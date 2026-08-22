<!-- evidence-type: analysis -->

---
status: final-research-synthesis
source_pin: 12cb7fe383ddae09479d26f3fcd4328070194c15
source_version: 14.8.0
research_date: 2026-08-22
refinement_loops: 5
---

# AC React, Component Library, Playbook & Monorepo — deep research synthesis

## Executive conclusion

The missing capability is not “React support” or “monorepo support” in isolation. AC already has both in fragments. The missing capability is a **closed, machine-readable delivery loop** that connects:

`workspace -> package -> public API -> component catalogue -> existing usages -> design/token contract -> story/playbook states -> edit -> targeted verification -> affected consumers -> release surface`

Today these concerns live in separate skills and prose:

- `src/skills/existing-ui-audit/SKILL.md` inventories components, one dominant design system, tokens, broad reusable-pattern buckets and five similarity candidates.
- `src/skills/project-analysis-react/SKILL.md` understands component tree, state, hooks and rendering behavior.
- `src/skills/project-analyzer/SKILL.md` recognizes monorepo shapes and can describe module public APIs.
- `src/skills/module-management/SKILL.md` has a Node-monorepo carve-out.
- `src/scripts/_lib/module_detection.ts` recognizes `packages`, `apps` and `modules` roots heuristically.
- `src/skills/react-shadcn-ui/SKILL.md` already has a small Storybook “component workshop” carve-out and browser/a11y verification.
- token and UI-track work already exists in archived roadmaps and must be reused rather than recreated.

The weakness is that the knowledge above is **not composed into operational state**. A UI change can therefore know that components exist yet still fail to know which workspace owns them, which package exports them, which consumers depend on them, which story captures the intended state, what public API is stable, or which packages/tests need verification after a change.

The final plan is deliberately split into four roadmaps:

1. `road-to-workspace-graph-intelligence.md` — deterministic workspace/package/public-API/affected graph.
2. `road-to-component-library-intelligence.md` — component catalogue, layered design systems, usage/dependent evidence and reuse ranking.
3. `road-to-component-playbooks-and-workshop.md` — stories/compositions/docs/playbooks as executable component contracts and evidence.
4. `road-to-react-monorepo-delivery-loop.md` — integration into the normal AC work loop, including targeted verification and release impact.

The sequence matters: **workspace graph -> component intelligence -> playbook/workshop -> delivery-loop integration**.

## Current AC findings at pin `12cb7fe3` / v14.8.0

### What AC already does well

AC already has a strong resource-first UI posture. `existing-ui-audit` explicitly says project code outranks screenshots and external recommendations, searches for components and tokens before styling, detects common React design systems, records candidate reuse targets, and can preserve an accessibility baseline. This should remain the front door.

The React shadcn skill is materially stronger than a generic React prompt: it understands semantic tokens, registry metadata, local primitives, state coverage, dark mode, a11y, browser rendering and Storybook when the library is large enough. The roadmap therefore does **not** create another shadcn-specific layer.

`project-analyzer` already recognizes monorepo signals such as `apps/* + packages/* + turbo.json / nx.json / pnpm-workspace`, and its module analysis template contains a `Public API` section. This proves the vocabulary already exists in AC. The gap is executable representation and consumption.

AC also already has token work and component-oriented guidance. The archived shared-token roadmap demonstrates that AC understands build-time token generation, drift checks and framework-independent token sources. New work should consume token provenance instead of introducing another token schema.

### Structural gaps

#### 1. Filesystem inventory is not a workspace graph

The Node carve-out in `module-management` assumes a `packages/` root and validates with `npm test --workspace=<pkg>`. The lower-level detector recognizes a few conventional parent directories but does not parse the package manager’s actual workspace declaration, package exports, peer dependencies, task runner graph, or package-to-package consumers.

This is insufficient for:

- pnpm workspace globs and `workspace:` dependencies,
- npm/yarn/bun workspace declarations,
- Nx `apps`/`libs`/package projects and tags,
- Turborepo package/task topology,
- nested domain libraries,
- public `exports` subpaths,
- package boundary changes,
- affected-consumer verification.

#### 2. Component inventory is too shallow for a real component library

`existing-ui-audit` currently captures `{path, name, kind, exports?}`, a single `design_system`, token buckets, broad pattern buckets, and top-five fuzzy candidates. For large shared libraries AC also needs:

- workspace/package ownership,
- source entrypoint and package export path,
- public vs internal component status,
- props/type surface and variants,
- peer/runtime dependency posture,
- importers/dependents and representative usage sites,
- story/composition coverage and named states,
- test/a11y/visual evidence,
- docs/playbook links,
- token references and aliases,
- deprecated/replacement metadata where available,
- API-change/release impact.

#### 3. “Stop at the first design system” is wrong for modern monorepos

A monorepo can legitimately contain a custom design system built on Radix or React Aria, a legacy MUI app, and a shadcn-based internal tool. The dominant-system scalar should become a scoped, layered model: project/package/surface plus foundation/wrapper/brand layers.

