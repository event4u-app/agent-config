---
complexity: lightweight
---

# Stub: road to estate claims the gate can actually read

> **Stub — not active work.** Found 2026-08-24 by the `/analyze:inbox` run while
> landing a roadmap that carried the construct. Not a transfer from a parent
> roadmap: it is a defect in a shipped gate's escape hatch, discovered in
> passing, recorded here so it is not lost.

## The defect, in one sentence

**A YAML block scalar satisfies `check_estate_count` while withholding the exact
thing the key exists to surface.**

`growthClaims()` matches **one patch line**
(`src/scripts/check_estate_count.ts:473`):

```
/^\+\s*estate_growth_exempt:\s*(.+?)\s*$/
```

So a claim written as a folded or literal block —

```yaml
estate_growth_exempt: >-
  the real reason, on the following lines
```

— is captured as the literal reason **`>-`**. The gate goes green, prints
`↑ growth claimed in <file>: >-`, and the sentence a reviewer is supposed to read
never reaches it. Whether the continuation lines are even *present* depends on
how the file arrives, and neither case helps:

- **Newly added file** — every line is a `+` line, so the continuations ARE in
  the patch. They simply do not match a regex anchored on
  `estate_growth_exempt:`, so they are read past. Recoverable in principle, by a
  scanner that does not exist.
- **Edited file** — at `--unified=0` the continuations are context rather than
  `+` lines, so they are not in the patch at all. Not recoverable.

The first case is the common one for this key, and it is worth stating precisely
rather than collapsing both into "the lines are gone": the fix for an addition is
a smarter scanner, the fix for an edit is a wider diff, and only the single-line
form needs neither.

The gate's own docstring names this outcome as the thing the key replaced:
*"deliberately NOT tolerant of an empty reason, because an exemption whose reason
is blank is the silent exception the key exists to replace."* `>-` is
functionally that exception, wearing two characters.

## Why it is not merely cosmetic

The claim is **diff-scoped by design** — it authorises the change that adds it and
no later one. That makes the moment of addition the only moment the reason is ever
read. A folded claim is therefore not "a reason formatted awkwardly"; it is an
authorisation granted against no recorded reason at all, and the record cannot be
reconstructed afterwards from the gate's output.

## Measured population

Grepped at 2026-08-24 over `agents/`, for
`^estate_(growth|offset)_exempt:[ \t]*[|>]`:

| Where | Sites |
|---|---|
| `agents/roadmaps/archive/` | 6 |
| `agents/roadmaps/later/` | 1 (`road-to-run-continuation-observation.md`) |
| `agents/evidence/reviews/*.review-input/` | 8 |
| **total** | **15** |

Two further sites were in the inbox and were fixed at landing rather than left to
this stub, which is why the count above is 15 rather than 17.

The archived ones are spent — their claims already did or did not authorise their
own additions, and a diff-scoped key cannot be re-read. They are counted because
they are the evidence that the construct is idiomatic here, not an isolated slip.

## What moved here

1. Decide whether the regex should reject a block scalar outright (fail closed,
   with a message naming the fix) or learn to read one.
2. Rejecting is the smaller change and matches the existing empty-reason stance.
   Reading it means teaching a line-oriented patch scanner about YAML
   continuations at `--unified=0`, where the continuation lines are not in the
   patch — so "read it" may not be implementable at all, and establishing that is
   part of the work.
3. Either way, one test per direction: a folded claim must not be accepted with
   `>-` as its reason, and a single-line claim must still pass unchanged.

### Named producer

Whoever next touches `check_estate_count.ts`. This is a repository-code change to
a shipped gate, so it is maintainer-owned under the same reasoning
`road-to-draft-status-ratchet-boundary.md` records for its own counting change.

### Probe

Written as a comparison, not a pinned count — the population moves with every
archival.

```bash
# Clause 1 — does the construct still occur?
grep -rn --include='*.md' -E '^estate_(growth|offset)_exempt:[ \t]*[|>]' agents/ | wc -l
#   -> 15 at discovery (2026-08-24).

# Clause 2 — does the gate still accept one?
grep -n 'growthClaims' src/scripts/check_estate_count.ts
#   Re-entry completes when a test asserts the folded form is refused, OR a
#   written decision records that it is accepted deliberately.
```

**Either branch closes it.** A recorded "we accept `>-` and here is why" is a
complete answer; silence is not.

## Related

- [`road-to-draft-status-ratchet-boundary.md`](road-to-draft-status-ratchet-boundary.md)
  — the sibling defect in the same gate, from the other direction: there the
  *population* is opt-out-able, here the *reason* is. Both are cases of a
  measured party controlling what the measurement sees.
