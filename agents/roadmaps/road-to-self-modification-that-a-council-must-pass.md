---
complexity: structural
status: ready
execution:
  mode: phase-checkpoints
estate_offset_exempt: "An owner directive of 2026-10-05 makes self-modification a goal on one condition: an AI council confirms it at the least, questions what the change does, and the user decides when the council cannot. At the pin the approval record names no change, the council has no question set and no verdict of its own for such a review, the reviewer's code sits outside the gate, a council that cannot conclude leaves no way for the owner's word to be recorded, and the lane meant to carry a change nobody asked for has produced no proposal. The roadmap that owns the ratification gate is a draft waiting on two owner blockers. Merging these steps into it was considered and rejected: they would wait behind blockers none of them needs. Adds no gate script and no verdict vocabulary; extends one artifact, one council review and one path list."
estate_growth_exempt: "Grows open_blockers by two. One asks the owner to confirm how far the directive reaches, with the measured cost of the wider reading and with the quorum and escalation rules the tree already reserves to the owner written into the record he accepts. The other asks by which route the owner's own permission is given when a council cannot conclude, because every route this file could build for it is one an agent could also write. Also grows active_roadmaps by one, because the owner asked on 2026-10-05 for this round's roadmaps to land as ready in one change."
relates:
  - slug: road-to-typed-grants-that-persist
    relation: extends
    note: "Its Phase 5 built the artifact and the gate; Phases 2 to 5 here extend both. It keeps the retirement of the tool-call deny and both open blockers on it; step 1.3 here adds one dated note beside them and edits none of its steps."
  - slug: road-to-gate-preauth-authorization
    relation: disjoint
    note: "Stub. Owns the undecided matter of where an authorisation only a person may give is kept. The second blocker here meets the same matter for the owner's permission and builds no answer of its own."
  - slug: road-to-ac-deep-capabilities
    relation: disjoint
    note: "Later, draft. Its Workstream C owns learning evidence and the promotion boundary. Phase 6 here builds none of it and leaves one dated note beside its step C3."
---
# Road to self-modification that a council must pass

> **Source:** an owner directive given on 2026-10-05 during an external
> comparison round against an autonomous-runtime tree (opaque id S1) that edits
> its own code behind a path list, a rate limit and a snapshot, with the editor
> as its own judge. The directive, in the owner's words: self-modification is
> good and should be a goal here too; it must at the least be confirmed and
> permitted by an AI council, which always questions critically and checks
> what the modification does; and in the last resort the user must permit it.
> Every anchor below was read, the artifact validation and the commit census
> run, and the whole file re-read by an independent pass, at `main` @
> `df377ca64` on 2026-10-05. Class: owner directive; external comparison
> corpus.
>
> Round `agents/tmp.old/inbox-2026-10-d/`. Re-verified anchor by anchor at
> `main` @ `975d03d01` on 2026-10-05 by five independent read-only passes;
> the one commit since the pin moved no anchor, and their corrections are in.

## Goal

A change the package makes to what governs it lands on a council's verdict
about that exact change. The record is bound to the reviewed content, the
council answered a fixed set of questions about what the change does, the code
that reviews is itself inside the reviewed surface, and a council that cannot
conclude stops the run for the user, whose permission then has a route the
owner chose. One change that no one asked for has travelled that lane from
capture to a change that passes the gate, by an agent's hand and on a
council's record.

## Context

At `df377ca64`:

- **The decision exists and is half-built.** "Kernel rules, governance hooks
  and authority schemas may be edited inside an authorised mission. An
  authority-expanding edit is inert until a ratification artifact exists"
  (`docs/decisions/ADR-268-*.md:191-193`), with the ladder "an independent
  session or agent → the AI council, CLI-first → a different provider → the
  owner" (`:201-203`). The gate that reads the artifact ships beside the
  tool-call deny, not in its place
  (`docs/contracts/ratification-artifact.md:92-96`), although ADR-268 § 4
  itself still says the deny "is replaced by a CI gate" (`:203-204`) — the
  sentence step 1.1 amends. Asking for more
  independence is, by the same record's § 0 (`:90`, table row `:122`), an allowed narrowing; routing a
  technical decision to the owner because it is hard is not.
