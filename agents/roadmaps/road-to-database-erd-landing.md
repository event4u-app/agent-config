---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "One of four siblings split from a single inbox drop. This one exists because the analysis found a finished, tested capability sitting off-trunk that three of the four input proposals planned to build from scratch. Its disposition is landing, not building, which is a different task from every sibling and from anything in the current estate — rule 11 forbids folding it into the modeling roadmap that would otherwise have rebuilt it."
estate_growth_exempt: "Claims `open_blockers` 43 -> 44: ONE blocker, `erd-skill-cannot-clear-the-preamble-ceiling`, recording a MEASURED obstacle rather than an unanswered question. `check_preamble_payload_budget`'s grace ceiling leaves 17 tokens of headroom on origin/main (138,195 against 138,212) and the skill needs 53 -- measured in clean worktrees, including a probe that gutted the description to 12 tokens and was STILL one token over, because the catalog bucket costs 6 tokens for `\"- schema-erd: \"` before any description. Its config says the ceiling \"may never move UP\", so the addition is blocked on headroom, not on work. The blocker exists because the alternative is losing the measurement: without it the next attempt re-derives 5,456 lines of revalidation from scratch, which is the exact seven-day loss `agents/evidence/analysis/unlanded-finished-branch-2026-08-27.md` records. AI council 2026-08-27, 2/2, chose \"block until a separate payload-reduction change creates headroom\" over raising the ceiling or dropping the skill. This change adds NO skill and NO roadmap -- skill_count and active_roadmaps are unchanged."
---
# Road to database ERD landing

> **Source:** `agents/tmp.old/database-structure/` — an inbox drop of 2026-08-26
> whose defect register listed "no ERD capability" as defect D3. The claim is
> true of `origin/main` and false of the repository: the capability exists,
> complete and tested, on an unpushed branch. Verified against HEAD `1899f92b9`.

## Goal

The ER-diagram capability that already exists on `feat/schema-erd-diff` is on
`main`, validated against the gates that exist today rather than the ones that
existed at `release/14.6.0`, and its skill admission is recorded. When this is
finished, no future roadmap proposes to build a schema-to-Mermaid renderer,
because grep finds one.

## Context

Three of the four inbox proposals contain a phase for exactly this work —
"ERD-Artefakt + `schema_to_mermaid`", "Mermaid ERD", "ERD as a generated
artifact from one canonical source". All three would have written it from
nothing. The branch `feat/schema-erd-diff` already carries **5456 insertions
across 33 files**: `src/skills/schema-erd/SKILL.md` with `evals/triggers.json`,
`src/scripts/schema_erd/ir.ts` (SchemaIR v1 with validator and byte-stable
canonicaliser), four adapters (DDL, Prisma, tbls, Laravel), `diff.ts`,
`rename_scan.ts`, Mermaid and change-table renderers, a CLI entry point, and
**134 test cases** across four test files. Every step and every acceptance
criterion in its own roadmap is marked `[x]`, and that roadmap is archived on
the branch as fully closed.

It has never been pushed to `origin`. `git merge-tree --write-tree origin/main
feat/schema-erd-diff` reports **8 conflicts**, and the distribution is what
makes this roadmap short: `README.md`, `docs/CLAIMS.md`, `docs/architecture.md`,
`docs/featured-skills.md`, `docs/getting-started-by-role.md`,
`docs/governance-advantage.md` — all skill-count-bearing generated pages — plus
`agents/roadmaps/archive/INDEX.md` and `index.json`, which `main` deleted. There
are **zero** conflicts in `src/scripts/schema_erd/`, `src/skills/schema-erd/`
or `tests/`.

This is also a recurrence, and that is the reason the roadmap says so out loud.
The same requirement arrived on 2026-08-19 as `agents/tmp.old/erd-erp/` — a
Revision-2 proposal with its own file:line provenance. It was consumed from the
inbox, implemented on a branch, and then `road-to-session-closeout` step 7.2
("Land or discard the rescue set, one change per worktree") was marked `[x]`
while this branch was neither landed nor recorded as discarded. Of the three
outcomes a recurrence can have, this is the third: the disposition was right,
it was recorded, and the record did not reach anything that acts. The learning
this roadmap owes is in Phase 3.

Siblings, sharing the `road-to-database-` prefix: `-advice-correction`,
`-relational-modeling`, `-evolution-tactics`.

## Provenance

