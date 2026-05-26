# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY backend/package*.json ./backend/

# Install dependencies
RUN npm install
RUN cd backend && npm install

# Copy source code
COPY . .

# Build backend
RUN cd backend && npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Install production dependencies only
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --only=production

# Copy built application from builder
COPY --from=builder /app/backend/dist ./backend/dist
COPY --from=builder /app/backend/prisma ./backend/prisma

# Expose port (adjust if different)
EXPOSE 3001

# Set environment
ENV NODE_ENV=production

# Start the server
CMD ["node", "backend/dist/index.js"]
