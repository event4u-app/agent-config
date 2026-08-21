---
model_tier: high
name: decision-review
description: "Use to audit a past architectural decision — did the chosen option hold up, what assumptions drifted, should the ADR be superseded? Backward review only; does not lock new choices."
domain: process
workspaces:
  - engineering
packs:
  - analysis-workbench
trust:
  level: professional
  confidence: medium
install:
  default: false
  removable: true
---

# decision-review

> Audit a past architectural decision: restate what was chosen and why,
> compare the original assumptions against reality now, and produce a
> verdict (still valid / needs amendment / superseded). Ends with a
> `historical-patterns` memory candidate per the
> [Analysis Memory Loop](../../../docs/contracts/analysis-memory-loop.md).
>
> **Direction:** backward (did it hold?) not forward (which option?).
> For forward flow, use [`decision-record`](../decision-record/SKILL.md).
> For filing the ADR file, use [`adr-create`](../adr-create/SKILL.md).

## When to use

- Revisiting a past architectural decision: "Did ADR-042 still make
  sense given what we learned?"
- A prior ADR is being cited as precedent and its validity should be
  checked before relying on it.
- A post-mortem or retrospective surfaces that an earlier choice may
  have contributed to problems.
- Preparation for a supersession: confirm the old decision actually
  needs replacing before writing a new ADR.
- Routed here by [`decision-revisit-gate`](../../rules/decision-revisit-gate.md)
  when a beneficial change is blocked by a recorded lock (honest-null
  verdict, "don't relitigate" memory, budget canon, or ADR) — this skill
  supplies the backward-audit procedure that rule's re-evaluation offer
  points to.

Do NOT use when:

- Making or locking a **new** decision — use
  [`decision-record`](../decision-record/SKILL.md) (which builds the
  options matrix and locks the choice).
- The ask is to file or number the ADR file — use
  [`adr-create`](../adr-create/SKILL.md).
- No prior decision or ADR exists to review — nothing to audit.

## Procedure

### 1. Locate and inspect the decision

Identify the ADR in `docs/decisions/` (flat, `ADR-NNN-<slug>.md`) or
`docs/adrs/<area>/` (per-area, `NNNN-<slug>.md`), or a logged
decision in `agents/decisions/`. If the user named the decision
informally, check the index for the slug before reading. Read the
full file before proceeding.

### 2. Restate: what was decided and why

Extract and restate in your own words:

- **Chosen option** — what was picked.
- **Context then** — the forcing function that made the decision
  necessary.
- **Assumptions** — the explicit and implicit priors the decision
  rested on (load, team size, vendor stability, regulatory state,
  tech maturity, cost, etc.).
- **Alternatives rejected** — why each runner-up lost.

This restatement is the baseline. Later steps compare against it.

### 3. Compare to reality now

For each assumption identified in step 2, classify:

| Assumption | Status | Evidence |
|---|---|---|
| *e.g. "vendor X is stable"* | held / broke / unknown | *e.g. "vendor deprecated API in v3"* |

Also list **new information** that did not exist when the decision
was made (new tooling, changed requirements, post-mortem learnings,
usage data).

Hindsight discipline: judge each assumption against the **information
available at the time it was made**, not against the outcome alone.
A decision can be correct given the information then and still need
revision now.

**Read the record's axes in this order** — each step can end the review, so
running them out of order pays for the expensive ones first:

1. **Effective state** — status, `superseded_by`, amendments, whether the
   `review_trigger` fired. `superseded`/`deprecated` is not a live lock at all.
2. **`provenance`** (+ `agentic_mode`) — who decided; descriptive only.
3. **`evidence.strength`** — E0–E4, claim-relative, not a count of sources.
4. **`evidence.discovery`** — on E0, `incomplete` means *nobody looked*: a
   discovery failure, not an evidence failure. Search before treating the
   absence as established, or the grade measures the review, not the decision.
5. **Current evidence** — what tree, measurements and sources say *today*.
6. **Reversibility** — of the transition you propose, not of the original
   decision. The routing unit is the transition, never the document.
7. **Reserved dimensions** — `protected_dimensions`, `reopen_policy` (absent →
   `unclassified`, which is not `owner`).

Then price the reopen record from the grade × provenance burden table in
[`adr-layout § The reopen record`](../../../docs/contracts/adr-layout.md) —
cheap for an `E0`/`E1` agentic snapshot, *surfaced* rather than obeyed or
overturned for `E0`/`E1` human, the standard five fields at `E2`, and those
fields plus engaging the original evidence **in kind** at `E3`/`E4`. Read the
table; do not reconstruct it from memory. The axes are defined by
[`adr-layout § Provenance and evidence`](../../../docs/contracts/adr-layout.md),
not here.

