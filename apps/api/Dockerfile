# Production API image — MUST build from monorepo root:
#   docker build -f apps/api/Dockerfile -t prizren-api-test .
#
# Do NOT copy full builder node_modules into the runtime image.

FROM node:20.19.2-bookworm-slim AS base
WORKDIR /app

RUN apt-get update -y \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# --- install all deps (incl. Nest CLI) for compile ---
FROM base AS deps
ENV NODE_ENV=development
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
RUN npm ci

# --- compile shared-types + Nest API ---
FROM base AS build
ENV NODE_ENV=development
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/api ./apps/api
RUN npm run build -w @prizren/shared-types
ENV DATABASE_URL=postgresql://build:build@127.0.0.1:5432/build?schema=public
RUN npx prisma generate --schema=apps/api/prisma/schema.prisma
WORKDIR /app/apps/api
RUN npx --yes @nestjs/cli build

# --- production node_modules only (small) ---
FROM base AS prod-deps
ENV NODE_ENV=production
ENV HUSKY=0
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-types ./packages/shared-types
COPY apps/api/prisma ./apps/api/prisma
# Drop root prepare (husky) — husky is a root devDependency and is omitted here.
RUN npm pkg delete scripts.prepare \
  && npm ci --omit=dev --workspace=@prizren/api --workspace=@prizren/shared-types --include-workspace-root \
  && npm run build -w @prizren/shared-types \
  && npx prisma generate --schema=apps/api/prisma/schema.prisma

# --- slim runtime ---
FROM base AS runner
ENV NODE_ENV=production
WORKDIR /app

RUN groupadd --system --gid 1001 nestjs \
  && useradd --system --uid 1001 --gid nestjs nestjs

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=prod-deps /app/package.json ./package.json
COPY --from=prod-deps /app/packages/shared-types ./packages/shared-types
COPY --from=prod-deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=prod-deps /app/apps/api/prisma ./apps/api/prisma
COPY --from=build /app/apps/api/dist ./apps/api/dist

WORKDIR /app/apps/api
USER nestjs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3001)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/main.js"]
