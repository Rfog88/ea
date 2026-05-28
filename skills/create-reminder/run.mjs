#!/usr/bin/env node
// create-reminder — open a Paperclip Issue tagged `reminder` with a due time.
// Invocation: echo '{"text":"...","when":"2026-05-28T19:00:00Z"}' | node skills/create-reminder/run.mjs

import { readFileSync } from "node:fs";
import { createIssue } from "../../shared/lib/paperclip.mjs";

function parseWhen(when) {
  if (!when) throw new Error("invalid_input: missing `when`");
  const d = new Date(when);
  if (isNaN(d.getTime())) throw new Error(`invalid_input: unparseable when="${when}"`);
  return d.toISOString();
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const text = (input.text || "").trim();
  if (!text) throw new Error("invalid_input: missing `text`");
  const dueAt = parseWhen(input.when);

  const issue = await createIssue({
    title: text.slice(0, 60),
    body: text,
    labels: ["reminder"],
    dueAt,
  });

  console.log(JSON.stringify({ ok: true, issue_id: issue.id ?? issue.code ?? null, due_at: dueAt }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