### 4. Verdict

One of three:

- **Still valid** — assumptions largely held; no amendment needed.
  Document the validation date so future reviewers know it was checked.
- **Needs amendment** — core decision stands but one or more
  consequences or constraints must be updated. Recommend the specific
  amendment and suggest filing a narrow ADR or addendum.
- **Superseded** — the chosen option no longer serves the original
  goal or a new forcing function invalidates it. Name the successor
  option. Recommend handing off to
  [`decision-record`](../decision-record/SKILL.md) (to lock the new
  choice) then [`adr-create`](../adr-create/SKILL.md) (to file the
  superseding ADR with `supersedes: ADR-NNN`).

### 5. Memory write-back (dedup-first)

Before drafting a new candidate, call `retrieve()` over the same
key-space (decision area, affected paths):

- **Match found** — propose a `frequency` / `supersedes` **update**
  to the existing entry. Do not create a duplicate.
- **No match** — draft a new `historical-patterns` candidate per the
  [Analysis Memory Loop § 1](../../../docs/contracts/analysis-memory-loop.md):

```jsonc
{
  "type": "historical-patterns",
  "summary": "<one-line pattern: what held or broke>",
  "evidence_paths": ["docs/decisions/ADR-NNN-<slug>.md"],
  "decision_surface": ["<area1>", "<area2>"],
  "last_validated": "YYYY-MM-DD",
  "review_after_days": 90,
  "applicable_scope": "project"
}
```

Surface the draft to the user via `/memory propose`. Never
auto-promote. If the candidate fails the admission gate (< 2
distinct evidence paths AND < 3 future decisions in
`decision_surface`), surface the gap and suggest deferring or
strengthening evidence.

## Output

1. **Decision restatement** — chosen option, context then, assumptions, alternatives rejected.
2. **Assumption-drift table** — each assumption: held / broke / unknown, with evidence.
3. **New information** not available at decision time.
4. **Verdict** — still valid / needs amendment / superseded — with rationale.
5. *(optional)* **Memory candidate** — `historical-patterns` draft or update proposal.

## Do NOT

- Re-litigate a decision that the verdict confirms is still valid.
  Acknowledge it, note the validation date, stop.
- Duplicate [`decision-record`](../decision-record/SKILL.md)'s options
  matrix and trade-off table — this skill reads the old matrix; it does
  not rebuild one unless the verdict is "superseded" and a new decision
  process is needed.
- Auto-promote memory candidates — the human drives promotion per the
  [Analysis Memory Loop](../../../docs/contracts/analysis-memory-loop.md).
- Issue a "superseded" verdict without naming the successor option or
  recommending the forward path to `decision-record` + `adr-create`.

## Gotchas

- **Backward vs forward:** `decision-review` asks "did the chosen
  option hold up?" — `decision-record` asks "which option should we
  pick?" Conflating them produces a partial analysis: either a
  verdict without a replacement plan, or a replacement plan without
  understanding what broke.
- **Hindsight bias:** a decision made with the information available
  then can be correct even if the outcome was poor. State what was
  known at the time; avoid framing a correct past decision as wrong
  because newer facts exist.
- **Stale memory entries:** if `retrieve()` returns entries in
  `skipped` (stale — age > `review_after_days`), surface them to
  the user; do not silently use stale entries as if they were current.

## Removal is a disposition — a rule the agent keeps failing gets teeth or gets deleted

```
A RULE THE AGENT CONSISTENTLY FAILS TO FOLLOW GETS STRUCTURAL ENFORCEMENT
OR DELETION. NEVER A LOUDER RESTATEMENT.
ASK WHAT CAN BE REMOVED AS DELIBERATELY AS WHAT SHOULD BE ADDED.
```

Ratchets in this tree move one way. Counts go up, gates accumulate, and nothing
retires an artifact — so the default response to non-adherence has been to say
it again, harder. That is the one response the evidence rules out: an obligation
that did not change behaviour as prose does not change it as louder prose. The
fork is **enforcement or deletion**, and both are real options.

**Non-adherence is the trigger, not low frequency.** A rule that rarely fires is
not a rule that fails. A floor is working precisely when nothing crosses it, and
deleting it because it has been quiet removes the thing that was holding.

### The simplify signals

