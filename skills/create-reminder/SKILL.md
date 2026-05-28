---
schema: agentcompanies/v1
kind: skill
name: create-reminder
description: Open a Paperclip Issue tagged `reminder` with a due time. Use for one-off reminders Ryan asks for by voice or SMS. No confirmation required.
metadata:
  requires_env:
    - PAPERCLIP_API_URL
    - PAPERCLIP_API_TOKEN
  implementation: skills/create-reminder/run.mjs
  primary_users: [ea]
  storage: paperclip-issues (label `reminder`, dueAt)
  status: needs-paperclip-api-confirm
---

# create-reminder

The reminder surface. Creates a Paperclip Issue the daily briefing later picks up.

## When to use

- "Remind me to X at/in <time>." Voice or SMS.

## When NOT to use

- For "remember this fact" content with no time → use `log-note`.
- For scheduling an outbound call → use `schedule-outbound-call`.

## Inputs

```json
{ "text": "Call back the Glenn Hills inspector", "when": "2026-05-28T19:00:00Z" }
```

`when` accepts ISO-8601 or natural language ("tomorrow 3pm ET"); natural language is normalized to ISO by the caller before this runs. EA's own timezone reference is America/New_York.

## Outputs

```json
{ "ok": true, "issue_id": "EA-123", "due_at": "2026-05-28T19:00:00Z" }
```

## Behavior

1. Normalize `when` to an ISO-8601 UTC instant (reject if unparseable).
2. Create an Issue: title = first 60 chars of `text`, body = full `text`, label `reminder`, `dueAt` = ISO, assignee `ea`.
3. Return `{ok, issue_id, due_at}`. On API failure, return `{ok:false, error, reason}`.
