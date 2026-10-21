<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
review_by: 2026-12-01
estate_offset_exempt: "Round inbox-2026-10-v verified at 324969e7e that nothing this package ships watches a consumer project's dependencies, runtimes or toolchain between changes: dependency-upgrade fires only on an upgrade (SKILL.md:4) and asks for `composer audit` / `npm audit` 'regularly' with no mechanism (:209); supply-chain-intake does not fire when no dependency is added (:23); `querybatch` and `minimumReleaseAge` have zero hits in src/; and ADR-238:44-45 assigns 'dependency security' to the one skill whose scope excludes that case. The daily probe machinery exists three times, all for this package only (update_check.ts:39-147, probe_throttle.ts:50-64, session_register_hook.ts:933-952). No active, parked or stub roadmap owns this: a grep over agents/roadmaps/{*,later,stubs} for querybatch, minimumReleaseAge, pre-announced and advisories.mode returns nothing; the nearest, road-to-an-update-that-installs-itself-only-when-it-is-safe, owns this package's own install. Parking costs more because a critical runtime advisory pre-announced on 2026-10-20 for 2026-10-21 reached no project through this package; merging into that file would put consumer monitoring behind an install transaction."
relates:
  - slug: road-to-an-update-that-installs-itself-only-when-it-is-safe
    relation: depends
    note: "Phase 4.2's session notice joins the open council round recorded there as blocker `concerns-refused-as-authority-expansion`; it argues nothing a second time. Every other phase stands without it."
  - slug: road-to-security-fixes-carried-to-the-merge
    relation: extends
    note: "That file consumes this one's verdict vocabulary (2.2) and the notice's offer (4.2) and carries a finding to a merged, deployed fix. This file builds no fix."
  - slug: road-to-worktrees-that-leave-after-the-merge
    relation: disjoint
    note: "Owns worktree removal. This file creates no worktree."
depends:
  - road-to-an-update-that-installs-itself-only-when-it-is-safe
---
# Road to advisories heard the same day

> **Source:** `agents/tmp.old/inbox-2026-10-v/` — one owner transcript and
> three supplied plans, pinned at `main@8a2c3b4`, re-read at `main@324969e7e`
> on 2026-10-21. External references appear only as mechanisms; their origins
> are `ENC1`-encrypted in the round's intake note.

## Goal

When a security advisory, a malware report, an end-of-security-support date or
a pre-announced security release touches something a project actually uses —
a locked package, a declared runtime, the package-manager binary, a CI or base
image — the person working on that project hears about it **the same day**, in
proportion to how much it matters, with the evidence for each claim and an
offer to fix it. Silence is never reported as safety: a source that could not
be reached reads `unknown`, never "no findings".

Measured promise, pre-registered in Phase 0: **time-to-notice (TTN)** —
advisory publication → first user-visible notice in a session on an affected
project.

## Prerequisites

- Phase 4.2 waits on the council round recorded in
  `road-to-an-update-that-installs-itself-only-when-it-is-safe.md` § Blockers,
  `concerns-refused-as-authority-expansion` (opened 2026-10-20). Phases 0–3
  and 5 do not.
- No new runtime dependency and no vendored scanner: the hook bundle stands at
  its ceiling (`src/config/hook-bundle-budget.json:7`).

## Context — read at `main@324969e7e`

