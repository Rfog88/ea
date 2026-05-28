// Per-call audit log in SQLite. Records call lifecycle + every tool call.
import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.EA_BRIDGE_DB || "/var/lib/ea-voice-bridge/session.sqlite";

let db = null;

function init() {
  if (db) return db;
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  const schema = readFileSync(join(here, "..", "..", "..", "migrations", "0001_session_log.sql"), "utf8");
  db.exec(schema);
  return db;
}

export function logSession(callSid, event, detail) {
  try {
    init().prepare(
      "INSERT INTO session_log (call_sid, event, detail, ts) VALUES (?, ?, ?, ?)"
    ).run(callSid, event, typeof detail === "string" ? detail : JSON.stringify(detail || {}), new Date().toISOString());
  } catch {
    // Audit must never crash a live call.
  }
}

export function logToolCall(callSid, tool, input, result) {
  try {
    init().prepare(
      "INSERT INTO tool_call (call_sid, tool, input, result, ts) VALUES (?, ?, ?, ?, ?)"
    ).run(callSid, tool, JSON.stringify(input || {}), JSON.stringify(result || {}), new Date().toISOString());
  } catch { /* never crash a call */ }
}
