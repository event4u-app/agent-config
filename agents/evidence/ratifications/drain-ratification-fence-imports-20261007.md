---
proposed_by: claude-code drain lane, road-to-a-ratification-fence-that-follows-its-imports (2026-10-07)
implemented_by: claude-code drain lane, same session — see § Independence
reviewed_by: ai-council 2026-10-07 — anthropic/claude-sonnet-4-5 (cli) + openai/gpt-4o (api)
providers: [anthropic, openai]
verdict: ratified
effective_after: merge
---

<!-- evidence-type: ratification -->

# Ratification — `drain/road-to-a-ratification-fence-that-follows-its-imports-20261007`

Named for the branch, because the gate reads this file on the first push,
before a PR number exists. Slug carries `ratification-fence-imports` for the
roadmap's step 2.3 check.

## What was proposed

Steps 2.2, 3.1 and 3.2 of `road-to-a-ratification-fence-that-follows-its-imports`.
Gated surfaces in the diff:

| Surface | Change |
|---|---|
| `src/scripts/check_kernel_edit_ratified.ts` (self-watched) | plumbing set = hand regex ∪ verdict-class modules of `dispatch_hook.ts`'s import closure, read from both the reviewed tree and the gate's own tree, ∪ any non-concern module newly reachable from the dispatcher; `hook-bundle-budget.json` added to the regex; the closure reader added to the self-watched list |
| `src/scripts/_lib/dispatch_import_closure.ts` (now self-watched) | new: static relative-import walk, stops at the concern table, classes modules `verdict` / `payload` / `neither` / `concern` |
| `src/scripts/hooks/block_plumbing_writes.ts` (governance hook) | header comment only: points at the gate's derived set instead of restating a list |
| `src/config/hook-bundle-budget.json` (now plumbing) | `shrink_only_note` says the raise rule is enforced |
| `src/scripts/check_hook_bundle_composition.ts` | not gated; reviewed because it enforces the budget's raise rule against the base ref |

Closes release finding `21900086c1a0` (16.3.0): `_resolve_execution_failure`
had moved into `concern_failure_policy.ts`, outside the hand regex.

## Why `ratified`

The change only adds refusals — more paths need a record, a raise needs a
complete log entry, a missing base fails closed in CI. Nothing that needed a
record before stops needing one. One seat classed it
`confirmed-non-expanding` on its single-round pass and `ratified` on its
two-round pass; the other seat returned `ratified`. Both passing verdicts
clear the gate under identical validation; `ratified` is recorded because the
change alters the gate's own reach, which is the authority surface ADR-268 § 4
names, and because it is what the roadmap step asks for.

## Rounds

Five council invocations, all 2026-10-07, all on the governed-file diff
inline. Responses are runtime artefacts and are not cited by path.

1. **Round A (2 rounds, cli, $0).** anthropic answered both rounds; openai
   answered round 1 and failed round 2 with `os_error: ENOBUFS`. anthropic's
   round-2 verdict: **`refused`**, on three defects — (i) the name-based
   classifier misses a verdict module with neutral names
   (`acceptsExecution(): boolean`); (ii) a bare `{ "to": N }` `raise_log`
   entry satisfied the raise rule; (iii) an unresolvable base ref printed a
   notice and passed, in CI too. It also asked whether stripping a module's
   names could declassify it across the merge boundary.
2. **Fix commit `d13ae958f`.** (i) `closureArrivals`: any non-concern module
   present in the head closure and absent from the base closure is gated on
   the diff that makes it reachable, whatever its class; a base-`verdict`
   module stays watched through the base∪head union when the head strips its
   names. (ii) the matching entry must carry `from` = base ceiling, a
   `YYYY-MM-DD` date, and both reason fields. (iii) `GITHUB_ACTIONS=true` with
   no base ref exits 2. Each pinned by a test seen red with its mechanism
   neutralised.
