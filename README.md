# MiniRaft Distributed Drawing Board

An interactive, real-time collaborative drawing application built on top of a highly available distributed backend leveraging the **RAFT Consensus Algorithm**.

MiniRaft demonstrates how modern collaborative tools (like Google Jamboard or Miro) handle complex state synchronization across multiple concurrent connections while ensuring fault tolerance through a robust distributed systems architecture.

---

## 🏗️ Architecture Overview

The system is designed with a microservices-inspired architecture to separate client management from state consensus:

1. **Frontend (React)**: High-performance HTML5 Canvas interface with real-time WebSocket bindings. Implements strict, zero-leakage state isolation across multiple frames (workspaces).
2. **Gateway Service (Node.js)**: Acts as a reverse proxy, WebSocket orchestrator, and leader discovery agent. It routes incoming client mutations to the active RAFT leader and broadcasts committed state changes exclusively to frame-specific socket rooms.
3. **Replica Cluster (3x Node.js Nodes)**: The core state machine. Nodes participate in leader elections, handle append-entries requests, and manage a durable, replicated transaction log to guarantee consistency even in the event of node failures.

---

## ✨ Technical Features

* **RAFT Consensus Implementation**: Full implementation of Leader Election, Log Replication, Heartbeats, and State Machine synchronization.
* **Resilient State Management**: Capable of surviving single-node failures. Automatic leader re-election and delayed follower sync/catch-up mechanisms.
* **Strict Frame Isolation**: Workspaces (frames) are treated as isolated state instances. State is dynamically cached on the client and strictly partitioned via Socket.IO rooms on the Gateway, allowing users to collaborate on different boards concurrently without data leakage.
* **Real-Time Data Flow**: Sub-100ms synchronization of canvas strokes, vector shapes, text elements, and draggable sticky notes.
* **Conflict Resolution**: The RAFT leader serializes all incoming strokes into a linear log, providing a single source of truth and preventing race conditions between concurrent users.

---

## 🛠️ Technology Stack

* **Frontend**: React, HTML5 Canvas API, Framer Motion (animations), Lucide (icons)
* **Backend**: Node.js, Express, Socket.IO
* **Infrastructure**: Docker, Docker Compose (isolated bridge network)
* **Networking**: WebSockets for client-to-gateway multiplexing, Axios/HTTP for internal cluster RPCs (Remote Procedure Calls).

---

## 🚀 Getting Started

The entire stack is containerized for deterministic deployment.

### Prerequisites
* Docker (v20.10+)
* Docker Compose (v3.8+)

### Deployment

1. **Clone & Spin up the cluster**:
   ```bash
   docker-compose up -d --build
   ```

2. **Access the Application**:
   * **Frontend UI**: `http://localhost:8080`
   * **Gateway Status**: `http://localhost:3000/status`
   * **Replica Nodes**: Ports `3001`, `3002`, `3003`

### Node Failure Simulation (Testing Fault Tolerance)
You can test the RAFT protocol's resilience by killing the current leader node:
```bash
# Check the gateway to see the current leader port
curl http://localhost:3000/status

# Stop the respective replica container (e.g., replica2)
docker stop replica2

# Watch the remaining containers negotiate a new leader
docker logs -f replica1
```

---

## 🔄 Data Lifecycle (Stroke Commit Flow)

1. **Client Action**: User draws a stroke on Frame N.
2. **Gateway Reception**: Gateway receives the payload via `socket.on('draw')`.
3. **Leader Forwarding**: Gateway identifies the current RAFT Leader and synchronously POSTs to `/append-log`.
4. **Log Replication**: Leader appends to its local log and propagates `AppendEntries` RPCs to followers.
5. **Commitment**: Once a quorum (majority) acknowledges the entry, the Leader commits the log and notifies the Gateway via `/commit`.
6. **Scoped Broadcast**: The Gateway emits the committed stroke exclusively to clients joined to the `frame-N` Socket room.
