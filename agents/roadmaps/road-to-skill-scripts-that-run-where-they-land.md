---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "No active or parked roadmap owns this consumer defect: the lint's own allowlist comment calls the repair 'a separate, larger-scope follow-up' and nothing in agents/roadmaps/ carries it. The nearest neighbour, later/road-to-skill-ecosystem-executable-payloads, is parked on spikes about whether prose skills should gain payloads at all, and archiving an unrelated roadmap to buy this slot would hide the defect behind a trade."
relates:
  - slug: road-to-skill-ecosystem-executable-payloads
    relation: disjoint
    note: "Parked on three Phase-0 spikes that measure whether prose skills should gain executable payloads. This roadmap adds no payload and converts no skill; it makes the six entry points that already ship start from the line their own skill teaches. A spike measuring invocation of a command that cannot start measures nothing, so this neither waits on that roadmap nor decides anything for it."
  - slug: road-to-host-primitive-lowering
    relation: disjoint
    note: "Stub. Owns lowering the `<skills-root>` placeholder per host. Nothing here resolves the placeholder; only the runner in front of it changes."
---
# Road to skill scripts that run where they land

> **Source:** `agents/tmp.old/inbox-2026-10-k/` — an external harvest round
> (a transcript, two master plans, four draft roadmaps, a stub, two loop
> revisions and two prototypes). Every anchor below was re-read at `main` @
> `d41121927` on 2026-10-11; the round's own pin was `f76e83e47`, and nothing
> in `f76e83e47..d41121927` touched these files. Class: external harvest
> proposal, verified and reproduced against this tree.

## Goal

The command a shipped skill tells the agent to run starts on a machine that
has only what the installer put there, and the first documented example
returns rows. Each bundled entry point has one runnable form that needs
nothing but `node` at the package's engine floor. The contract that describes
this names files that exist and a test that runs.

## Context

- Twenty consumer-projected skills teach a wrapper the package does not ship.
  `src/scripts/lint_consumer_internal_refs.ts:69-90` allowlists exactly those
  twenty for the `./scripts-run` pattern (`:121-125`); its header says why the
  pattern is a leak — the wrapper is "not shipped — `package.json` `files`
  never lists the repo-root `scripts-run` file" (`:29-30`) — and the allowlist
  comment calls the repair "a separate, larger-scope follow-up" (`:60-67`).
  `package.json` `files` was re-read on this commit: no `scripts-run` entry.
- The wrapper needs what a consumer does not have: it execs
  `node_modules/.bin/tsx`, and `tsx` is a devDependency only.
- The lint reads `SKILL.md` only (`:32`, `:181`). Two reference files teach the
  same skill-script line outside its scope:
  `src/skills/design-intelligence/references/design-languages.md:39` and
  `references/integration-mapping.md:27,41`. **Corrected from reproduction:**
  five further reference files in three other skills (`ai-council`,
  `git-workflow`, `skill-writing`) name `./scripts-run src/scripts/…` — a
  different class (a maintainer script, not a skill script). Widening the lint
  to `references/` without separating the two classes would red on those five.
- The first documented example fails in this tree. Reproduced on 2026-10-11:
  `ground search` without `--domain` over each of the six
  `src/skills/*/data/manifest.json` exits 0 on four and 1 on two —
  `brand` (`Invalid regular expression: /brand\ personality/u: Invalid escape`)
  and `design-intelligence` (`/\#/u: Invalid escape`).
  `src/skills/corpus-grounding/scripts/decision_engine.ts:164-175` ports
  Python's `re.escape`, which escapes every non-word character, and `:191`
  compiles the result with the `u` flag, under which `\ `, `\#` and `\-` are
  invalid escapes (all three confirmed with a bare `new RegExp(…, 'u')`).
- Of the nine files under `src/skills/*/scripts/`, six are entry points
  (`ground`, `tokens`, `check_package_surface`, `shadcn_add`,
  `story_contrast_floor`, `tailwind_config_gen`) and three are library modules.
  The round bundled all nine to single ES modules with no third-party import
  and ran `ground` under plain `node` from an unrelated directory with the
  wrapper's rows; that reading is the round's, not reproduced here.
