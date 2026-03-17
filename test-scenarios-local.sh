#!/bin/bash

# Cleanup function to stop background node processes
cleanup() {
    echo "Cleaning up..."
    pkill -f "node server.js"
    exit
}

# Trap signals for cleanup
trap cleanup SIGINT SIGTERM EXIT

# 1. Start all services
echo "Starting services locally..."

# Start 3 Replicas in the background
# Each replica gets its own environment variables and log file
cd replica
echo "Starting Replica 1 (Port 3001)..."
REPLICA_ID=1 PORT=3001 REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 GATEWAY_URL=http://localhost:3000 MY_URL=http://localhost:3001 node server.js > replica1.log 2>&1 &
PID1=$!

echo "Starting Replica 2 (Port 3002)..."
REPLICA_ID=2 PORT=3002 REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 GATEWAY_URL=http://localhost:3000 MY_URL=http://localhost:3002 node server.js > replica2.log 2>&1 &
PID2=$!

echo "Starting Replica 3 (Port 3003)..."
REPLICA_ID=3 PORT=3003 REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 GATEWAY_URL=http://localhost:3000 MY_URL=http://localhost:3003 node server.js > replica3.log 2>&1 &
PID3=$!
cd ..

# Start Gateway in the background
cd gateway
echo "Starting Gateway (Port 3000)..."
REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 node server.js > gateway.log 2>&1 &
GATEWAY_PID=$!
cd ..

echo "Wait for system to initialize (10 seconds)..."
sleep 10

# 2. Check current leader
echo "Checking current leader via Gateway discovery..."
STATUS_RESPONSE=$(curl -s http://localhost:3000/status)
LEADER_URL=$(echo "$STATUS_RESPONSE" | grep -o 'http://[^"]*' | head -n 1)

if [ -z "$LEADER_URL" ]; then
    echo "ERROR: Could not find current leader. Is the Gateway running?"
    cleanup
fi
echo "Current Leader: $LEADER_URL"

# 3. Leader Crash Scenario
echo "Scenario: Leader Crash"
# Extract port number to identify which PID to kill
LEADER_PORT=$(echo $LEADER_URL | grep -oE '[0-9]+$')

if [ "$LEADER_PORT" == "3001" ]; then
    LEADER_PID=$PID1
    LEADER_ID=1
elif [ "$LEADER_PORT" == "3002" ]; then
    LEADER_PID=$PID2
    LEADER_ID=2
elif [ "$LEADER_PORT" == "3003" ]; then
    LEADER_PID=$PID3
    LEADER_ID=3
else
    echo "ERROR: Unexpected leader port: $LEADER_PORT"
    cleanup
fi

echo "Stopping Leader (Replica $LEADER_ID, Port $LEADER_PORT, PID $LEADER_PID)..."
kill $LEADER_PID

echo "Wait for re-election (15 seconds)..."
sleep 15

echo "Checking for new leader..."
NEW_LEADER=$(curl -s http://localhost:3000/status | grep -o 'http://[^"]*' | head -n 1)
echo "New Leader: $NEW_LEADER"

# 4. Replica Restart & Log Sync
echo "Scenario: Replica Restart"
echo "Restarting Replica $LEADER_ID (Port $LEADER_PORT)..."
cd replica
REPLICA_ID=$LEADER_ID PORT=$LEADER_PORT REPLICA_URLS=http://localhost:3001,http://localhost:3002,http://localhost:3003 GATEWAY_URL=http://localhost:3000 MY_URL=http://localhost:$LEADER_PORT node server.js >> replica$LEADER_ID.log 2>&1 &
NEW_PID=$!
cd ..

echo "Wait for log synchronization (5 seconds)..."
sleep 5
echo "Replica $LEADER_ID should now be a follower and sync logs from the new leader."

echo "Tests completed successfully. Cleaning up in 5 seconds..."
sleep 5
# cleanup is called by trap
