---
adr: 254
status: accepted
date: 2026-09-04
decision: git-authorization-enforcement-removed
supersedes: ADR-252
superseded_by: —
phase: —
type: structural
reopen_policy: owner
protected_dimensions: security_floor
provenance:
  kind: human
  decision_makers: [owner]
  human_directed: true
evidence:
  strength: E2
  basis:
    - src/scripts/hooks/git_command_classifier.ts
    - src/scripts/git_authorization_hook.ts
    - src/scripts/hook_manifest.yaml
    - docs/decisions/ADR-252-specificity-replaces-recency-for-merge.md
    - docs/decisions/ADR-251-authorization-window-shape-not-width.md
authority_basis: owner_intent
review_trigger: >-
  Reopen when an irreversible operation — a prod-trunk merge, a tag push, a
  GitHub release, an npm publish — is observed executing against the owner's
  stated intent, since that is the failure the removed gate existed to catch
  and its absence is now the only thing between the intent and the operation.
  Reopen also when the conformance scan's unauthorized-operation count rises
  over a measured baseline rather than staying flat. Explicitly NOT a trigger:
  a wish to re-add the gate in its old shape. The shape is what failed; a
  replacement must classify intent into typed transitions rather than test a
  prompt against a regex.
---

# ADR-254 — The git-authorization gate is removed; enforcement returns to the model

## Status

**Accepted** · 2026-09-04. Supersedes
[ADR-252](ADR-252-specificity-replaces-recency-for-merge.md), and with it the
line of records ADR-252 itself superseded
([ADR-251](ADR-251-authorization-window-shape-not-width.md)) and the merge-authority
question left open in
[ADR-239](ADR-239-drain-command-surface-and-merge-authority.md) § Decision 3.

Decided by the **owner**, directly. Both prior records carry
`reopen_policy: owner` and `protected_dimensions: security_floor`, so this is
the reserved path being used rather than bypassed. No council seat resolved it,
and none was required to.

## Context

ADR-251 and ADR-252 answered the same pressure twice: an authorization the user
had given did not survive long enough to finish the work it authorized. ADR-251
kept the 30-minute window and changed the behaviour at expiry. ADR-252 kept the
window too and added target-bound grants — an authorization naming PR numbers
minted a grant over those numbers, spent per target, carrying no clock.

The grant mechanism worked, in the narrow sense that its own tests passed. What
it did not do is fire for the prompts it existed to serve. Measured 2026-09-04
against the shipped code, using the owner's real authorization for a PR-drain
run:

| Sentence in the authorization | Meant as | `isRevocation` |
|---|---|---|
| `Never merge empty PRs to raise the count.` | a guardrail | **true** |
| `Never force-merge past failing required checks` | a different verb | **true** |
| `Rote required checks sind ein Halt, kein Bypass.` | the noun "Halt" | **true** |
| `Warte auf CI, dann merge #12.` | sequencing | **true** |
| `Es gibt keinen Grund, PR #12 nicht zu mergen.` | double negation | **true** |
| `No reviewer objected; merge #12.` | negation on an unrelated word | **true** |

`isRevocation` returning true makes `foldGrants` return `[]` before the clock is
consulted at all. So a careful authorization — and a careful authorization is
exactly the kind that states what must *not* be merged — revoked itself. The
mechanism was unreachable in practice, and the owner's reading of that was that
the mechanism did not exist.

Two structural causes, both in the file's own terms:

1. **Both branches of `isRevocation` were prompt-wide, context-free regexes.**
   The sibling function `negatedBefore`, in the same file, is sentence-scoped
   with a 30-character window and contrast cues, and its docstring calls that
   bound load-bearing. `isRevocation` never received the same treatment.
2. **The gate read prose, never a typed intent.** An answer given as an option
   number — `1` to a numbered-options block the gate's own refusal had asked
   for — carried no authorizing word, so the next attempt refused identically.
   Consent was real and on the record three turns running, and the gate could
   not see it.

