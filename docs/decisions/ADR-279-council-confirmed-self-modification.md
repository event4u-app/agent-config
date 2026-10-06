---
adr: 279
status: proposed
date: 2026-10-06
decision: council-confirmed-self-modification
supersedes: ADR-268, ADR-118
superseded_by: —
supersedes_scope: >-
  On acceptance this record amends two sentences and nothing else: the
  ratification-ladder sentence of ADR-268 section 4, whose first rung becomes
  the council rather than an independent session, and rejection 2 of ADR-118
  section 3, whose "human approval" becomes the council's record for a proposal
  scoped to this package and stays the user's approval for work a user
  commissioned. Rejection 1 of ADR-118 section 3 — no open-ended hill-climbing
  on the config — is untouched, as are rejections 3 to 5 and every other
  section of both records. While this record is `proposed` it performs no
  supersession and the two records carry no reciprocal field; both are written
  in the same change that moves this record to `accepted`.
amends: —
amended_by: —
type: structural
reopen_policy: owner
protected_dimensions: [governance]
provenance:
  kind: mixed
  agentic_mode: delegated
  decision_makers: [owner, agent]
  human_directed: true
evidence:
  strength: E2
  basis:
    - agents/roadmaps/road-to-self-modification-that-a-council-must-pass.md
    - docs/decisions/ADR-268-every-mission-is-one-run.md
    - docs/contracts/ratification-artifact.md
    - src/scripts/_lib/ratification_artifact.ts
    - src/scripts/check_kernel_edit_ratified.ts
    - src/config/ratification-policy.json
    - src/rules/decision-revisit-gate.md
review_trigger: >-
  Reopened if the review load the council carries on the gated surface or on
  the learning lanes changes materially — the measured rate at the pin is 22
  governing commits in the 49 before 2026-10-05, of which 8 already carried a
  record — or if the owner widens the reading to every change touching a rule,
  skill, command or hook, or narrows it to the gated surface alone.
authority_basis: owner_intent
---

# ADR-279 — Self-modification is a goal, and a council is the lowest rung that can pass one

## Status

proposed

Drafted as proposed on purpose. Everything below that sets quorum or escalation
sits on the owner-reserved row of
[`decision-revisit-gate`](../../src/rules/decision-revisit-gate.md), which
reserves governance self-amendment — reopening authority, quorum, escalation —
to the owner. An agent may draft that text and may not accept it. The
acceptance is the owner's act, and until it happens the two records this would
amend keep saying what they say today.

## Context

On 2026-10-05, during an external comparison round against an autonomous
runtime that edits its own code behind a path list, a rate limit and a
snapshot, with the editor as its own judge, the owner gave a directive. In his
words: self-modification is good and should be a goal here too; it must at the
least be confirmed and permitted by an AI council, which always questions
critically and checks what the modification does; and in the last resort the
user must permit it.

Four facts about the tree at `df377ca64` make that directive a change rather
than a restatement.

- **The ladder's first rung is already weaker in the text than in practice.**
  ADR-268 section 4 opens the ladder at "an independent session or agent". Of
  the 23 artifacts under `agents/evidence/ratifications/`, 22 name a council in
  `reviewed_by` — in 19 different spellings. The text permits something the
  corpus has stopped doing.
- **The record names no change.** The six required fields
  (`src/scripts/_lib/ratification_artifact.ts:69-76`) identify who proposed,
  who implemented, who reviewed, which providers, the verdict and when it takes
  effect. None identifies a diff, and the gate passes when any one artifact in
  the changed-file list validates, so a gated file edited after its review
  still lands on that review's record.
- **The council has no review of this kind.** Its diff and pull-request lenses
  end on APPROVE / REQUEST_CHANGES / REJECT and a sentence; no code reads that
  line, and the artifact's verdict is typed by the agent that wrote the diff.
  No prompt in `src/scripts/ai_council/` mentions a kernel, a ratification or a
  modification.
