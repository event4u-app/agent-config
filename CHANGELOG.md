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

- **Docs hygiene — retired stale authoring-source pointers.** 43 stale
  "edit `.agent-src.uncondensed/`" *authoring* pointers across 28 `.md` files
  repointed at `src/` (the authoring source of truth per ADR-051); continues
  the #989 README/thin-root fixes. `check_source_pointer_freshness`'s allowlist
  broadened (2 → 16 files) to lock the cleaned files against regression. Live
  `.agent-src.uncondensed/` **code constants, pipeline descriptions, and
  catalog paths were deliberately left untouched** — that tree is a live
  generated intermediate, not dead debt; a blind sweep was explicitly rejected.

### Added

- **Internet-reach operator tooling** — upstream-tool health and install-pinning
  discipline for the tools a reach recipe needs. The router skill this was
  scoped around was **cancelled pre-authoring by its own benchmark gate**: the
  pre-registered run returned 0/12 outright wins against the host's native web
  tools (`band: stop`), so no skill, no triggers, no capability-area claim. The
  null is published in [`docs/benchmark.md`](docs/benchmark.md) § internet-reach;
  the decision is [ADR-126](docs/decisions/ADR-126-internet-reach-operator-tooling.md).
  - `reach:doctor` — new read-only command: per-channel probe status,
    `active_backend`, tier, lifecycle, and the exact **pinned** fix command for
    the current platform when a backend is missing or broken. No writes, no
    installs, no network (`--deep` is the explicit opt-in that makes one real
    request per backend and still writes nothing).
  - `src/config/reach-channels.yml` + `reach-channels.schema.json` — ordered
    backend candidates per channel (swapping a backend is a config reorder, not
    a code edit), the four-value lifecycle vocabulary reused from
    `provider-lifecycle`, `last_verified` staleness metadata, and an install
    pattern that **rejects** unpinned versions, `latest`/`main`/`HEAD` refs and
    archive-URL install sources.
  - `tool_probe` — five-state probe taxonomy (`ok`/`missing`/`broken`/`timeout`/
    `error`) with stale-shim detection (resolvable shim, dead interpreter),
    exit-126/127 mapping, timeout-only single retry, and per-channel error
    isolation. Every spawn routes through `hardenedSpawnEnv()`.
  - `check-reach-channels` + `check-reach-prescriptions` CI gates — pinning and
    intake-record discipline is machine-checked, not an honour system; a
    prescription that cannot be pinned does not ship.
  - `check-reach-staleness` CI gate — offline: a channel unverified for >90 days,
    a `deprecated` channel with no `replacement`, or a channel past its
    `removal_after` date and still present fails the build.
  - Registry trust is enforced at runtime, not just in CI: `reach:doctor` (incl.
    `--registry <path>`) validates the registry against its schema and refuses to
    probe on any violation (exit 2). `probe_args` is a flag-shaped **allowlist**
    and `probe_cmd` must equal its backend `id`, so a registry entry can neither
    smuggle a shell payload nor label a row with a binary other than the one that
    ran — both closed by an adversarial pre-merge review, with permanent
    regression fixtures.

- **Doc-follows-code discipline** — deterministic, framework-agnostic mechanism
  so documentation is updated when code changes.
  - `downstream-changes` rule gains a first-class **Doc-Impact** obligation:
    a change to a public surface (route, exported signature, CLI flag, config/
    settings key, env var, DB schema, event payload) is incomplete until the
    doc that describes it is updated in the same change; escape hatch for
    refactor-only / no-surface changes.
  - `agent-docs-writing` skill: the advisory doc-sync table becomes an
    actionable, cross-stack Doc-Impact procedure with a falsifiable-claim
    fire/no-fire test.
  - `check_source_pointer_freshness` CI gate — fails when an authoring file
    names the retired `.agent-src.uncondensed/` tree as source of truth.
  - Opt-in consumer CI template `github-workflows/doc-impact.yml` (warn-first,
    `[docs:not-needed]` / `refactor:` escape hatch, `STRICT` toggle).

