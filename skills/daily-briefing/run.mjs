#!/usr/bin/env node
// daily-briefing — assemble + SMS the 07:30 ET briefing. Silent if nothing to report.
// Invocation: echo '{}' | node skills/daily-briefing/run.mjs

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { findOpenIssueByLabel } from "../../shared/lib/paperclip.mjs";
import { graphFetch } from "../../shared/lib/graph.mjs";

function etDayBounds(offsetDays = 0) {
  // Compute ET midnight bounds without a tz lib: ET is UTC-5 (EST) / UTC-4 (EDT).
  // Use Intl to get the ET date string, then build an ISO with a fixed offset query.
  const now = new Date(Date.now() + offsetDays * 86400000);
  const etDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now); // YYYY-MM-DD
  return {
    start: `${etDate}T00:00:00`,
    end: `${etDate}T23:59:59`,
    date: etDate,
  };
}

async function getReminders() {
  try {
    const res = await findOpenIssueByLabel("reminder", "");
    const items = (res?.issues || res || []).filter((i) => {
      if (!i.dueAt) return false;
      const due = new Date(i.dueAt).getTime();
      return due >= Date.now() && due <= Date.now() + 24 * 3600 * 1000;
    });
    return items.map((i) => i.title);
  } catch {
    return [];
  }
}

function getYesterdayNotes() {
  const repo = process.env.EA_VAULT_REPO_PATH;
  if (!repo) return [];
  const { date } = etDayBounds(-1);
  try {
    return readdirSync(join(repo, "notes"))
      .filter((f) => f.startsWith(date) && f.endsWith(".md"))
      .map((f) => f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "").replace(/-/g, " "));
  } catch {
    return [];
  }
}

async function getMeetings() {
  const { start, end } = etDayBounds(0);
  try {
    const q = new URLSearchParams({ startDateTime: start, endDateTime: end, $orderby: "start/dateTime", $top: "20", $select: "subject,start" });
    const res = await graphFetch(`/me/calendarView?${q}`, { method: "GET", headers: { Prefer: 'outlook.timezone="America/New_York"' } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.value || []).map((e) => {
      const t = e.start?.dateTime ? new Date(e.start.dateTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "America/New_York" }) : "";
      return `${t} ${e.subject || ""}`.trim();
    });
  } catch {
    return [];
  }
}

async function sendSms(body) {
  const sid = process.env.TWILIO_ACCOUNT_SID, token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER, to = process.env.BOARD_PHONE;
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const form = new URLSearchParams({ From: from, To: to, Body: body });
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const res = await fetch(url, { method: "POST", headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" }, body: form });
  if (!res.ok) { const e = new Error(`twilio ${res.status}`); e.reason = "external-quota-exceeded"; throw e; }
}

async function main() {
  readFileSync(0, "utf8"); // drain stdin
  const [reminders, notes, meetings] = await Promise.all([getReminders(), Promise.resolve(getYesterdayNotes()), getMeetings()]);

  const parts = [];
  if (reminders.length) parts.push(`${reminders.length} reminders: ${reminders.join("; ")}`);
  if (meetings.length) parts.push(`${meetings.length} meetings: ${meetings.join("; ")}`);
  if (notes.length) parts.push(`Notes from yesterday: ${notes.join("; ")}`);

  if (!parts.length) {
    console.log(JSON.stringify({ ok: true, sent: false, reminders: 0, meetings: 0, notes: 0 }));
    return;
  }

  const msg = `Morning Ryan. ${parts.join(". ")}.`;
  await sendSms(msg.slice(0, 1500));
  console.log(JSON.stringify({ ok: true, sent: true, reminders: reminders.length, meetings: meetings.length, notes: notes.length }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
