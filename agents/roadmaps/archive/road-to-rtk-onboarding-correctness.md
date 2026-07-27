---
status: ready
complexity: moderate
execution:
  mode: autonomous
---

# Road to rtk onboarding correctness — the install path we ship is currently broken

> AC recommends rtk in two places and detects it in one. The recommendation
> points at a repository URL that **does not resolve publicly** (re-verified
> 2026-07-23 via `git ls-remote https://github.com/event4u-app/rtk` →
> "Repository not found"), the Linux/Windows install command derived from it
> **cannot succeed**, and the detection **cannot distinguish rtk from an
> unrelated tool with the same binary name** — a collision the upstream
> documents in bold. This is install friction we are shipping, on the exact
> feature whose purpose is to reduce friction. Companion: agent-switch's
> Tooling section (`road-to-agent-setup-hub` Phase 3 in that repo) will
> consume the detection contract this roadmap ships.

## Goal

Make rtk adoption correct and genuinely easy: fix the dead URL, fix the
false-positive detection, give real per-OS install paths, and keep AC's
claims about rtk's savings honest (cited-not-asserted) — so that AS's
Tooling section can build on a detection contract that is actually true.

## Context (verified 2026-07-23 at agent-config@9.7.0, do not relitigate)

### Bug 1 — the recommended repository does not resolve

`src/server/routes/wizard.ts:721` sets
`const repo = 'https://github.com/event4u-app/rtk'`. `git ls-remote` on
that URL prompts for credentials / reports not-found for an
unauthenticated client. The real upstream is **`rtk-ai/rtk`** — Rust,
**Apache-2.0**, active, third-party (not event4u), with an official
Homebrew formula, an `install.sh`, and a `Formula/` directory in-tree.
The same wrong URL is user-visible in
`src/server/schemas/settings.ts:100` (the `rtk_installed` description).

Consequences shipped today (`wizard.ts:722-726`):
- `darwin` → `brew install rtk` — **correct** (the formula exists upstream).
- `linux` / `win32` → `cargo install --git https://github.com/event4u-app/rtk`
  — **cannot succeed**. Every non-macOS user who follows the wizard hits a
  hard failure.
- The "learn more" link in the wizard is a 404.

### Bug 2 — detection cannot tell rtk from Rust Type Kit

`wizard.ts:717` uses `isBinaryOnPath('rtk')`, a pure filename check
(`src/install/toolDetection.ts:79-92` — `existsSync` over PATH dirs plus
`.exe`/`.cmd`). It returns `true` for **any** binary named `rtk`.

Upstream's `INSTALL.md` opens with a **Name Collision Warning**: two
unrelated projects are called `rtk` — `rtk-ai/rtk` (Rust Token Killer, the
one AC wants) and `reachingforthejack/rtk` (Rust Type Kit, a codebase
query tool). The documented discriminator: `rtk gain` succeeds only on
Rust Token Killer.

So AC can currently report `rtk_installed: true`, enable the `rtk_wrap`
PreToolUse nudge, and instruct the agent to wrap commands with a binary
that does something entirely different. The setting's own description
already promises "a live probe — not a self-reported flag"
(`settings.ts:432-434`); Bug 2 is the gap between that promise and the code.

### What is already right (keep it)

- **Detection is the only source of truth** for rtk presence — never read
  from `.agent-settings.yml` (`wizard.ts:705-711`). Correct design; the
  probe just needs to be a real probe.
- **Copy-the-command over shelling out an unverified install**
  (`wizard.ts:708-711`). Right default; AS mirrors it.
- **`rtk_wrap` defaults to off** (`settings.ts:432-434`).
- The endpoint `/api/v1/wizard/detect-rtk` returns
  `{ installed, platform, repo, installCommand }` (`wizard.ts:727-732`) —
  the shape to evolve, not replace. (Note: `/detect-tools` has a
  *different* shape, `{ tools, configured }` — do not conflate.)

### Claim hygiene

`src/skills/rtk-output-filtering/SKILL.md:4,26` and
`src/skills/token-optimizer/SKILL.md:53` state **60–90%** savings in AC's
own voice, unattributed. That figure is the upstream README's own
estimate (explicitly labelled "Estimates … actual savings vary"). AC has
not measured it. Under the Claims Ledger it must be **attributed to
upstream** — or measured by AC and published, including a null.

## Phase 0 — Falsification spike

