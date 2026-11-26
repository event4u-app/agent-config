# Changelog

All notable changes to `event4u/agent-config` are documented here.
Format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/);
versioning policy is documented in [CONTRIBUTING.md](CONTRIBUTING.md#versioning-policy).
Entry-shape contract: [`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md).

> Entries before 1.3.3 were reconstructed from git history after the fact.
> Early releases did not maintain release notes.
>
> History is split into **eras**. The current era keeps full entries
> inline; prior eras collapse into a single pointer to an archive file
> under [`docs/archive/`](docs/archive/). A drift test
> (`tests/lib/changelog_eras.test.ts`) forces an era split before the
> current era grows past 250 lines.

> **Retro-curation disposition, 2026-09-01** — roadmap
> `road-to-publication-integrity-hard-fail`, blocker `b-retro-curation-scope`,
> option (c). The `### Release highlights` heads of 14.9.0 through 14.13.0 were
> written by the release generator and published without the editorial pass they
> ask for. Two things were repaired: the generator's own authoring instruction,
> which was never release content, is deleted from this file, and the writer no
> longer emits it. The generator-derived head lines below are **preserved as
> published** and deliberately not paraphrased — rewriting a derived claim is
> editorial judgement two prior councils reserved, and a paraphrase of the
> generator's own reason would be truthfully documented uselessness.
> [`docs/archive/`](docs/archive/) is left untouched as historical record. The
> annotated tag messages and the published GitHub Release bodies for 14.9.0
> through 14.13.0 are **immutable** and cannot be repaired at all.

## [Unreleased]

### Added

* **deliberation:** a new user-global setting `deliberation.mode` (class A,
  default `off`) decides what happens when a question carries a real decision
  with trade-offs. It stays off until the user asks to switch it on, for one
  session or globally. `offer` lists the fitting `/council`, `/arena` or `/panel` as
  numbered options with the plain answer last; `auto` is an automatic mode the
  user switches on — the agent runs the fitting tool and answers its own
  implementation questions instead of asking, while merge, deploy, push,
  release, production data or infra, bulk deletion and irreversible external
  actions still ask; `off` never offers one. `agent-config deliberation:get [--session <id>]
  [--json]` prints the effective mode and its source (`session`, `global`,
  `default`); `agent-config deliberation:set <off|offer|auto|inherit>
  [--session <id>]` writes it globally through `settings:set` or as a
  per-session override at `~/.event4u/agent-config/state/deliberation/<id>.json`.
  The `deliberation-mode` hook concern (`user_prompt_submit`, kill switch
  `AGENT_CONFIG_NO_DELIBERATION_HINT=1`) delivers the mode per prompt; the
  command `/deliberation` and the `ai-council` skill carry the procedure. No
  rule file, so the per-spawn preamble does not grow.
* **arena:** `agent-config bracket name --run <id> --text "…"` /
  `--decision "…"` writes `name.json` beside `bracket.json` — the run's human
  name and its one-line decision with the current champion, as Agent Switch
  shows them. A field the user set is kept unless `--force`; an empty value
  clears it. `/judge bracket` and `/arena` now name the run right after `init`
  and record the decision at `done`.

### Changed

* **claude plugin:** the marketplace plugin root is `./.claude-plugin`, no
  longer the repo root. Claude Code loads `<plugin root>/agents/` as
  subagents, so the old root shipped the repo's whole `agents/` tree and
  pushed every session past the agent-description budget. The plugin keeps
  its hooks (`.claude-plugin/hooks` links the generated `hooks/`) and the
  pointer skill; `lint_marketplace` now fails on a wider root, on a
  `.claude-plugin/agents/` dir and on missing plugin hooks. The host-loadability
  smoke installs into a throwaway `CLAUDE_CONFIG_DIR` as well as `HOME`, so
  `task ci` no longer rewrites a developer's real marketplace source.
* **code-graph (Laravel):** the route lane reads a package's own route files —
  those a provider loads with `loadRoutesFrom(__DIR__ …)` or `group(__DIR__ …)`,
  and the files they `require` — and resolves `Route::controller(C::class)`
  groups with bare method-name handlers. Views resolve by namespace
  (`loadViewsFrom`, `Blade::anonymousComponentPath`) for `view('ns::…')`,
  `@include('ns::…')` and `<x-ns::…>`.
* **detectors:** the silent-catch entry-path reading starts at a template the
  graph states is rendered or included, and walks `renders` / `includes` edges,
  so inline script in a routed page is read instead of left unanswered.
* **self-review gate workflow:** a separate, advisory `graph-checks` job reports
  the code graph's three review checks beside the gate (job summary and a
  `code-graph-checks` artifact, never a PR comment). It is not a required check;
  the dispositions ledger refuses its artifact. Off switch: repository variable
  `GRAPH_CHECKS_JOB=off`.

* **skills:** `/mcp` and `/code-review` open Claude Code's own commands again.
  The package skills that shadowed them are renamed `mcp-tool-use` and
  `code-review-lens`; `user-invocable: false` had only hidden them from the
  menu, it never gave the name back. The next update removes the old
  `skills/mcp/` and `skills/code-review/` directories the package recorded
  writing; a same-name skill you wrote yourself is kept.
* **mcp:** the lite MCP server (`agent-config mcp`) now returns
  `isError: true` when `suggest_skill_for_task` or `read_skill` fails (status
  `error`, `not_found` or `no_catalogue`); `structuredContent.status` is
  unchanged. `suggest_skill_for_task` caps `limit` at 20 and reports
  `clamped_from`, and both tools publish an open `outputSchema`. A kernel
  discovery stub's `not_implemented` envelope is returned as a tool error too.
* **mcp:render:** keeps MCP servers and comments it did not write, writes a
  `.agent-config.bak` before changing a host config (refreshed on every changing
  write, and ignored by the managed `.gitignore` block), and refuses a file with
  a duplicate key at any depth when it would rewrite it. A server you remove
  from `mcp.json` is no longer deleted from the targets.
* **web-launch gate:** attribute order, quote style and case no longer change a
  verdict; a robots.txt block aimed only at AI-training crawlers is no longer
  reported as a critical staging leftover; every canonical is checked; two new
  checks (`snippet-eligibility`, `structured-data-parses`); every check names
  the basis it rests on.
* **humanizer:** `detect_ai_tells --baseline` also reports number words, status
  qualifiers, negation and attribution changes, and no longer reads German
  sentence openers as names (a sentence-initial name such as "Deutsche Bahn"
  stays whole); a three-digit decimal such as "2.125 seconds" is no longer read
  as a thousands group in English text; range dashes ("12–14") are no longer
  counted.
* **code-graph:** `parent::m()` (and C# `base.m()`) resolves to the parent's
  method instead of the method it is written in, and a bare `f()` in PHP,
  TypeScript, JavaScript, Python or Go no longer binds to a same-named method —
  `redirect()` inside a controller's `redirect()` was a self-edge. A merged
  `index.scip` now lands on the right node in a file holding U+2028, U+2029 or a
  lone CR, which end a line for TypeScript but not for the graph.
* **code-graph:** a consumer's node-link graph export keeps its import and
  reference edges: `imports_from`, `re_exports`, `dynamic_import` and `includes`
  load as imports, and `references_constant`, `uses_static_prop` and `mixes_in`
  (trait use) as uses. They were dropped as unmapped relations before.
* **code-graph:** `review-risk` no longer reads a lane-backed term as `0` when its
  lane never ran (a `--no-lanes` build, an older or a foreign graph): a term that
  counted nothing then reads `unknown (lane not run)` and the band reads `unknown`.
  Facts the graph does carry still count.

Twenty entries that had accumulated here were drained to
[`docs/archive/CHANGELOG-unreleased-drain-2026-10.md`](docs/archive/CHANGELOG-unreleased-drain-2026-10.md)
on 2026-10-13; every one of them had already shipped, the oldest in 9.7.0.
An entry belongs under a dated release section, not here — see
[`docs/contracts/CHANGELOG-conventions.md`](docs/contracts/CHANGELOG-conventions.md).

# Era: pre-4.5.0 — archived

> All entries before `4.5.0` live in
> [`docs/archive/CHANGELOG-pre-4.5.0.md`](docs/archive/CHANGELOG-pre-4.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-5.4.0 — archived

> All entries before `5.4.0` live in
> [`docs/archive/CHANGELOG-pre-5.4.0.md`](docs/archive/CHANGELOG-pre-5.4.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-5.9.0 — archived

> All entries before `5.9.0` live in
> [`docs/archive/CHANGELOG-pre-5.9.0.md`](docs/archive/CHANGELOG-pre-5.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-6.0.0 — archived

> All entries before `6.0.0` live in
> [`docs/archive/CHANGELOG-pre-6.0.0.md`](docs/archive/CHANGELOG-pre-6.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-7.0.0 — archived

> All entries before `7.0.0` live in
> [`docs/archive/CHANGELOG-pre-7.0.0.md`](docs/archive/CHANGELOG-pre-7.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.0.0 — archived

> All entries before `8.0.0` live in
> [`docs/archive/CHANGELOG-pre-8.0.0.md`](docs/archive/CHANGELOG-pre-8.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.1.0 — archived

> All entries before `8.1.0` live in
> [`docs/archive/CHANGELOG-pre-8.1.0.md`](docs/archive/CHANGELOG-pre-8.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.9.0 — archived

> All entries before `8.9.0` live in
> [`docs/archive/CHANGELOG-pre-8.9.0.md`](docs/archive/CHANGELOG-pre-8.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-8.12.0 — archived

> All entries before `8.12.0` live in
> [`docs/archive/CHANGELOG-pre-8.12.0.md`](docs/archive/CHANGELOG-pre-8.12.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-9.2.0 — archived

> All entries before `9.2.0` live in
> [`docs/archive/CHANGELOG-pre-9.2.0.md`](docs/archive/CHANGELOG-pre-9.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-9.9.0 — archived

> All entries before `9.9.0` live in
> [`docs/archive/CHANGELOG-pre-9.9.0.md`](docs/archive/CHANGELOG-pre-9.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.10.0 — archived

> All entries before `9.10.0` live in
> [`docs/archive/CHANGELOG-pre-9.10.0.md`](docs/archive/CHANGELOG-pre-9.10.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.13.0 — archived

> All entries before `9.13.0` live in
> [`docs/archive/CHANGELOG-pre-9.13.0.md`](docs/archive/CHANGELOG-pre-9.13.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.15.0 — archived

> All entries before `9.15.0` live in
> [`docs/archive/CHANGELOG-pre-9.15.0.md`](docs/archive/CHANGELOG-pre-9.15.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.18.0 — archived

> All entries before `9.18.0` live in
> [`docs/archive/CHANGELOG-pre-9.18.0.md`](docs/archive/CHANGELOG-pre-9.18.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.23.0 — archived

> All entries before `9.23.0` live in
> [`docs/archive/CHANGELOG-pre-9.23.0.md`](docs/archive/CHANGELOG-pre-9.23.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.27.0 — archived

> All entries before `9.27.0` live in
> [`docs/archive/CHANGELOG-pre-9.27.0.md`](docs/archive/CHANGELOG-pre-9.27.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.31.0 — archived

> All entries before `9.31.0` live in
> [`docs/archive/CHANGELOG-pre-9.31.0.md`](docs/archive/CHANGELOG-pre-9.31.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.34.0 — archived

> All entries before `9.34.0` live in
> [`docs/archive/CHANGELOG-pre-9.34.0.md`](docs/archive/CHANGELOG-pre-9.34.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-9.36.0 — archived

> All entries before `9.36.0` live in
> [`docs/archive/CHANGELOG-pre-9.36.0.md`](docs/archive/CHANGELOG-pre-9.36.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-10.3.0 — archived

> All entries before `10.3.0` live in
> [`docs/archive/CHANGELOG-pre-10.3.0.md`](docs/archive/CHANGELOG-pre-10.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-12.0.0 — archived

> All entries before `12.0.0` live in
> [`docs/archive/CHANGELOG-pre-12.0.0.md`](docs/archive/CHANGELOG-pre-12.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.0.0 — archived

> All entries before `14.0.0` live in
> [`docs/archive/CHANGELOG-pre-14.0.0.md`](docs/archive/CHANGELOG-pre-14.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.3.0 — archived

> All entries before `14.3.0` live in
> [`docs/archive/CHANGELOG-pre-14.3.0.md`](docs/archive/CHANGELOG-pre-14.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.5.0 — archived

> All entries before `14.5.0` live in
> [`docs/archive/CHANGELOG-pre-14.5.0.md`](docs/archive/CHANGELOG-pre-14.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.8.0 — archived

> All entries before `14.8.0` live in
> [`docs/archive/CHANGELOG-pre-14.8.0.md`](docs/archive/CHANGELOG-pre-14.8.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.9.0 — archived

> All entries before `14.9.0` live in
> [`docs/archive/CHANGELOG-pre-14.9.0.md`](docs/archive/CHANGELOG-pre-14.9.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.12.0 — archived

> All entries before `14.12.0` live in
> [`docs/archive/CHANGELOG-pre-14.12.0.md`](docs/archive/CHANGELOG-pre-14.12.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.14.0 — archived

> All entries before `14.14.0` live in
> [`docs/archive/CHANGELOG-pre-14.14.0.md`](docs/archive/CHANGELOG-pre-14.14.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.17.0 — archived

> All entries before `14.17.0` live in
> [`docs/archive/CHANGELOG-pre-14.17.0.md`](docs/archive/CHANGELOG-pre-14.17.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.18.0 — archived

> All entries before `14.18.0` live in
> [`docs/archive/CHANGELOG-pre-14.18.0.md`](docs/archive/CHANGELOG-pre-14.18.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.19.0 — archived

> All entries before `14.19.0` live in
> [`docs/archive/CHANGELOG-pre-14.19.0.md`](docs/archive/CHANGELOG-pre-14.19.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.20.0 — archived

> All entries before `14.20.0` live in
> [`docs/archive/CHANGELOG-pre-14.20.0.md`](docs/archive/CHANGELOG-pre-14.20.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-14.23.0 — archived

> All entries before `14.23.0` live in
> [`docs/archive/CHANGELOG-pre-14.23.0.md`](docs/archive/CHANGELOG-pre-14.23.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.0.0 — archived

> All entries before `16.0.0` live in
> [`docs/archive/CHANGELOG-pre-16.0.0.md`](docs/archive/CHANGELOG-pre-16.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.1.0 — archived

> All entries before `16.1.0` live in
> [`docs/archive/CHANGELOG-pre-16.1.0.md`](docs/archive/CHANGELOG-pre-16.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.2.0 — archived

> All entries before `16.2.0` live in
> [`docs/archive/CHANGELOG-pre-16.2.0.md`](docs/archive/CHANGELOG-pre-16.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.3.0 — archived

> All entries before `16.3.0` live in
> [`docs/archive/CHANGELOG-pre-16.3.0.md`](docs/archive/CHANGELOG-pre-16.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-16.5.0 — archived

> All entries before `16.5.0` live in
> [`docs/archive/CHANGELOG-pre-16.5.0.md`](docs/archive/CHANGELOG-pre-16.5.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-17.1.0 — archived

> All entries before `17.1.0` live in
> [`docs/archive/CHANGELOG-pre-17.1.0.md`](docs/archive/CHANGELOG-pre-17.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-17.4.0 — archived

> All entries before `17.4.0` live in
> [`docs/archive/CHANGELOG-pre-17.4.0.md`](docs/archive/CHANGELOG-pre-17.4.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-18.1.0 — archived

> All entries before `18.1.0` live in
> [`docs/archive/CHANGELOG-pre-18.1.0.md`](docs/archive/CHANGELOG-pre-18.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-19.0.0 — archived

> All entries before `19.0.0` live in
> [`docs/archive/CHANGELOG-pre-19.0.0.md`](docs/archive/CHANGELOG-pre-19.0.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-19.1.0 — archived

> All entries before `19.1.0` live in
> [`docs/archive/CHANGELOG-pre-19.1.0.md`](docs/archive/CHANGELOG-pre-19.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.1.0 — archived

> All entries before `20.1.0` live in
> [`docs/archive/CHANGELOG-pre-20.1.0.md`](docs/archive/CHANGELOG-pre-20.1.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.2.0 — archived

> All entries before `20.2.0` live in
> [`docs/archive/CHANGELOG-pre-20.2.0.md`](docs/archive/CHANGELOG-pre-20.2.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.3.0 — archived

> All entries before `20.3.0` live in
> [`docs/archive/CHANGELOG-pre-20.3.0.md`](docs/archive/CHANGELOG-pre-20.3.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.6.0 — archived

> All entries before `20.6.0` live in
> [`docs/archive/CHANGELOG-pre-20.6.0.md`](docs/archive/CHANGELOG-pre-20.6.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.7.0 — archived

> All entries before `20.7.0` live in
> [`docs/archive/CHANGELOG-pre-20.7.0.md`](docs/archive/CHANGELOG-pre-20.7.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: pre-20.8.0 — archived

> All entries before `20.8.0` live in
> [`docs/archive/CHANGELOG-pre-20.8.0.md`](docs/archive/CHANGELOG-pre-20.8.0.md).
> The archive is read-only; git tags remain the canonical
> source for what shipped. Splitting them out of the main file
> keeps the active era under the 250-line drift cap enforced by
> `tests/test_changelog_eras.py`.

# Era: 20.8.x — current

> Started at `20.8.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 20.9.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [20.10.0](https://github.com/event4u-app/agent-config/compare/20.9.0...20.10.0) (2026-11-26)

### Release highlights

- **Behaviour changes:** a major's own BREAKING_CHANGES row reaches its changelog head (9e1f48a).
- **Default changes + migration:** deliberation.mode, off by default (f1b0df4); regenerate the doc-path inventory for the release head's MIGRATION pointer (6777cb4).
- **Security and correctness:** sessions.auto_title in the server settings schema (4d91dae); switching sessions.auto_title off hides refined titles (9de36ec); freeze on the first prompt after a /rename, not the next milestone (4aaf9d7); bound session:title after the round-1 council review (dc59c68); council cluster, step receipts, plain hook comment (c6ea2b1); precompile every plain src/scripts route, no npx tsx (104828f); +9 more.
- **Honest nulls:** _none_
- **Known limitations:** an escaped pipe does not split a by-major row's What-broke cell (src/scripts/_lib/release_highlights.ts declares a residual) (837740d); a major's by-major row replaces the Pending rows it carries in the head (src/scripts/_lib/release_highlights.ts declares a residual) (dd1aaa7); a major's own BREAKING_CHANGES row reaches its changelog head (src/scripts/_lib/release_highlights.ts declares a residual) (9e1f48a).

> **Governance mix:** governance-only 16 vs consumer-only 8 (mixed 15, maintenance 15; taxonomy 1.1.0; range 2f837e1ceb31..4056206ddac9).

### Features

* **hooks:** session-title asks the agent to sharpen the session title ([695105f](https://github.com/event4u-app/agent-config/commit/695105fb56405b13ddbae58015bf3f375994b693))
* **sessions:** session:title publishes a refined title beside the transcript ([ce0d8f6](https://github.com/event4u-app/agent-config/commit/ce0d8f66a1917d4237b4ad62d5b132b9d6f630d4))
* **settings:** sessions.auto_title, a global switch for sharpening titles (ADR-305) ([dcdc9bd](https://github.com/event4u-app/agent-config/commit/dcdc9bd0e7f5fd43047b464040f8f85ff47624df))
* **arena:** bracket name — a run's name and the decision it reached ([a35e803](https://github.com/event4u-app/agent-config/commit/a35e803ad41a8d4ff2ad515519d4aa7829a6c4f7))
* **commands:** /deliberation and the ai-council deliberation-mode reference ([6416730](https://github.com/event4u-app/agent-config/commit/64167302ef0d49c7bb159bab2604adff78116992))
* **hooks:** deliberation-mode concern carries the session's mode on every prompt ([007c3c7](https://github.com/event4u-app/agent-config/commit/007c3c7a5e7a09deb840f8ba38b99ad06995e9b2))
* **cli:** deliberation:get and deliberation:set, globally or for one session ([bfee728](https://github.com/event4u-app/agent-config/commit/bfee728a40aa6020d3b392c01ad57a6f242d1a4e))
* **settings:** deliberation.mode, off by default ([f1b0df4](https://github.com/event4u-app/agent-config/commit/f1b0df4414e118e4b8bd053f8f1f81307a6923cd))

### Bug Fixes

* **settings:** sessions.auto_title in the server settings schema ([4d91dae](https://github.com/event4u-app/agent-config/commit/4d91daeae1a96d7ec6f61e3268f43821dbf5422b))
* **sessions:** switching sessions.auto_title off hides refined titles ([9de36ec](https://github.com/event4u-app/agent-config/commit/9de36ec5cffb397e546dd9cb1f3619b28d2447c9))
* **sessions:** freeze on the first prompt after a /rename, not the next milestone ([4aaf9d7](https://github.com/event4u-app/agent-config/commit/4aaf9d7b0921f7f31b31c8d192f554b3c79b365d))
* **sessions:** bound session:title after the round-1 council review ([dc59c68](https://github.com/event4u-app/agent-config/commit/dc59c68e7459e8cefe89aea24edf3b3f24551d26))
* **deliberation:** council cluster, step receipts, plain hook comment ([c6ea2b1](https://github.com/event4u-app/agent-config/commit/c6ea2b11cb9cc1a27feeb11c539e890350148094))
* **dispatch:** precompile every plain src/scripts route, no npx tsx ([104828f](https://github.com/event4u-app/agent-config/commit/104828fb57fd33e8a1b8e3f63e9e1b74fdb1d00b))
* **scripts:** resolve the package root by marker, not hop count ([1be1e36](https://github.com/event4u-app/agent-config/commit/1be1e361c100206abda83d61e9df4e99d35c3448))
* **projection-gates:** host-tree parity refuses to pass without a form record ([e02fc5b](https://github.com/event4u-app/agent-config/commit/e02fc5b7d9c8ced3da9dfca5c3f025f6f24c1e58))
* **release:** an escaped pipe does not split a by-major row's What-broke cell ([837740d](https://github.com/event4u-app/agent-config/commit/837740de8be5e0c2b4a208b9c16a065b7fc40088))
* **release:** a major's by-major row replaces the Pending rows it carries in the head ([dd1aaa7](https://github.com/event4u-app/agent-config/commit/dd1aaa7abbf159108c3fce887911d6f7de53fd80))
* **projection-gates:** refuse an unknown flag in check_rule_projection_integrity ([3a6c5eb](https://github.com/event4u-app/agent-config/commit/3a6c5ebd829a018a159aa879de7d3f16caaa2c42))
* **evidence-temperature:** class merge clearances hot; the gate reads them by constructed path ([271ec01](https://github.com/event4u-app/agent-config/commit/271ec0131649f27f11f323ce5ba9c533b041c48a))
* **projection-gates:** stop reading the removed lean_projection key (ADR-293) ([db770ad](https://github.com/event4u-app/agent-config/commit/db770ad85de1dff03bb8fdf91e3ac78f2d84a56a))
* **update-invite:** keep child_process out of the concern's runtime import graph ([353aacd](https://github.com/event4u-app/agent-config/commit/353aacd123b2b8dd6b767f9a86e830bdf98afd2b))
* **release:** a major's own BREAKING_CHANGES row reaches its changelog head ([9e1f48a](https://github.com/event4u-app/agent-config/commit/9e1f48a1dfc5a3e3d88c661a80e8bc79b6885b6e))

### Documentation

* **evidence:** bypass record for the #3049 merge over the ratification split ([0945b03](https://github.com/event4u-app/agent-config/commit/0945b030ebca8c512137f504f07749696a802e4e))
* **evidence:** record the owner decision on the session-title split ([9ef69ad](https://github.com/event4u-app/agent-config/commit/9ef69adfc793509425f8a0ea802521c16a22dca9))
* **settings:** regenerate the settings reference for sessions.auto_title ([4db72d8](https://github.com/event4u-app/agent-config/commit/4db72d89da69ca9cbfbc594addc8ea3b86330fc6))
* **adr:** ADR-305 discloses its evidence ([d217718](https://github.com/event4u-app/agent-config/commit/d217718c95fada2632bbe8a131ab55c5f5dcad71))
* **evidence:** session-title ratification record, round 3 (split) ([71002a6](https://github.com/event4u-app/agent-config/commit/71002a6e6159af1b245a0b35a944a4326f7421c3))
* **evidence:** session-title ratification prompt, round 3 ([18bf2a6](https://github.com/event4u-app/agent-config/commit/18bf2a611d5562286fb5a056469ab0a84444b593))
* **evidence:** session-title ratification prompt, round 2 ([a5a5398](https://github.com/event4u-app/agent-config/commit/a5a5398dfc5332dc009c2d2b9eb877fe239c5833))
* **evidence:** narrow the round-1 prompt to the council bundle ceiling ([a0b52c9](https://github.com/event4u-app/agent-config/commit/a0b52c96491fcdf2732338f36099a116b5ad3b26))
* **evidence:** session-title ratification prompt, round 1 ([223303e](https://github.com/event4u-app/agent-config/commit/223303e3bf713d88e0b9d5f36c13f7f16980778d))
* **evidence:** deliberation-mode ratification prompts ([c2330db](https://github.com/event4u-app/agent-config/commit/c2330db987955774231e8dbbf3a327b17fc96b21))
* **turn-end-gate:** point the readTurnRunState comment at _lib/turn_run_state.ts ([4e09ed5](https://github.com/event4u-app/agent-config/commit/4e09ed558f122614e75889407f99de941fe55b57))
* **breaking:** say the cut also reads a major's own by-major row ([b950604](https://github.com/event4u-app/agent-config/commit/b950604048a9c695d790c4158e9ffbc3271d713f))
* **maintainers:** regenerate the doc-path inventory for the release head's MIGRATION pointer ([6777cb4](https://github.com/event4u-app/agent-config/commit/6777cb4fb0d83a152022f9e9580d2945114f7d10))
* **breaking:** name the three renamed commands and the removed --apply in 17.0.0 ([f10581e](https://github.com/event4u-app/agent-config/commit/f10581e1ceb76f23bdf4904c0cf99c9bcf27c93d))
* **roadmap:** mirror the depends relation ([1907ae8](https://github.com/event4u-app/agent-config/commit/1907ae8860ea11e27d9f50dbce13dd97ef76c392))
* **roadmap:** fix relation keyword and give 1.1 a failing verify ([b0415c0](https://github.com/event4u-app/agent-config/commit/b0415c033b58164a7be96e472d328402c7efddc3))
* **roadmap:** owner overrides that do not block releases ([bbf57ff](https://github.com/event4u-app/agent-config/commit/bbf57ffbc377d6e3fa182558bc3ed4ea3db2328c))

### Tests

* **update-invite:** read the import graph from the TypeScript AST ([260748b](https://github.com/event4u-app/agent-config/commit/260748b00392526e903c3eb3f7f41b0071e126fc))
* **release:** replace the vacuous head-cap assertions with a line-break check ([35aef38](https://github.com/event4u-app/agent-config/commit/35aef383208246e5e90148a057e12f5d71e471d4))

### CI

* stop claiming the 22.6.0 engines floor is measured ([5d9080f](https://github.com/event4u-app/agent-config/commit/5d9080ff7350ba298dc9c4d8ecbc1f4a91ebabae))
* refresh Node-version comments that still describe the Node 20 floor ([9c7fa82](https://github.com/event4u-app/agent-config/commit/9c7fa8276c24d7aa41a9b226ddc23e1ccd186902))

### Chores

* **hooks:** admit session-title in the concern ledger ([3644d9b](https://github.com/event4u-app/agent-config/commit/3644d9b413cce7309c1cf949f129b4f8756cbe14))
* **evaluator:** refresh the nightly measurement record ([9277432](https://github.com/event4u-app/agent-config/commit/92774320ad8a1f044c10f746239f96a4ad588448))
* regenerate artefact index and catalog ([ba52278](https://github.com/event4u-app/agent-config/commit/ba52278883a0f101f410cd3f68454e7a85eda557))
* **evidence:** host cost census ([594a7a1](https://github.com/event4u-app/agent-config/commit/594a7a1df3e280b1f74f489cf92b5d62b7565e6c))
* regenerate derived docs ([875c68d](https://github.com/event4u-app/agent-config/commit/875c68d47293099f273f497326f7484a1d4c4d17))
* **budget:** lower the source-size baseline to 16607 ([b69298e](https://github.com/event4u-app/agent-config/commit/b69298ef71012a28a027e98a43a2b63ae37d9db2))
* **budget:** re-anchor the built pack surface for the delegate bundle ([2b3c2e6](https://github.com/event4u-app/agent-config/commit/2b3c2e6075def88f8fc3e0198540440a382b42fc))
* **deps:** bump the site group in /site with 3 updates ([fe1e19c](https://github.com/event4u-app/agent-config/commit/fe1e19cf8348c077994d0f1c14ba74b71b31b90a))
* **deps-dev:** bump @cloudflare/workers-types ([9009d9a](https://github.com/event4u-app/agent-config/commit/9009d9a08d91f0d973aa8d7a57b7006199b83961))

Tests: 41208 (+90 since 20.9.0)

## [20.9.0](https://github.com/event4u-app/agent-config/compare/20.8.0...20.9.0) (2026-11-25)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** seed the decision ledger with the two arena harvest rows (fcdd064).
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 3 vs consumer-only 1 (mixed 3, maintenance 1; taxonomy 1.1.0; range 8bcc444530ce..367f9b92270a).

### Features

* **hooks:** arena-route — an arena is the bracket engine, not a hand-rolled Workflow (#3037) ([2404338](https://github.com/event4u-app/agent-config/commit/2404338fffd35f392f656b4976a900bc6d5e8f6c))
* **bracket:** deal distinct approach angles and render blind match briefs ([28f25bc](https://github.com/event4u-app/agent-config/commit/28f25bc9f4d04d75be57df1829befdc5d9a90147))

### Bug Fixes

* **provenance:** seed the decision ledger with the two arena harvest rows ([fcdd064](https://github.com/event4u-app/agent-config/commit/fcdd0644ea27e812009b401f3375c4600a835647))
* **host-docs:** re-establish the drifted copilot and codex hooks rows ([c224721](https://github.com/event4u-app/agent-config/commit/c22472160ff8552f39c05c23e69eaefe19fb6d9f))

### Documentation

* **bypass:** record the owner override of #3037 and the follow-up roadmap order ([2691629](https://github.com/event4u-app/agent-config/commit/2691629c0f686dd75b7053a63c3628967b5f1dee))
* **judge-bracket:** standalone task file, dealt angles, driver briefs ([4e281ca](https://github.com/event4u-app/agent-config/commit/4e281ca576eaf46de55b18d53cd0b25c099b22ef))
* **evidence:** ratify the copilot and codex row re-establishment (#3028) ([da0d088](https://github.com/event4u-app/agent-config/commit/da0d0882062c38eb8cefe8c89946bf87daf7931a))

### Chores

* **evaluator:** refresh the nightly measurement record ([f6827cb](https://github.com/event4u-app/agent-config/commit/f6827cb88667e8999671c632c1d62020f6c15b6c))

Tests: 41118 (+41 since 20.8.0)

## [20.8.0](https://github.com/event4u-app/agent-config/compare/20.7.0...20.8.0) (2026-11-25)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** make the two macOS timing flakes deterministic (e13d1b7); an unset target tier is not a tier mismatch (b8a698a); carry the prose-hold parser to its own roadmap (9f57ccf); a negation never releases a phrase carrying its own 'only' (7e0f32b); release a cited blocker only directly after the hold phrase (2761767); a resolution never releases a hold with several objects (42eff09); +11 more.
- **Honest nulls:** R2 completion review — honest-null on the final scope (e831727).
- **Known limitations:** _none_

> **Governance mix:** governance-only 8 vs consumer-only 3 (mixed 23, maintenance 2; taxonomy 1.1.0; range b10d45539ac3..fc5e3a4c2fd8).

### Features

* **council:** live table with declared seats and a human inbox ([1ce5fd8](https://github.com/event4u-app/agent-config/commit/1ce5fd8131e687fdd2bafc4176f495979cba74ed))

### Bug Fixes

* **tests:** make the two macOS timing flakes deterministic ([e13d1b7](https://github.com/event4u-app/agent-config/commit/e13d1b70b6dec269221a29aace9d3762acf0dbae))
* **lint_handoffs:** an unset target tier is not a tier mismatch ([b8a698a](https://github.com/event4u-app/agent-config/commit/b8a698a57c304e96ae1f2b35b4e7636bd906ac42))
* **roadmaps:** blocker Routed line in the decider roadmap matches rule 20 ([fb51642](https://github.com/event4u-app/agent-config/commit/fb51642a30cf4d55dd10284bedcd900ff607cd4f))
* **roadmaps:** receipts, carry annotations, and the depth budget ([8712556](https://github.com/event4u-app/agent-config/commit/8712556d5c264af4ca59805c3e560a7cd8a19a93))
* **drain-queue:** a negation never releases a phrase carrying its own 'only' ([7e0f32b](https://github.com/event4u-app/agent-config/commit/7e0f32b2f304b85411f8bf03f298ac930ce8d0be))
* **drain-queue:** release a cited blocker only directly after the hold phrase ([2761767](https://github.com/event4u-app/agent-config/commit/276176770b8c7c648b9bd3b8995df439d561a1c4))
* **drain-queue:** a resolution never releases a hold with several objects ([42eff09](https://github.com/event4u-app/agent-config/commit/42eff09d95c5a01f6cba120aed09239fd398a88f))
* **drain-queue:** parked and on-hold release again; a citation is the whole object ([ffa7dd2](https://github.com/event4u-app/agent-config/commit/ffa7dd256252c422c5106aca9ff7f90246894006))
* **drain-queue:** a resolution may carry only a date after its verb ([c9aa912](https://github.com/event4u-app/agent-config/commit/c9aa912e711c0d7e2ada86d863c8628b8dac902e))
* **drain-queue:** a resolved blocker releases only the hold that cites it ([13e9c80](https://github.com/event4u-app/agent-config/commit/13e9c80f4a34da8f29dad029a7d5f0dd7a6ae60e))
* **drain-queue:** tie a resolution to its own hold and sentence end ([7a66b95](https://github.com/event4u-app/agent-config/commit/7a66b95e91b084da7e12252eaec76a8009f28556))
* **drain-queue:** release a prose hold only on its own resolution ([5730206](https://github.com/event4u-app/agent-config/commit/573020696229f6e7ff10451b12ef8097e8cf16d3))
* **drain-queue:** judge each prose hold in its own clause ([78ba5e4](https://github.com/event4u-app/agent-config/commit/78ba5e4da07a2abb8f3b008e9fcce57f33554a54))
* **drain-queue:** the emergency halt refuses every entry, re-dispatch included ([2179808](https://github.com/event4u-app/agent-config/commit/2179808f5d014620e364f57c3a0d9859d7745293))
* **council:** read one inline-findings predicate for prompt and harvest ([9d01a13](https://github.com/event4u-app/agent-config/commit/9d01a133b8611cd6a612c3e05b7144b27c4eefae))
* **council:** close a ratification round on one stance contract ([19c06ba](https://github.com/event4u-app/agent-config/commit/19c06ba0d20cf21788ad72b6ccbffe43fe2a6c4c))
* **council:** ratification prompts bypass the necessity gate ([84a12cd](https://github.com/event4u-app/agent-config/commit/84a12cd808be4bded0d7bc0692d22d6b748a8537))
* **release:** resume an in-flight release without the flag ([4778319](https://github.com/event4u-app/agent-config/commit/477831953032aca484aca72d09d9476409bc637a))

### Reverts

* **drain-queue:** carry the prose-hold parser to its own roadmap ([9f57ccf](https://github.com/event4u-app/agent-config/commit/9f57ccf65bbccd94f6e1a3272fb325681d2fae15))

### Documentation

* **ci:** record why Linux is no longer selected ([f7d6bca](https://github.com/event4u-app/agent-config/commit/f7d6bca41fd67957edb13974c30169ad37a56401))
* **contracts:** council live table and the seats key ([e72619d](https://github.com/event4u-app/agent-config/commit/e72619d3fab60d74f23ae8be6d89b30000cd9de4))
* **roadmaps:** record standing-criteria ranking as PD19 ([0f2db03](https://github.com/event4u-app/agent-config/commit/0f2db03f5fc526481610767450a404fb5362d8b0))
* **roadmaps:** three later/ roadmaps from inbox round inbox-2026-11-xa ([1a7edd7](https://github.com/event4u-app/agent-config/commit/1a7edd78253233833daeaf09583f01c5e03040b8))
* **process-full-all:** one precise halt sentence where dispatch_hold is explained ([f7adf6a](https://github.com/event4u-app/agent-config/commit/f7adf6aac64077be6df49732d558825ec194a5aa))
* **roadmaps:** carry Phase 2 with its criterion intact and a tracked council record ([b8b7b4c](https://github.com/event4u-app/agent-config/commit/b8b7b4cd602eb12cd243a129b74b3c39deaf8f7d))

### Refactoring

* keep the fixes out of files over the source-size ratchet ([205ced1](https://github.com/event4u-app/agent-config/commit/205ced133562ce47b2db68e02eef69027e647eb9))

### Tests

* **release:** skip the single-writer history half on a grafted history ([5d17697](https://github.com/event4u-app/agent-config/commit/5d176971ddf59c7b523a217cacc8914667894d65))

### CI

* **tests:** run the whole suite on Linux for every pull request ([67b7bc0](https://github.com/event4u-app/agent-config/commit/67b7bc042f095ba69aa0debd5680627d1b8be8a1))

### Chores

* **gates:** lower the source-size baseline to the measured total ([61e0c14](https://github.com/event4u-app/agent-config/commit/61e0c149b0262f549fa9f2b592222b0d25020390))
* **gates:** reaffirm the lint_handoffs baseline by owner decision ([db3d2c5](https://github.com/event4u-app/agent-config/commit/db3d2c54c223c316e06439415254f3634fd0702a))
* **reviews:** R2 completion review — final round, findings dispositioned ([26222ae](https://github.com/event4u-app/agent-config/commit/26222aede62c6bd9f7ffdb3d4dbba197ba80b54c))
* **reviews:** R2 completion review — honest-null on the final scope ([e831727](https://github.com/event4u-app/agent-config/commit/e8317279cba1418e6a4fab4541b9ae12cd4eea24))
* **roadmaps:** carry the two open prose-hold findings into a follow-up ([316d3bd](https://github.com/event4u-app/agent-config/commit/316d3bd432e8a70a9ff2b2c28f73596596ce7a3e))
* **roadmaps:** archive road-to-a-halt-that-holds-every-lane ([55b27d0](https://github.com/event4u-app/agent-config/commit/55b27d08ccee9469dcecb909cdc1809d196cd915))

Tests: 41077 (-42 since 20.7.0)

# Era: pre-4.0.0 — archived

> All entries from `3.2.0` and `3.3.0` live in
> [`docs/archive/CHANGELOG-pre-4.0.0.md`](docs/archive/CHANGELOG-pre-4.0.0.md).
> The archive is read-only; git tags `3.2.0` and `3.3.0` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.2.0 — archived

> All entries from `3.1.0` and `3.1.1` live in
> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).
> The archive is read-only; git tags `3.1.0` and `3.1.1` remain the
> canonical source for what shipped. Splitting them out of the main
> file keeps the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.1.0 — archived

> All entries from `3.0.0` live in
> [`docs/archive/CHANGELOG-pre-3.1.0.md`](docs/archive/CHANGELOG-pre-3.1.0.md).
> The archive is read-only; git tag `3.0.0` remains the canonical
> source for what shipped. Splitting it out of the main file keeps
> the active era under the 250-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-3.0.0 — archived

> All entries from `2.26.0` and `2.25.0` live in
> [`docs/archive/CHANGELOG-pre-3.0.0.md`](docs/archive/CHANGELOG-pre-3.0.0.md).
> The archive is read-only; git tags `2.26.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.25.0 — archived

> All entries from `2.24.0` through `2.20.0` live in
> [`docs/archive/CHANGELOG-pre-2.25.0.md`](docs/archive/CHANGELOG-pre-2.25.0.md).
> The archive is read-only; git tags `2.24.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.20.0 — archived

> All entries from `2.19.0` through `2.17.0` live in
> [`docs/archive/CHANGELOG-pre-2.20.0.md`](docs/archive/CHANGELOG-pre-2.20.0.md).
> The archive is read-only; git tags `2.19.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.17.0 — archived

> All `2.16.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.17.0.md`](docs/archive/CHANGELOG-pre-2.17.0.md).
> The archive is read-only; git tag `2.16.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.16.0 — archived

> All `2.15.0` entries live in
> [`docs/archive/CHANGELOG-pre-2.16.0.md`](docs/archive/CHANGELOG-pre-2.16.0.md).
> The archive is read-only; git tag `2.15.0` remains the canonical
> source for what shipped. Splitting these out of the main file keeps
> the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.15.0 — archived

> All entries from `2.14.0` through `2.11.0` live in
> [`docs/archive/CHANGELOG-pre-2.15.0.md`](docs/archive/CHANGELOG-pre-2.15.0.md).
> The archive is read-only; git tags `2.14.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.11.0 — archived

> All entries from `2.10.0` through `2.7.0` live in
> [`docs/archive/CHANGELOG-pre-2.11.0.md`](docs/archive/CHANGELOG-pre-2.11.0.md).
> The archive is read-only; git tags `2.10.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.


# Era: pre-2.7.0 — archived

> All entries from `2.6.1` through `2.2.0` live in
> [`docs/archive/CHANGELOG-pre-2.7.0.md`](docs/archive/CHANGELOG-pre-2.7.0.md).
> The archive is read-only; git tags `2.6.1` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.

# Era: pre-2.2.0 — archived

> All entries from `2.1.0` and earlier live in
> [`docs/archive/CHANGELOG-pre-2.2.0.md`](docs/archive/CHANGELOG-pre-2.2.0.md).
> The archive is read-only; git tags `2.1.0` and prior remain the
> canonical source for what shipped. Splitting these out of the main
> file keeps the active era under the 200-line drift cap enforced by
> `tests/lib/changelog_eras.test.ts`.
