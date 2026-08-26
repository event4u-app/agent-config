---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
estate_offset_exempt: "No archive move is available in this change. The addition is the smaller half of a reduction: a six-document, roughly 5,400-line proposal bundle carrying 23 distinct work items produced one roadmap, because sixteen of the 23 were measured owned, locked, or already shipped and are recorded as prevented rather than planned. The predecessors on this axis, road-to-routing-assurance and road-to-composition-ratchet, are both already archived and cannot be retired again."
estate_growth_exempt: "Activation change (2026-08-26): this file flips status draft -> ready, so it now charges +1 on the count half, which read +0 for as long as it shipped draft. One-in-one-out is file-based and was already paid by the change that landed the file; the claim is re-stated here because it is diff-scoped and an earlier one cannot be banked. It also adds one blocker against a floor of 31, which carries no automatic allowance. Warranted on measurement: the skill ranker's CLI default points at a directory that does not exist in this repository and returns '(no relevant skills found)' with exit 0, which is the exact false negative the missing-skill-recovery rule was written to prevent; and the cross-skill link surface grew from a recorded 943 to a measured 976 while the only gate that checks it validates against the full tree. No open roadmap carries either item; grepped across all twelve active files and all 65 in later/."
---
# Road to skill-selection evidence — the ranker answers "nothing" and means "wrong directory"

> **Source:** `agents/tmp.old/agent-skills/` (2026-08-26), six proposal documents
> written against `06e7585`, and its predecessor bundle
> `agents/tmp.old/agent-skills.txt` (2026-08-22) on the same subject. External
> comparators are referred to as Source A–C per
> [`source-confidentiality`](../../src/rules/source-confidentiality.md).
> Every figure was re-derived at HEAD `3f4508a9b`. **Six of the bundle's six
> checkable numbers moved, and all six moved in the tree's favour** — they are
> recorded in § Prevented, because a plan built on a pessimistic premise plans
> the wrong size of work.

## Goal

The two skill-selection defects that are measurable at HEAD are closed, and the
one council decision this bundle's main workstream would have violated is
evaluated before anything is written against it. Finished means: the skill
ranker's default entry point either ranks or fails loudly, the cross-skill link
gate checks the shape a consumer actually receives, and the batch-backfill
question has a recorded verdict rather than an unread lock.

## Context — two live defects, one unread lock

