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

# Era: 20.3.x — current

> Started at `20.3.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 20.4.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [20.3.0](https://github.com/event4u-app/agent-config/compare/20.2.0...20.3.0) (2026-11-11)

### Release highlights

- **Behaviour changes:** _none_
- **Default changes + migration:** quiet output by default, --verbose / --debug for the full run (8069430).
- **Security and correctness:** drop the inferred drain; never remove a 20.2.0 lock file, fail closed instead (95cec4a); take no record lock until the hooks of the earlier install have exited (7685f54); never break a live holder's ticket, and hold the older lock path as a directory (455aaa7); do not score inline terminal-pane regions (105248d); repoint the codex writer citation to install.ts:1365 (26e0207); take the record lock rewrite out of the link chunk change (e5e2626); +11 more.
- **Honest nulls:** _none_
- **Known limitations:** mark each install run in the tx log (src/scripts/install.ts declares a residual) (ce43b02); skip tx-log writes the log already records (src/scripts/install.ts declares a residual) (f71c518); quiet output by default, --verbose / --debug for the full run (src/scripts/install.ts declares a residual) (8069430); batch transaction-log appends (src/scripts/install.ts declares a residual) (236ad29).

> **Governance mix:** governance-only 30 vs consumer-only 4 (mixed 22, maintenance 17; taxonomy 1.1.0; range 57d03dc9d8f8..3f6f2b9f0868).

### Features

* **switch-relay:** lock the record by per-holder tickets that never evict a live writer ([b557f86](https://github.com/event4u-app/agent-config/commit/b557f8657ffb178dc46258105d63b69cf43853e7))
* **hook-budget:** a removed group or a dropped member needs a raise_log entry ([d4421a2](https://github.com/event4u-app/agent-config/commit/d4421a2b0d193a6ae1c79d018910855288e7a0c8))
* **upgrade:** quiet output by default, --verbose / --debug for the full run ([8069430](https://github.com/event4u-app/agent-config/commit/806943098457f885e54978dc4eec34206f85f305))
* **hook-budget:** chunk-group ceilings over chunks one caller loads together ([1e52ebe](https://github.com/event4u-app/agent-config/commit/1e52ebef4449a425a3a4e5e449a8b63806ebb8c2))

### Bug Fixes

* **hooks:** apply round-2 wording refinements to the copilot row comment ([eabc59c](https://github.com/event4u-app/agent-config/commit/eabc59c6d37fce9d2833d5510dedfa7167d96918))
* **switch-relay:** drop the inferred drain; never remove a 20.2.0 lock file, fail closed instead ([95cec4a](https://github.com/event4u-app/agent-config/commit/95cec4a9716004d7d41f1e2954d58add83c122fe))
* **switch-relay:** take no record lock until the hooks of the earlier install have exited ([7685f54](https://github.com/event4u-app/agent-config/commit/7685f54261605f349a0fb869d99cd349564872b9))
* **switch-relay:** never break a live holder's ticket, and hold the older lock path as a directory ([455aaa7](https://github.com/event4u-app/agent-config/commit/455aaa7ccade41022274e54c0904f2d1a3ea0f4c))
* **host-docs:** scope the copilot config.json note to the CLI ([38d12e5](https://github.com/event4u-app/agent-config/commit/38d12e5a702d38ab512d161e2d54d0fa12a43c17))
* **language-mirror:** do not score inline terminal-pane regions ([105248d](https://github.com/event4u-app/agent-config/commit/105248d2e824cc9d2835abd5a0c9dec0b2312688))
* **report:** repoint the codex writer citation to install.ts:1365 ([26e0207](https://github.com/event4u-app/agent-config/commit/26e0207c6bb6f972f06566e0d52179a3350694d4))
* **host-docs:** re-establish the drifted copilot hooks row ([e5a3161](https://github.com/event4u-app/agent-config/commit/e5a31617b0ed1793d8d444a2d6d3bf46994cc6e9))
* **install:** mark each install run in the tx log ([ce43b02](https://github.com/event4u-app/agent-config/commit/ce43b021c387bc7f06334c98c81f867ae32e7580))
* **cli:** run settings:sync from its delegate bundle ([ffb38dc](https://github.com/event4u-app/agent-config/commit/ffb38dca04b47d8c414a8d06da2eae19e46d669a))
* **hook-budget:** refuse unknown flags in check_hook_bundle_composition ([0f9b76d](https://github.com/event4u-app/agent-config/commit/0f9b76deae92a1270dae97df4b9f8a02c9295911))
* **switch-relay:** give the older lock file back when it cannot be dated ahead ([3ed8f74](https://github.com/event4u-app/agent-config/commit/3ed8f74bc0381feef41e543597691259a0853063))
* **hooks:** bound the opted-in link at 63,500 B and call the version check what it is ([2f70392](https://github.com/event4u-app/agent-config/commit/2f703925ce923de962a3a87e161f751589a72195))
* **switch-relay:** date the older lock file ahead so that version cannot age it out ([0d9f090](https://github.com/event4u-app/agent-config/commit/0d9f090cd80a9634674cdd3e6e027414489c8d93))
* **hooks:** bind the link chunk to its callers' build ([362505f](https://github.com/event4u-app/agent-config/commit/362505fbf2d7449b098575c104f27cd7b9adc7e2))
* **switch-relay:** keep the older lock file in the protocol across an install ([a65f6d5](https://github.com/event4u-app/agent-config/commit/a65f6d5dfd4a67969780e58d7cb975fe00c61c11))
* **hooks:** correct the link chunk readings and state the opted-in cost ([2ffb6b6](https://github.com/event4u-app/agent-config/commit/2ffb6b6911f0a6d48de11e578b6f2f1f4c692e83))
* **switch-relay:** lock by per-holder tickets so a break never removes a successor ([a24cd73](https://github.com/event4u-app/agent-config/commit/a24cd73827881f0b963abb5c365afd308ffe4c61))
* **switch-relay:** never evict a live lock holder ([6d1cfd6](https://github.com/event4u-app/agent-config/commit/6d1cfd62f34f52a1969a626664723a9ffcfbef04))
* **release:** run the CI mirror on the release head before pushing it ([d80ee78](https://github.com/event4u-app/agent-config/commit/d80ee78ca870c6b125faebca3ffa53bc96214086))

### Performance

* **install:** skip tx-log writes the log already records ([f71c518](https://github.com/event4u-app/agent-config/commit/f71c518d31bf6fddd150ae228b0d0764c4df4057))
* **hooks:** keep the dispatch bundle under main's raised ceiling ([621e661](https://github.com/event4u-app/agent-config/commit/621e6616d643d85353c42c5dce11264bf89aa825))
* **install:** batch transaction-log appends ([236ad29](https://github.com/event4u-app/agent-config/commit/236ad29092d6fa9417e8e08dcce20403b14d7048))
* **hooks:** load the agent-switch link as its own lazy chunk ([8475063](https://github.com/event4u-app/agent-config/commit/84750636c1694c1359a7851487c9d03e0709bc5e))

### Reverts

* **switch-relay:** take the record lock rewrite out of the link chunk change ([e5e2626](https://github.com/event4u-app/agent-config/commit/e5e2626dfb546f11d9673f24dfabc8e1cdf44d01))

### Documentation

* **evidence:** record council round 3 on the copilot row, confirmed-non-expanding ([d464e66](https://github.com/event4u-app/agent-config/commit/d464e664cc3b0187a933bccbb90225fa9d27ab29))
* **maintainers:** regenerate the doc-path inventory for the interleave test's contract cite ([b63c2a5](https://github.com/event4u-app/agent-config/commit/b63c2a5a06b0777c86940632347a534e8359ec94))
* **council:** the three review questions on the record lock ([04764bc](https://github.com/event4u-app/agent-config/commit/04764bc152a99a7c0de5bb736c1f35d00310c4a7))
* **agent-switch-link:** exclusion across versions only after the cutover, one ordered procedure ([999ac21](https://github.com/event4u-app/agent-config/commit/999ac21ee963ec98deb3b1da31779477f9c6890c))
* **evidence:** record the owner's ruling on the #2951 refused seat ([2efa203](https://github.com/event4u-app/agent-config/commit/2efa2034f926894263cd9277ef98448c65529c4f))
* **evidence:** ratification record for the #2950 bundle-ceiling raise ([e48a69c](https://github.com/event4u-app/agent-config/commit/e48a69c8557b69f19a0ff4d0563026ec88541d0f))
* **agent-switch-link:** fail-closed lock across versions, cutover behind the opt-in, counted rollback trigger ([119136f](https://github.com/event4u-app/agent-config/commit/119136f48263998b930ffad4063a87cf1b83e462))
* **evidence:** the #2950 bundle-ceiling ratification prompt, verbatim ([cc406a1](https://github.com/event4u-app/agent-config/commit/cc406a18620c514f336d6db7fc23a386ada297bc))
* **agent-switch-link:** the drain before the record lock, and its limits ([8d2dd9a](https://github.com/event4u-app/agent-config/commit/8d2dd9aa505283113ab7075468c0c2b78f7c47b4))
* **evidence:** state gain, risk and rollback in the #2951 record ([996431c](https://github.com/event4u-app/agent-config/commit/996431cf40c076f273b08672cba42ded9f568027))
* **evidence:** record the #2951 copilot-row ratification review ([e36190f](https://github.com/event4u-app/agent-config/commit/e36190f4e20c9f21be78a000b8fff76b34738aaf))
* **agent-switch-link:** the lock without expiry, its directory, and the rollback procedure ([c2a9e9a](https://github.com/event4u-app/agent-config/commit/c2a9e9a15ba13cf4bfe4bd886822b3951a731886))
* **agent-switch-link:** keep reopened step 8.1 under the 150-word cap ([a1c70a5](https://github.com/event4u-app/agent-config/commit/a1c70a5afe8d2fd0e5f9172eaa9f936c2cfbe817))
* **ratification:** record council round 6 on the link chunk, ratified ([07eb672](https://github.com/event4u-app/agent-config/commit/07eb672c50384a3ccd03f232f755bb9829b15ad3))
* **evidence:** fit the round 6 question under the council's 50 KB bundle ceiling ([5afd90f](https://github.com/event4u-app/agent-config/commit/5afd90fe623360354a6cd9f25f59191d9f5ad1d5))
* **evidence:** the council round 6 question for the link chunk, without the lock ([37c9cd7](https://github.com/event4u-app/agent-config/commit/37c9cd7fd2fa1b3b9888d018a95dfa2163cadc7e))
* **hook-budget:** lower switch_link to 30,300 and the link group to 60,100 ([7ad014e](https://github.com/event4u-app/agent-config/commit/7ad014ed6847d620b5c4b66d5dc54a28a2c5600a))
* **roadmap:** close Phase 1 of the five-arm measurement on its INCONCLUSIVE reading ([40706f7](https://github.com/event4u-app/agent-config/commit/40706f7ad0b0cc7ba2f7383ae73ba5205a00de72))
* **bench:** record the five-arm pilot selection and the Stage B reading ([fbef69b](https://github.com/event4u-app/agent-config/commit/fbef69bf19bcee824f76a16d13880cfd13941c08))
* **roadmap:** fit the three activated roadmaps' Decisions tables to the class contract ([bfeb353](https://github.com/event4u-app/agent-config/commit/bfeb353ba65d7b23fa38dd4b2bd092fd8ef5b6af))
* **roadmap:** set the activated roadmaps ready, each with its own estate claim ([298116c](https://github.com/event4u-app/agent-config/commit/298116c2a3440300ab1a1fad23bc641d8ed2907b))
* **roadmap:** give the funded five-arm comparison its own active roadmap ([5ef0b0d](https://github.com/event4u-app/agent-config/commit/5ef0b0d8f90b1b10653cea441dee76599c75548b))
* **ratification:** state gain, risk and rollback for the link chunk ([e15d704](https://github.com/event4u-app/agent-config/commit/e15d704a78f43eb6db9d70bcfc5c40b28d461f81))
* **ratification:** record council round 5 on the link chunk, refused ([b5eb91d](https://github.com/event4u-app/agent-config/commit/b5eb91d3f839e0531ccc24fedec2cb6a9c77384d))
* **evidence:** the council round 5 question for the link chunk ([913daec](https://github.com/event4u-app/agent-config/commit/913daecc832e9f3ffac56dfebf38637a465e8733))
* **hook-budget:** lower quota_notice to 29,900 and the link group to 62,100 ([3346576](https://github.com/event4u-app/agent-config/commit/3346576fa835fc38dbf585fd28680d6243ed4c45))
* **bench:** pre-register the five-arm comparison on Sonnet 5.5 ([8384cb5](https://github.com/event4u-app/agent-config/commit/8384cb53c7c206fe06f1f5dea5cc12a1436374d1))
* **evidence:** record the owner's budget for the five-arm comparison ([8773341](https://github.com/event4u-app/agent-config/commit/8773341e0e0eb3d67780c726c27b1932bf47b4d2))
* **agent-switch-link:** current readings and the council round 4 question ([0bd8725](https://github.com/event4u-app/agent-config/commit/0bd872595514119c74a44e4ea90a917b0ed5f936))
* **roadmap:** re-review two risk registers; give the citation fix an expectation ([9522007](https://github.com/event4u-app/agent-config/commit/952200770e749306fc7f828b2b54fef85b70efd7))
* **roadmap:** carry the pass-3 gaps — stale evidence clauses, owner decisions in PR bodies, the direction constraint ([4ac9283](https://github.com/event4u-app/agent-config/commit/4ac9283147ba89574b204e1cd12c90726775a897))
* **roadmap:** record the closure pass on the two parked roadmaps ([a3650e4](https://github.com/event4u-app/agent-config/commit/a3650e4b5b15a72a82f61efe47b8480fdac6a8a9))
* **roadmap:** land the round's findings on the parked and stub owners ([8574611](https://github.com/event4u-app/agent-config/commit/85746116fd66385d5f1e475d960f10279ad88a00))
* **roadmap:** land the round's findings on the active roadmaps that own them ([a199be6](https://github.com/event4u-app/agent-config/commit/a199be6d3bc1fab23b9a71828865bb3ea856b891))
* **roadmap:** park two roadmaps for the review residues no roadmap owned ([4a5a258](https://github.com/event4u-app/agent-config/commit/4a5a258ac2c3c4f3b705089bc7d8d64ff7c42a00))
* **agent-switch-link:** lock rules, the link chunk, phase 8 progress ([94a5372](https://github.com/event4u-app/agent-config/commit/94a537262910dc43a785b0308718f74d482406f6))

### Refactoring

* **hooks:** load the link chunk without the lazy-concern table ([f1de65a](https://github.com/event4u-app/agent-config/commit/f1de65ac00783e663955eac601b41a1266e9ed95))

### Tests

* **switch-relay:** pause two holders at each other's steps, and pin 20.2.0's residual eviction ([864c147](https://github.com/event4u-app/agent-config/commit/864c14793b9204452b5f7594a52d0d7d84a250f4))
* **language-mirror:** German text around an inline region, and both region kinds together ([80b8055](https://github.com/event4u-app/agent-config/commit/80b80554794106ec8f2510295da87ed27689c97f))
* **release:** pin the pre-push order; drop a box-rule comment ([93c5ce3](https://github.com/event4u-app/agent-config/commit/93c5ce36b286cc8b9e109d5ba9a79a3e063cd6a9))

### CI

* **publish:** wait up to 30 minutes for npm to serve a release ([ba1b7c0](https://github.com/event4u-app/agent-config/commit/ba1b7c0228c931d76542303b338a1d740fa6ad1f))

### Chores

* **hooks:** raise the bundle ceiling by 200 B for the terminal-pane strip ([0b0726e](https://github.com/event4u-app/agent-config/commit/0b0726e1940a644a176daab3da9e2f3017965aff))
* **roadmap:** regenerate the owned digest after the activation ([b3cc278](https://github.com/event4u-app/agent-config/commit/b3cc2784a984a683acaf02a3fbd087d5432384c1))
* **roadmap:** regenerate the owned digest for the two parked roadmaps ([cc43cb3](https://github.com/event4u-app/agent-config/commit/cc43cb31f09974bfed73f2e741ab7668f0c9f5fd))

Tests: 40235 (+69 since 20.2.0)

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
