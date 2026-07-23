# Road to Doc-Screenshot Anonymization

**Status:** archived — all phases (P0–P4) verified complete 2026-07-23; rule + skill + config + ADR-125 shipped, all targeted checks green.
**Started:** 2026-07-23
**Branch:** `feat/doc-screenshot-anonymization`
**Trigger:** Maintainer wants agents to **create screenshots for documentation
when genuinely useful** (e.g. when generating a Starlight docs site for a
project / product / package) and **embed them** — with a hard requirement:
**sensitive data visible on a screenshot must be anonymized / pixelated before
the screenshot ships.** The agent must genuinely make sure screenshots are as
neutral as possible (conservative, err-on-the-side-of-redaction posture).

## Purpose

Close a verified governance gap: the package has strong image *generation*
skills and a Starlight docs path (`docs/media/` → `site/sync-docs.mjs`), but
**no discipline for capturing screenshots into docs, and no anonymization of
sensitive data inside a captured screenshot.** `domain-safety-pii` covers only
text surfaces (drafts / logs / exports); media governance covers only
*generated*-image rights/likeness — neither covers redacting sensitive content
in a captured screenshot. This roadmap adds that discipline.

## AI council convergence (inlined — 2026-07-23, anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2-round debate)

The two members debated the architecture. Converged points (both members),
after rebuttal:

1. **Capture is delegated to the host** (`claude-in-chrome` / Playwright). The
   package builds NO bundled capture engine (respects no-runtime-floor). The
   package owns only the anonymization + embedding discipline.
2. **A standalone rule**, NOT a "Surface 5" bolted onto `domain-safety-pii` —
   screenshots are opaque binary artifacts requiring OCR/vision, not the
   text-pattern surfaces that rule contracts around.
3. **Automated detection is a HELPER, never a CLEARANCE.** It flags + pre-redacts
   to make review cheap; it can never *prove* a screenshot is safe (semantic
   leaks — aggregate counts, real-vs-fake data tells, re-identification via name
   structure — are undetectable by pattern matching). **The gate is human
   confirmation** for data-bearing screenshots.
4. **Conservative default:** uncertain / unresolved / cannot-confirm-safe →
   redact-or-refuse, never ship-and-hope.
5. **Terminal / CLI / IDE screenshots are the highest leak vector** (absolute
   local paths, env tokens) → **forbidden**; steer to text code blocks with text
   redaction (cheaper AND safer).
6. **Redaction = deterministic opaque box/blur** over flagged regions; reject
   lossy provider inpaint (docs need visual accuracy). The redaction tool must be
   **optional / tool-agnostic** (`sharp` is a `site` dep only, not a package dep
   — mandating it breaks framework-neutrality + no-runtime-floor). Missing tool →
   STOP and hand off to the maintainer; never silently downgrade the guarantee.
7. **The identity allowlist is the maintainer's OWN public handles + a small
   fake-data seed** — NOT a global cross-cultural fake-data dictionary and NOT
   identity-resolution. Default: everything is forbidden unless a human decides
   or it matches the allowlist. A public handle co-located with a real name does
   **not** whitelist the name.

**Divergence resolved by synthesis (chairman):** Anthropic wanted a kernel
(`always`) rule for its Hard-Floor teeth (blocked by ADR + 24 h soak); OpenAI
wanted a lightweight `auto` rule (Anthropic: "too weak for a security gate"). The
resolution — a `auto` tier-2a rule whose Iron Law makes a data-bearing embed an
**irreversible published egress that routes INTO the existing kernel
`non-destructive-by-default` Hard Floor**. The enforcement teeth are borrowed
from the kernel (publish/commit already require this-turn confirmation); no new
kernel rule, no soak blocker. This is the "route, don't rebuild" pattern.

**Note:** the maintainer has already decided to build this feature. The council
informs *how* to build it safely, not *whether* — Anthropic's Round-1 "don't
build it at all" stance is explicitly out of scope.

## Design anchors (locked, not open for renegotiation)

| Anchor | Decision |
|---|---|
| Capture delegated | Host tools capture; package never bundles a capture engine. |
| Detection ≠ clearance | Automation flags + pre-redacts; the *clearance* is human, for data-bearing shots. |
| Conservative default | Uncertain → redact-or-refuse. Never ship-and-hope. |
| Terminal forbidden | Terminal/CLI/IDE screenshots are forbidden; use text code blocks + text redaction. |
| Egress teeth via kernel | Data-bearing embed routes into `non-destructive-by-default` (irreversible published egress). |
| Redaction tool optional | Opaque box/blur via whatever image tool is present; missing tool → hand off, never silent-ship. |
| Allowlist = own handles | `screenshots.identity_allowlist` holds the maintainer's own public handles + fake-data seed; default-forbid otherwise. |
| No release pinning | Phases describe work, never target releases / tags / dates. |
| Fenced delivery | Roadmap plans work only — no commit steps; PR is created after the roadmap closes, on maintainer instruction. |

