---
complexity: lightweight
status: ready
---

# Roadmap: Ecosystem-Harvest — Review Mechanics

**Trigger:** Ecosystem survey, second sweep of the source directory (see
[`road-to-ecosystem-harvest-index`](road-to-ecosystem-harvest-index.md)).
Sources cited source-anonymously (**O** = a 3-persona PR-review skill, **P** = a
mobile-app repo's change-review skill, **Q** = an RL-env repo's alignment-review
skill, **G** = a security-firm repo, **Y** = a container-tooling repo); full
provenance in the index § Provenance.

**Priority: P1.5.** Upgrades the review surface (`code-review`,
`adversarial-review`, `review-routing`, `fix-pr-comments`, council parallel
review) with five verified mechanisms it lacks today.

## Goal

Add change-type checklist routing, parallel-review ordering-bias mitigation,
reasoned finding-validation with dropped-false-positive transparency, comment
dedup, and a two-tier mechanical/alignment split with governance-conflict
flagging — each attacking a distinct, real review failure mode.

## Reality check — already shipped (do NOT rebuild)

| Candidate | Verdict | Evidence |
|---|---|---|
| Review skill + routing between skills | Shipped | `code-review`, `review-routing`, `adversarial-review` |
| Multi-reviewer / lens system | Shipped | `architecture-review-lens`, council lenses, `judge-*` |
| Fixed reviewer personas (correctness/health/UX) | Already-have (variant) | map onto existing lenses; do NOT import personas |
| Change-type → checklist routing | **Gap** | `code-review` is one flat procedure (grep-confirmed: no change-type/two-tier terms) |
| Ordering-bias mitigation on parallel dispatch | **Gap** | `parallelizable: files` + council dispatch shuffle nothing |
| Dropped-false-positive transparency | **Gap** | no output template exposes suppressed findings |
| Dedup vs existing PR comments | **Gap** | `fix-pr-comments` has no dedup step (grep-confirmed) |
| Governance-conflict (ADR) flag on review | **Gap** | no review artifact scans `docs/decisions/` for conflicts |

- [x] Reality check complete — five mechanisms are genuine gaps; the multi-reviewer *infrastructure* already exists.

## Phase 1 — Change-type routing + per-type checklists

- [ ] Add a change-type detection step to `code-review` (file-pattern table for the repo's stacks) and split the single procedure into `checklists/<type>.md` loaded on demand (progressive disclosure of review depth; dependency-bump = expedited). *Source P.* **Token-neutral:** measure on-invoke tokens before/after — this is a token-efficiency change, prove it.
- [ ] Metadata gates: UI diff without screenshots → ❓; new module without a test plan → ❓. Optional per-project cross-cutting gate (new state-changing op without telemetry/authz touch → ❓). *Source P, Y.*
- [ ] Re-review scoping rule: on a follow-up push, scope to changed lines only; never flag new issues in unchanged code — the discipline `fix-pr-comments` reply rounds need. *Source P.*

## Phase 2 — Two-tier triage + governance-conflict flag

- [ ] Restructure `code-review` output into **Tier 1** (mechanical — enumerated, fix-ready) and **Tier 2** (alignment — each flag names the principle/ADR at stake + the concern). *Source Q.*
- [ ] Governance-conflict step: scan `docs/decisions/` status-aware; conflicts with **draft/in-review** ADRs flag too ("either the change or the draft needs updating — discuss"). Optional `git blame`-derived reviewer suggestion on the cited line, guarded (degrades silently without governance docs). *Source Q.*

## Phase 3 — Parallel-review de-biasing + reasoned aggregation

- [ ] Ordering shuffle: wherever N reviewers get the same file set, each dispatch gets an independently shuffled file order; deterministic seed per session, logged for replay. *Source O.*
- [ ] Reasoned validation: group findings (file + line range) → CONFIRMED / adjusted / DROPPED with one-line reasons — explicitly **not** vote-counting. **Boundary note (grep-checkable):** option-level decisions use the council stance tally; finding-level review uses reasoned validation — state this in both `ai-council` and `code-review` so the two protocols never cross-apply. *Source O.*
- [ ] Output template: collapsible "Dropped false positives" section (with reasons) + a YES / NOT-SURE / NO verdict line. *Source O.*
- [ ] **Deep path for security-class CONFIRMED findings:** route into a false-positive deep-verify (restate the claim first; threat-model fields — privilege / sandbox / attacker precondition; source→sink trace; devil's-advocate; evidence-backed verdict). Shares the "Rationalizations to Reject" table with the bug-security-rigor roadmap. *Source G (fp-check).*
- [ ] **Adaptive review depth:** codebase-size table (SMALL→DEEP / MEDIUM→FOCUSED / LARGE→SURGICAL) + risk-triggers (auth/crypto/external-call/validation-removal → HIGH regardless of diff size) + a mandatory "coverage limits + confidence" report section. Cross-check overlap with `blast-radius-analyzer` before writing (it is one input; the depth-policy + coverage-honesty are the gaps). *Source G (differential-review).*

## Phase 4 — fix-pr-comments: dedup + scope discipline

- [ ] Before posting: fetch existing PR comments (paginated), suppress matches (same file, ±3 lines, title-keyword overlap), log suppressed items. *Source O.*
- [ ] Apply the Phase-1 re-review scoping rule to reply rounds.

## Council convergence (2026-07-11)

Vetted under the index-level council direction (adopt verified mechanisms,
respect census discipline). The tally-vs-reasoned-validation boundary is
recorded so it never cross-applies with the council-deliberation work.

## Acceptance criteria (anti-dump)

- [ ] No checklist file ships unreachable from the detection table (orphans fail `lint_load_context`).
- [ ] Code-review on-invoke token cost does not increase (measured before/after).
- [ ] A planted false-positive fixture lands in the "dropped" section with a reason; a fixture ADR-conflict produces a Tier-2 flag naming the ADR.
- [ ] The tally-vs-reasoned boundary sentence exists in both `ai-council` and `code-review` (grep-checkable).
- [ ] Dashboard regenerated.
