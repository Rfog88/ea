// EA Discord bridge — inbound side of the EA<->Ryan text channel.
// Holds a persistent Discord gateway connection, listens for Ryan's messages in
// his private EA channel (or DM), and hands each one to the inbound-sms-handler
// skill, which opens/reopens a Paperclip Issue routed to the `ea` agent. The
// agent replies via the send-discord skill on its heartbeat.
//
// Outbound (EA->Ryan) does NOT go through here — that's the send-discord skill
// over plain REST. This service only needs to stay connected to receive.
import { Client, GatewayIntentBits, Partials } from "discord.js";
import dotenv from "dotenv";
import http from "node:http";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

dotenv.config({ path: process.env.EA_ENV_FILE || "/etc/ea/env" });

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const OWNER_ID = process.env.DISCORD_OWNER_ID;            // Ryan's Discord user id (allowlist)
const CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;        // optional: restrict to one channel
const HEALTH_PORT = process.env.DISCORD_HEALTH_PORT || 5051;

if (!TOKEN) { console.error("FATAL: DISCORD_BOT_TOKEN not set"); process.exit(1); }
if (!OWNER_ID) { console.error("FATAL: DISCORD_OWNER_ID not set (inbound allowlist)"); process.exit(1); }

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, "..", "..", "skills");

function spawnSkill(folder, input) {
  const child = execFile("node", [join(SKILLS_DIR, folder, "run.mjs")], { timeout: 15000 }, (err, _o, stderr) => {
    if (err) console.error(`[${folder}] failed:`, (stderr || err.message || "").trim());
  });
  child.stdin.write(JSON.stringify(input));
  child.stdin.end();
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,   // PRIVILEGED — enable it in the Dev Portal
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],         // required to receive DMs
});

client.once("ready", (c) => console.log(`ea-discord-bridge ready as ${c.user.tag}`));
client.on("error", (e) => console.error("discord client error:", e.message));

client.on("messageCreate", (msg) => {
  // Ignore our own messages and any other bot.
  if (msg.author.bot) return;
  // Caller allowlist: only Ryan, mirroring the voice bridge's ALLOWED_CALLER_E164.
  if (msg.author.id !== OWNER_ID) return;
  // If a fixed channel is configured, accept that channel or any DM; ignore elsewhere.
  const isDM = !msg.guildId;
  if (CHANNEL_ID && !isDM && msg.channelId !== CHANNEL_ID) return;

  const body = (msg.content || "").trim();
  if (!body) return; // attachment-only / empty — nothing to route

  console.log(`inbound from ${msg.author.username} (${msg.channelId}): ${body.slice(0, 80)}`);
  spawnSkill("inbound-sms-handler", { from: `discord:${msg.author.username}`, body });
});

// Tiny health endpoint so the bridge-heartbeat routine can probe liveness.
http
  .createServer((_req, res) => {
    const ready = client.isReady();
    res.writeHead(ready ? 200 : 503, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: ready }));
  })
  .listen(HEALTH_PORT, "127.0.0.1", () => console.log(`health on 127.0.0.1:${HEALTH_PORT}`));

client.login(TOKEN).catch((e) => {
  console.error("FATAL: discord login failed:", e.message);
  process.exit(1);
});
