---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "Round inbox-2026-10-t verified at 5fa963cec that this package ships 353 scripts matching ^(check_|lint_|audit_) and that docs/proof.md:112-119 records 18 of 62 backed claims carrying `exec:` evidence while the other 44 rest on a pointer, so most of what the package asserts about consumer behaviour is checked by nothing executable; and that `check_agent_artifact_location.ts:15` names `agent-config doctor --strict` as its outward-facing half while a grep for that check over src/scripts/_cli/*.ts returns zero hits — a cited check that does not exist. No active, parked or stub roadmap owns either: a grep over agents/roadmaps/{*,later,stubs} for proof.md, CLAIMS.md, exec share and artifact-location returns nothing. Archiving or parking costs more because every consumer-facing fix in this round needs an executable home and there is currently no agreed one; merging into either install roadmap would make the shared harness a by-product of whichever landed first."
estate_growth_exempt: "Adds one owner blocker (`consumer-gate-denominator`) above the open_blockers floor measured at origin/main. A ratchet floor published from a number nobody re-derived is the failure this package's own ratchet discipline exists to prevent, so the figure is held rather than guessed. Measure the delta with `./scripts-run src/scripts/check_estate_count` on the landed commit rather than reading this sentence."
relates:
  - slug: road-to-an-uninstall-that-only-removes-what-it-brought
    relation: extends
    note: "Its Phase 0 adds the first uninstall-shaped case to the harness this file generalises. That file must not wait for this one; the harness already exists and is only being named and extended here."
  - slug: road-to-an-ownership-record-that-belongs-to-the-user
    relation: extends
    note: "Its Phase 1 red tests are consumer-scenario cases in the same harness. This file adds the exit-code register and the claim-evidence obligation around them, not the tests themselves."
  - slug: road-to-unknowns-that-say-so
    relation: disjoint
    note: "Owns what a package says when it does not know a value. This file owns whether a claim about consumer behaviour has an executable backing; it adds no state and no reporting path."
  - slug: road-to-local-gates-wired-while-they-are-green
    relation: extends
    note: "Owns wiring local-only gates into CI. Phase 2 implements a check that is cited and absent rather than written and unwired; the two meet at the point where the new check needs a CI home."
---
# Road to gates that run where the consumer stands

> **Source:** `agents/tmp.old/inbox-2026-10-t/topic-2/` — two transcripts and
> ten supplied plans, pinned at `main@9a43fabe5`, `main@9b6ff1a5b` and
> `main@73eb69439`. Re-read at `main@5fa963cec` on 2026-10-16. Readings marked
> *(executed)* ran against this tree.

## Goal

The checking machinery this package applies to itself also runs over what a
consumer's machine actually does, and every claim this package makes about
consumer behaviour points at something that executes.

## Prerequisites

- `npx vitest` runs locally. The harness this file extends already exists at
  `tests/install/`; nothing here builds a second one.

## Context — read at `main@5fa963cec`

| # | Defect | Evidence |
|---|---|---|
| L1 | **The gates point inward.** *(executed)* `ls src/scripts/ \| grep -cE '^(check_\|lint_\|audit_)'` returns **353**. The supplied source puts 21 of those on the consumer runtime path; that denominator needs a hook-manifest × CLI join that was **not** reproduced, so the number is held rather than published. |
| L2 | **Most published claims are not executable.** `docs/proof.md:112-119` records that **18 of 62** backed claims carry `exec:` evidence and the other **44** rest on a pointer. *(executed)* `grep -E '^- status: ' docs/CLAIMS.md \| sort \| uniq -c` → 62 backed, 36 unbacked, 7 resolved-null, 1 withdrawn. A claim about what happens on a consumer's machine, backed by a pointer into this repository, is backed by the wrong thing. |
| L3 | **A gate cites a check that does not exist.** `src/scripts/check_agent_artifact_location.ts:15` states "The outward-facing half is `agent-config doctor --strict`". *(executed)* a grep for `roadmap_candidate`, `roadmap-shaped` and `artifact.location` over `src/scripts/_cli/*.ts` returns **0 hits**. The contract half exists (`docs/contracts/agents-layout.md`, invariants 4 and 5); the consumer-facing half was never written. |
| L4 | **The harness already exists and is unnamed.** `tests/install/` holds 47 files; `installed_layer_ownership_real_install.test.ts` and `global_install_hooks_smoke.test.ts` already drive the real installer through `spawnSync` into a throwaway HOME. Two sibling roadmaps in this round add cases to it. Nothing records that this is *the* consumer harness, so the next round will propose building one. |
| L5 | **The exit-code contract is folklore.** `init`, `sync`, `doctor` and `uninstall` each return codes that callers depend on, and no document fixes them. A consumer scripting against them is scripting against an implementation detail. |