### Fixed

- **Every release PR was red on its first run — the generator and the
  highlight gate contradicted each other.** `release.ts` wrote `_none_` into
  all five curated-head fields; `check_release_highlights` (added 2026-08-03)
  fails a `_none_` the release span contradicts. Because every release of this
  package touches `src/rules/` or `src/scripts/schemas/`, "Behaviour changes"
  is *always* substantiated, so the gate reliably red-flagged the generator's
  own default — 9.17.0 (run 30871194277) and 9.18.0 (run 30909511315) both
  failed on that one step, and each release had to be unblocked by hand.
  - The span → category classifier now lives once, in
    `src/scripts/_lib/release_highlights.ts`, and is shared by the generator
    and the gate; the two duplicated label lists are gone with it.
  - `release.ts` **pre-fills** each substantiated label with the deriving
    reason plus its citing SHAs (capped at 6, remainder stated, never silently
    truncated). `_none_` is now a fallback for labels the span does not
    substantiate, not a blanket default — so the tool no longer asserts five
    things it never checked.
  - The gate keeps full teeth for the failure it was actually built for: a
    **human** editing a substantiated line back down to `_none_`, which is what
    produced the false 9.13.0 and 9.14.0 heads. An unrewritten auto-derived
    line is advisory (a prose gap, not a false claim) and never blocks.
  - Derivation is best-effort in the generator: a git failure degrades to the
    `_none_` skeleton with a warning instead of aborting a release.

- **`/team delegate` double gate is now enforced in code, not only in prose**
  (team mode stays default-off; closing `road-to-team-mode`). The gate on the
  only write-access wrapper existed as agent-followed instructions in the
  command doc — nothing mechanical checked `ai_team.allow_delegate`, and no
  test covered any of the three flag combinations. Added
  `assert_delegate_allowed()` + `TeamDelegateDisabledError` in
  `src/scripts/ai_team/team_dispatch.ts` (mirroring the existing
  `run_team_review` fail-closed shape) plus a `--delegate-gate` CLI mode that
  exits non-zero with the opt-in pointer unless **both** `ai_team.enabled` and
  `ai_team.allow_delegate` are true; all three combinations are test-pinned.
- **Default-off parity for team mode is now pinned where it was only
  claimed**: the Stop-hook E2E covered `enabled: true` + `managed: false`
  only, so the shipped default posture (`ai_team` absent, or
  `enabled: false`) was never exercised — two new pins assert a strict no-op
  (exit 0, no stdout, no state, no ledger). The command-suggestion surface
  gained its own pin (exactly one eligible team command, its
  `trigger_context` carrying the `ai_team.enabled is true` agent-side
  precondition, all sub-commands ineligible, and zero `ai_team` awareness in
  the deterministic suggester — so its output is invariant with respect to
  that config).
- Stale `not yet manifest-wired` header comments in
  `src/scripts/ai_team/review_gate.ts` and
  `src/scripts/team_review_gate_hook.ts`: the Stop-concern registration
  landed with team-mode Phase 4 (`hook_manifest.yaml`, claude `stop` chain),
  so the comments told a reviewer auditing default-off that the hook was
  still inert.
- Source-of-truth pointer drift: `src/agent-src/README.md` and the
  `agents-md-thin-root` skill named the retired `.agent-src.uncondensed/`
  tree; corrected to `src/`.
