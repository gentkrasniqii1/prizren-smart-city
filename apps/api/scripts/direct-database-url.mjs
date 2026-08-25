/**
 * Neon pooled hosts (`ep-xxx-pooler.`) go through PgBouncer. Prisma migrate
 * takes a session-level `pg_advisory_lock` that the pooler cannot hold, so
 * `migrate deploy` fails after ~10s (P1002).
 *
 * schema.prisma: `url` = DATABASE_URL (pooled, Nest + Prisma Client).
 *                `directUrl` = DIRECT_URL (unpooled, Prisma CLI migrate).
 * Seed is Prisma Client, so it must use DATABASE_URL pointed at the unpooled
 * host for that child process only. Nest keeps the original pooled URL.
 */
export function toDirectDatabaseUrl(databaseUrl) {
  if (!databaseUrl) return databaseUrl;
  const matched = databaseUrl.match(/^(postgres(?:ql)?:)(\/\/[\s\S]*)$/i);
  if (!matched) return databaseUrl;
  const protocol = matched[1];
  let parsed;
  try {
    parsed = new URL(`http:${matched[2]}`);
  } catch {
    return databaseUrl;
  }
  parsed.hostname = parsed.hostname.replace(/-pooler(?=\.|$)/i, '');
  parsed.searchParams.delete('pgbouncer');
  return parsed.toString().replace(/^http:/i, protocol);
}

export function describeDatabaseHost(url) {
  try {
    return new URL(url.replace(/^postgres(?:ql)?:/i, 'http:')).host;
  } catch {
    return '(unparseable)';
  }
}

export function isPooledHost(url) {
  return /-pooler(?=\.|$)/i.test(describeDatabaseHost(url));
}

function resolvedDirectUrl(env = process.env) {
  const databaseUrl = env.DATABASE_URL ?? '';
  const explicit = typeof env.DIRECT_URL === 'string' ? env.DIRECT_URL.trim() : '';
  return toDirectDatabaseUrl(explicit || databaseUrl) || databaseUrl;
}

/** Prisma CLI migrate: keep pooled DATABASE_URL; set DIRECT_URL for `directUrl`. */
export function migrateEnv(env = process.env) {
  const databaseUrl = env.DATABASE_URL ?? '';
  return {
    ...env,
    DATABASE_URL: databaseUrl,
    DIRECT_URL: resolvedDirectUrl(env),
  };
}

/** Seed process (Prisma Client): Client only reads `url` / DATABASE_URL. */
export function seedClientEnv(env = process.env) {
  const direct = resolvedDirectUrl(env);
  return {
    ...env,
    DATABASE_URL: direct,
    DIRECT_URL: direct,
  };
}

export function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
