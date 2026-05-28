---
schema: agentcompanies/v1
kind: skill
name: inbound-sms-handler
description: Open or reopen a Paperclip Issue for an inbound SMS, keyed by sender number, labeled `sms-inbound`, so the `ea` agent picks it up on its next heartbeat.
metadata:
  requires_env:
    - PAPERCLIP_API_URL
    - PAPERCLIP_API_TOKEN
  implementation: skills/inbound-sms-handler/run.mjs
  primary_users: [ea]
  storage: paperclip-issues (label `sms-inbound`)
  status: needs-paperclip-api-confirm
---

# inbound-sms-handler

Called by the bridge's `/sms` webhook. Turns an inbound text into tracked work. Does NOT reply — the `ea` agent does that on its heartbeat (so replies go through the same judgment + confirmation rules).

## When to use

- Every inbound SMS from `BOARD_PHONE`.

## Inputs

```json
{ "from": "+1XXXXXXXXXX", "body": "what's on my calendar tomorrow" }
```

## Outputs

```json
{ "ok": true, "issue_id": "EA-200", "reopened": false }
```

## Behavior

1. Look for an open Issue labeled `sms-inbound` whose key matches `from` (active thread).
2. If found, append the body as a comment (reopened=true). Else create a new Issue: title = first 60 chars of body, label `sms-inbound`, body includes `from` + message.
3. Return `{ok, issue_id, reopened}`. The reply is generated later by the agent.