Any of these is a reason to open the question. None of them is on its own a
verdict:

- a section that has not been relevant across many sessions;
- a rule derived from a **single unvalidated observation**;
- a workflow that is consistently shortcut in practice;
- sections that are loaded every run and never acted on;
- two rules that contradict each other;
- complexity added for a case that has never triggered.

Note that *never relevant*, *single unvalidated observation*, and *never acted
on* are listed separately on purpose. They look alike and they are not: the
first is about scope, the second about evidence, the third about attention.

### Escalation, and its counterpart

```
A THIRD RECURRENCE OF THE SAME VIOLATION CLASS CONVERTS AN OBSERVATION
INTO A DETERMINISTIC GATE.
A REVIEW FINDING NEVER SILENTLY BECOMES A HARD GATE.
ESCALATE AT A STATED THRESHOLD, NEVER SILENTLY.
```

Both halves are load-bearing and they come from sources that disagree. The
threshold stops a recurring defect from being re-observed forever; the
counterpart stops a single reviewer's opinion from quietly becoming law. Between
them, the only legitimate path from *noticed* to *enforced* is a stated count
reached in the open.

## Decision-revisit gate — mechanics (migrated from the `decision-revisit-gate` rule)

Body of [`decision-revisit-gate`](../../rules/decision-revisit-gate.md)
(per P4 of `road-to-kernel-and-router.md`). The Iron Law — benefit blocked
by a lock → surface + offer re-evaluation, never silent compliance — stays
in the rule; the lock catalog, fire steps, and failure modes live here.

### What counts as a "lock"

