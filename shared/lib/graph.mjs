// Shared Microsoft Graph helper for EA skills.
// Delegated OAuth on Ryan's M365 Business account. Email/Teams send AS Ryan.
// Requires: MS_GRAPH_TENANT_ID, MS_GRAPH_CLIENT_ID, MS_GRAPH_CLIENT_SECRET, MS_GRAPH_REFRESH_TOKEN

import "./env.mjs";

const TOKEN_HOST = "https://login.microsoftonline.com";
const GRAPH = "https://graph.microsoft.com/v1.0";

let cached = { token: null, exp: 0 };

export async function graphToken() {
  const now = Date.now();
  if (cached.token && now < cached.exp - 5 * 60 * 1000) return cached.token;

  const tenant = reqEnv("MS_GRAPH_TENANT_ID");
  const body = new URLSearchParams({
    client_id: reqEnv("MS_GRAPH_CLIENT_ID"),
    client_secret: reqEnv("MS_GRAPH_CLIENT_SECRET"),
    grant_type: "refresh_token",
    refresh_token: reqEnv("MS_GRAPH_REFRESH_TOKEN"),
    scope: "https://graph.microsoft.com/.default offline_access",
  });

  const res = await fetch(`${TOKEN_HOST}/${tenant}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    const txt = await res.text();
    // 400/401 here almost always means the refresh-token grant was revoked.
    const err = new Error(`graph_token_failed: ${res.status} ${txt.slice(0, 200)}`);
    err.reason = res.status === 400 || res.status === 401 ? "api-key-missing" : "adapter-broken";
    throw err;
  }
  const json = await res.json();
  cached = { token: json.access_token, exp: now + (json.expires_in || 3600) * 1000 };
  return cached.token;
}

export async function graphFetch(path, init = {}) {
  const token = await graphToken();
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  return res;
}

function reqEnv(name) {
  const v = process.env[name];
  if (!v) {
    const e = new Error(`missing_env: ${name}`);
    e.reason = "api-key-missing";
    throw e;
  }
  return v;
}