## Phase 1 — Count honestly, then name the harness

- [x] **1.1 Re-derive the consumer-path gate count.** A script that joins
      `src/scripts/hook_manifest.yaml` against the CLI surface and reports how
      many of the 353 gates run on a consumer's machine. The supplied figure
      of 21 is **not** carried forward until this reproduces it.
      verify: the script runs and prints a number; the number — whatever it
      is — is what gets written, not the one in the source.
      **Result:** `./scripts-run src/scripts/report_consumer_gate_reach`
      prints 353 prefix entries, of which 345 are gate modules (the other 8
      are allowlist data files and tests), and **13** of the 345 are
      statically reachable from a consumer entry point (125 entry points
      walked: hook dispatcher, every manifest `script:`, the node CLI, every
      delegated `cmd_*` verb, the installer, the MCP server and every source
      the bash dispatcher names). The supplied 21 did not reproduce; 13 is a
      lower bound on reach through a supported surface, for the reasons the
      script's header states.
- [x] **1.2 Enumerate the consumer-claim subset.** Mark every claim in
      `docs/CLAIMS.md` whose subject is consumer behaviour rather than this
      repository's own tree.
      verify: the subset is a list of claim ids, not a count.
      **Result:** 12 ids in `docs/contracts/consumer-harness.md`
      § Consumer-facing claims (11 backed, 1 withdrawn), with the evidence
      class each carries today; `consumer_harness_contract.test.ts` fails when
      a listed id leaves the ledger or changes status.
- [x] **1.3 Name `tests/install/` as the consumer harness.** One paragraph in
      `docs/contracts/` recording what it is, how a case is added, and the
      `env: { HOME }` injection rule the existing cases already follow.
      The matched lines are the new paragraph.
      verify: `grep -rn 'tests/install' docs/contracts/` -> 0

## Phase 2 — Implement the check that is cited and absent

- [x] **2.1 Write the artifact-location check.** The consumer half
      `check_agent_artifact_location.ts:15` already promises, reusing
      `is_roadmap_candidate` rather than a second detector — one detector is
      the file's own argument.
      verify: a fixture monorepo carrying
      `apps/x/docs/roadmaps/road-to-y.md` yields exactly one finding naming
      the target location under `agents/`.
      **Result:** `doctor`'s `artifact-location` row
      (`src/scripts/_lib/install_reach_checks.ts`, so `cmd_doctor.ts` does not
      grow). `tests/install/doctor_artifact_location.test.ts` runs the real
      doctor against the fixture and reads one finding,
      `apps/x/docs/roadmaps/road-to-y.md → agents/roadmaps/road-to-y.md`.