- The build tool is already here and already guarded: the `build:*` scripts
  call `esbuild` with `--target=node20`, `.github/workflows/tests.yml:134-137`
  rebuilds one committed bundle and fails on a diff, and
  `check_bundle_path_leakage` (`tests.yml:144`) exists because the bundler
  writes build-machine paths into bundle comments. `esbuild` is not a direct
  devDependency.
- A file emitted only into `dist/agent-src/` would be deleted:
  `cleanup_stale` (`src/scripts/condense.ts:591`) removes a projected file with
  no source, and `sync_non_md` (`:654`) copies every non-markdown file under
  `src/skills/` unchanged.
- The contract is stale where it matters. `docs/contracts/skill-bundled-assets.md`
  says "executable Python" (`:18`), names `condense.py` and `install.py`
  (`:27`, `:29`), and is "Locked by `tests/test_skill_bundled_assets.py`"
  (`:20`, `:66`); the beta note extends its window on the same absent file
  (`:10-11`). That file is not in the tree.
- No consumer has reported a failed start. Skills are explicitly invoked
  reference material (ADR-263) and the tree records no observed invocation of
  these lines; the evidence is that the line cannot start, not that someone
  was stopped by it.

## Phase 1 — The control reading

- [x] **1.1 The taught path, checked as installed.** A test installs the
      shipped projection into a temporary home, collects every line in an
      installed `SKILL.md` or `references/*.md` that names
      `<skills-root>/<skill>/scripts/<tool>`, fenced or not, substitutes the
      temporary skills root, and records per line: the runner token, whether
      the target file exists, and whether the runner is on `PATH` in a shell
      holding nothing but `node`. Today every row's runner is absent; the test
      asserts that count.
      verify: `npx vitest run tests/install/skill_script_lines.test.ts -t control --reporter=verbose` -> /✓.*control/
- [ ] **1.2 Each entry point, started once.** The same test starts each of the
      six entry points from an empty temporary directory with one fixture
      argument vector held in the test file, through the form its skill
      teaches. Today all six fail to start; the test asserts six.
      verify: `npx vitest run tests/install/skill_script_lines.test.ts -t entry-points-control --reporter=verbose` -> /✓.*entry-points-control/
- [x] **1.3 The corpus reading.** A test runs `search` without `--domain`
      against each of the six manifests in this tree and asserts the two
      failures named in Context.
      verify: `npx vitest run tests/scripts/skills_corpus_grounding_ground.test.ts -t every-manifest-control --reporter=verbose` -> /✓.*every-manifest-control/

## Phase 2 — The example returns rows

- [ ] **2.1 Keyword detection escapes for the engine it runs on.**
      `_reEscape` escapes only what a `u`-flag pattern treats as syntax. The
      1.3 control flips: all six manifests exit 0 without `--domain`. This
      step ships alone, ahead of Phase 3, because it is a bug in the
      maintainer's own tree too.
      verify: `npx vitest run tests/scripts/skills_corpus_grounding_ground.test.ts -t every-manifest --reporter=verbose` -> /✓.*every-manifest/

## Phase 3 — One runnable form

- [ ] **3.1 A build script beside the ones that exist.** `build:skill-scripts`
      bundles each entry point to `src/skills/<name>/scripts/<tool>.mjs` from a
      fixed working directory with the same `--target=node20` the other
      bundles use, so path comments are relative and identical on every
      machine and the output runs at the `engines.node` floor. The bundler
      becomes a direct devDependency. `sync_non_md` carries the files into the
      projection unchanged; `condense.ts` is not edited.
      verify: `npx vitest run tests/scripts/skill_script_bundle.test.ts` -> 0
- [ ] **3.2 A stale bundle fails a pull request.** The job that rebuilds the
      install bundle rebuilds these and fails on a diff, and the path-leakage
      check reads them. Positive control: the test changes one source line in
      a temporary copy without rebuilding and asserts the diff is non-empty.
      verify: `npx vitest run tests/scripts/skill_script_bundle.test.ts -t stale-control --reporter=verbose` -> /✓.*stale-control/
