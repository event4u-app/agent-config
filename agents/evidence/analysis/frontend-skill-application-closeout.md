<!-- evidence-type: analysis -->
<!-- analyzed: 2026-08-20 | commit: 1d2f73c40 | files: 3 -->

# Frontend skill application — Phase 5 closeout and the premise check behind it

Closeout finding for `road-to-frontend-skill-application`. It records one
decision (Phase 5: **no-change**), the evidence that decided it, and — because
the decision was handed down with a premise attached — an explicit test of that
premise against this tree. Two of the three premise elements did not survive the
test, and the corrections are stated rather than absorbed.

## 0. Provenance of the disposition

The closing dispositions for this repository's open blockers were decided by an AI
council in one pass. The record is
[`agents/evidence/council/drain-blocker-dispositions-a.md`](../council/drain-blocker-dispositions-a.md),
which **landed on `main` while this closeout was in progress** — it was absent when
this finding was first written, so the `ref-ignore` marker it carried has been
dropped and the citation is now a live link. Its verdict line for this roadmap
reads, verbatim:

> Treat the enforcement-projection null as terminal because it matches this
> repository's population and epoch: only 3 UI-write turns occurred across 107
> sessions, while the catalogue corpus independently records host truncation and
> insufficient observation.

This finding cites that record, tests the premise it carried (§ 2), and departs
from it where the premise did not survive — which the record's own instruction
requires. Worth noting that the companion document
[`drain-blocker-dispositions-b.md`](../council/drain-blocker-dispositions-b.md)
reaches the same doubt from the other side without having measured anything:
*"You can't disposition enforcement-evidence until you know whether earlier
phases produced the data it cites."* That is exactly the check § 2 and § 3
perform, and it is why the outcome is kept while the premise is not.

## 1. The decision

**Phase 5 closes with an explicit `no-change`.** `hooks.design_slop.enabled`
stays default-OFF, `lint_design_slop` stays advisory, and no artifact-presence
gate ships on ad-hoc UI writes.

The reasoning is the unmet precondition, not a preference. Phase 5 Step 4 fires
"if and only if warn-level pressure proved insufficient". Warn-level pressure was
never switched on in any measured store, so there is no arm in which it could
prove insufficient. Flipping a default against zero evidence of insufficiency
would be a default flip that migrates nobody — it would change the shipped
posture of every consumer on the strength of a measurement that does not exist.

What *is* measured is the control arm, and it is measured properly for the first
time (§ 3): **consultation rate 0.0 %, 0 of 275 UI-write turns across 16
UI-write sessions.** That is a real zero from a proven-sensitive instrument, and
it is the number the next intervention has to beat.

## 2. The premise check — two elements did not hold

The disposition arrived with three supporting claims. Verified individually:

| Premise element | Verdict | Evidence |
|---|---|---|
| The catalogue corpus records host truncation and insufficient observation | **holds** | `agents/evidence/metrics/skill-catalogue.jsonl`: 7 observations, 2 hosts. Six codex rows carry `truncation_mode: "budget-strip-and-drop"`, `observation_source: "host-event"`, `dropped_count` 330–402, verdict `insufficient-observation`. One claude row (2026-08-12) carries verdict `no-selector`. |
| "3 UI-write turns across 107 sessions" | **stale, and its conclusion is refuted** | The figure was true of this repo's own store and still is in shape (re-run: 125 sessions, 1 UI-write session, 3 UI-write turns). Its conclusion — that the population is absent and a human must name a consumer store — is false. See § 3. |
| The enforcement-projection null is terminal "because it matches this repository's own population and epoch" | **does not hold** | See § 2a. |

### 2a. Why the enforcement-projection null does not carry Phase 5

The recorded null is `docs/contracts/governance-enforcement-projection.md`
(*Status: Measured → honest-null, 2026-06-25*). It is a real, well-recorded null
and nothing here disputes it on its own terms. It does not answer Phase 5's
question, on four independent axes:

- **Population.** Its selector was "rules already carrying `tier: safety-floor`
  in frontmatter — today that is exactly 3 files". Measured now:
  `grep -rl "tier: safety-floor" src/rules/` returns **zero files**. The
  population it measured no longer exists in this tree. The two rules Phase 5
  governs are `tier: "2b"` (`ui-audit-gate`, `design-review-after-ui-write`);
  `design-fidelity` is `tier: "2a"`. Neither was ever in the null's set.
