<!-- check-refs: skip -->
<!-- verbatim roadmap snapshot for the R2 reviewer; the live roadmap layer is excluded from check_references, and a snapshot must not fail a gate its source is exempt from -->
---
complexity: lightweight
status: ready
execution:
  mode: interactive
owner: maintainer
relates:
  - slug: road-to-a-graph-that-is-shipped
    relation: extends
    note: >
      Receiver. This file carries the `pack-size-budget-preexisting-overage`
      blocker that roadmap RECORDED but did not cause and could not resolve; it
      was relocated here on 2026-09-08 so a completed roadmap could archive
      without the blocker being closed. Substance untouched.
estate_growth_exempt: "Orchestrator-instructed 2026-09-08, and the charge is net ZERO by construction: this file is +1 active and the archival of `road-to-a-graph-that-is-shipped` in the same change is -1, so `check_estate_count` reads +0 on `active_roadmaps`. `open_blockers` is likewise unchanged, because the blocker MOVED rather than closed — it is open here on exactly the terms it was open there. The alternative was a completed 25/25 roadmap held indefinitely in the active estate by a blocker whose own `Blocks:` field says it blocks nothing in it, which is a filing problem wearing an approval problem's clothes."
design_validated: "orchestrator ruling 2026-09-08 under the owner delegation covering this drain. NOT a council decision — see § How this relocation was decided."
capability_gap: none
---
# Road to the packed-payload cap

> **This roadmap exists to hold one owner-reserved blocker, and nothing else.**
> It was relocated out of
> [`road-to-a-graph-that-is-shipped`](archive/road-to-a-graph-that-is-shipped.md)
> on 2026-09-08. Every field below is that blocker's, verbatim where it was
> correct and corrected where it was measurably wrong — the corrections are
> marked and the reasoning is in § Corrections carried in.

## Goal

`./scripts-run src/scripts/check_pack_size` exits 0 on `origin/main` with no
local edits, and `src/config/pack-size-budget.json` records the tree its figures
were measured in.

Nothing here is agent-executable. The cap is a maintainer-owned ratchet and the
three options below are a maintainer's to pick among; an execution run may
reproduce the measurement and may not act on it.

## Prerequisites

- [x] Read `src/config/pack-size-budget.json` in full — `_comment`,
      `measurement_conditions`, `built_surface_measurement_2026_08_24`,
      `built_surface_enforcement_2026_08_30`, and the six `baseline_note_*`
      entries. The file's own history is the argument against a reflex raise:
      four of those notes ARE raises, each recording that the trunk was already
      at the ceiling before the branch that tripped it existed.
      Done 2026-09-09. The reading changed what the decision below is ABOUT, and
      that is recorded at 1.1 rather than here. The one structural fact worth
      carrying up: this file holds **two** surfaces and they are not
      interchangeable. `budgets.packed_size_mb.max` (9.1) was set against the
      UNBUILT tree, and `built_surface_measurement_2026_08_24.built.packed_mb`
      (10.5525) against the BUILT one, from `npm run build && npm pack`. Since
      `built_surface_enforcement_2026_08_30`, `check_pack_size` compares against
      the BUILT figure with `regression_pct: 10`, i.e. a ceiling of 11.608.
- [x] Read `docs/decisions/ADR-259-code-graph-parsers-ship-with-the-package.md`
      § "Amendment — 2026-09-07 · vendored-wired-set", which is where the
      +373,922 B this blocker was first recorded beside came from.
      Done 2026-09-09. The amendment replaced a mechanism, not a decision:
      vendoring three grammars instead of depending on thirty-six, because the
      dependency route delivers all 36 (51,765,657 B apparent, 49 MiB on disk) —
      the outcome the record's own Alternatives section rejects by name. So the
      vendored bytes this blocker sits beside are already the SMALL branch of
      that choice, and "shrink the payload" cannot be answered by revisiting it.

## Phase 1 — The decision

