# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).
An answered question moves to `### OQ-8 — Self-modification AC-5: a proposal that passed, or one that landed

- **Context:** AC-5 of `road-to-self-modification-that-a-council-must-pass` asks
  for one proposal whose change passes the gate on a passing record. The only
  proposal, `test-through-the-entry-point`, carries a refused record and landed
  through the owner's forge act (OQ-7), so the criterion is not met as written.
  It is the roadmap's last open item once 3.4 to 6.2 and AC-2/AC-3 are on main.
- **Options:** (a) run one new learning through a two-seat modification review
  until a record passes, then close AC-5; (b) amend AC-5 to accept a change that
  landed through the D11 owner route with its refused record; (c) park the
  roadmap with AC-5 as the entry condition.
- **Recommendation:** (a) — it is the only option that proves the pipeline can
  pass, which is what the criterion is for; (b) weakens it and is yours alone.
- **Blocks:** AC-5 and the archive of the roadmap.

## Answered` with its date and the answer verbatim,
and the run that applies it links its PR.

## Open

## Not owner questions — waits, or already settled in the tree

- `openai-council-seat-oauth-grant-rejected` (agent-throughput-recovery): its
  `Resolved when` asks for both seats answering a real round. Councils ran 2/2 on
  2026-10-24, so it looks settled. The agent verifies and closes it.
- `default-flip-of-the-installed-layer` (installed-layer): waits on a host
  observation and states itself "not a question".
- `four-dated-re-checks-are-calendar-bound` (corpus cadence): waits on calendar dates.

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

### OQ-9 — Which tree owns "who is the user", and what "profile" and "pack" mean

- **Context:** ADR-010 gives the "who" question to one axis, `profile.id`, and
  calls duplication across axes a contract violation. Three trees answer it:
  `src/profiles/*.yaml` (command views), `src/agent-src/profiles/*.yml` (seed
  identity) — six shared ids, different `packs` vocabularies — and
  `user-types/` (seven other ids, read only to order MCP prompts). "Profile"
  also names the install scope, `discipline_profile` and session overlays;
  "pack" names `src/packs`, `src/domains/*/pack.yaml` and
  `src/agent-src/packs`. Raised by round `inbox-2026-10-an`; both of its plans
  recommended the seed tree.
- **Options:** (a) the seed tree owns the axis, `src/profiles` is generated
  from it as the command view, `user-types` folds into a seed-profile field
  with an id mapping, and the extra meanings get prefixed names with aliases
  for one release; (b) keep three trees and document the split (done in
  `road-to-a-measured-pointer-gate-and-true-records` 1.3); (c) (a) without the
  renames.
- **Recommendation:** (c) first — it removes the duplicated axis without
  touching public names; the renames can follow once the ids are single.
- **Blocks:** nothing executable; settings key `personal.user_type` and the
  profile ids are public surface, so no run changes them unasked.

### OQ-10 — Measure per-skill uplift against a no-skill arm

- **Context:** `agents/roadmaps/stubs/road-to-skill-uplift-against-a-no-skill-arm.md`
  poses this and has now arrived six times, the latest in round
  `inbox-2026-10-an`. `run_skill_evals.ts` still throws from
  `_spawn_subagent` and grades every rubric `pass: null`, so no skill has a
  measured outcome delta.
- **Options:** (1) fund a pilot — one host, three skills with a deterministic
  outcome check, published either way; (2) fold a per-skill outcome column into
  the tiering live arm; (3) decline and record that per-skill uplift is not
  measured.
- **Recommendation:** (1) — the stub's own recommendation, and the only option
  that answers the question that keeps arriving.
- **Blocks:** the stub's promotion; nothing active.

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
| OQ-1 | 2026-10-25 | Lower R0/R1 ceremony now, before 30 shadow steps? | a — flip now on the audit (`agents/evidence/owner-directives/2026-10-25-step-costs-oq-1-4-5-6.md`) |
| OQ-4 | 2026-10-25 | Cancel step-that-costs 1.1? | a — cancelled |
| OQ-5 | 2026-10-25 | Cancel step-that-costs 1.2? | a — cancelled |
| OQ-6 | 2026-10-25 | How 4.2 narrows the rule load, and its A/B | a — wait for the flip data |
| OQ-7 self-modification owner act | 2026-10-25 | Land the split-council self-modification work? | 1 — land through the D11 forge bypass; 3.4, 5.2 and 6.2 ride one PR the owner merges with bypass, 4.1 and 4.2 follow in their own change after the writer is on main |
