// Single source of truth for MySQL/TiDB connection options, used by the app
// (server/db.ts), drizzle-kit (drizzle.config.ts) and the manual migration
// runner (scripts/migrate-manual.mjs).
//
// TiDB Cloud Serverless rejects unencrypted connections, and mysql2 only uses
// TLS when told to. So any non-local host gets TLS with certificate checks
// unless the URL already carries an explicit `ssl` setting.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

/** @param {string} url @returns {import("mysql2").ConnectionOptions & { host: string; database: string }} */
export function mysqlOptionsFromUrl(url) {
  const u = new URL(url);
  const options = {
    host: decodeURIComponent(u.hostname),
    port: u.port ? parseInt(u.port, 10) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: decodeURIComponent(u.pathname.slice(1)),
  };
  // Keep other query params the way mysql2 would read them (JSON if possible).
  u.searchParams.forEach((value, key) => {
    try {
      options[key] = JSON.parse(value);
    } catch {
      options[key] = value;
    }
  });
  const sslIsConfigured = options.ssl && typeof options.ssl === "object";
  if (!sslIsConfigured && !LOCAL_HOSTS.has(options.host) && options.ssl !== false) {
    options.ssl = { minVersion: "TLSv1.2", rejectUnauthorized: true };
  }
  // Prisma-style params that mysql2 doesn't understand; drop to avoid warnings.
  delete options.sslaccept;
  delete options.sslmode;
  return options;
}