| # | Defect | Evidence |
|---|---|---|
| A1 | **The "quiet week" gap is named here and closed for this package only.** A PR-time audit misses an advisory against an already-installed version until the next PR; a scheduled re-evaluation closes it. Nothing shipped closes it for a consumer. | `.github/dependabot.yml:7-10` |
| A2 | **Every consumer-facing dependency asset is reactive.** `dependency-upgrade` fires on an upgrade; `supply-chain-intake` does not fire without a new dependency; the only ongoing instruction is "check … regularly" with no mechanism. | `src/skills/dependency-upgrade/SKILL.md:4,209`; `src/skills/supply-chain-intake/SKILL.md:23` |
| A3 | **Monitoring has no owner.** ADR-238 routes "dependency security" to the skill whose scope excludes the no-change case. | `docs/decisions/ADR-238-security-content-routes-to-external-authority.md:44-45,66-68` |
| A4 | **The daily-probe machinery exists three times, all package-own.** A 24 h registry probe with a 1 s budget and a sanitising cache carrying `security: boolean`; a local-day throttle; a retro probe riding `session_start`. | `src/scripts/_lib/update_check.ts:39,41,76-147`; `src/scripts/hooks/probe_throttle.ts:50,64`; `src/scripts/session_register_hook.ts:933-952` |
| A5 | **Runtimes and toolchains are invisible.** The only manifest reader in the shipped scripts reads `composer.json` / `package.json` for a frontend stack; nothing reads `require.php`, `config.platform.php`, `.php-version`, `.nvmrc`, `engines.node`, `.tool-versions`, `mise.toml`, Dockerfile `FROM` or CI image tags. The `engines.node` readers that exist read this package's own update candidate. | `src/agent-src/templates/scripts/work_engine/stack/detect.ts:9-30,251-253`; `src/scripts/_lib/unattended_gates.ts` |
| A6 | **Shipped examples teach rotted versions.** The docker skill pins a Node major past end of life; `composer-packages` has zero lines on audit, advisories or abandoned packages. | `src/skills/docker/SKILL.md:167`; `src/skills/composer-packages/SKILL.md` (0 hits for `audit\|security\|advis`) |
| A7 | **The post-update audit has no release-age dimension.** No asset mentions cooldown or minimum release age; nothing re-checks `.claude/`, `.vscode/`, `.cursor/` after an update — the persistence path a 2026 worm used. | `src/skills/dependency-upgrade/SKILL.md:258-270`; 0 hits for `minimumReleaseAge` in `src/` |
| A8 | **In this package's own CI, an advisory arrived as an unattributed red.** The audit step went red with no dependency change and every open PR with it. Resolved since (lockfile now past the fixed versions), kept as the first replay fixture. | `agents/roadmaps/stubs/road-to-the-fastify-and-hono-advisories.md:37-40` |

### Constraints

| # | Constraint | Evidence |
|---|---|---|
| C1 | `skill_count` and `concern_count` growth allowance is 0. | `src/config/estate-count-budget.json:25,27` |
| C2 | A council refused `session_start` concerns that act; it asked for declared authority expansion, read-only notify, and a user-owned setting. | `road-to-an-update-that-installs-itself-only-when-it-is-safe.md:331-388` |
| C3 | Fetched remote text never enters model context; the cache is the sanitising boundary. | `src/scripts/_lib/update_check.ts:139-147` |
| C4 | Network reads are disclosed in the settings file in plain words. | `src/config/agent-settings.template.yml:1127-1138` |
| C5 | Existing installs are asked, never flipped; `audit` is an approved verb with no cluster under it yet. | `docs/decisions/ADR-291-existing-installs-are-asked-never-flipped.md`; `src/config/discovery/command-verbs.yml:18` |
| C6 | The package carries no security parameters and no advisory data. | ADR-238:66-68 |

### Bestand — reuse, do not rebuild

| Need | Already in tree |
|---|---|
| Day throttle, fail-open | `src/scripts/hooks/probe_throttle.ts` |
| Fetch with hard timeout, sanitising cache | `src/scripts/_lib/update_check.ts:76-147` |
| Semver compare and range subset | `src/scripts/_lib/version_order.ts:24,59,129` |
| Workspace walker over manifests | `detect.ts:803,866` |
| Security floor outranking a version rule | `src/scripts/check_dependency_floors.ts:24` |
| CI audit-step detection | `src/scripts/grade_target_readiness.ts:431` |
| Provenance check (`npm audit signatures`) | `src/scripts/_lib/provenance_verify.ts` |

## Phase 0 — Pre-register the promise and the replay corpus

