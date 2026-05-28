# ea-voice-bridge

Twilio Media Streams ↔ Gemini Live audio bridge for EA. Runs as a systemd unit on the `paperclip-prod` droplet, behind a Cloudflare Tunnel. The only public-internet surface of EA.

## What it does

- **Inbound call** (`/incoming-call`): validates `X-Twilio-Signature`, allowlists the caller, returns TwiML that connects the call to `/media-stream`.
- **Media stream** (`/media-stream`, WebSocket): decodes Twilio's 8 kHz µ-law, upsamples to 16 kHz PCM16, streams to Gemini Live; takes Gemini's 24 kHz PCM16 output, downsamples + µ-law-encodes back to Twilio. Server VAD drives turn-taking; on interruption it sends Twilio a `clear` to stop playback (barge-in).
- **Tool calls**: Gemini function calls are dispatched to the same `skills/*/run.mjs` scripts the `ea` agent uses (JSON stdin → JSON stdout), so there's one implementation per tool. `send_*` tools enforce a `confirmed=true` gate.
- **Inbound SMS** (`/sms`): hands off to the `inbound-sms-handler` skill; the `ea` agent replies on its heartbeat.
- **Outbound callback** (`/outbound-call` + loopback `/trigger-callback`): the `ea` agent dials Ryan via Twilio with a context string; this returns TwiML that opens the media stream pre-seeded with that context.

## Local dev

```bash
cp .env.example .env          # fill values; or point EA_ENV_FILE at /etc/ea/env
npm install
npm test                      # transcode round-trip tests (no network)
node index.js                 # listens on 127.0.0.1:5050
```

To exercise the full path locally, tunnel `5050` (cloudflared or ngrok) and point a Twilio number's voice webhook at `https://<host>/incoming-call`.

## Deploy (droplet)

```bash
# Deploy the WHOLE repo: the bridge resolves skills (../../skills), migrations
# (../../../migrations) and the persona (../../../shared/persona) relative to the
# repo root, so it MUST keep that layout. Run from the repo root.
sudo mkdir -p /opt/ea /var/lib/ea-voice-bridge
sudo rsync -a --exclude '.git' ./ /opt/ea/
sudo chown -R paperclip:paperclip /opt/ea /var/lib/ea-voice-bridge
cd /opt/ea/services/voice-bridge && sudo -u paperclip npm ci
sudo cp /opt/ea/services/voice-bridge/systemd/ea-voice-bridge.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ea-voice-bridge
sudo cp /opt/ea/services/voice-bridge/cloudflared/config.yml /etc/cloudflared/config.yml   # edit hostname first
systemctl status ea-voice-bridge
curl http://127.0.0.1:5050/healthz
```

## Notes / gotchas

- **Persona is loaded at boot.** Editing `shared/persona/ea-voice.md` requires a `systemctl restart ea-voice-bridge` to take effect.
- **`/trigger-callback` is loopback-only** and guarded by `EA_INTERNAL_TOKEN` — it must NOT appear in the Cloudflare ingress.
- **Audio rates**: Twilio = 8 kHz µ-law; Gemini input = 16 kHz PCM16; Gemini output = 24 kHz PCM16. The `lib/transcode.js` constants reflect this. If Gemini changes its output rate, update `pcm16ToMulaw(..., sourceRate)` in `index.js`.
- **Signature validation depends on the reconstructed public URL.** Behind Cloudflare, `x-forwarded-host`/`x-forwarded-proto` are used. If validation fails on real calls, log the reconstructed URL and compare to what Twilio signed.