## Taxonomy (the anonymization contract — feeds the rule + skill)

**Always redact / refuse (sensitive):**
- Real person's name, postal address, birthdate, phone number.
- Passwords, API tokens, secrets, session cookies, bearer tokens, private keys.
- Real email addresses (anything not `@example.{com,org,net}` / a fake-data domain).
- Absolute filesystem paths that reveal a real identity
  (`/Users/<realname>/…`, `/home/<realname>/…`).
- Client / customer / project identifiers, internal hostnames (`*.internal`).
- Anything GDPR-sensitive; aggregate counts / data tells that reveal real users.

**Allowed (no redaction):**
- Well-known fake data (Max Mustermann, Musterstraße, `@example.com`, …).
- The maintainer's OWN public handle (e.g. `matze4u`) shown as a username in an
  admin panel — the handle is already public.
- A path rooted at the maintainer's own public handle (`/Users/matze4u/…`) — the
  handle is public; but the maintainer's **real name** is never allowed, even
  co-located with the handle.

## Phase 0 — Decision record + config surface

- [x] P0.1 — Write an ADR (`docs/decisions/ADR-125-doc-screenshot-anonymization.md`
  via `adr-create`) capturing the locked architecture: capture-delegated-to-host,
  detection-is-helper-not-clearance, human-gate-for-data-bearing, terminal-forbidden,
  redaction-tool-optional, allowlist-is-own-handles, and the route-into-Hard-Floor
  decision (why NOT a new kernel rule). Regenerate the ADR index.
- [x] P0.2 — Add `screenshots.*` config keys to
  `src/config/agent-settings.template.yml`: `identity_allowlist` (list, default
  `[]`), `forbid_terminal_capture` (bool, default `true`),
  `data_bearing_gate` (enum/bool, conservative default). Mirror in the settings
  schema under `src/scripts/schemas/` (use `.default(...)`, never bare
  `.optional()`), then run `npm run build:install-bundle` to regenerate the
  install bundle.
- [x] P0.3 — Verify the config + schema round-trips (schema parse of the template
  passes; new keys documented in the settings reference doc if one exists).

## Phase 1 — The rule `doc-screenshot-hygiene`

- [x] P1.1 — Author `src/rules/doc-screenshot-hygiene.md` (`type: auto`,
  `tier: 2a`). Thin obligation surface: the Iron Law (data-bearing screenshot
  embed = irreversible published egress → this-turn human confirmation per
  `non-destructive-by-default`; terminal/CLI/IDE screenshots forbidden), the
  taxonomy summary (allowed vs always-redact), the three risk tiers
  (illustrative-no-data → embed with justification; data-bearing → gate;
  terminal/IDE → forbidden), and the conservative default. Keep it short
  (rules stay well below 200 lines).
- [x] P1.2 — Frontmatter: `triggers` (keywords: screenshot, screen capture,
  Starlight docs, embed image in docs, admin panel screenshot, dashboard
  screenshot; phrases: "add a screenshot", "screenshot for the docs",
  "put an image in the readme"); `routes_to: skill:screenshot-hygiene`;
  `applies_to_user_types: [all]`; `workspaces` (mirror `domain-safety-pii`);
  `packs: [meta]`. `See also` cross-links: `non-destructive-by-default`,
  `domain-safety-pii`, `lethal-trifecta-guard`, `readme-writing`,
  skills `image-analyser` / `image-editing`.
- [x] P1.3 — Confirm `lint_artefact_frontmatter` accepts the rule (workspaces/pack
  ids exist; triggers + routes_to present for an `auto` rule).

## Phase 2 — The skill `screenshot-hygiene`

