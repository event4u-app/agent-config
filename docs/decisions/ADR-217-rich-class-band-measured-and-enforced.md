---
adr: 217
status: accepted
date: 2026-08-06
decision: rich-class-band-measured-and-enforced
supersedes: —
superseded_by: —
phase: road-to-skill-ecosystem-authoring-discipline — blocker rich-class-band-question
type: structural
review_trigger: >-
  Reopen when a rich-class artifact is legitimately blocked by the 3,500-token
  ceiling — that is, when its `## Why this skill is rich` section survives
  review AND the content cannot be split by responsibility. One blocked
  artifact is a data point; two is the signal the ceiling is set wrong. Also
  reopen if a published measurement moves the diminishing-returns threshold, or
  if the character proxy is ever observed misclassifying an artifact across a
  band boundary — the per-artifact margin check in the linter exists to detect
  exactly that, so its first firing is a reopening condition.
---

# ADR-217 — The rich-class band is measured against real tokenisation, lowered to what the corpus uses, and enforced

## Status

**Accepted.** Resolves the `rich-class-band-question` blocker on
`road-to-skill-ecosystem-authoring-discipline`. AI council consulted
(`claude-sonnet-4-5` + `gpt-4o`, 2026-08-06); where they split, the split and
the reason for the call are recorded below.

## Context

### The claim that opened this

A published study (84 tasks, 7,308 trajectories) tiers instruction-file size by
measured effect: compact and mid-size bands both help substantially; above
roughly **2,500 tokens** returns diminish; above roughly **5,000 tokens**
performance measurably degrades.

This suite declares a `rich` token-budget class banded at **2,000–5,000
tokens**, exempt from condensation and never trimmed. The sweep record's § R1
noted that band spans the diminishing-returns zone, that the suite's budget
estimates use character division rather than real tokenisation, and set the
disposition: *measure real tokenisation first, then put the band question to the
maintainer with the numbers.* That is what this record does.

### The measurement — done before deciding, not asserted

The exact-BPE instrument already existed in-tree and nobody had pointed it at
this question: `src/scripts/_lib/token_count.ts`, `js-tiktoken` `cl100k_base`, a
**declared** dependency with a graceful `TIKTOKEN_AVAILABLE` fallback. Measured
2026-08-06 over every artifact declaring `token_budget_class: rich` — there are
exactly four:

| Skill | exact BPE | chars/4 proxy | proxy error | published band |
|---|---|---|---|---|
| `design-system-capture` | **3,331** | 3,518 | −187 (−5.3 %) | diminishing (> 2,500) |
| `typography-system` | **2,807** | 2,764 | +43 (+1.6 %) | diminishing (> 2,500) |
| `design-intelligence` | **2,613** | 2,688 | −75 (−2.8 %) | diminishing (> 2,500) |
| `accessibility-auditor` | **1,931** | 1,878 | +53 (+2.8 %) | below the band entirely |

Totals: 10,682 exact vs 10,848 proxy — **1.5 % aggregate error, 5.3 % worst
case.**

Three facts follow, and they are what actually decided this:

1. **Nothing is in the degradation zone.** The largest rich artifact is 3,331
   tokens. The declared 5,000 ceiling describes no artifact that exists; it is
   unused headroom.
2. **The character proxy was not materially misleading.** The concern that
   estimates use character division is real in principle and worth 1.5 % here.
3. **The band was never enforced.** `lint_token_budget_discipline.ts` checks the
   15 % count cap and the presence of the `## Why this skill is rich` section.
   It has never checked a size. The 2,000–5,000 band was documentation, not a
   gate — which is why nothing ever noticed that no artifact used its top half.

## Decision

1. **The declared ceiling drops from 5,000 to 3,500 tokens.** The floor stays
   at 2,000 as documentation of the intended band.
2. **The ceiling becomes enforced**, in `lint_token_budget_discipline.ts`,
   alongside the checks it already runs. **The floor does not.** That is a
   finding, not an omission — see below.
