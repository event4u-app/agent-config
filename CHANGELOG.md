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

# Era: 20.7.x — current

> Started at `20.7.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 20.8.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [20.7.0](https://github.com/event4u-app/agent-config/compare/20.6.0...20.7.0) (2026-11-23)

### Release highlights

- **Behaviour changes:** withdraw the owner-class column from decision-revisit-gate (d1c5e2b); say that an outside row still routes to the owner (3ba75b0); name the owner class on every reserved row (674c23e); restore efficient-tooling line in the rule body (5ca4354); keep law sections under the 2000-char ceiling (48fe105); align Iron Law 4 with self-check scope, IL1 example and reply order (b2d2e55); +1 more.
- **Default changes + migration:** _none_
- **Security and correctness:** re-measure the content pack and move its proxy limit to 7 MiB (1233817); keep the template memory_signal twin in step with the bundle guard (901ea6e); contain the timing record too, the last post-verdict diagnostic (6726451); skip subagent hand-backs; make the retro queue runnable in consumers (368caca); consumer-reachable closure:scan / closure:lint, lint the project's roadmaps (8c88531); the evaluator nightly's bot push skips the local replay check (200e07e); +113 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 179 vs consumer-only 57 (mixed 123, maintenance 81; taxonomy 1.1.0; range 2cc3dcf403a2..627953d7a85a).

### Features

* **probe:** measure owner attributions that cite no source ([2fb3808](https://github.com/event4u-app/agent-config/commit/2fb38083c016170f640a72bd7da96179f936a1dd))
* **subagents:** carry the question cascade and the provenance line ([84fc2af](https://github.com/event4u-app/agent-config/commit/84fc2afd93127a8328c83bc9c1513e1363de6024))
* **council:** keep only the owner's classes in high_impact ([75c41d8](https://github.com/event4u-app/agent-config/commit/75c41d86c1b429b7e9a2c24fa8baf41536a05993))
* **census:** count every owner-reaching ask with producer, impact and reply class ([0897c0d](https://github.com/event4u-app/agent-config/commit/0897c0d54a3b6f3f23e5bf6e4ce8331c4659d4bb))
* **credential-guard:** treat pattern, filter and message operands as no file ([d4ae809](https://github.com/event4u-app/agent-config/commit/d4ae809307ddeb36a335d13b4ee2d57074acb098))
* **review-nudge:** count only the lines a session's own writes touched ([b0ca531](https://github.com/event4u-app/agent-config/commit/b0ca531c24cf6b738c3033afdb027e13dd262a34))
* **turn-end-gate:** recognise a verifier run through docker exec ([7e7b081](https://github.com/event4u-app/agent-config/commit/7e7b081791ed2555aa855a9b77e7ded93ed9375f))
* **push-settle:** read a pushed branch only inside a To section ([6e67860](https://github.com/event4u-app/agent-config/commit/6e678606fcb0f2df86f0b94e1a4ec0af26340bac))
* **legal:** count attorney-review lines per turn kind across transcript stores ([6dd1de0](https://github.com/event4u-app/agent-config/commit/6dd1de0ff06bdd3482cedaa47862fe211c3ee29b))
* **commands:** roadmap:next merges through process-full and yields to the project rule ([fba1b3a](https://github.com/event4u-app/agent-config/commit/fba1b3a632b1fc810d6f3f375ee2a2a275a8990b))
* **commands:** PR commands take the session's one open PR without asking ([b6b64c2](https://github.com/event4u-app/agent-config/commit/b6b64c21f267eb41efe3aa986fa1cbbf37b88394))
* **scripts:** add the session goal record as an unwired library ([bbabc81](https://github.com/event4u-app/agent-config/commit/bbabc81904f78087be4c07e57f9ee0a78f0513f9))
* **scripts:** count goal-scoped re-asks in host transcripts ([36dd8a1](https://github.com/event4u-app/agent-config/commit/36dd8a1c94f5a807e14342b78bfbeb67c8294103))
* **user-interaction:** Iron Law 4 — a question carries its own context ([765a308](https://github.com/event4u-app/agent-config/commit/765a30846e0baa1abefab62b11b07f3f8cd108d7))
* **council:** a ratification prompt must ask for the stance line ([fdc0f20](https://github.com/event4u-app/agent-config/commit/fdc0f201b7f856f2072c315116766ba63402e8ba))
* **ci-settle:** name a red that only waits for the owner ([88d4f8c](https://github.com/event4u-app/agent-config/commit/88d4f8c8f816ae8a00e7722022f54280583dda77))
* **hooks:** a known-red push stays local until the owner decides ([deeca06](https://github.com/event4u-app/agent-config/commit/deeca067430069ed2ba8838516567c2733516453))
* **review-loops:** advisory convergence verdict and historical replay ([226a242](https://github.com/event4u-app/agent-config/commit/226a242a9e3982f55ddb76ce0b24d22de76769d8))
* **review-loops:** reader input and origin-merge tooling ([0dd3c31](https://github.com/event4u-app/agent-config/commit/0dd3c315cc484f003a75310d79d9f110d52ddad9))
* **review-loops:** deterministic origin classes per round ([6248df0](https://github.com/event4u-app/agent-config/commit/6248df08e30b98c0db0e77ff25d27e3351168196))
* **review-loops:** generate the census of every review loop ([64fb232](https://github.com/event4u-app/agent-config/commit/64fb23231731067bf81e5e4c63df8e218719114b))
* **measure-turn-end-gate:** --before renders a before/after split with the instrument held fixed ([75fe530](https://github.com/event4u-app/agent-config/commit/75fe530454e079d4ffef98564c94c04aa79fe6f3))
* **turn-end-gate:** refuse on language only behind an owner-prose pin ([daf8e48](https://github.com/event4u-app/agent-config/commit/daf8e48eba8ccc909475f1899f11a1de37554781))
* **language-mirror:** record owner_prose_chars on every pin ([17aa86c](https://github.com/event4u-app/agent-config/commit/17aa86c9c98145be62b07c41eae01f23ef432ba9))
* **language-mirror:** set the pin only from owner prose ([20f4861](https://github.com/event4u-app/agent-config/commit/20f486144c198b0087a720f4ce761c2a102cd42e))
* **verify:** derive live surfaces and record unlisted ones ([ba9c15a](https://github.com/event4u-app/agent-config/commit/ba9c15a123ea86b88549837c7f2e212d21194bd1))
* **turn-end-gate:** record partial ratios reported as complete ([8a74e05](https://github.com/event4u-app/agent-config/commit/8a74e0513b179ae3f984cb2fad665af6cc863731))
* **measure-turn-end-gate:** add --language-split refusal split by pin source ([8aedb7f](https://github.com/event4u-app/agent-config/commit/8aedb7f511cbb8fd2d737e25e1fd468b10c957ab))
* **lint:** refuse verify clauses and exec pointers with masked exit codes ([8324bd9](https://github.com/event4u-app/agent-config/commit/8324bd91b7d6686766c2cc12d6652b06932b340b))
* **verification:** classify masked exit codes and rtk-wrapped runs ([a6cc7a4](https://github.com/event4u-app/agent-config/commit/a6cc7a45584e806ac19670d47a366a764bde4388))
* **trigger-evals:** count passing rotation runs as freshness evidence ([0824cc2](https://github.com/event4u-app/agent-config/commit/0824cc2aa72d0a4c7d0ea538ae8e72199ffbd258))
* **hooks:** replace the bundle byte ratchet with a package allowlist and a backstop ([6dcc246](https://github.com/event4u-app/agent-config/commit/6dcc246041bbf079bfb9211aaa754d8a0c0c4e69))
* **locks:** a waiting acquire and directory generations for the generation lock ([b431fec](https://github.com/event4u-app/agent-config/commit/b431fec461f4e83c25d65404f3e75b07178357ad))

### Bug Fixes

* **mcp:** re-measure the content pack and move its proxy limit to 7 MiB ([1233817](https://github.com/event4u-app/agent-config/commit/1233817ad8f269e0fa23bca51e6019719b775474))
* **memory:** keep the template memory_signal twin in step with the bundle guard ([901ea6e](https://github.com/event4u-app/agent-config/commit/901ea6e3586a86fdb19d9d41b34b53f9e32d32cc))
* **hooks:** contain the timing record too, the last post-verdict diagnostic ([6726451](https://github.com/event4u-app/agent-config/commit/672645154a0c0e969f14204951e1d39fe6cdfb92))
* **self-repair:** skip subagent hand-backs; make the retro queue runnable in consumers ([368caca](https://github.com/event4u-app/agent-config/commit/368cacaba361077ce59546c28da95ef4d53234db))
* **design-intelligence:** the re-check note uses the house spelling ([ded6599](https://github.com/event4u-app/agent-config/commit/ded65991baee4aef691df0e4ae774328538c4550))
* **closure:** consumer-reachable closure:scan / closure:lint, lint the project's roadmaps ([8c88531](https://github.com/event4u-app/agent-config/commit/8c88531da9bd14a20885cf82646939ec03071175))
* **analyze:inbox:** ask before widening a named path, move only what was named or confirmed ([6b6c236](https://github.com/event4u-app/agent-config/commit/6b6c2360784aed57c61bb38c5f69a1eb4059f2dd))
* **ci:** the evaluator nightly's bot push skips the local replay check ([200e07e](https://github.com/event4u-app/agent-config/commit/200e07e2e970068d3a4ca5663445995cedaafd41))
* **roadmap:** process-full's core fits its byte budget again ([6fb4840](https://github.com/event4u-app/agent-config/commit/6fb4840f1e92896d6083f2325ea8d434eabc8061))
* **hooks:** no feedback write can stop a computed verdict ([01bfc52](https://github.com/event4u-app/agent-config/commit/01bfc5240045a6882ff7500c4bf824b7f1245606))
* **wedge:** ship the regenerated worker floor in the wedge docs ([e3b6dc5](https://github.com/event4u-app/agent-config/commit/e3b6dc53f8c8a2c92877f56507c211f297ac7109))
* **subagents:** fit the who-answers section and the routing note into their budgets ([f52e889](https://github.com/event4u-app/agent-config/commit/f52e8895ecb7157d717021939eb423afc9e5785a))
* **prompt-shape:** a hunk context row decrements both counts in a block ([f6680ae](https://github.com/event4u-app/agent-config/commit/f6680ae981f26a125039bb5b2e19aea38016e931))
* **user-interaction:** restore efficient-tooling line in the rule body ([5ca4354](https://github.com/event4u-app/agent-config/commit/5ca4354542b40dc943ca5639ff0e2ffbdf7aa12e))
* **user-interaction:** keep law sections under the 2000-char ceiling ([48fe105](https://github.com/event4u-app/agent-config/commit/48fe1053fc4ef6f6aae861b4ff191dd16bd15a0d))
* **user-interaction:** align Iron Law 4 with self-check scope, IL1 example and reply order ([b2d2e55](https://github.com/event4u-app/agent-config/commit/b2d2e55dc8d40b4e45132c4eeac1c4ce14a55273))
* **known-red:** act on the review of the first cut ([dc48e9e](https://github.com/event4u-app/agent-config/commit/dc48e9e9e7f59e7dd2953d6f54592c2027bfa6fc))
* **council:** a short detected value is not swept through the bundle ([ea9987f](https://github.com/event4u-app/agent-config/commit/ea9987f6480701ce891144d34d3bd0ae1e69588f))
* **prompt-shape:** read patches on the raw lines; git preamble is metadata; only `\ ` annotates ([c089326](https://github.com/event4u-app/agent-config/commit/c089326ac6ce1bd69883954bcdd47ba025320128))
* **verification:** read exit literals with sign, any size and an attached redirection ([2d630dc](https://github.com/event4u-app/agent-config/commit/2d630dc501651c9038e351043263921798466883))
* **verification:** keep a redirected exit's own status, a recognised set succeeds ([8d32b19](https://github.com/event4u-app/agent-config/commit/8d32b193165d2666661095650b4965ffd3513ea5))
* **prompt-shape:** collapse diff hunks by declared length, before the fence reader ([4bc92e4](https://github.com/event4u-app/agent-config/commit/4bc92e4dfa808b6c43ad5dfa099b352ac68e4353))
* **verification:** an exit whose redirection can fail lets the line go on ([6e903b3](https://github.com/event4u-app/agent-config/commit/6e903b39d07d7fe0dff197aa9693534df4555d88))
* **turn-end-gate:** keep 'Task completed.' a claim, unknown status for a redirected builtin ([749e240](https://github.com/event4u-app/agent-config/commit/749e240d1c076eede4d196a677792315cb2d02d6))
* **prompt-shape:** a unified-diff hunk body is patch content, never owner prose ([7b23c3a](https://github.com/event4u-app/agent-config/commit/7b23c3a5f6e24c1acdc70bfba45aa39dc8ecae71))
* **turn-end-gate:** model errexit in the reachability walk, whole-word completion phrases ([6f1a9a7](https://github.com/event4u-app/agent-config/commit/6f1a9a7dbd17aa411a83e32700390ddccedc99bc))
* **turn-end-gate:** follow both pipefail settings when the text cannot say, bare builtins only, line-bound claims and ratios ([d561a9d](https://github.com/event4u-app/agent-config/commit/d561a9d9d0f58897970887ae0f0a9a3c55a6775e))
* **prompt-shape:** the word-boundary strip is owner-prose only; an unindented line ends a list fence ([bd01900](https://github.com/event4u-app/agent-config/commit/bd0190002d893ae461557044280d018a1a545bb0))
* **turn-end-gate:** linear completion scan, only the shell's own exit ends a line, CRLF blank lines end a Not verified block ([5516295](https://github.com/event4u-app/agent-config/commit/5516295130dda7100e38cc2ffd98d4e2027de726))
* **verification:** a top-level return in a Bash call is an ordinary command ([254481d](https://github.com/event4u-app/agent-config/commit/254481d9e1bfb6e51e10cce7ea4409a5e6525726))
* **prompt-shape:** removing an inline terminal region keeps the word boundary ([5c73acc](https://github.com/event4u-app/agent-config/commit/5c73acc55e2d2601973870cff275ee2ebe89ff19))
* **review-loops:** replay reads only what each round knew ([e9541f6](https://github.com/event4u-app/agent-config/commit/e9541f607dde1307999af855fcba696cceba7439))
* **turn-end-gate:** one status rule for every pipeline, credit only runs after the edit, skip non-scalar compose ports ([9ce6f16](https://github.com/event4u-app/agent-config/commit/9ce6f16d623d950ebdda585479a243a8b9c21cb0))
* **turn-end-gate:** a negated claim no longer hides a later one, pipeline status from its last command, baseURL outside comments ([47e4a20](https://github.com/event4u-app/agent-config/commit/47e4a20bd383a912013b8fc4c16e9141d67e6398))
* **language-mirror:** a glued trailing span needs two output lines directly above it ([cac635d](https://github.com/event4u-app/agent-config/commit/cac635d86571a09b7e09410b9316e1272292934f))
* **turn-end-gate:** pipefail off after any other set or shopt naming it, request targets from dequoted shell words ([6a0a933](https://github.com/event4u-app/agent-config/commit/6a0a933c79a6fb45e598894a6beeb0295ac5ce39))
* **language-mirror:** veto on the opposing language directly; tab-indented list closers close ([adf8495](https://github.com/event4u-app/agent-config/commit/adf8495419f0ca9805f238c95c8701cd23f1f0d2))
* **language-mirror:** the veto reads the raw prompt; list fences count tab columns ([6a5d13b](https://github.com/event4u-app/agent-config/commit/6a5d13b3d5a43946e62087a17a8d85741177839b))
* **turn-end-gate:** no status handed on by an exit of PIPESTATUS, credit only request targets (D10) ([39cb7d8](https://github.com/event4u-app/agent-config/commit/39cb7d8478c2c538bbe8fb5fde01f3c3012e434c))
* **language-mirror:** the veto strips only host regions; top-level closers take three spaces ([ba7f239](https://github.com/event4u-app/agent-config/commit/ba7f2392d1139672564526a5cbebb585fab0378b))
* **turn-end-gate:** read verifiers skippable through ||, match URL targets whole, ignore doc edits and false && chains ([d7c062b](https://github.com/event4u-app/agent-config/commit/d7c062b8a5ace33a609bf0bd30719f6b88b6c080))
* **turn-end-gate:** one negation check per line, no credit past an unconditional exit, shared bounded reader ([20f6b14](https://github.com/event4u-app/agent-config/commit/20f6b140aa9b849ae684b4919269e99403036f49))
* **language-mirror:** flush an unclosed fence line by line; list closers up to three past the content column ([2b6ecb8](https://github.com/event4u-app/agent-config/commit/2b6ecb8cf216bb7c25b95fa754e68966fbbe72d5))
* **turn-end-gate:** linear Not verified spans, webServer keys outside strings, stop at an unconditional exit ([cdc5e05](https://github.com/event4u-app/agent-config/commit/cdc5e05ed9a279e419024d5294cadf92f3940322))
* **language-mirror:** an unclosed fence hides nothing; list-item closers align to the content column ([d2b5e4f](https://github.com/event4u-app/agent-config/commit/d2b5e4fa1f7b75f431feacf8c42e9512c51379aa))
* **turn-end-gate:** linear comment stripping, URL credit only for HTTP clients, PIPESTATUS exit under pipefail ([8ef9347](https://github.com/event4u-app/agent-config/commit/8ef9347b9b9a77ba9d335652aa2b1074d56f4b1e))
* **review-loops:** strict index types, receipts and production entries for 0.1-0.2 ([8c9c48b](https://github.com/event4u-app/agent-config/commit/8c9c48bb5aed5fd13a9f55b3efa41d56e3927f31))
* **language-mirror:** list-item fences open; blank lines skip the output regex ([9bcf3e1](https://github.com/event4u-app/agent-config/commit/9bcf3e1f49d356ec3be174f594953bd2ec9ee5ec))
* **turn-end-gate:** webServer credit per config, linear compose index, Not verified heading on its own line ([847f8c6](https://github.com/event4u-app/agent-config/commit/847f8c61dd1f1f040002d560ff9e944455991811))
* **language-mirror:** both languages at the floor anywhere veto the pin; fence closers take only spaces or tabs ([0b97d12](https://github.com/event4u-app/agent-config/commit/0b97d123487a116e230088329a69183827748394))
* **verify:** cap surface work while building, read webServer from command strings, parse masking only for a 0 ([299cbb8](https://github.com/event4u-app/agent-config/commit/299cbb83bac97f20e1723bcf8c8260ee6dc1b54b))
* **language-mirror:** veto the pin on any contiguous run of lines that disagrees ([5434c93](https://github.com/event4u-app/agent-config/commit/5434c93c27218de445a264d12f01f819581a0c91))
* **turn-end-gate:** validate counters and counter keys, credit only the webServer script, cap surfaces ([8e997bc](https://github.com/event4u-app/agent-config/commit/8e997bc7021bb7d64b00eba9b2bce8b77eb140f2))
* **language-mirror:** fence delimiters indented at most three spaces; CR ends a line ([1036b27](https://github.com/event4u-app/agent-config/commit/1036b275bef746660bdd51f2724bac8520e8ef42))
* **turn-end-gate:** bounded counter reads, claim lines past blank lines, browser credit through the root config ([8359ae2](https://github.com/event4u-app/agent-config/commit/8359ae21be9f98a91ec9dc85fdee73c94bb7f450))
* **turn-end-gate:** read a negation on the claim's own line when the match starts at a newline ([dfc233a](https://github.com/event4u-app/agent-config/commit/dfc233a615c62fb1cc2a2cece4a72e0e810729a8))
* **verification:** a literal exit code keeps a failure only when nonzero modulo 256 ([f3d368e](https://github.com/event4u-app/agent-config/commit/f3d368eb0dc2d33271c5350d2b2403c14da711c5))
* **language-mirror:** read fences line by line, as Markdown does ([22a9a1a](https://github.com/event4u-app/agent-config/commit/22a9a1a136a3b28f5e7573b8f84567d8cf01df8f))
* **verify:** re-check workspace containment on the path resolved after open ([19cf8b4](https://github.com/event4u-app/agent-config/commit/19cf8b46be90eefe8f322cb5e3506283009c9fc7))
* **verification:** count an exit of PIPESTATUS only as a lone command with the bare expansion ([7c40e91](https://github.com/event4u-app/agent-config/commit/7c40e91eef51d78f95d920f9de5ee348526608ed))
* **verify:** open the contained real path, confirm it after open, and skip a non-object tauri config ([d837aaa](https://github.com/event4u-app/agent-config/commit/d837aaa6fb0b48cebfea11b4b52b2956bfbeb1e5))
* **verification:** count a pipefail set or an exit only where it runs in the parent shell ([91e2c88](https://github.com/event4u-app/agent-config/commit/91e2c88088e588a9bac5b8bf1241ded6ea9fc912))
* **language-mirror:** all prose together is a veto unit ([364ddf6](https://github.com/event4u-app/agent-config/commit/364ddf63f9f29773a4f4eab02bc4415f2489152b))
* **language-mirror:** the combined owner verdict joins the veto; tilde fences are code ([03f2f1a](https://github.com/event4u-app/agent-config/commit/03f2f1ae834c3626d114e61a1a14932cbc34f9a4))
* **verify:** keep surface reads inside the workspace through symlinked directories ([b1d3202](https://github.com/event4u-app/agent-config/commit/b1d3202af1b193e13008721b8d2a03ca057250e5))
* **verification:** let masking replace only a recorded 0, never demote a refusal ([6bdb430](https://github.com/event4u-app/agent-config/commit/6bdb430b030fd8ba69b6eab87efb73453c78aae9))
* **language-mirror:** a prompt pins only when all of its prose agrees ([42c1ce1](https://github.com/event4u-app/agent-config/commit/42c1ce1740a66632418518f23016789b48c6bf95))
* **turn-end-gate:** match surface URLs whole, keep inline code in Not verified lists, refuse symlinked inputs ([b83b45a](https://github.com/event4u-app/agent-config/commit/b83b45ac5d5117365f79b127c68fab4997929711))
* **verification:** never read an output line as the verifier's status ([392c06e](https://github.com/event4u-app/agent-config/commit/392c06e891146995f46b63e2848985e1b51c26f6))
* **language-mirror:** flush the prose paragraph at a document head ([93fae26](https://github.com/event4u-app/agent-config/commit/93fae2694afa8ec9de6506edfd8264f0f4ba5338))
* **turn-end-gate:** check every playwright run in a call and scan tauri lines once ([bebccf5](https://github.com/event4u-app/agent-config/commit/bebccf5148958a3a6046d5d2bf7a258584535fc3))
* **verification:** trust a status echo only after ';', never behind '||' ([a281412](https://github.com/event4u-app/agent-config/commit/a2814125d1f3b7f517107e23848f95369e4222bb))
* **language-mirror:** any two confident prose units that disagree veto the pin ([c34525c](https://github.com/event4u-app/agent-config/commit/c34525c10e3d56db916e854915439455c4797457))
* **turn-end-gate:** recognise browser runs and start commands by the commands a line runs ([61debdf](https://github.com/event4u-app/agent-config/commit/61debdfc09120a4b91ccc7dc96b81c5eb6719a18))
* **verification:** read an echoed status only when the expansion prints its digits ([f69c7ad](https://github.com/event4u-app/agent-config/commit/f69c7ad411eccff6ceb771b97f94c8265919eb53))
* **language-mirror:** an unmarked paragraph can veto but never decide the pin ([e48e404](https://github.com/event4u-app/agent-config/commit/e48e4045b6a4f0a3eeb124ab61b0b8c5b68b70c4))
* **turn-end-gate:** count a surface as driven only when its command runs ([141b0aa](https://github.com/event4u-app/agent-config/commit/141b0aa380249e83ecdad0311aeeda38e205e8c0))
* **verification:** follow a failure through the rest of the line before trusting the record ([65b14a9](https://github.com/event4u-app/agent-config/commit/65b14a9f26a379b30fb87f6bdbcd6be24aa8e0c5))
* **language-mirror:** two confident owner lines that disagree are undetermined ([5b3e5c8](https://github.com/event4u-app/agent-config/commit/5b3e5c8b9f829adfc06a11440605f7202b96087d))
* **turn-end-gate:** bound surface reads on the opened file and narrow what counts as driven ([2650e05](https://github.com/event4u-app/agent-config/commit/2650e058937fca9be5dc5cecfe1adee22fdc78aa))
* **verification:** attribute a recorded or echoed exit code to the pipeline that produced it ([1cc5fac](https://github.com/event4u-app/agent-config/commit/1cc5facb58dd6933501b4040f68008e89c0d965e))
* **language-mirror:** two confident owner spans that disagree are undetermined ([9d0f254](https://github.com/event4u-app/agent-config/commit/9d0f2544ae09a9ef5f6003c66d1b8d5293e11bfc))
* **turn-end-gate:** derive surfaces after the cheap checks and match them by name ([96f21c8](https://github.com/event4u-app/agent-config/commit/96f21c8f8e3f522889bbcf8bd9470344bf608be9))
* **verification:** read a masked exit code only where the exit code decides ([207591f](https://github.com/event4u-app/agent-config/commit/207591fe2797204c10ede6cbbeac35113b8ad2ff))
* **measure-turn-end-gate:** declare the language split as an analysis evidence artifact ([ad1f5e4](https://github.com/event4u-app/agent-config/commit/ad1f5e40b02f6a7581f3b5ad3a3405debd025a20))
* **roadmaps:** make the real-task-run-budget blocker decidable ([4d198f1](https://github.com/event4u-app/agent-config/commit/4d198f1d5ce9c865fda6079f5678df128e25d4e3))
* **ci-mirror:** clone the target of a symlinked node_modules ([ca0c1ee](https://github.com/event4u-app/agent-config/commit/ca0c1ee7863ba2aff2a14f3c9cc132cf6b5090c4))
* **trigger-evals:** load legacy-shape corpora in the local live eval ([5ebe871](https://github.com/event4u-app/agent-config/commit/5ebe871e31420fabda065bc0247326e7228172b7))
* **ci:** isolate CLAUDE_CONFIG_DIR in the host-loadability smoke ([0d54f7c](https://github.com/event4u-app/agent-config/commit/0d54f7cec57a0389293a4e1040ed9f3c372fd213))
* **claude-plugin:** scope plugin root to .claude-plugin so agents/ is not loaded as subagents ([e4182a8](https://github.com/event4u-app/agent-config/commit/e4182a8adc633d5d033c370b9fac6acb0ed194b3))
* **hooks:** LatestRun typechecks as JSON; keep the chunk-defined-twice check ([be2aef3](https://github.com/event4u-app/agent-config/commit/be2aef3a405b9fa6c0bae661787e99120cef1c72))
* **hooks:** the dispatcher pays an owed environment restore before anything else ([8c721c9](https://github.com/event4u-app/agent-config/commit/8c721c9af578c845117bbd7a810d2c5cbb428940))
* **hooks:** the doctor skips damaged summary history items one by one ([f99722e](https://github.com/event4u-app/agent-config/commit/f99722e5c0ed6c28f702ed2cc220a4d1545bc0eb))
* **hooks:** the doctor reads only latest rows the writer would keep, and never drops the history for a bad one ([b2d6470](https://github.com/event4u-app/agent-config/commit/b2d64704e3b20a422d3210cc23a1020e145ee6df))
* **hooks:** the summary records each concern's own completion, and the doctor ranks history on it ([3b020d6](https://github.com/event4u-app/agent-config/commit/3b020d68d45d8b0214ca5a2951f6a9f5da9a7693))
* **hooks:** the doctor weighs a summary's latest row against its history, not instead of it ([3e959df](https://github.com/event4u-app/agent-config/commit/3e959df59f7f5aa967c9ac385801dc19c21c75ee))
* **hooks:** the summary's latest row carries the run's outcome ([29a7951](https://github.com/event4u-app/agent-config/commit/29a7951c2d87a832c5c1391b93e6e8cd4fa3c0dd))
* **hooks:** one run order for feedback writers and the doctor; latest rows validated, prototype-free ([2864752](https://github.com/event4u-app/agent-config/commit/2864752ddc464480b7812b329a5156c4e6686b84))
* **hooks:** the summary's latest row keeps the later run by the concern's own clock ([19ebac7](https://github.com/event4u-app/agent-config/commit/19ebac79abb1b9d495de45830f2d8f79a71b2346))
* **hooks:** summary keeps each concern's last run outside the capped history ([b2ce2b1](https://github.com/event4u-app/agent-config/commit/b2ce2b1215e61aef6b9a8117e07d8665716b8fde))
* **hooks:** a quiet allow keeps its own file when the summary write fails; a full restore clears both marks ([5255754](https://github.com/event4u-app/agent-config/commit/5255754fefa1c09f0d91ad35508eb52e764b8e9c))
* **hooks:** per-concern feedback names its dispatch, and the doctor breaks an equal-instant tie by it ([227b6ca](https://github.com/event4u-app/agent-config/commit/227b6ca9ed601384e37ca41456dd918f1b47c62d))
* **hooks:** a spawned concern gets the scope's hardened baseline, never the live environment ([3503ff9](https://github.com/event4u-app/agent-config/commit/3503ff99929bb118f7d6cab4135c87998455c361))
* **hooks:** owe the baseline when a half-applied scope open cannot roll back ([5106fd1](https://github.com/event4u-app/agent-config/commit/5106fd1a5389808f091be781529899a6ffb77d67))
* **hooks:** recover an owed environment restore before the next scope opens ([3b6c388](https://github.com/event4u-app/agent-config/commit/3b6c3886317c4a263b75684bdbc9b8848fe5ee10))
* **hooks:** address the round-8 ratification findings ([9c6bb2d](https://github.com/event4u-app/agent-config/commit/9c6bb2d8c775311e857f97fd1a6f3505c61d2c11))
* **hooks:** keep the budget file watched; prove refusal and ordering end to end ([d303556](https://github.com/event4u-app/agent-config/commit/d3035561c31d491c1cae4ce63e837a6241a37ee2))
* **hooks:** address the round-6 ratification findings ([ad94bf9](https://github.com/event4u-app/agent-config/commit/ad94bf9b451d614c7f4aa3c3e58f738c58b2b26e))
* **hooks:** address the round-5 ratification findings ([ec407c7](https://github.com/event4u-app/agent-config/commit/ec407c76f8f0dc384b3b2744487c17ab6c592895))
* **hooks:** address the round-4 ratification findings ([bd3c61c](https://github.com/event4u-app/agent-config/commit/bd3c61cc963820a2897b34fa50c16d65b6853b8b))
* **hooks:** address the round-3 ratification findings ([1157db0](https://github.com/event4u-app/agent-config/commit/1157db0a5f410b8a2a9710c164b4e37a8d7468be))
* **hooks:** address the round-2 ratification findings ([ec926e9](https://github.com/event4u-app/agent-config/commit/ec926e910658cce5616269d9ba1d20e8784e35ac))
* **hooks:** address the round-1 ratification findings ([7b9f836](https://github.com/event4u-app/agent-config/commit/7b9f836abbfc38da805013980b22204069f40d35))
* **locks:** no attempt starts after the wait deadline ([93aa0bb](https://github.com/event4u-app/agent-config/commit/93aa0bbd7265977668a7b4e085159ad8db42f17f))
* **locks:** a waiting acquire ends on the wall clock ([08958e9](https://github.com/event4u-app/agent-config/commit/08958e9c170f8af437fbe57e7d32157c4c286b55))
* **locks:** the pruner releases a dead holder's lock; the ledger lock refuses on error ([c8ea6fc](https://github.com/event4u-app/agent-config/commit/c8ea6fc20d2faaf77cc97dd0f0d62fd1e64cafda))
* **locks:** owner-only guard files, an accurate recheck comment, a per-call strict test ([daeb649](https://github.com/event4u-app/agent-config/commit/daeb6490dd8b3bbb00f375982ea98fb957d559c1))
* **locks:** a caller that backs off releases its generation instead of removing it ([1e312ac](https://github.com/event4u-app/agent-config/commit/1e312ac56bfb491c5b7506a09e02ab37aa80d57d))
* **locks:** pruners keep each lock's highest generation ([f4560ac](https://github.com/event4u-app/agent-config/commit/f4560ac412a2463f69db979f557fd2f2dd940de5))
* **locks:** a superseder rechecks that the generation it superseded is still stale ([608828b](https://github.com/event4u-app/agent-config/commit/608828b09c63f17c90917e310f1ce198bd027195))
* **locks:** a strict caller refuses a stale holder at once, and pruners keep fresh generations ([fcf48b9](https://github.com/event4u-app/agent-config/commit/fcf48b93421031c85034de1058c0d94be5f280e0))
* **locks:** prune each lock generation with its retired file ([8ab9c96](https://github.com/event4u-app/agent-config/commit/8ab9c96b0bbbe2c6a5052998ce5074b25ebf5d3f))
* **locks:** read-modify-write writers refuse when no guard can be taken ([a5a9797](https://github.com/event4u-app/agent-config/commit/a5a9797161df999e7785ecd14f0fc5676228a636))
* **locks:** never allocate a generation the listing would not see ([24b2f85](https://github.com/event4u-app/agent-config/commit/24b2f858aa3b77701b989686e12b7c6eb31c757b))
* **locks:** a failed listing throws, and strict callers never supersede a stale holder ([dddf680](https://github.com/event4u-app/agent-config/commit/dddf6801ec8e6957797f740bbbf947f862476892))
* **locks:** move three more stale-lock breakers to the generation lock ([fb2bda0](https://github.com/event4u-app/agent-config/commit/fb2bda07c0d89052aa337c346a4663d3d4fe51ee))
* **locks:** no stale-lock break or release lets two callers hold the five locks ([4db4b83](https://github.com/event4u-app/agent-config/commit/4db4b83442d76271a08527b3d1e47e39915f56f1))

### Performance

* **hooks:** one feedback write per dispatch for quiet concerns ([46e1d7b](https://github.com/event4u-app/agent-config/commit/46e1d7b4e67267e7b830da6a8a9dd8e0287da56f))
* **hooks:** harden the concern environment once per dispatch ([ad766da](https://github.com/event4u-app/agent-config/commit/ad766da8a4e701f87512fe9dfe13abb9bcace657))
* **cli:** compile-cache the hook bundle on the launcher path ([133580b](https://github.com/event4u-app/agent-config/commit/133580bce052aaa4033d69abf3433d99e41149a9))
* **hooks:** load one yaml copy per dispatch, not two ([24447ee](https://github.com/event4u-app/agent-config/commit/24447ee6093ecee2a69cb6208ef348421c28663c))

### Reverts

* **rules:** withdraw the owner-class column from decision-revisit-gate ([d1c5e2b](https://github.com/event4u-app/agent-config/commit/d1c5e2b7e4268b28fc391d00be0dbfd491c7dc43))
* **hooks:** withdraw the dispatch bundle raise for the owner-prose pin ([e373aac](https://github.com/event4u-app/agent-config/commit/e373aac9f0679416e3d57152479406ec4b3af4b0))

### Documentation

* **ratification:** feedback-containment record, round 4 — both seats ratified ([befe663](https://github.com/event4u-app/agent-config/commit/befe66354a12812e4ddbb2d8a163adadd8cc6cd8))
* **evidence:** council prompt for feedback-containment ratification round 4 ([f4b15a7](https://github.com/event4u-app/agent-config/commit/f4b15a71ffa9e57c330a51f47815a399c7cc22be))
* **ratification:** record the owner's decision on feedback containment ([24c2c44](https://github.com/event4u-app/agent-config/commit/24c2c4461114375a748616bc60ee4d0132b0b135))
* **ratification:** state gain, risk and rollback on the feedback-containment record ([597c6d8](https://github.com/event4u-app/agent-config/commit/597c6d84200231deb2fef66959a6c7c7676434ca))
* **ratification:** feedback-containment record, round 3 ([a0ccd2e](https://github.com/event4u-app/agent-config/commit/a0ccd2e6f53bce5065a0230f5c5f43f707dcf9d2))
* **evidence:** council prompt for feedback-containment ratification round 3 ([6119aa1](https://github.com/event4u-app/agent-config/commit/6119aa11441fbc8860caf3c58d0c5c8812bd1f4c))
* **evidence:** round-2 prompt quotes round 1 without its stance line ([3ebd3de](https://github.com/event4u-app/agent-config/commit/3ebd3de8258bc8666bf7094271e9bc2e5619ce77))
* **evidence:** council prompt for feedback-containment ratification round 2 ([18d3cc8](https://github.com/event4u-app/agent-config/commit/18d3cc83eb851e13923dd116b457c19d730b2315))
* **distribution:** awesome-mcp-servers attempt 3 is accepted; two reads refreshed ([07abd6c](https://github.com/event4u-app/agent-config/commit/07abd6c821f0637cb820a8ed0f60b02d6499c771))
* **evidence:** council prompt for the feedback-containment ratification ([b110219](https://github.com/event4u-app/agent-config/commit/b11021900854465a9649960b8c15ac749da23f2b))
* **roadmaps:** defer 2.4 into 2.5 and add the step receipts ([eb1bd27](https://github.com/event4u-app/agent-config/commit/eb1bd27b1087dec54de61b0e66e2662cbfe6d44a))
* **ratification:** owner-class column, confirmed-non-expanding 2/2 in round 3 ([28f70fc](https://github.com/event4u-app/agent-config/commit/28f70fc67ecfa4213ba4b52eb47abb566bec62a9))
* **evidence:** ratification prompt for the owner-class column, round 3 ([e8a558f](https://github.com/event4u-app/agent-config/commit/e8a558f9729969138cf8e42a180a2d8013ef23fa))
* **evidence:** ratification prompt for the owner-class column, round 2 ([14e73bb](https://github.com/event4u-app/agent-config/commit/14e73bb2e0590d69f33c872e01798bd832cfa50c))
* **rules:** say that an outside row still routes to the owner ([3ba75b0](https://github.com/event4u-app/agent-config/commit/3ba75b0ae74d136ff2adb08df313a7e01e298bd7))
* **evidence:** ratification prompt for the owner-class column, round 1 ([d57045d](https://github.com/event4u-app/agent-config/commit/d57045db4cb451f64358049ba5bd5aa894f82f1b))
* **roadmaps:** record questions-that-reach-the-right-decider progress ([e2fe5b5](https://github.com/event4u-app/agent-config/commit/e2fe5b5f264de22bf8cf84a0180faa704bd2ed07))
* **rules:** name the owner class on every reserved row ([674c23e](https://github.com/event4u-app/agent-config/commit/674c23e940f80937f5fc2f19de6302bce6dd1539))
* **roadmaps:** bind each tick's receipt to the step's own paths ([01b12bb](https://github.com/event4u-app/agent-config/commit/01b12bbedd21092cece9c9d41298f6a82aab82ca))
* **roadmaps:** park stop-hooks-that-count-own-edits behind its owner blocker ([fde4a8d](https://github.com/event4u-app/agent-config/commit/fde4a8d1ae25ff1ee6b90cd11e31f4cc2ea9e565))
* **roadmaps:** add step receipts, the offset exemption and the regenerated owned digest ([705f163](https://github.com/event4u-app/agent-config/commit/705f163051f5f41fe330bccfc25e49284467cec6))
* **roadmaps:** record D4, D5 and the work-product owner blocker; carry the live wiring ([d67d650](https://github.com/event4u-app/agent-config/commit/d67d650a14fa9b034a37d7aa577c95fa85e51fbc))
* **contracts:** re-emit the host cost census at the current rule corpus ([516c67f](https://github.com/event4u-app/agent-config/commit/516c67fe059a10490f2c44719a0d1eebe41e9bd7))
* **roadmaps:** close mandates-scoped-to-the-goal without the hook raise and split off its wiring ([64fdece](https://github.com/event4u-app/agent-config/commit/64fdecef3d4edf7666ce415c37cca5b4d6bc49c7))
* **evidence:** keep the 18 goal-record ratification prompts as the record ([a0951b9](https://github.com/event4u-app/agent-config/commit/a0951b93c46fcd04630d7b846365233817cce6ee))
* **roadmap:** order the live-wiring risk register by rank ([f94496c](https://github.com/event4u-app/agent-config/commit/f94496c69b76fc3d17d487fb13bf396b265bbd08))
* **roadmap:** receipts, risk register and owned digest for the owner-prose carry ([8c372bb](https://github.com/event4u-app/agent-config/commit/8c372bbb837ada8ef74974fa91b77db5df1b0717))
* **roadmap:** drop the offset exemption the archive already covers ([b8bf221](https://github.com/event4u-app/agent-config/commit/b8bf22101f004063da4dc15569c3c1382d176b75))
* **roadmap:** fold the claim-chunk follow-up into the live-wiring roadmap ([2f62605](https://github.com/event4u-app/agent-config/commit/2f62605452102bc79288166f51eb36a0f77cc570))
* **roadmap:** carry the owner-prose pin wiring to its own roadmap ([7ec36e8](https://github.com/event4u-app/agent-config/commit/7ec36e8750adc5a955257b181709b88d8ef72198))
* **roadmap:** carry the live wiring to a follow-up roadmap (D12) ([91a5c2f](https://github.com/event4u-app/agent-config/commit/91a5c2f2d20f6ac4219f167d6a142b3b7856f4a1))
* **git-workflow:** a known red stays local ([7b43ef4](https://github.com/event4u-app/agent-config/commit/7b43ef4f3b94d91dad44fae6bffe115b3d83397a))
* **evidence:** ratification question round 22 for the owner-prose pin ([f3e41e4](https://github.com/event4u-app/agent-config/commit/f3e41e4ceef30ff0fce6d040ec4bfff9eb194ced))
* **evidence:** ratification question round 21 for the owner-prose pin ([2dbef06](https://github.com/event4u-app/agent-config/commit/2dbef06421c3a55836f9ba596c3527128a93d9dc))
* **evidence:** ratification question round 20 for the owner-prose pin ([5a40adb](https://github.com/event4u-app/agent-config/commit/5a40adb48f08ac36081cc90d357cfc51d43af2b1))
* **evidence:** shorten the round-19 question under the council's bundle ceiling ([50ff12e](https://github.com/event4u-app/agent-config/commit/50ff12eb2eb7f97b5b29d426b83e0197d774204f))
* **evidence:** ratification question round 19 for the owner-prose pin ([8d6668a](https://github.com/event4u-app/agent-config/commit/8d6668a179c039b57910eed21e3721ff29a2374d))
* **roadmap:** carry annotation, risk register and owned digest for the unlisted_surface follow-up ([81cae58](https://github.com/event4u-app/agent-config/commit/81cae58a41777acf7548559c1eea6e36fd47a5ae))
* **evidence:** ratification question round 18 for the owner-prose pin ([1b66f79](https://github.com/event4u-app/agent-config/commit/1b66f79101384498bde5598663b107bad15c3a2a))
* **roadmap:** carry step 4.4's live wiring to road-to-unlisted-surface-in-a-claim-chunk (D11) ([8a771f3](https://github.com/event4u-app/agent-config/commit/8a771f3ead54d0ffa35f804d5de1cbb738e6ddca))
* **evidence:** ratification question round 17 for the owner-prose pin ([6b8962f](https://github.com/event4u-app/agent-config/commit/6b8962f8134f0d0b64e48471fa31941e0e6a30e8))
* **review-loops:** step receipts for the steps ticked on this branch ([5bd8836](https://github.com/event4u-app/agent-config/commit/5bd88364317e113fcd2d83dd283ee10dbfd74806))
* **review-loops:** move the convergence advisory into the ai-council skill ([edd6cbd](https://github.com/event4u-app/agent-config/commit/edd6cbd0df206291c822c5d43fd5351091547100))
* **council:** keep both round-26 ratification replies verbatim ([12e90e3](https://github.com/event4u-app/agent-config/commit/12e90e3da8ed80ea88ffdf783cde26f93ec6dc78))
* **review-loops:** route both owner blockers and park the roadmap ([ae057c3](https://github.com/event4u-app/agent-config/commit/ae057c36e836a4c048d8ad5b7a04ff5419b5a790))
* **evidence:** ratification question round 16 for the owner-prose pin ([c86a73d](https://github.com/event4u-app/agent-config/commit/c86a73dd05709148780d7dd91ce33868b7d4dcce))
* **evidence:** ratification question round 15 for the owner-prose pin ([480d438](https://github.com/event4u-app/agent-config/commit/480d43819ea24a19c82fad683a1d522761fbe9cb))
* **evidence:** council prompt for ratification round 26 ([d9d7e60](https://github.com/event4u-app/agent-config/commit/d9d7e6049bca628c744db3d3822537842f75eab2))
* **review-loops:** run the convergence verdict before the next ratification round ([9cc80cd](https://github.com/event4u-app/agent-config/commit/9cc80cd83ea02c7a39aa5ec17958cef336e8355d))
* **review-loops:** council verdict on the convergence criterion ([c06f154](https://github.com/event4u-app/agent-config/commit/c06f1546232d4d7378b1337907dbf07ea7c942db))
* **review-loops:** reader origin classes for the ten longest loops ([f95da3b](https://github.com/event4u-app/agent-config/commit/f95da3b4aa6bd4aa10d2b02f7e7045da55c84715))
* **evidence:** restore the override/missed-update distinction in round 14 ([eedd05c](https://github.com/event4u-app/agent-config/commit/eedd05cf849abf6502de34622b1119ae4d61b428))
* **evidence:** shorten the round-14 ratification question under the council's bundle ceiling ([5b34362](https://github.com/event4u-app/agent-config/commit/5b34362a4e222f44fc7ca340fb84fb6742025d80))
* **evidence:** ratification question round 14 for the owner-prose pin ([a9de2a7](https://github.com/event4u-app/agent-config/commit/a9de2a786d2ac4b5a5f49abb123ad995cbd82bac))
* **prompt-shape:** name the host-tag residual of stripHostRegions ([4c343eb](https://github.com/event4u-app/agent-config/commit/4c343ebf154ce5ee57f196edbd1527cd8c64346e))
* **evidence:** ratification question round 13 for the owner-prose pin ([9ec2174](https://github.com/event4u-app/agent-config/commit/9ec2174850262758769ac5a51c7868fef78cc641))
* **evidence:** ratification question round 12 for the owner-prose pin ([a1e9d39](https://github.com/event4u-app/agent-config/commit/a1e9d39e5ae4c4e738a70e733c1e29a9400828be))
* **evidence:** ratification question round 11 for the owner-prose pin ([75d91da](https://github.com/event4u-app/agent-config/commit/75d91dac57dbd6b094f9d93134b7e1e272761ea9))
* **evidence:** ratification question round 10 for the owner-prose pin ([5750bf4](https://github.com/event4u-app/agent-config/commit/5750bf4297a4c2627d1a15812b74119bad1659d4))
* **evidence:** ratification question round 9 for the owner-prose pin ([b2f169a](https://github.com/event4u-app/agent-config/commit/b2f169a1a38c5dbeb05ff2981ef3d61535a7c2ee))
* **evidence:** ratification question round 8 for the owner-prose pin ([0242707](https://github.com/event4u-app/agent-config/commit/02427078866342a14ae967046b27cba7e4af4291))
* **evidence:** ratification question round 7 for the owner-prose pin ([3e16897](https://github.com/event4u-app/agent-config/commit/3e16897ce97e282ee96ed4d9816b261083bb7deb))
* **evidence:** ratification question round 6 for the owner-prose pin ([f691be4](https://github.com/event4u-app/agent-config/commit/f691be406b6a98970e416604b4bfa7f5d419343c))
* **evidence:** ratification question round 5 for the owner-prose pin ([5704105](https://github.com/event4u-app/agent-config/commit/570410596b173b046a8491502f2b1a86f6d18c0e))
* **evidence:** ratification question round 4 for the owner-prose pin ([fe18165](https://github.com/event4u-app/agent-config/commit/fe181655c436a228484c3571bbc006e1a5243063))
* **evidence:** ratification question round 3 for the owner-prose pin ([a479498](https://github.com/event4u-app/agent-config/commit/a47949851ce16173b389d445df71c1dda21bbc57))
* **evidence:** ratification question round 2 for the owner-prose pin ([c6ef1f4](https://github.com/event4u-app/agent-config/commit/c6ef1f4346d006645f27dd0b5f2488ba6c2a92c1))
* **evidence:** ratification question for the owner-prose pin bundle raise ([2633aae](https://github.com/event4u-app/agent-config/commit/2633aaec3f45a12e1ab4b731ecc4b142783f7fd8))
* **roadmap:** shadow receipts for Phase 5 and reach exemptions for the report scripts ([3e160a2](https://github.com/event4u-app/agent-config/commit/3e160a298f1bef7e6f33029b4ea8f29619b63f8a))
* **roadmap:** record the arming verdicts and archive done-claims roadmap ([d5b52da](https://github.com/event4u-app/agent-config/commit/d5b52da129845672cbedaf3f88cf190897f303f4))
* **roadmap:** record the council's floor for short owner spans (D5) ([db4d6ea](https://github.com/event4u-app/agent-config/commit/db4d6ea24b4c08b3eb3d6fa8559f5be9f0242cf6))
* **roadmap:** close throughput-recovery 4.1 on the council's option (b) ([e85ca00](https://github.com/event4u-app/agent-config/commit/e85ca00b52c73337e3877b8e80ba5599e5fe22ee))
* **evidence:** record the language refusal split baseline for 2026-11-03..21 ([728c37e](https://github.com/event4u-app/agent-config/commit/728c37e8515a3a5b9af175b932323452dae292aa))
* **roadmaps:** give every added verify clause a falsifiable expectation ([de7e129](https://github.com/event4u-app/agent-config/commit/de7e129e0851f4bda11e5901405726d7a0d9944d))
* **council:** round-25 replies are quoted text, not references ([9f5ef03](https://github.com/event4u-app/agent-config/commit/9f5ef03f4522f0bd741d70154e2cac18069d2d0e))
* **ratification:** state gain, risk and rollback on the round-25 record ([8810790](https://github.com/event4u-app/agent-config/commit/8810790d0deec3f6e3572a68b62fad304b70642c))
* **ratification:** round-25 record, split verdict, both replies verbatim ([2a3cc8c](https://github.com/event4u-app/agent-config/commit/2a3cc8c1738a4c559f1efd4b0a125f42d999beb1))
* **roadmaps:** plan every measure from the 2026-11-21 session retro ([a4dcebe](https://github.com/event4u-app/agent-config/commit/a4dcebe4176d29aa4a2ae5a6914e6f528241e2a3))
* **evidence:** council prompt for ratification round 25 ([2b47d6e](https://github.com/event4u-app/agent-config/commit/2b47d6e1de5131bc381c38f79b513a37bc63020d))
* **evidence:** record the owner's directive for the session-retro roadmaps ([3e375d8](https://github.com/event4u-app/agent-config/commit/3e375d8403e3ef6b52d762dec108afd6d1390786))
* **verify-completion-evidence:** name the wrapper-masks-exit-code trap ([1e7652d](https://github.com/event4u-app/agent-config/commit/1e7652d8b5f046a04b921b736fc682bd8d8cfb8b))
* **roadmaps:** step receipts, a verify clause that states its check, a live reference ([51be465](https://github.com/event4u-app/agent-config/commit/51be46502b45b14c8623a4e3b7cf02ed5b0f1ba0))
* **council:** keep both round-24 ratification replies verbatim ([e49143f](https://github.com/event4u-app/agent-config/commit/e49143f068a0e29147f37e0afc1c5795c1392a5f))
* **evidence:** council prompt for ratification round 24 ([d775125](https://github.com/event4u-app/agent-config/commit/d775125cee0571d3a9f13f464239f409d893223c))
* **evidence:** council prompt for ratification round 23 ([1bcde45](https://github.com/event4u-app/agent-config/commit/1bcde4548ab0a6c23e86e9312955a8ab8827a514))
* **evidence:** council prompt for ratification round 22 ([937dcbe](https://github.com/event4u-app/agent-config/commit/937dcbe0d5dedcce41849b20a071f8b5b6698a17))
* **evidence:** council prompt for ratification round 21 ([81cbe4f](https://github.com/event4u-app/agent-config/commit/81cbe4f065f01850784318e1af5e318997f73160))
* **evidence:** council prompt for ratification round 20 ([59a3877](https://github.com/event4u-app/agent-config/commit/59a38779734860a62729ea1bf64165462a8334bb))
* **evidence:** council prompt for ratification round 19 ([a42e30f](https://github.com/event4u-app/agent-config/commit/a42e30ff912e611ed28363af7c66e06cd4a51704))
* **evidence:** council prompt for ratification round 18 ([9493284](https://github.com/event4u-app/agent-config/commit/9493284c251c902d96ea09c857e9ff5c25ad6d6f))
* **evidence:** council prompt for ratification round 17 ([e0ed08e](https://github.com/event4u-app/agent-config/commit/e0ed08ec05854dde03ed14d0ad8d11167d7bf635))
* **evidence:** council prompt for ratification round 16 ([89d6e66](https://github.com/event4u-app/agent-config/commit/89d6e66704f3d53cd9be2e1e9f7ea560db580e12))
* **evidence:** council prompt for ratification round 15 ([ac7705e](https://github.com/event4u-app/agent-config/commit/ac7705e2c12dffe854f97f517d204569812121db))
* **evidence:** refresh the round-14 prompt to its head ([08f50fb](https://github.com/event4u-app/agent-config/commit/08f50fbdc2a2158f3c782a3d21dfe5f2815f0f51))
* **hooks:** feedback_policy states the quiet-allow fallback ([54eda02](https://github.com/event4u-app/agent-config/commit/54eda0295cfcc7e20b6d9768ae17b5bbe6b4d6a1))
* **evidence:** council prompt for ratification round 14 ([5575200](https://github.com/event4u-app/agent-config/commit/557520096a9961b226cafcd75c56ec547edf61b7))
* **evidence:** drop an unmeasured figure from the round-13 prompt ([5d6f7d9](https://github.com/event4u-app/agent-config/commit/5d6f7d9c2d22833237125376abbaf8910e27356f))
* **evidence:** council prompt for ratification round 13 ([62defc8](https://github.com/event4u-app/agent-config/commit/62defc8b95f125c7eb43469bb13df455149c44bb))
* **evidence:** council prompt for ratification round 12 ([8870e44](https://github.com/event4u-app/agent-config/commit/8870e4433cd2f7c175d4f3ce46c7c1eb5bc6029b))
* **evidence:** council prompt for ratification round 11 ([4984593](https://github.com/event4u-app/agent-config/commit/49845931730d2faec297c559f276c870e505ee86))
* **evidence:** council prompt for ratification round 10 ([8d7e065](https://github.com/event4u-app/agent-config/commit/8d7e06536ebd7fcb1c4761c99555e20b2e5d09c4))
* **roadmaps:** record the acceptance criteria of the hook-system roadmap ([76e6f36](https://github.com/event4u-app/agent-config/commit/76e6f363b6923b943bb0541ec77788386c1ab3ca))
* **evidence:** ratification prompt, round 9 ([1d5f560](https://github.com/event4u-app/agent-config/commit/1d5f5604d6429bbd50c8ff541d5cef5ead5de7e6))
* **evidence:** ratification prompt, round 8 ([aea119a](https://github.com/event4u-app/agent-config/commit/aea119a6511c314b021d997b9a40e3a88f22863f))
* **evidence:** ratification prompt, round 7 ([fd0a1d4](https://github.com/event4u-app/agent-config/commit/fd0a1d4419abde8c29d8cc80c91b8326a8812020))
* **evidence:** ratification prompt, round 6 ([a81f3e4](https://github.com/event4u-app/agent-config/commit/a81f3e466dee9341094ddab5bf05d219a022967c))
* **evidence:** ratification prompt, round 5 ([6797cbf](https://github.com/event4u-app/agent-config/commit/6797cbfd9528a423e31cb2f3d5e7b747048f9f2a))
* **evidence:** round-4 prompt within the council bundle ceiling ([23eb1f6](https://github.com/event4u-app/agent-config/commit/23eb1f6aa8d46b8b5eae11648a07c4270f90326f))
* **evidence:** ratification prompt, round 4 (complete package) ([f47ce74](https://github.com/event4u-app/agent-config/commit/f47ce7413e3a6243f1aa2c556835f4c0481a86f5))
* **evidence:** ratification prompt, round 3 ([6ed8cee](https://github.com/event4u-app/agent-config/commit/6ed8cee7f81bb2096d15588d7f8da12f076a8611))
* **evidence:** ratification prompt, round 2 ([54dd24f](https://github.com/event4u-app/agent-config/commit/54dd24f331ecc9faa36c8e821a5c2b77225ea133))
* **evidence:** ratification prompt for the hook budget and dispatcher change ([425d969](https://github.com/event4u-app/agent-config/commit/425d96977a6a18b9c1022380d2af84ca5036cc31))
* **roadmaps:** plan the hook budget replacement and the hook-system rework ([25eaa83](https://github.com/event4u-app/agent-config/commit/25eaa83fc836cf0620add78ecb3ebf6f4eafda3c))
* **review:** re-bind R2 round 5 to the scope its fixes produced ([9038273](https://github.com/event4u-app/agent-config/commit/9038273f7589d30a1451d371a58c458dea78a851))
* **review:** R2 round-5 dispositions — two fixed ([d166447](https://github.com/event4u-app/agent-config/commit/d166447256da508752aa9585bae2737b2e32ea4b))
* **locks:** the state_io comments and the hook contract name the generation lock ([3c1b09f](https://github.com/event4u-app/agent-config/commit/3c1b09fa123a88e61c2f1c2dd126415306f42c57))
* **review:** R2 round 5 of the generation lock, two findings ([c45e7ff](https://github.com/event4u-app/agent-config/commit/c45e7ffa5c860e35cb5b23259b6e7c262047e4f4))
* **ratification:** the generation lock, ratified 2/2 in round 18 ([ca023b3](https://github.com/event4u-app/agent-config/commit/ca023b350ab12ab018b1b1ee6c9b425b1dc1c38a))
* **council:** the round-18 ratification question for the generation lock ([bc04ff5](https://github.com/event4u-app/agent-config/commit/bc04ff5c985fcbd9eacc11f769d34fd48f144417))
* **locks:** state the wait guarantee and the dispatch raise as they are ([9fe72c8](https://github.com/event4u-app/agent-config/commit/9fe72c8e4c3aa1c3746407eb3fe8c5476012ca77))
* **council:** the round-17 ratification question for the generation lock ([657ed6b](https://github.com/event4u-app/agent-config/commit/657ed6bc8dc858d3addc082da549daab417dcd47))
* **council:** the round-16 ratification question for the generation lock ([1039b3c](https://github.com/event4u-app/agent-config/commit/1039b3cf68312960c3c3cff358c6c9af12cf777e))
* **review:** R2 round-4 dispositions — five fixed ([43d6906](https://github.com/event4u-app/agent-config/commit/43d69062eb603aeba53c808fa2fe4661d2aa77c1))
* **review:** R2 round 4 of the generation lock, five findings ([05e0390](https://github.com/event4u-app/agent-config/commit/05e039068d51e2c90d659d68d7f3ce528e79bcd3))
* **review:** R2 round-3 dispositions — four fixed ([8e24a81](https://github.com/event4u-app/agent-config/commit/8e24a81947c72f0191589d01166879e436bd5e11))
* **review:** R2 round 3 of the generation lock, four findings ([32ba425](https://github.com/event4u-app/agent-config/commit/32ba425b5f3af0a3ffd7a94fb3f8bb412a2cd56e))
* **ratification:** the generation lock, ratified 2/2 in round 15 ([08da1d1](https://github.com/event4u-app/agent-config/commit/08da1d11a6c4942d1f0e3c09ee0d5d25b73dfe03))
* **council:** the round-15 ratification question (round 14 lacked one stance line) ([bfb2b2f](https://github.com/event4u-app/agent-config/commit/bfb2b2f6f0b5a79ed529d897e123d39d5b22ad3c))
* **council:** the round-14 ratification question for the generation lock ([43b52aa](https://github.com/event4u-app/agent-config/commit/43b52aa85512fb7f3aa2a48ec3e383031e181eca))
* **locks:** a pruner can also remove the superseded generation after our create ([97eb163](https://github.com/event4u-app/agent-config/commit/97eb163a1749da33c0a22b2ac944f36a4350a0af))
* **council:** the round-13 ratification question for the generation lock ([afdb245](https://github.com/event4u-app/agent-config/commit/afdb2451deef91e9e4119d60c635c7c9ecf196c1))
* **council:** fit the round-12 question under the council's size limit ([d8308e9](https://github.com/event4u-app/agent-config/commit/d8308e9af3a072abc96f23d985c3b29bc13d373c))
* **council:** the round-12 ratification question for the generation lock ([5fbdf0f](https://github.com/event4u-app/agent-config/commit/5fbdf0f902c8b8d1d3baca15e3a126b25ca5ec55))
* **locks:** the paused-holder residual covers strict holders too ([9738bf7](https://github.com/event4u-app/agent-config/commit/9738bf7d72d7ceedd0b324c8c02b77b5cded5f36))
* **council:** the round-11 ratification question for the generation lock ([983d6c1](https://github.com/event4u-app/agent-config/commit/983d6c14e62b3b22d6517f81830368a38e7e63c3))
* **council:** the round-10 ratification question for the generation lock ([eeaed4c](https://github.com/event4u-app/agent-config/commit/eeaed4c2f29cf3c1837840d161ce5aa48930fb83))
* **council:** the round-9 ratification question for the generation lock ([ef27d56](https://github.com/event4u-app/agent-config/commit/ef27d569ceea57634f9df1e15c310eb676522613))
* **council:** the round-8 ratification question for the generation lock ([ed9b85c](https://github.com/event4u-app/agent-config/commit/ed9b85c83d58907ddc384312e3bed8f8ce4ad5d6))
* **review:** R2 round-2 dispositions — five fixed, one accepted ([c86f146](https://github.com/event4u-app/agent-config/commit/c86f14617de717ae0043f065e48e8a367aa04c7e))
* **review:** R2 round 2 of the generation lock, six findings ([2c78f82](https://github.com/event4u-app/agent-config/commit/2c78f8219b77617f5d334ca9cd7d96223949611e))
* **review:** R2 round-1 dispositions — two fixed, one deferred, one accepted ([75e53f0](https://github.com/event4u-app/agent-config/commit/75e53f05d96ec1c142ed702566b87ddb847f3d0e))
* **review:** R2 completion review of the generation lock, four findings ([3c0273e](https://github.com/event4u-app/agent-config/commit/3c0273e486234c1cddf49351031e8e047de04127))
* **ratification:** the generation lock, ratified 2/2 in round 7 ([994aa9a](https://github.com/event4u-app/agent-config/commit/994aa9ad4ea20064e4e244264142d4d3b2a7cebd))
* **council:** the round-7 ratification question, with the stance line the record reads ([d863000](https://github.com/event4u-app/agent-config/commit/d863000c22f27e7a5bf2ebaccb480b0eee5cbcb0))
* **council:** the round-6 ratification question for the generation lock ([f6f89c3](https://github.com/event4u-app/agent-config/commit/f6f89c3901e56df43496ade11faac65935fdad12))
* **council:** the round-5 ratification question for the generation lock ([19a5249](https://github.com/event4u-app/agent-config/commit/19a5249049b57b5ee4896ae2c98219e314e1c9e9))
* **locks:** scope the exclusion claim to callers of the protocol ([12f5aab](https://github.com/event4u-app/agent-config/commit/12f5aab55185418643d03f154625758ac70d47a8))
* **council:** the round-4 ratification question for the generation lock ([c4281e0](https://github.com/event4u-app/agent-config/commit/c4281e02bd19b572272e3f41613bdd3a2200e7a7))
* **council:** the round-3 ratification question for the generation lock ([2e78ef9](https://github.com/event4u-app/agent-config/commit/2e78ef97cb3180b98670e4e0c4cc67510463a47a))
* **council:** the round-2 ratification question for the generation lock ([dcd2c4d](https://github.com/event4u-app/agent-config/commit/dcd2c4d9600eee95592a7c3df3ebf50549aa2394))
* **roadmap:** record the round-1 ratification fixes under 2.1 ([bae765d](https://github.com/event4u-app/agent-config/commit/bae765dc64d61b86389ea0343a814d6f5aea2884))
* **council:** the round-1 ratification question for the generation lock ([172edfb](https://github.com/event4u-app/agent-config/commit/172edfbf8448366dac906ec650e62bf7baed0095))
* **roadmap:** close the five lock sites and carry four more as Phase 3 ([091ce7c](https://github.com/event4u-app/agent-config/commit/091ce7cacd567687283a89a4adfa0ed6cdc39850))

### Refactoring

* **hooks:** move the per-concern feedback write into feedback_policy ([1fccf4a](https://github.com/event4u-app/agent-config/commit/1fccf4a9802b841cfba0eda74cb64ef692cac657))
* **language-mirror:** keep the owner-prose pin off the live hook path ([81fa4f3](https://github.com/event4u-app/agent-config/commit/81fa4f3617575a4ff483a6b43bbb8a8dd73c6671))
* **verification:** move exit masking into an off-path module ([9606e46](https://github.com/event4u-app/agent-config/commit/9606e46572a5468b164d8bc05d7763764f1dab7d))
* **turn-end-gate:** keep detector G off the live hook path ([a04d516](https://github.com/event4u-app/agent-config/commit/a04d516b49446b72eeed3f75abf01619b0239db8))
* **user-interaction:** move context-carrying asks into own context file ([344fe41](https://github.com/event4u-app/agent-config/commit/344fe4198e070da808d4bd1404281f7dd3c03bea))
* **council:** stance repair and ratification-prompt checks move out of the over-ceiling files ([16d9ed9](https://github.com/event4u-app/agent-config/commit/16d9ed9dea7f1877092242b94e04e4f8010ebc6a))
* **turn-end-gate:** detectors D and F keep their origin/main trigger; signed exit literals; repair text for trailing commands ([fbe8022](https://github.com/event4u-app/agent-config/commit/fbe802297b85ec191bfb5ba80c0480f513a70056))
* **language-mirror:** gatePinLanguage in its own module; compact the pin docstrings ([54ffe06](https://github.com/event4u-app/agent-config/commit/54ffe067fb4a5e5c4dd75bb8ca131859f9f33c25))
* **turn-end-gate:** take unlisted_surface and the surface reader off the live hook path (D11) ([c0862e9](https://github.com/event4u-app/agent-config/commit/c0862e945eece21fc8a707793700e08c7b962de8))
* **verification:** one linear reachability walk for masking and runnable segments ([5d14cb9](https://github.com/event4u-app/agent-config/commit/5d14cb97c67b7943d17dd953450bebdfe236418a))
* **language-mirror:** the veto is one rule — both languages at the floor in the whole prompt ([021cfd2](https://github.com/event4u-app/agent-config/commit/021cfd267f4664107dbf4f22bf3985410915f1ca))

### Tests

* **mcp:** the pack's proxy limit still fits the real gz limit ([4749b8c](https://github.com/event4u-app/agent-config/commit/4749b8ccdb3f69366807b4ba5b6471bb0a8c525e))
* **hooks:** a feedback write that throws keeps the refusal and later feedback ([80b7633](https://github.com/event4u-app/agent-config/commit/80b763334255b51052219db0b7d19ffa1214815e))
* **hooks:** the feedback write path reports failure, it never throws ([5569969](https://github.com/event4u-app/agent-config/commit/5569969718c052e1888c9c6d04ae10976928b5de))
* **fixtures:** keep the exit-masking roadmap fixtures out of the artifact-location gate ([9d10d07](https://github.com/event4u-app/agent-config/commit/9d10d074338194ff8119e646debd5b36afa53fda))
* **turn-end-gate:** a system-locale pin must not raise a language finding ([0db3668](https://github.com/event4u-app/agent-config/commit/0db3668e3971833eeec45e00514227a5421773df))
* **language-mirror:** owner-prose-only fixture table, red before the fix ([e9ecd2c](https://github.com/event4u-app/agent-config/commit/e9ecd2ccb2f164bc4e1816c1c696a2b1aca400d0))
* **hooks:** writer-to-doctor regressions and the composition checker's exit 2 paths ([9bdade7](https://github.com/event4u-app/agent-config/commit/9bdade77606232d553b26e7dfcfcf023156e7d2a))
* **telemetry:** stop the transport tests aging out of the retention window ([5fde451](https://github.com/event4u-app/agent-config/commit/5fde4511732e55ea9df70f3ca43f4d60caf0c71e))
* **hooks:** a runtime load-set check and an interleaved A/B bench ([16f374b](https://github.com/event4u-app/agent-config/commit/16f374b81200fe13260d96de82077c75d8157e02))
* **locks:** every site lets a lone caller in, and the next after its release ([9cab4cc](https://github.com/event4u-app/agent-config/commit/9cab4ccfc45479e8c2ddfa9669dd70c965bfaea6))

### CI

* **rule-backstops:** run lint_verify_exit_masking in CI ([babd983](https://github.com/event4u-app/agent-config/commit/babd983fa786efb93c7f881a2b83295253c6f88a))

### Chores

* **evaluator:** move the CLI command budget to 130 for retro ([49c492d](https://github.com/event4u-app/agent-config/commit/49c492d86b20544d0681212606d6ef0f46879826))
* **design-intelligence:** canonical spelling in the re-check note ([adcf763](https://github.com/event4u-app/agent-config/commit/adcf763127d90ccaf68cc7afa6ff6be85d67b087))
* **evaluator:** move the CLI command budget to 129 for closure:scan and closure:lint ([4f7615f](https://github.com/event4u-app/agent-config/commit/4f7615f0290d993d2c0149c36d1586e9d1543e6c))
* **design-intelligence:** record the 2026-11-23 upstream re-check ([52e0ccb](https://github.com/event4u-app/agent-config/commit/52e0ccbbcc2def5d907f2c4cc5b98e9d98d52d9d))
* **design-intelligence:** record the quarterly upstream re-check ([8111c17](https://github.com/event4u-app/agent-config/commit/8111c174b70693c0a12c480565b2beb27fac2ab5))
* **sync:** regenerate the process-full projection and the meta token passport ([4382bde](https://github.com/event4u-app/agent-config/commit/4382bde1e4bf5ccf288bb6c4edb348a34d63eebb))
* **docs:** regenerate the doc path inventory and the owned digest ([f66e7cc](https://github.com/event4u-app/agent-config/commit/f66e7cc7639fc49558d50a7bdb0281c8b764cbf5))
* **packs:** refresh the meta token passport ([0d9905e](https://github.com/event4u-app/agent-config/commit/0d9905e4d6c8fc73170a1294ac713e72d3b7c078))
* **generated:** re-emit the standing-payload census and host cost table ([efeed61](https://github.com/event4u-app/agent-config/commit/efeed61d882d7aa609e19769eba0cefddaa678a6))
* **generated:** re-emit the per-host census and the host cost table ([cd5d021](https://github.com/event4u-app/agent-config/commit/cd5d02108415ec9031a10bb3c5559ac98cab7014))
* **hooks:** withdraw the dispatch bundle raise ([b5fdfc7](https://github.com/event4u-app/agent-config/commit/b5fdfc758229f5be66a6bf925c8e0c4033a14b86))
* **evidence:** ratification prompt round 33 for the classifier-scope raise ([f63a103](https://github.com/event4u-app/agent-config/commit/f63a1031e76fc63e142e1d74fad0b891435bd1b5))
* **hooks:** resize the dispatch bundle raise after round 32 ([2fff948](https://github.com/event4u-app/agent-config/commit/2fff9484f04af2527d57e5593a45e6e709b84d3d))
* **evidence:** ratification prompt round 32 for the classifier-scope raise ([408b42e](https://github.com/event4u-app/agent-config/commit/408b42e6f5aa3e743f6eaf3417f0fd990f2fc32d))
* **hooks:** resize the dispatch bundle raise after round 31 ([7498a4e](https://github.com/event4u-app/agent-config/commit/7498a4e58ce39f8724bb6d83563799993da7b4a2))
* **evidence:** ratification prompt round 31 for the classifier-scope raise ([4dbec0e](https://github.com/event4u-app/agent-config/commit/4dbec0e091b77ff8dd30b3487293aacea9d575d9))
* **hooks:** resize the dispatch bundle raise after round 30 ([0637b1f](https://github.com/event4u-app/agent-config/commit/0637b1f2760ebd299ce690b92fe22c01c1bfb0a8))
* **evidence:** ratification prompt round 30 for the classifier-scope raise ([d9a13cb](https://github.com/event4u-app/agent-config/commit/d9a13cb2f10ebf96c27c5b766d440c68ca46e118))
* **hooks:** resize the dispatch bundle raise after round 29 ([ee144e3](https://github.com/event4u-app/agent-config/commit/ee144e33265889fe3fb73ad91931120827f617d8))
* **evidence:** ratification prompt round 29 for the classifier-scope raise ([eba76e3](https://github.com/event4u-app/agent-config/commit/eba76e3401c1e72662671bb56ab620d0b4e71103))
* **hooks:** resize the dispatch bundle raise after round 28 ([ef051de](https://github.com/event4u-app/agent-config/commit/ef051de10a1e344a467d7642bd0aa81eebea9bb9))
* **evidence:** ratification prompt round 28 for the classifier-scope raise ([e0d9a70](https://github.com/event4u-app/agent-config/commit/e0d9a70509cfd851728a28769f3272c646d1692d))
* **hooks:** resize the dispatch bundle raise after round 27 ([570f55d](https://github.com/event4u-app/agent-config/commit/570f55d41afc306056144d89242b47a8777b5021))
* **evidence:** ratification prompt round 27 for the classifier-scope raise ([2a82cf8](https://github.com/event4u-app/agent-config/commit/2a82cf8c231bfafcdc95a05e1eae6f0f521353a5))
* **hooks:** resize the dispatch bundle raise after round 26 ([df82e34](https://github.com/event4u-app/agent-config/commit/df82e34435bb6d78421a148284caee04461fbabe))
* **evidence:** ratification prompt round 26 for the classifier-scope raise ([5489d87](https://github.com/event4u-app/agent-config/commit/5489d87eed1ffb04d140069580ea4a128b9d5dd7))
* **hooks:** resize the dispatch bundle raise after round 25 and state the headroom arithmetic ([84c6f2b](https://github.com/event4u-app/agent-config/commit/84c6f2bc1b229a4a11fa20dc10f10cbb6db7905e))
* **evidence:** ratification prompt round 25 for the classifier-scope raise ([c976afb](https://github.com/event4u-app/agent-config/commit/c976afb2a28b74a96234ac5ef2587d12545a5741))
* **hooks:** resize the dispatch bundle raise after round 24 ([647516f](https://github.com/event4u-app/agent-config/commit/647516fd41ec3dd552b46d6009c49ca3857a73ad))
* **evidence:** ratification prompt round 24 for the classifier-scope raise ([88ab784](https://github.com/event4u-app/agent-config/commit/88ab784dc2151732e055e677b1dc04c4acf37bb4))
* **hooks:** shrink the dispatch bundle raise to the classifier scope ([5784e13](https://github.com/event4u-app/agent-config/commit/5784e1362a3d64cb33ba5aa556d525651909eb5e))
* **evidence:** ref-ignore the docs path in ratification prompts, record the strategy question ([c1e2b1c](https://github.com/event4u-app/agent-config/commit/c1e2b1c388fd0e66d6cfe18b7773a48e3d316b04))
* **skills:** record the ai-council body raise for the convergence advisory ([76fb604](https://github.com/event4u-app/agent-config/commit/76fb604d1ac2c96f568b2300e7d02e251708daed))
* **evidence:** ratification prompt round 23 for the dispatch bundle raise ([66d5d9e](https://github.com/event4u-app/agent-config/commit/66d5d9efce625a67735af35e102c1ea4b8c32144))
* **hooks:** resize the dispatch bundle raise after round 22, with the round-22 ratification prompt ([76eab14](https://github.com/event4u-app/agent-config/commit/76eab14e9508a56bdba8a31308e54f73df2012b9))
* **hooks:** resize the dispatch bundle raise after round 21, with the round-21 ratification prompt ([f582989](https://github.com/event4u-app/agent-config/commit/f582989590f35c59383dbca84bf21a888b38b4bb))
* **hooks:** resize the dispatch bundle raise after round 20 ([b9e2693](https://github.com/event4u-app/agent-config/commit/b9e2693c87129a832a366a71e559b7f7c128c669))
* **evidence:** ratification prompt round 20 for the dispatch bundle raise ([1adb34c](https://github.com/event4u-app/agent-config/commit/1adb34c51fcf36563383d52f070f441980febf14))
* **hooks:** resize the dispatch bundle raise after round 19 ([fc814c8](https://github.com/event4u-app/agent-config/commit/fc814c8f72dd6fa6e0d9a68f80734d22ff7dd303))
* **evidence:** ratification prompt round 19 for the dispatch bundle raise ([b3c63f8](https://github.com/event4u-app/agent-config/commit/b3c63f8ceba7ff928efbc8c1cd11a2c3e5b93dfc))
* **hooks:** resize the dispatch bundle raise after round 18 ([f68f710](https://github.com/event4u-app/agent-config/commit/f68f71092d8040aa44837b36b4688bb401bdc5e0))
* **evidence:** ratification prompt round 18 for the dispatch bundle raise ([0e9c546](https://github.com/event4u-app/agent-config/commit/0e9c546fe0c1a7eb8f17347e8cbdebad3d5bd057))
* **hooks:** resize the dispatch bundle raise after round 17 ([0e2901a](https://github.com/event4u-app/agent-config/commit/0e2901aae6ae31128ad5ae8afe038f9b53c4cd34))
* **evidence:** ratification prompt round 17 for the dispatch bundle raise ([5e766af](https://github.com/event4u-app/agent-config/commit/5e766af928fd09dbe87c21ad6b9a48856137bff7))
* **hooks:** resize the dispatch bundle raise after round 16 ([8036cbf](https://github.com/event4u-app/agent-config/commit/8036cbf626cb4a816875fb731804d498ef09cd3a))
* **evidence:** ratification prompt round 16 for the dispatch bundle raise ([4b060e4](https://github.com/event4u-app/agent-config/commit/4b060e401d93ef99290cb3adb29ea3b083892c53))
* **hooks:** resize the dispatch bundle raise after round 15 ([5135592](https://github.com/event4u-app/agent-config/commit/5135592a52fccae1204feda33387b286612d9ab2))
* **evidence:** ratification prompt round 15 for the dispatch bundle raise ([79c720d](https://github.com/event4u-app/agent-config/commit/79c720dbb47a1904e53f7076ba9c37116e10fdf3))
* **hooks:** resize the dispatch bundle raise after round 14 ([9165394](https://github.com/event4u-app/agent-config/commit/9165394b1c11d332334d44d518190c9aaaa0f53a))
* **evidence:** ratification prompt round 14 for the dispatch bundle raise ([69977e4](https://github.com/event4u-app/agent-config/commit/69977e426906a74527aa5a7ef43b6b7a3aca8411))
* **hooks:** resize the dispatch bundle raise after round 13 ([789f962](https://github.com/event4u-app/agent-config/commit/789f9629425979a2d524057fe405059ab9918f2c))
* **hooks:** size the dispatch raise to the round-9 measurement ([0e8da6b](https://github.com/event4u-app/agent-config/commit/0e8da6b6360e7c3d8d1508e80cba23f923d170c5))
* **evidence:** ratification prompt round 13 for the dispatch bundle raise ([d2f8de2](https://github.com/event4u-app/agent-config/commit/d2f8de2065803991d5c5f1b5d941c48c68cea80d))
* **hooks:** resize the dispatch bundle raise after round 12 ([6eab2f1](https://github.com/event4u-app/agent-config/commit/6eab2f1a22cdc8b1af6ed0132607b8ece9c84068))
* **roadmap:** tick language-pin 4.1 and 4.2 ([fb437fc](https://github.com/event4u-app/agent-config/commit/fb437fcfbf2d81f6a3eb8a6d70f51d5c22d3d084))
* **evidence:** ratification prompt round 12 for the dispatch bundle raise ([04018ad](https://github.com/event4u-app/agent-config/commit/04018ad22c28d44419460ed046acd15a981bc9ca))
* **hooks:** resize the dispatch bundle raise after round 11 ([6c7eb24](https://github.com/event4u-app/agent-config/commit/6c7eb24fd41542fd5023bf94fa04ee4f042abd1b))
* **evidence:** ratification prompt round 11 for the dispatch bundle raise ([a1fcc3f](https://github.com/event4u-app/agent-config/commit/a1fcc3f181f083a486695a82c4c26775c427fdd8))
* **hooks:** record the round-10 bundle reading in the raise entry ([3967be8](https://github.com/event4u-app/agent-config/commit/3967be8a0e3790373cfdfb0fb322435d9bbeeb25))
* **hooks:** size the dispatch raise to the round-7 measurement ([308dd09](https://github.com/event4u-app/agent-config/commit/308dd09cbf596443f49c7a5904e956ee85f7f3ea))
* **evidence:** ratification prompt round 10 for the dispatch bundle raise ([f800597](https://github.com/event4u-app/agent-config/commit/f800597dfd6cda0ed25052e803d59640029764ce))
* **hooks:** resize the dispatch bundle raise after round 9 ([9257257](https://github.com/event4u-app/agent-config/commit/925725733e74d8752fb328bc8c0ac2a69b1bcf43))
* **evidence:** ratification prompt round 9 for the dispatch bundle raise ([24a2f3e](https://github.com/event4u-app/agent-config/commit/24a2f3e9690e3103f5762b1a337fb804427a6145))
* **hooks:** resize the dispatch bundle raise after round 8 ([f43a446](https://github.com/event4u-app/agent-config/commit/f43a446bb7ca723f9af558d3bd25fbe7451603b0))
* **hooks:** restate the dispatch raise against the round-6 reading ([153f5da](https://github.com/event4u-app/agent-config/commit/153f5dad8dbf78f0479616f0b8c5540ff29ba9cb))
* **evidence:** ratification prompt round 8 for the dispatch bundle raise ([8716795](https://github.com/event4u-app/agent-config/commit/8716795bb79084daec7cd1516587bb37642e4a2b))
* **hooks:** resize the dispatch bundle raise after round 7 and record D9 ([2db964c](https://github.com/event4u-app/agent-config/commit/2db964c52ab9425e47be94916b55ed8a7b9d6845))
* **hooks:** restate the dispatch raise against the round-5 reading ([d47a546](https://github.com/event4u-app/agent-config/commit/d47a5462fa3e28175eb93df8cf3787914af1f017))
* **evidence:** ratification prompt round 7 for the dispatch bundle raise ([93948fa](https://github.com/event4u-app/agent-config/commit/93948fa0ed221dd8f768474f571a66a847ec738c))
* **hooks:** lower the dispatch bundle raise to the round-6 reading and record D8 ([6929669](https://github.com/event4u-app/agent-config/commit/6929669f7fcc2b0f9d826b9433035df028f5826e))
* **hooks:** describe the veto in the dispatch raise entry ([b9433f9](https://github.com/event4u-app/agent-config/commit/b9433f9b4fa8a2729244d3f7a600fbed9782a50b))
* **evidence:** ratification prompt round 6 for the dispatch bundle raise ([e4fe3a7](https://github.com/event4u-app/agent-config/commit/e4fe3a7d20a9516d44fe2d78823a119fbb212e4d))
* **hooks:** record the round-5 bundle reading in the raise entry ([5a06c15](https://github.com/event4u-app/agent-config/commit/5a06c1516962f70fa23d5d09b277738015ae5013))
* **hooks:** size the dispatch raise to the round-4 measurement ([34b26ec](https://github.com/event4u-app/agent-config/commit/34b26ecbdc0d47e655b04f02ee2d78475dc01b5d))
* **evidence:** ratification prompt round 5 for the dispatch bundle raise ([e614521](https://github.com/event4u-app/agent-config/commit/e6145219f4d06f45e70137be4c991a62a406e0a9))
* **hooks:** resize the dispatch bundle raise after the round-4 fixes ([cecaec1](https://github.com/event4u-app/agent-config/commit/cecaec14ff68f168f2fb8116ddbc0695aa4a6158))
* **hooks:** size the dispatch raise to the round-3 measurement ([0d9555f](https://github.com/event4u-app/agent-config/commit/0d9555f25cb16f7d84d1d0766e0f9a60d97b4435))
* **evidence:** ratification prompt round 4 for the dispatch bundle raise ([d65ca58](https://github.com/event4u-app/agent-config/commit/d65ca581eefb2b556933ba32c77b2816bc6bc2b8))
* **hooks:** resize the dispatch bundle raise after the round-3 fixes ([194cedc](https://github.com/event4u-app/agent-config/commit/194cedc92efd366ecdf23dfea199dd4f2a58812b))
* **hooks:** size the dispatch raise to the round-2 measurement ([eb1a142](https://github.com/event4u-app/agent-config/commit/eb1a142edf6c8904aaec8d5e77582bbd2ff558d0))
* **evidence:** ratification prompt round 3 for the dispatch bundle raise ([8384f8c](https://github.com/event4u-app/agent-config/commit/8384f8c3a5cd425516636fad077808c857d1fdf1))
* **hooks:** resize the dispatch bundle raise after the round-2 fixes ([918a3be](https://github.com/event4u-app/agent-config/commit/918a3be96f925579db269a8cd2fabc4b6d45d8f8))
* **hooks:** restate the dispatch raise against the round-1 measurement ([e995e10](https://github.com/event4u-app/agent-config/commit/e995e10f78299630c7efc88b3b5d23ca122806be))
* **evidence:** ratification prompt round 2 for the dispatch bundle raise ([8cfc8f3](https://github.com/event4u-app/agent-config/commit/8cfc8f3a3a7bf0dafc9be296f8c5aeb768fd1d09))
* **hooks:** resize the dispatch bundle raise to the re-measured bundle ([060dbc1](https://github.com/event4u-app/agent-config/commit/060dbc1ade76a8d7249e306f0e9fecef33f165b6))
* **hooks:** raise the dispatch bundle ceiling for the owner-prose pin ([2af92fd](https://github.com/event4u-app/agent-config/commit/2af92fde4923b99f2b594fb60921f7bd5a5e7c06))
* **evidence:** ratification prompt for the dispatch bundle raise ([c2bfbe7](https://github.com/event4u-app/agent-config/commit/c2bfbe7de8190b195b5d96a0c7193550092b0e38))
* **roadmap:** tick language-pin 3.2-3.4, record D6 ([0a5d3c9](https://github.com/event4u-app/agent-config/commit/0a5d3c99aadef73dece223f257d189f93179562e))
* **hooks:** raise the dispatch bundle ceiling for detector G and the exit-code classifier ([ecd13e5](https://github.com/event4u-app/agent-config/commit/ecd13e5d922f238d60ec1a68c1b943961fbf1472))
* **generated:** regenerate the owned digest, ownership matrix and doc path inventory ([cbf7406](https://github.com/event4u-app/agent-config/commit/cbf74060ae98ea3e60108458f4582a21933e1d56))
* **skills:** raise the verify-completion-evidence body ceiling for the closing split ([9380334](https://github.com/event4u-app/agent-config/commit/93803346a0e175b388fd90061c6c99e5e3488f34))
* **evaluator:** move the CLI command budget to 127 for verify:surfaces ([c6bb35d](https://github.com/event4u-app/agent-config/commit/c6bb35d4eabf901f6f414001e3ce5905c3ab8f97))
* **roadmap:** tick language-pin 3.1 ([e9c4e9b](https://github.com/event4u-app/agent-config/commit/e9c4e9bf3b53d58323f038dbbef65c4ca98e9431))
* **roadmap:** tick language-pin 2.1 and 2.2 ([a3afb86](https://github.com/event4u-app/agent-config/commit/a3afb866e92143e8a9e671fb096a77452b3ef446))
* **roadmap:** tick language-pin 1.3, record D3 and D4 ([78aee4f](https://github.com/event4u-app/agent-config/commit/78aee4f07c81145cb9978536cfb1a0bf15fb62a5))
* **roadmap:** tick language-pin 1.1 and 1.2 ([bd880d5](https://github.com/event4u-app/agent-config/commit/bd880d5e53bfdf2fec694498e963860ff94a0688))
* **roadmaps:** regenerate the owned digest after archiving ([49c1455](https://github.com/event4u-app/agent-config/commit/49c1455f7d8ee26e71a7fd282c869b2f45b26e00))
* **dist:** regenerate the telemetry settings projection ([a951400](https://github.com/event4u-app/agent-config/commit/a9514007138273425682c61d2a449fb2498897a1))
* **budget:** raise the session-pins chunk ceiling for the generation lock ([a912d53](https://github.com/event4u-app/agent-config/commit/a912d531d1c0d7f69a7ccff0ac62ef4872c26752))

### Other

* 20.7.0 ([627953d](https://github.com/event4u-app/agent-config/commit/627953d7a85af9f2bab2beff606966bd16a74798))

Tests: 41119 (+785 since 20.6.0)

## [20.7.0](https://github.com/event4u-app/agent-config/compare/20.6.0...20.7.0) (2026-11-23)

### Release highlights

- **Behaviour changes:** withdraw the owner-class column from decision-revisit-gate (d1c5e2b); say that an outside row still routes to the owner (3ba75b0); name the owner class on every reserved row (674c23e); restore efficient-tooling line in the rule body (5ca4354); keep law sections under the 2000-char ceiling (48fe105); align Iron Law 4 with self-check scope, IL1 example and reply order (b2d2e55); +1 more.
- **Default changes + migration:** _none_
- **Security and correctness:** re-measure the content pack and move its proxy limit to 7 MiB (1233817); keep the template memory_signal twin in step with the bundle guard (901ea6e); contain the timing record too, the last post-verdict diagnostic (6726451); skip subagent hand-backs; make the retro queue runnable in consumers (368caca); consumer-reachable closure:scan / closure:lint, lint the project's roadmaps (8c88531); the evaluator nightly's bot push skips the local replay check (200e07e); +113 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 179 vs consumer-only 57 (mixed 122, maintenance 81; taxonomy 1.1.0; range 2cc3dcf403a2..a817b22a3114).

### Features

* **probe:** measure owner attributions that cite no source ([2fb3808](https://github.com/event4u-app/agent-config/commit/2fb38083c016170f640a72bd7da96179f936a1dd))
* **subagents:** carry the question cascade and the provenance line ([84fc2af](https://github.com/event4u-app/agent-config/commit/84fc2afd93127a8328c83bc9c1513e1363de6024))
* **council:** keep only the owner's classes in high_impact ([75c41d8](https://github.com/event4u-app/agent-config/commit/75c41d86c1b429b7e9a2c24fa8baf41536a05993))
* **census:** count every owner-reaching ask with producer, impact and reply class ([0897c0d](https://github.com/event4u-app/agent-config/commit/0897c0d54a3b6f3f23e5bf6e4ce8331c4659d4bb))
* **credential-guard:** treat pattern, filter and message operands as no file ([d4ae809](https://github.com/event4u-app/agent-config/commit/d4ae809307ddeb36a335d13b4ee2d57074acb098))
* **review-nudge:** count only the lines a session's own writes touched ([b0ca531](https://github.com/event4u-app/agent-config/commit/b0ca531c24cf6b738c3033afdb027e13dd262a34))
* **turn-end-gate:** recognise a verifier run through docker exec ([7e7b081](https://github.com/event4u-app/agent-config/commit/7e7b081791ed2555aa855a9b77e7ded93ed9375f))
* **push-settle:** read a pushed branch only inside a To section ([6e67860](https://github.com/event4u-app/agent-config/commit/6e678606fcb0f2df86f0b94e1a4ec0af26340bac))
* **legal:** count attorney-review lines per turn kind across transcript stores ([6dd1de0](https://github.com/event4u-app/agent-config/commit/6dd1de0ff06bdd3482cedaa47862fe211c3ee29b))
* **commands:** roadmap:next merges through process-full and yields to the project rule ([fba1b3a](https://github.com/event4u-app/agent-config/commit/fba1b3a632b1fc810d6f3f375ee2a2a275a8990b))
* **commands:** PR commands take the session's one open PR without asking ([b6b64c2](https://github.com/event4u-app/agent-config/commit/b6b64c21f267eb41efe3aa986fa1cbbf37b88394))
* **scripts:** add the session goal record as an unwired library ([bbabc81](https://github.com/event4u-app/agent-config/commit/bbabc81904f78087be4c07e57f9ee0a78f0513f9))
* **scripts:** count goal-scoped re-asks in host transcripts ([36dd8a1](https://github.com/event4u-app/agent-config/commit/36dd8a1c94f5a807e14342b78bfbeb67c8294103))
* **user-interaction:** Iron Law 4 — a question carries its own context ([765a308](https://github.com/event4u-app/agent-config/commit/765a30846e0baa1abefab62b11b07f3f8cd108d7))
* **council:** a ratification prompt must ask for the stance line ([fdc0f20](https://github.com/event4u-app/agent-config/commit/fdc0f201b7f856f2072c315116766ba63402e8ba))
* **ci-settle:** name a red that only waits for the owner ([88d4f8c](https://github.com/event4u-app/agent-config/commit/88d4f8c8f816ae8a00e7722022f54280583dda77))
* **hooks:** a known-red push stays local until the owner decides ([deeca06](https://github.com/event4u-app/agent-config/commit/deeca067430069ed2ba8838516567c2733516453))
* **review-loops:** advisory convergence verdict and historical replay ([226a242](https://github.com/event4u-app/agent-config/commit/226a242a9e3982f55ddb76ce0b24d22de76769d8))
* **review-loops:** reader input and origin-merge tooling ([0dd3c31](https://github.com/event4u-app/agent-config/commit/0dd3c315cc484f003a75310d79d9f110d52ddad9))
* **review-loops:** deterministic origin classes per round ([6248df0](https://github.com/event4u-app/agent-config/commit/6248df08e30b98c0db0e77ff25d27e3351168196))
* **review-loops:** generate the census of every review loop ([64fb232](https://github.com/event4u-app/agent-config/commit/64fb23231731067bf81e5e4c63df8e218719114b))
* **measure-turn-end-gate:** --before renders a before/after split with the instrument held fixed ([75fe530](https://github.com/event4u-app/agent-config/commit/75fe530454e079d4ffef98564c94c04aa79fe6f3))
* **turn-end-gate:** refuse on language only behind an owner-prose pin ([daf8e48](https://github.com/event4u-app/agent-config/commit/daf8e48eba8ccc909475f1899f11a1de37554781))
* **language-mirror:** record owner_prose_chars on every pin ([17aa86c](https://github.com/event4u-app/agent-config/commit/17aa86c9c98145be62b07c41eae01f23ef432ba9))
* **language-mirror:** set the pin only from owner prose ([20f4861](https://github.com/event4u-app/agent-config/commit/20f486144c198b0087a720f4ce761c2a102cd42e))
* **verify:** derive live surfaces and record unlisted ones ([ba9c15a](https://github.com/event4u-app/agent-config/commit/ba9c15a123ea86b88549837c7f2e212d21194bd1))
* **turn-end-gate:** record partial ratios reported as complete ([8a74e05](https://github.com/event4u-app/agent-config/commit/8a74e0513b179ae3f984cb2fad665af6cc863731))
* **measure-turn-end-gate:** add --language-split refusal split by pin source ([8aedb7f](https://github.com/event4u-app/agent-config/commit/8aedb7f511cbb8fd2d737e25e1fd468b10c957ab))
* **lint:** refuse verify clauses and exec pointers with masked exit codes ([8324bd9](https://github.com/event4u-app/agent-config/commit/8324bd91b7d6686766c2cc12d6652b06932b340b))
* **verification:** classify masked exit codes and rtk-wrapped runs ([a6cc7a4](https://github.com/event4u-app/agent-config/commit/a6cc7a45584e806ac19670d47a366a764bde4388))
* **trigger-evals:** count passing rotation runs as freshness evidence ([0824cc2](https://github.com/event4u-app/agent-config/commit/0824cc2aa72d0a4c7d0ea538ae8e72199ffbd258))
* **hooks:** replace the bundle byte ratchet with a package allowlist and a backstop ([6dcc246](https://github.com/event4u-app/agent-config/commit/6dcc246041bbf079bfb9211aaa754d8a0c0c4e69))
* **locks:** a waiting acquire and directory generations for the generation lock ([b431fec](https://github.com/event4u-app/agent-config/commit/b431fec461f4e83c25d65404f3e75b07178357ad))

### Bug Fixes

* **mcp:** re-measure the content pack and move its proxy limit to 7 MiB ([1233817](https://github.com/event4u-app/agent-config/commit/1233817ad8f269e0fa23bca51e6019719b775474))
* **memory:** keep the template memory_signal twin in step with the bundle guard ([901ea6e](https://github.com/event4u-app/agent-config/commit/901ea6e3586a86fdb19d9d41b34b53f9e32d32cc))
* **hooks:** contain the timing record too, the last post-verdict diagnostic ([6726451](https://github.com/event4u-app/agent-config/commit/672645154a0c0e969f14204951e1d39fe6cdfb92))
* **self-repair:** skip subagent hand-backs; make the retro queue runnable in consumers ([368caca](https://github.com/event4u-app/agent-config/commit/368cacaba361077ce59546c28da95ef4d53234db))
* **design-intelligence:** the re-check note uses the house spelling ([ded6599](https://github.com/event4u-app/agent-config/commit/ded65991baee4aef691df0e4ae774328538c4550))
* **closure:** consumer-reachable closure:scan / closure:lint, lint the project's roadmaps ([8c88531](https://github.com/event4u-app/agent-config/commit/8c88531da9bd14a20885cf82646939ec03071175))
* **analyze:inbox:** ask before widening a named path, move only what was named or confirmed ([6b6c236](https://github.com/event4u-app/agent-config/commit/6b6c2360784aed57c61bb38c5f69a1eb4059f2dd))
* **ci:** the evaluator nightly's bot push skips the local replay check ([200e07e](https://github.com/event4u-app/agent-config/commit/200e07e2e970068d3a4ca5663445995cedaafd41))
* **roadmap:** process-full's core fits its byte budget again ([6fb4840](https://github.com/event4u-app/agent-config/commit/6fb4840f1e92896d6083f2325ea8d434eabc8061))
* **hooks:** no feedback write can stop a computed verdict ([01bfc52](https://github.com/event4u-app/agent-config/commit/01bfc5240045a6882ff7500c4bf824b7f1245606))
* **wedge:** ship the regenerated worker floor in the wedge docs ([e3b6dc5](https://github.com/event4u-app/agent-config/commit/e3b6dc53f8c8a2c92877f56507c211f297ac7109))
* **subagents:** fit the who-answers section and the routing note into their budgets ([f52e889](https://github.com/event4u-app/agent-config/commit/f52e8895ecb7157d717021939eb423afc9e5785a))
* **prompt-shape:** a hunk context row decrements both counts in a block ([f6680ae](https://github.com/event4u-app/agent-config/commit/f6680ae981f26a125039bb5b2e19aea38016e931))
* **user-interaction:** restore efficient-tooling line in the rule body ([5ca4354](https://github.com/event4u-app/agent-config/commit/5ca4354542b40dc943ca5639ff0e2ffbdf7aa12e))
* **user-interaction:** keep law sections under the 2000-char ceiling ([48fe105](https://github.com/event4u-app/agent-config/commit/48fe1053fc4ef6f6aae861b4ff191dd16bd15a0d))
* **user-interaction:** align Iron Law 4 with self-check scope, IL1 example and reply order ([b2d2e55](https://github.com/event4u-app/agent-config/commit/b2d2e55dc8d40b4e45132c4eeac1c4ce14a55273))
* **known-red:** act on the review of the first cut ([dc48e9e](https://github.com/event4u-app/agent-config/commit/dc48e9e9e7f59e7dd2953d6f54592c2027bfa6fc))
* **council:** a short detected value is not swept through the bundle ([ea9987f](https://github.com/event4u-app/agent-config/commit/ea9987f6480701ce891144d34d3bd0ae1e69588f))
* **prompt-shape:** read patches on the raw lines; git preamble is metadata; only `\ ` annotates ([c089326](https://github.com/event4u-app/agent-config/commit/c089326ac6ce1bd69883954bcdd47ba025320128))
* **verification:** read exit literals with sign, any size and an attached redirection ([2d630dc](https://github.com/event4u-app/agent-config/commit/2d630dc501651c9038e351043263921798466883))
* **verification:** keep a redirected exit's own status, a recognised set succeeds ([8d32b19](https://github.com/event4u-app/agent-config/commit/8d32b193165d2666661095650b4965ffd3513ea5))
* **prompt-shape:** collapse diff hunks by declared length, before the fence reader ([4bc92e4](https://github.com/event4u-app/agent-config/commit/4bc92e4dfa808b6c43ad5dfa099b352ac68e4353))
* **verification:** an exit whose redirection can fail lets the line go on ([6e903b3](https://github.com/event4u-app/agent-config/commit/6e903b39d07d7fe0dff197aa9693534df4555d88))
* **turn-end-gate:** keep 'Task completed.' a claim, unknown status for a redirected builtin ([749e240](https://github.com/event4u-app/agent-config/commit/749e240d1c076eede4d196a677792315cb2d02d6))
* **prompt-shape:** a unified-diff hunk body is patch content, never owner prose ([7b23c3a](https://github.com/event4u-app/agent-config/commit/7b23c3a5f6e24c1acdc70bfba45aa39dc8ecae71))
* **turn-end-gate:** model errexit in the reachability walk, whole-word completion phrases ([6f1a9a7](https://github.com/event4u-app/agent-config/commit/6f1a9a7dbd17aa411a83e32700390ddccedc99bc))
* **turn-end-gate:** follow both pipefail settings when the text cannot say, bare builtins only, line-bound claims and ratios ([d561a9d](https://github.com/event4u-app/agent-config/commit/d561a9d9d0f58897970887ae0f0a9a3c55a6775e))
* **prompt-shape:** the word-boundary strip is owner-prose only; an unindented line ends a list fence ([bd01900](https://github.com/event4u-app/agent-config/commit/bd0190002d893ae461557044280d018a1a545bb0))
* **turn-end-gate:** linear completion scan, only the shell's own exit ends a line, CRLF blank lines end a Not verified block ([5516295](https://github.com/event4u-app/agent-config/commit/5516295130dda7100e38cc2ffd98d4e2027de726))
* **verification:** a top-level return in a Bash call is an ordinary command ([254481d](https://github.com/event4u-app/agent-config/commit/254481d9e1bfb6e51e10cce7ea4409a5e6525726))
* **prompt-shape:** removing an inline terminal region keeps the word boundary ([5c73acc](https://github.com/event4u-app/agent-config/commit/5c73acc55e2d2601973870cff275ee2ebe89ff19))
* **review-loops:** replay reads only what each round knew ([e9541f6](https://github.com/event4u-app/agent-config/commit/e9541f607dde1307999af855fcba696cceba7439))
* **turn-end-gate:** one status rule for every pipeline, credit only runs after the edit, skip non-scalar compose ports ([9ce6f16](https://github.com/event4u-app/agent-config/commit/9ce6f16d623d950ebdda585479a243a8b9c21cb0))
* **turn-end-gate:** a negated claim no longer hides a later one, pipeline status from its last command, baseURL outside comments ([47e4a20](https://github.com/event4u-app/agent-config/commit/47e4a20bd383a912013b8fc4c16e9141d67e6398))
* **language-mirror:** a glued trailing span needs two output lines directly above it ([cac635d](https://github.com/event4u-app/agent-config/commit/cac635d86571a09b7e09410b9316e1272292934f))
* **turn-end-gate:** pipefail off after any other set or shopt naming it, request targets from dequoted shell words ([6a0a933](https://github.com/event4u-app/agent-config/commit/6a0a933c79a6fb45e598894a6beeb0295ac5ce39))
* **language-mirror:** veto on the opposing language directly; tab-indented list closers close ([adf8495](https://github.com/event4u-app/agent-config/commit/adf8495419f0ca9805f238c95c8701cd23f1f0d2))
* **language-mirror:** the veto reads the raw prompt; list fences count tab columns ([6a5d13b](https://github.com/event4u-app/agent-config/commit/6a5d13b3d5a43946e62087a17a8d85741177839b))
* **turn-end-gate:** no status handed on by an exit of PIPESTATUS, credit only request targets (D10) ([39cb7d8](https://github.com/event4u-app/agent-config/commit/39cb7d8478c2c538bbe8fb5fde01f3c3012e434c))
* **language-mirror:** the veto strips only host regions; top-level closers take three spaces ([ba7f239](https://github.com/event4u-app/agent-config/commit/ba7f2392d1139672564526a5cbebb585fab0378b))
* **turn-end-gate:** read verifiers skippable through ||, match URL targets whole, ignore doc edits and false && chains ([d7c062b](https://github.com/event4u-app/agent-config/commit/d7c062b8a5ace33a609bf0bd30719f6b88b6c080))
* **turn-end-gate:** one negation check per line, no credit past an unconditional exit, shared bounded reader ([20f6b14](https://github.com/event4u-app/agent-config/commit/20f6b140aa9b849ae684b4919269e99403036f49))
* **language-mirror:** flush an unclosed fence line by line; list closers up to three past the content column ([2b6ecb8](https://github.com/event4u-app/agent-config/commit/2b6ecb8cf216bb7c25b95fa754e68966fbbe72d5))
* **turn-end-gate:** linear Not verified spans, webServer keys outside strings, stop at an unconditional exit ([cdc5e05](https://github.com/event4u-app/agent-config/commit/cdc5e05ed9a279e419024d5294cadf92f3940322))
* **language-mirror:** an unclosed fence hides nothing; list-item closers align to the content column ([d2b5e4f](https://github.com/event4u-app/agent-config/commit/d2b5e4fa1f7b75f431feacf8c42e9512c51379aa))
* **turn-end-gate:** linear comment stripping, URL credit only for HTTP clients, PIPESTATUS exit under pipefail ([8ef9347](https://github.com/event4u-app/agent-config/commit/8ef9347b9b9a77ba9d335652aa2b1074d56f4b1e))
* **review-loops:** strict index types, receipts and production entries for 0.1-0.2 ([8c9c48b](https://github.com/event4u-app/agent-config/commit/8c9c48bb5aed5fd13a9f55b3efa41d56e3927f31))
* **language-mirror:** list-item fences open; blank lines skip the output regex ([9bcf3e1](https://github.com/event4u-app/agent-config/commit/9bcf3e1f49d356ec3be174f594953bd2ec9ee5ec))
* **turn-end-gate:** webServer credit per config, linear compose index, Not verified heading on its own line ([847f8c6](https://github.com/event4u-app/agent-config/commit/847f8c61dd1f1f040002d560ff9e944455991811))
* **language-mirror:** both languages at the floor anywhere veto the pin; fence closers take only spaces or tabs ([0b97d12](https://github.com/event4u-app/agent-config/commit/0b97d123487a116e230088329a69183827748394))
* **verify:** cap surface work while building, read webServer from command strings, parse masking only for a 0 ([299cbb8](https://github.com/event4u-app/agent-config/commit/299cbb83bac97f20e1723bcf8c8260ee6dc1b54b))
* **language-mirror:** veto the pin on any contiguous run of lines that disagrees ([5434c93](https://github.com/event4u-app/agent-config/commit/5434c93c27218de445a264d12f01f819581a0c91))
* **turn-end-gate:** validate counters and counter keys, credit only the webServer script, cap surfaces ([8e997bc](https://github.com/event4u-app/agent-config/commit/8e997bc7021bb7d64b00eba9b2bce8b77eb140f2))
* **language-mirror:** fence delimiters indented at most three spaces; CR ends a line ([1036b27](https://github.com/event4u-app/agent-config/commit/1036b275bef746660bdd51f2724bac8520e8ef42))
* **turn-end-gate:** bounded counter reads, claim lines past blank lines, browser credit through the root config ([8359ae2](https://github.com/event4u-app/agent-config/commit/8359ae21be9f98a91ec9dc85fdee73c94bb7f450))
* **turn-end-gate:** read a negation on the claim's own line when the match starts at a newline ([dfc233a](https://github.com/event4u-app/agent-config/commit/dfc233a615c62fb1cc2a2cece4a72e0e810729a8))
* **verification:** a literal exit code keeps a failure only when nonzero modulo 256 ([f3d368e](https://github.com/event4u-app/agent-config/commit/f3d368eb0dc2d33271c5350d2b2403c14da711c5))
* **language-mirror:** read fences line by line, as Markdown does ([22a9a1a](https://github.com/event4u-app/agent-config/commit/22a9a1a136a3b28f5e7573b8f84567d8cf01df8f))
* **verify:** re-check workspace containment on the path resolved after open ([19cf8b4](https://github.com/event4u-app/agent-config/commit/19cf8b46be90eefe8f322cb5e3506283009c9fc7))
* **verification:** count an exit of PIPESTATUS only as a lone command with the bare expansion ([7c40e91](https://github.com/event4u-app/agent-config/commit/7c40e91eef51d78f95d920f9de5ee348526608ed))
* **verify:** open the contained real path, confirm it after open, and skip a non-object tauri config ([d837aaa](https://github.com/event4u-app/agent-config/commit/d837aaa6fb0b48cebfea11b4b52b2956bfbeb1e5))
* **verification:** count a pipefail set or an exit only where it runs in the parent shell ([91e2c88](https://github.com/event4u-app/agent-config/commit/91e2c88088e588a9bac5b8bf1241ded6ea9fc912))
* **language-mirror:** all prose together is a veto unit ([364ddf6](https://github.com/event4u-app/agent-config/commit/364ddf63f9f29773a4f4eab02bc4415f2489152b))
* **language-mirror:** the combined owner verdict joins the veto; tilde fences are code ([03f2f1a](https://github.com/event4u-app/agent-config/commit/03f2f1ae834c3626d114e61a1a14932cbc34f9a4))
* **verify:** keep surface reads inside the workspace through symlinked directories ([b1d3202](https://github.com/event4u-app/agent-config/commit/b1d3202af1b193e13008721b8d2a03ca057250e5))
* **verification:** let masking replace only a recorded 0, never demote a refusal ([6bdb430](https://github.com/event4u-app/agent-config/commit/6bdb430b030fd8ba69b6eab87efb73453c78aae9))
* **language-mirror:** a prompt pins only when all of its prose agrees ([42c1ce1](https://github.com/event4u-app/agent-config/commit/42c1ce1740a66632418518f23016789b48c6bf95))
* **turn-end-gate:** match surface URLs whole, keep inline code in Not verified lists, refuse symlinked inputs ([b83b45a](https://github.com/event4u-app/agent-config/commit/b83b45ac5d5117365f79b127c68fab4997929711))
* **verification:** never read an output line as the verifier's status ([392c06e](https://github.com/event4u-app/agent-config/commit/392c06e891146995f46b63e2848985e1b51c26f6))
* **language-mirror:** flush the prose paragraph at a document head ([93fae26](https://github.com/event4u-app/agent-config/commit/93fae2694afa8ec9de6506edfd8264f0f4ba5338))
* **turn-end-gate:** check every playwright run in a call and scan tauri lines once ([bebccf5](https://github.com/event4u-app/agent-config/commit/bebccf5148958a3a6046d5d2bf7a258584535fc3))
* **verification:** trust a status echo only after ';', never behind '||' ([a281412](https://github.com/event4u-app/agent-config/commit/a2814125d1f3b7f517107e23848f95369e4222bb))
* **language-mirror:** any two confident prose units that disagree veto the pin ([c34525c](https://github.com/event4u-app/agent-config/commit/c34525c10e3d56db916e854915439455c4797457))
* **turn-end-gate:** recognise browser runs and start commands by the commands a line runs ([61debdf](https://github.com/event4u-app/agent-config/commit/61debdfc09120a4b91ccc7dc96b81c5eb6719a18))
* **verification:** read an echoed status only when the expansion prints its digits ([f69c7ad](https://github.com/event4u-app/agent-config/commit/f69c7ad411eccff6ceb771b97f94c8265919eb53))
* **language-mirror:** an unmarked paragraph can veto but never decide the pin ([e48e404](https://github.com/event4u-app/agent-config/commit/e48e4045b6a4f0a3eeb124ab61b0b8c5b68b70c4))
* **turn-end-gate:** count a surface as driven only when its command runs ([141b0aa](https://github.com/event4u-app/agent-config/commit/141b0aa380249e83ecdad0311aeeda38e205e8c0))
* **verification:** follow a failure through the rest of the line before trusting the record ([65b14a9](https://github.com/event4u-app/agent-config/commit/65b14a9f26a379b30fb87f6bdbcd6be24aa8e0c5))
* **language-mirror:** two confident owner lines that disagree are undetermined ([5b3e5c8](https://github.com/event4u-app/agent-config/commit/5b3e5c8b9f829adfc06a11440605f7202b96087d))
* **turn-end-gate:** bound surface reads on the opened file and narrow what counts as driven ([2650e05](https://github.com/event4u-app/agent-config/commit/2650e058937fca9be5dc5cecfe1adee22fdc78aa))
* **verification:** attribute a recorded or echoed exit code to the pipeline that produced it ([1cc5fac](https://github.com/event4u-app/agent-config/commit/1cc5facb58dd6933501b4040f68008e89c0d965e))
* **language-mirror:** two confident owner spans that disagree are undetermined ([9d0f254](https://github.com/event4u-app/agent-config/commit/9d0f2544ae09a9ef5f6003c66d1b8d5293e11bfc))
* **turn-end-gate:** derive surfaces after the cheap checks and match them by name ([96f21c8](https://github.com/event4u-app/agent-config/commit/96f21c8f8e3f522889bbcf8bd9470344bf608be9))
* **verification:** read a masked exit code only where the exit code decides ([207591f](https://github.com/event4u-app/agent-config/commit/207591fe2797204c10ede6cbbeac35113b8ad2ff))
* **measure-turn-end-gate:** declare the language split as an analysis evidence artifact ([ad1f5e4](https://github.com/event4u-app/agent-config/commit/ad1f5e40b02f6a7581f3b5ad3a3405debd025a20))
* **roadmaps:** make the real-task-run-budget blocker decidable ([4d198f1](https://github.com/event4u-app/agent-config/commit/4d198f1d5ce9c865fda6079f5678df128e25d4e3))
* **ci-mirror:** clone the target of a symlinked node_modules ([ca0c1ee](https://github.com/event4u-app/agent-config/commit/ca0c1ee7863ba2aff2a14f3c9cc132cf6b5090c4))
* **trigger-evals:** load legacy-shape corpora in the local live eval ([5ebe871](https://github.com/event4u-app/agent-config/commit/5ebe871e31420fabda065bc0247326e7228172b7))
* **ci:** isolate CLAUDE_CONFIG_DIR in the host-loadability smoke ([0d54f7c](https://github.com/event4u-app/agent-config/commit/0d54f7cec57a0389293a4e1040ed9f3c372fd213))
* **claude-plugin:** scope plugin root to .claude-plugin so agents/ is not loaded as subagents ([e4182a8](https://github.com/event4u-app/agent-config/commit/e4182a8adc633d5d033c370b9fac6acb0ed194b3))
* **hooks:** LatestRun typechecks as JSON; keep the chunk-defined-twice check ([be2aef3](https://github.com/event4u-app/agent-config/commit/be2aef3a405b9fa6c0bae661787e99120cef1c72))
* **hooks:** the dispatcher pays an owed environment restore before anything else ([8c721c9](https://github.com/event4u-app/agent-config/commit/8c721c9af578c845117bbd7a810d2c5cbb428940))
* **hooks:** the doctor skips damaged summary history items one by one ([f99722e](https://github.com/event4u-app/agent-config/commit/f99722e5c0ed6c28f702ed2cc220a4d1545bc0eb))
* **hooks:** the doctor reads only latest rows the writer would keep, and never drops the history for a bad one ([b2d6470](https://github.com/event4u-app/agent-config/commit/b2d64704e3b20a422d3210cc23a1020e145ee6df))
* **hooks:** the summary records each concern's own completion, and the doctor ranks history on it ([3b020d6](https://github.com/event4u-app/agent-config/commit/3b020d68d45d8b0214ca5a2951f6a9f5da9a7693))
* **hooks:** the doctor weighs a summary's latest row against its history, not instead of it ([3e959df](https://github.com/event4u-app/agent-config/commit/3e959df59f7f5aa967c9ac385801dc19c21c75ee))
* **hooks:** the summary's latest row carries the run's outcome ([29a7951](https://github.com/event4u-app/agent-config/commit/29a7951c2d87a832c5c1391b93e6e8cd4fa3c0dd))
* **hooks:** one run order for feedback writers and the doctor; latest rows validated, prototype-free ([2864752](https://github.com/event4u-app/agent-config/commit/2864752ddc464480b7812b329a5156c4e6686b84))
* **hooks:** the summary's latest row keeps the later run by the concern's own clock ([19ebac7](https://github.com/event4u-app/agent-config/commit/19ebac79abb1b9d495de45830f2d8f79a71b2346))
* **hooks:** summary keeps each concern's last run outside the capped history ([b2ce2b1](https://github.com/event4u-app/agent-config/commit/b2ce2b1215e61aef6b9a8117e07d8665716b8fde))
* **hooks:** a quiet allow keeps its own file when the summary write fails; a full restore clears both marks ([5255754](https://github.com/event4u-app/agent-config/commit/5255754fefa1c09f0d91ad35508eb52e764b8e9c))
* **hooks:** per-concern feedback names its dispatch, and the doctor breaks an equal-instant tie by it ([227b6ca](https://github.com/event4u-app/agent-config/commit/227b6ca9ed601384e37ca41456dd918f1b47c62d))
* **hooks:** a spawned concern gets the scope's hardened baseline, never the live environment ([3503ff9](https://github.com/event4u-app/agent-config/commit/3503ff99929bb118f7d6cab4135c87998455c361))
* **hooks:** owe the baseline when a half-applied scope open cannot roll back ([5106fd1](https://github.com/event4u-app/agent-config/commit/5106fd1a5389808f091be781529899a6ffb77d67))
* **hooks:** recover an owed environment restore before the next scope opens ([3b6c388](https://github.com/event4u-app/agent-config/commit/3b6c3886317c4a263b75684bdbc9b8848fe5ee10))
* **hooks:** address the round-8 ratification findings ([9c6bb2d](https://github.com/event4u-app/agent-config/commit/9c6bb2d8c775311e857f97fd1a6f3505c61d2c11))
* **hooks:** keep the budget file watched; prove refusal and ordering end to end ([d303556](https://github.com/event4u-app/agent-config/commit/d3035561c31d491c1cae4ce63e837a6241a37ee2))
* **hooks:** address the round-6 ratification findings ([ad94bf9](https://github.com/event4u-app/agent-config/commit/ad94bf9b451d614c7f4aa3c3e58f738c58b2b26e))
* **hooks:** address the round-5 ratification findings ([ec407c7](https://github.com/event4u-app/agent-config/commit/ec407c76f8f0dc384b3b2744487c17ab6c592895))
* **hooks:** address the round-4 ratification findings ([bd3c61c](https://github.com/event4u-app/agent-config/commit/bd3c61cc963820a2897b34fa50c16d65b6853b8b))
* **hooks:** address the round-3 ratification findings ([1157db0](https://github.com/event4u-app/agent-config/commit/1157db0a5f410b8a2a9710c164b4e37a8d7468be))
* **hooks:** address the round-2 ratification findings ([ec926e9](https://github.com/event4u-app/agent-config/commit/ec926e910658cce5616269d9ba1d20e8784e35ac))
* **hooks:** address the round-1 ratification findings ([7b9f836](https://github.com/event4u-app/agent-config/commit/7b9f836abbfc38da805013980b22204069f40d35))
* **locks:** no attempt starts after the wait deadline ([93aa0bb](https://github.com/event4u-app/agent-config/commit/93aa0bbd7265977668a7b4e085159ad8db42f17f))
* **locks:** a waiting acquire ends on the wall clock ([08958e9](https://github.com/event4u-app/agent-config/commit/08958e9c170f8af437fbe57e7d32157c4c286b55))
* **locks:** the pruner releases a dead holder's lock; the ledger lock refuses on error ([c8ea6fc](https://github.com/event4u-app/agent-config/commit/c8ea6fc20d2faaf77cc97dd0f0d62fd1e64cafda))
* **locks:** owner-only guard files, an accurate recheck comment, a per-call strict test ([daeb649](https://github.com/event4u-app/agent-config/commit/daeb6490dd8b3bbb00f375982ea98fb957d559c1))
* **locks:** a caller that backs off releases its generation instead of removing it ([1e312ac](https://github.com/event4u-app/agent-config/commit/1e312ac56bfb491c5b7506a09e02ab37aa80d57d))
* **locks:** pruners keep each lock's highest generation ([f4560ac](https://github.com/event4u-app/agent-config/commit/f4560ac412a2463f69db979f557fd2f2dd940de5))
* **locks:** a superseder rechecks that the generation it superseded is still stale ([608828b](https://github.com/event4u-app/agent-config/commit/608828b09c63f17c90917e310f1ce198bd027195))
* **locks:** a strict caller refuses a stale holder at once, and pruners keep fresh generations ([fcf48b9](https://github.com/event4u-app/agent-config/commit/fcf48b93421031c85034de1058c0d94be5f280e0))
* **locks:** prune each lock generation with its retired file ([8ab9c96](https://github.com/event4u-app/agent-config/commit/8ab9c96b0bbbe2c6a5052998ce5074b25ebf5d3f))
* **locks:** read-modify-write writers refuse when no guard can be taken ([a5a9797](https://github.com/event4u-app/agent-config/commit/a5a9797161df999e7785ecd14f0fc5676228a636))
* **locks:** never allocate a generation the listing would not see ([24b2f85](https://github.com/event4u-app/agent-config/commit/24b2f858aa3b77701b989686e12b7c6eb31c757b))
* **locks:** a failed listing throws, and strict callers never supersede a stale holder ([dddf680](https://github.com/event4u-app/agent-config/commit/dddf6801ec8e6957797f740bbbf947f862476892))
* **locks:** move three more stale-lock breakers to the generation lock ([fb2bda0](https://github.com/event4u-app/agent-config/commit/fb2bda07c0d89052aa337c346a4663d3d4fe51ee))
* **locks:** no stale-lock break or release lets two callers hold the five locks ([4db4b83](https://github.com/event4u-app/agent-config/commit/4db4b83442d76271a08527b3d1e47e39915f56f1))

### Performance

* **hooks:** one feedback write per dispatch for quiet concerns ([46e1d7b](https://github.com/event4u-app/agent-config/commit/46e1d7b4e67267e7b830da6a8a9dd8e0287da56f))
* **hooks:** harden the concern environment once per dispatch ([ad766da](https://github.com/event4u-app/agent-config/commit/ad766da8a4e701f87512fe9dfe13abb9bcace657))
* **cli:** compile-cache the hook bundle on the launcher path ([133580b](https://github.com/event4u-app/agent-config/commit/133580bce052aaa4033d69abf3433d99e41149a9))
* **hooks:** load one yaml copy per dispatch, not two ([24447ee](https://github.com/event4u-app/agent-config/commit/24447ee6093ecee2a69cb6208ef348421c28663c))

### Reverts

* **rules:** withdraw the owner-class column from decision-revisit-gate ([d1c5e2b](https://github.com/event4u-app/agent-config/commit/d1c5e2b7e4268b28fc391d00be0dbfd491c7dc43))
* **hooks:** withdraw the dispatch bundle raise for the owner-prose pin ([e373aac](https://github.com/event4u-app/agent-config/commit/e373aac9f0679416e3d57152479406ec4b3af4b0))

### Documentation

* **ratification:** feedback-containment record, round 4 — both seats ratified ([befe663](https://github.com/event4u-app/agent-config/commit/befe66354a12812e4ddbb2d8a163adadd8cc6cd8))
* **evidence:** council prompt for feedback-containment ratification round 4 ([f4b15a7](https://github.com/event4u-app/agent-config/commit/f4b15a71ffa9e57c330a51f47815a399c7cc22be))
* **ratification:** record the owner's decision on feedback containment ([24c2c44](https://github.com/event4u-app/agent-config/commit/24c2c4461114375a748616bc60ee4d0132b0b135))
* **ratification:** state gain, risk and rollback on the feedback-containment record ([597c6d8](https://github.com/event4u-app/agent-config/commit/597c6d84200231deb2fef66959a6c7c7676434ca))
* **ratification:** feedback-containment record, round 3 ([a0ccd2e](https://github.com/event4u-app/agent-config/commit/a0ccd2e6f53bce5065a0230f5c5f43f707dcf9d2))
* **evidence:** council prompt for feedback-containment ratification round 3 ([6119aa1](https://github.com/event4u-app/agent-config/commit/6119aa11441fbc8860caf3c58d0c5c8812bd1f4c))
* **evidence:** round-2 prompt quotes round 1 without its stance line ([3ebd3de](https://github.com/event4u-app/agent-config/commit/3ebd3de8258bc8666bf7094271e9bc2e5619ce77))
* **evidence:** council prompt for feedback-containment ratification round 2 ([18d3cc8](https://github.com/event4u-app/agent-config/commit/18d3cc83eb851e13923dd116b457c19d730b2315))
* **distribution:** awesome-mcp-servers attempt 3 is accepted; two reads refreshed ([07abd6c](https://github.com/event4u-app/agent-config/commit/07abd6c821f0637cb820a8ed0f60b02d6499c771))
* **evidence:** council prompt for the feedback-containment ratification ([b110219](https://github.com/event4u-app/agent-config/commit/b11021900854465a9649960b8c15ac749da23f2b))
* **roadmaps:** defer 2.4 into 2.5 and add the step receipts ([eb1bd27](https://github.com/event4u-app/agent-config/commit/eb1bd27b1087dec54de61b0e66e2662cbfe6d44a))
* **ratification:** owner-class column, confirmed-non-expanding 2/2 in round 3 ([28f70fc](https://github.com/event4u-app/agent-config/commit/28f70fc67ecfa4213ba4b52eb47abb566bec62a9))
* **evidence:** ratification prompt for the owner-class column, round 3 ([e8a558f](https://github.com/event4u-app/agent-config/commit/e8a558f9729969138cf8e42a180a2d8013ef23fa))
* **evidence:** ratification prompt for the owner-class column, round 2 ([14e73bb](https://github.com/event4u-app/agent-config/commit/14e73bb2e0590d69f33c872e01798bd832cfa50c))
* **rules:** say that an outside row still routes to the owner ([3ba75b0](https://github.com/event4u-app/agent-config/commit/3ba75b0ae74d136ff2adb08df313a7e01e298bd7))
* **evidence:** ratification prompt for the owner-class column, round 1 ([d57045d](https://github.com/event4u-app/agent-config/commit/d57045db4cb451f64358049ba5bd5aa894f82f1b))
* **roadmaps:** record questions-that-reach-the-right-decider progress ([e2fe5b5](https://github.com/event4u-app/agent-config/commit/e2fe5b5f264de22bf8cf84a0180faa704bd2ed07))
* **rules:** name the owner class on every reserved row ([674c23e](https://github.com/event4u-app/agent-config/commit/674c23e940f80937f5fc2f19de6302bce6dd1539))
* **roadmaps:** bind each tick's receipt to the step's own paths ([01b12bb](https://github.com/event4u-app/agent-config/commit/01b12bbedd21092cece9c9d41298f6a82aab82ca))
* **roadmaps:** park stop-hooks-that-count-own-edits behind its owner blocker ([fde4a8d](https://github.com/event4u-app/agent-config/commit/fde4a8d1ae25ff1ee6b90cd11e31f4cc2ea9e565))
* **roadmaps:** add step receipts, the offset exemption and the regenerated owned digest ([705f163](https://github.com/event4u-app/agent-config/commit/705f163051f5f41fe330bccfc25e49284467cec6))
* **roadmaps:** record D4, D5 and the work-product owner blocker; carry the live wiring ([d67d650](https://github.com/event4u-app/agent-config/commit/d67d650a14fa9b034a37d7aa577c95fa85e51fbc))
* **contracts:** re-emit the host cost census at the current rule corpus ([516c67f](https://github.com/event4u-app/agent-config/commit/516c67fe059a10490f2c44719a0d1eebe41e9bd7))
* **roadmaps:** close mandates-scoped-to-the-goal without the hook raise and split off its wiring ([64fdece](https://github.com/event4u-app/agent-config/commit/64fdecef3d4edf7666ce415c37cca5b4d6bc49c7))
* **evidence:** keep the 18 goal-record ratification prompts as the record ([a0951b9](https://github.com/event4u-app/agent-config/commit/a0951b93c46fcd04630d7b846365233817cce6ee))
* **roadmap:** order the live-wiring risk register by rank ([f94496c](https://github.com/event4u-app/agent-config/commit/f94496c69b76fc3d17d487fb13bf396b265bbd08))
* **roadmap:** receipts, risk register and owned digest for the owner-prose carry ([8c372bb](https://github.com/event4u-app/agent-config/commit/8c372bbb837ada8ef74974fa91b77db5df1b0717))
* **roadmap:** drop the offset exemption the archive already covers ([b8bf221](https://github.com/event4u-app/agent-config/commit/b8bf22101f004063da4dc15569c3c1382d176b75))
* **roadmap:** fold the claim-chunk follow-up into the live-wiring roadmap ([2f62605](https://github.com/event4u-app/agent-config/commit/2f62605452102bc79288166f51eb36a0f77cc570))
* **roadmap:** carry the owner-prose pin wiring to its own roadmap ([7ec36e8](https://github.com/event4u-app/agent-config/commit/7ec36e8750adc5a955257b181709b88d8ef72198))
* **roadmap:** carry the live wiring to a follow-up roadmap (D12) ([91a5c2f](https://github.com/event4u-app/agent-config/commit/91a5c2f2d20f6ac4219f167d6a142b3b7856f4a1))
* **git-workflow:** a known red stays local ([7b43ef4](https://github.com/event4u-app/agent-config/commit/7b43ef4f3b94d91dad44fae6bffe115b3d83397a))
* **evidence:** ratification question round 22 for the owner-prose pin ([f3e41e4](https://github.com/event4u-app/agent-config/commit/f3e41e4ceef30ff0fce6d040ec4bfff9eb194ced))
* **evidence:** ratification question round 21 for the owner-prose pin ([2dbef06](https://github.com/event4u-app/agent-config/commit/2dbef06421c3a55836f9ba596c3527128a93d9dc))
* **evidence:** ratification question round 20 for the owner-prose pin ([5a40adb](https://github.com/event4u-app/agent-config/commit/5a40adb48f08ac36081cc90d357cfc51d43af2b1))
* **evidence:** shorten the round-19 question under the council's bundle ceiling ([50ff12e](https://github.com/event4u-app/agent-config/commit/50ff12eb2eb7f97b5b29d426b83e0197d774204f))
* **evidence:** ratification question round 19 for the owner-prose pin ([8d6668a](https://github.com/event4u-app/agent-config/commit/8d6668a179c039b57910eed21e3721ff29a2374d))
* **roadmap:** carry annotation, risk register and owned digest for the unlisted_surface follow-up ([81cae58](https://github.com/event4u-app/agent-config/commit/81cae58a41777acf7548559c1eea6e36fd47a5ae))
* **evidence:** ratification question round 18 for the owner-prose pin ([1b66f79](https://github.com/event4u-app/agent-config/commit/1b66f79101384498bde5598663b107bad15c3a2a))
* **roadmap:** carry step 4.4's live wiring to road-to-unlisted-surface-in-a-claim-chunk (D11) ([8a771f3](https://github.com/event4u-app/agent-config/commit/8a771f3ead54d0ffa35f804d5de1cbb738e6ddca))
* **evidence:** ratification question round 17 for the owner-prose pin ([6b8962f](https://github.com/event4u-app/agent-config/commit/6b8962f8134f0d0b64e48471fa31941e0e6a30e8))
* **review-loops:** step receipts for the steps ticked on this branch ([5bd8836](https://github.com/event4u-app/agent-config/commit/5bd88364317e113fcd2d83dd283ee10dbfd74806))
* **review-loops:** move the convergence advisory into the ai-council skill ([edd6cbd](https://github.com/event4u-app/agent-config/commit/edd6cbd0df206291c822c5d43fd5351091547100))
* **council:** keep both round-26 ratification replies verbatim ([12e90e3](https://github.com/event4u-app/agent-config/commit/12e90e3da8ed80ea88ffdf783cde26f93ec6dc78))
* **review-loops:** route both owner blockers and park the roadmap ([ae057c3](https://github.com/event4u-app/agent-config/commit/ae057c36e836a4c048d8ad5b7a04ff5419b5a790))
* **evidence:** ratification question round 16 for the owner-prose pin ([c86a73d](https://github.com/event4u-app/agent-config/commit/c86a73dd05709148780d7dd91ce33868b7d4dcce))
* **evidence:** ratification question round 15 for the owner-prose pin ([480d438](https://github.com/event4u-app/agent-config/commit/480d43819ea24a19c82fad683a1d522761fbe9cb))
* **evidence:** council prompt for ratification round 26 ([d9d7e60](https://github.com/event4u-app/agent-config/commit/d9d7e6049bca628c744db3d3822537842f75eab2))
* **review-loops:** run the convergence verdict before the next ratification round ([9cc80cd](https://github.com/event4u-app/agent-config/commit/9cc80cd83ea02c7a39aa5ec17958cef336e8355d))
* **review-loops:** council verdict on the convergence criterion ([c06f154](https://github.com/event4u-app/agent-config/commit/c06f1546232d4d7378b1337907dbf07ea7c942db))
* **review-loops:** reader origin classes for the ten longest loops ([f95da3b](https://github.com/event4u-app/agent-config/commit/f95da3b4aa6bd4aa10d2b02f7e7045da55c84715))
* **evidence:** restore the override/missed-update distinction in round 14 ([eedd05c](https://github.com/event4u-app/agent-config/commit/eedd05cf849abf6502de34622b1119ae4d61b428))
* **evidence:** shorten the round-14 ratification question under the council's bundle ceiling ([5b34362](https://github.com/event4u-app/agent-config/commit/5b34362a4e222f44fc7ca340fb84fb6742025d80))
* **evidence:** ratification question round 14 for the owner-prose pin ([a9de2a7](https://github.com/event4u-app/agent-config/commit/a9de2a786d2ac4b5a5f49abb123ad995cbd82bac))
* **prompt-shape:** name the host-tag residual of stripHostRegions ([4c343eb](https://github.com/event4u-app/agent-config/commit/4c343ebf154ce5ee57f196edbd1527cd8c64346e))
* **evidence:** ratification question round 13 for the owner-prose pin ([9ec2174](https://github.com/event4u-app/agent-config/commit/9ec2174850262758769ac5a51c7868fef78cc641))
* **evidence:** ratification question round 12 for the owner-prose pin ([a1e9d39](https://github.com/event4u-app/agent-config/commit/a1e9d39e5ae4c4e738a70e733c1e29a9400828be))
* **evidence:** ratification question round 11 for the owner-prose pin ([75d91da](https://github.com/event4u-app/agent-config/commit/75d91dac57dbd6b094f9d93134b7e1e272761ea9))
* **evidence:** ratification question round 10 for the owner-prose pin ([5750bf4](https://github.com/event4u-app/agent-config/commit/5750bf4297a4c2627d1a15812b74119bad1659d4))
* **evidence:** ratification question round 9 for the owner-prose pin ([b2f169a](https://github.com/event4u-app/agent-config/commit/b2f169a1a38c5dbeb05ff2981ef3d61535a7c2ee))
* **evidence:** ratification question round 8 for the owner-prose pin ([0242707](https://github.com/event4u-app/agent-config/commit/02427078866342a14ae967046b27cba7e4af4291))
* **evidence:** ratification question round 7 for the owner-prose pin ([3e16897](https://github.com/event4u-app/agent-config/commit/3e16897ce97e282ee96ed4d9816b261083bb7deb))
* **evidence:** ratification question round 6 for the owner-prose pin ([f691be4](https://github.com/event4u-app/agent-config/commit/f691be406b6a98970e416604b4bfa7f5d419343c))
* **evidence:** ratification question round 5 for the owner-prose pin ([5704105](https://github.com/event4u-app/agent-config/commit/570410596b173b046a8491502f2b1a86f6d18c0e))
* **evidence:** ratification question round 4 for the owner-prose pin ([fe18165](https://github.com/event4u-app/agent-config/commit/fe181655c436a228484c3571bbc006e1a5243063))
* **evidence:** ratification question round 3 for the owner-prose pin ([a479498](https://github.com/event4u-app/agent-config/commit/a47949851ce16173b389d445df71c1dda21bbc57))
* **evidence:** ratification question round 2 for the owner-prose pin ([c6ef1f4](https://github.com/event4u-app/agent-config/commit/c6ef1f4346d006645f27dd0b5f2488ba6c2a92c1))
* **evidence:** ratification question for the owner-prose pin bundle raise ([2633aae](https://github.com/event4u-app/agent-config/commit/2633aaec3f45a12e1ab4b731ecc4b142783f7fd8))
* **roadmap:** shadow receipts for Phase 5 and reach exemptions for the report scripts ([3e160a2](https://github.com/event4u-app/agent-config/commit/3e160a298f1bef7e6f33029b4ea8f29619b63f8a))
* **roadmap:** record the arming verdicts and archive done-claims roadmap ([d5b52da](https://github.com/event4u-app/agent-config/commit/d5b52da129845672cbedaf3f88cf190897f303f4))
* **roadmap:** record the council's floor for short owner spans (D5) ([db4d6ea](https://github.com/event4u-app/agent-config/commit/db4d6ea24b4c08b3eb3d6fa8559f5be9f0242cf6))
* **roadmap:** close throughput-recovery 4.1 on the council's option (b) ([e85ca00](https://github.com/event4u-app/agent-config/commit/e85ca00b52c73337e3877b8e80ba5599e5fe22ee))
* **evidence:** record the language refusal split baseline for 2026-11-03..21 ([728c37e](https://github.com/event4u-app/agent-config/commit/728c37e8515a3a5b9af175b932323452dae292aa))
* **roadmaps:** give every added verify clause a falsifiable expectation ([de7e129](https://github.com/event4u-app/agent-config/commit/de7e129e0851f4bda11e5901405726d7a0d9944d))
* **council:** round-25 replies are quoted text, not references ([9f5ef03](https://github.com/event4u-app/agent-config/commit/9f5ef03f4522f0bd741d70154e2cac18069d2d0e))
* **ratification:** state gain, risk and rollback on the round-25 record ([8810790](https://github.com/event4u-app/agent-config/commit/8810790d0deec3f6e3572a68b62fad304b70642c))
* **ratification:** round-25 record, split verdict, both replies verbatim ([2a3cc8c](https://github.com/event4u-app/agent-config/commit/2a3cc8c1738a4c559f1efd4b0a125f42d999beb1))
* **roadmaps:** plan every measure from the 2026-11-21 session retro ([a4dcebe](https://github.com/event4u-app/agent-config/commit/a4dcebe4176d29aa4a2ae5a6914e6f528241e2a3))
* **evidence:** council prompt for ratification round 25 ([2b47d6e](https://github.com/event4u-app/agent-config/commit/2b47d6e1de5131bc381c38f79b513a37bc63020d))
* **evidence:** record the owner's directive for the session-retro roadmaps ([3e375d8](https://github.com/event4u-app/agent-config/commit/3e375d8403e3ef6b52d762dec108afd6d1390786))
* **verify-completion-evidence:** name the wrapper-masks-exit-code trap ([1e7652d](https://github.com/event4u-app/agent-config/commit/1e7652d8b5f046a04b921b736fc682bd8d8cfb8b))
* **roadmaps:** step receipts, a verify clause that states its check, a live reference ([51be465](https://github.com/event4u-app/agent-config/commit/51be46502b45b14c8623a4e3b7cf02ed5b0f1ba0))
* **council:** keep both round-24 ratification replies verbatim ([e49143f](https://github.com/event4u-app/agent-config/commit/e49143f068a0e29147f37e0afc1c5795c1392a5f))
* **evidence:** council prompt for ratification round 24 ([d775125](https://github.com/event4u-app/agent-config/commit/d775125cee0571d3a9f13f464239f409d893223c))
* **evidence:** council prompt for ratification round 23 ([1bcde45](https://github.com/event4u-app/agent-config/commit/1bcde4548ab0a6c23e86e9312955a8ab8827a514))
* **evidence:** council prompt for ratification round 22 ([937dcbe](https://github.com/event4u-app/agent-config/commit/937dcbe0d5dedcce41849b20a071f8b5b6698a17))
* **evidence:** council prompt for ratification round 21 ([81cbe4f](https://github.com/event4u-app/agent-config/commit/81cbe4f065f01850784318e1af5e318997f73160))
* **evidence:** council prompt for ratification round 20 ([59a3877](https://github.com/event4u-app/agent-config/commit/59a38779734860a62729ea1bf64165462a8334bb))
* **evidence:** council prompt for ratification round 19 ([a42e30f](https://github.com/event4u-app/agent-config/commit/a42e30ff912e611ed28363af7c66e06cd4a51704))
* **evidence:** council prompt for ratification round 18 ([9493284](https://github.com/event4u-app/agent-config/commit/9493284c251c902d96ea09c857e9ff5c25ad6d6f))
* **evidence:** council prompt for ratification round 17 ([e0ed08e](https://github.com/event4u-app/agent-config/commit/e0ed08ec05854dde03ed14d0ad8d11167d7bf635))
* **evidence:** council prompt for ratification round 16 ([89d6e66](https://github.com/event4u-app/agent-config/commit/89d6e66704f3d53cd9be2e1e9f7ea560db580e12))
* **evidence:** council prompt for ratification round 15 ([ac7705e](https://github.com/event4u-app/agent-config/commit/ac7705e2c12dffe854f97f517d204569812121db))
* **evidence:** refresh the round-14 prompt to its head ([08f50fb](https://github.com/event4u-app/agent-config/commit/08f50fbdc2a2158f3c782a3d21dfe5f2815f0f51))
* **hooks:** feedback_policy states the quiet-allow fallback ([54eda02](https://github.com/event4u-app/agent-config/commit/54eda0295cfcc7e20b6d9768ae17b5bbe6b4d6a1))
* **evidence:** council prompt for ratification round 14 ([5575200](https://github.com/event4u-app/agent-config/commit/557520096a9961b226cafcd75c56ec547edf61b7))
* **evidence:** drop an unmeasured figure from the round-13 prompt ([5d6f7d9](https://github.com/event4u-app/agent-config/commit/5d6f7d9c2d22833237125376abbaf8910e27356f))
* **evidence:** council prompt for ratification round 13 ([62defc8](https://github.com/event4u-app/agent-config/commit/62defc8b95f125c7eb43469bb13df455149c44bb))
* **evidence:** council prompt for ratification round 12 ([8870e44](https://github.com/event4u-app/agent-config/commit/8870e4433cd2f7c175d4f3ce46c7c1eb5bc6029b))
* **evidence:** council prompt for ratification round 11 ([4984593](https://github.com/event4u-app/agent-config/commit/49845931730d2faec297c559f276c870e505ee86))
* **evidence:** council prompt for ratification round 10 ([8d7e065](https://github.com/event4u-app/agent-config/commit/8d7e06536ebd7fcb1c4761c99555e20b2e5d09c4))
* **roadmaps:** record the acceptance criteria of the hook-system roadmap ([76e6f36](https://github.com/event4u-app/agent-config/commit/76e6f363b6923b943bb0541ec77788386c1ab3ca))
* **evidence:** ratification prompt, round 9 ([1d5f560](https://github.com/event4u-app/agent-config/commit/1d5f5604d6429bbd50c8ff541d5cef5ead5de7e6))
* **evidence:** ratification prompt, round 8 ([aea119a](https://github.com/event4u-app/agent-config/commit/aea119a6511c314b021d997b9a40e3a88f22863f))
* **evidence:** ratification prompt, round 7 ([fd0a1d4](https://github.com/event4u-app/agent-config/commit/fd0a1d4419abde8c29d8cc80c91b8326a8812020))
* **evidence:** ratification prompt, round 6 ([a81f3e4](https://github.com/event4u-app/agent-config/commit/a81f3e466dee9341094ddab5bf05d219a022967c))
* **evidence:** ratification prompt, round 5 ([6797cbf](https://github.com/event4u-app/agent-config/commit/6797cbfd9528a423e31cb2f3d5e7b747048f9f2a))
* **evidence:** round-4 prompt within the council bundle ceiling ([23eb1f6](https://github.com/event4u-app/agent-config/commit/23eb1f6aa8d46b8b5eae11648a07c4270f90326f))
* **evidence:** ratification prompt, round 4 (complete package) ([f47ce74](https://github.com/event4u-app/agent-config/commit/f47ce7413e3a6243f1aa2c556835f4c0481a86f5))
* **evidence:** ratification prompt, round 3 ([6ed8cee](https://github.com/event4u-app/agent-config/commit/6ed8cee7f81bb2096d15588d7f8da12f076a8611))
* **evidence:** ratification prompt, round 2 ([54dd24f](https://github.com/event4u-app/agent-config/commit/54dd24f331ecc9faa36c8e821a5c2b77225ea133))
* **evidence:** ratification prompt for the hook budget and dispatcher change ([425d969](https://github.com/event4u-app/agent-config/commit/425d96977a6a18b9c1022380d2af84ca5036cc31))
* **roadmaps:** plan the hook budget replacement and the hook-system rework ([25eaa83](https://github.com/event4u-app/agent-config/commit/25eaa83fc836cf0620add78ecb3ebf6f4eafda3c))
* **review:** re-bind R2 round 5 to the scope its fixes produced ([9038273](https://github.com/event4u-app/agent-config/commit/9038273f7589d30a1451d371a58c458dea78a851))
* **review:** R2 round-5 dispositions — two fixed ([d166447](https://github.com/event4u-app/agent-config/commit/d166447256da508752aa9585bae2737b2e32ea4b))
* **locks:** the state_io comments and the hook contract name the generation lock ([3c1b09f](https://github.com/event4u-app/agent-config/commit/3c1b09fa123a88e61c2f1c2dd126415306f42c57))
* **review:** R2 round 5 of the generation lock, two findings ([c45e7ff](https://github.com/event4u-app/agent-config/commit/c45e7ffa5c860e35cb5b23259b6e7c262047e4f4))
* **ratification:** the generation lock, ratified 2/2 in round 18 ([ca023b3](https://github.com/event4u-app/agent-config/commit/ca023b350ab12ab018b1b1ee6c9b425b1dc1c38a))
* **council:** the round-18 ratification question for the generation lock ([bc04ff5](https://github.com/event4u-app/agent-config/commit/bc04ff5c985fcbd9eacc11f769d34fd48f144417))
* **locks:** state the wait guarantee and the dispatch raise as they are ([9fe72c8](https://github.com/event4u-app/agent-config/commit/9fe72c8e4c3aa1c3746407eb3fe8c5476012ca77))
* **council:** the round-17 ratification question for the generation lock ([657ed6b](https://github.com/event4u-app/agent-config/commit/657ed6bc8dc858d3addc082da549daab417dcd47))
* **council:** the round-16 ratification question for the generation lock ([1039b3c](https://github.com/event4u-app/agent-config/commit/1039b3cf68312960c3c3cff358c6c9af12cf777e))
* **review:** R2 round-4 dispositions — five fixed ([43d6906](https://github.com/event4u-app/agent-config/commit/43d69062eb603aeba53c808fa2fe4661d2aa77c1))
* **review:** R2 round 4 of the generation lock, five findings ([05e0390](https://github.com/event4u-app/agent-config/commit/05e039068d51e2c90d659d68d7f3ce528e79bcd3))
* **review:** R2 round-3 dispositions — four fixed ([8e24a81](https://github.com/event4u-app/agent-config/commit/8e24a81947c72f0191589d01166879e436bd5e11))
* **review:** R2 round 3 of the generation lock, four findings ([32ba425](https://github.com/event4u-app/agent-config/commit/32ba425b5f3af0a3ffd7a94fb3f8bb412a2cd56e))
* **ratification:** the generation lock, ratified 2/2 in round 15 ([08da1d1](https://github.com/event4u-app/agent-config/commit/08da1d11a6c4942d1f0e3c09ee0d5d25b73dfe03))
* **council:** the round-15 ratification question (round 14 lacked one stance line) ([bfb2b2f](https://github.com/event4u-app/agent-config/commit/bfb2b2f6f0b5a79ed529d897e123d39d5b22ad3c))
* **council:** the round-14 ratification question for the generation lock ([43b52aa](https://github.com/event4u-app/agent-config/commit/43b52aa85512fb7f3aa2a48ec3e383031e181eca))
* **locks:** a pruner can also remove the superseded generation after our create ([97eb163](https://github.com/event4u-app/agent-config/commit/97eb163a1749da33c0a22b2ac944f36a4350a0af))
* **council:** the round-13 ratification question for the generation lock ([afdb245](https://github.com/event4u-app/agent-config/commit/afdb2451deef91e9e4119d60c635c7c9ecf196c1))
* **council:** fit the round-12 question under the council's size limit ([d8308e9](https://github.com/event4u-app/agent-config/commit/d8308e9af3a072abc96f23d985c3b29bc13d373c))
* **council:** the round-12 ratification question for the generation lock ([5fbdf0f](https://github.com/event4u-app/agent-config/commit/5fbdf0f902c8b8d1d3baca15e3a126b25ca5ec55))
* **locks:** the paused-holder residual covers strict holders too ([9738bf7](https://github.com/event4u-app/agent-config/commit/9738bf7d72d7ceedd0b324c8c02b77b5cded5f36))
* **council:** the round-11 ratification question for the generation lock ([983d6c1](https://github.com/event4u-app/agent-config/commit/983d6c14e62b3b22d6517f81830368a38e7e63c3))
* **council:** the round-10 ratification question for the generation lock ([eeaed4c](https://github.com/event4u-app/agent-config/commit/eeaed4c2f29cf3c1837840d161ce5aa48930fb83))
* **council:** the round-9 ratification question for the generation lock ([ef27d56](https://github.com/event4u-app/agent-config/commit/ef27d569ceea57634f9df1e15c310eb676522613))
* **council:** the round-8 ratification question for the generation lock ([ed9b85c](https://github.com/event4u-app/agent-config/commit/ed9b85c83d58907ddc384312e3bed8f8ce4ad5d6))
* **review:** R2 round-2 dispositions — five fixed, one accepted ([c86f146](https://github.com/event4u-app/agent-config/commit/c86f14617de717ae0043f065e48e8a367aa04c7e))
* **review:** R2 round 2 of the generation lock, six findings ([2c78f82](https://github.com/event4u-app/agent-config/commit/2c78f8219b77617f5d334ca9cd7d96223949611e))
* **review:** R2 round-1 dispositions — two fixed, one deferred, one accepted ([75e53f0](https://github.com/event4u-app/agent-config/commit/75e53f05d96ec1c142ed702566b87ddb847f3d0e))
* **review:** R2 completion review of the generation lock, four findings ([3c0273e](https://github.com/event4u-app/agent-config/commit/3c0273e486234c1cddf49351031e8e047de04127))
* **ratification:** the generation lock, ratified 2/2 in round 7 ([994aa9a](https://github.com/event4u-app/agent-config/commit/994aa9ad4ea20064e4e244264142d4d3b2a7cebd))
* **council:** the round-7 ratification question, with the stance line the record reads ([d863000](https://github.com/event4u-app/agent-config/commit/d863000c22f27e7a5bf2ebaccb480b0eee5cbcb0))
* **council:** the round-6 ratification question for the generation lock ([f6f89c3](https://github.com/event4u-app/agent-config/commit/f6f89c3901e56df43496ade11faac65935fdad12))
* **council:** the round-5 ratification question for the generation lock ([19a5249](https://github.com/event4u-app/agent-config/commit/19a5249049b57b5ee4896ae2c98219e314e1c9e9))
* **locks:** scope the exclusion claim to callers of the protocol ([12f5aab](https://github.com/event4u-app/agent-config/commit/12f5aab55185418643d03f154625758ac70d47a8))
* **council:** the round-4 ratification question for the generation lock ([c4281e0](https://github.com/event4u-app/agent-config/commit/c4281e02bd19b572272e3f41613bdd3a2200e7a7))
* **council:** the round-3 ratification question for the generation lock ([2e78ef9](https://github.com/event4u-app/agent-config/commit/2e78ef97cb3180b98670e4e0c4cc67510463a47a))
* **council:** the round-2 ratification question for the generation lock ([dcd2c4d](https://github.com/event4u-app/agent-config/commit/dcd2c4d9600eee95592a7c3df3ebf50549aa2394))
* **roadmap:** record the round-1 ratification fixes under 2.1 ([bae765d](https://github.com/event4u-app/agent-config/commit/bae765dc64d61b86389ea0343a814d6f5aea2884))
* **council:** the round-1 ratification question for the generation lock ([172edfb](https://github.com/event4u-app/agent-config/commit/172edfbf8448366dac906ec650e62bf7baed0095))
* **roadmap:** close the five lock sites and carry four more as Phase 3 ([091ce7c](https://github.com/event4u-app/agent-config/commit/091ce7cacd567687283a89a4adfa0ed6cdc39850))

### Refactoring

* **hooks:** move the per-concern feedback write into feedback_policy ([1fccf4a](https://github.com/event4u-app/agent-config/commit/1fccf4a9802b841cfba0eda74cb64ef692cac657))
* **language-mirror:** keep the owner-prose pin off the live hook path ([81fa4f3](https://github.com/event4u-app/agent-config/commit/81fa4f3617575a4ff483a6b43bbb8a8dd73c6671))
* **verification:** move exit masking into an off-path module ([9606e46](https://github.com/event4u-app/agent-config/commit/9606e46572a5468b164d8bc05d7763764f1dab7d))
* **turn-end-gate:** keep detector G off the live hook path ([a04d516](https://github.com/event4u-app/agent-config/commit/a04d516b49446b72eeed3f75abf01619b0239db8))
* **user-interaction:** move context-carrying asks into own context file ([344fe41](https://github.com/event4u-app/agent-config/commit/344fe4198e070da808d4bd1404281f7dd3c03bea))
* **council:** stance repair and ratification-prompt checks move out of the over-ceiling files ([16d9ed9](https://github.com/event4u-app/agent-config/commit/16d9ed9dea7f1877092242b94e04e4f8010ebc6a))
* **turn-end-gate:** detectors D and F keep their origin/main trigger; signed exit literals; repair text for trailing commands ([fbe8022](https://github.com/event4u-app/agent-config/commit/fbe802297b85ec191bfb5ba80c0480f513a70056))
* **language-mirror:** gatePinLanguage in its own module; compact the pin docstrings ([54ffe06](https://github.com/event4u-app/agent-config/commit/54ffe067fb4a5e5c4dd75bb8ca131859f9f33c25))
* **turn-end-gate:** take unlisted_surface and the surface reader off the live hook path (D11) ([c0862e9](https://github.com/event4u-app/agent-config/commit/c0862e945eece21fc8a707793700e08c7b962de8))
* **verification:** one linear reachability walk for masking and runnable segments ([5d14cb9](https://github.com/event4u-app/agent-config/commit/5d14cb97c67b7943d17dd953450bebdfe236418a))
* **language-mirror:** the veto is one rule — both languages at the floor in the whole prompt ([021cfd2](https://github.com/event4u-app/agent-config/commit/021cfd267f4664107dbf4f22bf3985410915f1ca))

### Tests

* **mcp:** the pack's proxy limit still fits the real gz limit ([4749b8c](https://github.com/event4u-app/agent-config/commit/4749b8ccdb3f69366807b4ba5b6471bb0a8c525e))
* **hooks:** a feedback write that throws keeps the refusal and later feedback ([80b7633](https://github.com/event4u-app/agent-config/commit/80b763334255b51052219db0b7d19ffa1214815e))
* **hooks:** the feedback write path reports failure, it never throws ([5569969](https://github.com/event4u-app/agent-config/commit/5569969718c052e1888c9c6d04ae10976928b5de))
* **fixtures:** keep the exit-masking roadmap fixtures out of the artifact-location gate ([9d10d07](https://github.com/event4u-app/agent-config/commit/9d10d074338194ff8119e646debd5b36afa53fda))
* **turn-end-gate:** a system-locale pin must not raise a language finding ([0db3668](https://github.com/event4u-app/agent-config/commit/0db3668e3971833eeec45e00514227a5421773df))
* **language-mirror:** owner-prose-only fixture table, red before the fix ([e9ecd2c](https://github.com/event4u-app/agent-config/commit/e9ecd2ccb2f164bc4e1816c1c696a2b1aca400d0))
* **hooks:** writer-to-doctor regressions and the composition checker's exit 2 paths ([9bdade7](https://github.com/event4u-app/agent-config/commit/9bdade77606232d553b26e7dfcfcf023156e7d2a))
* **telemetry:** stop the transport tests aging out of the retention window ([5fde451](https://github.com/event4u-app/agent-config/commit/5fde4511732e55ea9df70f3ca43f4d60caf0c71e))
* **hooks:** a runtime load-set check and an interleaved A/B bench ([16f374b](https://github.com/event4u-app/agent-config/commit/16f374b81200fe13260d96de82077c75d8157e02))
* **locks:** every site lets a lone caller in, and the next after its release ([9cab4cc](https://github.com/event4u-app/agent-config/commit/9cab4ccfc45479e8c2ddfa9669dd70c965bfaea6))

### CI

* **rule-backstops:** run lint_verify_exit_masking in CI ([babd983](https://github.com/event4u-app/agent-config/commit/babd983fa786efb93c7f881a2b83295253c6f88a))

### Chores

* **evaluator:** move the CLI command budget to 130 for retro ([49c492d](https://github.com/event4u-app/agent-config/commit/49c492d86b20544d0681212606d6ef0f46879826))
* **design-intelligence:** canonical spelling in the re-check note ([adcf763](https://github.com/event4u-app/agent-config/commit/adcf763127d90ccaf68cc7afa6ff6be85d67b087))
* **evaluator:** move the CLI command budget to 129 for closure:scan and closure:lint ([4f7615f](https://github.com/event4u-app/agent-config/commit/4f7615f0290d993d2c0149c36d1586e9d1543e6c))
* **design-intelligence:** record the 2026-11-23 upstream re-check ([52e0ccb](https://github.com/event4u-app/agent-config/commit/52e0ccbbcc2def5d907f2c4cc5b98e9d98d52d9d))
* **design-intelligence:** record the quarterly upstream re-check ([8111c17](https://github.com/event4u-app/agent-config/commit/8111c174b70693c0a12c480565b2beb27fac2ab5))
* **sync:** regenerate the process-full projection and the meta token passport ([4382bde](https://github.com/event4u-app/agent-config/commit/4382bde1e4bf5ccf288bb6c4edb348a34d63eebb))
* **docs:** regenerate the doc path inventory and the owned digest ([f66e7cc](https://github.com/event4u-app/agent-config/commit/f66e7cc7639fc49558d50a7bdb0281c8b764cbf5))
* **packs:** refresh the meta token passport ([0d9905e](https://github.com/event4u-app/agent-config/commit/0d9905e4d6c8fc73170a1294ac713e72d3b7c078))
* **generated:** re-emit the standing-payload census and host cost table ([efeed61](https://github.com/event4u-app/agent-config/commit/efeed61d882d7aa609e19769eba0cefddaa678a6))
* **generated:** re-emit the per-host census and the host cost table ([cd5d021](https://github.com/event4u-app/agent-config/commit/cd5d02108415ec9031a10bb3c5559ac98cab7014))
* **hooks:** withdraw the dispatch bundle raise ([b5fdfc7](https://github.com/event4u-app/agent-config/commit/b5fdfc758229f5be66a6bf925c8e0c4033a14b86))
* **evidence:** ratification prompt round 33 for the classifier-scope raise ([f63a103](https://github.com/event4u-app/agent-config/commit/f63a1031e76fc63e142e1d74fad0b891435bd1b5))
* **hooks:** resize the dispatch bundle raise after round 32 ([2fff948](https://github.com/event4u-app/agent-config/commit/2fff9484f04af2527d57e5593a45e6e709b84d3d))
* **evidence:** ratification prompt round 32 for the classifier-scope raise ([408b42e](https://github.com/event4u-app/agent-config/commit/408b42e6f5aa3e743f6eaf3417f0fd990f2fc32d))
* **hooks:** resize the dispatch bundle raise after round 31 ([7498a4e](https://github.com/event4u-app/agent-config/commit/7498a4e58ce39f8724bb6d83563799993da7b4a2))
* **evidence:** ratification prompt round 31 for the classifier-scope raise ([4dbec0e](https://github.com/event4u-app/agent-config/commit/4dbec0e091b77ff8dd30b3487293aacea9d575d9))
* **hooks:** resize the dispatch bundle raise after round 30 ([0637b1f](https://github.com/event4u-app/agent-config/commit/0637b1f2760ebd299ce690b92fe22c01c1bfb0a8))
* **evidence:** ratification prompt round 30 for the classifier-scope raise ([d9a13cb](https://github.com/event4u-app/agent-config/commit/d9a13cb2f10ebf96c27c5b766d440c68ca46e118))
* **hooks:** resize the dispatch bundle raise after round 29 ([ee144e3](https://github.com/event4u-app/agent-config/commit/ee144e33265889fe3fb73ad91931120827f617d8))
* **evidence:** ratification prompt round 29 for the classifier-scope raise ([eba76e3](https://github.com/event4u-app/agent-config/commit/eba76e3401c1e72662671bb56ab620d0b4e71103))
* **hooks:** resize the dispatch bundle raise after round 28 ([ef051de](https://github.com/event4u-app/agent-config/commit/ef051de10a1e344a467d7642bd0aa81eebea9bb9))
* **evidence:** ratification prompt round 28 for the classifier-scope raise ([e0d9a70](https://github.com/event4u-app/agent-config/commit/e0d9a70509cfd851728a28769f3272c646d1692d))
* **hooks:** resize the dispatch bundle raise after round 27 ([570f55d](https://github.com/event4u-app/agent-config/commit/570f55d41afc306056144d89242b47a8777b5021))
* **evidence:** ratification prompt round 27 for the classifier-scope raise ([2a82cf8](https://github.com/event4u-app/agent-config/commit/2a82cf8c231bfafcdc95a05e1eae6f0f521353a5))
* **hooks:** resize the dispatch bundle raise after round 26 ([df82e34](https://github.com/event4u-app/agent-config/commit/df82e34435bb6d78421a148284caee04461fbabe))
* **evidence:** ratification prompt round 26 for the classifier-scope raise ([5489d87](https://github.com/event4u-app/agent-config/commit/5489d87eed1ffb04d140069580ea4a128b9d5dd7))
* **hooks:** resize the dispatch bundle raise after round 25 and state the headroom arithmetic ([84c6f2b](https://github.com/event4u-app/agent-config/commit/84c6f2bc1b229a4a11fa20dc10f10cbb6db7905e))
* **evidence:** ratification prompt round 25 for the classifier-scope raise ([c976afb](https://github.com/event4u-app/agent-config/commit/c976afb2a28b74a96234ac5ef2587d12545a5741))
* **hooks:** resize the dispatch bundle raise after round 24 ([647516f](https://github.com/event4u-app/agent-config/commit/647516fd41ec3dd552b46d6009c49ca3857a73ad))
* **evidence:** ratification prompt round 24 for the classifier-scope raise ([88ab784](https://github.com/event4u-app/agent-config/commit/88ab784dc2151732e055e677b1dc04c4acf37bb4))
* **hooks:** shrink the dispatch bundle raise to the classifier scope ([5784e13](https://github.com/event4u-app/agent-config/commit/5784e1362a3d64cb33ba5aa556d525651909eb5e))
* **evidence:** ref-ignore the docs path in ratification prompts, record the strategy question ([c1e2b1c](https://github.com/event4u-app/agent-config/commit/c1e2b1c388fd0e66d6cfe18b7773a48e3d316b04))
* **skills:** record the ai-council body raise for the convergence advisory ([76fb604](https://github.com/event4u-app/agent-config/commit/76fb604d1ac2c96f568b2300e7d02e251708daed))
* **evidence:** ratification prompt round 23 for the dispatch bundle raise ([66d5d9e](https://github.com/event4u-app/agent-config/commit/66d5d9efce625a67735af35e102c1ea4b8c32144))
* **hooks:** resize the dispatch bundle raise after round 22, with the round-22 ratification prompt ([76eab14](https://github.com/event4u-app/agent-config/commit/76eab14e9508a56bdba8a31308e54f73df2012b9))
* **hooks:** resize the dispatch bundle raise after round 21, with the round-21 ratification prompt ([f582989](https://github.com/event4u-app/agent-config/commit/f582989590f35c59383dbca84bf21a888b38b4bb))
* **hooks:** resize the dispatch bundle raise after round 20 ([b9e2693](https://github.com/event4u-app/agent-config/commit/b9e2693c87129a832a366a71e559b7f7c128c669))
* **evidence:** ratification prompt round 20 for the dispatch bundle raise ([1adb34c](https://github.com/event4u-app/agent-config/commit/1adb34c51fcf36563383d52f070f441980febf14))
* **hooks:** resize the dispatch bundle raise after round 19 ([fc814c8](https://github.com/event4u-app/agent-config/commit/fc814c8f72dd6fa6e0d9a68f80734d22ff7dd303))
* **evidence:** ratification prompt round 19 for the dispatch bundle raise ([b3c63f8](https://github.com/event4u-app/agent-config/commit/b3c63f8ceba7ff928efbc8c1cd11a2c3e5b93dfc))
* **hooks:** resize the dispatch bundle raise after round 18 ([f68f710](https://github.com/event4u-app/agent-config/commit/f68f71092d8040aa44837b36b4688bb401bdc5e0))
* **evidence:** ratification prompt round 18 for the dispatch bundle raise ([0e9c546](https://github.com/event4u-app/agent-config/commit/0e9c546fe0c1a7eb8f17347e8cbdebad3d5bd057))
* **hooks:** resize the dispatch bundle raise after round 17 ([0e2901a](https://github.com/event4u-app/agent-config/commit/0e2901aae6ae31128ad5ae8afe038f9b53c4cd34))
* **evidence:** ratification prompt round 17 for the dispatch bundle raise ([5e766af](https://github.com/event4u-app/agent-config/commit/5e766af928fd09dbe87c21ad6b9a48856137bff7))
* **hooks:** resize the dispatch bundle raise after round 16 ([8036cbf](https://github.com/event4u-app/agent-config/commit/8036cbf626cb4a816875fb731804d498ef09cd3a))
* **evidence:** ratification prompt round 16 for the dispatch bundle raise ([4b060e4](https://github.com/event4u-app/agent-config/commit/4b060e401d93ef99290cb3adb29ea3b083892c53))
* **hooks:** resize the dispatch bundle raise after round 15 ([5135592](https://github.com/event4u-app/agent-config/commit/5135592a52fccae1204feda33387b286612d9ab2))
* **evidence:** ratification prompt round 15 for the dispatch bundle raise ([79c720d](https://github.com/event4u-app/agent-config/commit/79c720dbb47a1904e53f7076ba9c37116e10fdf3))
* **hooks:** resize the dispatch bundle raise after round 14 ([9165394](https://github.com/event4u-app/agent-config/commit/9165394b1c11d332334d44d518190c9aaaa0f53a))
* **evidence:** ratification prompt round 14 for the dispatch bundle raise ([69977e4](https://github.com/event4u-app/agent-config/commit/69977e426906a74527aa5a7ef43b6b7a3aca8411))
* **hooks:** resize the dispatch bundle raise after round 13 ([789f962](https://github.com/event4u-app/agent-config/commit/789f9629425979a2d524057fe405059ab9918f2c))
* **hooks:** size the dispatch raise to the round-9 measurement ([0e8da6b](https://github.com/event4u-app/agent-config/commit/0e8da6b6360e7c3d8d1508e80cba23f923d170c5))
* **evidence:** ratification prompt round 13 for the dispatch bundle raise ([d2f8de2](https://github.com/event4u-app/agent-config/commit/d2f8de2065803991d5c5f1b5d941c48c68cea80d))
* **hooks:** resize the dispatch bundle raise after round 12 ([6eab2f1](https://github.com/event4u-app/agent-config/commit/6eab2f1a22cdc8b1af6ed0132607b8ece9c84068))
* **roadmap:** tick language-pin 4.1 and 4.2 ([fb437fc](https://github.com/event4u-app/agent-config/commit/fb437fcfbf2d81f6a3eb8a6d70f51d5c22d3d084))
* **evidence:** ratification prompt round 12 for the dispatch bundle raise ([04018ad](https://github.com/event4u-app/agent-config/commit/04018ad22c28d44419460ed046acd15a981bc9ca))
* **hooks:** resize the dispatch bundle raise after round 11 ([6c7eb24](https://github.com/event4u-app/agent-config/commit/6c7eb24fd41542fd5023bf94fa04ee4f042abd1b))
* **evidence:** ratification prompt round 11 for the dispatch bundle raise ([a1fcc3f](https://github.com/event4u-app/agent-config/commit/a1fcc3f181f083a486695a82c4c26775c427fdd8))
* **hooks:** record the round-10 bundle reading in the raise entry ([3967be8](https://github.com/event4u-app/agent-config/commit/3967be8a0e3790373cfdfb0fb322435d9bbeeb25))
* **hooks:** size the dispatch raise to the round-7 measurement ([308dd09](https://github.com/event4u-app/agent-config/commit/308dd09cbf596443f49c7a5904e956ee85f7f3ea))
* **evidence:** ratification prompt round 10 for the dispatch bundle raise ([f800597](https://github.com/event4u-app/agent-config/commit/f800597dfd6cda0ed25052e803d59640029764ce))
* **hooks:** resize the dispatch bundle raise after round 9 ([9257257](https://github.com/event4u-app/agent-config/commit/925725733e74d8752fb328bc8c0ac2a69b1bcf43))
* **evidence:** ratification prompt round 9 for the dispatch bundle raise ([24a2f3e](https://github.com/event4u-app/agent-config/commit/24a2f3e9690e3103f5762b1a337fb804427a6145))
* **hooks:** resize the dispatch bundle raise after round 8 ([f43a446](https://github.com/event4u-app/agent-config/commit/f43a446bb7ca723f9af558d3bd25fbe7451603b0))
* **hooks:** restate the dispatch raise against the round-6 reading ([153f5da](https://github.com/event4u-app/agent-config/commit/153f5dad8dbf78f0479616f0b8c5540ff29ba9cb))
* **evidence:** ratification prompt round 8 for the dispatch bundle raise ([8716795](https://github.com/event4u-app/agent-config/commit/8716795bb79084daec7cd1516587bb37642e4a2b))
* **hooks:** resize the dispatch bundle raise after round 7 and record D9 ([2db964c](https://github.com/event4u-app/agent-config/commit/2db964c52ab9425e47be94916b55ed8a7b9d6845))
* **hooks:** restate the dispatch raise against the round-5 reading ([d47a546](https://github.com/event4u-app/agent-config/commit/d47a5462fa3e28175eb93df8cf3787914af1f017))
* **evidence:** ratification prompt round 7 for the dispatch bundle raise ([93948fa](https://github.com/event4u-app/agent-config/commit/93948fa0ed221dd8f768474f571a66a847ec738c))
* **hooks:** lower the dispatch bundle raise to the round-6 reading and record D8 ([6929669](https://github.com/event4u-app/agent-config/commit/6929669f7fcc2b0f9d826b9433035df028f5826e))
* **hooks:** describe the veto in the dispatch raise entry ([b9433f9](https://github.com/event4u-app/agent-config/commit/b9433f9b4fa8a2729244d3f7a600fbed9782a50b))
* **evidence:** ratification prompt round 6 for the dispatch bundle raise ([e4fe3a7](https://github.com/event4u-app/agent-config/commit/e4fe3a7d20a9516d44fe2d78823a119fbb212e4d))
* **hooks:** record the round-5 bundle reading in the raise entry ([5a06c15](https://github.com/event4u-app/agent-config/commit/5a06c1516962f70fa23d5d09b277738015ae5013))
* **hooks:** size the dispatch raise to the round-4 measurement ([34b26ec](https://github.com/event4u-app/agent-config/commit/34b26ecbdc0d47e655b04f02ee2d78475dc01b5d))
* **evidence:** ratification prompt round 5 for the dispatch bundle raise ([e614521](https://github.com/event4u-app/agent-config/commit/e6145219f4d06f45e70137be4c991a62a406e0a9))
* **hooks:** resize the dispatch bundle raise after the round-4 fixes ([cecaec1](https://github.com/event4u-app/agent-config/commit/cecaec14ff68f168f2fb8116ddbc0695aa4a6158))
* **hooks:** size the dispatch raise to the round-3 measurement ([0d9555f](https://github.com/event4u-app/agent-config/commit/0d9555f25cb16f7d84d1d0766e0f9a60d97b4435))
* **evidence:** ratification prompt round 4 for the dispatch bundle raise ([d65ca58](https://github.com/event4u-app/agent-config/commit/d65ca581eefb2b556933ba32c77b2816bc6bc2b8))
* **hooks:** resize the dispatch bundle raise after the round-3 fixes ([194cedc](https://github.com/event4u-app/agent-config/commit/194cedc92efd366ecdf23dfea199dd4f2a58812b))
* **hooks:** size the dispatch raise to the round-2 measurement ([eb1a142](https://github.com/event4u-app/agent-config/commit/eb1a142edf6c8904aaec8d5e77582bbd2ff558d0))
* **evidence:** ratification prompt round 3 for the dispatch bundle raise ([8384f8c](https://github.com/event4u-app/agent-config/commit/8384f8c3a5cd425516636fad077808c857d1fdf1))
* **hooks:** resize the dispatch bundle raise after the round-2 fixes ([918a3be](https://github.com/event4u-app/agent-config/commit/918a3be96f925579db269a8cd2fabc4b6d45d8f8))
* **hooks:** restate the dispatch raise against the round-1 measurement ([e995e10](https://github.com/event4u-app/agent-config/commit/e995e10f78299630c7efc88b3b5d23ca122806be))
* **evidence:** ratification prompt round 2 for the dispatch bundle raise ([8cfc8f3](https://github.com/event4u-app/agent-config/commit/8cfc8f3a3a7bf0dafc9be296f8c5aeb768fd1d09))
* **hooks:** resize the dispatch bundle raise to the re-measured bundle ([060dbc1](https://github.com/event4u-app/agent-config/commit/060dbc1ade76a8d7249e306f0e9fecef33f165b6))
* **hooks:** raise the dispatch bundle ceiling for the owner-prose pin ([2af92fd](https://github.com/event4u-app/agent-config/commit/2af92fde4923b99f2b594fb60921f7bd5a5e7c06))
* **evidence:** ratification prompt for the dispatch bundle raise ([c2bfbe7](https://github.com/event4u-app/agent-config/commit/c2bfbe7de8190b195b5d96a0c7193550092b0e38))
* **roadmap:** tick language-pin 3.2-3.4, record D6 ([0a5d3c9](https://github.com/event4u-app/agent-config/commit/0a5d3c99aadef73dece223f257d189f93179562e))
* **hooks:** raise the dispatch bundle ceiling for detector G and the exit-code classifier ([ecd13e5](https://github.com/event4u-app/agent-config/commit/ecd13e5d922f238d60ec1a68c1b943961fbf1472))
* **generated:** regenerate the owned digest, ownership matrix and doc path inventory ([cbf7406](https://github.com/event4u-app/agent-config/commit/cbf74060ae98ea3e60108458f4582a21933e1d56))
* **skills:** raise the verify-completion-evidence body ceiling for the closing split ([9380334](https://github.com/event4u-app/agent-config/commit/93803346a0e175b388fd90061c6c99e5e3488f34))
* **evaluator:** move the CLI command budget to 127 for verify:surfaces ([c6bb35d](https://github.com/event4u-app/agent-config/commit/c6bb35d4eabf901f6f414001e3ce5905c3ab8f97))
* **roadmap:** tick language-pin 3.1 ([e9c4e9b](https://github.com/event4u-app/agent-config/commit/e9c4e9bf3b53d58323f038dbbef65c4ca98e9431))
* **roadmap:** tick language-pin 2.1 and 2.2 ([a3afb86](https://github.com/event4u-app/agent-config/commit/a3afb866e92143e8a9e671fb096a77452b3ef446))
* **roadmap:** tick language-pin 1.3, record D3 and D4 ([78aee4f](https://github.com/event4u-app/agent-config/commit/78aee4f07c81145cb9978536cfb1a0bf15fb62a5))
* **roadmap:** tick language-pin 1.1 and 1.2 ([bd880d5](https://github.com/event4u-app/agent-config/commit/bd880d5e53bfdf2fec694498e963860ff94a0688))
* **roadmaps:** regenerate the owned digest after archiving ([49c1455](https://github.com/event4u-app/agent-config/commit/49c1455f7d8ee26e71a7fd282c869b2f45b26e00))
* **dist:** regenerate the telemetry settings projection ([a951400](https://github.com/event4u-app/agent-config/commit/a9514007138273425682c61d2a449fb2498897a1))
* **budget:** raise the session-pins chunk ceiling for the generation lock ([a912d53](https://github.com/event4u-app/agent-config/commit/a912d531d1c0d7f69a7ccff0ac62ef4872c26752))

Tests: 41119 (+785 since 20.6.0)

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