- [x] **1.1 Pick one of (a), (b), (c)** below and execute it in a change that is
      *only* that. A budget move buried in a feature branch is how the
      2026-08-24 cap trip became a merge artifact nobody could attribute.
      verify: `./scripts-run src/scripts/check_pack_size` exits 0 on a clean
      `origin/main` checkout with no local edits, and the chosen path's own
      condition below holds.
      **STILL OPEN — the decision is the maintainer's and this run did not take
      it. What this run did is the half the Goal allows: reproduce the
      measurement. It came back with something the blocker did not anticipate.**
      Measured 2026-09-09 on `origin/main` at `e7a7a68d4`, no local edits:

      | Tree state | `check_pack_size` | vs recorded built 10.5525 | Verdict |
      |---|---:|---:|---|
      | `dist/mcp` + `dist/ui` PRESENT (a full build) | **12.140 MB** | **+15.0 %** | **FAILS** — ceiling 11.608 |
      | those two ABSENT (a partial build) | 11.539 MB | +9.35 % | passes, by 0.069 MB |

      **The second row is the invalid one, and that is the finding.** The
      recorded baseline came from `npm run build && npm pack --dry-run --json`,
      and `npm run build` in `package.json` chains `build:mcp-bundle` and
      `build:ui` — so 10.5525 was measured WITH those directories. Comparing a
      partial build against a full-build baseline understates the payload by
      0.601 MB, which is nine times the 0.069 MB of apparent headroom it
      produces. Anyone who clears those two directories to get a green has made
      the gate lie rather than made the tree smaller.
      **So the overage is REAL and it is 15.0 %, not the ~0.7 % the passing row
      suggests.** The blocker's own step 1 asked for this reproduction; the
      numbers it carried (9.8216 on 2026-09-07, 10.3087 on 2026-09-08) were
      taken against the UNBUILT cap of 9.1, which
      `built_surface_enforcement_2026_08_30` has since superseded. They are not
      wrong, they measure the other surface.
      **A standing note this contradicts, named so it is not quietly dropped.**
      A recorded local heuristic says `check_pack_size` reds because vitest
      builds `dist/ui` and `dist/mcp`, and that clearing them is the fix. That
      was true while the gate compared against the UNBUILT cap. Under the
      built-surface line the same act inverts: their presence is the CORRECT
      state to measure, and clearing them is what produces the false green.
      **Not decided here, deliberately.** Which of (a), (b), (c) — and whether
      re-pinning the built baseline is even the same class of act as raising the
      unbuilt cap — is a maintainer-owned ratchet call, and the Goal says an
      execution run may reproduce the measurement and may not act on it. The
      measurement is now sharp enough to decide against.

      **DONE 2026-09-10 — option (a), decided by an AI council over three rounds
      under an owner delegation, recorded in `ADR-273`.** The 2026-09-09 note
      above stands as written and is superseded only in its last paragraph: the
      decision the maintainer owned was delegated, and the council took it.

      **Both axes were red, not one.** The 2026-09-09 reproduction measured the
      BUILT route only. A clean checkout with no build takes the UNBUILT route
      and read **10.503 against `max` 9.1** — and the UNBUILT route is the one
      this step's own `verify:` names, because "a clean `origin/main` checkout
      with no local edits" has no `dist/cli/**`. So the closing condition was
      never the axis the earlier note measured.

      **Two defects were separated from the growth before anything was reset.**
      (1) 25 gitignored `__pycache__/*.pyc` files were being packed —
      `.npmignore` cannot withhold what `files[]` admits — which is why the
      binary axis read 28 observed against 3 allowed. (2) `dist/cli-delegate`
      held **105 esbuild chunks dated 2026-07-31 through 2026-09-07**: three
      esbuild runs share one `--outdir` with `--splitting`, names are
      content-hashed, and none cleaned the directory. Fixed in this change by
      prefixing `build:cli-delegate` with `rm -rf dist/cli-delegate`; worth
      **−1.32 MB packed**. Defect-pattern search reported with its count: exactly
      one further instance, `build:cli` (`tsc`, same missing clean), measured at
      0.158 MB and NOT fixed here because `dist/install` is tracked and shares
      that output root.

      **The old baseline was polluted too, and it was reconstructed rather than
      assumed.** `ab398ed05` checked out detached, `npm ci` against its own
      lockfile, full `npm run build`, packed: **10.1467 MB / 2785 entries** clean
      against **10.5525 / 2808** recorded. Real clean-to-clean growth is
      **+2.3424 MB / +456 entries**, *larger* than a naive subtraction — the
      pollution masked growth rather than inventing it.

      **The attribution both earlier readings would have got wrong.** Measured in
      PACKED bytes by `files[]` negation: `src/scripts` **6.0231 MB (48.2 %)**,
      `dist/agent-src` 2.6187, `dist/cli-delegate` 0.6462, `dist/mcp` 0.5319,
      `src/vendor` **0.3752**, `dist/hooks` 0.3308. Two council rounds had
      asserted WASM "compresses poorly" and that the tree-sitter grammars
      explained most of the growth; 3.807 MB unpacked → 0.3752 packed is ~90 %
      compression, so they are 19 % of it, not the majority.

      **`src/scripts` was proven necessary rather than grandfathered.** Both
      seats specified a differential packed-consumer test and both proposed
      carrying it as a provisional clause. It was RUN: two real tarballs (12.489
      MB full, 6.466 MB with `!src/scripts/**`), each installed `--omit=dev` into
      an empty project and driven through twelve entry points. The stripped
      install fails **every** command but `--version` and `--help` with rc=127 on
      a missing `src/scripts/_dispatch.bash` — the shipped consumer entry point,
      which routes only SOME commands to `dist/cli-delegate/`. The provisional
      clause is discharged here, not carried.

      **What landed:** `max` 9.1 → **11.5** (`10.5056 × 1.095 = 11.5036`, rounded
      DOWN, stricter than the formula), `last_measured` → 10.5056, a new
      `built_surface_measurement_2026_09_10` recording unbuilt 10.5056/3037 and
      built 12.4539/3240, the 2026-08-24 record annotated in place (**not**
      renamed — one seat's rename proposal rested on the selector skipping it,
      and `check_pack_size.ts:599-601` matches the prefix either way), and the
      build fix.

      verify RESULT: unbuilt route **10.506 ≤ 11.5 ✅**, built route
      **12.454 ≤ 13.699 ✅**, all four content classes 0, binary axis 3/3.

