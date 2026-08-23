---
complexity: structural
status: ready
estate_growth_exempt: "Same owner-instructed draft -> ready flip, 2026-08-22. One blocker that was dormant under status: draft now charges open_blockers, and the policy sanctions a new blocker through no allowance other than this claim. Growth is +1 open_blockers. The blocker is where the playbook artefact lives in the consumer tree — an estate decision the maintainer holds, which the flip surfaces rather than settles. It was not added, weakened, or resolved here; only its visibility to the ratchet changed."
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate decision this key deferred to the owner has now been taken, for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft so it charges neither active_roadmaps nor open_blockers until the maintainer flips it to ready — the flip is the owner's estate decision. A genuine addition and explicitly a proposal: nothing in the tree calls anything a playbook, and the gap is shown by a fixture whose own generator the UI lane ignores. The one blocker kept is where the artefact lives in the consumer tree, which is an estate decision the maintainer holds; the supported-generator surface is decided in-text (scripts, turbo.json tasks, turbo gen first) because it follows from the sibling roadmap's consumer-binary posture."
execution:
  mode: phase-checkpoints
---
# Road to repo playbooks
> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source M` rather than by org/repo name: this
> tree must not record which third-party packages seeded an idea. The real
> identifiers, their pinned revisions and their licences remain in the consumed
> inbox copy under `agents/tmp.old/`, which is gitignored and therefore
> maintainer-reachable only. Tool and product names used as *integration
> targets* (Nx, Turborepo, Storybook, shadcn, Base UI) are unaffected — naming a
> tool this package works with is not derivation-attribution.

> **Source:** `agents/tmp.old/component-library/road-to-repo-playbooks.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external deep-analysis session, 2026-08-22, against
> `event4u-app/agent-config` @ `12cb7fe383ddae09479d26f3fcd4328070194c15`
> (v14.8.0). External sources pinned: `Source A (an external monorepo agent-config suite, MIT)` @ `aa363e4`
> (`skills/nx-generate/SKILL.md` § Key Principles, § 2 "prefer the local
> workspace generator"), turborepo.dev `docs/guides/ai` (task `description`,
> `turbo gen`), and agentbrisk.com "AI Coding Agents in Monorepos" (2026-04-20,
> per-package `CLAUDE.md` pattern). Inverted harvest (ADR-211 C/D). The term
> **playbook** and the artefact class below are a **proposal** of this session;
> nothing in the tree calls anything a playbook today.

## Goal

A **playbook** (proposed term) is a repository-local, procedural, evidence-graded recipe for a
task this repository performs repeatedly — "add a component to `@org/ui`",
"add a workspace package", "cut a release", "add a route to the admin app" —
that an agent runs **before** it reaches for a generic skill. When this is
finished: playbooks have one home in the consumer tree, one template, one
grading rule (a playbook step is either **configured** — it invokes a
generator, script, or runner task the repository already defines — or
**observed** — it was written from a worked example and says so), the UI
lane and the command router consult them first, and a playbook whose
configured step no longer exists is flagged by a deterministic check rather
than discovered by an agent at run time.

## Context

What exists, and why it is not a playbook:

- **P1 — contexts are descriptive, not procedural.**
  `src/agent-src/templates/contexts.md:5-7` defines context documents as a
  "snapshot of knowledge… structure, key classes, patterns"; the five types at
  `:25-29` (Module, Domain, Service, Integration, Infrastructure) describe
  areas. None is "how we do X here". `knowledge-card.md` and `lesson-card.md`
  (`src/agent-src/templates/contexts/`) capture facts and lessons, again not
  steps.
- **P2 — overrides modify generic skills; they do not add repo recipes.**
  `src/agent-src/templates/overrides/skill.md:6-14` offers `extend` / `replace`
  of a shipped skill. A recipe for "add a component to our library" has no
  shipped skill to extend — `react-shadcn-ui` is about the primitive set, not
  the team's package — so the override mechanism has nothing to attach to.
- **P3 — the UI lane does not consult project-local procedure.**
  `grep -n -i "override\|playbook\|recipe" directives/ui/apply.ts
  directives/ui/scaffold.ts` (work-engine templates) returns nothing. The lane
  dispatches by `state.stack.frontend` (`review.ts:26-37`, `scaffold.ts:71-80`)
  straight to a shipped skill.
