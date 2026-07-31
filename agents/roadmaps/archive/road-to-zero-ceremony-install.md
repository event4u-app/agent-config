---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
related_roadmaps: [road-to-zero-ceremony-detection]
related_adrs: [ADR-033, ADR-036, ADR-133, ADR-200, ADR-201]
related_contracts: [gui-wizard]
---

# Road to zero-ceremony install — make the install claim true before making it shorter

> The quickstart promises five minutes, documents its own npm failure mode
> inline, and advertises a flag that does not exist. Close the gap between what
> the install says and what it does, budget the payload that dominates the
> wall-clock, and only then reduce the number of doors.

## Goal

Every statement the install surfaces makes is true of the code that runs, the
npm payload is bounded by a pre-registered budget enforced in CI, and door
retirement happens only after the failure mode that door exists to absorb is
demonstrably covered elsewhere.

## Prerequisites

- [x] Host detection exists for 23 hosts and already pre-selects on first run.
- [x] The wizard's "Recommended" path already runs detection-driven with zero
      user *decisions* — two confirmations, no choices.
- [x] A non-interactive install path already exists and is unit-tested
      (skipped GUI on CI, non-TTY, headless, or any of a dozen flags).
- [x] `setup.sh` is CI-smoked across 3 OS × 2 Node versions.

## Context