- **Embed-contract docs completed + de-drifted**
  ([`docs/contracts/local-server-ports.md`](docs/contracts/local-server-ports.md),
  [`docs/contracts/local-server-api.md`](docs/contracts/local-server-api.md)):
  the host-facing contract now carries the framing-DENY council reasoning, the
  `local-server.json` discovery-file rules (`url` embeds `?token=` — hosts
  rebuild from `port` + a fresh token read; `0600` is a contract invariant),
  the `?token=` accepted-risk statement, the wizard-out-of-scope-for-embed-v1
  note, and a Host-lifecycle section (idle-shutdown watchdog + keepalive,
  headless refusal). `local-server-api.md` had three stale claims corrected:
  the token IS persisted (`local-server.token`, mode `0600`) — not
  "never written to disk"; headless `ui:serve` refuses with exit 2 — it does
  not silently boot browserless; the ping example now shows the
  `capabilities` block. Plus an explicit `capabilities.embed` assertion in
  `tests/server/app.test.ts`. Closes `road-to-ac-embeddable-gui`.

> The former "6.0.0 at a glance" overview was drained on 2026-07-21 to
> [`docs/archive/CHANGELOG-6.0.0-overview.md`](docs/archive/CHANGELOG-6.0.0-overview.md).

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

# Era: 14.14.x — current