- [x] **0.1 TTN bar**, written before any Phase 1 code: P50 ≤ 24 h, P90 ≤ 36 h
      for a project with ≥ 1 session per working day; T0 ≤ 4 h where the
      opt-in out-of-band runner (5.3) is enabled. An honest null is a
      complete result.
      verify: a claim row for TTN in `docs/CLAIMS.md` with status `unbacked`
      and a reproduce command, committed with `build_proof` in the same change.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **0.2 Replay corpus, this package's own incident first.** F1 the A8
      advisory pair; F2 a runtime security release pre-announced a day ahead
      with no patched version named; F3 a package-manager-binary CVE; F4
      malware with no advisory record; F5 a runtime branch reaching end of
      security support in < 90 days; F6 a week offline; F7 a private package
      name; F8 a Debian-style vendor backport where the upstream version looks
      older than the fix; F9 a corrected advisory whose range shrinks; F10
      five concurrent sessions on one machine.
      verify: each fixture is a directory under `tests/fixtures/advisories/`
      with an expected-verdict file.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **0.3 Noise budget**: ≤ 3 interrupting notices per project per week;
      the rest go to the digest.
      verify: the budget is a constant read by 3.1, asserted by a test that
      feeds ten T1 findings and counts three interrupts.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 1 — Know what the project actually runs

- [x] **1.1 One deterministic inventory reader**: packages from lockfiles
      (incl. GitHub Actions pins); runtimes from declarations, Dockerfile
      `FROM`, compose and CI images; the package-manager version. Each entry
      carries `file:line` and a provenance of `lockfile | declared | image |
      ci | inferred` — a `composer.json` `require.php` range is never reported
      as the runtime that is deployed.
      verify: a fixture with `require.php: ^8.3` and a Dockerfile on 8.4
      yields two entries with different provenance, never one.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.2 Recompute on change only**: a hash over the files read; unchanged
      → reuse.
      verify: a second run over an unchanged fixture reads no lockfile body.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.3 Private names never leave**: `path`, `vcs` and private-registry
      packages are excluded from every outbound query (F7).
      verify: F7 with a recording transport sends zero requests naming it.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **1.4 Fix the rotted shipped facts (A6)**: the docker skill's pinned
      Node major, and an audit/advisories/abandoned section on
      `composer-packages`.
      verify: `grep -c "node:18" src/skills/docker/SKILL.md` -> /^0$/
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 2 — Ask the authorities, carry nothing

- [x] **2.1 Source adapters in a fixed precedence**, each reporting `ok |
      unavailable | error`: native audit → cross-ecosystem batch query for public
      packages → runtime release and lifecycle adapters → malware records.
      Hosts on a fixed allowlist; no URL is built from fetched content.
      verify: an adapter test with each transport outcome yields the matching
      status and never `ok` on a timeout.
      *Changed by the council round of 2026-10-21 (D7): no authenticated GitHub access in v1; platform alerts stay a later adapter. A native audit runs only for a lockfile that names no private package.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.2 Closed verdict vocabulary**: `affected`, `fix-available`,
      `fix-fresh` (fixed version younger than the cooldown), `no-fix`,
      `malware`, `eol`, `eol-soon`, `pre-announced`, `unknown`, `accepted`.
      `pre-announced` carries no fixed version by construction (F2).
      verify: F2 yields `pre-announced` with `fixed_version: null`; F6 yields
      `unknown`, never an empty list.
      *`fix-fresh` is in the vocabulary and is assigned by the fix path's cooldown check (`road-to-security-fixes-carried-to-the-merge` 1.3); no v1 source carries a release date for the fixing version.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.3 Sanitising cache boundary** copied from `update_check.ts`: IDs,
      versions, enums and numbers only; no advisory prose; links rebuilt from
      IDs.
      verify: a fixture advisory whose summary carries an instruction string
      produces a cache file in which that string does not occur.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.4 Dedupe by alias, join platform state**: CVE / GHSA / OSV aliases
      merge into one finding; an open platform alert or bot PR is named on the
      finding, never duplicated.
      verify: a fixture with one CVE under three aliases and an open bot PR
      yields one finding naming the PR.
      *The alias merge is done here. Joining an open bot PR moved to `road-to-security-fixes-carried-to-the-merge` 2.1 (G7), where the session reads it through the user's own `gh` — the council kept authenticated GitHub out of the refresh (D7).*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **2.5 Vendor backports and corrections**: a distro-patched version is
      not escalated on its upstream number (F8); a corrected advisory
      re-evaluates and records the transition (F9).
      verify: F8 yields no `affected`; F9 yields one recorded transition.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 3 — Say it in proportion

