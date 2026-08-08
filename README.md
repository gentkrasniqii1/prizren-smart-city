# Prizren Smart City

Monorepo for the Prizren Smart City reporting platform.

## Stack

- **Web:** Next.js 14 (App Router, TypeScript, Tailwind) — `apps/web`
- **API:** NestJS (TypeScript) — `apps/api`
- **Shared:** `@prizren/shared-types` — `packages/shared-types`
- **DB:** PostgreSQL + PostGIS via Docker
- **ORM:** Prisma

## Quick start

### 1. Install

```bash
npm install
```

### 2. Start database

```bash
docker compose up -d postgres
```

### 3. Configure API env

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

### 4. Migrate

```bash
cd apps/api
npx prisma migrate dev
cd ../..
```

### 5. Run

```bash
# terminal 1
npm run dev:api

# terminal 2
npm run dev:web
```

- Web: http://localhost:3000  
- API health: http://localhost:3001/health  

Optional Redis: `docker compose --profile redis up -d redis`  
Full stack API container: `docker compose --profile full up --build`

Architecture docs: [docs/architecture.md](docs/architecture.md)
