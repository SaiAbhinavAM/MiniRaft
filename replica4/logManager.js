const axios = require('axios');

class LogManager {
  constructor() {
    this.log = [];
    this.commitIndex = -1;
    this.gatewayUrl = process.env.GATEWAY_URL || null;
    this.isCommitting = false;
  }

  append(entry) {
    this.log.push(entry);
    return this.log.length - 1;
  }

  appendEntries(startIndex, entries) {
    for (let i = 0; i < entries.length; i++) {
      const index = startIndex + i;
      if (!this.log[index] || this.log[index].term !== entries[i].term) {
        this.log[index] = entries[i];
      }
    }
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
        this.commitIndex = i;

        if (!this.gatewayUrl) continue;

        // FIX: removed 5-second cooldown that was silently dropping strokes
        try {
          await axios.post(`${this.gatewayUrl}/commit`, { stroke: entry.stroke });
        } catch (err) {
          console.error('Failed to notify gateway of commit:', err.message);
          // Retry once after short delay
          await new Promise(r => setTimeout(r, 100));
          try {
            await axios.post(`${this.gatewayUrl}/commit`, { stroke: entry.stroke });
          } catch (_) {}
        }
      }
    } finally {
      this.isCommitting = false;
    }
  }

  getLog() { return this.log; }
  getLastLogIndex() { return this.log.length - 1; }
  getLastLogTerm() {
    if (this.log.length === 0) return 0;
    return this.log[this.log.length - 1].term;
  }
}

module.exports = new LogManager();