- [x] **3.1 Deterministic tiers T0–T3.** T0 interrupt: `malware`, known-
      exploited (KEV) in a runtime scope, `pre-announced` critical runtime,
      CVSS ≥ 9.0 runtime-direct with a fix. T1 today. T2 digest. T3 ledger.
      EPSS and KEV raise a tier; neither lowers one.
      *Changed by the council round of 2026-10-21 (D9): KEV raises a tier and is read; EPSS is withdrawn, not deferred.*
      verify: a tier table test over the F-corpus with the expected tier per
      fixture.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.2 Delta ledger**: only new findings and escalations are announced.
      verify: running twice over F1 announces once.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.3 Accept with reason and expiry**; a grep-negative is never a reason.
      verify: an acceptance without an expiry is refused by the writer.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **3.4 Non-security "outdated" stays in the weekly digest.**
      verify: a minor-release fixture never reaches T0–T1.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 4 — Check daily, speak at the session, never block the start

- [x] **4.1 Refresh off the critical path**: detached, budgeted, outside the
      hook bundle; daily; one refresh per machine per window however many
      sessions start (F10). `session_start` reads files only.
      verify: F10 issues one refresh; a test asserts zero sockets in the hook
      process.
      *Changed by the council round of 2026-10-21 (D8): the refresh runs from the CLI (`agent-config audit:deps refresh`) and the opt-in CI schedule, never from a session start; a session start reads the cache, and a cache older than 24 h makes the notice say so. F10 holds through the refresh window and a machine-wide lock.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.2 One read-only notice, declared**, riding the existing
      `session_start` block in the same council round as the update notice
      (D1). Each T0/T1 line ends in the offer "fix now — here / in a separate
      worktree / later", whose routing is owned by
      `road-to-security-fixes-carried-to-the-merge`.
      verify: the notice is registered under the verdict that resolves
      `concerns-refused-as-authority-expansion`, and its fixture prints the
      offer line.
      *Ratified by the council round 2 of 2026-10-21 (2/2) as a declared authority expansion, ADR-296; every printed field passes a single-line grammar, and the notice module reaches no network code.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.3 Settings with disclosed egress**: `advisories.mode: notify | off`
      and `advisories.egress: query | none`, each disclosed in plain words in
      the template. New installs `notify`; existing installs asked once.
      verify: an install with no `advisories` block behaves as today until
      asked, asserted in a test.
      *An existing install changes nothing until a refresh runs in that project, because the notice needs a cache.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.4 Silence is reported**: three days of `unknown` on any source is
      itself a notice line.
      verify: F6 produces the silence line on day 3.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **4.5 Hosts without a session slot** keep the CLI banner path.
      verify: a host fixture with no `session_start` binding prints the
      banner after a CLI subcommand.
      *`check_update_banner` prints the same notice after a CLI subcommand; the once-a-day stamp keeps a host with both surfaces from seeing it twice.*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
## Phase 5 — Native first, a visible command, more projects

