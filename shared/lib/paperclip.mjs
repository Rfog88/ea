// Shared Paperclip API helper for EA skills.
// Requires: PAPERCLIP_API_URL (e.g. http://127.0.0.1:3100), PAPERCLIP_API_TOKEN
// NOTE: exact endpoint shapes are confirmed against the live instance during deploy
// (same pattern Vantyx used). Adjust paths here if the instance differs; all skills
// route through this module so there is one place to fix.

import "./env.mjs";

const COMPANY_SLUG = process.env.EA_COMPANY_SLUG || "ea";

function base() {
  const url = process.env.PAPERCLIP_API_URL;
  if (!url) {
    const e = new Error("missing_env: PAPERCLIP_API_URL");
    e.reason = "api-key-missing";
    throw e;
  }
  return url.replace(/\/$/, "");
}

async function api(path, init = {}) {
  const token = process.env.PAPERCLIP_API_TOKEN;
  if (!token) {
    const e = new Error("missing_env: PAPERCLIP_API_TOKEN");
    e.reason = "api-key-missing";
    throw e;
  }
  const res = await fetch(`${base()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`paperclip_api ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.status === 204 ? null : res.json();
}

// Create an Issue assigned to the `ea` agent.
export function createIssue({ title, body, labels = [], dueAt = null, assigneeSlug = "ea", parentId = null }) {
  return api(`/api/companies/${COMPANY_SLUG}/issues`, {
    method: "POST",
    body: JSON.stringify({
      title,
      body,
      labels,
      dueAt,
      assigneeAgentSlug: assigneeSlug,
      parentId,
    }),
  });
}

export function commentIssue(issueId, body) {
  return api(`/api/issues/${issueId}/comments`, {
    method: "POST",
    body: JSON.stringify({ body }),
  });
}

export function findOpenIssueByLabel(label, key) {
  const q = new URLSearchParams({ label, q: key, status: "open" });
  return api(`/api/companies/${COMPANY_SLUG}/issues?${q}`);
}

// Two-step routine creation: create routine, then attach a one-shot schedule trigger.
// Used by schedule-outbound-call. The trigger fires once at fireAtIso.
export async function createOneShotRoutine({ title, prompt, fireAtIso, assigneeSlug = "ea" }) {
  const routine = await api(`/api/companies/${COMPANY_SLUG}/routines`, {
    method: "POST",
    body: JSON.stringify({ title, prompt, assigneeAgentSlug: assigneeSlug, concurrencyPolicy: "always_enqueue" }),
  });
  const cron = isoToOneShotCron(fireAtIso);
  await api(`/api/routines/${routine.id}/triggers`, {
    method: "POST",
    body: JSON.stringify({ kind: "schedule", cronExpression: cron, timezone: "America/New_York", oneShot: true }),
  });
  return routine;
}

// Build a minute-resolution cron for a single fire time (UTC).
function isoToOneShotCron(iso) {
  const d = new Date(iso);
  return `${d.getUTCMinutes()} ${d.getUTCHours()} ${d.getUTCDate()} ${d.getUTCMonth() + 1} *`;
}
