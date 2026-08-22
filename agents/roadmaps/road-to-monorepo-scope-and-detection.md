---
complexity: structural
status: draft
estate_offset_exempt: "Ships status: draft so it charges neither active_roadmaps nor open_blockers until the maintainer flips it to ready — the flip is the estate decision, taken by the owner and not by this external session. A genuine addition: the defect is reproduced at the pinned commit with a live detector run (a real monorepo resolves to plain), and no active roadmap covers stack detection, so there is nothing to offset against without an unreviewed disposition. Of the two decisions this roadmap raises, one is decided in-text from evidence in the tree (both yaml and js-yaml are already runtime dependencies) and one is posture-matched to react-shadcn-ui; neither is filed as a blocker."
execution:
  mode: phase-checkpoints
---
# Road to monorepo scope and detection
> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source M` rather than by org/repo name: this
> tree must not record which third-party packages seeded an idea. The real
> identifiers, their pinned revisions and their licences remain in the consumed
> inbox copy under `agents/tmp.old/`, which is gitignored and therefore
> maintainer-reachable only. Tool and product names used as *integration
> targets* (Nx, Turborepo, Storybook, shadcn, Base UI) are unaffected — naming a
> tool this package works with is not derivation-attribution.

> **Source:** `agents/tmp.old/component-library/road-to-monorepo-scope-and-detection.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external deep-analysis session, 2026-08-22, against
> `event4u-app/agent-config` @ `12cb7fe383ddae09479d26f3fcd4328070194c15`
> (v14.8.0). Every `file:line` below was read at that commit. External sources
> were cloned and pinned: `Source A (an external monorepo agent-config suite, MIT)` @ `aa363e4` (MIT),
> `Source B (an external monorepo build-tool repo, MIT)` @ `ef1ef92` (MIT, `skills/turborepo/SKILL.md`),
> `Source C (an external plugin repo carrying a component-CLI skill, Apache-2.0)` @ `c4a1c4e` (Apache-2.0, `skills/shadcn/SKILL.md`).
> Harvest form is inverted (ADR-211 C/D): every phase starts from a defect
> confirmed in this tree and pulls in a source only where the source closes it.
> Anything marked **proposal** is this session's own design, not an adopted
> foundation. Sibling roadmaps from the same session:
> `road-to-component-library-lifecycle.md` (owns the compatibility refresh
> and Storybook) and `road-to-repo-playbooks.md` (consumes `scope_root` from
> Phase 1 here).

## Goal

A monorepo stops being invisible to the UI lane. Three things are true when
this is finished. First, `detect_stack()` recognises the monorepo shape that
actually exists in the wild — a root manifest that declares `workspaces` (or a
`pnpm-workspace.yaml`, `turbo.json`, `nx.json` beside it) with frontend roots
underneath — instead of only the shape with no root manifest at all. Second,
scope selection is an explicit step with an explicit answer: one frontend
workspace is descended into, several are named and the caller chooses, and the
chosen scope is written into state so every downstream directive reads the
same answer. Third, the workspace-link, affected-set, and task-runner facts an
agent needs in a monorepo live in skills this package ships, derived from the
repository's own configuration rather than guessed, and the two existing
monorepo tests are replaced by fixtures that look like a real repository.

## Context

The defects this roadmap acts on, each verified at the pinned commit with a
live run of the detector where a run was possible:

- **M1 — the workspace branch is unreachable for real monorepos.**
  `src/agent-src/templates/scripts/work_engine/stack/detect.ts:289` guards the
  workspace descent with `if (mtime === 0.0)`, and `latest_manifest_mtime`
  (`detect.ts:330-339`) returns `0.0` only when none of `composer.json`,
  `package.json`, `components.json` exists at the root. A root `package.json`
  is the defining file of an npm/pnpm/yarn/bun workspace, so the branch is
  skipped for every repository it was written for. Live run at the pinned
  commit: root `package.json` with `"workspaces": ["apps/*","packages/*"]` and
  `turbo` in devDependencies, `apps/web` (react + next), `packages/ui` (react +
  `@radix-ui/react-dialog` + `components.json`) → `frontend: "plain"`, every
  axis `unknown`/`none`, `ambiguity: []`. The repository is then handed the
  generic `ui-design-review-plain` directive (`directives/ui/review.ts:33`,
  `DEFAULT_DIRECTIVE` at `:40`).
- **M2 — the tests pin the unrealistic shape.**
  `tests/scripts/work_engine/ui_lane_matrix.test.ts:241-260` and `:262-275`
  build monorepos with **no** root `package.json`. Both pass at HEAD and both
  would keep passing after M1 is fixed, so they are not a regression witness
  for the defect; they are the reason the defect survived two prior edits (the
  comment at `:242-246` records the row was changed twice).
