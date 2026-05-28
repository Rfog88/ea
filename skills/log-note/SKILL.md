---
schema: agentcompanies/v1
kind: skill
name: log-note
description: Write a markdown note to Ryan's private vault repo (Rfog88/ea-vault) and commit+push it. For "remember this for later" content. No confirmation required.
metadata:
  requires_env:
    - EA_VAULT_REPO_PATH      # local clone on the droplet, e.g. /var/lib/ea-voice-bridge/vault
    - EA_VAULT_GIT_REMOTE     # git@github.com:Rfog88/ea-vault.git (deploy key auth)
  implementation: skills/log-note/run.mjs
  primary_users: [ea]
  storage: git (private repo Rfog88/ea-vault, notes/<date>-<slug>.md)
  status: needs-vault-repo-and-deploy-key
---

# log-note

Durable "remember this" storage. Notes are versioned in a PRIVATE repo, never the public `ea` repo.

## When to use

- "Note that ...", "remember for later ...", "log this ...". Content with no due time.

## When NOT to use

- Time-bound reminders → `create-reminder`.

## Inputs

```json
{ "topic": "Cipher invoice dispute", "content": "They billed for 3 extra hours; check the original SOW." }
```

## Outputs

```json
{ "ok": true, "path": "notes/2026-05-27-cipher-invoice-dispute.md", "committed": true }
```

## Behavior

1. Slugify `topic`; filename `notes/<YYYY-MM-DD>-<slug>.md`.
2. Write frontmatter (topic, created) + content.
3. `git add` the file, `git commit -m "note: <topic>"`, `git push`.
4. If push fails (network/key), the file is still written locally; return `{ok:true, committed:false, push_error}` so the note isn't lost — a later note or the heartbeat retries the push.