3. **Measurement is exact where the tokenizer resolves and proxy where it does
   not**, and the gate states which one it used. It does not become a hard
   dependency: `token_count.ts` already degrades and flags `exact: false`.
4. **A per-artifact margin check ships with it.** For any artifact measured by
   proxy, the gate reports the distance to the nearest band boundary; a
   proxy-measured artifact within its own error margin of a boundary is reported
   as unresolved rather than silently classified.
5. **The three artifacts in the diminishing-returns band stay.** Their
   `## Why this skill is rich` sections stand; this record does not order a split.

### The floor is documented and not gated — what running the check taught

This record initially gated both ends. The first run of the ceiling-and-floor
gate over the real corpus produced exactly one finding: `accessibility-auditor`
at **1,931 tokens**, under the 2,000 floor while legitimately holding the class.

That is not a mislabelled artifact. `rich` buys exemption from condensation, and
that is a claim about what compression would **lose** — for a skill whose body is
WCAG criteria with per-criterion test procedures, the rule's own justification
table says compression loses the procedures. A floor gate would have forced it
out of the exemption on a threshold with no measurement behind it: the published
study supplies a **degradation threshold**, which is a ceiling. Nothing in it
measures a minimum.

So the floor stays as the band's documented intent and the gate enforces only the
ceiling. Recorded here rather than quietly dropped, because the alternative
reading — that the gate was weakened to make a finding go away — is exactly the
failure this tree has a rule against, and the distinction is the evidence: the
ceiling has a measurement behind it and the floor never did.

## Consequences

**A number that described nothing now describes the corpus.** 3,500 leaves 5 %
headroom over the largest real artifact — enough that the next honest edit does
not red the build, tight enough that a doubling does.

**The failure mode this closes is the unused-permission one.** An unenforced
5,000 invites growth into a band the research calls degrading, and nothing would
have reported it. The first artifact to cross 3,500 now has to argue for it in
review rather than discover the ceiling was theoretical.

**The count cap and the size cap are one control with two factors, not two
controls.** 15 % of 288 skills × 3,500 tokens bounds the total rich-class budget
at ~151k tokens. Neither factor alone bounds it.

**Cost:** one more thing the linter can red on. The margin check is the mitigation
for the only false-positive shape available — a proxy measurement near a
boundary.

## Alternatives

**Keep 5,000, unenforced (one council member's call).** Argument: aligning to the
published degradation threshold preserves flexibility for a future artifact that
genuinely needs the room. Rejected because it confuses a *threshold* with a
*budget*: the research says performance degrades above 5,000, which is a reason
not to allow 5,000, not a reason to permit up to it. An unused permission costs
nothing until someone uses it, and the whole point of a band is to be consulted
before that happens.

**Switch the whole budget rule to exact tokenisation (rejected by both members).**
The proxy has not failed its job — no artifact was misclassified, and the
aggregate error is 1.5 %. Making exact counting mandatory would add a hard
dependency at lint time for precision the decision has never needed. Adopted
instead in the weaker form above: exact where available, flagged, with a margin
check for the proxy path.

**Split the three diminishing-band artifacts.** Deferred, not refused. One member
raised trigger-routing — a compact trigger plus a conditionally-loaded payload —
as a shape the published research does not cover, because it never tested
conditional loading. This suite already has the routing infrastructure. That is a
real question and it is not this record's: nothing measured says a 2,613-token
skill read in full performs worse than a 400-token trigger plus a 2,213-token
payload read on demand.

**Replace the count cap with a size cap.** Rejected. They bound different things;
the count cap stops proliferation, the size cap stops individual growth, and the
measured risk in the study is per-artifact size while the measured risk in this
tree's own history is accretion.

## References

- `agents/settings/contexts/skill-ecosystem-sweep-2026-08.md` § R1 — the
  contradiction and the measure-first disposition this record discharges.
- `src/rules/token-budget-discipline.md` — the rule carrying the band.
- `src/scripts/lint_token_budget_discipline.ts` — the gate that now enforces it.
- `src/scripts/_lib/token_count.ts` — the exact/proxy instrument and its
  `TIKTOKEN_AVAILABLE` fallback.
