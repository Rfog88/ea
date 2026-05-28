---
schema: agentcompanies/v1
kind: skill
name: send-teams-chat
description: Send a Microsoft Teams 1:1 chat message as Ryan via Microsoft Graph. Confirms before sending. No channel posts in Phase 1.
metadata:
  requires_env:
    - MS_GRAPH_TENANT_ID
    - MS_GRAPH_CLIENT_ID
    - MS_GRAPH_CLIENT_SECRET
    - MS_GRAPH_REFRESH_TOKEN
    - EA_CONTACTS_PATH
  implementation: skills/send-teams-chat/run.mjs
  primary_users: [ea]
  storage: none
  status: needs-azure-app-registration
---

# send-teams-chat

Sends a 1:1 Teams chat as Ryan. Same `confirmed=true` gate as email.

## When to use

- "Message <person> on Teams that ..." after Ryan confirms.

## When NOT to use

- Channel/group posts — Phase 2.
- Without `confirmed=true` — refuse.

## Inputs

```json
{ "to": "amber", "body": "Running 20 late to the walkthrough.", "confirmed": true }
```

`to` resolves to a Teams UPN (email) via contacts, or accepts a literal UPN.

## Outputs

```json
{ "ok": true, "chat_id": "19:...", "to": "amber@example.com" }
```

## Behavior

1. If `confirmed !== true`, return `{ok:false, error:"confirmed_required"}`.
2. Resolve `to` to a UPN via contacts (`teams_upn` field; falls back to `email`).
3. Find or create the 1:1 chat: `POST /chats` with members = [me, them], chatType oneOnOne (Graph returns existing if present).
4. `POST /chats/{id}/messages` with the body.
5. Return `{ok, chat_id, to}`.
