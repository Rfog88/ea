// Gemini Live API WebSocket client.
// Docs: https://ai.google.dev/gemini-api/docs/live
// Sends 16kHz PCM16 audio in, receives 24kHz PCM16 out + tool calls. Server VAD
// handles turn detection and barge-in (interruptions arrive as interrupted=true).
import WebSocket from "ws";

const HOST = "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";

export function connectGemini({ apiKey, model, voice, tools, instructions, onAudioDelta, onToolCall, onInterrupted, onError, onClose }) {
  const ws = new WebSocket(`${HOST}?key=${apiKey}`);
  let ready = false;
  const preReady = []; // audio buffered until setup completes

  ws.on("open", () => {
    ws.send(JSON.stringify({
      setup: {
        model: `models/${model}`,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } }, languageCode: "en-US" },
          temperature: 0.6,
        },
        systemInstruction: { parts: [{ text: instructions }] },
        tools: [{ functionDeclarations: tools }],
        realtimeInputConfig: {
          automaticActivityDetection: {
            disabled: false,
            startOfSpeechSensitivity: "START_SENSITIVITY_HIGH",
            endOfSpeechSensitivity: "END_SENSITIVITY_LOW",
            prefixPaddingMs: 200,
            silenceDurationMs: 800,
          },
        },
      },
    }));
  });

  ws.on("message", async (raw) => {
    let msg;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    if (msg.setupComplete) {
      ready = true;
      for (const pcm of preReady) sendAudio(pcm);
      preReady.length = 0;
      return;
    }

    const sc = msg.serverContent;
    if (sc) {
      if (sc.interrupted && onInterrupted) onInterrupted();
      const parts = sc.modelTurn?.parts || [];
      for (const p of parts) {
        const inline = p.inlineData;
        if (inline?.data) onAudioDelta(Buffer.from(inline.data, "base64"));
      }
    }

    // Tool calls.
    if (msg.toolCall?.functionCalls?.length) {
      for (const fc of msg.toolCall.functionCalls) {
        const result = await onToolCall({ name: fc.name, arguments: fc.args }).catch((e) => ({ ok: false, error: e.message }));
        ws.send(JSON.stringify({
          toolResponse: { functionResponses: [{ id: fc.id, name: fc.name, response: { result } }] },
        }));
      }
    }
  });

  ws.on("error", (e) => onError && onError(e));
  ws.on("close", () => onClose && onClose());

  function sendAudio(pcm16) {
    if (ws.readyState !== WebSocket.OPEN) return;
    if (!ready) { preReady.push(pcm16); return; }
    ws.send(JSON.stringify({
      realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data: pcm16.toString("base64") }] },
    }));
  }

  return {
    sendAudio,
    close: () => { try { ws.close(); } catch { /* noop */ } },
    get raw() { return ws; },
  };
}
