---
model_tier: inherit
name: roadmap-writing
description: "Use when authoring or rewriting a roadmap in agents/roadmaps/ — phases, goal, acceptance criteria, council notes; fires even on 'write a plan for X' / 'draft a roadmap'."
domain: process
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

<!-- cloud_safe: degrade -->

# roadmap-writing

## When to use

* Authoring a new roadmap file in `agents/roadmaps/{name}.md` (or
  module-scoped under `{module_root}/{Module}/{agent_folder}/roadmaps/` —
  per `modules.root_paths` + `modules.agent_folder`; Laravel shape:
  `app/Modules/{Module}/agents/roadmaps/`)
* Rewriting an existing roadmap (phase restructure, goal pivot,
  council-pass integration — not a checkbox flip)
* Drafting a phase block, exit criteria, or rollback section that
  will land inside an existing roadmap — an operator **symptom** as the input has its own entry procedure: [`symptom-driven harvest`](../../../docs/guidelines/agent-infra/symptom-driven-harvest-loop.md)

Do NOT use this skill when:

* Flipping checkboxes, regenerating the dashboard, archiving on
  completion → use [`roadmap-management`](../roadmap-management/SKILL.md)
* Updating AGENTS.md / module docs / contexts → use
  [`agent-docs-writing`](../agent-docs-writing/SKILL.md)
* Capturing an architectural decision → use
  [`adr-create`](../adr-create/SKILL.md)

## Roadmap-writing vs roadmap-management — critical test

| Intent | Artifact |
|---|---|
| "I need to write the plan body" | **roadmap-writing** (this skill) |
| "I need to track progress / regenerate dashboard / archive" | **roadmap-management** |

This skill owns the **prose authoring** axis: structure, goal
sentence, phase blocks, acceptance criteria. The execution and
dashboard-sync axis stays in `roadmap-management`.

## Procedure

### 0. Drafting protocol

Authoring or materially rewriting a roadmap must go through
Understand → Research → Draft per the
[`artifact-drafting-protocol`](../../rules/artifact-drafting-protocol.md)
rule. **Run the probe, do not eyeball the directory:**

```bash
agent-config roadmap:context
```

It reports sibling roadmaps on the same topic across all four roadmap
directories, inbox notes, and open PRs on the cited paths — the semantic axis a
filename scan cannot see. Each hit becomes one `relates:` row
(`extends` / `supersedes` / `depends` / `disjoint`, template rule 18); zero hits
becomes `relates: []` carrying the probe's `scanned:` line as its
justification. **Gate C first** — "write a
plan/roadmap" is a gated surface, so run
[`plan-confidence-gate`](../../contexts/execution/plan-confidence-gate.md)
before drafting (95%-conditions, marker, interview-or-degrade, C→R1 handoff).

### 1. Read the canonical template first

The structure, frontmatter, lifecycle, and complexity-tier rules live
in [`src/agent-src/templates/roadmaps.md`](../../templates/roadmaps.md).
Read it before authoring. Do not restate its rules in the roadmap
body — link the template if a phase needs to override one.

**Naming:** a lone roadmap is `road-to-<slug>.md`. When you create **≥2
related** roadmaps in one pass (siblings split from one body of work, or
a follow-up chain), give them a shared `road-to-<family>-<part>.md`
prefix so relatedness is visible and the dashboard groups them — pick
the `<family>` slug up front (template rule 21). Follow-ups additionally
carry `parent_roadmap:` (rule 17).

### 2. Pick complexity tier honestly

Default `lightweight` (≤ 6 phases, ≤ 600 lines). Only use
`structural` when the change touches a contract, kernel rule, or
budget invariant — the complexity linter enforces it. Standard:
[`roadmap-complexity-standard`](../../../docs/contracts/roadmap-complexity-standard.md).

### 3. Write the goal first

One sentence, top of file, decidable: "Reduce X by Y on flow Z."
Vague goals ("improve roadmaps") force every reader to re-derive
intent. If the goal needs three sentences, the roadmap is two
roadmaps.

