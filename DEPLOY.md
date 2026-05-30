# EA — deploy runbook

End-to-end checklist to take EA from "code-complete" to "Ryan can call the number."
The repo is already import-tested; everything below is **provisioning + droplet deploy**,
in dependency order. Items marked **[long pole]** gate go-live — start them first.

Droplet reference (`paperclip-prod`): SSH `paperclip@68.183.104.145`. Root via
DigitalOcean panel → Access → Reset Root Password → Launch Console. Paperclip API is
loopback-only at `http://127.0.0.1:3100` and accepts any bearer token on-box
(`local_trusted`). EA company UUID: `ece2a7ef-c413-4f58-9318-c2bb29de7dc4`.

---

## 0. Provision external accounts (do these first, in parallel)

- [ ] **[long pole] Twilio A2P 10DLC** — register brand + campaign (multi-day approval;
      gates ALL SMS: briefing, inbound texts, send-sms). Copy to paste into the forms is
      in [`docs/a2p-10dlc.md`](docs/a2p-10dlc.md). Buy the US number at the same time.
- [ ] **Twilio number + auth** — note Account SID, Auth Token, the From number.
- [ ] **Gemini API key** — must have access to `gemini-2.5-flash-native-audio-preview-09-2025`
      (older Live model names 404 on BidiGenerateContent).
- [ ] **Azure AD app + Microsoft Graph refresh token** — delegated OAuth on Ryan's M365
      account. Scopes needed: `Mail.Send`, `Calendars.Read`, `Chat.ReadWrite`,
      `offline_access`. Mint a refresh token once and store it; the bridge refreshes
      access tokens itself (`shared/lib/graph.mjs`). Without this, `send-email`,
      `read-calendar`, and `send-teams-chat` fail `api-key-missing`.

## 1. Get root on the droplet

- [ ] Recover root (DO panel, above) **or** enable a user-level unit without root:
      `loginctl enable-linger paperclip` and install the systemd unit as a `--user` unit.
      Durable deploy (whole repo → `/opt/ea`, system unit, tunnel) is cleaner with root.

## 2. Secrets + contacts on the box

- [ ] `sudo install -d -m 700 -o paperclip -g paperclip /etc/ea`
- [ ] Create `/etc/ea/env` (chmod 600, owned by `paperclip`) from
      `services/voice-bridge/.env.example`, filling every value.
      **Gotcha:** systemd `EnvironmentFile` does NOT strip inline `# comments` — keep
      comments on their own lines, never after a value.
- [ ] Create `/etc/ea/contacts.json` (chmod 600) from `shared/contacts.example.json`
      with real slugs/numbers/emails. This file is the ONLY source of truth — EA never
      guesses a contact; a missing one makes it ask Ryan.

## 3. Deploy the bridge (deploy the WHOLE repo)

The bridge resolves `skills/`, `migrations/`, and `shared/persona/` relative to the repo
root, so it must keep that layout — deploy the whole repo, not the bridge folder alone.

```bash
sudo mkdir -p /opt/ea /var/lib/ea-voice-bridge
sudo rsync -a --exclude '.git' ./ /opt/ea/            # run from a fresh checkout of this branch
sudo chown -R paperclip:paperclip /opt/ea /var/lib/ea-voice-bridge
cd /opt/ea/services/voice-bridge && sudo -u paperclip npm ci
sudo cp systemd/ea-voice-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ea-voice-bridge
curl -fsS http://127.0.0.1:5050/healthz        # expect {"ok":true}
```

- The SQLite audit DB (`/var/lib/ea-voice-bridge/session.sqlite`) and its schema are
  created automatically at boot (`migrations/0001_session_log.sql` is exec'd by
  `lib/audit.js`) — no manual migration step.
- `systemd` unit pins `WorkingDirectory=/opt/ea/services/voice-bridge` and
  `ReadWritePaths=/var/lib/ea-voice-bridge`; if you put the DB elsewhere, add it there.

