---
schema: agentcompanies/v1
kind: skill
name: send-email
description: Send an email from Ryan's M365 Business inbox via Microsoft Graph delegated OAuth. Sender = Ryan; recipients see his address. Refuses unless `confirmed=true`.
metadata:
  requires_env:
    - MS_GRAPH_TENANT_ID
    - MS_GRAPH_CLIENT_ID
    - MS_GRAPH_CLIENT_SECRET
    - MS_GRAPH_REFRESH_TOKEN
    - EA_CONTACTS_PATH
  implementation: skills/send-email/run.mjs
  primary_users: [ea]
  storage: none (Graph is system of record; bridge writes audit row)
  status: needs-azure-app-registration
---

# send-email

The "EA sent this from Ryan" surface. Recipients see Ryan's address, not EA's.

## When to use

- After Ryan verbally or via SMS confirms an outbound email.
- The caller (bridge or agent) passes `confirmed=true` once Ryan has heard the read-back.

## When NOT to use

- Without `confirmed=true` — refuse. This is the hard gate.
- For mass-send (>5 recipients) — Phase 1 single-recipient only.

## Inputs

```json
{
  "to": "amber",
  "subject": "Lot 41 Glenn Hills — items 1, 2, 3",
  "body": "Amber, ...",
  "confirmed": true
}
```

## Outputs

```json
{ "ok": true, "to": "amber@example.com" }
```

## Behavior

1. If `confirmed !== true`, return `{ok:false, error:"confirmed_required"}`.
2. Resolve `to` to an email via contacts (or accept a literal email address).
3. Refresh Graph token (auto-cached).
4. POST `/me/sendMail` with an HTML body (plain text is wrapped).
5. Return `{ok, to}`. On 401 after refresh → `reason: api-key-missing` (grant revoked). On repeated 5xx → `reason: external-quota-exceeded`.
