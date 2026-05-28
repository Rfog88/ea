// EA voice bridge — Twilio Media Streams <-> Gemini Live.
// Pattern adapted from twilio-samples/speech-assistant-openai-realtime-api-node,
// retargeted to Gemini Live with µ-law<->PCM16 transcoding and EA tool calls.
import Fastify from "fastify";
import fastifyFormBody from "@fastify/formbody";
import fastifyWs from "@fastify/websocket";
import dotenv from "dotenv";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { validateTwilioRequest, dialBoard } from "./lib/twilio.js";
import { isAllowedCaller, openCallBudget, closeCallBudget, callExpired } from "./lib/auth.js";
import { mulawToPcm16, pcm16ToMulaw } from "./lib/transcode.js";
import { connectGemini } from "./lib/gemini.js";
import { TOOLS, dispatchTool } from "./lib/tools.js";
import { loadPersona, personaWithContext } from "./lib/persona.js";
import { logSession } from "./lib/audit.js";

dotenv.config({ path: process.env.EA_ENV_FILE || "/etc/ea/env" });

const PORT = process.env.PORT || 5050;
const VOICE = process.env.GEMINI_VOICE || "Charon";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash-native-audio-preview-09-2025";
const BASE_PERSONA = loadPersona(); // fail fast at boot if missing

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS_DIR = join(HERE, "..", "..", "skills");

function spawnSkill(folder, input) {
  const child = execFile("node", [join(SKILLS_DIR, folder, "run.mjs")], () => {});
  child.stdin.write(JSON.stringify(input));
  child.stdin.end();
}

const app = Fastify({ logger: true });
app.register(fastifyFormBody);
app.register(fastifyWs);

app.get("/healthz", async () => ({ ok: true }));

function streamTwiml(host, ctx) {
  const qs = ctx ? `?ctx=${encodeURIComponent(ctx)}` : "";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://${host}/media-stream${qs}"/>
  </Connect>
</Response>`;
}

// Inbound call. Validate signature, allowlist caller, return media-stream TwiML.
app.all("/incoming-call", async (req, reply) => {
  if (!validateTwilioRequest(req)) return reply.code(403).send();
  const from = req.body?.From ?? req.query?.From;
  if (!isAllowedCaller(from)) {
    logSession("n/a", "rejected-caller", { from });
    return reply.type("text/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Google.en-US-Chirp3-HD-Aoede">This number is a private line. Please leave a message after the tone.</Say>
  <Hangup/>
</Response>`);
  }
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  reply.type("text/xml").send(streamTwiml(host, null));
});

// Outbound (scheduled callback). Twilio dials Ryan and hits this for TwiML.
app.all("/outbound-call", async (req, reply) => {
  if (!validateTwilioRequest(req)) return reply.code(403).send();
  const ctx = req.query?.ctx ?? "";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  reply.type("text/xml").send(streamTwiml(host, ctx));
});

// Inbound SMS. Hand to Paperclip; the `ea` agent replies on its heartbeat.
app.all("/sms", async (req, reply) => {
  if (!validateTwilioRequest(req)) return reply.code(403).send();
  const { From, Body } = req.body || {};
  logSession("sms", "inbound", { from: From, body: Body });
  spawnSkill("inbound-sms-handler", { from: From, body: Body });
  reply.type("text/xml").send("<Response/>");
});

// Outbound dial trigger (called by the `ea` agent's heartbeat when a callback fires).
app.post("/trigger-callback", async (req, reply) => {
  // Loopback-only endpoint (not exposed via tunnel ingress). Auth via shared token.
  if (req.headers["x-ea-internal"] !== process.env.EA_INTERNAL_TOKEN) return reply.code(403).send();
  try {
    const sid = await dialBoard(req.body?.ctx || "");
    reply.send({ ok: true, call_sid: sid });
  } catch (e) {
    reply.code(502).send({ ok: false, error: e.message });
  }
});

// Media stream WebSocket: Twilio <-> Gemini Live.
app.register(async (app) => {
  app.get("/media-stream", { websocket: true }, (connection, req) => {
    const ctx = req.query?.ctx || "";
    let streamSid = null;
    let callSid = `call-${Date.now()}`;
    const budget = openCallBudget(callSid);
    logSession(callSid, "ws-open", { ctx });

    const gemini = connectGemini({
      apiKey: process.env.GEMINI_API_KEY,
      model: MODEL,
      voice: VOICE,
      tools: TOOLS,
      instructions: personaWithContext(BASE_PERSONA, ctx),
      onAudioDelta: (pcm24) => {
        if (!streamSid) return;
        const mulaw = pcm16ToMulaw(pcm24, 24000);
        connection.send(JSON.stringify({ event: "media", streamSid, media: { payload: mulaw.toString("base64") } }));
      },
      onInterrupted: () => {
        // Barge-in: flush whatever Twilio has buffered so EA stops talking immediately.
        if (streamSid) connection.send(JSON.stringify({ event: "clear", streamSid }));
      },
      onToolCall: (call) => dispatchTool(call, { callSid }),
      onError: (e) => logSession(callSid, "gemini-error", e.message),
      onClose: () => logSession(callSid, "gemini-close", {}),
    });

    connection.on("message", (raw) => {
      let msg;
      try { msg = JSON.parse(raw.toString()); } catch { return; }
      switch (msg.event) {
        case "start":
          streamSid = msg.start.streamSid;
          callSid = msg.start.callSid || callSid;
          logSession(callSid, "stream-start", { streamSid });
          break;
        case "media": {
          if (callExpired(callSid)) {
            connection.send(JSON.stringify({ event: "clear", streamSid }));
            connection.close();
            return;
          }
          const pcm16 = mulawToPcm16(Buffer.from(msg.media.payload, "base64"));
          gemini.sendAudio(pcm16);
          break;
        }
        case "stop":
          logSession(callSid, "stream-stop", {});
          gemini.close();
          break;
      }
    });

    connection.on("close", () => { gemini.close(); closeCallBudget(callSid); logSession(callSid, "ws-close", {}); });
  });
});

app.listen({ host: "127.0.0.1", port: PORT }, (err, addr) => {
  if (err) { app.log.error(err); process.exit(1); }
  app.log.info(`ea-voice-bridge listening on ${addr}`);
});
