# Frontend Dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# React default port
EXPOSE 3000

# Start app
CMD ["npm", "start"]
