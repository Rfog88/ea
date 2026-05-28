// Shared contact resolution for EA skills.
// Source of truth: /etc/ea/contacts.json (EA_CONTACTS_PATH). NEVER guess a contact.
import { readFileSync } from "node:fs";

export function loadContacts() {
  const path = process.env.EA_CONTACTS_PATH || "/etc/ea/contacts.json";
  try {
    const data = JSON.parse(readFileSync(path, "utf8"));
    return data.contacts || {};
  } catch (e) {
    throw new Error(`contacts_unavailable: ${e.message}`);
  }
}

const E164 = /^\+\d{8,15}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Resolve a spoken reference (slug, name, raw phone, or raw email) to a contact field.
// field is one of "phone" | "email" | "teams_upn". Returns { value, contact } or
// throws "unknown_contact" so the caller can surface it to Ryan instead of guessing.
export function resolveContact(ref, field) {
  if (!ref) throw new Error("unknown_contact: empty reference");
  const trimmed = String(ref).trim();

  // Already a literal of the requested kind — accept verbatim.
  if (field === "phone" && E164.test(trimmed)) return { value: trimmed, contact: null };
  if ((field === "email" || field === "teams_upn") && EMAIL.test(trimmed)) {
    return { value: trimmed, contact: null };
  }

  const contacts = loadContacts();
  const lower = trimmed.toLowerCase();

  // Exact slug match first.
  if (contacts[lower]) return pick(contacts[lower], field, lower);

  // Then case-insensitive name / relationship match.
  for (const [slug, c] of Object.entries(contacts)) {
    const name = (c.name || "").toLowerCase();
    const rel = (c.relationship || "").toLowerCase();
    if (name === lower || rel === lower || name.includes(lower) || rel === lower) {
      return pick(c, field, slug);
    }
  }
  throw new Error(`unknown_contact: ${trimmed}`);
}

function pick(contact, field, slug) {
  const value = contact[field];
  if (!value) throw new Error(`contact_missing_field: ${slug} has no ${field}`);
  return { value, contact };
}