- **Where the ladder ends at the owner, nothing the owner can write passes.**
  The two passing verdicts both sit under the provider count, the gate runs in
  a required job, and the contract's emergency procedure is for an active
  incident and says in terms that a red check is not one.

## Decision

### 1. Self-modification is a goal, not an exception

The package changing what governs it is ordinary work with an extraordinary
control on it, not a thing that happens only when something has gone wrong.
ADR-268 section 4 already permits the edit; this record removes the remaining
implication that it is exceptional, and the shipped sentences that still say
kernel rules cannot change at all are corrected on acceptance.

### 2. The council is the lowest rung that can pass

For a change to the **gated surface** — the kernel rules, the governance hooks,
the hook plumbing, the ratification mechanism itself and the review's own
modules — and for a change that **originates in the package's own learning
lanes**, the lowest rung that can produce a passing record is the AI council.
An independent session or agent alone no longer ratifies.

This is a **narrowing**, in the sense ADR-268 section 0 gives the word: it asks
for more independence than the text asked for, removes no refusal and adds one.
Work a user commissioned keeps the speed it has — the reading adopted is option
(a) of the roadmap's first blocker, not the wider option (b), whose measured
cost is 14 further reviews over the 49 commits before the pin.

### 3. The rest of the ladder stands, with one addition

After the council: a different provider, then the owner — reached on
non-convergence, on unavailable provider diversity for a critical expansion, or
on an owner-reserved dimension. To that list this record adds one case: **a
change to the reviewer itself** — the question set, the verdict rule, the
record writer, the content digest or the artifact contract — reaches the owner.
A reviewer that can approve a change to itself is not a reviewer.

### 4. The verdict rule, stated for the owner to accept or strike

Quorum is the owner's to set, so the rule is written here rather than only in
code. A seat **concludes** when its closing stance line parses to one of
`ratified`, `confirmed-non-expanding` or `refused`; a missing line, an
abstention or any other label is a seat that did not conclude. Then, in order:

1. any concluding seat on `refused` gives `refused`;
2. fewer concluding **providers** than `required_providers` in
   `src/config/ratification-policy.json` gives `non-convergent`;
3. otherwise `ratified` if any seat said so, and `confirmed-non-expanding` if
   all did.

The seat count comes from the ratification policy and not from the council's
own quorum, which concludes at one of two seats by deliberate choice
(`src/scripts/ai_council/quorum.ts:13-19`). One seat is enough to answer a
design question and is not enough to ratify an authority change.

### 5. When the user decides, and by which route

The user decides when the record is `non-convergent` after a different provider
was tried; when provider diversity is unavailable for a critical expansion;
when the change touches a row of the owner-reserved table in
`decision-revisit-gate`; and when the change is to the reviewer itself.

The route — the matter the roadmap's blocker `owner-permission-route` put to
the owner, answered on 2026-10-06 — is the **owner's own recorded bypass on the
forge**, preceded by an ask: on non-convergence, or on the red check it causes,
the agent tells the owner at once and asks in-session with options. A yes is
then given as the forge act and never as a chat answer, because a chat answer
reaches the tree only as text an agent wrote, and ADR-268 section 4 forbids an
agent ratifying its own increase in power. The alternative the owner did not
pick — an owner-ruling record written into a place only a person may write —
needs a fence that does not exist in this tree today; it becomes the better
route when the `road-to-gate-preauth-authorization` stub answers where such an
authorisation is kept, and this record is reopened at that point.

**What that route cannot prove, said plainly:** a bypass on the forge is
detective and restorative, not preventive. It leaves a trace; it does not make
the act impossible, and no mechanism in this repository can authenticate that
the owner's instruction was given or correctly transcribed.

## Consequences

- A change to the gated surface that no council passed does not land, and the
  agent cannot substitute its own judgement or a subagent fan-out for the
  council's record. The standing instruction to decide alone when the council
  fails stops applying to this one review.
- A council outage stops governance work. That is the directive's last rung
  working as intended, and the stop is one question to the user with the
  recommendation, the dissent, the change, its expected gain, its risk and how
  it is undone.
