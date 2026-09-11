---
title: Four ordinary-work turns judged against E3, and the condition all of them fail
date: 2026-09-11
---
<!-- evidence-type: analysis -->

# Four ordinary-work turns judged against E3, and the condition all of them fail

`road-to-delivery-on-hook-hosts` blocker `no-host-observed-true-injection` needs one
transcript qualifying under the four-condition criterion pre-registered on 2026-09-10
(that roadmap, § step 1.1). Every prior round failed on an operational obstacle — a
gate believed stale, then a gate closed by configuration. Both are gone: delivery is
live on this machine and firing in ordinary work. This round is therefore the first
that tests the **substantive** bar rather than the carrier.

It tests it on four candidates and reports four negatives. The value of the round is
not the verdicts; it is that all four fail on the **same** condition, for a reason
that is a property of the corpus rather than of the effort.

## Method

Candidates were selected mechanically, not chosen for their result. The whole Claude
Code transcript store was scanned for `rule-inject` delivery events; six sessions
carry one. Two were excluded before judging, both on condition 3: `5731d568`, a
roadmap-drain session whose own subject is this injection work (345 of its lines
mention the roadmap or the topic), and the session assembling this round, which is
disqualified twice over — by condition 3 and by the independence requirement, since
observer and subject would be the same agent.

For each surviving candidate a packet was assembled containing (a) the delivered rule
bodies verbatim, as they arrived, and (b) the turn: the user prompt, then every tool
call and reply in order. Each packet went to a **fresh subagent context that did not
produce the turn**, with an identical four-question prompt asking separately about
condition 1 (obligation discharged), condition 2 (counterfactual), condition 3
(subject) and an overall ACTED / NONE / UNCLEAR verdict. The prompt stated no
expectation in either direction and told the reader a weak verdict stated plainly was
more useful than a confident one. No reader was told what the verdict would be used
for, and none was re-run after returning an answer.

## Results

| # | Session · date · host | Delivered rule(s) judged | C1 obligation discharged | C2 not explainable by prompt | C3 not about delivery | Verdict |
|---|---|---|---|---|---|---|
| A | `2e711721` · 2026-09-10 · 2.1.267 | `question-not-instruction` | **no** | no | yes | **NONE** |
| B | `f0838a0e` · 2026-09-10 · 2.1.267/268 | `fix-what-you-see`, `cli-output-handling`, `commit-conventions`, `augment-edit-discipline`, `user-interrupt-priority`, `code-comment-discipline` | **yes** | no | yes | **UNCLEAR** |
| C | `f0838a0e` · 2026-09-10 · 2.1.267/268 | `active-remediation`, `council-availability`, `minimal-safe-diff` | **yes** | no | yes | **UNCLEAR** |
| D | `00e85eb7` · 2026-09-11 · 2.1.268 | `cross-source-consistency` (packet defective — see below) | **no** | no | yes | **NONE** |

## What each reader actually found

**A — NONE, and a clean one.** The delivered rule forbids executing on a question.
The prompt carried a question *and* an explicit imperative, so the rule's own
carve-out ("a rhetorical question inside a larger instruction — the trailing
imperative governs") applied and the rule did not fire. The reader's words: *"a rule
that does not fire cannot have changed behaviour … the evidence is not ambiguous, it
is absent."* Answering the user's question is not evidence of the rule; it is
evidence of reading the prompt.

**B — condition 1 met, condition 2 failed, and one datum that points the other way.**
The reader found `fix-what-you-see`'s sensitivity clause genuinely *performed*:
five fixes each neutralised, watched fail individually, restored. That is an
obligation discharged, not cited. But the reader also found the technique had been
demonstrated by a reviewer earlier in the same conversation, and — the sharpest
finding of the round — that the one clause in the same delivered rule which would
have **changed** the outcome was not followed: *"'a chat mention is not [a
disposition]', land a roadmap in the same change — was not followed, while the clause
the assistant had independent reason to follow was."* An injection that moves the
behaviour the model would have produced anyway, and does not move the behaviour it
would not, is the signature of no effect.

**C — same shape, independently reached.** A real batched note-and-ask with candidate
fixes and an explicit leave-it, and a sibling defect fixed with its test seen red.
The reader's conclusion: *"performance is not attribution … what the turn
demonstrates is conformant behaviour, not caused behaviour."* It also noted that
`council-availability`, the one delivered rule the task gave no occasion to satisfy,
went untouched — *"consistent with the injection having no observable effect either
way."*

**D — NONE, on a packet this round got wrong.** The reader found no discrepancy
surfaced and no question put before proceeding, and named a sufficient independent
cause for every behaviour that could be mistaken for compliance (the invoked
command's own flow, the user's German prompt). It also caught a defect in the
material it was given, and the catch is recorded here rather than quietly repaired:
the packet preserved only the delivered rule's **frontmatter preview**, not its body,
because the extraction read a truncated attachment field. The reader judged against an
incomplete delivery record and said so unprompted. D's verdict is therefore the
weakest of the four and is reported as one negative on a defective packet, not as an
independent confirmation. A re-run on a complete packet is the cheapest open follow-up
from this round; it was not done here because the finding below does not turn on D.