- **P4 — "configured convention" exists only for style.**
  `standards-from-config/SKILL.md:14-18` establishes the Class-A discipline —
  derive from the real tooling config, emit pointer + digest — for lint/format
  settings. Nothing applies the same discipline to **procedures** the
  repository already encodes: `package.json#scripts`, `turbo.json` task
  descriptions, Nx generators, `turbo gen` templates, Plop files.
- **P5 — the external pattern the suite lacks is stated plainly.**
  nx-ai-agents-config `skills/nx-generate/SKILL.md:41` § 2: "When both a local
  workspace generator and an external plugin generator could satisfy the
  request, always prefer the local workspace generator." The suite has no
  equivalent precedence between a repository's own recipe and a shipped skill.
- **P6 — the per-package instruction file is a known pattern with no slot.**
  Root `AGENTS.md` is governed by `agents-md-thin-root` (hard char ceilings,
  ≥ 40 % pointer ratio); a per-workspace `AGENTS.md` under `packages/ui/`
  is neither forbidden nor modelled, and `copilot-agents-optimization`
  dedups only against `.augment/`.

Reused, not rebuilt: the Class A/B/C evidence grading
(`src/agent-src/contexts/execution/evidence-discipline.md`), the
`standards-from-config` output shape, `command-writing` (numbered steps,
safety gates), `module-detect-on-the-fly`, `check-refs`, and the
`verify-before-complete` rule.

## Phase 0 — Decide the artefact, prove the gap

- [x] **0.1 Write the negative control first.** Under
      `tests/fixtures/playbooks/mono-with-generator/` commit a monorepo that
      already has `turbo/generators/config.ts` (a `turbo gen component`
      template) and a `package.json` script `new:package`. Record in its
      `README.md` what the suite does today when asked "add a Toast component
      to @org/ui": it routes to `react-shadcn-ui` and never runs the
      generator. This is the pre-state.
      verify (discharged): the fixture exists and the `README.md` names the generator
      file, the script, and the shipped skill that was dispatched instead. **All three
      named** — `turbo/generators/config.ts`, `new:component`, `react-shadcn-ui`.

      **The pre-state is a VERIFIED negative, not a recalled one.** The search that
      establishes it, run at this commit:
      `grep -rn 'turbo gen\|turbo/generators\|plopfile' src/skills/ src/rules/` ->
      **no matches**. Nothing in any shipped skill or rule mentions a repository
      generator, so no dispatch path *can* propose one — the component-shaped skills
      (`react-shadcn-ui`, `ui-component-architect`) are the only reachable candidates and
      both write files directly.

      The README also states why this is a defect rather than a preference: the generator
      encodes the barrel export, the co-located test and the layout, so a generic skill's
      output **compiles and is wrong** — and it fails silently, because the result looks
      like a component. And what the fixture is NOT: `turbo` is never executed (the files
      are read as configuration, so it works offline and installs nothing), and naming
      `turbo` is an integration target rather than derivation-attribution.
