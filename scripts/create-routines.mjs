#!/usr/bin/env node
// create-routines — create EA's two recurring Paperclip routines from the values
// in ../.paperclip.yaml (which companies.sh does NOT import). Run this LAST, after
// the voice bridge is durable and /etc/ea/env has real secrets — creating
// `bridge-heartbeat` before the bridge is live spams "bridge-down" escalations.
//
// Usage (on the droplet, where the Paperclip API is loopback at :3100):
//   node scripts/create-routines.mjs --dry-run     # print payloads, POST nothing
//   node scripts/create-routines.mjs               # create both routines
//   node scripts/create-routines.mjs heartbeat     # create only bridge-heartbeat
//
// Env (loopback API accepts any bearer token in local_trusted mode):
//   PAPERCLIP_API_URL   default http://127.0.0.1:3100
//   PAPERCLIP_API_TOKEN default "local"
//   EA_COMPANY_ID       company UUID (preferred — most routes address by UUID).
//                       Falls back to EA_COMPANY_SLUG ("ea") if unset.
//
// NOTE: endpoint shapes mirror shared/lib/paperclip.mjs and are "confirmed against
// the live instance during deploy." If a POST 404s, fix the path here AND there.

const API = (process.env.PAPERCLIP_API_URL || "http://127.0.0.1:3100").replace(/\/$/, "");
const TOKEN = process.env.PAPERCLIP_API_TOKEN || "local";
const COMPANY = process.env.EA_COMPANY_ID || process.env.EA_COMPANY_SLUG || "ea";
const DRY = process.argv.includes("--dry-run");
const ONLY = process.argv.find((a) => a === "briefing" || a === "heartbeat");

// Source of truth: .paperclip.yaml. Keep these in sync with that file.
//
// CAVEAT (verify on first fire): .paperclip.yaml sets briefing cron "30 11 * * *"
// with timezone America/New_York and a comment "11:30 UTC = 07:30 ET". Those two
// conflict: if the scheduler reads the cron IN the given timezone, "30 11" fires at
// 11:30 ET, not 07:30, and a fixed-UTC cron also drifts an hour across DST. The
// DST-safe form for 07:30 ET is cron "30 7 * * *" + timezone America/New_York.
// Set BRIEFING_CRON below to match whatever your platform's cron-tz semantics are,
// then confirm the first real fire time.
const BRIEFING_CRON = process.env.BRIEFING_CRON || "30 11 * * *";

const ROUTINES = {
  briefing: {
    title: "Daily briefing (07:30 ET)",
    assigneeAgentSlug: "ea",
    concurrencyPolicy: "skip_if_active",
    catchUpPolicy: "skip_missed",
    trigger: { kind: "schedule", cronExpression: BRIEFING_CRON, timezone: "America/New_York" },
    prompt: [
      "Run the `daily-briefing` skill. It reads open `reminder` Issues due in the",
      "next 24h, yesterday's vault notes, and today's calendar, formats a 3-bullet",
      "SMS, and sends it to BOARD_PHONE. If there is nothing to report, it sends",
      "nothing — that is correct. If the skill returns ok:false, run",
      "diagnose-why-work-stopped and escalate Tier 1 with the diagnosed reason.",
    ].join(" "),
  },
  heartbeat: {
    title: "Bridge heartbeat ping",
    assigneeAgentSlug: "ea",
    concurrencyPolicy: "skip_if_active",
    catchUpPolicy: "skip_missed",
    trigger: { kind: "schedule", cronExpression: "*/5 * * * *", timezone: "America/New_York" },
    prompt: [
      "GET http://127.0.0.1:5050/healthz. If it is non-2xx three consecutive times,",
      "escalate Tier 2 `adapter-broken` with error_signature \"bridge-down\". On the",
      "first success after a failure streak, send a board-notify Tier 0 \"bridge back up\".",
    ].join(" "),
  },
};

async function api(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} -> ${res.status}: ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}

async function createRoutine(key, def) {
  const { trigger, ...routine } = def;
  if (DRY) {
    console.log(`\n# ${key}`);
    console.log(`POST /api/companies/${COMPANY}/routines`);
    console.log(JSON.stringify(routine, null, 2));
    console.log(`POST /api/routines/{id}/triggers`);
    console.log(JSON.stringify(trigger, null, 2));
    return;
  }
  const created = await api(`/api/companies/${COMPANY}/routines`, routine);
  const id = created?.id ?? created?.routine?.id;
  if (!id) throw new Error(`no routine id in response: ${JSON.stringify(created).slice(0, 200)}`);
  await api(`/api/routines/${id}/triggers`, trigger);
  console.log(`✓ ${key}: routine ${id} + ${trigger.kind} trigger (${trigger.cronExpression})`);
}

async function main() {
  const keys = ONLY ? [ONLY] : ["briefing", "heartbeat"];
  console.log(`Target: ${API}  company=${COMPANY}  ${DRY ? "(dry-run)" : ""}`);
  for (const key of keys) {
    try {
      await createRoutine(key, ROUTINES[key]);
    } catch (e) {
      console.error(`✗ ${key}: ${e.message}`);
      process.exitCode = 1;
    }
  }
}

main();
