const axios = require('axios');
const logManager = require('./logManager');
const ElectionManager = require('./election');

class Raft {
  constructor() {
    this.id = process.env.REPLICA_ID || '1';
    this.term = 0;
    this.state = 'FOLLOWER'; // LEADER, FOLLOWER, CANDIDATE
    this.votedFor = null;
    this.election = new ElectionManager(this);
    this.replicas = (process.env.REPLICA_URLS
      ? process.env.REPLICA_URLS.split(',')
      : ['http://localhost:3001', 'http://localhost:3002', 'http://localhost:3003'])
      .filter(url => !url.includes(`:${3000 + parseInt(this.id)}`));
    this.nextIndex = {};
    this.blockedReplicas = new Set(); // For network partition simulation
  }

  init() {
    this.election.resetElectionTimeout();
    console.log(`Replica ${this.id} initialized as FOLLOWER`);
  }

  async startElection() {
    this.state = 'CANDIDATE';
    this.term += 1;
    this.votedFor = this.id;
    console.log(`Starting election for term ${this.term}`);
    this.election.clearHeartbeat();

    const totalReplicas = this.replicas.length + 1;
    const majority = Math.ceil(totalReplicas / 2);

    let votes = 1; // vote for self
    const votePromises = this.replicas
      .filter(url => !this.isBlocked(url))
      .map(url =>
        axios.post(`${url}/request-vote`, {
          term: this.term,
          candidateId: this.id,
          lastLogIndex: logManager.getLastLogIndex(),
          lastLogTerm: logManager.getLastLogTerm()
        }).catch(() => ({ data: { voteGranted: false } }))
      );

    const results = await Promise.all(votePromises);
    results.forEach(res => { if (res.data && res.data.voteGranted) votes++; });

    if (votes >= majority && this.state === 'CANDIDATE') {
      this.becomeLeader();
    } else {
      this.state = 'FOLLOWER';
      this.election.resetElectionTimeout();
    }
  }

  becomeLeader() {
    this.state = 'LEADER';
    console.log(`Replica ${this.id} became LEADER for term ${this.term}`);
    this.election.clearElectionTimeout();

    this.replicas.forEach(url => {
      this.nextIndex[url] = logManager.getLastLogIndex() + 1;
    });

    this.election.startHeartbeat();
    this.notifyGatewayOfLeaderChange();
  }

  // Replicate entry at `index` to followers and commit once majority acks
  async replicateAndCommit(index) {
    const entry = logManager.getLog()[index];
    if (!entry) return false;

    const totalReplicas = this.replicas.length + 1;
    const majority = Math.ceil(totalReplicas / 2);

    let acks = 1; // leader counts itself
    const promises = this.replicas
      .filter(url => !this.isBlocked(url))
      .map(async (url) => {
        try {
          const ni = this.nextIndex[url] || 0;
          const entries = logManager.getLog().slice(ni);
          const res = await axios.post(`${url}/append-entries`, {
            term: this.term,
            leaderId: this.id,
            prevLogIndex: ni - 1,
            entries,
            leaderCommit: logManager.commitIndex
          });
          if (res.data.success) {
            this.nextIndex[url] = ni + entries.length;
            acks++;
          } else if (res.data.needSync) {
            // Follower is behind — push missing entries via /sync-log
            await this._syncFollower(url, res.data.followerLogLength || 0);
          }
        } catch (_) {}
      });

    await Promise.all(promises);

    if (acks >= majority) {
      await logManager.commit(index);
      console.log(`Entry ${index} committed with ${acks} acks`);
      return true;
    }
    return false;
  }

  // Network partition simulation methods
  blockReplica(url) {
    this.blockedReplicas.add(url);
    console.log(`Replica ${this.id} blocking communication with ${url}`);
  }

  unblockReplica(url) {
    this.blockedReplicas.delete(url);
    console.log(`Replica ${this.id} unblocking communication with ${url}`);
  }

  unblockAllReplicas() {
    this.blockedReplicas.clear();
    console.log(`Replica ${this.id} unblocking all replicas`);
  }

  isBlocked(url) {
    return this.blockedReplicas.has(url);
  }

  // Push all committed entries from `fromIndex` onward to a lagging follower
  async _syncFollower(url, fromIndex) {
    if (this.isBlocked(url)) return;
    try {
      const entries = logManager.getLog().slice(fromIndex);
      if (entries.length === 0) return;
      await axios.post(`${url}/sync-log`, { fromIndex, entries });
      this.nextIndex[url] = fromIndex + entries.length;
      console.log(`Synced follower ${url} from index ${fromIndex}`);
    } catch (_) {}
  }

  async sendHeartbeats() {
    const promises = this.replicas
      .filter(url => !this.isBlocked(url))
      .map(async (url) => {
        const lastIndex = logManager.getLastLogIndex();
        const ni = this.nextIndex[url] !== undefined ? this.nextIndex[url] : 0;
        const entries = ni <= lastIndex ? logManager.getLog().slice(ni) : [];

        try {
          const res = await axios.post(`${url}/append-entries`, {
            term: this.term,
            leaderId: this.id,
            prevLogIndex: ni - 1,
            entries,
            leaderCommit: logManager.commitIndex
          });

          if (res.data.success) {
            this.nextIndex[url] = ni + entries.length;
          } else if (res.data.term > this.term) {
            this.term = res.data.term;
            this.state = 'FOLLOWER';
            this.election.clearHeartbeat();
            this.election.resetElectionTimeout();
          } else if (res.data.needSync) {
            // Follower needs catch-up
            await this._syncFollower(url, res.data.followerLogLength || 0);
          } else {
            this.nextIndex[url] = Math.max(0, ni - 1);
          }
        } catch (_) {}
      });
    await Promise.all(promises);
  }

  async notifyGatewayOfLeaderChange() {
    if (!process.env.GATEWAY_URL) return;
    try {
      const myUrl = process.env.MY_URL || `http://localhost:${3000 + parseInt(this.id)}`;
      await axios.post(`${process.env.GATEWAY_URL}/leader-update`, { leaderUrl: myUrl });
    } catch (_) {
      console.error('Failed to notify gateway of leader change');
    }
  }

  handleVoteRequest(data) {
    const { term, candidateId } = data;
    if (term > this.term) {
      this.term = term;
      this.state = 'FOLLOWER';
      this.votedFor = null;
    }
    const canVote = !this.votedFor || this.votedFor === candidateId;
    if (term >= this.term && canVote) {
      this.votedFor = candidateId;
      this.election.resetElectionTimeout();
      return { term: this.term, voteGranted: true };
    }
    return { term: this.term, voteGranted: false };
  }

  handleAppendEntries(data) {
    const { term, leaderId, prevLogIndex, entries, leaderCommit } = data;

    if (term < this.term) {
      return { term: this.term, success: false };
    }

    // Valid leader — reset to follower
    this.term = term;
    this.state = 'FOLLOWER';
    this.election.resetElectionTimeout();

    // Catch-up check: if prevLogIndex is ahead of our log, signal leader to sync us
    if (prevLogIndex >= 0 && prevLogIndex >= logManager.getLog().length) {
      return {
        term: this.term,
        success: false,
        needSync: true,
        followerLogLength: logManager.getLog().length
      };
    }

    if (entries && entries.length > 0) {
      logManager.appendEntries(prevLogIndex + 1, entries);
    }

    if (leaderCommit > logManager.commitIndex) {
      const commitTo = Math.min(leaderCommit, logManager.getLastLogIndex());
      logManager.commit(commitTo);
    }

    return { term: this.term, success: true };
  }
}

module.exports = new Raft();
