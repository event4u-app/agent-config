---
complexity: lightweight
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
depends: road-to-delivery-for-every-host
depends_on: road-to-delivery-for-every-host
relates:
  - slug: road-to-delivery-for-every-host
    relation: depends
    note: >
      Predecessor. Runs after its Phase 4 so this file's measurement lands on the
      post-flip baseline rather than on the pre-flip total.
  - slug: road-to-the-skill-surface-framing-choice
    relation: disjoint
    note: >
      A carrier for one deferred census item, not an owner of the catalog bucket —
      it holds a framing question, this file holds the standing bytes.
estate_growth_exempt: "Owner-instructed 2026-09-07. Charges +1 active roadmap against the origin/main `active_roadmaps` floor of 4 measured at 0918def55 — the floor is the base-ref measurement, not a stored number (ADR-243). The 14,846-token skill catalog is the second-largest standing bucket and is held by no active roadmap; `road-to-the-skill-surface-framing-choice.md` carries `status: carrier` for one deferred census item and does not own the bucket. AMENDED 2026-09-08 (owner-delegated drain run), and the amendment is what makes this claim diff-scoped rather than banked: this change also adds ONE blocker entry (`step-1-2-menu-exclusion-lever-unbuilt`), which grows `open_blockers` by 1 against the origin/main floor. `open_blockers` carries no growth allowance by policy, so a claim is the only green path. The rise is a NEW recorded blocker, not a repaired undercount: the mechanism defect it names was reproduced at e010b1c2f and no blocker described it before."
estate_offset_exempt: "Offsets nothing. It disposes no roadmap and archives nothing, so the one-in-one-out half has no move available and is claimed here instead."
---

# Road to skill menu economy

> **Source.** Owner instruction 2026-09-07 out of analysis round `inbox-2026-09-u`,
> consumed to `agents/tmp.old/inbox-2026-09-u/`. Re-measured at `0918def55` (v14.20.0);
> corrections forced by that re-measurement carry `corrected-from-reproduction`. Owner
> ruling **E5** is decided in this file. Runs after `road-to-delivery-for-every-host`
> Phase 4 so its measurement lands on the new baseline.

## Goal

The preloaded skills catalog costs no more than the skills a model can actually route to:
every skill that is only ever reached through a command or a flow leaves the model's menu
but stays installed and callable, and a skill-MCP replaces the remaining catalog only if a
pre-registered comparison shows equal-or-better hit rate at equal-or-lower standing bytes.

## Prerequisites

- [ ] Predecessor Phase 4 merged (the baseline this file measures against is the post-flip
      one).
      NOT MET 2026-09-07. Every step of `road-to-delivery-for-every-host` Phase 4 —
      4.0 through 4.5 — is unticked at this commit. This is what blocks 1.2, Phase 2
      and Phase 3 below; it does **not** block 1.1 or 1.3, whose output is a
      classification of entry paths and carries no byte baseline at all.
- [x] Read `src/scripts/preamble_byte_census.ts:290` (`censusSkillsCatalog`) and
      `src/scripts/schemas/skill.schema.json:25-29` (the description cap and its recorded
      distribution).
      Done 2026-09-07, with a path `corrected-from-reproduction`: this line said
      `src/scripts/_lib/preamble_byte_census.ts:290`, and there is no file at that
      path — the census lives at `src/scripts/preamble_byte_census.ts`, where
      `censusSkillsCatalog` is at line 290 exactly as cited. Read and confirmed: it
      walks `skillsDir`, and per skill adds `- ${name}: ${description}\n`.length to a
      char total, reading **no body byte**, which is why a 299-file corpus reports as
      ~14.8k standing. The schema's `description` cap is `maxLength: 200` at line 28,
      and its own docstring at line 29 records the distribution the Context cites
      (median 181 / p75 189 / max 200, zero over 200). Both halves of K2 verified at
      source rather than quoted.
