---
model_tier: high
name: overbuild-review-lens
description: "Use when a diff builds more than the task needs — code that should not exist, a dependency the platform already covers, or a clever form where a flat one reads better. Deletion-hunting, not quality."
personas:
  - senior-engineer
domain: quality
workspaces:
  - engineering
packs:
  - engineering-base
---

# overbuild-review-lens

> A deletion-hunting lens. It asks one question the other judges never
> ask: **should this code exist at all?** Sibling of
> [`architecture-review-lens`](../architecture-review-lens/SKILL.md) and
> the `judge-*` family — never overlaps with them.

## When to use

- A diff adds a helper, a wrapper, a config layer, an abstraction, or a
  dependency.
- A rewrite, v2, or large refactor landed — the peak over-build context
  (see [`minimal-safe-diff-mechanics`](../../../docs/guidelines/agent-infra/minimal-safe-diff-mechanics.md)
  § The sanctioned-rewrite trap).
- A reviewer asks "is all of this needed?", "could the platform do
  this?", or "why is this so clever?".

Do NOT use when:

- The concern is whether the code is **correct** — route to
  [`judge-bug-hunter`](../judge-bug-hunter/SKILL.md).
- The concern is **security** — route to
  [`judge-security-auditor`](../judge-security-auditor/SKILL.md).
- The concern is **naming, single-responsibility, or convention fit** of
  code whose existence is not in question — route to
  [`judge-code-quality`](../judge-code-quality/SKILL.md). That judge asks
  *is this code malformed*; this lens asks *should it exist*.
- The concern is **performance** — route to
  [`performance`](../performance/SKILL.md). Speed is out of scope here.
- The diff is documentation-only or formatting-only.

## The scope fence — read this before the first finding

```
CORRECTNESS, SECURITY AND PERFORMANCE ARE OUT OF SCOPE FOR THIS LENS.
THE MINIMUM RUNNABLE CHECK IS NEVER FLAGGED FOR DELETION.
A SIZE REDUCTION THAT DROPS A GUARD IS A LOSS, NOT A FINDING.
```

The measured failure mode this fence exists for: a bare "make it
simpler" critic was the only arm in a controlled comparison that dropped
a safety guard — the three lines it saved were a path-traversal check.
Tests, validation, authorization checks, tenant scoping, and error paths
that can actually occur are **not** over-build. If removing something
would reduce coverage of a real case, it is not a finding here.

## Procedure

### 1. Establish what the task actually asked for

Read the ticket / prompt, not just the diff. Over-build is measured
against the **requirement**, not against your taste. Anything the diff
adds beyond the requirement is a candidate; anything the requirement
demands is not, however large.

### 2. Walk each addition down the solution-size ladder

For every new unit (function, class, module, config key, dependency),
find the highest rung that would have carried it — see
[`agent-interaction-and-decision-quality`](../../../docs/guidelines/agent-infra/agent-interaction-and-decision-quality.md)
§ 8b-ladder:

| Tag | Meaning | The evidence that makes it a finding |
|---|---|---|
| `delete:` | This should not exist at all | A fence line (see § 3) — mandatory |
| `stdlib:` | The language stdlib or framework already does it | Name the exact API and show it is equivalent |
| `native:` | The OS / runtime / browser / database already does it | Name the platform capability and its availability floor |
| `yagni:` | Built for a requirement nobody stated | Quote the requirement it exceeds |
| `shrink:` | Must exist, but smaller | Name the lines that carry no requirement |
| `flatten:` | Must exist, but in a **simpler form** | Name the cognitive cost, not the line count |

`flatten:` is the shape-axis inverse of `shrink:` — same logic, simpler
form, **even when that costs a line or two**. Without it the lens only
ever argues downward and becomes a golfing engine. A nested ternary
replaced by an `if` block is a valid `flatten:` finding even though the
diff grows.

### 3. Every `delete:` carries a fence line — no exceptions