- **Source A** — an external LLM ideation thread, four analysis loops.
  `ENC1:n37Vvuk8AEZHmidSo1ARDeBqPO5FWZiPEx4xsRnKXAH77thamSR51BjdOweQ5TUIlnggpcFFOzga3s9St4+ubTH+2oYCB0dGDeGsbH8THloswnlYqqkRxFTPpieCd7bkBRr2PPGj2e3ngmPKlrpiaKpm1gm0GC3RxXY=`
- **Source B** — a second external LLM ideation thread, six loops plus a harvest
  of ten external skill collections.
  `ENC1:uwPcFwnylOcQB/u2WBmmK0YEXNGjYZuvh7DYzxJqJfQzfZDKOB0PxAHIYJ9EsrcG6wktnGWGlo0QBHBLCaHWOOPvdC1WC2eOY8FPM7LNO6r7nVD9kNcFK50kJAfO443D1QCLn2t89J0LOjVYwgjP8ZXmMX8Gv7tR0o33`
- Neither source found the branch. The Mermaid format decision they both
  proposed is, independently, already the tree's stated position:
  `src/skills/design-intelligence/references/integration-mapping.md:63` routes
  "a **DB schema / ERD** / entity relations" to "**mermaid**, never hand-placed
  SVG".

### Council convergence

