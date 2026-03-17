const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const axios = require('axios');
const cors = require('cors');
const leaderManager = require('./leaderManager');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
  },
});

// Import routes and pass Socket.IO instance
const routes = require('./routes')(io);
app.use('/', routes);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('draw', async (stroke) => {
    try {
      const leaderUrl = leaderManager.getLeaderUrl();
      // Forward client's stroke to current leader
      await axios.post(`${leaderUrl}/append-log`, { stroke });
    } catch (error) {
      console.error('Error forwarding stroke to leader:', error.message);
      // Optional: attempt to discover new leader on failure
      await leaderManager.discoverLeader();
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Gateway service running on port ${PORT}`);
});
