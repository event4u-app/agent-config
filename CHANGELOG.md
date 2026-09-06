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

### Fixed

- **Release gates now refuse before the push, not on the release PR.** 14.17.0
  (PR #1856) failed `check_release_highlights` on a missing
  `> **Governance mix:**` line — an assertion reproducible locally in under two
  seconds, discovered instead after a branch, a pull request and a CI run had
  been spent. It was the second instance of the shape in three releases
  (14.14.0 / PR #1812 was the first, on the curated head), and
  `docs/contracts/CHANGELOG-conventions.md` had **recorded** the gap rather than
  closed it. Three changes: `render_changelog_entry` now emits the response
  block with the measured level and a placeholder sentinel the guards refuse
  (never a finished answer — a generator that discharged a written-answer
  obligation for itself would make it a formality); one predicate
  (`mix_response_blockers`) is read by the CI gate and both local guards, so the
  two sides cannot drift; and the missing `Tests: N` footer joins it as a
  section-level publication blocker, which until now also existed only inside
  `release-validation.yml`.

### Added

- **A release-gate locality registry, so the next orphan cannot land silently.**
  `src/config/release-gate-locality.yml` relates every job in
  `release-validation.yml` to the command that reproduces it locally;
  `tests/scripts/release_gate_locality.test.ts` fails when a job has no row, or
  when a row claims a script that is not in the tree, or when a missing local
  command carries no classified `NEEDS_*` reason. `task release:verify` runs the
  reproducible set from that same registry — and `task release` now runs its
  `--cheap` subset itself, before the branch is pushed. Three jobs genuinely
  cannot run pre-PR; the registry names which and why, and a green run prints
  what it did not cover rather than reading as a clearance.

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

# Era: 14.18.x — current

> Started at `14.18.0`. Full entries live inline below.
> The drift test caps this era at 250 lines of entry body; growth past
> that forces a new era split (`# Era: 14.19.x`, etc.) — see
> [`docs/contracts/CHANGELOG-conventions.md § Era splits`](docs/contracts/CHANGELOG-conventions.md).

## [14.19.0](https://github.com/event4u-app/agent-config/compare/14.18.0...14.19.0) (2026-09-07)

### Release highlights

- **Behaviour changes:** drop a comma from the three skill-reachability lines (be57b0c); skills are named or trigger-matched, not matched by topic (edbc6a5); keep autonomous-execution inside the size its pointer claims (a9d21e2); fit the directory-flag line inside the preamble ratchet (5d1d002); bump the skill schema patch for the corrected host claim (a5281be); pay for the host-wording correction in the preamble budget (26659d6); +4 more.
- **Default changes + migration:** move the column migration out of a file past its cap (03eedeb).
- **Security and correctness:** split the claim check out of the census into a check_ gate (88132c6); re-pin the gate-coverage canary line to 598 (3a8e3f7); separate repository drift from store drift in the staleness verdict (6d9284a); route the merged permission-decision envelope through the table (b4e4573); read the expiry verdict through the as-of seam (f6f862a); type the bridge reads instead of suppressing the lint (285c0e0); +8 more.
- **Honest nulls:** close road-to-the-ledger-two-releases-skipped (7cb1af8).
- **Known limitations:** _none_

> **Governance mix:** governance-only 52 vs consumer-only 17 (taxonomy 1.0.0).
> Next cycle ships the installed MCP bridge repair — a version-pinned server
> entry instead of an `npx -y` resolution of `latest`, a registration that
> migrates itself when the bridge shape changes under an update, and setup docs
> matching the command the installer actually writes — tracked in
> `agents/roadmaps/road-to-mcp-bridge-integrity-and-reach-truth.md`, which stands
> at zero of its seventeen steps at this tag.

> **Previous cycle:** the 14.18.0 head promised the installed MCP bridge repair —
> a version-pinned server entry instead of an `npx -y` resolution of `latest`, a
> registration that migrates itself when the bridge shape changes, and setup docs
> matching the command the installer writes. It **did not ship**. `MCP_BRIDGE_ENTRY`
> still resolves `npx -y @event4u/agent-config`
> (`src/scripts/_lib/mcp_bridge.ts:38-45`) and the roadmap carrying it,
> `road-to-mcp-bridge-integrity-and-reach-truth`, stands at zero of its seventeen
> steps. The promise is not withdrawn; it is outstanding, and from this release on
> a head that leaves the previous head's promise unanswered is refused by
> `check_release_highlights`.

### Features

* **ci:** call the activation census at release time and register it ([ec7282e](https://github.com/event4u-app/agent-config/commit/ec7282ef65bf1fb19c322242c6f7de38d00b71ba))
* **census:** give the activation census a record, a claim check and a self-test ([1ce9fc0](https://github.com/event4u-app/agent-config/commit/1ce9fc005491174adcdd5abe8171cd7fe025e4c4))
* **skills:** the design family becomes router-visible ([044a15c](https://github.com/event4u-app/agent-config/commit/044a15c8c1bda4ae4b682b71b53760cc07088976))
* **fe-design:** frequency and initiation are declared, never inferred ([5a051c6](https://github.com/event4u-app/agent-config/commit/5a051c691dfcd0cf6b04aa6863aa713d9890baf0))
* **design:** the Motion dial reads frequency and initiation ([027dc78](https://github.com/event4u-app/agent-config/commit/027dc7869de803f6859a1fe7e5d058b505edf01c))
* **evidence:** a feel type, for motion that is correct and still wrong ([0b25dc0](https://github.com/event4u-app/agent-config/commit/0b25dc0cf4fb06ccf006beae08e7ac3cc3df8b41))
* **design:** the antipattern catalog says what class a row is ([347c1d0](https://github.com/event4u-app/agent-config/commit/347c1d02cdecf7788ffcaa14de9c8806513d1034))
* **design:** one motion authority, and a gate that fails on drift ([a09dc6e](https://github.com/event4u-app/agent-config/commit/a09dc6e962500f3f559e112bc00c774da21be120))
* **measurement:** baseline the friction instead of asserting it ([6d4292e](https://github.com/event4u-app/agent-config/commit/6d4292ee351cddb5882bc9e071a0d86074215efe))
* **hooks:** give a host-capability fact an expiry, and enforce it ([407f657](https://github.com/event4u-app/agent-config/commit/407f657c65666b3a5960726c1499dee5e9f57f2f))
* **hooks:** record the surface a dispatch came from ([a3f0657](https://github.com/event4u-app/agent-config/commit/a3f06577fd74d99a898ba3a4f3f552553decc554))
* **hooks:** one table for host lowering, replacing five constants ([646fdab](https://github.com/event4u-app/agent-config/commit/646fdaba103a6dac42e9fd3df8742a5369337a20))
* **ledger:** record the consequence operations the owner named ([c299ece](https://github.com/event4u-app/agent-config/commit/c299ece07d4c01357eb444a21fbb183c54ac7e14))
* **doctor:** report the host permission settings that produce prompts ([473f4e1](https://github.com/event4u-app/agent-config/commit/473f4e18e3e7211f3edbc499ba81de8bc4ed4c4e))
* **hooks:** emit permissionDecision allow for category-A tool calls ([e9fef89](https://github.com/event4u-app/agent-config/commit/e9fef896b1680f19a7ff8ae78d5014b660a90f82))
* **gates:** give the RDP corpus a validator and the trigger contradiction a check ([6ff326c](https://github.com/event4u-app/agent-config/commit/6ff326ccce27a7f371e405c33be8c8900d7fc31a))
* **gates:** pin a coverage row to the workflow invocation it claims ([80cb0cb](https://github.com/event4u-app/agent-config/commit/80cb0cb10e3f0a3298121c631fe487036928316a))
* **gates:** an empty findings ledger must state why it is empty ([2db593c](https://github.com/event4u-app/agent-config/commit/2db593c51da43ef5e882acff82bda98577a59357))
* **release:** read the previous head's next-cycle promise back ([f6cae66](https://github.com/event4u-app/agent-config/commit/f6cae669502652899467ebdd56b90a2625e6ea69))
* **adr:** surface dated review triggers in the ADR index ([ead5eaf](https://github.com/event4u-app/agent-config/commit/ead5eaf8983d18b2bf42fb4d825d143f8f22bc6e))
* **adr:** decide a review trigger whose condition is a date ([2974a54](https://github.com/event4u-app/agent-config/commit/2974a54eb4d4e71f4072916c32ef40cb7e7494ef))
* **gates:** assert a coverage row runs its gate the way the pipeline does ([0ec7893](https://github.com/event4u-app/agent-config/commit/0ec789358261b47e0a92f7eec7e947fd255429a1))
* **gates:** measure the two README dimensions that regressed unseen ([d18aa13](https://github.com/event4u-app/agent-config/commit/d18aa139eed673e98f93cac281b0dc5acfa9e3bf))
* **gates:** report beta contracts about to lapse, not only those that have ([3c5b868](https://github.com/event4u-app/agent-config/commit/3c5b8685dca0b218985988b85026ed9b8ef503ed))

### Bug Fixes

* **gates:** split the claim check out of the census into a check_ gate ([88132c6](https://github.com/event4u-app/agent-config/commit/88132c6a98ebf9ddb8f7a09f099f5aa5400e452f))
* **roadmaps:** correct what `status: carrier` actually exempts ([80235da](https://github.com/event4u-app/agent-config/commit/80235dacdd6b4edf8d514b75c41423672097d7aa))
* **census:** separate repository drift from store drift in the staleness verdict ([6d9284a](https://github.com/event4u-app/agent-config/commit/6d9284a0f843bace0095305e0cf6250a3135bd2c))
* **design:** name the reduced-motion media query, not a bare rule token ([3b19777](https://github.com/event4u-app/agent-config/commit/3b19777e22d9e451d85049a3e3d4fcdf4e33e7d9))
* **hooks:** route the merged permission-decision envelope through the table ([b4e4573](https://github.com/event4u-app/agent-config/commit/b4e45734a91b4ddd4f26d4725654c97e0b126e12))
* **gates:** read the expiry verdict through the as-of seam ([f6f862a](https://github.com/event4u-app/agent-config/commit/f6f862aeb08e7968d6017e815072763996e42e10))
* **tests:** type the bridge reads instead of suppressing the lint ([285c0e0](https://github.com/event4u-app/agent-config/commit/285c0e0f717954dce7013f6af8ce0615b4e79f62))
* **rules:** keep autonomous-execution inside the size its pointer claims ([a9d21e2](https://github.com/event4u-app/agent-config/commit/a9d21e216216df071577df8458921cad57e53b3b))
* **schema:** bump the skill schema patch for the corrected host claim ([a5281be](https://github.com/event4u-app/agent-config/commit/a5281bea1f1c41288885637cfc904f9f8d6eb47c))
* **rules:** pay for the host-wording correction in the preamble budget ([26659d6](https://github.com/event4u-app/agent-config/commit/26659d642f2d7419a71fa1dbea283a63de8bc0b0))
* **skills:** address a directory by flag where the tool has one ([f4d757f](https://github.com/event4u-app/agent-config/commit/f4d757fd5efa75eb2331085e8dd231acdbe20b35))
* **gates:** drop the duplicate argv-parity mechanism, use the one main already has ([dbfd08e](https://github.com/event4u-app/agent-config/commit/dbfd08e64948f2a6131c413b95bbe3a9908aae82))
* **hooks:** parse git global options in the category-A classifier ([26f928b](https://github.com/event4u-app/agent-config/commit/26f928be6d0d4365455f76f05e74de126804c320))
* **hooks:** stop naming files the TypeScript port deleted ([6c897ef](https://github.com/event4u-app/agent-config/commit/6c897efd16d773bf9051aa943afa9df227e50082))
* **rule:** keep the directory-flag guidance stack-agnostic ([794ecd4](https://github.com/event4u-app/agent-config/commit/794ecd4db1052a62509325e855d230da1e64fe76))
* **canon:** address another directory by flag, not by `cd` ([3d0ad90](https://github.com/event4u-app/agent-config/commit/3d0ad90f0ba3df62ae3108ee249b83e0faed559d))
* **gates:** typecheck the unknown-key scan, and correct a docblock claim ([bedd18c](https://github.com/event4u-app/agent-config/commit/bedd18c2aca19ff59ca2174ee0f8b214fbb7cb7a))
* **rdp:** point the corpus at the successors that exist, not the deleted Python ([5be6ab9](https://github.com/event4u-app/agent-config/commit/5be6ab981fd92aa65cfb2526df545fea70a4f7db))
* **skills:** drop the auto-trigger keywords the descriptions contradict ([720eb73](https://github.com/event4u-app/agent-config/commit/720eb7333fcb248ba82d673dc9e779a6b20d76e2))
* **readme:** hoist only the wedge command, keep the audience-order contract ([14a7204](https://github.com/event4u-app/agent-config/commit/14a72049094907ca784d07a3d3df97d6f64412cc))
* **ci:** site.yml no longer reasons from a premise that stopped holding ([7de0594](https://github.com/event4u-app/agent-config/commit/7de05947159cc53ab49dd59f2176f3404ceb4061))
* **review-changes:** count the judges from the table, not by hand ([18b0070](https://github.com/event4u-app/agent-config/commit/18b00708d9a163502d68f66445fe1f30f60b9b5a))
* **proof:** publish the kernel-denied split beside the undeclared figure ([476d4c0](https://github.com/event4u-app/agent-config/commit/476d4c0af412f81018d3ea083efd425485112169))
* **roadmap:** the blocking-concern count was taken by grep, not by parse ([7f947fc](https://github.com/event4u-app/agent-config/commit/7f947fc0663aad038e89d0014878858300baad76))

### Performance

* **skills:** compress the ten design descriptions back under the preamble ratchet ([63640b1](https://github.com/event4u-app/agent-config/commit/63640b18a0c1279e5467145e673457eaf046c841))

### Documentation

* **census:** the exit-code contract now has three modes, not one ([776efc6](https://github.com/event4u-app/agent-config/commit/776efc6c7b3684d6ddff0266b5b92074de6a009a))
* skills are named or trigger-matched, not matched by topic ([edbc6a5](https://github.com/event4u-app/agent-config/commit/edbc6a5b2e69044069bbe56d66e4d92b2f56e950))
* **claims:** derive the census claim from its record and split the 299 ([265d095](https://github.com/event4u-app/agent-config/commit/265d095be07a9d9823bddecd3506d735476bb0a1))
* **roadmap:** close road-to-one-motion-authority with both blockers decided ([a6071a6](https://github.com/event4u-app/agent-config/commit/a6071a6f420cffa79741d7a815dfdd8088acd6d2))
* **review:** rebind the inbox-2026-09-t skip declaration after merging origin/main ([b4be39a](https://github.com/event4u-app/agent-config/commit/b4be39a346c37d4af6df3f8eeb0e6d6c459497a2))
* **decisions:** disclose what ADR-255 rests on ([e5238e9](https://github.com/event4u-app/agent-config/commit/e5238e9505a5f5b161479630283337ff3536e966))
* **roadmap:** close and archive road-to-authorization-that-reaches-further ([8061844](https://github.com/event4u-app/agent-config/commit/8061844dcfe99e9ec627e071933a7a69f774932f))
* **decisions:** record five scoped refusals and close the blockers ([9a3b6e5](https://github.com/event4u-app/agent-config/commit/9a3b6e5ac7801a2c45ac3324cc96b0066a91c148))
* **roadmap:** close road-to-host-enforcement-truth ([b1f3adf](https://github.com/event4u-app/agent-config/commit/b1f3adf053dc51e5da3dfae9aa1189fd9f643390))
* **review:** skip declaration for the inbox-2026-09-t completion ([c9c4298](https://github.com/event4u-app/agent-config/commit/c9c4298a999b39be3ce4272553ddf22326dc7f34))
* **evidence:** verification and disposition for inbox round 2026-09-t ([045afef](https://github.com/event4u-app/agent-config/commit/045afefb6baeb5d671f96c00355edc277b6088fb))
* **hosts:** say what this package binds, not what a host cannot do ([2b20145](https://github.com/event4u-app/agent-config/commit/2b2014509f26cd4b2177edefe70d01d91d57b734))
* **evidence:** record drain run 19 ([80a23d1](https://github.com/event4u-app/agent-config/commit/80a23d193a84f3fbee0b56b76e232bccffdb9207))
* **roadmaps:** close road-to-the-reasoning-surface-that-is-wired ([17f6b62](https://github.com/event4u-app/agent-config/commit/17f6b6261eb4f8fa3f0c11201ccd117e69d537ed))
* **roadmap:** close road-to-the-ledger-two-releases-skipped ([7cb1af8](https://github.com/event4u-app/agent-config/commit/7cb1af8bc91f87a45fe8e66d9249e812a39e5b95))
* **roadmap:** move the release-finding-ordering review date in ([aadd854](https://github.com/event4u-app/agent-config/commit/aadd854b0a2707cf6722ce510d60d7bfd6bd5675))
* **evidence:** record the two skipped release ledgers and write them ([73a50c6](https://github.com/event4u-app/agent-config/commit/73a50c6472213fddc13bd4446e3e71242becf4b0))
* **evidence:** record ADR-134s unrouted expiry and close the roadmap ([a42bf57](https://github.com/event4u-app/agent-config/commit/a42bf57a6fc75bb3b76ffccc45363601c46bcea4))
* **changelog:** answer the 14.18.0 next-cycle promise ([a9bd75d](https://github.com/event4u-app/agent-config/commit/a9bd75d559107ad3766f0f6af5ee44f958492f00))
* **roadmaps:** close road-to-a-readme-that-stays-short ([25e519d](https://github.com/event4u-app/agent-config/commit/25e519d4fdae30fba55837375df44ca06d3d72be))
* **readme:** reach the first command at line 26 and come back under budget ([52c326d](https://github.com/event4u-app/agent-config/commit/52c326d12bab0a5894e20d1794c085ea70d29d70))
* **roadmaps:** close road-to-a-beta-window-that-is-not-a-surprise ([8f78a41](https://github.com/event4u-app/agent-config/commit/8f78a413d8cca250db889c62525fee4460af054e))
* **roadmaps:** own the two beta dates that nothing owned ([d3982cc](https://github.com/event4u-app/agent-config/commit/d3982ccc8c45920ee03c0b1945096015d74c019a))
* **evidence:** repoint both records at the archived roadmap path ([f51ef0a](https://github.com/event4u-app/agent-config/commit/f51ef0a59214b8245b6c48b5efd806d49763d74e))
* **decisions:** ADR-225 Amendment 1 answers the fired skill-size park ([85f3249](https://github.com/event4u-app/agent-config/commit/85f3249ddf9fad47556ae4bc1230c45937f711d4))
* **evidence:** record the council on the ADR-225 skill-size park, prompt included ([252cb2f](https://github.com/event4u-app/agent-config/commit/252cb2f144a155745b1d395c3241123f8b87ff70))
* **evidence:** reproduce the ADR-225 skill-size park condition at HEAD ([99f09a1](https://github.com/event4u-app/agent-config/commit/99f09a11ae55b4b157c9d39e9c8fb869290e32e7))
* **review:** skip declaration for the inbox-2026-09-s completion ([437f500](https://github.com/event4u-app/agent-config/commit/437f5003bb0d385187caab78f4ce23983dbf67e4))
* **evidence:** verification and disposition for inbox round 2026-09-s ([832a48f](https://github.com/event4u-app/agent-config/commit/832a48f3cc351bda3d4e49f2481dbd47c1fbbc4e))
* **review:** rebind the inbox-2026-09-r skip declaration to the current review scope ([e0344f8](https://github.com/event4u-app/agent-config/commit/e0344f8be1596a353ee641a2e77bffe06e344f18))
* **review:** skip declaration for the inbox-2026-09-r completion ([ec522f9](https://github.com/event4u-app/agent-config/commit/ec522f91a532e665bd2bd6e6f563047ae97c130f))
* **evidence:** verification and disposition for inbox round 2026-09-r ([b132b36](https://github.com/event4u-app/agent-config/commit/b132b36cc557a59680bfdb992c29fce162651b9e))
* **review:** skip declaration for the inbox-2026-09-q completion ([b8be9d2](https://github.com/event4u-app/agent-config/commit/b8be9d22209f891d85cd176dfbd2f595f2c1531a))
* **evidence:** verification and disposition for inbox round 2026-09-q ([a2d7e1b](https://github.com/event4u-app/agent-config/commit/a2d7e1bfc9a03e346a1ec70e5a9bead59e60e4c9))

### Refactoring

* **rule:** fit the directory-flag line inside the preamble ratchet ([5d1d002](https://github.com/event4u-app/agent-config/commit/5d1d002a3c0d2003efa17f326eabdc8eef9338d6))
* move the round's additions out of two capped files ([6e9d41c](https://github.com/event4u-app/agent-config/commit/6e9d41cc7d84ae22027aa7cb73f6df57e70aab50))
* **journal:** move the column migration out of a file past its cap ([03eedeb](https://github.com/event4u-app/agent-config/commit/03eedebebc10651e5eb1e8e92a7eb84c9fe648e7))

### Tests

* **estate:** re-derive the two pins the description rewrites moved ([7b4b879](https://github.com/event4u-app/agent-config/commit/7b4b8798f94c30e29c729eaa4e61ba6ecda2cc04))
* **hooks:** measure the cross-load claim before guarding against it ([1a00c97](https://github.com/event4u-app/agent-config/commit/1a00c970c07a5f67d2465dead568934084e413ca))

### Build

* **install:** refresh the committed installer bundle ([0721e3c](https://github.com/event4u-app/agent-config/commit/0721e3c735755037b352ae9decb61f966ba45b00))

### CI

* run both new gates in a workflow, not only in `task ci` ([6cbf98c](https://github.com/event4u-app/agent-config/commit/6cbf98c163604b1fc0ff12b49f7a3c1c8c944bd7))
* run the findings-ledger gate outside the release/* condition ([fa92daa](https://github.com/event4u-app/agent-config/commit/fa92daa86855a239139a490ad8478d84cfc66676))

### Chores

* **security:** re-pin the gate-coverage canary line to 598 ([3a8e3f7](https://github.com/event4u-app/agent-config/commit/3a8e3f7552133f53e7dccdef596116d4a34d0e87))
* **docs:** regenerate the skill index and catalog ([d310e09](https://github.com/event4u-app/agent-config/commit/d310e09382ffac61349cfdd37ce4d0da980911fa))
* **roadmaps:** archive road-to-the-activation-census-consequence ([eb2491d](https://github.com/event4u-app/agent-config/commit/eb2491d37786335841fd09e16b283aaec5b954ab))
* **roadmap:** archive road-to-one-motion-authority ([e88e3bf](https://github.com/event4u-app/agent-config/commit/e88e3bfaf4484705590dcbd7d3441a88240b9ddd))
* **adr:** refresh the evidence census after ADR-255's disclosure section ([ef16d7f](https://github.com/event4u-app/agent-config/commit/ef16d7ff2583496bbf291c92d933ce379df65dbd))
* **gates:** walk the source-size ratchet down to the new measurement ([b5e448d](https://github.com/event4u-app/agent-config/commit/b5e448d7b28ccea353b5918aeebbac4786dbe690))
* **roadmaps:** archive road-to-host-enforcement-truth ([2dbe4d9](https://github.com/event4u-app/agent-config/commit/2dbe4d90208371fdbd69d79cacc5d44f328a84c6))
* **roadmaps:** archive road-to-the-reasoning-surface-that-is-wired ([814a361](https://github.com/event4u-app/agent-config/commit/814a3613d5b04ed9809dd774f9b3f62045c5394c))
* **secrets:** re-pin the gate-coverage canary line 551 to 563 ([ef863b9](https://github.com/event4u-app/agent-config/commit/ef863b9294184cc748ed94de4e4c57d06bd9f92f))
* **roadmap:** archive road-to-the-ledger-two-releases-skipped ([9fa962b](https://github.com/event4u-app/agent-config/commit/9fa962b3eb9ec1bc8e19493517119e8b94ab4684))
* **roadmaps:** archive road-to-a-dated-trigger-that-decides ([870dae2](https://github.com/event4u-app/agent-config/commit/870dae2cafa98037edaf18938a8a52863ed81db6))
* **roadmaps:** archive road-to-a-readme-that-stays-short ([213e5b9](https://github.com/event4u-app/agent-config/commit/213e5b9314e3e10ca1fe83ec372eeb0fa8e73ff2))
* **roadmaps:** archive road-to-a-beta-window-that-is-not-a-surprise ([4076ef9](https://github.com/event4u-app/agent-config/commit/4076ef9d576a27c2f56776b6e428d7177b894488))
* **docs:** regenerate command-flows for the corrected judge counts ([37d69cb](https://github.com/event4u-app/agent-config/commit/37d69cb4844e0739a89b00cd6af157aa518f1483))
* **evidence:** refresh the ADR evidence census after the ADR-225 amendment ([1a88ac4](https://github.com/event4u-app/agent-config/commit/1a88ac489f48d55aa9084727e820cb3540dc54c9))
* **roadmaps:** archive road-to-the-skill-size-park-fired ([497fb13](https://github.com/event4u-app/agent-config/commit/497fb1322a972e8377fb5ecb4a90667fe98c5d34))
* **index:** regenerate agents/index.md + docs/catalog.md ([a97717c](https://github.com/event4u-app/agent-config/commit/a97717cfa4ffb6a8ee27b633335418821fef8855))
* **roadmaps:** archive road-to-figures-that-name-their-denominator ([1972c62](https://github.com/event4u-app/agent-config/commit/1972c628d666ff9580e93c255893bfedc80ba1db))

### Other

* drop a comma from the three skill-reachability lines ([be57b0c](https://github.com/event4u-app/agent-config/commit/be57b0c09e6679dee791ffa6c42a8a9abaaf8102))
* close the activation-census consequence, carry its framing choice ([9278c13](https://github.com/event4u-app/agent-config/commit/9278c130d04bb27dc4d0f6a84aa8c53bf9c3282d))
* resolve the retirement blocker with option 1 and harden the end state ([64547a8](https://github.com/event4u-app/agent-config/commit/64547a8f4a0816dac401848daaba8e8439eba1ff))
* one continuity record, from inbox round 2026-09-t ([5e48184](https://github.com/event4u-app/agent-config/commit/5e4818468ebab9ef29e620ee1bd83f24e01d7787))
* write the continuity arrival counter onto its most recent archived epoch ([6bceab9](https://github.com/event4u-app/agent-config/commit/6bceab9073c09902801c905873eed6699bdc2444))
* **proof:** drop the section mark from the axis comment ([4ba967a](https://github.com/event4u-app/agent-config/commit/4ba967a2e70625e59a1034d5ea2ffb8f3095cabd))
* close road-to-figures-that-name-their-denominator ([c68fe04](https://github.com/event4u-app/agent-config/commit/c68fe041d1fdd0be207ff14fb2bbfcfe9deabf1d))
* measured prose tells, from inbox round 2026-09-s ([3b33220](https://github.com/event4u-app/agent-config/commit/3b33220c3b72c851a88d5107a7a83a7476837015))
* write the humanizer arrival counter onto its archived parent ([6b19271](https://github.com/event4u-app/agent-config/commit/6b1927134517f3833f0f429eb091eb82be0d9982))
* four roadmaps and one stub from inbox round 2026-09-r ([e3592b0](https://github.com/event4u-app/agent-config/commit/e3592b0995284597b2190c16f170474964819d29))
* write arrival counters onto four held objects that had none ([936fd33](https://github.com/event4u-app/agent-config/commit/936fd33d32c50fb6d590630d4f2eab50f10fa679))
* four roadmaps and one stub from inbox round 2026-09-q ([a3c09f0](https://github.com/event4u-app/agent-config/commit/a3c09f04c4287183fc5ac7a104e012d01671dc4c))

Tests: 21476 (+286 since 14.18.0)

## [14.18.0](https://github.com/event4u-app/agent-config/compare/14.17.0...14.18.0) (2026-09-06)

### Release highlights

- **Behaviour changes:** say that a finding id is a finding id, not a commit SHA (d6ca2b7); bump skill.schema.json to 1.1.0 for the added enforced_by key (ab87d6a); a standard-conformance claim names its resolver or declares its gap (9a013fa).
- **Default changes + migration:** _none_
- **Security and correctness:** resolve --git-path output before comparing it (f5d3c5c); honour core.hooksPath, name the destination, and repair two weak pins (89305f3); make the staleness check advisory, and stop it prescribing a downgrade (6b7e6c2); drop the write-swallow assertions the removed guard owned (9deec70); drop consumer-dead paths and re-derive the corpus pins (934cd71); declare conformance-claim-baseline in the suppression inventory (45bf83e); +15 more.
- **Honest nulls:** track the hook this change could not reach (3802ea5); close road-to-checklist-rows (29f63fe).
- **Known limitations:** _none_

> **Governance mix:** governance-only 55 vs consumer-only 16 (taxonomy 1.0.0).
> Next cycle ships the installed MCP bridge repair — a version-pinned server
> entry instead of an `npx -y` resolution of `latest` at every start, a
> registration that migrates itself when the bridge shape changes under an
> update, and setup docs that document the command the installer actually
> writes — tracked in `road-to-mcp-bridge-integrity-and-reach-truth`.

### Features

* **hooks:** report when the installed git hooks go stale ([6b12be5](https://github.com/event4u-app/agent-config/commit/6b12be5d66a6efc08fe3bc467719b851960b68c5))
* **roadmaps:** add the receiver for the tenth arrival's carried AC-3 ([576de5f](https://github.com/event4u-app/agent-config/commit/576de5f3fafb290dbcec54cda5f9a18075f84d8a))
* **authz:** remove the git-authorization gate — enforcement returns to the model ([7f5bc37](https://github.com/event4u-app/agent-config/commit/7f5bc37321404d39ffe22b7401b2ee694d7d82af))
* **release:** register every release-validation job against a local command ([e9f272b](https://github.com/event4u-app/agent-config/commit/e9f272b87723879f2afeb064d98d58880527a4e6))
* **detectors:** flag a newly introduced silent catch, warn-first ([85b1db3](https://github.com/event4u-app/agent-config/commit/85b1db34bb08acd7a41a00d4273475fa427d3628))
* **detectors:** decide verification tampering by shape, loop-local ([f7a8e16](https://github.com/event4u-app/agent-config/commit/f7a8e16163c4ce495171c76feb6711864538b6c4))
* **skills:** a standard-conformance claim names its resolver or declares its gap ([9a013fa](https://github.com/event4u-app/agent-config/commit/9a013fac54fd1d50126ef11bc3be681e76d085cc))
* **hooks:** make a push say whether it finished, not only whether it worked ([b3fff64](https://github.com/event4u-app/agent-config/commit/b3fff64e1b0e9dc57215e8b718cf11c003dc1709))
* **prepush:** ask the staleness question the hook has always claimed to ask ([10a3168](https://github.com/event4u-app/agent-config/commit/10a3168426e23d3e9501ab3f62ff4bc1b7cfb5e2))
* **planning:** state the four criteria a plan can be failed on ([1d77901](https://github.com/event4u-app/agent-config/commit/1d77901ebbeaf12c01ce3bde6c02f1eaae99438c))
* **ai-code-blindspots:** add the four completeness rows to the render surface ([339c40d](https://github.com/event4u-app/agent-config/commit/339c40dae2aa27e1b76bf6f2e25d40de189fe545))

### Bug Fixes

* **tests:** resolve --git-path output before comparing it ([f5d3c5c](https://github.com/event4u-app/agent-config/commit/f5d3c5ce47b4744344b428dc682db2069f38fbe2))
* **hooks:** honour core.hooksPath, name the destination, and repair two weak pins ([89305f3](https://github.com/event4u-app/agent-config/commit/89305f333f4c44efcc71c56d9c46bdd8f6e5e88c))
* **hooks:** make the staleness check advisory, and stop it prescribing a downgrade ([6b7e6c2](https://github.com/event4u-app/agent-config/commit/6b7e6c2a62949475aad9b5dedc0167fd9c0f88f2))
* **roadmaps:** land the AC-6 cancellation PR #1860 archived without ([d92f9a6](https://github.com/event4u-app/agent-config/commit/d92f9a60e512ddae3adbb9eaeff7bf7f2432cf45))
* **docs:** keep the skill reference portable and the dialect canonical ([500da8b](https://github.com/event4u-app/agent-config/commit/500da8b781ee8af1a5c44946123964d8c0c94440))
* **test:** drop the write-swallow assertions the removed guard owned ([9deec70](https://github.com/event4u-app/agent-config/commit/9deec705af2d4242e93613f6e8cb3abfda52f0c4))
* **adr:** ADR-254 carries no agentic_mode — the decision had none ([7e38059](https://github.com/event4u-app/agent-config/commit/7e38059c23aab7d8b4989cf639591e26b4629662))
* **testing-anti-patterns:** use the house dialect in the five new prose lines ([72acd36](https://github.com/event4u-app/agent-config/commit/72acd36a8864890dd47551c0bd0c5b65b127d109))
* **code-intelligence:** drop consumer-dead paths and re-derive the corpus pins ([934cd71](https://github.com/event4u-app/agent-config/commit/934cd7117eb71b113114bcba8dbaca9b3d939483))
* **gates:** declare conformance-claim-baseline in the suppression inventory ([45bf83e](https://github.com/event4u-app/agent-config/commit/45bf83e1e72a1a07d0cd58b90d0fb705086bd380))
* **test:** drop the three imports the deleted enforcement tests owned ([9fd6a80](https://github.com/event4u-app/agent-config/commit/9fd6a8022143964b70d6bfe7b66367e2f2c95218))
* **skills:** name feature-planning instead of linking it from complexity-first-planning ([ed70287](https://github.com/event4u-app/agent-config/commit/ed702875ef4c87c78e3df7e58120d8001ca8f99f))
* **evidence:** declare review independence on the 14.16.0 findings ledger ([848dd8e](https://github.com/event4u-app/agent-config/commit/848dd8e2a86df20d5d9ab59fc1eeeb880d5ded26))
* **release:** stop the runner reporting a clearance it did not earn ([47412ed](https://github.com/event4u-app/agent-config/commit/47412ed6d1780be01f172943b424f8c4fea34e5f))
* **release:** move the tests-footer refusal off the site that cannot recover ([4394eda](https://github.com/event4u-app/agent-config/commit/4394eda093c9fe9c301b7d462d62981b79979a8a))
* **release:** the mix predicate was wrong in both directions ([f71e975](https://github.com/event4u-app/agent-config/commit/f71e975fb4c1b0ddeae3bea67aa8072890a6fd2c))
* **release:** drop the two box-rule section comments this branch added ([1355604](https://github.com/event4u-app/agent-config/commit/1355604d8554cf4ae106901b7cd49e6a5f97d8ad))
* **release:** drop the imports this branch's own relocation orphaned ([6282594](https://github.com/event4u-app/agent-config/commit/6282594ad7d7b55fbcb12f0881dd91ef3ad877d4))
* **release:** refuse both writer placeholders, not only the first ([6fd1e67](https://github.com/event4u-app/agent-config/commit/6fd1e67866b5925e428ef2e3155d618014242a97))
* **release:** skip the release-PR-shape row off a release branch, and say so ([67dfddc](https://github.com/event4u-app/agent-config/commit/67dfddc4097d72b48acfe4599a1785c113560e78))
* **release:** refuse the governance-mix obligation before the push, not on the PR ([23cc153](https://github.com/event4u-app/agent-config/commit/23cc153ccc8344e99e2b35985858388d46793377))
* **code-graph:** bind imports to their module specifier, stop guessing by name ([87a5bf9](https://github.com/event4u-app/agent-config/commit/87a5bf9dc920594786950ac9aa78837e60925b37))
* **release-truth:** absence is not evidence of zero ([d318926](https://github.com/event4u-app/agent-config/commit/d318926eaa16703608623b223c68a1de47634849))
* **self-review:** say that a finding id is a finding id, not a commit SHA ([d6ca2b7](https://github.com/event4u-app/agent-config/commit/d6ca2b790c9b09c5351f59758e3c5a24f9630a7a))
* **roadmap:** the carrier was already there — 1.2 claimed otherwise without looking ([466c45b](https://github.com/event4u-app/agent-config/commit/466c45b637b83dfca533039103c1883611f92645))
* **hooks:** stop swallowing a failed write at all four sites, not the two that were reported ([6b41475](https://github.com/event4u-app/agent-config/commit/6b4147531e2b87e54942d0c1121d8d1db5f94a61))
* **hooks:** record the push-settle admission, and drop the last maintainer verb ([0196513](https://github.com/event4u-app/agent-config/commit/0196513f8f761567cd83e9bc07b4d8ca92517e81))
* **git-workflow:** keep the shipped skill shippable, and speak the house dialect ([4658fdf](https://github.com/event4u-app/agent-config/commit/4658fdfe5f589161ab43cc5dd4395188436dde0a))
* **git-workflow:** say the install lifecycle without naming one ecosystem's tool ([01fa985](https://github.com/event4u-app/agent-config/commit/01fa985fd1569b1d9f49d1c04b9fdbf8735375b7))
* **git-auth:** route isRevocation through the one clause-scoped negation parser ([c19f4d7](https://github.com/event4u-app/agent-config/commit/c19f4d7246cab5da2f19834e69a2cbbb34fe5311))
* **roadmaps:** correct two stale line citations in the archived roadmap ([455f3f2](https://github.com/event4u-app/agent-config/commit/455f3f2491a3d07769d20b79c5a2b64f4a6ac02f))
* **claims:** retire the surviving no-runtime-daemon wording and repair the README ([d6992c8](https://github.com/event4u-app/agent-config/commit/d6992c867b61543d17e18afb927ba68f04f39577))

### Documentation

* **evidence:** correct the run-21 record after lane B's review landed ([df1203f](https://github.com/event4u-app/agent-config/commit/df1203f86bf5d8248b4d982d62b491fcc8f1091e))
* **roadmaps:** record arrival counts on the objects nine rounds hit ([cd0d572](https://github.com/event4u-app/agent-config/commit/cd0d5722ac3a652f83fc96577bb69bd6f5628b63))
* **roadmaps:** add road-to-observed-learning-signal ([ce41a05](https://github.com/event4u-app/agent-config/commit/ce41a05f0c80453ae648cbd2ab5599be669d156b))
* **roadmaps:** add road-to-scan-that-fails-closed ([070076d](https://github.com/event4u-app/agent-config/commit/070076d0e9cb24ba0b5fa670018667e0b397ec57))
* **roadmaps:** add road-to-admissible-council-seats ([708b575](https://github.com/event4u-app/agent-config/commit/708b57545c1953889b04582dbdd6b3d113d0d760))
* **roadmaps:** add road-to-authorization-that-reaches-further ([d84cc1c](https://github.com/event4u-app/agent-config/commit/d84cc1c92c6e2ed89cda6b11b7a88959bb6a2c1f))
* **roadmaps:** add road-to-one-motion-authority ([572b778](https://github.com/event4u-app/agent-config/commit/572b7789c1e43b061104223b5f97957a076a7b35))
* **roadmaps:** add road-to-mcp-bridge-integrity-and-reach-truth ([8ed7d7b](https://github.com/event4u-app/agent-config/commit/8ed7d7b496671c2c4860a43b679dee33d176ee84))
* **roadmaps:** add road-to-asked-not-parked ([c74eaa5](https://github.com/event4u-app/agent-config/commit/c74eaa5a5a58377018f37f096e066be3ea0ac00b))
* **roadmaps:** add road-to-host-enforcement-truth ([ba136b4](https://github.com/event4u-app/agent-config/commit/ba136b4dadb994aae1681e3678d4ffae6e8a2d15))
* **roadmaps:** add road-to-bounded-reference-harvest-loop ([23ab3df](https://github.com/event4u-app/agent-config/commit/23ab3dfcd69220a289816ebcf6329b2791125a0d))
* **evidence:** record the cross-session hook revert the detector caught ([2da72d3](https://github.com/event4u-app/agent-config/commit/2da72d36ac2292b12f126ca53519451e58f45884))
* **evidence:** state the run-21 base-update and ci_settle-exit-2 detail ([4365727](https://github.com/event4u-app/agent-config/commit/4365727ddbba9ff0b82f5149fa9c20b3f16d4010))
* **evidence:** record the run-21 autonomous roadmap drain ([1a49336](https://github.com/event4u-app/agent-config/commit/1a49336427e7df6ac24fd60d682927fdce1ec94e))
* **adr:** ADR-254 discloses what it rests on ([b003cc0](https://github.com/event4u-app/agent-config/commit/b003cc0423b35cc9d1f5332b8b8522193be0219c))
* **roadmap:** re-pin the DONE-note line citations after the reorder ([a4f75c7](https://github.com/event4u-app/agent-config/commit/a4f75c7a22564d9a6c684e481120c4f46c0c7c6b))
* **roadmaps:** resolve the worth-building blocker W-NO ([6e9f0c5](https://github.com/event4u-app/agent-config/commit/6e9f0c5c016b4680327b602a72cb179ac55c80d7))
* **hooks:** answer the consumer question and record the refused repair ([77bafdf](https://github.com/event4u-app/agent-config/commit/77bafdfca0b193f276ff6f6fac9126337ee1766c))
* **roadmaps:** carry the tenth arrival's AC-3 rather than claiming it ([b92952c](https://github.com/event4u-app/agent-config/commit/b92952c978016f8506f1edab7786a19d76297dab))
* **evidence:** reproduce the tenth-arrival AC-3 constraint at n=1 ([1476bfa](https://github.com/event4u-app/agent-config/commit/1476bfa7d23dd7337730da68ef9f48426538b402))
* **evidence:** record the 2026-09-05 PR drain run ([d5c8c75](https://github.com/event4u-app/agent-config/commit/d5c8c75727d41bdf389a4b21db30a47a210190c8))
* **release:** correct three claims this branch got wrong, and name the surface ([21d0f58](https://github.com/event4u-app/agent-config/commit/21d0f584777a99206d444f0b72e279e4c2f78794))
* **authz:** ADR-254 supersedes ADR-252, and every doc that claimed a window ([c1dabe5](https://github.com/event4u-app/agent-config/commit/c1dabe561b7c4d8af278319d3903112a8e1b074d))
* **release:** correct the coverage paragraph that documented the gap ([3cd0376](https://github.com/event4u-app/agent-config/commit/3cd0376fc2018a71a452c3d77be2cbd246b39fea))
* **worktrees:** name the cwd cost of a worktree outside the repo root ([e4ad278](https://github.com/event4u-app/agent-config/commit/e4ad278bff745b19f75cd9702ffa8c3229963766))
* **index:** regenerate for the code-intelligence description change ([f8e7955](https://github.com/event4u-app/agent-config/commit/f8e7955b25e3bbbfee7fb884de90a791728c795a))
* **roadmaps:** archive road-to-the-graph-that-lies-confidently ([a53789a](https://github.com/event4u-app/agent-config/commit/a53789ab507169d7f267483ab944cecc8839bfff))
* **roadmaps:** close the graph-that-lies-confidently with its findings ([3d23a90](https://github.com/event4u-app/agent-config/commit/3d23a9070bb201adb46b580877965f923248b7f9))
* **code-intelligence:** re-anchor the published measurement to the re-run ([9d5042c](https://github.com/event4u-app/agent-config/commit/9d5042c614f92daafee2aa7db250a0abfdeda5f4))
* **code-intelligence:** apply the retraction where the claim still lives ([7d36b11](https://github.com/event4u-app/agent-config/commit/7d36b11010f719d8e0f9acb3b5f42c2870a89e24))
* **roadmaps:** archive road-to-the-unwritten-ledger ([4b68884](https://github.com/event4u-app/agent-config/commit/4b6888446013df14d9409fcf2618fc34b5f9ad14))
* **roadmaps:** close the unwritten ledger, and move the sibling review date ([0493a64](https://github.com/event4u-app/agent-config/commit/0493a64f9ce674a59e7186dd108a12203ebeed0d))
* **self-review:** record why the enforcement flip is not safe to take yet ([6e89069](https://github.com/event4u-app/agent-config/commit/6e890690e28d05198e4425528e9eea6e95441d1a))
* **evidence:** write the findings ledger 14.16.0 never got ([c507353](https://github.com/event4u-app/agent-config/commit/c5073530e44d6f464cbfafbee2e5e08204d2923e))
* **contracts:** name two test smells, and give flakiness a state ([e795899](https://github.com/event4u-app/agent-config/commit/e7958998d0d6699417354fd58b844e7074284b9b))
* **roadmaps:** record the three counted populations, and report AC-5 failed rather than claim it ([5626df0](https://github.com/event4u-app/agent-config/commit/5626df095363b7cec8d206e3b3e322a662c3c76f))
* **roadmaps:** inline the council convergence summary instead of linking it ([387b1d0](https://github.com/event4u-app/agent-config/commit/387b1d03ad58c0c30e2bfa3399c8783f3d519100))
* **roadmaps:** close road-to-one-negation-vocabulary ([c8b9771](https://github.com/event4u-app/agent-config/commit/c8b97710aecea7628a0db83927e504cd11e9e288))
* **git-workflow:** name the hole this change leaves open ([722c8cb](https://github.com/event4u-app/agent-config/commit/722c8cbfb24708d89b56ce654591c2e012430d40))
* **git-workflow:** a push closes its own loop ([e3f681d](https://github.com/event4u-app/agent-config/commit/e3f681df062143f75d26e5bf931ef31cd45de904))
* **roadmaps:** close road-to-checklist-rows ([29f63fe](https://github.com/event4u-app/agent-config/commit/29f63fe57b54e9faf46dd4bfce9a547188c36642))
* **laravel-mail:** cover what a transactional email needs to survive a client ([30bcc27](https://github.com/event4u-app/agent-config/commit/30bcc27433d6bc6f46e66f0c932efed9994f2561))

### Tests

* **authz:** drop the enforcement tests, keep every ledger and classifier test ([3030265](https://github.com/event4u-app/agent-config/commit/30302652699d9d9674d3b2ba972adc6828627248))
* **release:** prove the pre-push gate run can actually stop a release ([13e7bb3](https://github.com/event4u-app/agent-config/commit/13e7bb38b778e9ad0c260e2a8451fd04e1c6c9d3))
* **bench:** re-pin the re-run to the engine tree that actually ships ([bd8a222](https://github.com/event4u-app/agent-config/commit/bd8a222c602b7b7a305b63d50fccf3c19868feac))
* **bench:** publish the v2 re-run, zero classes won again ([5264732](https://github.com/event4u-app/agent-config/commit/52647327c64a4eda9bf25adb2844cbd8075e6d7a))
* **bench:** warn on every re-run that a measured root is live source ([20af461](https://github.com/event4u-app/agent-config/commit/20af461be6cdbac56892dd2543dbe134b8b7a3d7))
* **bench:** let the v2 runner write a dated re-run without overwriting v2 ([4988954](https://github.com/event4u-app/agent-config/commit/4988954f4268aee9f0fddfa4fc55e3311ed9473f))
* **fixtures:** commit the tamper corpus before any detector exists ([c62402c](https://github.com/event4u-app/agent-config/commit/c62402c7c7c49e24cc036b9e93032530127c91e1))
* **git-auth:** derive the operation set, and name every guard rather than only the covered one ([e6dd88e](https://github.com/event4u-app/agent-config/commit/e6dd88e5e0b5f123a08c130b227e68c5de5f0f3e))
* **git-auth:** assert the negation corpus against both functions ([c01c6e7](https://github.com/event4u-app/agent-config/commit/c01c6e7227eed02898c78eb4a98f6835cba5f882))

### Chores

* **roadmaps:** archive road-to-second-trigger-corpus-generation ([666d2a8](https://github.com/event4u-app/agent-config/commit/666d2a882fefa7f3abaf60bd47444f6c8daef9bb))
* **adr:** regenerate the evidence census for ADR-254 ([88e16ff](https://github.com/event4u-app/agent-config/commit/88e16ff938f38e89573d910d5e36f7bdae9aa008))
* **roadmaps:** archive road-to-the-tenth-arrival ([4f34c15](https://github.com/event4u-app/agent-config/commit/4f34c157fc2480b942e4fb557c541302c3fc0407))
* **reports:** regenerate the skill-overlap report after the dialect fix ([3fcfe81](https://github.com/event4u-app/agent-config/commit/3fcfe81a5a0485eab903ffc441f8d8876d296958))
* **meta:** regenerate the meta pack token passport after the main merge ([c4747a8](https://github.com/event4u-app/agent-config/commit/c4747a88131da2d8bb40eb7e654762c301952001))
* **code-graph:** drop a box-rule comment lint_code_comments rejects ([10fcf0c](https://github.com/event4u-app/agent-config/commit/10fcf0c1bfa3d258c97298c0786e151308f54082))
* **evidence:** re-anchor the routing body-signal verdict after a skill-body edit ([44db916](https://github.com/event4u-app/agent-config/commit/44db91672b0092a293b5645e5ce083ae47f96e8a))
* **roadmaps:** archive road-to-deterministic-defect-detectors ([b256143](https://github.com/event4u-app/agent-config/commit/b256143d917c8e1ccd0e1e3e3818025a924834e4))
* **schemas:** bump skill.schema.json to 1.1.0 for the added enforced_by key ([ab87d6a](https://github.com/event4u-app/agent-config/commit/ab87d6ae01ce48a69eda6946408d8346f832e878))
* **evidence:** declare the evidence type on the three census artifacts ([003963e](https://github.com/event4u-app/agent-config/commit/003963eff51a1acc5f235d8d760aee4517bed697))
* **roadmaps:** archive road-to-defect-population-sweeps ([1b5f60a](https://github.com/event4u-app/agent-config/commit/1b5f60ab19926142ba7cdb5514201797b0b088a8))
* **roadmaps:** archive road-to-one-negation-vocabulary ([45e4036](https://github.com/event4u-app/agent-config/commit/45e4036e84b4eb28062a68ec4bf49768865fdff7))
* **roadmaps:** archive road-to-checklist-rows ([34f109f](https://github.com/event4u-app/agent-config/commit/34f109ff334a7c77f032e21aad86529b29a0fc9e))

### Other

* **r2:** rebind the artefact after the base merge ([922a6dc](https://github.com/event4u-app/agent-config/commit/922a6dc9b8448623334ab1e2f81aefa3f7516f22))
* **r2:** rebind the round-2 artefact against origin/main ([735888d](https://github.com/event4u-app/agent-config/commit/735888df79ace437ecb0576fbd13862f11347106))
* **r2:** round-2 dispositions, all eleven terminal ([79eb0cf](https://github.com/event4u-app/agent-config/commit/79eb0cf752bf95f10eb4093353bda0368a8b755e))
* **r2:** record the blind completion review, findings open ([23884ad](https://github.com/event4u-app/agent-config/commit/23884ad2ec01ec63ec395c56c15decbcb025f9f1))
* complete road-to-the-hook-that-was-never-installed ([a8c0ddc](https://github.com/event4u-app/agent-config/commit/a8c0ddc51ad71097a585e54fdb9a21ca5f483009))
* close road-to-the-check-that-cannot-see under delegated disposition ([cfb696f](https://github.com/event4u-app/agent-config/commit/cfb696fdd0a954d1320b9aa49c51a22818795dab))
* **detectors:** drop markdown headings from the new docstrings ([63e9263](https://github.com/event4u-app/agent-config/commit/63e9263d6ac7da023f5c437dd1f7a7e5602eda5f))
* track the hook this change could not reach ([3802ea5](https://github.com/event4u-app/agent-config/commit/3802ea5e2fc47d9346179a8edb184d4e64efd6cd))

Tests: 21190 (+183 since 14.17.0)

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
