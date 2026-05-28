---
schema: agentcompanies/v1
kind: skill
name: escalate-to-board
description: Create a Paperclip Issue assigned to Board (Ryan) with a standardized reason, fire board-notify (SMS), and apply labels. Tier-2 dedupe by (agent_slug, error_signature).
metadata:
  requires_env:
    - PAPERCLIP_API_URL
    - PAPERCLIP_API_TOKEN
    - TWILIO_ACCOUNT_SID
    - TWILIO_AUTH_TOKEN
    - TWILIO_FROM_NUMBER
    - BOARD_PHONE
  implementation: skills/escalate-to-board/run.mjs
  primary_users: [ea]
  status: needs-paperclip-api-confirm
---

# escalate-to-board

The "I need Ryan" channel. For EA, Board = Ryan, and the only channel is SMS (no Discord). Still creates a tracked Issue so the request isn't lost.

## When to use

A standardized reason:
1. `api-key-missing` — secret not bound or grant revoked for `<service>`.
2. `subscription-rate-limit` — `<model>` quota hit; resumes at `<reset_time>`.
3. `decision-needed` — choose between `<X>`/`<Y>`; default after `<window>`: `<default>`.
4. `external-quota-exceeded` — `<service>` plan limit reached.
5. `agent-conflict` — (rare for single-agent EA) contradictory outputs.
6. `human-review-required` — Ryan must look before EA proceeds.
7. `adapter-broken` — bridge/Twilio/Graph failing repeatedly.
8. `unknown-failure` — attach `diagnose-why-work-stopped` output.

## When NOT to use

- Status FYI → `board-notify` Tier 0.
- A reply to an SMS thread → `send-sms`.

## Inputs

```json
{
  "tier": 1,
  "reason": "decision-needed",
  "title": "Outbound call can't fire",
  "context": "Bridge /healthz returned 502 twice.",
  "suggested_action": "Restart ea-voice-bridge or text me to retry.",
  "error_signature": "bridge-502"
}
```

## Outputs

```json
{ "ok": true, "issue_id": "EA-301", "sms": "sent", "dedup": false }
```

## Behavior

- Tier-2 dedupe: if an open Issue with the same `error_signature` exists, no-op with `{dedup:true, existing}`.
- Create Issue assigned to Board, labels `pending_human` + `reason:<reason>`.
- Fire `board-notify` (tier passed through; SMS on Tier 2).