- **In practice the reviewer already is a council.** 23 artifacts stand under
  `agents/evidence/ratifications/`; 22 name a council in `reviewed_by`, in 19
  different spellings. Run through the repository's own reader with the
  committed policy (`src/config/ratification-policy.json`, two providers
  required), 21 validate and two do not: one carries a verdict outside the
  closed vocabulary, one names a single provider and a subagent as reviewer.
  The ladder's first rung is therefore weaker in the text than in the reader.
- **The record names no change.** The six required fields are who proposed,
  who implemented, who reviewed, which providers, the verdict and
  `effective_after` (`src/scripts/_lib/ratification_artifact.ts:69-76`). None
  identifies a diff. The gate passes when any one artifact in the changed-file
  list validates (`src/scripts/check_kernel_edit_ratified.ts:406-445`), so a
  gated file edited after the review still lands on the review's record. A
  hash that binds a review to a diff exists for another gate — "the token the
  review binds to" (`src/scripts/dispatch_r2_reviewer.ts:302-320`). It is taken
  over diff text against a base, and this gate is run on the pull request's
  merged checkout with a file list and no base
  (`.github/workflows/consistency.yml:913-931`): an independent probe of this
  round got two different hashes for one unedited change once the base had
  moved on a file the change also touches. That hash's own gate still runs
  advisory in CI (`consistency.yml:604-621`), with 199 recorded re-bind events
  behind it (`agents/evidence/analysis/review-binding-drift.md:18-19`).
- **The council has no review of this kind.** Its diff and pull-request lenses
  end on "APPROVE / REQUEST_CHANGES / REJECT" and a sentence
  (`src/scripts/ai_council/prompts.ts:71`, `:101-103`); no code reads that
  line, and the artifact's verdict is typed by the agent that wrote the diff.
  A closing line per seat that code does read exists — the stance line and
  its parser (`prompts.ts:171`; `src/scripts/ai_council/stance_tally.ts:106`).
  Its tally is built for picking between options: at two seats it calls two
  different labels, or two low-confidence equal ones, a split, and it is
  switched on by configuration only. No prompt in `src/scripts/ai_council/` mentions a
  kernel, a ratification or a modification. A pass concludes with one of two
  seats present — "1-of-2 is the deliberate choice"
  (`src/scripts/ai_council/quorum.ts:13-19`). The contract says what the
  record cannot show: "It cannot read whether the review actually happened"
  (`ratification-artifact.md:485-486`); council output is confined to
  `agents/runtime/council/` (`src/scripts/council_cli.ts:227-231`) and is
  "gitignored and pruned" (`src/scripts/council_record_shape.ts:26`).
- **The reviewer is outside what it reviews.** The gate watches itself, its
  reader, its policy file, its workflow and three anchor files
  (`check_kernel_edit_ratified.ts:89-124`). `src/scripts/ai_council/` and the
  artifact contract are not on the list. A header comment in the gate says
  two source files "are also denied at tool-call time" (`:175-178`); the two
  deny hooks match neither (`src/scripts/hooks/block_plumbing_writes.ts:102-107`
  lists four build outputs).
- **A council that cannot conclude leaves the owner no record to give.** The
  two passing verdicts are `ratified` and `confirmed-non-expanding`
  (`ratification_artifact.ts:63-66`), both under the provider count. The gate
  runs in a required job, and the committed platform expectation allows no
  unconditional bypass (`src/config/platform-anchor.json:16`). The contract's emergency procedure is for "an active
  incident" and says "*the check is red*" is not one
  (`ratification-artifact.md:185-193`). So where the ladder ends at the
  owner, nothing the owner can write passes the gate.
- **When the council fails, the standing instruction is to decide alone.** "Do
  not bounce to the user just because the council failed … Decide it, label it
  own analysis" (`src/skills/ai-council/SKILL.md:67-69`), and a subagent
  fan-out is "a legitimate substitute only when named as such"
  (`src/rules/council-availability.md:71-72`). For an ordinary design question
  that is the recorded intent. For a change to the governing surface it is
  the editor judging its own edit.
