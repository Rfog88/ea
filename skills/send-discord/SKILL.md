---
schema: agentcompanies/v1
kind: skill
name: send-discord
description: Send a message from EA to Ryan over Discord (his private EA channel or DM). This is the primary EA->Ryan text channel — replies to inbound messages, ad-hoc notifications. No carrier/A2P registration involved.
metadata:
  requires_env:
    - DISCORD_BOT_TOKEN
    - DISCORD_CHANNEL_ID   # or DISCORD_OWNER_ID for a DM fallback
  implementation: skills/send-discord/run.mjs
  primary_users: [ea]
  storage: none (audit row written by caller/bridge)
  status: ready
---

# send-discord

Outbound Discord message. The async `ea` agent uses this to reply to inbound
Discord messages and to push notifications (e.g. the daily briefing). Recipient
is always Ryan — a single private channel or DM that only he can read.

## When to use

- Replying to an inbound Discord message from Ryan.
- Any EA->Ryan notification that used to go out as SMS.

## When NOT to use

- To email → `send-email`. To Teams → `send-teams-chat`.
- To text a THIRD PARTY (someone not Ryan): Discord can't reach them. That path
  needs SMS, which requires Twilio A2P 10DLC registration. Not supported here.

## Inputs

```json
{ "body": "On it — I'll remind you at 3pm." }
```

Optional `channelId` overrides the default target channel.

## Outputs

```json
{ "ok": true, "id": "123456789012345678", "channel": "987654321098765432" }
```

## Behavior

1. Resolve the target channel: `channelId` arg → `DISCORD_CHANNEL_ID` →
   open a DM with `DISCORD_OWNER_ID`.
2. POST the message to the Discord API (truncated to Discord's 2000-char limit).
3. Return `{ok, id, channel}`. No confirmation gate — the channel is Ryan-only.