- **M3 — workspace markers are not read.** `grep -n "pnpm-workspace\|turbo.json\|nx.json"
  detect.ts` returns nothing. `_nested_frontend_roots` (`detect.ts:581-606`)
  reads only `package.json#workspaces` plus a fixed directory list
  (`_WORKSPACE_DIRS`); a pnpm monorepo declares its workspaces in
  `pnpm-workspace.yaml` and frequently has no `workspaces` key at all.
- **M4 — the shadcn signal is one major behind.** `detect.ts:92` sets
  `_SHADCN_RADIX_PREFIX = '@radix-ui/'` and `detect.ts:472` derives
  `component_lib: radix` from that prefix only. shadcn's `new-york` style moved
  to the unified `radix-ui` package (vercel-plugin `skills/shadcn/SKILL.md:176-188`,
  "Unified Radix UI Package (February 2026)") and accepts Base UI as the
  primitive layer (`:190-198`; package `@base-ui/react` since Base UI 1.0, renamed from `@base-ui-components/react`).
  Live run: `react` + `radix-ui` without `components.json` → `component_lib:
  none`; `react` + `@base-ui/react` → `component_lib: none`.
- **M5 — prose contradicts the monorepo layout.**
  `src/skills/existing-ui-audit/SKILL.md:91` ("`components.json` exists at repo
  root") and `:267` ("shadcn requires `components.json` at repo root") are false
  for the layout shadcn's own CLI scaffolds: each workspace carries its own
  `components.json` and the root carries none (ui.shadcn.com/docs/monorepo,
  "Every workspace must have a components.json file").
- **M6 — nothing consumes the monorepo signal.**
  `src/skills/project-analyzer/SKILL.md:215` classifies `apps/* + packages/* +
  turbo.json / nx.json / pnpm-workspace` as "Monorepo", and no skill in
  `src/skills/` or rule in `src/rules/` mentions `turbo`, `nx affected`,
  `pnpm --filter`, or the `workspace:` protocol (grep over both trees, 0 hits
  outside unrelated prose). The package detects the shape and then has nothing
  to say about it.

What already exists and is reused, not rebuilt: the axis model
(`detect.ts:148-163`, `_detect_axes` at `:232`), the ambiguity refusal
(`detect.ts:240-242`), the `unknown` lane that the directives refuse on
(`review.ts:35-37`), `standards-from-config` as the Class-A "derive from real
config" primitive (`src/skills/standards-from-config/SKILL.md:14-18`), and
`worktree-lifecycle` for parallel-agent isolation.

## Phase 0 — A fixture that looks like a repository

- [ ] **0.1 Author the realistic monorepo fixture before touching the
      detector.** Under `tests/fixtures/stack/` add `mono-pnpm-turbo/` with a
      root `package.json` (`private: true`, `packageManager: pnpm@…`,
      `devDependencies.turbo`), `pnpm-workspace.yaml` listing `apps/*` and
      `packages/*`, `turbo.json` with `build`/`lint`/`test` tasks carrying a
      `description` field, `apps/web/package.json` (react + next), and
      `packages/ui/package.json` (react + `radix-ui`) beside
      `packages/ui/components.json`. Record the pre-state verdict in the
      fixture's `README.md`: `frontend: plain` at `12cb7fe`.
      verify: `npx tsx -e "import {detect_stack} from
      './src/agent-src/templates/scripts/work_engine/stack/detect.ts';
      console.log(detect_stack('tests/fixtures/stack/mono-pnpm-turbo').frontend)"`
      prints `plain` (the documented pre-state) before Phase 1 lands.
- [ ] **0.2 Add the two-root and the Nx variants.** `mono-two-frontends/`
      (root manifest with `workspaces`, `apps/web` react, `apps/admin` vue) and
      `mono-nx/` (root manifest without `workspaces`, `nx.json`, a `project.json`
      under `packages/ui`). The first must end `unknown` with both roots named;
      the second must descend.
      verify: both directories exist and each `README.md` states the expected
      post-Phase-1 verdict and the pre-state verdict measured at HEAD.
- [ ] **0.3 Convert the two existing rows.** Replace the temp-dir builders at
      `ui_lane_matrix.test.ts:241-275` with rows that load the Phase 0
      fixtures, keeping the assertions (`react-shadcn` for the single root,
      `UNSUPPORTED_STACK` + `workspace roots` for the pair). The old shape (no
      root manifest) stays as a third row labelled `greenfield-nested` so the
      scaffold path it protects is still covered.
      verify: `npx vitest run tests/scripts/work_engine/ui_lane_matrix.test.ts`
      fails on the converted rows at HEAD (the detector still returns `plain`)
      and the `greenfield-nested` row passes.

## Phase 1 — Reach the workspace branch when a root manifest exists

- [ ] **1.1 Replace the `mtime === 0.0` guard with a workspace predicate.**
      Introduce `_is_workspace_root(project_root, pkg)` that is true when any
      of: `package.json#workspaces` is a non-empty array, `pnpm-workspace.yaml`
      exists, `turbo.json` exists, `nx.json` exists, `lerna.json` exists. The
      descent at `detect.ts:289-318` runs when that predicate is true **and**
      the root manifest itself carries no frontend marker (a root `package.json`
      that lists `react` in `dependencies` is an app, not a workspace root;
      a root that lists `react` only in `devDependencies` beside a workspace
      declaration is a workspace root with shared test tooling — keep the
      existing priority chain above it untouched and add this devDependencies
      row to the fixture set).
      verify: the three Phase 0 fixtures return `react-shadcn` /
      `UNSUPPORTED_STACK` / `react` respectively, and every pre-existing row in
      `ui_lane_matrix.test.ts` still passes.
- [ ] **1.2 Read `pnpm-workspace.yaml` globs.** `_nested_frontend_roots`
      (`detect.ts:581`) gains the YAML `packages:` list as a second declarative
      source beside `package.json#workspaces`; the head-segment extraction at
      `:592-595` is reused as-is. Parse with the YAML reader the package
      already depends on: `package.json` lists both `yaml` (^2.9.0) and
      `js-yaml` (^5.2.0) at the pinned commit, so no dependency is added; use
      whichever the work-engine templates already import, and if neither is
      imported there, prefer `yaml`.
      verify: a fixture with `pnpm-workspace.yaml` pointing at `libs/*` and no
      `workspaces` key descends into `libs/ui`.
- [ ] **1.3 Add workspace marker files to `_CACHE_KEY_FILES`.**
      `detect.ts:352-356` must list `pnpm-workspace.yaml`, `turbo.json`, and
      `nx.json`, for the same reason `components.json` is there (`:341-350`).
      verify: `grep -n "pnpm-workspace.yaml\|turbo.json\|nx.json" detect.ts`
      shows all three inside `_CACHE_KEY_FILES`.
- [ ] **1.4 Surface the chosen scope.** `StackResult` gains a `scope_root`
      field (absolute path of the workspace that was descended into, or the
      project root when none was). The `unknown` verdict for several roots
      keeps its `ambiguity` string unchanged so `review.ts:35-37` and the
      `unsupported_stack_questions` path keep working by construction.
      verify: `detect_stack('tests/fixtures/stack/mono-pnpm-turbo').scope_root`
      ends in `packages/ui`, and the pre-existing tests that destructure
      `StackResult` compile without edits (`npx tsc -p tsconfig.test.json --noEmit`).

## Phase 2 — Recognise the current shadcn and Base UI surface

- [ ] **2.1 Extend the component-library signal table.** At `detect.ts:470-476`
      add `{ axis: 'component_lib', value: 'radix', npm: ['radix-ui'] }` and
      `{ axis: 'component_lib', value: 'base-ui', npm: ['@base-ui/react',
      '@base-ui-components/react'] }`; `_is_react_shadcn` (`detect.ts:631-646`)
      treats `radix-ui` exactly like the `@radix-ui/` prefix. Base UI without
      `components.json` resolves to `react` with `component_lib: base-ui`, not
      to `react-shadcn` — shadcn-on-Base-UI is identified by `components.json`
      alone, as today.
      verify: the two live-run cases from § Context (`react`+`radix-ui`,
      `react`+`@base-ui/react`) become table rows in `ui_lane_matrix.test.ts`
      and pass.
- [ ] **2.2 Correct the audit prose.** `existing-ui-audit/SKILL.md:91` and
      `:267` say "at the **workspace** root (the package that owns
      `components.json`; in a monorepo this is never the repository root)".
      The shadcn inventory step at `:128` reads `package.json` of the scope
      root from 1.4, not the repository root.
      verify: `grep -n "repo root" src/skills/existing-ui-audit/SKILL.md`
      returns no line that pairs it with `components.json`.