- **The lane for a change nobody asked for has produced nothing.** The
  guideline describes five stages and opens with "No autonomous self-edits;
  every upstream change ships via a human-reviewed PR"
  (`docs/guidelines/agent-infra/self-improvement-pipeline.md:4-5`); stage five
  needs "a human approver" (`:87`). `agents/proposals/` holds its README and
  no proposal; `agents/learnings/` does not exist. The stage-four gate exists
  as the CLI verb `proposal:check` and is invoked by no workflow, task or
  hook. The stage-five skill is said to refuse a proposal that is not
  `stage: gated` (`:88-89`); it runs the check for a contribution that comes
  from a proposal and contains neither `stage: gated` nor `gated`. The archived roadmap's closing
  criterion — "one real learning from this repo's own history is walked
  through the pipeline as a worked example"
  (`agents/roadmaps/archive/road-to-curated-self-improvement.md:158-159`) —
  has no artefact in the tree. A parked draft owns what comes after:
  learning evidence, validation, and a promotion boundary whose substrate is
  the self-repair line and whose null route is "promotion stays manual"
  (`agents/roadmaps/later/road-to-ac-deep-capabilities.md:163-192`); the
  programme's kill register parks "Causal self-improvement with automated
  promotion" on it (`agents/roadmaps/archive/road-to-leading-every-row.md:231`).
- **Shipped sentences say the opposite of the decision.** "Kernel rules are
  **immutable**" (`src/agent-src/templates/AGENTS.md:17`); "kernel rules are
  immutable, never propose an edit" (`docs/threat-model.md:44-45`); "no loop
  commits changes to `src/skills/` or `src/rules/` without human approval"
  (`docs/decisions/ADR-118-*.md:104-108`).
- **What gating more would cost, counted.** Of the 49 most recent commits
  before the pin — 2026-10-01 to 2026-10-05, the depth of the clone this was
  read from — 22 touch a rule, skill, command, hook, gate script, council file
  or the settings template (21 when only `src/scripts/hooks/` counts as a
  hook; 22 when a hook-registered script outside it does, as one did); 8 carry a ratification artifact; one touches
  council code; four touch a rule outside the kernel.
- **Changing the reviewer is already owner-reserved.** "Governance
  self-amendment — reopening authority, quorum, escalation"
  (`src/rules/decision-revisit-gate.md:142`).

## Phase 1 — The directive is a decision on record

- [ ] **1.1 One decision record, drafted as proposed.** A new ADR with
      `status: proposed`, numbered with the next free number and carrying
      `council-confirmed-self-modification` in its file name, quotes the
      directive with its date and states three things. Self-modification is a goal, not an exception. For a change to
      the gated surface, and for a change that originates in the package's
      own learning lanes, the lowest rung that can pass is the council; an
      independent session alone no longer ratifies. The rest of the ladder of
      ADR-268 § 4 stands — a different provider, then the owner on
      non-convergence, on unavailable diversity for a critical expansion, or
      on an owner-reserved dimension — and a change to the reviewer itself
      joins the owner's list. Because quorum and escalation are the owner's
      to set, the record also states, for him to accept or strike: the
      verdict rule of step 3.3 and the conditions of step 5.1. It amends the ladder sentence of ADR-268 § 4 and
      rejection 2 of ADR-118 § 3, leaves rejection 1 and the rest of both
      standing, and carries the scoped-supersession fields and the
      `## Not reopened` and `## Evidence` sections the ADR gates require.
      While it is proposed, the two records it would amend are not touched.
      verify: `grep -l 'supersedes_scope' docs/decisions/*council-confirmed-self-modification* | wc -l` -> /^1$/
- [ ] **1.2 On acceptance, the sentences that say otherwise are corrected.**
      The two amended records gain their reciprocal field and the index is
      regenerated. The consumer template, its tracked copy and the threat
      model state what ADR-268 and the new record state: kernel rules change only through a ratified edit,
      and an override may tighten one. The pipeline guideline's opening and
      its stage five name the council's record as the approval and the user
      as its last rung, and so does the improvement skill's line on when a
      learning hardens into a rule or skill: for a proposal scoped to the
      package, on the council's record; for a change a user asked for, on that
      user's approval as now. The contract's ladder paragraph follows 1.1.
      Left as they are, because each is about sending something outward or
      about the deny and not about approving a change: the deny hook's own
      message, the self-repair rule's outward step, the upstream skill's
      consent line and the upstream rule's ask.
      verify: `cat src/agent-src/templates/AGENTS.md dist/agent-src/templates/AGENTS.md docs/threat-model.md docs/guidelines/agent-infra/self-improvement-pipeline.md | grep -cE 'are \*\*immutable\*\*|rules are immutable|No autonomous self-edits|human approver signed off'` -> /^0$/
      Positive control: without the projected copy the command returns 4 at
      `df377ca64` and `975d03d01`; the projected template is listed so the
      shipped file is checked, not only its source.
