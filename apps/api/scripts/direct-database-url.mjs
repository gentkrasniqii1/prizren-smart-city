/**
 * Neon pooled hosts (`ep-xxx-pooler.`) go through PgBouncer. Prisma migrate
 * takes a session-level `pg_advisory_lock` that the pooler cannot hold, so
 * `migrate deploy` fails after ~10s (P1002).
 *
 * The Nest process should keep DATABASE_URL (pooled). Schema ops (migrate,
 * seed-on-boot) should use DIRECT_URL or the same URL with `-pooler` removed.
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

/** Env for Prisma CLI / seed: never mutates the parent process.env. */
export function schemaOpsEnv(env = process.env) {
  const databaseUrl = env.DATABASE_URL ?? '';
  const explicit = typeof env.DIRECT_URL === 'string' ? env.DIRECT_URL.trim() : '';
  const direct = explicit || toDirectDatabaseUrl(databaseUrl);
  return {
    ...env,
    DATABASE_URL: direct || databaseUrl,
    DIRECT_URL: direct || databaseUrl,
  };
}

export function sleepMs(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
