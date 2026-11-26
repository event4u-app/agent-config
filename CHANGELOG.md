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