**On reader independence.** Each packet went to a reader that had produced nothing in
this round, and the readers did not see each other's answers. They were not, however,
independent *models* — all four ran on the same model as the session that assembled
the packets. That is a real limit on how much the agreement between B and C is worth:
two readers sharing a prior can agree for reasons other than the evidence.

## The finding that supersedes the four verdicts

Everything below this heading was written before the enumeration that the round's
own disposition called for had been run. That enumeration found a confound which
**changes what the four verdicts mean**, and it is stated first because a reader who
stops here must not leave with the superseded reading.

**Every rule this mechanism can deliver is already in the same session's context
unconditionally, through a channel the measurement never accounted for.** Measured,
not inferred, at `c86131ad7`:

| | |
|---|---|
| `type: auto` rules under `src/rules/` | **106** (`grep -lE '^type: *"?auto"?' src/rules/*.md`) |
| present in the user-global always-loaded layer `~/.claude/rules/` with a **byte-identical body** | **89** |
| present there with a body differing at all | **3** — and each differs by exactly one blank line (`finance-safety-floor`, `legal-safety-floor`, `strategy-safety-floor`) |
| absent from that layer | **14** — exactly the `workspaces: [agent-config-maintainer]` set, which this repository's sessions carry **inline in the system prompt** as project instructions |

Bodies were compared with frontmatter stripped, because the two channels legitimately
differ there (the always-loaded copy is an older install carrying different projection
metadata). A first pass reported ten of ten judged rules as DIFFERING; that was an
artifact of an extraction anchored on `^# `, which matches the `# obligation: line N`
comment inside the shipped copy's frontmatter. Recorded because the corrected pass
reverses it: with frontmatter properly stripped, **all ten rules judged in candidates
A-D are body-identical across both channels**, and `augment-edit-discipline`, the one
that is not in the global layer, is in the maintainer-scoped set carried inline.

**So in every judged turn the obligation text was in context twice, and the injected
copy added no new text.** Condition 2 asks a reader to name what the turn would have
looked like had the body not been present. In this environment, removing the injection
does not remove the body. The intervention varies *one copy versus two*, never
*absent versus present* — a different quantity from the one the condition is written
about.

Two explanations now fit the four verdicts equally well: the corpus explanation below
(these rules state what a competent agent does anyway) and duplicate exposure (the
agent had already read every one of them). **Nothing in this round separates them.**
The four results are therefore **non-identifying observations, not negative evidence**
about either the corpus or the mechanism, and the section below is retained as the
reading that was current when it was written rather than as a conclusion that stands.

An AI council (2/2 present, 2026-09-11, third round of the day) took the confound as a
premise change and split on the label while converging on every operational term:
anthropic returned **E3opt** — not measurable as specified, with one bounded
novel-rule attempt allowed; openai returned **E2** — continue only in a clean
environment, with automatic escalation to E3opt at the already-authorised boundary.
Both hold that E1 (no change) is untenable, that narrowing the witness class cannot
cure an environment-level confound, and that nothing here shows the hook or the rules
ineffective. Their shared operational terms are the ones now written into the blocker:
suspend condition-2 judgements wherever a second copy of the obligation exists, record
an **exposure audit** over system / project / user-global / other auto-loaded
instructions before admitting any candidate, require injection to be the **sole**
source of the tested body, and keep the boundary unchanged.

The residual measurable set in this environment, after all of that, is **empty**: the
only three rules whose bodies differ at all differ by a blank line, and all three are
domain-pack floors that ordinary work in a software repository never trips.

## The finding as it was read before the confound was known

Condition 1 is satisfiable — two of four candidates discharge a delivered rule's
stated obligation in externally visible text. **Condition 2 is where the corpus
fails, and it fails structurally.**

These rules encode the behaviour the model already produces on this project. That is
not an accident of authorship; it is what a house rule set *is*. So for almost every
delivered rule, the visible task independently demands the same act, and the
counterfactual a reader is asked to name comes out identical. The two candidates that
discharged an obligation were both over-determined: the task was "work this
reviewer's findings", and fixing findings with tests is what that task means.

Two further limits, neither of which effort removes:

- **Reasoning obligations are invisible by construction.** Assistant thinking blocks
  are recorded with length 0 in this host's transcript format. A rule discharged in
  reasoning leaves no trace a reader can judge. Most delivered rules state reasoning
  obligations, not output-shaped ones.
- **Selecting for an output-shaped rule edges into condition 3.** Choosing a prompt
  that trips a rule whose discharge is visible is the staging the criterion was
  written to exclude.

## What this does NOT establish

It does not establish that delivered bodies have no effect. Three turns are three
turns, and the absence of a visible counterfactual is not evidence of absent
influence — particularly given the length-0 limit above, which removes the place most
influence would show.

It does not establish that E3 is unsatisfiable in principle. It establishes that on
the corpus this package actually delivers, and the transcripts this host actually
records, condition 2 has now failed on every candidate the store contains.

It licenses no change to `src/config/host-injection-effect.json`. The `claude` row
stays `unobserved`, which is a result and not a gap.

**And, after the confound above, it does not establish the corpus reading either.**
Four turns cannot distinguish "these rules state what an agent does anyway" from "the
agent had already read them". Read the four verdicts as what they are — turns in which
no attributable difference was found, in an environment where no attributable
difference could have been found.