**Defect 1 — the ranker's default entry point silently ranks nothing.**
`src/scripts/skill_tools/score_skill_relevance.ts:53` sets
`DEFAULT_SKILLS_DIR = ROOT/.agent-src.uncondensed/skills`, used at `:390` as the
argv default. **That directory does not exist in this repository** — it is a
pre-move path, and `src/scripts/audit_auto_rules.ts:69-70` says so in as many
words: *"Pre-monorepo this was REPO_ROOT/.agent-src.uncondensed/rules. Post-move
(ADR-017) source rules live under packages/*"*. Reproduced:

```
./scripts-run src/scripts/skill_tools/score_skill_relevance --task "review a pull request" --top 3
(no relevant skills found)
exit=0
```

The blast radius is narrower than it first reads, and the narrow version is the
one worth stating. The two real consumers resolve the root themselves —
`src/scripts/mcp_server/tools.ts:1246` calls `catalogue.resolveSkillsRoot` and
`src/scripts/hooks/skill_route_hook.ts:255-269` takes a `skillsDir` with a null
guard — so the MCP tool and the routing hook are unaffected. What is affected is
the direct CLI, which is exactly the path
[`missing-skill-recovery`](../../src/rules/missing-skill-recovery.md) sends an
agent down when the host catalogue is truncated. An empty result with exit 0 is
indistinguishable from *"no skill covers this"*, which is the one conclusion that
rule exists to forbid.

**Defect 2 — the link surface grew while the gate stayed full-tree.**
976 cross-skill body links measured at HEAD
(`grep -rEho '\]\(\.\./[a-z0-9-]+/SKILL\.md' src/skills --include=SKILL.md`).
The archived census in
`agents/roadmaps/archive/road-to-skill-link-integrity-and-manifest-sync.md:99`
recorded **943**. `check_references.ts:12-15` validates against the full tree; no
gate validates against a delivered subset, so a link that resolves here can dangle
in a pack-scoped install. That roadmap's Phase 1 shipped the full-tree gate and
closed its scoped half as an honest null — the per-pack half now sits in
`later/road-to-skill-ecosystem-security-and-conformance.md:123`, parked at queue
position 5 behind a family cap that is 2/2 full. The per-tier and standalone
shapes are owned by nobody.

**A lock the bundle does not mention, and its main workstream needs.**
The bundle's largest item is a catalogue-wide backfill of `triggers.json` from 94
skills to all 299. `agents/roadmaps/archive/road-to-composition-ratchet.md:69-74`
records the opposite verdict verbatim: *"New disposition — scope: batch backfill
of `triggers.json` over the grandfathered skill set. **Rejected.** revisit-if:
real consumer misfire data names specific skills (backfill exactly those).
Settled-by-decision."* Its gap table at `:84` repeats it: *"Expand trigger-evals
across the existing catalog (backfill) | CUT | synthetic without users."*
Per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), that
record is evaluated before it is cited **or** ignored — and its reopen condition
is narrow: real misfire data naming specific skills, not a general wish for
coverage.

## Prevented — the six numbers, and the items they de-scope

Recorded rather than dropped, because three of the bundle's phases are sized on
them.

| The bundle's figure | Measured at HEAD | Effect |
|---|---|---|
| routing coverage `skills 76/299 = 0.254` | **94/299 = 0.3144**, and the seed already read `0.301` at the bundle's own pin, with `history[0]` recording the `0.2542 → 0.301` move | the coverage phase is sized against a number that was stale before the bundle was written |
| `compute_skill_tiers` disagrees with host observation on **4 of 8** | `tests/scripts/host_listing_model.test.ts:196` says *"five of eight … three known disagreements"* — already at the pin | the contradiction is smaller than claimed |
| **15** hooks in `src/scripts/hooks/` | **45** files, 53 registered concerns, at HEAD **and** at the pin | the transport-cost argument the bundle builds on this gets *stronger*, not weaker |
| `/build` points at **12** existing commands | **61** commands | — |
| counter-pressure at **10/299**, red-flag sections at **5/299** | **9** and **3** | premise holds, numbers do not |
| *"there is no prompt→skill trigger eval at all"* | `description_route_check.ts`, `.github/workflows/description-route.yml`, 90 `triggers.json`, `check_routing_coverage`, `check_trigger_eval_presence` and `skill_trigger_eval` all existed **at the pin**; a live run emits real `BLOCK` lines | the phase proposing to build it is a rebuild of a shipped surface |

Two further items are de-scoped on population rather than on number:
`requires_skills` carries **5 of 299** skills, so the composition-case item has no
input; and behavioural evals are not missing — 42 `evals.json`, a runner, and two
freshness gates ship, with coverage at rich 4/4, default-surface 29/29, router
2/2, priority 35/35 and **7/264 in the unprioritised rest**. That 2.7 per cent is
the real defect and it is already owned by
`road-to-skill-ecosystem-eval-integrity`.

**Three routing targets in the bundle point at nothing.** `road-to-one-spine`,
`road-to-code-intelligence-master` and `road-to-active-routing` do not exist as
roadmap files anywhere in the estate. With the family cap at 2/2 and the estate
at `+0` headroom, "routed to X" and "dropped" are the same outcome when X is not
a file.

## Non-goals

- **A second `doctor` verb.** `road-to-skill-ecosystem-runtime-enforcement:87-93`
  already claims `agent-config doctor` and
  `later/road-to-skill-ecosystem-executable-payloads.md:266` claims
  `agent-config doctor --skill=<id>`. Four `*_doctor.ts` scripts already ship.
- **A second maturity ladder.** `ADR-018:70,119,136` holds `trust:` as a closed
  enum; a parallel ladder is forbidden, and anything here would be a *report* over
  the existing field.
- **A third catalogue-wide backfill attempt** before the lock above is evaluated.

## Phase 1 — make the ranker fail loudly instead of quietly

- [x] **1.1 Repoint or remove the stale CLI default.**
      Either resolve the skills root the way the two real consumers already do —
      `catalogue.resolveSkillsRoot` — or drop the default and require the flag.
      What must not survive is a default that resolves to a non-existent path.
      verify: `./scripts-run src/scripts/skill_tools/score_skill_relevance --task
      "review a pull request" --top 3` returns ranked rows, or exits non-zero
      naming the unresolved directory. The current output — `(no relevant skills
      found)` with exit 0 — is the state this step removes.

      **DONE — repointed to `resolveSkillsRoot`, the resolver the two real consumers already use.** Defect reproduced first: `--task "review a pull request" --top 3` printed `(no relevant skills found)` and **exit 0**, on a task that scores 47 against the real catalogue. After: three ranked rows. Repointed rather than dropped, because requiring the flag would move the failure from the CLI to every caller — and the shared resolver is shared on purpose: two resolvers over one catalogue is how a ranker and the tool that exposes it start ranking different trees.

- [x] **1.2 Make "no matches" and "no catalogue" distinguishable at every entry point.**
      `missing-skill-recovery` already distinguishes a ranked empty list from an
      unreachable catalogue (`status: no_catalogue`) for the MCP tool. The CLI
      does not. Give it the same two outcomes.
      verify: a run against a real skills root with a nonsense task prints the
      empty-result form; a run against a missing root prints the no-catalogue
      form; the two differ in exit code.

      **DONE, and there are THREE states, not two — the third is the one that actually bit.** `.claude/skills` is a gitignored projection, so a worktree that never ran `generate-tools` has a root that **EXISTS and is EMPTY**. `resolveSkillsRoot` accepted it, and the ranker reported an empty catalogue as an empty result all over again through a second door. Measured live in this run: that worktree ranked zero skills and exited 0 on the same task that scores 47 against `src/skills`.

      So `resolveSkillsRoot` now requires a NON-EMPTY directory, and the CLI reports `no_catalogue` with **exit 3** for all three deficits — missing, empty, unreadable — each naming which. The check covers an **explicit** `--skills-dir` too, not only the default: an operator passing a wrong path is in exactly the position the silent failure was about, and answering them with `(no relevant skills found)` is the same wrong answer with a different cause. `--json` carries `status: no_catalogue` and **no `ranked` key at all**, so a consumer cannot read an absent catalogue as an empty ranking.

      The two other consumers of `DEFAULT_SKILLS_DIR` were patched too, and deliberately NOT with `?? ''` — an empty string re-creates the exact defect. They fall back to a literal `<no-skills-catalogue>` sentinel that can never resolve.

- [x] **1.3 Pin the regression.**
      A test that fails if the default resolves to a directory that does not
      exist in the repository. The defect survived because nothing looked.
      verify: the test fails when `DEFAULT_SKILLS_DIR` is reverted to the
      pre-move path, and passes after 1.1. Sabotage it once and record that it
      went red — a test never seen red has unknown sensitivity.

      **DONE — 9 tests, and sensitivity proven exactly as the step demands.** Reverting `DEFAULT_SKILLS_DIR` to the pre-move path reds **2 of 9**; restoring it returns 9. The step's own words — *a test never seen red has unknown sensitivity* — so it was sabotaged once and the result is recorded here rather than asserted.

      Coverage is wider than the step asked because the empty-root state was found during the work: the default resolves to a directory that exists, the default path ranks real rows with no flag at all, `resolveSkillsRoot` skips an empty candidate and falls through to the next, and the three CLI outcomes differ in exit code with `--json` carrying a machine-readable status.

## Phase 2 — check links against the shape a consumer receives

- [x] **2.1 Re-measure and publish the link surface.**
      976 today against 943 recorded. Publish the current count, the delta, and
      the command, so the next reader compares rather than re-derives.
      verify: an evidence file carries the number, the date, and the verbatim
      grep — including the note that a trailing `\)` in the pattern yields 974
      and misses two anchor links.

      **DONE — `agents/evidence/analysis/skill-link-surface-2026-08-26.md`.** **976** links across **299** delivered skills; **+33** against the previously-published 943, and that is corpus growth rather than a correction — no link was found to have been miscounted. The verbatim grep is in the file.

      The trailing-paren note is recorded and acted on rather than just noted: `\]\(\.\./[a-z0-9-]+/SKILL\.md\)` yields **974**, missing two links that carry an anchor. Two of 976 is 0.2 % and easy to write off; it should not be, because an anchored link is the shape most likely to rot — a heading renames without touching any path — and a checker blind to exactly that shape reports clean while missing the failure it is least able to catch otherwise.

- [x] **2.2 Validate links against one delivered subset.**
      One subset, not all of them: pick the narrowest real delivery shape and
      check that every cross-skill body link inside it resolves within it. The
      per-pack half belongs to the parked owner and is not taken here.
      verify: the check runs in CI, reds on a deliberately broken fixture link,
      and is registered in `src/config/gate-coverage.yml` with a `reportScanned`
      count and a `--self-test`.

      **DONE — `lint_skill_link_reach`, corpus `dist/agent-src/skills`.** What it adds over `check_references`, which already walks that tree: `check_references` reports a broken PATH, and cannot answer the question a consumer has — *does this link resolve in the tree I was given*. A link is not broken because its target is missing from the repository; it is broken because the target is missing from the SUBSET that shipped, and those are different failures with different fixes.

      Measured: 976 links, 299 delivered skills, **zero unresolved** — stated as a clean result rather than a discovery. The gate's value is that the next projection change cannot break it silently.

      Registered in CI (`consistency.yml`), in `task ci`, and in `gate-coverage.yml` with `reportScanned` (299), a `min_scanned` floor of **200** (a scoped projection can legitimately deliver fewer; below 200 the projection is broken rather than smaller), a create-only canary, and a `--self-test` of 4 cases, 3 rejecting — including the anchored link and an empty delivered tree, which is REFUSED rather than passed.

      **Per-pack delivery is deliberately NOT checked.** A link resolving across the whole delivered tree can still dangle inside one pack, and that half belongs to the parked owner per this step's own wording. A check that quietly widened to it would answer a question nobody asked here.

## Phase 3 — evaluate the lock before touching the corpus

- [x] **3.1 Read the composition-ratchet disposition and record a verdict.**
      `archive/road-to-composition-ratchet.md:69-74` and `:84`. Apply
      `decision-revisit-gate` step 2: read the record's status, its reopen
      condition, any amendment and any successor, then state one of — the lock
      stands, the lock does not apply because the proposed mechanism differs, or
      the reopen condition has fired and here is the misfire data.
      verify: the verdict is written down with the record's file:line and its
      reopen condition quoted, and it names which of the three it is.

      **DONE. THE LOCK STANDS** — and this is the first of `decision-revisit-gate` step 2's three outcomes, not a default taken for want of reading.

      The record, read rather than cited: `archive/road-to-composition-ratchet.md` carries `status: ready`, so it is not `superseded` or `deprecated` and is a live lock. No amendment, no successor. Its § New disposition reads verbatim:

      > *scope: batch backfill of `triggers.json` over the grandfathered skill set. Rejected. revisit-if: real consumer misfire data names specific skills (backfill exactly those). Settled-by-decision.*

      **Mechanism-match: CONFIRMED, which is the half that would have let it not apply.** The proposal is the catalogue-wide backfill the record rejected — the same mechanism, not a neighbouring one.

      **The reopen condition has NOT fired, and this was checked rather than assumed.** It requires *real consumer misfire data naming specific skills*. The only observation store that exists is `agents/evidence/metrics/skill-catalogue.jsonl`, 7 rows, and every row records catalogue DELIVERY counts (`entries_total`, `bare_count`, `described_count`) on two hosts. **No row names a skill, and no row records a wrong activation.** A delivery census is not misfire data; the condition asks for a named misfire and there is not one.

      Recorded against the roadmap's own recommendation, which argued that 94 of 299 is not the estate the rejection was written against and is therefore an argument for re-READING the lock. It was re-read, and re-reading is what produced this verdict.

- [x] **3.2 Decide the corpus question on that verdict, not around it.**
      If the lock stands, this roadmap adds no corpus work and says so. If it
      does not apply, the scope is whatever the differing mechanism actually is —
      not the catalogue-wide backfill by another name.
      verify: either a recorded no-op with the reason, or a scoped item whose
      scope is derived from 3.1's verdict.

      **DONE — a recorded NO-OP with its reason, which is what a standing lock earns.** This roadmap adds **no** corpus work: no `triggers.json` is authored, no allowlist entry is dropped, and no skill's trigger set is touched.

      That is the whole of it, and the discipline is in what did not happen. The tempting move — backfill a small, defensible subset and call it something other than the catalogue-wide backfill — is the one this step forbids by name: *"not the catalogue-wide backfill by another name"*. A lock rejecting a mechanism is not satisfied by doing a tenth of that mechanism.

      What WOULD unlock it is cheap and specific, which is why waiting costs little: one real misfire, named, with the skill it named. The observation log already exists to hold it.

## Blockers

### b-backfill-lock-authority — who may reopen the batch-backfill rejection

- **Status:** resolved
- **Resolved 2026-08-26 as (a) — the lock stands.** No further authority was
  needed, and the blocker's own wording says so: *(a) needs no further authority
  and is the default if nothing is decided*. What this run added is that it is no
  longer the default-by-silence — it is a verdict, recorded at step 3.1 with the
  record's `status`, its reopen condition quoted verbatim, the mechanism-match
  confirmed, and the misfire question CHECKED rather than assumed: the only
  observation store (`agents/evidence/metrics/skill-catalogue.jsonl`, 7 rows)
  records delivery counts and names no skill and no wrong activation.
  Neither (b) nor (c) was reached, so neither the council nor the owner was
  asked — (b) requires misfire data that does not exist, and (c) asks to lift a
  lock on grounds the record excluded, which nothing here argues for.
- **Status was:** open
- **Owner:** maintainer
- **Blocks:** 3.2
- **What to do:** pick exactly one — (a) the lock stands and no corpus work
  happens here, which needs no further authority and is the default if nothing is
  decided; or (b) the reopen condition has fired, which requires naming the real
  misfire data and the specific skills it points at, and is a council question
  under `decision-revisit-gate` because it preserves the record's own condition;
  or (c) the condition has not fired but the lock should be lifted anyway, which
  changes a recorded decision on grounds the record excluded and is therefore an
  owner decision.
- **Resolved when:** one of the three is recorded at the roadmap step, with the
  record's reopen condition quoted verbatim next to the verdict.
- **Recommendation:** (a) until misfire data exists. The lock's own condition is
  specific and cheap to satisfy later; satisfying it is a better use of a run
  than arguing the lock, and 94 of 299 is not the same estate the rejection was
  written against — which is an argument for re-reading it, not for ignoring it.
- **If you do nothing:** 3.2 has no verdict to act on, and the next incoming
  bundle proposes the catalogue-wide backfill again, because from outside the
  estate the rejection is invisible — it lives in an archived roadmap.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Phase 3 becomes a re-argument of the lock rather than a reading of it | product | The step is a verdict, and a run under pressure to produce work writes the verdict it wants instead of the one the record supports. | 3.1's verify requires the record's reopen condition quoted verbatim beside the verdict, and the blocker routes (b) to the council and (c) to the owner rather than letting either be self-issued. | Phase 3 — evaluate the lock before touching the corpus |
| 2 | 2.2 picks a subset that no consumer actually receives | implementation | A "delivered subset" chosen for convenience proves nothing about real installs, and the gate then certifies a shape nobody has. | The step takes the narrowest real delivery shape and names it; the per-pack half stays with its parked owner rather than being approximated here. | Phase 2 — check links against the shape a consumer receives |
| 3 | 1.1 repoints the default and the fix is never exercised | implementation | The CLI path is rarely run, so a wrong repoint would sit undetected exactly as the stale one did. | 1.3 pins the regression and requires the test to be seen red under a deliberate revert before it is trusted. | Phase 1 — make the ranker fail loudly instead of quietly |

## Acceptance Criteria

- [x] AC-1 — the skill ranker's CLI, invoked with no directory flag, either
      returns ranked rows or exits non-zero naming the unresolved directory; it
      never returns an empty list with exit 0.
- [x] AC-2 — an empty ranking and an unreachable catalogue are distinguishable
      at every entry point, by exit code and by message.
- [x] AC-3 — a regression test covers the default path and has been observed red
      against the pre-move path.
- [x] AC-4 — cross-skill links are validated against at least one delivered
      subset, in CI, with the gate registered and self-testing.
- [x] AC-5 — the batch-backfill disposition carries a written verdict quoting its
      own reopen condition, and any corpus work in this roadmap derives its scope
      from that verdict.
