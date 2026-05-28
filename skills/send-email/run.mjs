#!/usr/bin/env node
// send-email — send as Ryan via Microsoft Graph. Requires confirmed=true.
// Invocation: echo '{"to":"amber","subject":"...","body":"...","confirmed":true}' | node skills/send-email/run.mjs

import { readFileSync } from "node:fs";
import { resolveContact } from "../../shared/lib/contacts.mjs";
import { graphFetch } from "../../shared/lib/graph.mjs";

function htmlEscape(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function main() {
  const input = JSON.parse(readFileSync(0, "utf8"));

  if (input.confirmed !== true) {
    console.error(JSON.stringify({ ok: false, error: "confirmed_required" }));
    process.exit(3);
  }
  const subject = (input.subject || "").trim();
  const body = (input.body || "").trim();
  if (!subject || !body) throw new Error("invalid_input: missing subject or body");

  let to;
  try {
    to = resolveContact(input.to, "email").value;
  } catch (e) {
    if (e.message.startsWith("unknown_contact")) {
      console.error(JSON.stringify({ ok: false, error: "unknown_contact", ref: input.to }));
      process.exit(2);
    }
    throw e;
  }

  // If body already looks like HTML, send as-is; else wrap plain text.
  const isHtml = /<[a-z][\s\S]*>/i.test(body);
  const content = isHtml ? body : `<p>${htmlEscape(body).replace(/\n/g, "<br>")}</p>`;

  const res = await graphFetch("/me/sendMail", {
    method: "POST",
    body: JSON.stringify({
      message: {
        subject,
        body: { contentType: "HTML", content },
        toRecipients: [{ emailAddress: { address: to } }],
      },
      saveToSentItems: true,
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    const reason = res.status === 401 ? "api-key-missing" : res.status >= 500 ? "external-quota-exceeded" : "adapter-broken";
    console.error(JSON.stringify({ ok: false, error: `graph ${res.status}: ${txt.slice(0, 200)}`, reason }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, to }));
}

main().catch((e) => {
  console.error(JSON.stringify({ ok: false, error: e.message, reason: e.reason || "unknown-failure" }));
  process.exit(1);
});
