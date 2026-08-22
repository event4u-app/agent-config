---
complexity: structural
status: draft
estate_offset_exempt: "Ships status: draft so it charges neither active_roadmaps nor open_blockers until the maintainer flips it to ready — that flip is the estate decision and belongs to the owner. A genuine addition: grep over src/skills and src/rules at the pinned commit finds no artefact that treats a JavaScript library as a package (exports map, peerDependencies, buildable decision), and Storybook exists only as five bullets inside react-shadcn-ui. The single blocker kept is the bundler/export shape of the fixture, which depends on the maintainer's own libraries and is not decidable from this tree; the React-only limit of the Storybook MCP is decided in-text from Storybook's own docs."
execution:
  mode: phase-checkpoints
---
# Road to component library lifecycle

> **Source:** `agents/tmp.old/component-library/road-to-component-library-lifecycle.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external deep-analysis session, 2026-08-22, against
> `event4u-app/agent-config` @ `12cb7fe383ddae09479d26f3fcd4328070194c15`
> (v14.8.0). External sources read at a pinned state: Storybook 10.5 docs
> (`docs/ai/mcp/overview`, `docs/ai/best-practices`, fetched 2026-08-22),
> `nrwl/nx-ai-agents-config` @ `aa363e4` (`skills/nx-generate/SKILL.md`
> § Library Buildability), `vercel-labs/vercel-plugin` @ `c4a1c4e`
> (`skills/shadcn/SKILL.md` § Build, § View/Info/Docs), and the
> `ui.shadcn.com/docs/monorepo` page. Inverted harvest (ADR-211 C/D): phases
> start from confirmed gaps in this tree. Anything marked **proposal** is this
> session's design, not an adopted foundation. Depends on
> `road-to-monorepo-scope-and-detection.md` Phase 1 step 1.4 (`scope_root`)
> for the library root; until that lands, "library root" means the project
> root.

## Goal

The package knows what a **component library** is as a unit of work, not only
what a component is. When this is finished: a library package has a lifecycle
the suite can reason about — its public surface (`exports` map, `peerDependencies`,
buildable vs. source-consumed), its workshop (Storybook as a first-class
artefact with stories that an agent can read and run, and the Storybook MCP as
an opt-in channel that replaces guessing with querying), and its release
(changesets or the runner's release command, never a hand-bumped version).
The existing `ui-component-architect` / `react-shadcn-ui` / `design-tokens`
chain is extended at its seams, not duplicated; every "new" claim is pinned to
a fixture library committed under `tests/fixtures/`.

## Context

Confirmed at the pinned commit:

- **L1 — no artefact treats a library as a package.** `grep -rli
  "changesets\|changeset\|peerDependencies\|exports map\|tsup\|library mode"
  src/skills src/rules` returns zero skill or rule that covers a publishable
  or workspace-consumed React library. The `typescript` pack lists one skill,
  `project-analysis-node-express` (`src/packs/typescript/README.md:14`); the
  `react` pack lists three (`src/packs/react/README.md:14-16`) and none is about
  packaging. `composer-packages` exists for PHP
  (`src/skills/composer-packages/SKILL.md:4`); its JavaScript twin does not.
- **L2 — Storybook is a paragraph, not an artefact.** The only procedural
  Storybook guidance is `react-shadcn-ui/SKILL.md` § "Component workshop
  (Storybook) — when the library is large enough" (five bullets), pointed at
  from `docs/guidelines/component-oriented-and-oop-development.md:87-94`. It is
  reachable only through the `react-shadcn` lane; a Vite + React library
  without shadcn (stack `react`) never sees it. No trigger, no eval, no story
  format, no test run.
- **L3 — Storybook's agent surface is absent.** Storybook 10.5 ships
  `@storybook/addon-mcp` with three toolsets (`docs`, `development`,
  `testing`), generated component manifests, and an explicit `AGENTS.md`
  recommendation ("Never hallucinate component properties… query
  `list-all-documentation` / `get-documentation`"). `grep -rn "addon-mcp\|manifest"
  src/skills/react-shadcn-ui src/skills/fe-design src/skills/existing-ui-audit`
  returns nothing Storybook-related. The `existing-ui-audit` inventory
  (`SKILL.md:128`) reads `package.json` and `components/ui/*.tsx` by hand, which
  is precisely the "paste the source into the prompt" path Storybook's docs
  describe as failing at design-system scale.
- **L4 — `react-shadcn-ui` does not know the registry build.** The skill
  covers consuming registries (`SKILL.md` § Registry & MCP awareness) but not
  **publishing** one: `npx shadcn build` / `registry.json` / `registry-item.json`
  authoring (vercel-plugin `skills/shadcn/SKILL.md` § Build (Custom Registry), `:136-141`) is the
  mechanism by which a team's `packages/ui` becomes installable into other
  apps. An internal library that wants `npx shadcn add @acme/data-table` has no
  guidance.
- **L5 — buildable vs. non-buildable is not a named decision.**
  `ui-component-architect` decides component shape; nothing decides whether
  the library ships `dist/` or source. nx-ai-agents-config
  `skills/nx-generate/SKILL.md:55-75` § Library Buildability states the rule the
  suite lacks: default non-buildable for internal monorepo libs, buildable only
  for publishing / cross-repo / cache hits, ask when unclear.
- **L6 — `DESIGN.md` has no component inventory slot.**
  `design-system-capture/SKILL.md:115-120` § Stack and conventions names the
  primitive library but not the **owned** components, their status
  (stable/experimental/deprecated), or where their stories live — the facts a
  consuming app's agent needs before it invents a second `DataTable`.

Already present and reused: `ui-component-architect` (shape), `react-shadcn-ui`
§ Step 3 state-coverage matrix (the story set is derived from it),
`design-tokens` (3-layer DTCG model, `SKILL.md:48-60`), `accessibility-auditor`
(the a11y verdict stories are checked against), `dependency-upgrade`
(stack-agnostic upgrade procedure the release step cites), `mcp` skill
(MCP configuration).

## Phase 0 — A library fixture and its pre-state

- [ ] **0.1 Commit `tests/fixtures/library/ui-lib-vite/`.** A minimal React
      library: `src/index.ts` barrel, `src/Button/{Button.tsx,Button.stories.tsx}`,
      `package.json` with `exports`, `peerDependencies` for `react`/`react-dom`,
      `files: ["dist"]`, a `tsup.config.ts` (or Vite lib mode — pick the one
      the maintainer's own libraries use and record the choice), and a
      `.storybook/main.ts`. No `node_modules` committed.
      verify: `ls tests/fixtures/library/ui-lib-vite/src/Button` lists both
      files and `jq .peerDependencies tests/fixtures/library/ui-lib-vite/package.json`
      names `react`.
- [ ] **0.2 Record what the suite says today.** Run `existing-ui-audit` and
      `project-analysis-react` against the fixture and file the outputs under
      `agents/evidence/analysis/library-lifecycle-prestate.md`. The expected
      finding is that neither names `exports`, `peerDependencies`, or the
      stories.
      verify: the evidence file exists and quotes the two skill outputs with
      the pinned commit.

## Phase 1 — The library as a package

- [ ] **1.1 `js-library-packaging` skill (new, `engineering-base`, suggested by
      `react` and `typescript` packs).** The JavaScript twin of
      `composer-packages`. Covers: `exports` map with `types` first and
      `import`/`require` conditions; `react` and `react-dom` as
      `peerDependencies` never `dependencies` (the "invalid hook call" failure
      is the stated reason); `files` allow-list; `sideEffects`; `private: true`
      on workspace roots; `publishConfig.access`. The **buildable vs.
      non-buildable** decision from L5 is the skill's first question, with the
      nx-ai-agents-config table harvested and cited (record in `borrows.jsonl`,
      MIT, commit `aa363e4`).
      verify: the skill exists with an `evals/triggers.json` whose positives
      include "publish our ui package" and "why does my hook say invalid hook
      call", and `./scripts-run src/scripts/check_references` is green.
- [ ] **1.2 A deterministic packaging check.** `scripts/check_package_surface.ts`
      inside the skill: given a library root, it reports (a) `react` in
      `dependencies` (error), (b) `exports` absent while `main`/`module` present
      (warn), (c) `types` not first in a conditions object (warn), (d)
      `workspace:` dependency in a package whose `private` is not `true` and
      which lacks a `publishConfig` (warn). Output is JSON; no network, no
      subprocess.
      verify: run against the 0.1 fixture → 0 errors; run against a copy with
      `react` moved to `dependencies` → 1 error.
- [ ] **1.3 Release path.** The skill's § Release names exactly one of
      `changesets` (`.changeset/` present), the runner's release (`nx release`),
      or "none configured — propose, never bump by hand", derived from the
      repository (Class A, per `standards-from-config`). It routes breaking
      changes to `conventional-commits-writing` for the `!` marker.
      verify: § Release has the three branches and cites both skills by path.

## Phase 2 — Storybook as an artefact

- [ ] **2.1 `storybook-workshop` skill (new, `engineering-base`).** Lift the
      five bullets out of `react-shadcn-ui/SKILL.md` § Component workshop into
      a stack-agnostic skill; `react-shadcn-ui` keeps a one-line pointer. The
      skill states the **story set** per reusable component: the
      default/loading/empty/error/disabled/dark rows of `react-shadcn-ui`
      § Step 3 become story names, one concept per story (Storybook best
      practices § Writing effective stories: the "SizesAndVariants" story is
      the named anti-pattern). JSDoc `@summary` on the component export and on
      each story is required because the manifest truncates descriptions.
      verify: `grep -c "Storybook" src/skills/react-shadcn-ui/SKILL.md` drops
      to a pointer-only count (≤ 3), and the new skill's trigger eval fires on
      "add stories for the card".
- [ ] **2.2 Stories are tests.** The skill's § Validate runs
      `storybook test` (Vitest addon) or the project's equivalent script from
      `package.json` and reads the a11y result; it writes into
      `state.ui_review.a11y` in the `(rule, selector, severity)` shape
      `react-shadcn-ui` already defines (`SKILL.md` § Review pass) so the
      engine's de-dup keeps working. Browser tooling stays a consumer
      dependency (same posture as `react-shadcn-ui`).
      verify: the 0.1 fixture with a deliberately low-contrast story yields one
      `a11y_violation` entry through this path.
- [ ] **2.3 Storybook MCP — opt-in channel, never a dependency.** Scoped
      to the `react` / `react-shadcn` lanes by decision, not by blocker:
      Storybook's `docs/ai/mcp/overview` § FAQ states the docs toolset is
      React-only while in preview, so the skill says so in one sentence and
      routes Vue / Angular / Web Components to the file-read inventory. A
      § "MCP path" mirrors the shadcn one in `react-shadcn-ui` § Registry & MCP
      awareness: when the project has `@storybook/addon-mcp` and a running
      Storybook, `existing-ui-audit` prefers `list-all-documentation` /
      `get-documentation` over the hand-read inventory at `SKILL.md:128`; the
      live read wins, the file read is the fallback. The AGENTS.md block from
      Storybook's docs is **not** copied verbatim — its two operative rules
      (never use an undocumented prop; fetch story instructions before writing a
      story) are restated as two bullets with the source cited.
      verify: `existing-ui-audit/SKILL.md` names the MCP tools, the
      precedence rule, and the React-only limit with the Storybook docs
      version (10.5) in one paragraph; `check_references` green.
- [ ] **2.4 Manifest curation rule.** One rule paragraph (in the skill, not a
      new rule file): stories that show an anti-pattern or deprecated component
      carry `tags: ['!manifest']` so the agent never learns from them.
      verify: the skill's § Do NOT contains the `!manifest` line with the
      Storybook docs cited.

## Phase 3 — Publishing a registry from the library

- [ ] **3.1 `react-shadcn-ui` gains § Publish a registry.** Authoring
      `registry.json` / `registry-item.json` for the library's own components,
      `npx shadcn build` to `public/r`, and the `registries` map consumers add.
      The existing installer gate (propose, `--dry-run`, confirm) applies to
      `build` as it does to `add`. Source: vercel-plugin `skills/shadcn/SKILL.md`
      § Build (`:136-141`) and the Deprecated-in-v4 note (`:95`: `registry:build`
      and `registry:mcp` types are deprecated; use `registry:base` /
      `registry:font`).
      verify: the section exists and names the two deprecated registry types
      as forbidden with the source cited.
- [ ] **3.2 Registry fixture.** `tests/fixtures/library/ui-lib-vite/registry.json`
      with one item; the 1.2 check gains a rule that a `registry-item.json`
      `dependencies` list does not name `react`.
      verify: `jq '.items | length' …/registry.json` prints `1` and the check
      passes on it.

## Phase 4 — Inventory the library in `DESIGN.md`

- [ ] **4.1 `design-system-capture` gains § Owned components.** A table:
      component, status (stable / experimental / deprecated), story file,
      registry item (if any). The capture step fills it from the story files
      (`*.stories.tsx` glob) and, when available, the Storybook manifest — never
      from memory.
      verify: running the capture against the 0.1 fixture writes a one-row
      table naming `Button` and its story path.
- [ ] **4.2 `ui-component-architect` reads the inventory first.** Its § 1
      ("inspect prior art") cites the `DESIGN.md` § Owned components table as
      the first place to look before `existing-ui-audit`.
      verify: `grep -n "Owned components" src/skills/ui-component-architect/SKILL.md`
      returns one hit inside § 1.

## Phase 5 — Refresh the compatibility surface once, measured

- [ ] **5.1 Scaffold, do not assert.** In a throwaway directory run
      `npx shadcn@latest init -d --template vite` and `npx storybook@latest
      init --yes`; commit the resulting `package.json` files under
      `tests/fixtures/stack/shadcn-current/` and
      `tests/fixtures/stack/storybook-current/`. The majors that came out are
      the only versions any skill in this roadmap may state.
      verify: both fixture `package.json` files exist and
      `react-shadcn-ui/SKILL.md` § Compatibility quotes majors equal to theirs.
- [ ] **5.2 Tailwind v4 consistency.** `react-shadcn-ui/SKILL.md` references
      `tailwind.config.{js,ts}` and `theme.extend.colors` (§ Gotcha, § Step 2)
      while `design-intelligence/data/stacks/html-tailwind.csv:53` already
      teaches v4 syntax. The skill gains a v3/v4 branch keyed on the `css` axis
      value the sibling roadmap's detector emits (`tailwind-v3` /
      `tailwind-v4`, `road-to-monorepo-scope-and-detection.md` Phase 2 step
      2.3); token reading in `existing-ui-audit:128` follows the same key
      (v4: `@theme` block in the entry CSS; v3: `theme.extend` in the config).
      verify: both skills name the axis value they branch on; the 5.1 scaffold
      fixture resolves to the branch that matches its own files.

## Blockers

### blocker: b-bundler-choice-for-fixture

- **Status:** open
- **Owner:** maintainer
- **Blocks:** Phase 0 step 0.1, Phase 1 step 1.2.
- **What to do:** pick exactly one — (a) `tsup` (single config, ESM+CJS+dts);
  (b) Vite library mode (already the bundler of the maintainer's apps); (c)
  non-buildable source export (no bundler; the consumer compiles).
- **Recommendation:** **(c) as the fixture default, (b) as the buildable
  variant.** It mirrors the nx-ai-agents-config rule (non-buildable unless
  publishing) and keeps the fixture free of a build step the test container
  would have to run.
- **If you do nothing:** the fixture is authored with whichever bundler the
  first implementer prefers, and the packaging check in 1.2 is tuned to that
  bundler's output layout rather than to `package.json` semantics.
- **Resolved when:** the fixture `README.md` states the choice and the 1.2
  check runs against both the source-export and the buildable variant.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-22 | reviewer: external-session/claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | A second component skill | product | `storybook-workshop` drifts into re-stating `ui-component-architect` and `react-shadcn-ui`, the estate grows, the ratchet fires | 2.1 lifts existing text out of `react-shadcn-ui` rather than adding beside it; the verify asserts the old section shrinks | Phase 2 — Storybook as an artefact |
| 2 | MCP becomes the only path | implementation | Agents that cannot reach a running Storybook, or that work on a non-React renderer, lose the inventory entirely | 2.3 keeps the file-read inventory as the fallback, states precedence explicitly, and names the React-only limit with its source | Phase 2 — Storybook as an artefact |
| 3 | Versions asserted from blog posts | implementation | Writing "Storybook 10 / Tailwind 4 / shadcn CLI 4" from reading repeats the stale-pin defect this roadmap corrects (the shadcn 2.1 / Tailwind 3.x line at `react-shadcn-ui/SKILL.md:48-53`) | 5.1 allows only majors that came out of a committed scaffold | Phase 5 — Refresh the compatibility surface once, measured |
| 4 | The packaging check over-fires | implementation | A warn on every `main`-only package makes the check ignored | 1.2 reserves `error` for the one failure that breaks at runtime (`react` in `dependencies`); everything else is `warn` | Phase 1 — The library as a package |
| 5 | Registry publish is used to push code out silently | implementation | `shadcn build` writes to `public/r`, and a later `add` fetches it over the network | 3.1 puts `build` behind the same propose/dry-run/confirm gate as `add`; `lethal-trifecta-guard` already names the egress leg | Phase 3 — Publishing a registry from the library |
| 6 | `DESIGN.md` inventory goes stale | product | A table filled once by hand is wrong by the second sprint | 4.1 fills it from the story glob / manifest on every capture run, never by hand | Phase 4 — Inventory the library in `DESIGN.md` |

## Acceptance Criteria

- [ ] AC-1 — A library fixture is committed and the suite's pre-state output
      against it is filed before any skill changed.
- [ ] AC-2 — A skill names `peerDependencies`, the `exports` map, and the
      buildable decision, and a deterministic check errors when `react` sits in
      `dependencies`.
- [ ] AC-3 — Storybook guidance is reachable from the `react` lane, not only
      `react-shadcn`, and the story set is derived from the state-coverage
      matrix that already exists.
- [ ] AC-4 — A low-contrast story produces an `a11y_violation` in the same
      state shape the engine already de-duplicates.
- [ ] AC-5 — The Storybook MCP is opt-in, has a stated fallback, and states the
      React-only limit with its source.
- [ ] AC-6 — `react-shadcn-ui` can publish a registry through the same gate it
      uses to install one, and names the deprecated registry types.
- [ ] AC-7 — `DESIGN.md` carries an owned-components table that is generated,
      and `ui-component-architect` reads it first.
- [ ] AC-8 — Every version stated in the touched skills equals a major in a
      committed scaffold fixture.
