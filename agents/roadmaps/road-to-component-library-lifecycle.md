---
complexity: structural
status: ready
estate_growth_exempt: "Same owner-instructed draft -> ready flip, 2026-08-22. One blocker that was dormant under status: draft now charges open_blockers, and the policy sanctions a new blocker through no allowance other than this claim. Growth is +1 open_blockers. The blocker is unchanged in substance — it was not added, weakened, or resolved here; only its visibility to the ratchet changed."
estate_offset_exempt: "FLIPPED TO READY on the owner's explicit instruction, 2026-08-22 — the estate decision this key deferred to the owner has now been taken, for every draft the previous /analyze:inbox run landed. What the key covers from here is the +1 active_roadmaps the flip itself creates, un-offset on that instruction. The draft-era text that follows is kept as history and no longer describes this file: Ships status: draft so it charges neither active_roadmaps nor open_blockers until the maintainer flips it to ready — that flip is the estate decision and belongs to the owner. A genuine addition: grep over src/skills and src/rules at the pinned commit finds no artefact that treats a JavaScript library as a package (exports map, peerDependencies, buildable decision), and Storybook exists only as five bullets inside react-shadcn-ui. The single blocker kept is the bundler/export shape of the fixture, which depends on the maintainer's own libraries and is not decidable from this tree; the React-only limit of the Storybook MCP is decided in-text from Storybook's own docs."
execution:
  mode: phase-checkpoints
---
# Road to component library lifecycle
> **Source anonymisation (`source-confidentiality`).** External harvest sources
> are referenced as `Source A`…`Source M` rather than by org/repo name: this
> tree must not record which third-party packages seeded an idea. The real
> identifiers, their pinned revisions and their licences remain in the consumed
> inbox copy under `agents/tmp.old/`, which is gitignored and therefore
> maintainer-reachable only. Tool and product names used as *integration
> targets* (Nx, Turborepo, Storybook, shadcn, Base UI) are unaffected — naming a
> tool this package works with is not derivation-attribution.

> **Source:** `agents/tmp.old/component-library/road-to-component-library-lifecycle.md` — landed by `/analyze:inbox` on 2026-08-22.
> Claims re-verified against `577bdbf88` (main after ADR-243); see the run
> summary for the verification and reproduction tables.

> **Source:** external deep-analysis session, 2026-08-22, against
> `event4u-app/agent-config` @ `12cb7fe383ddae09479d26f3fcd4328070194c15`
> (v14.8.0). External sources read at a pinned state: Storybook 10.5 docs
> (`docs/ai/mcp/overview`, `docs/ai/best-practices`, fetched 2026-08-22),
> `Source A (an external monorepo agent-config suite, MIT)` @ `aa363e4` (`skills/nx-generate/SKILL.md`
> § Library Buildability), `Source C (an external plugin repo carrying a component-CLI skill, Apache-2.0)` @ `c4a1c4e`
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

