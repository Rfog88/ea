// Load the EA voice persona (Gemini Live system_instruction) from the repo.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
// services/voice-bridge/lib -> repo root is ../../..
const PERSONA_PATH = join(here, "..", "..", "..", "shared", "persona", "ea-voice.md");

export function loadPersona() {
  try {
    return readFileSync(PERSONA_PATH, "utf8");
  } catch (e) {
    // Fail loud at boot rather than greeting Ryan with an empty persona.
    throw new Error(`persona_load_failed at ${PERSONA_PATH}: ${e.message}`);
  }
}

// For scheduled callbacks, prepend the context so the model opens with it.
export function personaWithContext(base, ctx) {
  if (!ctx) return base;
  return `${base}\n\n## This is a scheduled callback\nOpen with: "You wanted me to call about ${ctx} — what's the question?"`;
}
