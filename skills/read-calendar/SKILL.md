---
schema: agentcompanies/v1
kind: skill
name: read-calendar
description: Read Ryan's Outlook calendar between two ISO datetimes via Microsoft Graph. Read-only. Returns up to 20 events with title/start/end/location/organizer.
metadata:
  requires_env:
    - MS_GRAPH_TENANT_ID
    - MS_GRAPH_CLIENT_ID
    - MS_GRAPH_CLIENT_SECRET
    - MS_GRAPH_REFRESH_TOKEN
  implementation: skills/read-calendar/run.mjs
  primary_users: [ea]
  storage: none
  status: needs-azure-app-registration
---

# read-calendar

Answers "what's on my calendar tomorrow?" on a call or by SMS. Read-only — no writes in Phase 1.

## When to use

- Calendar lookups for a window. Voice or SMS.
- Inside `daily-briefing` to assemble today's meeting list.

## When NOT to use

- To create/move events — Phase 2.

## Inputs

```json
{ "start_iso": "2026-05-28T00:00:00-04:00", "end_iso": "2026-05-28T23:59:59-04:00" }
```

## Outputs

```json
{ "ok": true, "count": 2, "events": [
  { "subject": "Glenn Hills walk", "start": "...", "end": "...", "location": "Lot 41", "organizer": "Amber Reynolds" }
] }
```

## Behavior

1. Graph `GET /me/calendarView?startDateTime=&endDateTime=&$orderby=start/dateTime&$top=20`.
2. Project each event to subject/start/end/location/organizer.
3. Return `{ok, count, events}`.
