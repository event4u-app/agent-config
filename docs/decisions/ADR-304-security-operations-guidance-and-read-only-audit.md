---
adr: 304
status: accepted
date: 2026-11-02
decision: security-operations-guidance-and-read-only-audit
supersedes: —
superseded_by: —
phase: road-to-a-switch-built-before-it-is-needed · step 1.1
type: structural
reopen_policy: unclassified
protected_dimensions: none
provenance:
  kind: agentic
  agentic_mode: single
  decision_makers: [agent]
  human_directed: true
evidence:
  strength: E1
  basis:
    - agents/evidence/owner-directives/2026-11-02-security-operations-and-containment.md
    - agents/roadmaps/archive/road-to-a-switch-built-before-it-is-needed.md
review_trigger: >-
  Reopened when the owner answers OQ-60 item 1 (self-containment) with yes, when
  a consumer reports a lever that locked its operator out, or when a lever store
  that fails open is found to be the blueprint's recommendation rather than a
  project's deviation from it.
---

# ADR-304 — Security operations is guidance plus a read-only audit; the suite never throws a lever

## Status

Accepted 2026-11-02, landing the owner's request recorded in
`agents/evidence/owner-directives/2026-11-02-security-operations-and-containment.md`.

## Context

The owner asked that the suite recommend — and, on the user's yes, plan — a
protected security and maintenance section in products it helps build:
maintenance, shutdown when a vulnerability becomes known, stack-aware scans, the
app disabled or self-disabling until fixed, and the operator always able to get
in. The suite has no runtime in a consumer's product. What it can own is the
design it proposes, the checks it runs, and the questions it asks while planning.

## Decision

1. **Guidance, a schema and a read-only audit — no production action.** The
   suite ships a reference blueprint
   (`src/skills/security-audit/references/control-section.md`), a lever
   inventory schema (`src/scripts/schemas/security-ops.schema.json`) and
   `/audit security`. It never flips a lever in a deployed product; ADR-296's
   read-only notice stays read-only.
2. **One lever vocabulary.** L0 observe · L1 feature off · L2 surface off
   (writes, signups, an API) · L3 maintenance with the operator path open ·
   L4 offline behind the edge. Every lever declares `fail_mode: open|closed` —
   what happens when its store cannot be read. A lever without one is invalid.
3. **The operator always gets in.** A lever never switches off the path that
   releases it: the control surface does not depend on the component it
   switches, and a break-glass path works without the web UI.
4. **Only the operator releases a lever.** A timer, a re-evaluation or a newer
   advisory may propose release, never perform it.
5. **Opt-in.** The audit and planning offer the section; after a "no" the
   finding stays visible and the question is not repeated in that run.
6. **`/audit security` is an argument of `/audit`**, alongside `deps`, `code`
   and `agents` — no new verb (ADR-041).

## Consequences

- A project the suite plans can be contained by a human within minutes, and the
  audit can say whether it could.
- Automatic self-containment stays undecided and unbuilt (OQ-60): a false
  positive would take a product offline with nobody in the loop.

## Evidence

The owner's request (basis 1) and the roadmap that implements it (basis 2). The
tree at a3b91da693 had no consumer containment guidance: zero hits for a
maintenance lever, a break-glass path or a lever inventory outside agent-internal
files, and no containment row in `threat-modeling/data/threats.csv`.

## Alternatives

- **A runtime library shipped into consumer projects** — rejected: the suite has
  no runtime, and a library per framework is a maintenance surface this package
  does not carry.
- **A top-level `/security` verb** — rejected: ADR-041 fixes the verb list and
  `/audit` already holds the security audits.

## Amendment 2026-11-02 — the owner's answer to OQ-60

Owner ruling (`agents/evidence/owner-directives/2026-11-02-oq-59-60-answers.md`):
"OQ-60: wie empfohlen". <!-- md-language-check: ignore -->
The review trigger above did not fire: item 1 was answered **no** by
default, not yes. Three points change, and § 1 (the suite never throws a lever)
stands unchanged:

- **Item 1 — `automation: propose`.** The lever inventory may opt into one mode
  beyond the default `off`: a T0 advisory whose package a lever names becomes an
  unchecked proposal in the advisory issue, addressed to the lever's owner.
  The validator refuses every other value, so an unattended throw cannot be
  declared. The consequence "automatic self-containment stays undecided" now
  reads: **decided — no, except as a proposal an operator confirms.**
- **Item 2 — `security_ops.plan`.** Decision 5's "not repeated in that run"
  becomes "asked once, then persisted": a class-B settings key, default
  `false`, written with `--source jit-answer` when the user answers.
- **Item 3 — `/audit` is suggestable in consumer projects.** Its workspace
  list gains the engineering workspace, so the suggestion layer can offer it
  outside the maintainer workspace.
