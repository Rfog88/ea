// Shared Discord REST helper for EA skills + the discord-bridge service.
// EA is single-user: the only recipient is Ryan, reached either via a fixed
// private channel (DISCORD_CHANNEL_ID) or a DM opened to DISCORD_OWNER_ID.
// Sending uses the bot token over plain REST — no gateway connection needed.
import "./env.mjs";

const API = "https://discord.com/api/v10";

function botToken() {
  const t = process.env.DISCORD_BOT_TOKEN;
  if (!t) {
    const e = new Error("missing_env: DISCORD_BOT_TOKEN");
    e.reason = "api-key-missing";
    throw e;
  }
  return t;
}

async function discordFetch(path, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${botToken()}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    const e = new Error(`discord ${res.status}: ${txt.slice(0, 200)}`);
    // 429 = rate limited; everything else (401 bad token, 403 perms, 5xx) = adapter problem.
    e.reason = res.status === 429 ? "external-quota-exceeded" : "adapter-broken";
    throw e;
  }
  return res.status === 204 ? null : res.json();
}

// Resolve where to post: explicit channelId wins, then DISCORD_CHANNEL_ID,
// else open (or reuse) a DM channel with DISCORD_OWNER_ID.
export async function resolveChannelId(channelId) {
  if (channelId) return channelId;
  const fixed = process.env.DISCORD_CHANNEL_ID;
  if (fixed) return fixed;
  const owner = process.env.DISCORD_OWNER_ID;
  if (!owner) {
    const e = new Error("missing_env: set DISCORD_CHANNEL_ID or DISCORD_OWNER_ID");
    e.reason = "api-key-missing";
    throw e;
  }
  const dm = await discordFetch(`/users/@me/channels`, {
    method: "POST",
    body: JSON.stringify({ recipient_id: owner }),
  });
  return dm.id;
}

// Post a message. Discord's hard limit is 2000 chars; we truncate to stay safe.
export async function sendMessage(content, { channelId } = {}) {
  const id = await resolveChannelId(channelId);
  const msg = await discordFetch(`/channels/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: String(content).slice(0, 2000) }),
  });
  return { id: msg.id, channelId: id };
}