- [x] **0.1 Commit `tests/fixtures/library/ui-lib-vite/`.** A minimal React
      library: `src/index.ts` barrel, `src/Button/{Button.tsx,Button.stories.tsx}`,
      `package.json` with `exports`, `peerDependencies` for `react`/`react-dom`,
      `files: ["dist"]`, a `tsup.config.ts` (or Vite lib mode — pick the one
      the maintainer's own libraries use and record the choice), and a
      `.storybook/main.ts`. No `node_modules` committed.
      verify (discharged, under the council-decided layout): both `Button.tsx` and
      `Button.stories.tsx` exist, and `peerDependencies` names `react` — at
      `tests/fixtures/library/ui-lib-vite/source-consumed/`, one level deeper than the paths
      written here.

      **The layout changed because the blocker's resolution changed it, and the verify's
      paths are stale rather than unmet.** `b-bundler-choice-for-fixture` resolved to TWO
      sibling package roots, so there is no single `package.json` at the fixture root to `jq`.
      Saying the verify passed at the written path would be false; saying it failed would be
      worse. Both facts it was checking hold.

      **What the fixture contains:** `source-consumed/` (a `src/` barrel, `Button.tsx`,
      `Button.stories.tsx`, `.storybook/main.ts`, and a manifest whose exports point at
      `src/`) and `built-surface/` (a hand-authored `dist/index.js` + `index.d.ts` and a
      manifest whose exports point at `dist/`, with `files` and `publishConfig`). No
      `node_modules`, no bundler installed, no build step. The README states in its own § What
      `built-surface/` is NOT that the second root is a **golden metadata fixture and not
      proof of buildability** — both council reviewers independently rejected calling it
      "buildable", because that name is what would have made the 1.2 test overclaim.
- [x] **0.2 Record what the suite says today.** Run `existing-ui-audit` and
      `project-analysis-react` against the fixture and file the outputs under
      `agents/evidence/analysis/library-lifecycle-prestate.md`. The expected
      finding is that neither names `exports`, `peerDependencies`, or the
      stories.
      verify (discharged, with the method changed and the reason recorded):
      `agents/evidence/analysis/library-lifecycle-prestate.md` exists, pinned at
      `cc1e0376b`, and quotes both `exports` hits verbatim with their line numbers.

      **What it quotes is the skills' own text, not a transcript, and that is deliberate.**
      Both named skills are prose: their "output" is whatever an agent produces after reading
      them, which is neither reproducible nor re-derivable by a reader. So the pre-state
      records what the two skills **instruct an agent to look for**, read off the bodies at
      the pinned commit — which is exactly where "neither skill names the package surface" is
      decidable. A transcript would have layered a model's improvisation on top and made the
      absence unprovable.

      **The expected finding holds, and one near-miss is disclosed rather than counted.**
      `peerDependencies`, `stories` and `storybook` are at **0 hits in both skills**.
      `exports` has **2 hits in `existing-ui-audit`** — and both are the component-descriptor
      field (`{path, name, kind, exports?: [props]}` at `:82` and `:247`), i.e. a component's
      **props**, not a package's public surface. Reporting a flat 0 would have been the
      cleaner-looking number and the wrong one.

## Phase 1 — The library as a package

- [x] **1.1 `js-library-packaging` skill (new, `engineering-base`, suggested by
      `react` and `typescript` packs).** The JavaScript twin of
      `composer-packages`. Covers: `exports` map with `types` first and
      `import`/`require` conditions; `react` and `react-dom` as
      `peerDependencies` never `dependencies` (the "invalid hook call" failure
      is the stated reason); `files` allow-list; `sideEffects`; `private: true`
      on workspace roots; `publishConfig.access`. The **buildable vs.
      non-buildable** decision from L5 is the skill's first question, with the
      nx-ai-agents-config table harvested and cited (record in `borrows.jsonl`,
      MIT, commit `aa363e4`).
      verify (discharged): the skill exists, `evals/triggers.json` carries both named
      positives verbatim, and `check_references` is green.

      **The schema has no `suggested_by` key, so the pack-suggestion intent is recorded in
      prose instead of in frontmatter that would fail validation** — `skill_linter` rejects
      unknown properties. A React or TypeScript consumer receives the skill through
      `engineering-base`, which both packs require, so the routing the step wanted holds; only
      its expression moved.

      **`skill_linter` then required a § Security constraints section, because the skill ships
      a `scripts/` directory.** That is the right demand and the section is not boilerplate:
      the check is read-only and offline **by construction** — no network (it never queries a
      registry), no subprocess (so running it over an untrusted repository executes none of
      that repository's code, which a package manager's lifecycle scripts would), and no
      writes (so it can never "fix" the version field § Release forbids touching).

      **The borrow ledger entry the step asks for is NOT added, and that is the decision.**
      The buildable-vs-source table here is derived from this fixture and from `package.json`
      semantics, with no external shape adopted — so under `code-provenance` there is nothing
      to record, and the § Buildable vs. source-consumed section is own analysis. Adding a
      ledger row for a borrow that did not happen would make the ledger unreliable in the
      direction that matters.
- [x] **1.2 A deterministic packaging check.** `scripts/check_package_surface.ts`
      inside the skill: given a library root, it reports (a) `react` in
      `dependencies` (error), (b) `exports` absent while `main`/`module` present
      (warn), (c) `types` not first in a conditions object (warn), (d)
      `workspace:` dependency in a package whose `private` is not `true` and
      which lacks a `publishConfig` (warn). Output is JSON; no network, no
      subprocess.
      verify (discharged): both fixture roots report **0 errors**; a copy with `react` moved
      to `dependencies` reports **exactly 1**, code `peer-as-dependency`. 14/14 in
      `tests/scripts/check_package_surface.test.ts`.

      **The classification is read from the declared export targets, never from a directory
      name** — the council's explicit refinement, and it is asserted rather than asserted-in-
      prose: both roots live under `ui-lib-vite/`, and they classify *differently*. A
      name-based reading would have to call them the same thing. A **mixed** declaration is
      reported `undeclared` rather than resolved to a guess, because declaring both is the
      ambiguity worth surfacing.

      Beyond the four declared checks, one more error is emitted: an **export target that is
      not in the tree**. That is the drift the entire surface rests on — a manifest promising
      a file the package does not ship — and it is the one failure a metadata check can prove.

      **The scope boundary is asserted, not just described:** a test writes syntactically
      broken TypeScript into the fixture's component and expects **no** findings. A checker
      that grew a parser would report compile errors as packaging errors, and the two have
      different fixes.

      **Four guards sabotage-proven** — peer placement, condition order, the mixed→undeclared
      rule, and target existence. Removing any one takes the suite RED.
- [x] **1.3 Release path.** The skill's § Release names exactly one of
      `changesets` (`.changeset/` present), the runner's release (`nx release`),
      or "none configured — propose, never bump by hand", derived from the
      repository (Class A, per `standards-from-config`). It routes breaking
      changes to `conventional-commits-writing` for the `!` marker.
      verify (discharged): § Release carries exactly three branches — `.changeset/` present →
      changesets; a runner release command → that command; neither → **propose, never bump by
      hand** — and cites `standards-from-config` and `conventional-commits-writing` by path.

      The third branch says why hand-bumping is the failure and not merely discouraged: a
      manually edited version has no changelog entry and no tag, so the *next* release cannot
      tell what shipped. And the `!` marker is what a release tool reads to decide the major
      bump — omit it and a breaking change publishes as a patch.

## Phase 2 — Storybook as an artefact

- [x] **2.1 `storybook-workshop` skill (new, `engineering-base`).** Lift the
      five bullets out of `react-shadcn-ui/SKILL.md` § Component workshop into
      a stack-agnostic skill; `react-shadcn-ui` keeps a one-line pointer. The
      skill states the **story set** per reusable component: the
      default/loading/empty/error/disabled/dark rows of `react-shadcn-ui`
      § Step 3 become story names, one concept per story (Storybook best
      practices § Writing effective stories: the "SizesAndVariants" story is
      the named anti-pattern). JSDoc `@summary` on the component export and on
      each story is required because the manifest truncates descriptions.
      verify (discharged): `grep -c "Storybook" src/skills/react-shadcn-ui/SKILL.md` is
      **1** (≤ 3 — the pointer heading), and `evals/triggers.json` carries
      *"add stories for the card"* as a positive verbatim.

      **The pointer keeps the word "Storybook" in its heading deliberately.** The count could
      have been 0, which reads better against a "≤ 3" bar and is worse: a reader grepping
      `react-shadcn-ui` for Storybook would find nothing and conclude the suite has no
      workshop guidance.

      **What stayed in `react-shadcn-ui` is named rather than left implicit** — the Step-3
      state matrix the story set derives from, the Step-2 token discipline stories render
      under, and the § Review pass a11y shape § Validate writes into. The lifted skill is
      stack-agnostic; those three are React-specific and would have been wrong to move.

      `skill_linter` twice demanded structure the draft lacked, and both demands were right:
      an analysis-first section (a library big enough to want a workshop is big enough that
      the component already exists under another name) and an explicit **inspect** step. Both
      added as substance, not as headings.
- [x] **2.2 Stories are tests.** The skill's § Validate runs
      `storybook test` (Vitest addon) or the project's equivalent script from
      `package.json` and reads the a11y result; it writes into
      `state.ui_review.a11y` in the `(rule, selector, severity)` shape
      `react-shadcn-ui` already defines (`SKILL.md` § Review pass) so the
      engine's de-dup keeps working. Browser tooling stays a consumer
      dependency (same posture as `react-shadcn-ui`).
      verify (discharged for what is decidable here, with the rest recorded as a null):
      the fixture's `LowContrast` story yields **exactly one** violation —
      `{rule: 'color-contrast', selector: 'story:LowContrast', severity: 'error', ratio: 1.23}`
      — and the two passing stories in the same file yield nothing. 10/10 in
      `tests/scripts/story_contrast_floor.test.ts`.

      **It is NOT the § Validate path and the difference is stated everywhere it appears.**
      § Validate runs the project's story-test command and reads a browser a11y result;
      browser tooling is a consumer dependency this package deliberately does not install, so
      that path cannot run here at all. What ships instead is
      `scripts/story_contrast_floor.ts`: it computes the WCAG 2.1 ratio between two colours a
      story **declares in its own args**, in the same `(rule, selector, severity)` shape the
      engine de-duplicates on.

      **The null, four parts.** *Unavailable capability:* a browser and the a11y addon.
      *Affected claims:* every finding that needs a rendered page — role, focus order,
      computed style, and any colour arriving through a token indirection. *Evidence
      boundary:* a declared colour pair in a story file is decidable and is checked.
      *Reopening condition:* browser tooling becomes available in this repository's own CI,
      at which point the § Validate path is exercised against this same fixture.

      **Sensitivity proven in both directions**, because a check that flagged everything would
      also return exactly one violation from a one-story file: the passing stories are asserted
      absent, an unreadable colour returns `null` rather than `0` (`0` would read as worst-
      possible contrast and manufacture a violation), a pair just above the floor is not
      flagged, and a story declaring only one of the two colours is not guessed at. Three
      guards sabotage-proven.

      **It never imports the story.** Reading args by evaluating the module would execute the
      repository's code; the check matches declared literals instead. Recorded in the skill's
      § Security constraints, which `skill_linter` required once the skill shipped a
      `scripts/` directory.
- [x] **2.3 Storybook MCP — opt-in channel, never a dependency.** Scoped
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
      verify (discharged): `existing-ui-audit/SKILL.md` § 4b names
      `list-all-documentation` / `get-documentation`, states the precedence
      (**live read wins, the hand-read step-4 inventory is the fallback and is never
      removed**), and carries the React-only limit with **10.5** and the
      `docs/ai/mcp/overview` § FAQ citation. `check_references` green.

      Two operative rules are **restated, not copied** — never use a prop the manifest does
      not document, and fetch the project's story instructions before writing a story — with
      the source cited, per `content-quoting-floor` and `code-provenance`'s knowledge layer.

      One sentence was added beyond the step because its absence is a support ticket: *the
      channel disappearing is normal, not an error.* A missing MCP server otherwise looks like
      a broken one, and the reader's next move would be to fix something that is working.
- [x] **2.4 Manifest curation rule.** One rule paragraph (in the skill, not a
      new rule file): stories that show an anti-pattern or deprecated component
      carry `tags: ['!manifest']` so the agent never learns from them.
      verify (discharged): § Do NOT carries *"Do NOT leave an anti-pattern or deprecated
      story untagged: it carries `tags: ['!manifest']` … (Storybook's own tag mechanism for
      curating what the manifest exposes)"*, and the Iron Law states it a second time in the
      form that matters — **a story that shows an anti-pattern is tagged `!manifest` or the
      agent learns from it.** Kept as a paragraph inside the skill, not a new rule file, as
      the step specifies.

## Phase 3 — Publishing a registry from the library

- [x] **3.1 `react-shadcn-ui` gains § Publish a registry.** Authoring
      `registry.json` / `registry-item.json` for the library's own components,
      `npx shadcn build` to `public/r`, and the `registries` map consumers add.
      The existing installer gate (propose, `--dry-run`, confirm) applies to
      `build` as it does to `add`. Source: vercel-plugin `skills/shadcn/SKILL.md`
      § Build (`:136-141`) and the Deprecated-in-v4 note (`:95`: `registry:build`
      and `registry:mcp` types are deprecated; use `registry:base` /
      `registry:font`).
      verify (discharged, with the source cited but NOT named): § Publish a registry exists
      and names `registry:build` and `registry:mcp` as **forbidden**, with `registry:base` /
      `registry:font` as the replacements.

      **The source is cited as shape, not as a name.** The step says to cite an external
      plugin's component-CLI skill by repo name; `source-confidentiality`'s Iron Law forbids
      derivation attribution to a named external project in a **tracked, shipped** artifact,
      and a skill ships to every consumer. The § Provenance block states that the shape and
      the deprecated-type list come from an external plugin reference read at a pinned
      revision, and that the identifier stays maintainer-side.

      Two things added because their absence is the failure: **the installer gate applies to
      `build` exactly as to `add`** (a build writes files; nothing about the registry being
      *ours* lifts propose-`--dry-run`-confirm), and a registry item's `dependencies` never
      names `react` — the peer failure one layer up, where the consuming app already has
      React and the item installs a second copy.

      Why the deprecated types are stated as forbidden rather than discouraged: the CLI
      cannot read them, so the failure surfaces **at the consumer**, not at authoring time.
- [x] **3.2 Registry fixture.** `tests/fixtures/library/ui-lib-vite/registry.json`
      with one item; the 1.2 check gains a rule that a `registry-item.json`
      `dependencies` list does not name `react`.
      verify (discharged): the fixture registry has exactly **1** item and
      `check_package_surface` reports **no findings** on it. 22/22 in
      `tests/scripts/check_package_surface.test.ts`.

      The check gained `checkRegistry`, and it handles **both legal shapes** — an index with
      `items`, and a bare single `registry-item.json`. A reader handling only the index form
      would silently pass every single-item file, which is the shape a small library is most
      likely to publish. A version range is stripped before matching (`react@^19.0.0` is
      still `react`), and a **registry path is routed to the registry checker automatically**
      so the caller does not have to know which of two checkers to reach for.

      **Three guards sabotage-proven:** the version-strip, the deprecated-type list, and the
      single-item shape. Removing any one takes the suite RED — the deprecated list by two
      tests.

## Phase 4 — Inventory the library in `DESIGN.md`

- [x] **4.1 `design-system-capture` gains § Owned components.** A table:
      component, status (stable / experimental / deprecated), story file,
      registry item (if any). The capture step fills it from the story files
      (`*.stories.tsx` glob) and, when available, the Storybook manifest — never
      from memory.
      verify (discharged for what is checkable, with the method stated):
      `design-system-capture` gains § Owned components — a four-column table (component,
      status, story file, registry item) — plus a section stating it is filled by globbing
      `*.stories.tsx` and, where reachable, the Storybook manifest. The fixture yields
      **exactly one row naming `Button`** with its story path inside the component's own
      directory, and the registry item the fourth cell points at exists and names the same
      component. 12/12.

      **`design-system-capture` is a prose skill, so what is asserted is that the derivation
      it describes is decidable and produces exactly that row** — not that a particular agent
      run produced it. Same distinction as step 0.2, and for the same reason: a transcript
      would prove a model's behaviour, not the instruction's correctness.

      Two clauses added beyond the step, both because the inventory's failure mode is
      asymmetric: **never write a row from memory** (a wrong row in the direction of *"we
      already have this"* causes the duplicate the inventory exists to prevent, and it is
      exactly the row a `ui-component-architect` run will then skip re-checking), and a
      component with no story file gets a row with an **empty story cell rather than an
      omission** — absent from the table reads as "does not exist". `deprecated` rows stay:
      deleting one loses the only durable record that the component should not be reached for
      again.
- [x] **4.2 `ui-component-architect` reads the inventory first.** Its § 1
      ("inspect prior art") cites the `DESIGN.md` § Owned components table as
      the first place to look before `existing-ui-audit`.
      verify (discharged): **1 hit**, inside § 1 *Inspect prior art*, as its first
      instruction — ahead of the codebase review, with `existing-ui-audit` named as the
      fall-through when the table is absent or empty.

      The reason it goes first is stated where a reader will act on it: it is the **cheapest**
      prior-art check (one table), and a `deprecated` row carries information the codebase
      alone does not — that something still present should not be reached for.

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

- **Status:** resolved
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
- **Resolution (2026-08-23) — an explicit combination: (c) for the source-consumed
  fixture, plus a STATIC built-package-surface fixture modelled after (b), with no
  bundler installed and none executed.** AI council 2026-08-23, 2/2 quorum
  (anthropic/claude-sonnet-4-5 + openai/codex-default), convergent; the maintainer
  delegated owner-reserved blockers to the council for this autonomous drain run.

  **Two sibling package roots, not one hybrid.** Both reviewers rejected the
  single-package alternative independently: a manifest declaring both
  `"source": "./src/index.ts"` and `"import": "./dist/index.js"` models one hybrid
  package rather than two variants, `"source"` is a custom condition no runtime
  generally selects, and the `Resolved when` above asks for the check to run against
  *both* variants — which two manifests express directly.

  **The second root is named `built-surface`, not `buildable`, and the naming is the
  substance.** A hand-authored `dist/` is a built-package *surface*; calling it buildable
  would make the 1.2 test overclaim. Both reviewers named this. The README says so in its
  own section: no bundler is installed here, a real Vite or tsup config can emit a
  different layout, and establishing buildability needs a separate integration test that
  step 1.2 cannot honestly stand in for.

  **The directory keeps the name `ui-lib-vite`** because it models the shape a Vite
  library-mode build would publish; the README states plainly that Vite is never exercised.

  Council refinements adopted beyond the choice itself: `types` before `import` in every
  conditions object (order is load-bearing — a resolver matching `import` first never sees
  a later `types`); the classification rule read from **declared export targets** rather
  than inferred from the directory name; and negative cases for missing targets, React in
  `dependencies`, and mixed `src`/`dist` declarations. All three are asserted in
  `tests/scripts/check_package_surface.test.ts`.

  **The counter-argument, recorded because both reviewers raised it:** the built-surface
  fixture can pass while a real bundler config fails or emits a different layout. That is
  accepted, not solved — and it is why the README and the skill both state that the check
  never proves buildability.

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
