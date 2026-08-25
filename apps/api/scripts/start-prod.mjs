/**
 * Production boot: migrate → seed canonical catalog → start the API.
 * Seed upserts institutions/departments/categories/rules. It does not prune
 * custom routing unless SEED_PRUNE=true.
 *
 * Seed is run via run-seed.mjs (not `prisma db seed`) so a temp Prisma cwd
 * cannot lose the relative seed command.
 *
 * Migrate uses schema `directUrl` / DIRECT_URL (unpooled). Seed (Prisma Client)
 * uses an unpooled DATABASE_URL in its child process only. Nest keeps the
 * original pooled DATABASE_URL. Do not set spawn timeout — that kills Prisma;
 * it does not extend the 10s advisory-lock wait.
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sleepMs } from './direct-database-url.mjs';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const prismaProd = join(apiRoot, 'scripts', 'prisma-prod.mjs');
const runSeed = join(apiRoot, 'scripts', 'run-seed.mjs');
const main = join(apiRoot, 'dist', 'main.js');
const SEED_ATTEMPTS = 3;
const SEED_RETRY_MS = 5_000;

function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: 'inherit',
    cwd: apiRoot,
    env: process.env,
  });
  const code = result.status === null ? 1 : result.status;
  if (code !== 0) process.exit(code);
}

function runSeedWithRetry() {
  let status = 1;
  for (let attempt = 1; attempt <= SEED_ATTEMPTS; attempt++) {
    console.log(`Catalog seed attempt ${attempt}/${SEED_ATTEMPTS}`);
    const result = spawnSync(process.execPath, [runSeed], {
      stdio: 'inherit',
      cwd: apiRoot,
      env: process.env,
    });
    status = result.status === null ? 1 : result.status;
    if (status === 0) return;
    if (attempt < SEED_ATTEMPTS) {
      console.warn(`Seed failed (exit ${status}). Retrying in ${SEED_RETRY_MS / 1000}s.`);
      sleepMs(SEED_RETRY_MS);
    }
  }
  process.exit(status);
}

run(prismaProd, ['migrate', 'deploy']);
runSeedWithRetry();

const child = spawn(process.execPath, [main], {
  stdio: 'inherit',
  cwd: apiRoot,
  env: process.env,
});

function forward(signal) {
  if (!child.killed) child.kill(signal);
}

process.on('SIGTERM', () => forward('SIGTERM'));
process.on('SIGINT', () => forward('SIGINT'));
child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
