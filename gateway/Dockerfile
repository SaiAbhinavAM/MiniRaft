# Gateway Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Gateway default port
EXPOSE 3000

# Start server
CMD ["node", "server.js"]
