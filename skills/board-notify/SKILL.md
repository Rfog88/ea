---
schema: agentcompanies/v1
kind: skill
name: board-notify
description: Lower-level notification primitive. Sends an SMS to Ryan (BOARD_PHONE) via Twilio. Honors BOARD_DND_HOURS for non-urgent tiers. Does NOT create a Paperclip Issue — use escalate-to-board for that.
metadata:
  requires_env:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_FROM_NUMBER
    - BOARD_PHONE
    - BOARD_DND_HOURS    # optional, e.g. "22-07"; Tier-1 holds inside window, Tier-2 always fires
  implementation: skills/board-notify/run.mjs
  primary_users: [ea]
  storage: none
  status: ready
---

# board-notify

EA has a single human (Ryan) and a single channel (SMS to his phone). This is the SMS primitive underneath `escalate-to-board`, and is used directly only when an Issue-tracked escalation would be overkill.

## When to use

- As the SMS layer under `escalate-to-board`.
- A one-line FYI that needs no acknowledgement and no tracked Issue.

## When NOT to use

- Anything that needs follow-up → `escalate-to-board` (creates a tracked Issue).
- A reply to an inbound SMS thread → `send-sms` on that thread.

## Inputs

```json
{ "tier": 0, "title": "Bridge restarted", "body": "ea-voice-bridge came back up at 14:02.", "sms_on_tier_2": true }
```

## Outputs

```json
{ "sms": "sent" }
```

## Behavior

- Tier 0 silently drops inside `BOARD_DND_HOURS`. Tier 1 defers inside the window. Tier 2 always fires.
- Prefixes the SMS with a tier tag: `[FYI]` / `[DECISION]` / `[HARD-BLOCK]`.
