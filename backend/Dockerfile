# ── Backend Production Dockerfile (multi-stage) ──────────────────────────────
#
# Stage 1 (builder): install ALL deps, generate Prisma client, compile TS → JS
# Stage 2 (runner):  copy only the compiled dist + prod node_modules → slim image

# ── Stage 1: builder ─────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies (all, including devDeps needed for build)
COPY package*.json ./
RUN npm ci

# Prisma schema + config — needed for client generation
COPY prisma ./prisma
COPY prisma.config.ts ./

# Generate Prisma client
RUN npx prisma generate

# Copy source and config files, then compile
COPY tsconfig*.json nest-cli.json ./
COPY src ./src

# Build NestJS app (outputs to dist/ via rootDir:"src" in tsconfig.build.json)
RUN npm run build

# ── Stage 2: runner ───────────────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

# Production dependencies + ts-node for seed script
COPY package*.json ./
RUN npm ci --omit=dev && npm install --no-save ts-node

# Prisma schema + config needed for `prisma migrate deploy` at startup
COPY prisma ./prisma
COPY prisma.config.ts ./

# Regenerate Prisma client against the prod node_modules
RUN npx prisma generate

# Compiled application from builder
COPY --from=builder /app/dist ./dist

# Non-root user for security
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
USER appuser

EXPOSE 3000

# Run migrations, seed (idempotent), then start the compiled server
CMD ["sh", "-c", "npx prisma migrate deploy && npx ts-node prisma/seed.prod.ts && node dist/main"]
