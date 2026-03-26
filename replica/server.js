const express = require('express');
const cors = require('cors');
const raft = require('./raft');
const logManager = require('./logManager');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));  // changed

const REPLICA_ID = process.env.REPLICA_ID || 1;
const REPLICA_PORT = process.env.PORT || 3001;

// RAFT: Gateway forwards strokes here (to leader)
app.post('/append-log', async (req, res) => {
  const { stroke } = req.body;
  if (raft.state !== 'LEADER') {
    return res.status(403).json({ message: 'Not the leader' });
  }

  const entry = { term: raft.term, stroke };
  const index = logManager.append(entry);
  
  // Replication: In a real RAFT, leader waits for majority
  // Here we commit immediately for simplicity while heartbeats sync followers
  await logManager.commit(index);
  
  res.status(200).json({ status: 'Log appended', index });
});

// RAFT: Inter-replica appendEntries (Heartbeats & Replication)
app.post('/raft-append-entries', (req, res) => {
  const result = raft.handleAppendEntries(req.body);
  res.json(result);
});

// RAFT: Request for vote
app.post('/raft-request-vote', (req, res) => {
  const result = raft.handleVoteRequest(req.body);
  res.json(result);
});

// Leader status check for Gateway discovery
app.get('/status', (req, res) => {
  res.json({ id: REPLICA_ID, role: raft.state, term: raft.term });
});

// Sync log for restarted nodes
app.get('/sync-log', (req, res) => {
  res.json({ log: logManager.getLog() });
});

app.listen(REPLICA_PORT, () => {
  console.log(`Replica ${REPLICA_ID} running on port ${REPLICA_PORT}`);
  raft.init();
});
