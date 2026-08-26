# Inbox verification — `mixed-analysis`, 2026-08-27

A record of what an inbox drop of 24 files claimed, what survived verification
against this tree, and what was already owned. Written so the next harvest that
meets the same source does not re-derive any of it.

- **Input:** `agents/tmp.old/mixed-analysis/` — 24 files, ~250 KB, produced by an
  external analysis session on 2026-08-27.
- **Provenance stated by the source:** drafted against `main` at `3738c23e3`.
  Verified: exactly one commit merged between that pin and the HEAD this
  verification ran on (`0be1cf6b7`, PR #1680), so the staleness window is one
  commit and almost every claim is evaluable rather than overtaken.
- **Output:** two roadmaps —
  `agents/roadmaps/road-to-turn-bound-authorization-integrity.md` and
  `agents/roadmaps/road-to-composition-before-creation.md` — plus this record.
- **Sources named in the drop:** eight external repositories and two preprints.
  They are not named here; per `source-confidentiality` they are referred to by
  role only. Nothing in either emitted roadmap carries a derivation attribution.

## Triage

Two generations, both from the same session. The second supersedes the first,
and the first is the second's own input set — so only the second was read at
depth.

| Generation | Files | Disposition |
|---|---|---|
| First, 00:12–00:32 | `00-deep-analysis`, `01-three-review-loops`, `02-architecture-reframe`, `03-three-new-challenge-loops`, `MASTER-ROADMAP`, eight `road-to-*` drafts, `roadmap-00A/00B/08` | superseded — consumed by the second generation, which cites them by name in its own source list |
| Second, 00:44–00:45 | `00-DEEP-REANALYSIS`, three `LOOP-*` challenge files, `FINAL-ROADMAP`, `SOURCES`, `chat.txt`, `road-to-extensible-ac-consolidated-master` | read at depth; `FINAL-ROADMAP` is the actionable artefact |

`FINAL-ROADMAP` restructures the first generation's "ten mostly independent
roadmaps" into one program with eight tracks (growth spine, runtime composition,
human output, knowledge, provider routing, workflow, security, continuous
harvest). The verification below is per track.

## The headline finding

**Roughly seventy per cent of the eight tracks is already owned by this tree** —
by a shipped mechanism, by an active or parked roadmap, or by a recorded
decision that is stronger than what the source proposes. The estate holds 66
parked roadmaps, about twenty of them harvest roadmaps from earlier cycles, and
the source's own third challenge loop asks whether more per-package analysis
"will actually produce more insight, or only more roadmaps, terminology, and
merge conflicts". Measured against this tree, the second reading is the better
supported one.

That is not a criticism of the source. It is drafted against a repository whose
`agents/` tree is largely invisible from outside, so it could not have seen the
parked estate. It is exactly the failure mode `/analyze:inbox` exists to catch
before the work is planned.

## Per-claim verification

`still-true` = the claim holds at HEAD. `already-fixed` = a mechanism or an owner
exists. `corrected` = the claim is right but its proposed remedy collides with
something here.