- [x] Run `agent-config roadmap:context --roadmap road-to-skill-menu-economy` and record the
      probe's `scanned:` line against the `relates:` block above.
      Done 2026-09-07 via `./scripts-run src/scripts/roadmap_context --roadmap
      road-to-skill-menu-economy` (the CLI verb and the script are the same probe).
      Recorded `scanned:` lines: **0 PRs · 900 roadmap file(s) across
      active/later/stubs/archive · 430 remote branch(es) · 3 live session record(s) ·
      0 inbox file name(s)**. Context fingerprint `ddeb6ad5a89ea2bf` (base
      `5776a659e069ce208ee7621fc46f4dee90863956`). Against the `relates:` block: the
      probe reports no open PR, no remote branch carrying either declared slug, and no
      sibling roadmap on the topic — so nothing contradicts `depends` on
      `road-to-delivery-for-every-host` or `disjoint` on
      `road-to-the-skill-surface-framing-choice`, and both files exist. The probe
      resolved its base against `origin/main` at `5776a659e`, which is CURRENT: the
      branch started from `04a9af594` and PR #1914 then moved `origin/main` forward, so
      a ratchet reading `origin/main` in this worktree is reading the right base.
      Corrected 2026-09-07 — this line first said the opposite, that `origin/main` was
      stale and the ratchets overstated what is new. That was a wrong inference from a
      single `git merge-base --is-ancestor` result: a base ref that is not an ancestor of
      HEAD means the two have diverged, and says nothing about which side moved. The
      practical consequence is the reverse of what was written: an inherited-red count
      read against `origin/main` here is real, not inflated.

## Context

At `0918def55` the catalog bucket is **14,846 tok** for 299 skills
(`check_preamble_payload_budget`, built by `censusSkillsCatalog` from `- name: description`
per skill and reading no body byte). Skill bodies — 299 files, roughly 596k tok — are
already on demand, which is why a corpus that size reports as ~14.8k standing.

**Why shortening descriptions is not the lever — `corrected-from-reproduction`.** The draft
said descriptions sit near a cap at "median 184 chars, max 206". Re-derived over all 299
`SKILL.md` files by two independent methods that agree: **median 181, max 200**, min 133,
with the top of the distribution at 198/199/200. The **206 was structurally impossible**:
`src/scripts/schemas/skill.schema.json:28` sets `description.maxLength: 200`, and its own
docstring records the measured distribution as median 181 / p75 189 / max 200 with zero
over 200 — the cap was lowered from 220 on 2026-08-22 precisely because 220 described no
artifact. The draft's conclusion survives and gets stronger: the corpus is **at** the cap,
not near it, so **count on the menu** is the whole remaining lever and no byte-shaving
budget exists to spend.

Menu-economy fields are nearly unused: `user-invocable` appears on 2 of 299,
`disable-model-invocation` on 1 of 299. The trigger corpus labels 100 of 299 skills
(`src/skills/*/evals/triggers.json`).

**Owner ruling E5 (final):** a skill-MCP is adopted as the catalog carrier only if, on the
labelled trigger corpus, its hit rate ≥ the catalog's and its standing bytes ≤ the catalog's
after Phase 1 — both numbers pre-registered before the comparison runs. The completeness
invariant holds either way: no skill leaves the install.

## Phase 1: Menu census and marking

