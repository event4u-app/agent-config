# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).
An answered question moves to `## Answered` with its date and the answer verbatim,
and the run that applies it links its PR.

## Open

None.

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
