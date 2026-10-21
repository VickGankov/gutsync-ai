#!/usr/bin/env node
// Manage invite codes.  Needs DATABASE_URL (run it from the Render shell, or locally against your DB).
//   node scripts/invite.mjs create <code> <founder|tester> <cap> [days-until-expiry] [label...]
//   node scripts/invite.mjs list
//   node scripts/invite.mjs delete <code>
// A founder code gives every feature and 20 scans a day; a tester code gives every feature and 10 scans a day.
import mysql from "mysql2/promise";
import { mysqlOptionsFromUrl } from "../shared/dbConnection.mjs";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL is not set"); process.exit(1); }
const [cmd, ...a] = process.argv.slice(2);
const conn = await mysql.createConnection(mysqlOptionsFromUrl(url));
try {
  if (cmd === "create") {
    const [code, plan, capRaw, daysRaw, ...label] = a;
    const cap = Number(capRaw);
    if (!code || !/^[A-Za-z0-9_-]{3,64}$/.test(code)) throw new Error("code must be 3-64 letters, numbers, - or _");
    if (plan !== "founder" && plan !== "tester") throw new Error("plan must be founder or tester");
    if (!Number.isInteger(cap) || cap < 1) throw new Error("cap must be a whole number of 1 or more");
    const days = daysRaw ? Number(daysRaw) : null;
    if (days !== null && !(days > 0)) throw new Error("days must be a positive number");
    const expiresAt = days ? Date.now() + days * 86400000 : null;
    await conn.execute("insert into invite_codes (`code`, `plan`, `cap`, expiresAt, label) values (?,?,?,?,?)", [code, plan, cap, expiresAt, label.join(" ") || null]);
    console.log(`Created ${plan} code "${code}" (cap ${cap}${days ? `, expires in ${days} days` : ""}).`);
    console.log(`Invite link: https://triggerplate.com/?invite=${encodeURIComponent(code)}`);
  } else if (cmd === "list") {
    const [rows] = await conn.query("select `code`, `plan`, redeemed, `cap`, expiresAt, label from invite_codes order by id");
    if (!rows.length) console.log("No invite codes yet.");
    for (const r of rows) {
      const exp = r.expiresAt ? (r.expiresAt < Date.now() ? "EXPIRED" : new Date(Number(r.expiresAt)).toISOString().slice(0, 10)) : "never";
      console.log(`${r.code}\t${r.plan}\t${r.redeemed}/${r.cap}\texpires ${exp}\t${r.label ?? ""}`);
    }
  } else if (cmd === "delete") {
    const [res] = await conn.execute("delete from invite_codes where lower(code) = lower(?)", [a[0] ?? ""]);
    console.log(res.affectedRows ? "Deleted." : "No such code.");
  } else {
    console.error("Usage: create <code> <founder|tester> <cap> [days] [label] | list | delete <code>");
    process.exitCode = 1;
  }
} catch (e) {
  console.error(e.code === "ER_DUP_ENTRY" ? "That code already exists." : e.message);
  process.exitCode = 1;
} finally { await conn.end(); }
