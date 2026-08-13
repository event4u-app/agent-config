# Roadmap Template

Templates for roadmap files stored in `agents/roadmaps/` or `{module_root}/{Module}/{agent_folder}/roadmaps/` (resolved via `modules.root_paths` + `modules.agent_folder` in `.agent-project-settings.yml`; Laravel example: `app/Modules/{Module}/agents/roadmaps/`).

---

## Rules for Roadmaps

1. **Be precise and concise.** Lightweight default: ≤ 600 lines (see rule 15). Only a declared `complexity: structural` roadmap may exceed that, capped at 1000 lines — if larger, split into multiple files.
2. **Checkboxes are mandatory, not decorative.** Every active roadmap MUST contain at least one `- [ ]` per non-intro phase. Decision tables, ICE matrices, and block-sequencing tables capture the *why*; checkboxes capture the *what to do next*. A roadmap without checkboxes is invisible to `agents/roadmaps-progress.md` — the dashboard cannot count it, the next reader thinks no work is planned. Enforced by [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md) Iron Law #2.
   - **Glyph semantics:** `[ ]` open · `[x]` done · `[~]` **deferred** (planned for later — blocks silent archive per `roadmap-progress-sync` Iron Law 3) · `[-]` **cancelled** (won't do — explicit drop). Pick `[~]` vs `[-]` honestly; the former carries follow-up-roadmap obligations, the latter does not. Optional inline annotations: `<!-- deferred: reason -->` / `<!-- cancelled: reason -->` on the same line.
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
    When a roadmap closes with `[~]` deferred items, the
    [`roadmap-management`](../skills/roadmap-management/SKILL.md) skill
    spawns a follow-up under `agents/roadmaps/road-to-<parent>-followup.md`.
    The follow-up's frontmatter declares the back-link:
    ```yaml
    ---
    complexity: lightweight
    status: draft               # optional — hides from dashboard
    parent_roadmap: <parent-slug>
    ---
    ```
    The follow-up's body opens with a `## Context` block citing
    `agents/roadmaps/archive/<parent>.md`. Deferred steps are copied
    **verbatim** (with their original phase context) so the plan
    survives the migration. If the follow-up is "ready but blocked"
    rather than draft, omit `status:` and add a body note
    `> Blocked until <condition>` — the dashboard surfaces the
    roadmap, readers honor the body convention. Authoring contract:
    [`roadmap-writing § 7`](../skills/roadmap-writing/SKILL.md);
    spawn procedure: [`roadmap-management § Spawn follow-up`](../skills/roadmap-management/SKILL.md).
18. **Declare the execution mode.** Every roadmap MAY declare how it
    should be executed by `/roadmap:process-*` via frontmatter:
    ```yaml
    execution:
      mode: autonomous        # autonomous | phase-checkpoints | interactive
    ```
    - `interactive` (default when the field is absent) — today's behavior:
      every gate fires as authored by its owning rule.
    - `phase-checkpoints` — the run halts at each phase boundary with a
      compact status + continue prompt; inside a phase it behaves like
      `autonomous`.
    - `autonomous` — at run start the loop derives an **execution
      contract** (see
      [`roadmap-execution-contract`](../contexts/execution/roadmap-execution-contract.md))
      and ONE confirmation activates all run grants; the run then
      proceeds without interruptions except the safety floors.

    The field is a **declaration of intent, not a permission grant** —
    permissions are granted only by the user's this-turn acceptance of
    the run-start execution contract. Frontmatter never lifts a Hard
    Floor, never authorizes a merge, and never substitutes for the
    contract confirmation. Unknown values are rejected by the roadmap
    lint. Follow-up roadmaps (rule 17) inherit the parent's mode as the
    *suggested* option during creation but the question is always asked
    again.
19. **Source-derived roadmaps carry a gap-table + provenance; internally
    originated roadmaps carry neither.** This rule fires **only** when a
    roadmap originates from an external input (a suggestion, a competitive
    or capability harvest, an external LLM ideation thread) or adopts
    external capabilities into the suite. It does **not** fire for ordinary
    internally-originated roadmaps — those add no Provenance block and no
    gap-table ritual. When it fires:
    - **(a) Gap-table before drafting.** Audit each proposed item against
      the existing skill / command / rule surface and keep only verified
      gaps — `KEEP` (genuine gap) / `FOLD` (into an existing artefact) /
      `CUT` (already covered). The plan integrates, it does not dump.
    - **(b) `## Provenance` block** — source named by a **neutral
      descriptor** (never the raw competitor / tool name, per
      [`source-confidentiality`](../rules/source-confidentiality.md));
      retain the real link as an `ENC1:` token via
      `src/scripts/_lib/link_crypto.ts encrypt --value <url>`.
    - **(c) Council convergence inlined** with date + members — never a
      session filepath ([`no-roadmap-references`](../rules/no-roadmap-references.md)).
    Authoring contract:
    [`roadmap-writing § 8`](../skills/roadmap-writing/SKILL.md).
20. **Blockers are structured, not free prose.** When a roadmap has a
    gate that only the user (or a maintainer) can clear — a decision,
    an external dependency, an evidence threshold, a kernel-budget soak
    window — record it as a `## Blockers` entry, not a stray sentence.
    Shape (one entry per blocker):
    ```markdown
    ## Blockers

    ### blocker: <kebab-id>
    - **Status:** open            <!-- open | resolved -->
    - **Owner:** user             <!-- user | maintainer | external -->
    - **Blocks:** Phase N — {phase name}
    - **What to do:**
      1. {Concrete, copy-pasteable step the owner must execute.}
      2. {Include commands, file paths, and expected outcomes.}
    - **Resolved when:** {decidable signal, e.g. "task X exits 0"}
    ```
    `### blocker: <id>` is the parse anchor the dashboard generator
    reads; ids are unique within the roadmap. All five fields are
    required. A cleared blocker flips `Status: resolved` (kept for
    history) instead of being deleted — the resolve-flip runs in the
    same reply as the checkbox flip that cleared it, per
    [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md). A
    step gated by a specific blocker may cross-reference it inline:
    `- [ ] … <!-- blocked-by: <blocker-id> -->`.

    **Legacy fallback.** A body-level `> Blocked until <condition>`
    note (the follow-up-roadmap convention from rule 17) is parsed by
    the dashboard generator as one implicit roadmap-level blocker
    (`Owner: user`, instructions = the note text) — existing roadmaps
    surface in the dashboard's `Blocker` column without retrofit.
    New roadmaps should prefer the structured form above; it renders
    richer instructions in the per-roadmap breakdown.

21. **Related roadmaps share a common filename prefix.** When you create
    more than one roadmap that belongs together — a follow-up, a set of
    siblings split from one body of work in a single pass, or phases of
    one initiative carved into separate files — give them a shared
    `road-to-<family>-…` prefix so the relationship is visible on sight
    in `agents/roadmaps/` and the dashboard groups them. `<family>` is a
    short kebab slug naming the shared initiative; the suffix
    distinguishes the members:
    - **Split-in-one-pass siblings** → `road-to-<family>-<part>.md`
      (e.g. `road-to-auth-hardening-backend.md`,
      `road-to-auth-hardening-frontend.md`,
      `road-to-auth-hardening-infra.md`).
    - **Follow-ups** → `road-to-<parent>-followup.md` (rule 17) is the
      special case where `<parent>` is the family prefix; keep the
      `parent_roadmap:` back-link.
    - **Sibling (non-parent/child) roadmaps** carry no `parent_roadmap:`;
      the shared prefix is the only linkage — do **not** invent a new
      frontmatter field for it. Cross-link siblings by name in each
      `## Context` block when it helps a reader.
    Pick the `<family>` slug **once, up front**, before writing the first
    of the set — renaming a prefix later means migrating inbound
    references. A lone roadmap with no siblings keeps the plain
    `road-to-<slug>.md` form; the convention fires only when ≥2 related
    roadmaps are created together or as a follow-up chain.

22. **Human gates are the exception — author for autonomous execution.**
    A roadmap exists to be worked through without stopping; every human
    checkpoint interrupts that. Default number of human gates in a
    roadmap: **zero**.
    - Every step is **agent-executable**. `- [ ] User verifies X`,
      `- [ ] Manually check Y`, and dedicated "Review / Sign-off" phases
      are authoring bugs — replace them with an agent-verifiable check
      (a command, a targeted test, a grep) or delete them.
    - Exit and acceptance criteria are **agent-decidable** signals (a
      command exit code, a file that exists, a test that passes) — never
      "user approves", "looks good", or "sign-off".
    - A **human gate** is allowed only when only a human can **decide or
      authorize**: a Hard-Floor action (deploy, prod data/infra),
      billable spend, or a decision bound to the user's own preference,
      risk appetite, or product intent.
    - A **contested technical decision is not a human gate while a
      council is configured.** Which design is sound, whether a contract
      still holds, which of N implementations to pick — these have
      technical answers, and `decision_resolution` already classes a
      contract or architecture change as `medium_impact → council`
      (`docs/contracts/ai-council-config.md`). Authoring them as human
      gates contradicts that classification and spends the user's
      attention on a question the council answers. Run it, record the
      verdict in the phase, and the gate becomes a step.
      `agent-config council:status` says whether one is configured —
      never infer it from the project tree (`council-availability`).
      Record a genuine gate as a structured `## Blockers` entry
      (rule 20) — never as an inline checkbox step scattered through
      phases.
    - An **external dependency is a blocker, not a human gate**, whenever
      the agent can probe its status (CI run finished, package version
      published, upstream PR merged, API reachable, DNS propagated):
      record it as a blocker whose `Resolved when:` names the
      agent-checkable probe (command / URL / query) — do not assign it
      to a human.
    - **Merge is never a completion requirement.** A roadmap is
      implementation-complete once its checkboxes are ticked and
      verification ran; delivery stays the user's call (no merge / push /
      commit steps, per `commit-policy`). Merge may appear as a blocker
      only when later roadmap work technically depends on the merged
      state.
    - Do **not** restate safety floors as steps. `non-destructive-by-default`,
      `security-sensitive-stop`, and `commit-policy` fire at run time on
      their own; an authored "STOP: confirm with user before X" duplicates
      them and only adds interruptions.
    Gate-test before writing any checkpoint, asked in this order:
    1. *"Could the agent clear this with a tool or command during the
       run?"* Yes → it is a step, not a gate.
    2. *"Does it have a technical answer a council could reach?"* Yes →
       it is a step whose first action runs the council.
    3. Only what survives both — preference, risk appetite, product
       intent, authorization, spend — becomes a structured blocker with
       a decidable `Resolved when:`, owned by a human.
    Stopping at question 1 is the authoring bug this ordering exists to
    prevent: it sends every decision the agent cannot compute straight to
    the user, including the ones the council exists to answer.
    `task lint-roadmap-complexity` warns on human-gate step patterns,
    human-gate phase headings, and human-approval exit criteria.

