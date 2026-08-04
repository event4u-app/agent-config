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

# Era: 9.18.x — current

> Started at `9.18.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.19.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.20.0](https://github.com/event4u-app/agent-config/compare/9.19.0...9.20.0) (2026-08-04)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in 14dc053, bb362a0.
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in ba77e6a.
- **Known limitations:** _none_

### Features

* **gates:** read the archived round records nothing was reading ([89eea71](https://github.com/event4u-app/agent-config/commit/89eea712b89048a032dfccf8a3bdd41f565adacc))

### Bug Fixes

* **gates:** stop the remediation text pointing at the closed hole ([2dc9e0d](https://github.com/event4u-app/agent-config/commit/2dc9e0d91262864237e50268d8ea54dcce761a62))
* **gates:** rows are live wherever they appear — close the fence fail-open ([ba77e6a](https://github.com/event4u-app/agent-config/commit/ba77e6a6f4cc5c31b9de4741ee30ccc41e126df7))

### Documentation

* **evidence:** close the blind-pass dispositions and correct a claim I made ([0398238](https://github.com/event4u-app/agent-config/commit/0398238d99f7451712e710204c86ab41f964de50))
* **contracts:** 2.7 is enforced now, and says what it still does not check ([d0b3650](https://github.com/event4u-app/agent-config/commit/d0b365035dc314183dcb0e353a09e3e2c5420284))
* **roadmap:** pin-then-migrate ordering; drop the index for a round-record check ([bb362a0](https://github.com/event4u-app/agent-config/commit/bb362a0b64a5e16a156d238c1acadded44f229aa))
* **roadmap:** record the council verdict on the fence grammar ([3e0deff](https://github.com/event4u-app/agent-config/commit/3e0deff6256050aa23fe952707ab88bf7bc9647e))
* **review:** give the blind-pass findings terminal statuses and a carrier ([667b81e](https://github.com/event4u-app/agent-config/commit/667b81e9fa44d892095a7b057a6407196aa429bf))

### Tests

* **gates:** pin every fence arrangement before the grammar migration ([14dc053](https://github.com/event4u-app/agent-config/commit/14dc053d51ac1e932ce4deeb50ffb2e07737bd84))

### CI

* **gates:** wire check_review_dispositions with a trippable floor ([9b03190](https://github.com/event4u-app/agent-config/commit/9b0319032494345fdcaad40ae79dbe3ea95f6fc8))

Tests: 10995 (+23 since 9.19.0)

## [9.19.0](https://github.com/event4u-app/agent-config/compare/9.18.1...9.19.0) (2026-08-04)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _none_
- **Default changes + migration:** _none_
- **Security and correctness:** _none_
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits carrying an honest-null marker in 1c744c3.
- **Known limitations:** _none_

### Features

* **gate-coverage:** ratchet the unhardened-gate count, armed at 189 and able to fail ([5d1564f](https://github.com/event4u-app/agent-config/commit/5d1564fe0dcbeb340c97f33a29245a54c43a8591))
* **gate-coverage:** publish the asserted count from five gates, 17 -> 22 covered ([d228aa5](https://github.com/event4u-app/agent-config/commit/d228aa5cb5019dffe11c0e4606644630450d0816))

### Bug Fixes

* **roadmap:** repair the archived roadmap's own relative link ([ac85f3a](https://github.com/event4u-app/agent-config/commit/ac85f3a0fdefbbed74c50cc7049c5ffc72b408a8))
* **census:** make the scan-scope census reproducible, and regenerate it ([1e539ee](https://github.com/event4u-app/agent-config/commit/1e539ee96efc1807663342e084c2a0e666eaf9bc))
* **lint_handoffs:** stop the CI invocation resolving --quiet as the scan root ([6994781](https://github.com/event4u-app/agent-config/commit/6994781875f8d1d2feab6012ac7704e04232447e))
* **gates:** name the fence hole, drop the dead sort ([16dace4](https://github.com/event4u-app/agent-config/commit/16dace44b7d468aaba95abf16ec79d65d9862db8))

### Documentation

* **roadmap:** close road-to-gates-that-can-fail, re-charter the adoption gap ([34ff10c](https://github.com/event4u-app/agent-config/commit/34ff10c0748ea7e1c4cfdb99f423c35bba1c9a98))
* **claims:** register the exit-2 rate alarm in the Stage-A protocol ([4653841](https://github.com/event4u-app/agent-config/commit/46538415f7a59993aef7575f32cc84582a03126f))
* **review:** unsteered post-merge blind pass — 5 findings, 1 critical ([1c744c3](https://github.com/event4u-app/agent-config/commit/1c744c395f8d1bb727be946f459ce5a498320b5d))

### Chores

* **census:** regenerate after merging origin/main ([239f141](https://github.com/event4u-app/agent-config/commit/239f1413b950455efbe379976ea34a67ff02d380))

Tests: 10972 (+9 since 9.18.1)

## [9.18.1](https://github.com/event4u-app/agent-config/compare/9.18.0...9.18.1) (2026-08-04)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** the release generator pre-fills the curated head from the release span instead of writing `_none_` into all five fields (8fe60e9, 2f23d6b) — `_none_` now means "the span substantiates nothing", so a reader can trust it; review-gate scope classification changed, with IaC and extensionless build files counting as code and a findings row required to be exactly six cells (6c5f0f5).
- **Default changes + migration:** _none_
- **Security and correctness:** two more fail-open routes in the review-gate fence parser are closed — an unterminated fence no longer swallows the rest of a findings artefact (55dc01d) and a bare fence never delimits a region (9937ad9, the fourth such route); both previously let a truncated artefact read as clean.
- **Honest nulls:** the honest-null recorded against 6c6fc15a9 in the 9.18.0 notes was **false** — the real binding review is restored (d56c0be), so treat that 9.18.0 line as withdrawn. Rounds 6 to 8 of the R2 review closed 7 findings and deferred 10, with 0 critical or high (7a0f7b3, 39f071f, 70bb89f).
- **Known limitations:** the head pre-fill matches an `honest-null` literal anywhere in a commit body, so a commit *about* the mechanism gets cited as one — it did here, for 2f23d6b, and a human dropped it. The derived line is a draft, never a claim; the gate blocks only a `_none_` the span contradicts and never judges a filled field.

### Bug Fixes

* **release:** derive the head in --dry-run too, so the preview matches ([2f23d6b](https://github.com/event4u-app/agent-config/commit/2f23d6bb963577af5741951962b48e556e5a3e97))
* **release:** stop the generator writing a `_none_` the gate rejects ([8fe60e9](https://github.com/event4u-app/agent-config/commit/8fe60e9aba5192c07f8e33bc6ce1747a77e82922))
* **gates:** a bare fence never delimits a region — close the fourth fail-open route ([9937ad9](https://github.com/event4u-app/agent-config/commit/9937ad9b75f60bffd4ad42f2a830589bd4be7e5c))
* **gates:** an unterminated fence must not swallow the rest of a findings artefact ([55dc01d](https://github.com/event4u-app/agent-config/commit/55dc01d1fd3c8dbf44dd04fa7b3f41e3f4bc39bb))
* **gates:** IaC and extensionless build files are code; a row is exactly six cells ([6c5f0f5](https://github.com/event4u-app/agent-config/commit/6c5f0f5999b8a421cf765269a8da8b780465dc98))

### Documentation

* **review:** close round 8 — 1 fixed, 4 deferred, 0 critical ([70bb89f](https://github.com/event4u-app/agent-config/commit/70bb89f2820f4c5a5a26cd25f5db2daa53b08e5e))
* **review:** close round 7 — 2 fixed, 3 deferred, 0 critical/high ([39f071f](https://github.com/event4u-app/agent-config/commit/39f071fad58dc2c5cb9e6ec87e8e37b79085db2f))
* **gates:** in-place re-binding is the normal fix-pass path (2.1/2.5/2.7) ([1f7d140](https://github.com/event4u-app/agent-config/commit/1f7d1404c4bc63e87d4b46f91d52f81f2ae51f7b))
* **review:** round-7 R2 findings — 2 medium, 3 low, 0 critical/high ([2bd3eda](https://github.com/event4u-app/agent-config/commit/2bd3edad82ff69700f62c4d16c93f38a484e5e08))
* **review:** close round 6 — 4 fixed, 3 deferred, 0 critical/high ([7a0f7b3](https://github.com/event4u-app/agent-config/commit/7a0f7b33aed30921f2404ae1955a8e5aa76dde9b))
* **gates:** two claims corrected to match the code (round-6 lows) ([0f5d43a](https://github.com/event4u-app/agent-config/commit/0f5d43a17be245b034287b0f486839fb156f8b86))
* **review:** restore the real binding review — 6c6fc15a9's honest-null was false ([d56c0be](https://github.com/event4u-app/agent-config/commit/d56c0be63f6782183737ab50256401ab52a1f38f))

Tests: 10963 (+19 since 9.18.0)

## [9.18.0](https://github.com/event4u-app/agent-config/compare/9.17.0...9.18.0) (2026-08-04)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** rule triggers were re-cut — the brand pair is merged into one rule and the `disclaimer`/`finance` plus `secret`/`security` trigger sets are disjoined, so a prompt that used to load two rules now loads one (71c3527); `existing-ui-audit` moved its required sections back into the skill body and `references/output-and-pitfalls.md` is removed (b3cc0ad); an unknown router `tier` value now fails compilation instead of silently downgrading to tier-2 (02960bf); a new trigger-collision disposition gate lands with a reproducible census (b71e36c).
- **Default changes + migration:** the new `planning` settings section (Gate C/R1/R2) ships with defaults, so omitting it stays legal (4bd8813, 74afbf9) — no data or config migration.
- **Security and correctness:** the `secret`/`security` trigger overlap was disjoined so a secret-shaped edit routes to exactly one floor (71c3527); round-2 review of the new gate scripts closed eight findings, two of which were fail-open — a missing `maxBuffer` switched R2 off on large PRs, and the documented `planning.completion_review: false` escape hatch was read by nobody (8a2bf76).
- **Honest nulls:** the R2 review of the merge scope returned a binding honest-null (6c6fc15); the Stage-A metrics protocol is pre-registered but unmeasured, so no effectiveness claim ships with it (01323d1); an honest-null verdict no longer suppresses the risk-table checks it previously masked (65fe441).
- **Known limitations:** R2 (completion review) has **no blocking path in this release** — every wired call site passes `--advisory`, which downgrades every violation kind including dead-scan-scope; the gate-coverage note that claimed a trippable floor was withdrawn, and teeth arrive when Stage B drops the flag (f2c6971).

### Features

* **ci:** local mirror for the R2 manifest re-derivation (parity) ([3e014b2](https://github.com/event4u-app/agent-config/commit/3e014b2196a1caf8ebfc404dd492cb500acf5126))
* **metrics:** pre-register Stage-A protocol; close + archive the roadmap ([01323d1](https://github.com/event4u-app/agent-config/commit/01323d17b03e01610c526cf34cd5134002899518))
* **ci:** enforce R1 + advisory R2 at pre-push and CI, register gate coverage ([21810f2](https://github.com/event4u-app/agent-config/commit/21810f2bd443310591bbaa7c83d54133477ab902))
* **gates:** wire C/R1/R2 into the authoring and delivery surfaces ([3622d09](https://github.com/event4u-app/agent-config/commit/3622d09d4154e97fb2736cf5f08dc8eb2f7e0ba1))
* **gates:** R1/R2 validators, R2 reviewer dispatcher, R1 annotation helper ([37389c9](https://github.com/event4u-app/agent-config/commit/37389c9ef8ae7420eaaab98484b53f362d34168b))
* **settings:** add planning gate keys (Gate C/R1/R2) to template + Zod schema ([74afbf9](https://github.com/event4u-app/agent-config/commit/74afbf973bd34d8572f63b8e47ae29ebeefc43b1))
* **work-engine:** ui-fix intent — fix-lane enters the chain at apply ([f29cc7c](https://github.com/event4u-app/agent-config/commit/f29cc7cb33b6247da197348d6e0a8e74ef74617d))
* **work-engine:** trivial-lane recall 0.60 -> 1.00 against the pre-registered corpus ([07a32d4](https://github.com/event4u-app/agent-config/commit/07a32d4985cd89cba46474d7ffabff52ccd1b497))
* **eval:** pre-register the ui-triviality golden corpus (40 tasks, council-labelled) ([f71a41c](https://github.com/event4u-app/agent-config/commit/f71a41c821f81cd0bb78bc427e2eba47b0ac0fd4))
* **lint:** trigger-collision disposition gate + reproducible census ([b71e36c](https://github.com/event4u-app/agent-config/commit/b71e36c317385701d3b8577770130075c1b08754))
* **routing:** one shared trigger matcher + route:explain / route:audit CLI ([e3af5ca](https://github.com/event4u-app/agent-config/commit/e3af5cacc496228794acf5a86fe799785ddbe19d))

### Bug Fixes

* **gates:** stop claiming a blocking floor the advisory window does not have ([f2c6971](https://github.com/event4u-app/agent-config/commit/f2c6971913d19afe14523d460df996aa8d2adf82))
* **metrics:** create the metrics dir before appending an outcome ([4931eda](https://github.com/event4u-app/agent-config/commit/4931eda2dd968e365b7666856353d63e14f61dfe))
* **gates:** slug comes from git, not the CI branch env ([a8b04e1](https://github.com/event4u-app/agent-config/commit/a8b04e14dfdafdfffdd38f4966a6f04f60c175ac))
* **settings:** planning section defaults, so omitting it is legal ([4bd8813](https://github.com/event4u-app/agent-config/commit/4bd881354fdce7f053ce4b1135a650d11ab71898))
* **gates:** cwd decides, never an inherited GIT_DIR ([022f381](https://github.com/event4u-app/agent-config/commit/022f3819b17d3c80afbbad4b8aa30ce0f05dc5da))
* **gates:** honest-null no longer suppresses the risk-table checks ([65fe441](https://github.com/event4u-app/agent-config/commit/65fe4418126751d2833156b5debfa17fba2d17b5))
* **gates:** pin the diff bytes; malformed-row reporting; shared row split ([e023ac7](https://github.com/event4u-app/agent-config/commit/e023ac70df800380214dd7ade34ae266f842ae03))
* **ci:** full history for the plan-governance gates ([323ab06](https://github.com/event4u-app/agent-config/commit/323ab068eb8f70348478127768b54273a582dc8c))
* **metrics:** annotate helper exits on EOF instead of hanging ([6fd7fa9](https://github.com/event4u-app/agent-config/commit/6fd7fa9296b50e90d120ed7575c6cdd5c2a554f7))
* **gates:** exclude the mandated metrics path from the review scope ([cc82999](https://github.com/event4u-app/agent-config/commit/cc82999ceb937ef58543415c9abe45b1eb073eb7))
* **gates:** escape-aware markdown row split; scanned on every exit path ([05b4d44](https://github.com/event4u-app/agent-config/commit/05b4d44f4edffe90c305f1aa9f34ced8543c7002))
* **gates:** close the eight script findings of round 2 — two were fail-open ([8a2bf76](https://github.com/event4u-app/agent-config/commit/8a2bf767be47c081a0f94bd5f2dd69b45cce2e28))
* **ci,pr:** no-fetch base sha, in-script artefact selection, scope-hash re-use (R2 round-2 findings 1,3,5) ([f9102d7](https://github.com/event4u-app/agent-config/commit/f9102d7bea877822b1d82f8a1650083fab4919b0))
* **gates:** contract §2.0/§2.6, dispatcher scope binding, precise dead-scope trigger ([cd52b53](https://github.com/event4u-app/agent-config/commit/cd52b53458d18ec9f3ad2e7e1f65067b118a2a5d))
* **bundle,roadmaps:** drop worktree path leak; R1 adoption + corrected claims (R2 findings 3,6,7) ([54e60db](https://github.com/event4u-app/agent-config/commit/54e60dbf814614c27ce94232b8c63f0893816849))
* **ci:** verify every review artefact, block on dead scope (R2 findings 2,8,9) ([962699d](https://github.com/event4u-app/agent-config/commit/962699d5108ca12219ecf18c1c9e19e068b210b9))
* **gates:** bind R2 to a review-scope hash, not a head sha (R2 findings 1,2,4,5,10,11) ([8b4ec9f](https://github.com/event4u-app/agent-config/commit/8b4ec9f75b09eaac913271e6e8dd8bd365c72371))
* **lint:** repoint the fe-design abstraction-threshold pin to its reference file ([428bbd2](https://github.com/event4u-app/agent-config/commit/428bbd2513afe15a59600752244edd72b30a74b8))
* **lint:** escape the NUL key separator in lint_trigger_collisions ([e359256](https://github.com/event4u-app/agent-config/commit/e359256e2498719afc508625c3c46cd3f93ff155))
* **skills:** keep required sections in existing-ui-audit's body ([b3cc0ad](https://github.com/event4u-app/agent-config/commit/b3cc0ada669c2011de9c64623680ca4664552123))
* **config:** surgical schema + budget edits instead of whole-file JSON rewrites ([2e1b377](https://github.com/event4u-app/agent-config/commit/2e1b3776edd2c960d0c9170bee60648875acf055))
* **router:** unknown tier value fails compilation instead of silent tier-2 downgrade ([02960bf](https://github.com/event4u-app/agent-config/commit/02960bf5e8fab4c11aafaad29b5f4b5cde52ccd2))

### Documentation

* **review:** binding R2 honest-null for the merge scope ([6c6fc15](https://github.com/event4u-app/agent-config/commit/6c6fc15a983c8c685820c5e5eac2dd21ba0ab228))
* **contracts:** label the terminal-before-rename rule enforced_by: none ([911505e](https://github.com/event4u-app/agent-config/commit/911505e0207ab5715894e931b45f87a065b22b8a))
* **contracts:** name the superseded-round convention (§2.7) ([ba202e2](https://github.com/event4u-app/agent-config/commit/ba202e2dd261ea3d194799946a2dc1924024bef3))
* **review:** close round-4 findings — 4 fixed, 0 open ([7bb24d8](https://github.com/event4u-app/agent-config/commit/7bb24d879ecc9f512f9429e3c78a88959c7b6c50))
* **gates:** withdraw three claims that had no mechanism behind them ([2529f53](https://github.com/event4u-app/agent-config/commit/2529f53e91c68a670667ea2fa2971cc262241404))
* **review:** close round-3 findings — 11 fixed, 1 accepted-risk ([9603e29](https://github.com/event4u-app/agent-config/commit/9603e29f610dc1566bf1931ea6daf784e9f31725))
* **review:** R2 round-3 findings — 12 open ([7a88b1a](https://github.com/event4u-app/agent-config/commit/7a88b1af2d2283ae1b3c8866d689241a4af9dda3))
* **review:** close round-2 findings — 11 fixed ([6f0934c](https://github.com/event4u-app/agent-config/commit/6f0934c561223a8dd4424fa109b4c8b5701d38a7))
* **review:** close round-1 findings — 10 fixed, 1 accepted-risk ([6bc2a26](https://github.com/event4u-app/agent-config/commit/6bc2a2673daf568d39de86710625108a84a03e13))
* **review:** R2 completion-review findings — fresh blind reviewer, 11 open ([e7d0dca](https://github.com/event4u-app/agent-config/commit/e7d0dca86111dfe52247539630f11ff21f4c3c67))
* **contracts:** add plan-review-gates v1 — R1/R2 grammars, C-to-R1 handoff, exit codes ([aa69cdd](https://github.com/event4u-app/agent-config/commit/aa69cdd39adb4e7c12f95881a2243a785093c734))
* **roadmap:** adjudicate advisory-gate blocker findings for plan-governance-gates ([b35b2aa](https://github.com/event4u-app/agent-config/commit/b35b2aa088e6d0236d9a28107f7726d76b9530f8))
* **roadmap:** inline council trace per no-roadmap-references council clause ([c355c3b](https://github.com/event4u-app/agent-config/commit/c355c3b00b3a8ce031b7017bf12734908e1fd485))
* **roadmap:** add plan-governance-gates roadmap (confidence gate + review gates) ([810caa7](https://github.com/event4u-app/agent-config/commit/810caa74529577049bc55778fe82eb5936ce79e1))
* **evidence:** pre-register the UI-skill progressive-disclosure threshold ([0914f65](https://github.com/event4u-app/agent-config/commit/0914f65b24dd76f50ba073f375d6b0cb7d69ff2b))
* **roadmap:** flip census + collision-lint checkboxes (landed in b71e36c31) ([f49df8b](https://github.com/event4u-app/agent-config/commit/f49df8bf766462e1a60dae3f41d2974a81bee814))
* **roadmap:** routing-correctness — Phases 1, 2 and 4 landed ([010d733](https://github.com/event4u-app/agent-config/commit/010d73359ced4c9700ef4f40cc948216b0d6a070))
* **commands:** routing-audit surface on /rule-compliance-audit ([61ade3f](https://github.com/event4u-app/agent-config/commit/61ade3f78f8f5956ec66413890b692055fef319d))

### Refactoring

* **skills:** compress the gate additions under the size threshold ([015ec87](https://github.com/event4u-app/agent-config/commit/015ec8752dc6b5bc4e0e5c9098fc34b044bc9c61))
* **skills:** progressive disclosure for the four heavy UI reference skills ([709f010](https://github.com/event4u-app/agent-config/commit/709f0105a2b305f7c1b53ad561ceb964c5616157))
* **rules:** merge brand pair, disjoin disclaimer/finance and secret/security triggers ([71c3527](https://github.com/event4u-app/agent-config/commit/71c35279a774a42557f91d9f769ad0bdcf2386ba))

### Tests

* **gates:** cover the annotation helper and the R2 artifact parser ([72eabe0](https://github.com/event4u-app/agent-config/commit/72eabe01025f6a399ff0818b173d17c8546ed737))

### Chores

* **index:** regenerate artefact index, catalog and command flows ([71aacc6](https://github.com/event4u-app/agent-config/commit/71aacc6f675def21773d13f3fd927bcdc2519a99))
* **tests:** drop unused import in the fix-lane test ([b18e77f](https://github.com/event4u-app/agent-config/commit/b18e77f78c426493ba3ff6a2ee8dc9c9ce068253))

Tests: 10944 (+252 since 9.17.0)

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
