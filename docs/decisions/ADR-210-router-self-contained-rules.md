---
adr: 210
status: accepted
date: 2026-08-03
decision: router-self-contained-rules
supersedes: —
superseded_by: —
phase: road-to-renewal-adr-hygiene
type: structural
review_trigger: >-
  Reopen when a self_contained-tagged rule grows a real procedure body (its
  certification below then lies and it must route instead), OR when the count
  of self_contained rules rises above ~45 percent of non-kernel entries
  (the carve-out would then be swallowing the routing model instead of
  naming its honest exceptions), OR when a bidirectional back-ref linter is
  actually built (the dropped triggered_by promise may then return to the
  contract together with its enforcement)
---

# ADR-210 — Router contract reconciled: `routes_to ≥ 1` unless the rule is certified self-contained

## Status

**Accepted** · 2026-08-03. Per `road-to-renewal-adr-hygiene` Phase 2 with
AI-council convergence (claude-sonnet-4-5 + gpt-4o, design mode,
2026-08-03; the certification appendix below is the council's mandated
approval gate).

## Context

`docs/contracts/rule-router.md` promised: every non-kernel rule has ≥ 1
`routes_to:` entry, plus a bidirectional `triggered_by:` back-ref check.
Reality at decision time: 41 of 97 non-kernel router entries had empty
`routes_to`; the linter emitted `info` (never failing CI) with a dead
`trust.level: core` carve-out no rule used; the `triggered_by:` check was
never built.

Classification of the 41 (verified exhaustively against `src/skills/` and
`docs/guidelines/**`): 2 were mechanical stragglers whose prose already
named an existing guideline target; 2 point at *contexts* (not a legal
`routes_to` kind) and already declare `load_context:`; the remaining 37
are a coherent class — safety floors and output-format/interaction
policies whose entire body IS the constraint. Zero of the 37 have any
name-matched route target. Counter-evidence that routing is the norm: 37
*other* "Body migrated to …" rules all carry populated `routes_to` — the
41 were not a migration backlog.

## Decision

1. **The contract is amended**, not the rules fabricated: `routes_to` is
   required on non-kernel rules **unless the rule is self-contained** — a
   rule whose body is the constraint itself (a prohibition, gate, or
   output-format law with no procedure to delegate). Such a rule may
   offload detail via `load_context:`; it never declares an empty
   `routes_to: []`.
2. **The carve-out is an explicit marker, not an absence:**
   `self_contained: true` in rule frontmatter (added to
   `rule.schema.json`). The dead `trust.level: core` check in
   `skill_linter.ts` is replaced by this marker; a non-kernel rule
   declaring **neither** `routes_to` **nor** the marker is now an
   `error` (was: `info` that never failed CI).
3. **The 2 mechanical stragglers are routed** —
   `code-comment-discipline` → `guideline:code-clarity`,
   `untrusted-input-defense` → `guideline:agent-infra/untrusted-input-spotlighting`.
4. **The 2 context-pointing rules** (`autonomous-execution`,
   `roadmap-ci-steps-policy`) are certified self-contained-with-
   `load_context` rather than extending the `routes_to` kind vocabulary
   with `context:` — consistent with the 5 other `load_context` users in
   the class; a new routable kind would touch the schema pattern, the
   linter resolver, and the contract's resolution table for zero
   activation benefit.
5. **The false `triggered_by:` promise is removed from the contract**
   (recorded honestly per ADR-127: a promised check that does not run is
   decoration). It may return only together with a real linter.

## Consequences

- Positive: the contract is true; the gate can actually fail; the 39
  certified rules are reviewable line-items (appendix) instead of an
  unexplained absence.
- Negative / accepted: a new frontmatter key; authors of future
  constraint-only rules must certify deliberately (that friction is the
  point — the council's pre-registered failure mode is lazy
  classification, caught by the appendix review).

## Alternatives considered

- **Enforce ≥ 1 unconditionally** — rejected: would mean inventing ~37
  stub skills/guidelines that restate their rule, the exact fabrication
  the contract's activation-semantics rewrite (2026-08-02) was written to
  stop.
- **Drop the ≥ 1 clause with no marker** — rejected: reproduces the
  info-only no-op with more honest prose; the gate stays unenforceable.
- **`context:` as a routes_to kind** — rejected (Decision 4).

## Certification appendix — the 40 `self_contained: true` rules