- [ ] **1.3 The owners of the neighbouring work are told.** One dated note
      beside the blockers `ratification-platform-anchor` and
      `kernel-guard-first-crossing` in `road-to-typed-grants-that-persist`,
      and one beside step C3 of the parked draft, name the new record. No
      step, blocker field or decision in either file is edited, and the deny
      is not touched here.
      verify: `grep -l 'council-confirmed-self-modification' agents/roadmaps/road-to-typed-grants-that-persist.md agents/roadmaps/later/road-to-ac-deep-capabilities.md | wc -l` -> /^2$/

## Phase 2 — An approval is bound to what it approved

- [ ] **2.1 The record carries a digest of the gated content it reviewed.**
      The artifact gains a `subject` field: one digest over the sorted paths
      and contents of every file of the change that the gate classifies as
      gated, with a deleted file entered as deleted. One function in a module
      of its own computes it for whoever writes the record and for the gate,
      which recomputes it from the tree it is pointed at and refuses a record
      whose `subject` is absent or different. Which files count as gated is
      decided by the classifier of the base revision, for the writer as for
      CI, so that a change which widens the gated set and edits a newly gated
      file is judged and written by the same list. It needs no base diff, so it is the
      same on a branch and on the merged checkout CI judges unless the base
      changed a gated file the change also touches — and then the content
      that would land is not the content that was reviewed. The fixtures of
      the two existing suites gain the field. The new test edits one byte of
      a gated file after the record was written and expects red, moves the
      base on an ungated file and expects green, moves it on the gated file
      and expects red, and writes and judges a change that widens the gated
      set.
      verify: `npx vitest run tests/scripts/ratification_subject_binding.test.ts` -> 0
- [ ] **2.2 Each record answers for its own change.** A record validates a
      diff only when its `subject` matches that diff's gated content; a second
      valid record for something else no longer carries it. The 23 records on
      the trunk are not rewritten: they were judged when they landed and are
      read by nothing afterwards. A change that is open when this lands needs
      a record with a `subject` once its base carries the new gate, because
      the gate is judged from the base.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_subject.test.ts` -> 0

## Phase 3 — The council reviews a modification as one

- [ ] **3.1 A fixed set of questions, in a module of its own.** When the
      bundle of a diff review contains a gated path, every seat is asked, and
      answers one by one: what behaviour changes, including what follows from
      it; which authority or safety boundary becomes wider or narrower;
      whether the change weakens anything that judges it — a test, a gate, a
      threshold, this review; whether another host or projection is left as a
      way around it; whether it can be undone and how; what observation would
      show the claimed benefit to be false; whether a smaller change would do;
      what it adds to standing instruction weight; whether untrusted content
      could steer the path. The list is one constant in a new module, quoted
      in the contract; where the tree already words a question — the
      evaluator rule on weakened assertions, the synthesis prompt on kill
      criteria — that wording is used.
      verify: `npx vitest run tests/scripts/ai_council/modification_review_questions.test.ts` -> 0
- [ ] **3.2 Each seat closes on the stance line, read by the parser that
      exists.** The review asks every seat for the existing closing line with
      one of three labels — `ratified`, `confirmed-non-expanding`, `refused` —
      and reads it with the existing seat-line parser. The option tally and
      the synthesis verdict line are not used for this review: they answer
      which option wins, not whether each seat passed the change. The diff
      lens's own closing line is not asked for. The review is a verb of its
      own in a module of its own, inside `council_cli`'s dispatch and not a
      new `agent-config` verb — the CLI help-count budget is at its maximum
      (`src/config/evaluator-budgets.json`, `cli_help_command_count`); the council command, which is over the line
      ratchet, is not edited.
      verify: `npx vitest run tests/scripts/ai_council/modification_review_stance.test.ts` -> 0
- [ ] **3.3 The record's verdict is derived, by one rule.** A seat concludes
      when its line parses to one of the three labels; a missing line, an
      abstention or any other label is a seat that did not conclude. Then, in
      this order: any concluding seat on `refused` gives `refused`; fewer
      concluding providers than `required_providers` in the ratification
      policy gives `non-convergent`; otherwise `ratified` if any seat said so
      and `confirmed-non-expanding` if all did.
      verify: `npx vitest run tests/scripts/ai_council/modification_review_verdict_rule.test.ts` -> 0
- [ ] **3.4 The record is written from the run, not typed.** One writer, in
      the module of 2.1, turns the session record of such a review into the
      artifact: `reviewed_by` in one spelling, `providers` from the seats that
      concluded, the derived verdict, `subject` for the tree the bundle was
      built from, and each seat's answers in the body. Council output stays
      where it is; the writer reads it. Every tracked edit of the change
      precedes the review, because any later edit to a gated file moves the
      digest.
      verify: `npx vitest run tests/scripts/ratification_record_writer.test.ts` -> 0

## Phase 4 — The reviewer and the consequence class are inside the gate

- [ ] **4.1 The review's own code is a gated surface.** The gate's watch list
      gains the modules of Phases 2 and 3 — the digest and the writer, the
      questions, the verdict rule — and the artifact contract. Because they are modules of their
      own, an ordinary change to the council's prompts or transports stays
      ungated. A change to any watched one is a change to the reviewer: it
      needs a passing record and the owner.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts` -> 0