- [ ] **2.3 Hand the compatibility refresh to the sibling.** The
      `react-shadcn-ui/SKILL.md` § Compatibility line (`:48-53`) is stale
      (shadcn 2.1 / Tailwind 3.x / React 18+) but its refresh is owned by
      `road-to-component-library-lifecycle.md` Phase 5 step 5.1, which
      scaffolds and commits the fixture the majors are read from. This roadmap
      only adds the detector-side marker that Phase 5.2 there keys on: the
      `css` axis distinguishes `tailwind-v3` (`tailwind.config.*` present)
      from `tailwind-v4` (`@tailwindcss/vite` dependency or `@import
      "tailwindcss"` in the entry CSS) instead of the single `tailwind` value
      at `detect.ts:470-476`.
      verify: a fixture with `@tailwindcss/vite` resolves `css: tailwind-v4`
      and one with `tailwind.config.ts` resolves `css: tailwind-v3`; no
      version string is written into any skill by this roadmap.

## Phase 3 — Ship the monorepo facts the lane needs

- [ ] **3.1 `monorepo-workspace` skill (new, `engineering-base`).** Read-only
      orientation: detect the package manager from `packageManager` / lockfile;
      list workspaces from the declarative source; print the task runner
      (`turbo` / `nx` / none) and its task list **with the `description` field
      when present** (turborepo.dev/docs/guides/ai, "Task descriptions"); run
      the runner's own project listing (`nx show projects`, `turbo ls`) rather
      than reading config by hand (nx-ai-agents-config `skills/nx-workspace/SKILL.md`,
      "Do NOT read `project.json` directly"). Output is a pointer + digest in the
      `standards-from-config` Class-A shape, never a flattened claim.
      **Decided here, not a blocker:** `turbo` / `nx` are consumer-project
      binaries invoked through the project's own `npx` / `pnpm dlx`, never
      installed by this package; when absent, the skill walks the workspace
      graph from manifests and says so — the posture `react-shadcn-ui`
      already takes for the shadcn CLI (`SKILL.md:31-45`) with
      `missing-tool-handling` as the stop condition.
      verify: the fixture run in a container without `turbo` on PATH still
      prints the workspace list; the skill exists, `./scripts-run src/scripts/check_references`
      is green, and its `evals/triggers.json` has at least one positive
      ("which packages depend on @org/ui") and one negative ("add a button").