| Claim | Verdict | Evidence |
|---|---|---|
| A projection-mode selector exists with three modes | still-true, path corrected | `src/scripts/_lib/lean_projection_mode.ts:19` — the source put it at `src/scripts/` |
| `delivery` is not the shipped default | still-true | same file `:21`, `DEFAULT_LEAN_PROJECTION_MODE = 'eager-all'` |
| Runtime hook dispatch is centralised | still-true | `docs/contracts/hook-architecture-v1.md:210-226` — sequential, manifest order, stated reduction order |
| A shared redundancy taxonomy landed | still-true | `docs/guidelines/redundancy-taxonomy.md` |
| Recent drain evidence reports an authorization-ledger overwrite | still-true | `agents/evidence/pr-drain-run-summary.md:13`, `:116` — two authorization stalls |
| Overlap tooling exists and can be extended | still-true | `audit_overlap.ts`, `audit_skill_overlap.ts`, `report_layer_overlap.ts`, `skill_overlap.ts` |
| A canonical controlled vocabulary needs a hard lint | already-fixed | `lint_canonical_terms.ts`, 1,583 files scanned, 1,006 violations against a 1,007 ratchet |
| Relationship metadata is missing | corrected | `runtime_requires` (`skill.schema.json:45`) and `harness_compat` (`:37`) exist; `requires` is **reserved** for pack edges (`:48`) and reusing it makes a skill unassignable in the discovery manifest |
| Closure states for research candidates | still-true | no `open_proof_gap` / `ruled_out` token anywhere in `src/` or `docs/` |
| An eight-state security finding lifecycle | corrected | `check_finding_dispositions.ts` already ships a committed ledger with `fixed \| false_positive \| accepted_risk` plus rationale and `verified_by`; a parallel eight-state enum is the duplicate-terminology defect the source's own third pass names |
| A task execution envelope (`scope` / `risk` / `depth`) | still-true | no `runtime_level` or equivalent in `src/scripts/` or `docs/contracts/` |
| Make `delivery` observable, then migrate in stages | already-owned | `later/road-to-thin-flip-under-anchor-scoring.md` — three gates, two recorded failed measurements (36.2 % against a 48 % floor; a length-neutral rerun inconclusive at κ=0.46), ADR-202 |
| One automatic routing hop; a second router is an experiment | already-decided, more strongly | a second retrieval router was rejected by council on 2026-07-07; `later/road-to-deferred-rule-retriever.md` holds it behind three named re-open conditions |
| Merge state is not a correctness label | already-owned | `agents/roadmaps/road-to-evidence-gated-change.md` |
| A separately invokable prose detect/edit/preserve capability | already-fixed | the `humanizer` skill, plus `lint_output_slop.ts` and `lint_design_slop.ts` |
| Two preprints are cited for the disclosure-depth and merge-label claims | unverifiable | no network under this command's reproduction bound; carried as unverified, not as fact |

## Steps reproduced

| # | Step | How | Verdict |
|---|---|---|---|
| 1 | "Generate current inventory of skills, rules, commands, guidelines, hooks" | counted the directories | reproduced — 299 skills, 120 rules, 114 guidelines, 56 hook concerns |
| 2 | "Hard lint: enums, statuses, lifecycle values, command verbs, evidence terms, artifact types" | ran `lint_canonical_terms` | reproduced, and the premise is already satisfied — the lint exists and is ratcheted; the source's item is a scope extension, not a new mechanism |
| 3 | "Read the current dispatcher/resolvers and document the real order" | read the hook contract | diverged — hook dispatch order **is** documented; the rule and context load order across projection layers is not, so the item is half-owned and the surviving half is narrower than stated |
| 4 | "Repair the PR-drain authorization persistence defect" | read the writer | diverged, and the divergence is the finding — `git_authorization_hook.ts:28` states per-turn replacement is deliberate. The defect is the **input classification**, not the retention; "make it durable" would break a correct property to hide a different bug |
| 5 | "Adopt `implements / requires / extends / replaces / …`" | read the schema | unexecutable as written — `requires` is a reserved key; adopting the list verbatim breaks the discovery manifest |
| 6 | "Parallel read-only deep dives, one agent per external package" | not attempted | out-of-bound — the command's reproduction bound forbids network access |

The three ceilings (12 steps, 20 minutes, 3 attempts per step) did not fire;
step selection stopped at six because the remaining instructions were neither
paired with an asserted outcome nor phrased as reusable procedures.

## What was emitted, and why so little

Two roadmaps, from the residue that is genuinely new, verified and unowned.

1. **`road-to-turn-bound-authorization-integrity`** — from reproduced step 4. A
   verified defect with in-tree evidence and no owner: an agent-originated wake
   is processed as a user prompt and clears turn-bound git authorization
   mid-run. The remedy is corrected from the source's: classify the wake, do not
   make the ledger durable.
2. **`road-to-composition-before-creation`** — from the growth track, minus the
   six items dropped above. The one question nothing in the estate asks, with
   both of the source's collisions repaired in the roadmap body.

Everything else is either already owned or a duplicate. The estate stood at
`active_roadmaps 7 (floor 7, +0)` when this ran, so each addition costs a
recorded exemption line; adding eight tracks would have been the roadmap
explosion the source itself warns against.

## Not emitted, deliberately

- **The eight-track program as a program.** Its value is the framing, and the
  framing is recorded here rather than as a roadmap that would own nothing.
- **A second harvest wave.** The estate already holds about twenty harvest
  roadmaps in `later/`. A new wave before those are dispositioned adds inputs to
  a queue that is not being drained.
- **Runtime Commons, workspace persistence, a resident runtime.** The source
  correctly gates all three on real consumers; this tree has none yet, and
  `docs/contracts/no-runtime-boundary.md` plus ADR-124 already govern the
  question.
