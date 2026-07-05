# Roadmap Template

Templates for roadmap files stored in `agents/roadmaps/` or `{module_root}/{Module}/{agent_folder}/roadmaps/` (resolved via `modules.root_paths` + `modules.agent_folder` in `.agent-project-settings.yml`; Laravel example: `app/Modules/{Module}/agents/roadmaps/`).

---

## Rules for Roadmaps

1. **Be precise and concise.** Aim for 500–1000 lines max. If larger, split into multiple files.
2. **Checkboxes are mandatory, not decorative.** Every active roadmap MUST contain at least one `- [ ]` per non-intro phase. Decision tables, ICE matrices, and block-sequencing tables capture the *why*; checkboxes capture the *what to do next*. A roadmap without checkboxes is invisible to `agents/roadmaps-progress.md` — the dashboard cannot count it, the next reader thinks no work is planned. Enforced by [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md) Iron Law #2.
   - **Glyph semantics:** `[ ]` open · `[x]` done · `[~]` **deferred** (planned for later — blocks silent archive per `roadmap-progress-sync` Iron Law 3) · `[-]` **cancelled** (won't do — explicit drop). Pick `[~]` vs `[-]` honestly; former carries follow-up-roadmap obligations, latter does not. Optional inline annotations: `<!-- deferred: reason -->` / `<!-- cancelled: reason -->` on same line.
   - **Status is binary: `ready` (default) or `draft`.** New roadmaps are created **ready** unless the user explicitly says draft — `ready` is implicit and need not be written. Drafts declare it via frontmatter at the top of the file (`---\nstatus: draft\n---`) and are hidden from the dashboard until the flag is removed or flipped to `ready`. Use `draft` while the roadmap is still being authored, while waiting for upstream decisions, as a capture-only synthesis that has not been promoted to executable phases, or as a follow-up roadmap (see rule 17 below) that is not yet ready to surface. There are no other status values; legacy banners like `**Status: directional**` are removed.
3. **State the goal first.** One sentence at the top — what is the outcome?
4. **List prerequisites** — what must exist or be running before starting.
5. **Reference existing code** — point to files, classes, or modules.
6. **Define acceptance criteria** — how do we know the task is done?
7. **Include quality gates** — which commands must pass.
8. **Language:** All roadmap files must be written in **English**.
9. **Improve on read:** When processing a roadmap, check if it follows this template and suggest
   improvements if it doesn't.
10. **Keep docs up to date:** If changes affect documented behavior, update the relevant agent docs.
11. **One task per file.** Don't combine unrelated work.
12. **Lifecycle:** Every roadmap ends in exactly one folder:
    - `agents/roadmaps/` — active (in progress or planned **and workable now**)
    - `agents/roadmaps/archive/` — work happened (fully or partially); no further work planned
    - `agents/roadmaps/skipped/` — decision against pursuit; typically 0 items `[x]` (superseded, scope rejected)
    - `agents/roadmaps/later/` — open work remains but is **blocked-for-later** (gated on an external trigger or a decision); **will resume**. Set `status: later` + a `Blocked until` / `Trigger` line. Roadmaps with open tasks deferred for later are **always** moved here, never left active. Excluded from the dashboard and `/roadmap:process-*`; enforced by `lint_roadmap_later_disposition`.

    See the `roadmap-management` skill for the exact trigger matrix and user-confirmation flow.
13. **No tags, releases, or version numbers.** Roadmaps describe work, not shipping.
    Never assign version suffixes to phases (`Phase 1 — v1.8.0`), never write
    "Target release: X.Y.Z", never plan git tags or deprecation dates. Release
    and tag decisions belong to the user and are taken outside the roadmap.
    This is enforced by [`scope-control`](../rules/scope-control.md#git-operations--permission-gated).
14. **No automatic branch switches mid-roadmap.** Roadmap work runs on the
    branch the user is on. If a separate branch (spike, hotfix, experiment)
    would be genuinely useful, the agent may propose it **once** while
    creating the roadmap — not during execution. Default: stay on the
    current branch. If the user declines, the topic is closed for this
    roadmap. See [`scope-control`](../rules/scope-control.md#decline--silence--no-re-asking-on-the-same-task).
15. **Declare complexity tier.** Every roadmap declares
    `complexity: lightweight` or `complexity: structural` in frontmatter.
    Lightweight (default): ≤ 6 phases, ≤ 600 lines, no nested council
    debates inside the roadmap. Structural (rare, opt-in): contract-layer
    or budget-invariant changes; multi-round council, file-ownership
    matrices, > 600 lines. Enforced by `task lint-roadmap-complexity`.
    Standard: [`docs/contracts/roadmap-complexity-standard.md`](../docs/contracts/roadmap-complexity-standard.md).
16. **Time-boxed plates / visible-horizon sections — opt-in via
    `roadmap.horizon_weeks` in `.agent-settings.yml`.** Default is `0`
    (off): roadmaps describe scope and phase ordering, not week-by-week
    commitments. With the default, do **not** add `## Horizon (N-week
    visible plate)` sections, "Inside / outside the plate" framings,
    `In-plate?` columns in decision tables, or `**Out-of-plate.**` /
    `**Out-of-horizon.**` / `(out-of-horizon, gated on Phase N)`
    suffixes on steps or phase headers. AI execution does not operate
    on calendar plates by default; scope ordering and dependency gates
    are sufficient. Pacing is the user's call, decided per turn —
    never encoded into the plan unless they have explicitly set
    `horizon_weeks` to a positive integer. Enforced by
    `task lint-roadmap-complexity` (plate-token detection skipped when
    `horizon_weeks > 0`).
17. **Follow-up roadmaps from deferred items carry `parent_roadmap`.**
    When a roadmap closes with `[~]` deferred items,
    [`roadmap-management`](../skills/roadmap-management/SKILL.md) skill
    spawns a follow-up under `agents/roadmaps/road-to-<parent>-followup.md`.
    Follow-up's frontmatter declares back-link:
    ```yaml
    ---
    complexity: lightweight
    status: draft               # optional — hides from dashboard
    parent_roadmap: <parent-slug>
    ---
    ```
    Follow-up's body opens with `## Context` block citing
    `agents/roadmaps/archive/<parent>.md`. Deferred steps copied
    **verbatim** (with original phase context) so plan survives
    migration. If follow-up is "ready but blocked" rather than draft,
    omit `status:` and add body note `> Blocked until <condition>` —
    dashboard surfaces roadmap, readers honor body convention.
    Authoring contract: [`roadmap-writing § 7`](../skills/roadmap-writing/SKILL.md);
    spawn procedure: [`roadmap-management § Spawn follow-up`](../skills/roadmap-management/SKILL.md).
18. **Declare execution mode.** Every roadmap MAY declare how it
    should be executed by `/roadmap:process-*` via frontmatter:
    ```yaml
    execution:
      mode: autonomous        # autonomous | phase-checkpoints | interactive
    ```
    - `interactive` (default when field absent) — today's behavior:
      every gate fires as authored by its owning rule.
    - `phase-checkpoints` — run halts at each phase boundary with a
      compact status + continue prompt; inside a phase behaves like
      `autonomous`.
    - `autonomous` — at run start loop derives an **execution
      contract** (see
      [`roadmap-execution-contract`](../contexts/execution/roadmap-execution-contract.md))
      and ONE confirmation activates all run grants; run then proceeds
      without interruptions except safety floors.

    Field is a **declaration of intent, not a permission grant** —
    permissions granted only by user's this-turn acceptance of the
    run-start execution contract. Frontmatter never lifts a Hard
    Floor, never authorizes a merge, never substitutes for contract
    confirmation. Unknown values rejected by roadmap lint. Follow-up
    roadmaps (rule 17) inherit parent's mode as *suggested* option
    during creation but question always asked again.
19. **Source-derived roadmaps carry a gap-table + provenance; internally
    originated roadmaps carry neither.** Fires **only** when a roadmap
    originates from an external input (suggestion, competitive/capability
    harvest, external LLM ideation thread) or adopts external capabilities
    into the suite. Does **not** fire for ordinary internally-originated
    roadmaps — those add no Provenance block, no gap-table ritual. When it
    fires:
    - **(a) Gap-table before drafting.** Audit each proposed item against
      the existing skill / command / rule surface; keep only verified gaps
      — `KEEP` (genuine gap) / `FOLD` (into existing artefact) / `CUT`
      (already covered). Plan integrates, doesn't dump.
    - **(b) `## Provenance` block** — source by a **neutral descriptor**
      (never the raw competitor / tool name, per
      [`source-confidentiality`](../rules/source-confidentiality.md));
      retain the real link as an `ENC1:` token via
      `src/scripts/_lib/link_crypto.ts encrypt --value <url>`.
    - **(c) Council convergence inlined** with date + members — never a
      session filepath ([`no-roadmap-references`](../rules/no-roadmap-references.md)).
    Authoring contract:
    [`roadmap-writing § 8`](../skills/roadmap-writing/SKILL.md).

---

## Quality Gates (always apply at completion)

Every roadmap must pass the project's quality pipeline before it is
considered done. **When** the pipeline runs during
`/roadmap:process-step|phase|full` is governed by
`roadmap.quality_cadence` in `.agent-settings.yml`
(`end_of_roadmap` default → once before archival; `per_phase` → after
every phase; `per_step` → after every step). Either way, a final fresh
run is mandatory before "complete" per `verify-before-complete`.

Common commands:

```bash
# PHP projects (inside Docker container if applicable)
vendor/bin/phpstan analyse           # Static analysis
vendor/bin/rector process            # Auto-fix refactoring
vendor/bin/ecs check --fix           # Auto-fix code style
php artisan test                     # Tests (or: vendor/bin/phpunit)

# Non-Laravel projects — check Makefile/Taskfile for quality commands
```

Check `AGENTS.md` or `Makefile` / `Taskfile.yml` for the exact commands.

### CI-step gate (when `quality.local_auto_run: false`)

Roadmaps **must not** schedule full-pipeline literals (`task ci`,
`task ci-fast`, `task ci-strict`, `make ci`, `make test`,
`npm/pnpm run check`, `yarn check`, `composer test`, whole-suite
`vendor/bin/phpunit`, whole-suite `php artisan test`) as checkbox
steps when `quality.local_auto_run` is `false` in
`.agent-settings.yml` — `task lint-roadmap-ci-steps` blocks them.
Reword as narrow verifications (`vendor/bin/phpstan analyse
app/Modules/X`, `php artisan test --filter=…`) or mark with
`<!-- carve-out: new-gate-verification -->` when the step verifies a
**new** gate this roadmap introduces. At execution,
`/roadmap:process-*` flips matching steps to `[-]` with reason and
skips them. Full contract:
[`roadmap-ci-steps-policy`](../rules/roadmap-ci-steps-policy.md).

---

## Template

Copy the structure below into a new file:

```markdown
---
complexity: lightweight
---

# Roadmap: {Short descriptive title}

> {One sentence: What is the expected outcome?}

## Prerequisites

- [ ] Read `AGENTS.md` and relevant module docs
- [ ] {specific prerequisites}

## Context

{Why this roadmap exists. Which module/domain. Links to Jira tickets and feature plans.}

- **Feature:** {path to feature plan or "none"}
- **Jira:** {ticket links or "none"}

## Phase 1: {Phase name}

- [ ] **Step 1:** {Clear, actionable instruction}
- [ ] **Step 2:** {Next step — reference files/classes}
- [ ] ...

## Phase 2: {Phase name}

- [ ] **Step 1:** {description}
- [ ] ...

## Acceptance Criteria

- [ ] {Observable, testable criterion}
- [ ] All quality gates pass (PHPStan, Rector, tests)

## Notes

{Optional: edge cases, decisions, links to related docs.}

<!-- ## Provenance — INCLUDE ONLY for source-derived / harvest / capability-adoption
     roadmaps (rule 19). OMIT entirely for internally-originated roadmaps —
     do NOT ship an empty Provenance section.
- Source: <neutral descriptor> (anonymized per source-confidentiality);
  link via `src/scripts/_lib/link_crypto.ts decrypt`: ENC1:<token>
- Council: <members>, <date>, <depth>; convergence inlined above. -->
```

---

## Tips

- **Don't describe architecture** the agent can read from `AGENTS.md` — just reference it.
- **Don't repeat coding standards** — they live in `.github/copilot-instructions.md`.
- **Do reference specific files:** "See `app/Modules/Import/App/Services/ImportService.php`"
  is better than "look at the import service."
- **Do define boundaries:** State what the agent should NOT touch or change.
- **Do include example inputs/outputs** for non-obvious behavior.
- **Do split large tasks** — an agent works better with a focused 500-line file than a sprawling 2000-line one.
- **One task per file.** Don't combine unrelated work.

