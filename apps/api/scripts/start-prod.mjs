/**
 * Production boot: migrate → seed canonical catalog → start the API.
 * Seed upserts institutions/departments/categories/rules. It does not prune
 * custom routing unless SEED_PRUNE=true.
 *
 * Seed is run via run-seed.mjs (not `prisma db seed`) so a temp Prisma cwd
 * cannot lose the relative seed command.
 */
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const prismaProd = join(apiRoot, 'scripts', 'prisma-prod.mjs');
const runSeed = join(apiRoot, 'scripts', 'run-seed.mjs');
const main = join(apiRoot, 'dist', 'main.js');

function run(file, args = []) {
  const result = spawnSync(process.execPath, [file, ...args], {
    stdio: 'inherit',
    cwd: apiRoot,
    env: process.env,
  });
  const code = result.status === null ? 1 : result.status;
  if (code !== 0) process.exit(code);
}

run(prismaProd, ['migrate', 'deploy']);
run(runSeed);

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
