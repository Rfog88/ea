#!/usr/bin/env node
// send-teams-chat — send a 1:1 Teams chat as Ryan via Graph. Requires confirmed=true.
// Invocation: echo '{"to":"amber","body":"...","confirmed":true}' | node skills/send-teams-chat/run.mjs

import { readFileSync } from "node:fs";
import { resolveContact } from "../../shared/lib/contacts.mjs";
import { graphFetch } from "../../shared/lib/graph.mjs";

async function resolveUpn(ref) {
  // Prefer teams_upn, fall back to email.
  try {
    return resolveContact(ref, "teams_upn").value;
  } catch {
    return resolveContact(ref, "email").value;
  }
}

async function findOrCreateChat(upn) {
  const res = await graphFetch("/chats", {
    method: "POST",
    body: JSON.stringify({
      chatType: "oneOnOne",
      members: [
        { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": "https://graph.microsoft.com/v1.0/me" },
        { "@odata.type": "#microsoft.graph.aadUserConversationMember", roles: ["owner"], "user@odata.bind": `https://graph.microsoft.com/v1.0/users('${upn}')` },
      ],
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    const reason = res.status === 401 ? "api-key-missing" : res.status >= 500 ? "external-quota-exceeded" : "adapter-broken";
    const e = new Error(`graph_chat ${res.status}: ${txt.slice(0, 200)}`);
    e.reason = reason;
    throw e;
  }
  return (await res.json()).id;
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));
  if (input.confirmed !== true) {
    console.error(JSON.stringify({ ok: false, error: "confirmed_required" }));
    process.exit(3);
  }
  const body = (input.body || "").trim();
  if (!body) throw new Error("invalid_input: missing `body`");

  let upn;
  try {
    upn = await resolveUpn(input.to);
  } catch (e) {
    if (e.message.startsWith("unknown_contact") || e.message.startsWith("contact_missing_field")) {
      console.error(JSON.stringify({ ok: false, error: "unknown_contact", ref: input.to }));
      process.exit(2);
    }
    throw e;
  }

  const chatId = await findOrCreateChat(upn);
  const res = await graphFetch(`/chats/${chatId}/messages`, {
    method: "POST",
    body: JSON.stringify({ body: { content: body } }),
  });
  if (!res.ok) {
    const txt = await res.text();
    console.error(JSON.stringify({ ok: false, error: `graph_msg ${res.status}: ${txt.slice(0, 200)}`, reason: "adapter-broken" }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, chat_id: chatId, to: upn }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
