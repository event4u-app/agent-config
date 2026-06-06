---
adr: 057
status: proposed
date: 2026-06-06
decision: consolidation-evidence-gate-outcomes
supersedes: —
superseded_by: —
phase: consolidation evidence-gates (road-to-6.2.0-consolidation-evidence-gates)
type: structural
---

# ADR-057 — Consolidation evidence-gate outcomes (6.2.0)

## Status

**Proposed** · 2026-06-06. Records the outcome of running every gate in
`road-to-6.2.0-consolidation-evidence-gates` (the council-deferred remainder of
6.1.0). The roadmap is an **evidence-gate** plan: each step ships only behind a
named gate (inline-invoke proof, debug-bypass proof, grep-zero-usage, usage
signal). This ADR is the per-step decision provenance — the gate-checks were
run, the evidence captured, and the verdicts recorded here before any change
landed (Acceptance Criterion #3 of the roadmap).

Design context routed through the AI council
(anthropic/claude-sonnet-4-5 + openai/gpt-4o, design mode, 2 rounds +
peer-review, 2026-06-06). Both members converged on a conservative reading:
most gates are **not met**, and the package's existing safety posture argues
against the aggressive structural changes this cycle. The destructive
conversions are deferred or declined; the safe evidence/documentation slice
ships.

## Context

6.1.0 shipped the low-risk consolidation slice (Flows primary *view* +
recorded decisions) and deferred four items the council gated on real
capability/safety proof or usage evidence. Running those gates this session
produced the following verified evidence:

- **Skill description-match is the package's primary selector** — all ~220
  skills are reached by `description:` match (`src/scripts/skill_tools/
  score_skill_relevance.py::rank`). The "inline-invoke path" a converted
  command must satisfy is the same mechanism every skill already uses.
- **Projection suppression is binary per slug.** `generate_claude_commands()`
  skips a command slug when a same-named skill exists
  (`if slug in skill_names: continue`). A command and a skill **cannot coexist
  at the same slug** — creating `src/skills/<slug>/SKILL.md` silently removes
  the command projection. There is no "coexist as fallback" option at one slug.
- **The real `replaces:` alias set** is only: `git-commit`←`commit`,
  `git-commit-in-chunks`←`commit-in-chunks`,`commit:in-chunks`,
  `git-pr-create`←`create-pr`,
  `git-pr-create-description-only`←`create-pr-description-only`,`create-pr:description-only`.
  The roadmap's Step 8a named examples (`fix/pr-bot-comments`,
  `fix/pr-developer-comments`) **never existed as aliases** — a roadmap
  authoring error, corrected here and in the roadmap.
- **grep-zero-usage FAILS** for every alias (non-zero):

  ```bash
  # source-only scope (excludes definitions, archive, generated trees)
  grep -rIl --include='*.md' --include='*.py' --include='*.yml' --include='*.yaml' \
    -- "<alias>" . | grep -vE 'agents/roadmaps/archive|/dist/|/\.agent-src/|/\.augment/|/\.claude/|/\.cursor/|/\.clinerules|src/domains/git/'
  ```

  `commit-in-chunks` → 17 files · `commit:in-chunks` → 22 · `create-pr:description-only`
  → 17 · `create-pr-description-only` → 2. Several are live invocation forms,
  not dead flat names.
- **No usage telemetry exists.** No analytics JSONL is present;
  `docs/command-flows.md` is referenced only by its own generator, the
  Taskfile, and roadmaps — **zero** external/issue references. The 5b and 9b
  usage signals have not flipped.

## Decision