- [x] **0.2 ADR — playbook artefact class.** Via `adr-create`: Status Proposed;
      Decision names the playbook **home** (the path decided under
      `b-playbook-home-in-consumer-tree`; every later step says "the playbook
      home" and never spells a path) and defines a playbook as a file there
      with frontmatter `task`,
      `scope` (workspace path or `repo`), `grade` (`configured` | `observed`),
      `invokes` (list of script / generator / task ids), and a numbered step
      body in the `command-writing` shape. Consequences name the precedence
      rule (Phase 2) and the staleness check (Phase 3). Mark explicitly that
      the name and class are a proposal of this roadmap.
      verify (discharged): the ADR file exists, `./scripts-run src/scripts/generate_index
      --check` is green, and the ADR's Decision quotes the frontmatter keys. **All three:
      `ADR-244-playbook-is-a-sixth-context-type.md`, index in sync, and the Decision
      carries a table of `task` / `scope` / `grade` / `invokes` with the rule for each.**

      **Home: a sixth `Playbook` context type**, in the existing contexts directory beside
      the five `src/agent-src/templates/contexts.md:25-29` defines — `b-playbook-home-in-consumer-tree`
      option (b), AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent: *"reusing established context machinery as a sixth type
      minimizes new surface area versus creating a parallel structure in a new directory."*

      Status **proposed**, because the step says the name and class are this roadmap's
      proposal and the ADR should say so rather than presenting them as settled.

      Two things the ADR decides that the step did not ask for, both because leaving them
      open would have cost a later step: **there is no third `recommended` grade** — a
      grade derived from neither the tree nor a commit is a claim with no basis, and every
      consumer would have to honour it for it to mean anything; and **Nx and Plop are out
      of the first release**, because their discovery needs a consumer binary while the
      Phase-3 staleness check must run without one. A gate that needs the consumer's
      toolchain installed is a gate that does not run.

## Phase 1 — Template and authoring skill

- [x] **1.1 `src/agent-src/templates/playbook.md`.** The template with the
      0.2 frontmatter, a mandatory "Source of truth" line per step (the
      script / generator / task it invokes, or the worked example commit it
      was observed from), and a "Verify" line per step in the roadmap
      `verify:` idiom. A `configured` playbook may not contain a step without
      an `invokes` entry; an `observed` one must cite a commit.
      verify (discharged): the template exists and `grep -c "Source of truth" …/playbook.md`
      is >= 1. **Returns 2.**

      `src/agent-src/templates/playbook.md` carries the 0.2 frontmatter, a **Source of
      truth** line and a **Verify** line per step, and states both grade obligations as a
      table rather than as prose: `configured` may have no step without an `invokes` entry,
      `observed` must cite the commit. It also carries a *"What this playbook does NOT
      cover"* section, because a playbook that silently stops short is worse than one that
      names where it ends — a reader cannot otherwise tell completion from omission.
- [x] **1.2 `playbook-authoring` skill (new, `engineering-base`).** Derives
      playbooks from the repository: enumerate `package.json#scripts` (root and
      each workspace), `turbo.json` tasks with `description`, `nx list` /
      `nx g --help` output, `turbo/generators/*`, `plopfile.*`; propose one
      playbook per repeated procedure; grade each step; write the file. It
      must refuse to write a `configured` step for a generator it did not see
      in the tree (the Class-A rule from `standards-from-config` applied to
      procedure).
      **Decided here, not a blocker:** the first release resolves `invokes`
      ids against `package.json#scripts`, `turbo.json` tasks, and `turbo gen`
      templates only; Nx generators and Plop are recorded in the ADR as not
      yet covered, because their discovery needs a consumer binary (the
      posture decided in `road-to-monorepo-scope-and-detection.md` Phase 3
      step 3.1) and the staleness check in Phase 3 must run without one.
      verify (discharged): run against the 0.1 fixture → produces `add-ui-component.md`
      in the playbook home with `grade: configured` and `invokes: [turbo gen
      component]`; the ADR lists the three supported kinds and the two
      deferred ones; `check_references` green. **All three: the derivation prints
      `✅ …/add-ui-component.md  grade=configured  invokes=[turbo gen component]`;
      ADR-244:116-118 carries the three-supported / two-deferred split; references green.**

      Shipped as a **skill plus a deterministic script**, not prose alone. The verify says
      *"run against the fixture → produces"*, and a prose-only skill cannot discharge that:
      the claim would be an assertion about what an agent would do. `derive_playbooks.ts`
      makes no model call, so the verify is a command anyone can re-run.

      **The Class-A refusal is exercised on the fixture, not mocked.** `new:package` wraps
      `turbo gen workspace` and the fixture registers only `component`, so the same fixture
      that produces the `configured` playbook also produces an `observed` one naming the
      unresolved id. The pass arm and the refusal arm cannot drift apart, because they are
      the same input.

      Two findings that were not in the step and are now in the code:

      - **The wrapper trap.** `"new:component": "turbo gen component"` is a *pointer*. A
        playbook invoking the SCRIPT stays green after the generator is renamed — the script
        still exists — so the Phase-3 staleness check would pass over a broken procedure.
        Thin wrappers are unwrapped and what they point at is recorded.
      - **The filename is not the generator id.** `turbo/generators/config.ts` registers
        `component` via `plop.setGenerator`; reading the filename yields `turbo gen config`,
        which nobody can run. Both Plop spellings are accepted, since a real config carries
        either.

      Slugs are workspace-qualified (`add-ui-component`, not `add-component`) because two
      workspaces may each own a `component` procedure with different conventions, and one
      file per subject would silently collapse them into whichever ran last.

      **Sabotage-proven:** forcing `grade: 'configured'` unconditionally takes both refusal
      assertions RED. Restored, 13/13.

      **`lint_framework_leakage` rose 0 → 1, and the fix was the better skill rather than a
      suppression.** The gate offered a line-keyed suppression with a reason field; taking it
      would have recorded *"this token is quoted content"*, which was false — the draft named
      a Node manifest as *the* source of truth for a generic skill. A playbook is
      **ecosystem-neutral**: a Python repo's `nox` sessions, a Go repo's `make` targets, a
      Rust workspace's `just` recipes are all repeated procedures the class covers. What
      varies is whether a deterministic reader can resolve an invoked id **without a consumer
      binary** — the actual constraint ADR-244 recorded, and now what the scope table says. A
      third row states honest scope: those ecosystems are **not yet read**, so a playbook for
      them is written by hand against the grading rules. 0 hits, no allowlist entry added.

      **A dropped `git stash` ate this note and the skill edits once.** Switching branches
      mid-step stashed uncommitted work; the pop reported *"The stash entry is kept"* and the
      entry was then dropped, taking the ecosystem-neutral rewrite and this whole block with
      it. `git fsck --unreachable` found no matching commit. Recovered by redoing the edits
      from the session record. The lesson is the ordering, not the recovery: **commit before
      switching branches**, and treat a `pop` that does not say *"Dropped"* as a failed pop.
- [x] **1.3 Per-workspace `AGENTS.md` slot.** `agents-md-thin-root` gains a
      § Workspace files: a `packages/<n>/AGENTS.md` is allowed, is subject to
      the same pointer-ratio rule, and its primary content is a pointer list to
      the playbooks whose `scope` is that workspace. `copilot-agents-optimization`
      dedups these files against the playbooks, not only against `.augment/`.
      verify (discharged): both skills name the per-workspace file; a fixture
      `packages/ui/AGENTS.md` that restates a playbook step verbatim is flagged
      by `copilot-agents-optimization`. **Both: `agents-md-thin-root` gains
      § Workspace files, `copilot-agents-optimization` gains step 3b, and the fixture is
      flagged — 17/17 in `derive_playbooks.test.ts`.**

      **"Flagged by a skill" is prose, so the flag is a function.** A skill cannot discharge
      a verify that says *is flagged*: the claim would be an assertion about what an agent
      would do. `findRestatedSteps` is deterministic and both skills point at it. It is NOT
      wired as a new CI gate — a new gate reds three ratchets and this is a consumer-side
      check over files this repository does not have.

      **The detector matches the invoked ID, not the step title, and the first version got
      that wrong.** Titles are generic by construction — every generator step in the fixture
      is called *"Run the repository's own generator"* — so the title needle reported the
      same prose line once per playbook (`expected 2 to be 1`) and named neither procedure.
      The id is the actionable half, and duplicating the actionable half is the failure.

      **Two guards, both sabotage-proven, and the first probe FAILED to prove anything.**
      Removing the pointer carve-out left the suite green: the fixture's link label read
      *"add a UI component"*, which contains no step text, so nothing distinguished
      carve-out from no carve-out. The fixture's pointer now reads
      `[Run the repository's own generator — \`turbo gen component\`](…)` — a pointer whose
      label quotes the step it points at, which is the hardest case and the only one that
      makes the carve-out observable. Removing it now takes the suite RED. Same story for
      the length guard: it is exercised with a short id (`gen`) against prose containing
      *"generator"*, and removing the guard takes it RED. A test never seen red has unknown
      sensitivity, and two of these had none.

      **`skill_linter` matched `fix` inside `fixtures`** and demanded an analysis-first
      section of a skill that had passed for months. Resolved by promoting the inventory
      requirement to its own `### Before writing one` section — which the skill wanted
      anyway, since a workspace file written before its playbooks are read is exactly how
      the restatement arrives. The substring match is a real linter defect (no word
      boundary, the same class as the grep-shaped traps this run keeps hitting); not fixed
      here, because widening `changeSignals` to word boundaries would move findings across
      288 skills and every ratchet that counts them.

## Phase 2 — Precedence: playbook before shipped skill

- [x] **2.1 `playbook-precedence` rule (new).** When a task matches a playbook
      whose `scope` contains the current `scope_root` (or `repo`), the agent
      runs the playbook's `configured` steps first and uses the shipped skill
      only for what the playbook does not cover. An `observed` playbook is
      advisory: it is read, but the shipped skill's gates still apply in full.
      Cite nx-ai-agents-config `nx-generate` § 2 as the source of the
      precedence shape.
      verify (discharged): the rule's § Routing names the `grade` axis and the
      `playbook-authoring` skill; `check_references` green. **Both — § Routing is a
      grade-keyed table citing the skill; references green; `skill_linter` PASS.**

      Two clauses added beyond the step, both because the gap they close is silent:
      **never run a playbook's command silently** (the propose-never-silent-run gate is
      unchanged by precedence — a playbook is authoritative about *what*, never about
      *who runs it*), and **never synthesise a command the playbook did not name** — the
      failure where a playbook names `turbo gen component` and the agent runs
      `turbo gen page` because the task said "page". A command the playbook did not name
      carries no repository authority, which is the whole basis of the precedence.

      **The step said to cite the external source by name; the rule does not, and that is
      deliberate.** `source-confidentiality`'s Iron Law forbids derivation attribution to a
      named external project in a **tracked, shipped** artifact, and a rule ships to every
      consumer. The § Provenance section carries the *shape* and states plainly that the
      name is withheld under that rule, with the attribution left where it already lives on
      the maintainer side. `check_no_external_sources` would not have caught it — the
      project is not on the denylist — so this is the rule binding, not the gate.