Per-rule rationale (council approval gate: no entry may say "no target
found", describe a procedure, or be trivially short). 39 are router
entries; `telegraph-speak` is compile-time-dormant (not in `router.json`)
but linted as a non-kernel rule file and certified on the same bar.

| Rule | Why the body IS the constraint |
|---|---|
| `autonomous-execution` | Authority bands + N=3 validation budget — a permission law; detail offloaded via its 3 declared `load_context` files, not a delegable procedure |
| `roadmap-ci-steps-policy` | A prohibition (never schedule/run full-pipeline CI steps locally when `local_auto_run` is false) with an inline-skip format; mechanics offloaded via `load_context` |
| `fast-path-marker-visibility` | A verbatim-output law: the council fast-path marker must open the reply unaltered — nothing to execute, only a format to preserve |
| `low-impact-corpus-privacy-floor` | A hard refuse-gate over 8 forbidden content classes at two write gates; the redactor script enforces, the rule states the prohibition |
| `no-attribution-footers` | A pure prohibition (never add attribution footers) with an explicit exception list |
| `no-decorative-emojis-in-git-surfaces` | A character-set prohibition per git surface with a legend carve-out — a format law, no procedure |
| `onboarding-gate` | A single conditional instruction (first turn + not onboarded → point at the wizard); the wizard is a binary, not a routable artifact |
| `question-not-instruction` | An interpretation law (a question is not authorization to act) — pure conversational constraint |
| `source-confidentiality` | A prohibition on derivation-attribution in tracked artifacts with an encryption escape; the CI denylist gate backs it |
| `source-of-truth` | The edit-only-`src/` Iron Rule — a write-location prohibition; mechanics offloaded via `load_context` |
| `user-interaction` | The numbered-options + single-recommendation format law; mechanics offloaded via `load_context` |
| `brand-consistency` | A validation gate (every emitted value traces to a brand token) — the trace requirement is the whole rule |
| `brand-source-of-truth` | A precedence law (consumer brand wins, corpus fills gaps) — three-line priority order, nothing to delegate |
| `communication-through-line` | A reply-coherence format law (anchor once, name the delta, one end-summary) |
| `content-quoting-floor` | A quantitative quoting prohibition (≤ 15 words, one quote per source, never complete works) |
| `downstream-changes` | The every-edit-is-incomplete-until-callers-update law; its table is a checklist of the constraint, not a workflow to invoke |
| `external-code-graph-interop` | A query-order law (shipped index first, grep fallback, name the source) |
| `external-reference-deep-dive` | An evidence floor (fetch before claiming, cite verbatim, enumerate coverage) — the prohibitions are the content |
| `icon-consistency` | One-icon-system-per-project — a consistency prohibition with explicit non-fire conditions |
| `image-likeness-and-rights` | A refuse-and-surface gate over likeness/trademark/style generation; the policy files it lists are data it surfaces, not a body that fulfils it |
| `invite-challenge` | A single mandatory checkpoint question before complex plans — one interaction law with its own format block |
| `lethal-trifecta-guard` | An architectural prohibition (never ship all three legs on one autonomous path) with a preference-ordered break-a-leg list |
| `markdown-safe-codeblocks` | A fencing format law (no nested triple backticks; `~~~` outer default) |
| `media-governance-routing` | A consult-before-emit gate that loads project-local policy files — the gate condition is the rule; the policies are consumer data, not package artifacts |
| `media-sync-ground-truth` | A ground-truth law (timing/singer from transcribed audio, never a planning doc) with a sign-off gate |
| `no-pr-progress-comments` | A posting prohibition gated on one setting, with an explicit not-gated list |
| `output-discipline` | A banned-pattern table (placeholder prose) + the PAUSED protocol — output format law |
| `prefer-enums-over-literals` | A modelling law (multi-state field = enum) with a defer-don't-disrupt ladder stated inline |
| `preservation-guard` | A transformation invariant (result ≥ original; Iron Law sections byte-preserved) with its own checklist |
| `role-mode-adherence` | A closing-output contract (field order + mode marker + forbidden-work refusals) keyed to a setting |
| `runtime-safety` | An execution-model constraint table (manual default, allowlisted handlers) — schema-shaped prohibitions |
| `security-sensitive-stop` | A stop-before-edit law; the analysis skills it names are per-case tools the *user's change* routes to, the rule itself is the stop |
| `session-canary` | A liveness-marker format law (greeting + reply-close) keyed to a setting |
| `spreadsheet-source-quality` | A source-priority floor (official first, unofficial needs permission + cell mark) |
| `think-before-action` | The analyze-verify-never-guess floor with max-2-retries; mechanics offloaded via `load_context` |
| `token-budget-discipline` | A load-in-full/never-trim law over `token_budget_class` with the value-over-budget escalation |
| `token-efficiency` | Two output-handling Iron Laws (never load full output; never repeat a tool > 2×); mechanics offloaded via `load_context` |
| `tool-safety` | The deny-by-default / least-agency grant law — permission constraints, no procedure |
| `user-interrupt-priority` | The stop-run-new-task-ask protocol — a three-row classification law of conversational authority |
| `telegraph-speak` | A dormant prose-condensation format law (seven byte-stable carve-outs; bench-gated flip) — the constraint is the whole body |

## References

- `docs/contracts/rule-router.md` — the amended contract (frontmatter table + linter contract).
- `src/scripts/skill_linter.ts` (`lint_router_frontmatter`) — the escalated gate; dead `trust.level: core` carve-out removed.
- `src/scripts/schemas/rule.schema.json` — the `self_contained` key.
- [ADR-127](ADR-127-enforcement-claims-must-resolve.md) — the honesty precedent for dropping the `triggered_by` promise.
- `agents/roadmaps/road-to-renewal-adr-hygiene.md` Phase 2 — the authorizing step.