#### 4. React analysis is behavior-aware but package-contract blind

`project-analysis-react` does good component/state/hooks/render reasoning but does not join that graph to package exports, consumers, stories, design-system contracts or release scope. It should consume the new workspace/component artefacts rather than absorb all of that logic itself.

#### 5. Existing evidence is not reused deeply enough

Storybook stories, MDX, play functions, visual baselines, tests and existing component docs already encode component states and intent. AC should **extract and reuse** those states rather than regenerate an imagined state matrix from the prompt.

### Important non-goal learned from AC's own history

Do **not** revive a general native source-code graph as a hard prerequisite. AC already tried the broader native code-intelligence route and recorded an honest-null result: its successor roadmap reports native graph retrieval recall below disciplined grep and left the capability default-off.

The workspace graph in these roadmaps is intentionally narrower and higher-confidence:

- manifests and workspace configuration,
- package dependencies,
- declared package exports,
- explicit task-runner metadata when present,
- bounded import evidence for public-boundary checks.

It makes **no call-graph or semantic-symbol-retrieval claim**.

## External reference corpus and what AC should extract

### Nx

Sources:
- https://nx.dev/docs/kb/folder-structure
- https://nx.dev/docs/features/enforce-module-boundaries
- https://nx.dev/docs/features/explore-graph
- https://nx.dev/docs/features/ci-features/affected
- https://nx.dev/docs/templates/react

Extract, do not require:
- a project graph is the correct unit for understanding workspaces;
- affected scope should follow dependency edges rather than “test everything”;
- UI, feature, data-access and util boundaries are useful classification hints, not mandatory naming;
- dependency edges should be explainable;
- applications can remain thin while libraries carry reusable behavior;
- architecture constraints should be read when a repo declares them.

AC must remain provider-neutral: use native Nx JSON/CLI output when already installed, otherwise derive the minimal manifest graph itself.

### pnpm workspaces

Sources:
- https://pnpm.io/workspaces
- https://pnpm.io/catalogs
- https://pnpm.io/filtering

Extract:
- `pnpm-workspace.yaml` is authoritative for pnpm workspace membership;
- `workspace:` dependency intent matters and must not be normalized away;
- catalogs centralize dependency-version intent;
- cycles and workspace-level dependency behavior should be visible;
- filtering is an existing targeted-execution primitive when pnpm is present.

Do not force pnpm onto npm/yarn/bun workspaces.

### Turborepo

Sources:
- https://turborepo.com/docs
- https://turborepo.com/docs/crafting-your-repository/structuring-a-repository
- https://turborepo.com/docs/crafting-your-repository/creating-an-internal-package
- https://turborepo.com/docs/crafting-your-repository/configuring-tasks

Extract:
- packages/apps are graph nodes;
- task dependencies and cache inputs matter for validation scope;
- internal packages need explicit boundaries/entrypoints;
- use Turbo's own task graph/filtering if present, never make Turbo a dependency.

### Storybook

Sources:
- https://storybook.js.org/docs/writing-stories
- https://storybook.js.org/docs/writing-docs
- https://storybook.js.org/docs/9/writing-tests/interaction-testing
- https://storybook.js.org/docs/writing-tests/visual-testing
- https://storybook.js.org/docs/writing-tests/integrations/stories-in-unit-tests
- https://storybook.js.org/docs/writing-tests/integrations/stories-in-end-to-end-tests

Extract:
- stories are structured, reproducible component states;
- `play` functions can be executable interaction evidence;
- stories can be reused from Vitest/Testing Library/Playwright instead of duplicating fixtures;
- visual testing and interaction testing answer different questions;
- Autodocs/MDX are useful component usage sources;
- Storybook is an adapter, not a required AC dependency.

### Bit

Sources:
- https://bit.dev/reference/components/component-anatomy/
- https://bit.dev/reference/compositions/compositions-overview/
- https://bit.dev/reference/dependencies/inspecting-dependencies/
- https://bit.dev/docs/design/component-libraries/

Extract concepts, not the platform:
- component = source + public API + dependencies + configuration + artefacts + metadata;
- dependents/“who consumes this” are first-class;
- compositions capture variations for testing, visualization and discoverability;
- a component catalogue should make public API and dependency impact discoverable.

### Style Dictionary / DTCG

Sources:
- https://styledictionary.com/info/tokens/
- https://styledictionary.com/info/architecture/
- https://styledictionary.com/reference/config/

Extract:
- tokens are hierarchical and can alias other tokens;
- source/include/provenance and transforms matter;
- the audit should preserve alias/provenance rather than flattening every token to a final value;
- DTCG-compatible sources should be read, not rewritten into an AC-specific token vocabulary.

### React Aria / mature headless libraries

Sources:
- https://react-spectrum.adobe.com/react-aria/
- https://react-spectrum.adobe.com/react-aria/getting-started.html

