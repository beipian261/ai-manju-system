# ==============================
# AI Comic Drama System — Dockerfile
# Multi-stage: builder → runner
# ==============================

# ---------- Stage 1: Builder ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for better-sqlite3 native module
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --only=production=false

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ---------- Stage 2: Runner ----------
FROM node:20-alpine AS runner

WORKDIR /app

# Runtime deps for better-sqlite3
RUN apk add --no-cache python3 make g++ curl

# Copy production node_modules (re-install to purge devDeps)
COPY package*.json ./
RUN npm ci --only=production

# Copy build artifacts
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/public ./public
COPY --from=builder /app/package.json ./

# Generate Prisma client at runtime to match the bundled engine
RUN npx prisma generate

# Create non-root user
RUN addgroup --system --gid 1001 appgroup \
  && adduser --system --uid 1001 --ingroup appgroup appuser \
  && mkdir -p /app/data /app/prisma \
  && chown -R appuser:appgroup /app

USER appuser

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/auth/status || exit 1

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "start"]
