#!/usr/bin/env node
// escalate-to-board — tracked Issue + SMS to Ryan. Tier-2 dedupe by error_signature.
// Invocation: echo '{"tier":1,"reason":"decision-needed","title":"...","context":"..."}' | node skills/escalate-to-board/run.mjs

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createIssue, findOpenIssueByLabel } from "../../shared/lib/paperclip.mjs";

const REASONS = new Set([
  "api-key-missing", "subscription-rate-limit", "decision-needed", "external-quota-exceeded",
  "agent-conflict", "human-review-required", "adapter-broken", "unknown-failure",
]);

function notify(payload) {
  const here = dirname(fileURLToPath(import.meta.url));
  const script = join(here, "..", "board-notify", "run.mjs");
  try {
    const out = execFileSync("node", [script], { input: JSON.stringify(payload), encoding: "utf8" });
    return JSON.parse(out).sms || "unknown";
  } catch {
    return "error";
  }
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const tier = input.tier ?? 1;
  const reason = input.reason;
  if (!REASONS.has(reason)) throw new Error(`invalid_input: unknown reason "${reason}"`);
  const title = (input.title || reason).slice(0, 60);
  const sig = input.error_signature || reason;

  // Tier-2 dedupe.
  if (tier === 2) {
    try {
      const res = await findOpenIssueByLabel("pending_human", sig);
      const existing = (res?.issues || res || []).find((i) => (i.body || "").includes(`error_signature: ${sig}`));
      if (existing) {
        console.log(JSON.stringify({ ok: true, dedup: true, existing: existing.id }));
        return;
      }
    } catch { /* fall through */ }
  }

  const body = [
    `Reason: ${reason}`,
    `error_signature: ${sig}`,
    input.context ? `Context: ${input.context}` : null,
    input.suggested_action ? `Suggested: ${input.suggested_action}` : null,
  ].filter(Boolean).join("\n");

  const issue = await createIssue({
    title,
    body,
    labels: ["pending_human", `reason:${reason}`],
    assigneeSlug: "board",
  });

  const sms = notify({ tier, title, body: input.suggested_action || input.context || reason, sms_on_tier_2: true });

  console.log(JSON.stringify({ ok: true, issue_id: issue.id ?? null, sms, dedup: false }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
