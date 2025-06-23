FROM node:18-alpine

# Install ffmpeg and other dependencies
RUN apk add --no-cache \
    ffmpeg \
    curl \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy worker source code
COPY . .

# Create temp directory for video processing
RUN mkdir -p /tmp/videos && chmod 777 /tmp/videos

# Create a non-root user
RUN addgroup -S worker && adduser -S worker -G worker

# Set permissions
RUN chown -R worker:worker /usr/src/app && \
    chown -R worker:worker /tmp/videos

# Switch to non-root user
USER worker

# Set environment variables
ENV NODE_ENV=production
ENV TEMP_VIDEO_DIR=/tmp/videos

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD ps aux | grep "node index.js" | grep -v grep || exit 1

# Start the worker
CMD ["npm", "start"] 