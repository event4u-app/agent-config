# Findings: behavior-vocabulary-close
<!-- completion-review: v1 | reviewed: 2026-10-01 | scope: 6aa403cd42937eedac809a6dec6f903aa3737e3fd0daff4e9ff268169015e0f6 | diff: 44b85bc5b25adde215870a0e0efd51d6894e49a1 | reviewer: r2-fresh-subagent-behavior-vocabulary-close | prompt_hash: 9cc607c5d57342eca6934149cda9373a2c34cd0a7612dc0e6f1609dce563ba23 -->
<!-- {"review-independence":{"review_independence":"single-member","context_relation":"fresh","acceptance_status":"provisional","assurance":"single-pass","reviewers":["r2-fresh-subagent-behavior-vocabulary-close"]}} -->
<!-- evidence-type: v1 | type: current-binding | declared: 2026-10-01 -->

<!-- context-manifest: v1
inputs:
  diff_sha: 44b85bc5b25adde215870a0e0efd51d6894e49a1
  scope_hash: 6aa403cd42937eedac809a6dec6f903aa3737e3fd0daff4e9ff268169015e0f6
  roadmap: agents/roadmaps/road-to-behavior-vocabulary-and-runner-truth.md
  roadmap_hash: 164e41ee77d3257afdefcacdddefdd37bf96ccc67024194adbb4b960aac06527
  ac_hash: 01c83fedc353c1d9b154bba02bae3621956400a8f4049358f225c4d194b88931
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: 2026-10-01T01:31:30Z
-->

| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | medium | src/agent-src/templates/scripts/work_engine/stack/runner.ts:873-879 | `_behavior_scopes` reads `pnpm-workspace.yaml` by matching every YAML sequence item in the whole file (`/^\s*-\s*['"]?([^'"#]+?)['"]?\s*$/`) with no check of the parent key, while its own doc comment states it reads `pnpm-workspace.yaml#packages`. Real pnpm workspace files routinely carry sibling sequences — `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies`, `patchedDependencies` — so `- esbuild` under `onlyBuiltDependencies` is pushed as the workspace scope `esbuild`. Usually this only burns per-scope file reads and consumes the 200-scope cap, but a repo that happens to have a top-level directory of that name gets a `behavior_runners` row whose `scope_root` is not a workspace package at all. The pnpm fixture in stack_runner.test.ts contains only a `packages:` key, so the near-miss is untested. | open | |
| 2 | medium | src/agent-src/templates/scripts/work_engine/stack/runner.ts:402 | `behavior_runners` is now part of the cached `ToolchainResult`, but none of the files it is derived from feed `latest_manifest_mtime` (runner.ts:436-444), which stats only root-level `_MANIFESTS`. Every per-scope read — `packages/*/package.json`, `packages/*/composer.json`, `packages/*/Gemfile` — plus root `behat.yml*`, `cucumber.{js,cjs,mjs,json}`, `requirements.txt`, `features/support/env.rb`, `pnpm-workspace.yaml` and `*.csproj` is invisible to the cache key. Adding Behat to a workspace package therefore does not move `mtime`, so a persisted `toolchain.json` keeps reporting the old (usually empty) behaviour inventory until some unrelated root manifest is touched. The diff declares this hazard explicitly, but only for the narrow project-file-only .NET case (runner.ts:120-131); the axis it ships widens the same gap by an order of magnitude without saying so. | open | |
| 3 | medium | tests/scripts/work_engine/stack_runner.test.ts:96-100 | The new comment justifies the three added labels with "the set is the single source of truth the state schema and these tests validate against", but nothing in the diff validates anything against it: `KNOWN_RUNNERS` and `KNOWN_BEHAVIOR_RUNNERS` are never read by `resolve_toolchain`, by `resolve_behavior_runners`, by `RunnerResult`/`BehaviorRunnerResult`, or by `to_config`, and the only assertions over them are the two set-equality tests in this same block. A label emitted with a typo (`dotnet_test`, `cucumber_js`) or a new detector branch added later would pass the full suite while the "source of truth" set silently stops describing the emitter. The claim creates assurance the code does not carry; the missing piece is a test asserting every emitted `runner` is a member of the matching set. | open | |
| 4 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:693-697 | The `names.length === 1` branch in `resolve_behavior_runners` is unreachable. It only runs when `found.length > 1`, and `_behavior_runners_in_scope` pushes at most one row per label (one `if` per runner; reqnroll/specflow are `if`/`else if`), so two rows in one scope always carry two distinct names. The test named for exactly this case — "the SAME runner matched by two signals is one answer, not a conflict" (stack_runner.test.ts:680) — writes `composer.json` plus `behat.yml`, which the behat branch collapses into a single row before the dedupe is reached, so it exercises the `found.length <= 1` path instead. The branch reads as covered and is not. | open | |
| 5 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:641 | `_dotnet_basis` takes `names.find(...)` over an unsorted `fs.readdirSync(root)`, so on a root carrying more than one project or solution file the emitted `basis` string depends on directory-entry order, which differs between filesystems and after a rename. The same unsorted order reaches `behavior_runners` row order through the glob expansion in `_behavior_scopes`. Both land in `to_config()` and then in the file `write_config` persists, so a config meant to be stable churns for reasons unrelated to the repository. Sorting the listing in both places would make the serialized output deterministic. | open | |
| 6 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:770-771 | `py_text` concatenates `pyproject.toml` and `requirements.txt` with no separator, so a `pyproject.toml` lacking a trailing newline fuses its last token to the first token of `requirements.txt` — the regexes on the following lines are then matched against a string containing a token present in neither file. The sibling helper added in the same diff, `_dotnet_project_text` (runner.ts:843), joins its parts with a newline; two helpers written together disagree about the same concern. | open | |
| 7 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:772 | `/\bbehave\b/` is matched against the full text of `pyproject.toml` plus `requirements.txt` and emits a HIGH-confidence `behave` row. Unlike every sibling signal in this function — `behat/behat`, `@cucumber/cucumber`, `pytest-bdd`, `io.cucumber`, `Reqnroll` — the token is an ordinary English verb, so a `description = "... describes how widgets behave"` line, a comment, or a changelog string inside the manifest produces a false detection at the top confidence tier. A dependency-section lookup (the shape the behat and cucumber-js branches already use) or a tighter anchor would close it. | open | |
| 8 | low | src/agent-src/templates/scripts/work_engine/stack/runner.ts:569 | `_ruby_runners` returns early whenever `Gemfile` is absent, so the `.rspec present` and `spec/spec_helper.rb present` bases below it are only ever reachable in a repository that also has a Gemfile. A Bundler project using `gems.rb`, or a gemspec-only gem that ships `.rspec` and `spec/spec_helper.rb`, reports no rspec row at all. The documentation row added in the same diff (toolchain-resolver.md:52) reads "rspec in Gemfile / .rspec" as if either signal alone were sufficient, and the absence fixture "no Gemfile at all" locks the behaviour in without distinguishing "no Ruby here" from "Ruby, rspec, no Gemfile". | open | |
| 9 | low | src/agent-src/contexts/execution/toolchain-resolver.md:52-54 | The three new resolver-table rows understate what the code detects, so a reader using the table as the contract will mis-predict the resolver. The JVM command column lists only `./mvnw test` and `./gradlew test`, but `_jvm_build` falls back to the ambient `mvn test` / `gradle test` when no wrapper file exists — and that fallback is what two of the junit tests assert. The .NET marker column omits `Directory.Build.props`, which `_dotnet_basis` accepts as a MEDIUM marker, and the Ruby marker column omits `spec/spec_helper.rb`, which `_ruby_runners` accepts as a basis. | open | |