23. **Optional `verify:` step-field — machine-checkable flip.** A
    behavior-changing step MAY carry a named verification command on its
    own inline-annotation line, e.g.
    `- [ ] Add the tenant-scope guard <!-- verify: task test -- --filter=TenantScopeTest -->`.
    When a step declares one, `/roadmap:process-*` will not accept its
    `[x]` flip without a **fresh green run of that exact command** in the
    same run (enforced by the flip-guard, see
    [`roadmap-process-loop § 5b`](../contexts/execution/roadmap-process-loop.md)).
    This is the machine-checkable tightening of rule 22's agent-decidable
    signals — bind it on **behavior-changing** steps (a new guard, a
    migration, a wired endpoint); doc-only / prose steps leave it off and
    stay governed by the ordinary flip-guard. Keep the command **narrow**
    (a targeted test / grep / build of the touched surface), never the
    full CI pipeline — per `roadmap-ci-steps-policy` a `verify:` must not
    be a full-suite gate.

24. **Ready roadmaps carry a `## Risk Register` (Gate R1).** Every
    ready (non-draft) roadmap ends with a schema-valid Risk Register —
    marker line (`<!-- risk-review: v1 | reviewed: YYYY-MM-DD |
    reviewer: <id> -->`), ranked rows (most → least risky), a
    `Mitigation` and an in-document `Anchored under` reference per row.
    No material risks → the **exact** honest-null grammar; a bare "no
    risks" sentence fails. Schema, staleness rule, and the grandfather
    clause for pre-gate roadmaps:
    [`plan-review-gates § 1`](../../docs/contracts/plan-review-gates.md).
    `status: draft` roadmaps are exempt until flipped to ready. Enforced
    by `lint_plan_risk_register` at pre-push + CI.