Chesterton's Fence, operationalised. Agents are documented as
especially fence-blind: complex code reads as an invitation to simplify
when the complexity may exist for a reason the reader has no context
for. This does not restate
[`minimal-safe-diff`](../../../src/rules/minimal-safe-diff.md)'s "never
delete code that *looks* dead without proof" — it is the output contract
that makes the proof visible.

The fence line has three fields, all required:

```
Fence: why=<why the code existed — blame, test, issue, or "unknown">
       safe=<the evidence that removal is safe>
       covered=<yes|no|partial — was the removed path under test?>
```

- `why=unknown` is a legal value and it is **not** a pass. It downgrades
  the finding to a question for the author, never an instruction.
- `covered=` is the one machine-checkable input to an otherwise
  archaeological judgement (the Beyoncé rule: if you liked it, you put a
  test on it). Deleting *tested* behaviour trips a test and is visible;
  deleting *untested* behaviour breaks silently — so `covered=no` is
  surfaced as **higher** risk, not as equivalent.

### 4. Emit the null when there is nothing to cut

```
A LENS THAT CANNOT SAY "NOTHING TO CUT" IS A FINDING GENERATOR.
```

A lean diff must produce the honest null, not an invented finding. This
is the load-bearing output, not a fallback: a reviewer who sees findings
on every diff stops reading them.

### 5. Validate before emitting

- Every finding has a `file:line` and exactly one tag from § 2.
- Every `delete:` has all three fence fields.
- No finding restates a correctness, security, or performance concern.
- The net-lines summary counts `flatten:` findings honestly, including
  the ones that **add** lines.
- Zero findings → emit the null block, not an empty issues list.

## Output format

The verdict block carries these ordered fields:

1. `Lens:` — fixed value `overbuild-review-lens`
2. `Target:` — the diff range or file set reviewed
3. `Verdict:` — exactly one of `lean` / `trim` / `overbuilt`
4. `Findings:` — one line per finding: tag, `file:line`, one sentence;
   `delete:` findings carry their `Fence:` line directly beneath
5. `Net:` — lines removable if every finding is applied, stated as a
   signed number so a line-adding `flatten:` is visible

```
Lens:    overbuild-review-lens
Target:  <branch / diff range>

Verdict: lean | trim | overbuilt

Findings:
1. stdlib:  src/util/uuid.ts:1     Hand-rolled v4 generator; crypto.randomUUID covers it.
2. delete:  src/config/flags.ts:12 Flag read by nothing since the feature shipped.
   Fence: why=guarded the 2026-03 rollout  safe=zero readers, grep clean  covered=no
3. flatten: src/parser.ts:88       Nested ternary; an if/else reads flat (+2 lines).

Net: -34 lines
```

The null, when there is nothing to cut — emit verbatim, do not
paraphrase:

```
Lens:    overbuild-review-lens
Target:  <branch / diff range>

Verdict: lean

Findings: none — nothing in this diff exceeds the stated requirement.

Net: 0 lines
```

## Gotcha

- **The requirement is the yardstick, not your preference.** A large
  diff that the ticket demanded is not over-built. Say so and emit the
  null.
- **`covered=no` makes a deletion riskier, not more attractive.** The
  absence of a test is the absence of a tripwire.
- **A `flatten:` finding that saves lines is suspicious.** If it is
  shorter *and* simpler it is probably a `shrink:`; `flatten:` exists
  for the cases where simplicity costs length.
- **Never flag the minimum runnable check.** One happy-path test is not
  over-build; it is the floor.
- **Do not count `delete:` lines that git already removed.** The net
  figure is about the diff as proposed, not the diff's own deletions.

## Do NOT

- Do NOT emit a `delete:` finding without all three fence fields — the
  output contract rejects it.
- Do NOT invent a finding to avoid an empty report.
- Do NOT review correctness, security, or performance — other surfaces
  own those, and a size argument against a guard is the canonical
  failure this lens is fenced against.
- Do NOT report a size number as a score. A size metric is a
  measurement, never a target.
