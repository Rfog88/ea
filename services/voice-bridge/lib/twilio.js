// Twilio helpers: webhook signature validation + outbound dial.
import twilio from "twilio";

// Validate X-Twilio-Signature on an incoming webhook. Returns boolean.
// Fastify gives us the parsed form body; Twilio signs the full public URL + sorted params.
export function validateTwilioRequest(req) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token) return false;
  const signature = req.headers["x-twilio-signature"];
  if (!signature) return false;

  // Reconstruct the public URL Twilio used (behind Cloudflare Tunnel).
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || "https";
  const url = `${proto}://${host}${req.raw.url}`;

  const params = req.body && typeof req.body === "object" ? req.body : {};
  try {
    return twilio.validateRequest(token, signature, url, params);
  } catch {
    return false;
  }
}

// Place an outbound call that connects Ryan to the bridge's /outbound-call TwiML.
export async function dialBoard(ctx) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.BOARD_PHONE;
  const publicHost = process.env.EA_PUBLIC_HOST; // e.g. ea.example.com
  if (!sid || !token || !from || !to || !publicHost) {
    throw new Error("dial_board: missing TWILIO_* / BOARD_PHONE / EA_PUBLIC_HOST");
  }
  const client = twilio(sid, token);
  const call = await client.calls.create({
    from,
    to,
    url: `https://${publicHost}/outbound-call?ctx=${encodeURIComponent(ctx || "")}`,
    method: "POST",
  });
  return call.sid;
}
