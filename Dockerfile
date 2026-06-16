# Stage 1: Build web frontend
FROM node:22.22.3-alpine3.22 AS web-builder
# node:22 bundles npm 10.9.x, but our lockfiles are generated with npm 11.
# npm 10 can't reconcile npm 11's nested-dependency lockfile layout (e.g. the
# tsx-nested esbuild platform deps) and fails `npm ci` with "Missing from lock file".
RUN npm install -g npm@11
WORKDIR /app/web
COPY web/package*.json ./
RUN npm ci
COPY web/ ./
RUN npm run build

# Stage 2: Build API server
FROM node:22.22.3-alpine3.22 AS api-builder
# See web-builder above: match the npm 11 that generated package-lock.json.
RUN npm install -g npm@11
WORKDIR /app/api
COPY api/package*.json ./
RUN npm ci --ignore-scripts
# Rebuild native modules (better-sqlite3, bcrypt) for Alpine
RUN npm rebuild better-sqlite3 bcrypt
COPY api/tsconfig.json ./
COPY api/src ./src
RUN npx tsc

# Stage 3: Production runtime
FROM node:22.22.3-alpine3.22
WORKDIR /app

# Copy compiled API + dependencies
COPY --from=api-builder /app/api/dist ./dist
COPY --from=api-builder /app/api/node_modules ./node_modules
COPY --from=api-builder /app/api/package.json ./

# Copy frontend build into public/ for @fastify/static
COPY --from=web-builder /app/web/dist ./public

# Create data directory for SQLite
RUN mkdir -p /app/data

# Run as a non-root user; chown -R covers /app/data so SQLite can write its DB
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
CMD ["node", "dist/index.js"]
