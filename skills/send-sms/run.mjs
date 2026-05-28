#!/usr/bin/env node
// send-sms — outbound SMS via Twilio. Third-party sends require confirmed=true.
// Invocation: echo '{"to":"brother","body":"...","confirmed":true}' | node skills/send-sms/run.mjs

import { readFileSync } from "node:fs";
import { resolveContact } from "../../shared/lib/contacts.mjs";

async function sendTwilioSms(to, body) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  if (!sid || !token || !from) {
    const e = new Error("missing_env: TWILIO_*");
    e.reason = "api-key-missing";
    throw e;
  }
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: form,
  });
  if (!res.ok) {
    const txt = await res.text();
    const e = new Error(`twilio ${res.status}: ${txt.slice(0, 200)}`);
    e.reason = res.status === 429 ? "external-quota-exceeded" : "adapter-broken";
    throw e;
  }
  return (await res.json()).sid;
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const body = (input.body || "").trim();
  if (!body) throw new Error("invalid_input: missing `body`");

  let to;
  try {
    to = resolveContact(input.to, "phone").value;
  } catch (e) {
    if (e.message.startsWith("unknown_contact")) {
      console.error(JSON.stringify({ ok: false, error: "unknown_contact", ref: input.to }));
      process.exit(2);
    }
    throw e;
  }

  const board = process.env.BOARD_PHONE;
  if (to !== board && input.confirmed !== true) {
    console.error(JSON.stringify({ ok: false, error: "confirmed_required", to }));
    process.exit(3);
  }

  const sid = await sendTwilioSms(to, body);
  console.log(JSON.stringify({ ok: true, sid, to }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
