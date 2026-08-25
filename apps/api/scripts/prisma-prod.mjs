/**
 * Why this script exists: `npx prisma migrate deploy` from apps/api always
 * loads a sibling `.env` ("Environment variables loaded from .env"). On a
 * developer machine that file is the Docker localhost URL. On Render, if that
 * file is present, Prisma CLI can use it instead of the dashboard env var.
 *
 * This wrapper:
 *   - reads process.env.DATABASE_URL (no hardcoded fallback)
 *   - fills from apps/api/.env only when not production (unset keys only)
 *   - runs Prisma from a temp cwd so the CLI cannot load apps/api/.env
 *   - leaves DATABASE_URL pooled; sets DIRECT_URL for schema `directUrl`
 *     (Prisma migrate deploy uses directUrl automatically)
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describeDatabaseHost, isPooledHost, migrateEnv, sleepMs } from './direct-database-url.mjs';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');
const MIGRATE_ATTEMPTS = 3;
const MIGRATE_RETRY_MS = 5_000;

function fillFromLocalDotenvIfNeeded() {
  if (isProd) return;
  const envPath = join(apiRoot, '.env');
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const m = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (process.env[key] !== undefined) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
}

fillFromLocalDotenvIfNeeded();

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl) {
  console.error(
    'DATABASE_URL is not set. On Render, add it under Environment. ' +
      'Locally: $env:DATABASE_URL="postgresql://..." then npm run prisma:deploy.',
  );
  process.exit(1);
}

const runtimeHost = describeDatabaseHost(databaseUrl);
if (isProd && /localhost|127\.0\.0\.1/i.test(databaseUrl)) {
  console.error(
    `Refusing prisma in production: DATABASE_URL host is "${runtimeHost}". ` +
      'Render is using the local Docker URL. Set Neon (*.neon.tech), do not import apps/api/.env.',
  );
  process.exit(1);
}

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/prisma-prod.mjs <prisma args>');
  process.exit(1);
}

const opsEnv = migrateEnv(process.env);
const directHost = describeDatabaseHost(opsEnv.DIRECT_URL);
const derivedDirect = !process.env.DIRECT_URL?.trim();

if (derivedDirect) {
  console.warn(
    'DIRECT_URL is unset. Derived unpooled host from DATABASE_URL. ' +
      'Set DIRECT_URL on Render (Neon → Connection Details → Direct connection).',
  );
}

console.log(`Prisma url (DATABASE_URL / pooler) host: ${runtimeHost}`);
console.log(`Prisma directUrl (DIRECT_URL / migrate) host: ${directHost}`);

if (isPooledHost(opsEnv.DIRECT_URL)) {
  console.error(
    'DIRECT_URL still points at a Neon pooler host (`-pooler`). ' +
      'Prisma migrate cannot take pg_advisory_lock through PgBouncer (P1002). ' +
      'Set DIRECT_URL to the Direct connection string (hostname without `-pooler`).',
  );
  process.exit(1);
}

const isMigrate = prismaArgs[0] === 'migrate';
const attempts = isMigrate ? MIGRATE_ATTEMPTS : 1;
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');

let status = 1;
for (let attempt = 1; attempt <= attempts; attempt++) {
  if (attempts > 1) {
    console.log(`Prisma migrate deploy attempt ${attempt}/${attempts}`);
  }
  const prismaCwd = mkdtempSync(join(tmpdir(), 'prisma-deploy-'));
  const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs, '--schema', schemaPath], {
    stdio: 'inherit',
    env: opsEnv,
    cwd: prismaCwd,
  });
  status = result.status === null ? 1 : result.status;
  if (status === 0) break;
  if (attempt < attempts) {
    console.warn(
      `Prisma migrate failed (exit ${status}). Retrying in ${MIGRATE_RETRY_MS / 1000}s ` +
        '(Neon pooler advisory-lock timeouts are P1002).',
    );
    sleepMs(MIGRATE_RETRY_MS);
  }
}

process.exit(status);