- [ ] **3.2 `workspace-link` skill (new).** Harvest the four package-manager
      `workspace:` forms from nx-ai-agents-config
      `skills/link-workspace-packages/SKILL.md` (MIT; record in
      `borrows.jsonl` per ADR-061). The skill refuses the two workarounds the
      source names — `tsconfig` `paths` patches and hand-edited `package.json`
      — and routes "cannot find module @org/*" / TS2307 here.
      verify: `borrows.jsonl` carries the entry with the pinned commit
      `aa363e4`, and the skill's Do NOT section names both workarounds.
- [ ] **3.3 Affected-set carve-out inside `blast-radius-analyzer`.** No new
      rule file (the estate target is 116 → ≤ 50 rules). `blast-radius-analyzer/SKILL.md`
      gains § Monorepo: before editing a file under a workspace that other
      workspaces depend on, name the affected set via the runner (`turbo run
      test --filter=...[HEAD^1]`, `nx affected -t test`) or, with no runner,
      via the reverse-dependency walk over the graph the 3.1 skill prints.
      verify: the section names both runner commands and the manifest-walk
      fallback; `check_references` green; `ls src/rules | wc -l` is unchanged
      by this roadmap.
- [ ] **3.4 Harvest the Turborepo anti-pattern list — selectively.**
      From `Source B (an external monorepo build-tool repo, MIT)` `skills/turborepo/SKILL.md` § Critical
      Anti-Patterns (`:218-735`), take only the rows that a review judge can
      detect by reading a diff: root scripts bypassing turbo (`:250`),
      `prebuild` that builds siblings (`:292`), `&&`-chained turbo tasks
      (`:272`), shared code inside `apps/` (`:693`), `../` traversal in
      `inputs` (`:497`), missing `outputs` on file-producing tasks (`:521`).
      Each lands as a row in a new `docs/guidelines/monorepo-antipatterns.md`
      with the source line cited; the remaining rows are recorded as **not
      harvested** with the reason (needs a running build to observe).
      verify: the guideline has exactly the six rows plus a "not harvested"
      table; `license-compliance-borrow-check` passes on the file.

## Phase 4 — Route the lane through the scope

- [ ] **4.1 Directives read `scope_root`.** `directives/ui/scaffold.ts`,
      `review.ts`, `apply.ts`, `polish.ts` resolve component paths
      (`components/ui/*`, `components.json`, `tailwind` config) relative to
      `state.stack.scope_root`, falling back to the project root when absent.
      verify: the `mono-pnpm-turbo` fixture run through `directives/ui/audit.ts`
      writes `state.ui_audit.shadcn_inventory` from `packages/ui/package.json`
      (assert on the `radix-ui` dependency appearing).
