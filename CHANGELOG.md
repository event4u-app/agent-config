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

# Era: 9.2.x — current

> Started at `9.2.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 9.3.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [9.8.0](https://github.com/event4u-app/agent-config/compare/9.7.0...9.8.0) (2026-07-26)

### Features

* **proof:** publish what re-derives itself, and what it prevents ([8ba878f](https://github.com/event4u-app/agent-config/commit/8ba878f0bb2244b33ce57f3484d5c0d0f887a5e9))
* **governance:** classify trust-boundary risk, measure before gating ([1421f82](https://github.com/event4u-app/agent-config/commit/1421f829ee58fe56a4c41a15c5f2e3925f17b5e9))
* **claims:** add exec: evidence that re-runs the command ([081b9ed](https://github.com/event4u-app/agent-config/commit/081b9ed36e29e3bb9e665004c16f3db9f831a107))
* **ci:** run the backstops rules declare, and baseline the five that were already red ([545d9cc](https://github.com/event4u-app/agent-config/commit/545d9ccd02cba430c8b5cb7c9b15fb0c9fe40463))
* **proof:** read the same checked rows as failure modes, not just as comparisons ([d2196de](https://github.com/event4u-app/agent-config/commit/d2196de10a220300b2897a379bf419c89416c117))
* **adr:** index the decisions filed outside the ADR directory, and stop auditing a hardcoded list ([2a2999a](https://github.com/event4u-app/agent-config/commit/2a2999a437f98fa94eae76638598923f0ba85bcd))
* **claims:** see the figure shapes that actually ship, and refuse a qual claim as a licence for a number ([5d7b166](https://github.com/event4u-app/agent-config/commit/5d7b1666364bb227fc687704560c93ddfb5fad2f))
* **host-integration:** config-root spawn flag + embed contract v1 ([a9f0038](https://github.com/event4u-app/agent-config/commit/a9f0038631ed97b815ab255d3a307a617423f091))
* **skill:** gated-reach — ship-tier channels only ([88f03c3](https://github.com/event4u-app/agent-config/commit/88f03c349fd89ffa36ca642eeef4bb8cd31263a8))
* **lint:** refuse nag phrasing in skill bodies ([004d696](https://github.com/event4u-app/agent-config/commit/004d696d3afae203e1581c63de979d0571031331))
* **reach:** distinguish "installed" from "able to extract" in reach:doctor ([e012bf7](https://github.com/event4u-app/agent-config/commit/e012bf784d0544002ec86128cc2fb2d6805e44d0))
* **reach:** read Reddit and single tweets credential-free ([9b89a34](https://github.com/event4u-app/agent-config/commit/9b89a34cf863167fda437f51ab54396f11229b60))
* **adr:** name the condition that reopens a decision, and validate ADR frontmatter at all ([5315ca1](https://github.com/event4u-app/agent-config/commit/5315ca1a05cb110dec839083dc8ef61b5f4fad9e))
* **subagents:** deliver the safety floor the contract already promised ([48ccf6a](https://github.com/event4u-app/agent-config/commit/48ccf6a10a45ba2ee2583a5dd3765ab0b8db9605))
* **overrides:** a kernel rule may be tightened, never replaced ([7821e22](https://github.com/event4u-app/agent-config/commit/7821e2202e9a03d9b0f80f299374a9cad3969139))
* **enforcement:** resolve what enforces each rule, instead of trusting the claim ([efc0fab](https://github.com/event4u-app/agent-config/commit/efc0fab2b8fc1bf181ba89ecc9f427312996dc56))
* **reach:** mechanize the supply-chain and staleness discipline as CI gates ([3d1b0f6](https://github.com/event4u-app/agent-config/commit/3d1b0f6375ba0f193fa198817bfa145091deebb1))
* **reach:** channel registry, five-state probe engine and read-only reach:doctor ([2cf6f04](https://github.com/event4u-app/agent-config/commit/2cf6f0406e3e82f955832698db556c7cba8887e2))
* **reach:** pre-registered reach-vs-native benchmark, published as an honest null ([8238f8b](https://github.com/event4u-app/agent-config/commit/8238f8bf78ac3f5cd47ad6ffdc703bbd562a206f))
* **code-graph:** code-intelligence skill + interop routing + host degradation (Phase 4) ([eabe48c](https://github.com/event4u-app/agent-config/commit/eabe48c49311278cfcb96ba3401b5240b4707261))
* **code-graph:** PreToolUse code-graph nudge hook (Phase 4) ([6d674ee](https://github.com/event4u-app/agent-config/commit/6d674ee421581a72094d581d35fc429006f7f4b4))
* **code-graph:** incremental --update + symlink-confinement fix (Phase 4) ([c0c846c](https://github.com/event4u-app/agent-config/commit/c0c846c222fc76bfcc685de96ae0dd0055a2fd38))
* add doc-screenshot anonymization discipline (rule + skill + ADR-125) ([c3e4671](https://github.com/event4u-app/agent-config/commit/c3e4671fd7822976d1293632b3b1ee7d707034a5))
* **code-graph:** source-agnostic query tier + detection (Phase 3) ([f5a0117](https://github.com/event4u-app/agent-config/commit/f5a0117a3445c4c3070f4432788a645cc2522f5a))
* **code-graph:** native WASM tree-sitter extract+build engine (Phase 2) ([8d78fef](https://github.com/event4u-app/agent-config/commit/8d78fefd788c6da88516ccdcdfde6ca84e572938))
* **adr-124:** land embedded-engine doctrine + reclassification sweep (Phase 0-1) ([e1db617](https://github.com/event4u-app/agent-config/commit/e1db617307d13de6d520b9aacc6aa0bb5472fb92))
* **install:** restart/launch the GUI on a global (re)install ([fae7a6c](https://github.com/event4u-app/agent-config/commit/fae7a6c6ad60441e2df9d056b92cc083ca63940d))
* secret-scan pre-flight in /commit, /commit:in-chunks, /pr:create ([ab69931](https://github.com/event4u-app/agent-config/commit/ab6993114bb57f6d8f2fea98ec4c2ec0e82366e7))
* secret-vcs-guard rule + secrets-management runtime guard ([9426f7e](https://github.com/event4u-app/agent-config/commit/9426f7e175b6b1325a4989eb07f709c8d9090bbe))
* secret detector library + CI leak-scan gate ([3168244](https://github.com/event4u-app/agent-config/commit/316824447b277f966dfe194e0c7c6741121b7e9f))

### Bug Fixes

* **roadmaps:** inline the council convergence instead of linking the transcript ([c47d9fc](https://github.com/event4u-app/agent-config/commit/c47d9fc0f8e390a8edce2a30d3dd8c5350ae0fd1))
* **docs:** replace stale 3.2.0 registry submission body and guard the file ([b393514](https://github.com/event4u-app/agent-config/commit/b393514dfa2a891ae24294d43155fa080ca115cd))
* **ci:** give the backstop gates their baseline, and stop an empty scan reading as clean ([69083f5](https://github.com/event4u-app/agent-config/commit/69083f577975c0de1d9535b4b45c27f475a676d7))
* **claims:** derive the denominator, and stop citing a gate that does not run ([89049f1](https://github.com/event4u-app/agent-config/commit/89049f1db36d63e33c7bb4f4a80712f3f2f72556))
* **enforcement:** say which build — a taskfile-named validator is not a CI gate ([7a87271](https://github.com/event4u-app/agent-config/commit/7a87271cce6b0cabeb664ccf890acd1f0335a0e7))
* **ci:** regenerate docs/proof.md and stop tracking a per-run eval artifact ([e8973c7](https://github.com/event4u-app/agent-config/commit/e8973c784513e33d7a0eb8e43d55c4a46b446a17))
* **claims:** the witness-sweep fixture encoded the bug it was testing ([b7b8621](https://github.com/event4u-app/agent-config/commit/b7b8621966d82f7f0cda87838974f1066258a6ec))
* **claims:** correct three shipped numbers, one of them understated by 3x ([2c52959](https://github.com/event4u-app/agent-config/commit/2c529590bce9ccb8cdabb1835f01670d7f60140a))
* **ci:** three self-inflicted reds — my own schema, my own legacy path, my own hand-edit ([7945f6c](https://github.com/event4u-app/agent-config/commit/7945f6cd74640a8f401451896c7a8c9cadce9dfd))
* **enforcement:** satisfy noUncheckedIndexedAccess in the two new scripts ([6501cce](https://github.com/event4u-app/agent-config/commit/6501ccebb757dd482dbd69bd5b784db447080e4a))
* **output-discipline:** wire the linter the rule already claimed was wired ([d996c6d](https://github.com/event4u-app/agent-config/commit/d996c6d7372add7e9b738bca2064078bbbc4a958))
* **kernel:** single-source the kernel list, and point the slow-rollout gate at a directory that exists ([676d74f](https://github.com/event4u-app/agent-config/commit/676d74f67d8db05d9f404e7a17d43172a2786bb1))
* **reach:** close the content-echo class at all four sites, not three ([17e806d](https://github.com/event4u-app/agent-config/commit/17e806d37af0894908f9b12a5044dc7c1fb1d51c))
* **reach:** confine credential_path, refuse non-files, and name what --deep consents to ([ffd02d0](https://github.com/event4u-app/agent-config/commit/ffd02d0d33b85f5e70de442d1c8dc4d5208b4c50))
* **reach:** redact echoed file content, unify error sanitization, document the gate boundaries ([52a1ded](https://github.com/event4u-app/agent-config/commit/52a1ded5314c99a51414ad3b6f44a60177ce40e5))
* **settings:** declare hooks.code_graph.enabled in the Zod settings schema ([ef475ce](https://github.com/event4u-app/agent-config/commit/ef475ce39a0e937f1f6cbfe9ed544633a789c969))
* **proof:** regenerate proof.md after code-intelligence skill-count bump ([8ad88c8](https://github.com/event4u-app/agent-config/commit/8ad88c82eee0252d903c9efb93b62e380a6acba5))
* sync settings Zod schema + regenerate proof/capabilities for screenshots config ([4812a6e](https://github.com/event4u-app/agent-config/commit/4812a6e232c7323695faf6a90328b13b2e48bbe0))
* **proof:** regenerate proof.md after comparison.yaml row-1 rewording ([f36f583](https://github.com/event4u-app/agent-config/commit/f36f583c1aab82da7171e4c9f3f28306b5e1345a))
* **roadmap:** unlink future reclassification-doc path in sequencing plan ([d74b4b0](https://github.com/event4u-app/agent-config/commit/d74b4b060cb01569c47615822b09ed2f055a2474))
* **review:** reclassify MCP server B, machine-visible partial supersession ([1b2ed21](https://github.com/event4u-app/agent-config/commit/1b2ed21046a6c904d435dd48472f512477436cad))
* **install:** make postinstall_gui self-contained (prepack-check) ([54a77b1](https://github.com/event4u-app/agent-config/commit/54a77b1bf981053f7e778ec2e6643637f608c313))
* widen check_secret_leak opts types for exactOptionalPropertyTypes ([593dfab](https://github.com/event4u-app/agent-config/commit/593dfab595be8c8f5cc722f038e8e60fcdb2609b))
* **release:** make the tag-workflow dispatch non-fatal + document actions:write ([d47949e](https://github.com/event4u-app/agent-config/commit/d47949e1357e5b4794b442c3b69fd84c999d23fa))

### Documentation

* **roadmaps:** record adoption progress and add two new roadmaps ([7af5375](https://github.com/event4u-app/agent-config/commit/7af537591d3628d4a2285553c41adcdf5e23e734))
* **readme:** reorder the opening to lead with the wedge, not the catalog ([ab66da8](https://github.com/event4u-app/agent-config/commit/ab66da8e968a540528fffca05ce65184c0817740))
* **adr:** record the cut as ADR-128, and archive the roadmap ([b365e90](https://github.com/event4u-app/agent-config/commit/b365e907461312f5e71e502de21333b10a211655))
* **roadmap:** archive road-to-wiring-truth, complete ([aaafb9e](https://github.com/event4u-app/agent-config/commit/aaafb9e7543b9b4a75f40b09805725dc437ca564))
* **roadmap:** archive road-to-number-truth, complete ([a12bbae](https://github.com/event4u-app/agent-config/commit/a12bbae9d83e60531a87b69fd135c37cbb02de8a))
* **contracts:** write the local-server-ports + host-integration contract ([610e539](https://github.com/event4u-app/agent-config/commit/610e539538bac8a914ce28a2b4f9c9ef91165b61))
* **roadmaps:** track the AC host-integration roadmaps + landed status ([34fcc27](https://github.com/event4u-app/agent-config/commit/34fcc271fe9eda5d24d8ee2a3260cdfbddad5722))
* **roadmap:** close gated-reach, spawn the YouTube follow-up, park five successors ([530917a](https://github.com/event4u-app/agent-config/commit/530917a3a1c4be5c514fe4eb507dea83a65b4b53))
* register the gated-reach claim, comparison row, and amend ADR-126 ([bb0b263](https://github.com/event4u-app/agent-config/commit/bb0b263292236a623e7cb71d2a9832f1e090cc3a))
* **bench:** publish the gated-reach outcomes, ships and parks alike ([5ca8930](https://github.com/event4u-app/agent-config/commit/5ca89304c517b91d2d3950213c835e6336ef5d57))
* **reach:** operator prescriptions for platforms the host cannot fetch ([844bb1b](https://github.com/event4u-app/agent-config/commit/844bb1b3cfa3633c2e4f383496ae04393ea15a48))
* **roadmap:** archive road-to-enforcement-proof, complete ([a590aca](https://github.com/event4u-app/agent-config/commit/a590aca449b9aa0a186d4739c9931f2b46458fcf))
* **proof:** publish both numbers, including the unflattering one ([eabe545](https://github.com/event4u-app/agent-config/commit/eabe545965648adbe4637f4b6f80ea3dcbc5de46))
* **reach:** make Reddit ranking + thread structure the goal — and it stays credential-free ([4c3b3cb](https://github.com/event4u-app/agent-config/commit/4c3b3cbafba3087078ff3a2ff0f0509e36dc29e1))
* **reach:** roadmap for credential-free gated reach — Reddit, single tweets, transcripts ([ff4b40c](https://github.com/event4u-app/agent-config/commit/ff4b40c83a8925fabfbf9c87ae29af092bcc1f0a))
* **reach:** correct my own overstatement about what the witness contains ([0e46437](https://github.com/event4u-app/agent-config/commit/0e46437e6377b863245e769cce9c0721e39a4698))
* **reach:** record all four council divergences, and give both accepted costs a re-entry point ([7f85378](https://github.com/event4u-app/agent-config/commit/7f853788973a3fcfac61e34866047d8704d61bd6))
* **reach:** ADR-126, archived roadmap, comparison row and maintenance log ([4bfc9da](https://github.com/event4u-app/agent-config/commit/4bfc9da38cd809465713e8544b953e38781594b4))
* **roadmap:** add native-code-intelligence roadmap + engine queue ([7c7ac11](https://github.com/event4u-app/agent-config/commit/7c7ac1149b8715794be0baac5b3285e514fb9b65))
* **adr:** propose ADR-124 embedded-engine doctrine ([d8c90a5](https://github.com/event4u-app/agent-config/commit/d8c90a52397a048b52abf17575f6d67d298b364b))
* **roadmap:** sync dashboard for archived Starlight roadmap ([d30846c](https://github.com/event4u-app/agent-config/commit/d30846c1299ef9784ea33a8572f830a0ae1b571f))
* **roadmap:** complete + archive Starlight project-docs roadmap ([4c7b91f](https://github.com/event4u-app/agent-config/commit/4c7b91f407f1238ffc83c1700f444e136c476400))
* **roadmap:** add Starlight project-docs roadmap ([f63e87f](https://github.com/event4u-app/agent-config/commit/f63e87f3ebc2cc53e2ceccb6a43591fd394aa90e))
* **site:** add setup, configuration, CLI and agent-command docs ([7c05e68](https://github.com/event4u-app/agent-config/commit/7c05e68fdc27c391c0882d2f2d0284bb3f3f9d8f))
* **site:** restyle docs site to the data-helpers look ([ef0e7a0](https://github.com/event4u-app/agent-config/commit/ef0e7a05de293d49c7f6fb474c40f157f621de13))
* document the secret-in-VCS guardrail (threat model + SECURITY) ([e10e316](https://github.com/event4u-app/agent-config/commit/e10e3160bb07b6457602b2c2ee70f2215a66dfb5))

### Tests

* **bench:** gated-reach — pre-registration, rows, per-channel verdict ([8233aed](https://github.com/event4u-app/agent-config/commit/8233aedd50c80156a9d8996967e1fd2a7db70109))
* **reach:** drop the witness instrument that watched shared state, and say what that costs ([1be7ab9](https://github.com/event4u-app/agent-config/commit/1be7ab98373f20cbfd0048184cc62a0c93de1151))
* **reach:** cover the sanitized error path, the export gate and the win32 skip ([3b5a47a](https://github.com/event4u-app/agent-config/commit/3b5a47a5c30d0968f2631924c813d3c6b13884d2))
* **reach:** the read-only witness parses the AST instead of grepping the source ([e54f22d](https://github.com/event4u-app/agent-config/commit/e54f22d994736c3e6cbb37390bc4b843975fa05e))

### Chores

* **reports:** regenerate the originality audit, stale on main ([aef5b53](https://github.com/event4u-app/agent-config/commit/aef5b53bbaf918a6b849060063e6c40196ab5dd4))
* regenerate drifted originality report (pre-push consistency sync) ([66c7f04](https://github.com/event4u-app/agent-config/commit/66c7f04afe9005b91c07457902edcf2ee0cf3a78))
* **test:** remove two orphans the depythonization left in the linter test ([e800c8e](https://github.com/event4u-app/agent-config/commit/e800c8e8627e26388de29c2b3e38b95620932b64))
* **regen:** sync skill counts + meta-pack membership after code-intelligence ([0775e14](https://github.com/event4u-app/agent-config/commit/0775e148c1fbd61da13f9ad5646e4f8ef7bfe324))
* **roadmap:** park native-code-intelligence in later/ (Phases 0-4 done, 5-6 gated) ([f7b3c2f](https://github.com/event4u-app/agent-config/commit/f7b3c2f63339efb81b497e6eeda05a3e843171d7))
* regenerate docs/proof.md for the +1 rule count ([620614c](https://github.com/event4u-app/agent-config/commit/620614c901b1c7971c8c55d97477c74e5b2f2ba2))
* regenerate dist projections + counts, archive completed roadmap ([55052c9](https://github.com/event4u-app/agent-config/commit/55052c941be45cea1d4dfc65fc048a0c8f450958))

Tests: 8391 (+537 since 9.7.0)

## [9.7.0](https://github.com/event4u-app/agent-config/compare/9.6.0...9.7.0) (2026-07-21)

### Features

* **templates:** opt-in consumer doc-impact CI workflow ([c02c878](https://github.com/event4u-app/agent-config/commit/c02c87810d0ee60f8544f17c9d7cefdafc59c826))
* **scripts:** add check_source_pointer_freshness CI gate + test ([f5895f7](https://github.com/event4u-app/agent-config/commit/f5895f784da4cc4c0d5b93fd55629589ec2f56c4))
* **rules,skills:** docs-follow-code — Doc-Impact discipline + fix source-of-truth pointer drift ([9f8f666](https://github.com/event4u-app/agent-config/commit/9f8f6665d9ea3b1baa48a3aa2b30a516b9878912))
* **bench:** adversarial-council residual-detection corpus + harness ([784202e](https://github.com/event4u-app/agent-config/commit/784202e5a33d94c0fe507cfb526e9dd2487dc89a))

### Bug Fixes

* **ci:** exempt check_source_pointer_freshness from the legacy-path guard ([5254683](https://github.com/event4u-app/agent-config/commit/5254683f492bb52e8fe3262f08b91a240867e3be))
* **bench:** typecheck + lint the adversarial-council runner ([14e81cd](https://github.com/event4u-app/agent-config/commit/14e81cd9f2034a66b448b70440f77916ed054d5d))
* **security:** close GIT_CONFIG_* config-injection RCE residual in hardenedSpawnEnv ([48941a6](https://github.com/event4u-app/agent-config/commit/48941a6d3be2bd125758f7899690e5bf36bb2843))

### Documentation

* **roadmap:** archive completed road-to-doc-follows-code ([2695aad](https://github.com/event4u-app/agent-config/commit/2695aade3be5e4a87acd19af8032c655e3bd10fe))
* **changelog:** record the docs-follow-code discipline under [Unreleased] ([54703a5](https://github.com/event4u-app/agent-config/commit/54703a5e930e01a2a124e22ded5ef5fc3aadfbd8))
* **roadmap:** archive completed adversarial-council-benchmark roadmap ([ae30ddb](https://github.com/event4u-app/agent-config/commit/ae30ddb4156365d17ac97c8ff1af7c5902c76337))
* **bench:** resolve adversarial-council-finding-coverage — HONEST NULL ([9bd5fe4](https://github.com/event4u-app/agent-config/commit/9bd5fe489fb9a324da9a096fc4170e820d7b2888))
* **roadmap:** archive completed changelog-unreleased-drain roadmap ([361f72f](https://github.com/event4u-app/agent-config/commit/361f72fe681e04b0ab717314c2fdb24e13939048))
* **changelog:** drain the stale 6.0.0 fossil out of [Unreleased] ([ca99ced](https://github.com/event4u-app/agent-config/commit/ca99ced83eee2b23ea18b33f9852cfe718ebbb2f))
* **roadmap:** archive completed spawn-env-completion roadmap ([c4fd083](https://github.com/event4u-app/agent-config/commit/c4fd0839c83f2c580bb08ce2581bcceb8d62d095))
* **security:** spawn-site policy inventory + ADR-123 follow-up (lint rejected) ([bec13d1](https://github.com/event4u-app/agent-config/commit/bec13d1c7acb0a17e2d8a561ca279a6cebb97446))
* drop serial comma in README + package.json prose ([dec73af](https://github.com/event4u-app/agent-config/commit/dec73affaca0a000c5fab656017be15c67e0f884))

### Tests

* **changelog:** guard [Unreleased] against at-a-glance fossil reopening ([75993e4](https://github.com/event4u-app/agent-config/commit/75993e4426bb2b103ae89706d59a70195513d624))

### Chores

* **condense:** re-mark 19 commands after dependency-hash cascade ([07ddac7](https://github.com/event4u-app/agent-config/commit/07ddac7a80661693852ae68ce31d530020d95305))
* **ci:** guard README against serial-comma drift ([a7caa83](https://github.com/event4u-app/agent-config/commit/a7caa83e0771244e16845505028f812f59d26624))

Tests: 7854 (+16 since 9.6.0)

## [9.6.0](https://github.com/event4u-app/agent-config/compare/9.5.0...9.6.0) (2026-07-20)

### Features

* **commands:** collapse the proactive suggestion surface to cluster-head journeys ([09d9cb3](https://github.com/event4u-app/agent-config/commit/09d9cb3abd78c5181cacf114eb05eb6ed6b54bcd))

### Bug Fixes

* **hooks:** route consumer-runtime spawn sites through hardenedSpawnEnv ([835af7f](https://github.com/event4u-app/agent-config/commit/835af7fb09818a03fc8efa6058f5bf3a148519d0))
* **ai-council:** scrub subprocess env to close spawn-inheritance RCE ([634486b](https://github.com/event4u-app/agent-config/commit/634486b6d72b739a9add0ef6555c66875d3d2f63))
* **consolidation:** add rationale to de-eligibled subs; head absorbs the sub's intent ([bc2b479](https://github.com/event4u-app/agent-config/commit/bc2b4799c07c8e0c4bdd651dca3218aeac90e6a5))

### Documentation

* **roadmap:** archive completed runtime-security-hardening roadmap ([dae91c4](https://github.com/event4u-app/agent-config/commit/dae91c4d9faa8b12d38c1527b892069a735b5c85))
* **security:** record runtime-security scope decision (ADR-123) ([efb2272](https://github.com/event4u-app/agent-config/commit/efb22723c2b42b390bad0eda0ace106c32d60b3b))
* **roadmap:** road-to-surface-consolidation — Phase 1 done, Phase 2 folded ([c84e182](https://github.com/event4u-app/agent-config/commit/c84e18212658d038cfda0bfe50176bdc01bac6a4))
* **consolidation:** fold the complexity-budget checklist + record restraint decisions ([6f864c9](https://github.com/event4u-app/agent-config/commit/6f864c9452d857f8f019bd27890214b6bff431a9))

Tests: 7838 (+5 since 9.5.0)

## [9.5.0](https://github.com/event4u-app/agent-config/compare/9.4.0...9.5.0) (2026-07-20)

### Features

* **bench:** defect-finding runner + results (team-mode Phase 5 Steps 2-4) ([aca13fd](https://github.com/event4u-app/agent-config/commit/aca13fd0c212a1af31c0715bf56db1972d819d0b))
* **bench:** pre-registered defect-finding corpus (team-mode Phase 5 Step 1) ([e7b5300](https://github.com/event4u-app/agent-config/commit/e7b5300d39fa6f2e9ac4fb0d42934cb08d8a9382))

### Documentation

* **roadmap:** close team-mode Phase 5 on the honest-null verdict ([2ff25dd](https://github.com/event4u-app/agent-config/commit/2ff25dd2837872f2ff36139839abc9211d7e7305))
* **proof:** record the team-mode defect-finding honest null (Phase 5 Step 4-5) ([908284a](https://github.com/event4u-app/agent-config/commit/908284a9dc20d067aaaf1305b3c352f260c88e82))

Tests: 7833 (+0 since 9.4.0)

## [9.4.0](https://github.com/event4u-app/agent-config/compare/9.3.0...9.4.0) (2026-07-20)

### Features

* **self-review:** large-diff / claim-affecting ai-council escalation (detect + recommend) ([1308e22](https://github.com/event4u-app/agent-config/commit/1308e220179600424d4ac590ae9295b522f3f22c))
* **council:** cross-round prompt-cache read unlock ([5faf32b](https://github.com/event4u-app/agent-config/commit/5faf32bc3b0522e7e0af3b28a108ce808133a56e))
* **council:** auto model-tiering gated on the A1<->A3 cache coupling ([1a693bf](https://github.com/event4u-app/agent-config/commit/1a693bffe79addde715becc9a366c5185e9545b9))
* **council:** stance repair fires only on genuinely unparseable STANCE ([40196bd](https://github.com/event4u-app/agent-config/commit/40196bdac2489dc50ac1213976e776d94f3f89c7))
* **adoption:** wedge promise, opt-in first-run instrument, honest positioning surface ([c93e314](https://github.com/event4u-app/agent-config/commit/c93e314b102ba437afcbef994306a5f0c42d2476))
* **routing:** reciprocal cluster routing for the weighted-matrix mode ([6be7bc5](https://github.com/event4u-app/agent-config/commit/6be7bc5b7d042bdfc000c5a51270a7c9da5a2f28))
* **skill:** weighted-matrix mode in decision-record ([7eaf4db](https://github.com/event4u-app/agent-config/commit/7eaf4db125eebe19cb0d57ac32f15f917530b206))
* **command:** /contribution-precheck — contributor self-service gate subset ([5e7de9b](https://github.com/event4u-app/agent-config/commit/5e7de9b6b828653bb0e49e1711f42ee56c18e4cd))
* **catalog:** provenance source column + CREDITS.md ([10cca8a](https://github.com/event4u-app/agent-config/commit/10cca8af8a244aa30d0ee036126e24c506c82e48))
* **ci:** wire lint_originality --changed as the originality-gate PR job ([00c3754](https://github.com/event4u-app/agent-config/commit/00c3754df8d9a95c30a84c294bfb3ab9cfbbe509))
* **skills:** add learning-tutor skill — six structured tutoring modes ([8ed343d](https://github.com/event4u-app/agent-config/commit/8ed343d282ad669489866cda84a6a214f1943ca6))
* **skill:** evaluate-llm-feature — black-box LLM-feature evaluator ([b94249f](https://github.com/event4u-app/agent-config/commit/b94249fb067c39d8fa5c8f4fa6cfe2b1290e336b))
* **flows:** optional team annotation + resolver ([7b14ed5](https://github.com/event4u-app/agent-config/commit/7b14ed5cbba5bec6b4e5500fb68c6770ad7d5f87))
* **mcp:** lazy catalog router — index, scoring, stub tools ([d17b9e0](https://github.com/event4u-app/agent-config/commit/d17b9e05fc5742f922177febab086c4723796029))
* **originality:** anti-reskin shingle-overlap gate ([dae4760](https://github.com/event4u-app/agent-config/commit/dae4760c7b041844bde10fa3e2eb6ae5f34a9fa6))

### Bug Fixes

* **skill:** keep subagent-orchestration under the 400-line size gate ([c419da9](https://github.com/event4u-app/agent-config/commit/c419da949db135c6c1723d85e78906669ee881a2))
* **portability:** drop task-ci literals from the shipped precheck command ([a0d83d3](https://github.com/event4u-app/agent-config/commit/a0d83d33984847143749131fe0e01509c72edbbb))
* **ci:** CAPABILITIES 277 count + defang injection-probe examples ([c1d4036](https://github.com/event4u-app/agent-config/commit/c1d4036dd615fa2bcbd670e66583f8eac15fbb6a))
* **originality:** close the adversarial DF batch-masking hole ([dd84403](https://github.com/event4u-app/agent-config/commit/dd8440363a7ecda67934cca27cb0df4b69ba34e6))
* **mcp:** version the catalog-index cache filename ([93d980a](https://github.com/event4u-app/agent-config/commit/93d980aff254ceb9d31bf290f36a249377e81eea))

### Documentation

* **team:** CHANGELOG entry + close-out (Phase 6 + prereqs); upstream re-verified ([a6405c5](https://github.com/event4u-app/agent-config/commit/a6405c5ade5e4e1a22c7cb60eaf0d31f7f212b9e))
* **team:** three-way router disambiguation cross-links (council / team / subagents) ([f82ed16](https://github.com/event4u-app/agent-config/commit/f82ed168f81c48ef98b0e561f44bc13c8691ce77))
* **self-review:** document the escalation path; flip Phase 1 step (part c) ([9f26716](https://github.com/event4u-app/agent-config/commit/9f267166b1305f9833f89ae8119638105ecd42c1))
* **roadmap:** archive road-to-api-cost-optimization — A3 executed, fully closed ([94e2044](https://github.com/event4u-app/agent-config/commit/94e20444f215491d6f5350b09910d37a928a090e))
* **cost:** B2 index-branch pointers (deferred follow-up closed) ([7d68245](https://github.com/event4u-app/agent-config/commit/7d68245ebc013b5fa05f0790473e910e45227a5e))
* **roadmap:** adoption roadmap — second autonomous slice landed ([0febec6](https://github.com/event4u-app/agent-config/commit/0febec66d629dc2cca6410bfaa07c841711e1966))
* **announcements:** draft the honest-launch story (drafted, not posted) ([8e1b757](https://github.com/event4u-app/agent-config/commit/8e1b757f53f367c1fdc7d7150eed4ff8edc1e426))
* **roadmap:** archive road-to-weighted-decision-matrix — fully executed ([4586dcd](https://github.com/event4u-app/agent-config/commit/4586dcd5432c618ffd007af2f0977a24249945aa))
* **roadmap:** originality-gate + contributor-funnel roadmap, executed and parked ([4d0e73b](https://github.com/event4u-app/agent-config/commit/4d0e73b67298cd78b509778514ab170fcc75e930))
* **probe:** anti-reskin-gate demand probe + extraction floor ([b849580](https://github.com/event4u-app/agent-config/commit/b8495802f93a966bcf5808e01b15b93e4017fd9a))
* **roadmap:** complete + archive the ecosystem-harvest index hub ([e1752d1](https://github.com/event4u-app/agent-config/commit/e1752d176fbf948aff364fb1271532164bb2b755))
* regenerate proof page for the new skill count (277) ([2476284](https://github.com/event4u-app/agent-config/commit/247628404098690ba2f68fa1bef6fdba1753ee13))
* **roadmap:** complete + archive ecosystem-harvest domain-watch ([d07e81e](https://github.com/event4u-app/agent-config/commit/d07e81e017a90e92863d9bcffd1818b232fefaeb))
* **domain-watch:** watch-notes for the two gated verticals ([26bb9dd](https://github.com/event4u-app/agent-config/commit/26bb9dd77c7c6adb1bebc9677f5096d8e66ef999))
* **roadmap:** correct the flip-gate checkbox and tighten the flow-team criterion ([89a2d26](https://github.com/event4u-app/agent-config/commit/89a2d26721090cc7545a19ef73877689a445420f))
* **roadmap:** persona-library harvest — executed and archived ([1c6940a](https://github.com/event4u-app/agent-config/commit/1c6940a2693c94ad366ddc31f791d13870da6d07))
* correct outdated Antigravity host claims ([fca90e2](https://github.com/event4u-app/agent-config/commit/fca90e2c3413465e0a4bfbfd65d1da01ea15bef7))

### Chores

* **meta:** sync pack README with shortened precheck description ([601fdc1](https://github.com/event4u-app/agent-config/commit/601fdc111553d8d4c55796d43c3203d938b5c179))
* **ci:** wire lint-originality and validate-flow-teams into the pipeline ([48bc88a](https://github.com/event4u-app/agent-config/commit/48bc88a2ce24bfffd1f98e4194163986b3adf245))

Tests: 7833 (+63 since 9.3.0)

## [9.3.0](https://github.com/event4u-app/agent-config/compare/9.2.0...9.3.0) (2026-07-16)

### Features

* **ergonomics:** harvest ergonomics plate — tdd cluster, fix:route, persona-improvement, hand-off examples ([e8be16f](https://github.com/event4u-app/agent-config/commit/e8be16f2a0194a6b6cb3b2ed4a9899db31067d1d))
* **review:** wire reuse + OOP-shape lens into the review/orchestration surfaces ([067175a](https://github.com/event4u-app/agent-config/commit/067175a04c1d49c356bf8e42c4cb0f23b3d91473))
* **hooks:** PostToolUse PR-URL reminder — reply-shape backstop for direct-answers ([1bf82a1](https://github.com/event4u-app/agent-config/commit/1bf82a1f23fd2fac7ae86fe1fae3cc6b3e0da657))

### Bug Fixes

* **counts:** regenerate command-flows.md (+5 commands) + map explain-run orphan into surface-map ([a6254e4](https://github.com/event4u-app/agent-config/commit/a6254e434e966eaca9e697093980dfc3cc04a8d8))
* **hooks:** pre-push gate mirrors the full CI consistency check locally ([ebd706f](https://github.com/event4u-app/agent-config/commit/ebd706fb1e978189954ca838bc41bd3f536ee560))

### Documentation

* refresh guideline counts (100 -> 101) after the new dev-standard guideline ([02ac1a5](https://github.com/event4u-app/agent-config/commit/02ac1a53214b5cd22eecee873e2b81286c01a6b2))
* **standards:** apply council findings — paradigm-appropriate + minimal-diff precedence ([474b1c6](https://github.com/event4u-app/agent-config/commit/474b1c68b8a28dd1f5302b135fbe69876696ea6f))
* **standards:** component-oriented + OOP-first development standard ([5bd62bd](https://github.com/event4u-app/agent-config/commit/5bd62bdf14208f65ae166b954a5c7b4e49211ffa))
* **roadmaps:** council-review + apply findings to feedback-9.2.0 followups ([dc187d4](https://github.com/event4u-app/agent-config/commit/dc187d4b83debda1c4f8c551acfc6400149da520))
* **roadmaps:** draft feedback-9.2.0 follow-ups roadmap ([69d363d](https://github.com/event4u-app/agent-config/commit/69d363df10f5e9dd6605ba6af370ac1d477a5a92))
* **roadmaps:** spawn adversarial-council benchmark follow-up; mark deferred arm moved ([36a69d9](https://github.com/event4u-app/agent-config/commit/36a69d9f00b4a236535ea01bf8dd36a4d82f1293))

### Refactoring

* **subagent-orchestration:** relocate worker-prompt contract to spawn-contract context ([de38ce1](https://github.com/event4u-app/agent-config/commit/de38ce12ff167eafe7a0631f1088ed244e2b85bf))

### Chores

* **harvest:** close second-sweep coverage plate — all folds verified, proposals parked, archived ([7af8a75](https://github.com/event4u-app/agent-config/commit/7af8a75305289bd1f2d36498bea362b789b0f610))
* **roadmaps:** archive completed adversarial-verification-council roadmap ([fc34874](https://github.com/event4u-app/agent-config/commit/fc34874a608644d89ab12aa0147d5f6237a4f9ca))

Tests: 7770 (+6 since 9.2.0)

## [9.2.0](https://github.com/event4u-app/agent-config/compare/9.1.0...9.2.0) (2026-07-14)

### Features

* **rules:** cross-source-consistency — detect discrepancies, ask before guessing ([63b8049](https://github.com/event4u-app/agent-config/commit/63b804981e70045f138af4bd4a5546b62b135d24))
* **settings:** add consistency.cross_source toggle (default on) ([2f41bbb](https://github.com/event4u-app/agent-config/commit/2f41bbbf52737f12401eb7ccfed104d3b4a9b4a6))
* **settings:** opt-in subagents.adversarial_council + verify-budget escalation ([fa68dbc](https://github.com/event4u-app/agent-config/commit/fa68dbc514a6cc2def90f7f4b8b031e5c872747f))
* **subagent:** Mode 9 adversarial-verification-council + skeptic prompt ([26501a1](https://github.com/event4u-app/agent-config/commit/26501a18a1ab53d3eb54a06230086e0c4508bfee))
* **subagent:** adversarial-findings schema + deterministic reconciliation core ([12c64f2](https://github.com/event4u-app/agent-config/commit/12c64f26bcc92d4472935badc41b64fe563f98b2))

### Bug Fixes

* **proof:** regenerate docs/proof.md after the pre-registered claim ([a24fb54](https://github.com/event4u-app/agent-config/commit/a24fb54574379aaf90061beee2df4d21e3d55a9a))

### Documentation

* **adr:** ADR-122 + pre-registered finding-coverage claim + eval design ([0123cd2](https://github.com/event4u-app/agent-config/commit/0123cd298d0587fd1eb98f82c7e40f41e912ee05))

### Chores

* regenerate derived artefacts for the new rule ([5268766](https://github.com/event4u-app/agent-config/commit/5268766dd6aca34efbac77660ecf3fa9d1553814))

Tests: 7764 (+27 since 9.1.0)

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
