#!/usr/bin/env node
// schedule-outbound-call — create a one-shot routine + tracking Issue for a callback.
// Invocation: echo '{"when":"...","context":"the Cipher invoice"}' | node skills/schedule-outbound-call/run.mjs

import { readFileSync } from "node:fs";
import { createOneShotRoutine, createIssue } from "../../shared/lib/paperclip.mjs";

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const ctx = (input.context || "").trim();
  if (!input.when) throw new Error("invalid_input: missing `when`");
  const d = new Date(input.when);
  if (isNaN(d.getTime())) throw new Error(`invalid_input: unparseable when="${input.when}"`);
  const fireAt = d.toISOString();

  const prompt = [
    "One-shot outbound call. Verify the bridge is up (GET /healthz), then POST to the Twilio Calls API",
    "to dial BOARD_PHONE with TwiML URL pointing at the bridge /outbound-call?ctx=" + encodeURIComponent(ctx) + ".",
    "If the bridge is down or Twilio errors, escalate Tier 1 adapter-broken. Context for the call: " + (ctx || "(none)"),
  ].join(" ");

  const routine = await createOneShotRoutine({
    title: `Callback: ${ctx || "(no context)"}`.slice(0, 60),
    prompt,
    fireAtIso: fireAt,
  });

  await createIssue({
    title: `Outbound call ${fireAt}: ${ctx}`.slice(0, 60),
    body: `Scheduled callback. Context: ${ctx}`,
    labels: ["outbound-call-scheduled"],
    dueAt: fireAt,
  });

  console.log(JSON.stringify({ ok: true, routine_id: routine.id ?? null, fire_at: fireAt }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
