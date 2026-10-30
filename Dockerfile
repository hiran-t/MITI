# Stage 1: Dependencies
FROM node:22-alpine AS deps
WORKDIR /app

# Install exactly the locked dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# Stage 2: Builder
FROM node:22-alpine AS builder
WORKDIR /app

# Copy dependencies
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Leave empty to connect to foxglove_bridge on the host MITI is served from (port 8765);
# Next.js builds NEXT_PUBLIC_* values into the app, so this is a build argument.
ARG NEXT_PUBLIC_BRIDGE_URL=
ENV NEXT_PUBLIC_BRIDGE_URL=${NEXT_PUBLIC_BRIDGE_URL}

# Set environment variables for build
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV STANDALONE_BUILD=true

# Build the application (standalone output via STANDALONE_BUILD=true)
RUN npm run build

# Stage 3: Runner
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create a non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy necessary files from builder
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
