# Build stage
FROM node:20-alpine AS builder

# Install dependencies needed for building
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

# Copy package files first for better caching
COPY package.json ./

# Clean any previous installations
RUN rm -rf node_modules && npm cache clean --force

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:20-alpine

# Install ffmpeg, runtime dependencies and build tools for rebuilding native modules
RUN apk add --no-cache \
    ffmpeg \
    curl \
    python3 \
    make \
    g++

WORKDIR /usr/src/app

# Copy package files
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built application from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Install node-pre-gyp globally and rebuild bcrypt for the target architecture
RUN npm install -g node-pre-gyp && npm rebuild bcrypt --build-from-source

# Create directory for CloudFront keys and set correct path
RUN mkdir -p /usr/src/app/keys
# The private_key.pem will be mounted via volume in docker-compose.yml

# Create directory for temporary files
RUN mkdir -p /tmp/videos && chmod 777 /tmp/videos

# Create a non-root user and use it
RUN addgroup -S nodejs && adduser -S nodejs -G nodejs

# Set permissions
RUN chown -R nodejs:nodejs /usr/src/app && \
    chown -R nodejs:nodejs /tmp/videos

# Set environment variables for temporary directory and CloudFront key path
ENV TEMP_VIDEO_DIR=/tmp/videos
ENV AWS_CLOUDFRONT_PRIVATE_KEY_PATH=/usr/src/app/keys/private_key.pem

# Switch to non-root user
USER nodejs

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:4000/health || exit 1

# Expose API port
EXPOSE 4000

# Start the app
CMD ["npm", "run", "start:prod"] 