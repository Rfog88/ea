#!/usr/bin/env node
// send-discord — outbound message from EA to Ryan via Discord.
//
// SELF-CONTAINED on purpose: no imports from ../../shared/lib. The Paperclip
// agent executes skills from a catalog location that does NOT include the
// shared libs, and its env does not inherit /etc/ea/env. So this skill inlines
// both the Discord REST call and an /etc/ea/env backfill, so it runs correctly
// whether launched by the bridge (env already present) or by the agent.
//
// Invocation: echo '{"body":"..."}' | node skills/send-discord/run.mjs

import { readFileSync } from "node:fs";

// Backfill env from the EA env file for keys not already set.
function loadEnvFile() {
  const path = process.env.EA_ENV_FILE || "/etc/ea/env";
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      if (process.env[k] !== undefined) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      process.env[k] = v;
    }
  } catch {
    // no env file — rely on ambient environment
  }
}

const API = "https://discord.com/api/v10";

async function discordFetch(path, init = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    const e = new Error("missing_env: DISCORD_BOT_TOKEN");
    e.reason = "api-key-missing";
    throw e;
  }
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (!res.ok) {
    const txt = await res.text();
    const e = new Error(`discord ${res.status}: ${txt.slice(0, 200)}`);
    e.reason = res.status === 429 ? "external-quota-exceeded" : "adapter-broken";
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

async function resolveChannelId(channelId) {
  if (channelId) return channelId;
  if (process.env.DISCORD_CHANNEL_ID) return process.env.DISCORD_CHANNEL_ID;
  const owner = process.env.DISCORD_OWNER_ID;
  if (!owner) {
    const e = new Error("missing_env: set DISCORD_CHANNEL_ID or DISCORD_OWNER_ID");
    e.reason = "api-key-missing";
    throw e;
  }
  const dm = await discordFetch(`/users/@me/channels`, { method: "POST", body: JSON.stringify({ recipient_id: owner }) });
  return dm.id;
}

async function main() {
  loadEnvFile();
  const input = JSON.parse(readFileSync(0, "utf8"));
  const body = (input.body || "").trim();
  if (!body) throw new Error("invalid_input: missing `body`");

  const channelId = await resolveChannelId(input.channelId);
  const msg = await discordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: String(body).slice(0, 2000) }),
  });
  console.log(JSON.stringify({ ok: true, id: msg.id, channel: channelId }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
