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

- [ ] S0.1 — **Confirm both bugs red on a clean machine.** Fresh box, no
      rtk: run the extended wizard, follow the Linux install command
      verbatim, record the failure. Then put a stub binary named `rtk` on
      PATH and confirm AC reports it installed. Both must reproduce before
      the fixes land, so the regression tests go red→green from reality.
      <!-- was-verify: cargo install --git https://github.com/event4u-app/rtk fails; stub rtk on PATH → rtk_installed true -->
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
- [ ] S0.3 — **Never `cargo install rtk`.** Research confirmed the
      crates.io crate `rtk` IS the colliding Rust Type Kit
      (reachingforthejack/rtk). Grep AC's copy/wizard/skills to ensure no
      surface ever emits `cargo install rtk` (only `--git` form is safe);
      add a regression test/lint if any templated command builder exists.

## Phase 1 — Fix the two bugs (small diff, high value)

- [ ] Replace the repo constant with the real upstream in **both** sites
      (`wizard.ts:721`, `settings.ts:100`), and state that rtk is a
      **third-party Apache-2.0 tool** — the current URL implies event4u
      ownership, which is a provenance error as much as a broken link.
- [ ] Per-OS install commands from verified upstream paths:
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
- [ ] **Two-stage detection:** `isBinaryOnPath('rtk')` **and** an identity
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
- [ ] `unknown-rtk` gets its own UI message naming the collision and
      linking upstream's guidance; `unverified` gets "rtk found but the
      identity check failed — verify manually with `rtk gain`". Silently
      treating either as "not installed" would be a second wrong answer.
- [ ] **Gate `rtk_wrap` on `identity === 'token-killer'`**, not presence —
      what the setting's description already promises. `unverified` does
      **not** activate the wrap.
- [ ] `win32` fallback UX when S0.2 finds no clean path: an explicit "no
      packaged Windows install yet" message with the upstream releases
      URL — never a command that fails.
- [ ] Regression tests for both bugs, from S0.1's red states.
      <!-- was-verify: test suite covers dead-URL replacement + stub-rtk tri-state -->

Exit: a Linux user following the wizard installs rtk successfully; a user
with Rust Type Kit on PATH is told exactly what is wrong.

## Phase 2 — Make the recommendation earn its place

- [ ] Decide the wizard gating: today the rtk step is `extended`-only
      (`wizard.ts:713-715`), so most users never see the recommendation —
      a strange place for a feature framed as a headline token saving.
      Move it, or keep the gate and record why.
- [ ] **Attribute the savings claim everywhere.** Every user-facing
      "60–90%" becomes "upstream reports 60–90% (their estimate)" until AC
      has its own number — includes `src/skills/rtk-output-filtering/
      SKILL.md:4,26` and `src/skills/token-optimizer/SKILL.md:53`, plus
      any settings/wizard copy.
- [ ] *(Optional, spend-gated)* Measure it: AC's own bench on a fixed
      command corpus, wrapped vs. unwrapped, publish the delta **including
      a null**. Only then may the number appear in AC's own voice.

## Phase 3 — Expose detection as a contract AS can consume

- [ ] Promote rtk detection from a wizard-only endpoint to a stable
      readout available to `agent-config doctor` and the CLI in JSON form,
      with the tri-state shape from Phase 1.
- [ ] Document it as a versioned contract under `docs/contracts/` so AS's
      Tooling section reads AC's verdict **when agent-config is
      installed** — one primary implementation, one place to fix when
      upstream changes. (AS keeps a documented fallback probe with the
      same tri-state semantics for machines without agent-config; the
      contract file defines those semantics so the two cannot drift.)

Exit: on any machine where both are installed, AS and AC never disagree
about whether rtk is installed.

## Acceptance criteria (pre-registered)

- [ ] **No user-facing URL in AC points at a non-resolving repository.**
- [ ] **Every emitted install command has been executed successfully** on
      its target OS, or is replaced by an explicit "no clean path" message.
- [ ] **A binary named `rtk` that is not Rust Token Killer is never
      reported as installed**, and `rtk_wrap` never activates for it.
- [ ] **rtk is identified as a third-party Apache-2.0 tool** wherever it
      is recommended.
- [ ] **No savings figure is stated in AC's own voice** without an AC
      measurement behind it.
- [ ] **Honest-null path:** if S0.2 finds no clean Windows install, AC
      says "not available on Windows yet" — it does not emit a command
      that fails.

## Blockers

### blocker: rtk-benchmark-spend
- **Status:** open
- **Owner:** user
- **Blocks:** Phase 2's optional own-measurement of the savings claim
- **What to do:** a corpus run costs time and tokens; the attribution fix (one line per site) is unblocked and lands regardless.
- **Resolved when:** the maintainer authorizes the run with an estimate, or accepts attribution-only permanently.

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
