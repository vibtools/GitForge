# Production Multi-Stage Dockerfile for GitForge
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install git and certificates required for GitHub repo sync and scan
RUN apk add --no-cache git ca-certificates wget

# Copy package manifests
COPY package.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend assets to dist/
RUN npm run build

# Set production environment defaults
ENV NODE_ENV=production
ENV PORT=3000

# Expose web service port
EXPOSE 3000

# Health check to verify Express and DB connectivity
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

# Start GitForge Express backend with compiled static SPA
CMD ["npm", "start"]
