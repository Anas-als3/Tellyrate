# syntax=docker/dockerfile:1
#
# Tellyrate — production image.
#
# Three stages so the runtime layer carries only what serves traffic: no npm,
# no source, no dev dependencies and no Prisma CLI. Next's standalone output
# traces the modules the server actually imports and copies them in, which is
# why the final stage has no `node_modules` install step of its own.

# ---------------------------------------------------------------------------
# 1. Dependencies
# ---------------------------------------------------------------------------
FROM node:24-alpine AS deps
WORKDIR /app

# The Prisma schema has to be present before `npm ci`: the postinstall hook
# runs `prisma generate`, which reads it.
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma

RUN npm ci

# ---------------------------------------------------------------------------
# 2. Build
# ---------------------------------------------------------------------------
FROM node:24-alpine AS builder
WORKDIR /app

# `NEXT_PUBLIC_*` values are inlined into the bundle at build time, so this one
# is a build argument rather than a runtime variable. Pass the real origin:
#   docker build --build-arg NEXT_PUBLIC_SITE_URL=https://tellyrate.example .
ARG NEXT_PUBLIC_SITE_URL=http://localhost:3000
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

# A syntactically valid placeholder. The build never connects to a database,
# but `lib/env.ts` validates the variable at module load and would otherwise
# fail the build. The real value is supplied to the container at runtime.
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build

ENV NEXT_TELEMETRY_DISABLED=1
ENV BUILD_STANDALONE=1

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Explicit rather than relying on the `build` script, so a failure here is
# obviously a client-generation failure rather than a Next.js one.
RUN npx prisma generate
RUN npx next build

# ---------------------------------------------------------------------------
# 3. Runtime
# ---------------------------------------------------------------------------
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
# Without this the standalone server binds to localhost inside the container
# and nothing outside it can reach the port.
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 --ingroup nodejs nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

# Node 24 has a global fetch, so the check needs no extra package in the image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
