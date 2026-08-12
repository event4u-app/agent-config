---
complexity: standard
status: ready
---

# Road to structured guard input — stop guessing intent from prose

> **Source:** AI council on guard severity (anthropic + openai, 2026-08-12,
> quorum 2/2, $0.07). Convened after a cross-project session audit found false
> positives in all three blocking guards that classify natural-language text
> (`agents/evidence/audits/session-audit-2026-08-12.md`). The immediate
> false positives are already fixed and the tier rule is written into
> `docs/contracts/hook-architecture-v1.md`; this roadmap carries the part that
> does not fit one PR.

## The council's finding, in one line

> A finite pattern cannot bound an infinite false-positive set — narrowing is
> sampling from an unbounded error space, not converging on a solution.

The history is the evidence: `block-unauthorized-git` has been narrowed three
times (quoted `|`, dotted path segments, unanchored verb), and
`evidence-independence`'s self-scope discriminator was **itself** the fix for an
earlier false positive of the same shape. Each fix was correct about the
instance in front of it and bought nothing against the next one.

## What already shipped (not repeated here)

- The three measured false positives are fixed, each pinned by a test built from
  the real prompt.
- The tier rule is a contract: structured input may block · free text plus
  structured corroboration may block · free text alone may only warn.
- `evidence-independence`'s second-dispatch branch is advisory; its pre-loaded
  verdict branch still blocks.
- `turn-end-gate` gained a same-line negation check, so honest "not done yet"
  status lines are no longer refused.

## What is NOT decided, and must not be assumed

The council's own falsifiers are load-bearing and none of them has been
measured. Do not treat the recommendation as settled until Phase 1 answers them.

## Phase 1 — measure before building

- [ ] Measure the false-NEGATIVE cost of the advisory downgrade. Over the next
      50 sessions, count second-self-review dispatches that the guard now only
      warns about, and classify each as genuine verdict shopping or fan-out.
      *Verify:* a count with a per-case classification, not a rate alone. The
      council's bar: if genuine shopping slips through at >2%, the branch needs
      structure rather than advisory status.
- [ ] Measure whether the secondary controls the council assumed actually exist.
      For each guard, name what else would catch the failure it was built for —
      evidence-file validation for a fabricated verdict, CI approval for an
      unauthorized publish, human review for a completion claim over red CI.
      *Verify:* per guard, either a named second control with a file reference,
      or an explicit "none — this guard is the only control", which changes the
      severity answer for that guard.
- [ ] Count the dispatch call sites that would need a `role` / `evidence_scope`
      field.
      *Verify:* a count. The council's falsifier: >50 sites with >30% external
      makes the structured-metadata path too expensive, and the recommendation
      changes.

## Phase 2 — the structured field, if Phase 1 supports it

- [ ] Add `role: evaluate | implement | coordinate` and
      `evidence_scope: self | external | none` to the dispatch envelope, set by
      the caller at the call site — where the intent is known by construction
      rather than inferred from the prompt text.
      *Verify:* the field reaches `evidence_independence` in a real envelope; a
      dispatch missing it is distinguishable from one that set it.
- [ ] Move the second-dispatch branch to read the field instead of the prose,
      and restore blocking for `(role=evaluate ∧ evidence_scope=self)` twice in
      one turn.
      *Verify:* the 16-way implementation fan-out from the audit still
      dispatches 16 workers; two genuine self-reviews in one turn block.
- [ ] Keep the prose predicate as an advisory cross-check and log disagreements
      between it and the field.
      *Verify:* a disagreement is logged with both verdicts, so a model that
      mislabels `role` to dodge the guard is visible rather than silent.

## Phase 3 — the adversarial question the council raised

- [ ] Test whether the field can be gamed: over 20 sessions after Phase 2, count
      dispatches where `role=implement` was set on a prompt that a human reads
      as an evaluation.
      *Verify:* a count with examples. The council's falsifier: >10% means
      structured gates do not survive an adaptive model, and the answer is
      human-in-the-loop approval for the sensitive operation rather than any
      automatic gate.

## Phase 4 — the blind spot the audit missed

- [ ] Establish whether guards see pre- or post-expansion text. A guard reading
      `rm $FILES` cannot know whether `$FILES` expands to `*.tmp` or `*`; the
      same applies to a dispatch prompt built from a template.
      *Verify:* a worked example per guard showing which text the guard actually
      received, taken from a real envelope rather than from the code path.
- [ ] If guards see pre-expansion text, record the consequence for the tier rule:
      a "structured" input that is a template variable is not structured at the
      moment the guard reads it.
      *Verify:* the contract's tier section states the answer either way.

## Success criteria

- Every blocking guard names the structured input or state its decision rests
  on. No guard blocks on inferred intent.
- The advisory downgrade is either justified by a measured false-negative rate
  or reversed with structure behind it — not left as an untested default.
- A model that mislabels a structured field is visible in the logs.

## Non-goals

- Machine-learned intent classification. Both council members rejected it: the
  maintenance overhead and the precision required for non-repetitive language
  make it a worse trade than structured metadata.
- Another round of regex narrowing on any of the three guards. That is the move
  this roadmap exists to stop; if a new false positive appears, it is evidence
  for Phase 2, not a patch target.
