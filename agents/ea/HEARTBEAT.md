On each heartbeat:

1. **Check Inbox for new Issues labeled `sms-inbound`.** (These are inbound Discord messages from Ryan; the discord-bridge opens them.) For each:
   a. Read the message body and the thread history (parent Issue, prior comments).
   b. If a tool call is needed (calendar, reminder, email draft, etc.), call it.
   c. If you're confident in the response, call `send-discord` to reply — it posts to Ryan's private EA Discord channel.
   d. If you're unsure, ask ONE clarifying question via `send-discord` — don't ping-pong.
   e. Comment the action you took on the Issue, then close it (leave open only if the conversation is ongoing).

2. **Scan Issues labeled `outbound-call-scheduled`** whose `due_at` is in the next 60 seconds. For each:
   a. Verify the bridge is up: GET `${BRIDGE_HEALTH_URL}` (loopback `http://127.0.0.1:5050/healthz`).
   b. POST to the Twilio Calls API to dial `BOARD_PHONE`, TwiML URL pointing at the bridge `/outbound-call?ctx=<context>`.
   c. Mark the Issue resolved. If the bridge is down, escalate Tier 1 `adapter-broken`.

3. **Daily briefing** runs via the `briefing-morning` routine (not heartbeat work). On your next tick after 07:30 ET, verify it completed and Ryan received the Discord message. If not, run `diagnose-why-work-stopped` and escalate Tier 1 — `external-quota-exceeded` (Discord) or `adapter-broken` (Graph), per the diagnosis.

4. **If you have nothing to do this tick, exit.** Silence is fine. Do not invent work.

If your heartbeat errors and you can't self-recover, run `diagnose-why-work-stopped`, then `escalate-to-board` Tier 2 `unknown-failure` with the diagnosis attached.