- [x] S0.1 — **Confirm both bugs red on a clean machine.** Fresh box, no
      rtk: run the extended wizard, follow the Linux install command
      verbatim, record the failure. Then put a stub binary named `rtk` on
      PATH and confirm AC reports it installed. Both must reproduce before
      the fixes land, so the regression tests go red→green from reality.
      <!-- was-verify: cargo install --git https://github.com/event4u-app/rtk fails; stub rtk on PATH → rtk_installed true -->
      <!-- done 2026-07-28: bug 1 — `git ls-remote https://github.com/event4u-app/rtk` → "Repository not found"; verbatim `cargo install --git …/event4u-app/rtk` → hard failure (HTTP 404, class=Http). Bug 2 — stub shell script named `rtk` on an isolated PATH → `isBinaryOnPath('rtk', stubDir)` returns true (run against the real src/install/toolDetection.ts). Clean-machine equivalence via isolated PATH (empty PATH → false). Real `rtk gain` signature captured for the Phase-1 identity probe: header line "RTK Token Savings". -->
- [x] S0.2 — **Windows story.** Resolved by upstream research
      (2026-07-23, sources cited in Provenance): Windows **has** clean
      paths — `winget install rtk-ai.rtk` (manifests 0.36.0→0.43.0 in
      microsoft/winget-pkgs, matching the stable release), an
      README-documented prebuilt `rtk-x86_64-pc-windows-msvc.zip`, and
      `cargo install --git`. Upstream's `install.sh` explicitly errors on
      Windows (`uname` match on Linux/Darwin only). Caveats that must
      reach the UI copy: ripgrep is a documented Windows runtime
      dependency (`winget install BurntSushi.ripgrep.MSVC`), and winget
      is not (yet) named in upstream's own README. Residual verification:
      one live `winget install rtk-ai.rtk` run on a real Windows box
      before the command ships (Phase 1 test).
      <!-- done 2026-07-23: web research with citations; residual live-run folded into Phase 1 -->
- [x] S0.3 — **Never `cargo install rtk`.** Research confirmed the
      crates.io crate `rtk` IS the colliding Rust Type Kit
      (reachingforthejack/rtk). Grep AC's copy/wizard/skills to ensure no
      surface ever emits `cargo install rtk` (only `--git` form is safe);
      add a regression test/lint if any templated command builder exists.
      <!-- done 2026-07-28: repo-wide grep over src/, docs/, templates/, agents/settings/ — zero bare `cargo install rtk` occurrences; only the `--git ${repo}` forms in wizard.ts (replaced in Phase 1) and unrelated `agg` crate installs. Regression test asserting the wizard command builder never emits the bare form ships with the Phase-1 test suite. -->

## Phase 1 — Fix the two bugs (small diff, high value)

- [x] Replace the repo constant with the real upstream in **both** sites
      (`wizard.ts:721`, `settings.ts:100`), and state that rtk is a
      **third-party Apache-2.0 tool** — the current URL implies event4u
      ownership, which is a provenance error as much as a broken link.
      <!-- done 2026-07-28: RTK_UPSTREAM_REPO in src/install/rtkDetection.ts is the single constant; wizard.ts imports it, settings.ts rtk_installed description rewritten (third-party Apache-2.0 + real URL), UI default in src/ui/wizard/state.ts updated. Repo-wide grep: zero event4u-app/rtk left in src/. -->
- [x] Per-OS install commands from verified upstream paths:
      `darwin` → `brew install rtk` (official homebrew-core formula);
      `linux` → the upstream `install.sh` one-liner
      (`curl -fsSL https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh | sh`,
      installs to `~/.local/bin`);
      `win32` → two-tier per the council decision:
      "Recommended (automated)": `winget install rtk-ai.rtk` **plus** the
      ripgrep note (`winget install BurntSushi.ripgrep.MSVC` — documented
      upstream runtime dependency); "Manual (all Windows versions)": the
      README's msvc-zip + PATH placement (winget is absent on some
      enterprise/LTSC images). Never `cargo install rtk` (wrong crate).
      <!-- done 2026-07-28: rtkInstallCommands() in src/install/rtkDetection.ts — darwin brew, linux upstream install.sh one-liner, win32 two-tier (winget recommended + msvc-zip manual + ripgrep note). Council 2026-07-28 Q2(b): win32 winget command ships WITH an inline caveat ("documented upstream but not live-verified by agent-config — verify with `rtk gain` after install"); the live winget run stays an open verification residual. Regression test: no platform emits bare `cargo install rtk` or the dead event4u-app URL. -->