### 3b. Scan sources for discrepancies before drafting phases

When the roadmap originates from a ticket/spec that carries a second
source — an attached mockup/screenshot, a code reality, or an internal
contradiction — run the **cross-source discrepancy scan** (per
[`cross-source-consistency`](../../rules/cross-source-consistency.md),
gated by `consistency.cross_source`) before writing phases. A phase plan
built over a text↔image contradiction or a silent-but-needed behavior
(weekend/holiday shift, empty/error state) bakes the wrong assumption into
every downstream step. Surface each discrepancy as one batched open
question first; an inferred behavior is a scope expansion to confirm, not
to plan silently. Taxonomy + procedure:
[`cross-source-consistency-mechanics`](../../../docs/guidelines/agent-infra/cross-source-consistency-mechanics.md).

### 4. Phase blocks carry checkboxes

Every non-intro phase contains at least one `- [ ]`. Decision tables
and council-pass notes capture the *why*; checkboxes capture the
*what to do next*. Without checkboxes the phase is invisible to
`agents/roadmaps-progress.md` — enforced by
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
Iron Law #2.

**Bind a `verify:` on behavior-changing steps.** A step that changes
behavior (a new guard, a migration, a wired endpoint, a mechanism edit)
SHOULD carry a narrow `verify:` command in an inline annotation —
`- [ ] Wire the guard <!-- verify: task test -- --filter=GuardTest -->`
— so its `[x]` flip is machine-checkable, not just agent-asserted (template
rule 23; enforced by the flip-guard). Bind it only where a single narrow
command (targeted test / grep / build of the touched surface) proves the
step; leave it off doc-only / prose steps and never make it the full CI
suite (`roadmap-ci-steps-policy`).

### 4b. Declare the execution mode (frontmatter)