> Started at `14.14.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.15.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.14.0](https://github.com/event4u-app/agent-config/compare/14.13.0...14.14.0) (2026-09-02)

### Release highlights

- **Behaviour changes:** `lint_code_comments` becomes a blocking source gate — comment discipline was claimed by two rules and enforced by neither, and it now reds the build on the authored tree (448f31f; the blind spots its first real corpus exposed are closed in 6edf1ad). Authoring-side only: no rule, skill, or command was removed or renamed in this span.
- **Default changes + migration:** _none_
- **Security and correctness:** No security-scoped fix in this span. One correctness fix reaches shipped behaviour — the language-pin carrier now skips host-injected wrapper regions instead of ending the human lead on them (27f3233). The other ten repair gates, fixtures, locks, typing and pinned evidence in the evolution harness and its records (6edf1ad, 9411964, 0c7fce0, ecf05c4, 32203ec, 01de2a3, f87eb79, 04a5a0b, 25647d0, 92549c4).
- **Honest nulls:** _none_
- **Known limitations:** _none_

### Features

* **gates:** enforce comment discipline in source, where two rules claimed it and neither could (#1806) ([448f31f](https://github.com/event4u-app/agent-config/commit/448f31ff8b3ef3752283d877bd68975dc6eaca1d))
* **council:** read-only retention probe for council artefacts ([1ac4a53](https://github.com/event4u-app/agent-config/commit/1ac4a53f118d190fa38bb1f282f225412ddb614d))
* **council:** corpus assembler for the provider-leakage bench ([f287afd](https://github.com/event4u-app/agent-config/commit/f287afd6c4ecc11eaec7cbb57a72cac58dffaad8))
* **harness:** lexical shortlist over the BM25 core, as a tie-break the matcher outranks ([ef9d74b](https://github.com/event4u-app/agent-config/commit/ef9d74b6669537e5425b4dcc42fbeaf79fd94004))
* **harness:** derive the index input set from the 5.1 verdict, closes 6.5 ([dce00d9](https://github.com/event4u-app/agent-config/commit/dce00d9a972062b4f5666ba7160d849303734e87))
* **harness:** measure delivery sets and set compatibility, closes 6.4 ([b7aafbb](https://github.com/event4u-app/agent-config/commit/b7aafbb3b3fe8b32d9a0d5fe6d22d6c8aefe4a4d))
* **harness:** run report with a mandatory evolution-ROI figure, and a cheapest-first model ladder ([83f1006](https://github.com/event4u-app/agent-config/commit/83f1006fedab78f364ddf8a11e39f36081bab3d4))
* **harness:** measure the description-vs-body routing signal, closes 5.1 ([a86bd89](https://github.com/event4u-app/agent-config/commit/a86bd899c5b32b8cee00e78e144695a0deac69bb))
* **harness:** deterministic evaluation cascade, wired into the runner ([211477d](https://github.com/event4u-app/agent-config/commit/211477d38819432ae4c4783ffddb122ff705da50))
* **harness:** pathology archive per WHERE x WHY cell, closes 4.4 ([c0fdd42](https://github.com/event4u-app/agent-config/commit/c0fdd42b1172c4f0664f906f920d1210c9174845))
* **council:** free explain mode for routing, with the unanswerable field marked ([07a717a](https://github.com/event4u-app/agent-config/commit/07a717afe8f259ed21564c1d67764da46922d045))
* **council:** route record for decision replay, with the one field that cannot exist ([f0954ed](https://github.com/event4u-app/agent-config/commit/f0954eddad2c024bafe0808fc38924f0a4e8caaa))
* **harness:** the promotion bridge mechanism — steps 7.1 through 7.7 ([ad0962f](https://github.com/event4u-app/agent-config/commit/ad0962f2e546fd87d77a1ad37cc570f6c6f1fbd7))
* **council:** one synthesis-strategy interface behind the five candidates ([b1e6001](https://github.com/event4u-app/agent-config/commit/b1e6001ac4a3d62e4a50c3d1b0100354cdbd0ffa))
* **council:** routing training-row schema with no free-text field ([8004341](https://github.com/event4u-app/agent-config/commit/8004341005335575f0eac5cb8ad4e43e7b5fa8cc))
* **council:** deterministic expected-information-gain-per-cost scoring ([8af7598](https://github.com/event4u-app/agent-config/commit/8af759869268d7e9682e4a04bc74500b72bcc90c))
* **council:** targeted cross-examination that quotes the claim verbatim ([de4bada](https://github.com/event4u-app/agent-config/commit/de4bada83e2ba266b8b15b30ac85c5dc5d602b5c))
* **gates:** lint_promotion_paths — the promotion-path structural invariant ([13999df](https://github.com/event4u-app/agent-config/commit/13999df0e46a3f754c9e9b1b709e1a5b1ddb4146))
* **council:** reviewer budget k with a balance-feasible diversity floor ([6afb3ae](https://github.com/event4u-app/agent-config/commit/6afb3ae24f791e5e65ab5370c27fd59455ee3b0f))
* **council:** freeze the majority-laundering fixture and its retention gate ([045fb8d](https://github.com/event4u-app/agent-config/commit/045fb8dea1b0176572fe7a05bc0d6db2dcd78071))
* **council:** reconstruct re-council savings offline and settle the retention cause ([44bc2e4](https://github.com/event4u-app/agent-config/commit/44bc2e4071f15791f8a518d91c794aa177b79a65))

### Bug Fixes

* **gates:** close two blind spots lint_code_comments had on its first real corpus (#1807) ([6edf1ad](https://github.com/event4u-app/agent-config/commit/6edf1add75881f9db6a9ff293a956722c8026503))
* **language-pin:** skip host-injected wrapper regions instead of ending the human lead on them (#1800) ([27f3233](https://github.com/event4u-app/agent-config/commit/27f323304be26c3514ad66f78852c6c207d31fb9))
* **guarded-baseline:** resolve what the blockers actually permit, and record why the rest cannot close (#1786) ([9411964](https://github.com/event4u-app/agent-config/commit/9411964fb85c92777b8138494ab0042747ea3671))
* **tests:** stop a test fixture from shifting the skill-catalogue count ([0c7fce0](https://github.com/event4u-app/agent-config/commit/0c7fce0d292c015e49c05f12421431bea89cac6c))
* **roadmap:** repair five stale line anchors in the governed harness ([52e0287](https://github.com/event4u-app/agent-config/commit/52e0287af36dd0be566a426284629c4877a308e0))
* **roadmap:** record three discharged conjuncts and the retention diagnosis ([869d76a](https://github.com/event4u-app/agent-config/commit/869d76a14a205bcc8a2359d7ff47eb6c24deddaa))
* **roadmap:** repair four stale claims in the governed harness ([94f17a3](https://github.com/event4u-app/agent-config/commit/94f17a33b65e6981c9809ce639062011ee1ae929))
* **roadmap:** repair two stale claims in the promotion bridge ([c96aa53](https://github.com/event4u-app/agent-config/commit/c96aa53de58050daeca6e9624e8288cff89562d3))
* **harness:** widen the cascade's optional inputs for exactOptionalPropertyTypes ([ecf05c4](https://github.com/event4u-app/agent-config/commit/ecf05c4c6cf5ea10d31428a2d946a9b15451c985))
* **harness:** repair two type errors the branch merge introduced ([32203ec](https://github.com/event4u-app/agent-config/commit/32203ec34a28effdee62f23fc035c160261d2850))
* **test:** take the shared clones lock, and close AC-10b at completion ([01de2a3](https://github.com/event4u-app/agent-config/commit/01de2a3ddac14dc1027702e1575105a3d8ccf373))
* **test:** scope the cascade end-to-end case so it stops breaking siblings ([f87eb79](https://github.com/event4u-app/agent-config/commit/f87eb7936d141650544c998e1bcecc35f83c8e51))
* **evidence:** declare the type on the re-council savings analysis ([7280750](https://github.com/event4u-app/agent-config/commit/7280750fad20fd990de57c6aa4bf5ed5b238dcf8))
* **test:** satisfy exactOptionalPropertyTypes and readonly-array typing ([04a5a0b](https://github.com/event4u-app/agent-config/commit/04a5a0b35d5aaab3f3ee6eabc798fcb541fdce03))
* **test:** the 7.3 tripwire reddened on its own documentation ([25647d0](https://github.com/event4u-app/agent-config/commit/25647d0249c1d4a8eb2a5ba91e4bc964e7cb3000))
* **evidence:** re-pin the trigger-corpus holdout hashes and guard them ([92549c4](https://github.com/event4u-app/agent-config/commit/92549c4a9983724fc47fbb5467de325ada98a28c))

### Documentation

* **evidence:** record the council round on drain run 13's five open questions (#1792) ([b92b74e](https://github.com/event4u-app/agent-config/commit/b92b74efe7cb541df0371e15d7782b82ab3849cc))
* **evidence:** commit the pending terminal-disposition council question ([e8c17f9](https://github.com/event4u-app/agent-config/commit/e8c17f9ebed1af047494c7f6ba31b23d1875f4a5))
* correct the red-check record — the failure is intermittent, CI is green ([95a435c](https://github.com/event4u-app/agent-config/commit/95a435cfa4acc19e63a2c76844cc72e34cdef3ed))
* **evidence:** record the CI-only red check in the run-11 summary ([df02075](https://github.com/event4u-app/agent-config/commit/df02075f63e9f6431012bccbb7ac7ca0eeba7507))
* track the CI-only routing-verdict drift found by this branch ([d088d81](https://github.com/event4u-app/agent-config/commit/d088d81a11515683eb8e74cc503570eca9390915))
* **evidence:** drain run 11 summary — three PRs, one council verdict, zero descopes ([41c8925](https://github.com/event4u-app/agent-config/commit/41c8925a6d204da29fcc8602ef33dbcd222bbe37))
* **bench:** pre-register the leakage protocol and emit the Phase-2 schedule ([bde70ef](https://github.com/event4u-app/agent-config/commit/bde70efec38a240ab05e51802510894151f76a0c))
* **evidence:** drain run 10 summary — PRs, council decisions, descopes ([18af540](https://github.com/event4u-app/agent-config/commit/18af5407551588abe5878c761f555523f03d2820))
* **roadmap:** pin the 6.4 measurement commit SHA beside the prereg SHA ([e595917](https://github.com/event4u-app/agent-config/commit/e59591765f681ae5a1f22b1746cf426a3f1ec668))
* **roadmap:** re-audit AC-8 after 5.6 — shape half closed, subject half unreachable here ([41f1d4c](https://github.com/event4u-app/agent-config/commit/41f1d4cfcab5b67266fe3497016e0dda956280bc))
* **roadmap:** pin the 5.1 measurement commit SHA beside the prereg SHA ([4e9eb72](https://github.com/event4u-app/agent-config/commit/4e9eb7278fa648e7507f2eaa2c97e07a7609663d))
* **evidence:** pre-register the routing-signal and delivery-set measurements ([fe87494](https://github.com/event4u-app/agent-config/commit/fe874945812138f1f28455f4a0540b41766b8012))
* **council:** pre-register the early-stop promotion gate before either arm runs ([4f4ca01](https://github.com/event4u-app/agent-config/commit/4f4ca014a546dec9720684ce03a18ae62cb555a1))

### Refactoring

* **adr:** move the reopen-authority vocabulary into the shared reader ([cb81e2d](https://github.com/event4u-app/agent-config/commit/cb81e2dd1abf926c8e969d74b051e60479231fa9))

### Tests

* **harness:** pin the proposer survival bar, 5.4 as an absence assertion ([4cb3c4c](https://github.com/event4u-app/agent-config/commit/4cb3c4c37eb6f5416bfc84f305949277c9c9ce16))
* **council:** pin the probe-above-council precedence as a guarded baseline ([b635f4e](https://github.com/event4u-app/agent-config/commit/b635f4efca1fedb516fcd20690114627fccdb962))
* **council:** pin the early-stop cost/quality separation as a guarded baseline ([0b4b922](https://github.com/event4u-app/agent-config/commit/0b4b92205bd80dfcca995873de8b6ad9499fe1b7))

### Chores

* **deps-dev:** bump @cloudflare/workers-types from 5.20260819.1 to 5.20260829.1 in /deploy/telemetry-worker in the telemetry-worker group (#1797) ([de6708b](https://github.com/event4u-app/agent-config/commit/de6708b3625aaca778d58db995183255270b0b00))
* **deps:** bump the site group in /site with 4 updates (#1798) ([044d141](https://github.com/event4u-app/agent-config/commit/044d141404b6a717beffc1c58ea6ae4dd271753f))

### Other

* complete the deferral-carry guard, and give a carrier a status that costs something (#1810) ([6641d47](https://github.com/event4u-app/agent-config/commit/6641d471993726174dde2f9d14734be8098a01fd))
* **governed-evidence:** cure F-A and F-C, and record 2A as owner-reserved (#1809) ([4ea82c2](https://github.com/event4u-app/agent-config/commit/4ea82c2f3239d4b36240108cbaf68ac2fecc5e1f))
* complete comment-enforcement-completion (#1808) ([183f9af](https://github.com/event4u-app/agent-config/commit/183f9afafa515f3619e9057b7cd9b6771b212ebe))
* complete harness-promotion-bridge (#1802) ([56c3338](https://github.com/event4u-app/agent-config/commit/56c3338557b634670f9098c913e6b907bac5809c))
* complete publication-integrity-hard-fail (#1801) ([f7fc5a1](https://github.com/event4u-app/agent-config/commit/f7fc5a135e7b8e38a6ce35f3be956ec449364bb9))
* complete blocked-quickwin-visibility (#1803) ([ef30b1f](https://github.com/event4u-app/agent-config/commit/ef30b1f3e80a03032e8ba29d272cdd97d8a6cdc8))
* **governed-evidence:** record the drain-15 1B disposition (#1804) ([7a3fe86](https://github.com/event4u-app/agent-config/commit/7a3fe8646f436449df98adbcb9e88c81763561af))
* **council-topology:** record the carrier's terminal disposition (#1805) ([31b2db2](https://github.com/event4u-app/agent-config/commit/31b2db292c8c3ce158220692d860695af7af85f9))
* **publication-integrity:** make the discarded detection refuse, and escalate the Phase 2 authority split (#1796) ([23391ae](https://github.com/event4u-app/agent-config/commit/23391aec24d4f7d47d71d1c4aeb86be46e81023c))
* **blocked-quickwin:** give stubs:due a fourth bucket, and delete the dispatcher definition that hid it (#1799) ([94000b3](https://github.com/event4u-app/agent-config/commit/94000b3bb5026fd78e788939d5cfd0b4e7ed00a6))
* **governed-evidence:** refuse the metered capture on validity, and repair six defects found proving it (#1795) ([1f6961d](https://github.com/event4u-app/agent-config/commit/1f6961da96128f7b04c9c572226c120fd59a6a2b))
* record the terminal owner-reserved disposition, and measure the unguarded carrier (#1794) ([597bf38](https://github.com/event4u-app/agent-config/commit/597bf3816d3c6212bce349b443b9b569b1967ae6))
* fix the release-head placeholder defect, and surface the quick-win the estate ratchet was holding (#1793) ([03d61a1](https://github.com/event4u-app/agent-config/commit/03d61a1161109d6704d8c9f9e528b2fe75f45511))
* **harness-bridge:** make a merge-authority refusal recordable, and record drain-13's dispositions (#1789) ([b50b272](https://github.com/event4u-app/agent-config/commit/b50b272817513325d30a2500039a379e9cd5a336))
* **governed-evidence:** close Phase 1, narrow the metered park, build Phase 2's arm and record its execution refusal (#1791) ([1e4b97b](https://github.com/event4u-app/agent-config/commit/1e4b97b286ddc4ebe6853ff588ed90efedea8661))
* **topology:** verify every deferral trigger, repair what the receiver mis-states, and record why it is not drained (#1790) ([35e1a3d](https://github.com/event4u-app/agent-config/commit/35e1a3d089f744d9dc1a2b477c80501acdc62626))
* complete road-to-governed-harness-evolution (#1785) ([0a567e9](https://github.com/event4u-app/agent-config/commit/0a567e949e7936c438d8d06db2e3b273d3f89ca7))
* close road-to-inbox-harvest-2026-08-e-council-topology-evidence (#1787) ([468eeef](https://github.com/event4u-app/agent-config/commit/468eeefc7f45af21414bf2e42de769249a84a31d))
* transfer the four governed-harness obligations to an owned receiver, and archive the source (#1788) ([50457b8](https://github.com/event4u-app/agent-config/commit/50457b898e65b2c92e4a0c6df066ff80da8ba9da))
* complete road-to-harness-promotion-bridge (#1784) ([7259c40](https://github.com/event4u-app/agent-config/commit/7259c407f46036bf88bcb2edbf8dbe9d76897cd4))
* advance road-to-inbox-harvest-2026-08-e-council-topology-evidence (#1782) ([8a9b97a](https://github.com/event4u-app/agent-config/commit/8a9b97af5485d8f96e268503ff1528051e0ef90b))
* drop two imports the merge left unused ([dae43b1](https://github.com/event4u-app/agent-config/commit/dae43b1e8785ee8ceebee6f60bc2dac0dc361b70))
* record that the merge-authority council route was refused, twice ([ba41097](https://github.com/event4u-app/agent-config/commit/ba41097eb4b15e584fcf3a0388eb771badcda638))
* harness-promotion-bridge 0/9 -> 7/9 — Phase 7 closed as mechanism, AC-9 re-audited and still open ([0040258](https://github.com/event4u-app/agent-config/commit/004025839a1528511544e5fb1ef219eb385d9ac4))
* harness-promotion-bridge — the carried condition is discharged by route 1 ([4a1e2f9](https://github.com/event4u-app/agent-config/commit/4a1e2f9163cd4e7253994f80a407dc2b9a6642a0))
* archive obligation-delivery-verification, all items disposed ([6d4dea9](https://github.com/event4u-app/agent-config/commit/6d4dea906e171fa96a9bb7e73ff2ddb3076b01ec))
* obligation-delivery closes BLOCKED-BY-ARCHITECTURE, criterion transferred not dropped ([991d4aa](https://github.com/event4u-app/agent-config/commit/991d4aa60eb5492a29bed58e5591adce82c22fd0))

Tests: 20561 (+674 since 14.13.0)

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
