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

# Era: 14.12.x — current

> Started at `14.12.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.13.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).


## [14.13.0](https://github.com/event4u-app/agent-config/compare/14.12.0...14.13.0) (2026-08-31)

### Release highlights

- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 9acdc14, af0cf0b, e9f4b31, 6a5670b, 30a75c6, 7cb1d1d +6 more.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 728d147.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 2219e00, eb4550e, e9f4b31, 60e9582, c3b0123, 2170de4 +19 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 6a5670b, 10949a3, 98325c7, af16afe.
- **Known limitations:** _none_

### Features

* **roadmap:** surface two stub counts in the dashboard header ([2a76847](https://github.com/event4u-app/agent-config/commit/2a76847d90dd964c7d4fed2046dd109a551fbbd2))
* **cli:** add stubs:due, the read-only reader over parked-roadmap frontmatter ([1e7753c](https://github.com/event4u-app/agent-config/commit/1e7753c1d41a09bb610e599a00545574fbb6b876))
* **skills:** the ranker fails loudly, and cross-skill links resolve in the tree a consumer receives ([bd4d021](https://github.com/event4u-app/agent-config/commit/bd4d021331135c20efd0fc3a85d141995f2859ab))
* **code-graph:** classify the ambiguous population, and it inverts the premise ([63777fd](https://github.com/event4u-app/agent-config/commit/63777fde0903322edc2183167f6e01f79ac401ff))
* **eval:** gate the measurement inputs, and score direction not magnitude ([031cd29](https://github.com/event4u-app/agent-config/commit/031cd2910c0580fd5aa59b306841416f3b059f17))
* **roadmap:** close skill-ecosystem-runtime-enforcement ([7d19d88](https://github.com/event4u-app/agent-config/commit/7d19d885ab453c1a7cd9f06a1e2264c5515ef767))
* roadmap:set-step — the single sanctioned writer of a checkbox glyph ([c3944c4](https://github.com/event4u-app/agent-config/commit/c3944c4c446add10e0801fefeb450fadbc4e69de))
* bounded-loop guards — atomic budget, whole-line marker, dependency halt ([34dae8d](https://github.com/event4u-app/agent-config/commit/34dae8d2c46bd6f97d0d41fdf53f371d6ab08426))
* terminal-state vocabulary, and machine-decidable retry + truncation ([f1db91c](https://github.com/event4u-app/agent-config/commit/f1db91cf3a6023a8bfafae201339333aee660700))
* projection reach, host-tool vocabulary, and two portability gates ([a894054](https://github.com/event4u-app/agent-config/commit/a894054d57aef1faeb6af81d887d71734b947790))
* runtime-wiring diagnostics — settings, router, hooks, inherited git env ([c3d2373](https://github.com/event4u-app/agent-config/commit/c3d23734b02401f2da2a880c112e3a8a99f097b8))
* lint_memory_twin_parity — the two shipped copies may not drift apart again ([ac2e5db](https://github.com/event4u-app/agent-config/commit/ac2e5dbedcbb9d59809414d779c146b862b31833))
* measure docs/ dead links, and widen check_references to the shipped root ([e3a96fe](https://github.com/event4u-app/agent-config/commit/e3a96fe3c150c16a6a9e1cd3636eb98b97481c80))
* the beta-deadline trigger as a command, plus the gate's own discrimination proof ([0d7233a](https://github.com/event4u-app/agent-config/commit/0d7233a1fbf9ac4f0406f386020e5e62d530de1f))
* lint_canonical_terms — hold the house dialect with a ratchet ([9b51665](https://github.com/event4u-app/agent-config/commit/9b51665b7ef44a1f712e67df1ca388748eba46dc))
* **hooks:** add the container-only tooling shim and its session installer ([175fe4d](https://github.com/event4u-app/agent-config/commit/175fe4dfc4641960525d946664d758dd71e3331e))
* **gates:** give check_beta_review_markers a floor, behind a no-growth ratchet ([ac0612b](https://github.com/event4u-app/agent-config/commit/ac0612b4c236741fc0124ff0204f7fbad5b51931))
* **config:** record the canonical term map — American, sweep NOT authorised ([6a2000b](https://github.com/event4u-app/agent-config/commit/6a2000bc8f366319bec5fc84650e946be625a52b))
* **config:** extract the drafting-channel enum into a validated data file ([efbb8c9](https://github.com/event4u-app/agent-config/commit/efbb8c956254ccfe5a69da0787844f23bc7e6abe))

### Bug Fixes

* **deps:** bump js-yaml from 5.3.0 to 5.4.1 in the npm-production group (#1766) ([a7ead3d](https://github.com/event4u-app/agent-config/commit/a7ead3d19025efa5f757846cb393078ab583e37f))
* **ci:** exempt bot-generated body and commit text from the off-tree metadata gate (#1768) ([2219e00](https://github.com/event4u-app/agent-config/commit/2219e005f1444694c9653b4bf23b307e6f019df1))
* **drain:** six defects a neutral review found in code that had just merged green (#1723) ([eb4550e](https://github.com/event4u-app/agent-config/commit/eb4550ed78cb89e659ca7c68c8e11f552e8dacee))
* **bench:** the void class was a scorer artifact — and the +89 pp fix for it was one too (#1711) ([60e9582](https://github.com/event4u-app/agent-config/commit/60e95826ac63212801b04e4a8681a761c4a064fd))
* **contracts:** the two value contracts lapsed yesterday and blocked every PR (#1710) ([0887651](https://github.com/event4u-app/agent-config/commit/0887651748d11a0cb22410ffc5bb2ea23264026e))
* **gate:** the supervision pattern matched a denial, and six more review findings (#1702) ([c3b0123](https://github.com/event4u-app/agent-config/commit/c3b0123f737cd53337a780430ac64e91e69e5546))
* **council:** a subscription-CLI answer costs nothing, and cost_usd_actual said otherwise (#1695) ([2170de4](https://github.com/event4u-app/agent-config/commit/2170de4539a9b34a084636cf0b46d4e8d5f14667))
* **contracts:** review the three beta deadlines that lapsed on 2026-08-26 (#1687) ([258d1a1](https://github.com/event4u-app/agent-config/commit/258d1a1bdeedd39eb86278acdee67aa5ae28a9dd))
* **roadmap:** mark the deliberately-nonexistent path with ref-ignore ([7e53be5](https://github.com/event4u-app/agent-config/commit/7e53be5813aba7960e7847179075372f24dff70f))
* **adr:** regenerate the ADR index so ADR-246 has its row ([163b0bb](https://github.com/event4u-app/agent-config/commit/163b0bb9f4301e98e28f70913f7d70b0297f386a))
* **adr:** ADR-246 gains its Evidence section, and the context shrinks back under its ceiling ([df20eae](https://github.com/event4u-app/agent-config/commit/df20eae32e72fff00d8c66f9fba20eb08d97b769))
* lower the source-size baseline to the live total, as its own test requires ([42946ec](https://github.com/event4u-app/agent-config/commit/42946ec3c0479722853969ffc26b030c5ae4d76b))
* **ci:** resolve the consistency-workflow conflict the merge left behind ([0b90410](https://github.com/event4u-app/agent-config/commit/0b90410dd9033de324e260f069c49888d8843f78))
* **evidence:** declare the evidence type on both analysis artifacts ([06ce4e8](https://github.com/event4u-app/agent-config/commit/06ce4e8ad347b1747ebb0bc62340d183123d71e0))
* four branch-only CI reds, each a real contract break ([3fa9718](https://github.com/event4u-app/agent-config/commit/3fa9718bfc33fc1e0c8ed90aa0e36a8e0db027ab))
* three CI reds this branch introduced, each a real contract break ([e473906](https://github.com/event4u-app/agent-config/commit/e473906449a7e4b148421a0dbad0be4081422af6))
* the dependency-halt rung shipped dead, and the wiring is now tested ([8828288](https://github.com/event4u-app/agent-config/commit/88282887fdbb0b8fb8f533279c874665e14e9b09))
* **test:** memory_signal snapshots gain the restored subject key ([565ab7a](https://github.com/event4u-app/agent-config/commit/565ab7a4b0c5b43254190b2b2a37dc77dbfc2eec))
* **memory_lookup:** the template retrieved deprecated and stale memory ([4fac3a7](https://github.com/event4u-app/agent-config/commit/4fac3a727538877e92358d02322c3382d90a41d1))
* **check_memory_proposal:** reconcile BOTH ways — 45 non-comment lines to 12 ([0a8d6ad](https://github.com/event4u-app/agent-config/commit/0a8d6ad75868deed26b6fd1ea62486c4787a2cb5))
* **check_memory:** reconcile the template snapshot — 195 non-comment lines to 18 ([c2a2ea5](https://github.com/event4u-app/agent-config/commit/c2a2ea51d771066010cdfaf6778494b8061a0705))
* **memory_signal:** the template was missing ADR-130's provenance gate entirely ([126da11](https://github.com/event4u-app/agent-config/commit/126da113012f291949e576c1654aba6185e407fb))
* drop the retired-container literal from the measurement docstring ([aed43b9](https://github.com/event4u-app/agent-config/commit/aed43b9c8d8b64a849d219b81769a224a1db1f90))
* close the two failures this branch introduced ([7fd0acf](https://github.com/event4u-app/agent-config/commit/7fd0acf1259f56b7d0f108b33fc5d6134c1dc70d))
* raise the routing-coverage skills seed to the live 0.3144 ([50b661b](https://github.com/event4u-app/agent-config/commit/50b661bf142ee66b28a9ac3bcddb4c458d112af3))
* repair every dead link in shipped docs, and the .py migration class ([728d147](https://github.com/event4u-app/agent-config/commit/728d1474abf6321d9d2a1fc8bc213b4f95a89edc))
* eight docs/contracts files were missing the required stability frontmatter ([87b3187](https://github.com/event4u-app/agent-config/commit/87b3187110c541cf0e44f9c6af43eb337024ba17))
* agents/tickets/symptoms is not a ticket bundle ([73b9941](https://github.com/event4u-app/agent-config/commit/73b994156f25e9efc931be50dc3ff9efb5982cd9))
* close the stale newInThisChange flag on lapsed-beta-baseline ([3f4f6c6](https://github.com/event4u-app/agent-config/commit/3f4f6c64c28407bad4091c801ab2e50feeae6ba2))
* tighten the trigger-eval presence ratchet to green ([e039391](https://github.com/event4u-app/agent-config/commit/e039391c663b8cc85ee466c374d52af45ca6a8dc))
* state py_format's live contract instead of fidelity to a deleted original ([e59255a](https://github.com/event4u-app/agent-config/commit/e59255aea9ce928a77c775cc5481bdc9da4c51e7))
* give the local preamble-payload task the same ceiling CI uses ([f61714f](https://github.com/event4u-app/agent-config/commit/f61714f58ca5a8bdf6a1c49405b39ded093902b6))
* drop the retired-container literal from lint_canonical_terms ([55e18e5](https://github.com/event4u-app/agent-config/commit/55e18e5c68a3f073191ec5a68f0de491e66c5c82))
* restore check_gate_completeness to its baseline — four ledger adoptions ([90e87f5](https://github.com/event4u-app/agent-config/commit/90e87f5445e63e36076f02c29706568b63ed7d9d))
* **gates:** declare the lapsed-beta baseline in SUPPRESSION_INVENTORY ([fedacbd](https://github.com/event4u-app/agent-config/commit/fedacbda61aa7975f4a2c65d6f0139ee3bc4f4cf))
* **test:** satisfy tsc in the drafting-channel schema test ([079ed87](https://github.com/event4u-app/agent-config/commit/079ed87b8192c645e03a7b9b1b7cc7a84236bc5e))

### Documentation

* **evidence:** record the second 2026-08-30 PR-drain run (#1738) ([ef6ff88](https://github.com/event4u-app/agent-config/commit/ef6ff8848dc289598906fab72733baa281d9155f))
* **evidence:** record the 2026-08-30 PR-drain run (#1732) ([5162341](https://github.com/event4u-app/agent-config/commit/51623415d168360e2620d8f18daf8e925e39ebca))
* **evidence:** the estate/payload ratchet collision that blocks the ERD landing (#1694) ([7ee3682](https://github.com/event4u-app/agent-config/commit/7ee368224b4a7bbdfcbff8360d15f9aa6bcd7ece))
* **evidence:** record the 2026-08-27 PR-drain run (#1690) ([5a8f6b5](https://github.com/event4u-app/agent-config/commit/5a8f6b592ecf809eed64d902174cbc808bb4b5ac))
* **evidence:** citable skipped parents, decidable kernel decisions (#1680) ([0be1cf6](https://github.com/event4u-app/agent-config/commit/0be1cf6b797d68e9461c44a120f3ce2c8956bea4))
* **evidence:** record the 2026-08-26 PR-drain run (#1678) ([3738c23](https://github.com/event4u-app/agent-config/commit/3738c23e31c021efc3469b431509679304c31319))
* **roadmaps:** four database-mastery roadmaps from a verified inbox drop (#1676) ([82e47ce](https://github.com/event4u-app/agent-config/commit/82e47cefcf869ec29d9a9dc4212b5b03daed89af))
* **roadmaps:** stop the three-tree sample from doing priority work (#1674) ([2d7cca0](https://github.com/event4u-app/agent-config/commit/2d7cca0b91593f6009082ff567940008b588e8ba))
* **roadmaps:** road-to-consumer-repo-reality — findings from three consumer trees (#1672) ([0fcec0f](https://github.com/event4u-app/agent-config/commit/0fcec0f884b704b36f5cb0f14e6b26dcf1bdebaa))
* **governance:** register four owner-reserved decisions, two without a position ([3c89b24](https://github.com/event4u-app/agent-config/commit/3c89b2480bf5615083e14fa2eb0e5b42f9252597))
* **stubs:** give every parked file a next-read date and a findable probe ([c8c8aed](https://github.com/event4u-app/agent-config/commit/c8c8aed936c6e43a9f3346fb47e48da5896a1bd9))
* **roadmap:** consolidate four test-first proposals into one verified roadmap ([d35f93b](https://github.com/event4u-app/agent-config/commit/d35f93b7761e14c5075efb973c7000b1be8c0600))
* **roadmap:** the two blocked items are OPEN, not deferred ([537a3b7](https://github.com/event4u-app/agent-config/commit/537a3b737fdc394db1f185458ad4df9a33e21371))
* **roadmap:** kernel invariant remedy decided; clause 1 is human-only ([ef80f0f](https://github.com/event4u-app/agent-config/commit/ef80f0f022fdbbfcb438cc3a0d8f8ba4dac9c852))
* **roadmaps:** activate the three 2026-08-26 inbox-drain roadmaps ([e8b2376](https://github.com/event4u-app/agent-config/commit/e8b2376c4dc3acb534c94a9fa2eda0cf6c913be2))
* **roadmaps:** land three roadmaps from the 2026-08-26 inbox drain ([af16afe](https://github.com/event4u-app/agent-config/commit/af16afed3650b6d8ae0acc3c3db88979444ca4d2))
* close road-to-memory-twin-reconciliation ([63e562e](https://github.com/event4u-app/agent-config/commit/63e562e3eae3f5cc706971a8e0563a2941b706a7))
* evidence + close road-to-contract-review-deadlines ([4125cbf](https://github.com/event4u-app/agent-config/commit/4125cbfaa484f21cefc83100565bcd240a939234))
* track the kernel-invariant loss check_rule_invariants found ([959be63](https://github.com/event4u-app/agent-config/commit/959be63829bc850ebba9a2772148959a829a42c4))
* classified canonical-terms inventory + close road-to-canonical-terms ([2166c47](https://github.com/event4u-app/agent-config/commit/2166c47f2a77e247d71c3aee2dd39bd08786e362))
* **contracts:** record the hook performance doctrine and marker convention ([be78af0](https://github.com/event4u-app/agent-config/commit/be78af0258987455c1e2bb607743ff36f513d3a0))
* **contracts:** record the lapsed-beta decision and close the 25% trigger ([2df5d26](https://github.com/event4u-app/agent-config/commit/2df5d26299f6758f30b383b0c1a3db66e5a87848))
* **evidence:** inventory the 86 lapsed beta contracts with a proposed disposition ([3f4675f](https://github.com/event4u-app/agent-config/commit/3f4675f39b396f6de2b546c53dcde2c08fd40956))
* **evidence:** correct the wording baseline — the aggregate hides a scope effect ([0cd54f3](https://github.com/event4u-app/agent-config/commit/0cd54f3ee4924e368915d7c41acc5f2cc2f8ad73))
* **decisions:** B4 regeneration-writer architecture decision packet ([42866e1](https://github.com/event4u-app/agent-config/commit/42866e1314ac5b99f654955b5effaf235feca642))
* **brand-asset-generation:** name the platform-cover surface class ([764fcff](https://github.com/event4u-app/agent-config/commit/764fcff4592750cf3bfaed5b1dc74538f6a902db))
* **brand-audit:** exclude profile surfaces, and constrain platform guidance ([e6e808c](https://github.com/event4u-app/agent-config/commit/e6e808ca5188f9c4f8a0f2c9647a7b5da9ac664a))
* **contracts:** extend write-engine's beta window to 2026-09-24 ([b72c3b2](https://github.com/event4u-app/agent-config/commit/b72c3b2b3b286f3f7677a1edbddb7bbe9c747e7d))
* **gtm:** point the two --channel surfaces at the data file ([e5c1203](https://github.com/event4u-app/agent-config/commit/e5c12035b89b3cf9a6bb5a93e23037b755564983))

### Refactoring

* **roadmap:** extract the stub header fragment to pay the size ratchet ([b6d9707](https://github.com/event4u-app/agent-config/commit/b6d9707717ecfed8121928929c3509d2e381a99e))
* extract the markdown prose classifier into _lib/md_prose_lines ([bac7c17](https://github.com/event4u-app/agent-config/commit/bac7c17e6b87a5ca511522238a169bb39ff96be6))

### Chores

* **deps-dev:** bump the npm-development group with 5 updates (#1767) ([56f102c](https://github.com/event4u-app/agent-config/commit/56f102c623573760e40d34dc4dde019abf5c5a21))
* **stubs:** give the merged-in benchmark-rerun stub its review_by date ([49d6d0c](https://github.com/event4u-app/agent-config/commit/49d6d0c42cfd42c7713f38247a6be7333574780e))
* regenerate the ADR evidence census ([25120db](https://github.com/event4u-app/agent-config/commit/25120dbd695fbf86748667f12a76d14f09fe33f7))
* register lint_memory_twin_parity on all four surfaces ([98f65a7](https://github.com/event4u-app/agent-config/commit/98f65a7fc54618f72ef677ded753b78ad46f35aa))
* put the beta-deadline gate where a pull request can see it ([dfdc45c](https://github.com/event4u-app/agent-config/commit/dfdc45cfbeda01973a452e69795ac109e65b0c74))
* regenerate the stale settings reference ([853ec23](https://github.com/event4u-app/agent-config/commit/853ec23f1d558d7eb28789da8b8b299c8130071a))
* regenerate the stale ownership matrix ([dad0264](https://github.com/event4u-app/agent-config/commit/dad0264e7981537833379f88888b9d368940477a))
* re-pin .secret-allow after the gate-coverage row landed ([d525f05](https://github.com/event4u-app/agent-config/commit/d525f05df8986263cf242798dba4df4bd3fa28f1))
* regenerate agents/index.md ([fca4e8a](https://github.com/event4u-app/agent-config/commit/fca4e8a6b28a10e8994a18576c1d30af69900f2e))
* archive road-to-canonical-terms ([ba6efd4](https://github.com/event4u-app/agent-config/commit/ba6efd407d0f3b326f747fb124b7c542b5d8755f))
* bounded canonical-terms pilot — 18 occurrences, 12 files ([0b3d0b6](https://github.com/event4u-app/agent-config/commit/0b3d0b6dd650becb356e08d53a44707953371fd7))
* register lint_canonical_terms on all four surfaces ([dc44ba4](https://github.com/event4u-app/agent-config/commit/dc44ba47ab3112c78d270084d04347324e746c19))
* **roadmaps:** park episode-finalizer-v2, descope its two rate steps ([69a5cc4](https://github.com/event4u-app/agent-config/commit/69a5cc4c12f7facdd42e97be8113896f9c2c07c9))
* **roadmaps:** re-review the memory-twin risk register ([f5b29ba](https://github.com/event4u-app/agent-config/commit/f5b29baec329228f2624c41136d3407dfb77fba0))
* **roadmaps:** memory-twin — release class decided, two twins characterised ([78df05d](https://github.com/event4u-app/agent-config/commit/78df05d916de2c9ea0d4a33b8591ea16a23c60a3))
* **roadmaps:** resolve both blockers and land Phase 1 of runtime-enforcement ([ec59527](https://github.com/event4u-app/agent-config/commit/ec5952771b57658d05ed87227dbe4cd1d6547adf))
* **roadmaps:** stamp the risk re-review at 2026-08-26 ([c398d94](https://github.com/event4u-app/agent-config/commit/c398d94d5ec55b6beb1b5ffb0959fccf86a33936))
* **roadmaps:** re-review the contract-review-deadlines risk register ([40400a0](https://github.com/event4u-app/agent-config/commit/40400a02a8d1123bb5d599a2274cc272aa0186e5))
* **evidence:** declare the inventory's artifact type ([ae898c9](https://github.com/event4u-app/agent-config/commit/ae898c9cec6a8d2f75761e0dd836392eca00cc2d))
* **roadmaps:** close Phase 0 and Phase 1 of contract-review-deadlines ([14c4efa](https://github.com/event4u-app/agent-config/commit/14c4efa1c1764f5132fcd8f0ee97878de918a85e))
* **roadmaps:** decide all three deferred decisions in canonical-terms ([4e757ca](https://github.com/event4u-app/agent-config/commit/4e757ca1b1b6cc0f1f82a28d4e309dd659a1c0f4))
* **roadmaps:** park merge-surface-zero to later/, split step 3.1 ([261dd03](https://github.com/event4u-app/agent-config/commit/261dd0342de311b4d8662fff5f42202208d9769d))
* **sync:** regenerate dist projection and pack token passport ([10d003d](https://github.com/event4u-app/agent-config/commit/10d003dd6a7a9087100de060d73f461b37551778))
* **roadmaps:** archive channel-contract-and-profile-drift ([fedcd0b](https://github.com/event4u-app/agent-config/commit/fedcd0bb58efd0b39e93014a36829bd8c3c6619e))
* **roadmaps:** close channel-contract-and-profile-drift ([a169f0f](https://github.com/event4u-app/agent-config/commit/a169f0f7cba37d99eca08929d5641b518997a2d5))
* **roadmaps:** track the trigger-eval presence ratchet, 18 violations ([50da57c](https://github.com/event4u-app/agent-config/commit/50da57cee3d55ce9a4018e0250bff609f256a4b8))
* **roadmaps:** archive web-launch-readiness ([59089c9](https://github.com/event4u-app/agent-config/commit/59089c9d5643892a96dd77efe88769f6495d5fc6))
* **roadmaps:** close web-launch-readiness by approved rescope ([86543cb](https://github.com/event4u-app/agent-config/commit/86543cb11bb9a54b6ef958e025bf0e024ee6d121))
* **roadmaps:** activate nine workable roadmaps out of draft ([548a891](https://github.com/event4u-app/agent-config/commit/548a891cbef214749cdb693dac5312d0484847d5))
* **roadmaps:** un-park the two verification-track roadmaps whose slot freed ([3452528](https://github.com/event4u-app/agent-config/commit/34525288ee135a8068fc87cd7bb3590cdb987d37))

### Other

* council-topology 27/77 → 28/77 — a precedent settled and machine-enforced, a blocker falsified, a hidden condition carried (#1772) ([9231837](https://github.com/event4u-app/agent-config/commit/92318379afb33806f8447f142155bd8a12ab12b1))
* governed-harness — two false claims corrected, one objection discharged, one candidate rejected (#1771) ([d9e1d7c](https://github.com/event4u-app/agent-config/commit/d9e1d7cbce6858e455c84bdad8d8a6a5c3269c98))
* harness-promotion-bridge — the carried non-promotion condition is adjudicated, NOT discharged (#1770) ([8cc1c90](https://github.com/event4u-app/agent-config/commit/8cc1c90722e2b1d0d866ee6fdce6ad4056979dc2))
* obligation-delivery 1.1 answered — delivery is architecturally blocked, with the number behind it (#1769) ([302f7f7](https://github.com/event4u-app/agent-config/commit/302f7f712d127e9cf55d46b8126e9052977b8189))
* council-topology 18/77 to 26/77 — Phase 4 null-closed, Phase 2 costed at 20 UTC days (council 2/2) (#1765) ([8574cc3](https://github.com/event4u-app/agent-config/commit/8574cc3f7f7b404c94d7f39c1b7e2bec5410b87a))
* governed-harness Phases 4-6 (9 steps), AC audit, and the Phase 7 split (council 2/2) (#1764) ([2e9f75d](https://github.com/event4u-app/agent-config/commit/2e9f75d5546b9d15b11b5b16871453591e01f7d3))
* complete road-to-turnaround-followups (transfer + archive, council 2/2 x2) (#1763) ([7b4411e](https://github.com/event4u-app/agent-config/commit/7b4411e03e4236ec8e15764a28b03c79cd316f31))
* drain run-7 record, and a resume probe that fires on a reference (#1762) ([60ad56b](https://github.com/event4u-app/agent-config/commit/60ad56b7cbca9ed41b3e955333b0f5aeffc30775))
* governed-harness Phase 0 (8/8) and Phase 3 (6/6) — guard call sites close the split blocker (#1761) ([ac25013](https://github.com/event4u-app/agent-config/commit/ac2501313959a63c99e5b37fd0dccb7d7971db8a))
* council-topology Phase 3 (4/6) — independence and judge-bias hardening (#1760) ([ccd4c45](https://github.com/event4u-app/agent-config/commit/ccd4c451ee169a66c7ddb0a10a0ce4ce625e70f4))
* turnaround-followups — 2.1 closed on ADR-251, 1.1 deferred with an owner (#1759) ([cf968bb](https://github.com/event4u-app/agent-config/commit/cf968bb5eb6f17d07c92a502b6a04c80258edbbe))
* drain run-6 record — five PRs, eighteen review findings, no descopes (#1758) ([de939f7](https://github.com/event4u-app/agent-config/commit/de939f769ff41b30271d62d60c5caefa54e7c99b))
* council-topology Phase 1B (2/4) + the seven completion-review findings (#1757) ([7f58126](https://github.com/event4u-app/agent-config/commit/7f58126297fb5650435d10dd01bbf90edf8e57a0))
* governed-harness-evolution Phase 2 (5/5) + the six completion-review findings (#1755) ([34318f7](https://github.com/event4u-app/agent-config/commit/34318f7f546ae8e06816b7f1eb15d47dad735951))
* turnaround-followups Phase 3 — emit Claude host-form rules on the install path (#1756) ([c96fc9b](https://github.com/event4u-app/agent-config/commit/c96fc9b8b75816e70aca906a986883805fe6a3b4))
* park capability-native-execution in later/ (split council, conservative side) (#1754) ([7b57734](https://github.com/event4u-app/agent-config/commit/7b57734cf5129706d2d7f3f1f49d030aee455e12))
* complete road-to-agent-turnaround (MERGE disposition, council 2/2) (#1753) ([99718e0](https://github.com/event4u-app/agent-config/commit/99718e07d171086aecc979fcc0e305095008ce52))
* complete road-to-retired-claims-stay-retired (re-target — #1746 never reached main) (#1751) ([9acdc14](https://github.com/event4u-app/agent-config/commit/9acdc14d8005cdcfbfce68d2c141f9282c099873))
* governed-harness-evolution phases 0 and 1 (re-target — #1748 never reached main) (#1752) ([d126fe4](https://github.com/event4u-app/agent-config/commit/d126fe4efa2af9216bd81756368c86c58b1e7e6d))
* **capability-native:** pre-register the outcome bars — the only step AC-14 permits (#1749) ([27af583](https://github.com/event4u-app/agent-config/commit/27af58334e41c41cfaa3e685a1017d5494909361))
* **council-topology:** close Phase 0, and a re-council guard whose exact states could never fire (#1750) ([db51a05](https://github.com/event4u-app/agent-config/commit/db51a0523af94e1ae0ec402c766a63b0fa3cfda3))
* agent-turnaround — 19/21, with the two it could not close named (#1747) ([af0cf0b](https://github.com/event4u-app/agent-config/commit/af0cf0bf001758a6d117e2a09c1f5b24b883c006))
* complete road-to-gates-that-do-not-run (#1744) ([dfdea86](https://github.com/event4u-app/agent-config/commit/dfdea863f442547c2a86a1aca1b4c317beb62c5b))
* promote two executable drafts to ready (#1745) ([41e7881](https://github.com/event4u-app/agent-config/commit/41e788104ce639888b2930d389691c667a79857e))
* complete road-to-concern-admission-ratchet (#1743) ([668421a](https://github.com/event4u-app/agent-config/commit/668421a635c0b848b02118d5f5c157bfe5c55340))
* complete road-to-experience-loop-broadening (#1742) ([36d273c](https://github.com/event4u-app/agent-config/commit/36d273c89b6241e4effeb5004adb94cd382a71a9))
* **agent-turnaround:** measure why a one-file change costs 42 round-trips (#1741) ([4305a86](https://github.com/event4u-app/agent-config/commit/4305a86c323babcc7253be51786d09da3fe59fc7))
* **inbox-2026-08-g:** three roadmaps from five bundles, and the one that dropped in full (#1740) ([f9543e4](https://github.com/event4u-app/agent-config/commit/f9543e481427f87d2542dff5f952ca6b7dd1ee9a))
* **council-topology-evidence:** record the method lineage anonymously, and say which half only the maintainer can finish (#1739) ([6e37584](https://github.com/event4u-app/agent-config/commit/6e37584a172561826caa6b9246f178cd9c8226c7))
* **governed-harness-evolution:** the Phase-0 exit criterion, and the stale blocker twin that recurred in a second roadmap (#1737) ([172b87c](https://github.com/event4u-app/agent-config/commit/172b87c6a9679adbafa9f75e27762d5c80350d73))
* **capability-native-execution:** freeze the dispatch corpus, and unstall Phase 0 without deciding what only an owner may decide (#1736) ([e86e332](https://github.com/event4u-app/agent-config/commit/e86e332f191b217c87cff9cf48d6630853f7bea0))
* **experience-loop-broadening:** Phase 0 — classify every runtime component, fix two boundaries, and refuse a metric with no consumer (#1735) ([6399819](https://github.com/event4u-app/agent-config/commit/6399819a07bde0757becfd3db12d017f4743ef93))
* **source-silence-cutover:** settle the skip_paths target, ship the notices, and fix a gate that scored compliance as debt (#1733) ([970e930](https://github.com/event4u-app/agent-config/commit/970e930d098a2ccb0e48a317f2d42598f4712204))
* **supervised-telemetry-collector:** Phases 3-5, five review rounds, and the one that found the kill switch did not stop collection (#1734) ([1906516](https://github.com/event4u-app/agent-config/commit/190651687c793360fdf9630c23d86c9ac73ad4ee))
* complete source-silence (#1728) ([227b016](https://github.com/event4u-app/agent-config/commit/227b01697ff125f43fbe629d79f4e7eadec0ccb5))
* **supervised-telemetry-collector:** Phases 2-3, and two steps reported done whose check could not go red (#1730) ([97687ed](https://github.com/event4u-app/agent-config/commit/97687edc3b4ec3eccdcb33772751742d6774ebcd))
* **drain:** append the run-3 record — seven PRs, five council decisions, eight unpredicted defects (#1731) ([b59c5bd](https://github.com/event4u-app/agent-config/commit/b59c5bd00215e06b7ce111d9ea5f7b009ebd0302))
* complete journal-host-capture-measurement (#1729) ([c950592](https://github.com/event4u-app/agent-config/commit/c9505927bb1d8614ff6311bcc617f9fad57d6ea2))
* **council-topology-evidence:** pin shipped council behaviour and inventory 164 surfaces — with one reported correction rejected (#1727) ([5b91c5e](https://github.com/event4u-app/agent-config/commit/5b91c5e0ab81b49542521061faf5479be927f9c2))
* **governed-harness-evolution:** close 1.4 as a reference, not a gate — the E1 ownership matrix discharged (#1726) ([0fcf7bc](https://github.com/event4u-app/agent-config/commit/0fcf7bc8900f813921f6960cf72bfa3fc8716950))
* **capability-native-execution:** close 0.4, and a stale blocker field that was holding lint_roadmap_blockers green (#1725) ([d6edc4f](https://github.com/event4u-app/agent-config/commit/d6edc4fe8a9ceb81413b751d51a97224e4394880))
* **experience-loop-broadening:** bind the three outcome vocabularies, and two contract claims that were false since PR #183 (#1724) ([736668a](https://github.com/event4u-app/agent-config/commit/736668a679700ec63eae03d2b04e441b9d8c63cb))
* **journal-host-capture:** a denominator exists after all — both blockers closed on measurement (#1722) ([63d06b7](https://github.com/event4u-app/agent-config/commit/63d06b7eb2c4c6b62ce0e9ed02d3a8ddd11d2ba6))
* **telemetry-collector:** the data contract, and a blocker that stays open after its decision (#1721) ([1468231](https://github.com/event4u-app/agent-config/commit/1468231fa2fae5a90d43a2c1a7d556419573015b))
* **source-silence:** write-time redaction, and a council that refused the convenient fix (#1720) ([8650a70](https://github.com/event4u-app/agent-config/commit/8650a700d7c735d985488bbb4fff110ff179c263))
* **council-topology-evidence:** lock the one-resolver invariant — six review rounds, four implementations killed (#1719) ([dc14a98](https://github.com/event4u-app/agent-config/commit/dc14a984e76e380a2d41c30e584e311e8c68fd29))
* **experience-loop-broadening:** two blockers no gate could see, and an estate argument that was a ratchet invariant (#1716) ([b7b2bf0](https://github.com/event4u-app/agent-config/commit/b7b2bf02f483a01184e05206d94ac17ec5e3a8cf))
* **supervised-telemetry-collector:** Phase 1 closed, and a blocker that read resolved but was not (#1714) ([df8ab5c](https://github.com/event4u-app/agent-config/commit/df8ab5c68690a0bd9ccb39661f1fcd14ada31a9f))
* **governed-harness-evolution:** a blocker no gate could see, and the ownership matrix E1 required and never wrote (#1718) ([4ed0b7d](https://github.com/event4u-app/agent-config/commit/4ed0b7dea15f613d9efa5dfa934c938ca38aab89))
* **capability-native-execution:** one blocker closed, one split — plus two false premises and a verify that could never pass (#1717) ([9470d3e](https://github.com/event4u-app/agent-config/commit/9470d3e98cdcbc71b52f0baa6061c0dc9a967cdf))
* PR drain run summary, 2026-08-29 (#1715) ([919c943](https://github.com/event4u-app/agent-config/commit/919c943ab69458d1d758f27b57eb377498d1a44b))
* a lock superseded the same day, and the shape ratchet main went red on between two green PRs (#1713) ([b9019f1](https://github.com/event4u-app/agent-config/commit/b9019f1ad2774d15983e5ec427fd5d8dc847ca6a))
* complete runtime-event-journal — the carry was to a stub, and a stub is not a receiver (#1712) ([7a2a6f8](https://github.com/event4u-app/agent-config/commit/7a2a6f883444a466be45a6f7f7a5f03e5157d360))
* **source-silence:** the census, the shape gate, and a security gate that was in no workflow (#1707) ([e9f4b31](https://github.com/event4u-app/agent-config/commit/e9f4b318b7991d87a1b6d4324cd64f7782d17e29))
* runtime-event-journal — the journal, the spine, the acknowledgment, and one step honestly left open (#1706) ([7b82c6b](https://github.com/event4u-app/agent-config/commit/7b82c6b64cdbb6ec9ed3c76c5747b2494a11d382))
* **council-topology-evidence:** resolve all five blockers, and name the one that must not be descoped (#1709) ([53621b4](https://github.com/event4u-app/agent-config/commit/53621b46548d7e75fa2bf3061cd4b7ce078a8665))
* **supervised-telemetry-collector:** resolve all three blockers, and correct a false premise in one (#1708) ([53e0e78](https://github.com/event4u-app/agent-config/commit/53e0e78658b264908f833ee677bad9efce131696))
* complete code-graph-evidence-that-exists (an honest null, and the class that measured nothing) (#1705) ([6a5670b](https://github.com/event4u-app/agent-config/commit/6a5670b7881a676c0da90d2afb950298087c4ccb))
* complete runtime-context-floors (ADR-249's missing floors, two council-resolved blockers) (#1703) ([30a75c6](https://github.com/event4u-app/agent-config/commit/30a75c659caea03e2b002e50289e828d4d6ed65d))
* five ready roadmaps from three inbox rounds, and the corrections that prevented four of their steps (#1701) ([43a8193](https://github.com/event4u-app/agent-config/commit/43a819363b2cb8ddb151513c85d93dce8a94dfa7))
* complete runtime-governance-flip (ADR-249, and a second reader that found three more blockers) (#1700) ([68463a1](https://github.com/event4u-app/agent-config/commit/68463a1e0af5f4bcc7ffb23ab4d4b073ed26c67f))
* park database-evolution-tactics (three blockers resolved, all three recommendations overturned) (#1699) ([9050874](https://github.com/event4u-app/agent-config/commit/90508746354412a3dbb252a1c54c4fac2f7b9180))
* park database-relational-modeling (overlap measured at 25%, skill warranted but inadmissible) (#1698) ([c649b47](https://github.com/event4u-app/agent-config/commit/c649b476e2a0b95dc35d8bd2b43681208aad7aab))
* park database-erd-landing (skill costs 53 tokens, 4 are available) (#1697) ([fd9b01f](https://github.com/event4u-app/agent-config/commit/fd9b01feda8d0e3521377c7cc6862913db892050))
* park composition-review-false-positive-rate (measurement blocked on elapsed time) (#1696) ([8b08eff](https://github.com/event4u-app/agent-config/commit/8b08effec23002bcc8055e22e93eba69296a4ef1))
* complete executable-specification-layer (#1692) ([830e31a](https://github.com/event4u-app/agent-config/commit/830e31aa3ca7329b513b53328eadad4a92d471f7))
* complete composition-before-creation (#1693) ([7cb1d1d](https://github.com/event4u-app/agent-config/commit/7cb1d1ddfa0a67d6552d12c88461886dda377fce))
* split the daemon out of governance, and work in two rounds of council findings (#1691) ([460b620](https://github.com/event4u-app/agent-config/commit/460b6200786e8c544a53416631b34d78ab730667))
* complete consolidation-lineage-integrity (#1682) ([b547dc8](https://github.com/event4u-app/agent-config/commit/b547dc8bb74339e61ddb822b4c18d99250698e7d))
* complete undeclared-obligation-disposition (the ceiling admits no declaration) (#1689) ([bc16645](https://github.com/event4u-app/agent-config/commit/bc16645b3a03096ee0463f78a954267c9b602ba8))
* complete database-advice-correction (#1683) ([9158984](https://github.com/event4u-app/agent-config/commit/9158984474594128f51e3f372726c91edcc6a266))
* complete turn-bound-authorization-integrity (#1686) ([1beae8d](https://github.com/event4u-app/agent-config/commit/1beae8d9a17c8a5ac355b95b8c30f72f83fb034b))
* two ready roadmaps from the uncle-bob-swarm inbox, and the ADR the analysis named was the wrong one (#1688) ([d176082](https://github.com/event4u-app/agent-config/commit/d176082907bb0bbe6c35caa122b03c9d4b2d2c39))
* transfer kernel-invariant-restoration, archived as transferred (#1685) ([d26edc9](https://github.com/event4u-app/agent-config/commit/d26edc97b7820be285049ced9861661699db731b))
* complete evidence-gated-change (#1675) ([d55d1f1](https://github.com/event4u-app/agent-config/commit/d55d1f1015c5a65eae392e4a30d4d60e00a09821))
* answer the two blocking review findings on #1681, and one roadmap out of three survivors (#1684) ([f2ed85e](https://github.com/event4u-app/agent-config/commit/f2ed85ea8d437708d2234b99f5a8b67a4da972e8))
* complete consumer-repo-reality (#1679) ([10949a3](https://github.com/event4u-app/agent-config/commit/10949a37b2bd6894e39de7c728a6fd151c183739))
* two roadmaps and one promotion from the mixed-analysis inbox drain (#1681) ([612b817](https://github.com/event4u-app/agent-config/commit/612b817e7362c0633508b9420b6c168f4224bdce))
* three drafts from the evolve/evolver inbox drain (#1677) ([15447f4](https://github.com/event4u-app/agent-config/commit/15447f47f736b5cd8e570d5fca19b797ab1ce80e))
* complete inbox-harvest-f-owner-decision-queue (#1661) ([9e8344a](https://github.com/event4u-app/agent-config/commit/9e8344a3f8dddb414e710467bbf23139004e0298))
* complete decision-conformance (#1673) ([387dd3e](https://github.com/event4u-app/agent-config/commit/387dd3e680de40687cbb2fc47a5037ad081446e5))
* complete internal-estate-fit (#1669) ([1899f92](https://github.com/event4u-app/agent-config/commit/1899f92b9c1ebeaf574bb9210426d88c3201cc1b))
* complete component-granularity-vocabulary (#1671) ([e6fdfd4](https://github.com/event4u-app/agent-config/commit/e6fdfd49d182d1ae5957380230e632be9255b60f))
* park ten-across-the-board (index, predicate unevaluable) (#1670) ([d2a4fef](https://github.com/event4u-app/agent-config/commit/d2a4fefe8ae45b4ab333ddc327872a8d51ee4de4))
* complete published-number-truth (#1668) ([580cb11](https://github.com/event4u-app/agent-config/commit/580cb11381e1fab9134287c59a9ea065ffb6d865))
* complete inbox-harvest-2026-08-f-owner-decision-queue ([338f22e](https://github.com/event4u-app/agent-config/commit/338f22e578e970c863d131197393d02f4aaf359b))
* complete inbox-harvest-2026-08-f-code-graph-evidence-refresh ([98325c7](https://github.com/event4u-app/agent-config/commit/98325c70d8d2c9f521723d73d289b6b5d7daaff5))

Tests: 19887 (+2222 since 14.12.0)

## [14.12.0](https://github.com/event4u-app/agent-config/compare/14.11.0...14.12.0) (2026-08-25)

### Release highlights

- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 952e94b, cb5446e.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 10a4b2c.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 1081512, 12f7477, b0e82fd, ca4adaa, 9de9ed4, 6e839d4 +2 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 12606f7, 8898b48, 3803945, 2a67719, f224d28, c4fc798.
- **Known limitations:** _none_

### Features

* **rules:** close the enum case in downstream-changes ([cb5446e](https://github.com/event4u-app/agent-config/commit/cb5446e5bb2eff580349f81ec722028c241d3a30))
* **guidelines:** teach the taxonomy naming — the dual of an echo ([12606f7](https://github.com/event4u-app/agent-config/commit/12606f75fcc8e0a226b0b7dc677fe73a114415d8))
* **council:** the argument-exhaustion stop, with the ordering as a conjunct ([7755110](https://github.com/event4u-app/agent-config/commit/775511082b6738f43c87b2a35930202ed544bf43))
* **baselines:** one switch migrates all 18 ratchet read sites ([9df0b9b](https://github.com/event4u-app/agent-config/commit/9df0b9bb8fbca57cf57150eec0914ae4acc7f321))
* **baselines:** the ABSOLUTE invariant, read from the target commit ([3a6a668](https://github.com/event4u-app/agent-config/commit/3a6a66850f4e842a4bd55ee9efbd627f71d6e4c7))
* **web-launch:** the benchmark fixtures, and the verdict that stops short ([eee0500](https://github.com/event4u-app/agent-config/commit/eee050022f75d3eb3c806e47fd2cb4908877d47e))
* **web-launch:** the remaining eight checks, and a region axis that escalates ([627f1a2](https://github.com/event4u-app/agent-config/commit/627f1a23cf2a589cc00ce8138a06b74a46df006e))
* **guidelines:** one redundancy authority, cited at all three moments ([9df7908](https://github.com/event4u-app/agent-config/commit/9df7908899a36c6dc430ab75afe8205e54897705))
* **corpus:** enforce the routing-matrix discipline on the corpus that exists ([3803945](https://github.com/event4u-app/agent-config/commit/3803945780d3663f25318289d09cd6f35add886a))
* **routing:** a description-surface regression check a PR can afford ([7c9edc6](https://github.com/event4u-app/agent-config/commit/7c9edc6aaeff0d83a082296c03865ce5b13c2e21))
* **gates:** ratchet routing-corpus coverage per scope, not in aggregate ([707fd4f](https://github.com/event4u-app/agent-config/commit/707fd4f0269b0ca2016a463a1f0cbb07dfbb7402))
* **command:** the web-launch indexability check, default-off ([10a4b2c](https://github.com/event4u-app/agent-config/commit/10a4b2c71e917e1213a882427154620e33626ac7))
* **config:** register the web-launch site-type axis before any code exists ([e3d0e67](https://github.com/event4u-app/agent-config/commit/e3d0e67c59fdebe6cba07b8e29596e5efe6faa91))
* **sync:** classify the generated paths the census actually found conflicting ([3bbb571](https://github.com/event4u-app/agent-config/commit/3bbb571df14619922c0dd0a4dc07308e28385202))
* **script:** pr_conflict_census -- which paths actually cost merge conflicts ([ca06337](https://github.com/event4u-app/agent-config/commit/ca06337251c5f7228148db21f28681ad6fecce62))
* **gate:** a committed admission and refusal ledger for new skills ([93f2312](https://github.com/event4u-app/agent-config/commit/93f2312283f6898b6b90e29c6a7d78c8c7b271cb))
* **gate:** ratchet the skill estate on the machinery the roadmap estate uses ([5c9ab3e](https://github.com/event4u-app/agent-config/commit/5c9ab3eda97bad125d9ef6338a10989da763cd6d))
* **lib:** measure the skill corpus in two dimensions ([d3bbf83](https://github.com/event4u-app/agent-config/commit/d3bbf8300e0a1a1fe613109aba6d6bc04a103509))
* **analysis:** an improvement mode that re-reads the artefact instead of the tree ([5a78ee5](https://github.com/event4u-app/agent-config/commit/5a78ee5c3ff85f4f6625bf7d4e988400fd7b5b00))
* **context:** re-orient when the tree contradicts what you last read ([883654b](https://github.com/event4u-app/agent-config/commit/883654b989c97d1511b7ddee6ff23848b97a5f9d))
* **gate:** check_command_examples -- three sub-checks over the visible surface ([5c2be5e](https://github.com/event4u-app/agent-config/commit/5c2be5ed0d700d6c96eee4667f6aabfd695e9e02))
* **commands:** a controlled pattern vocabulary for command Why lines ([10bb45a](https://github.com/event4u-app/agent-config/commit/10bb45a3865ce27f071d989910e1da3437158af4))
* **ci:** arm the preamble payload gate on pull requests, behind a grace ceiling ([4ef90d3](https://github.com/event4u-app/agent-config/commit/4ef90d350316291d7c095e97e6d6db22cb0fb38a))
* **gate:** scan published markdown for path leakage, with a zero-unapproved floor ([0dbf252](https://github.com/event4u-app/agent-config/commit/0dbf252dea054f789161cbd4e8ab556aae37a88c))
* **hooks:** suggestion-block capture as a two-slot latch, counts only ([05e0bd4](https://github.com/event4u-app/agent-config/commit/05e0bd4ea12c1fd6fdc35c45831ca028df4b969d))
* **pack:** a behavioural global-install harness, and a branch-vs-base delta report ([c5bebfd](https://github.com/event4u-app/agent-config/commit/c5bebfd4926114be891a12e1a03d77b7ec1192de))
* **gate:** check_score_contract makes a scorecard status derived, not awarded ([4587d70](https://github.com/event4u-app/agent-config/commit/4587d70cc8ea95680a7b9b8b7037d1a3599c8567))
* **evidence:** seed the AC capability scorecard, and document a fourth register ([4d6c23d](https://github.com/event4u-app/agent-config/commit/4d6c23d68a9d79c884dcbe2f35979dc9ba6da51e))
* **skills:** branch Tailwind tokens on the css axis, correct the version surface ([810a495](https://github.com/event4u-app/agent-config/commit/810a495c24af0abade21611ee399b94e16cd9426))

### Bug Fixes

* **roadmap:** correct an arithmetically false estate claim before it lands ([f65ae48](https://github.com/event4u-app/agent-config/commit/f65ae488bde4ad6a0f18ca71db7c7cfd837ef625))
* **payload:** move the closed-set procedure out of the rule and into a guideline ([952e94b](https://github.com/event4u-app/agent-config/commit/952e94b5e4cda042efc78e647dec334a521bcdc3))
* **evidence:** pin the twin metric, and correct a number that was encoded twice ([cefd23d](https://github.com/event4u-app/agent-config/commit/cefd23d7f955856f9301bd87f26d26e6629dc859))
* **evidence:** declare the census artifact's evidence type ([85685f5](https://github.com/event4u-app/agent-config/commit/85685f574f8b48d4adfb8d1ae255b94632559652))
* **security:** re-pin the secret-allow line the new manifest row pushed down ([1081512](https://github.com/event4u-app/agent-config/commit/10815120f3b9758ce4bfb7e53ec9c262bc08be19))
* **stub:** point the transfer provenance at the archived parent ([b04093b](https://github.com/event4u-app/agent-config/commit/b04093bdd492e63b621495d1e33dfecea9dd5746))
* **skill:** the router path must resolve in a consumer install ([37fa427](https://github.com/event4u-app/agent-config/commit/37fa4271b0700fe3dcbaef46819a92a3566bdcee))
* **hook:** suggestion-capture was a silent no-op on every live dispatch ([12f7477](https://github.com/event4u-app/agent-config/commit/12f747714a1b3a4211dd733c63bd34be87b3d360))
* **ci:** a diagnostic step that says it never gates must not fail the job ([b0e82fd](https://github.com/event4u-app/agent-config/commit/b0e82fd92f58dc3db61c53aedcb2d9da4b28b3eb))
* **test:** the bucket field is `name`, not `label` ([ca4adaa](https://github.com/event4u-app/agent-config/commit/ca4adaa1af3d4cd09b0983147bcb62a3bfa85f9c))
* **gate:** govern budgets.yml by an explicit row, not a widened glob ([9de9ed4](https://github.com/event4u-app/agent-config/commit/9de9ed4e76b7750c33d9e8d47c6a1ef3bedc550a))
* **config:** the built surface is ungated by a recorded decision, and it is +8.6 MB ([ab398ed](https://github.com/event4u-app/agent-config/commit/ab398ed0507abb2bda0a449179fde03492d8dc45))
* **roadmap:** four estate offsets, and a corrected reason on each ([3c0d33f](https://github.com/event4u-app/agent-config/commit/3c0d33f28d2f083d43f8aeca44c8b055950c3517))
* **ci:** three downstream surfaces the new concern and settings key required ([6e839d4](https://github.com/event4u-app/agent-config/commit/6e839d4b8a58ae1e329781d183593c684cd8e139))
* **ci:** declare report_pack_delta CI-only, and tighten the loose parity ratchet ([a7e3324](https://github.com/event4u-app/agent-config/commit/a7e3324f5e186b620dfa116f40c3d63e4cbf9c62))
* **ci:** resolve a companion roadmap in any disposition, re-pin an audited false positive ([0665e0a](https://github.com/event4u-app/agent-config/commit/0665e0a3e1b631db5307f09e51ae6215ad5315ca))
* **evidence:** type the register index as analysis, per lint_evidence_artifacts ([c356dec](https://github.com/event4u-app/agent-config/commit/c356dec3d6f4334bb7c4083c09141b4744582f52))
* **test:** narrow the semver-major capture to satisfy strict null checks ([e2f8b80](https://github.com/event4u-app/agent-config/commit/e2f8b805060f4c7f69d674c6925c2304bc887f4c))
* **roadmap:** state the council convergence inline instead of linking it ([d3f96a7](https://github.com/event4u-app/agent-config/commit/d3f96a7231b4ca91f0feea005231e711ca4ecb97))
* **roadmap:** mark three verbatim German quotes for the language gate ([c27ec81](https://github.com/event4u-app/agent-config/commit/c27ec81a6eb6044c9d4b829f71636c3f233914cc))
* **roadmap:** correct three claims in the placeholder-guard roadmap ([c1cbd1e](https://github.com/event4u-app/agent-config/commit/c1cbd1ef184b4b765e86e5efd8f2d53d4e5ca5cc))
* **evidence:** declare the evidence type on both new analysis artifacts ([5e187b8](https://github.com/event4u-app/agent-config/commit/5e187b846b95fb44b76df1ee67c6c389023ea349))
* **roadmap:** claim the later/ growth a draft still charges, and record why ([50fc67f](https://github.com/event4u-app/agent-config/commit/50fc67f8a4a271a4f84213c5cf951c4cb7664e83))
* **roadmap:** mark three planned-deliverable paths ref-ignore ([3e6847d](https://github.com/event4u-app/agent-config/commit/3e6847d3d54547520c9e252da9bc2af7e3cfcef2))
* **roadmap:** make the growth claim a single line so the gate reads the reason ([476438c](https://github.com/event4u-app/agent-config/commit/476438c2d732f50945c56613b5a70855dbd59ff5))

### Performance

* **pack:** exclude the three payload patterns a harness proved safe, and lower the cap ([a94312a](https://github.com/event4u-app/agent-config/commit/a94312ac0a4c58dbf58cdf57040f53339b5d908c))

### Reverts

* **ci:** restore the local-only baseline to 165 — the 164 was a local reading ([f904999](https://github.com/event4u-app/agent-config/commit/f904999b17af0c6942526c7ebdd3d72645044b26))

### Documentation

* **roadmap:** resolve redundancy-governance 3.2 as a split, not one answer ([d953a45](https://github.com/event4u-app/agent-config/commit/d953a45c9c0c772c0b6c4e8fce9c8386f35e11e8))
* **evidence:** the Run E drain summary — five decisions, two declined ([8898b48](https://github.com/event4u-app/agent-config/commit/8898b480d0a2011b6a4ba228fcd6e55c3d348e18))
* **roadmap:** resolve capability-native-execution's three council-owned blockers ([232450f](https://github.com/event4u-app/agent-config/commit/232450f3b3932853b5aac4a39a8f09411205e950))
* **evidence:** measure the redundancy baseline, and correct four claims ([9c64a01](https://github.com/event4u-app/agent-config/commit/9c64a01d42eb74a7990165e2f3dd9726e69f9c12))
* **routing:** pre-register the routing-assurance metric set and its three claims ([bbcb8e7](https://github.com/event4u-app/agent-config/commit/bbcb8e7321cc346dbf8ee5e90cded856b15d67ff))
* **roadmap:** web-launch-readiness Phase 2 core -- 13 of 19, AC-1..AC-4 met ([eb52c33](https://github.com/event4u-app/agent-config/commit/eb52c33e414ca0b75d6d6d8f29587cb8556fc23b))
* **roadmap:** ten-across-the-board 1.5 -- real payload defect, not an overlap artifact ([82a207f](https://github.com/event4u-app/agent-config/commit/82a207ff567f2d463bf81e00a73cbd21d60ba00d))
* **roadmap:** the envelope DROP band never triggered -- its population says non-local ([f8cf861](https://github.com/event4u-app/agent-config/commit/f8cf861d30b108003c362b1521ee937b7e0aba28))
* **roadmap:** web-launch-readiness -- NO skill slot, the domain ships as a command ([e283045](https://github.com/event4u-app/agent-config/commit/e2830455acd9f699ad8bad86be19ecb2a8d49c92))
* **claims:** pre-register the web-launch benchmark, decoy as a hard gate ([cd48376](https://github.com/event4u-app/agent-config/commit/cd48376b109392d376e4f81b0efa0be2f2e18e5b))
* **roadmap:** merge-surface-zero -- 1.1 done, and two blockers the phase order hid ([945fec4](https://github.com/event4u-app/agent-config/commit/945fec4f97a61951c59b7929181cde9cec60648e))
* **roadmap:** close skill-estate-drawdown -- the input does not exist, the mechanism does ([57dd342](https://github.com/event4u-app/agent-config/commit/57dd342b7adcb084c6d464afd3118c6a9a59bc25))
* **roadmap:** re-anchor merge-surface-zero on history, and correct Phase 1's targets ([dc7e111](https://github.com/event4u-app/agent-config/commit/dc7e111cec7560d8e3fe1e63c6edbd6916c65940))
* **evidence:** 50% of merge-conflict resolutions are on generated paths ([2603229](https://github.com/event4u-app/agent-config/commit/26032296e401e6e4a494ff8f2509026b844efe82))
* **roadmap:** close opencode-enforcement -- three criteria transferred, archived ([2cc7a0f](https://github.com/event4u-app/agent-config/commit/2cc7a0ffd81917b59fe802cb115857126c2f1a7c))
* **roadmap:** skill-estate-drawdown Phase 3 closed -- 14 of 16, 6 of 7 ACs ([327dae4](https://github.com/event4u-app/agent-config/commit/327dae47bbb566c115fa37b75b4fba9f3298538c))
* **skill:** the skill-growth answers go in the ledger, not the PR body ([91dd259](https://github.com/event4u-app/agent-config/commit/91dd259a1cb4c99b3ae62669660786fc5b2fa9ea))
* **proof:** regenerate after the claim correction ([d140bec](https://github.com/event4u-app/agent-config/commit/d140beca77bc4fbe10a5decbc46e79b0233b6048))
* **roadmap:** skill-estate-drawdown -- three blockers resolved, Phases 1, 2, 4.2 closed ([2a67719](https://github.com/event4u-app/agent-config/commit/2a67719d7c0d68230edf3bf41f1ef38fcac19263))
* **evidence:** four historical readings of the skill estate, backfilled ([4f597fe](https://github.com/event4u-app/agent-config/commit/4f597fe911ebf081c61ed761d5a0155310a91769))
* **roadmap:** close suggestion-block-capture with two criteria transferred ([53e1bc0](https://github.com/event4u-app/agent-config/commit/53e1bc0afe635199ba7ed94bfd791fc3429c1831))
* **roadmap:** close command-surface-legibility Phase 2+3, archived ([f224d28](https://github.com/event4u-app/agent-config/commit/f224d285c66bbc0370790a8a615588f0b5e7d4da))
* **roadmap:** a first outside-in probe against a real estate, and what it refuted ([a6974ef](https://github.com/event4u-app/agent-config/commit/a6974ef61a045cafc4a3a6bc7e54fb9ed5faf347))
* **roadmap:** close standing-payload-truth, all four blockers resolved, archived ([6926279](https://github.com/event4u-app/agent-config/commit/6926279dd2831e3de3d3ee061d1b75f7b80d0ed7))
* **roadmap:** the harvest bundle's one clean phase, and a routing correction ([f3c780f](https://github.com/event4u-app/agent-config/commit/f3c780f690c6dd60cb6cb519927986ab5347cd99))
* **roadmap:** 86 lapsed contract deadlines, and the gate that checks the other way ([9e72a71](https://github.com/event4u-app/agent-config/commit/9e72a71fafe287cbe9f480c2776a2a88e8207978))
* **roadmap:** the two defects that survived the LinkedIn ask ([5b50d55](https://github.com/event4u-app/agent-config/commit/5b50d55b10209d607a61718c9fde8d7b54a65651))
* **roadmap:** one component-granularity roadmap from two atomic-design drafts ([a983799](https://github.com/event4u-app/agent-config/commit/a983799b0611784f233af98b15c2fed465638103))
* **roadmap:** two roadmaps from the hard-feedback-1 drain, defect-first ([3825824](https://github.com/event4u-app/agent-config/commit/3825824dad5e000b61f29424097351694cf7655a))
* **evidence:** the Run C drain summary, including what it did not reach ([225b775](https://github.com/event4u-app/agent-config/commit/225b77533d646fe5b02a10e825a290e886b5656f))
* **roadmap:** close command-surface Phase 0, transfer Phases 1 and 4, add a step ledger ([9697c08](https://github.com/event4u-app/agent-config/commit/9697c083fd1fc8801e8ddbf3b2a4e244f3b2e282))
* **roadmap:** close opencode Phase 0, transfer the runtime probe, replace AC-2 ([c4fc798](https://github.com/event4u-app/agent-config/commit/c4fc7983d112b1dca17e1407feed4f0eb3e4d498))
* **opencode:** the plugin channel is real, the deny is narrow, the matrix was wrong ([5cf26ad](https://github.com/event4u-app/agent-config/commit/5cf26ad69f855ba0e4e9c8b2e5812159095ec555))
* **roadmap:** transfer the soak window to a stub, and record AC-2 as OPEN ([330bcc0](https://github.com/event4u-app/agent-config/commit/330bcc078fcd1a5271a28ecd89facc4636f1094a))
* **evidence:** probe the hook payload, pre-register the claim and the schema ([e298849](https://github.com/event4u-app/agent-config/commit/e29884966f09c9d950ce0ebb58c7996ed470e3db))
* **evidence:** the per-subtree payload verdicts, each citing a harness run ([c6d69fe](https://github.com/event4u-app/agent-config/commit/c6d69fed2b99a2ff913da8234720aa16cdde26cd))
* **roadmap:** close npm-payload-reduction and archive it ([770d57c](https://github.com/event4u-app/agent-config/commit/770d57c0b77b03e8afd35071e71eb1f11c30a8e6))
* **roadmap:** close score-contract, and qualify every all-32 claim it rests on ([7a960b7](https://github.com/event4u-app/agent-config/commit/7a960b7c59642a4bc9d76bd3bc701d86ff8c1596))
* **roadmap:** revert release-placeholder-guard to a stub by council verdict ([42015b2](https://github.com/event4u-app/agent-config/commit/42015b2ab08a17b031db0c861407ee922e3a52d0))
* **evidence:** derive which release-marker surfaces are still repairable ([3ef1f1e](https://github.com/event4u-app/agent-config/commit/3ef1f1e462d0d869f1fa669a035ce80a4acacae5))
* **roadmap:** close component-library-lifecycle Phase 5 and all eight AC ([30e17d9](https://github.com/event4u-app/agent-config/commit/30e17d9c3eaf01f0114b22c6e7ede85ca3d35b0d))
* **evidence:** triage the feedback-14.11.0 bundle, land nothing from ten of it ([a718b92](https://github.com/event4u-app/agent-config/commit/a718b92071631464fd475a47b1c3fd3fc4f2f7dd))
* **roadmap:** record the estate-ratchet asymmetry, measured against this run ([bf19315](https://github.com/event4u-app/agent-config/commit/bf193155917df46c112b3ee02d5c98ecd7ee6fe1))
* **roadmap:** point the Source line at the consumed inbox file ([4531665](https://github.com/event4u-app/agent-config/commit/4531665f1f52b800cdc0a46cf06669c59d7a0ab7))
* **roadmap:** record that the stub about phantom claims emitted one ([ee62d1d](https://github.com/event4u-app/agent-config/commit/ee62d1d8f4a4c2cfab894b36307bb6d0dcaf935f))
* **roadmap:** record the folded-estate-claim defect as a stub ([ab9e9c0](https://github.com/event4u-app/agent-config/commit/ab9e9c0a2ceb666eaa1ce4a5334d09cf438adcd9))
* **roadmap:** flip npm-payload-reduction to ready, correct the cap value ([fb06b65](https://github.com/event4u-app/agent-config/commit/fb06b65f144ab15228211fd82fa0749bc80c2ee3))
* **roadmap:** close two executed roadmaps, carry four deferrals to stubs ([8e948b8](https://github.com/event4u-app/agent-config/commit/8e948b86120349af9511a3b9f277d1a58e705877))

### Tests

* **routing:** assert the seed IS the measurement, not a snapshot of it ([83a0b1f](https://github.com/event4u-app/agent-config/commit/83a0b1ff9b01cb27d2375f0b194561f00cfa23c7))
* **admissions:** assert the ledger's invariant, not its row count ([6072a45](https://github.com/event4u-app/agent-config/commit/6072a45ac772909e2ade1dbe6399f9b26f048b6b))
* **hooks:** a registry-wide signature contract, not a does-not-throw smoke ([eae5b6c](https://github.com/event4u-app/agent-config/commit/eae5b6c3c14116d8c5a66fca49a5dbfd8e85483e))
* **fixtures:** pin shadcn and Storybook majors to a real scaffold ([635defc](https://github.com/event4u-app/agent-config/commit/635defc6b54f5ffd12189296e572fc83974901c7))

### Build

* **install:** refresh the committed install bundle for the new settings key ([72725da](https://github.com/event4u-app/agent-config/commit/72725da060b66410bce3313e546d914747334130))

### CI

* **pack:** report the branch-vs-base payload delta on pull requests only ([a55a803](https://github.com/event4u-app/agent-config/commit/a55a803706ced0e37a033878e3fbce55929a3e3e))

### Chores

* **roadmap:** close redundancy-governance — two were never open, three carried ([955ed2c](https://github.com/event4u-app/agent-config/commit/955ed2caf3a289e478db632b81ba6c9b8c3a4e71))
* **index:** regenerate for the downstream-changes-mechanics guideline ([2fb27ea](https://github.com/event4u-app/agent-config/commit/2fb27ea6bcf8c5c0ecd3c587ded0a6c6ae50c97b))
* **roadmap:** record the payload ceiling as the reason 5.1 moved ([705b8de](https://github.com/event4u-app/agent-config/commit/705b8de1ce825ee1e2298fd8112409589f733503))
* **roadmap:** add Phases 4 and 5, five items deferred ([9a30ae3](https://github.com/event4u-app/agent-config/commit/9a30ae3b27c8b5ca8129965a9c3402312c3e1f2c))
* **index:** regenerate for the redundancy-taxonomy guideline ([4aeabe4](https://github.com/event4u-app/agent-config/commit/4aeabe4cb011ccfa779b786a8112379916fd9bcc))
* **roadmap:** close Phase 1-3 of redundancy-governance, one item deferred ([2822dc9](https://github.com/event4u-app/agent-config/commit/2822dc986c1fcebe6bb8d5f22f178a549cb4fe49))
* **dist:** project the 14 new skill trigger corpora ([52eec8e](https://github.com/event4u-app/agent-config/commit/52eec8e9bd850e73ea2a07ea78770dfb5d4568a5))
* **roadmap:** close routing-assurance at its own cut line, park the live half ([63ae003](https://github.com/event4u-app/agent-config/commit/63ae003b7ff4c701d0e3c651f463fda753bda2e5))
* **ci:** register check_skill_admissions, and re-pin the secret-allow line ([570242a](https://github.com/event4u-app/agent-config/commit/570242aada90ecab5b0c54a7f57726e441540c47))
* **roadmap:** archive completed road-to-score-contract ([1c43a07](https://github.com/event4u-app/agent-config/commit/1c43a0705c8a9ef48981938e5f27b1268e21f7d8))
* **roadmap:** archive completed road-to-component-library-lifecycle ([103045a](https://github.com/event4u-app/agent-config/commit/103045aa7b1a1d825fd294ecb7064cfb211d52a7))
* **deps:** bump actions/upload-artifact in the github-actions group ([daa7f21](https://github.com/event4u-app/agent-config/commit/daa7f21e7b8c7181b9ffdec05a396e1d869e2243))
* **deps-dev:** bump happy-dom in the npm-development group ([7ea916d](https://github.com/event4u-app/agent-config/commit/7ea916de9cf787b65e498e18ea00d863c257e590))

### Other

* **ready:** skill-estate drawdown -- 299 skills, no gate objects ([9f4cfc4](https://github.com/event4u-app/agent-config/commit/9f4cfc4570df2c5edf267fc5b05e0fc1a5c9a09d))
* **draft:** land opencode enforcement, with its own premise as phase 0 ([03d2f19](https://github.com/event4u-app/agent-config/commit/03d2f199fed7da03fafc54db989b56ad5bc7c411))
* **ready:** standing-payload truth, and withdraw an invalid strike I made ([f2625bd](https://github.com/event4u-app/agent-config/commit/f2625bdd8188de1fba6d53b6640133e260b94126))
* **ready:** promote the release-placeholder guard after eight rounds ([2d210e2](https://github.com/event4u-app/agent-config/commit/2d210e2a9a71b24839cb2df553a702560b5192c7))
* land routing assurance ready, park two, distil a third to a stub ([26e45c5](https://github.com/event4u-app/agent-config/commit/26e45c5e5f7b64d576f3fb228dcd2ffa23db09e6))
* **draft:** land capability-native execution; dissolve its frontend twin into two stubs ([c28a4c3](https://github.com/event4u-app/agent-config/commit/c28a4c3547d58a5d1ca072e929327d00cd4a1d82))
* **draft:** land the council-topology and command-surface harvests ([377bea3](https://github.com/event4u-app/agent-config/commit/377bea3bc3d49e837ca7f7837d4bc6946c7dbe60))
* **draft:** land four from the road-to-10 cluster, drop four rivals ([dd1fa71](https://github.com/event4u-app/agent-config/commit/dd1fa71db8de3a3165f93b07bcc66d22d78a8497))
* **draft:** carry merge-surface-zero, and record that its premise dissolved ([0c3c028](https://github.com/event4u-app/agent-config/commit/0c3c028bd61be469448fa98a69fbc7780865b042))
* **ready:** land suggestion-block capture from the 2026-08-24 inbox run ([182cbf8](https://github.com/event4u-app/agent-config/commit/182cbf8e3ebadfa2d3f6707f80ee0d9b01f9c168))

Tests: 17665 (+441 since 14.11.0)

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
