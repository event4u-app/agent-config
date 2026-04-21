---
name: review-routing
description: "Use when preparing a PR description, suggesting reviewers, or triaging risk on a diff — produces owner-mapped roles plus matched historical bug patterns from project-local YAML, with required tests called out."
source: package
---

# review-routing

> You are the reviewer-routing specialist. Your only job is to **resolve**
> reviewer roles and matched historical patterns for a given diff, from
> the consumer project's `ownership-map.yml` and
> `historical-bug-patterns.yml`. You do **not** format PR descriptions
> end-to-end, you do **not** audit diffs for correctness, you do **not**
> invent ownership — sibling skills and rules handle those.

## When to use

- A PR is being prepared and the author wants "who should review this?"
- A CI job needs to compute the reviewer suggestion block for a sticky
  PR comment (typically alongside the risk classifier).
- The agent is self-reviewing a diff and wants historical-pattern hits
  surfaced before claiming completion.

Do NOT use when:

- The diff is low-risk and no ownership map exists — fall back to
  [`reviewer-awareness`](../../rules/reviewer-awareness.md) defaults.
- A full PR description is requested — route to
  [`create-pr-description`](../create-pr-description/SKILL.md) and let
  it call this skill for the routing block.
- A threat model is wanted — route to
  [`threat-modeling`](../threat-modeling/SKILL.md).

## Procedure

### 1. Collect the changed file list

From git (`git diff --name-only <base>...<head>`) or from an explicit
list supplied by the caller. If the list is empty, stop and report
"no changes — routing skipped".

### 2. Load project data (if present)

Check, in order:

- `.github/ownership-map.yml` → fallback `agents/ownership-map.yml`
- `.github/historical-bug-patterns.yml` → fallback
  `agents/historical-bug-patterns.yml`

Parse each with YAML. Validate `version: 1` is present. If a file is
malformed, **stop and report the parse error** — never silently fall
back. If neither file exists, emit the generic role-based fallback
using [`reviewer-awareness`](../../rules/reviewer-awareness.md).

### 3. Match ownership

For every changed file, find the **first** matching entry in
`ownership-map.yml` (`fnmatch` semantics, same as `pr-risk-config.yml`).
Collect the union of:

- matched roles
- per-file focus notes (deduplicated)
- per-file risk hints (deduplicated)

Files with no match fall through to `defaults.roles` if defined, else
to the generic-role fallback.

### 4. Match historical patterns

Walk every pattern in `historical-bug-patterns.yml`. A pattern matches
when **any** of its `paths` globs matches **any** changed file. For each
match, record:

- `id`, `label`, `severity`
- `required_test` (verbatim)
- `references` (verbatim)

### 5. Compute severity

Take the **max** severity across matched patterns:

- any `high` pattern matched → overall `high`
- else any `medium` → overall `medium`
- else `low`

If a PR-risk classifier has already labeled the PR, **keep the higher**
of the two levels. Do not downgrade.

### 6. Check staleness

If `ownership-map.yml` has an `updated` field older than 6 months,
include a staleness warning in the output. Still use the data — just
flag it.

## Validation

Before returning:

1. Every emitted role is either in the common vocabulary
   ([`reviewer-awareness`](../../rules/reviewer-awareness.md)) or sourced
   from an ownership entry — never invented.
2. Every historical-pattern match cites its `id` and `required_test`
   verbatim.
3. At least **primary + secondary** roles for medium/high severity.
4. No individual GitHub usernames or email addresses in the output.
5. If no data files exist, the output says so explicitly.

## Output format

```
Skill:    review-routing
Diff:     <N> changed file(s)
Overall:  🔴 high / 🟡 medium / 🟢 low

Ownership (from ownership-map.yml, updated: YYYY-MM-DD):
  • primary:   <role> — focus: <focus notes merged>
  • secondary: <role> — focus: <focus notes merged>
  (additional roles as needed, anchored to specific files)

Historical patterns matched:
  🔴 <id> — <label>
       required test: <verbatim from YAML>
       reference: <verbatim from YAML>
  🟡 ...

Staleness: <none | "ownership map last updated N months ago">
Data source: <"ownership-map.yml + historical-bug-patterns.yml"
             | "no project data — generic roles">
```

## Gotcha

- **Silently ignoring parse errors** — a malformed YAML looks like
  absent data. Report the parse error and stop.
- **Downgrading severity** when a pattern matched but "the author said
  it's fine" — the pattern is registered because it bit before.
- **Emitting usernames** — this skill outputs roles only. CODEOWNERS
  maps role → person.
- **Inventing ownership** when the map does not cover the diff — say
  "no match, generic fallback" instead.
- **Walking old pattern globs** against renamed files — the pattern
  matches paths, not semantics.

## Do NOT

- NEVER modify `ownership-map.yml` or `historical-bug-patterns.yml` as
  a side effect of routing a diff. Data edits are a separate task.
- NEVER merge the ownership and pattern blocks into a single list —
  they answer different questions.
- NEVER skip historical patterns because the PR is small. A one-line
  change can still hit a registered failure mode.
- NEVER emit a routing block for a PR with no changed files.

## See also

- [`reviewer-awareness`](../../rules/reviewer-awareness.md)
- [`review-routing-awareness`](../../rules/review-routing-awareness.md)
- [`review-routing-data-format`](../../guidelines/agent-infra/review-routing-data-format.md)
- [`create-pr-description`](../create-pr-description/SKILL.md)
- [`judge-test-coverage`](../judge-test-coverage/SKILL.md) — consumes
  the `required_test` entries from matched patterns.
