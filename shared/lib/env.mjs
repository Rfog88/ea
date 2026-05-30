// Zero-dependency env loader for EA skills.
//
// Skills are run two ways: (1) spawned by the voice/discord bridge, which
// already loads /etc/ea/env into its process env (inherited by the child), and
// (2) spawned by the Paperclip `ea` agent, whose subprocess env does NOT
// include /etc/ea/env. This module backfills any missing keys from the env file
// so a skill behaves identically no matter who launches it. The Paperclip user
// owns /etc/ea/env (chmod 600), so it can read it.
//
// Only fills keys that are not already set — anything the launcher injected
// (e.g. Paperclip projectEnv secrets) takes precedence.
import { readFileSync } from "node:fs";

const path = process.env.EA_ENV_FILE || "/etc/ea/env";

try {
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const key = t.slice(0, eq).trim();
    if (process.env[key] !== undefined) continue;
    let val = t.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env[key] = val;
  }
} catch {
  // No env file (local dev / CI) — rely on the ambient environment.
}
