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
    this.nextIndex = {}; // Track next log index for each replica
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
    this.election.clearHeartbeat(); // Stop heartbeats if we were leader

    let votes = 1; // Vote for self
    const votePromises = this.replicas.map(url => 
      axios.post(`${url}/raft-request-vote`, {
        term: this.term,
        candidateId: this.id,
        lastLogIndex: logManager.getLastLogIndex(),
        lastLogTerm: logManager.getLastLogTerm()
      }).catch(() => ({ data: { voteGranted: false } }))
    );

    const results = await Promise.all(votePromises);
    results.forEach(res => { if (res.data.voteGranted) votes++; });

    if (votes >= 2 && this.state === 'CANDIDATE') { // Majority for 3-node cluster
      this.becomeLeader();
    } else {
      this.election.resetElectionTimeout();
    }
  }

  becomeLeader() {
    this.state = 'LEADER';
    console.log(`Replica ${this.id} became LEADER`);
    this.election.clearElectionTimeout(); // Stop election timeout
    
    // Initialize nextIndex for each follower to leader's last index + 1
    this.replicas.forEach(url => {
      this.nextIndex[url] = logManager.getLastLogIndex() + 1;
    });

    this.election.startHeartbeat();
    this.notifyGatewayOfLeaderChange();
  }

  async sendHeartbeats() {
    const promises = this.replicas.map(async (url) => {
      const lastIndex = logManager.getLastLogIndex();
      const ni = this.nextIndex[url] || 0;
      
      // Collect entries to send
      const entries = ni <= lastIndex ? logManager.getLog().slice(ni) : [];

      try {
        const res = await axios.post(`${url}/raft-append-entries`, {
          term: this.term,
          leaderId: this.id,
          prevLogIndex: ni - 1,
          entries: entries,
          leaderCommit: logManager.commitIndex
        });

        if (res.data.success) {
          this.nextIndex[url] = ni + entries.length;
        } else if (res.data.term > this.term) {
          // Found higher term, step down
          this.term = res.data.term;
          this.state = 'FOLLOWER';
          this.election.resetElectionTimeout();
        } else {
          // Log mismatch, decrement nextIndex and retry
          this.nextIndex[url] = Math.max(0, ni - 1);
        }
      } catch (err) {
        // Just skip if follower is down
      }
    });
    await Promise.all(promises);
  }

  async notifyGatewayOfLeaderChange() {
    if (!process.env.GATEWAY_URL) return;
    try {
      const gatewayUrl = process.env.GATEWAY_URL;
      const myUrl = process.env.MY_URL || `http://localhost:${3000 + parseInt(this.id)}`;
      await axios.post(`${gatewayUrl}/leader-update`, { 
        leaderUrl: myUrl 
      });
    } catch (err) {
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
    if (term >= this.term) {
      this.term = term;
      this.state = 'FOLLOWER';
      this.election.resetElectionTimeout();
      
      // Append entries to log
      if (entries && entries.length > 0) {
        logManager.appendEntries(prevLogIndex + 1, entries);
      }

      // Follower commits log if leader has committed more
      if (leaderCommit > logManager.commitIndex) {
        // Commit only up to the last entry we have
        const commitTo = Math.min(leaderCommit, logManager.getLastLogIndex());
        logManager.commit(commitTo);
      }
      return { term: this.term, success: true };
    }
    return { term: this.term, success: false };
  }
}

module.exports = new Raft();
