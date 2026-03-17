#!/bin/bash

# Test scenarios for Distributed Drawing Board

# 1. Start all services
echo "Checking if Docker daemon is running..."
if ! docker info >/dev/null 2>&1; then
    echo "ERROR: Cannot connect to the Docker daemon. Please ensure Docker is running."
    exit 1
fi

echo "Starting all services..."
docker-compose up -d --build

echo "Wait for system to initialize..."
sleep 10

# 2. Check current leader
echo "Checking current leader via Gateway discovery..."
STATUS_RESPONSE=$(curl -s http://localhost:3000/status)
LEADER_URL=$(echo "$STATUS_RESPONSE" | grep -o 'http://[^"]*' | head -n 1)

if [ -z "$LEADER_URL" ]; then
    echo "ERROR: Could not find current leader. Is the Gateway running?"
    exit 1
fi
echo "Current Leader: $LEADER_URL"

# 3. Leader Crash Scenario
echo "Scenario: Leader Crash"
# Map URL to container name (e.g., http://replica1:3001 -> replica1)
LEADER_NAME=$(echo $LEADER_URL | sed -E 's/http:\/\/([^:]+):.*/\1/')

if [ -z "$LEADER_NAME" ]; then
    echo "ERROR: Could not parse leader container name from URL: $LEADER_URL"
    exit 1
fi

echo "Stopping $LEADER_NAME..."
docker stop $LEADER_NAME

echo "Wait for re-election..."
sleep 15

echo "Checking for new leader..."
NEW_LEADER=$(curl -s http://localhost:3000/status | grep -o 'http://[^"]*' | head -n 1)
echo "New Leader: $NEW_LEADER"

# 4. Replica Restart & Log Sync
echo "Scenario: Replica Restart"
echo "Restarting $LEADER_NAME..."
docker start $LEADER_NAME

echo "Wait for log synchronization..."
sleep 5
echo "$LEADER_NAME should now be a follower and sync logs from the new leader."

# 5. Full Status Check
docker-compose ps
