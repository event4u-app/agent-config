---
adr: 257
status: accepted
date: 2026-09-07
decision: prose-tell-detector-scope-and-rejected-absolutes
supersedes: —
superseded_by: —
phase: road-to-measured-prose-tells (step 1.6)
type: structural
reopen_policy: directional
provenance:
  kind: mixed
  decision_makers: [anthropic/claude-sonnet-4-5, openai/gpt-4o]
  human_directed: true
  agentic_mode: council
evidence:
  strength: E3
  basis:
    - agents/roadmaps/archive/road-to-humanized-writing.md
    - src/scripts/ai_tells_rules.ts
    - src/scripts/detect_ai_tells.ts
    - internal/bench/reports/prose-tells-fp-v1.md
review_trigger: >-
  Reopen on any one of four observations, each falsifying a premise this record
  rests on rather than merely arguing against it. First — a measured
  false-positive count showing the density cap rejects ordinary human prose at a
  rate the fixture corpus cannot see, which is a statement about the cap the
  2026-07-11 session had no instrument to make. Second — a consumer surface
  outside generated deliverable prose is observed being gated by this detector,
  since the scope boundary is the load-bearing half of the decision. Third — a
  captured voice fingerprint is observed being overridden by the density cap,
  since fingerprint precedence is what makes a cap tolerable at all. Fourth —
  repeated demand for opinionated voice injection, which is the revisit
  condition the session itself recorded against Q6. Explicitly NOT a reopen
  trigger: a fresh external proposal restating the absolute rules below without
  new measurement. Three independent sessions have now arrived with that
  proposal and none carried evidence; a fourth arrival is a recurrence, not a
  premise change.
---

# ADR-257 — the prose-tell detector's scope, and the absolute rules that were rejected

## Status

**Accepted.** This record does not make a new decision. It writes down one that
was made on 2026-07-11 and has governed a shipped, default-on surface ever
since from a place nobody looks.

## Context

`detect_ai_tells.ts` ships default-on inside write-engine step 4b and behind
`/humanize`. What it may and may not do was settled by a two-round AI-council
session on 2026-07-11 (anthropic/claude-sonnet-4-5 + openai/gpt-4o), recorded
in `agents/roadmaps/archive/road-to-humanized-writing.md` § Council notes and,
in fragments, in the docstrings of the two scripts.

That is the whole record. There are 195 ADRs under `docs/decisions/` and, until
this one, a grep across all of them for `humaniz|prose.tell|anti-slop|em.dash`
returned nothing.

The consequence is measurable rather than hypothetical. Two independent
external analysis sessions arrived in 2026 proposing the same absolute rules
this session rejected — a zero-em-dash target, a CI gate over this
repository's own documentation, blanket adverb and passive bans — and one
proposed re-litigating them as if the question were open. From where those
sessions were standing it was open: an archived roadmap and a code comment are
not a decision record, and a verdict nobody can find is a verdict that gets
re-argued at the cost of a full analysis round each time.

## Decision

Record the six 2026-07-11 verdicts as governing, in a citable place, with their
reopen conditions attached.

1. **Shape.** A standalone `humanizer` skill **plus** an opt-out write-engine
   hook. A guideline alone is not executable.
2. **Surfaces.** Default-on inside the write engine (step 4b) with a per-run
   opt-out. `/post-as:me` carries no opt-out — "post as me" makes an AI tell a
   replication defect, not a preference. `/ghostwriter:write` keeps the opt-out
   for legitimate neutral-register use. Technical and reference output is **hard
   excluded**: neutral plain prose is the correct human voice there.
3. **Em dashes.** The zero-dash hard rule is **rejected** — inconsistent with
   house style and with the CP1 precedent in `design_slop_rules`. What ships
   instead is a density cap (CP1 parity, > 2 per 500 words), fingerprint
   precedence (a captured voice that legitimately uses dashes wins), and a
   per-run strictness knob. Never applied to repo-doc authoring.
4. **Detector first.** The deterministic detector ships as the measurement
   substrate so every later exit gate is falsifiable. A scope-creep objection
   raised in round 2 targeted a CI-linter *product*; it was resolved by
   re-scoping, not by overruling — a fixture-gated script used at generation
   time and in evals, **never** a CI gate over repo docs.
5. **Disclosure.** The ghostwriter disclosure footer is inviolable. The
   humanizer never strips or rewords it, even though it is structurally a
   "communication artifact" the pattern list would otherwise flag. Hard stop in
   academic and legal contexts where AI-authorship disclosure is required.
6. **No voice injection.** Cut from v1. Precedence is fixed: profile
   fingerprint > registered brand voice > humanizer defaults.

### What is rejected, and stays rejected until the trigger above fires

A zero-dash target. A CI gate over `docs/`, `agents/` or `src/`. A blanket
adverb ban. A blanket passive ban. Any third-party "AI detector" outcome as a
claim — unfalsifiable from this side, and banned as a claim class.

**Rejected is not forbidden forever.** The `review_trigger` above names what
would reopen each one. What it does not accept is a restatement: a proposal
that re-argues these rules without a measurement is the same proposal, and the
2026-07-11 disposition holds against it.

## Consequences

Load-bearing, and stated as costs rather than as benefits.

- The detector stays scoped to generated deliverable prose. Repo documentation
  keeps em dashes and bold inline headers as house style, and no gate in this
  repository may read that as slop.
- The density cap is a **default with a known precision cost**, not a validated
  claim about human prose. Measured 2026-09-07 over a 32-file clean corpus:
  four files carrying a single em dash in 78–125 words are rejected, because at
  2 per 500 words no document under about 250 words can carry one dash and
  pass. That figure is published in
  `internal/bench/reports/prose-tells-fp-v1.md` and is the first evidence
  anyone has had on this axis; the 2026-07-11 session had none.
- Fingerprint precedence means the cap is suppressible per pass. A voice that
  genuinely uses dashes is not a defect and the detector must not treat it as
  one.

## Alternatives considered

**Leave the verdicts where they are.** Rejected: two independent sessions have
already paid for the absence, and an archived roadmap is not a surface an
inbound proposal reads.

**Restate the verdicts in the skill body.** Rejected: `humanizer/SKILL.md` is a
procedure, and a procedure that also carries governance is a procedure people
edit without noticing they are editing governance.

**Reopen the em-dash question while writing this record.** Rejected as out of
scope by construction. This ADR records a decision; changing it is a separate
act with its own evidence bar, and the `review_trigger` says what that bar is.

## Evidence

- `agents/roadmaps/archive/road-to-humanized-writing.md` § Council notes
  (2026-07-11) — the primary record of all six verdicts, quoted above in
  substance rather than reinterpreted.
- `src/scripts/ai_tells_rules.ts` — the severity model and the dash-density
  constant carrying the Q3 verdict in code, with the council date in the
  module docstring.
- `src/scripts/detect_ai_tells.ts` — the `SCOPE:` docstring carrying the Q4
  re-scoping ("NEVER wire this as a CI gate over `docs/`, `agents/`, or
  `src/**`").
- `internal/bench/reports/prose-tells-fp-v1.md` — the 2026-09-07 clean-corpus
  measurement, the only evidence in the tree about this detector's precision,
  and the source of the four-file residual named under Consequences.

Strength `E3`: the verdicts are quoted from a contemporaneous written record
and the consequences are reproduced from a committed measurement, but the
council session's own transcript is not in the tree, and the precision figure
comes from a corpus this repository authored rather than an independent one.
