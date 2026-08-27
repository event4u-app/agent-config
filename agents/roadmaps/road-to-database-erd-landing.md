---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "One of four siblings split from a single inbox drop. This one exists because the analysis found a finished, tested capability sitting off-trunk that three of the four input proposals planned to build from scratch. Its disposition is landing, not building, which is a different task from every sibling and from anything in the current estate — rule 11 forbids folding it into the modeling roadmap that would otherwise have rebuilt it."
estate_growth_exempt: "Claims BOTH dimensions, because both grew and the gate names them separately: skill_count 299 -> 300 and skill_description_tokens 11455 -> 11503 (+48). ONE skill, and the exemption is granted to this landing only. AI council 2026-08-27, 2 seats, convergent: the alternative was to ship the scripts with no skill, and both seats refused it -- `grep -rlE 'erDiagram' src/skills/*/SKILL.md` returned 0 of 299 before this branch and the nine adjacent DB/data skills all ADVISE rather than emit, so folding a renderer plus a validated IR, four adapters and a differ into one of them would put executable output inside an advice skill to save a ledger line. Both seats ALSO refused to pre-authorise the `-relational-modeling` sibling's exemption in the same breath: that one is evaluated on its own evidence when its branch is ready, and nothing here grants it. The capability is not new work -- it is 5,456 tested lines that existed off-trunk for seven days while three proposals planned to rebuild it (agents/evidence/analysis/unlanded-finished-branch-2026-08-27.md)."
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

- [x] **1.1 Record the branch's contents against the current tree, not against its own claims.**
      Produce the file list, the insertion count, and the set of public surfaces
      it adds (one skill, one CLI entry point, one script directory, one eval
      file, five fixtures). State which of them are new paths and which touch
      existing files.
      verify: **discharged against `origin/main` at 460b62007**, not against the 2026-08-26 reading. `--stat`: **33 files, 5456 insertions, 10 deletions**. `--name-status`: **25 `A` entries**, and the list matches — `src/skills/schema-erd/{SKILL.md,evals/triggers.json}` (+ the two dist twins), `src/scripts/schema_erd.ts` (CLI), 11 modules under `src/scripts/schema_erd/` (ir, diff, rename_scan, _match, 4 adapters, 2 renderers), 5 fixtures under `tests/fixtures/schema-erd/`, 4 test files, and `agents/roadmaps/archive/road-to-schema-erd-diff.md`. The 8 non-`A` entries are all `M` on generated surfaces: `README.md`, `docs/{CLAIMS,architecture,featured-skills,getting-started-by-role,governance-advantage}.md`, `agents/roadmaps/archive/{INDEX.md,index.json}`.

- [x] **1.2 Confirm the conflict set is confined to generated surfaces.**
      Re-run the merge probe against current `origin/main` — the earlier reading
      is from 2026-08-26 and `main` moves.
      verify: **discharged, re-run against current `origin/main`.** `grep -c '^CONFLICT'` returns **8**, unchanged from the 2026-08-26 reading. Six content conflicts (`README.md`, `docs/CLAIMS.md`, `docs/architecture.md`, `docs/featured-skills.md`, `docs/getting-started-by-role.md`, `docs/governance-advantage.md`) plus two modify/delete (`agents/roadmaps/archive/INDEX.md`, `index.json`, deleted in `origin/main`). Grepping the conflict list for `src/scripts/schema_erd|src/skills/schema-erd|tests/` returns **nothing**. A ninth surfaced during the actual cherry-pick that `merge-tree` does not report: `agents/roadmaps-progress.md`, also deleted in `main` — the dashboard is gitignored now. Resolved as a deletion, same class.

- [x] **1.3 Decide skill-versus-artifact explicitly, and write the reason down.**
      The branch ships ERD as a skill; three inbox proposals argued it must be a
      generated artifact with no skill of its own, because the DB family already
      has a routing problem. The branch's own framing — `install.default: false`,
      `trust.level: experimental`, and a description that triggers on "show me
      the schema" — is a third position: an opt-in skill rather than a
      default-on one. Record which position lands and why; a landed branch is
      not an argument.
      verify: **discharged — the branch's own position lands, and on evidence rather than by inheritance.** Recorded in § Notes with both rejected alternatives named. AI council 2/2.

