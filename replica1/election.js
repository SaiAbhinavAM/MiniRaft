class ElectionManager {
  constructor(raftInstance) {
    this.raft = raftInstance;
    this.electionTimeout = null;
    this.heartbeatInterval = null;
  }

  resetElectionTimeout() {
    this.clearElectionTimeout();
    const timeout = Math.floor(Math.random() * 300) + 500; // 500-800ms
    this.electionTimeout = setTimeout(() => {
      this.raft.startElection();
    }, timeout);
  }

  clearElectionTimeout() {
    if (this.electionTimeout) clearTimeout(this.electionTimeout);
  }

  startHeartbeat() {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.raft.sendHeartbeats();
    }, 150); // Heartbeat every 150ms
  }

  clearHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
  }
}

module.exports = ElectionManager;