AI council, 2026-08-26, members `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, 3 rounds, blind chairman. Convergent on landing over
re-derivation: *"the authored implementation and tests reportedly merge without
conflict, so the evidence favors preserving working code rather than recreating
5,456 lines"*. Both seats named the same risk and it shaped Phase 2 —
`codex-default`: *"the specific landing risk is **stale validation**: CI green
on `release/14.6.0` says nothing about current schema legality, estate limits,
packaging projection, generator invariants, supported Node versions, or
subsequently changed adapter contracts"*. `claude-sonnet-4-5` refused the
blanket conflict policy this roadmap's first draft carried: *"'Take main's side
on every regenerated surface' assumes deterministic identification of
'regenerated'… verify each conflicted file is wholly generated before applying
blanket conflict policy"*, which is now step 2.2. `codex-default` additionally
flagged that the skill this branch adds consumes the same zero skill_count
allowance the modeling sibling is arguing about — recorded as
`blocker: erd-skill-consumes-the-zero-allowance`.

## Gap table

| Proposed item | Verified state | Disposition |
|---|---|---|
| Build a schema → Mermaid `erDiagram` renderer | `render/mermaid.ts`, 225 lines, exists on `feat/schema-erd-diff` with round-trip tests | **CUT** — already built |
| Build a canonical schema model the ERD and the DDL share | `schema_erd/ir.ts`, SchemaIR v1 with validator and canonicaliser, 402 lines | **CUT** — already built |
| Read the schema from migrations / Prisma / DDL | four adapters, 33 files, 134 tests | **CUT** — already built |
| Diff two schema states with change status | `diff.ts` 498 lines + `rename_scan.ts` 209 lines, with the normalisation-class invariant enforced | **CUT** — already built, and richer than any proposal asked for |
| ERD as a skill vs. an artifact | the branch ships it as a skill (`src/skills/schema-erd/`), `install.default: false`, `trust.level: experimental` | **KEEP as a decision** — three proposals argued ERD must be an artifact and never a skill; the branch already decided the other way. Phase 1 records which position lands, it does not silently inherit one. |
| DBML export alongside Mermaid | not on the branch | **FOLD** into `-relational-modeling` — optional by every proposal's own verdict, and out of scope for landing |
| Land the branch | `merge-tree` reports 8 conflicts, all in generated surfaces, none in `src/` or `tests/` | **KEEP** — this roadmap |
| Make the roadmap-archive sweep re-depth relative links it moves | `check_references.ts` records 530 dead links across 147 archived roadmaps from exactly this cause | **CUT** — a real defect, unrelated to this branch, and its own change |

## Phase 1 — Establish what is actually being landed

- [ ] **1.1 Record the branch's contents against the current tree, not against its own claims.**
      Produce the file list, the insertion count, and the set of public surfaces
      it adds (one skill, one CLI entry point, one script directory, one eval
      file, five fixtures). State which of them are new paths and which touch
      existing files.
      verify: `git diff --stat origin/main...feat/schema-erd-diff` and
      `git diff --name-status origin/main...feat/schema-erd-diff` are both
      recorded, and the count of `A` entries matches the list.

- [ ] **1.2 Confirm the conflict set is confined to generated surfaces.**
      Re-run the merge probe against current `origin/main` — the earlier reading
      is from 2026-08-26 and `main` moves.
      verify: `git merge-tree --write-tree origin/main feat/schema-erd-diff | grep -c CONFLICT`
      and the conflicted path list contain no path under `src/scripts/schema_erd/`,
      `src/skills/schema-erd/` or `tests/`.

- [ ] **1.3 Decide skill-versus-artifact explicitly, and write the reason down.**
      The branch ships ERD as a skill; three inbox proposals argued it must be a
      generated artifact with no skill of its own, because the DB family already
      has a routing problem. The branch's own framing — `install.default: false`,
      `trust.level: experimental`, and a description that triggers on "show me
      the schema" — is a third position: an opt-in skill rather than a
      default-on one. Record which position lands and why; a landed branch is
      not an argument.
      verify: the decision and its reason are in this roadmap's Notes, naming
      the alternative that was rejected.

- [ ] **1.4 Check SchemaIR v1 against the contracts that exist now.**
      The branch's public shapes were designed against `release/14.6.0`. Read
      `ir.ts`'s exported types and the adapter interface against the current
      `src/scripts/_lib/persistence/` adapter shape and the current skill
      schema, and list every divergence.
      verify: the divergence list exists and is empty, or each entry names the
      file and the change needed.

## Phase 2 — Rebase and revalidate against today's gates

- [ ] **2.1 Rebase the branch onto current `main` before regenerating anything.**
      The merge base is `release/14.6.0`. Regenerating derived output from a
      stale branch deletes artifacts that landed on `main` in between — the
      generators write the whole tree from what the branch can see.
      verify: `git merge-base origin/main <rebased-ref>` equals
      `git rev-parse origin/main`, and this is confirmed **before** any
      generator runs.

- [ ] **2.2 Prove each conflicted file is wholly generated before taking main's side.**
      Six of the eight conflicts are documentation pages that carry skill counts;
      a page that is 80% generated and 20% hand-tuned would lose the hand-tuned
      fifth under a blanket policy. For each of the six, identify the generator
      that writes it and confirm the file has no hand-authored region, or
      identify the region and preserve it.
      verify: each of the six paths is recorded with the generator that owns it;
      any file without an identified generator is resolved by inspection, not by
      policy.

- [ ] **2.3 Regenerate in the correct order.**
      `task sync` then `task generate-tools` — the reverse order leaves
      projection integrity red. The two archive-index paths `main` deleted are
      resolved as deletions.
      verify: `bash src/scripts/condense.sh --changed` lists nothing, and
      `git status --short dist/ .augment/ .claude/` shows only intended paths.

- [ ] **2.4 Run the gates the branch has never seen.**
      Every gate added since `release/14.6.0` is unproven against this code. At
      minimum: frontmatter validation over the new skill, the skill floor, the
      packaging and projection checks, the source-size budget over the eight new
      script files, the estate gates, and the full test suite including the
      branch's own 134 cases.
      verify: `task ci` is green on the rebased branch, and the run is fresh —
      not a result carried from the branch's own history.

- [ ] **2.5 Confirm the 134 tests still test something.**
      A suite that passes because its fixtures were removed or its assertions
      became vacuous is worse than a missing suite. Sabotage one adapter and one
      renderer invariant, confirm the suite goes red, restore.
      verify: the two sabotage probes are recorded with the failing test names,
      and the suite is green again after restore.

- [ ] **2.6 Record the skill admission.**
      `check_skill_admissions` requires a line in
      `agents/decisions/skill-admissions.jsonl` with five answers, including
      `why_not_extend` measured against the 34 skills already in
      `family: backend-data`. The honest answer here is available and specific:
      no existing skill emits a diagram, and the capability is a renderer over a
      canonical model rather than advice.
      verify: `./scripts-run src/scripts/check_skill_admissions` exits 0, and
      the ledger line's `why_not_extend` names the surfaces checked.

## Phase 3 — Close the loop that let this sit for six days

- [ ] **3.1 Record why a finished branch went unlanded, as a finding rather than an anecdote.**
      The mechanism is identifiable: `road-to-session-closeout` step 7.2 required
      "a merged change or a recorded disposal" per rescued worktree and was
      marked `[x]` with neither for this branch. Write the finding to
      `agents/evidence/analysis/` — what the step asked for, what it got, and
      why the checkbox could be flipped anyway.
      verify: the evidence file exists and names the step, the branch, and the
      six-day gap.

- [ ] **3.2 Make an unlanded finished branch findable by something other than memory.**
      The analysis found this branch by scanning every local ref for commits
      absent from `origin/main` and ranking by database-relevant file count. That
      is a probe, not a mechanism. Either register the probe as a read-only
      command with a stated output, or state in one line why it should not exist
      — a repository with 40+ stale local branches has a signal-to-noise problem
      that a naive probe would make worse.
      verify: either the command exists and runs read-only, or the one-line
      reason is recorded in Notes with the branch count that motivates it.

## Blockers

### blocker: erd-skill-consumes-the-zero-allowance
- **Status:** open
- **Owner:** maintainer
- **Blocks:** step 2.6 and therefore the merge. Phases 1, 2.1–2.5 and 3 run
  without it.
- **What to do:** `check_estate_count` carries `skill_count` allowance **0**,
  annotated "no allowance, deliberately". This branch adds one skill, and the
  `-relational-modeling` sibling is separately arguing about whether it may add
  another. Landing this one consumes the growth exemption that sibling's Q3
  decision may also need, so the two cannot each assume it. Decide the total
  accounting: (a) this branch takes the exemption and the modeling sibling must
  extend an existing skill; (b) both take one, with two recorded exemptions;
  (c) this branch lands with the skill removed and only the scripts, deferring
  the skill to the modeling sibling's ownership decision. Option (c) is cheapest
  on the ledger and worst on reachability — a renderer with no skill is a script
  no agent routes to.
- **Resolved when:** the total `skill_count` accounting covering both this roadmap and `-relational-modeling` is recorded in `## Notes`, naming which of (a), (b) or (c) was chosen.
- **Recommendation:** (b) — two recorded exemptions. The two skills are unrelated capabilities and forcing either into an existing host to save a ledger line is the failure mode the admissions gate exists to surface, not to cause.
- **If you do nothing:** whichever of the two roadmaps lands second fails `check_estate_count` after its work is finished, and the cheap fix at that point is option (c) — a renderer with no skill, which no agent routes to.

