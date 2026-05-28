---
schema: agentcompanies/v1
kind: skill
name: send-sms
description: Send an SMS from Ryan's Twilio number to a contact. Messages to third parties require `confirmed=true` (read-back gate). Recipient must resolve from /etc/ea/contacts.json.
metadata:
  requires_env:
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_FROM_NUMBER
    - EA_CONTACTS_PATH
  implementation: skills/send-sms/run.mjs
  primary_users: [ea]
  storage: none (audit row written by caller/bridge)
  status: ready
---

# send-sms

Outbound SMS via Twilio. The async `ea` agent uses this to reply to inbound texts; the voice bridge uses it when Ryan says "text <someone>."

## When to use

- Replying to an inbound SMS thread (the recipient is Ryan himself — `confirmed` not required).
- Sending a text to a third party Ryan named on a call (requires `confirmed=true`).

## When NOT to use

- To email → `send-email`. To Teams → `send-teams-chat`.

## Inputs

```json
{ "to": "brother", "body": "I'll be 20 minutes late.", "confirmed": true }
```

`to` = contact slug, name, or E.164. If `to` resolves to anyone other than `BOARD_PHONE`, `confirmed=true` is required or the skill refuses.

## Outputs

```json
{ "ok": true, "sid": "SMxxxx", "to": "+15555550102" }
```

## Behavior

1. Resolve `to` to E.164 via contacts (or accept a literal E.164).
2. If the resolved number is not `BOARD_PHONE` and `confirmed !== true`, return `{ok:false, error:"confirmed_required"}`.
3. POST to Twilio Messages API. Return `{ok, sid, to}`.
4. On unknown contact, return `{ok:false, error:"unknown_contact", ref}` — do NOT guess.
