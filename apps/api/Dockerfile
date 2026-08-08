# Production-oriented API image (used with docker compose profile "full")
FROM node:20-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl ca-certificates && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm install --workspace=@prizren/api --workspace=@prizren/shared-types --include-workspace-root=false

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared-types/node_modules ./packages/shared-types/node_modules
COPY package.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN npm run build -w @prizren/shared-types
WORKDIR /app/apps/api
RUN npx prisma generate
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/packages/shared-types ./packages/shared-types
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/node_modules ./node_modules
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["node", "dist/main.js"]
