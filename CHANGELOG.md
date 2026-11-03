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
