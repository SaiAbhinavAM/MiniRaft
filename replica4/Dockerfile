# Replica Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies (includes nodemon)
RUN npm install

# Copy source code
COPY . .

# Start with nodemon for hot-reload (bind mount will override source)
CMD ["npx", "nodemon", "--legacy-watch", "server.js"]
