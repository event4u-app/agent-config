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

# Era: 19.1.x — current

> Started at `19.1.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 19.2.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [20.0.0](https://github.com/event4u-app/agent-config/compare/19.2.0...20.0.0) (2026-11-04)

### Release highlights

- **Behaviour changes:** migration note and breaking-changes row for 20.0.0 (91930a3); clear the remote reds of the first PR run (removes src/skills/persona-writing/evals/triggers.json) (613857c); keep the reference-photo likeness trigger in the policy only; the rule row exceeded the zero-growth payload ceiling (9a32966); scope the reference-photo likeness trigger to output that reproduces the likeness (council round 1) (f22794e); announce the Veo duration clamp, check image reference indexes, treat a supplied photo of a person as a likeness trigger (0dfee3b); satisfy the gates the main merge left red on this branch (7690bd9); +23 more.
- **Default changes + migration:** migration note and breaking-changes row for 20.0.0 (91930a3); inline the unique top hit's body in suggest_skill_for_task, default-off (1d8b945); diff untracked files by default, size-capped (e84b738).
- **Security and correctness:** keep the contract and process-full cores inside their byte budgets (128ff3f); read a snippet block on a lapsed crawler row as unknown (090ff8d); require a real caller citation in a prose exemption (5230e26); detect main guards precisely and strip comments string-aware (f64a18b); refuse any duplicate key on a rewrite and refresh the backup (ba4020b); keep sentence-initial German names whole and read separators by language (a8a9e91); +129 more.
- **Honest nulls:** _none_
- **Known limitations:** head checks beside the gate, inside the source-size budget (src/scripts/install.ts declares a residual) (85ef498); refuse any duplicate key on a rewrite and refresh the backup (src/scripts/install.ts declares a residual) (ba4020b); host-config writers keep what they did not write (src/scripts/install.ts declares a residual) (473265e); say where a refusal stops — mods and host switches (dist/install/noGoDenyRows.js declares a residual) (5c03f8f); say agent-config hooks, not managed hooks; document mod override class; route foreign skills through intake (src/scripts/install.ts declares a residual) (a32f6a9); inventory the provider-home baseline, mark the session-list beta window, drop a report table (src/scripts/_lib/environment_detector.ts declares a residual) (7742bad); +8 more.

> **Governance mix:** governance-only 216 vs consumer-only 50 (mixed 261, maintenance 75; taxonomy 1.1.0; range 2ccb4356322b..744fa1104bad).

### BREAKING CHANGES

* **ci:** satisfy the gates the main merge left red on this branch ([7690bd9](https://github.com/event4u-app/agent-config/commit/7690bd9fc8781388d4103605d97d5edb7a5c447c))

### Features

* **roadmap:** settle O-1 and O-2 by council on the owner's delegation ([73c0dc0](https://github.com/event4u-app/agent-config/commit/73c0dc06c2d8a72dc2023e5fccd11904e4b8ad7c))
* **stack:** record why a dotnet row was withheld on an engine root ([bf7a7e0](https://github.com/event4u-app/agent-config/commit/bf7a7e05ade4a988f085e9d6ff20ca1519c21ccc))
* **catalog:** llms.txt in the llms.txt format, one link per skill ([783e061](https://github.com/event4u-app/agent-config/commit/783e061d51b5b0c8af610e3ed400557c1084b120))
* **mcp:** lite tools ship an open outputSchema derived from one zod schema each ([795bcb2](https://github.com/event4u-app/agent-config/commit/795bcb28262f00df163c2b6593c484df8255f56e))
* **analysis:** an obligation ledger that can say no ([08ad454](https://github.com/event4u-app/agent-config/commit/08ad454742da95be7dd583e5b84639111b6d9eda))
* **humanizer:** tell register carries a cadence the staleness gate enforces ([009ee71](https://github.com/event4u-app/agent-config/commit/009ee71d938ce28eca806f2b7305ca1998bf69e3))
* **web-launch:** every check says what its verdict rests on ([b04b461](https://github.com/event4u-app/agent-config/commit/b04b461cb74d5d330ff86386241c3403e72e887f))
* **web-launch:** snippet-eligibility and structured-data-parses, pinned by metamorphic invariance ([20bb198](https://github.com/event4u-app/agent-config/commit/20bb198ac9c2d93569247981b2f41d98829af360))
* **claims:** check_claims flags a last_verified older than a date the claim names ([583a234](https://github.com/event4u-app/agent-config/commit/583a234ef5e8d586c0cc727871f5f0e7a8c1bc84))
* **bench:** humanizer bench reports fact conservation per split ([726e758](https://github.com/event4u-app/agent-config/commit/726e7588a2f849236e2b77da4ad82fb96eccaa16))
* **roadmap:** one invocation, at most one delivery PR — process-full takes a set ([3fb21c8](https://github.com/event4u-app/agent-config/commit/3fb21c8255d6856830252627e19355d56a37402a))
* **humanizer:** fact diff catches number words, status, negation and attribution ([1b780cb](https://github.com/event4u-app/agent-config/commit/1b780cb339a7e6cc6dec53d34f6044f810fb61cb))
* **roadmap:** process-step and process-phase take the invocation as the grant ([a42ca4f](https://github.com/event4u-app/agent-config/commit/a42ca4f6ef4847e6d30fb8861281613fb4a87f20))
* **roadmap:** the invocation carries owner answers and run-level policy ([0d4ee24](https://github.com/event4u-app/agent-config/commit/0d4ee243cdc453ea941006be031d00c98527df38))
* **roadmaps:** a wait needs no date to keep a roadmap open ([48ee232](https://github.com/event4u-app/agent-config/commit/48ee23287add52f43ab93f2ff93a45e3d202bf3e))
* **mcp:** inline the unique top hit's body in suggest_skill_for_task, default-off ([1d8b945](https://github.com/event4u-app/agent-config/commit/1d8b945ea104af0bd028952af68bdb9e8cdb09df))
* **routing:** classify a whole run against the frozen baseline (--classify) ([13863f8](https://github.com/event4u-app/agent-config/commit/13863f8535d6ce15f1c412a1e1ec550834b20bba))
* **web-launch:** read a lazy-loaded data-src as a first-paint load ([76b70ed](https://github.com/event4u-app/agent-config/commit/76b70ede88f5ee620539a793d0e39a1137ca3b9a))
* **work-engine:** build me a game is a build, sliced first ([b8a0143](https://github.com/event4u-app/agent-config/commit/b8a0143d0c854437b85961da531ac7dbe0527898))
* **media:** allowed_durations grid in the capability manifest ([653673c](https://github.com/event4u-app/agent-config/commit/653673c29ad76b1129c6fe8faf3cb2a287a5b9ee))
* **intake:** archive pre-check and a gate for third-party agent assets ([b1c3060](https://github.com/event4u-app/agent-config/commit/b1c3060a0061a3c7f799cb1e08199b1bea3ed6cd))
* **media:** announce the Veo duration clamp, check image reference indexes, treat a supplied photo of a person as a likeness trigger ([0dfee3b](https://github.com/event4u-app/agent-config/commit/0dfee3baa9b16dade900f4600a33cc3abcdbd80b))
* **toolchains:** gate accepts resolver runners; engine projects detected, not misrouted ([8c02348](https://github.com/event4u-app/agent-config/commit/8c02348cc56b654fe3f8f66ee06be9e9a8597558))
* **media:** forensic sampling, frame anchors, strips and a video-qa floor ([0d7c5a8](https://github.com/event4u-app/agent-config/commit/0d7c5a8d79d5ea585dfdde2362e71d21752bb206))
* **svg:** lint_svg_asset --class mark catches live text, near-miss angles and sub-pixel detail ([720d77e](https://github.com/event4u-app/agent-config/commit/720d77edcb53b31913a43d6df48994308b5c1528))
* **ai-video:** one provenance finish step with a hash of the final bytes, honest carrier policy ([50decf5](https://github.com/event4u-app/agent-config/commit/50decf50f5368d9e6ca23108e6b00465e71eb982))
* **design-consistency:** shadow-only sibling-gap rule over render style rows ([57815a0](https://github.com/event4u-app/agent-config/commit/57815a0d828f1141084050e347a2f64a6c619e8d))
* **ui-render:** state the style denominator and confine URL targets to same-origin reads ([5d20f21](https://github.com/event4u-app/agent-config/commit/5d20f213dbbedb855876fa53d2891a263da8bfc1))
* **ui-probe:** compare press feedback and read a missing key as not_available ([5bef3df](https://github.com/event4u-app/agent-config/commit/5bef3dfe5863bb340a9ba85ba330cd0203c5a27d))
* **work-engine:** route a bare quality adjective to review before rebuild ([3ad6703](https://github.com/event4u-app/agent-config/commit/3ad670358b90ec869e024f2e49c8d99805be1170))
* **doctor:** report skill directories that shadow a host built-in ([816f14c](https://github.com/event4u-app/agent-config/commit/816f14c6d36efa30e72b75542f6f37f99fe6a535))
* **schemas:** accept xhigh as a pinned effort level ([ad0c6c8](https://github.com/event4u-app/agent-config/commit/ad0c6c81ce43a82665a14f745acb2f0a21770fb7))
* **scripts:** subagent_return_report counts what a leg did ([fbac822](https://github.com/event4u-app/agent-config/commit/fbac8226c11c575ded691e8e5ccf08f11463fea1))
* **memory-recall:** honour the host autoMemoryDirectory, read-only ([8c5926d](https://github.com/event4u-app/agent-config/commit/8c5926d35d0c3a868818a14309f8440850de76f6))
* **lint:** fail on a new skill/command same-name twin ([2327c33](https://github.com/event4u-app/agent-config/commit/2327c33d3807a9ccab6eeace10fca1596534842e))
* **names:** reserve the host names two witnesses saw ([0ad495f](https://github.com/event4u-app/agent-config/commit/0ad495f42a6279f84e6e43b9293505e758977d6b))
* **lint:** template-injection and privileged-job-cache workflow rules ([9104463](https://github.com/event4u-app/agent-config/commit/91044636bc7a6c531fec21e20f07499f2b9b6a25))
* **handoff:** annotate branch and commit drift when the handoff file is consumed ([5ea3cf1](https://github.com/event4u-app/agent-config/commit/5ea3cf15cf5b9985019fdda4b1f44ac156ea4c5e))
* **mcp:** serve declared inputs as turnkey prompt arguments; close three content gaps ([1ef7361](https://github.com/event4u-app/agent-config/commit/1ef73617cf0205f98a1c4431a346da329cd26298))
* **skill-route:** treat the installer's name-only record as a bare source on claude ([ba2e49f](https://github.com/event4u-app/agent-config/commit/ba2e49f62eca47c5ba340e7f46882eb52a2d6e3e))
* **gates:** require source_urls for externally sourced floors; wire legal source tags ([10b1781](https://github.com/event4u-app/agent-config/commit/10b178142de1e40bdc8c91a18f82f9bc9bfec93b))
* **gates:** fail on a duplicate owner-question id ([3b53053](https://github.com/event4u-app/agent-config/commit/3b53053f47fab0d0f10cd612ae5c43458b6028c1))
* **dispositions:** count the fixed and false_positive rows that name an expected outcome ([4752dd9](https://github.com/event4u-app/agent-config/commit/4752dd9ce77a08b1cf2fc824eb4b5776d90b9097))
* **listing:** state a resident priority order and report it beside the alphabetical fill ([56798ae](https://github.com/event4u-app/agent-config/commit/56798aec0682620f8423c89d489f19611c946b0f))
* **fix-loop:** strike ledger in shadow — the counter the ladder never had ([4642933](https://github.com/event4u-app/agent-config/commit/46429332e56dd036c6e0fca9809772765b7e7fe9))
* **sessions:** record the profile a session runs under, and a versioned list ([ec88290](https://github.com/event4u-app/agent-config/commit/ec882906786ccbbbe108c91f97cce1cf05b2b73e))
* **profile:** read the login and sessions of the profile the session runs in ([7ef7a33](https://github.com/event4u-app/agent-config/commit/7ef7a33cae0963a91a8ec12d221716c6caa8bb37))
* **review-changes:** diff untracked files by default, size-capped ([e84b738](https://github.com/event4u-app/agent-config/commit/e84b73853c43027e0619ec82de44db4737936b82))
* **challenge-me:** add the founder sub-command ([f82486b](https://github.com/event4u-app/agent-config/commit/f82486ba64d100459982d310f4bd6b19b128979c))
* **roadmaps:** a report-only resolver for AC-n citations in the test tree ([e8ee594](https://github.com/event4u-app/agent-config/commit/e8ee59465f96fdb7e5c13d775459ff59832431b6))
* **source-gate:** block attribution labels under src/ with zero tolerance ([8afea9f](https://github.com/event4u-app/agent-config/commit/8afea9f246b52883629cef2be5b346e5e97f68d3))
* **skills:** founder-idea-interview, a composed interview that ends in a roadmap ([f713b01](https://github.com/event4u-app/agent-config/commit/f713b0177843117cc53e8d1c431da71801fed7af))
* **film:** seek timeline registries and embedded footage in the film witness ([4907899](https://github.com/event4u-app/agent-config/commit/4907899e67617a8b62f31fa98fc09ff22b66e291))
* **ledger:** subagent_stop records the worker's return size in bytes ([f5e0cba](https://github.com/event4u-app/agent-config/commit/f5e0cba9c04147a8fe1a3f1c2502b36a58a8e8e5))
* **bench:** bench sessions never persist into the transcript store ([877bc17](https://github.com/event4u-app/agent-config/commit/877bc173ce964af83a6c9d3ec4f95f515b1fe107))
* **audit:** /audit config reaches consumer projects, with --min-grade ([e266930](https://github.com/event4u-app/agent-config/commit/e266930d48efcdb78eed8655b2ec4667c53a1f4f))
* **challenge-me:** frontier grilling, declared seams, glossary-first, one recommendation line ([3454bc5](https://github.com/event4u-app/agent-config/commit/3454bc5654ebadc6deeeaaaafdea927e93996e1e))
* **gates:** flag attribution labels naming an external path; hint unpaired Do NOT sections ([03b6617](https://github.com/event4u-app/agent-config/commit/03b6617ba9490f2c87cd2b5e3f3a0f0e46c01fce))
* **ui-render:** photograph a page after it holds still, and hear the console ([70aa0ef](https://github.com/event4u-app/agent-config/commit/70aa0ef23b9ec6e2f9a9ba0c81be3c7986c80afb))
* **gates:** every self-test runs, unknown flags and golden changes are gated ([20bf461](https://github.com/event4u-app/agent-config/commit/20bf461aa10e56324d7fcb82312be3dabee4c57c))
* **gates:** a self-test reject must name its catch ([bc66d8c](https://github.com/event4u-app/agent-config/commit/bc66d8cdfbfb48717bb8138109542a05bc0a0eaf))
* **design-pass:** third-party loads and superseded statutes at write time ([0fd031c](https://github.com/event4u-app/agent-config/commit/0fd031c3015504b06dc59a320e0eaff33d922dbe))
* **doctor:** opt-in cloud carry of the hook matrix via --repair cloud-reach ([a160168](https://github.com/event4u-app/agent-config/commit/a16016853d7e2016f98cf6dd62bed206dbfae08c))
* **web-launch:** offline render witness for third-party loads (--render) ([8f24ca9](https://github.com/event4u-app/agent-config/commit/8f24ca9cc44f78c398e8dc25f063dfe6ff9bbe4f))
* **web-launch:** four outward rows — third-party loads, superseded statute, placeholders, privacy coverage ([ce00e57](https://github.com/event4u-app/agent-config/commit/ce00e57ee884430bc3c9dfcc245b4ca9d0661bc8))
* **doctor:** cloud-reach check and clone probe for Claude Code cloud sessions ([46ef158](https://github.com/event4u-app/agent-config/commit/46ef1584bf5959c494c7236a48c93ef21bd6f729))
* **audit:** /audit reaches consumer projects, with audit:agents ([3b8d4b8](https://github.com/event4u-app/agent-config/commit/3b8d4b83f4623da322d78bc58f1bd8faaea656b6))
* **settings:** security_ops.plan, the plan offer asked once per user ([e741598](https://github.com/event4u-app/agent-config/commit/e741598d1fdaed99c25f941ee84214cf05835c20))
* **security-ops:** an advisory may propose a lever, never throw one ([4d4c0b5](https://github.com/event4u-app/agent-config/commit/4d4c0b52f623e4996f464e48124e6b72dea22932))
* **skills:** code-film skill with a first-party recipe corpus and film motion authority ([6522f1e](https://github.com/event4u-app/agent-config/commit/6522f1e777c512870711a8c2d8786d7058abe34f))
* **ui:render:** film profile witnesses pages computed from time ([ea7bcfd](https://github.com/event4u-app/agent-config/commit/ea7bcfdda29ec599d540deddc3ebfdfdc354aac0))
* **media:** audio-qa.sh measures loudness, true peak and mono fold with ffmpeg only ([6b084a0](https://github.com/event4u-app/agent-config/commit/6b084a07e494d57b4c593319d4df653ac510dee4))
* **audit:** audit:security — supply, pipeline, contain and recover lenses ([88faa6f](https://github.com/event4u-app/agent-config/commit/88faa6f9e17176f1263bfcbecb3a9c3155eb1c6b))
* **advisories:** frameworks, pnpm/yarn/bun lockfiles, and the lever in the issue body ([a1b6599](https://github.com/event4u-app/agent-config/commit/a1b6599bd5c234ca16352ecb5dcfb021b264feb8))
* **audit:** security ledger v2 and a SARIF import for /audit code ([96f8c85](https://github.com/event4u-app/agent-config/commit/96f8c85462ad08e97952c3aad28d269a8e358f5b))
* **site:** rebuilt docs site with landing page, task-based sidebar, tool and feature pages, trust and cost section and a generated CLI reference ([af7fec1](https://github.com/event4u-app/agent-config/commit/af7fec1055889907e0cb97b6a2e74d309be5fde8))
* **media:** reproducible demo-map captures and a setup-wizard strip ([9697e62](https://github.com/event4u-app/agent-config/commit/9697e621cdcb178808aac2eb53666d1e2b20bdd2))
* **cli:** task-grouped help, honest init help and dry run, quiet doctor before install, one line for removed keys ([e404325](https://github.com/event4u-app/agent-config/commit/e4043251ff9c0478eb92a4230a913b13474c581f))
* **assets:** re-rendered info-image without unmeasured figures, web-sized copies and a social preview ([055e2d1](https://github.com/event4u-app/agent-config/commit/055e2d11c3904528231df59196c23057f0959130))
* **site:** manifest-driven docs sync, link classifier, native synced pages and a hosted demo map ([f4721eb](https://github.com/event4u-app/agent-config/commit/f4721ebf201d5b91ad2063f0ba824bcdf81d31a6))

### Bug Fixes

* **hiring-loop-design:** classed trigger corpus, off the grandfather list ([b1b88ab](https://github.com/event4u-app/agent-config/commit/b1b88abc79bc44c989e1280593ca10906e7c2e79))
* close the CI findings of round inbox-2026-11-u ([ae6782f](https://github.com/event4u-app/agent-config/commit/ae6782fea2094e653779ae399611244a1c8a06cb))
* **roadmaps:** verify clauses end in a parseable expectation ([1f10e19](https://github.com/event4u-app/agent-config/commit/1f10e194e46db3cd9ae977fa209ee3f646948c6d))
* **roadmaps:** verify clauses carry their expectation; name the set manifest's production entry ([ff0e784](https://github.com/event4u-app/agent-config/commit/ff0e78443b1783209a854c203861545c855bbb4a))
* **analyze:reference:** keep the tested mode flags in the shortened hint ([90d654a](https://github.com/event4u-app/agent-config/commit/90d654a92312c58246898a209491a3e448b4fab8))
* **roadmap:** keep the contract and process-full cores inside their byte budgets ([128ff3f](https://github.com/event4u-app/agent-config/commit/128ff3fbfb85c7ce9365c01eec55abd74018bf0c))
* **pr-comments:** resolve bot review summaries via minimizeComment ([c208c2a](https://github.com/event4u-app/agent-config/commit/c208c2a24a1dee029515a9d28f5c7aa3d38f9631))
* **web-launch:** read a snippet block on a lapsed crawler row as unknown ([090ff8d](https://github.com/event4u-app/agent-config/commit/090ff8dca910b97298ff508d8cc3e19c75162f94))
* **step-production-reach:** require a real caller citation in a prose exemption ([5230e26](https://github.com/event4u-app/agent-config/commit/5230e26bd4c91b3e27560f53e3a0050420001d2c))
* **production-reach:** detect main guards precisely and strip comments string-aware ([f64a18b](https://github.com/event4u-app/agent-config/commit/f64a18b1b94c3d74fd04898a5fcefa6d68b6aad3))
* **host-config:** refuse any duplicate key on a rewrite and refresh the backup ([ba4020b](https://github.com/event4u-app/agent-config/commit/ba4020b2c445653dfe8931796ba6d1720a3d837f))
* **roadmaps:** receipts on every closed step; regenerate the read-surface table ([a5f08fa](https://github.com/event4u-app/agent-config/commit/a5f08fa8263b775acd4202bb31050a6ffa34986b))
* **fact-diff:** keep sentence-initial German names whole and read separators by language ([a8a9e91](https://github.com/event4u-app/agent-config/commit/a8a9e919dbabcc403056bb8088827a35a3f7f1ad))
* **evidence:** exempt the verbatim council prompt from the reference check ([582f9a5](https://github.com/event4u-app/agent-config/commit/582f9a518ff0c6cf53c3d6eab58791a39a1063c8))
* **reconstruction-ledger:** refuse malformed rows with exit 2 and narrow the evidence-id claim ([958cf3d](https://github.com/event4u-app/agent-config/commit/958cf3d71bf56c91ec5756e13ef48b2edb021387))
* **analyze:reference:** argument-hint within the 120-char schema cap ([d9bc13a](https://github.com/event4u-app/agent-config/commit/d9bc13ac5b973d8a9254647d6dda0c0da6fc74d0))
* **ci:** park test reads the archived roadmap; carried step 2.1 under the word cap ([497a8f5](https://github.com/event4u-app/agent-config/commit/497a8f53777f5560c50249877044431282b79187))
* **mcp:** a kernel stub envelope answers isError, envelope unchanged ([7101c4e](https://github.com/event4u-app/agent-config/commit/7101c4ea2db3288b83c486fbebc21d3bfa47f342))
* **roadmap:** keep process-full's argument-hint under the 120-char schema cap ([811b12c](https://github.com/event4u-app/agent-config/commit/811b12c609772397e4b10b00d7fd9ce45f5f52cc))
* **mcp:** lite tool errors answer isError, and suggest limit is bounded at 20 ([2d6a0fc](https://github.com/event4u-app/agent-config/commit/2d6a0fcdd7ade7c5e8784d64b50e089ca51fe132))
* **reach:** a prose exemption names the call it relies on ([057352f](https://github.com/event4u-app/agent-config/commit/057352f9a3b561f67b23f8fdbc423641a5d5551d))
* **tells:** the dash counter no longer counts numeric ranges ([f0ef36b](https://github.com/event4u-app/agent-config/commit/f0ef36b3cb6d8b17aa26aad49e7662b8766af7f6))
* **reach:** a spread of an export is a use, not a member access ([35bed1c](https://github.com/event4u-app/agent-config/commit/35bed1c8337d22f54e752f319ff6afbfa430b614))
* **reach:** an entry is something that is invoked, not mentioned ([7168edf](https://github.com/event4u-app/agent-config/commit/7168edf48ea5313beb3c9d7d528b1087b69ade19))
* **web-launch:** indexability, metadata and canonical read by meaning, crawlers by purpose ([cff799b](https://github.com/event4u-app/agent-config/commit/cff799bc4375e55ee1c054c1aeaac7b6880705ad))
* **evidence:** type the council record as analysis ([2cf4996](https://github.com/event4u-app/agent-config/commit/2cf499695c5105e24a52e549b15906f5b2f0e35a))
* **mcp:** host-config writers keep what they did not write ([473265e](https://github.com/event4u-app/agent-config/commit/473265e1ba9f70ac995495ed7727dc6270e3146d))
* **routing:** address review — empty runs exit 3, floors must name their baseline, parse inline bodies ([e35cf47](https://github.com/event4u-app/agent-config/commit/e35cf476f8c6ffab5efba6f01dd530204d8c8d84))
* **hooks:** the interruption ledger reads the roadmap claim where sessions:claim writes it ([501048d](https://github.com/event4u-app/agent-config/commit/501048dd5c26ad4c78edf9e547fcf6e3353a6865))
* **humanizer:** fact diff stops false-alarming on locales and German nouns ([979986c](https://github.com/event4u-app/agent-config/commit/979986c8ccbd9366df0cda58e973fada031399b5))
* **roadmap:** process-full says the invocation is the grant, and names what it inherits ([6f2c096](https://github.com/event4u-app/agent-config/commit/6f2c096fca8c407c4830208d01013da4cc2f1cd4))
* **roadmap:** name step 2.1's production entries and follow the archive move ([d4aacff](https://github.com/event4u-app/agent-config/commit/d4aacff26458047eecf694c579051a29dc13fe12))
* **gates:** drop the stale newInThisChange flag on the name-twin baseline ([9a23536](https://github.com/event4u-app/agent-config/commit/9a235365c47b60a87ac6740c5bd4c51bd1b416f0))
* **gates:** drop the spent newInThisChange flag on the name-twin baseline ([b74ae93](https://github.com/event4u-app/agent-config/commit/b74ae93cd24fb6a176687d0aa7d7ec01a74d789d))
* **ci:** drop the spent newInThisChange flag for name-twin-baseline ([740455e](https://github.com/event4u-app/agent-config/commit/740455e0fcc0cb1c91153634d8cb8ef5d039eb41))
* **media:** measure ROI freezes on the C SAD; the x86 SIMD SAD over-reads narrow crops ([e8579d6](https://github.com/event4u-app/agent-config/commit/e8579d6d8ad2f9dbc2f86b373d9762fc2ba70ffb))
* **intake:** name the archive pre-check without a fragile invocation ([18ae6e5](https://github.com/event4u-app/agent-config/commit/18ae6e5a2d939e57c2139f5fce26c5b02208a34f))
* **ci:** skill-body raises, ownership matrix, README comma, verify expectations ([4a75f94](https://github.com/event4u-app/agent-config/commit/4a75f941557092837c43849499150987f37468df))
* **intake:** name the archive pre-check by its installed path ([16cfaf4](https://github.com/event4u-app/agent-config/commit/16cfaf4cef70fc79947bf37923c5c649ad973e6d))
* **roadmaps:** bring the owned digest back under its 10500-token budget ([69e193a](https://github.com/event4u-app/agent-config/commit/69e193a6ef68bac4b7fcfd3c52fc7ae039325d2a))
* **roadmaps:** a carried goal names the parent once, in its Source line ([29754eb](https://github.com/event4u-app/agent-config/commit/29754eb6fa00a5ecb18884fc8323d9e51f11c484))
* **test:** create agents/runtime before mkdtemp in two tests that assumed it existed ([9a8353d](https://github.com/event4u-app/agent-config/commit/9a8353d684a3ff9df0b3e6df56e10c3f4382e597))
* **analysis:** canonical spelling in Class D; record the three skill-body raises with their reasons ([e71af76](https://github.com/event4u-app/agent-config/commit/e71af764ded1b630b7d28be962997a2f3e59aa9d))
* **ci:** clear the remote reds of the first PR run ([613857c](https://github.com/event4u-app/agent-config/commit/613857c39b45967007831058a08b38e969f4f5fe))
* **media:** keep the reference-photo likeness trigger in the policy only; the rule row exceeded the zero-growth payload ceiling ([9a32966](https://github.com/event4u-app/agent-config/commit/9a329662483fd639468918acfe634ecdfdf0f53f))
* **auto-learnings:** park the roadmap under roadmaps/later/, keep the analysis in auto-learnings-1 ([005161a](https://github.com/event4u-app/agent-config/commit/005161a0fbbd46ba964ab78330dedd13eaa32111))
* **media:** scope the reference-photo likeness trigger to output that reproduces the likeness (council round 1) ([f22794e](https://github.com/event4u-app/agent-config/commit/f22794ee2799ac05e35751d4cacee20eb541c7e2))
* **host:** say agent-config hooks, not managed hooks; document mod override class; route foreign skills through intake ([a32f6a9](https://github.com/event4u-app/agent-config/commit/a32f6a984795c08268a8526a9c50a3ecf7840c7a))
* **gates:** read visibility at the baseline, ledger the owner-question gate, fit the digest ([8b5c6e1](https://github.com/event4u-app/agent-config/commit/8b5c6e14191a2d426d7e94d85c3081c1618fb41c))
* **roadmap:** give the last rename verify clause a readable expectation ([7ad94dd](https://github.com/event4u-app/agent-config/commit/7ad94dd8c4de160b520130917fa2480271ad17fc))
* **web-launch:** a canonical naming a registered provider never makes it the site itself ([8e86a27](https://github.com/event4u-app/agent-config/commit/8e86a2794387a60082d944903d967b10ba716cb0))
* **test:** encode quality accepts an explicit undefined ([1bee600](https://github.com/event4u-app/agent-config/commit/1bee600d0807264aebb5b6b5125bea63c208a5dc))
* **media:** ROI freeze tolerates codec noise (-40 dB); a coarser-quantiser fixture proves it ([3458157](https://github.com/event4u-app/agent-config/commit/3458157c0f6a2966543e2851806fac662b84bd3c))
* **svg:** shipped linter takes the asset classes from src/scripts, not src/cli ([230e166](https://github.com/event4u-app/agent-config/commit/230e16691022b67464e86769e593dbcb37757525))
* **skills:** canonical spelling in the new logo-generation line ([6528124](https://github.com/event4u-app/agent-config/commit/65281242311e13e1d7ab600e97f8ee9b93ec4f60))
* **ci:** record skill-body raises, regenerate proof and routing verdict, give each filter skip a reason ([8e8d7ac](https://github.com/event4u-app/agent-config/commit/8e8d7ac10ed74de6af07a788d8b76949e76fb40d))
* **roadmaps:** keep ref-ignore on quoted What-to-do steps in the dashboard ([57b55f3](https://github.com/event4u-app/agent-config/commit/57b55f3cf0f83ffd9cfce1a33d58ace21f94c2ba))
* **rules:** keep the floor-rule changes inside the standing-payload ratchet ([6e326d9](https://github.com/event4u-app/agent-config/commit/6e326d98f09942c1725389e81dd39d95ae7def77))
* **skills:** keep bug-analyzer and systematic-debugging within their body budget ([24cee67](https://github.com/event4u-app/agent-config/commit/24cee67465ae829e165ba9c9c29794fb266985ab))
* **gates:** preamble back under its base, ownership matrix, retire a spent newInThisChange flag ([0815e38](https://github.com/event4u-app/agent-config/commit/0815e38c59b24628581daefb40353f8c1058b708))
* **gates:** parse check_owner_question_ids argv strictly and declare its exit dialect ([736707b](https://github.com/event4u-app/agent-config/commit/736707bfecfa65233925cbe93a88195371e9a198))
* **gates:** keep check_test_delta's self-test off the ambient CI event ([d99b66b](https://github.com/event4u-app/agent-config/commit/d99b66b029e47e6a0b59d9a84f6468e6fd8cc0e4))
* **gates:** drop the served newInThisChange flag on the provider-home baseline ([3773361](https://github.com/event4u-app/agent-config/commit/3773361549623c795ab52ea765a186e2567fb58a))
* **strike-ledger:** key the target on the full command as it ran ([281c01d](https://github.com/event4u-app/agent-config/commit/281c01d37361f83917b69825ed104f923bbf7fa3))
* **strike-ledger:** expire before the fold, cap after it ([e0f95c6](https://github.com/event4u-app/agent-config/commit/e0f95c66aea946957e140d15de2db485201f1d0b))
* **skills:** finish the rename's downstream references and re-pins ([982aca2](https://github.com/event4u-app/agent-config/commit/982aca21be28be266820f3f51044a27a3540b9f4))
* **strike-ledger:** keep the edit counter a surviving entry depends on; prune after folding ([fd78202](https://github.com/event4u-app/agent-config/commit/fd78202263aa464f13456dfc0974eb8d4d5960f4))
* **design-slop:** scan CSS blocks in one pass, so a minified page cannot stall the hook ([2043394](https://github.com/event4u-app/agent-config/commit/20433949c6219a49abb57a31d06f1930ea855989))
* **design-pass:** read the dispatcher envelope, so a dispatched write is checked ([66ddb96](https://github.com/event4u-app/agent-config/commit/66ddb963d6fc327e44c362fbc4c24553893dd047))
* **memory:** project intake writers refuse standing commands at capture ([445e4c8](https://github.com/event4u-app/agent-config/commit/445e4c8c141ff166def931becee6d83147deae61))
* **memory:** standing-command guard needs a recurrence and an exec target ([aaafa4b](https://github.com/event4u-app/agent-config/commit/aaafa4b2060f2b13f6b8534610ae738f9c971c99))
* **strike-ledger:** observe the run the recorder appended; bound the ledger ([557836b](https://github.com/event4u-app/agent-config/commit/557836b7dd6e94c36fff6f55a4e17d0b4dba4266))
* **templates:** shipped workflow templates drop the checkout credential ([3e12a3a](https://github.com/event4u-app/agent-config/commit/3e12a3a1838e51582ddc20b7574bcecb581eb2f1))
* **work-engine:** read plural and German symptom nouns as UI signals ([77afea6](https://github.com/event4u-app/agent-config/commit/77afea618b4fe07e6d20b48c6f72e6433cc87000))
* **free-route:** ask the aggregator not to keep prompts and write the exposure ledger atomically ([5d931e7](https://github.com/event4u-app/agent-config/commit/5d931e781aea7018ae0c974c834b70a6efcd707d))
* **memory:** yield a curated entry once per id ([905f28b](https://github.com/event4u-app/agent-config/commit/905f28b395d4b0727a6b20107a9de76a3445d566))
* **transcripts:** skip set-aside .orphaned- copies and count them apart ([5198e47](https://github.com/event4u-app/agent-config/commit/5198e474d7e0ef036388c0813cfc62cd5370abe6))
* **ci:** free text via env and no cache in privileged release jobs ([9cc5631](https://github.com/event4u-app/agent-config/commit/9cc563184ab029aca6808f4d4946dda09e621a20))
* **lint:** a reserved skill name has no frontmatter escape ([b56917e](https://github.com/event4u-app/agent-config/commit/b56917e376589b74a2500ed588bacb707c4859e6))
* **strike-ledger:** per-agent edits, rebuilt entries, no stale or blocking observation ([e4341d6](https://github.com/event4u-app/agent-config/commit/e4341d6cfa4e835f4a28ec3836a38f031c758070))
* **skills:** rename mcp and code-review so the host built-ins stay reachable ([96a46ef](https://github.com/event4u-app/agent-config/commit/96a46ef746c00529fd8f2341cecc06e820b0c1b6))
* **gates:** drop newInThisChange from the provider-home-joins inventory entry ([f3bf1a0](https://github.com/event4u-app/agent-config/commit/f3bf1a08f771013c17cf87a9126abfbc6cbb9c7b))
* **design-tokens:** read layerless files and fail loudly on what generate cannot read ([b36ef18](https://github.com/event4u-app/agent-config/commit/b36ef18fc7f7722e1aa5e02abf57d672fd7a2818))
* **handoff:** count what the word cap trimmed instead of rendering it as none extracted ([fea0aae](https://github.com/event4u-app/agent-config/commit/fea0aaeb58f272b58cc23856def058f40608e489))
* **free-route:** read a cut-off answer, a missing model and a served size correctly ([e06c7fc](https://github.com/event4u-app/agent-config/commit/e06c7fcd1026cd7536fa9ddee6c05a2cf2063015))
* **sanitize:** a carriage return is not a control-char finding ([0b50fcd](https://github.com/event4u-app/agent-config/commit/0b50fcd2a94d231ee48d2783ecd0414db4a5be6c))
* **commands:** honour a foreign repo's AI-contribution policy; repair create-pr link ([41e06d7](https://github.com/event4u-app/agent-config/commit/41e06d733f0bc2eed603897a58a66869dc9521c3))
* **settings:** contain module roots and named paths by path segment ([876040c](https://github.com/event4u-app/agent-config/commit/876040c8c529dde2bee181190ae0baa6acf9bb60))
* **rules:** route retention floors to primary sources instead of stating figures ([8847a19](https://github.com/event4u-app/agent-config/commit/8847a195954cfa6bd0ad73be6fd32c70b3eaad06))
* **free-hands:** let the head's verdict reach the flip ledger ([56e684c](https://github.com/event4u-app/agent-config/commit/56e684c70ba5c090a673a161f0ecf2392c897392))
* **self-review:** an unparseable chunk is unreviewed, findings carry confidence, the ceiling drops low-risk paths first ([f82284d](https://github.com/event4u-app/agent-config/commit/f82284d1653953ebfb4140bd5d0a5c72d5a87456))
* **hooks:** fence settings.local.json like settings.json ([8e15b26](https://github.com/event4u-app/agent-config/commit/8e15b26409357bce492ee771f0774e0ac9029559))
* **hooks:** a forwarded session message is not a human turn ([66dd150](https://github.com/event4u-app/agent-config/commit/66dd150cfc2d63f56c00dddc16bee42a13347df1))
* **design-pass:** drop the web-launch size cap, a padding bypass ([acb617b](https://github.com/event4u-app/agent-config/commit/acb617bef030f0ef93ee25b5542a48fe31e36a7b))
* **verification:** a discarded failure is never pass-evidence ([99c4b2f](https://github.com/event4u-app/agent-config/commit/99c4b2fbae6b49e05eee39e6e3715857676ca317))
* **fix-loop:** one ladder wording, no count-to-ask paraphrases ([d0ca309](https://github.com/event4u-app/agent-config/commit/d0ca309cb0d4889f2a863185833ed65765aa3f7c))
* **roadmaps:** give three parked roadmaps a machine-readable wake condition ([20eeda7](https://github.com/event4u-app/agent-config/commit/20eeda74982e0720c091fc75657ed0b26de43e54))
* **flows:** classify challenge-me/founder on the product surface ([0ad82ce](https://github.com/event4u-app/agent-config/commit/0ad82ced6b85e4bc23e10307b25bbd6a0c5edb60))
* **gates:** inventory the provider-home baseline, mark the session-list beta window, drop a report table ([7742bad](https://github.com/event4u-app/agent-config/commit/7742bad8c4bb92a56f3d3cade4d5e6aeae200a06))
* **ci:** cite the founder skill's spine slots, keep a fixture path out of the comment lint, refresh skill-overlap ([10f1974](https://github.com/event4u-app/agent-config/commit/10f1974760b346119f11b5194089bf4391537dff))
* **rules:** keep the zero-tolerance tier in the mechanics guideline ([62e87bc](https://github.com/event4u-app/agent-config/commit/62e87bce32fc00fe549582df0bec6583a165c517))
* **profile:** drop the process import claude_config_dir no longer needs ([5dbafe7](https://github.com/event4u-app/agent-config/commit/5dbafe73c512894ce8a3b57bde7553ddc3cf6956))
* **gates:** check_pack_size refuses unknown flags ([048df95](https://github.com/event4u-app/agent-config/commit/048df9561447a417ef625190d15a1b6b21058c5f))
* **gates:** the provider-home ratchet refuses an unknown flag ([850c361](https://github.com/event4u-app/agent-config/commit/850c3619ebf61b3fce9de2835e119875ae734f98))
* **gates:** the provider-home ratchet refuses a dead scan root ([dcb61c6](https://github.com/event4u-app/agent-config/commit/dcb61c6f98ea3e42179123b7221716c4e24cdc63))
* **founder:** use the canonical spelling 'artifact' ([b1dd6f2](https://github.com/event4u-app/agent-config/commit/b1dd6f23863ac2404caf7ed5e5c923f1c8b3147e))
* **payload:** pay back the founder-idea-interview catalogue line ([80955c9](https://github.com/event4u-app/agent-config/commit/80955c93363579252f249df163d0faef01714824))
* **ai-video:** re-pin the video template's pack-size bound; parity test reads the live tier ([d14f838](https://github.com/event4u-app/agent-config/commit/d14f838d77fa05f7407fb16974645b8a3ebf8399))
* **docs:** canonical spelling in /project:analyze and the regenerated doc-path inventory ([5f57083](https://github.com/event4u-app/agent-config/commit/5f5708368489dea53e9e10a24708c1d2d3490b39))
* **readiness:** grade the behaviour contract on an executable spec, not AGENTS.md presence ([e00a485](https://github.com/event4u-app/agent-config/commit/e00a48598f51dfc540383b42ae9ba9f4c33ae59f))
* **design-pass:** read the dispatcher envelope, so the pass fires when dispatched ([d1c05f9](https://github.com/event4u-app/agent-config/commit/d1c05f905d1e9b841a77e05b60e4ac1b3cacb185))
* **roadmaps:** name the CLI entry that ships the film witness ([4589e58](https://github.com/event4u-app/agent-config/commit/4589e5851bfb4c6b2e1a92b98ba22abf13ea3756))
* **ci:** shrink trigger-eval grandfather list, refresh skill-overlap report ([9948bc2](https://github.com/event4u-app/agent-config/commit/9948bc24b3c98aaaee9dc3406ebe93d5a5afe4be))
* **evals:** raise trigger-eval weekly ceiling to 230 ([da8be61](https://github.com/event4u-app/agent-config/commit/da8be614956c2477eade6a1817a89f5a2c8287df))
* **ci:** fit skill bodies, move linter sections out, add trigger corpora, keep fixtures out of the skill gate ([d483573](https://github.com/event4u-app/agent-config/commit/d483573a446248be29a06668066952257932889e))
* **roadmaps:** carried roadmap links back to its parent ([62d83fc](https://github.com/event4u-app/agent-config/commit/62d83fcb660827398746d7377c5557975b54690e))
* **web-launch:** round-8 test gaps — derived time ceiling, output assertions ([bc564a5](https://github.com/event4u-app/agent-config/commit/bc564a50cd925fd90ce84987b89fe3167ea84722))
* **budget:** raise the dispatch ceiling for the web-launch call site ([d9e6f60](https://github.com/event4u-app/agent-config/commit/d9e6f601682d655acef57db0581567b7547caf6b))
* **bench:** keep bench_ab_v2_run within its size baseline ([158a7d4](https://github.com/event4u-app/agent-config/commit/158a7d46f857231d18085b93665bf355579c3f71))
* **roadmaps:** phase-3 receipts are shadow, not a lowered depth ([516ad6f](https://github.com/event4u-app/agent-config/commit/516ad6f85654a2282327e87844bb974b469fab9e))
* **roadmaps:** receipts on every ticked step of road-to-a-lead-the-user-can-reach ([20cd871](https://github.com/event4u-app/agent-config/commit/20cd87147eb569f9ae783d52f1d34fb0ad121acc))
* **roadmaps:** verify clauses state an expectation; /audit hint within 120 chars ([d8a0995](https://github.com/event4u-app/agent-config/commit/d8a0995c1487fc71a82c76d5c29975d6383ea698))
* **gates:** fit the reply-consistency fix into the hook bundle; raise its ceiling with a recorded reason ([4ade845](https://github.com/event4u-app/agent-config/commit/4ade845590c7d4b0136ab8209be1ec13bd58bad9))
* **tests:** drop a denylisted vendor name from the attribution-label fixture ([a9fdd5f](https://github.com/event4u-app/agent-config/commit/a9fdd5f83fc4db5d36f4919e9033ff76a43f8eb8))
* **docs:** registry states live truth, one ADR path, dangling ADR roadmap links repointed ([0e1f605](https://github.com/event4u-app/agent-config/commit/0e1f6051a57492d6294c12fccf0abb1bd9d8a94e))
* **review:** diff committed, staged and unstaged; quarantine tracker text; slice tickets vertically ([9e567e0](https://github.com/event4u-app/agent-config/commit/9e567e08bf0ea17e1b7e1e0e405a8886805a875e))
* **gates:** read a bold recommendation label and wrapped options as one block ([7bbea84](https://github.com/event4u-app/agent-config/commit/7bbea84303071082b61678df3fb3654a5e211808))
* **gates:** pin HOME in check_host_loadability's reject case ([2fe4f13](https://github.com/event4u-app/agent-config/commit/2fe4f13d77505038f2df32d9933ff6de9dadd109))
* **roadmaps:** record where the deferred step 1.1 went, both ends ([54d68a4](https://github.com/event4u-app/agent-config/commit/54d68a45fbeb72510e2aa28bfb11f72b243004c4))
* **gates:** make the captured-output accessor a testing seam; name uiRender as the entry of its steps ([9de3c70](https://github.com/event4u-app/agent-config/commit/9de3c70f2bb6c6b38d9465c72a6b512c759316eb))
* **roadmaps:** raise the evidence step's receipt to R2 ([01eeb40](https://github.com/event4u-app/agent-config/commit/01eeb404af6d5654d279f42d572a497e5da7fc3d))
* receipts and falsifiable verify clauses; keep design-review within budget ([a4d58ec](https://github.com/event4u-app/agent-config/commit/a4d58ec1a52180df755116f174e491638138d371))
* **gates:** check_host_loadability refuses a flag it does not know ([01867bc](https://github.com/event4u-app/agent-config/commit/01867bcd98495371e6322457ca20fdd2a68784a4))
* **design-review:** keep the console/settle note within the skill's size budget ([33c95b5](https://github.com/event4u-app/agent-config/commit/33c95b599139ebda41ddeaca8126869e09863743))
* **gates:** keep the self-test verdict messages short — gate_self_test ships in the hook bundle ([9ffe5dd](https://github.com/event4u-app/agent-config/commit/9ffe5dd834146dfa872327f915f0a3147e17008c))
* **gates:** keep the ratification gate's imports untouched ([c47be04](https://github.com/event4u-app/agent-config/commit/c47be040069dca89ae494757d019aa0ddc69a0a5))
* **report:** follow the codex writer citation to install.ts:1362 ([c945c22](https://github.com/event4u-app/agent-config/commit/c945c22d496d120d5f358edb324816d57018169a))
* **evidence:** type the gate self-test reading ([3518dab](https://github.com/event4u-app/agent-config/commit/3518dab03f9375a1793a47f7ca49ae22c7ba02b7))
* **gates:** repair ten self-tests that were red or green by crash ([1f5e1ff](https://github.com/event4u-app/agent-config/commit/1f5e1ffe56fd666c07de808490a229223c31fe7a))
* **budget:** web-launch chunk ceiling from the new measurement, correct derivation ([9d6e56f](https://github.com/event4u-app/agent-config/commit/9d6e56f02443a1fdf2e5c718a0a948d001675c3e))
* **web-launch:** read long tags whole and report unclosed ones as unread ([992bde8](https://github.com/event4u-app/agent-config/commit/992bde8db4865309bf0ddcd19675db860e051207))
* **web-launch:** find tags over the whole page with a bounded window ([7943475](https://github.com/event4u-app/agent-config/commit/7943475722180e5424a1c2863a07729289fa0f2c))
* **web-launch:** keep the rows linear on pathological markup ([3c3dd45](https://github.com/event4u-app/agent-config/commit/3c3dd4504d9d23ed7de076ec936fc9f54bf15139))
* **design-pass:** cap the web-launch input, report an unchecked file, keep the mapping in the chunk ([abaffa1](https://github.com/event4u-app/agent-config/commit/abaffa1adf0a0893fea6ceab07118552ec0d0378))
* **web-launch:** the render witness imports nothing outside the shipped tree ([698ef46](https://github.com/event4u-app/agent-config/commit/698ef46559e8302cfb6a6d26a7e56ee4552df4b6))
* **install:** stop writing enabledPlugins for the deprecated Claude plugin ([12c1b76](https://github.com/event4u-app/agent-config/commit/12c1b76a26610f9535589be3643bb27a0b2c2f1e))
* **roadmaps:** nothing after a verify expectation on its line ([ce8070c](https://github.com/event4u-app/agent-config/commit/ce8070cf89f90cc696a9ed04816bc45c819dfcb8))
* **roadmaps:** end each verify expectation where the gate reads it ([9e25978](https://github.com/event4u-app/agent-config/commit/9e259789407b7cd86499af83ca6eded9c4a031d6))
* verify clauses state their expectation; the budget comment states a why ([ef08021](https://github.com/event4u-app/agent-config/commit/ef08021fba8aa4ef1428b945dada8be707c2b8aa))
* **settings:** count the fourth B key and keep the rule under its body ceiling ([fcaa762](https://github.com/event4u-app/agent-config/commit/fcaa7622893700288dae2457920bc97d2bb86f12))
* **roadmaps:** give the current-model-price-rows blocker a decidable path ([9fffea8](https://github.com/event4u-app/agent-config/commit/9fffea84b3c3d5773e9359ca9c678d62dfda1b85))
* **media-bundle:** probe on-screen text in all three bands, not the lower third ([1a9d927](https://github.com/event4u-app/agent-config/commit/1a9d927d0453891e55ffd9844191ed3629679759))
* **security-ops:** an unreadable sidecar or a non-boolean plan value is unanswered ([c18662e](https://github.com/event4u-app/agent-config/commit/c18662ed1368ac25e7299f99f8105b92b42543ba))
* **web-launch:** neutralise the superseded-statute trap in benchmark fixture v1 ([b9b614e](https://github.com/event4u-app/agent-config/commit/b9b614e2de8c0a44588e6fa3b0b8fd19002007c9))
* **code-film:** canonical spelling (license) in the skill, corpus and contract ([32d47b9](https://github.com/event4u-app/agent-config/commit/32d47b9fb86b819597c8784d1730ad0eac6cdd94))
* **code-film:** admission row, contract stability, pack-safe pointers, payload-neutral descriptions ([b69015d](https://github.com/event4u-app/agent-config/commit/b69015d98d41610351c816680468bd74a57c549e))
* **tests:** fourteen grader dimensions in the capability registry; the install test accepts the grouped help header ([f5255a7](https://github.com/event4u-app/agent-config/commit/f5255a7ef076b006e8f98af715a7a6f0575b4d21))
* **ci:** receipts and falsifiable verify clauses, consumer paths marked, lifecycle partial as error ([cf4f4b4](https://github.com/event4u-app/agent-config/commit/cf4f4b4eaee09f92ba3a8db8b4b600f60fff3a17))
* **security:** act on the independent review of the inbox-2026-11-s delta ([b36afe5](https://github.com/event4u-app/agent-config/commit/b36afe5cd8d6b349565bcdd11e89409f561d3832))
* **security:** ask the containment question in threat-modeling, leave the ratified rule untouched ([4e578e5](https://github.com/event4u-app/agent-config/commit/4e578e53cb6576523349c026b09eb5f5e2ed56bf))
* grant approval, release impact floor and ADR amendments from the 19.1.0/19.2.0 reviews (#2792) ([03581ff](https://github.com/event4u-app/agent-config/commit/03581ff7916cb63e8fbd6c779dad6b30c5949e44))
* **site:** copy media subfolders into the site build ([c7eb691](https://github.com/event4u-app/agent-config/commit/c7eb691fa2fa9a99c72606c7f2d3ffc38c785ed5))
* **docs:** count a git-ignored file as absent in the doc path inventory ([f5383de](https://github.com/event4u-app/agent-config/commit/f5383def4e1606d133f742a7579c4517de773e91))
* **docs:** keep probe ADR paths out of the doc path inventory, leave archived verify clauses as written ([61f8171](https://github.com/event4u-app/agent-config/commit/61f8171371f1207c215ef6009ac4a36107478d47))
* **adr-cite:** return one citation per decision, not per spelling ([c7f027f](https://github.com/event4u-app/agent-config/commit/c7f027f0ea7a64b66dbed6bcf9c7462c8bab419f))
* **ci:** read the PR diff from git in the legacy-path guard and the actionlint step ([0a0e1ae](https://github.com/event4u-app/agent-config/commit/0a0e1aeabe8be6026a61afdffeed48efab79febd))
* **evidence:** type the independent-read records ([abe7882](https://github.com/event4u-app/agent-config/commit/abe788275e546ef1e65b9846edddb0f69f533504))
* **install:** name the .gitignore and .gitattributes blocks in the scope sentence, accept --yes with init --project, consumer-facing doctor hints ([578640a](https://github.com/event4u-app/agent-config/commit/578640a8e55328da408053fea154d1b03c87d8ec))
* **cli:** code-graph runs from a shipped bundle, templates resolve from the package root, doctor stays out of the repo and exits 0 on warnings ([7ced352](https://github.com/event4u-app/agent-config/commit/7ced352587f7a50471cb41768aa41aed41efb40b))
* **install:** working Copilot export hint and a shipped gitattributes template for init --project ([c2c86b6](https://github.com/event4u-app/agent-config/commit/c2c86b6ed9e9f2928c1933680dc50e65fb3b3e53))
* **code-graph:** <verb> --help prints help instead of running the verb ([95adb4d](https://github.com/event4u-app/agent-config/commit/95adb4d8d9a0f3096010b935de677042cc567adf))
* **install:** init without a scope flag installs globally before writing anything ([648f4fe](https://github.com/event4u-app/agent-config/commit/648f4fe2f3e1b067b4ef6a26867cd45be4207c48))
* **settings:** the cost factors in the template are multiples of the no-rules baseline ([8f310bc](https://github.com/event4u-app/agent-config/commit/8f310bc895148e233f6c63ea29b1385805169b83))
* **roadmap:** step 0.1 receipt matches the PR diff depth ([a4e5d2e](https://github.com/event4u-app/agent-config/commit/a4e5d2e2128b707a5fc679f961b4e06582b82274))
* **roadmap:** receipt for step 0.1 and checkable verify clauses ([c383afa](https://github.com/event4u-app/agent-config/commit/c383afa33e5bf1b7de2952935cb35e065c70d9f1))

### Performance

* **web-launch:** keep the shared tag reader inside the hook chunk budget ([709f16b](https://github.com/event4u-app/agent-config/commit/709f16b98c40b643f31fb05856f19a9be739fcca))
* **hooks:** keep the dispatch bundle under its ceiling without a raise ([7345990](https://github.com/event4u-app/agent-config/commit/7345990d813888288a68dd2d91ac99a7b31c8100))
* **hooks:** move the web-launch rows into a conditional chunk ([50c0295](https://github.com/event4u-app/agent-config/commit/50c0295506a6b9e4cc6e2d959f70208517f8a55c))

### Reverts

* **ledger:** carry return_bytes out of this PR ([02fa963](https://github.com/event4u-app/agent-config/commit/02fa963bf4626e6a315d4d83d98ac5693759f8ab))
* **gates:** keep the hook bundle ceiling; the compacted fix fits under it ([33f1ee5](https://github.com/event4u-app/agent-config/commit/33f1ee5663de30c744809362f4dce2acdd684a57))
* **design-pass:** carry the write-time carrier out; the budget raise was refused ([1f0c4cf](https://github.com/event4u-app/agent-config/commit/1f0c4cf232749e47ab1a5ee9753510e5847026ec))
* **budget:** the hook-bundle overage was a symlinked node_modules artefact ([f5637b4](https://github.com/event4u-app/agent-config/commit/f5637b4ae9188ddbcd2e097d2f9059837be53bf1))

### Documentation

* **release:** migration note and breaking-changes row for 20.0.0 ([91930a3](https://github.com/event4u-app/agent-config/commit/91930a307b4ecd631c9b563b56c5a7e5a30b6830))
* **evidence:** type the neutral review record ([83cf3e5](https://github.com/event4u-app/agent-config/commit/83cf3e5cda285accb188a327ab6704656065ec27))
* **evidence:** neutral review record for round inbox-2026-11-u ([3c08ddf](https://github.com/event4u-app/agent-config/commit/3c08ddf29001eaff235e69b1f55ef22ad5d5afdc))
* **roadmaps:** re-review the provider-slot risk register after Phase 0 ([6d2fbbf](https://github.com/event4u-app/agent-config/commit/6d2fbbfd5d70a1c2e8240570c033d9befa85ac30))
* **roadmaps:** archive the round's roadmaps, carry two owner-gated steps ([ee86d6f](https://github.com/event4u-app/agent-config/commit/ee86d6faf44ed683750e0643bb8927e549fd036e))
* **changelog:** behaviour changes of round inbox-2026-11-u ([63313ea](https://github.com/event4u-app/agent-config/commit/63313ea8c2496052b0676e3f64a4669c98c202ad))
* **evidence:** council prompt for the abandoned-worktree residue ([2294a56](https://github.com/event4u-app/agent-config/commit/2294a56394745c6e131b3fadc98185fd7a41ea91))
* **domain-watch:** record the game-development domain as gated ([f9584b7](https://github.com/event4u-app/agent-config/commit/f9584b7a92cc443d148ac1dc9d1627805a8dd0da))
* **roadmaps:** archive road-to-verdicts-the-markup-cannot-flip, every step closed ([c0548c4](https://github.com/event4u-app/agent-config/commit/c0548c44aa378fe50d47e76bdde1f2e347ac71bf))
* **roadmaps:** receipts for the steps of road-to-rewrites-that-keep-their-facts ([bdd6e46](https://github.com/event4u-app/agent-config/commit/bdd6e462c0e5d0cfc43b2fa423c599c8704f975e))
* **skills:** four inflation checks for release notes and Done notes ([cbd7c3d](https://github.com/event4u-app/agent-config/commit/cbd7c3d2583161c74888e94de59ee02f14b11a61))
* **hiring:** route AI-assisted screening and probe it for name bias ([adb7eb8](https://github.com/event4u-app/agent-config/commit/adb7eb8cde8a47f390e477136bfc42a280068b01))
* **analysis:** unreached engine modules say the model carries them ([7eabedf](https://github.com/event4u-app/agent-config/commit/7eabedfa1f354de7ac03952d4ddae628bd1faf5f))
* **security:** rendering-layer hiding and data injection in spotlighting ([9705e50](https://github.com/event4u-app/agent-config/commit/9705e5097723702017e79d991412cf1e2f0d0293))
* **roadmaps:** observation-slot 0.3 carries the range receipt ([85ae9f8](https://github.com/event4u-app/agent-config/commit/85ae9f8c179fc44ffd5ce5ff16e0134068703c14))
* **roadmaps:** reach exemption for the budget figures of verdicts 3.1 ([cab8e9d](https://github.com/event4u-app/agent-config/commit/cab8e9dd5694186415fc8bf6e010b72d4cde2ed4))
* **roadmaps:** reach exemption for the budget figures of verdicts 3.2 ([9508665](https://github.com/event4u-app/agent-config/commit/9508665144d2cda3c3c87dc9125b909b4a77048b))
* **roadmaps:** give the carried routing roadmap its risk register ([eee1052](https://github.com/event4u-app/agent-config/commit/eee1052ad7dc8ee7071bd10fb72474f6736f44ac))
* **evidence:** type the inline-arm protocol as analysis, record its pre-run hash ([6e7f3fb](https://github.com/event4u-app/agent-config/commit/6e7f3fb6611dc3572ef6c5c13a3ded7e76bf990e))
* **roadmaps:** state why ledger 1.4 is exempt from the reach gate ([c542307](https://github.com/event4u-app/agent-config/commit/c542307186a046194ee363385bb2b4ecca0ef999))
* **analyze:** --transfer in the reference door's hint and one lens name ([cc23496](https://github.com/event4u-app/agent-config/commit/cc23496e7d98e081159c334aaca002b16e2b771b))
* **humanizer:** Fixture 4 shows a rewrite that reads better and is false ([3f3165b](https://github.com/event4u-app/agent-config/commit/3f3165b0e53d29481ebaa723d320a31236888043))
* **roadmaps:** close and archive a run the invocation already answered ([a48dab0](https://github.com/event4u-app/agent-config/commit/a48dab0ca0c370de1eaa079bb0f11ed8a653e6e1))
* **roadmaps:** receipt and production entry for verdicts 1.1 ([f7ee8fa](https://github.com/event4u-app/agent-config/commit/f7ee8fa4d9ba7eef4e2317746807706c6e557df0))
* **roadmaps:** put the step receipts on the step line ([f0c430c](https://github.com/event4u-app/agent-config/commit/f0c430c2f3b54ab9f1234518a9939a782c67ed4b))
* **evidence:** rerun the nine canary regressions at three runs; carry the three stable ones ([3fa312b](https://github.com/event4u-app/agent-config/commit/3fa312bd6bb924f783e93588b04f50fc19f7d585))
* **roadmaps:** close the planning decisions of round inbox-2026-11-u ([d235291](https://github.com/event4u-app/agent-config/commit/d235291dd7d3f834476c6044eb7c5725b99fb8d7))
* **roadmaps:** oracle arrows the verify grammar parses ([8833691](https://github.com/event4u-app/agent-config/commit/8833691a43eec27dd7467e19fe7163f583ae14f5))
* **roadmaps:** relates rows and checkable verify clauses for round inbox-2026-11-u ([56ad577](https://github.com/event4u-app/agent-config/commit/56ad57702c02ca2ac703001f9352e9c81c6dd665))
* **roadmaps:** a run the invocation already answered (inbox-2026-11-v) ([8158729](https://github.com/event4u-app/agent-config/commit/815872930248c9935e1406d69122c7563455cac1))
* **evidence:** the first routing canary classified against the baseline; tick 5.3 ([dbe5776](https://github.com/event4u-app/agent-config/commit/dbe5776a581063d95c6bb2429d4d77d8be4ead79))
* **roadmaps:** land round inbox-2026-11-u — three roadmaps and four arrivals ([17870a5](https://github.com/event4u-app/agent-config/commit/17870a523b26b848a958da1ee19b96c3930805ec))
* **evidence:** pre-register the inline-top-body MCP arm before it runs ([c45936a](https://github.com/event4u-app/agent-config/commit/c45936af3b07afd5f231aad010bf8aa5faf8f111))
* **roadmap:** close and archive road-to-a-page-check-at-write-time ([a706dd6](https://github.com/event4u-app/agent-config/commit/a706dd622bed675ada398da4ea758e0a901080c1))
* **evidence:** ratification prompt for the hook-bundle ceiling raise ([9c8f378](https://github.com/event4u-app/agent-config/commit/9c8f378fe359672b5c7bc1609df42752b1160ba4))
* **ratification:** record the council verdict on the trunk-repair bundle raise ([e9b8e67](https://github.com/event4u-app/agent-config/commit/e9b8e67b1e451839d5e486f2f1c13333a6023bf9))
* **council:** round-2 prompt for the trunk-repair bundle raise ([0ef64fd](https://github.com/event4u-app/agent-config/commit/0ef64fd82faff2a2c4b00e80f9d6396c335fda5d))
* **ratification:** pin the subject digest ([3f5524e](https://github.com/event4u-app/agent-config/commit/3f5524e3258c4436e03b7656530c6250d32accbf))
* **ratification:** the bundle ceiling raise of fix/steady-roi-freeze ([e1f5667](https://github.com/event4u-app/agent-config/commit/e1f5667455bb7f823499e49bdd545d9a8b1c74a9))
* **council:** ratification prompt for the trunk-repair bundle raise ([48a2965](https://github.com/event4u-app/agent-config/commit/48a2965bf60b07010cc91e5a183856f7c9de8256))
* **roadmap:** record owner answers on game engine and gamedev pack ([a82068e](https://github.com/event4u-app/agent-config/commit/a82068ee0452006bc40cba44f7b4cb1e665ac239))
* **ratification:** ratify the gated diff including the bundle ceiling raise ([510e7d0](https://github.com/event4u-app/agent-config/commit/510e7d04c9ebeb5c4adcdeec1b267295195e83e9))
* **hooks:** say where a refusal stops — mods and host switches ([5c03f8f](https://github.com/event4u-app/agent-config/commit/5c03f8fd279e95656a2adf5d35bab46f06bcbb19))
* **roadmaps:** stub the ROI freeze case that fails only on the CI runner ([6d80b6f](https://github.com/event4u-app/agent-config/commit/6d80b6f0a5a4a037fc56eb26b0e6ca0dd2e114cd))
* **roadmaps:** verify clauses carry an expectation that can fail ([af6b1bc](https://github.com/event4u-app/agent-config/commit/af6b1bc6ed2485d7c780965c935dfe2f152f1a31))
* **roadmaps:** record why four ticked steps are reached outside a TypeScript import ([3c98a01](https://github.com/event4u-app/agent-config/commit/3c98a013eb3c8a14f2b49696263db0c96fc6e56d))
* **roadmaps:** receipt for 4.1 at full depth ([fc6115f](https://github.com/event4u-app/agent-config/commit/fc6115f50e24f2068a975959673330e79bf588af))
* **roadmaps:** step receipts for the archived inbox-2026-11-q/-r roadmaps ([e6be28f](https://github.com/event4u-app/agent-config/commit/e6be28f6d479fc15d64afd38ef7799b8ecc00dd5))
* **evidence:** type the council prompts as analysis ([8ca31da](https://github.com/event4u-app/agent-config/commit/8ca31da6784152df297deecac0de04228e049730))
* **evidence:** ratification record for the likeness-rule trigger (council, 2 providers, confirmed-non-expanding) ([8b16424](https://github.com/event4u-app/agent-config/commit/8b16424187490b476bd8a7435b42cf171e634100))
* **evidence:** council prompt round 3 with the stance format the record reader parses ([94436f5](https://github.com/event4u-app/agent-config/commit/94436f59fe8ecee1a9427031d4f8ebbdfa880a73))
* **evidence:** council prompt round 2 for the likeness trigger ([02ff325](https://github.com/event4u-app/agent-config/commit/02ff32592a642fd89332af5dedfdd156e6bc1a53))
* **auto-learnings:** analyse 100 sessions of user friction and plan the fixes ([733b081](https://github.com/event4u-app/agent-config/commit/733b081abc7c2b0935528df48edddfaf2437b3d2))
* **evidence:** council prompt for the likeness-rule trigger ratification ([35b03c1](https://github.com/event4u-app/agent-config/commit/35b03c1abbc0209ed89f776e3da3e02b11826736))
* **roadmaps:** fold the media remainder into the witness roadmap that owns it; regenerate owned digest ([9a92773](https://github.com/event4u-app/agent-config/commit/9a92773f27741247b0755fb2685b52ecc0cb858c))
* **evidence:** type the two rename archive notes ([68b52af](https://github.com/event4u-app/agent-config/commit/68b52af9385062be5dadffe4f312821dbefe5e85))
* **ratification:** re-ratify the gated diff after the schema version bump ([f98401b](https://github.com/event4u-app/agent-config/commit/f98401b99c0773d4d6481d3bf25b7c89b6832d9c))
* **roadmaps:** close and archive the inbox-2026-11-q/-r roadmaps; arrivals on existing owners; owner directive ([c704e80](https://github.com/event4u-app/agent-config/commit/c704e80d13dce37af84cd0fc25956510f14d6964))
* **evidence:** round-14 ratification record with the owner decision; close step 1.1, carry data-src as 2.1 ([740ef7c](https://github.com/event4u-app/agent-config/commit/740ef7cebd30b2790fca4f594dd3ef285d22dbc3))
* **roadmaps:** inbox-2026-11-q/-r — two active roadmaps, two parked remainders ([a1d608d](https://github.com/event4u-app/agent-config/commit/a1d608d1e0f31783d64105c43e82ee6923c12be0))
* **evidence:** round-14 ratification prompt for the web-launch write-time carrier ([2d129f6](https://github.com/event4u-app/agent-config/commit/2d129f6f6ed7cda49892d42fa3a63c539795a189))
* **evidence:** record the owner directive for round inbox-2026-11-p ([29f26d8](https://github.com/event4u-app/agent-config/commit/29f26d8ee6423b62b9165625d20038f0969d6b8a))
* **skills:** stop claiming checks no script performs ([519e7b3](https://github.com/event4u-app/agent-config/commit/519e7b3afc1f06aa6d71d4593bba0bf63eef8370))
* **roadmaps:** inbox-2026-11-p — three media-verification roadmaps and their later/ residue ([abcd916](https://github.com/event4u-app/agent-config/commit/abcd91620682d67ddb3a8b43fb327afe09e085a3))
* **roadmaps:** carry the reverted floor tags into a parked roadmap ([d78cae3](https://github.com/event4u-app/agent-config/commit/d78cae3e2d7e8155c68beee888b55037c0ef60c0))
* **council:** round-13 ratification prompt after main absorbed the raise ([242039c](https://github.com/event4u-app/agent-config/commit/242039c5afa77e808c1138464cb56d25cbeb70ba))
* **roadmaps:** record the owner's answers to Q1 and Q2 of road-to-generated-files-and-unattended-asks ([220ea8c](https://github.com/event4u-app/agent-config/commit/220ea8cdc0830e2b6584a2d60c0bbad65c74892f))
* **evidence:** bind the ratification to the final gated subject ([5aacc72](https://github.com/event4u-app/agent-config/commit/5aacc722a5ce5e4ef623be9a5871833134f956f4))
* **evidence:** ratification over the final gated diff ([8e3018a](https://github.com/event4u-app/agent-config/commit/8e3018a7be357e290b574c0d5908f80ca33bc60b))
* **evidence:** ratification record for round 12, with the owner's decision on the split ([97c3b27](https://github.com/event4u-app/agent-config/commit/97c3b27871dcae9f533431956b429bc40ea75573))
* **council:** round-12 ratification prompt, feature only after the split ([310122e](https://github.com/event4u-app/agent-config/commit/310122e91e615045a5fe8ae9af340d135ec1b631))
* **roadmaps:** declare production reach for the inbox-2026-11-n steps ([9ecb37a](https://github.com/event4u-app/agent-config/commit/9ecb37a87ece3914edf687f4f8153d33aa15bdfa))
* **roadmaps:** receipts on the tick lines ([6c4700d](https://github.com/event4u-app/agent-config/commit/6c4700d96343a751b5687393c53d7e5c42b8ceb5))
* **roadmaps:** receipts and verify expectations for road-to-a-strike-the-session-keeps ([0bd070e](https://github.com/event4u-app/agent-config/commit/0bd070e8ec2061ef64f48180f10378baad561e8a))
* **roadmaps:** receipts at full depth where the diff does not allow a lowered one ([1463b2e](https://github.com/event4u-app/agent-config/commit/1463b2e508a211ac59fce685d402ef55eb439565))
* **roadmaps:** step receipts for the eight inbox-2026-11-n roadmaps ([2e3b5ec](https://github.com/event4u-app/agent-config/commit/2e3b5ec0dc1129f0f9de93487085299f32b85df1))
* **evidence:** ratification record for the strike-ledger bundle raise ([355d9ff](https://github.com/event4u-app/agent-config/commit/355d9ff7d5e27abab461c34e69875e203a98533e))
* **evidence:** rebind the ratification to the reviewed subject ([9bc7916](https://github.com/event4u-app/agent-config/commit/9bc791636976c8af9bd18d48c9391e521de591a0))
* **evidence:** bind the ratification to its subject digest ([fe6f24d](https://github.com/event4u-app/agent-config/commit/fe6f24d0a778ca5ffb778429d9586b62292f8341))
* **evidence:** ratification record for round inbox-2026-11-n ([a4578bb](https://github.com/event4u-app/agent-config/commit/a4578bb233be9df248d6164fb197623452da6321))
* **roadmaps:** close road-to-a-name-no-host-already-owns and land its arrivals ([71e03a9](https://github.com/event4u-app/agent-config/commit/71e03a93cb7f7f41c9408264609e114399227a56))
* **evidence:** note the URL-render request guard in the council disposition ([c2d8587](https://github.com/event4u-app/agent-config/commit/c2d85873d234f50991fef3b51ae37448318b7677))
* **roadmaps:** close and archive road-to-design-inputs-and-pages-read-as-they-are ([eebb485](https://github.com/event4u-app/agent-config/commit/eebb48508b83d58082710f870effc5a3ea6b96ad))
* **evidence:** record the council disposition of round inbox-2026-11-n ([8928d5a](https://github.com/event4u-app/agent-config/commit/8928d5af582ef3d30ef15784310b1a318384e979))
* **roadmaps:** archive road-to-boundaries-that-hold-at-release-and-runtime ([c7a3e74](https://github.com/event4u-app/agent-config/commit/c7a3e74ffd0e4ca7ae557c915028e213f12992dc))
* **roadmaps:** give three parked roadmaps their wake condition ([ff3f9b0](https://github.com/event4u-app/agent-config/commit/ff3f9b0e2bf32ddcab1ded529859d84142a638b9))
* **council:** round-11 ratification prompt for the web-launch write-time carrier ([b55df27](https://github.com/event4u-app/agent-config/commit/b55df2721cb12abdfe1b428b03e5ab6b91bcd3a5))
* **roadmaps:** close and archive road-to-a-green-that-saw-what-it-certifies ([f27e5b6](https://github.com/event4u-app/agent-config/commit/f27e5b67c26587d345482d2a4f7ba429fd1e34bb))
* **skills:** github-ci teaches the workflow security rules, project-neutral ([c7270b4](https://github.com/event4u-app/agent-config/commit/c7270b4a153cecc45ac59ae56e45e4aa5158f003))
* **roadmaps:** archive road-to-a-record-that-says-what-it-lost, every step landed ([850b6f0](https://github.com/event4u-app/agent-config/commit/850b6f0c465554412772f2a13ba23a5e5d0b618c))
* **accessibility-auditor:** carry the WCAG 2.1 A/AA criteria a 2.2 claim covers ([6ffca73](https://github.com/event4u-app/agent-config/commit/6ffca73d074bdd75fb779ee8d98a16727660efaf))
* **evidence:** inventory the steps a merge queue would skip ([4e6bc55](https://github.com/event4u-app/agent-config/commit/4e6bc55e05d1e3b29fac1095f6098ed3ea32082e))
* **release:** bind the pre-cut gate to the run it dispatched ([e5646f5](https://github.com/event4u-app/agent-config/commit/e5646f5787cfcceeadac2cc6ea88bb256b5b9df2))
* **skills:** one confidence vocabulary, and review replies record the reproduction ([3c274ed](https://github.com/event4u-app/agent-config/commit/3c274ed4a6f21bb4fbc33ac9659fb84dc7c23366))
* **evidence:** give the six replay-outlier dispositions an expected outcome ([29e70a3](https://github.com/event4u-app/agent-config/commit/29e70a340ae6c526a13795531fdfece0f266c01d))
* **roadmaps:** conform the inbox-2026-11-n roadmaps to the roadmap lints ([7029e41](https://github.com/event4u-app/agent-config/commit/7029e41c594831cdd1844a1718eb3a6795e52885))
* **evidence:** type the 2026-11-03 owner directive ([7949a17](https://github.com/event4u-app/agent-config/commit/7949a179d2d277b4a6329fc93d35f5617a2f77f4))
* **roadmaps:** land the eight roadmaps of round inbox-2026-11-n ([39b1cca](https://github.com/event4u-app/agent-config/commit/39b1cca65e9aae7320b42b518c950c384732f9ed))
* **roadmaps:** flip phase 1 and 2.0 of road-to-a-strike-the-session-keeps ([75db0e6](https://github.com/event4u-app/agent-config/commit/75db0e6630ad5345f31ea0dafbb4bf67c8590fd7))
* **roadmaps:** strike counter for the fix-loop ladder (inbox-2026-11-m) ([83468a4](https://github.com/event4u-app/agent-config/commit/83468a426859be7ba9f2bc6f52ae1c352c09ac20))
* **council:** fit the round-10 prompt to the bundle ceiling, owner-set scope ([5b18c79](https://github.com/event4u-app/agent-config/commit/5b18c79117263cdefdc40ef914727bc2dce37975))
* **roadmaps:** a verify clause that can say no ([9f0e323](https://github.com/event4u-app/agent-config/commit/9f0e323f81e8cafa3346ff36f1e2bf8b485ee109))
* **roadmaps:** range receipts for the doc steps, reach exemptions for two re-exported symbols ([8b7ef25](https://github.com/event4u-app/agent-config/commit/8b7ef25e81561246f20ba2c8eb30a3a78ce04bbd))
* **roadmaps:** step receipts and falsifiable verify clauses for the profile roadmap ([5381ec4](https://github.com/event4u-app/agent-config/commit/5381ec4dabff30bddf8da9b8ab898f0db3c1fce3))
* **roadmaps:** fourth arrival of the stale youtube reach date ([8103af3](https://github.com/event4u-app/agent-config/commit/8103af3f3c8a65b7eba4e2b49fa589143ebb1b57))
* **roadmaps:** archive road-to-a-founder-interview-that-ends-in-a-plan ([cd29c34](https://github.com/event4u-app/agent-config/commit/cd29c34bb9c9679333f8d6f9c49ec5d501a92d04))
* **roadmaps:** close the founder-interview roadmap with step receipts ([a060097](https://github.com/event4u-app/agent-config/commit/a060097f1dc8007612c70bf4fe59f025f2fe41c1))
* **council:** round-10 ratification prompt for the web-launch write-time carrier ([0c3db12](https://github.com/event4u-app/agent-config/commit/0c3db12f0652ad2479a6197ee512f767a2849e10))
* **maintainers:** regenerate the doc-path inventory for session-list.md ([0eac051](https://github.com/event4u-app/agent-config/commit/0eac051c7f950b125663d4e4606e15626647da63))
* **ratifications:** two-provider review of the inbox-2026-11-l hook-bundle raise ([db43d5c](https://github.com/event4u-app/agent-config/commit/db43d5cead02a718f78c0a87b18e930ccabc1f0d))
* **council:** ratification prompt for the inbox-2026-11-l hook-bundle raise ([9571fd0](https://github.com/event4u-app/agent-config/commit/9571fd037106ee82ef22e43a4879e87e3c077e25))
* **agent-switch:** what AC guarantees under a profile, and what it never does ([4e23005](https://github.com/event4u-app/agent-config/commit/4e23005ef44e141a37dbce951a4534656230d273))
* **roadmaps:** archive road-to-a-grade-that-saw-the-evidence ([33bc24d](https://github.com/event4u-app/agent-config/commit/33bc24d89fdfd2927109833b46f046328c45e9aa))
* **roadmaps:** step receipts for the grader fix and the AC resolver ([ddea6b8](https://github.com/event4u-app/agent-config/commit/ddea6b8a59cff2b90ca0d32899073b95135faae7))
* **roadmaps:** archive road-to-gates-that-see-what-is-there ([9e7e8ab](https://github.com/event4u-app/agent-config/commit/9e7e8ab4448ef043120ff536b360e31f3538d541))
* **roadmaps:** add step receipts to road-to-gates-that-see-what-is-there ([2406dad](https://github.com/event4u-app/agent-config/commit/2406dadfe71ac623ce75cad1f56a6dcdda561bc5))
* **readiness:** registry, fixtures and /project:analyze name the evidence the contract probe needs ([35558e6](https://github.com/event4u-app/agent-config/commit/35558e6a9d1c5f66c439324c793923a15733f7de))
* **roadmaps:** plan the founder interview behind /challenge-me founder ([fc894b1](https://github.com/event4u-app/agent-config/commit/fc894b1f90980a64c11042319bffc840846e74a4))
* **roadmaps:** plan the readiness-grader fix and the report-only AC resolver (OQ-63 a) ([2ec0fb6](https://github.com/event4u-app/agent-config/commit/2ec0fb6afbe712963e8eb6e46feff85c06338a47))
* **roadmaps:** plan E2 and E9 from owner decision OQ-62 ([edbb7fd](https://github.com/event4u-app/agent-config/commit/edbb7fd6f8de5b875999d115df921eca22b228bb))
* **owner-questions:** record answers to OQ-61, OQ-62, OQ-63 ([9b358fc](https://github.com/event4u-app/agent-config/commit/9b358fce8893596d59d5671e10acd7d1137b2284))
* **roadmaps:** record the council's decisions on the inbox-2026-11-k owner questions ([a1911d6](https://github.com/event4u-app/agent-config/commit/a1911d6d341a7987ab9eb95c58ca908e0ed375f1))
* **roadmaps:** fourth arrival of the red local gates on main ([bf4fc5a](https://github.com/event4u-app/agent-config/commit/bf4fc5a3c0f1e6ecd740e2f99f3e8db2bf3e022a))
* **roadmaps:** third arrival of the stale youtube reach date, posed to the owner ([13745e3](https://github.com/event4u-app/agent-config/commit/13745e3d41e94f022176bc2ff3811a28a6362d14))
* **roadmaps:** inbox-2026-11-k — film witness landed, video and voice arrivals carried ([1e29422](https://github.com/event4u-app/agent-config/commit/1e29422d1dac1ae4b7cf5f17a73ca36c80d2f593))
* **skills:** motion-prompt locks and segments, plugin intake, two drift fixes ([eb7cb2a](https://github.com/event4u-app/agent-config/commit/eb7cb2a925c41c6a457e3c6d6d3c918f9b18ca6e))
* **evidence:** ratification prompt, round 9, with the round-8 dispositions ([c75353f](https://github.com/event4u-app/agent-config/commit/c75353f3e96f7861562799a459ef414d7ed8be3e))
* **evidence:** ratification prompt, round 8, with the dispatch-ceiling raise ([ab55cc8](https://github.com/event4u-app/agent-config/commit/ab55cc87345cb915cbe62f53b6f7990922aab30c))
* **roadmaps:** receipts and falsifiable verify clauses on both archived roadmaps ([2d55a6f](https://github.com/event4u-app/agent-config/commit/2d55a6fd7e475eca5602ead91c9c70d6970c6e6e))
* **roadmaps:** close and archive both inbox-2026-11-i roadmaps; carry owner decisions as OQ-61..63 ([ad19a82](https://github.com/event4u-app/agent-config/commit/ad19a821ceea1ecdb868fe18898c0748d5301b62))
* **roadmaps:** inbox-2026-11-j — two peer comparisons, landed and carried ([bffa081](https://github.com/event4u-app/agent-config/commit/bffa0811516a76ea60b9cc4518c91a8274bdc281))
* **roadmaps:** two roadmaps from inbox-2026-11-i ([131fbd4](https://github.com/event4u-app/agent-config/commit/131fbd412e8d5dd5a5859fe9757ab15d840b058f))
* **evidence:** ratification record for the web-launch write-time carrier ([714bc21](https://github.com/event4u-app/agent-config/commit/714bc2183a9125428c1361ff539bed6289ae9fde))
* **evidence:** ratification prompt, round 7, for the web-launch write-time carrier ([6380bdd](https://github.com/event4u-app/agent-config/commit/6380bdd69ae8c2ce041035518a65a6376eb3d4e4))
* **roadmaps:** road-to-checks-that-name-their-catch, done and archived ([45011c4](https://github.com/event4u-app/agent-config/commit/45011c4238e6f7c827db7fd7251beb01eff8e484))
* **evidence:** ratification prompt, round 6, for the web-launch write-time carrier ([1171e27](https://github.com/event4u-app/agent-config/commit/1171e274391adbf6e332019deee78087fd25107d))
* **evidence:** ratification prompt, round 5, for the web-launch write-time carrier ([3edcc7f](https://github.com/event4u-app/agent-config/commit/3edcc7f6c2760ee98b73ecdfae2f3abca6e0542c))
* **evidence:** ratification prompt, round 4, for the web-launch write-time carrier ([9a7ce98](https://github.com/event4u-app/agent-config/commit/9a7ce98d3c98fafd5f7c180d887fe2083b92f365))
* **evidence:** ratification prompt, round 3, for the web-launch write-time carrier ([6180cb6](https://github.com/event4u-app/agent-config/commit/6180cb6d677c61fdc92d147f92e11a58b6dfc864))
* **evidence:** ratification prompt, round 2, for the web-launch write-time carrier ([63578ee](https://github.com/event4u-app/agent-config/commit/63578ee99904176f752a086bbe67c2c86f171f9f))
* **evidence:** ratification prompt for the web-launch write-time carrier ([9e4d4fb](https://github.com/event4u-app/agent-config/commit/9e4d4fb3cad4e80885edde9c49e46ced89cd710b))
* **roadmaps:** annotate the 4.2 carry and its back-link ([fd7c8e3](https://github.com/event4u-app/agent-config/commit/fd7c8e344c2c9d2ee2b5b88635d989cdeff05a09))
* **roadmaps:** step receipts on every ticked step ([1dbf4be](https://github.com/event4u-app/agent-config/commit/1dbf4be2464c6e65c9706a6402b9f2b3cfad3ba6))
* **readme:** put the Glama and MCP Toplist badges back into the top badge row ([997ad56](https://github.com/event4u-app/agent-config/commit/997ad56666868260b7b9869ccb990cc99c0e2190))
* **roadmaps:** record the cloud-delivery decision, tick 5.3 and 5.4 ([91d2b0d](https://github.com/event4u-app/agent-config/commit/91d2b0dbec8004224af0dce7e306559395353309))
* **setup:** how to carry agent-config hooks into cloud sessions ([d4c96f6](https://github.com/event4u-app/agent-config/commit/d4c96f64143eaf79c44eb88ac3c3557556462116))
* **roadmaps:** record the real bundle headroom on the write-time blocker ([1e6e1b2](https://github.com/event4u-app/agent-config/commit/1e6e1b25153a917ea110e54dc2664c1e8f9a4546))
* **evidence:** ratification prompt for the hook-bundle budget raise ([0f44d2b](https://github.com/event4u-app/agent-config/commit/0f44d2b135ad81df278e2d20d05122c9ab32295b))
* **roadmaps:** name the clone probe as its step's production entry ([67d2732](https://github.com/event4u-app/agent-config/commit/67d273229da8fdd42529892681e3e8c96b2941a4))
* **ratifications:** round 3 record for the compacted settings-ask-protocol text ([cc4ee52](https://github.com/event4u-app/agent-config/commit/cc4ee528c8945df582f26dd4734b26f21bb5c7d9))
* **evidence:** type the owned-digest council record ([a2ef35e](https://github.com/event4u-app/agent-config/commit/a2ef35e9b192532f25d81e7484e37e5d1da6706c))
* **council:** round 3 review prompt for the compacted settings-ask-protocol text ([9634cdc](https://github.com/event4u-app/agent-config/commit/9634cdc397ef25e0d310433f42d91d90e7a945ca))
* **security-audit:** the plan-offer note lives in the blueprint, not in feature-planning ([541e765](https://github.com/event4u-app/agent-config/commit/541e765e9afdea4cd3da31088f6f5c4a07721267))
* **roadmaps:** third arrival of the red local ci steps on main ([c99b98c](https://github.com/event4u-app/agent-config/commit/c99b98c04ba0324081e7ce533aead5851d684afe))
* **roadmaps:** one more verify clause in the gate's form ([01b15bf](https://github.com/event4u-app/agent-config/commit/01b15bf0ad4364ebb09f18e1212bad701587667a))
* **roadmaps:** verify clauses in the expectation form the gate reads ([3e8a884](https://github.com/event4u-app/agent-config/commit/3e8a88424149ddc3592394a5b5f90d998a4356a4))
* **roadmaps:** step receipts, falsifiable verify clauses, carry back-link ([e8d4d7e](https://github.com/event4u-app/agent-config/commit/e8d4d7e500459032f5b37f8a313a008c8d1f15bb))
* **roadmaps:** second arrival of the stale youtube reach channel ([0a29a8f](https://github.com/event4u-app/agent-config/commit/0a29a8f7a45d1ab548ab49c69fad2d43fa6565bc))
* **evidence:** council ratification of the hook-bundle budget raise ([996cf17](https://github.com/event4u-app/agent-config/commit/996cf17a76805bb8199143e1520eb4b84a93461b))
* **roadmaps:** record the two decisions the closure scan surfaced ([c97cb55](https://github.com/event4u-app/agent-config/commit/c97cb55b285a332af8da95f04d5aab59fb75610f))
* **roadmaps:** archive road-to-a-page-that-says-what-it-loads — every step closed ([9994aad](https://github.com/event4u-app/agent-config/commit/9994aad3cfa33040fda22b4d86268e373b9efda6))
* **ratifications:** two-provider review of the security_ops.plan class-B key ([2d602b3](https://github.com/event4u-app/agent-config/commit/2d602b3ba28edc978d944885cbfd2bc8893b1e15))
* **roadmaps:** land deferred cloud-delivery steps on the host-inputs owner ([a0c6af3](https://github.com/event4u-app/agent-config/commit/a0c6af356c62bea9781c0286c5492f9bd037ec8f))
* **roadmaps:** cloud-clone install roadmap, baseline, deferred delivery parked ([1bece8d](https://github.com/event4u-app/agent-config/commit/1bece8d13a750410f3ceb102c31eab703a69a220))
* **setup:** what a Claude Code cloud session receives ([3d31bf8](https://github.com/event4u-app/agent-config/commit/3d31bf8e3189d0baaf501af12a078c2023a42a65))
* **council:** round 2 review prompt for the security_ops.plan class-B key ([a30c388](https://github.com/event4u-app/agent-config/commit/a30c38895c4bec81b17999bd73b3ad8adfa60d7b))
* **roadmaps:** third-party loads and legal-page rows from inbox-2026-11-g ([90fb0ec](https://github.com/event4u-app/agent-config/commit/90fb0ec65170cb370a6037e960d89820e30850af))
* **council:** ratification review prompt for the security_ops.plan class-B key ([68862d4](https://github.com/event4u-app/agent-config/commit/68862d47fc5783fb91ba80c3cf239fbdc7e1e205))
* **decisions:** record the owner's answers to OQ-59 and OQ-60 ([9aa8a88](https://github.com/event4u-app/agent-config/commit/9aa8a8890ccffda2bae59bfb8809133c806ae5f1))
* **evidence:** record the owner decision on the gallery-prompt import ([0361164](https://github.com/event4u-app/agent-config/commit/0361164127633c469cfef7e70ee99078fb66492e))
* **roadmaps:** falsifiable verify clauses in road-to-a-film-built-from-time ([69782be](https://github.com/event4u-app/agent-config/commit/69782be943ffacffe919e15439d6f40c59cad3b6))
* **roadmaps:** claim the code-film skill growth where it happened ([aca0520](https://github.com/event4u-app/agent-config/commit/aca0520e3ce027596a802f33f917b6035e8f4ef3))
* **roadmaps:** extend the reach exemption to steps 6.1 and 6.2 ([ba41b66](https://github.com/event4u-app/agent-config/commit/ba41b6627f7b5d21fa9563e93b370e1489d75b9e))
* **roadmaps:** record the production-reach exemption for the film steps ([5578a77](https://github.com/event4u-app/agent-config/commit/5578a77e875f6b4e2c4e40d436c321865c693aaf))
* **roadmaps:** step receipts for road-to-a-film-built-from-time ([b9bf7b7](https://github.com/event4u-app/agent-config/commit/b9bf7b7b4a6b3f74fc56f47822cde9efb9e864c5))
* **roadmaps:** archive road-to-a-film-built-from-time; carry its follow-on as breadth-with-depth 5.3a ([409a2b3](https://github.com/event4u-app/agent-config/commit/409a2b3ca7ecd10c25925d50145304474bb8fc28))
* **evidence:** type the inbox-2026-11-e disposition as analysis ([8ff8936](https://github.com/event4u-app/agent-config/commit/8ff8936cec89f3eaf5d47265f1155f6c014fff89))
* **roadmaps:** code-rendered film roadmaps from inbox round inbox-2026-11-e ([0138cf9](https://github.com/event4u-app/agent-config/commit/0138cf9ee6b3c72b1a5bc9a4207f55bfef6747a1))
* **roadmaps:** archive the two inbox-2026-11-s roadmaps, both complete ([0c937e2](https://github.com/event4u-app/agent-config/commit/0c937e25de7ccac8e36beb842cf19cc3740f936b))
* **security:** ADR-304 and the containment blueprint across planning and review ([fb34cee](https://github.com/event4u-app/agent-config/commit/fb34cee04a4a6fb0b4875403444e152a6d7c30ea))
* **roadmaps:** close road-to-a-clean-that-says-what-it-checked steps and record arrivals ([8268e73](https://github.com/event4u-app/agent-config/commit/8268e73825127f940cd142281965954c6b3c5858))
* **security:** judges carry coverage, threat models persist ([c010460](https://github.com/event4u-app/agent-config/commit/c010460bb05b90f1b309243f833aa9ef2fb0887d))
* **roadmaps:** two security roadmaps from inbox round inbox-2026-11-s ([622363b](https://github.com/event4u-app/agent-config/commit/622363b32b9faec8531126a117c5abd701bd4c23))
* **readme:** put the artifact-count badges back under the other badges ([bc754f2](https://github.com/event4u-app/agent-config/commit/bc754f24046786f5d766e248753d181d3482146e))
* embed the demo map captures and the setup wizard strip ([6a69cd6](https://github.com/event4u-app/agent-config/commit/6a69cd6f04414ddfbda51faa9791251cad6304d0))
* **readme:** act on the independent read — truthful sub-line and caption, cost strip on the first screen, less jargon and repetition ([5bd4a1c](https://github.com/event4u-app/agent-config/commit/5bd4a1c02c31e049aea3a2ef0820b849fa60ba48))
* **readme:** rewrite the README around the new one-liner, honest cost and tool facts, with deep links to the site ([25002c7](https://github.com/event4u-app/agent-config/commit/25002c76699dbb82bc6137bb44fec28d146896b8))
* **claims:** say which of the 20 hosts init writes and that the Copilot plugin is discovery-only ([8030f6a](https://github.com/event4u-app/agent-config/commit/8030f6a253b8d4dfb725c92306475dc3c30c4f94))
* consolidate duplicate clusters, move maintainer records, fix install scope, host facts, uninstall and network pages ([3e86fb4](https://github.com/event4u-app/agent-config/commit/3e86fb45cd78af6111a440d5464349b552ed9d53))
* **maintainers:** message house and docs voice guide ([235effb](https://github.com/event4u-app/agent-config/commit/235effbc556e008a5b4938f1e6c4f5ad63910f49))
* **decisions:** rulings 0.2–0.8 for the docs rewrite ([540660c](https://github.com/event4u-app/agent-config/commit/540660cb57f8949d8dd6befa139556ef1d94424f))
* **evidence:** owner directive to activate road-to-docs-that-sell ([d81a215](https://github.com/event4u-app/agent-config/commit/d81a215ff6163e365d86a2d3a328ee61302b72f0))
* **roadmaps:** park road-to-docs-that-sell ([82f9390](https://github.com/event4u-app/agent-config/commit/82f9390d129415475fe3d752cab754ce09a39ce7))

### Refactoring

* **web-launch:** head checks beside the gate, inside the source-size budget ([85ef498](https://github.com/event4u-app/agent-config/commit/85ef49838b49d1c5082f7c273b1b2557d10df923))
* **claims:** move the stale last_verified check into its own lib ([0fb2c09](https://github.com/event4u-app/agent-config/commit/0fb2c09bdcabd6d67d3e96b2644d1c2d28a1b0bf))
* **web-launch:** one start-tag reader shared by the gate and the third-party pass ([db8a8a8](https://github.com/event4u-app/agent-config/commit/db8a8a894f591a96b27cf3c9ece344647b5246c6))
* **surface-matrix:** ac-owned-settings-block replaces managed-settings-block ([2156b69](https://github.com/event4u-app/agent-config/commit/2156b69de8b39ffe135a5b943c716a64b9a2993d))
* keep the three grown scripts under the source size ceiling ([ad63020](https://github.com/event4u-app/agent-config/commit/ad63020d3536987887056816c19f21f0dad2b32a))
* **strike-ledger:** fold the two identical green branches, share the platform pattern ([da393fc](https://github.com/event4u-app/agent-config/commit/da393fcc8b01de0f4953f4f157ef2b408bd7253c))
* **doctor:** move the cloud-reach repair glue into cloud_carry ([575d5bb](https://github.com/event4u-app/agent-config/commit/575d5bb99781da6d8427813f1a32e7bfc604e96e))
* **hooks:** extract loadChunkExport from the SVG chunk loader ([92f3340](https://github.com/event4u-app/agent-config/commit/92f334078eecf5152d6c0d6e61ea5b2adb312ce3))
* **claims:** move the site sweep into its own module and tighten the size ratchet ([5cb683b](https://github.com/event4u-app/agent-config/commit/5cb683b44e6cc10fbc2066b693df5bbc852ce694))

### Tests

* **humanizer:** pin the witness ratchet's sensitivity to exactly one ([8d5e600](https://github.com/event4u-app/agent-config/commit/8d5e600004661eb5ac71f9b95c7cba774e70f11f))
* **humanizer:** satisfy strict index access in the Fixture 4 parser ([d22e85f](https://github.com/event4u-app/agent-config/commit/d22e85f4daa39a922c4782efd34fabe25adc7a58))
* **web-launch:** form-variant fixtures the gate reads by form, red at the pin ([fb3bd64](https://github.com/event4u-app/agent-config/commit/fb3bd647a5365467cc4ac1cc443b903c9cb61de8))
* **humanizer:** ratchet the corpus's supplied-number count ([6c28c53](https://github.com/event4u-app/agent-config/commit/6c28c538b9be032c5d9fa975f12c375233d0cbec))
* **media:** a narrow ROI flush against motion, on a lossless clip (expected red on x86) ([006cc8b](https://github.com/event4u-app/agent-config/commit/006cc8b370f9bbe3b18ea1098799488db332f1c9))
* **media:** name the measured ROI readings when the frozen-region assertion fails ([591a732](https://github.com/event4u-app/agent-config/commit/591a732b487c886678f793b4f6271e4f58ab807a))
* **layout:** pin the auto-learnings-1 whitelist entry and reject an unregistered round ([9e0d130](https://github.com/event4u-app/agent-config/commit/9e0d130db0c3cf69377026fa5c4f2d9a4eeb95fa))
* **skills:** German exemplar in the character-consistency trigger corpus ([c612644](https://github.com/event4u-app/agent-config/commit/c612644f87ebc1bf10ca688fb55066341ff1468a))
* **skills:** trigger corpus for character-consistency, touched by this diff ([321f234](https://github.com/event4u-app/agent-config/commit/321f2344aea0df0b8162af4583920e05705cbc1b))
* **svg:** the fixture-layer report scans mark rows under --class mark ([02eceff](https://github.com/event4u-app/agent-config/commit/02eceff3ec47a5831441519ee71f47ff779efb96))
* **svg:** pre-register the mark readings and plant red/clean fixtures ([340aa8b](https://github.com/event4u-app/agent-config/commit/340aa8b09e105ef35ec73f9efced279247e8523c))
* **strike-ledger:** satisfy exactOptionalPropertyTypes in the count fixture ([e104177](https://github.com/event4u-app/agent-config/commit/e10417738fe0a6633624aeac52239570aad1b158))
* **ui:** state why the new live browser cases skip without Chromium ([ae473bb](https://github.com/event4u-app/agent-config/commit/ae473bb88b0abfb5681e7197ff759d31bc61eccb))
* **web-launch:** run the dispatch test unconditionally ([52dfad2](https://github.com/event4u-app/agent-config/commit/52dfad255633302095d61ea19a3555ad6a61f072))
* **strike-ledger:** an unwritable ledger leaves the recorder untouched; exact headroom in the raise_log ([97cfe64](https://github.com/event4u-app/agent-config/commit/97cfe64cd10c862feb555e0d58e468ae7b7e734e))
* **design-pass:** run the dispatch test unconditionally ([4737134](https://github.com/event4u-app/agent-config/commit/4737134553effc71cb79e0f9d16b10a4538cdc73))
* **corpus:** declare classes and add counterexamples to the code-review-lens corpus ([ed7442b](https://github.com/event4u-app/agent-config/commit/ed7442ba6cced7393b6bc019c9618799e9257ad8))
* **memory:** standing-command fixture for the capture guards, red first ([a748854](https://github.com/event4u-app/agent-config/commit/a748854fad90d39cf5f5886ee44151e5a2171198))
* **ui-triviality:** pre-register symptom and quality-adjective bars before the classifier change ([533e345](https://github.com/event4u-app/agent-config/commit/533e3451e67dc93f9490bfcbfb71584f45a77dbb))
* **web-launch:** visibleText equals the regex it replaced, and the cap boundary ([bc75cb1](https://github.com/event4u-app/agent-config/commit/bc75cb188ce67d80f8588c74615719c404275c49))
* **web-launch:** tagsOf line edges, and the placeholder lookahead bound ([77235bd](https://github.com/event4u-app/agent-config/commit/77235bd6998df5b3c6cd35ad36edda41a52a3670))
* **ui-render:** assert console rows and settle on the existing live capture ([faafa56](https://github.com/event4u-app/agent-config/commit/faafa56852422e60b3cca95cbdc357c8878be651))
* **web-launch:** mixed and sparse unclosed tags, and a megabyte of them ([27dba4b](https://github.com/event4u-app/agent-config/commit/27dba4bf48bd6c39924caf37d16197f19db9499f))
* **web-launch:** state the skip reason on the live witness cases; assert pages rendered ([6bb5c56](https://github.com/event4u-app/agent-config/commit/6bb5c56e8ecbad207b87f5665c6cdf8b60c88552))
* **web-launch:** closed output vocabulary for the four outward rows ([ed93edf](https://github.com/event4u-app/agent-config/commit/ed93edfc35f5640577034f88b7a4e95a54684a87))
* **web-launch:** pre-register third-party-load-finds-planted with its frozen corpus ([07b643c](https://github.com/event4u-app/agent-config/commit/07b643c298cedc1e4d79fe105e33b80b6ada8f2d))
* **film:** run the film captures in the browser job, keep the pure parts on node shards ([d352e25](https://github.com/event4u-app/agent-config/commit/d352e25cbc3cee269fdeefb795976a99e960c672))
* **film:** name the tool-absence reason on the two ffmpeg skips ([828765f](https://github.com/event4u-app/agent-config/commit/828765f2ca27f94b7b5ac0d9377c8744c053cf59))
* **module-reach:** give the two-scan stability test a 90 s timeout ([a5f5111](https://github.com/event4u-app/agent-config/commit/a5f51117b994089443aee1cdd3536028c0865ad4))

### Build

* **install:** regenerate the install bundle ([f5b4e64](https://github.com/event4u-app/agent-config/commit/f5b4e64264c6c45fe791d91b48468dd869894e40))
* **install:** regenerate dist/install for the host-config writer changes ([4be13b4](https://github.com/event4u-app/agent-config/commit/4be13b4cd0c487bd6a3c9a6daa4bd9dda4cf9719))
* regenerate the install bundle and the owned digest ([afb9ac2](https://github.com/event4u-app/agent-config/commit/afb9ac26b327861b0f46275974292358f83faa65))
* regenerate the install bundle and the owned digest after the main merge ([03c7979](https://github.com/event4u-app/agent-config/commit/03c7979900d1856944b9a456f25b71647b1ac175))
* regenerate the install bundle over the merged lanes ([beaba59](https://github.com/event4u-app/agent-config/commit/beaba598f3bf93a700b4667a47c7ffa50205b311))

### CI

* **production-reach:** run the unreached-module report and name missing modules ([2f3ba6c](https://github.com/event4u-app/agent-config/commit/2f3ba6c0700e716e4c7f242b8424ff4e1b17aae3))
* **probe:** temporary ROI freeze probe across twelve ubuntu runners ([8b0a6c9](https://github.com/event4u-app/agent-config/commit/8b0a6c99fdf098213feddd6e09c72d2ffe742b54))
* re-trigger so check_test_delta reads the test-delta-acknowledged label ([11b1757](https://github.com/event4u-app/agent-config/commit/11b175767ec809850ed9eab8b2900c7ad14b62e7))
* never cancel a merge_group run ([1ff1cff](https://github.com/event4u-app/agent-config/commit/1ff1cff8c135d7c901bb69577aaf645e12f2766b))
* **tests:** say "nothing ran" when every Tests job skipped ([3ebed39](https://github.com/event4u-app/agent-config/commit/3ebed395916698f75fece36592d8af08ec05e498))
* **rule-backstops:** run the provider-home join ratchet there, not in the ratification workflow ([8786d8f](https://github.com/event4u-app/agent-config/commit/8786d8f593209cdb732c95913167477c49e5843c))
* **consistency:** run the provider-home join ratchet in the workflow ([53fb884](https://github.com/event4u-app/agent-config/commit/53fb884ab3e9be00d64e56163aebd8b258078ab5))
* **site:** pin Node to astro's engines floor (>=22.23.4 <23) ([56aad15](https://github.com/event4u-app/agent-config/commit/56aad152c7de8e5f98d14a8a4a885295062d559a))
* **gates:** reach the new self-test and gate-contract gates from task ci ([851339b](https://github.com/event4u-app/agent-config/commit/851339b246740b4135ea3849b5c44e1864d6a794))
* **gates:** run the self-test and gate-contract steps in rule-backstops ([1829b98](https://github.com/event4u-app/agent-config/commit/1829b98bd2c2b5f58638e1fa68c3126046ea27e3))
* **rule-backstops:** check the doc path inventory remotely too ([92d8f02](https://github.com/event4u-app/agent-config/commit/92d8f0296b1681bac6d89248e22566b5170c076b))
* fix the reds on PR #2777 — comment lint, catalog links, canonical terms, large-PR file lists, moved-doc tests, restored review records ([d7d0059](https://github.com/event4u-app/agent-config/commit/d7d0059d5ba540473d742e3b49e638cc6457ed76))
* **docs:** site CI sees docs, relative links and fragments are checked, site figures need a claim, doc-path inventory ([1693144](https://github.com/event4u-app/agent-config/commit/1693144c485373f8c88e1850348f4b67028f91fb))

### Chores

* **ownership:** regenerate the matrix for the new council records ([b5e0c92](https://github.com/event4u-app/agent-config/commit/b5e0c92154d999413a817acc278dbca90a48e71b))
* **trigger-evals:** raise the weekly ceiling to 240 (owner decision 2026-11-03) ([9147e69](https://github.com/event4u-app/agent-config/commit/9147e69e87c958590d7633af50fe2ae33c2f8012))
* **routing-coverage:** raise the skills seed to 0.67 for the hiring-loop-design corpus ([157ae69](https://github.com/event4u-app/agent-config/commit/157ae6979899d7aa810395bc908d0faa7c2f60f7))
* **measurements:** pin the hiring-loop-design corpus (train) and re-take both train-side records ([e89f433](https://github.com/event4u-app/agent-config/commit/e89f433bd9fcf9901db2bbdf6763f5b21ae5509b))
* **roadmaps:** annotate the carried 4.4 with its deferred-resolution destination ([d47cd89](https://github.com/event4u-app/agent-config/commit/d47cd89f33603e30dcf5332d82e2e22981365366))
* **index:** regenerate catalog and command flows for the pr-comments description ([bf4047b](https://github.com/event4u-app/agent-config/commit/bf4047bc30d24a5309cd3c88ed1544abd91d8993))
* **roadmaps:** restate routing 5.3's pre-wiring note in the past tense ([6089f8f](https://github.com/event4u-app/agent-config/commit/6089f8fc6f37c5b3bd000bbd1069716edb9b1479))
* **roadmaps:** receipt for routing step 5.3 ([e6c3093](https://github.com/event4u-app/agent-config/commit/e6c3093beceafa42acf0565893535d7d9e2caf0a))
* **docs:** regenerate the doc path inventory for the ledger CLI ([fe514e0](https://github.com/event4u-app/agent-config/commit/fe514e0b3a4073438495590759ac6e029ae1fa1d))
* **roadmaps:** regenerate the owned digest for the archive and carry ([d839658](https://github.com/event4u-app/agent-config/commit/d839658c2729fdedf14ca57dee72925bc54c5cd6))
* **install:** delete the dead lenient JSON parser ([0b113a7](https://github.com/event4u-app/agent-config/commit/0b113a75bd36787a9d16d5deba535d5634ee3014))
* **roadmaps:** archive routing live floors; carry 4.4 by council verdict ([570a3fa](https://github.com/event4u-app/agent-config/commit/570a3faac50a1393f06ba468e1e8aefc512c790a))
* **hooks:** raise the bundle ceiling for #2816's merged web-launch rows ([4b0f69f](https://github.com/event4u-app/agent-config/commit/4b0f69fec840151bf8f0c58899339eb03c64a986))
* **hooks:** qualify the trunk-repair raise_log entry per council round 1 ([51df0bb](https://github.com/event4u-app/agent-config/commit/51df0bb0ce6ef03ff0117b20441070300926b75a))
* **hooks:** fit the bundle ceiling to the web-launch rows main already carries (council decision) ([d1e4442](https://github.com/event4u-app/agent-config/commit/d1e4442a0436cfd1c2eed82d48d89eaa156f9262))
* **hooks:** raise the bundle ceiling to the trunk's own reading ([b6c0a42](https://github.com/event4u-app/agent-config/commit/b6c0a429ef601590fa536df4a75bbb661054eb1c))
* drop the ROI freeze probe and close its stub; the fix is in ([5126aee](https://github.com/event4u-app/agent-config/commit/5126aee826509129795655fc846878298b580d10))
* **hooks:** raise the bundle ceiling for the round's bundled features (council decision) ([a94e87c](https://github.com/event4u-app/agent-config/commit/a94e87cad06bbdd9ad7c1b463941cec4a389cfa5))
* **roadmaps:** receipt for the game-classifier step ([2c56a2a](https://github.com/event4u-app/agent-config/commit/2c56a2a8f19d0e04dbe842a83707c07825433855))
* **roadmaps:** archive the inbox follow-up and record the parallel-run directive ([e3440d6](https://github.com/event4u-app/agent-config/commit/e3440d6dacf4a7c2e7b94c58e102606131794801))
* **measurements:** pin the song-to-script corpus and the edited supply-chain-intake corpus (both train) and re-take both train-side records ([3f5a759](https://github.com/event4u-app/agent-config/commit/3f5a759726ef6d0a23e47fe2be329e201781bd92))
* **roadmaps:** shorten the parked roadmap's goal to fit the owned-digest budget and regenerate it ([5379267](https://github.com/event4u-app/agent-config/commit/5379267938f3a7026abbae2d74e39afbce39a44a))
* **generated:** rebuild install modules ([fe7181e](https://github.com/event4u-app/agent-config/commit/fe7181e4527f69553b91200c905de68f23935728))
* **generated:** regenerate index and catalog ([47f35bb](https://github.com/event4u-app/agent-config/commit/47f35bb3f180cbadb961194117ae490e54812683))
* **roadmap:** receipt for step 1.1 ([c26cb9d](https://github.com/event4u-app/agent-config/commit/c26cb9db9c18acd79342b14a6a7268aaa14a8e68))
* **layout:** register agents/auto-learnings-1 as an owner-directed directory ([c77bd4c](https://github.com/event4u-app/agent-config/commit/c77bd4c78959989033ebcadb7b74101f9943ff00))
* **lint:** drop unused identifiers in two touched files ([1386758](https://github.com/event4u-app/agent-config/commit/1386758219d649c85dd75da4e13c9fb5477f66f1))
* **generated:** rebuild install bundle ([e6ac448](https://github.com/event4u-app/agent-config/commit/e6ac448604edf535deb2451c86e705c1aba9ac8e))
* **generated:** regenerate projections and pack token passports ([bb0ae04](https://github.com/event4u-app/agent-config/commit/bb0ae04cb07f631ac15f3b8a5da93e690ffd8ca8))
* **routing:** raise the skills coverage seed for the new character-consistency corpus ([57a2868](https://github.com/event4u-app/agent-config/commit/57a2868ca5b80025b456ba5270f476b42009df5f))
* **measurements:** pin the character-consistency corpus (trains, nothing seals) and re-take both train-side records ([8d7726a](https://github.com/event4u-app/agent-config/commit/8d7726afa7878f7406788643bd396509f12d8178))
* **roadmaps:** receipts name each media step's real subject; exempt the anchor step's markdown-run edge ([857667e](https://github.com/event4u-app/agent-config/commit/857667e38edae89e050354b11cbcc9bbbffe2aff))
* **roadmaps:** add step receipts to the three archived media roadmaps ([4be2928](https://github.com/event4u-app/agent-config/commit/4be29288045f366f2a1e457bf9e066c8602941b2))
* **generated:** regenerate the owned-roadmap digest ([bc9741f](https://github.com/event4u-app/agent-config/commit/bc9741f44aa6f1e19e77ddb702f1d9188d40f5e3))
* **roadmaps:** archive the three completed media roadmaps ([6a2cfbc](https://github.com/event4u-app/agent-config/commit/6a2cfbca8f37ed86e0bf246487fae405723cbf78))
* **generated:** regenerate projections ([f6ed97f](https://github.com/event4u-app/agent-config/commit/f6ed97f68d572f00e912c7298316bfcd957e0c3e))
* **gates:** lower the source-size ratchet to the measured 16875 ([ec40aa8](https://github.com/event4u-app/agent-config/commit/ec40aa856763ca7d0b578247cbd75c013adae448))
* **budget:** restate the write-time raise against main after #2812 ([faccefc](https://github.com/event4u-app/agent-config/commit/faccefc2d123e7d856852093bda69119aceeb8e1))
* **generated:** regenerate the ownership matrix ([98470e1](https://github.com/event4u-app/agent-config/commit/98470e1d947e3359d665cf329f6fdcded8fa1e8e))
* **generated:** re-emit the standing-payload census and host cost table ([9442dd5](https://github.com/event4u-app/agent-config/commit/9442dd5f3afa97b9a7fc36531ef42fc866aab735))
* **reach:** re-verify the youtube channel (reach:doctor --deep, yt-dlp probe exit 0) ([90c0b94](https://github.com/event4u-app/agent-config/commit/90c0b94ca152ec7ab64bb92f21e75d2cdfa72bd8))
* **hooks:** raise the hook bundle ceiling for the merged inbox-2026-11-n fixes ([914d799](https://github.com/event4u-app/agent-config/commit/914d799fbecd7cc4b0dfaaa6c2bb91eb5f83dc06))
* regenerate the owned digest and the doc-path inventory ([8b850a9](https://github.com/event4u-app/agent-config/commit/8b850a99ac1eb64c428b4a11c70a4eec0349e6f2))
* **hooks:** record the final bundle measurement in the raise_log ([54cb705](https://github.com/event4u-app/agent-config/commit/54cb7054f12897cfb24ebcc2ee4cae459c6b4227))
* **evidence:** re-emit the standing-payload census after the rename ([095b40d](https://github.com/event4u-app/agent-config/commit/095b40d075ea16526560bd5ac33798188721818b))
* **roadmaps:** archive road-to-a-resident-set-chosen-on-purpose ([0100012](https://github.com/event4u-app/agent-config/commit/0100012aa4760c469c5be5a7b5f74ef874990288))
* **roadmaps:** regenerate projections and archive road-to-floors-that-cite-or-route ([5debb6f](https://github.com/event4u-app/agent-config/commit/5debb6f9cfb3330bc508fb5f038eb9516b862473))
* **generated:** regenerate projections for the fix-loop wording ([ad10887](https://github.com/event4u-app/agent-config/commit/ad108879317ee10c5c8cc57167e27fc356bf163e))
* **reach:** re-verify the youtube channel and archive its roadmap ([b716c1f](https://github.com/event4u-app/agent-config/commit/b716c1f537cefb27bd4476e1f471ed90d6f0ba48))
* **gates:** record why the source-size ratchet moved ([ce603a7](https://github.com/event4u-app/agent-config/commit/ce603a79ba351580384c9e83c25c38d0a17cf853))
* **gates:** lower the source-size ratchet to the live total (16951 -> 16882) ([76a14eb](https://github.com/event4u-app/agent-config/commit/76a14ebdd4f82aae2a4f2d3bf947a2c9449aa85a))
* **generated:** re-emit the per-host standing-payload census and cost table ([145012f](https://github.com/event4u-app/agent-config/commit/145012fc0aad5034e525cebebedd4b12bdb9f103))
* **measurements:** re-take the pinned measurements for 303 skills ([74d32e6](https://github.com/event4u-app/agent-config/commit/74d32e6219ab3b1c1ffbea75469b26a04bda9808))
* **roadmaps:** regenerate the owned digest for the new stub ([22ab58a](https://github.com/event4u-app/agent-config/commit/22ab58a4a491091536fa2019bdfffcc5e6f2a6c5))
* **hooks:** raise the bundle ceiling for profile detection on session_start ([47161a7](https://github.com/event4u-app/agent-config/commit/47161a7b70fc11a01b2ac9b034f74cacd1baf9fb))
* **docs:** regenerate doc-path inventory for the new test reference ([622caea](https://github.com/event4u-app/agent-config/commit/622caead70a99b2715e445dffb867c4e0a473806))
* **sync:** regenerate projections for the /project:analyze contract wording ([0d37603](https://github.com/event4u-app/agent-config/commit/0d37603af5cf9c07c2cff0d136e3a0b78383d5a6))
* **ai-video:** demote seven adapters to experimental before the trace window closes ([b03bc15](https://github.com/event4u-app/agent-config/commit/b03bc153d7331d6a91f80751eb55d063ede9d7fb))
* **gates:** receipts, verify expectations, body-budget raises, re-taken routing measurement ([207abf4](https://github.com/event4u-app/agent-config/commit/207abf4daa2be516edafc3fd6bf61ea49c451516))
* **budget:** hook bundle ceiling 1,562,000 → 1,562,500 for return_bytes ([30c186c](https://github.com/event4u-app/agent-config/commit/30c186ca2b5ee581e25d41eebe885f6e4e4a0d53))
* **evidence:** type the inbox-2026-11-j disposition; regenerate the doc-path inventory ([3fa43f7](https://github.com/event4u-app/agent-config/commit/3fa43f747606558ea38031390dff8374b2164de4))
* **flows:** point stale lint_flows.py references at lint_flows.ts ([3b0d981](https://github.com/event4u-app/agent-config/commit/3b0d981d3b09fad1f940ac2d62f5b3b941792564))
* regenerate proof, wedge doc and owned digest; raise the digest budget ([77f854d](https://github.com/event4u-app/agent-config/commit/77f854d3eb576077bb169c09409c3800644a9c78))
* **budget:** raise_log wording per council review; commit the review prompt ([a1fc142](https://github.com/event4u-app/agent-config/commit/a1fc142cb36866cada4dc68f2492dfbfb92be53d))
* **sync:** regenerate projections for the blindspots and analyze:post edits ([ae354ab](https://github.com/event4u-app/agent-config/commit/ae354ab8c4b6ec71ee804cc0e7b3ef023c5860e6))
* **budget:** record main's hook-bundle growth since the 2026-11-01 raise ([0f9430c](https://github.com/event4u-app/agent-config/commit/0f9430cbbfb70b08c22df5e2f602fa4ca1edbb4d))
* **generated:** regenerate the install bundle and the ADR evidence census ([bfc1537](https://github.com/event4u-app/agent-config/commit/bfc15377891dfafa6f12217cef7989f8c821be25))
* **measurements:** re-take the pinned measurements for 302 skills ([b2d377f](https://github.com/event4u-app/agent-config/commit/b2d377fb42fe03ca3a99bc78ca6c54367110ba3c))
* **counts:** regenerate capability index, proof page and rule count for 302 skills ([5f84a9f](https://github.com/event4u-app/agent-config/commit/5f84a9f25ad18ab90346cc74864bced48aaa182e))
* **reports:** regenerate the skill-overlap report for 302 skills ([92911cb](https://github.com/event4u-app/agent-config/commit/92911cbd3da381da9adf69abbd0be6ac43de53b3))
* **index:** regenerate the artifact index and catalog for code-film ([4e3f79b](https://github.com/event4u-app/agent-config/commit/4e3f79b77d763e18928fd8eb138ad216c3dcd109))
* **budget:** cli_help_command_count 121 → 122 for audit:security ([ff325a3](https://github.com/event4u-app/agent-config/commit/ff325a316c53e8efee7cbe388481608042d55ca2))
* regenerate projections ([429b9c3](https://github.com/event4u-app/agent-config/commit/429b9c35df8b0b16f095a08baa4a2ce0456b2c8a))
* **consistency:** regenerate and guard the doc path inventory before a push ([71df798](https://github.com/event4u-app/agent-config/commit/71df7980d6d5d93075e03d9dafcbce64bccc3616))
* **roadmap:** tick the final sweep of docs-that-sell ([3cc96e7](https://github.com/event4u-app/agent-config/commit/3cc96e73fa6a05fe45fb46ed76124083239ffa85))
* **docs:** regenerate the doc path inventory after merging main ([1bdbdab](https://github.com/event4u-app/agent-config/commit/1bdbdabf1fa4bf5bdc51bdb6a4419a3e56c54970))
* **gates:** ratify the large-PR diff source and re-pin the installer's pack-size row ([13441d0](https://github.com/event4u-app/agent-config/commit/13441d0041b85820a4be83d1a9e5cade20f44b97))
* **roadmap:** tick the walkthrough and acceptance criteria 1-6 of docs-that-sell ([f657ac1](https://github.com/event4u-app/agent-config/commit/f657ac19155112627e8d7f0b43a5fb4291b2ff53))
* **roadmap:** independent read recorded with its prompt and dispositions ([f69059d](https://github.com/event4u-app/agent-config/commit/f69059d2ce0d053874fd36914af027cc609910c0))
* **roadmap:** cloud audit recorded and listings hand-off for docs-that-sell ([6df8a52](https://github.com/event4u-app/agent-config/commit/6df8a52cc7ff98d635fab0ba6b1826d6ae2f76f6))
* **roadmap:** tick Phases 6 and 7 and the remaining Phase 2 steps of docs-that-sell ([c9524b9](https://github.com/event4u-app/agent-config/commit/c9524b9833d6f2b302ff08f022fae23f5586bd37))
* **counts:** drop site count targets the rebuilt site no longer carries ([445584f](https://github.com/event4u-app/agent-config/commit/445584ff595d1b9101dae5bf387690c18fca9a82))
* **roadmap:** tick Phases 2 and 8 steps of docs-that-sell that are done ([8e87d4d](https://github.com/event4u-app/agent-config/commit/8e87d4d70b19110d501e6e08dc777131fd7af841))
* **assets:** restore the original site banner and keep the original info-image ([88c0215](https://github.com/event4u-app/agent-config/commit/88c021570fa4f166ce7011e834ab2ba296dcdd57))
* **roadmap:** tick Phases 3 and 4 of docs-that-sell ([79a8597](https://github.com/event4u-app/agent-config/commit/79a8597af6aaec866ec8166cfa2f4be540e065d5))
* **roadmap:** tick Phase 0 rulings of docs-that-sell ([413a4af](https://github.com/event4u-app/agent-config/commit/413a4af0a7421084b62890fdce85edec09f56789))
* **roadmap:** tick Phase 1, Phase 5 and the image steps of docs-that-sell ([884c765](https://github.com/event4u-app/agent-config/commit/884c7653312cf1c8f2e8971e462f7e0480cbbc56))

### Other

* Revert "chore(hooks): raise the bundle ceiling for #2816's merged web-launch rows" ([9422a66](https://github.com/event4u-app/agent-config/commit/9422a66fbc84e4074f61fb8094585bf69f58b7d7))
* Revert "docs(evidence): ratification prompt for the hook-bundle ceiling raise" ([dc81e13](https://github.com/event4u-app/agent-config/commit/dc81e13ff881d098854efc7bbe018c8f6a35af36))
* **lint:** drop the section mark from the legal-pack lint doc comment ([d1f0e7d](https://github.com/event4u-app/agent-config/commit/d1f0e7d4b629b359bd2bf71c28ae9045ba2199b1))

Tests: 37344 (+1144 since 19.2.0)

## [19.2.0](https://github.com/event4u-app/agent-config/compare/19.1.0...19.2.0) (2026-11-01)

### Release highlights

- **Behaviour changes:** pin three new corpora (one seals), re-take both train-side measurements, raise the coverage seed (d2f5737); numbers, paths and DTO examples the finance, prediction and PHP skills can stand behind (814b3d5).
- **Default changes + migration:** _none_
- **Security and correctness:** a truncated stance abstains in the tally (468d565); scan the docs-site pitch as a publish surface (e2d0e24); step receipts, regenerated MCP inventory, no skip guards in new tests (1cfcb1f); leave the owner-reserved stance tally unchanged (683f203); every tool carries all four annotation hints (2196b55); drift reds on a missing claim, not on any byte (c7e6b56); +32 more.
- **Honest nulls:** _none_
- **Known limitations:** _none_

> **Governance mix:** governance-only 52 vs consumer-only 10 (mixed 62, maintenance 16; taxonomy 1.1.0; range 904018f8b783..1c5439083f54).

### Features

* **subagent-orchestration:** every dispatch prompt carries the user requirements ([5ebf443](https://github.com/event4u-app/agent-config/commit/5ebf44361351f1d0ce2286003b768495d288ab4e))
* **code-graph:** render the map viewer from the committed map data ([94be0ed](https://github.com/event4u-app/agent-config/commit/94be0ed0998b17d91547f699a2729ab1d1819095))
* **session-eol-report:** replay cold returns to calibrate the prediction ([f7d26e1](https://github.com/event4u-app/agent-config/commit/f7d26e177095c95f1c6c07298d4e82642637561d))
* **quota-notice:** name the price of a cold-cache return ([54e3f95](https://github.com/event4u-app/agent-config/commit/54e3f9568493e8ab47e01b80cf00b8fe60aa713d))
* **statusline:** carry the host prompt-cache reading and the measured /clear start ([ae44e8d](https://github.com/event4u-app/agent-config/commit/ae44e8d4113518e04610bf1070082fef908dbfd5))
* **code-graph:** areas follow folders, with ids named after them ([be6dba4](https://github.com/event4u-app/agent-config/commit/be6dba4ce319052537578d2dd8f2b13a4be57c1d))
* **code-graph:** tracked map files change only where the tree did ([5a2d8bf](https://github.com/event4u-app/agent-config/commit/5a2d8bf62d80cc29aa0d7aba76c604b6340cb045))
* **hooks:** refresh the code graph at turn end once HEAD moved ([6060f0c](https://github.com/event4u-app/agent-config/commit/6060f0cb3c5344696d5c39e94295c0733ba7f79c))
* **code-graph:** a local build or map turns auto-refresh on ([dc9cdfb](https://github.com/event4u-app/agent-config/commit/dc9cdfbe74f3d8b0e745f5ec907ab8680ef0dbef))
* **round:** a split the task earns (inbox-2026-10-cb) (#2768) ([d7d3789](https://github.com/event4u-app/agent-config/commit/d7d3789486f51ade954aee90717f65266277b01c))
* **judge:** /judge bracket as the visible route of do-competitively ([7fbb7dd](https://github.com/event4u-app/agent-config/commit/7fbb7dd96915abb7e98ef3b29387398bea2914e2))
* **bracket:** a resumable bracket whose losses can be appealed ([d810443](https://github.com/event4u-app/agent-config/commit/d81044320f3520a26272f7021f97e4d4af9f7197))

### Bug Fixes

* **subagent-orchestration:** keep the skill body under its ceiling; regenerate the ownership matrix ([2474716](https://github.com/event4u-app/agent-config/commit/2474716f3505eb8a6c709098ad02459354cb8c11))
* **council:** a truncated stance abstains in the tally ([468d565](https://github.com/event4u-app/agent-config/commit/468d565daaa2f819967403dac95f3699920b13ca))
* **check_claims:** scan the docs-site pitch as a publish surface ([e2d0e24](https://github.com/event4u-app/agent-config/commit/e2d0e240e359390873aad835946e59ba4845f03f))
* **ci:** step receipts, regenerated MCP inventory, no skip guards in new tests ([1cfcb1f](https://github.com/event4u-app/agent-config/commit/1cfcb1fb2760c20b36adaa3e4bdcc45b5801d03a))
* **council:** leave the owner-reserved stance tally unchanged ([683f203](https://github.com/event4u-app/agent-config/commit/683f203af3f28df65a77b13b2a957a9ac08eccef))
* **mcp:** every tool carries all four annotation hints ([2196b55](https://github.com/event4u-app/agent-config/commit/2196b55ad5e17190cb85fe18013b8b9cc5338759))
* **host-docs:** drift reds on a missing claim, not on any byte ([c7e6b56](https://github.com/event4u-app/agent-config/commit/c7e6b56c563995e1e7cc0ca2c6db49e0bedb28ab))
* **council:** an answer the provider cut short is not a vote ([504a5af](https://github.com/event4u-app/agent-config/commit/504a5aff79a668f2954db5bd9b1dd2691e43a48e))
* **knowledge:** /knowledge ingest|list|forget reach their implementation ([5183394](https://github.com/event4u-app/agent-config/commit/5183394a4219561dd52556831b6c2f43c29a67a2))
* **memory:** CLI memory:lookup answers from the MCP implementation ([3cefce8](https://github.com/event4u-app/agent-config/commit/3cefce88e6e4091634a6ffac4286893a14934cd9))
* **code-graph:** untrack a committed map viewer page in existing repositories ([ef50cd0](https://github.com/event4u-app/agent-config/commit/ef50cd096a9ffa0dfc7d666a1ce4d755aef85625))
* **map-viewer:** an exact area-id search leads, case-insensitively ([e54d88b](https://github.com/event4u-app/agent-config/commit/e54d88b4e3ebe3d845fb157bf544556e3b35398b))
* **code-graph:** split folder areas above 40 files and follow single subfolders ([5005742](https://github.com/event4u-app/agent-config/commit/50057426a69e4045b53efc0fb4eee5ec152a716d))
* **roadmaps:** name the report CLI as step 4.1's production entry ([2cfbad9](https://github.com/event4u-app/agent-config/commit/2cfbad979c7f9fecb5a2cc4a870d17733e42eef1))
* **code-graph:** satisfy the strict typecheck in the stored-map helpers ([3d043a5](https://github.com/event4u-app/agent-config/commit/3d043a550198d79c1ed81132235936ecb1c118d9))
* **roadmaps:** oracle at the end of the resume verify clause ([3ca173a](https://github.com/event4u-app/agent-config/commit/3ca173ac2998caf53688ed1b842441a3e9597763))
* **roadmaps:** receipt and verify wording the gates can read ([04434e0](https://github.com/event4u-app/agent-config/commit/04434e046eeda8a9467ce88d69e0ec41eecbe043))
* **roadmaps:** step receipts and falsifiable verify on the cache-return roadmaps ([f324914](https://github.com/event4u-app/agent-config/commit/f32491439dbfb721494aabaa2dfff3ccd75f4e3a))
* **evidence:** type the cold-return calibration as analysis ([5e6beb3](https://github.com/event4u-app/agent-config/commit/5e6beb3bc054678db8d053145455f39b4e5530f4))
* **code-graph:** drop the evidence path from the consent comment ([2529c30](https://github.com/event4u-app/agent-config/commit/2529c30e40abe8a6effe091483ef72afd59ad46c))
* **ci:** reasoned reach exemption for the help-text-only step 1.8 ([27f837b](https://github.com/event4u-app/agent-config/commit/27f837bd7924da09db0e7cc50cce192796d4de83))
* **hooks:** refuse a committed claim before reading it; off fails if it cannot persist ([61f5562](https://github.com/event4u-app/agent-config/commit/61f5562995dcd86322cbb311f081d37ba09e2d09))
* **code-graph:** contain every write this change adds under agents/map ([b51c393](https://github.com/event4u-app/agent-config/commit/b51c393683f8ef27775c88f9e569ee5199a48ef7))
* **hooks:** contain the claim path from the repository root down ([6f23a23](https://github.com/event4u-app/agent-config/commit/6f23a2337d393acda8da82ac30ecbfe769378255))
* **hooks:** never claim or sweep through a symlink under .build/ ([c952e42](https://github.com/event4u-app/agent-config/commit/c952e4203976aa1b29cf1364860ea7e6d3076877))
* **hooks:** keep claims in day folders so deletion trails admission by a day ([09cbc38](https://github.com/event4u-app/agent-config/commit/09cbc38ff29ff0fd951c407797c32cc3435ea285))
* **ci:** receipts on the archived roadmap's ticked steps; drop two grandfather lines the new corpora retired ([fcecbc0](https://github.com/event4u-app/agent-config/commit/fcecbc05c20e574ac5836ecf082ca66bb360e0de))
* **hooks:** refuse a claim for a sweepable window by a clock read at claim time ([8b407e8](https://github.com/event4u-app/agent-config/commit/8b407e87f3c2b73e48fcee6e0a66863f15e4f050))
* **hooks:** sweep only spent claim windows, so no live claim loses its owner ([338fb6e](https://github.com/event4u-app/agent-config/commit/338fb6e7f119886b40fcb8f745d932a57b5d6e3f))
* **hooks:** admit a turn-end refresh by an exclusive per-(HEAD, window) claim ([f885cf5](https://github.com/event4u-app/agent-config/commit/f885cf51afd5a05764f091ca21a90f683e793f8b))
* **hooks:** atomic turn-end admission, withdrawn failed launches, no consent under CI ([e277bcb](https://github.com/event4u-app/agent-config/commit/e277bcba1715ab033f1d2a364ba7aeb5744a4aee))
* **hooks:** bound every turn-end spawn path the ratification named ([b3e3126](https://github.com/event4u-app/agent-config/commit/b3e3126f27639a02d0df51a1087e60d89b47993b))
* **skills:** numbers, paths and DTO examples the finance, prediction and PHP skills can stand behind ([814b3d5](https://github.com/event4u-app/agent-config/commit/814b3d5ea2822d4f06fdf1d0cb9f105c88fabca8))
* **code-graph:** interfaces and data lanes honour .gitignore ([432900d](https://github.com/event4u-app/agent-config/commit/432900d2f1f20f275b3dd93912a433cda05effbd))
* **payload-gate:** the owner approves a grant; no second reviewer required ([d8882a8](https://github.com/event4u-app/agent-config/commit/d8882a8fa578695420e49cba004afbaa8d3e8a19))
* **bracket:** do not name the shadow jury module in a comment its AC-9 grep reads as a consumer ([832e688](https://github.com/event4u-app/agent-config/commit/832e68885c4c99530833a14d00cab6536ecda829))
* **subagent-orchestration:** keep the skill body under its budget; the bracket pointer lives in the modes context ([4dfda71](https://github.com/event4u-app/agent-config/commit/4dfda714b5cb6d10931dbe8ad74147cd43482eef))
* **truth-surfaces:** settle three claims the tree contradicted ([cccf45d](https://github.com/event4u-app/agent-config/commit/cccf45dedd5760f3b0d3eebe7b8bfa5c26ea3a75))
* **docs:** the bound rewording stays inside the size budgets; drop the platform skips ([36b00a5](https://github.com/event4u-app/agent-config/commit/36b00a5c82bb05b75e86e038a8ad907e3dca1f90))
* **auth:** the reset sentence spends a pending refusal, like any turn ([29c2574](https://github.com/event4u-app/agent-config/commit/29c257440037d9d12194dc0b72ba9189244756f5))
* **run:** leave the manifest comment to the ratified edit that owns it ([6eaf302](https://github.com/event4u-app/agent-config/commit/6eaf3021037339fb18642d3bd11670f8323960c1))
* **run:** the run surfaces name one retry bound and count their detectors ([8e06b2a](https://github.com/event4u-app/agent-config/commit/8e06b2a34f423a7e724435b5453b2e874e72ae66))
* **quota:** the signal is right before anything acts on it ([f38127f](https://github.com/event4u-app/agent-config/commit/f38127f6ca239827b883113304c7399c1e5cc65e))
* **pack-size:** re-bind the install script payload exception to its new size ([4df2e79](https://github.com/event4u-app/agent-config/commit/4df2e79d0347dd47a0a5dbc4437b349ff7c64650))
* **install:** forward --full and --enrol from the install orchestrator ([a8ba61f](https://github.com/event4u-app/agent-config/commit/a8ba61f249bf973c5c01de45ac0413444fad0473))
* **release:** a resume reruns the PR-body check its body refresh cannot re-trigger ([92806bf](https://github.com/event4u-app/agent-config/commit/92806bf8212759091bde83353f014116fe83e977))
* **release:** the CI release job can push its release branch ([3843c96](https://github.com/event4u-app/agent-config/commit/3843c965435b6c228bfb22c142a8812f463035eb))
* **bench:** a hook that exits before reading stdin is a measurement, not a failure ([5e7b355](https://github.com/event4u-app/agent-config/commit/5e7b35574874cf5500f69e62f8efebb9bb7bbfa6))

### Performance

* **code-graph:** read the history window once per HEAD ([1b4ccd2](https://github.com/event4u-app/agent-config/commit/1b4ccd24691b8e5b6e01bcecf9910138f6f34cae))
* **code-graph:** one git file listing per run instead of one per walk ([e24b2cb](https://github.com/event4u-app/agent-config/commit/e24b2cbcc09a7f994df71b1fa93bb85b33966fc7))
* **quota:** read the park reset time at report time, not in the hook ([8c94451](https://github.com/event4u-app/agent-config/commit/8c94451479caf6dfe05ab36dcc1b440b3fffb34b))
* **hooks:** each event costs less and is measured in memory and CPU ([48cf15c](https://github.com/event4u-app/agent-config/commit/48cf15cbeb59e7fbd08d80fbdd7e4dd41c13cb27))

### Documentation

* **ratifications:** two-provider review of the truncated-stance tally change ([3e7d181](https://github.com/event4u-app/agent-config/commit/3e7d18184a771a9869a9a7ac89854d61361e420c))
* **council:** ratification review prompt for the truncated-stance tally change ([cdef93c](https://github.com/event4u-app/agent-config/commit/cdef93c06dfbb5207b5b049fb688ea1f580da5a0))
* **distribution:** mark two awesome lists closed to outside pull requests ([8ee19c8](https://github.com/event4u-app/agent-config/commit/8ee19c8ef0d49815ef00ed8e7aa284a84768dc85))
* **site:** stop publishing the withdrawn zero-runtime claim ([ce75d87](https://github.com/event4u-app/agent-config/commit/ce75d87ecb678076c77905270c8b6ba58ed97787))
* **positioning:** descriptions say what the package is before what it proves ([0f9ec88](https://github.com/event4u-app/agent-config/commit/0f9ec88c19d636570f07449d1a3ad031733f2b00))
* **roadmaps:** archive road-to-twins-that-answer-alike ([838dde9](https://github.com/event4u-app/agent-config/commit/838dde95326bf3a7e95bc7397517580b4a216c56))
* **distribution:** record the 2026-11-01 awesome-list submissions ([b593b1a](https://github.com/event4u-app/agent-config/commit/b593b1a38b1190c1164032924121116d54089ee8))
* **map:** the engine migrates repositories that committed the viewer page ([7e77de5](https://github.com/event4u-app/agent-config/commit/7e77de53ee50572be561202b7739448455aa34be))
* **map:** ADR-297 amendment 2, the viewer page is local ([c405974](https://github.com/event4u-app/agent-config/commit/c4059743b4383cfa848607a1dc6ddb1e6196400e))
* **roadmaps:** cancel the cold-return transcript fallback, move the metered amount to the status line ([81708c0](https://github.com/event4u-app/agent-config/commit/81708c0762c0f80433d5d1d04b72c04fc3bb572b))
* **roadmaps:** road-to-a-return-that-names-its-price, done and archived ([0480945](https://github.com/event4u-app/agent-config/commit/04809456a25b907b24b144fd01262e4d7ba99e33))
* **evidence:** ratification record for the map auto-refresh change ([362c5a1](https://github.com/event4u-app/agent-config/commit/362c5a1f49af87d59ac1986490fa941b5c69a6f2))
* **code-graph:** auto-refresh status says each new commit may launch one refresh ([2980348](https://github.com/event4u-app/agent-config/commit/29803487a127f03ef1c04655a45635b5be09c9f8))
* **evidence:** ratification prompt for the map auto-refresh change, round 11 ([5ac60da](https://github.com/event4u-app/agent-config/commit/5ac60da0b60f1f23f365fa3fa65071b9953c8c05))
* **evidence:** fit the round 10 prompt under the bundle ceiling ([8681d9a](https://github.com/event4u-app/agent-config/commit/8681d9a258f3d26bada8862cfda27e6bdebcb2ab))
* **evidence:** ratification prompt for the map auto-refresh change, round 10 ([4f522a0](https://github.com/event4u-app/agent-config/commit/4f522a04211ea20fa5dce95cb99ea2f4101193ba))
* **evidence:** ratification prompt for the map auto-refresh change, round 9 ([56456f0](https://github.com/event4u-app/agent-config/commit/56456f0fbe8d6fcec600555f3cb84db10d97038b))
* **evidence:** ratification prompt for the map auto-refresh change, round 8 ([febb5bf](https://github.com/event4u-app/agent-config/commit/febb5bff4907f3fd42d018fe6c82d5bf6dd957d7))
* **evidence:** ratification prompt for the map auto-refresh change, round 7 ([742bf73](https://github.com/event4u-app/agent-config/commit/742bf73912ee287004e685b0c024c57e334baa7e))
* **evidence:** ratification prompt for the map auto-refresh change, round 6 ([98abe38](https://github.com/event4u-app/agent-config/commit/98abe38dcac4c5455be1d194674422dbbff910ef))
* **evidence:** the owner confirms consent by local use, agents included ([f80cc19](https://github.com/event4u-app/agent-config/commit/f80cc191e4c59397e831dfaae114e9110bfdee6b))
* **evidence:** fit the round 5 ratification prompt under the bundle ceiling ([8192578](https://github.com/event4u-app/agent-config/commit/81925788028967e000d8dd6013243df208f111d2))
* **evidence:** ratification prompt for the map auto-refresh change, round 5 ([78bc4b1](https://github.com/event4u-app/agent-config/commit/78bc4b129152f653e41e8871b5424b8a9b372fa9))
* **evidence:** ratification prompt for the map auto-refresh change, round 4 ([722b808](https://github.com/event4u-app/agent-config/commit/722b80873cdc6529d860c54af434d0d2684284aa))
* **evidence:** ratification record for the two floor sentences (council 2/2 confirmed-non-expanding) ([db741f9](https://github.com/event4u-app/agent-config/commit/db741f9118074080aada753c17aacd051e00d92a))
* **evidence:** ratification prompt for the map auto-refresh change, round 3 ([9ff5aca](https://github.com/event4u-app/agent-config/commit/9ff5aca259aa0b41955a951bc681bf672840e710))
* **evidence:** ratification prompt for the map auto-refresh change, round 2 ([4ae104b](https://github.com/event4u-app/agent-config/commit/4ae104b533451601e5db95e6bbcfa1306b617f03))
* **roadmaps:** verify clauses state their oracle ([40eac78](https://github.com/event4u-app/agent-config/commit/40eac785a336df2f662daa02b2f848f12c931dbc))
* **roadmaps:** archive road-to-numbers-a-skill-can-stand-behind, round disposition ([603aa33](https://github.com/event4u-app/agent-config/commit/603aa33f611d315162cf5efb02451d67b9844488))
* **evidence:** fit the ratification prompt under the council bundle ceiling ([c97ad76](https://github.com/event4u-app/agent-config/commit/c97ad766e67a40bc76e1ab45cfac242da3a82253))
* **evidence:** ratification prompt for the map auto-refresh change, round 1 ([dfcbc23](https://github.com/event4u-app/agent-config/commit/dfcbc230b689e623fda929b8ee95594e2f001e94))
* **roadmaps:** inbox-2026-11-a — one executable roadmap, three parked, five folds ([e6e3366](https://github.com/event4u-app/agent-config/commit/e6e3366d8ba7bf95ddb9a36614317b5f843afb3c))
* **evidence:** bypass record for #2768 (#2769) ([8ccb6ae](https://github.com/event4u-app/agent-config/commit/8ccb6ae90daa9588920558a9cf20f42858855794))
* **roadmaps:** road-to-a-loss-that-can-be-appealed, done and archived ([267f080](https://github.com/event4u-app/agent-config/commit/267f080ac8e0af0aff85272d778c256c9edd03dc))
* **roadmaps:** name interruption_report as the CLI entry its step ships ([b89dda4](https://github.com/event4u-app/agent-config/commit/b89dda451e2910e8b31cab85e66f221871075b13))
* **roadmaps:** one more verify expectation in a readable shape ([af08983](https://github.com/event4u-app/agent-config/commit/af089838e98ae735c97101820953c03f4ed2dc83))
* **roadmaps:** verify expectations the checker can read, and the 2.2 receipt by range ([29dcf8d](https://github.com/event4u-app/agent-config/commit/29dcf8d76fad6222e729a1589f83006c693d06d6))
* **roadmaps:** receipts and verify expectations on the inbox-2026-10-bm steps ([dc056b3](https://github.com/event4u-app/agent-config/commit/dc056b3aa2a3f6581f018c4f43937fad45d7a14e))
* **evidence:** ratification record for the inbox-2026-10-bm hook-bundle raise ([f346be8](https://github.com/event4u-app/agent-config/commit/f346be8cd2ce696e519419f7f739ed740c4f1790))
* **evidence:** round-2 ratification prompt for the hook-bundle raise ([711c31f](https://github.com/event4u-app/agent-config/commit/711c31fec8bf5ac012bc3d22c5d05ca74a060332))
* **evidence:** ratification prompt for the inbox-2026-10-bm hook-bundle raise ([a9e51e1](https://github.com/event4u-app/agent-config/commit/a9e51e1b456c6c07a0e564f75bd75ec3fbae7a0b))
* **owner-questions:** settle OQ-43 to OQ-53 and apply the ADR-108/ADR-240 rulings (#2763) ([1401275](https://github.com/event4u-app/agent-config/commit/14012757df29c438ebb60d77d471d3e137492cd1))
* **roadmaps:** inbox-2026-10-bm lands three roadmaps, done and archived ([3bb45be](https://github.com/event4u-app/agent-config/commit/3bb45be1ac06bf8ee8bdfe1bba107750fd1edf48))
* **roadmaps:** park road-to-a-session-start-under-the-host-limit (#2764) ([1ce6585](https://github.com/event4u-app/agent-config/commit/1ce6585fa6cb8949a0bf35f7948fc91a8c39df76))
* **roadmaps:** park the carriers for OQ-9, OQ-10 and OQ-11 ([b333602](https://github.com/event4u-app/agent-config/commit/b33360215c08771f5ac779b829ce384756cc3d11))
* **owner-questions:** record the answers to OQ-8 to OQ-11 and lift the register into OQ-43 to OQ-53 ([7ede0e7](https://github.com/event4u-app/agent-config/commit/7ede0e73984d298dbb376ed5255fcab360764986))

### Refactoring

* **code-graph:** move the stored-map helpers into map_stored.ts ([c1c112d](https://github.com/event4u-app/agent-config/commit/c1c112db0716816240128ca40af88e5acca70231))
* **release:** the surface-check rerun lives in its own module ([cf50321](https://github.com/event4u-app/agent-config/commit/cf50321c0e346c97dc579606153287c60ba58941))

### Tests

* **council:** context_exceeded abstains; unknown, absent and errored do not ([3a3cac6](https://github.com/event4u-app/agent-config/commit/3a3cac6ae07ee65cd3fb3f140dc1536aac58580f))
* **check_claims:** pin the docs-site pitch as a publish surface ([400b680](https://github.com/event4u-app/agent-config/commit/400b680e5515edbbf245c96a007c563dd762e828))
* **knowledge:** drop unused harness vars, assert the table's static columns ([fbd13fc](https://github.com/event4u-app/agent-config/commit/fbd13fcce6e8dffbc315cfb37d84db04898a4636))
* **routing:** pin three new corpora (one seals), re-take both train-side measurements, raise the coverage seed ([d2f5737](https://github.com/event4u-app/agent-config/commit/d2f573757df8c2864bc751924cbd64bd0bea3a1b))
* **skills:** German positives in the new trigger corpora declare their language ([a752823](https://github.com/event4u-app/agent-config/commit/a752823754af0427efb8df3f8e12c516375a33c6))
* **bench:** build the spawn fixture without an explicit undefined error ([a55a48a](https://github.com/event4u-app/agent-config/commit/a55a48a92f8dd32fc36c61f2d9d390bd521c4453))

### Chores

* **gates:** lower the source-size baseline to the measured 17,060 ([23553a5](https://github.com/event4u-app/agent-config/commit/23553a5e024e31c6396a692c202e4739985010c2))
* **publish:** record the two knowledge:local modules in the publish surface ([6e91bbb](https://github.com/event4u-app/agent-config/commit/6e91bbba33e9fbab895b748e01af51bf61abffe9))
* **mcp:** import the hint derivation from its module; record E7 ([7aeb927](https://github.com/event4u-app/agent-config/commit/7aeb927bdae7c800a65dc14e80e101542e8b4dc3))
* **deps:** bump the site group in /site with 3 updates ([de1a925](https://github.com/event4u-app/agent-config/commit/de1a9251f84dc30fb904e7a0be9ccded2f136705))
* **deps-dev:** bump @cloudflare/workers-types ([b620290](https://github.com/event4u-app/agent-config/commit/b620290eed1c359cf6e136c97370e6b3bf71e612))
* **deps:** drop graphology-communities-louvain ([fae1565](https://github.com/event4u-app/agent-config/commit/fae15657a91188c85945f817bcc7360f3e278c9f))
* **map:** keep the viewer page local ([eada201](https://github.com/event4u-app/agent-config/commit/eada20188e702d9ff19292504d23ddeb65684518))
* **generated:** ADR evidence census after the ADR-297 amendment ([7452e84](https://github.com/event4u-app/agent-config/commit/7452e843e54979e59166fdf722f5f13b886df553))
* **roadmaps:** park write containment for the map engine's existing writers ([1d96297](https://github.com/event4u-app/agent-config/commit/1d9629793723612917ab541730256237e45727e7))
* **budget:** record the refresh chunk's measured size after the sweep fix ([56be7c6](https://github.com/event4u-app/agent-config/commit/56be7c6998ffde8473ee24961ad05ddf2267b5cc))
* **generated:** standing-payload census and host cost table at the new pin ([12dc984](https://github.com/event4u-app/agent-config/commit/12dc984c8314047153db230ace8954dcb6a0ed18))
* **generated:** standing-payload census and host cost table after the floor text edits ([3d01e6d](https://github.com/event4u-app/agent-config/commit/3d01e6d0f08e6195b37ac4e7bf97eceb87fb7fb6))
* **roadmaps:** drop the speaking Source header from the parked youtube roadmap ([181b152](https://github.com/event4u-app/agent-config/commit/181b152010775ad25936cac4765bf7cf414ffc3c))
* **roadmaps:** park the stale youtube reach-channel re-verification ([c23922d](https://github.com/event4u-app/agent-config/commit/c23922d5f1a7b5febf40c87eb124a590a465dc35))
* **generated:** ADR evidence census after the ADR-275/276 amendments ([cf4b140](https://github.com/event4u-app/agent-config/commit/cf4b1406ac746780e52c777bca869ae09e93a65e))
* **evaluator:** refresh the nightly measurement record ([0620f2d](https://github.com/event4u-app/agent-config/commit/0620f2d432890cbb2d5b036912395c4cca674c88))
* drop report side effects of local check runs ([00f5a0e](https://github.com/event4u-app/agent-config/commit/00f5a0e48b6270340b53fc93ac45708b865d8695))
* **bracket:** surface tier, flow map, counts and step receipts ([5182603](https://github.com/event4u-app/agent-config/commit/518260352f74c50b2602d42b468d74c6f865fb49))
* **generated:** index and catalog list /judge bracket ([266db15](https://github.com/event4u-app/agent-config/commit/266db151a4bc22f713853a1a62f85e27d8a91fc5))
* **generated:** owned digest and install bundle for the new stubs and settings text ([2b10cb1](https://github.com/event4u-app/agent-config/commit/2b10cb1f371b667007e54ac41942f36eb34d7226))
* **evidence:** regenerate the ADR evidence census after the base merge ([f4db5bf](https://github.com/event4u-app/agent-config/commit/f4db5bfc6e063f841ff3d6ae16743a5aba9472db))
* **roadmaps:** regenerate the owned digest for the three parked carriers ([c703434](https://github.com/event4u-app/agent-config/commit/c70343451a77f8d07c40fba62dd38c0e0cb750aa))

Tests: 36200 (+291 since 19.1.0)

## [19.1.0](https://github.com/event4u-app/agent-config/compare/19.0.0...19.1.0) (2026-10-30)

### Release highlights

- **Behaviour changes:** the image rights floor routes to its six skills (OQ-42 grant) (#2754) (4257d0e); land inbox rounds 2026-10-bk/-bl on their owners; close map views; records that match their code (#2753) (6ac90a2); host configs survive the install, transfers close on evidence, verify checks that can say no (#2743) (98c42cb); a scorer that fails when nothing was done, and the showcase foundation (#2741) (5c7d7ef).
- **Default changes + migration:** _none_
- **Security and correctness:** a major only when a consumer-facing installer path is removed (#2758) (b2792e5); close the gaps a post-merge review found in the release hardening (#2739) (67522fb); require only the standing laws the claude deploy wrote (#2738) (1df9bb3); harden the release against network drops and drop the census commit (#2737) (1e3869b).
- **Honest nulls:** _none_
- **Known limitations:** host configs survive the install, transfers close on evidence, verify checks that can say no (#2743) (src/scripts/install.ts declares a residual) (98c42cb); a scorer that fails when nothing was done, and the showcase foundation (#2741) (internal/bench/ui/run.ts declares a residual) (5c7d7ef).

> **Governance mix:** governance-only 8 vs consumer-only 1 (mixed 12, maintenance 1; taxonomy 1.1.0; range 76ed3de29feb..b2792e582976).

### Features

* **rules:** the image rights floor routes to its six skills (OQ-42 grant) (#2754) ([4257d0e](https://github.com/event4u-app/agent-config/commit/4257d0ebd33bb158d576032fbe2e8e3590a7ec5e))
* land inbox rounds 2026-10-bk/-bl on their owners; close map views; records that match their code (#2753) ([6ac90a2](https://github.com/event4u-app/agent-config/commit/6ac90a2843b14bd6fe9d7bfbebf28ef3239f5f0f))
* **roadmap:** set-step --verify runs the step's check, warn-only (OQ-33) (#2745) ([566cccf](https://github.com/event4u-app/agent-config/commit/566cccf600b2da355a8470a0710bc36760f7c11f))
* **memory:** a correction that is heard and a memory that arrives (inbox-2026-10-bi) (#2744) ([d3d5d8d](https://github.com/event4u-app/agent-config/commit/d3d5d8dbd4a67024f8251b24e8d345d013856c99))
* host configs survive the install, transfers close on evidence, verify checks that can say no (#2743) ([98c42cb](https://github.com/event4u-app/agent-config/commit/98c42cb437e0de601ff5df7d405c8d164ef208dc))
* **owner:** apply OQ-21 and OQ-25 to OQ-27 — intake-pass hook, consumer-reachable interview, no Lyra (#2730) ([965c4db](https://github.com/event4u-app/agent-config/commit/965c4db02b7a6b7bc7530590b1f751a6787086b3))
* **bench:** a scorer that fails when nothing was done, and the showcase foundation (#2741) ([5c7d7ef](https://github.com/event4u-app/agent-config/commit/5c7d7ef70df10a7b5dba4f545d10cb7063b91f91))

### Bug Fixes

* **release:** a major only when a consumer-facing installer path is removed (#2758) ([b2792e5](https://github.com/event4u-app/agent-config/commit/b2792e58297696f297721503d3625f840393a061))
* **gates:** reaffirm the deferral-integrity baseline at its 56-day expiry (#2742) ([fa216c9](https://github.com/event4u-app/agent-config/commit/fa216c9dcd9e2e0d3077e2e5f50659a1ea6f5a3a))
* **roadmaps:** give routing-assurance-live-floors its relates block (#2740) ([58d4307](https://github.com/event4u-app/agent-config/commit/58d43073b7b0f6cbb9d6d61913e4cbf7ffecbeba))
* **release:** close the gaps a post-merge review found in the release hardening (#2739) ([67522fb](https://github.com/event4u-app/agent-config/commit/67522fb0755d632b714aa80e869ff77c53606e58))
* **layer-form:** require only the standing laws the claude deploy wrote (#2738) ([1df9bb3](https://github.com/event4u-app/agent-config/commit/1df9bb335657e7f993eef6e5951182bab1a9f95f))
* **release:** harden the release against network drops and drop the census commit (#2737) ([1e3869b](https://github.com/event4u-app/agent-config/commit/1e3869b03da24624fcdd85b4280ebc030b07e177))

### Documentation

* **evidence:** bypass record and after-the-fact council review for #2755 (#2757) ([7096ed3](https://github.com/event4u-app/agent-config/commit/7096ed36036dc54847d1f732e696b3227a2ea45b))
* **evidence:** bypass record and after-the-fact council review for #2754 (#2755) ([36af1af](https://github.com/event4u-app/agent-config/commit/36af1af0866ce9ce50f4119d1edcf2a210869cda))
* **evidence:** owner directive to promote three memory roadmaps above the active-roadmap cap (#2749) ([c01ee0a](https://github.com/event4u-app/agent-config/commit/c01ee0afa70c8069b90afc558c61bac8487b0988))
* **roadmap:** council and owner decisions on Phase 6 of the installed layer (#2748) ([73f60ae](https://github.com/event4u-app/agent-config/commit/73f60aea7fca5abf15694a0561e7fa3e65576559))
* **owner:** record answers OQ-32..OQ-35 for the memory roadmaps (#2746) ([f1dbf37](https://github.com/event4u-app/agent-config/commit/f1dbf37a6271fb8d1ff90344b3cd0b0de4f13a09))

### Chores

* **evaluator:** refresh the nightly measurement record (#2756) ([8e39ff8](https://github.com/event4u-app/agent-config/commit/8e39ff8cb83f0dad7a6416ee8702727b2cd28db7))
* **roadmaps:** activate road-to-an-observation-provider-slot (OQ-36) (#2752) ([2744e0f](https://github.com/event4u-app/agent-config/commit/2744e0f2fa044328b2a96bde9cbe31f95a45c4f4))
* **owner:** record the provider-slot activation; renumber OQ-32/33 to OQ-36/37 (#2751) ([0b2f61c](https://github.com/event4u-app/agent-config/commit/0b2f61c300becd345cd0f4fe0c2b6050064e594c))
* **roadmaps:** promote the three memory roadmaps from later/ on owner instruction (#2750) ([4dc4927](https://github.com/event4u-app/agent-config/commit/4dc4927202604e0b931a480ed2f200bdf2a18e27))

Tests: 35909 (+506 since 19.0.0)

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