25. **`## Pre-mortem` is optional — and only worth having when it is a
    forecast.** A roadmap MAY carry a `## Pre-mortem` section holding the
    four-part failure register from the
    [`premortem`](../skills/premortem/SKILL.md) skill (three ranked causes
    of death · one untested hidden dependency · one survivable-failure
    modification · one tripwire metric with a horizon). It is deliberately
    NOT required: a failure register written to satisfy a template stops
    being a forecast, and boilerplate in a failure register is worse than
    its absence. Include it when the plan is heavy or irreversible enough
    that a named tripwire changes behaviour; omit it entirely otherwise —
    never ship an empty or perfunctory one. Distinct from rule 24's Risk
    Register: the register ranks *known* risks with mitigations; the
    pre-mortem imagines the *whole plan dead* and reconstructs why.

---

## Quality Gates (remote CI by default)

Every roadmap must pass the project's quality pipeline before it is
considered done. **Where** that gate runs depends on
`quality.local_auto_run`: when `false` or missing (the default), the
agent does NOT run the pipeline locally — the user runs it manually and
remote CI on the PR is the authoritative gate; the run-end report says
*"quality gates delegated to remote CI"*, never that the tools passed.
When `local_auto_run: true`, **when** the local pipeline runs during
`/roadmap:process-step|phase|full` is governed by
`roadmap.quality_cadence` in `.agent-settings.yml`
(`end_of_roadmap` default → once before archival; `per_phase` → after
every phase; `per_step` → after every step), with a final fresh run
before "complete" per `verify-before-complete`.

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

<!-- ## Blockers — INCLUDE ONLY when a gate exists that only the user /
     a maintainer can clear (decision, external dependency, evidence
     threshold, soak window). OMIT entirely when there are none — see
     rule 20 for the full shape.
### blocker: <kebab-id>
- **Status:** open
- **Owner:** user
- **Blocks:** Phase N — {phase name}
- **What to do:**
  1. {step}
- **Resolved when:** {decidable signal} -->

## Notes

{Optional: edge cases, decisions, links to related docs.}

<!-- ## Pre-mortem — INCLUDE ONLY when the plan is heavy or irreversible
     enough that a failure forecast changes behaviour (rule 25). OMIT
     entirely otherwise — a perfunctory register is worse than none.
     Shape: the four-part failure register from the premortem skill.
1. Causes of death, ranked: {three, one paragraph each — mechanisms, not topics}
2. Untested hidden dependency: {the assumption the plan never tests}
3. Survivable-failure modification: {one concrete plan change}
4. Tripwire: {metric + threshold + horizon that says cause #1 is materializing} -->

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