- [x] P2.1 — Author `src/skills/screenshot-hygiene/SKILL.md` — the executable
  workflow: (1) **decide** — is a screenshot warranted, and is a text/diagram
  alternative safer? classify risk tier; (2) **capture** via host tool
  (`claude-in-chrome`/Playwright), record which tool; (3) **detect** — OCR the
  image (host / `image-analyser`), scan the text against the taxonomy + the
  `identity_allowlist`, produce a flagged-regions report; (4) **redact** — opaque
  box/blur over flagged regions (deterministic, not inpaint); (5) **pre-embed
  audit checklist** — the human gate for data-bearing shots; (6) **embed** via
  `docs/media/` (+ Starlight sync) or README. Include `## Gotcha` and ≥ 2 concrete
  Output requirements. Add `triggered_by: [doc-screenshot-hygiene]` (bidirectional
  with the rule's `routes_to`).
- [x] P2.2 — Redaction mechanism: document the exact deterministic commands
  (ImageMagick `magick`/`convert` draw-rectangle, or `sharp` composite) + the
  missing-tool fallback (`missing-tool-handling`: STOP and hand off — never
  ship-unredacted). Provide a thin OPTIONAL tool-agnostic helper under
  `src/scripts/media/` ONLY if it earns its place over documented commands; if it
  would be over-engineering, document the commands in the skill and record the
  one-line reason instead. (Decide during execution, favouring the minimal diff.)
- [x] P2.3 — Pre-embed audit checklist content (the human-gate artifact): no real
  names/addresses/birthdates; no tokens/passwords/secrets; no non-fake emails; no
  real-identity absolute paths; no client/project identifiers; no terminal output;
  aggregate-count / real-vs-fake-data tell check; "if realistic-looking data, why
  is it safe" justification. Lives in the skill (not a loose doc).

## Phase 3 — Integrations & docs-embedding path

- [x] P3.1 — Extend the `readme-writing` skill's pre-save self-check: a
  **data-bearing** screenshot added without explicit user request → flag (the
  existing anti-unrequested-screenshot check is strengthened, not relaxed;
  illustrative/no-data screenshots for docs generation are the reconciled
  exception). Cross-link `screenshot-hygiene`.
- [x] P3.2 — Cross-link the new surface into the ecosystem without duplicating:
  `domain-safety-pii` See-also gains a "screenshots → `doc-screenshot-hygiene`"
  sibling pointer (NOT a Surface 5); `image-analyser` / `image-editing` skills
  note their role as the detection/redaction helpers; `lethal-trifecta-guard`
  See-also notes the screenshot-egress case. Verify bidirectional refs.
- [x] P3.3 — Document the docs-embedding path: how a screenshot flows into a
  Starlight site (`docs/media/` + `sync-docs.mjs` auto-copy/rewrite) and into a
  README/any docs, gated by the hygiene workflow. Short section in the skill or a
  focused doc; generalize beyond Starlight (framework-neutral).

## Phase 4 — Condense, project, verify

- [x] P4.1 — `/condense` the new + edited rule/skill (source-of-truth: `src/` →
  `dist/agent-src/`; never hand-edit projections).
- [x] P4.2 — `task sync` + `task generate-tools` to regenerate `dist/agent-src/`,
  the per-tool projections (`.claude/`, `.cursor/`, …), and `dist/router.json`
  (the new `auto` rule's triggers/routes_to compile into the router).
- [x] P4.3 — Targeted verification of the NEW artifacts (net-new, so run once as
  evidence per `verify-before-complete`): `validate_frontmatter`, `check-router`
  (src == dist), `lint-skills` on `screenshot-hygiene`, `check-refs`
  (bidirectional `triggered_by`), ADR index freshness. Full `task ci` is the
  remote-CI gate — do NOT run it locally (`roadmap-ci-steps-policy`: skip inline,
  mark `[-]` with reason if it surfaces).

## Acceptance criteria

- A `doc-screenshot-hygiene` `auto` tier-2a rule exists whose Iron Law gates a
  data-bearing screenshot embed into shipped docs behind this-turn human
  confirmation (routing into `non-destructive-by-default`) and forbids
  terminal/CLI/IDE screenshots.
- A `screenshot-hygiene` skill exists carrying the decide → capture → detect →
  redact → audit → embed workflow, with the human-gate checklist and the
  missing-tool fallback.
- `screenshots.identity_allowlist` + policy config keys exist with conservative
  defaults; schema + install bundle regenerated.
- `readme-writing` flags unrequested data-bearing screenshots.
- Cross-links are bidirectional; `dist/` + `router.json` regenerated and in sync;
  ADR recorded + indexed.
- The maintainer's nuance holds: `matze4u` (own public handle) is allowed; the
  maintainer's real name, addresses, birthdates, tokens, secrets, and real
  emails/paths are always redacted; known-fake data (Max Mustermann) is allowed.
