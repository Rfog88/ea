// Caller-ID allowlist + per-call budget (cost + duration ceilings).

const calls = new Map(); // callSid -> { startedAt, toolCalls }

export function isAllowedCaller(from) {
  const allowed = process.env.ALLOWED_CALLER_E164;
  if (!allowed) return false; // fail closed
  return String(from).trim() === allowed.trim();
}

export function openCallBudget(callSid) {
  const maxSec = parseInt(process.env.MAX_CALL_SECONDS || "1800", 10); // 30 min default
  const maxTools = parseInt(process.env.MAX_TOOLS_PER_CALL || "20", 10);
  const state = { startedAt: Date.now(), toolCalls: 0, maxSec, maxTools };
  calls.set(callSid, state);
  return state;
}

export function callExpired(callSid) {
  const s = calls.get(callSid);
  if (!s) return false;
  return (Date.now() - s.startedAt) / 1000 > s.maxSec;
}

// Returns true if the tool call is allowed; increments the counter.
export function chargeToolCall(callSid) {
  const s = calls.get(callSid);
  if (!s) return false;
  if (s.toolCalls >= s.maxTools) return false;
  s.toolCalls += 1;
  return true;
}

export function closeCallBudget(callSid) {
  calls.delete(callSid);
}
