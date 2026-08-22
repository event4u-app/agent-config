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

# Era: 14.8.x — current

> Started at `14.8.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.9.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.8.0](https://github.com/event4u-app/agent-config/compare/14.7.0...14.8.0) (2026-08-22)

### Release highlights

<!-- Curated head: fill before merge, keep it under 10 lines, and leave `_none_` where it is genuinely the answer. The generated log below is unchanged. -->
- **Behaviour changes:** _auto-derived, rewrite before merge:_ rule/schema diffs, breaking commits or removed public surface in 0ec38ab, fb8cc36, 27d6e57, 741c9c3, d635ff7, ffa75c5.
- **Default changes + migration:** _auto-derived, rewrite before merge:_ commits naming a default, migration or migrate in a28694c, 3a87be7.
- **Security and correctness:** _auto-derived, rewrite before merge:_ security-scoped commits or fixes to executable surface in 0baf882, ed0edf1, 69e11fc, d2d6ec2, b5fd05b, 62457bd +31 more.
- **Honest nulls:** _auto-derived, rewrite before merge:_ commits recording a null, waived or falsified result in 85352cb, 408c05d, 05fb45f, f8c1d79, 9bb3316, 271f72d +5 more.
- **Known limitations:** _none_

### Features

* **cli:** adr:effective — the effective state of one decision record ([6a052c8](https://github.com/event4u-app/agent-config/commit/6a052c86df2c3e821ae386ded5d3d1fd2e42fc58))
* **partition:** --prune the duplicates, correct two Phase 5 premises, close the roadmap ([729610b](https://github.com/event4u-app/agent-config/commit/729610bf34ed03ccbee42bf6b3fc05477cee3e66))
* **gate:** check_rule_layer_partition enforces one rule per layer, with an honest skip ([34a6547](https://github.com/event4u-app/agent-config/commit/34a6547d2345cfb084df5ba13f1d3579c848a62a))
* **partition:** connect the three emitters that never consulted the partition ([6f19dd3](https://github.com/event4u-app/agent-config/commit/6f19dd399498754d9197c0ed777132adc6adefb6))
* **partition:** decide the rule partition per host, on that host's own evidence ([ea86f86](https://github.com/event4u-app/agent-config/commit/ea86f86d90037d2592a35b6106b4f12d3930c55b))
* **archive-index:** give --check the same tracked/untracked table the dashboard has ([bf5cd9f](https://github.com/event4u-app/agent-config/commit/bf5cd9f8290dfa6dcb86dfd60f939f1e79647a24))
* **process-full:** remove --merge, record the merge-authority closure ([c87a537](https://github.com/event4u-app/agent-config/commit/c87a53746108a9ea2bcd5411397129b0e28ad8be))
* **roadmap-progress:** give --check an explicit tracked/untracked mode ([945502e](https://github.com/event4u-app/agent-config/commit/945502ea8e339c2085d28ddea25a6817addeecf9))
* **delivery:** the ADR-236 partition reaches personas and the colon-form commands ([2525e4b](https://github.com/event4u-app/agent-config/commit/2525e4bb95fddc03aea6b28e209a37d7b13b877d))
* **delivery:** measure the two families the delivery gates never named ([fd7a393](https://github.com/event4u-app/agent-config/commit/fd7a393a10a00229bb83b6c26865418beda8b15b))
* **adr:** evidence census — proposals over all 185 records, writes nothing ([9466e93](https://github.com/event4u-app/agent-config/commit/9466e935231d547e2d0698c300b0bb1d3709ace4))
* **adr:** give the 7 per-area records YAML frontmatter, and stop the fourth parser ([9251097](https://github.com/event4u-app/agent-config/commit/925109741989a8acf101bf395b438dfcbc4f29de))
* **skills:** admission gate, Evidence/Assumptions sections, evidence-first review ([9b7e251](https://github.com/event4u-app/agent-config/commit/9b7e251162ba161053955265305fa92af5a790ba))
* **adr:** lint permanence language in an ADR's load-bearing positions ([5cd4826](https://github.com/event4u-app/agent-config/commit/5cd4826148d5f7f93e356794f035e9de18e626e5))
* **adr:** surface provenance and grade at cite time, and put the gate in CI ([c2e22d2](https://github.com/event4u-app/agent-config/commit/c2e22d2faa0eb0452bf581f2116c4409a16de185))
* **adr:** one shared frontmatter reader, and validate the two descriptive axes ([bb21c2e](https://github.com/event4u-app/agent-config/commit/bb21c2ef26e20a94e4f59027fc522594691e207b))
* **commands:** process-full gains --all and --worktree; --merge ships inert ([6de65cf](https://github.com/event4u-app/agent-config/commit/6de65cf0bb662721ecd48915504ea185950f08cd))
* **skills:** state the security coverage boundary and route to the authority ([fc68cb2](https://github.com/event4u-app/agent-config/commit/fc68cb2f97e7e0f6f096708ebace21bc239ee04c))
* **commands:** add /pr:merge — prepare a PR to mergeable, then merge ([27febd3](https://github.com/event4u-app/agent-config/commit/27febd3aa053b33d508a0c84c7f5af8118d8c094))
* **gates:** verify the hook bundle by content, not by timestamp ([e64bb92](https://github.com/event4u-app/agent-config/commit/e64bb925af7eb91ebe8207dfb0917460d3910d70))
* **roadmap:** one-shot flip self-fix in contract mode, and kill criteria at the flips ([d6f38be](https://github.com/event4u-app/agent-config/commit/d6f38bee1b71cf2aba939de470b909ad4e1f8f81))
* **roadmap:** let a declared deferred_policy remove the closure round ([d635ff7](https://github.com/event4u-app/agent-config/commit/d635ff74b51a7d7b0fefa2648e8415b0bc6e370f))
* **contract:** add late_artifacts and deferred_policy as contract fields ([ffa75c5](https://github.com/event4u-app/agent-config/commit/ffa75c5ae10b9d539ded6640e24e9f0687049e16))
* **autonomy:** add set-scoped autonomy shape and the set-contract loop layer ([99e7d82](https://github.com/event4u-app/agent-config/commit/99e7d82ebe1bf6edda717c558c45d92340518c39))
* **bench:** isolate the transport share of the large-payload dispatch cell ([0fb497f](https://github.com/event4u-app/agent-config/commit/0fb497f0236992488481a7fedc100d8218cf6203))
* **contracts:** add the cross-vendor worker direction policy ([c7f9f97](https://github.com/event4u-app/agent-config/commit/c7f9f9785a6eb68c4587285a65fb01c5a2311606))

### Bug Fixes

* **gate:** unblock preflight during a release — two gates that could not be green mid-release ([917778a](https://github.com/event4u-app/agent-config/commit/917778a83e331750ac53724c36d319fd1f5ed7fc))
* **baselines:** remove the zero-count entry, and undo three JSON reformats ([97f5e9b](https://github.com/event4u-app/agent-config/commit/97f5e9bdd348a47025899f64605dbb7fc99856b6))
* **gates:** retire the zero-count baseline instead of shipping it ([c35412e](https://github.com/event4u-app/agent-config/commit/c35412edab41b751308b0980c9e3806201a7c013))
* **ci:** put only the dashboard's own state behind the required check ([0baf882](https://github.com/event4u-app/agent-config/commit/0baf882836df2e5f962776c62cc5c049fa0b6dd7))
* **test:** inject the partition-active bit so the suite is not environment-dependent ([ed0edf1](https://github.com/event4u-app/agent-config/commit/ed0edf1d085de1eb6b47e65ab48f732ef82daa5c))
* **adr:effective:** drop the unused amendment_blocks import ([69e11fc](https://github.com/event4u-app/agent-config/commit/69e11fc56e7c8bd0f781abee729774fe5b163e6e))
* **test:** point the real-archive check at the mode the repository runs ([d2d6ec2](https://github.com/event4u-app/agent-config/commit/d2d6ec25657ddc453680f2f8fb8a23b9f2146a5d))
* **condense:** drop the own-orphaned isExclusivelyPackageOnly import ([b5fd05b](https://github.com/event4u-app/agent-config/commit/b5fd05b750c5d0a8f33043f9a4f330e48de8e2b2))
* **rules:** repair the two condensed-path links ([0ec38ab](https://github.com/event4u-app/agent-config/commit/0ec38abfab8fdf8a2aa53a4c387f6c7662dc9764))
* **evidence:** regenerate the stale ADR evidence census ([3a3e647](https://github.com/event4u-app/agent-config/commit/3a3e64730119b24cacc5374d2bbb02e36aade98e))
* **sync:** send an untracked-by-design conflict to the deletion, not to --ours ([62457bd](https://github.com/event4u-app/agent-config/commit/62457bd8caee47f63551f3323b7753d0db9520dc))
* **adr:** finish the 239 -> 241 renumber and drop new permanence language ([faa1c71](https://github.com/event4u-app/agent-config/commit/faa1c71c376fabc2bc57e117f2c7427b725ca48b))
* **archive:** regenerate the stale archive index ([5505dd6](https://github.com/event4u-app/agent-config/commit/5505dd605b158e7e113bce6def3b839b426290e9))
* **gates:** stop three corpus guards tracking the estate size ([ba3c15e](https://github.com/event4u-app/agent-config/commit/ba3c15ed525fac63de907e4276a2dff71013fdb0))
* **check-references:** carve out the deliberately-untracked dashboard ([daefc28](https://github.com/event4u-app/agent-config/commit/daefc280094a633462b935117f56879b532e39f6))
* **stubs:** restore the disposition-framework pointer the index deletion dropped ([3a35a8c](https://github.com/event4u-app/agent-config/commit/3a35a8c8c2753c4ecbb73a721ae2659b95191e8b))
* **sync:** classify the two generated paths a grep of the list could not find ([0290e9e](https://github.com/event4u-app/agent-config/commit/0290e9e40a84a480515f28bb9cc8f8b1a8c12a05))
* **review:** re-derive roadmap_hash and ac_hash, the step three re-binds missed ([d384ba5](https://github.com/event4u-app/agent-config/commit/d384ba549af63950faa5a6a33de8559058ec9c52))
* **roadmap:** follow road-to-user-out-of-the-loop into archive/ ([a8366fb](https://github.com/event4u-app/agent-config/commit/a8366fbf13711a27327d1c60ecef8fe35ac381c9))
* **archive:** regenerate the archive index after this branch's archival ([03d9e44](https://github.com/event4u-app/agent-config/commit/03d9e44525cd69325dc8d0e538b57f82b5f80b71))
* **adr:** close all 21 round-2 findings ([fb8cc36](https://github.com/event4u-app/agent-config/commit/fb8cc36bcd1d6dc9557473f68f17f7138635fefc))
* **docs:** drop the unpinned install string from benchmark prose ([61e6162](https://github.com/event4u-app/agent-config/commit/61e6162c78498321502279b166469a16c7d53c24))
* **adr:** close 20 completion-review findings ([27d6e57](https://github.com/event4u-app/agent-config/commit/27d6e57a1063c460826a13946dfa2c84a225f363))
* correct the 3.2 measurement, the precedent citations, and a missing test ([271f72d](https://github.com/event4u-app/agent-config/commit/271f72d4e437331389865af5f75d3cd469b353c2))
* **delivery:** act on the neutral cross-model review of this branch ([e8db875](https://github.com/event4u-app/agent-config/commit/e8db875b1ec012b0ad7d5a210f9727a5fa2d7ee8))
* **skill:** drop a maintainer-only invocation from the shipped merge-conflicts skill ([2dbb781](https://github.com/event4u-app/agent-config/commit/2dbb7817480f9406a62c22f4ccfe00e67446cda8))
* **evidence:** declare the analysis type on the cadence measurement ([b19cc56](https://github.com/event4u-app/agent-config/commit/b19cc560d4fbb328c173c14d42edfe1c5747b35b))
* address the round-4 findings ([0814e5e](https://github.com/event4u-app/agent-config/commit/0814e5e331f5199c4050f9a9d4998720ba594a91))
* **sync:** classify the archive-index pair and add a REMEASURED class ([0e8a5e3](https://github.com/event4u-app/agent-config/commit/0e8a5e3375b7daff7c8ba432398a20dca8e0c93d))
* **delivery:** stop printing a remedy the partition superseded ([4e75cb1](https://github.com/event4u-app/agent-config/commit/4e75cb1fb70c3608ec5263b9969dd2aeed3b4012))
* **release:** move the placeholder guard onto the render path ([b21df89](https://github.com/event4u-app/agent-config/commit/b21df89567a4518c5fb0ec35f2529ed7dba82ff8))
* drop the adr_cite_check coverage row — two gates disagree about the same file ([1638ad7](https://github.com/event4u-app/agent-config/commit/1638ad7bc650b0440b24a7833f63bd42082d9033))
* address the round-3 findings ([c6c99a4](https://github.com/event4u-app/agent-config/commit/c6c99a415d4a98cfb2b729d0c343a0c21fba6349))
* address the round-2 findings, blocker first ([c2a5147](https://github.com/event4u-app/agent-config/commit/c2a51474c4688ee95d125344fd8087775ae568ae))
* remove the two regexes the shared reader orphaned ([cf98d98](https://github.com/event4u-app/agent-config/commit/cf98d9814cd8aff0ff721a642ac0859f9611d611))
* session:recycle refused its own machine-collected last_verify, and wire the axes into the gate ([741c9c3](https://github.com/event4u-app/agent-config/commit/741c9c391295004638b3c52f4acb1424416f57c1))
* **adr:** close the prose leaks a neutral review found, and evaluate ADR-133 ([70e84f1](https://github.com/event4u-app/agent-config/commit/70e84f1de5d15541fe1dc00040e53be9556d26c0))
* **adr:** close the separation leaks a neutral review found, and add supersession reciprocity ([c7ff963](https://github.com/event4u-app/agent-config/commit/c7ff9632e2329f7eb62bb55998cdfd27b188b52e))
* **adr:** the contract blessed `review_trigger: unclassified` and the validator rejected it ([b458168](https://github.com/event4u-app/agent-config/commit/b458168d02e2e53e8eac788a0047c7bc11dc5de6))
* restore the roadmap a substring anchor truncated, and re-true the estate ratchet ([d89f7da](https://github.com/event4u-app/agent-config/commit/d89f7da8e9288b2dd289c58fb22353ff4334a92f))
* **hooks:** reject a duplicate nudge_rank in the manifest lint ([4f2456f](https://github.com/event4u-app/agent-config/commit/4f2456f22cf136bf3bd3969a1aec256e2cf44c9a))
* **release:** refuse to publish an unrewritten auto-derived placeholder ([3a0eec5](https://github.com/event4u-app/agent-config/commit/3a0eec527e0fa84b0ae4fab07cc2862236e4b231))
* **test:** re-base the second estate-pinned corpus floor ([ff4d54f](https://github.com/event4u-app/agent-config/commit/ff4d54faa99cc4687c74f32b6533ad0d754d10d7))
* address all 19 R2 findings ([73d7205](https://github.com/event4u-app/agent-config/commit/73d720501cd89606812727281de0f680410f89e5))
* **review:** repair the broken ADR links and three inconsistencies the review found ([0e3ec91](https://github.com/event4u-app/agent-config/commit/0e3ec9174b0861ddf8048d492234769c6231940d))
* **ci:** re-base the risk-register coverage floor on what it guards ([b8e25c5](https://github.com/event4u-app/agent-config/commit/b8e25c574e76f2a14b3762ff2a2b3209f2bebb2f))
* **git-guard:** restore the 30-minute authorization window ([1d6c456](https://github.com/event4u-app/agent-config/commit/1d6c4569054ab3187328517ec367650b6ad9a913))
* **docs:** allow-marker for the hooksPath diagnostic fence ([5ce688c](https://github.com/event4u-app/agent-config/commit/5ce688c495e640ce13059044f4b052426641f538))
* **stubs:** correct the draft-boundary stub's absolute figures to the post-archival tree ([3c2147d](https://github.com/event4u-app/agent-config/commit/3c2147d8cfbebf06e975fe0a501e8b4ff5efbf95))
* **contracts:** remove a stray unpaired conflict marker that reached the trunk ([85714a1](https://github.com/event4u-app/agent-config/commit/85714a11a970ccd800483f1d71e318aea0e12f41))
* **agents:** re-depth seven archival-broken links in the two files this branch already edits ([a784226](https://github.com/event4u-app/agent-config/commit/a784226d522db8ff0fc4e2c0f8b24824e9581b12))
* **stubs:** re-depth three inbound links the archival sweep left behind ([76806a8](https://github.com/event4u-app/agent-config/commit/76806a807966f38d6e15b739dcf0aca6749db3e4))
* **stubs:** resolve the transfers-table conflict as both rows, not one ([ef37f05](https://github.com/event4u-app/agent-config/commit/ef37f05e9f9372e5b290216c69c3f9f3e55dc32e))
* **state:** converge update_text_under_lock onto the merged lock contract ([91d8615](https://github.com/event4u-app/agent-config/commit/91d861530502a97a080dc8b550f231b0767c94ab))
* **hooks:** give injection-scan an output contract, then narrow its unwrap to it ([42d5c62](https://github.com/event4u-app/agent-config/commit/42d5c62dccd1656fee16e8b0e568bce6fa9b134d))
* **hooks:** deny an unreadable payload where a guard can actually refuse ([2830bea](https://github.com/event4u-app/agent-config/commit/2830bea75f5eb9c290ea4f0975f976b0c9a8101c))
* **hooks:** make the three dispatcher state files safe under concurrent dispatch ([4d119cf](https://github.com/event4u-app/agent-config/commit/4d119cf904406b6a2b1427369a278efd1558eb92))
* **roadmap:** state the close arithmetic the tree actually reports ([f51d706](https://github.com/event4u-app/agent-config/commit/f51d706c2cf4908f35998fd6e3569b29c8fb904a))

### Reverts

* **release:** withdraw the placeholder guard, carry the finding instead ([6f00fdd](https://github.com/event4u-app/agent-config/commit/6f00fdd67a170abd9266dcfb8d228d5074625255))

### Documentation

* **evidence:** fix a duplicated word from a scripted rephrase ([4d2cdaf](https://github.com/event4u-app/agent-config/commit/4d2cdafcb672bf60020b65d1d2dce8f9f3d279d5))
* **evidence:** close the PR-drain record — queue drained to zero ([2426643](https://github.com/event4u-app/agent-config/commit/24266438f1bb5475877ec075b468ff0c3a7d1bd2))
* **evidence:** record the check-archive-index self-repairing gate ([39dbf77](https://github.com/event4u-app/agent-config/commit/39dbf77497ad1ba171c5e682ee810a772df7d218))
* **adr:** disclose ADR-242's evidence in the section the gate reads ([5cf2ddd](https://github.com/event4u-app/agent-config/commit/5cf2ddd2933a8160052a751ec2d2d3f63d6a3d91))
* **evidence:** the drain-run summary ([6ae34dd](https://github.com/event4u-app/agent-config/commit/6ae34dd6eadb53ad0937180a04a403a8594a9ad2))
* **roadmap:** close and archive the run, and carry AC-2 to a stub ([50ef6dc](https://github.com/event4u-app/agent-config/commit/50ef6dca91874adbbaa2559b6120d532968da494))
* ADR-242, the roadmap that produced it, and the consumer-classification evidence ([4a44fa0](https://github.com/event4u-app/agent-config/commit/4a44fa0e506a016643a3f8af3631b49a33c41c10))
* **adr:** record when a derived artifact may leave the git index ([db38883](https://github.com/event4u-app/agent-config/commit/db38883bd5c240c69939c5dc0372e8107f593ca6))
* **roadmap:** road-to-single-rule-layer — rules are still delivered twice on 4 of 5 hosts ([2de7e79](https://github.com/event4u-app/agent-config/commit/2de7e79ceff119b35dee73374b5195bc3d60969a))
* **adr:** disclose ADR-241's provenance and evidence ([4a0c560](https://github.com/event4u-app/agent-config/commit/4a0c5608b017b28bf49da48d346cb0171ff6763b))
* **review:** round 3 — honest-null on the scope that includes the CI fixes ([f8c1d79](https://github.com/event4u-app/agent-config/commit/f8c1d790fd56f41753ff87e0291193e08a3d68f4))
* **review:** the completion review for this branch, both rounds ([9bb3316](https://github.com/event4u-app/agent-config/commit/9bb33161863c9d6bfe11018f7eadb69a036257b6))
* **review:** re-bind after the proof.md regeneration ([225ee6b](https://github.com/event4u-app/agent-config/commit/225ee6b3353f18508f5fd28e252176630dd5da03))
* **review:** re-bind after the merge and the ADR renumber ([c7fd058](https://github.com/event4u-app/agent-config/commit/c7fd0583cde161eb24833978a5da0d81db697b04))
* **review:** re-bind after the token re-anchor ([ae87ec1](https://github.com/event4u-app/agent-config/commit/ae87ec1da2754e5bbe1ae41d71cf3c0784f06cf5))
* **review:** re-bind after the second trunk merge ([667290c](https://github.com/event4u-app/agent-config/commit/667290ce07792db82f892d4f380d6e4c66d29779))
* **evidence:** record the PR-drain run ([72d81a8](https://github.com/event4u-app/agent-config/commit/72d81a8cff0df4251c19a0d4952d52b134f95c8f))
* **review:** re-bind after the archive-path correction ([22d0035](https://github.com/event4u-app/agent-config/commit/22d0035997cc578a5bb3d7b42009608e604fd174))
* **review:** re-bind the review scope after merging main ([c2c64ab](https://github.com/event4u-app/agent-config/commit/c2c64ab5694f6a0da06d5b67109e63630bfd3602))
* **review:** disposition round 2 and re-bind the scope ([4e4f72a](https://github.com/event4u-app/agent-config/commit/4e4f72a6896f71b076a1ba56f566cafa50462cca))
* **review:** record round 2 — 21 findings, do-not-merge ([3e579d6](https://github.com/event4u-app/agent-config/commit/3e579d67ad9c1a786dfa9b97361cedf6ce3be47f))
* **review:** archive round 1, open round 2 ([ae9dc4d](https://github.com/event4u-app/agent-config/commit/ae9dc4d45bbc78aff9914174d598b8e642345bb0))
* **review:** disposition round 1 — 20 fixed, 3 accepted-risk ([13fae20](https://github.com/event4u-app/agent-config/commit/13fae204b1583891da5715b1d53fc1ab59e53ff1))
* **review:** record the R2 completion-review findings ([dcc6d90](https://github.com/event4u-app/agent-config/commit/dcc6d90bcf69173204ecd522f4641d81223687a8))
* classify a CONFLICTING PR before opening the GitHub web editor ([6246dea](https://github.com/event4u-app/agent-config/commit/6246dea074797da8fd3f87d57c752e16ec6f3dd2))
* **adr:** ADR-239 -- merge=union is not available for a ratchet baseline ([be496dd](https://github.com/event4u-app/agent-config/commit/be496dd9abdbec60dcdc20bd3936eb90639d9447))
* **config:** correct a false unstage claim in the canonical gitignore block ([9e77c41](https://github.com/event4u-app/agent-config/commit/9e77c41d00ed7c29b2250c6d5ff50c451b37316f))
* **roadmap:** close and archive road-to-single-delivery-closure ([fc4b3a1](https://github.com/event4u-app/agent-config/commit/fc4b3a1f803d88d729730feff7d75df67a6360c3))
* **adr:** the full-corpus challenge sweep — all 185 records, no frontmatter written ([d90cb53](https://github.com/event4u-app/agent-config/commit/d90cb53b05e2e13e98c23eb9c109ab819714a9f5))
* **adr:** propose ADR-238 evidence-based-decision-floor, pre-register the shadow metrics ([3c25ebb](https://github.com/event4u-app/agent-config/commit/3c25ebbd8673401efe8ff1db34e575522cf8d538))
* **evidence:** correct a known-false Implemented claim about untrusted_content ([0e279fe](https://github.com/event4u-app/agent-config/commit/0e279fe4470649613e5df078df6e8886b2845cdb))
* **adr:** ADR-238 — drain command surface and where merge authority stops ([ac5954a](https://github.com/event4u-app/agent-config/commit/ac5954ab863c1584b2dfbb02bb1b8671ae6e2fae))
* **adr:** ADR-238 — route security-domain parameters, do not carry them ([f352e4e](https://github.com/event4u-app/agent-config/commit/f352e4ed29b4a032fe565f10955d93f77aed3ec0))
* fix roadmap blocker contract shape and estate offset exemption ([af2ddfe](https://github.com/event4u-app/agent-config/commit/af2ddfeb262f3f8138a8997fd160a7267741e200))
* **roadmap:** add road-to-drain-commands ([20a3d3b](https://github.com/event4u-app/agent-config/commit/20a3d3b31f8c1b8390ed488bb4582bd1007dd413))
* add road-to-evidence-based-adr-governance roadmap ([b4fd058](https://github.com/event4u-app/agent-config/commit/b4fd0580f20dbb10381e5ff61990983be629cf62))
* **stubs:** carry estate-drawdown's two transferred obligations ([8186aca](https://github.com/event4u-app/agent-config/commit/8186aca4f367d9e91369ea6333eab60e2f0db83b))
* **council:** record the two-round disposition of estate-drawdown's residue ([236378a](https://github.com/event4u-app/agent-config/commit/236378aced8602b3ee2a7184890c10e097bf1ae8))
* **council:** record the standing-context-40k disposition (2/2 quorum) ([118b7b1](https://github.com/event4u-app/agent-config/commit/118b7b1bfac58fd7e368724d90a5f3675ffefd18))
* **evidence:** probe the standing-context-40k host and machine premises ([94bec2a](https://github.com/event4u-app/agent-config/commit/94bec2a90e4ba9dc8e30b51a5ce1fb872e8a6802))
* **evidence:** measure the estate-drawdown residue before disposing it ([2b522ad](https://github.com/event4u-app/agent-config/commit/2b522ad96ba7df2fdded05aeef37be78958382c0))
* **council:** record the solution-minimalism quality-gates disposition ([7738e41](https://github.com/event4u-app/agent-config/commit/7738e4191bb5b87f81afcba22cfcc134e3ae8186))
* **stubs:** transfer the kernel batch-elicitation delta and the set front doors ([3964103](https://github.com/event4u-app/agent-config/commit/3964103c0f28e9a338c84c996f708cc8b9db65b3))
* **roadmap:** document depends: and correct the wrapper-derivation claim ([087da05](https://github.com/event4u-app/agent-config/commit/087da0570fac392cc34da4b6fb5aa27257f0c038))
* **roadmap:** correct the Outcome opener — 7 transferred, 2 verified, not 9 ([b188606](https://github.com/event4u-app/agent-config/commit/b1886061a9fb2babcc302c0d742fd9487c14c5d0))
* **roadmap:** close road-to-rule-coherence-followup by transfer, not by claim ([228067e](https://github.com/event4u-app/agent-config/commit/228067e5261d1f7852dbe12c815afa748d34bc85))
* **stubs:** transfer the default flip, its benchmark run and the read cap ([a28694c](https://github.com/event4u-app/agent-config/commit/a28694c256cb892b2885327ecc925b33f1786ce3))
* **evidence:** census the discipline-default flip before transferring it ([3a87be7](https://github.com/event4u-app/agent-config/commit/3a87be73f4a6507d342fe2e3dc48b80feae92871))
* **roadmap:** close road-to-gated-reach-followup as transferred, not achieved ([928f5ba](https://github.com/event4u-app/agent-config/commit/928f5bacb49e58c2885a0697c00d901a7750a55b))
* **benchmark:** publish the YouTube channel outcome as a transfer ([2e68cc8](https://github.com/event4u-app/agent-config/commit/2e68cc8359c885a010755751b303e26a531c2e2f))
* **roadmaps:** transfer the nine backend-gated YouTube lines to a stub ([2f982df](https://github.com/event4u-app/agent-config/commit/2f982dfe5f8b0654662fb6f37e09a0b52f9ea245))
* **roadmap:** transfer Phase 0 of per-turn-hook-economy to a host-repro stub ([e092198](https://github.com/event4u-app/agent-config/commit/e09219899542f54e363e9748b033d20bf0abd14b))
* **roadmap:** record the gated-reach-followup probe baseline and outcome frame ([b82592c](https://github.com/event4u-app/agent-config/commit/b82592c783669a66a9753ebe292acf17830c2abc))
* **roadmap:** close all six blockers on road-to-per-turn-hook-economy ([a276fda](https://github.com/event4u-app/agent-config/commit/a276fdac9710b6f517b7177080de66eadd43a807))
* **roadmaps:** close road-to-orchestration-scope-decision as transferred ([f8f71ae](https://github.com/event4u-app/agent-config/commit/f8f71aebfce91c54ba03fafc7cdf4351fde0c56d))
* **roadmaps:** register the shared task-completion observability stub ([b2f1119](https://github.com/event4u-app/agent-config/commit/b2f1119dafe3c4c22c55496f926a807fe6a2689d))
* **evidence:** publish the task-completion payload probe ([2c92bf3](https://github.com/event4u-app/agent-config/commit/2c92bf39401e14e6d9b1a32673d9ba49bae87075))
* **roadmaps:** close road-to-context-fidelity with honest outcome states ([51494f7](https://github.com/event4u-app/agent-config/commit/51494f7069c8c3d5f26dc5a08dbb12ba8cccbe24))
* **roadmaps:** add the compaction-survival census stub and register it ([fd76681](https://github.com/event4u-app/agent-config/commit/fd76681f93acaadc5228e2b9a5155341da815643))
* **roadmaps:** close always-on-orchestration with an honest outcome record ([50154f5](https://github.com/event4u-app/agent-config/commit/50154f5db715caf0d74f8b1980bf0d3e68d01945))
* **roadmaps:** add four drain-transfer stubs and scope the promotion criteria ([8e1bf99](https://github.com/event4u-app/agent-config/commit/8e1bf99121b690f66fe3493e6aa3e1f922e29712))
* **roadmap:** re-review the risk register instead of restamping its date ([851b356](https://github.com/event4u-app/agent-config/commit/851b35668bf0122af49f257254fae94941b62771))
* **roadmap:** close road-to-skill-ecosystem-gate-integrity honestly ([4823ee3](https://github.com/event4u-app/agent-config/commit/4823ee3c5a171d9402882b4f7f6e7da576b1c48d))
* **stubs:** transfer the kernel cross-link and its soak to a maintainer-owned stub ([53b286a](https://github.com/event4u-app/agent-config/commit/53b286a50b998a032a000d347fabcd841f6fb580))
* **false-green:** add the two catalogue classes Phase 3 Step 5 enumerated and missed ([0e09509](https://github.com/event4u-app/agent-config/commit/0e09509710522d2ebe89dcb89c9ad8691a2bc809))

### Refactoring

* **dashboard:** extract the --check report, keeping the generator under its ceiling ([0ceb2f4](https://github.com/event4u-app/agent-config/commit/0ceb2f4f7d0254e586821d00048c3aaa80783c1c))
* **repo:** untrack the three generated roadmap artefacts, guarded this time ([497b3a1](https://github.com/event4u-app/agent-config/commit/497b3a1159273e7ab11baa6cc4b1653457bdb168))
* **roadmap-progress:** extract the mode table so the growth ratchet holds ([c795ff4](https://github.com/event4u-app/agent-config/commit/c795ff42f0bf4247b3bfcf0641931c38220e8666))
* **stubs:** delete the hand-maintained stub index, the last authored hotspot ([3793855](https://github.com/event4u-app/agent-config/commit/3793855b3d9cf8e0e8cc0d72e303e14379f703e6))
* **repo:** untrack the roadmap dashboard, this repository only ([19362a7](https://github.com/event4u-app/agent-config/commit/19362a7e22de66df082301b83c12cf76d9e1d59d))
* **contexts:** pay down the depth ceiling by extraction, not by baseline ([fd0491c](https://github.com/event4u-app/agent-config/commit/fd0491c71e7d2cf0fc99c59f4560b91e8143874b))

### Tests

* **run-continuation:** scan the roadmap tree recursively for a verify line ([83170b5](https://github.com/event4u-app/agent-config/commit/83170b5706a8f72de9c55699582beab926407d5e))
* **preflight:** --enforce is unbindable here, not merely early ([8e460f6](https://github.com/event4u-app/agent-config/commit/8e460f6fc2b95c557496742a12b787d0e5ff4e3e))

### Build

* **dist:** commit the two new src/install modules ([c592f07](https://github.com/event4u-app/agent-config/commit/c592f07441191ea71b35996a17682c5e264d116f))
* **install:** refresh dist/install for personaWithheldFor and the measured state space ([54e5c36](https://github.com/event4u-app/agent-config/commit/54e5c36aaf7b2bbd6ef7b9a8e5efaed96862e1a2))

### CI

* **consistency:** run check-condensed-paths remotely ([31f812f](https://github.com/event4u-app/agent-config/commit/31f812fd2ecdfb74c6387d0bdb455cadca34c5ae))

### Chores

* **roadmap:** rebuild the archive index after the merge conflict resolution ([4c62da6](https://github.com/event4u-app/agent-config/commit/4c62da6b631b4775c663de8d2d2dbc8c221515f2))
* **archive:** regenerate the index after the #1518 merge ([7117665](https://github.com/event4u-app/agent-config/commit/71176651e85f6678f3ee5c311cd14ccd8d9ddce5))
* **archive:** regenerate the archive index after the main merge ([46b3669](https://github.com/event4u-app/agent-config/commit/46b36690e49d32f105c34911a74c3e26e92b5bbe))
* **estate:** walk open_blockers 34 -> 32 for the two resolved ADR-governance blockers ([56ffe95](https://github.com/event4u-app/agent-config/commit/56ffe95dc42a64fcbc65c606861a3fc703864e61))
* **adr:** refresh the evidence census for ADR-242 ([f2dfca1](https://github.com/event4u-app/agent-config/commit/f2dfca1835959e9e2828860891c1c30a2bd74c48))
* **roadmap:** restore the archive index entry lost in the merge conflict reset ([625ed04](https://github.com/event4u-app/agent-config/commit/625ed04f1a0b11128b5d48cfaae9a4e1d57feb65))
* **evidence:** declare the consumer-classification artifact's type ([4f37a79](https://github.com/event4u-app/agent-config/commit/4f37a79487a3929e91005d2accc2e94a70558462))
* **adr:** regenerate the evidence census for ADR-241 ([d39208b](https://github.com/event4u-app/agent-config/commit/d39208b302a327c65ca80813c9c9877bce2ce3c7))
* **proof:** regenerate docs/proof.md after the ADR renumber ([da767c3](https://github.com/event4u-app/agent-config/commit/da767c3f6eafa8a50fa21bd5e86ffe86d3ae4388))
* **dist:** re-project the generator after the self-header correction ([b156d86](https://github.com/event4u-app/agent-config/commit/b156d8631b00544bdc8d87f1821b630197814c13))
* **tokens:** re-anchor eager_rule_load, itemised with the measured split ([9bbfb3e](https://github.com/event4u-app/agent-config/commit/9bbfb3e23255f4659bf934616616e10e377d35ef))
* regenerate index, catalog and flows after the main merge ([59e85c9](https://github.com/event4u-app/agent-config/commit/59e85c9c8bb795de8a5bce24a78b3eebc82baf63))
* regenerate docs/proof.md for the four pre-registered metrics ([8664789](https://github.com/event4u-app/agent-config/commit/86647899f30b55a24b17828fc0ca602f003dfd83))
* regenerate dist projections for the ADR-governance surface ([dcaa3fc](https://github.com/event4u-app/agent-config/commit/dcaa3fc2987c6aced4dbe1a3ef2fbc85fee30757))
* **adr:** renumber to ADR-239 after a parallel-PR number collision ([535b20c](https://github.com/event4u-app/agent-config/commit/535b20c5a71a55fcd0f726c8f225c624cf4d2262))
* **estate:** record the merge-authority blocker in the ratchet ([d6ce9fd](https://github.com/event4u-app/agent-config/commit/d6ce9fd91672c49c3b06b769d043f83bf6219081))
* **estate:** ratchet the active-roadmap baseline down to 10 ([e79f045](https://github.com/event4u-app/agent-config/commit/e79f0450ef87686fedb6fc95c604133e6006aa6d))
* **roadmaps:** track the pre-existing condensed-link failure ([b8e6a3b](https://github.com/event4u-app/agent-config/commit/b8e6a3ba57468b24ffecb17d0c44772daef2031b))
* **gates:** lower the risk-register coverage floor to 10, with the evidence ([b68b2dc](https://github.com/event4u-app/agent-config/commit/b68b2dc6ad8b3ca3cedf77185bda237fa470e82a))
* **roadmaps:** land and archive the consumer-security-guidance roadmap ([be42d44](https://github.com/event4u-app/agent-config/commit/be42d44004a5a39ed2ec146e9a93af99f4ad4bd0))
* **security:** deny the evaluated source tokens in the confidentiality gate ([e53e623](https://github.com/event4u-app/agent-config/commit/e53e623bce3cdb59d7b4e665e53fab1e4fff93f9))
* merge origin/main and re-measure the ratchets ([34a01a1](https://github.com/event4u-app/agent-config/commit/34a01a1936d1450b8f97847d9bf10fe26ea63871))
* regenerate derived outputs after the merge ([3fd5547](https://github.com/event4u-app/agent-config/commit/3fd5547813c6ace6a57ac28d10a2cdf9beb5d18a))
* **roadmap:** regenerate derived outputs after the merge ([60c38ff](https://github.com/event4u-app/agent-config/commit/60c38ff30f195780004e2988f09bceca5416a430))
* **roadmap:** regenerate the archive index after the merge ([a7ad00a](https://github.com/event4u-app/agent-config/commit/a7ad00a9dc268334744b3ee6831fcc8271893935))
* **roadmap:** close road-to-user-out-of-the-loop with an explicit outcome ([05eeb5c](https://github.com/event4u-app/agent-config/commit/05eeb5ca3729668028c6a8fb52a6c138d986f5e4))
* **ratchets:** walk two baselines down for a drop nothing in the tree earned ([1145b72](https://github.com/event4u-app/agent-config/commit/1145b7210fb468522082238b0c481fe44ac2cbd2))
* **budget:** walk the estate ratchet down to 24 active / 63 blockers ([16a7da6](https://github.com/event4u-app/agent-config/commit/16a7da6d41b16263685f6e85d52508e02c30353e))
* **roadmap:** regenerate the progress dashboard ([5283653](https://github.com/event4u-app/agent-config/commit/5283653c68aed2f3114056aa78c993cd7a2713e3))
* **gates:** record the prominence-gate corpus boundary on its own entry ([9eabff8](https://github.com/event4u-app/agent-config/commit/9eabff87138de61aeee110c7cab831e1d63e7918))
* **gates:** walk the estate open_blockers baseline from 70 to 65 ([331870c](https://github.com/event4u-app/agent-config/commit/331870c1ccc4b3bcdb861e1b407f1946608246a4))
* **gates:** tighten the blocker-decidability ratchet from 20 to 15 ([394906d](https://github.com/event4u-app/agent-config/commit/394906d9f5526c24ea13ccee5c4a8a6acadd137e))
* **baselines:** lower the blocker-decidability ratchet 20 to 19 ([ee70d97](https://github.com/event4u-app/agent-config/commit/ee70d972d94946353a6cac1bf1aea6c0f5099646))

### Other

* **adr-governance:** scout step 4.3's permanence rows, walk decidability to 0 ([3c1f968](https://github.com/event4u-app/agent-config/commit/3c1f96810d5c4fb196f74fc1fe12b2a37c529a7f))
* Merge origin/main into drain/road-to-demand-gate ([d009712](https://github.com/event4u-app/agent-config/commit/d0097127364769f3fad97f496fdc65397f475ebc))
* **subagent-lifecycle:** publish the envelope-return column — 0 of 1,296 ([c75f7a5](https://github.com/event4u-app/agent-config/commit/c75f7a56f47b8ee4132791d93e54b4f74b51544c))
* **adr-governance:** resolve both owner-reserved blockers, close Phase 0B, 4.2, 6.3 and Phase 7 ([85352cb](https://github.com/event4u-app/agent-config/commit/85352cbd6218b3496c0bd2000f9d68b3eba218f2))
* close AC-3 on observed CI, archive road-to-condensed-link-repair ([1356099](https://github.com/event4u-app/agent-config/commit/13560994a606ede5c43461596ec0e3d7e9f7050e))
* **link-repair:** close 1.1 and 1.3, and AC-2 as an honest null ([408c05d](https://github.com/event4u-app/agent-config/commit/408c05d5d431dc68f3d161661f3fb6733171b202))
* close road-to-demand-gate-audience-followup as transferred ([05fb45f](https://github.com/event4u-app/agent-config/commit/05fb45f79ac540d99d3097530fecdc11684457aa))
* complete road-to-drain-commands ([a913b28](https://github.com/event4u-app/agent-config/commit/a913b28f65eee2f875b72d838430980d8b21a30c))
* archive generated-artifact-conflict-drawdown, complete ([7fd5c3c](https://github.com/event4u-app/agent-config/commit/7fd5c3cfe48fe77bb9ecbc59dde2b9a85fd7708a))
* record the generated-artifact conflict drawdown and what it refused ([0db1d47](https://github.com/event4u-app/agent-config/commit/0db1d47b441b4fb4204ba49b4f3c2301fb46c7c9))
* **r2:** re-bind after the main merge; findings unchanged ([6311611](https://github.com/event4u-app/agent-config/commit/631161151fe1e218d173ea5621d6f75dac4bd0c7))
* carry Phase 2 to a stub, and record why it could not ship here ([d7060c1](https://github.com/event4u-app/agent-config/commit/d7060c11c798167acdc662792b26802c5d62b25b))
* **r2:** bind the review to the shipped head, four rounds recorded ([b1ff1a7](https://github.com/event4u-app/agent-config/commit/b1ff1a71f67ce0297ecc5ee22331d47e92f972a8))
* close and archive merge-hotspot-drawdown ([587c975](https://github.com/event4u-app/agent-config/commit/587c9754d31ad7869ad213848e0ca000f4bbd8eb))
* re-true Phase 2 against the guard that actually shipped ([08f37d8](https://github.com/event4u-app/agent-config/commit/08f37d8871de4598e12df65ff50aca0d83f45fee))
* **r2:** re-bind the review package to the final head ([e1a2035](https://github.com/event4u-app/agent-config/commit/e1a2035e7a36578c2e4e882f9be6837538f3702b))
* **r2:** round 3 findings, recorded before their fixes ([d7a3f37](https://github.com/event4u-app/agent-config/commit/d7a3f37b488d84632f8ac7a568a4c5d0d3f9ee6a))
* **r2:** round 2 findings, recorded before their fixes ([728bf47](https://github.com/event4u-app/agent-config/commit/728bf47dd15b3c12fd7836d7bb162518cd53e377))
* close and archive wiring-truth-corrections ([5adc45c](https://github.com/event4u-app/agent-config/commit/5adc45c6accf182a4cd869c7a5397939b0ebcca0))
* **r2:** record the blind completion review before any of its fixes ([37100b8](https://github.com/event4u-app/agent-config/commit/37100b87461d81ee0fc396eea70339a7011eada8))
* **adr-layout:** add provenance + evidence axes, price reopen burden by grade ([f841ae5](https://github.com/event4u-app/agent-config/commit/f841ae5e462d8605904454d49c5b7f44f5c1c0d3))
* **estate-drawdown:** archive the closed roadmap and walk the ratchet down ([aa52b90](https://github.com/event4u-app/agent-config/commit/aa52b903eb35fea07ebf45e5adc653e9872c1039))
* **solution-minimalism:** record the closure as disposition 2 / `narrowed`, per the council's second pass ([ad96143](https://github.com/event4u-app/agent-config/commit/ad96143daa7181fb1c45a3e04e18d0f45d40838b))
* close standing-context-40k by per-step disposition, transferred ([0fd7a3e](https://github.com/event4u-app/agent-config/commit/0fd7a3e0359604b00fc4af8dbd775ff1e661f208))
* **estate-drawdown:** close the last five items against council dispositions ([d73d656](https://github.com/event4u-app/agent-config/commit/d73d656df209e282ab5774d9f8af39e8d3cb804a))
* **solution-minimalism:** archive at zero open, and repair every link the move broke ([fc3c294](https://github.com/event4u-app/agent-config/commit/fc3c294737ab36be35d14b86cc62d597655cd34a))
* **solution-minimalism:** close the quality-gates criterion on the authoritative gate ([aee9337](https://github.com/event4u-app/agent-config/commit/aee93372e6bc7157b6f9826f06b58999c38a2d8a))

Tests: 16175 (+406 since 14.7.0)

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
