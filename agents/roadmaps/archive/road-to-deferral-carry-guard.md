---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2027-03-31
relates:
  - slug: road-to-council-topology-evidence-followups
    relation: extends
    note: >
      That file is the worked instance: 38 obligations carried out of an
      archived parent, resting on a receiver no gate protects. This roadmap
      builds the protection and reclassifies it last.
estate_offset_exempt: "Not a new plan. This is the former stubs/ entry of the same name, promoted in place -- the same file, moved out of stubs/ -- and it archives in this same change once its phases close, so the active count returns to where it started. Promotion is authorised by AI council verdict 3Q (2026-09-02, anthropic/claude-sonnet-4-5 + openai/codex-default, 2 rounds, deep, peer-review, blind chairman, 2/2 present needed 1, subscription transport, billable=0, $0.0000), which held that the carrier -- not the receiver -- is the thing to complete and archive, and that leaving the carrier mechanically unprotected is an integrity defect rather than optional hygiene."
estate_growth_exempt: "active_roadmaps 2 -> 3 for the length of this change and back to 2 at its end, because the promoted file archives in the same PR. The receiver it protects is status: carrier, which the completion review's fix now COUNTS in active_roadmaps (a reclassification is not a disposal), so the flip is count-neutral and the net estate is unchanged for that reason rather than by exclusion. The growth is the cost of closing a defect the tree can state precisely: deleting a live deferral receiver reds nothing today and scores as an estate CREDIT (check_estate_count.ts:490-534), while 38 obligations rest on that file continuing to exist."
---
# Road to guarding a deferral carry after the parent is archived

> **Promoted from `stubs/` on 2026-09-02** by AI council verdict 3Q. The stub
> text below is preserved verbatim from § The gap onward — it is the evidence
> this roadmap acts on, and rewriting it would lose the derivation. What changed
> is the frontmatter and the phases; § Why it is not built here is superseded by
> § Why it is built now.

## Why it is built now

The stub's own reason for deferring was that *"the run that found this was
deciding one file's disposition, not extending the archival gate."* A later run
put the disposition to the council with the estate instruction in view, and both
seats refused to leave the carrier as found.

**The council's convergent core**, verdict 3Q, 2/2, 2026-09-02 (members
`anthropic/claude-sonnet-4-5` + `openai/codex-default`, 2 rounds, depth deep,
peer-review, blind chairman, quorum 2/2 present needed 1 — concluded;
subscription transport, `billable=0`, `$0.0000`; council artefacts are
gitignored and auto-pruned, so every line relied on is inlined here per
`no-roadmap-references`):

- The invariant belongs to the obligations, not to a pathname: *"A live deferred
  obligation must always have a validated carrier, and it may disappear from
  that carrier only through resolution or an explicit, validated transfer."*
- Position P — migrate the 38 obligations out of the roadmap estate — was
  refused because *"any Position P destination satisfying that invariant would
  effectively recreate Position Q under another name"*, and because the
  migration target is a semantic decision an autonomous run may not make.
- Plain 3A was refused: *"recognizing the file socially as a carrier does not
  protect it mechanically."*
- Protections ship BEFORE the reclassification. One seat's objection to the
  other's ordering is adopted: *"Reclassifying the file before the status
  parser, accounting rules, and guards recognize `carrier` may produce an
  invalid or unprotected intermediate state."*
- The full transition vocabulary — rename, re-parent, split, onward carry —
  stays deferred, and unsupported transitions must **fail closed** with a
  diagnostic rather than be inferred.

**One design choice diverges from both seats and is better than either.** Seat 2
required *"a durable registry, baseline comparison, or equivalent tombstone
mechanism"* because *"a validator that only scans surviving carriers has nothing
left to inspect"* once a whole file is deleted. That objection is correct and the
remedy is not a registry. **The archived parent is already the durable record.**
It carries `<!-- deferred-resolution: carried-to=<slug> -->` for every deferred
item, it lives under `archive/` where nothing rewrites it, and it names the
destination by slug. A validator that starts from the archived parents rather
than from the surviving carriers detects whole-file deletion on its first pass,
with no new baseline file to maintain and no second suppression surface. It also
reuses `deferralProblems` rather than reimplementing its checks, which is the
memory-twin drift the parent roadmap of the receiver already warned about.

