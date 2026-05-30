# ea-discord-bridge

Inbound side of EA's text channel. A persistent Discord gateway client that
listens for Ryan's messages and opens a Paperclip Issue for the `ea` agent to
answer. Outbound replies are sent by the `send-discord` skill (plain REST), not
by this service.

This is the **hybrid** setup: Twilio still handles phone **calls** (no A2P
needed), while all **text** runs over Discord — sidestepping A2P 10DLC brand /
campaign registration entirely.

## One-time Discord setup (do this first)

1. **Create the bot.** https://discord.com/developers/applications → New
   Application → Bot. Copy the **bot token** → `DISCORD_BOT_TOKEN`.
2. **Enable privileged intent.** In the Bot tab, turn on **MESSAGE CONTENT
   INTENT** (the bridge needs it to read message text).
3. **Invite the bot to a private server.** OAuth2 → URL Generator → scopes
   `bot`, permissions `View Channels` + `Send Messages` + `Read Message
   History`. Open the URL, add it to a server only you are in.
4. **Get the IDs** (enable Developer Mode in Discord → Advanced, then
   right-click → Copy ID):
   - Your user ID → `DISCORD_OWNER_ID` (inbound allowlist; the only person the
     bridge listens to).
   - The channel the bot should read/reply in → `DISCORD_CHANNEL_ID`. Omit to
     use DMs instead.
5. Put those values in `/etc/ea/env` (see `../voice-bridge/.env.example`).

## Run locally

```bash
npm install
EA_ENV_FILE=./.env npm start    # or rely on /etc/ea/env in production
```

Health check: `curl http://127.0.0.1:5051/healthz` → `{"ok":true}` once
connected.

## Deploy (droplet)

Mirrors the voice bridge:

```bash
sudo cp systemd/ea-discord-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now ea-discord-bridge
journalctl -u ea-discord-bridge -f
```

## Flow

```
Ryan (Discord) --message--> gateway --> this service
  --> spawn skills/inbound-sms-handler (opens Paperclip Issue, label sms-inbound)
  --> `ea` agent answers on heartbeat --> skills/send-discord --> Ryan
```