The docstring justified the over-inclusiveness with "a false revocation costs
one prompt, a missed revocation costs an unwanted merge". The measurement
falsifies the first half: a false revocation cost the entire mechanism,
silently, and the twice-recorded response to that cost was to hand-widen
`LEDGER_MAX_AGE_MS` (2026-08-21, 2026-08-30) — the very move both prior records
forbade.

## Decision

**The `block-unauthorized-git` concern is removed. Nothing in this package
enforces git authorization.**

Concretely:

- The concern is deleted from `hook_manifest.yaml` — its definition and its
  three `pre_tool_use` bindings.
- `src/scripts/hooks/block_unauthorized_git.ts` is renamed to
  `src/scripts/hooks/git_command_classifier.ts`, and its enforcing half —
  `decide`, `run`, `main`, `grantCovers`, `LEDGER_MAX_AGE_MS` — is deleted. The
  command parser and the operation vocabulary survive, because two callers need
  them and neither gates git: `block_no_verify` uses `substitutionPayloads` so
  `git $(echo --no-verify)` cannot slip past the hook-bypass guard, and
  `conformance_scan` uses `commandOp` / `BLOCK_OPS` to **measure** unauthorized
  operations after the fact.
- The `git-authorization` ledger concern **stays**, advisory as it always was.
  It writes state and blocks nothing. `evidence_independence` reads its
  `detected_at` as a per-turn stamp, and removing it would silently degrade a
  guard that has nothing to do with this decision.

What replaces the gate is what preceded it: `non-destructive-by-default`, held
by the model. The Hard Floor is unchanged as a rule. It is simply no longer
mechanical for git operations.

## Consequences

**Accepted, and named rather than softened.** The failure the gate was built
after — a full release chain (prod-trunk merge, tag push, GitHub release, npm
publish) executing on a turn with no authorization, measured in the 30-session
conformance audit of 2026-08-06 — is now unguarded again. If it recurs, nothing
stops it. That is the cost of this decision and it is the owner's to carry.

**What still observes it.** `conformance_scan`'s `git-authorization` check is
untouched and keeps counting irreversible operations that ran on unauthorized
turns. Measurement without enforcement is a weaker control than enforcement,
and it is not nothing: the review trigger above is written against that count.

**What is unaffected.** `block_no_verify` (hook-bypass), `evidence_independence`
(evaluator steering), `block_kernel_rule_writes`, `block_config_weakening`,
`block_speaking_inbox_dir` all keep their severities. Only git authorization
changed.

**Not a licence to re-add the same shape.** A future gate may not be the old one
with a longer regex. The measured defect is that a Boolean verdict over free
prose cannot represent target subtraction, method restriction, policy
requirement, or ambiguity — a single-seat council pass on 2026-09-04 (openai;
the anthropic seat's CLI quota was exhausted, so this was **degraded and not
convergence**) argued for typed transitions with fail-closed ambiguity and
enforcement deployed before classification. That pass informed nothing about
*whether* to remove the gate — the owner decided that — and it is cited only as
the standing objection to rebuilding the removed shape.

## Evidence