Extract:
- a design system can be layered: accessibility behavior primitives underneath project-specific styling/components;
- public component contracts should distinguish foundation primitives from branded wrappers;
- do not infer “custom or none” merely because a project does not use shadcn/MUI.

### Changesets

Sources:
- https://github.com/changesets/changesets
- https://github.com/changesets/changesets/blob/main/docs/adding-a-changeset.md

Extract:
- a shared library change may have a release contract independent of application code;
- AC should detect and follow the repository’s existing release mechanism;
- do not create a Changeset automatically unless the repo convention and change classification require it.

## Five refinement loops

### Loop 1 — baseline decomposition

Initial hypothesis: create one “React/Monorepo super skill”.

Rejected. It would repeat AC’s historic tendency to collect unrelated behavior in a single prose surface and would make simple React edits expensive.

Result:
- split workspace topology from component semantics;
- preserve `existing-ui-audit` as UI entrypoint;
- make integration lazy and capability-driven.

### Loop 2 — external pattern harvest

Nx, pnpm, Storybook, Bit and Style Dictionary changed the plan in five ways:

1. workspace **graph**, not folder list;
2. component **dependents**, not only dependencies;
3. story/composition **states**, not screenshots alone;
4. token **provenance/aliases**, not only flattened values;
5. **affected** verification, not broad repo-wide commands by default.

Result:
- Roadmaps 1–3 became separate producer layers;
- targeted verification became a first-class output of the graph.

### Loop 3 — AC-native integration pass

Re-read AC’s current React pack, `existing-ui-audit`, `project-analysis-react`, `project-analyzer`, module detection and archived token/UI roadmaps.

Corrections:
- Storybook support is not absent; it is narrow and shadcn-local. Generalize the workshop concept instead of duplicating it.
- Monorepo detection is not absent; it is shallow and non-operational. Extend it into a contract rather than adding another detector.
- token intelligence already exists. Extend provenance/alias consumption rather than creating a new token system.
- keep current resource-first/source-priority rules.

Result:
- new artefacts are additive and referenced by existing skills;
- no duplicate “React v2” skill.

### Loop 4 — adversarial / failure-mode pass

Challenged the plan with likely failure modes:

- A generic code graph would repeat AC’s measured code-intelligence miss.
- Requiring Storybook would punish apps without a component workshop.
- Requiring Nx/Turbo would turn AC into a task-runner installer.
- putting full component graphs into `state` would create context bloat.
- first-match design-system detection would misclassify mixed monorepos.
- auto-generating playbooks would create stale documentation.
- “affected” can under-test if graph confidence is low.

Corrections:
- manifest graph only, no symbol-call claims;
- provider adapters are optional;
- large artefacts live on disk, state carries compact summary + path/checksum;
- confidence and source are attached to graph edges;
- playbooks are read-first/update-existing-first;
- low-confidence affected scope expands conservatively.

### Loop 5 — acceptance, measurement and rollout pass

Final pass converted features into measurable contracts.

Added:
- fixture corpus covering pnpm, npm/yarn/bun, Nx, Turbo, nested libraries, mixed design systems, Storybook/no-Storybook and Changesets/no-Changesets;
- graph parity checks against native Nx/Turbo output when those tools exist;
- reuse benchmark: existing-component retrieval must beat current fuzzy-only candidate ranking;
- false-negative safety for affected verification;
- context-budget check for compact state envelopes;
- rollout order and “honest null” exits where a new heuristic does not beat current behavior.

## Final target architecture

```text
Repository truth
  |
  +-- workspace manifests/config
  |      -> workspace-graph.json
  |          packages / apps / libs
  |          dependency + export edges
  |          task runner + release hints
  |
  +-- component source + exports + usages
  |      -> component-catalog.json
  |          public/internal
  |          props/variants
  |          dependents/use sites
  |          token refs
  |
  +-- stories / compositions / docs / tests
         -> component-contract evidence
             states
             interactions
             visual/a11y/test evidence
             usage + migration guidance

Normal AC work loop
  inspect target workspace
    -> find reusable components
    -> decide reuse / compose / extend / net-new
    -> make change in owning package
    -> verify component contract
    -> verify affected consumers
    -> update release artefact only when repo convention requires
    -> report evidence + impact
```

## Success metrics

The programme should not be judged by “more skills”. It succeeds when measured on a fixture and real-project corpus:

- component-reuse retrieval recall improves materially over the current top-five fuzzy matcher;
- the agent chooses the correct owning workspace/package before editing;
- public API changes identify known consumers;
- targeted verification covers every known affected workspace and does not run unrelated work when confidence is high;
- story/playbook state reuse reduces duplicated test setup;
- mixed design systems are scoped correctly instead of collapsed to one scalar;
- context cost remains bounded because full graphs/catalogues are lazy artefacts;
- no new mandatory runtime daemon, framework, Storybook, Nx, Turbo, pnpm, Bit or release tool is introduced.
