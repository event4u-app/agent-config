# Pre-registration — scoped-rule absence in the read corridor

**Registered 2026-08-10, before any session was run.** Roadmap:
`road-to-feedback-9-29`, Phase 3 step 1. This file lands in its own commit
**before** either experiment session exists, so the registered-before-looking
property is in the history. Registration commit: `<registration-commit>`
(filled with the SHA of the commit that introduces this file, at commit time —
the placeholder is the only edit this file receives after registration). The
bar below is frozen: it is **not** edited after a session is run. If a run
produces something interesting the bar excludes, that is recorded as an
out-of-scope observation, never as a bar amendment.

## What is being decided

The Claude Code rule emitter (`_emit_claude_rule` + `_claude_paths_plan` in
`src/scripts/condense.ts`, landed via PR #1231) moved 25 of 110 emitted rules
from unconditional standing context to `paths:`-scoped on-demand delivery.
The landing note records project-scope standing load 418,570 B → 272,824 B =
**34.8%, ~36.4k tokens per session** (`road-to-rule-delivery-integrity`,
archived, P3.1 completion note). **That figure conflates two populations and is
not the scoping saving** — re-measured on this tree 2026-08-10, and the landing
note refutes itself: it reports a 34.8% delta of 145,746 B while also naming
64,700 B as the bytes moved on-demand.

| Population | Bytes | Delta cause |
|---|---|---|
| `dist/agent-src/rules/*.md` (source, WITH frontmatter) | 419,246 | the "before" |
| `.claude/rules/*.md` (emitted; `_emit_claude_rule` keeps only `paths:` + body) | 338,230 | **−81,016 = frontmatter deleted**, not scoped |
| the same minus the 25 `paths:`-scoped rules | 273,389 | **−64,841 = actually scoped** |

So the scoping saving is **≈19.2% / ≈16.2k tokens** of the emitted standing
corpus, and the larger half of the headline was frontmatter the emitter drops
for every rule. This matters for what this experiment can earn: **absence is not
a property deleted bytes can have.** The claim under test is therefore the
64,841 B, never the 145,746 B.

Reproduce:

```bash
find dist/agent-src/rules -name '*.md' -exec cat {} + | wc -c   # 419246
find .claude/rules -name '*.md' -exec cat {} + | wc -c          # 338230
grep -L '^paths:' .claude/rules/*.md | xargs cat | wc -c        # 273389
```

The (corrected) figure rests on two properties, and only one is verified:

- **Verified — loading happens.** 23 fixtures in
  `tests/scripts/condense_glob_emit.test.ts` pin the emitted frontmatter, and a
  witness session showed a scoped rule loading when a matching file is read.
- **Unmeasured — absence.** Nothing has observed a scoped rule correctly
  **staying out** of a session that touches no matching file. The archived
  roadmap records this verbatim: *"Absence is the property the 34.8% actually
  rests on and it remains unmeasured; a witness can only show that loading DOES
  happen."*
  (The archived wording says "the 34.8%"; per the table above the property it
  actually rests on is the 19.2% / 64,841 B scoping half.)

This experiment either observes absence or falsifies it. Nothing else is being
decided; no emitter change is in scope in any branch.

## Instrument — the host's `InstructionsLoaded` records, never the filesystem

The measurement reads the host's **`InstructionsLoaded`** records — the
per-session log of exactly which instruction files were loaded, when, and why
(documented in `agents/evidence/analysis/claude-code-rules-dir-contract.md`
§ "`InstructionsLoaded` hook"). It measures what **arrived**, not what was
projected. The filesystem is never the instrument: `.claude/rules/*.md`
existing on disk says nothing about what a session received —
`check_standing_rule_delivery` already infers from the filesystem and its own
header names the `InstructionsLoaded` record as the missing observation.

**A session log with zero instruction events is instrument failure — outcome C
— never absence evidence.** Every session in this design loads the 9 kernel
rules and the 76 unconditional rules regardless of what it reads, so a record
showing *nothing* loaded proves the recorder was not bound, not that scoping
worked.

### The instrument is NOT bound today — binding it is precondition zero

Stated plainly, because it decides whether this experiment can return anything
but C: **this suite does not bind `InstructionsLoaded`.**
`src/scripts/check_standing_rule_delivery.ts:192` says so in its own words ("a
host feature this suite does not yet bind"), `src/scripts/hook_manifest.yaml`
binds five slots and none is this one, and `grep -rn "InstructionsLoaded" src/
tests/` returns only prose references — zero code that reads a record.

So the run order is: **bind the recorder, prove it emits, then cite the
registration SHA and run.** A pair of sessions started before that returns
outcome C by construction — and burning two sessions on a foregone conclusion is
exactly the waste a pre-registration is supposed to prevent. Precondition zero
is therefore: a session log exists in which the recorder demonstrably captured
instruction events, and its path is named in the run record.

## Prior state disclosed at registration time

- The 25 scoped rules and their globs (table below) were read from the emitted
  `.claude/rules/*.md` frontmatter in this worktree — the ground truth of what
  the host sees, regenerable with `task generate-tools`. No session log has
  been read.
- The maintainer machine currently delivers rules from **two layers**
  (user-global `~/.claude/rules/` + project `.claude/rules/` — the duplication
  blocker `b-machine-dedup` in `road-to-feedback-9-29` tracks it; auditor
  estimate 176k → ~75k standing rule tokens after the `--layer` dedup).
  **Requirement:** both experiment sessions run under an **identical two-layer
  topology** — whatever the topology is, it is the same for both sessions, and
  the record states it. The maintainer `--layer` cleanup should complete
  **before** the registration SHA is cited and the runs start
  (`check_standing_rule_delivery` green on that machine); running the
  experiment astride the cleanup changes the instrument mid-measurement.
- The drill for this file's sibling Phase 3 step (release coverage) shares no
  surface with this experiment.

## The 25 scoped rules — glob expansion (the fixture)

Computed 2026-08-10 from `.claude/rules/*.md` frontmatter
(`grep -l "^paths:" .claude/rules/*.md` → exactly 25 files):

| Rule | `paths:` globs |
|---|---|
| augment-edit-discipline | `.augment/**` · `src/**` |
| design-fidelity | `*design.html` · `.claude/design-system/**` |
| design-review-after-ui-write | `resources/views/**` · `resources/js/**` |
| doc-screenshot-hygiene | `docs/media/**` |
| domain-adoption-policy | `src/skills/**` |
| framework-neutrality-in-generic-skills | `src/skills/**` · `src/rules/**` · `src/agent-src/commands/**` |
| image-likeness-and-rights | `scripts/ai-image/adapters/**` |
| laravel-translations | `lang/**` |
| lethal-trifecta-guard | `src/skills/**` · `src/agent-src/commands/**` |
| linked-projects-onboarding-gate | `.idea/modules.xml**` · `.idea/vcs.xml**` |
| low-impact-corpus-privacy-floor | `agents/decisions/low-impact-decisions**` |
| markdown-safe-codeblocks | `*.md` |
| no-roadmap-references | `agents/roadmaps/**` · `agents/runtime/council/questions/**` · `agents/runtime/council/responses/**` · `agents/runtime/council/sessions/**` |
| onboarding-gate | `.agent-settings.yml**` |
| persona-governance | `src/agent-src/personas/**` · `dist/agent-src/personas/**` |
| php-coding | `*.php` |
| provider-lifecycle-discipline | `scripts/ai-video/adapters/**` · `scripts/ai-image/adapters/**` · `scripts/media/lib/**` · `agents/.ai-video.xml**` |
| roadmap-ci-steps-policy | `agents/roadmaps/**` |
| roadmap-progress-sync | `agents/roadmaps/**` |
| rule-type-governance | `src/rules/**` |
| settings-ask-protocol | `docs/contracts/settings-classes.md**` |
| skill-quality | `src/skills/**` |
| source-confidentiality | `src/skills/**` · `src/rules/**` · `src/domains/**` · `docs/**` · `agents/evidence/**` · `agents/roadmaps/**` |
| source-of-truth | `dist/agent-src/**` · `.augment/**` · `.claude/**` · `.cursor/**` |
| ui-audit-gate | `resources/views/**` · `resources/js/**` |

**Glob union, subsumption-reduced** (a pattern subsumed by a broader one in the
union is folded into it):

- Directory-shaped: `.augment/**` · `src/**` (subsumes the four `src/…/**`
  patterns) · `dist/agent-src/**` (subsumes `dist/agent-src/personas/**`) ·
  `docs/**` (subsumes `docs/media/**`, `docs/contracts/settings-classes.md**`) ·
  `.claude/**` (subsumes `.claude/design-system/**`) · `.cursor/**` ·
  `lang/**` · `resources/views/**` · `resources/js/**` ·
  `scripts/ai-image/adapters/**` · `scripts/ai-video/adapters/**` ·
  `scripts/media/lib/**` · `agents/roadmaps/**` ·
  `agents/runtime/council/questions/**` · `agents/runtime/council/responses/**` ·
  `agents/runtime/council/sessions/**` · `agents/evidence/**` ·
  `agents/decisions/low-impact-decisions**`
- File-anchored: `.idea/modules.xml**` · `.idea/vcs.xml**` ·
  `.agent-settings.yml**` · `agents/.ai-video.xml**`
- Extension-shaped: `*.md` · `*.php` · `*design.html`

## The read corridor — computed, not guessed

The corridor is the set of repo files matching **none** of the union. Checked
against the union above:

- **`tests/**/*.ts` is in the corridor.** No directory-shaped or file-anchored
  pattern names `tests/`; the `.ts` extension matches none of the
  extension-shaped patterns under **any** glob semantics (root-only or
  any-depth) — so the corridor's validity does not depend on resolving whether
  the host reads `*.md` as `**/*.md`.

This confirms the expected corridor from the roadmap step: **`tests/**/*.ts`**.
The corridor session may read only files from this set — reading anything
else (including `.claude/**` itself, which matches `source-of-truth`)
invalidates the run as a corridor session.

## Method — two sessions, one diff

1. **Corridor session.** Fresh session under the registered topology. Read
   only corridor files — e.g. `tests/scripts/release_drill.test.ts` and one
   other `tests/**/*.ts` file. No other file read, no glob-matching tool
   activity. End the session.
2. **Match session.** Fresh session, same topology. Read exactly one matching
   file: `src/rules/architecture.md`. Its unambiguous (directory-shaped)
   matches among the 25: **augment-edit-discipline** and
   **framework-neutrality-in-generic-skills**, **rule-type-governance**,
   **source-confidentiality** (all via `src/**` / `src/rules/**`). Whether
   `markdown-safe-codeblocks` (`*.md`) also loads is recorded as a
   **semantics observation** (root-only vs any-depth), not as part of the bar
   in either direction. End the session.
3. **Diff** the two sessions' `InstructionsLoaded` records over the 25 scoped
   rule filenames.

## Violations and the four outcomes

**E1** — any of the 25 scoped rules appears in the **corridor** session's
`InstructionsLoaded` records.

**E2** — any of the four unambiguous expected rules is **absent** from the
**match** session's `InstructionsLoaded` records.

| Outcome | Condition | Meaning |
|---|---|---|
| **A** | No E1, no E2, both sessions carry instruction events | **Absence holds.** Scoped rules are absent in the corridor and present on match — the scoping half (19.2%, 64,841 B) now rests on both properties. |
| **B** | ≥ 1 E1 violation | **Savings claim false as stated.** A scoped rule loads on non-match. A **single** E1 violation is outcome B — there is no "mostly holds" band, because the claim is "moved to on-demand", not "moved for most rules". |
| **B′** | No E1, ≥ 1 E2 violation | **Worse than B: the obligation is unreachable.** A scoped rule fails to load on match — the savings were *removed*, not *moved*. Escalate to a maintainer decision immediately; the emitter's own header already names the un-scopable class this would put every affected rule into. |
| **C** | Either session's log carries zero instruction events, OR the sequencing assertion below cannot be made | **Instrument failure.** No claim in either direction; re-register and re-run. |

E1 and E2 can in principle co-occur; that is recorded as **B and B′ both**, and
the B′ escalation still fires.

## Sequencing — strict, no best-effort disclaimer

- **Precondition zero — the recorder is bound and proven emitting.** The
  `InstructionsLoaded` instrument is not bound in this tree today (§ Instrument).
  Until a session log exists whose instruction events were demonstrably captured,
  and its path is named in the run record, every run is outcome C by
  construction. This precedes the SHA fill and both sessions.
- This file's registration commit is `<registration-commit>` (filled at commit
  time). It **precedes** both sessions in history.
- The run protocol REQUIRES the run record to (a) cite that SHA and (b) assert
  that **no corridor-matching session ran between registration and
  experiment** on the experiment machine. If that assertion cannot be made,
  the run is **outcome C** and the experiment re-registers — there is no
  best-effort path.
- The maintainer `--layer` dedup (`b-machine-dedup`) precedes the registration
  fill; `check_standing_rule_delivery` green on the experiment machine is the
  precondition witness. The two-session run itself is maintainer-machine work
  (blocker `b-absence-run`).

## Expected-results table — registered empty, before looking

| Session | Instruction events present? | Scoped rules loaded (count) | Which | E1 / E2 |
|---|---|---|---|---|
| corridor | _(pending)_ | _(pending)_ | _(pending)_ | _(pending)_ |
| match | _(pending)_ | _(pending)_ | _(pending)_ | _(pending)_ |

**Outcome:** _(pending — exactly one of A / B / B′ / C, plus the `*.md`
semantics observation)_

## Privacy

The records name this repository's own instruction files — no conversation
content is needed or quoted. Session ids are recorded as opaque ids, never as
file paths under `$HOME`.

## What outcome A does and does not mean

A means: *under this host, this topology, and these 25 emitted globs, scoped
rules stay out of a session that reads only non-matching files, and load on a
matching read.* It does not generalize to other hosts (only Claude Code reads
`paths:`), to future glob sets (the fixture above is the tested set), or to
sessions whose tool activity touches matching paths without "reading" them —
the record's own `why` field is the arbiter there and is quoted in the run
record if it arises.
