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
  will land inside an existing roadmap

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
rule. Inspect existing roadmaps under `agents/roadmaps/` for overlap
or supersession before opening a new one.

### 1. Read the canonical template first

The structure, frontmatter, lifecycle, and complexity-tier rules live
in [`.agent-src.uncondensed/templates/roadmaps.md`](../../templates/roadmaps.md).
Read it before authoring. Do not restate its rules in the roadmap
body — link the template if a phase needs to override one.

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

### 4. Phase blocks carry checkboxes

Every non-intro phase contains at least one `- [ ]`. Decision tables
and council-pass notes capture the *why*; checkboxes capture the
*what to do next*. Without checkboxes the phase is invisible to
`agents/roadmaps-progress.md` — enforced by
[`roadmap-progress-sync`](../../rules/roadmap-progress-sync.md)
Iron Law #2.

### 5. Exit & rollback per phase

Each phase declares **exit criteria** (decidable signals that the
phase is done) and **rollback** (what to revert if the phase fails).
A phase without exit criteria is open-ended; a phase without
rollback assumes success.

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

This section fires **only** when the roadmap originates from an
external input or adopts capabilities into the suite:

- a competitive / capability harvest, an external suggestion, or an
  external LLM ideation thread, **or**
- a decision to integrate/adopt new skills, commands, or a pack, **or**
- a plan whose design has genuinely contested, not-yet-resolved
  trade-offs.

For an ordinary internally-originated roadmap, **skip this section** —
§§ 0–7 are the whole job. Do not bolt a Provenance block or a
gap-table onto a plan that needs neither (template rule 18).

When it fires, add these four moves to the §§ 0–7 procedure:

**A. Gap-table before drafting (don't adopt — integrate).** Audit each
proposed item against the *existing* skill / command / rule surface and
classify it `KEEP` (verified gap), `FOLD` (into a named existing
artefact), or `CUT` (already covered). Only `KEEP` items become
roadmap scope; `FOLD`/`CUT` are recorded so the cut is auditable. A
negative grep is not proof — open the nearest existing artefacts (per
[`think-before-action`](../../rules/think-before-action.md) and, for an
external source, [`external-reference-deep-dive`](../../rules/external-reference-deep-dive.md)).

**B. Resolve contested design in the council *first*, then author.**
The default council flow (`/roadmap:ai-council`) *challenges a finished
roadmap*. For a contested or source-derived plan, run the council
**up front** on the design questions (`/council:design`, or the
[`ai-council`](../ai-council/SKILL.md) skill), converge, **then** write
the roadmap encoding the verdicts — so the plan ships already-decided,
not as open questions in prose. One run, converge; do not relitigate.

**C. Encode the decision so it survives.**
- Inline council convergence under a `## Council notes (<date>, <depth>)`
  block — members + date, **never** a session filepath
  ([`no-roadmap-references`](../../rules/no-roadmap-references.md)).
- Add a `## Provenance` block — source by a **neutral descriptor**
  (never the raw competitor/tool name,
  [`source-confidentiality`](../../rules/source-confidentiality.md));
  retain the real link as an `ENC1:` token via
  `src/scripts/_lib/link_crypto.ts encrypt --value <url>`.
- Save the locked decision to memory (project type, "don't relitigate")
  so a future session does not re-derive it.

**D. Make "integration, not dump" a testable acceptance criterion.**
The AC must encode the anti-dump litmus, decidably: visible commands
within the pack's `size_class` budget; each new visible command reuses
≥ 2 existing skills; no new artefact duplicates an existing one;
governance preflight recorded — `domain-adoption-policy` (does it open a
new domain?), `persona-governance` (new personas?),
`framework-neutrality`, `size-enforcement` — with the disposition
stated in the roadmap.

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
6. *Source-derived/adoption only (§ 8):* is there a `KEEP`/`FOLD`/`CUT`
   gap-table behind the scope, a `## Provenance` block with an `ENC1:`
   link, inlined council convergence, and an anti-dump acceptance
   criterion? (Internally-originated roadmap → these must be **absent**,
   not empty.)

## Do NOT

* Author a roadmap without a goal sentence.
* Restate `templates/roadmaps.md` rules inside the roadmap body.
* Include version numbers, target releases, or git tags — banned by
  template rule 13 + [`scope-control`](../../rules/scope-control.md#git-operations--permission-gated).
* Plan automatic branch switches mid-roadmap (template rule 14).
* Ship a phase without checkboxes (`roadmap-progress-sync` Iron Law #2).
* Write merge, push, or commit steps into the roadmap. Roadmaps plan
  **work**; merge / push / commit are delivery decisions owned by the
  user (`commit-policy` Iron Law). A roadmap is "implementation-complete"
  once its checkboxes are ticked and verification has been run — merge
  timing is tracked outside the roadmap.
* Schedule full-pipeline CI literals (`task ci`, `task ci-fast`,
  `task ci-strict`, `make ci`, `make test`, `npm/pnpm run check`,
  `yarn check`, `composer test`, whole-suite `vendor/bin/phpunit`,
  whole-suite `php artisan test`) as checkbox steps when
  `quality.local_auto_run: false` — blocked by
  `task lint-roadmap-ci-steps` per
  [`roadmap-ci-steps-policy`](../../rules/roadmap-ci-steps-policy.md).
  Reword as narrow verifications, or mark the step with
  `<!-- carve-out: new-gate-verification -->` when it verifies a NEW
  gate this roadmap introduces.
* Use ALL-CAPS Iron-Law fenced blocks — those belong in
  [`kernel-membership`](../../../docs/contracts/kernel-membership.md)-listed
  rules, not roadmaps.
* Adopt items from an external source / harvest **without a
  `KEEP`/`FOLD`/`CUT` gap-table** against the existing surface (§ 8) —
  that is a skill dump, not integration.
* Add a `## Provenance` block (or gap-table) to an **internally
  originated** roadmap — § 8 is conditional; an empty Provenance section
  is noise (template rule 18).
* Name the raw competitor / tool in a tracked roadmap, or paste a raw
  source link — anonymize + `ENC1:`-encrypt
  ([`source-confidentiality`](../../rules/source-confidentiality.md)).

## Gotchas

- **No checkboxes in a phase** — `agents/roadmaps-progress.md` cannot
  count the phase; the dashboard reports zero open work even though
  the phase has prose. Enforced by `roadmap-progress-sync` Iron Law #2.
- **Vague goal sentence** — "Improve roadmap quality" forces every
  reader to re-derive intent and blocks decidable acceptance.
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

## Examples

Browse `agents/roadmaps/` (active set) and `agents/roadmaps/archive/`
(closed work) for canonical structural / tactical / structural-with-council
examples.
