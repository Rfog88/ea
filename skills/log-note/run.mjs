#!/usr/bin/env node
// log-note — write a markdown note to the private vault repo and commit+push.
// Invocation: echo '{"topic":"...","content":"..."}' | node skills/log-note/run.mjs

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "note";
}

function git(repo, args) {
  return execFileSync("git", ["-C", repo, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  const topic = (input.topic || "").trim();
  const content = (input.content || "").trim();
  if (!topic || !content) throw new Error("invalid_input: missing topic or content");

  const repo = process.env.EA_VAULT_REPO_PATH;
  if (!repo) {
    const e = new Error("missing_env: EA_VAULT_REPO_PATH");
    e.reason = "api-key-missing";
    throw e;
  }

  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const rel = join("notes", `${date}-${slugify(topic)}.md`);
  const abs = join(repo, rel);
  mkdirSync(join(repo, "notes"), { recursive: true });

  const md = `---\ntopic: ${topic}\ncreated: ${now.toISOString()}\n---\n\n${content}\n`;
  writeFileSync(abs, md, "utf8");

  let committed = false;
  let pushError = null;
  try {
    git(repo, ["add", rel]);
    git(repo, ["commit", "-m", `note: ${topic}`]);
    git(repo, ["push"]);
    committed = true;
  } catch (e) {
    pushError = (e.stderr || e.message || "").toString().slice(0, 200);
  }

  console.log(JSON.stringify({ ok: true, path: rel, committed, ...(pushError ? { push_error: pushError } : {}) }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
