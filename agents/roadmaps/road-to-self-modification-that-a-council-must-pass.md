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
  - slug: road-to-a-danger-gate-that-sees-what-governs
    relation: extends
    note: "Repairs the danger gate ADR-282 added after this roadmap, so a gated-surface pull request reaches the owner rather than resting on a council clearance. Steps 1.4 and 1.5 here carry the text half of the same round."
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
>
> **Arrivals:** 2 — latest `inbox-2026-10-h` (2026-10-11); earlier:
> `inbox-2026-10-d`. The second round added steps 1.4 and 1.5 and AC-8 here
> and `road-to-a-danger-gate-that-sees-what-governs` beside this file.

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

## Staged, not abandoned — 2026-10-13

The branch that closed Phases 2 to 6 went to a modification review on
2026-10-12 and was **refused 2/2 over three rounds**
(`agents/evidence/ratifications/drain-self-modification-20261012.md`). The
dealbreaker of round 2 — a consequence class that failed OPEN, so a gate
advertising 28 high-consequence rules enforced none when one file failed to
parse — was corrected and the correction was accepted. Round 3 refused anyway,
and for a reason no patch answers:

> **smaller-change.** "This change bundles at least four independently
> reversible concerns — digest binding, governed-surface expansion, proposal
> validation, and a new standing Iron Law... Landing the binding first would
> close replay risk while letting the broader self-governance design be
> evaluated with a smaller blast radius."

Both seats said it could be staged. It was not. A second fact compounds it and
is recorded because it bounds what the refusal can be read as: the full
`origin/main...HEAD` diff was **177 KB against the council’s 51 KB bundle
ceiling**, so neither seat ever saw the whole change, and both said so in both
rounds.

So the branch was narrowed to the content binding alone — the `subject` digest
over the gated content, and the gate refusing a record whose `subject` does not
match — which is the piece both seats named as the smallest high-value change.

**The narrowed change then went to six rounds of its own and was refused in
all six** (`drain-self-modification-narrowed-20261013.md`). Round 1 and
round 2 refused 2/2; round 3, after round 2's dealbreaker was fixed, split —
anthropic `ratified` with no pre-merge change named, openai `refused` on three
defects in the refusal plumbing added to satisfy round 2. On the owner's
decision those three were fixed (step 2.4) and round 4 refused 2/2 on a new
one: non-regular files read as regular (step 2.5). That was fixed on the
owner's decision and round 5 refused 2/2 on a new one: an intermediate path
component that is a symlink is followed (step 2.6). The digest was then moved
from the working tree to Git objects at a revision (decision D13) and round 6
refused 2/2 on a new one: a mutable revision is resolved more than once in one
gate run (step 2.7). The disposition is the owner's. **No seat, in any of the
nine rounds across both shapes, disputed the design or the scope**; what is
open is step 2.7, not the binding.
Governed-surface expansion (4.1, 4.2, 4.3), proposal validation (6.1), the
worked example and its Iron Law (6.2), the record writer (3.4) and the
escalation shape (5.2) were reverted to `origin/main` and are **open steps
here**, not cancelled work. Each was verified by an empty net diff per file
against `origin/main`, not by a revert command’s exit code.

What this costs, stated rather than left to be discovered: until 4.1 lands, the
modules that compute the digest and ask the review’s questions are **outside**
the surface the gate watches, so the reviewer is not yet inside what it
reviews. Until 4.2 lands, the 28 high-consequence rules beyond the kernel stay
editable with no record. Those were the gaps before 2026-10-12 and they are the
gaps again; the binding closes replay, and nothing else.

## Phase 1 — The directive is a decision on record

- [x] **1.1 One decision record, drafted as proposed.** A new ADR with
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
      **Closed 2026-10-10 at `status: accepted`, not at `proposed`.** The record is
      `ADR-281-council-confirmed-self-modification.md`; it was drafted proposed, the
      owner accepted it, and 1.2's corrections followed — which is why 1.2's verify
      already returns 0. The step's own text anticipated that sequence; only the
      checkbox lagged it.
      verify: `grep -l 'supersedes_scope' docs/decisions/*council-confirmed-self-modification* | wc -l` -> /^1$/
- [x] **1.2 On acceptance, the sentences that say otherwise are corrected.**
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
- [x] **1.3 The owners of the neighbouring work are told.** One dated note
      beside the blockers `ratification-platform-anchor` and
      `kernel-guard-first-crossing` in `road-to-typed-grants-that-persist`,
      and one beside step C3 of the parked draft, name the new record. No
      step, blocker field or decision in either file is edited, and the deny
      is not touched here.
      verify: `grep -l 'council-confirmed-self-modification' agents/roadmaps/road-to-typed-grants-that-persist.md agents/roadmaps/later/road-to-ac-deep-capabilities.md | wc -l` -> /^2$/
