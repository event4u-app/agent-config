---
adr: 135
status: accepted
date: 2026-07-28
decision: trust-boundary-escalation
supersedes: —
superseded_by: —
phase: road-to-feedback-9.8.0-followups · Phase 1
type: structural
review_trigger: >-
  Reopen when (a) a third host gains deterministic hook support (the
  weak-host tier shrinks — re-derive the per-class table), (b) a real
  incident shows a CRITICAL-class bypass that the disclosure tier failed to
  surface, or (c) the enforced_by vocabulary (validator / validator-local /
  observer / none) itself changes shape.
---

# ADR-135 — Trust-boundary escalation: which floors may never be downgraded, and what that honestly means per host

## Status

Accepted (2026-07-28). Answers the five questions the 9.8.0 risk-
classification work left open when it deliberately did not activate
non-refusable escalation. Shaped by AI-council debate 2026-07-28
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds), whose synthesis:
bind POLICY over the EXISTING enforcement levels (validator /
validator-local / observer / none), tiered by host capability — neither
encode "no enforcement ever" (destroys future enforceability) nor pretend
universal gates exist (the package is report-not-gate, ADR-127; the Hard
Floor is honestly `enforced_by: none`). No new enforcement machinery: this
ADR binds policy, ADR-133's freeze refuses new mechanisms.

## The five answers

### 1. Which risk class may not be downgraded?

**CRITICAL class — never downgradable via consumer settings/overrides:**

- `secret-vcs-guard` (credential write/stage/commit gates + the CI secret
  scan),
- the untrusted-input quarantine (found-instructions stop in
  `untrusted-input-defense` / `lethal-trifecta-guard` egress gating),
- the kernel-override guard (`block-no-verify` PreToolUse hook + the
  kernel-rule slow-rollout gate in `scope-control`).

*Rationale:* these three guard irreversible, externally-leaking failure
modes (leaked secret, injected-instruction execution, silently disabled
governance). Everything else (HIGH: `non-destructive-by-default`,
`security-sensitive-stop`; MEDIUM/LOW: quality and workflow rules) keeps
the existing override paths.
*Evidence to change:* one release cycle of override-log data showing the
CRITICAL set blocks legitimate consumer workflows at a material rate.

### 2. Which verification is mandatory per class?

| Class | Mandatory verification | Level (existing vocabulary) |
|---|---|---|
| CRITICAL (the three above) | Deterministic gate where the host has hooks; repo-side validator otherwise (CI secret scan, kernel-edit CI gate) | `validator` on hook-capable hosts · `validator-local` / CI backstop elsewhere |
| HIGH (Hard Floor, threat-model stops) | Model-carried refusal + this-turn confirmation; surfaced in the enforcement-coverage report as uncovered | `enforced_by: none` — stated honestly, never inflated |
| MEDIUM/LOW | Report-not-gate observation where instrumented | `observer` / `none` |

*Rationale:* permits enforcement on capable hosts while documenting the
weak-host fallback — tiered behavior, not pretended parity.
*Evidence to change:* a measured false-positive rate on a CRITICAL gate
above what its surface tolerates (then the gate is redesigned, not
declassified).

### 3. May a user switch it off?

- **CRITICAL:** no settings/override off-switch. Bypass requires modifying
  the installed package or hook wiring itself — an act that is visible in
  the tree and in `agent-config doctor`/coverage output, never a quiet
  flag. A request to weaken these via chat is a refusal trigger
  (`security-sensitive-stop` § self-modification).
- **HIGH and below:** yes — existing overrides and settings apply
  unchanged. The off-switch is logged where the surface already logs
  (override files are tracked artifacts; no new logging machinery).

*Rationale:* consumer sovereignty stays real for judgment-shaped rules; it
ends where a single silent flag could produce an unrecoverable leak.
*Evidence to change:* same as Q1.

### 4. Weak-host behavior (no hooks / no deterministic gates)?

Degrade to **disclosure, never silent parity**: the projection for a
hook-less host ships the same rule text, and the host's row in
`docs/capability-matrix.md` / `docs/enforcement-by-host.md` marks the
CRITICAL gates as model-carried there. `agent-config doctor` (and the
first-run surface where present) states which deterministic gates are
inactive on this host. Claiming hook-backed enforcement on a host without
hooks is a claims-ledger violation.

*Rationale:* the package's honesty identity — coverage gaps are reported,
not papered over (ADR-127, `non-destructive-by-default` § Enforcement).
*Evidence to change:* review_trigger (a).

### 5. Permissible cost?

- **No new resident processes, no new machinery** — ADR-124 classes +
  ADR-133 freeze bound the mechanism space; enforcement rides existing
  hooks and CI gates only.
- **Hook budget:** per-event work stays within the existing hook
  dispatch (precompiled bundle, no per-event re-spawn beyond what
  `dispatch:hook` already does); a CRITICAL gate that needs a new
  long-lived watcher is out of budget by definition.
- **Model-carried budget:** the always-loaded rule text for the CRITICAL +
  HIGH floors stays inside the existing kernel concentration cap
  (~12% / 3,600-char per-rule ceiling); escalation policy must not grow
  the kernel.
- **CI budget:** repo-side validators stay in the existing CI lanes; no
  new required workflow solely for this ADR.

*Rationale:* the enforcement value is policy clarity, not new spend.
*Evidence to change:* a CRITICAL gate demonstrably needs more than the
existing budgets — that is an ADR-133 review-trigger event, decided there.

## Consequences

- No enforcement change ships without citing this ADR (the roadmap's
  acceptance criterion); the classification work has a policy home.
- The enforcement-coverage report gains a stable reading: CRITICAL rows
  must show `validator`/`validator-local` (or a recorded host-gap), HIGH
  rows are legitimately `none` — a HIGH row silently claiming `validator`
  is now a detectable inflation.
- Risk accepted: the CRITICAL set is deliberately small; a future incident
  class may warrant promotion — that is review_trigger (b), an evidence
  event, not a silent widening.

## References

- `docs/contracts/trust-and-safety.md` · ADR-018 — the trust enum this
  policy binds onto.
- ADR-127 — report-not-gate enforcement doctrine.
- ADR-124 / ADR-133 — mechanism-space bounds (engine classes, freeze).
- `non-destructive-by-default` § Enforcement — the honestly-unenforced Hard
  Floor this ADR classifies as HIGH, not CRITICAL (no deterministic gate
  exists or is buildable within budget for "ask before you deploy").