| Step | Gate | Evidence | Verdict |
|---|---|---|---|
| **7a** convert `skill/preview` + `skills/discover` to skills | inline-invoke proof before deletion | Mechanism proven (test added); but slug-collision suppression + untested cross-provider description-match | **DEFER conversion.** Ship the inline-invoke proof; keep the commands. |
| **7b** convert `review-routing` + `rule-compliance-audit` | guaranteed debug-bypass independent of the routing pipeline | The command form **is** the bypass; a skill reached only by description-match cannot debug a broken description-matcher (circular dependency) | **DECLINE conversion (KEEP command-only).** Document the intentional exception. |
| **8a** drop grace-elapsed 6.0.0-D aliases | grep-zero-usage → drop; any hit → keep stub | grep strongly NON-ZERO (17–22 files) | **KEEP all aliases as stubs.** Record evidence + alias-lifecycle policy. |
| **5b** fold `feature/explore`+`feature/roadmap` into `feature-plan` modes | evidence users treat them as modes of one goal | No usage signal; 6.1.0 KEEP-separate stands | **KEEP separate.** Not reopened. |
| **9b** make Flows the runtime primary surface | signal that users navigate by the flow doc | Zero external doc references; no telemetry | **DEFER runtime change.** Doc stays the observation vehicle. |

### Alias-lifecycle policy (Step 8a)

Aliases declared via `replaces:` fall into two classes:

- **Permanent migration stubs** — aliases for command names that existed before
  the 6.0.0-D restructure (`commit`, `create-pr`, and their `:`-cluster forms).
  These are a backward-compat contract for internal CI scripts and muscle
  memory; they are **kept indefinitely** and shrink only on a future
  grep-zero-usage pass.
- **Deprecated stubs** — aliases for commands shipped 6.0.0+ would carry a
  grace window and drop after grep-zero-usage for two consecutive releases.
  None exist today.

Re-run trigger: re-audit in a later cycle; if a previously non-zero alias drops
to grep-zero (with a hardened exclusion set and a manual spot-check of live vs.
stale hits), reopen it for deprecation. "Permanent" is therefore
evidence-reversible, not absolute.

## Consequences

- **No capability lost.** Every command in scope still resolves: 7a/7b keep
  their command form; 8a keeps every alias; 5b/9b are unchanged.
- **The roadmap stays active.** 7a-conversion and 9b-runtime remain open,
  blocked on future evidence (cross-provider validation / usage telemetry).
  7b-conversion is cancelled (decided, not pending). 8a and 5b are done.
- **Rollback path** — every change in the shipping PR is documentation, one
  test, and roadmap/ADR edits; revert is a single `git revert` of the PR with
  no runtime impact.
- **Follow-up (not this cycle, council-suggested):** passive
  flow-navigation telemetry would unblock both 7a (production reachability
  baseline) and 9b (flow-doc usage signal). Deferred as out-of-scope here —
  it is its own instrumentation roadmap, not an evidence-gate outcome.

## Alternatives considered

- **Ship the 7a conversion now** (delete commands, create skills). Rejected:
  the council converged on DEFER — slug-collision suppression turns a partial
  apply into a silent "source exists but does not project" state, and the
  cross-provider description-match is unvalidated for a maintainer-only tool
  with no telemetry to detect regression.
- **Convert 7b with a CLI hatch** (`python3 scripts/...` as the bypass).
  Rejected: adds a second invocation surface for the same tool when the
  existing command form already satisfies the gate at zero new surface.
- **Drop the grep-non-zero aliases anyway** (treat hits as stale). Rejected:
  the gate's own rule is "any hit → keep as stub"; overriding it would be
  exactly the silent-budget-bypass the gate exists to prevent.

## References

- `agents/roadmaps/road-to-6.2.0-consolidation-evidence-gates.md` — the gated plan.
- `docs/contracts/command-clusters.md` — cluster/alias model.
- `docs/contracts/skill-dry-run.md`, `docs/contracts/skill-discovery.md` — the
  contracts `skill/preview` + `skills/discover` implement.
- `tests/test_inline_invoke_reachability.py` — the Step 7a inline-invoke proof.
- ADR-056 — sibling council-informed, design-first disposition (video adapters).
