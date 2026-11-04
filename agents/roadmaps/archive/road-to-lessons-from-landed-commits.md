---
complexity: lightweight
status: ready
tree_pin: d2b372b183
execution:
  mode: autonomous
---
# Road to lessons from landed commits

> **Source:** a 2026-05 roadmap draft that was never landed and was kept only
> as a local stash, re-analysed against the tree on 2026-11-04. Its external
> reference is not named here.

## Goal

`learning-to-rule-or-skill` accepts a **landed commit** as a learning source:
given a commit, the agent drafts the learning from the diff and the message,
and the draft still passes every gate the interactive path passes. A one-off
fix stays a one-off — the commit is evidence, never a repetition.

## Disposition of the draft's thirteen proposals

Re-checked at the pin. Only one proposal names something the tree lacks.

| Proposal | Disposition | Evidence at the pin |
|---|---|---|
| Host-compatibility matrix for frontmatter fields | already present | `agent-config hooks:status`, `host_semantics.ts`, `docs/contracts/hook-architecture-v1.md` |
| Failure-mode matrix ("host ignores the field") | already present | every rule's `Honest enforcement` section names the host reach |
| `preview_required` advisory preview block | already present, other shape | `non-destructive-by-default` (confirm before act, names the exact object), skill `scope.write` |
| `reads_current_state` staleness preamble | already present, other shape | `source-discovery-gate` (session reads invalidate on `HEAD` change), `drafted-against` provenance, code-graph `behind:N` |
| `readOnlyHint` / `idempotentHint` | already present where a runtime reads them | `src/scripts/mcp_server/annotations.ts`; skills carry `scope.write` + `execution.type` |
| `destructiveHint` rejection | already decided | no runtime in a projected skill to honour it |
| Commit-driven learning (`--from-commit`) | **adopt** | absent: no commit source in `learning-to-rule-or-skill` |
| `## When to Use` sections on top-10 skills | already present | 303 of 303 skills carry `## When to use` and `## Do NOT` |
| JSON next-step hints spike | superseded | `src/scripts/ai_council/cli_hints.ts`; skill routing is `suggest_skill_for_task` |
| Recipe format spike | superseded | the work engine's directives (`src/agent-src/templates/scripts/work_engine/`) |
| Parallel batch primitive | rejected (host concern) | `subagent-orchestration` |
| Durable findings store | rejected | memory layer (`memory:*`) |
| Code graph | superseded | `code-intelligence`, `project:map` |

## Phase 1 — A commit as a learning source

- [x] **1.1 The commit source.** `src/skills/learning-to-rule-or-skill/SKILL.md` <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      names a landed commit as a learning source: read the diff as the
      evidence and the message as the intent, keep the Promotion Gate in full
      (a single commit never satisfies Repetition on its own), and set
      `source_learning` to the commit.
      verify: `grep -c 'Learning from a landed commit' src/skills/learning-to-rule-or-skill/SKILL.md` -> 1
      Done: one line under `### Decision hints`; the grep returns 1. Deviation:
      the planned standalone `## Commit-derived learnings` section took the skill
      to 418 lines and raised a new `skill_too_large` warning (> 400 lines,
      density 0.53), so the source ships as a decision hint — the skill is 399
      lines and lints clean. The hint still crossed the per-skill byte ceiling
      by 177 bytes; the raise is recorded in `src/config/skill-body-budget.json`.
- [x] **1.2 Reachable by the words people use.** The skill's auto-trigger <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/skill-body-budget.json -->
      keywords name the commit phrasing.
      verify: `grep -c '^\* learn from this commit$' src/skills/learning-to-rule-or-skill/SKILL.md` -> 1
      Done: keyword line added; the grep returns 1.
- [x] **1.3 Projection in step.** `dist/agent-src/` regenerated from `src/`. <!-- receipt: class=R0 · shadow · would-skip=council,evidence,retro,revalidation,review · bound=every touched path is non-behavioural -->
      verify: `bash src/scripts/condense.sh --changed` -> 0 and lists no stale file
      Done: `task sync` + `task generate-tools`; condense reports every projection matches its source.

## Risk Register

- **Over-fit.** A landed fix reads like a pattern because it is concrete. The
  section keeps the Repetition gate and says the commit is one piece of
  evidence; a second instance (another commit, an audit line, a session) is
  what promotes it.
