// Tool registry. Maps Gemini Live function names to EA skill scripts and runs them.
// Skills are the same process-adapter run.mjs scripts the `ea` agent uses: JSON on
// stdin -> JSON on stdout. Running them in-process here (rather than HTTP-hopping
// through Paperclip) keeps voice tool-call latency at localhost-spawn speed.
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chargeToolCall } from "./auth.js";
import { logToolCall } from "./audit.js";

const here = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(here, "..", "..", "..", "skills");

// Gemini function name -> skill folder. send_* tools require confirmed=true, which
// the persona supplies once Ryan says "send it" — the bridge passes it through.
const MAP = {
  create_reminder: "create-reminder",
  send_sms: "send-sms",
  send_email: "send-email",
  log_note: "log-note",
  read_calendar: "read-calendar",
  send_teams_chat: "send-teams-chat",
};

// Gemini Live function declarations (mirrors plan Section 6).
export const TOOLS = [
  { name: "create_reminder", description: "Open a reminder with a due time. No confirmation.",
    parameters: { type: "object", required: ["text", "when"], properties: {
      text: { type: "string", description: "Reminder text in Ryan's voice." },
      when: { type: "string", description: "ISO-8601 datetime, or natural language like 'tomorrow 3pm ET'." } } } },
  { name: "send_sms", description: "Text a contact from Ryan's number. Read back + confirm before sending to a third party.",
    parameters: { type: "object", required: ["to", "body"], properties: {
      to: { type: "string", description: "Contact slug, name, or E.164." }, body: { type: "string" },
      confirmed: { type: "boolean", description: "Set true only after Ryan says send it." } } } },
  { name: "send_email", description: "Email from Ryan's Outlook (sent as Ryan). Always read back + confirm first.",
    parameters: { type: "object", required: ["to", "subject", "body"], properties: {
      to: { type: "string" }, subject: { type: "string" }, body: { type: "string" },
      confirmed: { type: "boolean" } } } },
  { name: "log_note", description: "Write a 'remember this' note to Ryan's private vault. No confirmation.",
    parameters: { type: "object", required: ["topic", "content"], properties: {
      topic: { type: "string" }, content: { type: "string" } } } },
  { name: "read_calendar", description: "Read Ryan's calendar between two ISO datetimes. Read-only.",
    parameters: { type: "object", required: ["start_iso", "end_iso"], properties: {
      start_iso: { type: "string" }, end_iso: { type: "string" } } } },
  { name: "send_teams_chat", description: "Send a Teams 1:1 chat as Ryan. Always read back + confirm first.",
    parameters: { type: "object", required: ["to", "body"], properties: {
      to: { type: "string" }, body: { type: "string" }, confirmed: { type: "boolean" } } } },
];

function runSkill(folder, input) {
  return new Promise((resolve) => {
    const script = join(SKILLS_DIR, folder, "run.mjs");
    const child = execFile("node", [script], { timeout: 15000 }, (err, stdout, stderr) => {
      // Skills print JSON on stdout for success, on stderr for handled errors.
      const raw = (stdout && stdout.trim()) || (stderr && stderr.trim()) || "{}";
      try { resolve(JSON.parse(raw.split("\n").pop())); }
      catch { resolve({ ok: false, error: err ? err.message : "unparseable_skill_output" }); }
    });
    child.stdin.write(JSON.stringify(input));
    child.stdin.end();
  });
}

// Dispatch a Gemini tool call. Enforces per-call tool budget.
export async function dispatchTool(call, { callSid } = {}) {
  const folder = MAP[call.name];
  if (!folder) return { ok: false, error: `unknown_tool: ${call.name}` };
  if (callSid && !chargeToolCall(callSid)) return { ok: false, error: "tool_budget_exceeded" };

  const input = call.arguments || call.args || {};
  const result = await runSkill(folder, input);
  if (callSid) logToolCall(callSid, call.name, input, result);
  return result;
}
