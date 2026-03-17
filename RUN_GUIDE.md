# Running the Distributed Drawing Board

This guide explains how to run the project with multiple clients and how to manage the backend services.

## 1. Prerequisites
Ensure you have **Node.js** and **npm** installed on your machine.

---

## 2. Starting the Backend (Consensus Cluster)
If the services are not already running, open a terminal and run these commands to start the gateway and 3 RAFT replicas:

### Start Replicas
Open three separate terminals (or use background processes):
```bash
# Terminal 1: Replica 1
cd replica && REPLICA_ID=1 PORT=3001 node server.js

# Terminal 2: Replica 2
cd replica && REPLICA_ID=2 PORT=3002 node server.js

# Terminal 3: Replica 3
cd replica && REPLICA_ID=3 PORT=3003 node server.js
```

### Start Gateway
Open a fourth terminal:
```bash
# Terminal 4: Gateway
cd gateway && node server.js
```

---

## 3. Starting the Frontend
In a fifth terminal, start the React application:
```bash
cd frontend && PORT=8080 npm start
```

---

## 4. Running Multiple Clients
To simulate multiple users drawing simultaneously:
1.  Open your web browser.
2.  Navigate to `http://localhost:8080`.
3.  Open a **New Incognito/Private Window** or a **different browser** (e.g., Firefox and Chrome) and navigate to the same URL.
4.  Draw on one window; you will see the strokes replicated in real-time across all other windows.

---

## 5. Stopping the Services
To stop all running services gracefully:

### Method A: Using Terminal
In each terminal where a service is running, press `Ctrl + C`.

### Method B: Kill all Node processes (Unix/macOS)
If you started processes in the background and want to stop everything at once:
```bash
pkill -f node
```

### Method C: Check and Kill specific ports
If a port is "stuck," find the PID and kill it:
```bash
# Find PID for port 3000
lsof -ti:3000 | xargs kill -9
```
 lsof -ti:3000,3001,3002,3003,8080 | xargs kill -9
---

## 6. Verifying the Leader
You can check which replica is the current RAFT leader by visiting the status endpoints:
- `http://localhost:3001/status`
- `http://localhost:3002/status`
- `http://localhost:3003/status`

The one with `"role": "LEADER"` is handling the drawing data.