- [x] **5.1 `/audit deps`** under the approved `audit` verb (C5): inventory,
      findings by tier, the evidence per finding, and source health.
      verify: the command file exists under `src/domains/` with `visibility:
      advanced` and `./scripts-run src/scripts/lint_command_verbs` passes.
      *One command under the approved verb, `deps` its argument — a sub-command `deps` would be a new verb under ADR-041. Shipped `advanced`, not `visible` as first written: the session notice and `/audit deps fix` are how a user meets it, and a new visible command joins the consumer's top-level menu, which this change has no reason to grow (corrected 2026-10-21 by an R2 review finding).*
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **5.2 Gap report over what the project already runs**: platform alerts
      on, security updates ungrouped, a cooldown configured, Composer
      `config.policy`, frozen-lockfile CI, a CI audit step
      (`grade_target_readiness.ts:431`). Offer the config; never write it
      unasked.
      verify: a fixture with Dependabot grouping security updates yields one
      gap line naming the key.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **5.3 Out-of-band runner, opt-in**: a CI-schedule template that runs
      Phases 1–3 on days without a session and opens an issue for T0. Never a
      daemon, never a merge.
      verify: the template file exists and a dry-run over F2 writes the issue
      body to stdout.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [x] **5.4 Many projects, one machine**: a user-global index of recently used
      project roots, roots and hashes only, behind `advisories.mode != off`.
      verify: two fixture projects sharing a vulnerable package yield one
      fetch and two findings.
      <!-- receipt: class=R3 · shadow · would-skip=none · bound=override-list path: src/config/agent-settings.template.yml -->
- [~] **5.5 Publish measured TTN** after 30 days on the 0.1 bar; flip the claim
      only on that bar.
      verify: the claim row's status matches the committed measurement.
      <!-- deferred-resolution: carried-to=road-to-advisory-latency-measured -->
      *Carried 2026-10-21 to `later/road-to-advisory-latency-measured`, created in the same change: the step waits only for 30 days of data, which no run can shorten. Route: council-decidable carry (roadmap-progress-sync § preservation test); the criterion is preserved there as 1.1 and 1.3.*
## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | reversible-technical | agent | Own roadmap; the session notice joins the open council round on `session_start` concerns instead of opening a second | C2: one round settles both notices on the same terms | that round splits the two notices |
| D2 | reversible-technical | evidence | Extend `dependency-upgrade` and add `/audit deps`; no new skill, no new concern | C1: both allowances are 0 | an allowance is raised for an unrelated reason |
| D3 | critical-technical | evidence | No advisory database, mirror, or local SQL store; a JSON cache of IDs and enums | C6 and the bundle ceiling; the cache already exists in this shape | a measured TTN miss traces to fetch latency |
| D4 | critical-technical | evidence | Public package names only leave the machine; private names never | 1.3, F7 | never |
| D5 | reversible-technical | agent | First runtime adapters: PHP and Node | the two runtimes this package's own skills target; the source incident is PHP | a third runtime appears in the F-corpus |
| D6 | reversible-technical | agent | Scheduling is a daily stamp plus an opt-in CI schedule, never an OS daemon | a daemon contradicts the no-runtime install model; the stamp already exists | a measured TTN P90 miss on projects without daily sessions |
| D7 | critical-technical | council:agents/evidence/council/advisories-worktree-run-design-20261021.md | v1 sources: native audits (only where no private package is in the lockfile), OSV for public packages, endoflife.date, the PHP and Node release feeds; no authenticated GitHub access | council 2026-10-21 Q4, 2/2; one seat conditioned it on stating what a native audit transmits, which is why a lockfile naming a private package skips it | an adapter for platform alerts is proposed with its own privacy statement |
| D8 | critical-technical | council:agents/evidence/council/advisories-worktree-run-design-20261021.md | Refresh from the CLI and the opt-in CI schedule only; a session start reads the cache; the notice is a declared, read-only authority expansion (ADR-296) | council 2026-10-21 Q3 (2/2) and round 2 (2/2, ratified with conditions) | the notice is found to carry fetched text, or a session start is measured past its baseline because of it |
| D9 | critical-technical | council:agents/evidence/council/advisory-kev-epss-sources-20261021.md | KEV is read (the CISA catalog, downloaded whole and matched locally, behind `advisories.kev`); EPSS is not — 3.1's "EPSS raises a tier" is withdrawn | council 2026-10-21 round 3, 2/2: a project's CVE set is its vulnerability profile and needs its own opt-in; a predicted score in T0 would make T0 mean two things | an EPSS proposal arrives with its own opt-in key, display-only first, and a backtest that names the acceptable false-escalation rate |