- [x] **1.1 Census every skill's entry paths:** model-routed (description match),
      command-only (`src/domains/**/command.md` references), flow-only (`src/flows`), or
      both. Publish the classification in
      `agents/evidence/analysis/skill-menu-census-2026-09.md` pinned to the commit, first
      line `<!-- evidence-type: analysis -->`.
      verify: 299 rows; every row has ≥ 1 entry path or is flagged `orphan`; re-run at the
      same pin is byte-identical; `./scripts-run src/scripts/lint_evidence_artifacts` green.
      Done 2026-09-07. Generator: `src/scripts/report_skill_menu_census.ts`, pinned to
      `f1d5f3f3adebc67844d5aee845f9cfb657e6c17b`. Every limb of the verify, with its
      output:
      · **299 rows** — `grep -c '^| \`[a-z0-9-]*\` | \`' <census>` returns 299, and the
        generator's own `scanned: 299 skill(s)` agrees.
      · **Every row has an entry path or is `orphan`** — the classifier is total by
        construction (`classify()` returns one of five labels for every input), and the
        tally reconciles: both 17 + command-only 101 + flow-only 4 + model-routed 177 +
        orphan 0 = 299.
      · **Byte-identical on re-run at the same pin** — emitted twice, `diff -q` between
        the two files reports no difference. The pin is an argument rather than `now`,
        and rows sort by name, so nothing time-varying reaches the output.
      · **`lint_evidence_artifacts` green** — `--all` resolves the artifact's
        `<!-- evidence-type: analysis -->` marker, which is line 1.
      **The first pass published a false zero and it was caught before publication.**
      Running the command-shaped reference regex over `src/flows/*.yaml` returned
      `flow_refs = 0` for all 299 skills. Flows do not use those shapes; they carry YAML
      name lists (`skills: [code-review, adversarial-review]`). `flowSkillNames` parses
      that key instead, and the flow figure moved 0 → 4 flow-only plus 17 both. Recorded
      because a zero that was wrong for a mechanical reason is exactly the shape Risk 4
      warns about.
      **A second regex defect, found by probing rather than by a run.** The
      `skill:<name>` shape was closed with `\\b`, which sits between `w` and `-`, so
      `skill:code-review-lens` counted as a reference to `code-review` — a skill would
      have inherited a longer sibling's entry paths. Closed with a negative lookahead and
      pinned in all three shapes by
      `tests/scripts/report_skill_menu_census.test.ts`. **It moved no figure in this
      corpus** — 105 candidates before and after — and that is recorded rather than left
      implied, because a fix with no visible effect is exactly the one a later reader
      would suspect was never needed.
      **What the census refuses to decide, stated in the artifact itself:** it does not
      establish *sole* entry path. A command reference proves a command CAN reach a
      skill; nothing static proves the menu never does. So `command-only` and `flow-only`
      name **105 candidates**, never 105 marking decisions — which is Risk 1, and 1.2's
      per-skill invocation fixture is where it is discharged.
- [ ] **1.2 Exclude the command-only and flow-only skills from the model menu** — once a
      field that actually does so exists. Requires: a mechanism that removes a skill from the
      **delivered** model catalog while preserving its command and flow invocability; the 105
      candidates marked with it; and each marked skill still reachable by its command.
      verify: skill count on disk 299; the catalog bucket drops by the marked skills'
      name+description bytes **as measured against the delivered menu, not file presence**;
      a fixture invokes each marked skill via its command successfully.
      **Corrected 2026-09-08 — this step named a mechanism that does not exist.** It read
      "Mark command-only and flow-only skills `user-invocable: false` in frontmatter; the
      projector drops them from the model menu but leaves the skill directory installed",
      and its verify asked the catalog bucket to drop by the marked bytes. Both halves are
      refuted at `e010b1c2f` by
      `agents/evidence/analysis/skill-menu-exclusion-lever-2026-09-08.md`, and the step is
      restated above as the requirement it actually is rather than left as an instruction a
      later reader would execute. The correction is not a re-scope: the goal is untouched and
      no work moved out of this file. Summary of the three surfaces, which is finding (c)
      below.
      BLOCKED 2026-09-08, on three independent things and none is a scheduling excuse.
      (a) The Prerequisites' first line is unmet — `road-to-delivery-for-every-host`
      Phase 4 is entirely unticked, and this file's own header says it runs after that
      Phase so the measurement lands on the post-flip baseline. Marking now would measure
      a bucket drop against a baseline about to move.
      (b) 1.1 deliberately produces **candidates, not decisions**: it cannot establish
      sole entry path, and Risk 1 is the silent capability loss that follows from marking
      on a static scan. The verify's own third limb — a fixture that invokes each marked
      skill via its command — is the mitigation, and building a 105-skill invocation
      fixture is the substance of this step rather than a formality around it.
      (c) **The mechanism this step named does not exist in the tree.** Three surfaces,
      full evidence in `agents/evidence/analysis/skill-menu-exclusion-lever-2026-09-08.md`.
      · `censusSkillsCatalog` (`src/scripts/preamble_byte_census.ts:290-310`) sums
        `` `- ${name}: ${description}\n` `` over every `SKILL.md` and filters on nothing —
        it reads neither `user-invocable` nor `disable-model-invocation`. Measured: marking
        all 105 candidates moves 104 of them by **exactly 0** chars, count 299 → 299. The
        one non-zero is `mcp`, and it is a probe defect (`src/skills/mcp/SKILL.md:5` already
        carries the key, so the probe wrote a duplicate and the description parsed empty),
        recorded rather than dropped.
      · `user-invocable: false` has **inverted** semantics here:
        `src/scripts/lint_agent_skill_names.ts:104` calls it opting out of *slash
        registration*, and `:198-207` says it "keeps the skill model-loadable while the host
        retains the /name". It would cost the user's slash access to exactly the 105 skills
        whose one established entry path is a command or a flow — Risk 1 arriving from the
        opposite direction. `disable-model-invocation` is no substitute: it is a **required
        field of a command** (`src/scripts/schemas/command.schema.json:9`).
      · Corroborating, one host on one date: all three skills already carrying one of the two
        fields — `mcp`, `code-review` (`user-invocable: false`), `command-writing`
        (`disable-model-invocation: true`) — were present in the model-visible catalog
        delivered to the session that recorded this. The census's own `on menu` column reads
        `no` for the first two.
      Closes when Phase 4 of the predecessor is merged, a real exclusion mechanism exists,
      the measurement reads the delivered menu, and that fixture exists. See
      § Blockers → `step-1-2-menu-exclusion-lever-unbuilt`.
