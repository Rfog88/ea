#!/usr/bin/env node
// read-calendar — read Ryan's Outlook calendar window via Microsoft Graph (read-only).
// Invocation: echo '{"start_iso":"...","end_iso":"..."}' | node skills/read-calendar/run.mjs

import { readFileSync } from "node:fs";
import { graphFetch } from "../../shared/lib/graph.mjs";

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const start = input.start_iso;
  const end = input.end_iso;
  if (!start || !end) throw new Error("invalid_input: missing start_iso or end_iso");

  const q = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $orderby: "start/dateTime",
    $top: "20",
    $select: "subject,start,end,location,organizer",
  });

  const res = await graphFetch(`/me/calendarView?${q}`, {
    method: "GET",
    headers: { Prefer: 'outlook.timezone="America/New_York"' },
  });
  if (!res.ok) {
    const txt = await res.text();
    const reason = res.status === 401 ? "api-key-missing" : res.status >= 500 ? "external-quota-exceeded" : "adapter-broken";
    console.error(JSON.stringify({ ok: false, error: `graph ${res.status}: ${txt.slice(0, 200)}`, reason }));
    process.exit(1);
  }
  const json = await res.json();
  const events = (json.value || []).map((e) => ({
    subject: e.subject || "(no subject)",
    start: e.start?.dateTime || null,
    end: e.end?.dateTime || null,
    location: e.location?.displayName || null,
    organizer: e.organizer?.emailAddress?.name || null,
  }));
  console.log(JSON.stringify({ ok: true, count: events.length, events }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