- [ ] **4.2 Rule law beyond the nine kernel rules.** The gate's path set is
      extended by the members of `src/config/rule-consequence-class.json` —
      28 at the pin, selected by a criterion and not by name. The gate reads
      that list from its own tree, as it reads its policy, and the list and
      the schema that states its criterion join the watch list, so that a
      change cannot drop a member in order to edit it. The schema is shared
      by every rule, so any edit to it then needs a record too.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts` -> 0
- [ ] **4.3 The comment matches the hooks.** The gate's header stops saying
      that the dispatcher source and the kernel list are denied at tool-call
      time.
      verify: `grep -c 'also denied at tool-call time' src/scripts/check_kernel_edit_ratified.ts` -> /^0$/
      Positive control: the same grep returns 1 at `df377ca64`.

## Phase 5 — A council that cannot settle it stops the run for the user

- [ ] **5.1 The conditions, once.** The contract lists when the user decides,
      in the order of ADR-268 § 4: the record is `non-convergent` after a
      different provider was tried; provider diversity is unavailable for a
      critical expansion; the change touches a row of the owner-reserved table
      in `decision-revisit-gate`; the change is to the reviewer itself. The
      council skill's instruction to decide alone when the council fails, and
      the availability rule's substitute clause, each gain one sentence: not
      for a modification review.
      verify: `grep -l 'modification review' src/skills/ai-council/SKILL.md src/rules/council-availability.md | wc -l` -> /^2$/
- [ ] **5.2 The stop has a shape.** In those cases the run ends with the
      change open and labelled, the non-passing record in it, and one question
      for the user: the council's recommendation, the dissent, the exact
      change, what it is expected to gain, what it risks, and how it is
      undone.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_escalation_message.test.ts` -> 0
- [ ] **5.3 The user's permission takes the route the owner chose.** At the
      pin there is none: only a council record with two providers passes, the
      check is required, and the contract's bypass procedure is for incidents.
      This step implements the option the second blocker's answer names, and
      whatever it builds states in the contract what it cannot prove.
      verify: `npx vitest run tests/scripts/ratification_owner_route.test.ts` -> 0

## Phase 6 — One change nobody asked for travels the whole lane

- [ ] **6.1 The pipeline's approval is the council's record.** For a proposal
      whose scope is the package, `check_proposal` accepts `stage: gated` only
      when the proposal names a record whose `subject` matches the files the
      proposal declares as its change; a proposal scoped to a consumer's own
      project is checked as before. The stage-five skill refuses a proposal
      that is not `stage: gated`, as its guideline has claimed. Sending the
      result outward keeps the consent it has.
      verify: `npx vitest run tests/scripts/check_proposal_gated_needs_record.test.ts` -> 0
- [ ] **6.2 A worked example, for real.** One learning from this repository's
      own history is captured, proposed, and passed by a modification review
      as a change to a rule or skill body; its proposal stays under
      `agents/proposals/` naming the record, and the change passes the gate.
      An agent does each step on this roadmap's instruction; nothing is
      promoted by a loop, and whether the change lands is the usual call.
      verify: `grep -rl 'agents/evidence/ratifications/' agents/proposals | grep -vc README` -> /^[1-9]/

