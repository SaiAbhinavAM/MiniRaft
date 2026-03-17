# Replica Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Start replica
CMD ["node", "server.js"]