- [x] **1.3 Orphans are reported, not deleted.** Any `orphan` row is listed in the PR body
      with its last command reference; no removal.
      verify: `grep -c orphan <census>` equals the PR-body count.
      Done 2026-09-07 — **0 orphan rows**, so there is nothing to list and nothing to
      remove; K3 had no occasion to fire. Nothing was deleted.
      The verify is `corrected-from-reproduction`: the literal
      `grep -c orphan <census>` returns **3**, not 0, because the artifact explains the
      `orphan` class in prose and names it in the totals table. Counting prose as rows
      would have made a true zero look like three findings. The row-scoped instrument is
      `grep -c '^| \`[a-z0-9-]*\` | \`orphan\`' <census>`, which returns **0** and is the
      figure this step means. Both numbers are recorded so a later reader can reproduce
      the correction rather than take it.

## Phase 2: Skill-MCP comparison (E5)

- [ ] **2.1 Pre-register** the comparison in `internal/bench/skill-menu-vs-mcp-PREREG.md`:
      corpus = `src/skills/*/evals/triggers.json` (100 labelled), arms = post-Phase-1 catalog
      against the existing skill MCP surface, metrics = hit rate and standing bytes, the E5
      criterion verbatim.
      verify: file exists before any run artefact; `--selftest` rejects a planted defect.
      BLOCKED 2026-09-07. The arms are defined as "post-Phase-1 catalog against the
      existing skill MCP surface", and the post-Phase-1 catalog does not exist while 1.2
      is blocked. Pre-registering a comparison whose baseline arm is unbuilt would fix a
      criterion against a number nobody can produce, which is the failure Risk 2 names
      from the other direction. Closes when 1.2 closes.