## What this roadmap deliberately does not do

- No landing authority is added. Whether a run may land its own change is the
  typed grant's question; a passing record makes a change ready, not landed.
- The tool-call deny on kernel rules is not retired, bypassed or cited as
  retirable, and its message is not edited. That replacement was refused twice
  and waits on its blocker, so an agent still cannot edit a kernel rule on the
  one host where the deny refuses.
- No automated promotion and no learning store. Both belong to the parked
  draft's Workstream C, and the kill on automated promotion stands.
- No rollback after landing. Nothing in the tree ties a landed rule or skill
  change to a later measurement.
- No new verdict vocabulary and no second approval field for the pipeline.
- No council for every commit that touches a skill or a command.
- The self-repair loop, its deny list and its outward step are not changed.
  After this roadmap a self-repair fix outside the gated surface still needs
  the user's word to leave the machine and no council to be written.
- The consumer override registry is not changed.

## Blockers

### blocker: self-modification-directive-reading-confirmed
- **Status:** open — owner answered (a) on 2026-10-06 via `/roadmap:resolve-blockers` (D10); closes when step 1.1's record lands accepted, which is agent work and no longer a question
- **Owner:** owner
- **Blocks:** 1.2, 1.3, 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 5.1, 5.2, 5.3, 6.1, 6.2
- **What to do:** pick exactly one — (a) accept the proposed record of step
  1.1 as drafted: the council is the lowest passing rung for the gated
  surface and for changes the learning lanes originate, with the verdict
  rule and the escalation conditions as written there; (b) wider — every
  change to a rule, skill, command or hook needs the review, at the measured
  rate of 22 in 49 commits; (c) narrower — the gated surface only. Under any
  of them, strike or change the verdict rule or a condition if you read
  quorum or escalation differently.
- **Resolved when:** `grep -l 'status: accepted' docs/decisions/*council-confirmed-self-modification*`
  prints the record.
- **Recommendation:** (a) — it covers what governs and what the package
  proposes on its own, and leaves commissioned work at its present speed.
- **If you do nothing:** the ladder keeps a first rung the reader already
  refuses, and the texts of step 1.2 keep saying kernel rules cannot change.
  Steps 1.1, 2.1, 2.2 and 4.3 do not wait: the binding is right under any
  of the three.

### blocker: owner-permission-route
- **Status:** open — owner chose (b) on 2026-10-06 via `/roadmap:resolve-blockers` (D11), with the ask-first condition recorded there; closes when the record of step 1.1 names it and is accepted, which is agent work and no longer a question
- **Owner:** owner
- **Blocks:** 5.3
- **What to do:** pick exactly one, and have the record of step 1.1 name it —
  (a) an owner-ruling record that passes only beside the council's
  non-passing record for the same `subject`. It needs a place only a person
  writes: at the pin the one fence against agent writes is the Class C
  settings path, this repository tracks no settings file of its own, and
  where such an authorisation is kept is what the gate-preauth stub
  has still to decide — so (a) costs a new classified key, a committed
  settings file and that stub's answer. (b) The owner's own bypass on the
  forge, recorded and restored. It is the one act an agent cannot perform,
  and it costs an amendment of two sentences of the contract that today
  rule it out — a red check is "not" an emergency, and an unconditional
  bypass actor is a failure of the platform anchor — plus a forge action
  per case. (c) No route: a change the council cannot pass does not land
  until it is changed so that the council can.
- **Resolved when:** `grep -c 'owner-permission-route' docs/decisions/*council-confirmed-self-modification*`
  returns at least 1 and that record is accepted.
- **Recommendation:** (b), amended into the contract for recorded
  non-convergence only — its anchor is the platform and not a string, which
  is where the contract already says trust comes from. (c) is what the tree
  does today.
- **If you do nothing:** the directive's last rung stays as it is at the pin:
  where the council cannot conclude, nothing you can write passes the check.

## Acceptance Criteria

- [ ] AC-1 — A gated file edited after its review turns the gate red until a
      new review exists, and a base that moved on other files does not.
- [ ] AC-2 — A modification review with one provider concluding produces a
      record that does not pass.
- [ ] AC-3 — A change to the question list, the verdict rule or the writer is
      refused without a passing record.
- [ ] AC-4 — The contract names the route by which the owner permits a change
      the council could not pass, and what that route cannot prove.
