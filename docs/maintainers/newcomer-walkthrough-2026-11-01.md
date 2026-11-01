# Newcomer walkthrough — 2026-11-01

A newcomer installed, used and uninstalled Agent Config using **only** the docs-site
source (`agent-config-docs-sell/site/src/content/docs/`), starting at `index.mdx` and
following the Get started pages. The site had not been deployed yet.

## Setup

- Package: local checkout packed like a release, `npm pack` with scripts (prepack ran
  the full build) → `event4u-agent-config-19.1.0.tgz` (17.9 MB, 4,259 files).
- Installed with `npm install -g --prefix <walk>/prefix <tarball>`. `<walk>/prefix/bin/agent-config`
  was used wherever the site says `npx -y @event4u/agent-config`.
- `HOME=<walk>/home` (throwaway), project = a fresh git repo `<walk>/project` with two
  small JS files and one test.
- Headless: no browser, so the **Headless / CI** tab of the Install page was followed.
  Tools: `--tools=claude-code,cursor` (the page's own example).
- Node v26.7.0, macOS.

## Outcome

| Goal | Reached using only the site? |
|---|---|
| Install | **Yes** — headless path worked first time (`init --yes --global --tools=…`, exit 0). |
| First task without a model | **No first task qualifies.** Every first task on the site (`/work`, `/implement-ticket`, `@production-validator`, `/review:changes`, `/commit`) needs an AI tool and model. Closest offline steps the site offers were used instead: `doctor` (Install page) and `code-graph map` / `ask` / `tests-for` (home page card → Code map page). Both ran. |
| Clean uninstall | **Mostly.** `uninstall --global --purge` removed all recorded files and hooks. Leftovers remain in the repository and in `HOME` (see below). Some are documented and some are not. |

Wall-clock command time: pack 10 s · npm install 6 s · install dry-run 1 s · install 14 s ·
doctor 4 s · code-graph map 8 s · ask + tests-for ~2 s · uninstall dry-run <1 s · uninstall
--purge 1 s · project uninstall <1 s (error) · npm uninstall + rm settings 2 s.
Total from first command to clean-up: **214 s** (including reading the pages between steps).

## Findings

Severity: **blocker** = a newcomer cannot proceed · **confusing** = proceeds, but the site
and the tool disagree, or the tool does something the site does not prepare them for ·
**nit** = cosmetic or wording.

| # | Stage | Time | Finding | Severity | Page:line |
|---|---|---|---|---|---|
| 1 | First task | — | No first task works without an AI tool and model, and the site does not say so or offer an offline "try it" step. The only offline actions (`doctor`, `code-graph map`, the demo map) are on other pages. A newcomer evaluating headless has nothing to do after install. | confusing | getting-started/first-task.mdx:8-12 |
| 2 | First task (code-graph) | 8 s | Every `code-graph` command prints `package-local tsx not found — falling back to npx tsx` and then `npm warn exec … tsx@4.23.15 will be installed`. `tsx` is only a `devDependency`, so a release install downloads it from the registry at runtime. This contradicts "Nothing beyond the install … no running service" and would fail with `--offline` or on an air-gapped machine. The warning's own fix (`npm install -g @event4u/agent-config`) does not help. | confusing | features/code-map.md:37 |
| 3 | First task (code-graph) | 8 s | Side effects in `HOME` during the map run, most likely from the `npx tsx` fallback: `~/Library/Caches/node-gyp/` (3,431 files, Node 26.7.0 headers) and `~/Library/Caches/com.apple.python/` (python3 invoked). The Requirements page says "Python is not required". Attributed by timestamp only, not verified. | confusing | getting-started/requirements.md:21 |
| 4 | First task (code-graph) | 1 s | `code-graph ask "who calls sum"` returned `0/0 shown`, but `createInvoice` calls `sum` in the same file. Its `next:` hint is `grep -rn -- 'who calls sum' .`, which greps the question text, not the symbol. `tests-for createInvoice` worked correctly. | confusing | features/code-map.md:29-33 |
| 5 | First task (code-graph) | — | Output ends `render check: unverified — @playwright/test is not installed (a devDependency)`. That is maintainer jargon a consumer cannot act on. | nit | features/code-map.md:16 |
| 6 | Install (doctor) | 4 s | `doctor` exits **2** right after a successful install. The output has no summary line saying what failed. The only problems are four ⚠️ lines, all optional (git identity, MCP consent, telemetry, `.gitattributes`). A newcomer, or a CI script following the Headless tab, reads exit 2 as a failed install. | confusing | getting-started/installation.mdx:63-67 |
| 7 | Install (doctor) | 4 s | `doctor` **writes into the repository**: it creates untracked, not-gitignored `agents/reports/neighbour-scan.json`. The site says a global install writes nothing into the repo apart from `agents/overrides/` and gitignored files, and presents `doctor` as a check. Uninstall does not remove this file. | confusing | getting-started/installation.mdx:16; introduction.mdx:39 |
| 8 | Install (doctor) | 4 s | Several `doctor` fixes point at files a consumer does not have: `npx tsx src/scripts/sync_gitattributes.ts` and "copy `agents/templates/.ai-council.yml.example`". Three checks say "run `agent-config init` to create a project lockfile", which contradicts the site's "installs once into your user-level configuration, not into your repository". | confusing | getting-started/installation.mdx:42 ("names … the command that fixes it") |
| 9 | Install (doctor) | 4 s | `global-binary: on PATH (/opt/homebrew/bin/agent-config)` reports a different binary from the one being run (`<walk>/prefix/bin/agent-config`). The version matched only by coincidence. | nit | getting-started/installation.mdx:66 |
| 10 | Install (doctor) | 4 s | `doctor` runs the real third-party CLIs it detects (codex, gemini, copilot) under the user's `HOME`. They left `~/.codex/tmp/…`, `~/.gemini/projects.json.*.tmp` and `~/Library/Caches/copilot/` behind. The site does not mention this. | nit | getting-started/uninstall.md:49-53 |
| 11 | Install (doctor) | 4 s | The output is about 80 lines of internal vocabulary ("layer-form shadow decision", "hook carrier … stripped environment", "neighbours: 319 skill(s)", where the package's own skills are counted as neighbours). It does not read as "lists anything missing". | nit | getting-started/installation.mdx:42 |
| 12 | Install (dry-run) | 1 s | The page says "Preview what would be written". The dry-run prints only the two target directories and a plan summary, not the files. | nit | getting-started/installation.mdx:51-55 |
| 13 | Install (dry-run) | 1 s | The dry-run says `wizard: Suppressed (--no-ui flag set)`, but `--no-ui` was not passed (`--dry-run` was). It also prints Python-style `False`. | nit | getting-started/installation.mdx:71 |
| 14 | Install | 14 s | The install output prints host-budget lines for augment, cline and windsurf, which were not selected, and reports `cursor — 0 package-owned` although 376 Cursor files were written. Jargon such as `[ADR-007]` and "flat-command discovery workaround" appears too. | nit | getting-started/installation.mdx:57-61 |
| 15 | Install (`--project`) | — | `agent-config init --project` is promised on three pages to "create just that folder and nothing else". On the packed release it (a) also writes `.gitattributes`, and (b) errors `template not found: …/node_modules/@event4u/src/config/gitignore-block.txt` (the path is missing the `agent-config/` segment), so the gitignore block is never written. The bookkeeping files the site calls "gitignored" are therefore not gitignored. `--project` is also missing from `init --help`. Tested in a second throwaway repo and HOME. | confusing | getting-started/installation.mdx:16; introduction.mdx:39 |
| 16 | Uninstall (dry-run) | <1 s | "Prints every file and key it would remove". It prints one summary line per tool ("~/.claude/ preserved") and no file or key list. | nit | getting-started/uninstall.md:16-20 |
| 17 | Uninstall | 1 s | File counts disagree between stages: install reported 881 Claude / 376 Cursor files, the purge dry-run 873 / **378**, and the real purge 873 / 376. A newcomer cannot tell whether 8 Claude files were left behind. None were, according to `find`. | nit | getting-started/uninstall.md:30 |
| 18 | Uninstall (repo) | <1 s | The page says to run `agent-config uninstall` without `--global` inside the repository. For a global-only user (the default path) this exits **1** (`no project lockfile … pass --force`). It also does not remove `agents/reports/` (doctor) or `agents/map/` (code-graph). | confusing | getting-started/uninstall.md:38-45 |
| 19 | Uninstall (leftovers) | — | After `--purge`, `~/.claude/settings.json` remains as `{}`. The install created this file because it did not exist before, so the empty file is a leftover. Empty `~/.claude/` and `~/.cursor/` folders also remain, both created by the install. This matches "never the tool's folder itself", but it is worth saying that the install creates them. | nit | getting-started/uninstall.md:30 |
| 20 | Uninstall (leftovers) | — | After `rm -rf ~/.event4u/agent-config` as instructed, an empty `~/.event4u/` remains. The page calls this folder "your settings", but it held only bookkeeping (`deployed-files.json`, `install-log.jsonl`, `state/`). | nit | getting-started/uninstall.md:51 |
| 21 | Uninstall | — | The Uninstall page does not mention `agents/map/`, which the Code map page writes into the repository. A user who ran the home page's "Map your code" card has to find it alone. | confusing | getting-started/uninstall.md:38-47; features/code-map.md:16 |
| 22 | npm install | 6 s | `npm install -g` warns `install-scripts … (prepare: [ -d .git ] && bash src/scripts/install-hooks.sh …) not yet covered by allowScripts`. This is a maintainer `prepare` script visible to every consumer installing on npm ≥ 11. | nit | getting-started/installation.mdx:11 |
| 23 | Links | — | Every internal link and anchor on all 44 pages resolves, checked against `src/content/docs`, generated slugs from `docs-manifest.json`/`gen-cli-reference.mjs`, and `public/` (`/agent-config/demo-map/`). No dead links. | — | all |

## Leftovers after uninstall

`find <walk>/home <walk>/project -newer <tarball>`, excluding `.git/` and npm's own `~/.npm`,
after `uninstall --global --purge`, `npm uninstall -g` and `rm -rf ~/.event4u/agent-config`:

| Path | Origin | What the Uninstall page says |
|---|---|---|
| `~/.claude/settings.json` (`{}`), empty `~/.claude/`, empty `~/.cursor/` | install | Tool folder is never deleted. The file the install created is not mentioned. |
| `~/.event4u/` (empty) | install | "Delete that folder" (the child), which leaves the parent. |
| `project/agents/map/` (≈20 files incl. `.build/`) | `code-graph map` | Not mentioned. |
| `project/agents/reports/neighbour-scan.json` | `doctor` | Not mentioned; contradicts "writes nothing into your repository". |
| `~/.codex/tmp/…`, `~/.gemini/*.tmp`, `~/Library/Caches/copilot/` | `doctor` host detection | Not mentioned. |
| `~/Library/Caches/node-gyp/`, `~/Library/Caches/com.apple.python/`, `~/.npm/_npx/` | `code-graph` `npx tsx` fallback (attributed by timestamp) | Not mentioned. |

Every file the install recorded (873 + 376) is gone, the Claude hooks and listing
overrides were removed, and `installed.lock` was deleted, as the page claims.

## Top fixes, in order

1. Ship `tsx` as a runtime dependency, or bundle `code-graph`, so the offline commands the
   site advertises are actually offline (#2, #3).
2. Make `doctor` read-only and exit 0 when only optional warnings remain, with a one-line
   summary. Replace the maintainer-path fix commands (#6, #7, #8).
3. Fix the `gitignore-block.txt` path in `init --project` and add `--project` to `--help` (#15).
4. Add a "Try it without a model" step to Your first task (`doctor`, `code-graph map`, the
   demo map) (#1).
5. Uninstall page: name `agents/map/` and `agents/reports/`, and say that the repo-scope
   `uninstall` is only for project installs (#18, #21).

## Dispositions

Re-checked against a fresh `npm pack` (scripts on) of the fixed tree, installed with
`npm install -g --prefix <tmp>` under a throwaway `HOME`, with `npm_config_offline=true`.

| # | Disposition | Files |
|---|---|---|
| 1 | **Fixed (docs).** The First task page now says up front that the task runs in the AI tool on its model and that Agent Config calls none, and offers one offline step: `code-graph map --open`, plus the hosted demo map. `code-graph map --demo` is **not** offered: on a release it exits 1, because `tests/fixtures/code-graph/demo` is not in `files[]` (new finding, recorded below). | `site/src/content/docs/getting-started/first-task.mdx` |
| 2 | **Fixed.** `code-graph` now runs from a shipped, unsplit bundle `dist/cli-delegate/code_graph/cli.js` (`build:code-graph-delegate`, part of `build:delegates`, so `prepack` builds it). The dispatcher maps `src/scripts/code_graph/cli.ts` to it. The bundle's banner flags a direct run and hides `argv[1]` from the maintainer CLIs inlined beside it (same pattern as the MCP and hook bundles). Paths that counted `..` from the module now resolve through `resolvePackageRoot`, so the vendored grammars, the map viewer and the extractor fingerprint are found from the bundle. Verified offline on the packed release: `map`, `tests-for`, no `tsx` message, nothing under `~/.npm/_npx`. | `package.json`, `src/scripts/_dispatch.bash`, `src/scripts/code_graph/{cli,loader,build,map,map_area_payloads,map_demo}.ts`, `tests/scripts/code_graph_release_dispatch.test.ts` |
| 3 | **Fixed with #2.** No `npx tsx` fallback, so no `node-gyp` or python cache was written in the re-check (only doctor's `~/Library/Caches/copilot/`, see #10). Requirements page unchanged. | — |
| 4 | **Recorded.** `ask "who calls sum"` returning `0/0` and the `grep` hint that greps the question text were not in this pass's scope. | — |
| 5 | **Recorded.** The `render check: unverified — @playwright/test …` line is still printed on a release. | — |
| 6 | **Fixed.** A default `doctor` with an install now exits 0 when only optional warnings remain (1 on drift) and ends with one line, e.g. `agent-config: installed — 4 optional warning(s)`, naming drift and failed checks when present. `--json`, `--ci`, `--strict` and `--check` keep their documented codes. Help text and Install page updated. | `src/scripts/_cli/{cmd_doctor,doctor_ownership_ledger,_doctor_help}.ts`, `tests/scripts/_cli/doctor_no_project_install.test.ts`, `site/src/content/docs/getting-started/installation.mdx` |
| 7 | **Fixed.** The neighbour scan cache and the cross-root overlap cache moved from `<repo>/agents/reports/` to `~/.event4u/agent-config/state/neighbours/<project hash>/`. Readers (`score_skill_relevance`, the census) go through the same `scanCachePath`. The re-check left the project untouched. | `src/scripts/_lib/{skill_origin,neighbour_census}.ts`, `src/scripts/_cli/cmd_doctor_neighbours.ts`, `tests/scripts/neighbour_route_origin.test.ts` |
| 8 | **Fixed.** `memory-merge-union` names `agent-config refresh --project` (no `npx tsx src/scripts/…`) and is `skipped`, not a warning, in a project with no `agents/memory/`. The council fix says `run agent-config setup` instead of copying `agents/templates/…`. The three manifest-only checks and `bridge-drift` no longer tell a user with a global install to create a project lockfile. These checks moved into `_doctor_hints.ts`. Sibling search for maintainer paths in fix strings found 4 more sites in `src/scripts/_lib/runtime_wiring_checks.ts` (`task generate-tools` ×3 for a missing router, `./scripts-run … canary_liveness` ×1). Not changed: they fire only on a broken package or a maintainer canary; open question below. | `src/scripts/_cli/{_doctor_hints,cmd_doctor,detection_report}.ts`, `tests/scripts/_cli/{doctor_consumer_hints,detection_report}.test.ts` |
| 9 | **Recorded.** `global-binary` reports the first `agent-config` on `PATH`, not the one running. | — |
| 10 | **Fixed (docs).** The Uninstall page says `doctor` asks each tool CLI for its version and that some leave temp files (`~/.codex/tmp/`, `~/.gemini/`). Behavior unchanged. | `site/src/content/docs/getting-started/uninstall.md` |
| 11 | **Recorded.** Output length and vocabulary unchanged apart from the new summary line. | — |
| 12 | **Recorded.** | — |
| 13 | **Recorded.** | — |
| 14 | **Recorded.** | — |
| 15 | **Fixed (path), recorded (rest).** `gitignore_block.ts` and `cli_wrapper.ts` resolve their templates through `resolvePackageRoot`. They had counted three `..` from the source layout, which is one level too many from the bundles (`dist/install/install.mjs`, `dist/cli-delegate/`). A sibling search over the install-bundle closure found two more hop-counted roots. `installed_layer.defaultHostLimitsPath()` pointed at `<pkg>/config/` from the bundle, so host budgets read as unmeasured; it is fixed here. `thin_rules.REPO_ROOT` is documented as source-only with a bundled-caller handover, so it was left. `hooks/host_lowering.ts` already branches on bundle depth. Re-check: `init --project` on the release exits 0 and writes `agents/overrides/`, the gitignored `./agent-config` wrapper, a block in `.gitignore` and a block in `.gitattributes`. **The `.gitattributes` block is intended**: it is the memory `merge=union` block (`sync_gitattributes`, shipped template since c2c86b6ed9), so parallel branches appending memory entries merge instead of conflicting. Ruling 0.5's "only the overrides folder plus gitignored bookkeeping" should therefore name the `.gitignore` and `.gitattributes` blocks. `--project` is still missing from `init --help`, and `init --project --yes` is refused (`refresh: unrecognized arguments: --yes`). | `src/scripts/_lib/{gitignore_block,cli_wrapper,installed_layer}.ts`, `dist/install/install.mjs` (rebuilt), `tests/scripts/install/files_allowlist.test.ts` |
| 16 | **Recorded.** | — |
| 17 | **Recorded.** | — |
| 18 | **Fixed (docs).** The Uninstall page and `docs/installation.md` say that the repo-level `uninstall` applies only to a repository with its own install, and that with a global-only install it exits 1 with `no project lockfile` and changes nothing. The exit code was not changed: the 1 is pinned by `tests/scripts/_cli/cmd_uninstall.test.ts` and documented as a refusal, so it was left. `agents/reports/` is no longer written (#7). | `site/src/content/docs/getting-started/uninstall.md`, `docs/installation.md` |
| 19 | **Fixed (docs).** Both pages say the created `~/.claude/settings.json` can remain as `{}` and that tool folders the install created stay, empty. | same as #18 |
| 20 | **Fixed (docs).** "Delete `~/.event4u/` if it is then empty." That folder is now described as settings, install records, code maps and cached doctor scans. | same as #18 |
| 21 | **Fixed (docs).** Uninstall names `agents/map/`. The Code map page now says where the map goes: `agents/map/` only when the repository already has `agents/`, otherwise `~/.event4u/agent-config/map/`. In the walkthrough the map landed in the repo only because `doctor` had created `agents/` first (#7). | `site/src/content/docs/features/code-map.md`, uninstall pages |
| 22 | **Recorded.** The `prepare` script is still visible to consumers on npm ≥ 11. | — |
| 23 | No action. | — |

### New findings from the re-check

- `code-graph map --demo` exits 1 on a release: `the demo fixture ships only with a source checkout` (`tests/fixtures/code-graph/demo` is not in `files[]`). Either ship the fixture, which needs a pack-size decision, or keep pointing newcomers at the hosted demo map, as the pages now do.
- `doctor --json` / `--ci` still exit 2 ("no install found") for a global-only install with no `agents/overrides/`, because those modes key on the project marker, not on the global ledger. This is left as documented, since machine modes were out of scope. It is still a contract question.
- `check_pack_size` is red at HEAD, independent of this change: the extensionless `src/scripts/install` (24,438 B) has no bound exception.
