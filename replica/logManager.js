const axios = require('axios');

class LogManager {
  constructor() {
    this.log = [];
    this.commitIndex = -1;
    // Only notify the gateway when explicitly configured.
    // In docker-compose, GATEWAY_URL is set to http://gateway:3000.
    // When running a replica standalone, leaving this unset avoids DNS errors.
    this.gatewayUrl = process.env.GATEWAY_URL || null;
    this.isCommitting = false;
    this._lastGatewayErrorAtMs = 0;
    this._gatewayErrorCooldownMs = 5000;
  }

  append(entry) {
    this.log.push(entry);
    return this.log.length - 1;
  }

  appendEntries(startIndex, entries) {
    // Basic log append for followers
    // In a full RAFT, we would check for term mismatches and truncate
    for (let i = 0; i < entries.length; i++) {
      const index = startIndex + i;
      if (!this.log[index] || this.log[index].term !== entries[i].term) {
        this.log[index] = entries[i];
      }
    }
    // Truncate if there's extra stuff (simplified)
    if (this.log.length > startIndex + entries.length) {
      this.log.length = startIndex + entries.length;
    }
  }

  async commit(index) {
    if (index <= this.commitIndex || this.isCommitting) return;
    
    this.isCommitting = true;
    try {
      for (let i = this.commitIndex + 1; i <= index; i++) {
        const entry = this.log[i];
        if (!entry) break; 

        console.log(`Committing entry at index ${i}`);
        // Always advance local commit index; gateway notification is best-effort.
        this.commitIndex = i;

        if (!this.gatewayUrl) continue;

        // Avoid spamming logs if the gateway is down or misconfigured.
        const now = Date.now();
        if (now - this._lastGatewayErrorAtMs < this._gatewayErrorCooldownMs) continue;

        try {
          await axios.post(`${this.gatewayUrl}/commit`, { stroke: entry.stroke });
        } catch (err) {
          this._lastGatewayErrorAtMs = now;
          console.error('Failed to notify gateway of commit:', err.message);
        }
      }
    } finally {
      this.isCommitting = false;
    }
  }

  getLog() {
    return this.log;
  }

  getLastLogIndex() {
    return this.log.length - 1;
  }

  getLastLogTerm() {
    if (this.log.length === 0) return 0;
    return this.log[this.log.length - 1].term;
  }
}

module.exports = new LogManager();
