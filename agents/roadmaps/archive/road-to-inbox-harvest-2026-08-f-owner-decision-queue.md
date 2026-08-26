---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
estate_offset_exempt: "No archive move is available in this change. This file is the smaller half of a reduction: a three-bundle inbox drain of roughly 24,000 lines yielded three roadmaps, and more of its content was recorded as already-owned or already-fixed than became work. Its own subject is the estate's reachability, so retiring an active roadmap to pay for it would be the priority pick the 2026-08-24 council refused to make on exactly this ground."
estate_growth_exempt: "Activation change (2026-08-26): this file flips status draft -> ready, so it now charges +1 on the count half, which read +0 for as long as it shipped draft. One-in-one-out is file-based and was already paid by the change that landed the file; the claim is re-stated here because it is diff-scoped and an earlier one cannot be banked. It also adds blockers against a floor of 31, which carries no automatic allowance. Warranted on measurement rather than appetite: 77 files sit in agents/roadmaps/stubs/, exactly one carries a review_by, 48 carry no probe or promotion heading at all, and four owner-reserved decisions have been waiting in a single one of them since 2026-08-21. No open roadmap carries a stub-lifecycle or owner-decision-queue item; grepped across all twelve active files and all 65 in later/."
---
# Road to the owner-decision queue — the answers exist, and the owner cannot see them

> **Source:** the `/analyze:inbox` run of 2026-08-26 over three bundles in
> `agents/tmp.old/` — `agent-skills/`, `atomic-mem/` and `feedback-14.12.0/`.
> Two of the three are **second arrivals**: `agents/tmp.old/agent-skills.txt`
> (2026-08-22) and `agents/tmp.old/atomic-claude-graph/` (2026-08-24) carried the
> same subjects, and the newer bundle opens with the owner writing *"ich sagte
> schon mehrfach"*. <!-- md-language-check: ignore -->
> Every figure below was re-derived at HEAD `3f4508a9b`.

## Goal

An owner-reserved decision this repository is waiting on is visible without
reading a directory, and a parked file states when it will next be looked at.
Finished means: every file under `agents/roadmaps/stubs/` either names the probe
that promotes it or carries a date by which someone re-reads it; one command
lists what is due and what is waiting on the owner; and the decisions this drain
surfaced are in that list rather than in a paragraph.

## Context — what the measurement actually says

**The estate is not short of plans. It is short of a front door.**

| Reading at HEAD `3f4508a9b` | Value | How |
|---|---:|---|
| active roadmaps (files) | 12 | `ls agents/roadmaps/*.md` |
| active roadmaps (gate-counted, non-draft) | 10 | `check_estate_count` |
| parked in `later/` | 65 | `ls agents/roadmaps/later/*.md`, minus `README` |
| stubs | 77 | `ls agents/roadmaps/stubs/*.md`, minus `README` |
| open steps, active + `later/` | 846 | `grep -c '^- \[ \]'` over both |
| stubs carrying `review_by:` | **1** | frontmatter scan |
| stubs carrying a Probe / Promotion heading | 29 | heading scan |
| stubs carrying **neither** | **48** | the two above |
| owner-reserved decisions open in one stub | 4 | `stubs/road-to-owner-authority-decisions.md:35,49,59,101` |

**The invisibility is by design, and that part is not the defect.**
`update_roadmap_progress.ts:93` lists `stubs` in `EXCLUDE_DIRS`; the generator
emits a dedicated `## Parked — later/` section at `:1104` and no stubs section;
`stubs/README.md:18` states the exclusion in as many words. A stub is *not* a
backlog item, and putting 77 of them on a progress dashboard would be wrong.

**The defect is one layer down: nothing ever re-reads them.** A drain-run
transfer is capability-gated — `stubs/README.md` says the scope decision is
made, the work is wanted, and only an environment is missing. That is a claim
about *today*. With one `review_by:` across 77 files and no scheduled probe,
"capability-gated" decays silently into "abandoned", and the only mechanism that
re-surfaces it is the owner asking again. Which is what the 2026-08-26 bundles
are.

