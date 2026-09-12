---
proposed_by: claude-opus-5/drain-session-2026-09-12
implemented_by: claude-opus-5/drain-session-2026-09-12
reviewed_by: council/anthropic+openai-2026-09-12-r2
providers:
  - anthropic
  - openai
verdict: confirmed-non-expanding
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — the kernel-write guard's docstring stops claiming a coverage its parser never had

One gated surface in this diff: `src/scripts/hooks/block_kernel_rule_writes.ts`, a
governance hook. The change is comment-only.

## What was proposed

The docstring asserted **"No agent-accessible override: the sole legitimate bypass is the
human-owned exception registry the deny message points to."** That sentence is false about
the mechanism as shipped. The guard is a shell-argument parser; a write that never puts the
kernel-rule path into a parsed argument is not seen by it. The proposal was to replace the
false assurance with an accurate statement of coverage.

## Why `confirmed-non-expanding` and not `ratified`

The executable surface is untouched. Filtering this file's diff to non-comment lines
returns zero lines; `check_envelope`, the exported pure functions, the manifest declaration
(`fail_closed: true`, `severity`) and the set of tool calls the guard blocks are all
identical before and after. `npx vitest run tests/scripts/hooks/block_kernel_rule_writes.test.ts`
passes 18/18 with no test added, removed, or modified.

Recording this as `ratified` would be a false label: nothing was approved that an agent
could not do the day before. The vocabulary exists precisely so a correction to a governance
hook is not written into the record as an authority expansion.

## What the reviewer checked, and the round that did not converge

This took two rounds, and the first one is recorded because it changed the artefact.

**Round 1 refused to converge — `confirmed-non-expanding` against `refused`.** The draft
under review stated the coverage limitation by *enumerating four concrete bypass families*.
The refusing seat's objection was not that the correction was wrong but that the
enumeration "converts a general limitation into immediately actionable circumvention
guidance" inside a file the guarded agents can read — a governance-risk increase that is
avoidable when an equally honest, less operational wording exists. Its argument turned on
discovery cost rather than on executable permission, and it explicitly conceded the change
was not an executable authority expansion while still refusing it.

Both seats then proposed non-enumerative wording independently, and the seat that had voted
`confirmed-non-expanding` called that wording the better outcome rather than defending its
own draft. The draft was rewritten to that shape and resubmitted. This is not verdict
shopping: round 1's convergent instruction was to change the artefact, and the artefact
changed.

**Round 2 converged 2/2 on `confirmed-non-expanding`** over the rewritten text. The
discriminator both seats applied, in their own words: a *boundary statement* ("this parser
cannot detect all write shapes") is acceptable where *circumvention guidance* ("bypass this
using X, Y, Z") is not, and the rewritten text is the former. The refusing seat from round 1
stated what would have changed its round-2 verdict — "concrete evasion examples, procedural
hints, commands, exploitable implementation details, a newly sanctioned bypass, or any
behavior/policy change that allowed previously blocked operations" — and found none.

Checked across both rounds: the complete diff; the zero-non-comment-line claim; the
unchanged parser, exports, manifest policy, tests and blocked-call set; whether the prose
contains an actionable bypass procedure; and whether a comment-level change to a governance
hook can be an authority expansion in principle. Round 1 was genuinely divided on that last
question and round 2 was not.

## A round-1 factual error, corrected rather than carried

One seat argued in round 1 that the *previous* docstring already described the mechanism as
an "argument parser" and therefore already signalled its limitation. The other seat checked
and found the phrase appears only in the **added** text. The correction was carried into
round 2 so the second round did not inherit it. The prior docstring's entire statement on
the subject is quoted in full above; it contains no such signal.

## What the seats asked for beyond the verdict, and what was done

Both seats offered the same refinement after converging: the dated review provenance and
the meta-rationale paragraph do not belong in an operational docstring, because review
history ages poorly there and the ratification record is where it lives. The seats split on
how far to go — one wanted the paragraph kept as a guard against a future editor
"simplifying" back to enumeration, the other wanted it moved out entirely and the
correction made timeless.

Applied: the dated provenance was moved into this artefact, the correction was rewritten
without quoting the old false sentence, and the clause recording that the boundary is
stated as an abstraction rather than an inventory was kept — which preserves the first
seat's concern without keeping the dated prose the second seat objected to. The final
docstring is the one this verdict covers.

## What would have changed the verdict

To `refused`: concrete evasion examples or procedural hints in the shipped text; any
executable, manifest, or test change; a newly sanctioned bypass; evidence that the change
was proposed in order to enable circumvention. To `ratified`: any change that made the
listed routes easier to reach, rather than merely described the boundary.

## Independence

The reviewer is the AI council, two distinct providers (anthropic, openai), quorum
concluded 2/2 in both rounds, meeting `required_providers: 2` in
`src/config/ratification-policy.json`. The review prompts stated no expected outcome in
either round and put the strongest argument **against** the change in front of the seats
explicitly — round 1 named the enumeration objection before any seat raised it, and round 2
asked whether the revised abstraction still functioned as guidance. One seat refused in
round 1, which is the observable evidence that the framing did not steer.

Per `docs/contracts/ratification-artifact.md` § Honest enforcement: this artefact records
who decided and on what basis. It is not proof that they decided, and the trust anchor is
the base revision plus the platform, never these strings.
