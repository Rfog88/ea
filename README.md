# EA — Paperclip Company

Phone-first personal executive assistant for Ryan. He **calls** one US Twilio number (voice runs over a Twilio Media Streams ↔ Gemini Live bridge) and **texts** EA over Discord. Async work (Discord messages, daily briefing, scheduled callbacks) runs through one Paperclip agent (`ea`). Text moved off SMS to Discord to skip Twilio A2P 10DLC registration; Twilio is voice-only.

Single user. Not a product. Separate company from Vantyx (VAN) and Faceless Media (FAC) on the same `paperclip-prod` droplet.

## Import on the droplet

```bash
# --include is required: the default (company,agents) skips the 11 skills.
npx companies.sh add https://github.com/Rfog88/ea/tree/master --include company,agents,projects,tasks,issues,skills
```

For updates after the first add:

```bash
npx companies.sh add https://github.com/Rfog88/ea/tree/master --update
```

## Repo layout

```
ea/
  COMPANY.md             # Company manifest (agentcompanies/v1)
  .paperclip.yaml        # Routines (briefing-morning, bridge-heartbeat) + projectEnv
  agents/
    ea/                  # AGENTS.md (ENTRY), HEARTBEAT.md, SOUL.md, TOOLS.md
  skills/                # 11 custom SKILL.md + run.mjs (process-adapter, stdin->stdout)
  shared/
    persona/ea-voice.md  # Gemini Live system_instruction (bridge reads at startup)
    contacts.example.json # placeholder; real file at /etc/ea/contacts.json (not committed)
    lessons.md           # append-only failure log
  notes/                 # log_note target (pushed to private Rfog88/ea-vault, not here)
  services/
    voice-bridge/        # Node+Fastify bridge, runs as ea-voice-bridge.service
  migrations/
    0001_session_log.sql # SQLite for the bridge's per-call audit log
```

## Architecture (one paragraph)

Twilio webhooks and the media-stream WebSocket are exposed via a single Cloudflare Tunnel hostname `ea.<your-domain>` → `127.0.0.1:5050` (the bridge). The Paperclip UI stays SSH-tunnel-only. The bridge validates `X-Twilio-Signature` on every request, allowlists the caller by `ALLOWED_CALLER_E164`, transcodes G.711 µ-law ↔ 16 kHz PCM16, and brokers audio + tool calls with Gemini Live. Tool calls spawn the same `skills/*/run.mjs` scripts the `ea` agent uses (process adapter, JSON on stdin → JSON on stdout), reading secrets from `/etc/ea/env`. Reminders are Paperclip Issues; notes go to a private vault repo; email/calendar/Teams go through Microsoft Graph delegated OAuth on Ryan's M365 Business account.

## Secrets

Nothing secret is committed. All secrets live at `/etc/ea/env` (chmod 600, owned by `paperclip`) and are bound into Paperclip per-project via `.paperclip.yaml`'s `projectEnv`. See `services/voice-bridge/.env.example` for the full key list.

## Cost

~$41/mo all-in at 30 min calls/day + 20 SMS/day (Twilio ~$20 + Gemini Live ~$21; M365/droplet/Paperclip subscriptions are pre-existing and incremental-zero). Full math in the plan, Section 12.

## Plan

Full implementation plan: `~/.claude/plans/plan-mode-build-ea-jiggly-sundae.md`.

## Droplet-side steps (not done by `companies.sh`)

1. Create `/etc/ea/env` (chmod 600) and `/etc/ea/contacts.json`.
2. Deploy the **whole repo** to `/opt/ea` (the bridge resolves skills/migrations/persona relative to the repo root, so the bridge-only layout breaks), then `cd /opt/ea/services/voice-bridge && npm ci` and `cd /opt/ea/services/discord-bridge && npm ci`, and install both systemd units.
3. Configure Cloudflare Tunnel (`cloudflared/config.yml`).
4. Register Azure AD app (delegated Graph scopes) + mint refresh token.
5. Twilio: number + voice webhook only (no A2P/messaging service needed — voice doesn't require it).
6. Discord: create the bot, enable Message Content intent, invite to a private server, set `DISCORD_*` in `/etc/ea/env` (see `services/discord-bridge/README.md`).
7. Create the routines via the Paperclip API/UI (they don't import).
