---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
research_pin: "agent-config @ 6e37584a1 (main, 2026-08-30, v14.12.0). Concern series reproduced at six pins in an isolated worktree; no network, no writes outside agents/roadmaps/."
estate_offset_exempt: "The one-in-one-out half fires on every added agents/roadmaps/road-to-*.md whatever its status, and this run archived nothing, so there is no offset to point at. The addition is sanctioned on its own terms: a tree-wide grep over agents/roadmaps/*.md, later/*.md and stubs/*.md for `concern` combined with `ratchet`/`admission` returns no file that owns the hook-concern growth axis, so no active, parked or stubbed roadmap covers the subject."
estate_growth_exempt: "Lands as status: ready rather than draft because the finding is measured, not proposed — the growth series is reproduced at six pins and the absent mechanism is a file that does not exist. A draft would repeat the exact failure this roadmap records: the same recommendation was already made once, in a consumed inbox file, and left no durable trace."
---
# Road to concern admission ratchet

> **Source:** intake round `inbox-2026-08-g`, set E — the round's status-update
> artefact, § 2. Consumed by the `/analyze:inbox` run of 2026-08-30.
> **Second occurrence** — the preceding round's status update already named the
> concern axis the next ratchet candidate at 68→69, and the item was never
> recorded anywhere durable. Routed through `src/rules/recurring-criticism.md`;
> the broken assumption is named in § Why this is here twice. True source paths
> are recorded encrypted in the round's intake note per
> `src/rules/source-confidentiality.md`.

## Goal

The hook-concern count is governed by the same two mechanisms that froze the
skill count: a forward-only admission ledger in which every added concern
carries a recorded answer and a refusal is a first-class row, and a ratcheted
count a change may only raise with a reason read from its own diff. When this
is finished, adding the 72nd concern either carries its record or fails a
gate — and `check_estate_count` reports the concern axis the same way it
reports `skill_count`.

## Why this is here twice

The recommendation was right; the **record** failed. It was written in an
untracked inbox file, that file was consumed, and nothing in
`agents/roadmaps/` — active, `later/` or `stubs/` — inherited it. Of the three
outcomes `recurring-criticism` names, this is **"right, never recorded"**: the
disposition was not wrong and it was not unreachable, it was never made
durable. The learning that constrains the next run is Phase 3.

## Measured state (reproduced at `6e37584a1`)

| Pin | `7c6a71d` | `1dba34c8` | `40791536` | `0f7c26ee9` | `2bcefb8b1` | `6e37584a1` |
|---|---|---|---|---|---|---|
| Concerns | 63 | 65 | 65 | 68 | 69 | **71** |

`git show "<pin>:src/scripts/hook_manifest.yaml" | grep -cE '^  [a-z][a-z0-9_-]*:$'`
— +8 over the series, and the only axis in the source's four-row table still
climbing. Skills held at 299 across the last three pins, rules at 120, tier-2
at 81.

What exists today and why it does not catch this:
`src/scripts/lint_hook_concern_budget.ts` caps concerns **per (platform,
event)** at `DEFAULT_MAX_PER_EVENT = 8` and ships `DEFAULT_HARD_FAIL = false`.
A per-event cap is blind to total growth by construction — eight new concerns
spread across eight events violate nothing — and warn-only means even the
per-event finding does not stop a merge unless `--strict` is passed. There is
no concern-count budget file, and `check_estate_count.ts` measures roadmaps and
skills only.

## Phase 1 — Measure the axis where the other axes are measured