- [x] **1.4 The sentences 1.2 wrote follow the amendment of 2026-10-07.**
      ADR-281 was amended (`f76e83e47`, § Amendment `:216-231`) so that a
      council verdict recommends passage and a favourable one is advisory until
      authenticated owner authorisation is bound to the same digest. The
      amendment edited the ADR only; three shipped texts 1.2 corrected still say
      the council's record is the approval:
      `docs/contracts/ratification-artifact.md:500-502` ("the council is the
      lowest rung that can pass"),
      `docs/guidelines/agent-infra/self-improvement-pipeline.md:4-8` and its
      Stage 5 trigger (`:90-94`), and
      `src/skills/skill-improvement-pipeline/SKILL.md:244-248` ("the AI
      council's ratification record (user as last rung, ADR-281)"). Each
      states the amended rule in its words: the council's record is required
      and is a review; the owner authorises; a council refusal fails closed.
      The contract's ladder adds that under ADR-282 a pull request touching
      the gated surface is handed to the owner rather than cleared by the
      council, and names `road-to-a-danger-gate-that-sees-what-governs`. The
      contract is on the reviewer list, so this lands by the owner's act.
      verify: `grep -c -e 'lowest rung that can pass' -e "council's ratification record, and the user is its last rung" -e 'user as last rung' docs/contracts/ratification-artifact.md docs/guidelines/agent-infra/self-improvement-pipeline.md src/skills/skill-improvement-pipeline/SKILL.md | grep -c ':[1-9]'` -> /^0$/
      Positive control: the same command at `d41121927` prints 3.

      **Closed 2026-10-12.** All three texts now state the amended rule in
      their own words — the digest-bound council record is required and is a
      review, a refusal fails closed, and a favourable verdict stays advisory
      until the owner's authenticated authorization is bound to the same
      digest. The contract's ladder gained the ADR-282 sentence: a pull
      request touching the gated surface is handed to the owner rather than
      cleared by the council, which is why `classify_merge_risk` routes it
      `needs-council` and the seats decide only whether the owner must look.
      It names `road-to-a-danger-gate-that-sees-what-governs`. Measured 3 at
      the pin before the change and 0 after.
- [x] **1.5 No shipped sentence names a binding the gate does not perform, and
      the consumer template says where a kernel rule changes.** Three
      sentences describe a subject binding the reader and the gate do not
      have yet (`grep -c subject` is 0 in both): ADR-281's consequence that
      "the gate binds each record to the content it reviewed" (`:168`), which
      is not rewritten, and the pipeline guideline's Stage 5 "whose `subject`
      matches" (`:91`), which is. The contract's § Honest enforcement gains
      one dated sentence: at this pin a record is not bound to the content it
      reviewed, and the binding is steps 2.1 and 2.2 here; the guideline drops
      "whose `subject` matches" until 2.2 lands and says why. The consumer
      template (`src/agent-src/templates/AGENTS.md:17`, "Kernel rules change
      only by a ratified edit") states that kernel rules change upstream only,
      in the package and through its ratified flow, and that in a consumer
      project an override may tighten one and nothing edits one — the gate
      that makes an edit ratified runs only in this repository's workflow
      (`.github/workflows/consistency.yml:920-949`), and on a host without a
      hook API that sentence is the only layer before the write
      (`docs/threat-model.md:57`). It does not say "immutable", so AC-6 still
      holds; `docs/threat-model.md:42-47` follows in the same words, and the
      projections are re-emitted by `task sync`.
      verify: `grep -c 'not bound to the content' docs/contracts/ratification-artifact.md` -> /^[1-9]/

      **Closed 2026-10-12.** The contract's § Honest enforcement carries a
      dated paragraph saying a record is not bound to the content it reviewed
      at this pin, that ADR-281's consequence describes the intended end state
      rather than today's gate, and that the binding is steps 2.1 and 2.2. The
      pipeline guideline dropped "whose `subject` matches" and says in a block
      quote why, naming the two steps that bring it back. The threat model's
      Layer 2 follows the template's words.

      **The consumer template landed at 2,499 of its 2,500-character FAIL cap.**
      The sentence had to carry "upstream only" and "ratified" inside a 72-char
      budget, so "in a consumer project nothing edits one" is carried by the
      emergency-triage block instead (item 3, "Do not edit `.augment/` or
      `dist/agent-src/` here"), which already said it. One character of
      headroom is not a margin: the next addition to that file needs a
      subtraction in the same change, and `lint_agents_md` is the gate that
      will say so.

## Phase 2 — An approval is bound to what it approved

- [x] **2.1 The record carries a digest of the gated content it reviewed.**
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
      **Half shipped 2026-10-10, and the half that is missing is the gated one.**
      `src/scripts/_lib/ratification_subject.ts` is the module of its own this step
      asks for: `subjectDigest` hashes each gated file's PATH alongside its content,
      so identical bytes at two paths do not collide and a rename moves the digest,
      and a deleted gated file is entered via `DELETED_MARKER` rather than skipped —
      skipping would make "this hook was removed" digest-identical to "this hook was
      never gated", which is the change a record most needs to be bound to. It takes
      no base diff, so it reads the same on a branch and on the merged checkout.
      It **re-assembles** the gated list from the gate's own exported constants
      rather than restating the membership rule, because `classifyPaths` reports the
      self surface as a boolean and the list cannot be read back out of it; a second
      definition of "gated" would be a second thing to keep in step. Verified ungated
      by running the gate against it: nothing to ratify. 10 tests.
      **Closed 2026-10-12 — the gated half landed.** `readRatification` gained an
      `expectedSubject` parameter and three codes that are kept apart on purpose:
      `subject-absent`, `subject-malformed` and `subject-mismatch`, because a typo'd
      digest and a digest that moved because a gated file was edited after the review
      send an author looking in different places. The gate computes the digest once
      per run through the new `expectedSubjectFor`, which hands `subjectDigest` the
      SAME derived plumbing list it classified with — a digest classified without it
      would cover fewer files than the gate gated. Both existing suites' fixtures
      carry the field, and the gate suite asks the gate for the digest rather than
      typing one, so a fixture cannot prove a second implementation of the membership
      rule. `src/scripts/ratification_subject` prints it for whoever writes a record,
      by calling the gate's exported helper for the same reason.
      **One thing the implementation had to solve that the step did not foresee:**
      the gate now imports `ratification_subject` and that module already imported the
      gate's path constants, so the module-scope `SELF_SET` read those `const`
      bindings inside the cycle's dead zone. It is built on first call instead — which
      keeps the single definition of "gated" rather than trading it for a second copy.
      9 tests, seen red for the intended reason: neutralising the binding
      (`readRatification(text, providerCount, null)`) drops 5 of the 9 and leaves
      exactly the 4 polarity partners that should stay green.
- [x] **2.2 Each record answers for its own change.** A record validates a
      diff only when its `subject` matches that diff's gated content; a second
      valid record for something else no longer carries it. The 23 records on
      the trunk are not rewritten: they were judged when they landed and are
      read by nothing afterwards. A change that is open when this lands needs
      a record with a `subject` once its base carries the new gate, because
      the gate is judged from the base.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_subject.test.ts` -> 0

      **Closed 2026-10-12.** The `anyRatified` loop no longer passes on "any one
      artifact validates": every record is read against this diff's digest, so a
      record written for another change is refused here even though it is a GOOD
      record. Each case proves that rather than assuming it — the foreign record is
      read against the content it was written for and validates with zero problems,
      so the suite cannot be green because the record was broken for an unrelated
      reason. Two polarity partners keep the binding from becoming a replacement for
      the verdict rule: a matching `subject` rescues neither a `refused` verdict nor
      a self-ratified record. The trunk's 23 records are pinned as never re-read: an
      unparseable artifact on disk but absent from the changed-file list leaves the
      diff green. 5 tests.

- [x] **2.3 Every failure of the subject computation is one structured
      refusal.** The gate catches `GatedFileUnreadable`, `GatedPathEscapes` and
      a post-`lstat` read failure at ONE boundary around `expectedSubjectFor`
      and returns `exitCode 1` with a named line, rather than letting any of
      them leave `evaluate()` as an exception. Translation is narrow and typed,
      never a blanket catch. An end-to-end case through the real gate asserts
      the structured refusal for a traversing gated path and for a read that
      fails after the stat.
      verify: `npx vitest run tests/scripts/ratification_subject.test.ts tests/scripts/check_kernel_edit_ratified_subject.test.ts` -> 0

      **Opened 2026-10-13 by a modification review that refused the change
      carrying 2.1 and 2.2, 2/2, and was right.** The round-1 fixes introduced
      two error classes and gave only one of them a catch boundary. In the
      seats' words: *"`GatedFileUnreadable` gets the full treatment (defined →
      thrown → caught → structured refusal). `GatedPathEscapes` gets only the
      first half (defined → thrown), then escapes. The subsequent-read failures
      get zero coverage. A complete fix needs one catch boundary in
      `evaluate()` that handles all three failure classes."* And: *"the
      `readFileSync(abs)` and `readlinkSync(abs)` calls ... are not wrapped, so
      a permission change or I/O error after the stat escapes as a raw Node
      error — exactly the TOCTOU window the fail-closed lstat was meant to
      close."*
      The blind peer-review stage added two bounds on the repair rather than
      softening it: a blanket catch would *"conceal programming defects as
      ordinary refusals"*, so the translation stays narrow and typed; and one
      seat named a path-substitution race between the stat and the read —
      whether symlink-swap resistance is inside this gate's threat model is
      part of this step, not assumed.
      **Not fixed in the change that was reviewed, deliberately.** `evaluate()`
      is in `check_kernel_edit_ratified.ts`, a gated file, so editing it after
      the seats answered would move the `subject` and leave the record either
      stale or rebound to content its reviewers never saw — which is the exact
      defect 2.1 exists to catch. A change whose first act is to launder its
      own record does not land. Record:
      `agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.
      Three further findings from the same round are carried here rather than
      lost: the ENOENT polarity case asserts only that nothing throws and does
      not prove the absent file was encoded with `DELETED_MARKER`; the
      one-classification case uses a self-gated script and so would stay green
      if `derived` were dropped again, and needs a derived-only file; and
      `expectedSubjectFor` changing from `string` to `SubjectReading` is a type
      break for any caller outside this tree.

      **Closed 2026-10-13.** One boundary in `evaluate()` now enumerates BOTH
      error classes and returns `exitCode 1` with a named line; the two
      post-`lstat` reads are wrapped and translate an errno failure into
      `GatedFileUnreadable`. The translation is narrow in the way the blind
      peer-review stage asked for: `asErrno` admits only a value carrying an
      errno `code`, so a `TypeError` from a future edit of that loop stays a
      crash rather than surfacing as "the tree could not be read", and the
      catch enumerates two classes rather than catching everything. The CLI
      caller carries the same two-class catch, so the step's own title is true
      of both callers of the computation rather than of one.

      **The symlink-swap question, answered rather than assumed — and the
      answer has two halves.** A path that is a regular file at the `lstat`
      and a SYMLINK at the read is the only ordering in which out-of-revision
      CONTENT can enter the digest, because `readFileSync` dereferences;
      `readGatedFile` opens with `O_NOFOLLOW`, so that swap is `ELOOP` and
      then a refusal. The direction the seat named by name — a link whose
      TARGET is swapped between classification and read — is not a leak at
      all: the digest records the target STRING and never dereferences it, so
      the worst such a swap can do is move the digest, which reds the gate. A
      link replaced by a regular file makes `readlinkSync` fail with `EINVAL`,
      also a refusal. Three of three race outcomes fail closed.
      **What is NOT closed, recorded rather than left to be found:**
      intermediate directory components are still resolved, so a symlinked
      parent committed into the tree redirects the read — a property of the
      checkout, visible in the revision, not a race. And an adversary with
      concurrent write access to the checkout during a gate run can edit the
      gated bytes BEFORE the stat, forge the record, or patch the gate; no
      ordering of stat and read answers that, and claiming otherwise would be
      the false assurance this module exists to prevent. `O_NOFOLLOW` is
      undefined on Windows and falls back to `0` there; this gate runs on
      `ubuntu-latest` and its suites on ubuntu and macOS, so the fallback is
      stated in the header rather than silently losing the property.

      **The three further findings, each disposed of:**
      · **The ENOENT polarity case** asserted only that nothing threw and that
      the constant contains the word "deleted" — neither says the absent file
      was entered WITH `DELETED_MARKER`. It now compares the absent tree's
      digest against a tree whose gated file holds exactly those bytes, and
      against one holding a different marker. Seen red by encoding the absent
      branch with another marker; the two old assertions stay green under that
      same neutralisation, which is the finding.
      · **The one-classification case** used the gate's own script, gated
      through the SELF set whether or not `derived` reaches the classifier. It
      now uses `src/scripts/hooks/host_semantics.ts`, gated only through the
      derived closure, plus the direct assertion that an empty derived list
      un-gates it. Measured counterfactual rather than asserted: with
      `gatedFilesOf` ignoring `derived`, the new fixture reds and the old
      self-gated one stays green.
      · **The `expectedSubjectFor` type break** is not one, and the
      measurement is one command: `git show origin/main:src/scripts/check_kernel_edit_ratified.ts
      | grep -c expectedSubjectFor` prints 0. The function is new on this
      branch and has never shipped, so both shapes have only ever existed
      inside this unmerged change and no caller outside the tree can exist to
      break. Every in-tree caller moved with it. No code change; recorded so
      the next reader does not re-derive it.

      **Every case was seen red before the fix, by neutralising its
      mechanism:** dropping `GatedPathEscapes` from the catch reds 2 of 9 and
      leaves 7 green · unwrapping the two post-stat reads reds 2 of 33 ·
      dropping `O_NOFOLLOW` reds 1 of 24 · encoding an absent file with
      another marker reds 1 of 24 · making `gatedFilesOf` ignore `derived`
      reds 1 of 24. 33 tests across the two suites.

- [x] **2.4 The refusal plumbing's own edges are covered.** Three findings
      opened by round 3 of the modification review on 2026-10-13, all in the
      error-handling added to satisfy round 2 and none in the binding itself.
      `asErrno` admits any `Error` with a string `code`, which includes Node's
      own `ERR_*` programming errors — so the narrowness the header claims is
      not the narrowness the code has; the discriminator requires OS-error
      evidence (numeric `errno` plus `syscall`, or an explicit `ERR_*` split)
      and a case proving an `ERR_INVALID_ARG_TYPE`-shaped error is rethrown
      unchanged. `fs.closeSync(fd)` runs in a `finally` outside the catch, so a
      close failure escapes raw AND can replace an already-translated read
      failure, because an exception from `finally` overrides the pending one.
      The CLI's new refusal path has no direct case: `main()` is never
      invoked, so nothing proves it returns 1, writes to stderr, emits no
      digest, and still propagates an unrelated programming error.
      verify: `npx vitest run tests/scripts/ratification_subject.test.ts tests/scripts/ratification_subject_cli.test.ts` -> 0

      **In the seats' words, because two of the three are demonstrably right
      and the roadmap does not get to soften them:** *"That does not establish
      that the error is an OS errno. Node programming errors such as
      `ERR_INVALID_ARG_TYPE` are typically `TypeError` instances with string
      `code` properties. Consequently, the stated guarantee that 'a `TypeError`
      from a future edit … stays a crash' is false: many such errors will
      become `GatedFileUnreadable`, concealing defects as ordinary refusals."*
      And: *"An `EIO`, `EINTR`, or similar close failure therefore escapes as a
      raw Node error. It can also replace a successfully translated read error
      because an exception from `finally` overrides the pending exception."*

      **Not fixed in the change that was reviewed, and this time the reason is
      the bound rather than the digest.** Round 3 is the third refusal of the
      narrowed change, and the instruction this lane runs on stops there: the
      disposition is the owner's, by `ratification-artifact.md` § The
      owner-permission-route. A fourth round called on the agent's own judgement
      that the next one would pass is the judgement that bound removes — and
      the editor of a governance surface deciding when its own reviewers have
      asked enough is the failure this mechanism exists to prevent. The same
      digest argument of 2.3 still applies on top: `evaluate()` and the module
      are read by a record now bound to `1aff2b49…`.
      Record: `agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.
      The split is recorded as a split: anthropic answered `ratified` and named
      no pre-merge change at all; openai answered `refused` on the three above.

      **Closed 2026-10-14, on the owner's decision to fix the three and run a
      fourth round.** `asErrno` requires a string `code` outside `ERR_`, a
      numeric `errno` and a string `syscall`, and one helper applies it at the
      `lstat`, open, read, close and readlink — the `lstat` catch had the same
      construct and moved with it. `readGatedFile` has no `finally`: the read
      failure wins, and a close failure after a successful read is a refusal.
      `ratification_subject_cli.test.ts` invokes `main()` for exit 0, both
      refusal classes (exit 1, stderr, no digest) and an unrelated `TypeError`
      propagating. Each case seen red by neutralising its mechanism: 3 of 27,
      2 of 5, 1 of 5, 2 of 4, 1 of 4. Round 4 confirmed the three fixed and
      refused 2/2 on a new finding — step 2.5.

- [x] **2.5 Only the three object kinds the digest describes are read.** After
      the `lstat`, a gated path is absent, a symbolic link, or a regular file;
      anything else — FIFO, socket, device, directory — is a typed refusal
      raised BEFORE any `open`, handled by `evaluate()` and the CLI like the
      other two classes, with a case proving a non-regular `Stats` is refused
      without `openSync` being called. Opened by round 4 of the modification
      review on 2026-10-14, refused 2/2 on it. In openai's words: *"treating
      every non-symlink object as a regular file can hang the governance gate;
      the highest-leverage pre-merge change is to reject non-regular filesystem
      objects before opening them."* Raised in the same round and not stated as
      blocking, for the same step or its successor: `assertContained()` does
      not refuse backslash-separated `..` or UNC / rooted Windows paths (openai);
      the `O_NOFOLLOW` fallback degrades instead of refusing, and `--quiet`
      prints a digest over an empty gated set with no warning (anthropic); both
      seats ask for the round history to leave the production docblocks.
      **Not done in the lane that ran round 4**: the owner authorised the three
      round-3 fixes and one round, and a fifth round is the owner's call.
      verify: `npx vitest run tests/scripts/ratification_subject_revision.test.ts` -> 0
      Record: `agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.
      (The verify was re-pointed by step 2.6: the file it named tested the
      working-tree reader 2.6 replaced, and the refusal of every entry that is
      not absent or a regular file is pinned by the revision suite now.)

      **Closed 2026-10-14, on the owner's decision to fix round 4's confirmed
      findings and run a fifth round.** After the `lstat`, `subjectOf()` reads
      an absent path, a link or a regular file and throws `GatedPathUnsupported`
      for anything else before any `open`; `readGatedFile()` opens with
      `O_NOFOLLOW | O_NONBLOCK` and refuses a non-regular `fstat`, so an object
      swapped in after the stat cannot block it. The three refusal classes share
      `GatedSubjectRefusal`, which `evaluate()` and the CLI catch as one class.
      All four non-blocking notes were small and in scope and are done in the
      same change: a missing `O_NOFOLLOW` or `O_NONBLOCK` is a refusal,
      `--quiet` over an empty gated set warns on stderr, `assertContained()`
      refuses backslash `..` and UNC / rooted / drive-qualified paths on its own
      input, and the round history left the production comments for this
      roadmap and the record. Each case seen red by neutralising its mechanism:
      kind check 5 of 16, `fstat` check 2 of 16, `O_NONBLOCK` 1 (flags case, run
      alone because the direct-FIFO case would block), missing-flag refusal
      2 of 16, containment 1 of 29, `evaluate()` catch 1 of 10, CLI catch 1 of
      6, `--quiet` warning 1 of 6. Nothing from round 4 deferred. Round 5
      confirmed the finding fixed and refused 2/2 on a new one — step 2.6.

- [x] **2.6 No gated path is read through a symlinked ancestor.** `O_NOFOLLOW`
      guards only the final component; `lstat` and `open` resolve every parent,
      so a gated path whose parent directory is a symlink — committed, or in a
      dirty tree — is digested from content outside the revision, and two
      clean checkouts of one commit can disagree. The fix: walk the components
      between the root and the gated path, `lstat` each, and refuse with a typed
      refusal if any is a symbolic link (or hash Git blobs at an explicit
      revision, which both seats call the stronger shape); correct the module
      header, which says the digest never follows a link. Case: a gated child
      deleted or changed, its parent replaced by a symlink to a directory with a
      regular file at the remaining suffix; the subject computation refuses
      before hashing. Opened by round 5 on 2026-10-14, refused 2/2 on it. In
      openai's words: *"the digest can bind content reached through an
      intermediate symlink rather than the reviewed Git path; the
      highest-leverage pre-merge change is to hash an explicit Git revision, or
      at minimum refuse every symlinked ancestor and add the regression test
      above."* anthropic: *"Correct the comment claiming symlinks are never
      dereferenced."*
      verify: `npx vitest run tests/scripts/ratification_subject_revision.test.ts` -> 0
      Record: `agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.

      **Closed 2026-10-14 by a strategy shift, decision D13.** Rounds 3, 4 and 5
      each refused the working-tree reader on a new filesystem defect, so a
      fourth per-class patch was not converging. The subject is now read from
      Git objects at an explicit revision (`--rev`, default `HEAD`): the
      revision resolves to a commit, each gated path is looked up with
      `git ls-tree` and its bytes come from `git cat-file`. The gate reads the
      record at the same commit. Symlinks, FIFOs, devices, permission faults
      and races on the filesystem are therefore outside what the digest can
      observe, not refused one by one. A gated path committed as a symbolic
      link (mode `120000`) is refused, as are a directory or submodule entry,
      an unresolvable revision, a `--root` that is not a repository top level
      and a git that cannot run — all typed refusals, exit 1. The entry now
      hashes the mode as well, so the executable bit is part of the subject.
      The working-tree reader (`readGatedFile`, `readGatedLink`, `asErrno`,
      the `O_NOFOLLOW`/`O_NONBLOCK` flags) is deleted with the suite that
      tested it; the removals are accounted for in
      `agents/evidence/reviews/ratification-subject-git-revision-test-removals.md`.
      Each new property was seen red against the working-tree reader before
      the change (16 of 17 cases), and the subdirectory, mode-`120000` and
      `--rev` usage refusals again by neutralising them afterwards. Round 6
      accepted the object-store design and refused 2/2 on a new finding —
      step 2.7.

- [ ] **2.7 One gate run reads one commit.** `main()` passes the revision
      NAME to `git diff --name-only <base>...<rev>` for the changed-file list
      and then to `evaluate()`, which resolves it again for the content and the
      record, so a `HEAD`, branch or tag that moves between the two calls
      yields a file list from one commit and a digest and record from another
      — contradicting the contract's "one commit". The fix: resolve `--rev`
      once in `main()` to a commit id and pass that id to the diff, the digest,
      the record read and the reported revision; refuse `--rev` without a value
      in the gate as the subject CLI already does; run the diff through the
      same git runner (environment scrubbing) as the subject; state in the
      contract that an empty gated set reads no commit, so an invalid `--rev`
      then passes. Case: the ref moves between the diff and the read, and the
      gate still judges one commit. Opened by round 6 on 2026-10-14, refused
      2/2 on it. In openai's words: *"the gate does not yet ensure that
      changed-file discovery, hashing, and record reading use one immutable
      commit; the highest-leverage pre-merge change is to resolve `--rev` once
      before the diff and pass that OID through every subsequent operation,
      with shared strict option parsing."* anthropic: *"Resolve `--rev`
      exactly once in `main()` to an immutable commit OID [...] Pass that OID
      through all operations."* Also raised, not stated as blocking: the
      mutual import between the gate and the subject module (openai).
      **Deferred, with the reason**: the owner authorised one round, merging
      only on 2/2; a seventh round is the owner's call.
      verify: `npx vitest run tests/scripts/ratification_subject_revision.test.ts` -> 0
      Record: `agents/evidence/ratifications/drain-self-modification-narrowed-20261013.md`.

## Phase 3 — The council reviews a modification as one

- [x] **3.1 A fixed set of questions, in a module of its own.** When the
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
      **Done 2026-10-10.** `src/scripts/ai_council/modification_review_questions.ts`
      carries the nine as one constant, each with a stable id so the record's body
      can key a seat's answer by it and a skipped question is visible. Two quote the
      tree verbatim rather than paraphrasing, and each carries its `source`:
      question 3 is `evaluator-independence`'s weakening clause ("silently weakens
      an assertion … lowers a threshold"), question 6 the synthesis prompt's
      kill-switch criteria. The contract quotes the list under
      § The modification review asks a fixed set, and the test asserts every
      question appears there verbatim — so a question edited in the constant and
      not in the contract reds rather than leaving the two disagreeing. 7 tests.
- [x] **3.2 Each seat closes on the stance line, read by the parser that
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
      **Done 2026-10-10, and one tension in the step's own text is recorded rather
      than resolved silently.** `src/scripts/ai_council/modification_review.ts` is
      the module of its own: `seatConclusion` reads a reply through the EXISTING
      `stance_tally.parse_stance_line`, accepts only the three labels, and returns
      null for a missing line, an abstention or any other label — including a label
      in prose without the stance grammar. The option tally and the synthesis
      verdict line are not used. **What is NOT done is the dispatch wiring, because
      this step forbids it in the same sentence that asks for it:** it says the verb
      sits "inside `council_cli`'s dispatch" and then that "the council command,
      which is over the line ratchet, is not edited". `council_cli.ts` is 3,954
      lines against a 1,500 ceiling, so wiring would grow the worst offender in the
      tree and raise a shrink-only baseline. The module is the deliverable; the
      verb has no dispatch entry, and a reader looking for one will not find it.
      9 tests.
- [x] **3.3 The record's verdict is derived, by one rule.** A seat concludes
      when its line parses to one of the three labels; a missing line, an
      abstention or any other label is a seat that did not conclude. Then, in
      this order: any concluding seat on `refused` gives `refused`; fewer
      concluding providers than `required_providers` in the ratification
      policy gives `non-convergent`; otherwise `ratified` if any seat said so
      and `confirmed-non-expanding` if all did.
      verify: `npx vitest run tests/scripts/ai_council/modification_review_verdict_rule.test.ts` -> 0
      **Done 2026-10-10.** `deriveModificationVerdict` applies the four steps in
      the stated order, and the order is pinned by its own case: a lone refusing
      seat gives `refused`, NOT `non-convergent`, because letting the quorum rule
      fire first would turn "one reviewer said no" into "not enough reviewers
      answered" — a retryable condition rather than the objection it is.
      `required_providers` is a parameter, not baked in. 7 tests.
- [ ] **3.4 The record is written from the run, not typed.** One writer, in
      the module of 2.1, turns the session record of such a review into the
      artifact: `reviewed_by` in one spelling, `providers` from the seats that
      concluded, the derived verdict, `subject` for the tree the bundle was
      built from, and each seat's answers in the body. Council output stays
      where it is; the writer reads it. Every tracked edit of the change
      precedes the review, because any later edit to a gated file moves the
      digest.
      verify: `npx vitest run tests/scripts/ratification_record_writer.test.ts` -> 0
      **Attempted 2026-10-10 and stopped on a measured contradiction, which is
      worth more than a writer that papered over it.** The writer's inputs now all
      exist — the questions (3.1), the seat conclusions (3.2), the verdict rule
      (3.3) and the `subject` digest (2.1's module above). What does not work is
      emitting a record both rules accept.
      **The shipped reader and this roadmap's step 3.3 disagree on the
      quorum-short case, and the disagreement was measured rather than read:** for
      seats `{anthropic: ratified, openai: no-final-verdict}`,
      `deriveRatificationHeader` returns **`ratified`** while
      `deriveModificationVerdict({anthropic: 'ratified', openai: null}, 2)` returns
      **`non-convergent`**. The shipped reader has no quorum count at all — it
      leaves provider diversity to catch a one-seat record separately — and 3.3
      folds the count into the verdict.
      A record carrying 3.3's verdict is therefore rejected by the gate's own
      `header-not-derived` check, which requires the recorded verdict to equal the
      derived one. Reconciling them means editing
      `_lib/ratification_artifact.ts` — `READER_PATH`, gated — so 3.4 waits on the
      same forge act as its neighbours, plus a decision about WHICH rule is right.
      That decision is not this file's to take: 3.3's rule is what the roadmap
      specifies, the reader's is what ships, and both are defensible.

      **Closed 2026-10-12. The council took the decision, 2/2 convergent**
      (anthropic + openai, design mode, 2 rounds, blind peer review, $0.00 — both
      seats subscription-authed). Verdict: **the shipped reader is canonical.**
      `deriveRatificationHeader` is the sole authority over what a record SAYS;
      quorum stays a separate validation; `deriveModificationVerdict` keeps its
      name and its test and is documented as the ORCHESTRATION disposition, with
      a new `deriveModificationOutcome` returning `{header, quorumSatisfied,
      disposition}` so a caller cannot take the orchestration answer and write it
      into the record.
      **The argument, because it outlives the vote:** `seats:` is EVIDENCE and the
      header is derived from it, so letting a policy parameter
      (`required_providers`) rewrite what the evidence says inverts the
      dependency. A grep for `non-convergent` would otherwise return both "the
      providers disagreed" and "one provider ratified and the other never
      answered" — two failure modes with different remediations, retry being right
      for only one. The `refused`-first ordering both rules already had is the
      precedent; the council extended it to the passing labels.
      **The writer** is `src/scripts/_lib/ratification_record_writer.ts`, not the
      digest module. 3.4 said "in the module of 2.1", and that module's own header
      argues for one responsibility while 4.1 lists "the digest and the writer" as
      two — and 3.4's own verify names `ratification_record_writer.test.ts`. The
      deviation is recorded rather than taken silently.
      `reviewed_by` is one constant (`ai-council`) against 19 spellings in 22
      trunk records; `providers`, `verdict` and `seats:` are derived; `subject` is
      passed IN from the gate's `expectedSubjectFor`, so the writer never becomes a
      second place that decides which files are gated. Both council seats asked for
      the same safeguard and it is the round trip: the writer reads its own output
      back through the canonical reader and throws rather than hand back a file
      somebody will try to land. A non-passing record is still WRITTEN — the
      escalation the owner answers needs it in front of him. 14 tests, one of them
      end to end through the real gate including the post-review edit going red.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

## Phase 4 — The reviewer and the consequence class are inside the gate

- [ ] **4.1 The review's own code is a gated surface.** The gate's watch list
      gains the modules of Phases 2 and 3 — the digest and the writer, the
      questions, the verdict rule — and the artifact contract. Because they are modules of their
      own, an ordinary change to the council's prompts or transports stays
      ungated. A change to any watched one is a change to the reviewer: it
      needs a passing record and the owner.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_reviewer_paths.test.ts` -> 0
      **Closed 2026-10-12.** `REVIEWER_PATHS` carries the five: the digest, the
      writer, the questions, the verdict rule and the artifact contract. The
      individual self-surface constants were folded into ONE exported
      `SELF_SURFACE`, because the digest module had been re-assembling that set
      from the individual constants — with five new paths a copy would have left
      all five digest-invisible, which is a path the gate reds on and no record is
      bound to. Every case has a polarity partner: `prompts.ts`, `stance_tally.ts`,
      `quorum.ts` and `council_cli.ts` stay ungated, and an ordinary council edit
      passes with no record at all. The suite also pins the thing the step does not
      say out loud — each reviewer path enters `gatedFilesOf`, so it is covered by
      the digest and not only by the refusal. 14 tests.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

- [ ] **4.2 Rule law beyond the nine kernel rules.** The gate's path set is
      extended by the members of `src/config/rule-consequence-class.json` —
      28 at the pin, selected by a criterion and not by name. The gate reads
      that list from its own tree, as it reads its policy, and the list and
      the schema that states its criterion join the watch list, so that a
      change cannot drop a member in order to edit it. The schema is shared
      by every rule, so any edit to it then needs a record too.
      verify: `npx vitest run tests/scripts/check_kernel_edit_ratified_consequence_class.test.ts` -> 0
      **Closed 2026-10-12.** `GatedPaths` gained `consequenceRules`, fed by
      `consequenceRuleSlugs`, which reads the 28 members from the gate's OWN tree —
      never from `--root`, for the reason the quorum policy is read that way: a
      candidate that dropped a member would otherwise be judged against its own
      shortened list. The list and `rule.schema.json` joined `SELF_SURFACE`, so the
      drop-then-edit move carries a record either way, and that exact diff is a test.
      **One deliberate asymmetry, recorded rather than silently chosen:** a missing
      or unparseable list yields an EMPTY set rather than a refusal. The quorum
      policy fails closed because it decides whether a control can measure at all;
      this list only WIDENS, so failing closed on it would red every kernel PR over
      a file whose absence costs only the widening. 9 tests, with both polarities —
      a class member outside the kernel reds, a rule outside the class does not, and
      a kernel rule is still reported as a kernel rule rather than reclassified.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

- [ ] **4.3 The comment matches the hooks.** The gate's header stops saying
      that the dispatcher source and the kernel list are denied at tool-call
      time.
      verify: `grep -c 'also denied at tool-call time' src/scripts/check_kernel_edit_ratified.ts` -> /^0$/
      Positive control: the same grep returns 1 at `df377ca64`.
      **Closed 2026-10-12, and the replacement states the true fact rather than
      deleting the false one.** The claim was checked before it was replaced:
      `block_plumbing_writes.ts` names `dispatch_hook` only in prose about reads and
      protects three generated build outputs, and `block_kernel_rule_writes.ts`
      merely IMPORTS `kernel_rules.ts` without protecting it. So for those two paths
      the record is the only layer, not the second one — which is what the header
      now says. The 2026-10-10 probe that found this needed a record for a
      comment-only edit; this change carries one, for the whole diff.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

## Phase 5 — A council that cannot settle it stops the run for the user

- [x] **5.1 The conditions, once.** The contract lists when the user decides,
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
      **Closed 2026-10-12.** `escalationMessage` prints the six, and the split down
      the middle is the substance: the gate FILLS IN the verdict, the per-seat
      dissent and the gated paths, and ASKS FOR the expected gain, the risk and the
      rollback, naming the record and the diff as where they are written. It says in
      the message that it does not know them and will not guess — a stop that handed
      the owner a confident-looking summary the gate never computed would be this
      mechanism's own failure mode arriving through its help text. It fires on
      `non-convergent`, on `refused`, on diversity short of the required count, and
      on any reviewer-surface change record or not (condition 4 is the owner's
      whatever the seats said). It deliberately does NOT fire on a missing,
      malformed, self-ratified or content-stale record: those are authoring defects,
      and routing one to the owner spends the escalation on "write a record".
      13 tests, six of them polarity partners.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

- [x] **5.3 The user's permission takes the route the owner chose.** At the
      pin there is none: only a council record with two providers passes, the
      check is required, and the contract's bypass procedure is for incidents.
      This step implements the option the second blocker's answer names, and
      whatever it builds states in the contract what it cannot prove.
      verify: `npx vitest run tests/scripts/ratification_owner_route.test.ts` -> 0
      **Done 2026-10-10 — the substance was already shipped and had no test.** The
      second blocker closed on option (b), ADR-281 § 5, and
      `ratification-artifact.md` § The owner-permission-route already carried both
      halves: the route is the owner's own recorded forge bypass, a chat answer is
      refused by name, a `non-convergent` or `refused` record stays red — and
      § What this route cannot prove states the limit, that the gate cannot see a
      bypass and nothing proves the ask preceded it. What was missing is the pin.
      The test carries its OWN sensitivity case rather than asserting over a file
      that happens to be right: it strips the section and asserts every claim
      falls, so it has been seen red for the intended reason. 5 tests.

> **Screened 2026-10-10 — six steps are gated, and the gate said so itself.**
> Step 4.3 was attempted as the cheapest possible probe: a comment-only
> correction to `check_kernel_edit_ratified.ts` removing a sentence that was
> factually wrong (it claimed the dispatcher source and the kernel list are
> "also denied at tool-call time"; the plumbing guard protects three generated
> build outputs and not `dispatch_hook.ts`, and the kernel-rule guard imports
> `kernel_rules.ts` without protecting it). The edit changes no behaviour.
>
> The gate refused it: `scanned: 1 · Gated surfaces in this diff (1): the
> ratification mechanism itself (gate, reader, policy or workflow)` — so even a
> comment on that file needs a ratification record. The probe was reverted and
> the finding kept; the correction itself is still owed and still true.
>
> That answers the question for the whole phase block rather than six times
> over. 2.1, 2.2, 4.1, 4.2, 4.3 and 5.2 all edit the gate or its reader, so
> each needs a record; and `ratification-artifact.md` § When the user decides
> condition 4 — "the modules that compute the record's `subject`, write the
> record, ask the questions and derive the verdict, and this contract" — names
> 2.1 and 3.4 almost word for word. **Phase 3's four modules and Phase 6's two
> steps are downstream rather than independently gated**: they are new files
> the gate's path set does not yet watch (4.1 is what adds them), but 6.1
> consumes the `subject` 2.1 defines, so nothing in Phase 6 lands first.
>
> The binding gate is `road-to-authority-routing-mechanism`'s blocker
> `external-bootstrap-boundary-for-phases-2-3` (council 2026-10-10, 2/2): a
> forge-side approval outside the candidate branch must precede the first
> authority-expanding merge to this surface. It is registered there, addressed
> to the owner, and this roadmap adds no question of its own.

## Phase 6 — One change nobody asked for travels the whole lane

- [ ] **6.1 The pipeline's review is the council's record; the approval is the
      owner's.** For a proposal whose scope is the package, `check_proposal`
      accepts `stage: gated` only when the proposal names a record whose
      `subject` matches the files the proposal declares as its change AND the
      owner's authorization is bound to the same digest; a proposal scoped to
      a consumer's own project is checked as before. The stage-five skill
      refuses a proposal that is not `stage: gated`, as its guideline has
      claimed. Sending the result outward keeps the consent it has.
      verify: `npx vitest run tests/scripts/check_proposal_gated_needs_record.test.ts` -> 0

      **Title and text corrected 2026-10-12, and the step marked blocked.**
      It read "the pipeline's approval is the council's record", which the
      owner's amendment of 2026-10-07 reversed and which AC-8 now forbids in
      any shipped text — implementing the step as written would have re-broken
      the criterion the same branch just closed. The correction states the
      amended rule and adds nothing: the council reviews, the owner approves.
      The step is also marked blocked rather than left open, because the
      `subject` it checks is exactly the binding 1.5 records as absent and 2.1
      and 2.2 build. No new question: both the amendment and the gate's owner
      question are already on record.

      **Closed 2026-10-12.** `check_proposal` gained `_checkGatedRecord`: a
      `scope: package` proposal at `stage: gated` must declare `changed_files:`
      and name BOTH a `ratification_record:` and an `owner_authorization:`, each
      carrying the `subject` digest of those files as the gate computes it. The
      order is the amendment, and it is a test: a proposal carrying the council's
      record and no owner authorization is refused, naming the missing one.
      **What it cannot prove is in the function's own header, above what it can:**
      the authorization is a path the proposal names and a digest the file
      carries, and ADR-281 § 5 makes the owner's route a forge act that leaves
      nothing a gate can authenticate. What IS established is that the review and
      the approval name the same content, so last week's approval cannot carry
      this week's diff — which the suite pins directly. A `scope: project`
      proposal and any earlier stage are checked exactly as before.
      The stage-five skill now carries the refusal its guideline had claimed since
      it was written: `upstream-contribute` § 6b stops on any stage that is not
      `gated`, and states the review-then-approval order for a package proposal.
      11 tests.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

- [ ] **6.2 A worked example, for real.** One learning from this repository's
      own history is captured, proposed, and passed by a modification review
      as a change to a rule or skill body; its proposal stays under
      `agents/proposals/` naming the record, and the change passes the gate.
      An agent does each step on this roadmap's instruction; nothing is
      promoted by a loop, and whether the change lands is the usual call.
      verify: `grep -rl 'agents/evidence/ratifications/' agents/proposals | grep -vc README` -> /^[1-9]/

      **Closed 2026-10-12, and it stops where the lane genuinely stops.**
      `agents/proposals/polarity-fixture-repair.md` carries a learning this run
      made rather than one chosen to be easy: widening a gate's path set turns its
      NEGATIVE fixtures red, and the cheap repair — deleting them — leaves a gate
      that passes its own suite while reaching too far. It happened here: step 4.1
      put the artifact contract on the watch list and two cases in
      `ratification_subject.test.ts` failed for naming that file as ungated. The
      change is an 8th Iron Law plus a dated Gotcha in `testing-anti-patterns`,
      and the proposal distinguishes it from law 7 rather than folding it in,
      because deleting an expired fixture does not LOOK like gaming the green.
      `proposal:check` returns PASS. It discharges the criterion the archived
      `road-to-curated-self-improvement` left open and this roadmap's Context
      records as having no artefact in the tree.

      **It is `stage: proposed`, not `stage: gated`, and that is the honest
      state.** Since the owner's amendment a package proposal reaches `gated` only
      with an `owner_authorization:` bound to the same digest, and that
      authorization is precisely what the open owner blocker is about. Writing
      `gated` would be an agent asserting the owner's approval — the one thing
      ADR-268 § 4 forbids. Every step of the lane an agent can walk is walked; the
      last one is the owner's and is named as his in the proposal's § 9.

      **Built 2026-10-12, reopened 2026-10-13 — taken off the branch that
      carried it, on the reviewers’ own reasoning.** The modification review
      refused that branch 2/2 on `smaller-change`, and the code of this step is
      reverted to `origin/main` — verified as an EMPTY net diff per file rather
      than as a revert command that exited 0. Only the content binding (2.1, 2.2)
      stayed on it. See § Staged, not abandoned and D12.

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
- **Status:** resolved 2026-10-07 — option (a) on record (evidence: `docs/decisions/ADR-281-council-confirmed-self-modification.md` is `status: accepted`, `adr_cite_check` read 2026-10-07; owner choice D10)
- **Note (2026-10-07):** ADR-281 carries an amendment of 2026-10-07 making a council verdict advisory until an authenticated owner authorisation is bound to the same digest. Steps 3.4, 5.3 and 6.1 assume the council record itself passes the gate; that premise is re-read when those steps are worked, not by this blocker.
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
- **Status:** resolved 2026-10-07 — option (b) on record (evidence: ADR-281 is `status: accepted` and names `owner-permission-route` in § 5, `grep -c` = 4; owner choice D11)
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

- [x] AC-1 — A gated file edited after its review turns the gate red until a
      new review exists, and a base that moved on other files does not.
      **MET 2026-10-12, both limbs measured as a pair over one diff.**
      `ratification_subject_binding.test.ts` writes a valid record, then changes ONE
      byte of the reviewed kernel rule and the gate reds with "the record reviewed
      different content"; the same suite moves `README.md` and `docs/architecture.md`
      afterwards and the gate stays green. A third case moves a gated file that is
      NOT in the diff and stays green, so the criterion's "on other files" is pinned
      in both directions rather than once. Seen red for the intended reason:
      neutralising the binding drops 5 of the 9 cases and leaves the 4 that should
      stay green.
- [ ] AC-2 — A modification review with one provider concluding produces a
      record that does not pass.
      **MET 2026-10-12, and the council changed WHICH rule refuses it.** The writer
      exists (3.4) and the one-concluding-seat case runs end to end in
      `ratification_record_writer.test.ts`: the record IS written, it says
      `verdict: ratified` with `providers: [anthropic]` — what the seats actually
      said — and `recordWouldPass` is false. The measured reason is a single
      `diversity-required` problem and nothing else, which is the point of the 2/2
      council verdict of 2026-10-12: quorum refuses the record, the header does not
      relabel the evidence. A record that said `non-convergent` here would make a
      grep for that verdict return two different failure modes.

      **Reopened 2026-10-13.** The step this criterion was measured through
      came off the 2026-10-12 branch with the three concerns the reviewers asked
      to stage; the measurement stands as a record of what the code did, and the
      criterion is open until that code lands on a branch of its own. See
      § Staged, not abandoned.

- [ ] AC-3 — A change to the question list, the verdict rule or the writer is
      refused without a passing record.
      **MET 2026-10-12, measured with the real CLI rather than from the test.**
      `check_kernel_edit_ratified --files src/scripts/ai_council/modification_review_questions.ts
      src/scripts/_lib/ratification_record_writer.ts` exits 1, names "the review
      mechanism itself", and prints the escalation message — against the same
      command reporting "nothing to ratify" for those paths at the 2026-10-10
      measurement. `modification_review.ts` (the verdict rule) is on the same list.
      The polarity partner is measured too: `prompts.ts`, `stance_tally.ts`,
      `quorum.ts` and `council_cli.ts` stay ungated, so the gate did not simply
      swallow `src/scripts/ai_council/`.

      **Reopened 2026-10-13.** The step this criterion was measured through
      came off the 2026-10-12 branch with the three concerns the reviewers asked
      to stage; the measurement stands as a record of what the code did, and the
      criterion is open until that code lands on a branch of its own. See
      § Staged, not abandoned.

- [x] AC-4 — The contract names the route by which the owner permits a change
      the council could not pass, and what that route cannot prove.
      **MET 2026-10-10, both limbs measured rather than read.**
      `ratification-artifact.md` carries § The owner-permission-route (the owner's
      own recorded forge bypass, ADR-281 § 5; a chat answer refused by name) and
      § What this route cannot prove at `:532` (the gate cannot see a forge bypass;
      nothing proves the ask preceded it). Step 5.3's test pins both and carries its
      own sensitivity case.
- [ ] AC-5 — One proposal under `agents/proposals/` names a change that
      passes the gate and the record that passed it.
      **MET 2026-10-12, and the claim is scoped to exactly what is true.**
      `agents/proposals/polarity-fixture-repair.md` names
      `agents/evidence/ratifications/drain-self-modification-20261012.md`, the
      record of the modification review of the change it ships in, and that change
      passes `check_kernel_edit_ratified` — which is the gate the criterion names.
      What the proposal does NOT have is an `owner_authorization:`, so it stands at
      `stage: proposed` rather than `stage: gated`; that is the owner blocker, not a
      gap in this criterion, and § 9 of the proposal says so in its own words
      rather than leaving a reader to infer it from a missing field.

      **Reopened 2026-10-13.** The step this criterion was measured through
      came off the 2026-10-12 branch with the three concerns the reviewers asked
      to stage; the measurement stands as a record of what the code did, and the
      criterion is open until that code lands on a branch of its own. See
      § Staged, not abandoned.

- [x] AC-6 — No instruction file shipped to a consumer says kernel rules
      cannot be changed.
      **MET 2026-10-10.** The four-pattern grep over the consumer template, its
      projected copy, the threat model and the pipeline guideline returns **0**
      against a stated positive control of 4. Closed by step 1.2, whose corrections
      landed with ADR-281; this is the criterion re-measured at `0fd09ebe3` rather
      than inherited from that step.
- [x] AC-7 — The count of gate scripts is unchanged.
      **MET 2026-10-10: 173 on `origin/main`, 173 in this tree.** The Phase 3
      modules are library modules under `src/scripts/ai_council/`, not
      `check_*.ts` gates — which is the point of the criterion: this roadmap adds
      a review, not a new thing that can fail a build.

      **Re-measured 2026-10-13 after the narrowing: 174 on `origin/main`, 174 in
      this tree.** The base moved since 2026-10-10; what the criterion asserts is
      that this branch does not move it, and it does not. The one script 2.1 adds,
      `src/scripts/ratification_subject.ts`, prints a digest and exits 0 — it is
      not a `check_*.ts` gate and nothing in CI runs it.

- [x] AC-8 — No shipped text says a council record is the approval of a
      package self-modification, and none names a content binding the gate
      does not perform.
      **MET 2026-10-12, with a stated positive control.** A six-pattern grep
      (`lowest rung that can pass`, `approval is the AI`, `user as last rung`,
      `is its last rung`, `council record is the approval`, ``whose `subject`
      matches``) over `src/`, `dist/`, `docs/contracts/` and
      `docs/guidelines/` returns **0** in this tree against **7** on
      `origin/main` at `17f028941`. The one surviving occurrence of the
      `subject` phrase is the guideline block quote explaining why the clause
      is absent, which is the opposite of naming a binding, and is excluded by
      the measurement rather than hidden from it. Closed by steps 1.4 and 1.5.

      **Re-measured 2026-10-13, after the narrowing, and the second limb is met
      the OTHER way round.** The five patterns that measure the FIRST limb — that
      no shipped text calls a council record the approval — return **0** over
      `src/`, `dist/`, `docs/contracts/` and `docs/guidelines/`. The sixth,
      ``whose `subject` matches``, was going to be retired on 2026-10-12 because
      2.1 made the binding real and the clause could return to the pipeline
      guideline naming a guarantee the gate keeps. That return rode on 6.1, which
      is staged off this branch, so the guideline is back at `origin/main` and the
      clause is absent again — the limb holds because nothing names the binding,
      not because the binding is named truthfully. The contract’s new
      § `subject:` does describe it, and describes a binding the gate now
      performs, which is what the limb asks. Closed by steps 1.4 and 1.5; the
      clause returns with 6.1.

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
| D12 | reversible-technical | council:drain-self-modification-20261012 | Land the content binding alone; stage governed-surface expansion, proposal validation, the record writer, the escalation shape and the Iron Law as their own changes | The modification review of 2026-10-12 refused the bundled branch 2/2 and both seats answered `smaller-change` with "landing the binding first would close replay risk while letting the broader self-governance design be evaluated with a smaller blast radius"; the bundled diff was 177 KB against a 51 KB council bundle ceiling, so no seat saw the whole of it | A later council reviews the staged concerns together and asks for them as one change |
| D13 | reversible-technical | council:drain-self-modification-narrowed-20261013 (round 5) | The ratification subject is read from Git objects at an explicit revision, never from the working tree; a gated path committed as a symbolic link is refused rather than hashed as its target string | Rounds 3, 4 and 5 each refused the working-tree reader on a new filesystem defect (errno handling, non-regular files, a symlinked ancestor); both round-5 seats named hashing an explicit Git revision as the stronger fix | A gated surface legitimately needs to be a symbolic link, or the gate must judge content that is deliberately left uncommitted |

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
<!-- risk-review: v1 | reviewed: 2026-10-13 | reviewer: claude -->

| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1 | The record is still text an agent can write | implementation | A digest and a seat list can be typed as easily as a name; and whether the forge's file list is complete for a very large change was not measured. | The contract already says the anchor is the base revision and the platform, not the record; Phase 2 adds that a record cannot be reused or outlived by an edit and claims no more; 3.4 would add that it is produced by the run and is **open again**, so that half of the mitigation is planned rather than in force. Sharpened 2026-10-13 by a reviewer: an author who edits gated content and recomputes the digest produces a record the gate accepts, so the word is DETECTS, never prevents, and the contract now says that in the reviewer’s own words. | Phase 2 — An approval is bound to what it approved |
| 2 | The owner's route becomes the easy way round a split council | implementation | Any record form for the owner's permission is text, and a run with a grant could land it. | The step is held by its own blocker, whose options state what each can and cannot prove; the recommended one is an act on the forge that no session can perform. | Phase 5 — A council that cannot settle it stops the run for the user |
| 3 | The questions become a form the seats fill | product | A fixed list invites nine short affirmations. | 3.4 keeps each seat's answers in the record's body, where a later reader sees them; 3.1 asks what would show the benefit false, which has no affirmative answer. | Phase 3 — The council reviews a modification as one |
| 4 | This roadmap's own gate changes need the gate | implementation | Phases 2 to 5 edit self-watched files. | Each lands with a record under the rules in force at that time; 4.1 lands after Phase 3 so that nothing is gated by code that does not exist yet. | Phase 4 — The reviewer and the consequence class are inside the gate |
| 5 | A council outage stops governance work | product | With the lone decision removed, an unreachable seat ends the run. | That is the directive's last rung; 5.2 makes the stop one question with everything needed to answer it, and 5.3 gives the answer the route the owner chose. | Phase 5 — A council that cannot settle it stops the run for the user |
| 6 | The worked example is chosen to be easy | product | A trivial learning proves the plumbing and little else. | 6.2 requires a change to a rule or skill body, reviewed with the full question set; the record's body shows what was asked. | Phase 6 — One change nobody asked for travels the whole lane |
| 7 | Widening the path set slows ordinary rule work | product | 28 more files need a record per change, and so does any edit to the shared rule schema. | Four of the 49 commits touched a rule outside the kernel; D4 names the reading that would widen or narrow it. | Phase 4 — The reviewer and the consequence class are inside the gate |
| 8 | A reviewed change turns red because the base moved | implementation | The digest changes when the base edits a gated file the change also touches. | That is content the council did not see; 2.1's test pins that a base move on any other file leaves the digest alone. | Phase 2 — An approval is bound to what it approved |
| 9 | A step's own text outlives the decision it was written under | implementation | Step 6.1 still read "the pipeline's approval is the council's record" five days after the owner's amendment reversed exactly that, and nothing surfaced it: the amendment edited the ADR, 1.4 corrected the shipped texts, and the plan that instructs the work was in neither set. Implementing the step as written would have re-broken AC-8. | 6.1's title and text now state the amended rule, and AC-8's grep is scoped to shipped text only — so the same drift in a plan is still invisible to it. The check that caught this one was reading the step before running it; no gate replaces that. | Phase 6 — One change nobody asked for travels the whole lane |
| 10 | The staged concerns never land, and the binding is read as more than it is | product | 4.1, 4.2, 4.3, 6.1, 6.2, 3.4 and 5.2 came off the 2026-10-12 branch on the council’s own `smaller-change` answer. Replay is closed; the reviewer is still outside the gate, the 28 high-consequence rules beyond the kernel are still editable with no record, and a reader who hears “the binding landed” may take the whole design for shipped. | § Staged, not abandoned states that cost in the file rather than leaving it to be inferred, each reopened step carries the reviewers’ words, and the contract’s § `subject:` describes only what the gate performs. D12 carries the revisit-if. | Phase 4 — The reviewer and the consequence class are inside the gate |
| 11 | A gated path the gate classifies can abort the gate instead of refusing | implementation | The 2026-10-13 review found the error model three-quarters built: `GatedPathEscapes` is thrown and never caught at `evaluate()`, and the reads after the stat are unwrapped — so a classified traversing path or a post-stat I/O failure leaves the gate as an exception rather than the structured refusal the contract promises. A crash still fails closed on the exit code; it is not the documented behaviour, and it is a way around the promised refusal. | Step 2.3 carries it with the seats’ words and the two bounds the blind peer-review stage set on the repair — narrow typed translation rather than a blanket catch, and the symlink-swap question answered rather than assumed. Deliberately not repaired on the reviewed branch: editing a gated file after the seats answered would move the `subject` and launder the record. | Phase 2 — An approval is bound to what it approved |