| Claim | Basis |
|---|---|
| Six sentence shapes in a real authorization make `isRevocation` return true | Direct probe of the shipped `isRevocation` over the owner's actual PR-drain authorization plus five isolated variants, 2026-09-04: `Never merge empty PRs to raise the count.`, `Never force-merge past failing required checks`, `Rote required checks sind ein Halt, kein Bypass.`, `Warte auf CI, dann merge #12.`, `Es gibt keinen Grund, PR #12 nicht zu mergen.`, `No reviewer objected; merge #12.` — all `true` |
| A revocation verdict empties the grant set before the clock is read | `foldGrants` at the pre-change base returns `[]` on its first statement when `isRevocation(prompt)` holds. `LEDGER_MAX_AGE_MS` is never consulted on that path |
| The authorization did otherwise mint | Same probe: `classifyAuthorization` returned `pr-merge` and `extractMergeTargets` returned the named PR numbers on the identical prompt. Both were discarded by rule 1 |
| A trip-word-free authorization still mints a clockless grant | Same probe with the guardrail sentences removed: `grants minted: [[1841,1843,1844,1846,1848,1849,1851,1852]]`, `isRevocation: false`. The mechanism was reachable only by a sentence the owner would not naturally write |
| An option number carries no authorizing token | `isAffirmative` accepts `1`, and `classifyAuthorization` records no operation for it. Pinned from the other side by the deleted `confirming a refused operation` fixture, whose own comment described the resulting three-turn deadlock as measured on 2026-08-18 |
| Both branches of `isRevocation` were prompt-wide | `REVOKE_RE` at the pre-change base: one alternation of bare stop words and one negation-within-30-characters clause, tested against the whole prompt with no sentence bound. The sibling `negatedBefore` in the same file is sentence-scoped, and its docstring states the bound is load-bearing |
| The clock had been hand-widened twice under this pressure | ADR-251 § Context and ADR-252's commit body, both carried forward unchanged (2026-08-21, 2026-08-30) |
| The removal leaves the two neighbouring guards intact | `block_no_verify` imports only `substitutionPayloads`; `evidence_independence` reads only `detected_at`; `conformance_scan` imports `commandOp` and `BLOCK_OPS`. All four symbols survive in `git_command_classifier.ts`, and the three files' test suites are green after the change |
| Nothing enforcing survives in the executing artifact | `dist/hooks/dispatch.js` rebuilt after the change contains zero occurrences of `block_unauthorized_git`, `LEDGER_MAX_AGE_MS` or `grantCovers`; `hook_manifest.json` contains zero occurrences of the concern |

**The grade is E2 — repeated and comparative.** Every row is a probe run in this
tree against the shipped code, a file read at a named symbol, or a measurement
carried forward from the superseded record. The `isRevocation` probe was run
against both the owner's real prompt and isolated single-sentence variants, so
the rows name which clause fires rather than only that one did.

**What no evidence establishes**, and it is the load-bearing gap: **that removal
is safer than the gate.** Nothing here measures unintended merges the gate
prevented, because — as ADR-251 already recorded — the window has no instance of
preventing one on record either. The honest claim is narrower: the gate was
measured refusing authorizations that were given, and it was never measured
refusing one that was not.

## Alternatives considered

**Narrow `isRevocation` — compound-verb guard, qualified-object guard,
sentence-scoping.** Rejected by the owner. Every variant makes the guard fire
less, and the failure mode of a bad narrowing is an unwanted irreversible merge.
It also leaves the option-number defect untouched, since that failure is in the
authorizing path rather than the revoking one.

**Typed verdicts now** (`REVOKE_ALL` / `DENY_TARGETS` / `DENY_METHODS` /
`REQUIRE_POLICY` / `AMBIGUOUS`). Not rejected on merit — rejected as a
precondition. It is a multi-PR architecture touching classification, the
ledger schema, every ledger reader, and the executor, and the owner declined to
be blocked behind it.

**Keep the gate and phrase authorizations around it.** Verified to work: a
trip-word-free sentence naming PR numbers mints a grant with no clock. Rejected
because it makes the human the guard's parser, which is the defect rather than a
workaround for it.

## References

- [ADR-252](ADR-252-specificity-replaces-recency-for-merge.md) — superseded here.
- [ADR-251](ADR-251-authorization-window-shape-not-width.md) — superseded by 252, listed because its decision (the window's width does not move) dies with the constant.
- [ADR-239](ADR-239-drain-command-surface-and-merge-authority.md) § Decision 3 — the merge-authority question this closes.
- `src/scripts/hooks/git_command_classifier.ts` — what survives, and why.
- `src/rules/non-destructive-by-default.md` — the rule that is now the only carrier.