- The record gains a binding to the content it reviewed, so a reviewed change
  that is then edited is no longer covered by its own review.
- Nothing here grants landing authority. A passing record makes a change ready;
  whether a run may land its own change stays ADR-268 section 3's question and
  the typed grant's.

## Alternatives

- **Every change touching a rule, skill, command or hook needs the review.**
  Option (b) of the first blocker. Measured at 22 of the 49 commits before the
  pin. Not adopted: it prices commissioned work at the rate of governance work
  and the owner chose otherwise.
- **The gated surface only.** Option (c). Not adopted: it leaves the package's
  own proposals — the one class where no human asked for the change — on the
  weakest rung.
- **A new verdict vocabulary with a conditional-approval state.** Refused: the
  artifact's vocabulary is closed because an open one always reads as approval
  to a grep.
- **No route past a council that cannot conclude.** Option (c) of the second
  blocker, and what the tree does today. Not adopted: it makes an unreachable
  provider a permanent veto on governance work.

## Not reopened

The scoped supersession above touches two sentences. These are **not** reopened
by it and are not weakened anywhere in this record:

- **ADR-118 section 3 rejection 1** — no open-ended hill-climbing on the
  config. Nothing here permits a loop to mutate rules against a metric.
- **ADR-118 section 3 rejections 3, 4 and 5** — checkpointed runs, golden-set
  anchoring, no cross-session loop state in external services.
- **The Iron Law of ADR-268 section 4** — that an agent may modify its
  constitution but never ratify its own increase in power, that the party
  gaining the authority never records the ratification, and that provider
  diversity is required where two providers are configured. This record raises
  the first rung under that law and does not touch the law.
- **ADR-268 section 3** — without a grant a run ends open. A passing record is
  not a landing authority.
- **The tool-call deny on kernel rules.** It is not retired, bypassed or cited
  as retirable here; its replacement waits on the blocker
  `ratification-platform-anchor` in `road-to-typed-grants-that-persist`.
- **Automated promotion of learnings.** Killed on the programme's register and
  parked with `road-to-ac-deep-capabilities` Workstream C. This record raises
  the approval bar for a proposal; it promotes nothing.

## Evidence

- **23 ratification artifacts** under `agents/evidence/ratifications/` at the
  pin; 22 name a council in `reviewed_by`, in 19 distinct spellings. Run
  through this repository's own reader with the committed policy (two providers
  required), 21 validate and two do not — one carries a verdict outside the
  closed vocabulary, one names a single provider and a subagent as reviewer.
  This is the measurement behind section 2: the first rung is already weaker in
  the text than in the corpus.
- **22 of the 49 commits** dated 2026-10-01 to 2026-10-05 touch a rule, skill,
  command, hook, gate script, council file or the settings template; 8 carry a
  ratification artifact; one touches council code; four touch a rule outside
  the kernel. This is the cost of option (b), and the reason (a) was chosen.
- **The gate passes on any one valid artifact in the changed-file list**
  (`src/scripts/check_kernel_edit_ratified.ts:406-445`), and no required field
  identifies a diff — the gap the consequences above close with a content
  digest.
- **The council's closing lines are unread by code.** `prompts.ts:71`,
  `:101-103` end a diff review on a verdict word no reader parses; the stance
  line and its seat parser (`prompts.ts:171`,
  `src/scripts/ai_council/stance_tally.ts:106`) are the one closing line a
  parser already reads, which is why the rule in section 4 is built on it.
- **A council concludes at one of two seats by design**
  (`src/scripts/ai_council/quorum.ts:13-19`), which is why section 4 takes its
  threshold from `required_providers` instead.
- **The contract rules out the owner's own route today**: the emergency
  procedure is for an active incident and says a red check is not one
  (`docs/contracts/ratification-artifact.md:185-193`), and the committed
  platform expectation allows no unconditional bypass actor
  (`src/config/platform-anchor.json:16`). Section 5 is the amendment the
  owner's answer of 2026-10-06 asks for, scoped to recorded non-convergence
  only.
