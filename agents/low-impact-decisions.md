# Low-Impact Decisions Corpus

Project-local learning corpus that teaches the Phase 10 impact
classifier which questions should route as `low_impact` instead of
landing on the user. See
[`docs/contracts/ai-council-config.md`](../docs/contracts/ai-council-config.md)
§ "Decision routing by impact" for the routing semantics.

**Iron Law — privacy floor (non-bypassable):** every entry below is
redacted English text. No secrets, no emails, no project-rooted
paths, no customer / tenant names, no internal hostnames, no
monetary amounts, no business-context SQL identifiers, no inline
code excerpts longer than 40 characters. The redaction pass runs
before write and again before upstream — see
[`.augment/rules/low-impact-corpus-privacy-floor.md`](../.augment/rules/low-impact-corpus-privacy-floor.md).

## On Probation

Entries that have been signalled as low-impact at least once but have
not yet accumulated three confirmations within a rolling 30-day
window. Probation entries DO NOT influence routing — they are
intake-only until promoted.

<!-- intake-anchor: probation -->

## Validated

Entries with at least three in-window confirmations. The Phase 10
classifier reads this section at startup and routes matching
questions as `low_impact`. Promotion is one-way: a Validated entry
never falls back to probation. Timestamps are stripped on promotion
— only the `validated <YYYY-MM-DD>` marker survives.

<!-- intake-anchor: validated -->

## Anti-Examples (Always Ask User)

Questions that LOOK low-impact but carry hidden architecture,
security, billing, migration, or tenant-boundary impact. These
ALWAYS escalate to the user regardless of any classifier verdict.

- "Should I put this in the controller?" — controller-vs-service
  placement is an architecture decision when the surrounding code
  has a service layer.
- "Quick migration to rename this column?" — migrations touch
  production state. Always ask, even when the rename "obviously"
  looks safe.
- "Can I store this token in plain text for now?" — secrets storage
  is a security boundary. Never low-impact.
- "Should I add an index on this column?" — indexing touches the
  query plan and may affect production performance.

## Security & Privacy Floor

The redaction pass refuses to write an entry containing:

1. **Secrets** — patterns matching the key prefixes in
   `scripts/check_no_secrets.py` (AWS keys, GitHub tokens, OpenAI
   keys, etc.).
2. **Emails** — any RFC-5322 email shape.
3. **Project-rooted paths** — anything starting with `/Users/`,
   `/home/`, `/opt/`, drive letters (`C:\`), or the configured repo
   root from `.agent-settings.yml`.
4. **Customer / tenant names** — generic terms (`<customer>`,
   `<tenant>`, `<account>`) survive; specific names don't.
5. **Internal hostnames** — `*.internal`, `*.local`, project-private
   domains from `.agent-settings.yml`.
6. **Monetary amounts** — any currency-prefixed number that looks
   like a business figure.
7. **Business-context SQL identifiers** — table / column names that
   carry tenant or customer semantics.
8. **Inline code excerpts > 40 chars** — block-level snippets leak
   structure; keep questions abstract.

Redaction failure on write → the agent surfaces the offending
pattern to the user and refuses to save. Redaction failure on
upstream → the `/learn-low-impact` command refuses to open the PR.

## Provenance

last-upstreamed: 0000000000000000000000000000000000000000