## 4. Cloudflare Tunnel (the only public surface)

```bash
cloudflared tunnel login
cloudflared tunnel create ea-voice-bridge
cloudflared tunnel route dns ea-voice-bridge ea.<your-domain>
sudo cp /opt/ea/services/voice-bridge/cloudflared/config.yml /etc/cloudflared/config.yml
sudo sed -i 's/ea.example.com/ea.<your-domain>/' /etc/cloudflared/config.yml
sudo cloudflared service install
```

- [ ] Confirm `/trigger-callback` is **NOT** in the ingress (loopback-only, guarded by
      `EA_INTERNAL_TOKEN`). Only `ea.<your-domain>` → `127.0.0.1:5050` should be exposed.
      The Paperclip UI stays SSH-tunnel-only.

## 5. Wire Twilio webhooks

- [ ] Voice webhook (number config) → `https://ea.<your-domain>/incoming-call` (HTTP POST).
- [ ] Messaging webhook → `https://ea.<your-domain>/sms` (HTTP POST).
- [ ] Verify `ALLOWED_CALLER_E164` in `/etc/ea/env` is Ryan's number — every other caller
      hears the private-line message and is hung up on (auth fails closed if unset).

## 6. Smoke test before automation

- [ ] Call the number → EA greets by name, hold a short conversation.
- [ ] In-call, exercise read-only tools: "what's on my calendar today" (`read_calendar`),
      "remind me to X at 5pm" (`create_reminder`).
- [ ] Test a confirm-gated tool: ask to text a contact, confirm the read-back + "send it"
      gate fires before `send_sms` actually sends.
- [ ] Text the number → confirm an Issue opens (labeled `sms-inbound`) and EA replies.

## 7. Create the routines — LAST

Only after the bridge is durable and `/etc/ea/env` has real secrets. Creating
`bridge-heartbeat` earlier spams "bridge-down" escalations.

```bash
cd /opt/ea
EA_COMPANY_ID=ece2a7ef-c413-4f58-9318-c2bb29de7dc4 \
  node scripts/create-routines.mjs --dry-run     # eyeball the payloads first
EA_COMPANY_ID=ece2a7ef-c413-4f58-9318-c2bb29de7dc4 \
  node scripts/create-routines.mjs               # create briefing-morning + bridge-heartbeat
```

- [ ] **Verify the briefing fire time.** `.paperclip.yaml` ships cron `30 11 * * *` with
      `timezone America/New_York`, which is ambiguous (see the CAVEAT in
      `scripts/create-routines.mjs`). Confirm the first real fire lands at 07:30 ET; if the
      platform reads the cron in the given timezone, re-create with `BRIEFING_CRON="30 7 * * *"`.
- [ ] Confirm `bridge-heartbeat` does not fire a false "bridge-down" on its first run.

## 8. Cleanup

- [ ] **Retire the legacy "Executive Assistant" company** (UUID
      `e26a4e55-1646-4624-87f3-c7a9cbb4e2ee`) if it's redundant with the new EA.
- [ ] During deploy, **verify the Paperclip API endpoint shapes** used by
      `shared/lib/paperclip.mjs` and `scripts/create-routines.mjs` against the live
      instance. They're assumed from the Vantyx pattern; if any POST 404s, fix the path
      in those two files (single source per tool).

---

## Rollback / ops

- `sudo systemctl restart ea-voice-bridge` after editing `shared/persona/ea-voice.md`
  (persona is read once at boot).
- Logs: `journalctl -u ea-voice-bridge -f`. Per-call audit: `/var/lib/ea-voice-bridge/session.sqlite`
  (`session_log`, `tool_call`).
- If Twilio signature validation fails on real calls, log the reconstructed public URL
  (uses `x-forwarded-host`/`-proto` behind Cloudflare) and compare to what Twilio signed.
