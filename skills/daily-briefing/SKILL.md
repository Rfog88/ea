---
schema: agentcompanies/v1
kind: skill
name: daily-briefing
description: Assemble a 3-bullet morning briefing (open reminders + yesterday's notes + today's calendar) and send it to Ryan over Discord. Silent if there is nothing to report.
metadata:
  requires_env:
    - PAPERCLIP_API_URL
    - PAPERCLIP_API_TOKEN
    - MS_GRAPH_TENANT_ID
    - MS_GRAPH_CLIENT_ID
    - MS_GRAPH_CLIENT_SECRET
    - MS_GRAPH_REFRESH_TOKEN
    - DISCORD_BOT_TOKEN
    - DISCORD_CHANNEL_ID
    - EA_VAULT_REPO_PATH
  implementation: skills/daily-briefing/run.mjs
  primary_users: [ea]
  storage: reads paperclip-issues + vault notes + graph calendar; sends via Discord
  status: needs-paperclip-api-confirm
---

# daily-briefing

The 07:30 ET routine's worker. Pulls three sources, formats a compact message, sends to Ryan over Discord. Sends NOTHING if all three are empty — no "all clear" pings.

## When to use

- Only via the `briefing-morning` routine.

## Inputs

```json
{}
```

(No inputs; reads its own sources.)

## Outputs

```json
{ "ok": true, "sent": true, "reminders": 2, "meetings": 3, "notes": 1 }
```

## Behavior

1. Reminders: open Issues labeled `reminder` with `dueAt` in the next 24h.
2. Notes: files in the vault `notes/` dir dated yesterday.
3. Calendar: `read-calendar` for today (00:00–23:59 ET).
4. Format: "Morning Ryan. <N> reminders: <…>. <M> meetings: <times>. Notes from yesterday: <topics>." Drop any empty section.
5. If the message has no substance, do not send — return `{ok:true, sent:false}`.
6. Else send via Discord (`send-discord` shared helper) to Ryan's EA channel.