- [ ] **2.2 UI lane reads playbooks.** `directives/ui/scaffold.ts` and
      `apply.ts` resolve playbook files in the playbook home whose `task` matches the
      directive verb (`scaffold`, `apply`) and `scope` matches
      `state.stack.scope_root`; a `configured` match is dispatched before the
      `STACK_DIRECTIVES` skill and its `invokes` commands are shown to the user
      under the existing propose-never-silent-run gate. No match → unchanged
      behaviour.
      verify: the 0.1 fixture run through `scaffold` proposes
      `turbo gen component` before any `react-shadcn-ui` step; a fixture with
      an empty playbook home produces byte-identical output to HEAD.
- [x] **2.3 Command router hint.** `command-routing/SKILL.md` gains one
      sentence: a slash command whose name matches a playbook `task` lists the
      playbook in its preamble.
      verify (discharged): `grep -n "playbook" src/skills/command-routing/SKILL.md` returns
      one hit. **Two hits on one added step (2b) — the sentence and its rule link. The step
      asked for one hit meaning one addition, and a link that named nothing would be the
      worse reading.**

## Phase 3 — Staleness is a gate, not a surprise

- [ ] **3.1 `check_playbook_invokes.ts` (consumer-side gate).** For every
      `configured` playbook, each `invokes` id must resolve to an existing
      script name, `turbo.json` task, or `turbo gen` template in the tree
      (the three kinds decided in 1.2; an Nx or Plop id is reported as
      `unsupported`, never as resolved). Missing → exit 1 with the playbook
      and step named. Ships under the
      consumer `scripts/` template so it can run in the consumer's own CI.
      verify: rename the generator in the 0.1 fixture → the check fails naming
      `add-ui-component.md` step 1; restore → passes.