- [ ] **3.3 The read-only lint counts each script once.**
      `lint_skill_scripts_readonly` walks `scripts/**`; with bundles present it
      would see every mutation primitive twice. The lint skips `*.mjs` that a
      sibling `.ts` produced, and its finding count on the tree is unchanged.
      verify: `npx vitest run tests/scripts/lint_skill_scripts_readonly.test.ts -t bundles-not-double-counted --reporter=verbose` -> /✓.*bundles-not-double-counted/

## Phase 4 — The line the skill teaches

- [ ] **4.1 One form, in skills and references.** Every taught skill-script
      line reads `node <skills-root>/<skill>/scripts/<tool>.mjs …`. The
      placeholder and the sentence that defines it
      (`src/skills/corpus-grounding/SKILL.md:89-90`) stay. The three skills
      that name their script without a line — `js-library-packaging`,
      `storybook-workshop`, `tailwind-engineer` — gain one.
      verify: `npx vitest run tests/install/skill_script_lines.test.ts -t runner-is-node --reporter=verbose` -> /✓.*runner-is-node/
- [ ] **4.2 The allowlist is deleted and the lint reads references for this
      class.** `SCRIPTS_RUN_ALLOWLIST` is removed. The lint's scope gains
      `skills/*/references/*.md` for the skill-script form only
      (`<skills-root>/…/scripts/`); a second pattern refuses
      `node_modules/.bin/tsx` in a consumer skill. The five maintainer-script
      references named in Context are recorded in the test as out of this
      pattern's scope, not silently passed. Positive control: a fixture skill
      carrying the old line in a reference file makes the lint exit 1.
      `corrected-from-reproduction`.
      verify: `npx vitest run tests/scripts/lint_consumer_internal_refs.test.ts -t references-and-allowlist --reporter=verbose` -> /✓.*references-and-allowlist/
- [ ] **4.3 The controls flip.** 1.1 asserts every taught target exists and
      every runner is `node`; 1.2 asserts all six entry points start and exit
      with the code their fixture expects.
      verify: `npx vitest run tests/install/skill_script_lines.test.ts` -> 0

## Phase 5 — A contract that names what exists

- [ ] **5.1 The contract is rewritten against the tree.**
      `docs/contracts/skill-bundled-assets.md` names the TypeScript sources,
      the emitted module, the form of 4.1, the build script of 3.1 and the
      test of 1.1 as its guard. The beta note no longer cites an absent file.
      verify: `npx vitest run tests/install/skill_script_lines.test.ts -t contract-paths-exist --reporter=verbose` -> /✓.*contract-paths-exist/
      Positive control: the path check, run against the contract at
      `d41121927`, reports the lines naming `test_skill_bundled_assets.py`.

## What this roadmap deliberately does not do

- No new skill, no new script, no conversion of a prose skill into a payload.
- No runtime dependency; `dependencies` is unchanged.
- No CLI verb and no host-specific path variable. The placeholder stays;
  lowering it per host belongs to `road-to-host-primitive-lowering`.
- No `requires_skills` declarations for skills that call another skill's
  script. The contract guarantees sibling deployment
  (`skill-bundled-assets.md:46-50`) and no reading shows it failing.
- No exit-code table across the six entry points; no caller failure observed.
- No change to what any script computes, apart from the escaping in 2.1.
- No repair of the five maintainer-script references; they are a different
  class and are recorded, not fixed, by 4.2.

## Acceptance Criteria

- [ ] AC-1 — In a temporary-home install, every skill-script path a shipped
      skill or reference teaches exists and its runner is `node`.
- [ ] AC-2 — Each of the six entry points starts from an empty directory
      through the taught form.
- [ ] AC-3 — `search` without `--domain` exits 0 on all six corpus manifests.
- [ ] AC-4 — No consumer skill or skill reference teaches the skill-script
      line through `./scripts-run` or `tsx`, and the lint that says so carries
      no allowlist.