- [ ] AC-5 — One proposal under `agents/proposals/` names a change that
      passes the gate and the record that passed it.
- [ ] AC-6 — No instruction file shipped to a consumer says kernel rules
      cannot be changed.
- [ ] AC-7 — The count of gate scripts is unchanged.

## Decisions

| ID | ownership | resolved by | decision | evidence | revisit if |
|---|---|---|---|---|---|
| D1 | product-owned | owner | Self-modification is a goal; the council is the lowest passing rung; the user is the last | The directive of 2026-10-05, quoted in 1.1; blocker `self-modification-directive-reading-confirmed` | — |
| D2 | deterministic | evidence | Bind by a digest over the gated files' content; do not reuse the review-scope hash | That hash is over diff text against a base and differs between a branch and CI's merged checkout once the base moved on a shared file — probed this round; its gate is advisory with 199 re-bind events on record; this gate is handed a file list and no base | A review must be bound to ungated files too |
| D3 | reversible-technical | agent | Reuse the stance line and its seat parser, not the tally; reuse the artifact's verdicts; derive the record's verdict; write the record from the run | `stance_tally.ts:106`; at two seats the tally reads two different passing labels as a split; closed vocabulary at `ratification_artifact.ts:46-51`; 19 spellings of one reviewer in 22 records | A third provider is configured and a tally becomes meaningful |
| D4 | contested-technical | evidence | What is gated by surface: kernel, plumbing, the review's modules, the consequence class. What is gated by origin: anything the pipeline proposes. Everything else is not gated here | 22 of 49 commits touch a governing file and 8 carry a record, so gating all of them is 14 more reviews over those commits | The owner picks option (b) of the first blocker |
| D5 | product-owned | owner | By which route the owner permits a change the council could not pass | "An agent's transcription of a chat message into a floor reduction is not something any gate here can check" (`ratification-artifact.md:180-183`); blocker `owner-permission-route` | — |
| D6 | product-owned | owner | For this review the seat count comes from the ratification policy | The reader already refuses a record with fewer distinct providers than `required_providers`; quorum is on the owner-reserved row (`decision-revisit-gate.md:142`) | A third provider is configured |
| D7 | reversible-technical | agent | The worked example goes through the five-stage guideline once; the promotion boundary stays with the parked draft | The guideline's own closing criterion was never met; Workstream C names the self-repair line as substrate and is not started | Workstream C is promoted and names a different lane |
| D8 | product-owned | owner | A passing record permits the change to pass the gate; it does not publish or land it. The parallel proposal's reading that an ordinary council-approved change may open its own pull request without the user's keystroke is not adopted here | ADR-268 § 3: without a grant a run ends open; landing authority is the typed grant's question | The owner grants a standing landing authority for council-passed changes |
| D9 | deterministic | evidence | The digest covers the source of a gated file only; its projection is covered because `dist/agent-src/` is asserted byte-equal to the rewritten source | ADR-201; the "Verify dist == rewrite(src)" CI step | A gated surface gains a projection that is not a byte-exact rewrite |
| D10 | product-owned | owner | the directive's reading is (a): the council is the lowest passing rung for the gated surface and for changes the learning lanes originate, with the verdict rule and escalation conditions as drafted in step 1.1; commissioned work keeps its present speed | owner answer 2026-10-06 to blocker `self-modification-directive-reading-confirmed`, options (a) / (b) wider at 22 in 49 commits / (c) gated surface only | the review load on the gated surface or the learning lanes changes materially, or the owner widens the reading |
| D11 | product-owned | owner | the owner's route past a recorded council non-convergence is (b), the owner's own recorded bypass on the forge — preceded by an ask: on non-convergence, or on the red check it causes, the agent tells the owner at once and asks in-session with options; a yes is then given as the forge act, never as a chat answer, because a chat answer reaches the tree only as text an agent wrote and ADR-268 § 4 forbids an agent ratifying its own increase in power. The contract's two sentences ruling a bypass out are amended for recorded non-convergence only | owner answer 2026-10-06 to blocker `owner-permission-route`: "the user should be informed beforehand or on a failed CI run and be able to instruct the agent locally when it asks — otherwise option 1, if it cannot be done differently"; option (a) needs a place only a person writes, which does not exist at the pin | a place only a person writes exists (the gate-preauth stub's answer), at which point (a) becomes the route that needs no forge act |