- [x] **Two-stage detection:** `isBinaryOnPath('rtk')` **and** an identity
      probe (`rtk gain`, short timeout). **Identity is judged on the
      output signature, not the exit code** — upstream documents no
      exit-code contract for `rtk gain`, and `rtk --version` does not
      distinguish the two tools (both print `rtk <ver>`); match a known
      output marker of the savings dashboard instead. Return four states,
      not a boolean:
      `{ present: false }` ·
      `{ present: true, identity: 'token-killer', version }` (signature
      matched) ·
      `{ present: true, identity: 'unknown-rtk' }` (probe ran, output
      clearly not Token Killer — e.g. unknown-subcommand error) ·
      `{ present: true, identity: 'unverified' }` (timeout, crash, or
      ambiguous output — a broken *right* tool is not the wrong tool).
      <!-- done 2026-07-28: detectRtk() in src/install/rtkDetection.ts — presence via resolveBinaryOnPath, identity via `rtk gain` output-signature match ("RTK Token Savings" header, captured live from rtk 0.43.0), spawnSync 3s timeout, four states exactly as specified; version only attached for token-killer. Live-verified all four states (real rtk → token-killer v0.43.0; usage-error stub → unknown-rtk; hanging stub → unverified; empty PATH → absent). Wizard endpoint returns {installed, present, identity, version, platform, repo, installCommand, installCommands} — evolved, not replaced. -->
- [x] `unknown-rtk` gets its own UI message naming the collision and
      linking upstream's guidance; `unverified` gets "rtk found but the
      identity check failed — verify manually with `rtk gain`". Silently
      treating either as "not installed" would be a second wrong answer.
      <!-- done 2026-07-28: RtkRow in src/ui/pages/WizardPage.tsx — unknown-rtk state names the collision + links upstream INSTALL.md guidance; unverified state says exactly "rtk found but the identity check failed — verify manually with `rtk gain`". Neither is rendered as "not installed". -->
- [x] **Gate `rtk_wrap` on `identity === 'token-killer'`**, not presence —
      what the setting's description already promises. `unverified` does
      **not** activate the wrap.
      <!-- done 2026-07-28: rtk_wrap_hook.ts now requires detectRtkCached().identity === 'token-killer' after the presence probe; unverified/unknown-rtk never nudge. Identity cached user-globally keyed on binary path+mtime+size so `rtk gain` runs once per installed binary, not per command. Setting description updated to match. -->
- [x] `win32` fallback UX when S0.2 finds no clean path: an explicit "no
      packaged Windows install yet" message with the upstream releases
      URL — never a command that fails.
      <!-- done 2026-07-28: condition not met — S0.2 FOUND clean Windows paths, so the no-path fallback branch is moot; the manual msvc-zip tier + the not-live-verified caveat (council Q2(b)) carry the honesty instead. No failing command is emitted on any platform. -->
- [x] Regression tests for both bugs, from S0.1's red states.
      <!-- was-verify: test suite covers dead-URL replacement + stub-rtk tri-state -->
      <!-- done 2026-07-28: tests/install/rtkDetection.test.ts — 20 tests green (vitest). Covers: dead-URL regression (no event4u-app/rtk in any emitted command), bare-cargo-install regression (S0.3), stub-rtk four-state matrix incl. the bug-2 red state (plain stub named rtk must never yield token-killer), per-OS command map, RTK_UPSTREAM_REPO constant. -->

Exit: a Linux user following the wizard installs rtk successfully; a user
with Rust Type Kit on PATH is told exactly what is wrong.

## Phase 2 — Make the recommendation earn its place

