# Running MiniRaft on Multiple Laptops (LAN)

This guide explains how to run the distributed drawing board across **multiple laptops on the same network**.

There are two common setups:

- **Option A (simplest)**: One laptop runs **Gateway + Replicas**, every other laptop runs **Frontend** (clients only).
- **Option B (true distributed cluster)**: Gateway runs on one laptop, and **each Replica runs on a different laptop**.

---

## 0. Prerequisites (all laptops)

- **Same Wi‑Fi / LAN**
- **Node.js + npm** installed
- This repo cloned on each laptop (or at least on the machines that run services)

You also need the **LAN IP addresses**:

### Find your IP
- **macOS**:
  - `System Settings → Network → Wi‑Fi → Details → IP Address`
  - or `ipconfig getifaddr en0`
- **Windows (PowerShell)**: `ipconfig`
- **Linux**: `ip a`

In this guide we’ll use example IPs:

- **Gateway/Host laptop**: `192.168.1.50`
- **Replica laptops** (Option B): `192.168.1.51`, `192.168.1.52`, `192.168.1.53`

---

## 1. Ports to allow (firewall/router)

Make sure these ports are reachable *to the machine(s) hosting them*:

- **Gateway**: `3000` (Socket.IO + REST endpoints)
- **Replicas**: `3001`, `3002`, `3003` (RAFT + append-log)
- **Frontend (if served to others)**: `8080` (React dev server)

On macOS you may need to allow incoming connections when prompted.

---

## Option A (recommended): One host runs backend, other laptops are clients

### A1. On the host laptop (example: `192.168.1.50`)

Start replicas:

```bash
cd replica

# Replica 1
REPLICA_ID=1 PORT=3001 \
MY_URL=http://192.168.1.50:3001 \
REPLICA_URLS=http://192.168.1.50:3001,http://192.168.1.50:3002,http://192.168.1.50:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

In two more terminals:

```bash
cd replica

# Replica 2
REPLICA_ID=2 PORT=3002 \
MY_URL=http://192.168.1.50:3002 \
REPLICA_URLS=http://192.168.1.50:3001,http://192.168.1.50:3002,http://192.168.1.50:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

```bash
cd replica

# Replica 3
REPLICA_ID=3 PORT=3003 \
MY_URL=http://192.168.1.50:3003 \
REPLICA_URLS=http://192.168.1.50:3001,http://192.168.1.50:3002,http://192.168.1.50:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

Start gateway:

```bash
cd gateway
node server.js
```

Optional: start frontend on the host so others can open it:

```bash
cd frontend
REACT_APP_GATEWAY_URL=http://192.168.1.50:3000 PORT=8080 npm start
```

### A2. On each client laptop

You have two choices:

#### Choice 1: Use the host’s frontend (easiest)

Open in the browser:

- `http://192.168.1.50:8080`

#### Choice 2: Run frontend locally (better dev experience per laptop)

```bash
cd frontend
REACT_APP_GATEWAY_URL=http://192.168.1.50:3000 PORT=8080 npm start
```

Then open:

- `http://localhost:8080`

---

## Option B: Replicas on separate laptops (distributed RAFT)

In this setup:

- Gateway runs on **one laptop**: `192.168.1.50:3000`
- Replica 1 runs on laptop A: `192.168.1.51:3001`
- Replica 2 runs on laptop B: `192.168.1.52:3002`
- Replica 3 runs on laptop C: `192.168.1.53:3003`

### B1. Start the gateway (on `192.168.1.50`)

```bash
cd gateway
node server.js
```

### B2. Start replicas (one per laptop)

#### Replica 1 (on `192.168.1.51`)

```bash
cd replica
REPLICA_ID=1 PORT=3001 \
MY_URL=http://192.168.1.51:3001 \
REPLICA_URLS=http://192.168.1.51:3001,http://192.168.1.52:3002,http://192.168.1.53:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

#### Replica 2 (on `192.168.1.52`)

```bash
cd replica
REPLICA_ID=2 PORT=3002 \
MY_URL=http://192.168.1.52:3002 \
REPLICA_URLS=http://192.168.1.51:3001,http://192.168.1.52:3002,http://192.168.1.53:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

#### Replica 3 (on `192.168.1.53`)

```bash
cd replica
REPLICA_ID=3 PORT=3003 \
MY_URL=http://192.168.1.53:3003 \
REPLICA_URLS=http://192.168.1.51:3001,http://192.168.1.52:3002,http://192.168.1.53:3003 \
GATEWAY_URL=http://192.168.1.50:3000 \
node server.js
```

### B3. Start the frontend (any laptop)

```bash
cd frontend
REACT_APP_GATEWAY_URL=http://192.168.1.50:3000 PORT=8080 npm start
```

Open:

- `http://localhost:8080`

---

## 2. Verify it’s working

- **Gateway status** (from any laptop): `http://192.168.1.50:3000/status`
- **Replica status**:
  - Option A: `http://192.168.1.50:3001/status` etc.
  - Option B:
    - `http://192.168.1.51:3001/status`
    - `http://192.168.1.52:3002/status`
    - `http://192.168.1.53:3003/status`

Real-time test:

- Open the frontend on **two different laptops**
- Draw on one laptop
- The strokes should appear on the other instantly

---

## 3. Common issues

### Browser connects to wrong gateway (still uses localhost)

Make sure frontend is started with:

```bash
REACT_APP_GATEWAY_URL=http://<GATEWAY_IP>:3000 npm start
```

### Nothing works across laptops

- Ensure everyone is on the same LAN
- Ensure ports `3000-3003` and `8080` are allowed through firewall
- Confirm you can ping the host IPs

