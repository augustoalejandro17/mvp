# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files first for better layer caching
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build arguments and environment variables
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Output environment for debugging
RUN echo "Building with NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}"

# Build the application - ignore ESLint errors
ENV NEXT_ESLINT_IGNORE_ERRORS=1
RUN npm run build

# Production stage
FROM node:18-alpine

WORKDIR /app

# Copy environment variables from the builder
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Install only production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy built application from builder stage
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Add health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Use a non-root user
USER node

# Expose web port
EXPOSE 3000

# Start the application
CMD ["npm", "start"] 