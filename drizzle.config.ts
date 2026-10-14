import { defineConfig } from "drizzle-kit";
import { mysqlOptionsFromUrl } from "./shared/dbConnection.mjs";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is required to run drizzle commands");
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  // Explicit options (not the raw URL) so TLS is applied for TiDB Cloud.
  dbCredentials: (({ host, port, user, password, database, ssl }) => ({
    host,
    port,
    user,
    password,
    database,
    ...(ssl ? { ssl: ssl as Record<string, unknown> } : {}),
  }))(mysqlOptionsFromUrl(connectionString)) as any,
});
