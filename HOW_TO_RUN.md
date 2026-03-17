# How to Run and Verify the Distributed Drawing Board

This document provides step-by-step instructions on how to start the system and verify that all RAFT consensus and real-time drawing features are working correctly.

---

## 1. Quick Start (Recommended: Docker)

The easiest way to run the entire system is using **Docker Compose**. This will start the Gateway, three Replicas, and the Frontend.

### Run everything
```bash
docker-compose up -d --build
```

### Check status
- **Frontend**: [http://localhost:8080](http://localhost:8080)
- **Gateway Status**: [http://localhost:3000/status](http://localhost:3000/status)
- **Replica 1**: [http://localhost:3001/status](http://localhost:3001/status)
- **Replica 2**: [http://localhost:3002/status](http://localhost:3002/status)
- **Replica 3**: [http://localhost:3003/status](http://localhost:3003/status)

---

## 2. Manual Start (Without Docker)

If you prefer to run the services manually using Node.js, follow these steps in separate terminal windows:

### A. Start 3 Replicas
```bash
# Terminal 1: Replica 1
cd replica && \
  REPLICA_ID=1 PORT=3001 \
  MY_URL=http://localhost:3001 \
  REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 \
  GATEWAY_URL=http://localhost:3000 \
  node server.js

# Terminal 2: Replica 2
cd replica && \
  REPLICA_ID=2 PORT=3002 \
  MY_URL=http://localhost:3002 \
  REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 \
  GATEWAY_URL=http://localhost:3000 \
  node server.js

# Terminal 3: Replica 3
cd replica && \
  REPLICA_ID=3 PORT=3003 \
  MY_URL=http://localhost:3003 \
  REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 \
  GATEWAY_URL=http://localhost:3000 \
  node server.js
```

### B. Start Gateway
```bash
# Terminal 4: Gateway
cd gateway && node server.js
```

### C. Start Frontend
```bash
# Terminal 5: Frontend
cd frontend && PORT=8080 npm start
```

---

## 3. How to Verify Correct Implementation

### A. Verify Real-time Drawing
1.  Open [http://localhost:8080](http://localhost:8080) in **two different browser windows** (e.g., Chrome and Chrome Incognito).
2.  Draw a stroke in one window.
3.  **Correct behavior**: The stroke should appear instantly in the other window.

### B. Verify RAFT Leader Election
1.  Visit [http://localhost:3000/status](http://localhost:3000/status).
2.  Note which replica is the current `leader`.
3.  **Simulate failure**: Stop the leader container/process.
    ```bash
    docker stop replica1  # Replace with actual leader name
    ```
4.  Wait ~5-10 seconds.
5.  Refresh [http://localhost:3000/status](http://localhost:3000/status).
6.  **Correct behavior**: A new leader should have been elected from the remaining two replicas.

### C. Run Automated Test Scenarios
You can run tests using either Docker or locally:

**With Docker:**
```bash
chmod +x test-scenarios.sh
./test-scenarios.sh
```

**Locally (Without Docker):**
```bash
chmod +x test-scenarios-local.sh
./test-scenarios-local.sh
```
This script will:
- Start all services in the background.
- Identify the leader.
- Crash the leader.
- Verify a new leader is elected.
- Restart the old leader and verify it joins as a follower.
- Cleanup all processes at the end.

---

## 4. Stopping the Services
If using Docker:
```bash
docker-compose down
```
If running manually:
```bash
pkill -f node
```
