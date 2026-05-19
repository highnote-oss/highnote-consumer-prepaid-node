# Stage 1: Build web frontend
FROM node:22-alpine AS web-builder
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build API server
FROM node:22-alpine AS api-builder
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci --ignore-scripts
# Rebuild native modules (better-sqlite3, bcrypt) for Alpine
RUN npm rebuild better-sqlite3 bcrypt
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npx tsc

# Stage 3: Production runtime
FROM node:22-alpine
WORKDIR /app

# Copy compiled API + dependencies
COPY --from=api-builder /app/api/dist ./dist
COPY --from=api-builder /app/api/node_modules ./node_modules
COPY --from=api-builder /app/api/package.json ./

# Copy frontend build into public/ for @fastify/static
COPY --from=web-builder /app/web/dist ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
