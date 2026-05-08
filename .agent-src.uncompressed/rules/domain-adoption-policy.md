---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Adopting a new domain track (mobile, ML, blockchain, IoT, gaming) — gates import on demand, ownership, CI fit, Sunset compatibility BEFORE harvest"
source: package
triggers:
  - intent: "adopt new domain"
  - intent: "harvest new domain track"
  - intent: "open a domain plate"
  - keyword: "mobile track"
  - keyword: "ml track"
  - keyword: "blockchain track"
  - path_prefix: ".agent-src.uncompressed/skills/"
validator_ignore:
  - type: "substring"
    pattern: ".agent-src.uncompressed/"
    reason: "Rule names the authoring tree as the gated-entry location for new domain plates."
---

# Domain Adoption Policy

A "domain" is a coherent vertical the suite has not yet entered — mobile, ML,
blockchain, scientific computing, IoT, gaming, embedded, robotics. Adopting
one is a structural decision: every new domain plate doubles the surface a
single maintainer keeps current, and most upstream skill-suites in adjacent
domains rot within 6-12 months as their underlying SDK churns.

This rule gates that decision. It does **not** gate per-skill adoptions inside
a domain that is already opened — those run under the regular harvest plate
process. It gates **opening** the domain in the first place.

## The Iron Law

```
NEVER OPEN A NEW DOMAIN TRACK WITHOUT THE THREE GATES.
DEMAND-SIGNAL · NAMED MAINTENANCE OWNER · CI-TOOLING DECISION.
ALL THREE PASS, OR THE ROADMAP MARKS THE DOMAIN GATED.
```

The three gates fire before any skill, guideline, command, or rule from the
domain enters `.agent-src.uncompressed/`. A council session may inform the
decision but cannot replace the gate evidence.

## Gate 1 — Demand signal

At least one of the following must be **true and citeable** in the roadmap:

- **≥ 2 consumer projects** in the domain. Cite repository names or
  `agents/contexts/` notes — not "I think there might be".
- **Named user direction with target.** A specific user ask plus a target
  project / use case — e.g. "harvest the mobile skills for project X, due
  next quarter". Vague *"this might be useful"* does not count.
- **Public-incident pull.** A reproducible incident on a consumer project
  the domain would have prevented, captured in `agents/contexts/` with
  the missing surface area named.

If none of the three is citeable, **defer**. Open a watch-only context note
under `agents/contexts/domain-watch/<domain>.md` listing the missing signal
so the next harvest can re-evaluate without re-relitigating the case.

## Gate 2 — Named maintenance owner

Domain plates rot. Pick the owner before the import, not after.

- The roadmap names a **single maintainer** (not "the team", not "TBD")
  responsible for the domain quarterly review.
- The owner commits to the **refresh cadence** — quarterly review at
  minimum, faster if the domain is volatile (mobile RN/Expo SDK,
  ML model APIs).
- Each adopted artefact carries an **inline upstream-source line** with
  SHA + last-checked timestamp so refresh is mechanical, not archaeological.

If no owner is named or no cadence is set, **defer**. An unowned domain
plate becomes broken authoritative-links and stale skills inside two cycles.

## Gate 3 — CI-tooling decision

Either the domain's verification tooling is validated in CI, or the suite
explicitly accepts platform-bound reference-only status.

- **Validated.** The CI pipeline runs the relevant linters/tests/integration
  checks for the domain (e.g. `mobile-e2e` runners, ML model validation,
  contract conformance) on every PR. Cost noted in the roadmap risk
  register.
- **Out-of-scope (reference-only).** The domain is a platform fact the
  suite cannot validate (iOS Simulator on non-macOS runners, GPU-bound
  ML, hardware-bound IoT). The roadmap states this explicitly; affected
  artefacts carry a "reference-only on \<unsupported platforms\>" header
  so consumers do not file false-positive bugs.

If neither line is drawn, **defer**. Half-validated CI silently rots the
domain — green builds while the underlying tooling drifts.

## Sunset Policy stacks on top

Every domain track inherits the authoritative-link Sunset path documented
in any plate that imports volatile upstream content:

- Volatile content (SDK-pinned, API-pinned, tool-version-pinned) lives as
  guideline body + SHA-pinned upstream link, not as forked scripts.
- Refresh trigger: quarterly cadence or earlier if a SHA-pinned link
  404s in CI.
- The `check-refs` and `check-portability` linters apply unchanged.

Adopting a domain does not exempt it from any other suite-wide rule —
`augment-portability`, `skill-quality`, `size-enforcement`, `docs-sync`,
`rule-type-governance`. Every domain artefact passes the same gates as a
core artefact.

## Failure modes

- *"It's just one skill, not a domain."* — Audit the skill's prerequisites.
  If it pulls in a new toolchain, simulator, language runtime, or
  platform-specific build system, it **is** a domain entry. Run the gates.
- *"The upstream is well-maintained, we can just track it."* — Tracking
  upstream means owning the diff, the breaking changes, and the migrations.
  Tracking is maintenance work; budget for it under Gate 2 or skip the
  adoption.
- *"We'll add CI later."* — Later does not arrive. Either CI is wired in
  the same plate, or the artefacts ship with explicit reference-only
  headers so users do not assume validated coverage.
- *"Council convergence is enough."* — Council informs the gates; it does
  not replace them. A council session may surface that all three gates
  pass; the roadmap still cites the evidence.
- *"Demand-signal is the user asking once."* — Single-shot interest is a
  watch trigger, not an open trigger. Either name the target use case
  with project + timeline, or open a watch note and wait.

## What to do when the gates fail

1. Mark the domain plate `[-] gated — <gate name> not met` in the relevant
   roadmap. Do **not** silently shrink scope to dodge the gate.
2. Open a watch-only context note under `agents/contexts/domain-watch/`
   capturing what's missing — citations, owner candidates, CI feasibility.
3. Re-evaluate at the next harvest cycle. The note is the evidence trail
   so the same questions are not relitigated.

## Allowed without gates

- Adding **a single skill** to an **already-opened** domain follows the
  regular harvest plate; the gates do not re-fire per skill.
- Authoring a **guideline** that documents a domain the suite already
  ships in — the domain is open, the guideline is a within-domain artefact.
- A **rule** that constrains an already-opened domain — within-domain.

## See also

- [`augment-portability`](augment-portability.md) — `.agent-src/`
  must stay project-agnostic; domain plates inherit the floor
- [`size-enforcement`](size-enforcement.md) — size budgets apply per
  artefact regardless of domain
- [`docs-sync`](docs-sync.md) — keep cross-references in sync when
  opening a domain plate
- [`rule-type-governance`](rule-type-governance.md) — within-domain rules
  still pick `always` vs `auto` per the governance table
- [`skill-quality`](skill-quality.md) — every domain skill passes the
  same linter floor as a core skill
