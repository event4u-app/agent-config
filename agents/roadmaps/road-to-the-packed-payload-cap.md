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

- [ ] Read `src/config/pack-size-budget.json` in full — `_comment`,
      `measurement_conditions`, `built_surface_measurement_2026_08_24`,
      `built_surface_enforcement_2026_08_30`, and the six `baseline_note_*`
      entries. The file's own history is the argument against a reflex raise:
      four of those notes ARE raises, each recording that the trunk was already
      at the ceiling before the branch that tripped it existed.
- [ ] Read `docs/decisions/ADR-259-code-graph-parsers-ship-with-the-package.md`
      § "Amendment — 2026-09-07 · vendored-wired-set", which is where the
      +373,922 B this blocker was first recorded beside came from.

## Phase 1 — The decision

- [ ] **1.1 Pick one of (a), (b), (c)** below and execute it in a change that is
      *only* that. A budget move buried in a feature branch is how the
      2026-08-24 cap trip became a merge artifact nobody could attribute.
      verify: `./scripts-run src/scripts/check_pack_size` exits 0 on a clean
      `origin/main` checkout with no local edits, and the chosen path's own
      condition below holds.

## Blockers

### blocker: pack-size-budget-preexisting-overage

- **Status:** open
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
  tree its figures were measured in.
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

- [ ] AC-1 `./scripts-run src/scripts/check_pack_size` exits 0 on a clean
      `origin/main` checkout with no local edits.
- [ ] AC-2 `src/config/pack-size-budget.json` records the tree its figures were
      measured in, per the convention every `baseline_note_*` in that file
      already follows.
- [ ] AC-3 Whichever of (a) / (b) / (c) was taken is recorded in that file with
      its measurement, its method, and the alternatives that were examined and
      rejected — the shape its existing notes use.