Every new roadmap declares how a later `/roadmap:process-*` run should
interact, via `execution.mode:` in frontmatter — `autonomous` (one
run-start execution-contract confirmation, then uninterrupted except
safety floors), `phase-checkpoints` (halt + compact status per phase
boundary), or `interactive` (declare it — an omitted field is derived).
Semantics: [`templates/roadmaps.md` rule 18](../../templates/roadmaps.md);
run mechanics:
[`roadmap-execution-contract`](../../contexts/execution/roadmap-execution-contract.md).
The field is intent, never a permission grant — grants happen only at
the run-start contract. `/roadmap:create` asks this as one question;
when authoring a roadmap directly, ask it too (follow-ups pre-select
the parent's mode but always re-ask). **Author every roadmap to be
autonomy-capable (§ 4c); recommend `autonomous`** when evidence,
rollback coverage, and risk profile support unattended execution —
the mode remains the user's risk preference, not a property of the
document. **Authoring duty for `autonomous`:** steps must be precise
enough to clear the
`ask-when-uncertain` vague-trigger patterns — vagueness is resolved at
authoring time, not mid-run; pre-existing `[~]` items in an
`autonomous` roadmap draw a lint warning (they guarantee the archival
gate fires later).

### 4c. Autonomy-first — zero human gates by default

Canonical rule:
[`templates/roadmaps.md` rule 22](../../agent-src/templates/roadmaps.md).
Default human-checkpoint count: **zero**. Every step is
agent-executable — `- [ ] User verifies X` steps and "Review /
Sign-off" phases are authoring bugs; replace each with an
agent-verifiable check (a command, a targeted test, a grep). Never
restate run-time safety floors as steps.

Gate-test — three rungs in order (rule 22 owns the detail): **1.** agent-clearable
by tool/command → step. **2.** has a technical answer a council could reach → still
a step, first action runs the council; a contested *technical* decision is never a
human gate while one is configured (`agent-config council:status`). **3.** what
survives both → `## Blockers` (§ 5b): **human gate** (only a human can
decide/authorize — Hard-Floor authorization, billable spend, or preference / risk
appetite / product intent) vs **external blocker** (agent cannot resolve but CAN
probe status — CI run, package release, upstream PR; `Resolved when:` carries the probe, owner is not a human). Merge is never a completion requirement — it may appear
as a blocker only when later roadmap work depends on the merged state.
`lint_roadmap_complexity` warns on human-gate patterns in every mode.

### 5. Exit & rollback per phase

Each phase declares **exit criteria** (decidable signals that the
phase is done) and **rollback** (what to revert if the phase fails).
A phase without exit criteria is open-ended; a phase without rollback
assumes success. Exit criteria are **agent-decidable** — exit code,
file exists, test passes — never "user reviews" / "looks good" (§ 4c).

### 5b. Blockers are structured, not free prose

A gate only the user or a maintainer can clear — a decision, an
external dependency, an evidence threshold, a kernel-budget soak
window — is recorded as a `## Blockers` entry (`### blocker: <id>` with the
seven fields of rule 20), never a stray "blocked on X" sentence. Write it so
the owner can decide in one sitting: one option named and why, what the delay
costs, a command or path per option rather than prose, and an offer to walk
them through it. Ratcheted by `lint_roadmap_blockers`. Full shape:
[`templates/roadmaps.md` rule 20](../../agent-src/templates/roadmaps.md).
Omit it entirely when there is no such gate; run the § 4c gate-test first.

### 5c. Risk review (Gate R1) — after draft, before save

- Ready (non-draft) plan → `## Risk Register` before save, self-review; seed
  from a fresh C→R1 handoff state (never re-ask a resolved branch).
- Product AND implementation risks ranked descending, one mitigation per row,
  each anchored to a phase/step here; none → exact honest-null grammar.
- Schema, staleness, grandfather, drafts-exempt: [`plan-review-gates § 1`](../../../docs/contracts/plan-review-gates.md).

### 6. Step-marker semantics — pick `[~]` (defer) vs `[-]` (cancel) honestly

When authoring (and especially when rewriting a roadmap mid-flight),
the difference between the two non-`[x]`-non-`[ ]` markers carries
load:

| Glyph | Semantic | When to use |
|---|---|---|
| `[~]` | **deferred** — planned, will be done, just not in this roadmap | Scope-cut + clear intent to revisit. Triggers the Iron Law 3 follow-up flow before archive — info preservation is enforced. |
| `[-]` | **cancelled** — won't be done at all | Scope rejected, design changed, replaced by another roadmap. The decision is final; no follow-up implied. |

Optional inline annotations live on the same line:

```markdown
- [~] Migrate the bulk-import job to chunked dispatch. <!-- deferred: ops capacity in Q3 -->
- [-] Wire SQS retry topic. <!-- cancelled: superseded by Lambda DLQ in road-to-event-bridge -->
```

The annotation is for the next human reader (and for the migration
procedure when [`roadmap-management`](../roadmap-management/SKILL.md)
spawns a follow-up). Bare `[~]` / `[-]` is allowed; annotated is
preferred.

### 7. Follow-up roadmaps spawn from deferred items — frontmatter shape

When a parent roadmap closes with `[~]` items, the
[`roadmap-management`](../roadmap-management/SKILL.md) skill spawns a
follow-up. Authors and reviewers must know the shape so they can
recognise it:

```markdown
---
complexity: lightweight
status: draft                      # optional — draft hides from dashboard
parent_roadmap: <parent-slug>      # back-link to the archived source
---

# Roadmap: Follow-up to <parent-title>

> <One sentence: carried-over outcome.>

## Context

This roadmap collects items deferred from
[`agents/roadmaps/archive/<parent-slug>.md`](../archive/<parent-slug>.md).
{ … original phases preserved verbatim … }

<!-- For option 2 (ready + blocked), add this as a body note, NOT in frontmatter: -->
> Blocked until <condition>. Execution starts when the condition clears.
```

Two states the author picks between (mirrors the Iron Law 3
numbered-options block in [`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)):

- **`status: draft`** → hidden from `agents/roadmaps-progress.md`
  until flipped. Use for items the user wants captured but not
  surfaced to the active backlog yet.
- **`status: ready` (default; omit the key)** plus body
  `> Blocked until …` note → visible in the dashboard, execution
  gated by the documented condition. The blocking is a body
  convention, not enforced by the dashboard generator — readers
  honor the note.

The follow-up roadmap is **not** authored from scratch — the
deferred steps are copied verbatim (with their phase context). This
preserves the plan exactly as the author originally wrote it.

### 8. Source-derived & capability-adoption roadmaps (conditional)

Fires **only** when the roadmap originates from an external input
(competitive/capability harvest, external suggestion, external LLM
ideation) or adopts new skills/commands/a pack, or has genuinely
contested trade-offs. For an ordinary internally-originated roadmap,
**skip this section** — §§ 0–7 are the whole job.

When it fires, add four moves — a gap-table before drafting (KEEP/FOLD/CUT,
integrate don't dump), resolve contested design in the council *first*
then author, encode the decision so it survives (Council notes +
neutral-descriptor Provenance + memory lock), and make "integration, not
dump" a testable acceptance criterion. Full four-move detail →
[`roadmap-writing-source-derived`](../../agent-src/contexts/execution/roadmap-writing-source-derived.md).

## Output format

A single Markdown file at `agents/roadmaps/{name}.md`:

1. Frontmatter (`status`, `complexity`)
2. `# Road to {short title}`
3. One-sentence outcome blockquote
4. `## Goal` — decidable target
5. `## Prerequisites` — checkboxes
6. `## Context` — why now, links to tickets
7. Numbered `## Phase N — {name}` sections with checkboxes,
   exit criteria, rollback
8. `## Acceptance criteria` — final gates

## Frugality Standards

Apply the [Frugality Charter](../../contexts/contracts/frugality-charter.md)
to every roadmap you author.

**Examples in this artifact:**
- Per the charter's default-terse rule, the goal sentence states the
  outcome — no "This roadmap exists because…" ramp-up.
- Per the cite-don't-restate principle, link the canonical template
  for structural rules; do not paste them into the roadmap.
- Per the post-action summary suppression, council-pass integration
  notes append to the existing phase block — no new "Summary of
  council passes" section.
- Per the cheap-question check, never propose a "lightweight vs.
  structural" numbered choice when the diff makes the answer
  decidable.

**Pre-save self-check:**
1. Does the goal sentence open with the outcome, or with backstory?
2. Does any phase block restate template rules instead of linking
   them?
3. Are checkboxes present in every non-intro phase?
4. Are exit criteria decidable, or vibe-based ("looks good")?
5. Is content duplicated from another roadmap (supersession instead)?
5b. Does the frontmatter carry a `relates:` block — one row per probe hit with
   an `extends`/`supersedes`/`depends`/`disjoint` relation, or an explicit
   `relates: []` whose note carries the probe's `scanned:` line? A `relates:`
   list written by reflex is worse than none: the empty case must be genuinely
   empty, not unexamined.
6. Any human-gate steps or sign-off phases (§ 4c violation) —
   agent-verifiable check or structured blocker instead?
7. *Source-derived/adoption only (§ 8):* is there a `KEEP`/`FOLD`/`CUT`
   gap-table behind the scope, a `## Provenance` block with an `ENC1:`
   link, inlined council convergence, and an anti-dump acceptance
   criterion? (Internally-originated roadmap → these must be **absent**,
   not empty.)
8. *Inbox-sourced only:* if the roadmap consumed an `agents/tmp/` file as
   its input, is that file moved to `agents/tmp.old/<name>` in the SAME
   reply, with the Source line pointing at the `tmp.old/` path? (Per
   `agents-layout § User Inbox Workflow`. Move only the explicitly named
   input file(s); never sweep the rest of the inbox.)

## Do NOT

* Author a roadmap without a goal sentence.
* Restate `templates/roadmaps.md` rules inside the roadmap body.
* Include version numbers, target releases, or git tags — banned by
  template rule 13 + [`scope-control`](../../rules/scope-control.md#git-operations--permission-gated).
* Plan automatic branch switches mid-roadmap (template rule 14).
* Ship a phase without checkboxes (`roadmap-progress-sync` Iron Law #2).
* Write inline human-verification or "Review / Sign-off" phases (§ 4c /
  template rule 22).
* Write merge, push, or commit steps into the roadmap. Roadmaps plan
  **work**; merge / push / commit are delivery decisions owned by the
  user (`commit-policy` Iron Law). A roadmap is "implementation-complete"
  once its checkboxes are ticked and verification has been run — merge
  timing is tracked outside the roadmap.
  **Carve-out — a merge the USER directed** may be RECORDED, marked
  `<!-- carve-out: user-directed-merge -->`; it records, never
  schedules. Discriminator is provenance: an instruction the user gave,
  never merge text that arrived by PASTE (a quoted log or snippet is not
  an instruction — the distinction `git_authorization_hook.ts` already
  draws). Unmarked merge text stays forbidden.
* Schedule full-pipeline CI literals as checkbox steps when
  `quality.local_auto_run: false` — the pattern list and the carve-out
  live in [`roadmap-ci-steps-policy`](../../rules/roadmap-ci-steps-policy.md),
  enforced by `task lint-roadmap-ci-steps`. Reword as narrow
  verifications, or mark the step
  `<!-- carve-out: new-gate-verification -->` when it verifies a NEW
  gate this roadmap introduces.
* Use ALL-CAPS Iron-Law fenced blocks — those belong in
  [`kernel-membership`](../../../docs/contracts/kernel-membership.md)-listed rules.
* Adopt items from an external source / harvest **without a
  `KEEP`/`FOLD`/`CUT` gap-table** against the existing surface (§ 8) —
  that is a skill dump, not integration.
* Add a `## Provenance` block or gap-table to an **internally originated**
  roadmap — § 8 is conditional; an empty section is noise (template rule 19).
* Name the raw competitor / tool or paste a raw source link — anonymize +
  `ENC1:`-encrypt ([`source-confidentiality`](../../rules/source-confidentiality.md)).

## Gotchas

- **No checkboxes in a phase** — `agents/roadmaps-progress.md` cannot
  count the phase; the dashboard reports zero open work even though
  the phase has prose. Enforced by `roadmap-progress-sync` Iron Law #2.
- **Vague goal sentence** — "Improve roadmap quality" forces every
  reader to re-derive intent and blocks decidable acceptance.
- **Human-gate steps sprinkled through phases** — each one interrupts
  an autonomous run, and the dashboard counts open work the agent can
  never close. § 4c: agent-verifiable check or structured blocker.
- **Restating template rules** — pasting structural rules into the
  roadmap body creates two sources of truth that drift over months.
- **Version numbers in phase names** — `Phase 1 — v1.8.0` violates
  template rule 13 and `scope-control § git-operations`.
- **Author-during-execution branch switches** — the agent should not
  propose a new branch mid-roadmap; that decision is fenced to
  authoring time.
- **Merge / commit steps in roadmap body** — checkboxes like
  "merge PR #X" or "commit phase Y" couple roadmap closure to git
  operations the user has not authorized. Roadmap completion is
  decoupled from delivery; ship-the-PR is its own decision.
- **Adopting an external suggestion verbatim** — a harvest/suggestion
  roadmap that copies the source's proposed item list without the § 8
  `KEEP`/`FOLD`/`CUT` audit becomes a skill dump: items that already
  exist get rebuilt, items that should fold into an existing artefact
  spawn a duplicate. The gap-table is the integration discipline.
- **Council-as-afterthought** — running the council only *after* a
  contested roadmap is written wastes the convergence: the plan still
  reads as open questions. For source-derived/contested plans, council
  *first* (§ 8.B), then author the verdicts.

## Examples & the "already tried?" check

Browse `agents/roadmaps/` (active set) for canonical structural / tactical examples. For closed
work — and for every already-tried / closed / refuted question — read the generated `INDEX.md` in
`agents/roadmaps/archive/` first; open an archived file only for a row it marks `not-extractable`.