## Kill register

| ID | Proposal | Killed by | Note |
|---|---|---|---|
| K1 | Five verdicts with conditional approval and a review-again state | The artifact's closed vocabulary; "an open one always reads as approval to a grep" (`ratification-artifact.md:45`) | Planned in the parallel proposal |
| K2 | Automatic activation of council-approved changes by default | ADR-268 § 3: without a grant a run ends open | Same |
| K3 | Automatic rollback after an observation window | No reader ties a landed change to a metric; "Success-signal re-evaluation at eval date … Not automated" (`ADR-118:97`) | Parked with its entry condition |
| K4 | Enforcement roots that may never be edited | ADR-268 § 4 superseded exactly that | — |
| K5 | A council review for every commit that touches a rule, skill or command | The census under D4 | Option (b) of the first blocker reopens it |
| K6 | Retire the tool-call deny in this roadmap | `ratification-artifact.md:84-96` | Owned by the typed-grants roadmap |
| K7 | A separate approver field for pipeline proposals | One record kind already carries reviewer, providers and verdict | — |
| K8 | Reuse the review-scope hash as the binding | Two hashes for one unedited change once the base moved on a shared file; `review-binding-drift.md:18-19` | An earlier draft of this file planned it |
| K9 | A new closing line and parser for the review, or the option tally as the verdict | The stance line and its seat parser exist; the tally answers a different question | Earlier drafts planned each |
| K10 | An owner-ruling record any session can write, passing on a named condition alone | Three typed fields would pass with no council run; "never the transcription itself" (`ratification-artifact.md:180-183`) | An earlier draft planned it; the route is now the owner's choice |
| K11 | Automated promotion of learnings | `road-to-leading-every-row.md:231`; `later/road-to-ac-deep-capabilities.md:163-192` | The directive is noted there by 1.3 and decided by its owner |

## Risk Register
<!-- risk-review: v1 | reviewed: 2026-10-05 | reviewer: claude/host -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The record is still text an agent can write | implementation | A digest and a seat list can be typed as easily as a name; and whether the forge's file list is complete for a very large change was not measured. | The contract already says the anchor is the base revision and the platform, not the record; Phase 2 adds that a record cannot be reused or outlived by an edit, 3.4 that it is produced by the run, and neither claims more. | Phase 2 — An approval is bound to what it approved |
| 2 | The owner's route becomes the easy way round a split council | implementation | Any record form for the owner's permission is text, and a run with a grant could land it. | The step is held by its own blocker, whose options state what each can and cannot prove; the recommended one is an act on the forge that no session can perform. | Phase 5 — A council that cannot settle it stops the run for the user |
| 3 | The questions become a form the seats fill | product | A fixed list invites nine short affirmations. | 3.4 keeps each seat's answers in the record's body, where a later reader sees them; 3.1 asks what would show the benefit false, which has no affirmative answer. | Phase 3 — The council reviews a modification as one |
| 4 | This roadmap's own gate changes need the gate | implementation | Phases 2 to 5 edit self-watched files. | Each lands with a record under the rules in force at that time; 4.1 lands after Phase 3 so that nothing is gated by code that does not exist yet. | Phase 4 — The reviewer and the consequence class are inside the gate |
| 5 | A council outage stops governance work | product | With the lone decision removed, an unreachable seat ends the run. | That is the directive's last rung; 5.2 makes the stop one question with everything needed to answer it, and 5.3 gives the answer the route the owner chose. | Phase 5 — A council that cannot settle it stops the run for the user |
| 6 | The worked example is chosen to be easy | product | A trivial learning proves the plumbing and little else. | 6.2 requires a change to a rule or skill body, reviewed with the full question set; the record's body shows what was asked. | Phase 6 — One change nobody asked for travels the whole lane |
| 7 | Widening the path set slows ordinary rule work | product | 28 more files need a record per change, and so does any edit to the shared rule schema. | Four of the 49 commits touched a rule outside the kernel; D4 names the reading that would widen or narrow it. | Phase 4 — The reviewer and the consequence class are inside the gate |
| 8 | A reviewed change turns red because the base moved | implementation | The digest changes when the base edits a gated file the change also touches. | That is content the council did not see; 2.1's test pins that a base move on any other file leaves the digest alone. | Phase 2 — An approval is bound to what it approved |
