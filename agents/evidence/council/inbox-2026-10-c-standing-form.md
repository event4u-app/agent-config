# Council decision — what a thinned rule carries on the installed Claude layer

<!-- evidence-type: analysis -->

Session 2026-10-01. Members: `anthropic/claude-sonnet-4-5`, `openai/codex-default`.
Quorum **2/2**, one round, `--prompt-mode design`. Spend `$0.00` billed (both
seats on subscription transport). Question artefact:
`agents/runtime/council/questions/inbox-2026-10-c-standing-form.md` (local
runtime, not tracked; reproduced in substance below).

## The question

Round `inbox-2026-10-c` arrived with two incompatible delivery designs for the
moment the installed `~/.claude/rules` layer is thinned:

- **P-1** — pointer stubs, the Iron-Law section standing in the stub for 14
  safety rules (64,733 chars on the default scope); runtime delivers the first
  matched body in full when it fits under the 10,000-char host cap and every
  other match as its Iron-Law section plus a path; law-section ceiling 2,000.
- **P-2** — every thinned stub carries a compiled standing contract
  (MUST / MUST-NOT plus a minimum fallback action), ≤1,200 chars each; runtime
  delivers bounded mechanics ≤8,000 chars; a pointer never counts as arrived;
  75,000 hard standing ceiling.

Measured inputs given to both seats: keyword-only reach 305/335; 71 of 106
routed rules carry an Iron-Law section (median 511, p90 1,787, max 5,392); P-1's
runtime form peaks at 8,873 chars over 323 firing prompts; non-rule text on the
slot reaches 1,272 chars.

## Adopted

| # | Question | Both seats | Adopted |
|---|---|---|---|
| 1 | Standing form | Reject both as specified. A consequence-tiered hybrid: stubs for all, standing law for a high-consequence class, pointer-only for the rest at first. "14 safety rules" is ungoverned — the class needs a falsifiable criterion. | Stubs for every routed rule; the rule's own Iron-Law section stands in the stub for a class selected by a declared, falsifiable consequence criterion (irreversible external action, security or data-exposure, authority bypass). No compiled contract is authoritative: the standing text is copied from the source section, never summarized. |
| 2 | Runtime form and budget | 8,000-char hard budget on the whole rule-produced string, framing included. Order: matched high-consequence laws, then the highest-priority full body that fits, then further bodies, then laws of the rest, then a manifest. A path alone is never "delivered". | Adopted as stated. The manifest labels each match `full`, `law`, `omitted_budget`, `source_unavailable`. |
| 3 | Ceilings | Contract target 1,200, hard 2,000 (reviewed, expiring exception above it); standing target ~65,000, hard 75,000 with ≥10 % headroom; a separate warning on the combined package-plus-user total. | Adopted. |
| 4 | Before irreversible | Both reject a default flip without measurement. Ship tooling with no default change, then an opt-in mode with a one-setting rollback, then the flip only after declared gates pass; keep a full-rule install mode. | Adopted as the sequence. |

## Divergence and what was not adopted

- **Behavioural compliance as a flip gate.** Both seats ask for compliance
  measured against full rules (anthropic: >98 % standing-only compliance over
  100+ sessions). Not adopted as stated: ADR-202 closed the behavioural judge as
  an instrument this repository cannot produce. Adopted instead: a
  deterministic standing-only fixture (carrier disabled, the law text present in
  the installed file) plus the arrival record from the instruction-load
  observer. Recorded as a dissent, not dropped.
- **Session counts (100+ / 50+).** Not adopted as numbers; the opt-in cohort is
  the maintainer machines this repository can observe, and the gate is stated in
  records, not in a population size.
- **Tier list.** anthropic proposed an eight-rule destructive tier plus ~30
  manually curated contracts. Folded into the criterion of row 1; the list is
  produced by the criterion, not chosen.

## Revisit if

A rule in the high-consequence class has a law section that cannot carry its
obligation under 2,000 chars, or the observer shows a standing law that the host
did not load.