- [ ] **4.2 Ask once when several roots exist.** The `unknown` lane's
      `unsupported_stack_questions` gains a scope question listing the named
      roots; the answer is written back as `scope_root` and the detector is
      re-run against it. No silent pick — the refusal at `detect.ts:240-242`
      remains the contract.
      verify: the `mono-two-frontends` fixture produces a question whose
      options are exactly `web` and `admin`.
- [ ] **4.3 Pack membership.** `monorepo-workspace` and `workspace-link`
      join `engineering-base`; the `typescript` pack
      (`src/packs/typescript/README.md:14`, 1 skill today) gains
      `monorepo-workspace` as a suggestion. Regenerate manifests.
      verify: `./scripts-run src/scripts/generate_pack_manifests --check` and
      `./scripts-run src/scripts/generate_index --check` are both green.

## Blockers

None filed. The two decisions this roadmap raises are taken in-text with
their evidence: the YAML reader (Phase 1 step 1.2 — both `yaml` and `js-yaml`
are already runtime dependencies at the pinned commit) and the runner-binary
posture (Phase 3 step 3.1 — consumer-owned binary with a manifest-walk
fallback, matching `react-shadcn-ui`). If the maintainer disagrees with either,
the step is the place to say so; a blocker would only move a decided question
onto the owner's desk.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: external-session/claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The fix is tested against the shape that was already passing | implementation | The two existing tests build a monorepo with no root manifest; a detector edit that satisfies them can leave M1 intact | Phase 0 authors a realistic fixture and records the `plain` pre-state before any detector change; 0.3 makes the converted rows fail at HEAD | Phase 0 — A fixture that looks like a repository |
| 2 | A root app is mistaken for a workspace root | implementation | Any root `package.json` with `workspaces` triggers descent even when the root itself is the app (Next.js app with a `packages/` folder for tooling) | 1.1 runs the predicate only when the root manifest carries no frontend marker; the priority chain above it is untouched | Phase 1 — Reach the workspace branch when a root manifest exists |
| 3 | Runner-native commands become a hidden dependency | implementation | `nx show projects` / `turbo ls` are the right source of truth but are consumer-side binaries | 3.1 decides the consumer-owned posture and ships the manifest-walk fallback in the same step; the verify runs without `turbo` on PATH | Phase 3 — Ship the monorepo facts the lane needs |
| 4 | The Turborepo skill is harvested whole | product | 951 lines of source guidance pushed additively onto the repo is the exact direction ADR-211 forbids | 3.4 takes six diff-detectable rows and records every other row as not harvested with a reason | Phase 3 — Ship the monorepo facts the lane needs |
| 5 | Two roadmaps edit the same compatibility line | implementation | This roadmap and its sibling both touch `react-shadcn-ui` § Compatibility and drift apart | 2.3 writes no version string and hands the refresh to the sibling's Phase 5 by name; only the detector axis is changed here | Phase 2 — Recognise the current shadcn and Base UI surface |
| 6 | Scope selection asks every time | product | A question on every run in a two-app monorepo is a regression in the lane's economy | 4.2 writes the answer to state; the detector re-reads it before asking again | Phase 4 — Route the lane through the scope |

## Acceptance Criteria

- [ ] AC-1 — A repository with a root manifest that declares workspaces and a
      single frontend workspace resolves to that workspace's stack, and the
      fixture that proves it was committed with its `plain` pre-state recorded
      before the detector changed.
- [ ] AC-2 — A repository with two frontend workspaces resolves to `unknown`
      with both names in `ambiguity`, and the lane asks once, writes the answer,
      and does not ask again on the next run.
- [ ] AC-3 — `radix-ui` and `@base-ui/react` are recognised on the
      `component_lib` axis, and the two live-run cases from § Context are
      committed table rows.
- [ ] AC-4 — No prose in `src/skills/` states that `components.json` lives at
      the repository root.
- [ ] AC-5 — A consumer without `turbo` or `nx` installed still gets a
      workspace list from `monorepo-workspace`, and a consumer with either gets
      the runner's own listing.
- [ ] AC-6 — Every harvested anti-pattern row cites its source line and commit,
      and every source row that was not harvested is listed with the reason.
- [ ] AC-7 — The `css` axis distinguishes Tailwind v3 from v4 by marker
      files, and this roadmap wrote no version string into any skill.