- **Mechanism.** Compile-time hardening of prose blocks at projection time,
  versus flipping a runtime hook default and adding an artifact-presence gate.
- **Metric.** `discipline_score` over trapD/trapE micro-fixtures, versus
  consultation and discharge rates over UI-write turns.
- **Epoch.** 2026-06-25, roughly two months before this roadmap's own
  measurements, and before scoped projection shipped.

Per the disposition's own instruction — a mismatch turns `C` into `B` with the
mismatch cited — this element is cited as mismatched and is **not** relied on.

**The outcome is unchanged and the route to it is different.** Phase 5 still
closes `no-change`, on § 1's local reasoning and § 3's local measurement, not on
a transferred null from a different population. The distinction matters because
an outcome resting on a mismatched premise is unfalsifiable: nobody could later
show it wrong by measuring UI work, which is precisely what § 3 does.

## 3. The corpus is not absent — measured, not asserted

The `ui-corpus-has-no-ui` blocker held that a skill/rule suite is not a frontend,
"so the question cannot be answered from this store no matter how long it runs",
and that resolving it needs a human to name a consumer store. The first half is
correct. The second is not: the stores exist on this machine, are readable by
exactly the command the blocker prescribes, and were measured here.

Sweeping every store under `~/.claude/projects` (122 stores, 595 sessions) and
excluding the synthetic `scale-history-*` harness directories:

| | |
|---|---|
| stores containing a UI write | 10 |
| sessions scanned in those stores | 166 |
| sessions containing a UI write | **16** |
| UI-write turns | **275** |
| consultation rate | **0.0 % (0/275)** |
| discharge proxy (review opened) | 0.0 % (0/275) |

The largest single contributor is one application repo at 7 UI-write sessions and
184 UI-write turns; a second application repo, a stats service and three of its
worktrees supply the rest. Seventeen synthetic `scale-history-*` temp stores each
hold exactly 1 UI-write turn; counting them would reach 33 sessions / 292 turns
and cross the pre-registered floor of 20 sessions on harness fixtures rather than
on organic UI work, so they are **excluded** and reported separately here.

Reproduce without naming any local project — the loop measures whatever the
machine holds:

```bash
for d in ~/.claude/projects/*/; do
  ./scripts-run src/scripts/report_consultation_rate --store "$d" 2>/dev/null \
    | grep -E "sessions with a UI write|UI-write turns|CONSULTATION RATE"
done
```

**What this closes and what it does not.** The substantive question — is the
consultation rate measurable over a corpus containing UI work — is answered:
yes, and the answer is zero over 275 turns. The blocker's literal resolution
condition ("a store with ≥ 20 sessions containing UI writes") is **not** met:
no single store reaches 20, and the real-store aggregate is 16, four short. The
finding is therefore recorded as a narrowing, not as a clean satisfaction, and
the residual is exactly "4 more UI-write sessions, or one store with 20".

## 4. Instrument sensitivity — proven, not assumed

A 0 % rate over 275 turns is indistinguishable from a predicate that never
matches anything, so the predicate was made to fire before the zero was
believed. Two levels:

- **Unit.** `npx vitest run tests/scripts/consultation_rate.test.ts` — 36 tests
  pass, several asserting `consulted: 1`.
- **End-to-end.** A two-session synthetic store: session 1 reads
  `src/skills/fe-design/SKILL.md` and then writes `src/components/Card.tsx`;
  session 2 writes `src/components/Bare.tsx` with no prior read. The analyzer
  reports **`CONSULTATION RATE 50.0% (1/2)`**. The pipeline discriminates.

**The sensitivity has a stated ceiling, and it bounds the claim.**
`isConsultation` requires a tool event carrying a *file path* under
`skills/{fe-design,existing-ui-audit,design-review,design-intelligence}/`
(`src/scripts/hooks/ui_route_nudge_hook.ts:117-121`), and `toolUseToEvent`
returns `null` for any part without one. A skill invoked through the host's
`Skill` tool carries no file path and is therefore invisible to this numerator.
So 0/275 is precisely "no UI-write turn was preceded by *reading a file inside* a
design skill", which is a lower bound on consultation, not a measurement of it.
Both error directions point the same way as the analyzer's own
read-before-write caveat: the true consultation rate is **at least** what is
printed. For a zero, that is the harmless direction — a lower bound of zero
cannot hide consultation that happened *more* often than measured only if the
predicate can see it at all, which § 4 establishes it can.

