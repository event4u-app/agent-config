# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).
An answered question moves to `## Answered` with its date and the answer verbatim,
and the run that applies it links its PR.

## Open

### OQ-1 — Lower R0/R1 ceremony now, before 30 shadow steps

- **Context:** the 2026-10-21 decision
  (`agents/evidence/owner-directives/2026-10-21-review-cap-and-depth-flip.md`)
  lowers R0/R1 depth on structurally safe paths only after a committed reading of
  30 shadow steps; the reading stood at 0 on 2026-10-21. The 2026-10-24 directive
  already cut council and evidence in the `full` row; review rounds and retro
  stay full.
- **Options:** (a) set the depth table `active` for R0/R1 on safe paths now,
  relying on the sampled full-depth audit (1 in 4) and its automatic return to
  full depth; (b) keep waiting for the 30-step reading.
- **Recommendation:** (a) — reversible in one commit, and the audit rolls a
  class back on its own.
- **Blocks:** `road-to-a-step-that-costs-what-it-changes` steps 4.1 and 4.2
  (blocker `class-depth-flip-reopens-the-risk-null`).

## Not owner questions — waits, or already settled in the tree

- `openai-council-seat-oauth-grant-rejected` (agent-throughput-recovery): its
  `Resolved when` asks for both seats answering a real round. Councils ran 2/2 on
  2026-10-24, so it looks settled. The agent verifies and closes it.
- `default-flip-of-the-installed-layer` (installed-layer): waits on a host
  observation and states itself "not a question".
- `four-dated-re-checks-are-calendar-bound` (corpus cadence): waits on calendar dates.

### OQ-4 — Cancel step-that-costs 1.1 (async telemetry concerns)

- **Context:** the seven telemetry concerns cost 1.2 ms of ~68 ms dispatch;
  running them async adds a second Node start per call.
- **Options:** (a) cancel 1.1 as `[-]`; (b) keep it open.
- **Recommendation:** (a) — the measured gain is below the added start cost.
- **Blocks:** step 1.1 of `road-to-a-step-that-costs-what-it-changes`.

### OQ-5 — Cancel step-that-costs 1.2 (stop ordinal from stored state)

- **Context:** saves ~15 ms per turn but moves risk into the turn-end gate.
- **Options:** (a) cancel 1.2 as `[-]`; (b) keep it open.
- **Recommendation:** (a) — 15 ms per turn does not pay for a new failure mode
  in the gate that refuses unfinished turns.
- **Blocks:** step 1.2.

### OQ-6 — How step-that-costs 4.2 narrows the rule load, and its paid A/B

- **Context:** an R0/R1 step should load only the kernel plus path-matching
  rules, but `~/.claude/rules` always loads, the roadmap forbids changing the
  installed layer, and a settings key is excluded. The A/B (Haiku, 2 tasks ×
  12 seeds) costs up to $3.5 per run.
- **Options:** (a) wait until 4.1 reads READY (R0 7 of 30) and decide then;
  (b) allow a narrowing mechanism outside those exclusions now and fund the A/B.
- **Recommendation:** (a) — 4.1 gates it anyway, and the mechanism question is
  cheaper with the flip data in hand.
- **Blocks:** step 4.2.

### OQ-7 — Self-modification: how an owner act binds a split council

- **Context:** `road-to-self-modification-that-a-council-must-pass` steps 3.4,
  4.1, 4.2, 5.2 and 6.2 are built (commits `1f9ab5fca`, `5ecf60b10`,
  `0e262c5c2`, `ec866ae5b`) but every review split: across ~25 rounds the openai
  seat refuses because no authenticated owner mechanism exists, which ADR-281 § 5
  deliberately leaves to the owner's forge act.
- **Options:** (a) land the four commits through the D11 forge bypass as the
  owner act; (b) reopen D11 / ADR-281 § 5 and build an in-tree authenticated
  owner acknowledgment first; (c) park the roadmap.
- **Recommendation:** (a) — the design already assigns this act to the owner,
  and more council rounds on unchanged designs would be verdict shopping.
- **Blocks:** steps 3.4, 4.1, 4.2, 5.2, 6.2 and AC-2, AC-3, AC-5.

### OQ-8 — The owner-authority register sits outside this list

- **Context:** `agents/roadmaps/stubs/road-to-owner-authority-decisions.md` holds
  owner-reserved decisions 1, 4, 5, 7, 8 and 9-12 plus the open halves of 2 and
  3, under `## Unresolved decision N` headings that neither this list nor
  `/roadmap:resolve-blockers` reads. Its `review_by` lapsed on 2026-09-25, and it
  has now arrived seven times; the seventh arrival found Decision 6 answered
  (ADR-249) but recorded open, corrected on 2026-10-25.
- **Options:** (a) the agent lifts each open decision into its own OQ row here,
  one per decision, and marks the register entries as moved; (b) the owner
  answers or retires the register in one pass; (c) leave it as a parked record.
- **Recommendation:** (a) — one list of every owner decision is what this file
  says it is, and lifting rows decides nothing in the owner's name.
- **Blocks:** nothing executable; the cost is that the decisions are unseen.

## Answered

| ID | Date | Question | Answer |
|---|---|---|---|
| impact-numbering-model | 2026-10-24 | Does the Consumer-Impact trailer bind the bump? | 1 — bind, automatic migration is not a major (ADR-300) |
| AC-4 release wording | 2026-10-24 | Amend AC-4 to the shipped `action` form? | 1 — amend |
| 7-1-closure-standard | 2026-10-24 | Closure standard for authority-routing 7.1 | 1 — ledger + fail-closed gate |
| 7-1-r16d-waiver | 2026-10-24 | R16.d: absent composite store | 1 — exit 0, as the contract says |
| cold-start 2.5 user layer | 2026-10-24 | Skipping workers and the `~/.claude` layer | 2 — carry a user-layer digest |
| cold-start floor overflow | 2026-10-24 | Floor laws over the cap | 2 — first law block per rule |
| cold-start first-block precedence | 2026-10-24 | Order when first blocks overflow | 1 — safety floor first, then alphabetical |
| rule-packs-retirement | 2026-10-24 | Retire `projection.rule_packs`? | 1 — retirement step, next major |
| projection-mode-removal | 2026-10-24 | Remove `projection.mode` (setup 4.7)? | 1 — remove in the next major, with the rule-packs retirement; recorded on step 4.7 |
| authority-surface-second-approver | 2026-10-24 | Second approver for the authority surface? | b — not now; `road-to-authority-routing-mechanism` parked in `later/` |
| ratification-platform-anchor | 2026-10-24 | Repository PAT for the ratification platform anchor? | b — defer; `road-to-typed-grants-that-persist` and `road-to-decision-closure` parked |
| request-gateway-probe | 2026-10-24 | Run the 7.2 gateway probe? | b — defer; `road-to-placeholders-on-the-wire` parked |
| wip-five-active | 2026-10-24 | Which five roadmaps stay active? | a — cold-start, update-installs-itself, setup-decides-itself, step-that-costs, hook-guards-17; 18 parked with `entry_condition` and `review_by: 2026-11-24` |