- [ ] **2.2 Run both arms; write the artefact; apply E5.** If adopted: the catalog carrier
      flips to MCP for Claude Code only (hosts per the predecessor's `hosts` axis). If not:
      the artefact records the numbers and the catalog stays.
      verify: artefact with both arms' numbers and a one-line verdict citing E5; no catalog
      line removed before the artefact exists.
      BLOCKED 2026-09-07 — depends on 2.1, and K1 forbids the wholesale swap in the
      meantime. Nothing was removed from the catalog.

## Phase 3: Truth surfaces

- [ ] **3.1 Update the census-driven per-host cost table** (predecessor Phase 7.2) with the
      catalog bucket after Phases 1 and 2.
      verify: table equals census.
      BLOCKED 2026-09-07 — the predecessor's Phase 7.2 generates the table this step
      updates, and that Phase is unticked too. Closes after Phases 1 and 2 here.

## Blockers

### blocker: step-1-2-menu-exclusion-lever-unbuilt

- **Status:** open
- **Owner:** maintainer
- **Asked:** 2026-09-08, in the owner-delegated drain run; dispositioned by AI council the same day (2 seats, anthropic + openai, subscription transport, $0.0000, quorum 2/2 after the run).
- **Blocks:** steps 1.2, 2.1, 2.2 and 3.1, and acceptance criteria 1 and 3. Steps 1.1 and 1.3 are done and unaffected; the published census stands.
- **Recommendation:** none on the mechanism itself — choosing or building a model-menu exclusion path asserts a behaviour of a host this repository does not own, and that is the owner-reserved decision held in `road-to-the-skill-surface-framing-choice.md`. The council's recommendation was procedural only: record the defect, correct the false step text, keep the roadmap at 4/12, and pin explicit unblock conditions so "blocked" does not decay into "abandoned in place".
- **If you do nothing:** step 1.2 stays phrased as a mechanism that measurably does nothing, and a later reader executes it — marking 105 skills, moving the catalog bucket by 0 bytes, and removing the user's slash access to exactly the skills whose only entry path is a command. That is Risk 1 realised from the opposite direction, and every file-count check passes while it happens.
- **What to do:**
  1. Read `agents/evidence/analysis/skill-menu-exclusion-lever-2026-09-08.md` (three surfaces, pinned to `e010b1c2f`), then decide the surface question in `agents/roadmaps/archive/road-to-the-skill-surface-framing-choice.md` — it is owner-reserved and no agent may pick either of its options.
  2. Or build a delivered-menu census first, so the measurement this roadmap depends on reads the model's catalog rather than file presence: `src/scripts/preamble_byte_census.ts:290-310` is the function that would have to change, and `agents/evidence/analysis/skill-menu-census-2026-09.md:62` is the artifact whose `on menu` column already disagrees with it.
  3. Or state that the catalog bucket is not reducible by marking, in which case acceptance criterion 1 is retired by owner decision and this roadmap's Phase 1 ends at the published census.
- **Resolved when:** all five hold — (i) `road-to-delivery-for-every-host` Phase 4 is merged, so 1.2 measures the post-flip baseline; (ii) the owner-reserved surface decision in `road-to-the-skill-surface-framing-choice.md` is recorded; (iii) a mechanism that removes a skill from the **delivered** model catalog while preserving command and flow invocability is identified or built; (iv) the measurement in 1.2's verify reads the delivered menu rather than `SKILL.md` file presence; (v) the 105 candidates are revalidated per-skill, because the census establishes candidates and never sole entry path.
- **Review trigger:** re-read this blocker when `road-to-delivery-for-every-host` archives, or on 2026-12-08, whichever is first. Condition (i) is the only one that can close on its own; if it closes and (ii)-(v) have not moved, that is the signal to take the disposition back to the council rather than to leave the file open another quarter.
- **Why this is a blocker and not a re-scope.** The council considered re-scoping the goal to what the tree can already establish and rejected it 2/2 — on K5 (the openai seat read the narrowing as the forbidden carrier move) and, independently, because the narrowed goal would have been a false claim: proving that *no* shipped field removes a skill from the model's menu is a statement about the **delivered** menu, and this tree has no delivered-menu census. Deleting the roadmap was rejected as an unauthorised retirement. Building the lever was rejected as crossing the owner-reserved boundary. Option A was unanimous.

## Kill register

- **K1** Removing the catalog on the promise of a tool call — a wholesale swap before 2.2.
- **K2** Shortening descriptions to hit the budget. The corpus is at the schema cap of 200
  with median 181; there is no slack, and the recall cost of cutting into it is unmeasured.
- **K3** Deleting orphan skills in this roadmap.
- **K4** New top-level CLI verb; a daemon.
- **K5** Moving this file to `later/` or descoping to a carrier.

## Provenance

- **Source:** an owner-directed external LLM ideation round, consumed to
  `agents/tmp.old/inbox-2026-09-u/`. No third-party repository, product or vendor is a
  source of this plan.
- **Gap table:** `KEEP` — the bucket's standing cost and how `censusSkillsCatalog` computes
  it, the 299-skill corpus, the near-zero use of the two menu-economy fields, the 100
  labelled trigger sets, and E5's pre-registration criterion. `KEEP, corrected` — the
  description distribution (median 181 / max 200 against a schema cap of 200, not 184/206)
  and the catalog bucket (14,846 tok, not 14,849). `CUT` — nothing; the correction
  strengthens the draft's own conclusion rather than removing a step.
- **Council:** none. E5 is an owner ruling.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-09-08 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|---|---|---|---|---|---|
| 1 | A skill loses an entry path it actually had | product | **Re-reviewed 2026-09-08 and the likelier direction is now the opposite one.** As written the risk was that a misclassified skill leaves the *model* menu and is reachable by nobody. Measured at `e010b1c2f`, `user-invocable: false` does not remove a skill from the model menu at all — it opts out of *slash registration* (`src/scripts/lint_agent_skill_names.ts:104`). So a reader executing the pre-correction step 1.2 would have removed the **user's** slash access to the 105 skills whose one recorded entry path is a command or a flow, while the model menu stayed exactly as it was. Both directions are the same underlying defect: marking on a static scan that cannot establish sole entry path. | 1.2 is now blocked rather than executable, and its `Resolved when` (v) requires the 105 candidates to be revalidated per skill before any marking. The census artifact states in its own text that it yields candidates and never decisions. Step 1.2 no longer instructs anyone to set a field, so the mitigation no longer rests on a verification that cannot run — the previous entry cited "1.2 makes a successful command invocation part of the same verification", and that verification was never reachable while the mechanism was absent. | Phase 1: Menu census and marking |
| 2 | The MCP arm is adopted on an unfalsifiable comparison | implementation | Both metrics are easy to move after the fact by re-scoping the corpus or redefining a hit. | 2.1 pre-registers corpus, arms, metrics and the E5 criterion verbatim before any run, and 2.2 forbids removing a catalog line before the artefact exists; K1 forbids the wholesale swap | Phase 2: Skill-MCP comparison (E5) |
| 3 | The census is read as a deletion list | product | An `orphan` row looks like dead weight, and the cheapest response to a list of orphans is to remove them. | K3 forbids deletion in this roadmap and 1.3 requires each orphan to ship with its last command reference, so the row is a question rather than a verdict | Phase 1: Menu census and marking |
| 4 | The corrected description figures are re-derived wrongly and reopen K2 | implementation | The draft's 184/206 were wrong in both directions, and a later reader who re-measures loosely could conclude there is byte slack to spend. | The Context names the derivation and the schema line that caps it, and K2 states the cap and the median together so a proposal to shorten meets the number instead of the impression | Phase 1: Menu census and marking |
| 5 | The blocker becomes disguised archival debt | implementation | Recording a blocker and correcting the step text closes the honesty gap and buys no progress. The failure mode both council seats named on 2026-09-08 is that Option A decays into permanent limbo: the roadmap sits at its current progress indefinitely, nobody re-reads the five `Resolved when` conditions, and an open file substitutes for a decision. Only condition (i) can close without a human. | The blocker carries an explicit **Review trigger** — `road-to-delivery-for-every-host` archiving, or 2026-12-08, whichever is first — and names what to do when (i) closes alone: take the disposition back to the council rather than leave the file open another quarter. K5 keeps the file from being parked into `later/` in the meantime, so it cannot be quietly removed from the active estate. | Blockers |

## Acceptance Criteria

- [ ] Catalog bucket ≤ 10,000 tok on Claude Code after Phase 1, or the census proves fewer
      than 100 skills are command-only or flow-only.
      OPEN 2026-09-07, and the second limb is now answered in the negative: the census
      measures **105** command-only-or-flow-only skills (101 + 4), which is not fewer
      than 100, so the escape hatch does **not** fire and the byte limb is the live one.
      That limb needs Phase 1.2, which is blocked. Recorded here because a later reader
      would otherwise re-derive it, and because 105 sits close enough to 100 that a small
      change in the reference rule could flip the hatch — the rule the number came from
      is published in the artifact for exactly that reason.
      **Corrected 2026-09-08 — the byte limb is not merely blocked, it is unreachable by the
      mechanism Phase 1 named.** Marking moves the measured bucket by 0 (evidence:
      `agents/evidence/analysis/skill-menu-exclusion-lever-2026-09-08.md`), so this criterion
      cannot be met by 1.2 as it was written and is restated as depending on a real exclusion
      mechanism plus a delivered-menu measurement. Both limbs are now negative against the
      current tree: the escape hatch does not fire (105 ≥ 100) and the byte limb has no lever.
      See § Blockers → `step-1-2-menu-exclusion-lever-unbuilt`.
- [ ] 299 skills installed; every marked skill callable by its command.
      OPEN 2026-09-07. First limb holds and was checked: 299 skill directories with a
      `SKILL.md` on disk, unchanged by this work — nothing was marked, moved or removed.
      Second limb is vacuously true today (no skill is marked) and becomes real with 1.2.
- [ ] Skill-MCP decision recorded against the pre-registered criterion.
      OPEN 2026-09-07 — nothing pre-registered, nothing decided, no catalog line removed.
      See 2.1.
