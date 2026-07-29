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

# Era: 9.9.x — current

> Started at `9.9.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.10.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.9.0](https://github.com/event4u-app/agent-config/compare/9.8.0...9.9.0) (2026-07-29)

### Features

* **scripts:** broaden check_source_pointer_freshness allowlist to the cleaned files ([7b80962](https://github.com/event4u-app/agent-config/commit/7b809628176eb0c8862fb08e618e6b8f8eb145ba))
* **roadmap:** close road-to-native-code-intelligence — Phase 5 cancelled, archived ([07f076b](https://github.com/event4u-app/agent-config/commit/07f076bcc900874bcb27b609f007d0996b869958))
* **comparison:** publish the code-graph retrieval null as a comparison row ([9f1d073](https://github.com/event4u-app/agent-config/commit/9f1d0732e090877c9d80de2faf041e5a0bf0042e))
* **docs:** track scheduled deprecations forward, not only after they ship ([9858cb8](https://github.com/event4u-app/agent-config/commit/9858cb8ab4457f09f8ee2609c74e9cb22c609de0))
* **team:** enforce the /team:delegate double gate in code, not only in prose ([4330c00](https://github.com/event4u-app/agent-config/commit/4330c0081eb28d6615d2f9d11fffb83c08ac34c8))
* **provenance:** condense projections, cancel S2.3, archive the completed roadmap ([04a4b8c](https://github.com/event4u-app/agent-config/commit/04a4b8c869f2760a359c30160dcd4442a6a80da5))
* **provenance:** claims + vocabulary gate + ADR-136 honesty boundary (Phase 3, S4.4) ([d40410f](https://github.com/event4u-app/agent-config/commit/d40410ff28676c2a5780b3a1c2082048fbcda531))
* **provenance:** REUSE 3.3 compliance via path globs, reuse-lint in ci-strict (S4.2) ([f5dc480](https://github.com/event4u-app/agent-config/commit/f5dc48071a125bc6327aab5d8ca9bb66a5ed0636))
* **provenance:** code-provenance rule + license-compliance skill family (S1.1/S1.4) ([aa372ed](https://github.com/event4u-app/agent-config/commit/aa372ed26c248a76152e36b1dba8f928e4e509af))
* **provenance:** S4.1 self-audit exhibit + S4.3 sibling-repo verification ([bb31b61](https://github.com/event4u-app/agent-config/commit/bb31b6175313c9766e3affc21e9310ae1b5c5b96))
* **provenance:** baseline + G0 verdict (thresholds missed), ledger, license derivation ([23b5b01](https://github.com/event4u-app/agent-config/commit/23b5b017115369f20a92c3b1c2fcab51eb1339be))
* **provenance:** frozen golden corpus + pre-registered thresholds (S0.1/S0.2) ([a64c838](https://github.com/event4u-app/agent-config/commit/a64c83895aace5b21d1d71d4bf6f368196022631))
* **council:** Phase-2 A/B run + Ü1 blind synthesis adopted as default ([608514c](https://github.com/event4u-app/agent-config/commit/608514c8d3de485534128d1499df81d3bf57a614))
* **council:** flag-gated blind-review protocol upgrades (Phase 1, default-off) ([560a024](https://github.com/event4u-app/agent-config/commit/560a024b2f4f1e353b39e05964ff1a4d8b1175c0))
* **roadmap:** road-to-provenance-and-license-governance — council-reviewed plan ([a5ebc27](https://github.com/event4u-app/agent-config/commit/a5ebc273bc5f8601f64b47f08f2c70f62b4d1070))
* **roadmap:** road-to-council-blind-review — three council-cut deliberation upgrades ([7c33b8f](https://github.com/event4u-app/agent-config/commit/7c33b8f21183b074abd42087236000080d2fe275))
* **telemetry:** review follow-ups — vertical/substrate dispositions, L6 rule-usage signal ([60c4498](https://github.com/event4u-app/agent-config/commit/60c44986452e66c9af74c32a2738a79d80280607))
* **rules:** role-scoped rule projection (roles: frontmatter axis) ([587115f](https://github.com/event4u-app/agent-config/commit/587115f3908122e72ba05a59bfe22ac592bbdc33))
* **telemetry:** lean-init audit fields, claim pre-registration, spawn-payload linter ([f080c46](https://github.com/event4u-app/agent-config/commit/f080c468d9868b2da9b5e8f347ff2ef59c98193c))
* **spawn:** per-worker token stop-loss (L0b), prefix-stable payloads, measured rtk allowlist ([0f72692](https://github.com/event4u-app/agent-config/commit/0f7269260023ac17957fcd97ccc4a8a66c40d7ab))
* **dispatch:** lookup-class tool-not-agent routing (L0) with golden correctness proof ([e1991d5](https://github.com/event4u-app/agent-config/commit/e1991d5c94bd3133d4245633494ed0dccc6801ec))
* **server:** profile-awareness when running under an agent-switch profile ([401eee2](https://github.com/event4u-app/agent-config/commit/401eee268e1407b1d57f1014cbe1dbfe715d0328))
* **wizard:** agent-switch companion detection + passive tooling row ([e01cf72](https://github.com/event4u-app/agent-config/commit/e01cf7225ff13d1726f1c9404d7e3ea33522bee9))
* **build:** install-bundle path-leakage guard + reproducible-build doc ([6f7ab6d](https://github.com/event4u-app/agent-config/commit/6f7ab6d7b2d2553892de884ad74d4f92a926b36f))
* **review:** tag-aware release mode for the self-review gate ([3de07a9](https://github.com/event4u-app/agent-config/commit/3de07a9b4e82507eacea4f7ae264108831373bcf))
* **telemetry:** cross-source ask-rate facet on the engagement event ([f1e6660](https://github.com/event4u-app/agent-config/commit/f1e66600add9ac7ef6aa9f8b00b887f0396d7345))
* **eval:** cross-source-consistency eval runner (9.2.0-followups step 1.1) ([dd13ff8](https://github.com/event4u-app/agent-config/commit/dd13ff858c2a65444371a91db99c2932dccd8918))
* **council:** model_downgrade.auto_apply default true→false (suggest, not silent) ([3ea2c49](https://github.com/event4u-app/agent-config/commit/3ea2c4997827bbf32ad55a1bc735bd3fab8a61b0))
* **rules:** enforced_by declarations for the high-risk set — honest where none exists ([a499a65](https://github.com/event4u-app/agent-config/commit/a499a6541117085158dcc0b5f13518ba3509e961))
* **bench:** pre-registered code-graph vs grep benchmark — honest null ([297fe9d](https://github.com/event4u-app/agent-config/commit/297fe9db43c101ea668fe6f7259a3592152039bf))
* **cli:** one-time GUI notice on first interactive invocation ([0762954](https://github.com/event4u-app/agent-config/commit/0762954df406ebfaa8f442e8e08416c4c0ce4d92))
* **release:** install E2E gate in the release path + Tests-footer check ([3e4ee4c](https://github.com/event4u-app/agent-config/commit/3e4ee4cf08e512836d1295c1b49beda1290aca5b))
* **security:** secret-detector adversarial corpus + two measured fixes ([9ef8b4e](https://github.com/event4u-app/agent-config/commit/9ef8b4e1691510e64870b43339880227f535f4d5))
* **cli:** rtk:detect readout, doctor-shell rtk row, versioned detection contract ([1123621](https://github.com/event4u-app/agent-config/commit/1123621c60a29bcd61cc4725ada1b58e8dd2501b))
* **install:** rtk two-stage identity detection with verified per-OS install commands ([fc308f7](https://github.com/event4u-app/agent-config/commit/fc308f7d354a78490f05ce0f8f351fb926853f3c))
* **ci:** token drift + contrast gate; tokens:build / tokens:check scripts ([eca5a20](https://github.com/event4u-app/agent-config/commit/eca5a2004902dd537b7689909b7733810cfbc41d))
* **tokens:** agent-switch generator — shadcn block + wiring note ([d9e50aa](https://github.com/event4u-app/agent-config/commit/d9e50aac5f9e8610d2efa5e8551e9af460e438d7))
* **tokens:** src/ui/tokens.css becomes generated — orange accent lands ([9c073d7](https://github.com/event4u-app/agent-config/commit/9c073d7a724a85d073d50293ebc4c9b7179ebe5e))
* **tokens:** canonical event4u token source + S0.1 contrast verdict ([549a6d6](https://github.com/event4u-app/agent-config/commit/549a6d67d9379ce21062d38c224e428bf61e6c43))
* **verification:** evaluator page, internal-ref lint at zero, containerized umbrella gate ([51710ca](https://github.com/event4u-app/agent-config/commit/51710ca80fcfab28412de151696478f07c6cbbc4))
* **mcp:** generated catalog, honest annotations, stubs off the wire (ADR-132) ([6e1780e](https://github.com/event4u-app/agent-config/commit/6e1780e0e4c18a15a0e4812325440d6569bb859a))
* **install:** scoped projection is the default for new installs ([0857e42](https://github.com/event4u-app/agent-config/commit/0857e42ec4c4cfcb8c8e53ddd3ffa0492977420c))
* **hooks:** precompiled single-process dispatch — ~1.6s p50 to ~70ms ([43005ea](https://github.com/event4u-app/agent-config/commit/43005ea84aa04b3ae11c0b4cffdc5e8fb350d9d7))
* **skills:** add severity-conditioned team composition guidance to subagent-orchestration ([215cb7a](https://github.com/event4u-app/agent-config/commit/215cb7a8cff8c3e44bd9bb9415fc44e532b12831))
* **rules:** session-canary rule (greet-by-name liveness canary + reply-close hardening) ([46cbf2f](https://github.com/event4u-app/agent-config/commit/46cbf2ff7da9e892848901cc619a0c22540cb445))
* **hooks:** session-canary session_start injection ([53db8ae](https://github.com/event4u-app/agent-config/commit/53db8ae75e2dcbe481e2867b3c46232f8bb6cc21))
* **settings:** add personal.canary_name session-canary key ([8dc8bab](https://github.com/event4u-app/agent-config/commit/8dc8babc325339cd3c32ad2748690ee3e0a2d3c0))
* **install:** memory merge=union attributes - fragment, dogfood apply, installer sync, doctor check ([601c622](https://github.com/event4u-app/agent-config/commit/601c622a2287bad3c18004ce4b75cfa04be94cbe))
* **memory:** subject-axis storage boundary - store-boundary lint, provenance write-gate, tripwire honest-null ([2a681dc](https://github.com/event4u-app/agent-config/commit/2a681dc3dcdc7f1c1fc32094c5b0a1c3bfc8c998))
* **memory:** node:sqlite substrate - shared guard, FTS5 recall-gap closer, user_version zero-touch upgrades ([f771ee1](https://github.com/event4u-app/agent-config/commit/f771ee10bfad054dd43ba390718b7e94b77127d2))
* **memory:** session_end learning-sidecar wiring, default off; intake write path exists on fresh clone ([25d9878](https://github.com/event4u-app/agent-config/commit/25d98786afb5ab8a28b09ce9c349d9a082b5ecf0))
* **code-graph:** freshness verdict + refresh budget, read-plan output, intent router, derived sqlite twin ([0f2a344](https://github.com/event4u-app/agent-config/commit/0f2a344f45d57688c07b85ff3d3d5b81e79fbea0))
* **cli:** register code-graph, memory:get/learn, analytics, knowledge; lint pins the bug class ([0c66789](https://github.com/event4u-app/agent-config/commit/0c66789c9734061417e86a78dd5a46e04b83ebc0))
* **bench:** scale-history pre-registration + dry-runnable harness ([74b53ef](https://github.com/event4u-app/agent-config/commit/74b53ef7098d61b25ebc4dc21c117ee44e9482e9))
* **packs:** scale-discipline + history-discipline — default-off pack surface ([3d12492](https://github.com/event4u-app/agent-config/commit/3d12492374378098913e0fb28871b2cec7d35e25))
* **persistence:** deterministic lint substrate — 5 spike-verified adapters ([90f3880](https://github.com/event4u-app/agent-config/commit/90f38806b5ee4a4da725e1f14c277e3b7d678b76))
* **hooks:** tool-call-time deny on kernel rule writes (Layer 1) ([dd96761](https://github.com/event4u-app/agent-config/commit/dd967614a47f91991cd62d1488720b0a49c51d97))
* **bench:** deterministic honesty scorer ([4443e4e](https://github.com/event4u-app/agent-config/commit/4443e4ec28442375af89e4f10bbd5640c5c49887))
* **bench:** honesty bench corpora - rebuttal, clean-control, false-premise ([120590e](https://github.com/event4u-app/agent-config/commit/120590ee8709a7d6dd64de148f0df3f194eb14fb))
* **install:** non-blocking installer drift report on global update ([e158d0f](https://github.com/event4u-app/agent-config/commit/e158d0ffd884e43080d0ede278af2141566446bf))
* **lint:** extend override guard with ordinary-override citation check ([a8065fd](https://github.com/event4u-app/agent-config/commit/a8065fd818c8b7eba1302d64e1b9575f7c7f7256))
* **lint:** governed-writes scan over protected ledger surfaces ([fdcb34c](https://github.com/event4u-app/agent-config/commit/fdcb34c81b5cb7e47d1794fa5cfbb357e7c2fe5a))
* **rules:** anchor inbox-file archival at the roadmap self-check ([ce2d96f](https://github.com/event4u-app/agent-config/commit/ce2d96f14660bf68af88f57077631d99d9775875))
* **commands:** add /fix:pr-comments-loop — autonomous Copilot review-fix loop ([c44769d](https://github.com/event4u-app/agent-config/commit/c44769d76c72241a05efd44d56578391816da4bd))

### Bug Fixes

* **commands:** resolve command visibility from `visibility`, not the tier alias ([fbc05ac](https://github.com/event4u-app/agent-config/commit/fbc05acb4ebca4777624e92acbce298b5dc53245))
* **proof:** regenerate docs/proof.md for the new comparison row ([78589b2](https://github.com/event4u-app/agent-config/commit/78589b24e32056a7a76122c8b5e08c20c40f0651))
* **source-confidentiality:** retire the opt-retrieval denylist exception ([760245e](https://github.com/event4u-app/agent-config/commit/760245efd74c36df623be7a61a240da9fac6d178))
* **roadmap:** regenerate the dashboard after the #1033 / #1034 merge-order drift ([a0953fa](https://github.com/event4u-app/agent-config/commit/a0953fa4852e735694b9d921be9a5854cae56a56))
* **roadmap:** repair two invalid complexity tags the closeout sweep surfaced ([c95dcd6](https://github.com/event4u-app/agent-config/commit/c95dcd6ee7889329c6a4a3f96cae007f534e7836))
* **commands:** harden /fix:pr-comments-loop review findings ([db0127e](https://github.com/event4u-app/agent-config/commit/db0127e0f291265dac5e2eddb8fc28931397e862))
* **router:** comma-free intent trigger so the minified artifact keeps its format ([0149d8e](https://github.com/event4u-app/agent-config/commit/0149d8e37bcf5828beb7aa59a8a8739ba113e2bb))
* **claims:** re-measure artefact-count denominators after the new rule and skills ([b55db3a](https://github.com/event4u-app/agent-config/commit/b55db3a8180c457d957440917c665d6997858bf1))
* **skills:** consumer-safe script invocations in the license-compliance skills ([6c3c9c3](https://github.com/event4u-app/agent-config/commit/6c3c9c361eb20058700ffc97a6cf691f9aced859))
* **docs:** ASCII adoption labels in the council contract (md-English linter) ([6a9d38a](https://github.com/event4u-app/agent-config/commit/6a9d38a7306eedd08163382b8f2fb98593d9375b))
* **roadmap:** provenance corpus denominators — 24 seeded so every frozen threshold parses ([5aebb79](https://github.com/event4u-app/agent-config/commit/5aebb7985d2a04ca591259b8202bd60fb2ffcfb0))
* **roadmap:** inline council trace — no transient council-path reference ([80e1df4](https://github.com/event4u-app/agent-config/commit/80e1df48e9f1472bc4fb0e1df5e4186a4b536b14))
* **ci:** regenerate proof page after CLAIMS.md pre-registration ([ae691bf](https://github.com/event4u-app/agent-config/commit/ae691bfd6f2345c7caf2a5c6a1c9fac4c444efc9))
* **schema:** drop dead-path literal from roles description (ADR-051 guard) ([c9e94c6](https://github.com/event4u-app/agent-config/commit/c9e94c6c091e43ccde78f175be2db6fba5dc251e))
* **roadmap:** anonymize external source name in lean-agent-init roadmap ([fe11af0](https://github.com/event4u-app/agent-config/commit/fe11af02a09baee0c101000d8eb510a972d0121b))
* **security:** strip GIT_DIR/GIT_INDEX_FILE/GIT_NAMESPACE from spawned env ([517b823](https://github.com/event4u-app/agent-config/commit/517b823f87da05d734d4938103945cfcd664bfd9))
* **glama:** source node 24 from official image, drop nodesource ([f15ae63](https://github.com/event4u-app/agent-config/commit/f15ae63ed33da8b15cc800f9bb1dd3db4ca7269c))
* **ci:** portability wording in projected skill + fresh install bundle ([38c5061](https://github.com/event4u-app/agent-config/commit/38c50618352d4137990b64b21c545f4473041b2b))
* **hooks:** gate rtk_wrap nudge on verified Token Killer identity ([ddd50e8](https://github.com/event4u-app/agent-config/commit/ddd50e8ba28d69375beda494aba4fc9b43e878ad))
* **wizard:** four-state rtk detection, real upstream repo, both wizard modes ([1c477ab](https://github.com/event4u-app/agent-config/commit/1c477ab13fc1c5888d938d63ae4a0ba69b8f7cff))
* **ci:** drift-check treats an in-PR manifest change as a pending change, not drift ([a81e697](https://github.com/event4u-app/agent-config/commit/a81e697e93a2b4db670155d76a7f2e71738c2229))
* **ci:** hook-bench regression net loosened to a x3 pathology catch — absolute caps bind ([f5ab388](https://github.com/event4u-app/agent-config/commit/f5ab3889a819c6753d25a507d2e14519b67abe56))
* **ci:** green the PR gates — CI-environment hook baseline, leakage allowlist, legacy-path rewording ([351bd3f](https://github.com/event4u-app/agent-config/commit/351bd3f90cf288cd290221315ca44d77820d403d))
* **security:** clean the fresh-install audit surface and kill install-path rot ([06bd4c5](https://github.com/event4u-app/agent-config/commit/06bd4c5d3726d3b85995e8d00d7dea6463c0b1af))
* **ci:** resolve enforcement-coverage claim for the 110th rule ([6a9c752](https://github.com/event4u-app/agent-config/commit/6a9c752a90801b501e7f9e1afbb62412a4fcbe7d))
* **lint:** drop legacy-path reference from lint_documented_commands header (ADR-051 guard) ([cd18b1e](https://github.com/event4u-app/agent-config/commit/cd18b1e8ebd1bc33f6962682d2ca780988db39f6))
* **bench:** council PR-review round — symlink hardening + confinement tests ([f0cfea6](https://github.com/event4u-app/agent-config/commit/f0cfea66f044cafdf137fc367aa831460e1804bf))
* **bench:** harden the scorer against untrusted bench artifacts ([1d417e8](https://github.com/event4u-app/agent-config/commit/1d417e824473bc0e4e59cead04d98a19185f5e57))
* **ci:** regenerate proof/claims counters + multi-stack Tier-1 gotcha ([e47fd4a](https://github.com/event4u-app/agent-config/commit/e47fd4af806f40807f185e4bb10fc53654fe9c5f))
* **evidence:** secret-allow markers on documented false-positive excerpts ([24e5f12](https://github.com/event4u-app/agent-config/commit/24e5f12efa885a971398bd9e5238b4367c518436))
* **bench:** clear eslint no-unused-vars in the scorer test ([8520956](https://github.com/event4u-app/agent-config/commit/8520956f1fb59d333e1a0583c80171c283bb8f53))
* **ci:** wire the memory-intake append-only gate (was fail-open) ([adffeb1](https://github.com/event4u-app/agent-config/commit/adffeb1023d3c07935ec9530129178ac6a5b40f1))
* **gates:** point the token-optimizer catalog at a target that survives a clone ([4edb072](https://github.com/event4u-app/agent-config/commit/4edb072736ae0395487cb218870d2f298759b2c4))
* **ci:** re-baseline the debt ratchet to 0, and say so everywhere it was 37 ([6a55bf2](https://github.com/event4u-app/agent-config/commit/6a55bf28ad27c593f19041bacad78e3e30578593))
* **gates:** stop two backstops flagging what their own rules allow ([8194175](https://github.com/event4u-app/agent-config/commit/819417569e7db7f0dd167fd9c8e1b1d4569c3863))

### Documentation

* **roadmap:** archive completed road-to-retire-stale-authoring-pointers ([da35e71](https://github.com/event4u-app/agent-config/commit/da35e718ddbd5b0e271e5a726d03ffd98968c7de))
* **changelog:** record the authoring-source-pointer retirement under [Unreleased] ([dafe306](https://github.com/event4u-app/agent-config/commit/dafe30670c6a52513526d197c70eb60107ed3562))
* retire stale `.agent-src.uncondensed/` authoring pointers → `src/` ([4e1f9fd](https://github.com/event4u-app/agent-config/commit/4e1f9fdb2757ff0fe37a27102a3da23b35d00b2d))
* **roadmap:** close surface-consolidation's acceptance criteria on measured evidence ([0f63197](https://github.com/event4u-app/agent-config/commit/0f63197fc52c4453044afd1e109bc82da771d3e4))
* **changelog:** repoint the era-split drift-test references at the TS test ([870ff40](https://github.com/event4u-app/agent-config/commit/870ff40e787f59a59a7e44b08c1b5a4d3cb64cf6))
* **roadmap:** close the agent-executable half of road-to-tier-removal ([bd157b0](https://github.com/event4u-app/agent-config/commit/bd157b00b86f220c4e919c36e93e9b7b3be3406e))
* **adr:** ADR-137 — amend the tier-removal re-open triggers ([aa623ea](https://github.com/event4u-app/agent-config/commit/aa623ea7b2766a7071d79df7b18a192226777250))
* **roadmap:** record that the scope-dilution mitigation failed ([c92f90e](https://github.com/event4u-app/agent-config/commit/c92f90e70f51df5594883186f923a7acdc479830))
* **wedge:** mark the code-graph corpus as no longer feeding a pending decision ([52ea895](https://github.com/event4u-app/agent-config/commit/52ea895a34ab6d2f1aef7ecdc10f55ab7446cace))
* **adr-124:** record that the doctrine's first engine returned an honest null ([a6c2e51](https://github.com/event4u-app/agent-config/commit/a6c2e5153e06d5bd62f5abeb683807125a82e221))
* **refs:** drop roadmap paths from four artifacts whose targets moved ([22017c2](https://github.com/event4u-app/agent-config/commit/22017c2496793013c3b263a630da58ea2f3e2cbe))
* **changelog:** record the team-mode gate + parity fixes under Unreleased ([8a66310](https://github.com/event4u-app/agent-config/commit/8a66310fb9d1ebc29a5b0dabc5797a9a0567e1df))
* **roadmap:** park credible-install + request-scoped-rule-load in later/ ([6fa6407](https://github.com/event4u-app/agent-config/commit/6fa640757fc9eb5cf114aba4550bca43d1edab09))
* **roadmap:** close three roadmaps at 100% — U6 lock upheld, 1.5 transferred, window step re-homed ([a1c1b36](https://github.com/event4u-app/agent-config/commit/a1c1b363f401154ec8865806b790e00f62354540))
* **roadmap:** close road-to-team-mode — acceptance criteria verified, deferrals disposed, archived ([489c5eb](https://github.com/event4u-app/agent-config/commit/489c5eb3bdaba4cfd5117b43154706aaa29fbfe2))
* **team:** correct the stale "not yet manifest-wired" header comments ([9cff7a3](https://github.com/event4u-app/agent-config/commit/9cff7a330a600d59c31ff8de745d4093227afc40))
* **readme:** reorder badges — CI/npm badges to top, artefact-count badges consolidated ([30a240b](https://github.com/event4u-app/agent-config/commit/30a240b8ef244eaa0e295115251c49d97166789a))
* **roadmap:** close road-to-ac-embeddable-gui — verified landed, QA matrix recorded, archived ([a4d348b](https://github.com/event4u-app/agent-config/commit/a4d348b977a5b68eae6afa044e4b30507ebf84ed))
* **contracts:** complete the embed contract and de-drift local-server-api ([b7a221b](https://github.com/event4u-app/agent-config/commit/b7a221bcf6523ed8a5c5ca26f88271da5a3bf45f))
* Works-with-agent-switch README section + docs-site guide ([87605e6](https://github.com/event4u-app/agent-config/commit/87605e6fa96f7e93855599eb0e2d93bf787aa6bd))
* **proof:** regenerate proof page for the new claims-ledger entry ([f16f67d](https://github.com/event4u-app/agent-config/commit/f16f67db5576b48f3ce2444742654a45a6cfc157))
* **claims:** pre-register cross-source-consistency precision claim ([26adee8](https://github.com/event4u-app/agent-config/commit/26adee8a96c7e0c4ce355f1f1833e454291e5060))
* **disposition:** honest-null survivor dispositions recorded ([fcb9560](https://github.com/event4u-app/agent-config/commit/fcb9560ad368e78d947fea3311795d0e3b9d955c))
* **proof:** ADR-124 positioning, defused superlative, two axes on the proof page ([09afdc0](https://github.com/event4u-app/agent-config/commit/09afdc042c9bcc3f2013487aa6e77c6dacbb1b27))
* **adr:** freeze unblock-list, dated launch defer, trust-boundary escalation ([d2aadd2](https://github.com/event4u-app/agent-config/commit/d2aadd20ef2bf23f9e42965ef792546e6a0f46ad))
* **rtk:** attribute savings claims to upstream, publish scoped own measurement ([15e1a7b](https://github.com/event4u-app/agent-config/commit/15e1a7bffe92368ab798c34a2ac5bc12f92d316f))
* **embed:** theme contract — precedence, OS re-drive, accent bound ([4a889b2](https://github.com/event4u-app/agent-config/commit/4a889b2005b75cd06b9209191d5befa300908251))
* **release:** cadence contract + latest/next dist-tag routing ([698f73f](https://github.com/event4u-app/agent-config/commit/698f73fda293461a66772be89b8d825f510bb752))
* **roadmaps:** close persona-catalog disposition; file funnel-lesson input with adoption roadmap ([2018dd1](https://github.com/event4u-app/agent-config/commit/2018dd178930d5d6e7d0e3c113d212f6513775bd))
* **evidence:** point evidence reports at the archived roadmap path ([63ab4eb](https://github.com/event4u-app/agent-config/commit/63ab4ebb0bf9484e61e8ef41aefdc0de4305cc77))
* **adr:** add review_trigger to ADR-129 and ADR-130 ([eed2ecc](https://github.com/event4u-app/agent-config/commit/eed2ecccb79e93650a56432c54f07ae1ab104510))
* **adr:** ADR-129 sqlite-substrate maintainer override + ADR-130 subject axis ([94f021f](https://github.com/event4u-app/agent-config/commit/94f021f6d7a84021f9382ab09fded334c54343e7))
* **records:** council falsification note, capability audit, launch inputs, 60s gate ([9038b6c](https://github.com/event4u-app/agent-config/commit/9038b6ca0159643e330d25d36fe1de0ef148202a))
* **evidence:** Phase-0 spikes A/B/C with pre-registered verdicts applied ([963dd29](https://github.com/event4u-app/agent-config/commit/963dd2982bd0db771a7dc210c83abe2341eb2a49))
* **security:** kernel immutability is three-layer; Layer-2 statement projected ([9f6c85a](https://github.com/event4u-app/agent-config/commit/9f6c85a6efd0cf59d33d3e9ee0d1f94f3896e7a1))
* **bench:** pre-register the honesty bench design ([b584429](https://github.com/event4u-app/agent-config/commit/b584429c55656d879c0a0cdf37c80219eb8cb28d))
* **evidence:** impossible-cycles audit, adoption input, exec caveat line ([4e186fa](https://github.com/event4u-app/agent-config/commit/4e186fad927952b28e12ea6d7d42a539fc93c368))
* **disposition:** record enforcement-first rejection and E-pack deferral ([7f523fb](https://github.com/event4u-app/agent-config/commit/7f523fba4f12c97bc13b89d493c5ddd0e2d633c0))
* **evidence:** record canary calibration cycle 2026-07-c1 (miss + RCA) ([5ae833e](https://github.com/event4u-app/agent-config/commit/5ae833e81eca471d70cf8cce1718ad2b6880f2e9))
* **contracts:** add the adversarial-review-protocol contract ([f4b1aed](https://github.com/event4u-app/agent-config/commit/f4b1aed63080711ef430f395da80ff87b5c7fca8))
* **roadmaps:** add the inbox-sweep draft roadmaps (five intakes, five cuts) ([a79d7e5](https://github.com/event4u-app/agent-config/commit/a79d7e548af67c9f119914bec6a235fe09be0ad8))
* **roadmaps:** add the 9.8.0-feedback remediation drafts ([6ab11f6](https://github.com/event4u-app/agent-config/commit/6ab11f60d47bb6c608279c2cd9cca1b4eeb99689))
* drop seven pointers at files that are gitignored or archived ([3396178](https://github.com/event4u-app/agent-config/commit/3396178d5130cc1bedc714b319f650a004da7755))
* **skills:** give four single-stack lines a second ecosystem ([a1ab343](https://github.com/event4u-app/agent-config/commit/a1ab3438bc2f2b968aff3193b1da5ad6e98d75ac))

### Refactoring

* **skills:** move subagent-orchestration mode detail to contexts ([2f694f4](https://github.com/event4u-app/agent-config/commit/2f694f4f7d5f42f4b91952f66966c798d4d20127))

### Tests

* **team:** pin the default-off parity the acceptance criterion actually names ([f837c84](https://github.com/event4u-app/agent-config/commit/f837c846aa6d64eeb65f2894d930755fa6b5442c))
* **server:** pin the embed capability block in the ping readout ([df648b6](https://github.com/event4u-app/agent-config/commit/df648b6a61603778585af56781446b1cb168b3b4))
* **evidence:** evidence-engine meta-tests — five failure modes caught red ([71137fc](https://github.com/event4u-app/agent-config/commit/71137fc0f95ddb0e11244be5cf852af01ff1f11f))
* **deps:** recognize prefix-only builtins (node:sqlite) in the runtime-dependency gate ([ab7ee51](https://github.com/event4u-app/agent-config/commit/ab7ee516289d7a5082e929f87c22681b027de619))
* **spikes:** pre-registered falsification spikes S0a-S0d for reachable-code-memory ([4a5c3c1](https://github.com/event4u-app/agent-config/commit/4a5c3c1bd5d948e82661e5fc4ef3b2e54f43b912))

### Build

* **install:** rebuild install.mjs for the visibility-primary wrapper gate ([72ca8fa](https://github.com/event4u-app/agent-config/commit/72ca8fa8711df7a861476dae143fa2f40f44f16d))

### Chores

* **roadmap:** use status completed on the archived roadmap ([4fecd5f](https://github.com/event4u-app/agent-config/commit/4fecd5fbd363c8ab5ea10d8b301e07bcb8291dbd))
* **test:** drop the unused render_review_user_prompt import ([df19f1c](https://github.com/event4u-app/agent-config/commit/df19f1c38b3dd12d39273b60801171f01b2fdab8))
* **counts:** classify /fix:pr-comments-loop in surface-map + re-measure count surfaces after main merge ([51ee214](https://github.com/event4u-app/agent-config/commit/51ee2149aa699eae1514d39c20bf8ee415240ab7))
* **generated:** regenerate router + governance doc for the new code-provenance rule ([7ad0a2e](https://github.com/event4u-app/agent-config/commit/7ad0a2ec17ff8c21eac3ccbaf711fe55121d9c39))
* **lint:** exclude the provenance golden corpus from eslint ([9087db3](https://github.com/event4u-app/agent-config/commit/9087db3b7a6f5d013503dc765083d6441d7456a1))
* **roadmap:** Phase 5 DROPPED — residual class is rename-only, which a critic cannot fix either ([690514c](https://github.com/event4u-app/agent-config/commit/690514c4f0645473fbbe7954e0b16be57adb79e4))
* **roadmap:** regenerate dashboard after rebase onto inherited main-merge ([13a530d](https://github.com/event4u-app/agent-config/commit/13a530d2a9659be7365e5d3b90331136fba5c28f))
* **roadmap:** close road-to-lean-agent-init — 14/14 steps, results summary, archive ([c342102](https://github.com/event4u-app/agent-config/commit/c342102c1cc89ca4a28199264c2d1ee3ea1b2c3e))
* **roadmap:** regenerate dashboard after merging main ([1699234](https://github.com/event4u-app/agent-config/commit/1699234eac8edc20c8969f1ed9de379f9161a43f))
* **roadmap:** close and archive road-to-reciprocal-ecosystem ([33d3122](https://github.com/event4u-app/agent-config/commit/33d3122366f9728c5e99abb4c11e1879b3b52990))
* **roadmap:** 9.2.0-followups - 10/11 closed, gated 1.5 stays open ([490ae29](https://github.com/event4u-app/agent-config/commit/490ae294a1e81f664db6b22efda49c2dfe840f1c))
* **roadmap:** pin frozen critic-prompt + rubric SHA in spike pre-registration ([ab28ba4](https://github.com/event4u-app/agent-config/commit/ab28ba4bee3883153d00cfba12375b0957bde610))
* **roadmap:** ai-pairing feedback — lean-agent-init active, sparring-critic spike parked ([eab3d7b](https://github.com/event4u-app/agent-config/commit/eab3d7bfb5295a6a8c0d8a7047d3d108068cfc1e))
* **roadmap:** 9.8.0-followups — 21/22 closed, window-gated item stays open ([26a0849](https://github.com/event4u-app/agent-config/commit/26a08494f5a9b8fc21265cad70387a7bed7ad218))
* **roadmap:** close road-to-rtk-onboarding-correctness ([1cc4f2c](https://github.com/event4u-app/agent-config/commit/1cc4f2c67213bf223f09f4a6b5f758b86629dc3e))
* **roadmap:** close + archive road-to-shared-design-tokens ([6d9da26](https://github.com/event4u-app/agent-config/commit/6d9da262190ccec45392dc8be9f757a69729e97b))
* **roadmap:** close road-to-credible-install build work (29/30) ([5ce6437](https://github.com/event4u-app/agent-config/commit/5ce643761550d1a9410844905dee24a170dc0681))
* **hooks:** pre-register the hook-latency budget ([e66aba5](https://github.com/event4u-app/agent-config/commit/e66aba533a0e689c2ae888265d26fca27bbab1e5))
* **docs:** refresh routed-rule count (105 -> 106) after session-canary ([0ad5821](https://github.com/event4u-app/agent-config/commit/0ad5821196665eddd8172d08d8a44ce6b3c3dc3e))
* **roadmaps:** close and archive road-to-reachable-code-memory ([dc7123f](https://github.com/event4u-app/agent-config/commit/dc7123fa869c88ffe702ef90aaea78c8dffa33a5))
* **roadmaps:** visible bench-run follow-up + S0.6 registration ([f82301f](https://github.com/event4u-app/agent-config/commit/f82301fed38a9c90e6963265b75fde1eacad9428))
* **dist:** regenerate artefact counters after the two new packs ([8698b22](https://github.com/event4u-app/agent-config/commit/8698b22e3a7839b54a68e05d00a8f7fab83876f1))
* **roadmaps:** scale-and-history-discipline — executed + archived ([4bae3c3](https://github.com/event4u-app/agent-config/commit/4bae3c3c84710ed80ac291a356456592df21a09c))
* **roadmaps:** close and archive road-to-ai-employee-borrowings ([384373f](https://github.com/event4u-app/agent-config/commit/384373feed20ddbfab23e63faeb4d5467facebbc))
* **roadmaps:** close and archive road-to-honesty-bench ([00b804d](https://github.com/event4u-app/agent-config/commit/00b804df5fcc29f692093f80e276e0c87f6d3f1e))
* **dist:** regenerate install bundle after the drift-report hook ([09c8da0](https://github.com/event4u-app/agent-config/commit/09c8da0c93c2f09290ddbd08d150c82234f307ba))
* **roadmaps:** close and archive road-to-enforcement-peer-disposition ([4733117](https://github.com/event4u-app/agent-config/commit/473311731cf349885aa0f0125666b9ff6960b4cb))
* **roadmaps:** close and archive road-to-self-critical ([aebde20](https://github.com/event4u-app/agent-config/commit/aebde2086a688f5a45dc979a5247da5fb2af33e8))
* **roadmaps:** activate the eight feedback and inbox roadmaps ([349eb86](https://github.com/event4u-app/agent-config/commit/349eb8666c7f9eefce7279800715c9d52b8ab788))
* **roadmaps:** point consumed feedback sources at the processed-inbox archive ([873d857](https://github.com/event4u-app/agent-config/commit/873d857b215761c3de72fa7981682aa082e9ed12))
* **condense:** re-mark two command hashes stale since the argument-hint pass ([7159d75](https://github.com/event4u-app/agent-config/commit/7159d75084278cfad4f9583e7c38e1aa0965ffab))
* **memory:** anonymize nine source names in the tracked corpus ([5dd334f](https://github.com/event4u-app/agent-config/commit/5dd334f21fb47bd65bf8904782779057dfd60ac5))
* **proof:** regenerate proof page for command-count bump ([578c890](https://github.com/event4u-app/agent-config/commit/578c8908910f278a6c69a2e62ae39f345d0813e7))
* **index:** regenerate index + catalog for /fix:pr-comments-loop ([03b9fa2](https://github.com/event4u-app/agent-config/commit/03b9fa2693b905206ac8dd7ed21a8f11e7e56efa))

### Other

* Add MCP Toplist rank badge ([b32a3ab](https://github.com/event4u-app/agent-config/commit/b32a3ab3b88c5433df0e5e4a9ab10fa95ad58838))

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
