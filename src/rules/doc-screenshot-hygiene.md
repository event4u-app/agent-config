---
type: "auto"
tier: "2a"
description: "Doc screenshots — anonymize sensitive data before shipping; data-bearing shots human-gated (published egress); terminal/CLI/IDE shots forbidden"
triggers:
  - keyword: "screenshot"
  - keyword: "screenshots"
  - keyword: "screen capture"
  - keyword: "screen grab"
  - keyword: "admin panel screenshot"
  - keyword: "dashboard screenshot"
  - keyword: "docs site"
  - keyword: "Starlight"
  - phrase: "add a screenshot"
  - phrase: "screenshot for the docs"
  - phrase: "screenshot in the readme"
  - phrase: "embed an image in the docs"
  - phrase: "put a screenshot"
  - phrase: "generate a docs site"
  - phrase: "capture the ui"
  - path_prefix: "docs/media/"
routes_to:
  - "skill:screenshot-hygiene"
applies_to_user_types:
  - "all"
workspaces: [agent-config-maintainer, construction, engineering, finance, founder, gtm, legal-review-prep, ops, product, small-business]
packs: [meta]
collision_ok:
  "screenshot": "a screenshot shipping into docs is the PII/anonymization gate"
---

# Doc-Screenshot Hygiene

Agents may create screenshots for documentation when genuinely useful (a docs
site, feature docs, a README visual) and embed them. But a screenshot is an
opaque artifact that can carry **real PII, secrets, or revealing local paths**
straight into shipped, hosted, committed docs — an irreversible published egress.
This rule governs the anonymization discipline before any screenshot ships. Full
workflow: [`screenshot-hygiene`](../skills/screenshot-hygiene/SKILL.md).

## The Iron Law

```
A SHIPPED SCREENSHOT WITH UNREDACTED SENSITIVE DATA IS AN
IRREVERSIBLE PUBLISHED EGRESS. NEVER SHIP ONE.
ANONYMIZE BEFORE IT SHIPS — REAL NAMES, ADDRESSES, BIRTHDATES, TOKENS,
SECRETS, REAL EMAILS, IDENTITY-REVEALING LOCAL PATHS.
DETECTION IS A HELPER, NEVER A CLEARANCE. THE GATE IS HUMAN CONFIRMATION.
A DATA-BEARING SCREENSHOT EMBED IS GATED PER non-destructive-by-default
(THIS-TURN CONFIRMATION). TERMINAL / CLI / IDE SCREENSHOTS ARE FORBIDDEN.
WHEN UNCERTAIN → REDACT OR REFUSE. NEVER SHIP-AND-HOPE.
```

## The anonymization taxonomy

**Always redact / refuse (sensitive):** real person's name, postal address,
birthdate, phone; passwords, API tokens, secrets, cookies, bearer tokens,
private keys; real email addresses (anything not `@example.{com,org,net}` / a
fake-data domain); absolute local paths revealing a real identity
(`/Users/<realname>/…`); client / customer / project identifiers; internal
hostnames (`*.internal`); anything GDPR-sensitive; aggregate counts or data
tells that reveal real users.

**Allowed (no redaction):** well-known fake data (Max Mustermann, Musterstraße,
`@example.com`); the maintainer's OWN public handle shown as a username (e.g.
a handle in an admin panel — it is already public), and a path rooted at that
public handle. The maintainer's **real name is never allowed**, even co-located
with the handle. The safe set is `screenshots.identity_allowlist` (default
empty → every identity is human-decided).

## Risk tiers — symmetric friction

- **Illustrative / no data** (architecture diagrams, logos, icons, wireframes,
  placeholder-only UI): embed with a one-line justification. Low friction.
- **Data-bearing** (dashboards, admin panels, forms/lists with content, anything
  showing real-looking data): run the hygiene workflow, then **this-turn human
  confirmation before embed** (per [`non-destructive-by-default`](non-destructive-by-default.md)).
- **Terminal / CLI / IDE output**: **forbidden** as screenshots (highest leak
  vector — absolute paths, env tokens). Use a text code block with text
  redaction. Set `screenshots.forbid_terminal_capture` (default `true`).

## When it fires — and when NOT

**Fires** when creating/embedding a screenshot into documentation (docs site,
README, feature docs) or when a screenshot lands under `docs/media/`.

**Does NOT fire** on: image *generation* (see `media-governance-routing`,
`image-likeness-and-rights`); a user-supplied screenshot used only as a design
spec to compare against (see `design-fidelity`, `cross-source-consistency`);
non-doc surfaces.

## See also

- [`screenshot-hygiene`](../skills/screenshot-hygiene/SKILL.md) — the decide → capture → detect → redact → audit → embed workflow + the human-gate checklist.
- [`non-destructive-by-default`](non-destructive-by-default.md) — the published-egress Hard Floor a data-bearing embed routes into.
- [`domain-safety-pii`](domain-safety-pii.md) — the sibling PII rule for text surfaces (drafts / logs / exports); screenshots are the visual surface.
- [`lethal-trifecta-guard`](lethal-trifecta-guard.md) — a screenshot is the private-data + egress legs; the human gate is the egress control.
- [`readme-writing`](../skills/readme-writing/SKILL.md) — flags unrequested data-bearing screenshots.
- [`image-analyser`](../skills/image-analyser/SKILL.md), [`image-editing`](../skills/image-editing/SKILL.md) — the OCR-detect / region-redact helpers.
