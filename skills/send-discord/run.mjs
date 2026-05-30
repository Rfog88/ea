#!/usr/bin/env node
// send-discord — outbound message from EA to Ryan via Discord.
// Replaces send-sms for the EA<->Ryan channel (no A2P/carrier registration needed).
// Invocation: echo '{"body":"..."}' | node skills/send-discord/run.mjs

import { readFileSync } from "node:fs";
import { sendMessage } from "../../shared/lib/discord.mjs";

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const body = (input.body || "").trim();
  if (!body) throw new Error("invalid_input: missing `body`");

  // Single-user: the only recipient is Ryan's private EA channel/DM, which only
  // Ryan can see. No third-party read-back gate is needed (unlike send-sms).
  const { id, channelId } = await sendMessage(body, { channelId: input.channelId });
  console.log(JSON.stringify({ ok: true, id, channel: channelId }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