- [ ] AC-5 — A bundle that does not match its source fails a pull request.
- [ ] AC-6 — Every path in `skill-bundled-assets.md` exists.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | evidence | Ship a single-file `.mjs` per entry point rather than run TypeScript at the consumer | Three start failures (round reading); the `.js` import specifiers only a TypeScript loader rewrites; engine floor 20.11 strips no types | The engine floor rises to a line that strips types and the sources drop `.js` specifiers |
| D2 | reversible-technical | evidence | Commit the bundle under `src/skills/`, not only in the projection | `cleanup_stale` deletes a projected file with no source; `sync_non_md` copies a committed one | Sync gains an emit stage of its own |
| D3 | reversible-technical | evidence | Stability comes from a fixed build directory and the shared `node20` target | The path-leakage gate records the path-comment class; every other bundle targets `node20` | The bundler stops writing path comments |
| D4 | reversible-technical | agent | Keep the `<skills-root>` placeholder; resolve nothing at install time | Project-scope skills are symlinks into the projection, so there is no per-host file to rewrite | A host documents a variable for the skill directory and the lowering stub is promoted |
| D5 | reversible-technical | agent | The harness starts each entry point with a fixture argument vector, not `--help` | The round found a working help path on one of six; `ground search … --help` runs the search | The entry points gain a common help contract |
| D6 | reversible-technical | agent | 2.1 lands before the bundle work | It fails in the maintainer tree today and needs no build change | — |
| D7 | reversible-technical | evidence | Widen the reference scan for the skill-script form only | Reproduction found five maintainer-script references in three other skills that a blanket widening would red | Those references are judged consumer-facing defects by their own roadmap |
| D8 | deterministic | agent | Closure pass 2026-10-11: three `unfalsifiable-verify` listings (1.3, 2.1, 3.3) are `-t` titles the steps themselves add to existing test files; each verify asserts a passing test of that title (`--reporter=verbose` -> `/✓.*<title>/`), so it fails when the title is missing | `closure_scan` on this file: 3 listings, 0 owner questions | A step lands without the named test title |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-11 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Nobody runs these lines | product | No invocation has been observed; the repair may protect a path no consumer takes. | Five small phases with no runtime cost; 2.1 fixes a failure that also occurs in this tree. The parked payloads roadmap keeps the question of whether scripts earn their place. | Phase 1 — The control reading |
| 2 | Committed bundles drift | implementation | A source edit without a rebuild ships old behaviour. | 3.2 fails the pull request, as the install bundle's guard does today. | Phase 3 — One runnable form |
| 3 | The read-only lint reads bundles twice | implementation | `lint_skill_scripts_readonly` walks `scripts/**` and would see each mutation primitive in source and bundle. | 3.3 skips produced bundles and pins the count. | Phase 3 — One runnable form |
| 4 | A generator writes into the working directory | implementation | `tailwind_config_gen` with no arguments writes a config file where it is started. | 1.2 starts every entry point in a temporary directory with an explicit fixture vector. | Phase 1 — The control reading |
| 5 | The reference widening reds unrelated skills | implementation | Five maintainer-script references would match a blanket pattern. | 4.2 scopes the pattern to the skill-script form and records the five. | Phase 4 — The line the skill teaches |

## Provenance

- The round's lesson: tools that run with the one runtime the install already
  proves present, shipped as dependency-free single files (an external skill
  pack), and a format specification's guidance that bundled scripts be
  self-contained.
- No council was consulted.

| Item from the round | Verdict | Where it lands |
|---|---|---|
| Tools run with the one runtime the install proves present | KEEP | Phase 3 |
| Skill-relative invocation that survives install location | FOLD | Phase 4 — the placeholder exists; only the runner changes |
| Runs on the engine floor (loop-2 step 2.3, dropped in loop 3) | FOLD | 3.1 — `--target=node20` |
| One test per shipped tool | CUT | Already true: each of the nine files is imported by a test under `tests/scripts/` |
| Cross-skill relative script paths / `requires_skills` | CUT | Sibling deployment is a contract guarantee |
| Placeholder resolved per host | CUT | Owned by `road-to-host-primitive-lowering` |
| Distinct exit codes for finding and usage error | CUT | No caller failure observed |
| Scripts as a reason to convert more skills | CUT | Owned by the parked payloads roadmap |
