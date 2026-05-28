#!/usr/bin/env node
// inbound-sms-handler — open/reopen a Paperclip Issue for an inbound SMS.
// Invocation: echo '{"from":"+1...","body":"..."}' | node skills/inbound-sms-handler/run.mjs

import { readFileSync } from "node:fs";
import { createIssue, commentIssue, findOpenIssueByLabel } from "../../shared/lib/paperclip.mjs";

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const from = (input.from || "").trim();
  const body = (input.body || "").trim();
  if (!from || !body) throw new Error("invalid_input: missing from or body");

  let issueId = null;
  let reopened = false;

  try {
    const res = await findOpenIssueByLabel("sms-inbound", from);
    const existing = (res?.issues || res || [])[0];
    if (existing) {
      await commentIssue(existing.id, `Inbound SMS from ${from}: ${body}`);
      issueId = existing.id;
      reopened = true;
    }
  } catch {
    // fall through to create
  }

  if (!issueId) {
    const issue = await createIssue({
      title: body.slice(0, 60),
      body: `Inbound SMS\nFrom: ${from}\n\n${body}`,
      labels: ["sms-inbound"],
    });
    issueId = issue.id ?? issue.code ?? null;
  }

  console.log(JSON.stringify({ ok: true, issue_id: issueId, reopened }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