**Three worked instances from this drain, each already specified in-tree:**

1. `stubs/road-to-release-placeholder-guard.md:3` is `status: stub` while
   `CHANGELOG.md:419-422` ships four `_auto-derived, rewrite before merge:_`
   lines under `## [14.12.0]`. Its AC-1 at `:426` **is** the gate the reviewers
   asked for. It was promoted on 2026-08-24 and reverted the same day by a 2/2
   council verdict — not on merit, but because the run self-certified an estate
   exemption where a named offset was required.
2. `stubs/road-to-live-trigger-eval.md` and
   `stubs/road-to-skill-tiering-live-arm.md` hold the trigger-evaluation and
   tiering work one of the bundles asks for as if it were new.
3. `stubs/road-to-typed-knowledge-graph-memory.md` holds the knowledge-graph
   memory pattern the other bundle asks for as if it were new.

**A fourth blocker is a cap rather than a stub.** `lint_roadmap_family_cap.ts:42`
sets `CAP = 2` for `road-to-skill-ecosystem-*`; the gate reports **2/2 used**;
and `later/road-to-skill-ecosystem-executable-payloads.md:69-75` — the only file
in the estate that owns `run_skill_evals.ts`, whose `_spawn_subagent` still
throws at `:95-100` while 42 `evals.json` are counted as coverage — states in its
own words that it consumes the second slot and that renaming to dodge the cap
would be gate-gaming. So that work is not unowned, unwanted or unspecified. It is
third in a queue of two.

## Mechanism-match — what this roadmap is NOT proposing

The AI council of 2026-08-21 chose **deleting** the hand-maintained stub index in
`stubs/README.md` over **generating** one, both seats, and
`check_no_stub_inventory_table.ts` now refuses its return because *"prose cannot
refuse"* — a paragraph was tried and lost to a merge.

