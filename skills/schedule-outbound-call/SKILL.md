---
schema: agentcompanies/v1
kind: skill
name: schedule-outbound-call
description: Schedule a one-shot outbound call from EA to Ryan at a future time, carrying a context string ("call me in 10 min about X"). Creates a one-shot Paperclip routine.
metadata:
  requires_env:
    - PAPERCLIP_API_URL
    - PAPERCLIP_API_TOKEN
  implementation: skills/schedule-outbound-call/run.mjs
  primary_users: [ea]
  storage: paperclip-routine (one-shot) + issue (label `outbound-call-scheduled`)
  status: needs-paperclip-api-confirm
---

# schedule-outbound-call

Backs "call me in N minutes about X." Creates a one-shot routine that, when it fires, has the `ea` agent dial Ryan via Twilio with `X` as opening context.

## When to use

- Ryan (by SMS or on a call) asks EA to call him back later about a topic.

## When NOT to use

- Immediate calls — there is no Phase 1 "call me right now" path (just stay on the line).

## Inputs

```json
{ "when": "2026-05-27T15:35:00Z", "context": "the Cipher invoice" }
```

## Outputs

```json
{ "ok": true, "routine_id": "...", "fire_at": "2026-05-27T15:35:00Z" }
```

## Behavior

1. Normalize `when` to ISO-8601 UTC.
2. Create a one-shot routine whose prompt instructs `ea` to dial `BOARD_PHONE` with TwiML pointing at the bridge `/outbound-call?ctx=<context>`.
3. Also open an Issue labeled `outbound-call-scheduled` with `dueAt` = fire time, so the heartbeat has a visible record.
4. Return `{ok, routine_id, fire_at}`.