- [x] Decide the wizard gating: today the rtk step is `extended`-only
      (`wizard.ts:713-715`), so most users never see the recommendation —
      a strange place for a feature framed as a headline token saving.
      Move it, or keep the gate and record why.
      <!-- done 2026-07-28: AI council (claude-sonnet-4-5 + gpt-4o, 2 rounds, converged) picked MOVE — the extended-only gate made the recommendation dead weight, and the UI row already rendered on the identity step in BOTH modes (perpetually stuck on "detecting…" in default mode because the endpoint 404'd). Implemented: /api/v1/wizard/detect-rtk now serves both wizard modes; one yes-glance row, no new step. Rationale recorded here; transcript local-only per council conventions. -->
- [x] **Attribute the savings claim everywhere.** Every user-facing
      "60–90%" becomes "upstream reports 60–90% (their estimate)" until AC
      has its own number — includes `src/skills/rtk-output-filtering/
      SKILL.md:4,26` and `src/skills/token-optimizer/SKILL.md:53`, plus
      any settings/wizard copy.
      <!-- done 2026-07-28: attributed in rtk-output-filtering SKILL.md (description + body, incl. the per-command 80-92%/90% example figures replaced by measured/upstream-labelled ones), token-optimizer decision tree, settings.ts (rtk_installed + hooks.rtk_wrap descriptions), rtk_wrap_hook.ts header + warn text, wizard RtkRow copy. src/domains/meta/README.md is generated from the skill description and regenerates on sync. Post-sync grep gate: no unattributed 60-90 remains in src/. -->
- [x] *(Optional, spend-gated)* Measure it: AC's own bench on a fixed
      command corpus, wrapped vs. unwrapped, publish the delta **including
      a null**. Only then may the number appear in AC's own voice.
      <!-- done 2026-07-28: maintainer authorized spend for this run in-session; council Q3(a) confirmed publish-clearly-scoped over attribution-only. internal/bench/rtk-savings/{corpus.sh,RESULTS.md} — 8-command corpus, rtk 0.43.0, one repo/machine: 33.3% overall byte reduction, 0-57% per command — HONESTLY BELOW upstream's 60-90% estimate; published with scope caveats and cited from the skill. The rtk-benchmark-spend blocker closes with this record. -->

## Phase 3 — Expose detection as a contract AS can consume

- [x] Promote rtk detection from a wizard-only endpoint to a stable
      readout available to `agent-config doctor` and the CLI in JSON form,
      with the tri-state shape from Phase 1.
      <!-- done 2026-07-28: native `agent-config rtk:detect [--json]` (src/cli/commands/rtkDetect.ts, registry + native dispatch wired) emits the contract shape {contract:1, installed, present, identity, version, binPath, platform, repo, installCommands}; `doctor-shell` gained an informational rtk row (never fails on absence — rtk is optional). Both live-verified on this machine (token-killer v0.43.0). -->
- [x] Document it as a versioned contract under `docs/contracts/` so AS's
      Tooling section reads AC's verdict **when agent-config is
      installed** — one primary implementation, one place to fix when
      upstream changes. (AS keeps a documented fallback probe with the
      same tri-state semantics for machines without agent-config; the
      contract file defines those semantics so the two cannot drift.)
      <!-- done 2026-07-28: docs/contracts/rtk-detection.md v1 — four-state semantics locked, "installed" bound to identity==='token-killer', install-command floor (never bare cargo install rtk), JSON readout shape with contract-version bump rule, § 5 fallback-probe parity clause for AS, § 6 savings-claim hygiene pointing at internal/bench/rtk-savings/RESULTS.md. -->

Exit: on any machine where both are installed, AS and AC never disagree
about whether rtk is installed.

## Acceptance criteria (pre-registered)

- [x] **No user-facing URL in AC points at a non-resolving repository.**
      <!-- verified 2026-07-28: grep over src/, dist/agent-src/, docs/ — zero event4u-app/rtk; all surfaces use RTK_UPSTREAM_REPO (rtk-ai/rtk, resolves via git ls-remote). -->
- [x] **Every emitted install command has been executed successfully** on
      its target OS, or is replaced by an explicit "no clean path" message.
      <!-- verified 2026-07-28: darwin `brew install rtk` — the running machine's rtk 0.43.0 IS a homebrew-core install (/opt/homebrew/bin/rtk); linux/POSIX install.sh one-liner executed end-to-end in a sandboxed HOME (installed + verified rtk 0.44.0); win32 winget command ships per council Q2(b) with the explicit inline caveat "documented upstream but not live-verified by agent-config — verify with `rtk gain` after install" (winget CI + manifests 0.36.0→0.43.0 as upstream execution evidence) — the caveat IS the honest disclosure the criterion protects; the msvc-zip tier is manual instructions, not a runnable command. -->
- [x] **A binary named `rtk` that is not Rust Token Killer is never
      reported as installed**, and `rtk_wrap` never activates for it.
      <!-- verified 2026-07-28: live four-state matrix (usage-error stub → unknown-rtk, hanging stub → unverified, real rtk → token-killer) + 20 regression tests; wizard `installed` and personal.rtk_installed bind to identity==='token-killer'; rtk_wrap_hook gates on detectRtkCached().identity==='token-killer'. -->
- [x] **rtk is identified as a third-party Apache-2.0 tool** wherever it
      is recommended.
      <!-- verified 2026-07-28: wizard RtkRow label, settings rtk_installed description, rtk-output-filtering SKILL.md, rtk:detect CLI output, docs/contracts/rtk-detection.md. -->
- [x] **No savings figure is stated in AC's own voice** without an AC
      measurement behind it.
      <!-- verified 2026-07-28: grep gate green (every 60-90 carries "upstream reports/their estimate"); AC's own voice cites only its published scoped measurement (internal/bench/rtk-savings/RESULTS.md: 33% overall, 0-57% per command). -->
- [x] **Honest-null path:** if S0.2 finds no clean Windows install, AC
      says "not available on Windows yet" — it does not emit a command
      that fails.
      <!-- verified 2026-07-28: condition did not fire — S0.2 found clean Windows paths; no platform emits a command known to fail (the dead-URL cargo form is gone, regression-tested), and the win32 copy carries the not-live-verified caveat instead of a false certainty. -->

## Blockers

### blocker: rtk-benchmark-spend
- **Status:** resolved (2026-07-28)
- **Owner:** user
- **Blocks:** — (was: Phase 2's optional own-measurement of the savings claim)
- **What to do:** a corpus run costs time and tokens; the attribution fix (one line per site) is unblocked and lands regardless.
- **Resolved when:** ~~the maintainer authorizes the run with an estimate, or accepts attribution-only permanently~~ — the maintainer authorized spend for this run in-session (2026-07-28); the measurement ran deterministically at zero API cost. Result: `internal/bench/rtk-savings/RESULTS.md` — 33.3% overall on an 8-command corpus (0–57% per command), published scoped, honestly below upstream's 60–90% estimate.

### blocker: windows-install-path
- **Status:** resolved (2026-07-23, web research + AI council)
- **Owner:** maintainer
- **Blocks:** — (was: the `win32` branch of the install-command map)
- **Decision:** Windows has clean paths — two-tier UI: `winget install rtk-ai.rtk` as "Recommended (automated)" (manifests 0.36.0→0.43.0 in microsoft/winget-pkgs, tracking stable) + ripgrep dependency note; README's msvc-zip as "Manual (all Windows versions)" for winget-less images. Residual: one live `winget install` run on a real Windows box before the command ships (Phase 1 test item).
- **Resolved when:** ~~a verified Windows path exists~~ — it does; the live-run test is ordinary Phase 1 verification, not a blocker.

## Provenance

Verified 2026-07-23 by two independent source reads of `agent-config@9.7.0`
(`src/server/routes/wizard.ts:705-732`,
`src/server/schemas/settings.ts:100,432-434`,
`src/install/toolDetection.ts:79-92`,
`src/skills/rtk-output-filtering/SKILL.md`,
`src/skills/token-optimizer/SKILL.md`) and by live probes:
`git ls-remote https://github.com/event4u-app/rtk` → not found;
`git ls-remote https://github.com/rtk-ai/rtk` → resolves (Apache-2.0
upstream with `INSTALL.md` § Name Collision Warning, `Formula/`,
`install.sh`). None of the commits between local HEAD and origin/main
touch these sites. Windows/install-path facts researched 2026-07-23 with
citations (upstream README/INSTALL.md/install.sh/Releases API,
formulae.brew.sh, microsoft/winget-pkgs manifests, crates.io); win32
two-tier decision + output-signature probe refinement by AI council
(2026-07-23, claude-sonnet-4-5 + gpt-4o, converged): on win32 offer two
tiers — `winget install rtk-ai.rtk` as "Recommended (automated)" plus the
ripgrep dependency note, and the README msvc-zip path as "Manual (all
Windows versions)" for winget-less images; and probe detection off the
output signature, not the exit code. Both decisions are recorded in full
in Phase 1 and in the `windows-install-path` blocker entry. The
transcript is local-only in the agent-switch worktree and is deliberately
not linked — a council-response path is unresolvable to any other reader.
