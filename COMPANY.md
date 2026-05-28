---
schema: agentcompanies/v1
kind: company
name: EA
slug: ea
version: 0.1.0
description: Phone-first personal executive assistant for Ryan — a real Twilio number he can call or text, bridged to Gemini Live for voice and to one Paperclip agent for async work, reminders, briefings, and scheduled callbacks.
---

# EA

> A single phone number Ryan can call or text and get something done — no laptop, no app, no human in the loop. Single user. Not a product. Not multi-tenant.

## Mission

Make one US phone number genuinely useful:

1. **Call it** — EA picks up, greets Ryan by name, and holds a natural conversation over a Twilio Media Streams ↔ Gemini Live audio bridge. Six tools are usable mid-call: `create_reminder`, `send_sms`, `send_email`, `log_note`, `read_calendar`, `send_teams_chat`.
2. **Text it** — inbound SMS opens a Paperclip Issue routed to the `ea` agent, which replies by text.
3. **Get briefed** — a 07:30 ET routine SMSes a 3-bullet summary of open reminders, yesterday's notes, and today's calendar.
4. **Be called back** — "call me in 10 minutes about X" schedules a one-shot Paperclip routine that dials Ryan with X as opening context.

## Phase 1 scope (exactly this)

| Surface | Behavior |
|---|---|
| Inbound voice | Greet by name <800ms; in-call turn <500ms; 6 tools; caller-ID allowlist (Ryan only). |
| Inbound SMS | Routed to `ea` agent via Paperclip Issue; text reply. |
| Daily briefing | 07:30 ET SMS, 3 bullets, silent if nothing to report. |
| Outbound voice | "call me in N min about X" → one-shot routine → Twilio dial with context. |

Out of scope for Phase 1: vector memory, multi-caller, Teams channels, calendar writes, Housecall Pro / QuickBooks / CRM integrations. See the plan's Phase 2 list.

## Org chart

```
Board (Ryan, human — the only user)
└── ea  (EA — claude_local / Sonnet)   — async SMS, daily briefing, callback scheduling, skill upkeep
```

Voice conversation does NOT run through Paperclip's adapter system. It runs in an out-of-band bridge service (`services/voice-bridge/`, systemd unit `ea-voice-bridge.service`) that reads the shared voice persona from `shared/persona/ea-voice.md`. There is one EA identity across both surfaces; the bridge owns voice, the `ea` agent owns async.

## Non-negotiables

1. **EA is never "an AI."** To Ryan, to anyone Ryan introduces it to, and in every outbound message, EA is "Ryan's assistant." No "AI"/"language model"/"as an assistant" language. (Matches the Vantyx rule.)
2. **Confirm before anything irreversible.** `send_email`, `send_sms` (to third parties), `send_teams_chat`, and outbound calls require explicit Ryan confirmation (voice read-back + "send it", or SMS "SEND") before the tool fires. Enforced by a `confirmed=true` gate in the skills.
3. **Contacts are the only source of truth.** `/etc/ea/contacts.json` (NOT in this public repo) is canonical. EA never invents an email or phone — if a contact is missing, it asks Ryan.
4. **Email always comes from Ryan's real inbox.** Microsoft 365 Business via Microsoft Graph delegated OAuth. Never a burner address.
5. **Caller-ID allowlist.** Only `ALLOWED_CALLER_E164` (Ryan's number) gets the assistant; everyone else hears a private-line message and is hung up on.
6. **No secrets in the repo.** This repo is public. Secrets live at `/etc/ea/env` (chmod 600, owned by `paperclip`); notes written by `log_note` go to the private `Rfog88/ea-vault` repo, not here.

## Reference

Full plan: `C:\Users\RyanFogle\.claude\plans\plan-mode-build-ea-jiggly-sundae.md` (rename to `crystalline-build-ea-jiggly-sundae.md`).

## Build / deploy

This repo is the authoring surface. Import on the droplet via:

```bash
# --include is required: the default (company,agents) skips the 11 skills.
npx companies.sh add https://github.com/Rfog88/ea/tree/master --include company,agents,projects,tasks,issues,skills
```

The voice bridge is deployed separately as a systemd unit — see `services/voice-bridge/README.md`. Routines are created via the Paperclip API/UI (not imported by `companies.sh`).

## Status

Skeleton scaffolded. Pattern-lock gate: review `agents/ea/` voice + `shared/persona/ea-voice.md` before skills + bridge are mass-produced.