## Phase 1 — a standing carry validator

- [x] **1.1 Add `lint_carrier_integrity`.** Walk every roadmap under
      `agents/roadmaps/archive/` and `agents/roadmaps/skipped/`, parse each for
      `deferred-resolution:` annotations, and call the EXISTING
      `deferralProblems` export
      (`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) with the
      source's basename slug, so destination resolution, the dead-destination
      refusal, the self-reference refusal and the `parent_roadmap:` back-link
      are all checked by one implementation rather than two. Report `scanned:`
      via `reportScanned` on both the green and the red path.
      verify: `./scripts-run src/scripts/lint_carrier_integrity` exits 0 on the
      clean tree and prints a non-zero `scanned:` count.
- [x] **1.2 Prove it discriminates, in both directions.** A `--self-test`
      through `_lib/gate_self_test.ts` with at least one rejecting case per
      failure mode the walk can see: destination missing, destination under
      `archive/`, back-link absent, back-link naming a different parent. Plus
      the polarity that must stay silent: a well-formed carry.
      verify: `./scripts-run src/scripts/lint_carrier_integrity --self-test`
      exits 0, reports at least 5 cases with at least 4 rejecting, and
      `check_gate_coverage`'s `gate-self-test:registered-non-adopters` count
      does not grow.
- [x] **1.3 Register it everywhere a gate has to be registered.** Six surfaces,
      in the order they bite: `src/config/gate-coverage.yml` row with a
      CI-identical `argv` and a `min_scanned` floor below the live count; that
      file's header prose numbers; the gate-script population figure the
      coverage test bounds; `taskfiles/ci-fast.yml` plus the `Taskfile.yml`
      `ci:` list, which `check_ci_local_parity` derives from both sides; a
      workflow step with the same argv; and the ledger ratchet, via
      `_lib/gate_ledger.ts` or an explicit `// ledger-exempt:` marker.
      verify: `./scripts-run src/scripts/check_gate_coverage` green,
      `./scripts-run src/scripts/check_ci_local_parity` green, and
      `./scripts-run src/scripts/check_gate_coverage --canary` fires on the new
      row rather than reporting it verified-empty.

## Phase 2 — the `carrier` status, and the accounting that must know it

- [x] **2.1 Teach the status vocabulary one new value.** Add `carrier` beside
      `draft` in the enumerations that decide whether a roadmap is schedulable
      work: `update_roadmap_progress.ts:99` (`DRAFT_VALUES`, which gates
      `collect()` and therefore the dashboard and `/roadmap:process-*`) and
      `check_roadmap_trackable.ts:51`. A carrier has no `## Phase` headings by
      construction, so trackability must exclude it exactly as it excludes a
      draft — this is the objection the stub's own rejected option 3 raised, and
      it is answered by a new status rather than by promoting the receiver to
      `ready`.
      verify: `./scripts-run src/agent-src/scripts/update_roadmap_progress` does
      not list the carrier, and `./scripts-run src/scripts/check_roadmap_trackable`
      is green with it present.
- [x] **2.2 Stop the estate paying for the deletion.** `classifyDiff`
      (`src/scripts/check_estate_count.ts:490-534`) scores removing a roadmap as
      an offset. A `status: carrier` file must score as neither an offset nor an
      active-count member: deleting it earns zero credit, so the only signal
      left is Phase 1's red.
      verify: a fixture case in the gate's own test table where deleting a
      carrier scores 0 credit, and `./scripts-run src/scripts/check_estate_count`
      green on this branch.

## Phase 3 — reclassify the receiver, last

- [x] **3.1 Flip `road-to-council-topology-evidence-followups` to
      `status: carrier`.** Only after Phases 1 and 2 are green, per the council's
      ordering. Update its § Unguarded-carrier gap to state what now guards it
      and what still does not.
      verify: the frontmatter reads `status: carrier`, Phase 1's gate is green,
      and the dashboard does not list it.
- [x] **3.2 Record what stays deferred.** A stub for the transition vocabulary —
      rename, re-parent, split, onward carry, partial resolution,
      carrier-to-carrier transfer — stating that unsupported transitions fail
      closed today and that the vocabulary arrives when a second carrier
      justifies it.
      verify: the stub exists under `agents/roadmaps/stubs/`, and
      `./scripts-run src/scripts/lint_roadmap_complexity` is green.

## The gap

A `[~]` step carried to a follow-up roadmap is validated **once**, at the moment
the parent is archived, and never again.

`deferralProblems`
(`src/agent-src/scripts/archive_completed_roadmaps.ts:414`) checks the carry from
both ends — annotation well-formed, destination exists, destination not dead,
`parent_roadmap:` back-link present. It has exactly **one** production call site
(`:574`), inside a loop over `collect()`
(`src/agent-src/scripts/update_roadmap_progress.ts:748`), and that loop skips
every `status: draft` file (`:755-757`) and everything under `archive/`,
`skipped/`, `stubs/` and `later/` (`:95`, `:315`).

So once the parent is archived, the check that created the receiver can never
see the pair again. Nothing else reads the annotation: `deferred-resolution`
appears in only two files under `src/`, and the second
(`src/scripts/lint_roadmap_complexity.ts:259`) is a warning string, not a
validator. `parent_roadmap:` has no reader outside
`archive_completed_roadmaps.ts`.

Neither reference gate closes it. `check_no_roadmap_refs`
(`src/scripts/check_no_roadmap_refs.ts`) forbids a *stable artifact* from citing
a roadmap and does not scan `agents/roadmaps/` or `agents/evidence/` at all;
`check_references` (`src/scripts/check_references.ts`) skips
`agents/roadmaps/archive` and matches only paths whose first segment is in a
fixed allowlist, which `stubs/` is not.

**Net:** deleting a live receiver reds nothing, and `check_estate_count`
(`classifyDiff`, `:490-534`) scores the deletion as an **offset** — a credit.

## The worked instance

`road-to-council-topology-evidence-followups` carries 38 obligations from a
parent that is already in `archive/`. Every one of the parent's 38 `[~]` steps
names it, and no gate stands between the receiver and its own removal.

## What would close it

One of these, in rough order of cost:

1. **A standing carry validator.** Walk every roadmap under `archive/` for
   `deferred-resolution: carried-to=<slug>`, assert the destination still
   resolves and still back-links. Diff-scoped so it costs nothing on most runs.
   The hard part is not the walk — it is that a receiver may legitimately be
   renamed, re-parented, or itself carried onward, so the check needs a
   disposition vocabulary it does not have today.
2. **Charge the deletion.** Teach `classifyDiff` that removing a roadmap which
   is some archived roadmap's `carried-to` destination is not an offset.
   Narrower, and it catches deletion but not silent emptying.
3. **Make the receiver non-draft.** Rejected for this instance: it reds
   `check_roadmap_trackable` (no `## Phase` heading) and the `relates:` ratchet,
   and it would claim the work is scheduled when every resumption trigger is
   unmet.

## Why it was not built at the time (superseded by § Why it is built now)

The run that found this was deciding one file's disposition, not extending the
archival gate. Option 1 changes a fail-closed gate that every archival passes
through, which is a change that deserves its own review rather than riding along
with a documentation correction.

## Evidence

[`agents/evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md`](../../evidence/analysis/topology-followups-disposition-evidence-2026-09-01.md)
§ 3 — the full derivation, the 43 inbound-reference census, and the gate-by-gate
read. Its appendix names what was not checked.

## Blockers

No blockers. Every step is an ordinary source change in `src/`, reachable by an
agent. The one thing this roadmap deliberately does NOT touch is any of the nine
kernel rules, so `block_kernel_rule_writes` never applies.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-02 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The new status becomes a laundering channel | product | `status: carrier` buys exclusion from the active count and from the drain. A roadmap that is really open work could wear it to disappear from the dashboard, which is the opposite of what the council asked for. | **This mitigation was false as first written and is now true — corrected on the completion review that measured it.** The claim was that a self-declared carrier "gains exclusion and gains a red at the same time"; the gate enumerated only ARCHIVED PARENTS and never enumerated self-declared carriers, so no red existed and the status was free. Measured then: a top-level roadmap with an open `- [ ]` step and no archived parent naming it was invisible to `lint_carrier_integrity` (`scanned: 0`), invisible to `check_roadmap_trackable`, exempt in `lint_plan_risk_register`, and absent from `check_estate_count.active_roadmaps` — and flipping one existing roadmap to the status moved `active_roadmaps 3 -> 2` while the gate printed "estate within its ratchet". What the gate does NOW: a SECOND enumeration walks every `status: carrier` roadmap under `agents/roadmaps/` and `agents/roadmaps/later/` and requires each to be named by some dead roadmap's `deferred-resolution: carried-to=<slug>` annotation. One that is not is a `broken-destination` hard failure at zero, proven in both polarities by two `--self-test` cases and by unit coverage over `auditCarries`. The estate half is closed separately: `active_roadmaps` now counts carriers (`countActiveCarriers`), so a status flip is count-neutral in both directions and cannot lower the measured floor. | Phase 2 — the `carrier` status |
| 2 | The validator walks the archive on every run and costs real time | implementation | `agents/roadmaps/archive/` holds 651 roadmaps. A naive full-text parse of all of them on every gate run is a per-commit cost paid by every contributor for a corpus that changes rarely. | **Corrected to what shipped, on the completion review that measured it.** The mitigation as first written said "read only the frontmatter and the annotation lines rather than parsing whole files"; the gate reads each file whole, because the annotation may sit anywhere in a step's continuation block and the candidacy filter needs the content to decide. The risk did not materialise — 0.28 s over 16 MB, measured — so the shipped design is a whole-file read of every dead roadmap, ONCE per run, plus the `scanned:` count in the ledger. What was genuinely wrong and is now fixed: the archive was WALKED TWICE per run (once for the ledger's plan, once inside `auditCarries`), so a run paid two readdirs and two `statSync` per archived file for one reading; the walk is now performed once and handed in. Phase 1.1's verify clause still requires a non-zero count, so an implementation that reads nothing is not accepted either. | Phase 1 — a standing carry validator |