## Reviewer-disclosed contract deviation — recorded, not resolved

Recorded 2026-10-01 by the implementing session, transcribed from the
reviewer's own return envelope. It is here rather than only in a transcript
because it bears on how the independence metadata above should be read, and a
disclosure that lives only in a chat message is not a record.

The prompt's tool allowlist (contract §5) named branch-scoped `git diff` plus
reads of branch-touched files **only**. The reviewer states it exceeded that:
to check assertions the diff makes about the wider tree it ran repo-wide greps
and read four files outside the branch scope — `src/scripts/generate_pack_manifests.ts`,
`src/scripts/lint_eval_freshness.ts`, `src/scripts/lint_skill_trigger_corpus.ts`,
`src/scripts/lint_roadmap_blockers.ts` — and listed `src/skills` and
`agents/roadmaps`. It reports all four checks came back clean and **produced no
finding**, so no row above rests on the extra context. It reports reading
nothing under `agents/runtime/`, no session artifacts, no implementation
history, and not running `git log`.

Two consequences, stated rather than smoothed over:

1. **The blind-review property is weaker than `context_relation: fresh`
   suggests.** The reviewer acquired context the pattern excludes. The
   metadata block is left unedited because it records what was *dispatched*;
   this note records what was *done*.
2. **One finding's blast radius is explicitly unassessed.** The reviewer notes
   that `resolve_behavior_runners` has no production consumer in this diff
   beyond `to_config()`, so finding 2's practical impact depends on how
   `agents/runtime/state/toolchain.json` is consumed — the one surface the
   allowlist forbade, and which it did not read.

The reviewer also states it did not run the test suite, so every row is a
reading of the source rather than an observed failure.

<!-- reviewer fills the table; 0 findings => replace the table with the exact honest-null line per docs/contracts/plan-review-gates.md §2.3 AND change the evidence-type to `honest-null` per docs/contracts/evidence-artifact-types.md §4 -->
