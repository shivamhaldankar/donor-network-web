# Multi-stage Dockerfile for Pulse Donor Network
# Stage 1: Build the React frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Production server
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=5000

# Install server dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --omit=dev

# Copy server source code and database SQL files (for initDb script)
COPY server ./server
COPY database ./database

# Copy built frontend assets from stage 1
COPY --from=frontend-builder /app/web/dist ./web/dist

EXPOSE 5000

CMD ["node", "server/server.js"]
