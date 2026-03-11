# ---------- base ----------
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.30.2 --activate
# Install system dependencies for Prisma
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# ---------- deps ----------
FROM base AS deps
# Create the directory for Prisma Client output as per schema.prisma
RUN mkdir -p src/generated/prisma
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# Use a cache mount for pnpm store to speed up builds
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile

# ---------- build ----------
FROM base AS build
RUN mkdir -p src/generated/prisma
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/src/generated/prisma ./src/generated/prisma
COPY . .
# Build the application
RUN pnpm run build
# Ensure all prisma assets (binaries, engines) are in dist/generated/prisma
RUN mkdir -p dist/generated && cp -R src/generated/prisma dist/generated/
# Prune dev dependencies - ignore scripts to avoid "prisma not found" error
RUN pnpm prune --prod --ignore-scripts

# ---------- runtime ----------
FROM node:24-slim AS runtime
RUN apt-get update && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
WORKDIR /app

# Copy production-ready files
COPY package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY prisma ./prisma

EXPOSE 8080
CMD ["node", "dist/index.js"]
