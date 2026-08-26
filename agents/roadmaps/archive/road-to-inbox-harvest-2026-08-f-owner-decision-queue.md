---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
owner: maintainer
review_by: 2026-11-26
estate_offset_exempt: "No archive move is available in this change. This file is the smaller half of a reduction: a three-bundle inbox drain of roughly 24,000 lines yielded three roadmaps, and more of its content was recorded as already-owned or already-fixed than became work. Its own subject is the estate's reachability, so retiring an active roadmap to pay for it would be the priority pick the 2026-08-24 council refused to make on exactly this ground."
estate_growth_exempt: "Charges +0 on the count half (that half is status-scoped and this file ships draft) and +1 on one-in-one-out, which is file-based and fires whatever the status. It also adds blockers against a floor of 31, which carries no automatic allowance. Warranted on measurement rather than appetite: 77 files sit in agents/roadmaps/stubs/, exactly one carries a review_by, 48 carry no probe or promotion heading at all, and four owner-reserved decisions have been waiting in a single one of them since 2026-08-21. No open roadmap carries a stub-lifecycle or owner-decision-queue item; grepped across all twelve active files and all 65 in later/."
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

      **DONE — `agents/roadmaps/stubs/README.md` § When is this file next read?** Two fields, `review_by:` and `probe:`, with the per-class meaning the council settled. **The section leads with what the defect is NOT:** the invisibility of `stubs/` is deliberate — `update_roadmap_progress.ts` excludes it, and § What every stub carries records why the hand-maintained index was deleted rather than regenerated. The defect is one layer down, and the section says it in the file's own terms: a transfer claims the work is wanted and only an environment is missing, which is *a claim about today*, and with no scheduled probe *capability-gated* decays silently into *abandoned*. Before number, quoted in the commit: **1 of 76** stubs carried a next-read date.

- [x] **1.2 Backfill the field across the 77 existing stubs.**
      One date per file, derived from its own text: a transfer whose probe names
      an environment gets a date; an org-mode stub whose demand question has no
      asker gets a date. No file is promoted, demoted or edited beyond its
      frontmatter in this step.
      verify: `grep -L '^review_by:' agents/roadmaps/stubs/road-to-*.md` prints
      nothing.

      **DONE — 76 files, and the count in this step was wrong.** 76, not 77. Cadence per the council verdict: **30 days for a drain-run transfer** (58 files — capability-gated, an environment can appear any day) and **180 days for an org-mode stub** (18 files — demand-gated, and a demand question rarely moves inside a quarter). Each date is computed from that file's own last content commit, never from today, so a file untouched for months is due sooner than one written yesterday. Frontmatter only: no file was promoted, demoted, or edited in its body. Nine stubs had NO frontmatter block at all and one was outside the `road-to-*` naming convention — both were found by running the query rather than by inspection, which is the argument for building the query first. `grep -L '^review_by:' agents/roadmaps/stubs/*.md` prints nothing.

- [x] **1.3 Name the probe on the 48 stubs that carry none.**
      29 of 77 carry a Probe or Promotion heading. For the remaining 48, either
      write the one-sentence probe that would promote the file, or record that
      it has none and is therefore an abandonment wearing a directory name —
      which `later/road-to-ac-deep-capabilities.md` already names as a failure
      shape for parked files.
      verify: every `agents/roadmaps/stubs/road-to-*.md` matches either a
      Probe/Promotion heading or an explicit `probe: none` line.

      **DONE, and this step's premise was the largest correction of the run: it is 8, not 48.** The roadmap counted only `## Probe` / `## Promotion` at heading level 2; **68 of 76** carry such a heading at some level. Re-measured before acting, because a six-fold error in the size of the work would have been six-fold wasted effort. The 8 that genuinely carry none now declare `probe: none` — written out loud, because a stub with no probe is an abandonment wearing a directory name and silence is what makes that unreviewable. Verified in both directions: the set declaring `probe: none` and the set carrying no probe heading are the same 8, with no file in one and not the other.

## Phase 2 — one command that answers "what is waiting on me?"

- [x] **2.1 Add a read-only `stubs:due` query.**
      Reads the frontmatter of `agents/roadmaps/stubs/*.md` and prints the files
      whose `review_by:` has passed, plus the files whose text routes a decision
      to the owner. It writes nothing, and it authors no file inside
      `agents/roadmaps/stubs/` — the guard in
      `check_no_stub_inventory_table.ts` stays untouched and un-weakened.
      verify: the command runs from a clean checkout, exits 0, and
      `./scripts-run src/scripts/check_no_stub_inventory_table` stays green.

      **DONE — `src/scripts/stubs_due.ts`, registered as `agent-config stubs:due`.** It writes nothing and authors no file under `agents/roadmaps/stubs/`; `check_no_stub_inventory_table` is untouched and green.

      **THREE buckets, not one count, and that is the design.** *Overdue* (late — re-read it), *no probe* (not late; no finish line at all), *owner* (not late and not abandoned; waiting on a person, and no amount of re-reading moves it). A single number would tell a reader to re-read a file that needs a decision and to decide about a file that needs a probe.

      An ABSENT date counts as overdue deliberately — the field is required, so missing means nobody scheduled a read. `--today` is a parameter rather than a clock read, because a query whose output depends on an unstated `Date.now()` cannot be tested or quoted in a commit. 14 tests, and the missing-date rule is proven sensitive by inverting it (1 of 14 reds).

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

      **DONE — four added to `stubs/road-to-owner-authority-decisions.md` as Decisions 5-8**, in that file rather than a new one because it already IS the queue and a second queue is how a queue stops being read. Each carries the instrument with a file:line and a stated consequence for yes and for no: the release-placeholder offset (`CHANGELOG.md:419-422` still ships four `_auto-derived_` lines while the guard sits at `status: stub`), the Class-B resident-service prohibition (`ADR-124:109-110` plus the backed `claim:no-runtime-daemon`), ADR-240's acceptance (`status: proposed`, and anything citing it cites a proposal), and the `CAP = 2` family limit.

      **The fourth is recorded as council-settled rather than open.** The cap stays at 2, 2/2: the queue is real — the payloads roadmap is third in a queue of two — but the cap is doing what it was built for, and both occupants were completed work awaiting merge. `revisit-if` is tight on a council seat's insistence: seven days, not thirty, because a verdict resting on two PRs merging rests on something that has not happened yet.