- [x] **2.2 Advisory by default, `manual` under `--strict`. Report only.**
      No auto-move: `doctor` is read-only, and moving a consumer's file
      without asking is the ownership break a sibling roadmap exists to end.
      verify: the fixture run leaves the tree byte-identical.
      **Result:** the doctor's status vocabulary is `ok | warn | fail |
      skipped` and has no `manual`, so "advisory, opt-in failing" is carried
      as `warn`: a default run and `--strict` (level `fail`) exit 0 on it;
      `--strict --strict-level warn` fails. The same harness case hashes every
      path and byte of the fixture before and after and asserts equality.
- [x] **2.3 One detector, two callers.** The package gate and the consumer
      check import the same function.
      verify: a test that changes the detector's behaviour fails both call
      sites, not one.
      **Result:** the detector moved to `src/scripts/_lib/agent_artifact_location.ts`;
      the gate re-exports it. `agent_artifact_location_two_callers.test.ts`
      replaces `scan` once and sees the gate flip 0 → 1 and the doctor row
      flip `ok` → `warn`.

## Phase 3 — Freeze the exit-code contract

- [x] **3.1 Generate the register.** A `docs/contracts/` table of exit codes
      for `init`, `sync`, `doctor` and `uninstall`, generated from the code
      rather than written beside it.
      verify: the generator runs in CI and the file is drift-checked.
      **Result:** `src/scripts/build_exit_code_register.ts` scans each
      command's sources for the codes it returns (literal, ternary,
      `ArgparseExit`, bash `exit`, resolved `EXIT_*` constants, and a named
      forwarding line for `sync` → `init`) and writes
      `docs/contracts/exit-code-register.md`; only the one-line meanings are
      hand-written, and a code without a meaning, or a meaning without a code,
      fails the run. The drift check is
      `tests/scripts/build_exit_code_register.test.ts`, which runs in the CI
      vitest suite — no workflow or gate-coverage row was added for it.
- [ ] **3.2 Pin the pairs that must agree.** Where two surfaces report on one
      state — installer `rc=3` and `doctor --ci` — the register records the
      pair and a test asserts it.
      verify: the assertion fails if either side changes alone.
      **Open, read 2026-10-16:** the pair does not exist yet, so there is
      nothing to pin. No `doctor` check reads the preserved-sidecar state —
      `.agent-config.new` / `SIDECAR_SUFFIX` occur only under `src/install/`,
      `src/scripts/install.ts` and the wizard UI — so on a tree where the
      installer returned `3`, `doctor --ci` exits `0`. Closing the step means
      giving `doctor` a check that fails on that state, which changes what
      `doctor --ci` returns for consumers already scripting against it; the
      `doctor-exit-contract` decision of 2026-09-03 (recorded in
      `src/scripts/_cli/_doctor_strict.ts`) kept that contract stable and put
      new failing behaviour behind `--strict`. Whether the preserved state
      fails `--ci`, fails only `--strict`, or warns is a consumer-facing exit
      decision this lane did not take.

## Phase 4 — Point the claims at something that runs

- [ ] **4.1 Give every consumer-facing claim an `exec:` pointer** into the
      harness, or mark it `unbacked` and say so. A pointer into this
      repository is not evidence for a claim about a consumer's machine.
      The measured exec share is written from the run's output, never predicted.
      verify: `./scripts-run src/scripts/build_proof` -> 0
- [x] **4.2 Make a red harness case the entry point for a consumer bug.** A
      one-paragraph rule: a reported consumer defect lands as a failing case
      in `tests/install/` before its fix.
      verify: the paragraph exists and names the directory; the two sibling
      roadmaps in this round already follow it, which is the evidence it is
      workable rather than aspirational.
      **Result:** landed with 1.3 as `docs/contracts/consumer-harness.md`
      § The harness, paragraph "A consumer defect starts here".

## Blockers

### blocker: consumer-gate-denominator

- **Status:** open
- **Owner:** repository owner
- **Blocks:** publishing the Phase 1.1 figure as a ratchet floor. The
  measurement itself is step 1.1 and is not blocked; what is blocked is
  turning the result into a gate nobody can lower.
- **What to do:** pick exactly one — (a) publish the re-derived figure as a
  shrink-only ratchet once 1.1 produces it, on the same terms as the other
  estate ratchets; or (b) publish it as a reported, ungated figure for three
  months first, then decide; or (c) do not publish it at all and keep 1.1 as
  a one-off measurement recorded under `agents/evidence/`.
- **Resolved when:** the choice is recorded in this file's `## Decisions` as
  D4 and this blocker's Status reads `resolved — <choice>`.
- **Recommendation:** (b). A ratchet floor set from the first reading of a
  metric nobody has watched move is exactly the "never lower a ratchet on a
  local reading" failure in reverse — it fixes a number before anyone knows
  its natural variance. Three months of reporting costs nothing and makes (a)
  defensible.
- **If you do nothing:** 1.1 runs, the number exists in the PR, and nothing
  carries it forward — which is the state this round found for several
  earlier measurements.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | deterministic | evidence | Extend `tests/install/`, do not build a consumer-scenario tree | the harness already drives real installs into a throwaway HOME across two existing files | the install surface splits into two genuinely independent harnesses |
| D2 | critical-technical | evidence | The artifact-location check reports and never moves | `doctor` is read-only and an unasked move is the ownership break a sibling roadmap is ending | the user explicitly asks for a move command, which would be its own verb and its own decision |
| D3 | deterministic | agent | The supplied 21-of-353 figure is not carried forward unverified | 353 reproduced; 21 did not | 1.1 reproduces it |
| D4 | product-owned | owner | Hold the ratchet question for the `consumer-gate-denominator` blocker; step 1.1 produces the figure either way | a ratchet floor set from the first reading of a metric nobody has watched move fixes a number before its variance is known | the blocker resolves, or three months of reported readings exist |
| D5 | reversible-technical | agent | A pointer into this repository does not back a claim about a consumer machine | it is the distinction that makes the 18-of-62 figure meaningful rather than an accounting detail | the claim vocabulary gains a third evidence class |

