#!/usr/bin/env node
// Applies hand-written SQL migrations in drizzle/ that are NOT tracked by
// drizzle-kit's journal (drizzle/meta/_journal.json). Runs after
// `drizzle-kit migrate` as part of `pnpm run db:migrate`, which Render runs on
// every build — so new .sql files deploy without anyone running SQL by hand.
//
// - Files run once, in filename order, and are recorded in `_manual_migrations`.
// - Safe on databases where some files were already applied by hand: statements
//   that fail only because the object already exists are skipped, and the file
//   is recorded as applied.
// - Any other error stops the run with a non-zero exit, which fails the Render
//   build so the previous version stays live.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import mysql from "mysql2/promise";

const DRIZZLE_DIR = path.resolve(process.argv[2] ?? "drizzle");
const TABLE = "_manual_migrations";

// "Already exists" style errors: table, column, index/key, constraint, FK.
const ALREADY_APPLIED_ERRNOS = new Set([1050, 1060, 1061, 1826, 1022]);
// Some MySQL-compatible engines report these with a generic code, so match the message too.
const ALREADY_APPLIED_MESSAGE = /already exists|Duplicate (key|column|foreign key constraint|entry for key) name/i;

export function isAlreadyAppliedError(err) {
  return ALREADY_APPLIED_ERRNOS.has(err?.errno) || ALREADY_APPLIED_MESSAGE.test(String(err?.message ?? ""));
}

export function splitStatements(sql) {
  return sql
    .split("--> statement-breakpoint")
    .join("\n")
    .split(/;\s*(?:\r?\n|$)/)
    .map(s => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export function pendingFiles(allFiles, journalTags, appliedNames) {
  const journaled = new Set(journalTags.map(t => `${t}.sql`));
  return allFiles
    .filter(f => /^\d{4}_.+\.sql$/.test(f) && !journaled.has(f) && !appliedNames.has(f))
    .sort();
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[migrate-manual] DATABASE_URL is required");
    process.exit(1);
  }

  const journal = JSON.parse(fs.readFileSync(path.join(DRIZZLE_DIR, "meta", "_journal.json"), "utf8"));
  const journalTags = (journal.entries ?? []).map(e => e.tag);
  const files = fs.readdirSync(DRIZZLE_DIR);

  const conn = await mysql.createConnection(url);
  try {
    await conn.query(
      `CREATE TABLE IF NOT EXISTS \`${TABLE}\` (
        \`name\` varchar(255) NOT NULL PRIMARY KEY,
        \`checksum\` varchar(64) NOT NULL,
        \`appliedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`
    );
    const [rows] = await conn.query(`SELECT name FROM \`${TABLE}\``);
    const applied = new Set(rows.map(r => r.name));
    const pending = pendingFiles(files, journalTags, applied);

    if (pending.length === 0) {
      console.log("[migrate-manual] Up to date");
      return;
    }

    for (const file of pending) {
      const sql = fs.readFileSync(path.join(DRIZZLE_DIR, file), "utf8");
      const checksum = crypto.createHash("sha256").update(sql).digest("hex");
      let skipped = 0;
      for (const stmt of splitStatements(sql)) {
        try {
          await conn.query(stmt);
        } catch (err) {
          if (isAlreadyAppliedError(err)) {
            skipped++;
            continue;
          }
          console.error(`[migrate-manual] ${file} failed: ${err.message}\nStatement:\n${stmt}`);
          process.exitCode = 1;
          return;
        }
      }
      await conn.query(`INSERT INTO \`${TABLE}\` (name, checksum) VALUES (?, ?)`, [file, checksum]);
      console.log(`[migrate-manual] Applied ${file}${skipped ? ` (${skipped} statement(s) already applied, skipped)` : ""}`);
    }
  } finally {
    await conn.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(err => {
    console.error("[migrate-manual]", err);
    process.exit(1);
  });
}
