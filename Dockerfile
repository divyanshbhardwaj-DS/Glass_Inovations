# Complete Glass Innovations — Dockerfile
# Node.js serves both the static frontend and the /api + /admin backend

FROM node:20-alpine

WORKDIR /app

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy all source files
COPY . .

# Expose Node server port
EXPOSE 3001

# Run the Node server (serves frontend as static + all API routes)
CMD ["node", "server/index.js"]