## What this roadmap deliberately does not do

- It does not write the consumer-scenario tests themselves. Two sibling
  roadmaps own the cases; this file owns the harness contract around them.
- It does not add a CLI verb. The artifact-location check attaches to
  `doctor`.
- It does not move, rewrite or relocate any consumer file.
- It does not publish a number it did not measure.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-16 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The exec-share obligation turns into mass-marking claims `unbacked` | product | The cheapest way to satisfy 4.1 is to downgrade claims rather than back them. | 1.2 enumerates the consumer subset first, so the set is fixed before the obligation applies; a downgrade is visible in the diff as a status change rather than as an absence. | Phase 4 — Point the claims at something that runs |
| 2 | The artifact-location check fires on a consumer's deliberate layout | product | A monorepo that keeps roadmaps elsewhere on purpose gets a finding on every run. | Advisory by default; `manual` only under `--strict`; the finding names the target rather than asserting the current location is wrong. | Phase 2 — Implement the check that is cited and absent |
| 3 | 1.1 reproduces a number far from 21 and the phase reads as a failure | implementation | A measurement that contradicts its source looks like an error in the measurement. | D3 records that 21 was never verified; whatever 1.1 returns is the finding, and the divergence is reportable rather than embarrassing. | Phase 1 — Count honestly, then name the harness |
| 4 | The generated exit-code register drifts from the code it documents | implementation | A generated contract nobody regenerates is a stale contract with extra ceremony. | 3.1 drift-checks in CI; the register is generated, not written. | Phase 3 — Freeze the exit-code contract |
| 5 | Naming the harness freezes a structure two siblings are still shaping | implementation | A contract written mid-change constrains the change. | 1.3 records the injection rule and the entry point, not the file layout; the two siblings' cases are the input to it rather than the output. | Phase 1 — Count honestly, then name the harness |

## Acceptance Criteria

- [ ] **AC-1** A script re-derives the consumer-path gate count from
      `hook_manifest.yaml` and the CLI surface, and the written figure is its
      output.
- [ ] **AC-2** The consumer-claim subset of `docs/CLAIMS.md` is enumerated by
      claim id.
- [ ] **AC-3** A fixture monorepo with a roadmap outside `agents/` yields
      exactly one advisory finding naming the target, and the tree is
      byte-identical afterwards.
- [ ] **AC-4** The artifact-location detector has two callers and one
      implementation, asserted by a test that changes it once and sees both
      fail.
- [ ] **AC-5** `docs/contracts/` carries a generated, drift-checked exit-code
      register for `init`, `sync`, `doctor` and `uninstall`.
- [ ] **AC-6** `docs/proof.md`'s exec share is written from a `build_proof`
      run in the same change, and no consumer-facing claim is `backed` on a
      pointer into this repository alone.
- [ ] **AC-7** `task ci` green.

## Provenance

Source-derived under template rule 19. The source set compares this package
against several external references; none is named here per
`source-confidentiality`, links `ENC1`-encrypted in the round's intake note.

| Proposed | Verdict | Why |
|---|---|---|
| Consumer-path gate ratchet | KEEP, held | L1: 353 reproduced, the numerator did not; the blocker holds the publication, not the measurement. |
| `exec:` evidence for consumer claims | KEEP | L2 verified at `docs/proof.md:112-119`. |
| Implement the cited artifact-location check | KEEP | L3: cited at `:15`, zero hits in the CLI. |
| Build `tests/consumer-scenarios/` | CUT → FOLD | L4: the harness exists at `tests/install/`; building a second one duplicates the real-install fixture machinery. |
| Exit-code register | KEEP | L5: no document fixes them. |
| Numeric maturity grades / percentage targets | CUT | No measurement basis; the source withdraws the grades itself and the percentage targets are the same class. |
| A per-PR consumer-artifact gate | CUT | Declined by an accepted ADR; re-proposing it here would relitigate a recorded decision. |

## Notes — how this file was derived

Three extraction passes over a twelve-file source set. L1's 353, L2's 62/36/7/1
and L3's zero-hit grep were re-derived at HEAD; the source's 21-of-353 was
**not** reproduced and is carried as an open measurement rather than as a
figure. The source proposed a greenfield consumer harness; verification found
one already running real installs in a throwaway HOME across two existing test
files, so the proposal became an extension and a contract rather than a build.
