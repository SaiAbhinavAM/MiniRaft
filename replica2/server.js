const express = require('express');
const cors = require('cors');
const raft = require('./raft');
const logManager = require('./logManager');

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));

const REPLICA_ID = process.env.REPLICA_ID || 1;
const REPLICA_PORT = process.env.PORT || 3001;

// ─── RAFT RPC endpoints (spec-named) ───────────────────────────────────────

// /request-vote  (spec name)
app.post('/request-vote', (req, res) => {
  const result = raft.handleVoteRequest(req.body);
  res.json(result);
});

// /append-entries  (spec name)
app.post('/append-entries', (req, res) => {
  const result = raft.handleAppendEntries(req.body);
  res.json(result);
});

// /heartbeat  (spec name)
app.post('/heartbeat', (req, res) => {
  const result = raft.handleAppendEntries({ ...req.body, entries: [] });
  res.json(result);
});

// /sync-log POST — leader pushes missing committed entries to a rejoining follower
app.post('/sync-log', (req, res) => {
  const { fromIndex, entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.json({ status: 'nothing to sync' });
  }
  logManager.appendEntries(fromIndex, entries);
  const newCommit = fromIndex + entries.length - 1;
  if (newCommit > logManager.commitIndex) {
    logManager.commit(newCommit);
  }
  console.log(`Replica ${REPLICA_ID} synced ${entries.length} entries from index ${fromIndex}`);
  res.json({ status: 'synced', count: entries.length });
});

// ─── Legacy aliases (keep existing code working) ────────────────────────────
app.post('/raft-append-entries', (req, res) => {
  const result = raft.handleAppendEntries(req.body);
  res.json(result);
});
app.post('/raft-request-vote', (req, res) => {
  const result = raft.handleVoteRequest(req.body);
  res.json(result);
});

// ─── Gateway → Leader stroke endpoint ───────────────────────────────────────
app.post('/append-log', async (req, res) => {
  const { stroke } = req.body;
  if (raft.state !== 'LEADER') {
    return res.status(403).json({ message: 'Not the leader' });
  }
  const entry = { term: raft.term, stroke };
  const index = logManager.append(entry);

  // Wait for majority acknowledgment before committing
  const committed = await raft.replicateAndCommit(index);
  if (committed) {
    res.status(200).json({ status: 'Log appended and committed', index });
  } else {
    res.status(200).json({ status: 'Log appended (commit pending)', index });
  }
});

// ─── Status ──────────────────────────────────────────────────────────────────
app.get('/status', (req, res) => {
  res.json({
    id: REPLICA_ID,
    role: raft.state,
    term: raft.term,
    logLength: logManager.getLog().length,
    commitIndex: logManager.commitIndex
  });
});

// GET /sync-log?from=N  — read committed log from index N onward
app.get('/sync-log', (req, res) => {
  const from = parseInt(req.query.from) || 0;
  const log = logManager.getLog();
  res.json({ log: log.slice(from), fromIndex: from });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(REPLICA_PORT, () => {
  console.log(`Replica ${REPLICA_ID} running on port ${REPLICA_PORT}`);
  raft.init();
});