### blocker: erd-branch-merge-is-a-git-op
- **Status:** open
- **Owner:** maintainer
- **Blocks:** the final merge only. Every verification step above runs on a
  branch and produces its evidence without it.
- **What to do:** the branch is checked out in
  `.claude/worktrees/schema-erd-diff` and has never been pushed. Rebasing it
  rewrites five commits somebody else authored, and pushing it is an operation
  no roadmap authorises on its own. Confirm the rebase-and-push, or nominate a
  different landing shape — a fresh branch cherry-picking the four
  implementation commits, leaving the archive commit behind, is the obvious
  alternative and avoids rewriting inherited history.
- **Resolved when:** either the rebase-and-push of `feat/schema-erd-diff` is authorised in a turn that says so, or `## Notes` records a replacement landing shape with the commits it carries.
- **Recommendation:** cherry-pick the four implementation commits onto a fresh branch and leave the archive commit behind. It avoids rewriting five inherited commits and drops the archive-index conflict at the same time.
- **If you do nothing:** 5456 tested lines stay off-trunk, the capability is proposed again by the next analysis pass that cannot see the branch, and the six-day gap becomes a longer one.

### blocker: erd-skill-cannot-clear-the-preamble-ceiling

- **Status:** open
- **Owner:** maintainer
- **Blocks:** the merge, and only the merge. Every verification step in Phases 1,
  2 and 3 ran and produced its evidence — the cherry-pick is clean, the 134 tests
  pass, both sabotage probes fired, the admission is recorded, and
  `check_estate_count` is satisfied by this roadmap's own
  `estate_growth_exempt` claim. What cannot happen is the push.
- **Class:** 3
- **What to do:** `check_preamble_payload_budget`'s `grace_ceiling` is **138,212**,
  set to the exact measured total on 2026-08-24 with zero slack, and its config
  states "**It may never move UP**". Measured in clean worktrees:
  `origin/main` = **138,195** (−17), plus this skill = **138,248** (+36), plus
  the same skill with its description gutted to 12 tokens = **138,213** (+1). The
  floor is structural: the catalog bucket is `Σ "- <name>: <description>\n"`
  (`preamble_byte_census.ts:399`) and `"- schema-erd: "` alone is **6 tokens**, so
  17 tokens of headroom cannot hold a name plus a usable description. **No skill
  of any description lands until headroom exists.** Pick one: (a) land a separate
  payload-reduction change first, then this — the council's own fallback; (b) ship
  the scripts and tests without the skill, which the council refused 2/2 on
  reachability but which does make `grep -rl "erDiagram" src/` non-empty and stops
  the capability being re-proposed; (c) reopen the grace ceiling's "may never move
  UP" invariant, which is a maintainer decision about a registered budget and was
  refused 2/2 here.