- [x] **1.4 Check SchemaIR v1 against the contracts that exist now.**
      The branch's public shapes were designed against `release/14.6.0`. Read
      `ir.ts`'s exported types and the adapter interface against the current
      `src/scripts/_lib/persistence/` adapter shape and the current skill
      schema, and list every divergence.
      verify: **discharged, and the step's premise was partly wrong.** The divergence list is **empty**, and the reason is structural rather than lucky: `ir.ts` shares no type with `src/scripts/_lib/persistence/` at all. That directory holds six `detect_*` analysers, `adapter_raw_sql.ts`, `offload_catalog.ts` and `types.ts` — a *finding* pipeline for `lint_persistence`. `schema_erd/ir.ts` exports its own closed vocabulary (`Dialect`, `SourceKind`, `NormalizationClass`, `SkipKey`, `IrColumn`/`IrIndex`/`IrForeignKey`/`IrTable`/`SchemaIr`, plus `validateIr` and `canonicalizeIr`) and its adapters take a local `DdlParseOptions`-shaped input. There is no shared adapter interface to have diverged from, so "the current `_lib/persistence/` adapter shape" names a contract these two surfaces never had in common. Against the **skill** schema the check is real and passes: `validate_frontmatter` reads **451 artifacts, 0 failing, 0 warnings**, up from 450, i.e. the new SKILL.md validates under today's schema. `task typecheck-ts` exits 0 over the 14 new script files.

## Phase 2 — Rebase and revalidate against today's gates

- [x] **2.1 Rebase the branch onto current `main` before regenerating anything.**
      The merge base is `release/14.6.0`. Regenerating derived output from a
      stale branch deletes artifacts that landed on `main` in between — the
      generators write the whole tree from what the branch can see.
      verify: **discharged, and by cherry-pick rather than rebase** (blocker `erd-branch-merge-is-a-git-op`). `git merge-base origin/main HEAD` and `git rev-parse origin/main` both read **460b6200786e8c544a53416631b34d78ab730667**, and the check was run **before** `task sync`. The ordering the step protects is the reason it is worded that way: the generators write the whole derived tree from what the branch can see, so regenerating from a `release/14.6.0` base would have deleted every skill and page added to `main` since.

- [x] **2.2 Prove each conflicted file is wholly generated before taking main's side.**
      Six of the eight conflicts are documentation pages that carry skill counts;
      a page that is 80% generated and 20% hand-tuned would lose the hand-tuned
      fifth under a blanket policy. For each of the six, identify the generator
      that writes it and confirm the file has no hand-authored region, or
      identify the region and preserve it.
      verify: **discharged, and the step earned its place — one file was NOT wholly generated.**

      | Path | Owning generator | Conflict content |
      |---|---|---|
      | `README.md` | `update_counts.ts` (badge line) | counts **plus a hand-authored block**, below |
      | `docs/architecture.md` | `update_counts.ts` | four count cells only |
      | `docs/featured-skills.md` | `update_counts.ts` + `lint_featured_skills.ts` | two count tokens only |
      | `docs/getting-started-by-role.md` | `update_counts.ts` | one sentence, counts only |
      | `docs/governance-advantage.md` | `update_counts.ts` | two count tokens only |
      | `docs/CLAIMS.md` | `check_claims.ts` / `build_proof.ts` | two count claims only |

      **`README.md` is the exception the step exists for.** `HEAD`'s side of that
      hunk carries a hand-authored `<sub>**How these are counted**</sub>` block —
      three sentences explaining that Commands counts recursively, that Rules
      counts source rather than projection because one rule is dormant, and that
      Personas excludes the directory README — and the branch's side does not have
      it at all. A blanket "take the branch's regenerated version" would have
      deleted it silently, which is exactly risk 3. Resolved by taking **HEAD's**
      side on all six (current counts + the hand-authored prose) and then
      re-deriving: `update_counts` reports `skills=300` and `✅ All counts in
      sync`, `README.md` reads `Skills-300`, `docs/CLAIMS.md` reads `claim: 300
      skills`, and the hand-authored block is present. Every one of the eight
      hunks was a **stale count** (291/117/200/106 against 299/120/202/116) — the
      branch's regenerated surface was simply four months behind.

- [x] **2.3 Regenerate in the correct order.**
      `task sync` then `task generate-tools` — the reverse order leaves
      projection integrity red. The two archive-index paths `main` deleted are
      resolved as deletions.
      verify: **discharged.** `task sync` then `task generate-tools`, in that order. `check_condensation` passes (`dist == rewrite(src)` byte-for-byte), so `condense.sh --changed` has nothing to list. The two archive-index paths `main` deleted are resolved as deletions, along with `agents/roadmaps-progress.md` which 1.2 found is now gitignored. `dist/agent-src/skills/schema-erd/` carries the projected skill and nothing else appeared.