## Blockers

### blocker: pack-size-budget-preexisting-overage

- **Status:** resolved 2026-09-10. Option (a) taken by an AI council over three
  rounds under an owner delegation, recorded in `ADR-273`, executed in the same
  change as the build defect fix. Both gate routes green: unbuilt 10.506 against
  the reset `max` 11.5, built 12.454 against the derived ceiling 13.699. The
  entry below is left standing as written, because every number in it was
  correct for the surface it measured and the `What to do` list is what this
  resolution followed. Two of its premises did change and are named here rather
  than edited into the body: its costing advice *"start from 12.140 against
  10.5525"* rested on a baseline now proven to carry 0.4058 MB of stale build
  output, and its `If you do nothing` said the gate's size axis was dead — it is
  live again, on both routes.
- **Owner:** maintainer
- **Blocks:** step 1.1 of this roadmap, and nothing else anywhere. **CORRECTED
  ON RELOCATION** — in its original home this field read "nothing in this
  roadmap", which was true and was precisely why it could be relocated: it held
  a completed 25/25 roadmap out of the archive by co-location rather than by
  dependency. Here it blocks the one step this file has, which is the honest
  relation.
- **Class:** 3
- **Recommendation:** raise `budgets.packed_size_mb.max` to a re-measured figure
  in a dedicated change that also re-pins `last_measured`. The cap is a
  maintainer-owned ratchet with `review_by: 2027-07-31`, so an execution run may
  not move it — but leaving it below the tree's actual size means the gate
  reports the same failure on every branch and stops discriminating.
- **If you do nothing:** `check_pack_size` stays red in `task ci` for every
  branch. The gate's binary-payload half still works and still has teeth; only
  the size axis is dead. **CORRECTED ON RELOCATION:** this sentence also named
  `.github/workflows/consistency.yml`, and that half was false. Measured
  2026-09-08: `grep -rn 'check_pack_size' .github/` returns **nothing**, and the
  gate's only invocation in the tree is `taskfiles/ci-fast.yml:846`. So it reds
  no GitHub check on any PR and the consequence is local-only. That matters for
  urgency and it is why this blocker never appeared in PR #1945's failing set.
