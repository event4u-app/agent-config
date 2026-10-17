<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
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
      the fixture file named with its target under `agents/roadmaps/`.
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
- [x] **3.2 Pin the pairs that must agree.** Where two surfaces report on one
      state — installer `rc=3` and `doctor --ci` — the register records the
      pair and a test asserts it.
      verify: the assertion fails if either side changes alone.
      **Was open, read 2026-10-16:** the pair did not exist, and no `doctor`
      check read the preserved state, so on a tree where the installer
      returned `3`, `doctor --ci` exited `0`. Giving `doctor` such a check was
      a consumer-facing exit decision that lane did not take.
      **Closed 2026-10-17: the sibling took it.** The ownership-record
      roadmap's step 3.1 landed `src/scripts/_cli/doctor_ownership_ledger.ts`,
      which reports every ledger file the installer would preserve as
      `modified`, and
      `tests/install/ownership_ledger_real_install.test.ts` § step 3.1 runs
      both surfaces over one tree. The pair exists; the premise of the note
      above is spent. What was still missing was the register half, and that
      is what this step now lands: `build_exit_code_register` carries a
      `PAIRS` table, publishes a *Pairs that must agree* section, and
      `checkPairs` fails the build when either verb stops returning its side
      of the pair OR when the named test loses the assertion. The drift test
      asserts `errors` is empty, so either drift reds CI. Sensitivity
      observed: neutralising `checkPairs` turns three of the four new cases
      red.

## Phase 4 — Point the claims at something that runs

- [ ] **4.1 Give every consumer-facing claim an `exec:` pointer** into the
      harness, or mark it `unbacked` and say so. A pointer into this
      repository is not evidence for a claim about a consumer's machine.
      The measured exec share is written from the run's output, never predicted.
      verify: `./scripts-run src/scripts/build_proof` -> 0
      **Open, read 2026-10-16.** Of the 11 backed ids in the 1.2 subset, one
      already meets the bar (`host-agent-count`, `exec:` into
      `tests/install/toolDetection.test.ts`). The other ten split three ways,
      and none of the three is closed by editing the ledger alone:
      (a) `surgical-uninstall`, `council-fallback-loses-zero-seats` and
      `default-install-context-cost` carry `exec:` evidence that runs, but
      into `tests/lib/`, `tests/scripts/` or a repository count — they need a
      harness case, which this file's own scope note leaves to the sibling
      roadmaps; `surgical-uninstall` is also the one of the ten markered in
      `README.md`, so downgrading it would change public copy.
      (b) `install-audit-clean` and `hook-dispatch-latency` point at CI jobs
      that already run on a fresh install or on the installed invocation path.
      Marking them `unbacked` would misstate them; wrapping each as an
      `exec:` harness case is the honest fix and is the same harness work.
      (c) `thin-inject-delivery-equivalence`,
      `mcp-registered-server-standing-cost`,
      `skill-tiering-h2-costs-more-by-default`, `scope-dedup-cold-start-reduction`
      and `gated-platform-reads` are fixture or network measurements of a
      consumer-facing mechanism. `unbacked` means "not yet bound" in
      `docs/CLAIMS.md`, so flipping a finished measurement to it files a
      reading as debt — the misfiling the ledger's own `resolved-null` and
      `withdrawn` paragraphs exist to prevent, and Risk rank 1 below. D5's
      revisit condition (a third evidence class) is the shape of the real fix.
      Doing (c) by mass status change was declined in this lane for that
      reason; doing (a) and (b) waits on harness cases.
      **Re-read 2026-10-17, still open, and the structure is unchanged.**
      `./scripts-run src/scripts/build_proof` exits 0, so the verify line is
      satisfied and the step is not: that line measures the ledger's internal
      consistency, not whether a claim about a consumer's machine is backed by
      something that runs there.
      One candidate was examined and **declined**.
      `tests/install/uninstall_purge_containment.test.ts` now exists in the
      harness and proves that uninstall leaves every unrecorded file byte for
      byte, so `surgical-uninstall` could be given an `exec:` into it and would
      read as harness-backed. It was not: that suite proves the **file**-level
      half, while the claim's load-bearing half is **key**-level — "removes only
      its own keys from a shared host config … inside a shared `hooks.<event>`
      array" — which only `tests/lib/json_pointers.test.ts` and
      `host_hook_merge.test.ts` cover. Repointing it would have moved the id out
      of this step's residue while leaving the claim backed by the wrong thing,
      which is exactly the defect L2 names.
      **The step is structurally unclosable by this file**, and that is an
      authoring defect rather than undone work: (a) and (b) need harness cases
      and this file's own scope note gives those to the sibling roadmaps; (c)
      needs the third evidence class D5's `revisit if` already names. The honest
      next move is one of those two, taken where it belongs — not a ledger edit
      here.
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

