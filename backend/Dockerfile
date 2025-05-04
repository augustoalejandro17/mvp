# Build stage
FROM node:18 AS builder

# Install dependencies needed for building
RUN apt-get update && apt-get install -y \
    build-essential \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package*.json ./

# Clean any previous installations
RUN rm -rf node_modules && npm cache clean --force

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:18-slim

# Install ffmpeg and runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Create directory for temporary files
RUN mkdir -p /tmp/videos && chmod 777 /tmp/videos

# Create a non-root user and use it
RUN useradd -r nodejs && \
    chown -R nodejs:nodejs /usr/src/app && \
    chown -R nodejs:nodejs /tmp/videos

# Set environment variable for temporary directory
ENV TEMP_VIDEO_DIR=/tmp/videos

USER nodejs

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Expose API port
EXPOSE 4000

# Start the app
CMD ["npm", "run", "start:prod"] 