- **Resolved when:** either `check_preamble_payload_budget` reports a measured
  total at least 36 tokens below 138,212 on `origin/main`, or `## Notes` records
  which of (b) or (c) was chosen and why.
- **Recommendation:** (a). The work is done and verified; it is waiting on
  headroom, not on effort, and the 5,456 lines are safe on
  `feat/schema-erd-diff` plus the cherry-picked `drain/database-erd-landing`
  branch. Full measurement and the council reasoning:
  `agents/evidence/analysis/estate-payload-ratchet-collision-2026-08-27.md`.
- **If you do nothing:** the capability stays off-trunk and gets proposed a fourth
  time. It has already been proposed three times by sources that could not see the
  branch, and the seven-day gap in
  `agents/evidence/analysis/unlanded-finished-branch-2026-08-27.md` becomes a
  longer one — which is the exact failure Phase 3 exists to stop repeating.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | Stale validation — green CI at `release/14.6.0` is read as green CI today | implementation | The branch's own roadmap is archived as fully closed, which is exactly the artifact most likely to be trusted instead of re-run. Every gate added in the interval is unproven against this code: schema legality, estate limits, packaging projection, generator invariants, Node version, adapter contracts. | Phase 2 refuses the branch's own evidence: 2.4 requires a fresh full run on the rebased ref, and 1.4 diffs the public shapes against current contracts before the rebase begins. | Phase 2 — Rebase and revalidate against today's gates |
| 2 | Regenerating from the stale branch deletes work that landed since | implementation | The generators write the whole derived tree from what the branch can see. Running them before the rebase removes every skill, page and manifest entry added to `main` after `release/14.6.0`, and the diff looks like a legitimate regeneration. | 2.1 is ordered before 2.3 and its verify is an equality check on the merge base, not an impression. 2.3 fixes the generator order as well, because the reverse order reds projection integrity and invites a second wrong fix. | Phase 2 — Rebase and revalidate against today's gates |
| 3 | The blanket conflict policy silently drops hand-authored content | implementation | Six conflicts are documentation pages. "Take main's side, they are generated" is true of the skill counts and unverified for the prose around them. | 2.2 requires the owning generator to be named per file, and resolves by inspection where none is found. The step cannot be satisfied by asserting the class. | Phase 2 — Rebase and revalidate against today's gates |
| 4 | The 134 tests pass without exercising anything | implementation | A suite whose fixtures moved or whose assertions became vacuous is a false green, and it is the single artifact this roadmap most relies on to justify landing rather than rebuilding. | 2.5 requires two sabotage probes with the failing test names recorded. A suite never seen red has unknown sensitivity. | Phase 2 — Rebase and revalidate against today's gates |
| 5 | Landing consumes an allowance the modeling sibling also needs | product | Both roadmaps add a skill against an allowance of zero. If each assumes the exemption independently, the second one to land fails the gate after its work is done. | `blocker: erd-skill-consumes-the-zero-allowance` forces the total accounting before either merges, and names option (c) so the cheap-but-worse path is visible rather than discovered. | Phase 2 — Rebase and revalidate against today's gates |
| 6 | The same capability is proposed again next month | product | It was proposed three times in one inbox drop by sources that could not see the branch. Landing it fixes the grep; nothing yet fixes the class of finished-but-unlanded work. | Phase 3 writes the mechanism down as evidence and either registers a probe or records why one would be worse than none. | Phase 3 — Close the loop that let this sit for six days |

## Acceptance Criteria

- [ ] AC-1 — `src/skills/schema-erd/SKILL.md` and `src/scripts/schema_erd/` exist on `main`, and `grep -rl "erDiagram" src/ | wc -l` is greater than 0.
- [ ] AC-2 — `task ci` was run green on the rebased ref, after the rebase and after regeneration, and the run is recorded with its date.
- [ ] AC-3 — Two sabotage probes are recorded with the test names that went red, and the suite is green after restore.
- [ ] AC-4 — Each of the six conflicted documentation pages is recorded with the generator that owns it, or with the hand-authored region that was preserved.
- [ ] AC-5 — `./scripts-run src/scripts/check_skill_admissions` exits 0 and the ledger line for `schema-erd` answers `why_not_extend` against the `backend-data` family rather than in the abstract.
- [ ] AC-6 — `agents/evidence/analysis/` carries the finding from step 3.1, naming the closeout step, the branch and the gap.
- [ ] AC-7 — No sibling roadmap in this campaign contains a step to build a schema-to-Mermaid renderer, a schema IR, or a schema differ.

## Notes

The skill-versus-artifact decision from 1.3 and the probe-or-not reason from 3.2
belong here once taken.
