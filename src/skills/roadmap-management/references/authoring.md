# roadmap-management — authoring a roadmap

> Mode body of the [`roadmap-management`](../SKILL.md) skill (router-head
> retrofit, 2026-08-20). Content moved VERBATIM from SKILL.md — load this
> file when the mode table in SKILL.md routes here.

## Roadmap structure

Every roadmap follows this structure:

```markdown
# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets.}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass — the project's type-checker, auto-fixer, linter, and full test suite (see the `quality-tools` skill for stack-specific invocations)

## Notes

{Edge cases, decisions, links}
```

## Key rules for roadmaps

### Checkboxes — mandatory, not decorative

- **Every active roadmap MUST contain at least one `- [ ]` per non-intro phase.** Decision tables, ICE matrices, and block-sequencing tables are valid rationale, but they do not satisfy this rule on their own — pair them with a `## Phase N` or `## Implementation Checklist` section whose checkboxes execute the decision. A roadmap without checkboxes is invisible to `agents/roadmaps-progress.md` and violates [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md) Iron Law #2.
- Every actionable step uses `- [ ]` (unchecked) or `- [x]` (completed).
- Mark steps as `[x]` immediately after completing them.
- Never remove completed steps — they serve as history.
- **Status is binary: `ready` (default, implicit) or `draft`.** New roadmaps are created **ready** unless the user explicitly says otherwise — `ready` is implicit and need not be written. A roadmap that is still being authored, awaiting upstream decisions, or capturing options without a worked plan declares `status: draft` in YAML frontmatter at the top of the file. Drafts are hidden from `agents/roadmaps-progress.md` until the flag is removed or flipped to `ready`. There are no other status values; legacy banners (`**Status: directional**`, `Status: capture-only`, `mode: feedback`) are removed.

### Awaiting evidence — a blocker entry, never a new glyph

- Waiting on **evidence that has not arrived** (soak still running, benchmark unfunded, adopter absent) is neither `[~]` nor `[-]`. Signal it with a structured `## Blockers` entry — five-field shape in [`templates/roadmaps.md` rule 20](../../agent-src/templates/roadmaps.md) — whose `Resolved when:` names the decidable signal ending the wait. The item stays `- [ ]` and points at it: `<!-- blocked-by: <id> -->`.
- **No new glyph.** `[ ]` + `blocked-by:` = open, awaiting named evidence (stays active) · `[~]` = deferred by decision (bars archival, Iron Law 3) · `[-]` = cancelled with a reason (does not bar it). A fifth state buys nothing the entry above does not already carry.

### Phases

- Group related steps into phases (e.g. "Preparation", "Migration", "Cleanup").
- Complete one phase before starting the next (unless steps are independent).
- After completing a phase, summarize what was done.

### Quality gates

Every roadmap implicitly includes the project's quality pipeline
(static analysis, autofixes, tests). Whether the agent runs it locally
at all is gated by `quality.local_auto_run`: `false` or missing (the
default) → the agent never runs the pipeline locally; the user runs it
manually and remote CI on the PR is the authoritative gate (run-end
report: *"quality gates delegated to remote CI"*; new-gate carve-out
steps still run once). When `local_auto_run: true`, **when** the
pipeline runs during `/roadmap:process-step|phase|full` is controlled
by `roadmap.quality_cadence` in `.agent-settings.yml`:

| Cadence | Pipeline runs (`local_auto_run: true` only) | Trade-off |
|---|---|---|
| `end_of_roadmap` (default) | Once before archiving | Fastest, fewest tokens; errors compound across phases |
| `per_phase` | After every completed phase + final | Balanced; catches drift at phase boundaries |
| `per_step` | After every completed step + final | Legacy verbose; highest token cost |

The default is `end_of_roadmap` because most steps are checkbox-only
content edits and a final pipeline run is the cheapest way to satisfy
`verify-before-complete`. Switch to `per_phase` for risky migrations or
unfamiliar codebases.

**Always-on, regardless of cadence:**

- Step checkboxes flip `[ ] → [x]` and the dashboard regenerates **same
  response** (enforced by `roadmap-progress-sync`).
- Before any "roadmap complete" claim or archival, the pipeline runs
  fresh (enforced by `verify-before-complete`).

### Step granularity

- Each step should be completable in one session (< 1 hour of work).
- If a step is too large, break it down into sub-steps.
- Steps should reference specific files/classes when possible.

### Language

- Roadmap files are written in **English** (per project convention).
- Step descriptions should be precise and actionable, not vague.

