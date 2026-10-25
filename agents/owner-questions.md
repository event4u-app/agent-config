# Owner questions

One list of every open decision that only the owner can take. Runs do not open a
pull request whose only content is a question; they add a row here and take the
next step (`agents/evidence/owner-directives/2026-10-24-throughput-over-ceremony.md`).
An answered question moves to `## Answered` with its date and the answer verbatim,
and the run that applies it links its PR.

## Open

### OQ-13 — Restore the kernel literal in non-destructive-by-default

- **Context:** `check_rule_invariants` exits 1 on main because
  `src/rules/non-destructive-by-default.md` no longer carries the clause "The
  ask and the action are strictly sequential … WAIT for the answer"; the rule was
  reworded. It is the one red in `task ci` an agent may not fix: a kernel-rule
  edit is owner-gated, and the edit itself is written out in
  `agents/roadmaps/stubs/road-to-kernel-clause-1-restore.md`. Arrived in four
  earlier rounds and again in `inbox-2026-10-as`.
- **Options:** (a) restore the literal sentence as the stub writes it; (b)
  update the invariant to the current wording and record why; (c) leave it red.
- **Recommendation:** (a) — the stub's edit is ready and keeps the rule's text
  and its invariant saying the same thing.
- **Blocks:** a green `check_rule_invariants`, and with it the last owner-red in
  `task ci`.

### OQ-14 — Reopen ADR-263 for a package-side run basis

- **Context:** round `inbox-2026-10-at` asks that every run determines its base
  skills once and closes them out (`later/road-to-a-run-that-knows-its-skills`).
  ADR-263 (`reopen_policy: owner`) rejected a package-side routing claim because
  no host routing contract exists; a run basis needs none — it uses the
  documented hook contract only. Its zero is read from one store slug
  (`stubs/road-to-a-census-that-refuses-a-partial-store`).
- **Options:** (a) reopen now, narrowly: a package-side run basis is not a host
  routing claim; the rest of ADR-263 stands; (b) reopen only after a census over
  every store slug (that roadmap's step 1.1) is recorded; (c) do not reopen.
- **Recommendation:** (b) — the census is cheap, and it decides whether the
  ADR's own review trigger has already fired, which would make this a supersede
  rather than an owner reopen.
- **Blocks:** Phase 2 of `later/road-to-a-run-that-knows-its-skills`.

### OQ-15 — Un-park the live selection floors and fund one pilot

- **Context:** `later/road-to-routing-assurance-live-floors` now has 5 arrivals;
  each recommends its option (1): a protocol frozen by a session that did not
  author the corpus, then one pilot on the host's evaluator, natural against
  explicit invocation. The question itself is council-decidable; the pilot is
  metered spend, and the file can only start in a free active slot.
- **Options:** (a) yes, with a cap of 25 USD for the pilot, started in the next
  free slot; (b) yes, with a different cap you name; (c) keep it parked.
- **Recommendation:** (a) — five rounds have asked the same question, and one
  bounded run answers whether the package hides its own skills.
- **Blocks:** every step of `later/road-to-routing-assurance-live-floors`.

### OQ-16 — One stale word in the ai-council skill

- **Context:** `src/skills/ai-council/SKILL.md:91` calls `/review-changes` an
  "internal four-judge pass"; it dispatches seven. Every other surface was fixed
  in `road-to-a-plan-that-stays-true` 5.1, but any edit to this file classifies a
  PR `needs-owner` (council surface, ADR-281), so it was left out of that PR.
- **Options:** (a) a one-line PR changing "four-judge" to "7-judge" (the body
  budget allows no longer wording), merged by you; (b) leave it.
- **Recommendation:** (a) — the drift is the defect `review_changes_judge_count`
  exists to stop, one file away from its scope.
- **Blocks:** nothing; one stale cardinal remains.

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

### OQ-11 — The ADR-138 teardown review opens on 2026-10-28

- **Context:** the global user-profile layer reaches day 90 on 2026-10-28 with
  0 observations proposed (none even on the maintainer's machine; proposals come
  only from the manual `/memory mine-session`). The council's amendment of
  2026-10-25 makes that a no-adoption signal that opens the teardown review, and
  bounds the review: non-destructive, user data inventoried and preserved,
  nothing deleted without consent. `/agents user show --audit` shows the reading.
- **Options:** (a) archive-first deprecation — deprecate the commands for one
  release, keep the code and any user data in an archive; (b) redesign activation
  — e.g. offer mining at a natural moment instead of only on request, then read
  the gate again; (c) one bounded trial — fixed exposure, expiry and a minimum
  sample, decided in advance.
- **Recommendation:** (b) scoped as (c) — the layer was never offered, so its
  value is untested; one bounded trial with a fixed end answers that, and (a)
  stays the default if the trial does not reach its sample.
- **Blocks:** nothing executable; the review's outcome can deprecate a
  user-data layer, which is the owner's call
  (`road-to-a-memory-that-names-its-moment` § Decisions E12).

## Answered

### OQ-17 — Fund or close the outcome benchmark against S4

- **Context:** `agents/roadmaps/stubs/road-to-assurance-benchmark.md` asks for a
  measured outcome comparison (native / neighbour / native plus neighbour). The
  demand arrived a fifth time in `inbox-2026-10-au`, a comparison against deny
  group S4 that ends: no overall winner can be named until a shared benchmark
  runs. The stub's `review_by` (2026-09-25) is 30 days lapsed. Prior results
  predict caution: strong-host lift was an honest null (`docs/benchmark.md`).
- **Options:** (a) fund a pre-registered pilot — two task classes from the
  stub, one host, a named spend cap — and renew `review_by`; (b) archive the stub
  with its probe recorded and answer future arrivals with that record; (c) leave
  it parked with a new `review_by`.
- **Recommendation:** (a) — five arrivals say the question will keep coming, and
  a small pre-registered pilot answers it either way for a bounded cost.
- **Blocks:** every head-to-head KPI in the round's master plan.
- **Partly answered 2026-10-25:** the owner chose the pilot — "3" (both the
  roadmap for the unreached exports and this pilot), after "Ok, mach genau das".
  The plan is `agents/roadmaps/road-to-a-pilot-benchmark-against-s4.md`. **Still
  open: the spend cap** — no figure was given and `cost.budgets` is set nowhere;
  it gates the pilot's steps 1.4 and 3.1.
- **Answered 2026-10-25:** "1" — option 1 of the follow-up: a **$150** cap for
  the whole pilot, land both roadmaps by PR and merge, then run the pilot
  roadmap. Applied in `road-to-a-pilot-benchmark-against-s4` (blocker
  `pilot-spend-cap` resolved).

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
| OQ-12 self-modification AC-5 | 2026-10-25 | A proposal that passed, or one that landed? | b — amend AC-5: a change that landed through the D11 owner route with its refused record counts; the roadmap closes |