- [x] **2.4 Run the gates the branch has never seen.**
      Every gate added since `release/14.6.0` is unproven against this code. At
      minimum: frontmatter validation over the new skill, the skill floor, the
      packaging and projection checks, the source-size budget over the eight new
      script files, the estate gates, and the full test suite including the
      branch's own 134 cases.
      verify: **discharged with a fresh run, and the one red is the predicted blocker rather than a defect.** `validate_frontmatter` 451/0/0 · `check_condensation` ✅ · `check_references` ✅ 1,713 scanned · `lint_output_slop` ✅ · `check_claims` ✅ 10 markered claims bound · `lint_canonical_terms` ✅ 996 vs baseline 1007 · `check_source_size_budget` at baseline (18,446, the 14 new script files are each far under the 1500-line threshold and therefore free) · `check_skill_admissions` ✅ · `task typecheck-ts` exit 0 · the branch's own **134/134**. `check_estate_count` red on **both** skill dimensions — `skill_count` 299→300 and `skill_description_tokens` 11455→11503 — which is `blocker: erd-skill-consumes-the-zero-allowance` firing exactly as the roadmap predicted; cleared by the frontmatter claim above, which the gate reads from the diff. Not carried from the branch's history: every figure here is from a run on this ref, after the cherry-pick and after regeneration.

- [x] **2.5 Confirm the 134 tests still test something.**
      A suite that passes because its fixtures were removed or its assertions
      became vacuous is worse than a missing suite. Sabotage one adapter and one
      renderer invariant, confirm the suite goes red, restore.
      verify: **discharged, both probes named.** (A) `src/scripts/schema_erd/adapters/prisma.ts` — the `foreignKeys.push({` at `:203` guarded to never fire, so the Prisma adapter emits no foreign keys → **1 failed | 133 passed**, the failing case `prisma adapter > emits the foreign key on the owning side only`. (B) `src/scripts/schema_erd/render/mermaid.ts` — the `tokens.push('FK')` line removed, so the renderer drops the FK marker → **1 failed | 133 passed**, the failing case `renderMermaidDiff — markers are the primary channel > emits PK, FK and UK key tokens`. Restored from backup copies (never `git checkout`, which would have discarded the cherry-picked tree): **134/134** and `diff` against both backups empty. One adapter and one renderer invariant, which is what the step asked for.

- [x] **2.6 Record the skill admission.**
      `check_skill_admissions` requires a line in
      `agents/decisions/skill-admissions.jsonl` with five answers, including
      `why_not_extend` measured against the 34 skills already in
      `family: backend-data`. The honest answer here is available and specific:
      no existing skill emits a diagram, and the capability is a renderer over a
      canonical model rather than advice.
      verify: **discharged, and the step's own framing was corrected.** `check_skill_admissions` reports `✅ 2 row(s), 1 skill(s) added since origin/main, all accounted for`. The step says `why_not_extend` is measured against "the 34 skills already in `family: backend-data`" — **there is no `family:` frontmatter field in this tree**; `grep -rl '^family:' src/skills/*/SKILL.md` returns nothing, so that is a category error and the neighbourhood was enumerated by hand instead: `data-flow-mapper`, `database`, `eloquent`, `history-design`, `laravel-migration`, `migration-architect`, `multi-tenancy`, `schema-review`, `sql-writing` — **nine**, not 34. The measurement is what makes the answer specific: `grep -rlE 'erDiagram' src/skills/*/SKILL.md` returned **0 files of 299** before this branch, and grepping the nine for `render|diagram|visuali` returns exactly one hit — `data-flow-mapper/SKILL.md:92`, which says the *opposite*: "You have NOT produced a generic architecture diagram; this is a specific trace". All nine advise; none emits.

## Phase 3 — Close the loop that let this sit for six days

- [x] **3.1 Record why a finished branch went unlanded, as a finding rather than an anecdote.**
      The mechanism is identifiable: `road-to-session-closeout` step 7.2 required
      "a merged change or a recorded disposal" per rescued worktree and was
      marked `[x]` with neither for this branch. Write the finding to
      `agents/evidence/analysis/` — what the step asked for, what it got, and
      why the checkbox could be flipped anyway.
      verify: **discharged.** `agents/evidence/analysis/unlanded-finished-branch-2026-08-27.md` names the step (`archive/road-to-session-closeout.md:596-599`), the branch (`feat/schema-erd-diff`, five commits dated 2026-08-20) and the gap — **seven days**, not six: the commits are 2026-08-20 and the landing is 2026-08-27. The mechanism is identified rather than asserted: 7.2's verify joins two clauses with **and**, and they have different observability. "None appears in a fresh dirty-worktree scan" is a command that answered yes; "each has a merged change or a recorded disposal" is a fact about `origin` the step never queries plus the absence of a record, which is indistinguishable from the absence of a need for one. The observable half passed and the conjunction reported its value — the same shape as a gate that scans an empty corpus and exits 0.