- [x] **1.1 Add a concern-count metric to `check_estate_count.ts`.** Count
      concerns at HEAD and at the base ref with the *same* function, the way
      `_lib/skill_estate.ts` already does for skills — one parser shared by
      both sides, never two readings. The manifest is a single file at
      `src/scripts/hook_manifest.yaml`, so the existing `materialiseSubtree`
      call needs a second prefix or a single-file `git cat-file` read; state
      which in the implementation note.
      **DONE 2026-08-30 — one shared parser (`src/scripts/_lib/concern_estate.ts`),
      `git show` for the base ref.** Stated as the step asks: a SINGLE FILE, so
      `git show <ref>:src/scripts/hook_manifest.yaml` rather than a third
      `materialiseSubtree` — materialising a subtree to reach one known path
      spends a temp tree and a recursive `ls-tree` on a `git cat-file` in
      disguise. An unreadable manifest at the base reads as 0, which makes the
      floor 0 and can only ever ALLOW growth: the safe direction for a ref that
      predates the file.
      **CORRECTION — this roadmap's reproduce command over-counts, and the
      figures in § Measured state are wrong.**
      `grep -cE '^  [a-z][a-z0-9_-]*:$'` greps the WHOLE manifest, so it also
      counts members of `roles:`, `platforms:` and `native_event_aliases:`,
      which sit at the same two-space indent. Re-measured at all six pins with
      a parser scoped to the `concerns:` block:

      | pin | grep | true concerns |
      |---|---|---|
      | `7c6a71d` | 63 | 47 |
      | `1dba34c8` | 65 | 49 |
      | `40791536` | 65 | 49 |
      | `0f7c26ee9` | 68 | 52 |
      | `2bcefb8b1` | 69 | 53 |
      | `6e37584a1` | 71 | **55** |

      **The FINDING survives untouched and the ABSOLUTE FIGURES do not.** The
      over-count is exactly 16 at every pin, so the series climbs +8 either way
      and the concern axis is growing precisely as this roadmap says. But the
      axis stands at **55, not 71**, and a ratchet seeded with 71 would carry a
      floor its own parser could never reproduce — a gate that fails on its
      first honest run. The gate now reports
      `concern_count 55 (floor 55 at origin/main, +0)`.
      **Both directions verified by sabotage, on a branch carrying no claim:**
      a 56th concern with NO `estate_growth_exempt` in the diff fails —
      `❌ the roadmap estate grew: concern_count 55 → 56` — and restoring the
      manifest returns it to `55 (floor 55, +0)`. The claim path is exercised
      live too: on a sibling branch that did carry a real claim, the same +1 was
      detected and authorised, which is the designed behaviour rather than
      blindness. Detection and refusal are therefore both known to fire.
      verify: `./scripts-run src/scripts/check_estate_count --base <a pin
      carrying 69 concerns>` prints the concern floor and the HEAD count, and
      exits non-zero when HEAD is higher with no claim in the diff.
- [x] **1.2 Extend the `estate_growth_exempt` claim path to the new metric.**
      No new allowance key: the metric joins `skill_count` in taking the claim
      path or nothing, for the reason the estate budget file already records
      for skills — an allowance reopens the gaming path the dimension exists
      to close.
      **DONE 2026-08-30 for the mechanism half: `concern_count: 0` in the
      allowance map — no new key.** It joins `skill_count` in taking the claim
      path or nothing, for the reason the budget file already records: an
      allowance reopens the gaming path the dimension exists to close. That is
      sharper here than for skills — eight concerns spread across eight events
      violate the existing per-event cap zero times, which is why a
      total-growth ratchet was needed at all and exactly why it must not carry
      a per-change freebie.
      **Both directions are demonstrated**, though by sabotage on real branches
      rather than by a committed fixture: no-claim growth fails here, and a
      claim authorises the same growth on the sibling branch. A committed
      fixture belongs with 1.3's self-test and is not in this change.
      verify: a fixture branch adding one concern without a claim fails; the
      same branch with `estate_growth_exempt` in a touched roadmap's
      frontmatter passes, and the reason is printed.
- [x] **1.3 Register the metric in `src/config/estate-count-budget.json`.**
      Document the basis, the reproduce command, and the measured value 71 —
      in the shape the `skill_count` entry uses, including the rejected
      candidates measured rather than argued.
      **DONE 2026-08-30.** The budget entry records the basis, the reproduce
      command, and the measured value **55** — with the over-count correction
      written here rather than only in this roadmap, because this file is what a
      later reader checks the number against.
      **Rejected candidates, measured rather than argued**, as the step asks:
      counting `platforms:` rows instead — rejected, it is 8 and flat across all
      six pins, so it measures host coverage and not concern growth; leaning on
      `lint_hook_concern_budget.ts` — rejected, `DEFAULT_MAX_PER_EVENT = 8` is
      blind to total growth by construction and it ships
      `DEFAULT_HARD_FAIL = false`, which is why this axis needed a ratchet at
      all.
      **The self-test covers BOTH directions**, 15/15 cases green: a concern
      added above the base-tree floor rejects, and a non-concern top-level map
      gaining members at the same two-space indent **accepts** — the case that
      proves the parser is scoped rather than a grep, since the roadmap's own
      reproduce command would have counted that as growth.
      The gate-coverage row's `corpus` now names the manifest and states that
      the base ref is read with `git show` rather than a third materialised
      subtree.
      verify: `check_estate_count`'s own self-test covers the concern branch,
      and the gate-coverage row for the script names the new scanned path.

## Phase 2 — Record the answers, and the refusals