- **What to do:**
  1. Reproduce the baseline: `npm pack --dry-run --json --ignore-scripts` on
     `origin/main` with no local edits.
     · 2026-09-07, base `04a9af594`: **9.8216 MB** against
       `budgets.packed_size_mb.max = 9.1`. Independently reproduced the same day
       in a second worktree off the same base at **9.821 MB**.
     · **2026-09-08, base `3969c8b96` (the freshest reading anyone has):
       10.3087 MB**, 2,881 pack entries, 37.0116 MB unpacked. Method: the gate's
       own (`pack-size-budget.json` → `method`) on a `git archive origin/main`
       export into a throwaway directory, so there are no local edits of any
       kind — which is the condition `Resolved when` names. The **+0.49 MB
       between the two readings is the `release/14.22.0` merge**, not a feature
       branch: `road-to-a-graph-that-is-shipped` Phase 0.1's own contribution is
       +373,922 B and was already on `main` at both pins.
     · **2026-09-09, base `e7a7a68d4` — and the surface matters more than the
       number.** `check_pack_size` on a full build reads **12.140 MB** against
       the BUILT figure 10.5525, i.e. **+15.0 %** past a 10 % allowance whose
       ceiling is 11.608. With `dist/mcp` and `dist/ui` absent it reads 11.539
       and passes — but that compares a PARTIAL build against a FULL-build
       baseline, because `npm run build` chains `build:mcp-bundle` and
       `build:ui`. The 0.601 MB those two carry is nine times the 0.069 MB of
       headroom their absence appears to create, so the passing reading is the
       false one and clearing them is not a fix.
     · **The two readings above measure the OTHER surface.** 9.8216 and 10.3087
       were taken against `budgets.packed_size_mb.max = 9.1`, the UNBUILT cap,
       which `built_surface_enforcement_2026_08_30` superseded as the thing
       `check_pack_size` compares. They are not wrong; they answer a question
       the gate no longer asks. Anyone costing (a) should start from 12.140
       against 10.5525, not from 10.3087 against 9.1.
  2. Decide one:
     - **(a)** re-measure and raise `max` + `last_measured` together, recording
       the tree the figures came from as every other entry in that file does;
     - **(b)** shrink the payload back under 9.1;
     - **(c)** judge the unbuilt cap obsolete and gate only the built surface.
       **READ `built_surface_enforcement_2026_08_30` BEFORE COSTING THIS ONE**
       — the blocker never mentioned it and it changes what (c) means. Since
       2026-08-30 the gate already **routes**: it reads the payload it is
       judging (`payloadIsBuilt`, keyed on `dist/cli/**`) and sends an UNBUILT
       payload to `max` plus the `last_measured` creep line, and a BUILT payload
       to `built_surface_measurement_*.built.packed_mb` on a `regression_pct`
       line only. So (c) is not "add built-surface gating" — that exists. (c) is
       "retire the absolute unbuilt cap and keep only the regression line",
       which is a weaker gate than the file currently has, and that key states
       why no absolute built cap was ever set: *"inventing one here would be
       exactly the invented number the `_comment` warns about."*
  3. Whichever is chosen, do it in a change that is *only* that.
- **Resolved when:** `./scripts-run src/scripts/check_pack_size` exits 0 on
  `origin/main` with no local edits, and `pack-size-budget.json` records the
  tree its figures were measured in. MET 2026-09-10 on both counts:
  `built_surface_measurement_2026_09_10` records the commit, the command, the
  build state and the machine class for every figure it carries, and the gate
  exits 0 on the unbuilt route this condition describes.
- **Review trigger:** `budgets.packed_size_mb.review_by: 2027-07-31`. Unchanged
  by the relocation.

## Corrections carried in

Two statements in the original blocker were measurably wrong. They are corrected
in place above and recorded here so the next reader does not re-derive them:

1. **The CI claim.** *"stays red in `task ci` and
   `.github/workflows/consistency.yml`"* — the second half is false.
   `grep -rn 'check_pack_size' .github/` returns nothing; the sole invocation is
   `taskfiles/ci-fast.yml:846`. The gate is local-only and reds no PR check.
   Consistent with the measurement that prompted this file: PR #1945 carried one
   failing check and it was the 14.22.0 findings ledger, not this.
2. **The `Blocks:` field.** *"nothing in this roadmap"* was accurate and was the
   whole basis for relocating: a blocker that blocks nothing in its host holds
   that host out of the archive by filing accident. It now blocks the step it
   genuinely gates.

And one thing the blocker did not know: **option (c)'s premise has already
shipped**, per `built_surface_enforcement_2026_08_30`. Costing (c) as "wire up
built-surface gating" would overstate the work and understate the loss.

## What this roadmap is NOT

- **Not an authorisation to raise the cap.** `owner: maintainer` and
  `review_by: 2027-07-31` are unchanged. No agent may pick among (a), (b), (c);
  relocating a blocker does not relicense it.
- **Not a re-opening of ADR-259.** The vendored-grammar payload is an owner
  ruling and is not in question here. This file is about the CAP, not about what
  it measures.
- **Not a claim that the overage is urgent.** Correction 1 above says the
  opposite: the consequence is a local `task ci` red, not a blocked PR.

## How this relocation was decided