## 5. The two catalogue verdict classes stay separate

Required by the disposition and correct on the evidence: `no-selector` and
`insufficient-observation` are different states and are not aggregated.

| Verdict | Rows | Host | What it means |
|---|---|---|---|
| `no-selector` | 1 | claude | The instrument observed a real split (16 bare, 19 described of 336) and **found no separating property**. All 16 bare entries declare a `description:`; described entries reach position #325 while bare entries start at #45, so no head-N budget explains it. A measured null. |
| `insufficient-observation` | 6 | codex | The instrument **could not observe** the split at all: `bare_count: 0`, `described_count: 0`. Not a null about the selector — an absence of the observation the null would need. |

Aggregating them would report "7 observations, no selector found" and convert
six non-observations into evidence for a negative. That is why the split is
carried into the roadmap's blocker entry verbatim rather than summarised.

**Retained as mechanism evidence**, per the disposition: the six codex rows
publish the host's own truncation behaviour (`budget-strip-and-drop`, 330–402
entries dropped). That is a statement about *how* the catalogue is assembled,
which the "selector is host-internal" framing in the baseline document could not
supply. It is evidence about the mechanism even though it is not evidence about
the selector.

## 6. Estate reduction did not restore descriptions

A finding that closes Phase 2 Step 2's conditional rather than leaving it
hanging. Scoped skill projection shipped (owned by `road-to-catalogue-host-fit`,
not by this roadmap). The post-scoped observation — 2026-08-16, codex,
`projection_mode: "scoped"` — reads `projected_skill_count: 226` against a legacy
297, and still reports `entries_total: 426` with `dropped_count: 330` and verdict
`insufficient-observation`.

So the estate shrank by roughly a quarter and the host still dropped about four
fifths of the catalogue. Estate reduction alone is **not** the delivery fix. This
does not identify the selector; it removes one candidate.

## 7. What this finding does not claim

- Not that design skills are ineffective — nothing here measures output quality.
- Not that the nudge does or does not work; there is no intervention arm.
- Not that the selector is unknowable; only that 7 observations across 2 hosts
  have not found it and 6 of them could not look.
- Not a discharge rate. Its definition is a property of prose and prose-matching
  is a stated non-goal; the proxy in § 3 is reported under its own name.

## 8. Incidental finding — two archival gates disagree about open blockers

Surfaced by closing this roadmap, and recorded because it is a live inconsistency
rather than an artefact of this change.

`archive_completed_roadmaps.ts` refuses to archive a roadmap whose steps are all
closed while a blocker is still open, and its comment states the principle
precisely: *"An unresolved blocker outlives its steps. Closing every box does not
answer a question the roadmap raised for a human."*
(`src/agent-src/scripts/archive_completed_roadmaps.ts:338-354`).

The CI backstop does not apply that carve-out. `agent-config roadmap:progress-check`
counts steps only and flags such a file as a violation regardless of blocker state.
So a roadmap in the state the sweep deliberately protects is a state the backstop
reports as broken. Whichever is right, the two should agree: either the backstop
learns the open-blocker carve-out, or the sweep's comment describes a policy the
pipeline does not hold.

**Measured in both directions, because the instance has since gone.** While
`ui-session-capture-window` was still open, the sweep printed
`1 blocker(s) still open (ui-session-capture-window) — not archived` for this file
and `progress-check` exited 1 on the same file — the contradiction, live. After the
blocker was resolved as transferred, the sweep reports
`Would archive: … road-to-frontend-skill-application.md`, so the two agree here
now. The only other file `progress-check` flags,
`road-to-release-review-p0.md` (12/12), carries **no blocker entries at all**, and
the sweep omits it purely through `changed_only` branch scoping — `--all --dry-run`
offers to archive both. So the defect is **latent**: the contracts still differ,
and nothing in the tree instantiates the difference today.

Not fixed here — touching a shared gate to make one's own closeout green is the
wrong order of operations.

**Consequence for this roadmap, stated plainly:** it is closed out and
deliberately **not** archived per instruction, so `roadmap:progress-check` is red
locally on this branch by construction. That red is the archival instruction, not
a missed step and no longer the disagreement above.
