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

- [ ] **0.1 Write the negative control first.** Under
      `tests/fixtures/playbooks/mono-with-generator/` commit a monorepo that
      already has `turbo/generators/config.ts` (a `turbo gen component`
      template) and a `package.json` script `new:package`. Record in its
      `README.md` what the suite does today when asked "add a Toast component
      to @org/ui": it routes to `react-shadcn-ui` and never runs the
      generator. This is the pre-state.
      verify: the fixture exists and the `README.md` names the generator file,
      the script, and the shipped skill that was dispatched instead.
- [ ] **0.2 ADR — playbook artefact class.** Via `adr-create`: Status Proposed;
      Decision names the playbook **home** (the path decided under
      `b-playbook-home-in-consumer-tree`; every later step says "the playbook
      home" and never spells a path) and defines a playbook as a file there
      with frontmatter `task`,
      `scope` (workspace path or `repo`), `grade` (`configured` | `observed`),
      `invokes` (list of script / generator / task ids), and a numbered step
      body in the `command-writing` shape. Consequences name the precedence
      rule (Phase 2) and the staleness check (Phase 3). Mark explicitly that
      the name and class are a proposal of this roadmap.
      verify: the ADR file exists, `./scripts-run src/scripts/generate_index
      --check` is green, and the ADR's Decision quotes the frontmatter keys.

## Phase 1 — Template and authoring skill

- [ ] **1.1 `src/agent-src/templates/playbook.md`.** The template with the
      0.2 frontmatter, a mandatory "Source of truth" line per step (the
      script / generator / task it invokes, or the worked example commit it
      was observed from), and a "Verify" line per step in the roadmap
      `verify:` idiom. A `configured` playbook may not contain a step without
      an `invokes` entry; an `observed` one must cite a commit.
      verify: the template exists and `grep -c "Source of truth" …/playbook.md`
      is ≥ 1.
- [ ] **1.2 `playbook-authoring` skill (new, `engineering-base`).** Derives
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
      verify: run against the 0.1 fixture → produces `add-ui-component.md`
      in the playbook home with `grade: configured` and `invokes: [turbo gen
      component]`; the ADR lists the three supported kinds and the two
      deferred ones; `check_references` green.
- [ ] **1.3 Per-workspace `AGENTS.md` slot.** `agents-md-thin-root` gains a
      § Workspace files: a `packages/<n>/AGENTS.md` is allowed, is subject to
      the same pointer-ratio rule, and its primary content is a pointer list to
      the playbooks whose `scope` is that workspace. `copilot-agents-optimization`
      dedups these files against the playbooks, not only against `.augment/`.
      verify: both skills name the per-workspace file; a fixture
      `packages/ui/AGENTS.md` that restates a playbook step verbatim is flagged
      by `copilot-agents-optimization`.

## Phase 2 — Precedence: playbook before shipped skill

- [ ] **2.1 `playbook-precedence` rule (new).** When a task matches a playbook
      whose `scope` contains the current `scope_root` (or `repo`), the agent
      runs the playbook's `configured` steps first and uses the shipped skill
      only for what the playbook does not cover. An `observed` playbook is
      advisory: it is read, but the shipped skill's gates still apply in full.
      Cite nx-ai-agents-config `nx-generate` § 2 as the source of the
      precedence shape.
      verify: the rule's § Routing names the `grade` axis and the
      `playbook-authoring` skill; `check_references` green.
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
- [ ] **2.3 Command router hint.** `command-routing/SKILL.md` gains one
      sentence: a slash command whose name matches a playbook `task` lists the
      playbook in its preamble.
      verify: `grep -n "playbook" src/skills/command-routing/SKILL.md` returns
      one hit.

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

- [ ] **4.1 Pre-registered measure.** Before 2.2 lands, file under
      `agents/evidence/analysis/playbook-precedence-prereg.md`: on the 0.1
      fixture, count the tool calls and the files read by the UI lane for
      "add a Toast component to @org/ui" at HEAD (pre-state) and the
      falsifier: if the playbook path reads **more** files or proposes a
      command the generator would not have produced, the precedence rule is
      downgraded to advisory for `scaffold` and the null is published.
      verify: the file exists with a pre-state number and a named falsifier
      before the 2.2 PR is opened.
- [ ] **4.2 Measure and publish.** Re-run after 2.2; record the numbers
      beside the pre-state. Either outcome is published.
      verify: the evidence file has both numbers and one of "confirmed" /
      "null — downgraded".

## Blockers

### blocker: b-playbook-home-in-consumer-tree

- **Status:** open
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