- [ ] **3.2 Grade downgrade on drift.** When the check fails, the remediation
      it prints is to either fix the `invokes` id or downgrade the step to
      `observed` with a commit citation — never to delete the evidence line.
      verify: the check's failure message contains both options verbatim.

## Phase 4 — Evidence that it pays

- [x] **4.1 Pre-registered measure.** Before 2.2 lands, file under
      `agents/evidence/analysis/playbook-precedence-prereg.md`: on the 0.1
      fixture, count the tool calls and the files read by the UI lane for
      "add a Toast component to @org/ui" at HEAD (pre-state) and the
      falsifier: if the playbook path reads **more** files or proposes a
      command the generator would not have produced, the precedence rule is
      downgraded to advisory for `scaffold` and the null is published.
      verify (discharged): the file exists with a pre-state number and a named falsifier
      before the 2.2 PR is opened. **`agents/evidence/analysis/playbook-precedence-prereg.md`
      carries four pre-state rows and two named falsifiers (F1, F2), filed while 2.2 is
      unwritten.**

      **The step's own measure is not reproducible, and the pre-registration says so rather
      than pretending otherwise.** A tool-call count is a property of one agent run — a
      second run over the same code reads a different number of files. So the pre-state is
      the statically countable half: directives dispatched (**2**), whether a
      repository-specific command is proposed at all (**none** — the lane maps
      `state.stack.frontend` straight to a shipped skill), files read to decide (**1**), and
      `grep -rn 'turbo gen'` over the work engine (**0 hits**, the ADR-244 negative control
      narrowed to the lane this phase changes). The tool-call count is still recorded in 4.2,
      labelled as a single observed run, and is explicitly **not** the falsifier: anchoring a
      decision on an irreproducible number is how a measure becomes a story.

      The falsifiers are chosen so either can fire against the phase's own interest — **F1**
      the playbook path reads more to decide without proposing a repo-specific command, and
      **F2** it proposes a command the generator would not have produced, which is exactly
      `derive_playbooks`'s `observed` condition. Either → precedence is downgraded to
      advisory for `scaffold` and the null is published.