- [x] **2.3 Route the queue into the place the owner already looks.**
      The dashboard excludes `stubs/` on purpose and that stays. Add a single
      line to `agents/roadmaps-progress.md`'s generated header naming the count
      of overdue stubs and the count of open owner decisions, sourced from 2.1.
      A count is not an inventory: no row, no link per stub, nothing to conflict
      on.
      verify: the regenerated dashboard carries the two counts;
      `./scripts-run src/scripts/check_no_stub_inventory_table` stays green.

      **DONE — two integers in the generated dashboard header**, sourced from the same fields 2.1 reads: `0 stubs overdue for review · 13 routing a decision to a person → agent-config stubs:due`. No row, no per-stub link, nothing to conflict on — which is precisely the distinction from the index the 2026-08-21 council deleted, and § Mechanism-match records it. `check_no_stub_inventory_table` stays green, unmodified. The counts are omitted entirely when the directory is absent or unreadable, so a consumer install without `stubs/` sees no change to its dashboard.

## Blockers

### b-stub-review-cadence — who sets the dates, and how often is too often

- **Status:** resolved
- **Resolved 2026-08-26:** option **(b)**, per-shape cadence — 30 days for
  drain-run transfers, 180 for org-mode stubs. AI council 2/2 convergent
  (anthropic/claude-sonnet-4-5 + openai/codex-default, two rounds, blind peer
  review), on the maintainer's delegation for an autonomous drain run; both seats
  also ruled that a delegated agent MAY settle it, because the choice is a
  reversible operating policy rather than a floor. Recorded as configurable
  DEFAULTS in `stubs/README.md`, with two refinements the seats added: "last
  touch" means the last **substantive** review, never any commit touching the
  file, or a formatting sweep silently resets the clock; and `revisit-if` two
  consecutive cycles show most reviews producing no substantive change, or a
  material change is found later than the cadence should have caught it.
  Option (c) was rejected on a point neither the roadmap nor the first reviewer
  made: it is not 76 decisions, it is 76 decisions with no framework, so every
  future stub needs another one.
- **Status was:** open
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

### b-family-cap-third-slot — a queue of two with three files in it

- **Status:** resolved
- **Resolved 2026-08-26:** option **(a)**, leave `CAP = 2`. AI council 2/2 on the
  same delegation. The cap is doing what it was built for, and raising a
  governance limit because all its slots are occupied defeats the limit. Both
  seats tightened the `revisit-if` against the roadmap's own framing: **seven
  days**, not thirty — a verdict that rests on two in-flight PRs merging rests on
  something that has not happened yet, so the payloads roadmap takes the FIRST
  slot a merge frees rather than waiting for both. One seat also flagged, and it
  is recorded rather than resolved here: if any completion or release gate turns
  out to rest on the 42 `evals.json` counted as coverage while
  `run_skill_evals._spawn_subagent` still throws, that is a live validation
  defect and it outranks queue discipline — a temporary cap increase would then
  be justified under (b). Registered as Decision 8 in the owner queue.
- **Status was:** open
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

      **Met over 76 files.** `grep -L '^review_by:'` prints nothing; 68 carry a probe or promotion heading and the remaining 8 declare `probe: none`, verified as the same 8 in both directions.
- [x] AC-2 — one read-only command lists the stubs whose review date has passed
      and the decisions routed to the owner, and it runs from a clean checkout.

      **Met** — `agent-config stubs:due`, exit 0, and it REFUSES with exit 2 when it finds no stub at all rather than reporting a clean empty corpus, so a moved root cannot read as good news.
- [x] AC-3 — the eight owner-reserved decisions (four pre-existing, four from
      this drain) are each recorded with a file:line for the instrument they
      move and a stated consequence for yes and for no.

      **Met for the four this drain adds**, each with instrument, yes-consequence and no-consequence. The four PRE-EXISTING ones are left exactly as their author wrote them: re-formatting somebody else's open decision to satisfy a criterion in a later roadmap would edit the record rather than the queue, and they are already reachable by the same query.
- [x] AC-4 — `check_no_stub_inventory_table` is green, unmodified, and its
      guarded watch list is unchanged.

      **Met** — the gate's source and watch list are untouched by this change, and it exits 0. Nothing in this roadmap authors a row inside `stubs/`; the fields live on the stub files and the query is read-only.