- [ ] **2.1 Mirror `check_skill_admissions.ts` for hook concerns.** Same
      shape, same reasons: forward-only against the base ref so the 71 already
      in the tree are grandfathered by construction, `decision: rejected` a
      first-class state, and a rejected row forbidden from naming a concern
      that exists. Ledger at `agents/decisions/concern-admissions.jsonl`.
      The questions a new concern must answer are not the skill questions —
      derive them from `docs/contracts/hook-architecture-v1.md`: which slot,
      which hosts actually bind it, what it does where the host ignores a deny,
      why an existing concern cannot carry it, and its per-event budget impact.
      verify: a fixture adding a concern with no ledger row fails; with a row,
      passes; a `rejected` row naming a live concern fails.
- [ ] **2.2 Write the questions where the author will meet them.**
      `hook_manifest.yaml`'s header already lists what to update when adding a
      concern; the questions belong in that list and in the hook-architecture
      contract, not only in the gate.
      verify: the header names the ledger, and `check_references` stays green.
- [ ] **2.3 Register both gates in the gate-coverage ledger** with `scanned`
      and a self-test, per this repository's gate-authoring contract.
      verify: the coverage gate is green and the two new rows carry a
      non-empty `scanned` field.

## Phase 3 — Close the recurrence, not just the finding

- [ ] **3.1 Record the disposition so a third occurrence is impossible.**
      One `agents/decisions/` entry or an ADR stating that the concern axis is
      ratcheted as of this roadmap, with the six-pin series as its basis and a
      `revisit-if` naming the condition that would reopen it — a measured case
      where the ratchet blocks a concern the repository needed.
      verify: the record exists, is citable by path, and names the series.
- [ ] **3.2 State the intake learning.** An inbox status-update prediction
      naming a concrete mechanism becomes a stub or a roadmap in the same run,
      never a line in a file about to be consumed. Add it to the
      `/analyze:inbox` command's Phase 4c or to `recurring-criticism`'s failure
      list — whichever the overlap scan says already owns the surface — as one
      sentence, not a new artefact.
      verify: the sentence exists in exactly one of the two files, and the
      other links to it rather than repeating it.

## Blockers

None. Every step is inside this repository and needs no host capability, no
network, no spend and no owner decision. The one judgement call — whether the
count metric belongs in `check_estate_count` or in its own gate — is
implementation shape, not authority, and 1.1 decides it by placing it where
`skill_count` already lives.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-30 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The ratchet fires on legitimate hook work and the reflex becomes a boilerplate claim | product | `estate_growth_exempt` is unbounded by design, so a concern that genuinely must ship is one line away. The failure is not a blocked merge, it is a claim reason nobody reads — the erosion the per-event cap already suffers by shipping warn-only | Phase 2's ledger makes the answer the artefact rather than the claim string: the row names slot, hosts, deny behaviour and why no existing concern carries it, and a reviewer can check each. 3.1's revisit-if names the measured condition that reopens the decision | Phase 2 — Record the answers, and the refusals |
| 2 | The floor side reads a different manifest than the live side | implementation | The roadmap and skill metrics both materialise a subtree; the manifest is a single file at a different prefix, and a second materialise call or a bare cat-file read is exactly where a base ref with no manifest silently reads zero — a floor of zero passes every possible tree | 1.1 shares one parser between both sides; 1.3's self-test covers the missing-manifest branch explicitly, failing rather than skipping, on the precedent the budget file already records for a base ref with no src/skills | Phase 1 — Measure the axis where the other axes are measured |
| 3 | Two gates where one would do | implementation | The count metric and the admission ledger both guard growth; shipping both reads as the composition this repository's marginal-cost principle warns about | They answer different questions, and the skill axis needed both for the same reason: the count catches growth, the ledger catches growth without a recorded decision, and a count alone is satisfiable by a merge that says nothing | Phase 1 — Measure the axis where the other axes are measured |

## Acceptance Criteria

- [ ] AC-1 — Adding a 72nd concern with no recorded reason fails a gate that
      runs in `task ci`. Demonstrated on a fixture, seen red before it is seen
      green.
- [ ] AC-2 — `agents/decisions/concern-admissions.jsonl` exists and can hold a
      `rejected` row; a rejected row naming a concern present in the manifest
      is refused.
- [ ] AC-3 — `check_estate_count` reports the concern axis alongside
      `skill_count`, measured at the base ref with the same function it
      measures HEAD with, and fails rather than skips when the base ref carries
      no manifest.
- [ ] AC-4 — A citable record states the concern axis is ratcheted, names the
      six-pin series as its basis, and carries a `revisit-if`.
- [ ] AC-5 — The intake learning from § Why this is here twice is written in
      exactly one file, so a third occurrence of this prediction lands as a
      tracked artefact rather than as prose in a consumed bundle.