Source: an external planning set, audited against the tree on 2026-07-31.
Corrections and refusals: [`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

What the audit changed about this roadmap's shape:

- **The doors are not equivalent.** The draft's verdict was "same Node ≥20
  requirement, zero unique capability". False: the curl door fetches a GitHub
  tarball and runs a dependency-inlined bundle via plain `node`, bypassing npm
  dependency resolution entirely — which is precisely the failure the
  quickstart's own `ETARGET` block documents. The npx door goes through the
  registry and can hit that failure. So the curl door is a **rescue path**, and
  retiring it before the npm path is safe re-breaks exactly the users who need
  it. The council converged on this coupling independently.
- **Its stated rationale has nonetheless rotted.** The installation docs still
  headline the curl door as "no Node required" while the script now requires
  `node`. The differentiator it was documented for is gone even though a real
  one remains. Both facts have to appear in the same breath or the decision gets
  made on a false premise in either direction.
- **"Zero prompts" is already true of the terminal.** An accepted ADR already
  makes the interactive global install zero-terminal-interaction — it hands off
  to the browser instead. The prompts the draft wants to remove are in the
  browser, not the shell. The honest goal is therefore "no browser handoff on
  the default path", which is a different and larger claim.
- **That flip touches a tier-1 rule.** The onboarding gate rule names the
  browser wizard the *sole* onboarding surface and is hook-enforced. Inverting
  the default is a kernel-rule edit under the slow-rollout gate, not a flag
  change — so it lands here as a blocker with the path named, not as a step.
- **`--gui` does not exist.** The README documents it anyway. Doc↔code
  convergence is mandatory regardless of which way the default goes.
- **No `npm pack` size gate exists** anywhere in CI. The payload budget is
  genuinely new work with no conflict.

### Gap audit against the source draft

| Draft item | Verdict | Why |
|---|---|---|
| README quickstart honesty (drop "Five minutes", move `ETARGET` out) | **KEEP, resequenced** | The block may only leave the quickstart once the failure it documents is covered |
| Fix stale installation docs ("no Node required") | **KEEP, new** | Not in the draft; found by audit; a false premise for the door decision |
| `--gui` flag: implement, and converge docs with code | **KEEP** | The flag is documented and absent — a defect either way |
| Retire `setup.sh` | **KEEP, gated** | No ADR conflict, but a declared public-URL contract with 6-leg CI, and a real rescue path — gated on npm-path coverage |
| Zero-prompt (no browser handoff) as the default | **CUT → blocker** | Conflicts with an accepted ADR and a hook-enforced tier-1 rule; needs a kernel-rule edit under slow rollout |
| Payload budget + `npm pack` size gate | **KEEP** | Nothing enforces size today |
| Bulk-asset diet for the largest skill data dir | **KEEP** | 864 KB of an 8.9 MB payload, measured |
| Merge "Pipeline A/B" into one emitter | **CUT → reduce** | The draft's labels are not this repo's (the repo's Pipeline B is projection→`.augment/`, not the consumer installer); the rule-layer drift it targets is already prevented by a shared predicate; and collapsing `dist/agent-src/` was decided against on scope-discipline grounds. What remains is a narrow audit, below |
| Profile/pack questions deferred to point of need | **CUT** | Already true: packs prefill from the manifest and the Recommended path asks no questions |
| Cold-start wall-clock published as evidence | **KEEP** | Honest structural metric; never a guaranteed number |

## Phase 1 — Make every install statement true

Pure doc↔code convergence. Each item is a defect today.

- [x] Remove "Five minutes" from the quickstart self-description; state what is
      structurally guaranteed instead (one command, detection-driven, nothing
      written before confirmation).
- [x] Correct the installation docs' "no Node required" headline for the curl
      door — the script requires `node` today. Also corrected: three surfaces
      claimed a Python ≥ 3.10 requirement that ADR-200 removed.
- [x] Correct the installation docs' description of the retired installer
      scripts (they still describe entry points a prior ADR removed).
- [x] Implement `--gui` as an explicit opt-in flag that forces the wizard, and
      make the README's description of it true. This is additive and does not
      change any default.
      <!-- verify: npx vitest run tests/cli/init-gui-routing.test.ts -->
- [x] Document the real opt-out set in one place (the non-interactive path
      already skips the GUI on CI, non-TTY, headless, and a dozen flags) — today
      a reader has to infer it from code.
      <!-- verify: npx vitest run tests/cli/init-gui-routing.test.ts -->

**What the audit changed here.** Two findings landed that the phase did not
anticipate, both recorded rather than swept:

- The opt-out set could not be written down as *one* list, because there are
  **two gates that disagree** — `shouldInitLaunchGui` (the `init` front door)
  and `_wizard_should_launch` (the installer's tail-launch). The canonical
  section documents both and names the divergence; changing behaviour to
  reconcile them is not doc↔code convergence and is out of this phase.
- The stale-path rot is wider than the install surface: **~102 non-archive
  `.md` references to the retired `install.py`** and **~120 root-prefixed
  `scripts/…` paths** exist repo-wide. This phase fixed the install-facing
  surfaces (README, `docs/installation.md`, `docs/troubleshooting.md`,
  `docs/getting-started.md`, `docs/wizard.md`, `docs/development.md`,
  `docs/contracts/gui-wizard.md`, the two site pages). The remainder is in
  contract and architecture pages that no installing user reads; it is a
  separate sweep, measured here so it is not mistaken for done.

**`--gui` semantics — decided by AI council 2026-07-31** (2 members, 2 rounds,
$0.09; both converged in round 2). `--gui` overrides the *capability* probes
(TTY, headless) and yields to the *intent* guards (`CI`,
`AGENT_CONFIG_NO_UI`, CLI-mode flags); a losing `--gui` is a hard error, never
a silent CLI install; `--gui` does **not** imply `--allow-headless` (refusing
with an actionable error beats booting a server no browser can reach); the
flag is scoped to the `init` front-end and is **not** threaded through the
other two gates (when `--gui` wins they are unreachable, and when it loses the
run has already errored); and it is stripped from argv before any bash
delegation, since the installer's argument loop rejects unknown flags.

**Exit criteria:** no install-surface sentence contradicts the code path it
describes; `--gui` exists and does what the README says; the opt-out set is
documented in one place.
**Rollback:** text-only reverts plus dropping one flag.

## Phase 2 — Cover the npm failure mode the rescue door absorbs

The `ETARGET` block is evidence, not clutter. It leaves the quickstart when the
failure stops happening — not before.

- [x] Reproduce the documented failure deterministically: a consumer project
      with `.npmrc` `prefer-offline=true` and an unsatisfiable floor, asserting
      the `ETARGET` / `No matching version found` error. The live-registry leg
      is opt-in (`AGENT_CONFIG_NET_TESTS=1`) so the default suite stays
      hermetic; the unreachability assertions always run.
      <!-- verify: npx vitest run tests/install/npm_resolution.test.ts -->
- [x] **Premise corrected — the fix is prevention, not recovery.** The step as
      written ("detect the resolution failure and retry") is not implementable:
      npm resolves `dependencies` on the consumer's machine **before** our
      `bin` is executed, so when resolution fails npx aborts and no code of
      ours ever runs. There is no process in which to detect, retry, or print
      a remedy. What ships instead makes the failure unreachable:
      `src/scripts/check_dependency_floors` gates every runtime floor to a
      settled minor (`^X.Y.0`), with exact ABI pins and **security floors**
      allowed only as named exceptions. CONTRIBUTING already stated the rule in
      prose; this is its teeth. Wired into `task ci` / `ci-strict` and the
      always-on Consistency workflow.

      **The gate's first "finding" was a false positive, and a dangerous one.**
      It flagged `@fastify/static@^10.1.2` as an unsettled floor and asked for
      `^10.1.0`. That floor is a **CVE control**: everything `<= 10.1.1` carries
      a high-severity route-guard bypass via path traversal (CVSS 7.5), fixed in
      10.1.2 — confirmed by running `npm audit` against a clean 10.1.0 install,
      not inferred from a changelog. Lowering it would have traded a rare
      install failure for a live advisory. It was caught by
      `install_friction_guard`'s committed dependency baseline, which refused
      the change rather than letting it pass silently.

      The rule now models the exception class it was missing:
      `SECURITY_FLOOR_EXCEPTIONS` pins the required range together with its
      advisory, and the gate **enforces** that floor instead of asking for it to
      settle — including rejecting an attempt to raise it off the pinned range.
      Five dedicated cases exist so the regression cannot recur. The lesson
      generalizes past this package: a resolvability rule must never outrank a
      security floor.
      <!-- verify: npx vitest run tests/scripts/check_dependency_floors.test.ts -->
- [x] Only once that test is green: move the remaining `ETARGET` prose out of
      the quickstart into a troubleshooting page. (Also repaired there: the
      `Node.js is required` section carried orphaned Python-era fragments.)
- [x] Record what the curl door still uniquely provides after this phase — a
      registry-independent path — so the retirement decision in Phase 3 is made
      against the post-fix reality rather than today's. See below.

**What the curl door uniquely provides after this phase.** The gate removes the
cause we control (a floor a lagging mirror cannot satisfy). It does not remove
the causes we do not control: a registry mirror lagging by a whole minor, an
air-gapped or restricted network, a corrupted local cache, or an npm client
that cannot reach the registry at all. On every one of those, the npx door is
unusable and the curl door still works, because it fetches a GitHub tarball and
runs a dependency-inlined bundle — **zero npm dependency resolution**. That is
its remaining unique capability, and it is narrower but real. What is *not*
true of it any more: it is not "no Node required" (it runs `need_cmd node`).

**Exit criteria:** met. The reproduction asserts the `ETARGET` shape (live leg
verified locally); the manifest-side assertions prove the shipped floors cannot
produce it; the quickstart carries no recovery prose.
**Rollback:** drop the gate + restore the floor; restore the prose block.

## Phase 3 — Door consolidation, gated on Phase 2

- [x] Decide the curl door's disposition against the Phase-2 result, and record
      the decision with its reason. **Decision: RETAIN, demoted to a documented
      fallback.** Reasoning below.
- [-] If retired: keep the public URL alive as a stub that prints the npx
      one-liner and exits non-zero, add the breaking-change and migration
      entries, and keep the smoke workflow green against the stub rather than
      deleting the workflow. — not taken; the door is retained.
- [x] If retained: fix its documentation to describe what it actually is (a
      registry-independent rescue path that requires `node`) and stop counting
      it as redundant surface. Done in Phases 1–2 (`docs/installation.md`,
      `docs/getting-started.md`, `docs/troubleshooting.md`, the site
      requirements + installation pages) and demoted here: the site's install
      table is now "two you would choose, and one fallback", and the
      troubleshooting page reaches for it only after the registry path fails.

### How the disposition was decided

**AI council 2026-07-31** (2 members, 2 rounds) **split**: one argued B (retire
to a stub) on the surface-reduction principle, the other C (retain, demote) on
the asymmetry of an unrecoverable failure for a stranded user. Both independently
pre-registered the *same* cheap falsifier: search the project's entire issue
history for anyone reporting the registry-unreachable scenario. Zero mentions
would confirm retirement; one would flip it to C.

**The falsifier was run, and it cannot discriminate.** The repository has **7
non-PR issues in its entire history, all authored by the maintainer**, against
7 stars and 3.5 months of public availability. There has never been an external
report of anything. So "zero curl-door reports" is not evidence that the door is
unused — it is evidence that there is **no external user base yet**. The
retirement argument rested on silence being informative; with zero adopters,
silence is uninformative, and the pre-registered rule does not fire in either
direction. This is an honest null, not a verdict.

What survives the null is the asymmetry, and it is not symmetric: retiring a
door costs an unrecoverable failure for whoever needed it and cannot be
discovered (there is no telemetry and, on this evidence, no reporting channel in
use), while retaining it costs a ~200-line script and a CI matrix that is
currently green. On an irreversible axis with no data, the conservative
direction wins. Retention is also cheap to reverse later; retirement is not.

The surface-reduction principle is satisfied where it can be without that risk:
the **documentation** surface shrinks (the door stops being presented as a
co-equal third path), while the **capability** stays.

**Revisit when** — the condition, so this is not re-litigated on taste: the
first external adopter signal exists (a non-maintainer issue, or any adoption
telemetry at all). At that point the falsifier becomes informative and can be
re-run as originally designed.

**Exit criteria:** met. Disposition recorded with its reason; the public URL is
untouched and still resolves; the smoke workflow is unchanged and green.
**Rollback:** none needed — nothing was removed.

## Phase 4 — Payload budget with CI teeth

- [x] Measure and pre-register the tarball budget from the current measured
      size; record the measurement conditions alongside the number.
      `src/config/pack-size-budget.json` — `packed_size_mb` max 6.4,
      last_measured 5.903, with the measurement conditions stated in the file
      (buildless `npm pack --ignore-scripts`, tracked tree, 2026-07-31).
- [x] Add an `npm pack` size gate to CI that fails above the budget. ~~Nothing
      enforces size today.~~ **Premise corrected:** the *unpacked* size has been
      gated since road-to-credible-install Phase 6
      (`evaluator-budgets.unpacked_size_mb`, max 28 / last 26.05). What was
      genuinely ungated is (a) the **compressed** size a consumer downloads,
      (b) per-directory, (c) per-skill share. The new gate covers (a) and (c)
      and deliberately does **not** restate the unpacked number — one lever,
      one number. It also runs on **every** PR (buildless, seconds), where the
      evaluator umbrella runs only on release PRs and nightly, so accretion is
      now caught on the PR that causes it.
      <!-- verify: npx vitest run tests/scripts/check_pack_size.test.ts -->
- [-] Move the largest skill's bulk data directory behind a checksum-pinned,
      versioned lazy fetch. **Refused on the measurement — see below.**
- [x] Audit the next two largest data directories and record the result —
      measured, not assumed. See the table below.
- [x] Add a per-skill payload-share cap to the same gate so no single skill can
      silently reclaim the space. 5% default, with `design-intelligence`
      carrying a named 23% exception and its reason; the exception is not a
      blank cheque (its own cap is enforced) and a stale exception fails.
      <!-- verify: npx vitest run tests/scripts/check_pack_size.test.ts -->

### Bulk-asset audit — measured 2026-07-31

Compressed contribution is the decision-relevant figure, because it is what a
consumer downloads. Nobody had measured it; the roadmap's "864 KB of an 8.9 MB
payload" is the **raw on-disk** figure, which overstates the cost of text.

| Data dir | Raw | **Compressed** | Share of the 5.90 MB tarball |
|---|---:|---:|---:|
| `design-intelligence/data` (44 files) | 864 KB | **260,532 B** | **4.41 %** |
| `brand/data` (8 files) | 60 KB | 17,468 B | 0.30 % |
| `threat-modeling/data` (4 files) | 20 KB | 5,087 B | 0.09 % |

**Why the lazy fetch is refused.** It would save ~254 KB of a 5.90 MB download —
4.4 % — and buy that with: a network dependency on first use of a skill that is
fully offline today, checksum-pinning and version infrastructure, an offline
degradation path, and edits to the 7 skills that reference the corpus through
`corpus-grounding`'s manifest. That is a poor trade at 4.4 %, and it is the
wrong direction for a package whose retrieval works without a network.

Note also that the frequently-cited precedent does **not** support the fetch:
ADR-061 §8 rejected the 745 KB `google-fonts.csv` because it was *redundant with
a public API*, not because it was large — and its resolution for this very
corpus was **pack placement** (`frontend-design`), not lazy loading. Pack
placement bounds the *installed* footprint; it does not shrink the tarball,
which is what this phase is about.

The cap keeps the debt visible instead: `design-intelligence` sits at 22.63 %
of the skills payload against a named 23 % ceiling, so it cannot grow further
without an explicit, reasoned change. **Revisit if** the corpus grows past that
ceiling, or if the compressed share passes ~10 % of the tarball.

**Exit criteria:** met for the gate — it fails on deliberately oversized
fixtures (absolute, creep, default cap, exception cap, stale exception, empty
subtree) and passes on the real tree. The lazy-fetch leg is refused with the
measurement above rather than deferred silently.
**Rollback:** drop the gate; no payload changed.

## Phase 5 — Narrow emitter audit (what survives of the unification proposal)

- [x] Audit which consumer-install emitters lack the projection-side predicate
      the rule layer already shares, and list each divergence with its file.
      Table below.
- [x] For each divergence found, either route it through the shared predicate
      or record why it must differ. Do not collapse the projected tree — that
      was decided against on scope-discipline grounds, and the byte-equality
      invariant between source and projection must survive untouched. (Untouched:
      `check_condensation` — `dist == rewrite(src)` — is unchanged and green.)
      One divergence is a **bug**, not a justified difference; it is recorded as
      a blocker with its fix path rather than bundled into this change — see
      the reason under the table.
- [x] Use this repo's own pipeline names in every artefact this phase touches;
      the source draft's A/B labels mean something different here.
      Fixed in `src/install/rule_scope.ts`, `src/install/emit_host_rules_cli.ts`,
      `src/install/wizard-plan.ts` — all three called the consumer install
      "Pipeline B", which is `docs/architecture.md`'s name for the `.augment/`
      projection. **The drift check this item assumed does not exist**:
      `docs/architecture.md` claimed `tests/test_architecture_docs_pipelines.py`
      guarded the names; that test went with the Python suite (ADR-200) and was
      never replaced. The false claim is now corrected in place.

### Emitter divergence table — the shared predicate is `ruleFileArrives` (`src/install/rule_scope.ts:87`)

| Emitter | Uses it? | If not, what instead |
|---|---|---|
| `install.sh :: sync_hybrid` (+ `resolve_excluded_rules`) | yes, via `rule_scope_cli.ts` | falls back to `EXCLUDE_RULES="source-of-truth.md"` when tsx/npx is absent — over-ships, never under-ships |
| `install.sh :: emit_host_rules` / `create_tool_symlinks` / `generate_windsurfrules` | transitively | read the already-filtered `.augment/rules/` |
| `emit_host_rules_cli :: emitCursor` / `emitWindsurf` | no, **by design** | filters nothing; is *given* a filtered `rulesDir` |
| `wizard-plan :: expandWizardSources` / `buildPlanFromWizard` | yes | filter attached when `srcRel === 'dist/agent-src/rules'` |
| `server/routes/install :: resolveSources` | yes | — |
| `_cli/cmd_preflight` | no | omits `ruleScope` → `LEGACY_ALL`; read-only, but its counts over-report |
| **`install.ts :: _deploy_global_content`** | **no** | **nothing — raw recursive copy (the bug)** |
| **`install.ts :: _copy_dir_dereferencing_symlinks`** | **no** | **nothing** |
| `install.ts :: _prune_scoped_modules` / `_prune_lab_modules` | no | independent `frontmatter_packs` prune over skills/commands only; never touches rules |

Verified directly, not inferred: `src/scripts/install.ts` has **no import** of
`../install/rule_scope.js`, and the shipped bundle `dist/install/install.mjs`
contains **zero** occurrences of `ruleFileArrives` or `source-of-truth.md`.

**The bug.** The CLI global install (`agent-config init` → `src/scripts/install
--global`, which sets `SKIP_SYNC=true` so `install.sh` never runs) ships **all
110 rules including `source-of-truth.md`**, while the wizard global install
ships 94. The 2026-07-13 consumer-scoping flip is therefore unmet on the CLI
path — the exact contradiction `rule_scope.ts`'s own module doc says was fixed.
No test covers it: `tests/install/rule_scoping_plan.test.ts` exercises
`expandWizardSources` (the plan path), which is why the gap is invisible.

**Why it is not fixed in this change.** The fix is not a one-line filter. The
copy and the **inventory** must be filtered together — `expected_deploy_files`
feeds the reaper, so filtering only the copy would leave previously-installed
maintainer rules un-reaped on upgrade. That makes it a write-behaviour and
upgrade-semantics change to the global installer, the highest-blast-radius
surface in the package, inside a PR that is otherwise documentation and CI
gates. Per `active-remediation`'s ladder it is note-and-surface, not fix-now:
it is a correctness/noise defect, not a data exposure. Blocker below carries
the fix path.

**Exit criteria:** met — every divergence is listed with its file, each is
either justified or recorded as the bug it is, and the source↔projection
byte-equality check is untouched and green.
**Rollback:** the docstring renames revert independently; no behaviour changed.

## Phase 6 — Cold-start evidence

- [x] Wall-clock a containerized bare-machine run (install → `doctor`) in CI and
      publish it as a tracked number with its measurement conditions. Added to
      `src/scripts/evaluator_umbrella.sh`, which already runs inside a
      `node:20-bullseye` container and already does the headless
      install-from-tarball. The measurement spans `npm install` → `doctor`
      returned, lands in the run's `measurements.json`, and is written to the
      GitHub step summary next to its conditions (OS/arch, node, npm, and the
      fact that the package comes from a local tarball, so a real first touch
      adds registry latency on top).
- [x] State the structural guarantee separately from the number: one command,
      detection-driven, a bounded payload. The wall-clock is evidence, never a
      promise — network and registry latency are not ours to guarantee. The
      README quickstart now says exactly this, immediately under the four
      structural claims.

**Deliberately not a budget entry.** Every sibling metric in
`evaluator-budgets.json` is gated on an absolute max plus a >10% creep rule.
This one is not, and that is the design: the number is dominated by runner
weather, so a gate on it would flap and train the reader to ignore the line —
the failure mode `check_preamble_payload_budget`'s own docstring warns about.
It is recorded, not enforced. `check_evaluator_budgets` iterates the *budget*
entries, so the extra measurement rides along in the artifact and is ignored by
the gate (verified, not assumed).

**Exit criteria:** met — CI produces the number, with its conditions recorded
next to it, and no shipped claim states it as a guarantee.
**Rollback:** delete the step; nothing depends on it.

## Blockers

### blocker: curl-door-disposition
- **Status:** resolved 2026-07-31 — RETAIN, demoted to a documented fallback.
  Council split; the falsifier both members pre-registered turned out to be
  uninformative (zero external issues ever, so silence proves nothing). See
  § How the disposition was decided in Phase 3. Revisit on the first external
  adopter signal.
- **Owner:** maintainer
- **Blocks:** Phase 3
- **What to do:**
  1. Read the Phase-2 result: does the npx path now handle the registry
     resolution failure without prose?
  2. Decide whether a registry-independent install path is still wanted for
     restricted networks and mirrored registries.
  3. Note the constraint either way: the raw URL is a declared public contract
     with CI coverage across 3 OS × 2 Node versions — it must keep resolving
     even if the script becomes a stub.
- **Resolved when:** the disposition is recorded in this roadmap with its
  reason, and the smoke workflow reflects it.

### blocker: cli-global-install-skips-rule-scoping
- **Status:** open — found by the Phase-5 audit, 2026-07-31
- **Owner:** maintainer
- **Blocks:** nothing in this roadmap; recorded so it is not lost
- **What it is:** `install.ts :: _deploy_global_content` copies
  `dist/agent-src/rules` with `_copy_dir_dereferencing_symlinks` and never
  applies `ruleFileArrives`, so the CLI global install ships all 110 rules
  (including `source-of-truth.md`) where the wizard path ships 94.
- **Fix path:**
  1. Thread a `fileFilter` through `_copy_dir_dereferencing_symlinks`, applied
     when `src_rel === 'dist/agent-src/rules'` — mirror `wizard-plan.ts:198`.
  2. Apply the same predicate inside
     `global_deploy_inventory.expected_deploy_files`, or the reaper will leave
     previously-installed maintainer rules behind on upgrade. **Both, or
     neither** — filtering only the copy is worse than the status quo.
  3. Cover it where nothing does today: a test over `_deploy_global_content`,
     not over `expandWizardSources` (which is why the gap went unseen).
- **Resolved when:** the CLI global install and the wizard global install ship
  the same rule set for the same settings, with a test that fails if they
  diverge again.

### blocker: browser-handoff-default
- **Status:** open
- **Owner:** maintainer
- **Blocks:** any change making the non-browser path the default
- **What to do:**
  1. Note what is already true: the terminal path is already prompt-free, the
     Recommended path already asks zero questions (two confirmations), and
     detection already pre-selects. The remaining delta is the browser handoff
     itself, not choice overload.
  2. Note what stands in the way: an accepted ADR makes the browser handoff the
     interactive default, and the onboarding-gate rule — tier-1, hook-enforced
     — names the browser wizard the sole onboarding surface. Inverting this is
     a kernel-rule edit: own PR, ≥ 24 h between merges, per the slow-rollout
     gate.
  3. Note what is missing: there is no usage evidence either way, because zero
     external onboarding sessions have completed. The instrument that would
     produce it is the recruited session already open in the adoption roadmap.
  4. Decide: supersede the ADR and edit the rule, or keep the handoff and let
     `--no-ui` remain the documented escape.
- **Resolved when:** an ADR supersession plus a kernel-rule edit PR exists, or
  this roadmap records the handoff as retained by decision.

## Acceptance criteria

- No sentence on any install surface contradicts the code path it describes —
  checked per surface, not asserted globally.
- `--gui` exists and behaves as documented; the opt-out set is documented once.
- The npm resolution failure is reproduced by a test that fails pre-fix, and
  the quickstart carries no recovery prose after it passes.
- The curl door's disposition is recorded with a reason, and its public URL
  resolves either way.
- An `npm pack` size gate exists, fails on an oversized fixture, and carries a
  pre-registered budget with its measurement conditions.
- No single skill exceeds its pre-registered payload share.
- Every emitter divergence from the shared projection predicate is routed or
  documented; source↔projection byte equality is untouched.
- A cold-start wall-clock exists as a CI-produced number with conditions
  attached, and no shipped claim states it as a guarantee.
- The install story's shipped claims stay mechanical: one command, bounded
  payload, nothing written before confirmation. No claim that the install is
  fastest, easiest, or better than any alternative.

## Gate compliance, stated

The composition-ratchet polish gate is OPEN. Phases 1–2 are bug fixes (false
documentation, an unhandled failure the docs work around by hand). Phases 4–6
are CI/claims infrastructure. Phase 3 is a surface *retirement*, which reduces
rather than adds. Phase 5 is a divergence audit. The one item the gate would
genuinely bite — inverting the browser-handoff default — is deliberately a
blocker and not a step.

## Provenance

Source: an external planning set delivered through the user inbox, drafted by
an assistant that had the repository tree but not its decision memory. Every
in-tree premise was re-verified on 2026-07-31; corrections and refusals are in
[`zero-ceremony-inbox-cut`](../settings/contexts/zero-ceremony-inbox-cut.md).

Council 2026-07-31 (anthropic/claude-sonnet-4-5 + openai/gpt-4o, 2 rounds,
$0.14). Round 1 leaned toward splitting the arc into independent releases;
round 2 reversed on one specific coupling: retiring the curl door and covering
the npm failure mode are the same change, because the door's users are the
users the failure hits. That coupling is why Phase 3 is gated on Phase 2 rather
than sequenced beside it. Both members also converged that the browser-handoff
flip is a default inversion requiring the gate, not a small additive delta —
adopted verbatim as the blocker above. The council framed its answers as
release packaging; that framing is dropped, since roadmaps describe work and
release decisions are taken outside them.