Per [`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), the
mechanism-match check runs first: that verdict settled **an inventory of the
directory living inside the directory's own README**. Nothing below proposes
one. What is proposed is a *frontmatter field plus a read-only query* — the
stub files stay the single source, no row is authored twice, and there is no
append surface to conflict on. That is a different mechanism, so the lock does
not apply; the distinction is recorded here so a later reader does not have to
re-derive it.

## Phase 1 — give every stub a next-read date

- [x] **1.1 Add `review_by:` to the stub frontmatter contract.**
      `agents/roadmaps/stubs/README.md` distinguishes org-mode stubs from
      drain-run transfers and gives each its own promotion rule; neither shape
      states when it is next read. Extend the contract with one required date
      field and say what it means for each shape: for a transfer, when the
      capability is re-probed; for an org-mode stub, when the demand question is
      re-asked.
      verify: `agents/roadmaps/stubs/README.md` states the field and both
      meanings; `grep -c '^review_by:' agents/roadmaps/stubs/*.md` is quoted in
      the commit as a before number.


      **DONE — three fields, not one, and the extra two came from the council
      rather than from this step.** `agents/roadmaps/stubs/README.md` gains a
      § Frontmatter contract naming `review_by:` (required, an ISO deadline),
      `reviewed_at:` (optional, the day someone actually read it) and `probe:`
      (only ever the literal `probe: none`). Both council seats independently
      required the first two to be SEPARATE fields, on the argument that one
      field cannot both set an obligation and record its discharge — a
      `review_by:` that gets moved forward on every read is indistinguishable
      from one nobody has looked at.

      Per-shape meaning, as the step asks: a **drain-run transfer** is
      capability-gated, so its named probe is **re-run every 30 days** — an
      environment can appear at any moment and re-probing is cheap by
      construction. An **org-mode stub** is demand-gated, so its demand question
      is **re-asked every 120 days**; customer recruitment and audit funding do
      not move on a 30-day clock.

      **The before number, quoted as the verify requires:**
      `grep -l '^review_by:' agents/roadmaps/stubs/*.md | wc -l` → **1** (only
      `road-to-release-placeholder-guard.md`), out of 77 stub files.
- [x] **1.2 Backfill the field across the 77 existing stubs.**
      One date per file, derived from its own text: a transfer whose probe names
      an environment gets a date; an org-mode stub whose demand question has no
      asker gets a date. No file is promoted, demoted or edited beyond its
      frontmatter in this step.
      verify: `grep -L '^review_by:' agents/roadmaps/stubs/road-to-*.md` prints
      nothing.


      **DONE — 77 of 77, and the ordering was inverted on the council's
      instruction.** This step ran AFTER 2.1, not before it. Both seats made the
      enforcement-first ordering a rule rather than a preference: dates with no
      reader are strictly worse than no dates, because a stale date certifies
      attention nobody paid. `stubs:due` existed before the first date landed.

      **A backfilled date is a first deadline, not a claim of prior review.**
      Dates are creation-of-contract plus cadence, i.e. 2026-09-25 for the 30
      transfers and 2026-12-24 for the org-mode stubs — deliberately NOT
      creation-date plus cadence, which would have marked all 77 overdue on day
      one. That would be loud and carry no information, since the fact none had
      been re-read is exactly what the absent `reviewed_at:` already says. The
      README states this so a later reader does not mistake the uniform dates for
      a judgement.

      **Nine stubs had no frontmatter block at all** and were given one
      (`complexity: lightweight` plus the date) rather than skipped:
      `road-to-assurance-benchmark`, `road-to-central-policy`,
      `road-to-internal-connectors`, `road-to-legacy-target-onboarding-ratchet`,
      `road-to-session-closeout-gated`, `road-to-target-project-bootstrap-enforce`,
      `road-to-target-project-evidence-contract`, `road-to-team-context`,
      `road-to-team-sso`. No file was promoted, demoted, or edited beyond its
      frontmatter, as the step requires.

      verify, met: `grep -L '^review_by:' agents/roadmaps/stubs/road-to-*.md`
      prints nothing.
- [x] **1.3 Name the probe on the 48 stubs that carry none.**
      29 of 77 carry a Probe or Promotion heading. For the remaining 48, either
      write the one-sentence probe that would promote the file, or record that
      it has none and is therefore an abandonment wearing a directory name —
      which `later/road-to-ac-deep-capabilities.md` already names as a failure
      shape for parked files.
      verify: every `agents/roadmaps/stubs/road-to-*.md` matches either a
      Probe/Promotion heading or an explicit `probe: none` line.


      **DONE — and the count was right while the diagnosis was wrong, which is
      the finding.** 48 files did not match `^#{1,4} *(Probe|Promotion)`, exactly
      as the step says. But 46 of the 48 already carried a **real probe**; it sat
      under a heading the pattern could not see — `## Producer and probe — named,
      not wished`, `## Detection probe — and its measurement today`,
      `## Re-entry producer and detection probes`, `## Prerequisites for
      promotion`. The defect was findability, not absence.

      So the work was a heading normalization, not authoring: each of those 46
      headings now STARTS with `Probe` or `Promotion`, with the rest of its
      meaning kept and **the probe text itself untouched**. Two files needed real
      content and got it (`road-to-owner-authority-decisions` — the probe is
      whether the owner has ruled, baseline four open;
      `road-to-language-pin-short-lead` — the probe is that the defect still
      reproduces, with its measured baseline).

      **`probe: none` was written zero times, and that is a result rather than an
      omission.** Every one of the 48 turned out to have a promoting path. The
      escape hatch stays in the contract because the next stub may not.

      verify, met: every `agents/roadmaps/stubs/road-to-*.md` matches a
      Probe/Promotion heading or `probe: none` — 77 of 77 pass.
## Phase 2 — one command that answers "what is waiting on me?"

- [x] **2.1 Add a read-only `stubs:due` query.**
      Reads the frontmatter of `agents/roadmaps/stubs/*.md` and prints the files
      whose `review_by:` has passed, plus the files whose text routes a decision
      to the owner. It writes nothing, and it authors no file inside
      `agents/roadmaps/stubs/` — the guard in
      `check_no_stub_inventory_table.ts` stays untouched and un-weakened.
      verify: the command runs from a clean checkout, exits 0, and
      `./scripts-run src/scripts/check_no_stub_inventory_table` stays green.


      **DONE — `agent-config stubs:due`, and it landed BEFORE the backfill.**
      `src/agent-src/scripts/stubs_due.ts` reads the frontmatter of
      `agents/roadmaps/stubs/*.md` and prints: stubs past `review_by:`, stubs
      carrying none (with the date its shape would get), decisions routed to the
      owner, and stubs naming no probe. `--json`, `--counts` and `--today <ISO>`
      (so a test can pin "now").

      **Owner-routed decisions are counted from two deterministic markers**,
      unioned, because "the text routes a decision to the owner" has to be
      readable by a script and not only by a person: an `## Unresolved decision`
      heading, and an open `### blocker:` whose Owner is the maintainer. A stub
      can carry both.

      It writes nothing anywhere, and authors nothing under
      `agents/roadmaps/stubs/`. Registered in `src/cli/registry.ts` with the
      `cli_help_command_count` budget and the committed measurement record moved
      in the same change (108 → 109), per that gate's own contract.

      verify, met: runs from a clean checkout, exits 0, and
      `./scripts-run src/scripts/check_no_stub_inventory_table` is green with the
      guard file **unmodified** (`git diff --quiet` on it returns clean).
- [x] **2.2 Register the owner-reserved decisions this drain surfaced.**
      Four already sit in `stubs/road-to-owner-authority-decisions.md:35,49,59,101`.
      This drain adds four more, each recorded with the exact instrument it
      would move: the release-placeholder offset; the Class-B resident-service
      prohibition at `docs/decisions/ADR-124-embedded-engine-doctrine.md:109-110`
      together with the backed `claim:no-runtime-daemon` at `docs/CLAIMS.md:104-108`;
      the acceptance of `docs/decisions/ADR-240-evidence-based-decision-floor.md`,
      which ships `status: proposed` and whose own text reserves acceptance to
      the owner; and the `CAP = 2` family limit at
      `lint_roadmap_family_cap.ts:42`, whose reason is `ADR-215 § D2`.
      verify: each of the four appears with a file:line and a one-line statement
      of what changes if the owner says yes and what changes if they say no.


      **DONE — four registered as decisions 5-8 in
      `stubs/road-to-owner-authority-decisions.md`, each with its instrument at
      `file:line` and a stated consequence for yes and for no.** Two carry a
      position; two deliberately do not.

      | # | Instrument | Treatment |
      |---|---|---|
      | 5 — release-placeholder offset | `stubs/road-to-release-placeholder-guard.md:36-38` | surfaced; the question is whether a self-written `estate_offset_exempt` can stand in for a real archive move |
      | 6 — Class-B resident-service prohibition | `ADR-124:110` + `docs/CLAIMS.md:120-125` | **surfaced without a position** — council 2/2: established policy being preserved, reopening it is owner-reserved |
      | 7 — acceptance of ADR-240 | `ADR-240:3` (`status: proposed`) | **surfaced without a position** — the record's own text reserves acceptance to the owner, so an agent accepting it would use the record to authorise accepting the record |
      | 8 — the `CAP = 2` family limit | `lint_roadmap_family_cap.ts:42` | council decided the operational question (keep 2); only the underlying `ADR-215 § D2` reasoning is registered |

      **Two corrections landed with the registration, both measured rather than
      assumed.**

      First, a **provenance error in this step's own text**: it cites
      `docs/CLAIMS.md:104-108` for `claim:no-runtime-daemon`. Read at HEAD,
      `:104-108` is the `**What \`exec:\` cannot cover.**` paragraph; the claim
      is at `:120-125`. The registry entry carries the correct line and records
      the correction rather than silently fixing it.

      Second, and larger: **the family-cap blocker's premise is stale.** It
      describes *"a queue of two with three files in it"*.
      `./scripts-run src/scripts/lint_roadmap_family_cap` at HEAD reads
      **`0/2 slot(s) used`** — all three `road-to-skill-ecosystem-*` roadmaps sit
      in `agents/roadmaps/later/`, so the cap binds nothing today and nothing is
      waiting for a slot. The cost the blocker named (the eval-runner stub being
      re-proposed because it looks unowned) is therefore **not a cap problem**;
      that file is parked on three Phase-0 spike measurements, which its own
      Blocked-until condition states. Both council seats predicted that
      registering the decision in a distant register would not stop the
      re-proposal loop, and the measurement says why.

      Acting on that: the waiting file now carries `family_cap_state:
      not-blocked` in its frontmatter plus an intake comment naming the cap
      decision, the measured `0/2`, the real blocker, and the registry entry —
      the machine-readable, intake-surface disposition both seats asked for,
      stating the measured truth rather than the assumed one.
- [x] **2.3 Route the queue into the place the owner already looks.**
      The dashboard excludes `stubs/` on purpose and that stays. Add a single
      line to `agents/roadmaps-progress.md`'s generated header naming the count
      of overdue stubs and the count of open owner decisions, sourced from 2.1.
      A count is not an inventory: no row, no link per stub, nothing to conflict
      on.
      verify: the regenerated dashboard carries the two counts;
      `./scripts-run src/scripts/check_no_stub_inventory_table` stays green.


      **DONE — two integers in the generated header, no rows and no per-stub
      links.** `agents/roadmaps-progress.md`'s header now reads
      `… · **0** overdue stubs, **10** owner decisions → \`agent-config
      stubs:due\``, sourced from 2.1's counter. The clause renders only when at
      least one count is non-zero.

      The dashboard still excludes `stubs/` from every section below, exactly as
      before. A count is not an inventory: there is no row and no link for the
      table deleted on 2026-08-21 to grow back from, which is the failure Risk 2
      names.

      The reader is failure-tolerant by construction — a repository with no
      `agents/roadmaps/stubs/` yields zero and renders nothing rather than
      erroring, because this generator runs in consumer installs that carry no
      stub directory at all.

      verify, met: the regenerated dashboard carries both counts, and
      `./scripts-run src/scripts/check_no_stub_inventory_table` is green.
## Blockers

### b-stub-review-cadence — who sets the dates, and how often is too often

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** 1.2
- **What to do:** pick exactly one — (a) a uniform cadence, every stub re-read
  90 days after its last touch; or (b) a per-shape cadence, capability-gated
  transfers at 30 days because an environment can appear at any time and
  org-mode stubs at 180 days because a demand question rarely moves in a quarter;
  or (c) author-set per file at backfill time, with 90 days as the default when
  the author has no opinion.
- **Resolved when:** one of the three is written into
  `agents/roadmaps/stubs/README.md` and 1.2 uses it.
- **Recommendation:** (b) — the two shapes have genuinely different clocks, and
  the README already separates them, so this adds a number to a distinction that
  exists rather than inventing one.
- **If you do nothing:** 1.2 stalls, because a backfill needs a rule and an
  agent choosing the rule itself would set a repository-wide cadence by
  self-certification — the same shape the 2026-08-24 council refused.

- **Resolution, 2026-08-26 — option (b), per-shape cadence.** AI council, 2/2
  convergent (anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds,
  blind peer review), on the maintainer's standing delegation of owner-reserved
  decisions for an autonomous drain run. **30 days for capability-gated
  transfers** (an environment can appear at any moment) and **120 days for
  org-mode stubs** (a demand question rarely moves in a quarter). Written into
  `agents/roadmaps/stubs/README.md` § Frontmatter contract and used by 1.2.
- **30 is unanimous; 120 is not, and the dissent is recorded rather than
  averaged away.** One seat argued 180 — *"customer recruitment, audit funding
  and architectural approval usually change more slowly"*. The other argued 120 —
  *"premises can shift faster than that: a competitor ships, priorities change, a
  regulatory landscape moves. The cost of a wasted check every quarter is lower
  than the cost of a stale stub that should have been retired at month 4."* 120
  was taken because both seats named the stale-date risk as dominant and the
  shorter interval is the one that reduces it, and because the 180 seat framed
  its own number as *"a starting point, then tune from observed resolution and
  overdue rates"* rather than as a floor.
- **Two requirements neither the blocker nor the step contained, both added by
  the council and both binding:** (1) the backfill may not run until a reader
  exists — *"dates without a reader are strictly worse than no dates"* — which
  inverted the execution order so 2.1 landed before 1.2; (2) `review_by:` and
  `reviewed_at:` must be SEPARATE fields, because one field cannot both set an
  obligation and record its discharge.
- **Revisit-if:** after two review cycles, either class shows a sustained overdue
  rate above roughly 20 %; or 120-day reviews repeatedly find org-mode changes
  that were actionable months earlier; or capability changes are commonly missed
  between 30-day checks.

### b-family-cap-third-slot — a queue of two with three files in it

- **Status:** resolved
- **Owner:** maintainer
- **Blocks:** 2.2
- **What to do:** pick exactly one — (a) leave `CAP = 2` and accept that
  `later/road-to-skill-ecosystem-executable-payloads.md` waits until one of the
  two active family members archives; or (b) raise the cap, which
  `lint_roadmap_family_cap.ts:19-20` says is a one-line change **plus a new
  decision record**, never a silent edit; or (c) re-anchor the eval-runner work
  outside the family prefix, which that roadmap itself calls gate-gaming at
  `:74` and which is therefore recorded here only so the option is refused
  explicitly rather than silently.
- **Resolved when:** the choice is recorded, and if it is (b), the decision
  record exists and `ADR-215 § D2` is amended rather than contradicted.
- **Recommendation:** (a) — the cap is doing exactly what it was built for, and
  the honest fix is to finish one of the two open family roadmaps rather than to
  widen the road. This roadmap's job is to make the queue visible, not to jump it.
- **If you do nothing:** the eval-runner stub keeps being re-proposed by every
  incoming bundle, because from outside the estate it looks unowned.

- **Resolution, 2026-08-26 — option (a), `CAP = 2` stands.** AI council, 2/2
  convergent, same seating as above. Both seats: hitting the cap is evidence it
  is operating as designed, raising it precisely when it binds would weaken the
  mechanism without evidence that `ADR-215 § D2`'s rationale has failed, and
  re-anchoring is acknowledged gate-gaming (refused explicitly at registry
  decision 8 so it is not re-proposed silently).
- **The blocker's premise is STALE, and the measurement is the more useful half
  of this resolution.** It describes *"a queue of two with three files in it"*.
  `./scripts-run src/scripts/lint_roadmap_family_cap` at HEAD reads **`0/2
  slot(s) used`**: all three `road-to-skill-ecosystem-*` roadmaps
  (`capability-queue`, `executable-payloads`, `security-and-conformance`) sit in
  `agents/roadmaps/later/`, so the cap binds nothing today and no slot needs to
  free. The stated cost — the eval-runner stub being re-proposed because it looks
  unowned — is therefore **not a cap problem**; that file is parked on three
  Phase-0 spike measurements per its own Blocked-until condition.
- **Both seats predicted registration alone would not stop the re-proposal
  loop**, and one named the fix: the waiting disposition has to be discoverable
  at the intake surface, not only in a decision register. Done —
  `later/road-to-skill-ecosystem-executable-payloads.md` carries
  `family_cap_state: not-blocked` plus an intake comment naming the cap decision,
  the measured `0/2`, the real blocker and the registry entry.
- **Revisit-if:** a slot opens; an active family member lacks a credible
  completion or archival path at its next scheduled review; independent work is
  demonstrably harmed by serialization; or re-proposals continue after the
  waiting state is visible to intake.

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-08-26 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The date field becomes a second ratchet nobody honours | implementation | 77 dates land, none is ever re-read, and the repository gains a field that certifies attention it does not pay — strictly worse than no field, because a stale date reads as evidence. | Phase 2 makes the dates queryable in one command and surfaces two counts on the dashboard, so an unhonoured date is visible rather than inert; 1.3 forces `probe: none` to be written out loud where no probe exists. | Phase 2 — one command that answers "what is waiting on me?" |
| 2 | 2.3 is read as the inventory table the council deleted | implementation | A future reader sees stub information on the dashboard and concludes the 2026-08-21 verdict was reversed, then extends it row by row back into an index. | 2.3 ships two integers and no per-file row or link; the § Mechanism-match section records the distinction; `check_no_stub_inventory_table` stays green as an explicit verify on both 2.1 and 2.3. | Phase 2 — one command that answers "what is waiting on me?" |
| 3 | The backfill invents dates that carry no judgement | product | 1.2 assigns 77 dates mechanically, and the ones that matter are indistinguishable from the ones that do not. | The cadence comes from `b-stub-review-cadence`, which is an owner decision rather than an agent default, and option (b) ties the number to a distinction the README already draws. | Phase 1 — give every stub a next-read date |

## Acceptance Criteria

- [x] AC-1 — every file under `agents/roadmaps/stubs/` carries a `review_by:`
      date and either a named promotion probe or an explicit `probe: none`.

      **Met, 77 of 77 on both halves.** `grep -L '^review_by:'` over
      `road-to-*.md` prints nothing; every stub matches a Probe/Promotion
      heading. `probe: none` was needed zero times — all 48 flagged files turned
      out to carry a real probe under a heading the pattern could not see.
- [x] AC-2 — one read-only command lists the stubs whose review date has passed
      and the decisions routed to the owner, and it runs from a clean checkout.

      **Met.** `agent-config stubs:due` — read-only, exits 0, authors nothing
      under `agents/roadmaps/stubs/`. Registered in the CLI registry with the
      `cli_help_command_count` budget and committed record moved in the same
      change (108 → 109), and `check_cli_registry_budget_sync` is green.
- [x] AC-3 — the eight owner-reserved decisions (four pre-existing, four from
      this drain) are each recorded with a file:line for the instrument they
      move and a stated consequence for yes and for no.

      **Met.** Decisions 5-8 added to
      `stubs/road-to-owner-authority-decisions.md`, each with its instrument at
      `file:line` and both consequences. Two are surfaced without a position (6,
      7) by council agreement; one carries a council-decided operational answer
      (8). One cited line was wrong in this roadmap's own text and is corrected
      in place rather than silently: `claim:no-runtime-daemon` is at
      `docs/CLAIMS.md:120-125`, not `:104-108`.
- [x] AC-4 — `check_no_stub_inventory_table` is green, unmodified, and its
      guarded watch list is unchanged.

      **Met on all three conjuncts.** The gate exits 0; `git diff --quiet --
      src/scripts/check_no_stub_inventory_table.ts` returns clean, so both the
      gate and the watch list it carries are byte-unchanged. Nothing in this
      change writes a table, a row, or a per-stub link anywhere the guard reads —
      the dashboard gained two integers and nothing else.
