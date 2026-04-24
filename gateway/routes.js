const express = require('express');
const router = express.Router();
const leaderManager = require('./leaderManager');
const axios = require('axios');

module.exports = (io) => {
  // Replicas call this to broadcast committed strokes
  router.post('/commit', (req, res) => {
    const { stroke } = req.body;
    if (stroke) {
      // Broadcast to frame-specific room if frameId is present, else global
      if (stroke.frameId !== undefined) {
        io.to(`frame-${stroke.frameId}`).emit('draw', stroke);
      } else {
        io.emit('draw', stroke);
      }
      return res.status(200).json({ status: 'broadcasted' });
    }
    res.status(400).json({ error: 'Stroke data missing' });
  });

  // Replicas can notify gateway if leadership changes
  router.post('/leader-update', (req, res) => {
    const { leaderUrl } = req.body;
    leaderManager.setLeaderUrl(leaderUrl);
    res.sendStatus(200);
  });

  // Client status check to find current leader
  router.get('/status', (req, res) => {
    res.json({ leader: leaderManager.getLeaderUrl() });
  });

  // Get all replicas' statuses for dashboard
  router.get('/cluster-status', async (req, res) => {
    const replicaStatuses = [];
    for (const url of leaderManager.replicas) {
      try {
        const response = await axios.get(`${url}/status`, { timeout: 1000 });
        replicaStatuses.push({ ...response.data, url, healthy: true });
      } catch (err) {
        replicaStatuses.push({ url, healthy: false, error: err.message });
      }
    }
    res.json({ 
      leader: leaderManager.getLeaderUrl(), 
      replicas: replicaStatuses 
    });
  });

  return router;
};