- **Status:** resolved — **(b)**, AI council 2026-10-16, 2/2 concluded, no split,
  recorded as D4 with the methodology freeze and the evidence-based exit the
  seats made it conditional on. Record:
  `agents/evidence/council/owner-blocker-routing-20261016.md`.
- **Owner:** repository owner — **the council read the transition instead and found it unreserved; the label records who raised it.**
- **Blocks:** nothing further. It blocked publishing the Phase 1.1 figure as a
  ratchet floor; D4 now records (b), so 1.1 proceeds and its result is published
  ungated under the methodology D4 fixes.
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
| D4 | product-owned | council:agents/evidence/council/owner-blocker-routing-20261016.md | **(b) — publish the re-derived figure as a reported, ungated number first, and exit on evidence rather than on the calendar.** Three months is the observation WINDOW, not the criterion. Before the first reading, freeze the methodology and publish it with every reading: definition, numerator, denominator, exclusions and the reproduction command. "Representative" is fixed up front as spanning at least three host platforms, fresh and upgrade installs, and minimal and full projection scopes. The window ENDS IN A DECISION — (a) ratchet or (c) one-off — never in a drift into permanent (b); too few observations extend the window rather than force a pick | AI council 2026-10-16, members `anthropic` + `openai`, prompt mode, 2 rounds, 2/2 concluded, no split, $0.00 (subscription transport), both seats `DECIDE`: the transition is reversible, weakens no floor and creates no ratchet, so it is not reserved. A ratchet makes the first observation load-bearing, and with no history there is no way to tell a real regression from denominator churn, a classification change, nondeterminism or ordinary variance. Both seats refused a fixed numeric variance threshold as unsupported for a discrete ratio over a small denominator | a material unexplained decline during the window, or evidence that the absent gate was exploited — either triggers review immediately rather than at the window's end |
| D5 | reversible-technical | agent | A pointer into this repository does not back a claim about a consumer machine | it is the distinction that makes the 18-of-62 figure meaningful rather than an accounting detail | the claim vocabulary gains a third evidence class |
| D6 | reversible-technical | agent | Step 2.2's "advisory by default, `manual` under `--strict`" is carried as a `warn` row: `doctor` and `--strict` exit 0 on it, `--strict --strict-level warn` fails | the doctor's published status vocabulary is `ok \| warn \| fail \| skipped`; a `manual` value would not reach the MCP `doctor_report` contract | the status vocabulary gains a value that means "needs a human" |

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

- [x] **AC-1** A script re-derives the consumer-path gate count from
      `hook_manifest.yaml` and the CLI surface, and the written figure is its
      output.
- [x] **AC-2** The consumer-claim subset of `docs/CLAIMS.md` is enumerated by
      claim id.
- [x] **AC-3** A fixture monorepo with a roadmap outside `agents/` yields
      exactly one advisory finding naming the target, and the tree is
      byte-identical afterwards.
- [x] **AC-4** The artifact-location detector has two callers and one
      implementation, asserted by a test that changes it once and sees both
      fail.
- [x] **AC-5** `docs/contracts/` carries a generated, drift-checked exit-code
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