## Acceptance Criteria

- [x] AC-1 — deleting `agents/roadmaps/road-to-council-topology-evidence-followups.md`
      makes a gate RED. Proven by the deletion, the red, and the restore — not by
      reading the code.
- [x] AC-2 — removing the `parent_roadmap:` back-link from that file, or
      renaming it, makes the same gate red.
- [x] AC-3 — the carrier does not appear on `agents/roadmaps-progress.md` and is
      not offered by `/roadmap:process-*`, while `check_roadmap_trackable` stays
      green with it present.
- [x] AC-4 — deleting a `status: carrier` roadmap scores zero estate credit,
      asserted in `check_estate_count`'s own case table.
- [x] AC-5 — the transition vocabulary that stays out of scope is recorded in a
      stub, and unsupported transitions fail closed today rather than being
      inferred.

## Explicitly NOT in this roadmap

- **The transition vocabulary.** Rename, re-parent, split, onward carry, partial
  resolution and carrier-to-carrier transfer all fail closed and stay deferred
  to the Phase 3.2 stub. Both council seats agreed a deliberately immobile
  first version is the right shape.
- **Migrating the 38 obligations anywhere.** Position P was refused; the
  obligations stay where they are.
- **Automated resumption-trigger monitoring.** Named by one seat as out of the
  minimum shippable set.
