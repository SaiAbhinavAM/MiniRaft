class LeaderManager {
  constructor() {
    this.replicas = process.env.REPLICA_URLS 
      ? process.env.REPLICA_URLS.split(',') 
      : [
          'http://localhost:3001',
          'http://localhost:3002',
          'http://localhost:3003'
        ];
    this.currentLeaderUrl = this.replicas[0];
  }

  getLeaderUrl() {
    return this.currentLeaderUrl;
  }

  setLeaderUrl(url) {
    if (this.replicas.includes(url)) {
      this.currentLeaderUrl = url;
      console.log(`Leader updated to: ${url}`);
    }
  }

  // Logic to handle leader failure and discovery
  async discoverLeader() {
    for (const replica of this.replicas) {
      try {
        const response = await fetch(`${replica}/status`);
        const data = await response.json();
        if (data.role === 'LEADER') {
          this.setLeaderUrl(replica);
          return replica;
        }
      } catch (err) {
        console.error(`Failed to reach ${replica}`);
      }
    }
    return this.currentLeaderUrl;
  }
}

module.exports = new LeaderManager();