## What this roadmap deliberately does not do

- It does not build fixes, branches or PRs; that is
  `road-to-security-fixes-carried-to-the-merge`.
- It does not scan OS packages or image layers; an image appears only through
  its `FROM` tag and the runtime it pins.
- It does not add notification channels outside the session and the CLI.
- It does not put advisory prose into model context.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-21 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Alert fatigue drowns the one notice that matters | product | Many findings, few exploited. | Tiers, delta ledger and the 0.3 budget. | Phase 3 — Say it in proportion |
| 2 | An unreachable source reads as calm | product | A timeout looks like zero findings. | `unknown` is a verdict (2.2) and three days of it is a notice (4.4). | Phase 2 — Ask the authorities, carry nothing |
| 3 | A private package name leaks in a query | implementation | Batch queries carry names. | 1.3 excludes them before any request; F7 asserts it. | Phase 1 — Know what the project actually runs |
| 4 | The refresh slows session start | implementation | Network on the start path. | 4.1 runs detached; the hook reads a file. | Phase 4 — Check daily, speak at the session, never block the start |
| 5 | The council round slips | product | 4.2 waits on it. | Every other phase ships without it; the CLI command (5.1) carries the findings meanwhile. | Phase 5 — Native first, a visible command, more projects |

## Acceptance Criteria

- [x] **AC-1** F2 on a fixture declaring PHP 8.3 in a Dockerfile yields a T0
      `pre-announced` finding with no fixed version, and after the release
      fixture a `fix-available` one.
- [x] **AC-2** F1 yields one finding on the day of publication with the
      evidence of its source.
- [x] **AC-3** F4 yields `malware` without a CVE; F6 never yields "no
      findings"; F7 sends no private name; F10 issues one refresh.
- [x] **AC-4** `session_start` latency stays inside the baseline recorded in
      the sibling roadmap, with zero sockets in the hook process.
      *Measured 2026-10-21 on a freshly built bundle: `session_start` p95 126 ms, n=50 (`bench_hook_latency`); the notice reads one file. The worktree pass on the same slot runs only on the first session of a day: classification under a three-second deadline, the retro's own terms, and under `auto` up to three removals after it with their own timeouts (ADR-295).*
- [ ] **AC-5** `task ci` green.

## Provenance

Source-derived under template rule 19; the source is not named here per
`source-confidentiality`; links are `ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| Inventory incl. runtimes, images, toolchain | KEEP | A5. |
| Pre-announcement as its own verdict | KEEP | The source incident; F2. |
| Tiers, delta, noise budget | KEEP | The owner's "je nach Wichtigkeit". |
| Never report "secure"; source health visible | KEEP | 2.2, 4.4. |
| Vendor backports, corrected advisories | KEEP | 2.5. |
| One fetch for five sessions | KEEP | 4.1, F10. |
| Hourly polling of critical feeds | CHANGED | Daily plus opt-in CI schedule (D6); 0.1 measures whether that misses. |
| A separate `security` CLI namespace | CHANGED | `/audit deps` under the approved verb (C5). |
| SQLite state, leases, WAL | CUT | D3; a JSON cache and the day stamp carry the volume. |
| OS-package and image-layer scanning, IaC, managed-runtime facts | CUT | Out of this file's scope; an optional scanner adapter is a later roadmap once 0.1 has a measurement. |
| Slack / email / issue-tracker channels, GUI view | CUT | No measured need before TTN exists. |
| A remediation engine | MOVED | `road-to-security-fixes-carried-to-the-merge`. |

## Notes — how this file was derived

Three extraction passes over the transcript and three plans; pass 2 added the
backport, corrected-advisory and five-session items from the external plan,
pass 3 checked each KEEP row against a phase step. The supplied v4 plan was
split: detection and notice here, remediation in its own file, so each stays
under the lightweight caps and each can land without the other.
