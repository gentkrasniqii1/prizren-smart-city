/**
 * Runs the catalog seed. Production images have no ts-node, so prefer the
 * compiled `dist/prisma/seed.js` from `npm run build:seed`. Locally, fall
 * back to ts-node when that file is missing.
 *
 * Prisma Client only reads `url` (DATABASE_URL). Point that child env at the
 * unpooled host so seed is not stuck behind PgBouncer. Upserts in seed.ts are
 * idempotent; this file does not take PostgreSQL advisory locks.
 */
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedClientEnv } from './direct-database-url.mjs';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const compiled = join(apiRoot, 'dist', 'prisma', 'seed.js');
const source = join(apiRoot, 'prisma', 'seed.ts');
const isWin = process.platform === 'win32';
const env = seedClientEnv(process.env);

let result;
if (existsSync(compiled)) {
  result = spawnSync(process.execPath, [compiled], {
    stdio: 'inherit',
    cwd: apiRoot,
    env,
  });
} else {
  result = spawnSync('npx', ['ts-node', '--compiler-options', '{"module":"CommonJS"}', source], {
    stdio: 'inherit',
    cwd: apiRoot,
    env,
    shell: isWin,
  });
}

process.exit(result.status === null ? 1 : result.status);