- An eval verdict recorded as an honest null (a mechanism was tested,
  showed no lift, and the disposition says "don't rebuild without new
  evidence").
- A memory entry or `agents/settings/contexts/` note tagged "don't
  relitigate" / "settled" / a locked council convergence.
- A budget or frugality-canon line (`token-budget-discipline`,
  `telegraph-speak`, thin-projector trimming) that rejects a change on
  cost grounds alone.
- An ADR whose decision is being cited as a blocker for the current change.
- A **hard structural cap** (kernel size, per-domain persona cap, rich-skill
  ratio). A change that genuinely *qualifies* to cross the cap — e.g. a new
  rule that truly meets the kernel-membership inclusion criteria — triggers a
  **cap-raise proposal + maintainer/council approval**, never a silent
  downgrade of the rule to fit the old number (e.g. demoting a must-always-fire
  rule to `auto` just because the kernel says 9). Fitting the cap is not a
  reason to weaken a qualifying rule; but a rule that does **not** meet the
  criteria stays out — the cap is not the reason, the criteria are.

### What to do when it fires

1. **Mechanism-match check — do this FIRST.** A verdict settles the
   *mechanism it tested*, not every future proposal that resembles it.
   Before applying the lock, verify the blocked change is actually the
   same mechanism — not merely a similar-sounding one. A null on
   hardened blocking enforcement does not automatically cover
   discretionary contextual nudges; a null on one architecture does not
   cover a materially different one. If the mechanism differs, the lock
   does not apply — proceed, noting the distinction.
2. **If the mechanism genuinely matches**, do not silently comply.
   Surface, in one short block:
   - What change is blocked.
   - Which lock blocks it (cite the memory/context/ADR).
   - Under what conditions the lock was recorded (date, evidence, or
     "maintainer decision" if settled-by-decision rather than
     settled-by-evidence).
   - What has changed since (new evidence, new model generation, new
     tooling, repeated encounters) that makes revisiting worth the cost.
3. **Offer numbered options** (per [`user-interaction`](../../rules/user-interaction.md)),
   always including: re-evaluate the lock in the AI council. Other
   options: keep the lock as-is, or proceed without the blocked change.
4. **On re-evaluation:** run this skill's Procedure above for the
   backward audit and route to [`ai-council`](../ai-council/SKILL.md)
   for the debate mechanics. The rule owns the obligation to surface;
   this skill and the council own the procedure.
5. **Record the outcome** with scope + `revisit-if` per
   [`ai-council`](../ai-council/SKILL.md)'s convergence-summary
   contract — every re-evaluated lock gets a fresh, correctly-scoped
   disposition, not a re-statement of the old one.

   When the lock is an **ADR**, the disposition carries the five-field reopen
   record from [`adr-layout § Reopen record`](../../../docs/contracts/adr-layout.md):
   the original rationale **addressed** (not cited), what changed with tree
   evidence, dependants and external commitments touched, the rollback path,
   and a blast radius — `narrow | wide | irreversible` — with the evidence for
   that call. Two clauses bind the same record: **precedent creates no
   authority** (that a similar ADR was reopened is never grounds for this one),
   and **one seat must argue the strongest case for keeping the decision**.
   Both answer precedent laundering through correlated self-review, which is
   the failure two independent council seats named for this mechanism on
   2026-08-19: the proposer frames the evidence, correlated seats ratify, and
   the amendment becomes authoritative input for the next review.

   Proportionally: a narrow, reversible, bounded transition takes the light
   path (record + council); `wide` or `irreversible` adds owner notification.
   Identical ceremony for a typo-level amendment would cost more than asking
   the owner and the mechanism would die of its own weight.

### The grade prices the record, never the authority

```
AN EVIDENCE GRADE IS A MEASUREMENT, NOT A PERMISSION.
IT PRICES THE REOPEN RECORD AND THE REVIEW PRIORITY. IT CONFERS NO AUTHORITY.
A LOW GRADE NEVER LETS AN AGENT SUPERSEDE A RECORD ON ITS OWN.
```

Nothing in the burden table changes **who** may act: venue comes from the
discriminator, the trust boundaries the transition touches, and the
owner-reserved rows — never from the grade.

The coupling was proposed and refused: two council seats independently named it
the design's central defect, because the party assigning the grade would also
be the party gaining authority from it, and would additionally be
self-classifying its own transition as `reversible-internal` — itself an
authority-bearing classification. Calling the result "provisional" changes
neither the trust boundary nor the blast radius. Whether an *independently
validated* grade may ever reduce the authorization burden is owner-reserved and
open: do not answer it here — it is the `authority-coupling-decision` blocker in
`road-to-evidence-based-adr-governance`, and
[`adr-layout § The reopen record`](../../../docs/contracts/adr-layout.md) closes
on the same point.

Two consequences that are easy to get backwards:

- **An ADR's historical decision-maker does not determine its reopen venue.** A
  record decided by a council does not need a council to reopen it; a record
  decided by one agent is not thereby an agent's to overturn.
- **A low-evidence record may state a decision; it does not establish that the
  alternatives remain invalid.** *"We chose B because we had to choose"* is
  legitimate and publishable — but never grounds for *"A is forbidden, the ADR
  says B"*, which needs evidence the record never carried.

### When NOT to fire

- The blocked change has no real benefit — the gate is not a lever to
  reopen every settled question; [`no-cheap-questions`](../../rules/no-cheap-questions.md)
  still governs whether the resulting numbered-options block is a real
  question or noise. A revisit-offer with a genuine trade-off is never
  a "cheap question" under that rule — but a revisit-offer with no
  actual case for change is.
- The mechanism-match check (step 1) shows the lock is the same
  mechanism and no new evidence exists — apply the lock, no surfacing
  needed; this is the lock working as intended.
- The user already declined a revisit on this exact lock this
  conversation — per [`scope-control § Decline = silence`](../../rules/scope-control.md),
  do not re-ask.

### Failure modes

- Treating a "don't relitigate" memory as permanently closed instead of
  as settled-under-conditions-X.
- Applying a null verdict to a superficially similar but architecturally
  different mechanism without running the mechanism-match check.
- Letting the token-frugality canon auto-reject a net-positive change
  without surfacing the trade-off — see [`token-budget-discipline`](../../rules/token-budget-discipline.md)'s
  value-over-budget clause.
- Silently dropping a good idea because "we already decided this" —
  the canonical failure the gate exists to stop.
- Reading a low `evidence.strength` as permission to supersede — the grade
  prices the record, it never moves the venue.
- Treating `discovery: incomplete` as established absence: that grades the
  review, not the decision.
- Citing a low-evidence ADR as proof its rejected alternatives are still
  invalid. It records a choice, not a refutation.

## See also

- [`decision-revisit-gate`](../../rules/decision-revisit-gate.md) — the rule whose migrated mechanics live above.
- [`decision-record`](../decision-record/SKILL.md) — forward flow: lock a new choice.
- [`adr-create`](../adr-create/SKILL.md) — file the ADR after a decision is locked.
- [`blameless-post-mortem`](../blameless-post-mortem/SKILL.md) — incident review; may hand off to decision-review when a prior architectural choice is implicated.
- [`docs/contracts/analysis-memory-loop.md`](../../../docs/contracts/analysis-memory-loop.md) — produce → propose → promote → retrieve contract.
