# Architecture Report: Distributed Drawing Board

## 1. Introduction
The **Distributed Drawing Board** is a collaborative real-time application that allows multiple users to draw on a shared canvas. To ensure high availability and consistency, the system implements the **RAFT Consensus Algorithm** for managing replicated state across multiple server nodes.

---

## 2. System Architecture
The system follows a microservices-inspired architecture consisting of four main layers:

1.  **Frontend (React Application)**:
    - Provides a collaborative drawing interface using HTML5 Canvas.
    - Connects to the Gateway via WebSocket (`socket.io`) for real-time stroke updates.
2.  **Gateway Service (Reverse Proxy & Leader Discovery)**:
    - Serves as the primary entry point for client connections.
    - Maintains WebSocket sessions with all active clients.
    - Forwards drawing strokes to the current RAFT Leader.
    - Broadcasts committed strokes to all connected clients.
3.  **Replica Cluster (RAFT Nodes)**:
    - A set of three nodes that participate in the RAFT consensus protocol.
    - Each node maintains a replicated log of drawing strokes.
    - One node acts as the **Leader**, while others act as **Followers**.
4.  **Networking**:
    - Internal communication between replicas and the gateway is handled via a Docker bridge network.

---

## 3. Component Diagram
```mermaid
graph TD
    UserA[Client A] -- WebSocket --> GW[Gateway Service]
    UserB[Client B] -- WebSocket --> GW
    
    GW -- Forward Stroke (HTTP) --> R1[Replica 1 (Leader)]
    
    R1 -- AppendEntries (Heartbeats/Log) --> R2[Replica 2 (Follower)]
    R1 -- AppendEntries (Heartbeats/Log) --> R3[Replica 3 (Follower)]
    
    R1 -- Notify Commit (HTTP) --> GW
    GW -- Broadcast Stroke --> UserA
    GW -- Broadcast Stroke --> UserB
```

---

## 4. RAFT State Transitions
The system strictly follows the RAFT state machine for consensus. Each replica can be in one of three states:

-   **Follower**: The default state. Replicas expect regular heartbeats from the Leader. If no heartbeat is received within a randomized election timeout (500-800ms), the replica transitions to **Candidate**.
-   **Candidate**: The replica increments its term and requests votes from its peers. If it receives a majority of votes (2 out of 3), it transitions to **Leader**.
-   **Leader**: The Leader handles all client write requests (drawing strokes) and replicates them to Followers via `AppendEntries` messages. It also sends periodic heartbeats (150ms) to maintain leadership.

**Transition Rules**:
-   **Follower -> Candidate**: Heartbeat timeout.
-   **Candidate -> Leader**: Majority votes received.
-   **Candidate -> Follower**: New Leader discovered or higher term encountered.
-   **Leader -> Follower**: Higher term encountered (e.g., after a network partition resolves).

---

## 5. Data Flow
The lifecycle of a single drawing stroke follows these steps:

1.  **Action**: User draws a line on the Frontend.
2.  **Emission**: Frontend emits a `draw` event to the **Gateway**.
3.  **Forwarding**: Gateway identifies the current **Leader** and performs an HTTP POST to `/append-log`.
4.  **Replication**: The Leader appends the stroke to its local log and sends heartbeats with log entries to **Followers**.
5.  **Commitment**: Once the Leader determines the log entry is safely replicated (or for simplification in this prototype, immediately), it commits the stroke.
6.  **Broadcast**: The Leader notifies the **Gateway** via the `/commit` endpoint.
7.  **Synchronization**: The Gateway broadcasts the stroke to all connected WebSockets, ensuring all users see the new line.

---

## 6. Failure Handling
The system is designed to be resilient to single-node failures:

-   **Leader Failure**: If the Leader crashes, Followers will stop receiving heartbeats. The randomized timeout ensures one Follower will time out first and start a new election. The Gateway uses a `leaderManager` to re-discover the new Leader by querying `/status` endpoints.
-   **Follower Failure**: The cluster remains operational as long as a quorum (majority) is maintained.
-   **Network Partition**: Nodes in the minority partition will fail to reach consensus. Once the partition is healed, nodes with lower terms will automatically revert to Followers and synchronize their logs with the majority Leader.

---

## 7. Docker Deployment Instructions
The project is containerized using Docker and orchestrated with Docker Compose for easy deployment.

### Prerequisites
- Docker (v20.10+)
- Docker Compose (v3.8+)

### Steps to Deploy
1.  **Build and Start**: Run the following command from the root directory:
    ```bash
    docker-compose up --build
    ```
2.  **Access the Application**:
    - **Frontend**: Open `http://localhost:8080` in your browser.
    - **Gateway**: Accessible at `http://localhost:3000`.
    - **Replicas**: Ports `3001`, `3002`, and `3003` are mapped for direct status checks.
3.  **Verify Cluster Health**:
    - Check the logs to see the election process: `docker-compose logs -f replica1`
    - Verify leader status: `curl http://localhost:3000/leader-update` (internal check) or check replica status directly.

---

## 8. Conclusion
The distributed drawing board demonstrates a robust implementation of the RAFT protocol. By decoupling the client-facing gateway from the consensus-driven replica cluster, the system achieves both real-time performance and fault-tolerant state management.
