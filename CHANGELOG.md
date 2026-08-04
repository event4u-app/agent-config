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