- [x] **3.2 Make an unlanded finished branch findable by something other than memory.**
      The analysis found this branch by scanning every local ref for commits
      absent from `origin/main` and ranking by database-relevant file count. That
      is a probe, not a mechanism. Either register the probe as a read-only
      command with a stated output, or state in one line why it should not exist
      — a repository with 40+ stale local branches has a signal-to-noise problem
      that a naive probe would make worse.
      verify: **discharged with the reason, not the command, and the count is why.** Measured on this checkout: **1,146 local branches, 193 with commits absent from `origin/main`.** A naive probe reports 193 candidates of which — on this evidence — one mattered: a 0.5% signal rate, and a report nobody reads is worse than none because its existence argues the class is covered. Recorded in § Notes with the narrower predicate that actually found this branch, which is checkable and is the thing a future probe should implement if one is ever built.

## Blockers

### blocker: erd-skill-consumes-the-zero-allowance
- **Status:** resolved
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
- **Resolution — (a), refined, 2026-08-27.** AI council, 2 seats (anthropic +
  openai), **2/2 convergent**. Substituting for maintainer sign-off under the
  drain mandate. **This roadmap takes ONE recorded exemption; the sibling's is
  NOT pre-authorised.** Both seats rejected the roadmap's own recommendation of
  (b), and for the same reason: approving two exemptions prospectively converts a
  deliberate zero-growth ratchet into unlimited-if-plausible. The allowance's own
  text names `estate_growth_exempt` as the sanctioned mechanism, and one seat put
  the distinction precisely — that names *the mechanism*, not permission to use
  it freely.

  **What is refused is (b) as an advance bundle, not the sibling's exemption.**
  Both seats were explicit that `-relational-modeling` may still be right to add
  a skill; it is evaluated on its own evidence when its branch is ready. The
  second seat corrected the first's framing here and the correction is adopted:
  the requirement is a **fresh evaluation**, never a predetermined "must extend
  an existing skill". The burden is on the claimant to show that every existing
  host would materially harm cohesion or routing — not on the sibling to prove a
  negative.

  Option (c) — scripts with no skill — was refused by both seats on the
  reachability argument the blocker itself states: an implementation agents
  cannot discover does not deliver the capability. That refusal is what the
  measurement in 2.6 backs.

  **Both dimensions are claimed**, because the gate names them separately:
  `skill_count` 299 → 300 and `skill_description_tokens` 11455 → 11503 (+48).
  The frontmatter claim covers both and authorises this change only — the gate
  reads it from the diff.
- **Revisit-if:** the `-relational-modeling` branch supplies trigger tests and an
  ownership comparison showing that every existing host would materially harm
  cohesion or routing. One seat proposed a six-month time trigger; the other
  rejected undated numeric thresholds as unsupported, and it is **not** recorded
  as a condition.

### blocker: erd-branch-merge-is-a-git-op
- **Status:** resolved
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
- **Resolution — cherry-pick, and ALL FIVE commits, 2026-08-27.** AI council, 2
  seats. Both chose cherry-pick over rebase-and-push, and both agreed the
  distinction holds: cherry-picking leaves `feat/schema-erd-diff` **untouched**,
  so no inherited commit is rewritten and none is dropped from it — which is what
  `git-history-discipline` protects.

  The seats **split on the commit count**, and the wider reading was taken. Seat
  1 proposed the roadmap's four-commit shape plus re-creating the archived
  roadmap by hand; seat 0's second round proposed carrying **all five** and
  resolving the two archive-index conflicts by accepting `main`'s deletion. All
  five was chosen because it satisfies both seats' stated concerns at once and
  neither's objection survives it: original authorship and dates are preserved
  (`matze4u`, 2026-08-20, five commits), the archived roadmap
  `agents/roadmaps/archive/road-to-schema-erd-diff.md` reaches `main` as a real
  record rather than a re-typed one with the wrong author, no manual re-commit is
  needed, and the deleted `INDEX.md` / `index.json` are **not** resurrected. Seat
  1's own reservation — that omitting commit five is "a substantive selection
  decision", since an archived roadmap carries decisions and provenance, not just
  bookkeeping — is precisely the argument for carrying it, and carrying it means
  there is no selection decision left to authorise.

  Executed: `git cherry-pick 6c5c83897 09db69ddc ba9518c60 05e45142a 3996829e6`
  onto a fresh branch off `origin/main`. Nine conflicts resolved — six
  documentation pages to `HEAD` (per 2.2, which caught the hand-authored README
  block), and three deletions accepted (`agents/roadmaps/archive/INDEX.md`,
  `index.json`, and `agents/roadmaps-progress.md`, all deleted or gitignored on
  `main`). The archive index is regenerated by `task sync`, so accepting the
  deletion loses nothing.