```
DECIDED BY THE ORCHESTRATING RUN, UNDER THE OWNER DELEGATION COVERING THIS
DRAIN. NOT BY A COUNCIL, AND THE COUNCIL WAS NOT MERELY SKIPPED — IT WAS
UNAVAILABLE.
```

Both configured seats were exhausted at the moment the option set existed.
Measured with the free probe rather than by spending a failed attempt
(`./scripts-run src/scripts/council_cli quota`, 2026-09-08):

```
council:quota · anthropic · 50/50 · exhausted
council:quota · openai   · 50/50 · exhausted
```

`gemini`, `perplexity` and `xai` read `0/50 · ok` and are **disabled seats**
(`council:status` → "disabled, no reason recorded"), so they are not a quorum.
`api_on_quota: off` forbids the metered rung. An earlier pass in the same run
put the archival disposition to the council and received
`cli_quota_exhausted` from both seats with `quorum: inconclusive, 0/2` — so the
exhaustion is observed, not inferred.

What that means for how much this decision is worth: the relocation is a
**filing** judgement by one party, recorded as such. What it deliberately does
**not** do is decide anything the council would have been asked: the blocker
stays open, stays `owner: maintainer`, keeps its three options unchosen, and
keeps its `review_by`. A relocation that also weakened it would be the
substitution this repository's own discipline exists to catch.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | Relocation reads as resolution | product | A blocker that moves out of a roadmap the same day that roadmap archives can be mistaken for one that was cleared, and the 25/25 archival is exactly the signal that invites that reading. | `Status: open` is unchanged, `open_blockers` is unchanged in `check_estate_count` (measured, not asserted), the archived roadmap keeps a one-line pointer here by path, and this file's § How this relocation was decided says in its own Iron Law that nothing was decided about the blocker itself | Blockers |
| 2 | The freshest measurement ages, and a stale figure reads as current | implementation | The 10.3087 MB reading is pinned to `3969c8b96`. The previous figure aged 0.49 MB in one day across one release, so this one will age too — and the original blocker's 9.8216 was already being read as current when it was a day stale. | Every figure above carries its base SHA and its date, and step 1.1's `What to do` puts reproduction FIRST rather than treating any recorded number as the input | Phase 1 |
| 3 | Option (c) is picked on the blocker's old framing | implementation | The blocker described (c) as gating the built surface, which already happens. A maintainer costing (c) from that description would think it adds a gate when it removes one. | § Corrections carried in states it, and (c)'s own bullet now quotes `built_surface_enforcement_2026_08_30` on why no absolute built cap exists | Blockers |

## Acceptance Criteria

- [x] AC-1 `./scripts-run src/scripts/check_pack_size` exits 0 on a clean
      `origin/main` checkout with no local edits.
      MET 2026-09-10 on BOTH routes, which is more than this line asks and is
      stated because the distinction cost this roadmap a round: a clean checkout
      with no build takes the UNBUILT route and reads **10.506 against the reset
      `max` 11.5**; the same tree after a full build takes the BUILT route and
      reads **12.454 against the derived ceiling 13.699**. All four content
      classes read 0 and the binary axis is 3 observed / 3 allowed — that last
      one was 28/3 before this change, because 25 gitignored `__pycache__/*.pyc`
      files were being packed through `files[]`.
- [x] AC-2 `src/config/pack-size-budget.json` records the tree its figures were
      measured in, per the convention every `baseline_note_*` in that file
      already follows.
      MET 2026-09-10. `built_surface_measurement_2026_09_10` carries, per
      figure: the exact command, whether the tree was built, the entry count,
      and the machine class. It also states plainly that every number is a
      workstation reading and that no CI reading exists or can, because
      `check_pack_size` has no `.github` invocation — only
      `taskfiles/ci-fast.yml:846`.
- [x] AC-3 Whichever of (a) / (b) / (c) was taken is recorded in that file with
      its measurement, its method, and the alternatives that were examined and
      rejected — the shape its existing notes use.
      MET 2026-09-10. Option (a), in `baseline_note_2026_09_10` and
      `built_surface_measurement_2026_09_10`, with the full record in `ADR-273`:
      the `× 1.095` derivation, the historical clean reconstruction at
      `ab398ed05` that proved the old comparator carried 0.4058 MB of pollution,
      the packed-bytes attribution table that refuted the council's own
      compression premise, the differential packed-consumer test that proved
      `src/scripts` load-bearing, and each of (b), (c) and the two rejected
      procedural proposals with the reason it was rejected.
