---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Writing a credential into a tracked file or committing one in any VCS (git/svn/hg) — STOP, show the match, ask, offer alternatives; never silently"
triggers:
  - keyword: "secret"
  - keyword: "password"
  - keyword: "credential"
  - keyword: "api key"
  - keyword: "token"
  - keyword: ".env"
  - keyword: "commit"
  - keyword: "git add"
  - keyword: "svn commit"
  - keyword: "hg commit"
  - keyword: "push"
routes_to:
  - "skill:secrets-management"
validator_ignore:
  - type: "substring"
    pattern: "../../docs/"
    reason: "See-also routes to docs/threat-model.md — the canonical attack-surface doc lives there by design."
workspaces: [engineering]
packs: [engineering-base]
enforced_by:
  - "validator:src/scripts/check_secret_leak.ts"
collision_ok:
  "commit": "committing is the credential-leak moment this guard exists for"
# obligation: line 43
obligation_frequency: "per-edit"
evidence:
  source_type: own-analysis
  verified_on: 2026-08-30
  normative_level: informative
---

# Secret-in-VCS Guard

A committed secret is a leaked secret. Once it reaches version control it is in
the history, in every clone and fork, and — on a public remote — scraped by bots
within minutes. `git rm` does not un-leak it; only rotation does. The cheapest
moment to stop it is **before** the write. The agent is upstream of the commit,
so the agent is the earliest gate.

## The Iron Law

```
NEVER WRITE A CREDENTIAL INTO A TRACKED (OR TO-BE-TRACKED) FILE, AND NEVER
STAGE / COMMIT CONTENT CONTAINING ONE — IN ANY VCS (git · svn · hg) —
WITHOUT STOPPING FIRST.
DETECT → SHOW THE MATCH (file:line · kind · why risky) → ASK → OFFER ALTERNATIVES.
NEVER SILENTLY COMMIT A SECRET. NEVER SILENTLY STRIP ONE.
ALREADY IN HISTORY → ROTATE FIRST. git rm DOES NOT UN-LEAK.
```

## When it fires

The agent is about to (a) write/edit a value that looks like a live credential
into a tracked or soon-to-be-tracked file, or (b) `git add` / `git commit` /
`svn commit` / `hg commit` / push content containing one. Detection uses the
`secret_detector` library (regex rule pack + Shannon entropy + keyword context):
AWS/GitHub/Stripe/Google/Slack keys, PEM private keys, JWTs, DB connection URLs
with embedded credentials, and `password=` / `api_key=` style assignments.

## What to do on a `high`-confidence hit

1. **STOP** — do not write, stage, or commit.
2. **Show** the match: `file:line`, the kind, a masked preview, and why it is
   risky. Never echo the full secret back.
3. **Ask** via numbered options (per [`non-destructive-by-default`](non-destructive-by-default.md) +
   [`user-interaction`](user-interaction.md)) — e.g. *move it to a secret store
   (recommended)* / *this is a false positive, add a narrow allow-marker* /
   *commit anyway (I understand the risk)*. Never decide for the user; never
   auto-strip.
4. **Offer the alternative**, tiered to context (full table in
   [`secrets-management`](../skills/secrets-management/SKILL.md)): solo/local →
   gitignored `.env` + committed `.env.example`; team/prod → cloud secret manager
   or Vault/Doppler; k8s/GitOps → SOPS / Sealed Secrets; CI → OIDC over stored
   creds.

## Already committed / pushed → rotate first

If the secret is already in history, lead with **rotate/revoke the credential
now** — that is the only action that actually stops the damage. State plainly
that `git rm` and even a history rewrite do **not** un-leak an already-pushed
secret; then, if the user wants, point to history purge (`git filter-repo` / BFG)
plus force-push and collaborator re-clone. See
[`secrets-management`](../skills/secrets-management/SKILL.md).

## Honesty — one layer, not the whole defense

The agent-side gate is one layer and only covers what the agent writes. Recommend
the user also enable the non-bypassable nets: the repo's CI secret-scan
(`check_secret_leak`) and, where available, the host's push-protection.

## When NOT to fire

- `.env.example` / `*.sample` / `*.example` files with placeholder values.
- A line carrying an audited allow-marker (`# secret-allow` / `// secret-allow` /
  `<!-- secret-allow -->`) or listed in the repo `.secret-allow` file.
- Obvious placeholders (`xxxx`, `changeme`, `your-key-here`, `<...>`), test
  fixtures explicitly marked as such, and non-credential high-entropy strings
  (hashes, UUIDs, lockfile digests) with no credential keyword nearby.

## See also

- [`secrets-management`](../skills/secrets-management/SKILL.md) — store selection, tiered alternatives, rotation contract, remediation ordering.
- [`security-sensitive-stop`](security-sensitive-stop.md) — threat-model before editing a secrets surface (fires first, broader).
- [`tool-safety`](tool-safety.md) — "no hidden credentials" in shipped files.
- [`non-destructive-by-default`](non-destructive-by-default.md) — the commit/push confirmation floor this builds on.
- [`lethal-trifecta-guard`](lethal-trifecta-guard.md) — secrets are the private-data leg of the trifecta.
