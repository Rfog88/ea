#!/usr/bin/env node
// board-notify — SMS notification primitive for EA (single human, single channel).
// Invocation: echo '{"tier":0,"title":"...","body":"..."}' | node skills/board-notify/run.mjs

import { readFileSync } from "node:fs";

function inDndWindow() {
  const win = process.env.BOARD_DND_HOURS;
  if (!win) return false;
  const m = win.match(/^(\d{2})-(\d{2})$/);
  if (!m) return false;
  const start = parseInt(m[1], 10), end = parseInt(m[2], 10);
  const hour = new Date().getHours();
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps midnight
}

async function sendTwilioSms(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER, to = process.env.BOARD_PHONE;
  if (!sid || !token || !from || !to) return { status: "skipped", reason: "twilio_not_configured" };
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!res.ok) return { status: "error", code: res.status, body: (await res.text()).slice(0, 200) };
  return { status: "sent" };
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const { tier = 0, title = "", body = "", sms_on_tier_2 = true } = input;
  const dnd = inDndWindow();

  if (tier === 0 && dnd) { console.log(JSON.stringify({ sms: "skipped_dnd" })); return; }
  if (tier === 1 && dnd) { console.log(JSON.stringify({ sms: "deferred_dnd" })); return; }
  if (tier === 2 && !sms_on_tier_2) { console.log(JSON.stringify({ sms: "skipped" })); return; }

  const tag = tier === 2 ? "[HARD-BLOCK]" : tier === 1 ? "[DECISION]" : "[FYI]";
  const ack = tier >= 1 ? " Reply ACK to acknowledge." : "";
  const msg = `${tag} ${title} — ${body}${ack}`.slice(0, 1500);

  const result = await sendTwilioSms(msg);
  console.log(JSON.stringify({ sms: result.status }));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