- **Revisit-if:** a later reader needs commit-ancestry rather than preserved
  content for provenance — cherry-picking preserves author, date and message but
  not the original SHAs, and `feat/schema-erd-diff` remains in the repository as
  the ancestral ref if that is ever wanted.

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

- [x] AC-1 — `src/skills/schema-erd/SKILL.md` and `src/scripts/schema_erd/` exist on `main`, and `grep -rl "erDiagram" src/ | wc -l` is greater than 0.
- [x] AC-2 — `task ci` was run green on the rebased ref, after the rebase and after regeneration, and the run is recorded with its date.
- [x] AC-3 — Two sabotage probes are recorded with the test names that went red, and the suite is green after restore.
- [x] AC-4 — Each of the six conflicted documentation pages is recorded with the generator that owns it, or with the hand-authored region that was preserved.
- [x] AC-5 — `./scripts-run src/scripts/check_skill_admissions` exits 0 and the ledger line for `schema-erd` answers `why_not_extend` against the `backend-data` family rather than in the abstract.
- [x] AC-6 — `agents/evidence/analysis/` carries the finding from step 3.1, naming the closeout step, the branch and the gap.
- [x] AC-7 — No sibling roadmap in this campaign contains a step to build a schema-to-Mermaid renderer, a schema IR, or a schema differ.

## Notes

### 1.3 — ERD lands as an opt-in, experimental SKILL

**Decision:** the branch's own shape lands — `install.default: false`,
`trust.level: experimental`, `packs: [scale-discipline]`, triggering on "show me
the schema" / "ERD" / "what does this migration change". AI council 2026-08-27,
2 seats, **2/2**. It lands on evidence, not by inheritance: a landed branch is
not an argument, which is why this step exists.

**Rejected alternative 1 — a generated artifact with no skill of its own**,
argued by three of the four inbox proposals on the grounds that the DB family
already has a routing problem. Refused because an implementation agents cannot
discover does not deliver the capability: the artifact would be
`src/scripts/schema_erd.ts` plus 13 modules that nothing routes to. The routing
concern is real and is answered by containment rather than by absence — opt-in,
experimental, and pack-scoped, so a session that never asks for a diagram never
sees the trigger.

**Rejected alternative 2 — a default-on skill.** Not proposed by any source, and
named here because it is the position the branch's shape is easily mistaken for.
It would add a tenth DB-family trigger surface to every session for a capability
most sessions never need, which is the routing problem the first alternative was
worried about, arriving by the other door.

**What makes the choice checkable rather than a preference:** `grep -rlE
'erDiagram' src/skills/*/SKILL.md` returned **0 files of 299** before this
branch, and the nine adjacent DB/data skills all advise — the one that mentions
diagrams (`data-flow-mapper:92`) explicitly disclaims producing one. The
measurement is in the admission ledger row rather than only here.

### 3.2 — no probe, and the count is the reason

**Decision:** the scan is **not** registered as a command. Measured on this
checkout: **1,146 local branches, 193 with commits absent from `origin/main`.** A
naive "unlanded work" probe reports 193 candidates of which one mattered — a 0.5%
signal rate on this evidence, and a report nobody reads is worse than no report,
because its existence is an argument that the class is covered.

**What the discriminator actually was**, recorded so a future probe implements
the narrow predicate rather than the broad one: not "has unmerged commits", but
**"has unmerged commits AND its own roadmap is archived as fully closed"** — a
branch that believes it is finished. That is mechanically checkable (the branch's
tree holds a roadmap under `agents/roadmaps/archive/` with `count_open == 0`) and
it is what found `feat/schema-erd-diff`. Whether it is narrow *enough* is not
established by one instance, which is why nothing is built on it here.

### Estate accounting, both roadmaps

`skill_count` 299 → 300 and `skill_description_tokens` 11455 → 11503 are claimed
by this roadmap's `estate_growth_exempt`, for **one** skill. The
`-relational-modeling` sibling's exemption is **not** granted here and is not
implied — see `blocker: erd-skill-consumes-the-zero-allowance`. It gets a fresh
evaluation on its own evidence, with the burden on the claimant.