3. **Round B (2 rounds, cli, $0)** on the revised head: anthropic
   **`ratified`**; openai `ENOBUFS` again.
4. **Rounds C and D (1 round, cli, $0):** anthropic
   **`confirmed-non-expanding`**, "no bypass visible"; openai `ENOBUFS` both
   times, including on a `-U1` compacted diff.
5. **Round E (1 round, metered api, $0.021 spent):** openai/gpt-4o
   **`ratified`**; anthropic's api seat refused for credit balance.

## What the reviewers said that is adopted, and what is not

- **Adopted:** all three round-A defects, fixed in `d13ae958f`.
- **Recorded as a residual, not fixed:** anthropic's round-B counter-argument —
  a module ALREADY in the base closure as `payload` / `neither` that gains
  verdict-influencing logic under a neutral name is not caught. Its own
  reading: the hand regex had the same gap, the diff does not weaken
  protection, and closing it needs data-flow analysis rather than a tweak.
  Stated in `_lib/dispatch_import_closure.ts`'s header (classifies by name)
  and in the closure page's § Limits.
- **Not adopted:** openai's suggestion of a "manual override system for
  developers to contest false positive classifications". A per-file override
  of a ratification fence is the thing the fence exists to refuse.

## Independence, stated rather than implied

`proposed_by` and `implemented_by` are the same agent session; `reviewed_by`
is the council, run by that session. The session wrote the prompts, which is
the evaluator-independence risk; they are recorded below so the steering can
be checked. The prompt states the change and asks for a verdict and defects;
it states no expected outcome. The revised prompt reports that an earlier
round refused, and on what, which the reviewer needed to judge the fixes.

**The openai seat's review is shallow.** gpt-4o did not engage the three
defects or the residual; its verdict rests on the change's direction. It is
recorded as the second provider because the policy requires two and it is
the only openai answer obtainable today — the codex CLI seat failed with
`ENOBUFS` four times. A reader weighing this record should weigh anthropic's
two-round review as the substantive one.

## The prompt

Rounds A–E used this text, followed by the `git diff origin/main...HEAD` of
the five files above (rounds C–E: `-U1`). Rounds B–E inserted the
"Revision since an earlier review round" section before the diff.

> # Ratification review — widening the kernel-edit ratification gate's watched set
>
> You are an independent reviewer for a ratification record (ADR-268 § 4 in
> the event4u/agent-config repository). An agent wrote the diff below; it may
> not ratify its own change. Your verdict is recorded verbatim.
>
> **Context.** `check_kernel_edit_ratified.ts` is a CI gate: any diff touching
> a kernel rule, a governance hook, a hook-plumbing source, or the gate itself
> must carry a ratification record with two providers. In CI the gate's code
> runs from the base revision with `--root <head>`. Its plumbing set was one
> hand-written regex. A refactor moved `_resolve_execution_failure` out of
> `dispatch_hook.ts` into `concern_failure_policy.ts`, which the regex did not
> name (release finding `21900086c1a0`).
>
> **The change.** (1) the closure reader and its classes; (2) the gate unions
> its regex with the verdict class from both trees, adds the bundle budget,
> self-watches the reader; (3) the write guard's header points at the derived
> set; (4) the composition gate enforces the raise rule against the base ref.
>
> **Questions.** 1. Does this diff expand or narrow any authority? Choose one
> verdict: `ratified`, `confirmed-non-expanding`, `refused`, or
> `non-convergent`. 2. Name any defect: a path that should be watched and is
> not, a way the derived set can be shrunk without a record, a false-positive
> explosion, a bypass of the raise rule, or a fail-open path. 3. What would
> change your verdict?

## What would have changed the verdict

A construction in which a `verdict` module of the base closure leaves the
watched set without a record, a raise of `max_bytes` that passes without a
complete entry, or a narrowing of the closure reader that is not itself
gated. anthropic tried all three on round C and found none.

## Spend

$0.021 metered (openai api, round E). Rounds A–D subscription CLI, $0.