- [ ] **4.2 Measure and publish.** Re-run after 2.2; record the numbers
      beside the pre-state. Either outcome is published.
      verify: the evidence file has both numbers and one of "confirmed" /
      "null — downgraded".

## Blockers

### blocker: b-playbook-home-in-consumer-tree

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** Phase 0 step 0.2, Phase 1 step 1.1, Phase 2 step 2.2.
- **What to do:** pick exactly one — (a) `agents/playbooks/` beside
  `agents/settings/contexts/` (new directory, new type); or (b) a sixth
  context type `Playbook` inside the existing contexts directory, reusing the
  `contexts.md` machinery and adding only the frontmatter.
- **Recommendation:** **(b).** It adds no directory, rides the existing
  module-scoped resolution (`contexts.md:3`: `{module_root}/{Module}/{agent_folder}/settings/contexts/`),
  and keeps the estate ratchet quiet. Every step in this file says "the
  playbook home" so the choice lands in exactly one place, the ADR.
- **If you do nothing:** implementers pick a path each, the precedence rule
  in 2.1 cannot name a glob, and 3.1 has nothing to scan.
- **Resolved when:** the ADR's Decision names the path and every step in this
  file uses it.
- **Resolution (2026-08-23) — option (b): a sixth context type `Playbook`.** AI council 2026-08-23, 2/2 quorum (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent;
  the maintainer delegated owner-reserved blockers to the council for this autonomous
  drain run. Reason, in the council's words: *"reusing established context machinery as a
  sixth type minimizes new surface area versus creating a parallel structure in a new
  directory."* Option (a), a new `agents/playbooks/` directory, was refused because it
  creates a parallel content system with its own discovery, validation and projection
  surface — a cost paid on every later change to either system — for an artefact the
  contexts machinery already fits.

  Recorded in `ADR-244-playbook-is-a-sixth-context-type.md`, whose Decision names the
  home once. **Every later step says "the playbook home" and never spells the path**,
  which is deliberate: a step that hard-codes a directory has to be rewritten if the
  placement is revisited, and the placement is the part of this decision least likely to
  survive contact with a consumer.
## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: external-session/claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Playbooks become a second skill corpus | product | Teams write prose recipes that restate shipped skills, the estate doubles in the consumer tree | The `configured` grade requires an `invokes` id; prose-only recipes are `observed` and advisory, and `copilot-agents-optimization` flags restatement | Phase 1 — Template and authoring skill |
| 2 | Precedence bypasses a gate | implementation | A `configured` playbook step runs a script the shipped skill would have gated | 2.2 routes every `invokes` through the existing propose-never-silent-run gate; `observed` playbooks never pre-empt a gate | Phase 2 — Precedence: playbook before shipped skill |
| 3 | Stale playbooks are trusted | implementation | A renamed generator leaves a `configured` step that no longer resolves | 3.1 is a consumer-side gate; 3.2 forbids deleting evidence as the fix | Phase 3 — Staleness is a gate, not a surprise |
| 4 | The measure is post-hoc | product | "It helped" written after the fact is the claim shape the Claims Ledger rejects | 4.1 pre-registers the number and the falsifier before 2.2 opens | Phase 4 — Evidence that it pays |
| 5 | Home directory decided by whoever lands first | implementation | Two paths, two globs, one rule that names neither | `b-playbook-home-in-consumer-tree` gates Phase 0 | Phase 0 — Decide the artefact, prove the gap |

## Acceptance Criteria

- [ ] AC-1 — A fixture repository with its own generator is committed, and the
      pre-state (generic skill dispatched, generator ignored) is recorded
      before any code changed.
- [ ] AC-2 — An ADR defines the playbook class, its grades, and its home, and
      states that the class is this roadmap's proposal.
- [ ] AC-3 — `playbook-authoring` produces a `configured` playbook from the
      fixture's generator and refuses to write a `configured` step for a
      generator not in the tree.
- [ ] AC-4 — The UI lane proposes the repository's own generator before a
      shipped skill when a `configured` playbook matches, and is byte-identical
      to HEAD when none exists.
- [ ] AC-5 — Renaming a generator makes a deterministic check fail naming the
      playbook and step; the check's remediation never deletes evidence.
- [ ] AC-6 — A pre-registered measure with a named falsifier exists before the
      precedence change merged, and its outcome — confirmed or null — is
      published.
