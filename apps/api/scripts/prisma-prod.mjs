/**
 * Why this script exists: `npx prisma migrate deploy` from apps/api always
 * loads a sibling `.env` ("Environment variables loaded from .env"). On a
 * developer machine that file is the Docker localhost URL. On Render, if that
 * file is present, Prisma CLI can use it instead of the dashboard env var.
 *
 * This wrapper:
 *   - reads only process.env.DATABASE_URL (no hardcoded fallback)
 *   - fills from apps/api/.env only when DATABASE_URL is unset AND not production
 *   - runs Prisma from a temp cwd so the CLI cannot load apps/api/.env
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';
const schemaPath = join(apiRoot, 'prisma', 'schema.prisma');

function fillFromLocalDotenvIfNeeded() {
  if (isProd) return;
  if (process.env.DATABASE_URL) return;
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

function databaseHost(url) {
  try {
    return new URL(url.replace(/^postgres(ql)?:/i, 'http:')).host;
  } catch {
    return '(unparseable DATABASE_URL)';
  }
}

const databaseUrl = process.env.DATABASE_URL ?? '';
if (!databaseUrl) {
  console.error(
    'DATABASE_URL is not set. On Render, add it under Environment. ' +
      'Locally: $env:DATABASE_URL="postgresql://..." then npm run prisma:deploy.',
  );
  process.exit(1);
}

const host = databaseHost(databaseUrl);
if (isProd && /localhost|127\.0\.0\.1/i.test(databaseUrl)) {
  console.error(
    `Refusing prisma in production: DATABASE_URL host is "${host}". ` +
      'Render is using the local Docker URL. Set Neon (*.neon.tech), do not import apps/api/.env.',
  );
  process.exit(1);
}

console.log(`Prisma DATABASE_URL host: ${host}`);

const prismaArgs = process.argv.slice(2);
if (prismaArgs.length === 0) {
  console.error('Usage: node scripts/prisma-prod.mjs <prisma args>');
  process.exit(1);
}

const prismaCwd = mkdtempSync(join(tmpdir(), 'prisma-deploy-'));
const prismaCli = createRequire(import.meta.url).resolve('prisma/build/index.js');
const result = spawnSync(process.execPath, [prismaCli, ...prismaArgs, '--schema', schemaPath], {
  stdio: 'inherit',
  env: { ...process.env, DATABASE_URL: databaseUrl },
  cwd: prismaCwd,
});

process.exit(result.status === null ? 1 : result.status);
