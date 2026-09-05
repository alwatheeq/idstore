# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.13.0-slim

FROM node:${NODE_VERSION} AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ARG DEPLOYMENT_VERSION=unknown
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
ENV NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENV DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION}

RUN ["node", "-e", "if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) throw new Error('Supabase public build configuration is required')"]
RUN --mount=type=cache,target=/app/.next/cache npm run build

FROM base AS runner
WORKDIR /app

ARG DEPLOYMENT_VERSION=unknown
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
ENV DEPLOYMENT_VERSION=${DEPLOYMENT_VERSION}

RUN groupadd --gid 1001 nodejs
RUN useradd --uid 1001 --gid nodejs --no-create-home --home-dir /app --shell /usr/sbin/nologin nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "require('http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"]

CMD ["node", "server.js"]
