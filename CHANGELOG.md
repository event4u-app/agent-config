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

## [14.12.0](https://github.com/event4u-app/agent-config/compare/14.11.0...14.12.0) (2026-08-25)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
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
