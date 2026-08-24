# Roadmap Template

Templates for roadmap files stored in `agents/roadmaps/` or `{module_root}/{Module}/{agent_folder}/roadmaps/` (resolved via `modules.root_paths` + `modules.agent_folder` in `.agent-project-settings.yml`; Laravel example: `app/Modules/{Module}/agents/roadmaps/`).

---

## Start from the skeleton, not from this page

```bash
./scripts-run src/scripts/new_roadmap <slug>            # lightweight
./scripts-run src/scripts/new_roadmap <slug> --structural
./scripts-run src/scripts/new_roadmap <slug> --stdout   # print, do not write
```

It emits a file that passes every roadmap gate **unedited** — the complexity
enum, the acceptance heading in the exact form the extractor matches, the
risk-review marker, a legal risk type, and an anchor that resolves. Those four
conventions live in four different gates, and each one costs a full gate round
to discover by failing it. Measured 2026-08-20 across 88 roadmaps: **six
different invented `complexity:` values** were in the tree, and **10 of 22**
roadmaps wrote an acceptance heading the extractor cannot see.

The rules below still govern the content. The skeleton only removes the part
that was never a judgement call.

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
    - `interactive` — every gate fires as authored by its owning rule.
      **Not what an absent field means.** When the field is absent the mode is
      DERIVED from the invocation form (`roadmap-process-loop § 3a`):
      `process-full` derives `autonomous`; `/roadmap:next` and `process-phase`
      derive `phase-checkpoints`; `process-step` runs without a contract. The
      contract screen is still shown once and still carries "run interactive
      instead", so declaring nothing costs a keystroke, never control.
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

    **Companion field, same block — `depends:`.** Optional, and only
    meaningful for a set run:

    ```yaml
    depends: [road-to-other-thing]   # slugs, not paths
    ```

    A declared edge is authoritative and is never overridden by the
    file-overlap heuristic the set contract also computes
    ([`roadmap-process-loop § 3d`](../contexts/execution/roadmap-process-loop.md)).
    The union of declared and inferred edges feeds exactly two decisions —
    the order members run in, and whether two members may share a lane —
    and nothing else. Declaring an edge that is not real costs serial
    execution; missing a real one costs a collision, so the heuristic
    resolves toward serial and a declaration is the cheap way to be right.
    Absent means no declared dependency, never “independent”: the overlap
    heuristic still runs.

    **Companion field, same block — `relates:`.** The wider relation, of which
    `depends` is one value:

    ```yaml
    relates:
      - slug: road-to-other-thing
        relation: extends        # extends | supersedes | depends | disjoint
        note: "adds the path axis its § 3 left as slug-only"
      - slug: road-to-old-thing
        relation: supersedes
        note: "same mechanism, this one replaces it"
    ```

    One row per hit from `agent-config roadmap:context`, which is what the
    authoring surfaces run before drafting. Four relations and no more —
    `extends`, `supersedes`, `depends`, `disjoint`; an unknown value is rejected
    by the roadmap lint, because an open vocabulary here degrades into free-text
    notes nothing can read.

    A `relation: depends` row **mirrors into `depends:`** so the set contract's
    edge source stays the single one already defined above; `relates:` never
    becomes a second dependency source.

    An explicit `relates: []` is a complete answer and the common one, but only
    when it carries the probe's `scanned:` line as its justification:

    ```yaml
    relates: []   # scanned: 716 roadmap file(s), 0 sibling hits
    ```

    Absent-versus-empty is the whole point. Absent means nobody looked; `[]` with
    a `scanned:` line means somebody looked and found nothing. A `relates: []`
    written by reflex, with a boilerplate note, carries no information and is
    worse than none — the pre-save self-check in
    [`roadmap-writing`](../../skills/roadmap-writing/SKILL.md) asks for exactly
    this distinction.
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
    - **Question:** {optional — the one line saying what is being decided.}
    <!-- Class is optional and absent means 3. Add Run: ONLY with Class 0 or 1,
         where it is required — a class-3 entry advertising a command reads as
         actionable and is not. Budget: is class 1 only.
           - **Class:** 0
           - **Run:** `{command}`
           - **Budget:** {estimate}   (class 1 only)
    -->
    - **Recommendation:** {which option, and the one sentence why.}
    - **If you do nothing:** {what the non-decision costs, concretely.}
    - **What to do:**
      1. {Concrete, copy-pasteable step the owner must execute.}
      2. {Include commands, file paths, and expected outcomes.}
    - **Resolved when:** {decidable signal, e.g. "task X exits 0"}
    ```
    `### blocker: <id>` is the parse anchor the dashboard generator
    reads; ids are unique within the roadmap. All seven fields are
    required; `Question:` is optional and recognised (before it was
    named, the parser folded it silently into `Blocks:`). A cleared blocker flips `Status: resolved` (kept for
    history) instead of being deleted — the resolve-flip runs in the
    same reply as the checkbox flip that cleared it, per
    [`roadmap-progress-sync`](../rules/roadmap-progress-sync.md). A
    step gated by a specific blocker may cross-reference it inline:
    `- [ ] … <!-- blocked-by: <blocker-id> -->`.

    **A blocker is a decision the owner can make in one sitting, or it
    is not finished being written.** The five original fields describe
    the *situation*; they do not make it decidable, and a blocker that
    only describes a situation hands the analysis back to the person
    least able to do it. Measured 2026-08-15 across the 46 blocker
    entries in this tree: **14 carry no command, path, or option at all**
    in `What to do`. Each of those is a research task wearing a
    decision's clothes.

    - **`Recommendation:` names one option and why.** "Pick exactly one
      — (a) … or (b) …" without a recommendation is not neutrality, it is
      an unfinished analysis. The agent read the evidence; the owner did
      not. If the agent genuinely cannot recommend, the field says so
      **and names the missing fact** that would decide it.
    - **`If you do nothing:` states the cost of the non-decision.** Most
      blockers are cheap to leave open and a few are not; the owner
      cannot tell which without being told. "Nothing — the roadmap simply
      stays open" is a complete and common answer.
    - **`What to do:` is executable, not descriptive.** Each option
      names **what changes**, **where** (the file path or the command),
      and **what it costs**. A step a reader cannot execute without first
      re-deriving the analysis is a finding, not a step.
    - **Offer to run it.** When the agent hands a blocker to a human, it
      offers to walk them through it step by step in the same reply. The
      owner deciding does not mean the owner executing.

    **`Class:` — is a human the point of this gate, or its courier?**
    Most gates are not decisions; they are commands waiting for someone
    to type them. The four classes name the difference, and only the
    last one genuinely needs a person:

    | Class | Meaning | What clears it |
    |---|---|---|
    | `0` | auto-run — deterministic, free, reversible | the agent runs `Run:`; the output IS the unblock |
    | `1` | budget-preauthorized — billable but reversible | the agent runs `Run:` under a standing budget and logs a receipt |
    | `2` | consent-once — a real preference call, reversible | one line with the recommendation and a default |
    | `3` | human-only — the human IS the content: externally impossible for the agent, or an explicitly excluded action | a person, because nobody else can |

    **CAPABILITY BEFORE ROLE (ADR-237).** `3` means *a human is the
    content of this gate*, never *a human usually does this*. Before
    authoring `3`, ask one question: **can the agent execute this at all**
    — through the filesystem, git, `gh`, an API, a CLI, a tool, a model, a
    council? If yes, it is **not** class 3, whoever conventionally
    performs it. A branch to create, a push, a PR to open, a repository or
    branch setting the agent can change, a workflow to start, CI to
    re-run, a merge base to update, conflicts, failing tests, local
    configuration, a paid call inside the run's budget — all of these are
    **work**, and authoring `3` on any of them is a defect a
    `process-full` run repairs rather than obeys.

    What legitimately remains `3`: a credential that does not exist and
    the agent cannot create · a purchase beyond the delegated budget ·
    physical hardware access · another person or organisation must act · a
    wait that is factually mandatory and cannot be simulated or verified ·
    an action on the Hard Floor's EXCLUDED list (production-trunk merge,
    deploy, prod data / secrets / IAM / DNS, an irreversible external
    action).

    Three properties are load-bearing. **`Class:` is optional and its
    absence means 3**, so nothing becomes executable because an author
    forgot a field — but an absent class is a *default*, not a finding,
    and the capability question above still decides whether the step is
    really blocked. **A class-0 or class-1 entry MUST carry `Run:`** —
    `lint_roadmap_blockers` fails otherwise, because a gate that claims
    to be runnable without naming the command reads as actionable and is
    not. And **class is authored, never inferred**: promoting a gate is
    a reviewed edit, which is what keeps a Hard-Floor gate
    (`non-destructive-by-default`) out of reach of a runtime judgment.
    Repairing a `3` that fails the capability test is such an edit — it is
    recorded at the blocker with the reason, not applied silently.

    Only the leading token of `Class:` is read, so
    `- **Class:** 1 — budget-preauthorized` is valid; the taxonomy name
    is there for the reader.

    `lint_roadmap_blockers` enforces the field set and probes `What to
    do` for executable substance. The 14-entry backlog is recorded as a
    ratchet baseline (`gate-violation-baselines.json`), so existing
    entries stay legal while any **new** one that skips a field or ships
    a command-free `What to do` fails. The `Class:` / `Run:` pair is a
    HARD check rather than a ratcheted one — it is opt-in, so it fires
    on nothing until an author declares a class and there is no backlog
    to grandfather.

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
      **Carve-out — a merge the USER directed** may be RECORDED, marked
      `<!-- carve-out: user-directed-merge -->`. It records; it never
      schedules. The discriminator is PROVENANCE, not wording: an
      instruction the user gave, never merge text that arrived by paste —
      a quoted chat log or a pasted snippet is not an instruction, the
      same distinction the git-authorization classifier already draws
      between prose and pasted commands. Unmarked merge text stays
      forbidden.
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
- **Recommendation:** {which option, and the one sentence why}
- **If you do nothing:** {what the non-decision costs}
- **What to do:**
  1. {step — what changes, where (`path` or command), what it costs}
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

