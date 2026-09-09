---
demo_for: minimal-safe-diff, think-before-action
layer: pattern-memory
prose_delta:
  rule_chars_before: 5927
  rule_chars_after: 6903
  measured_at: lint-examples-shape-conformance-pass
  note: "Counts are of THIS demo file, measured with wc -c before and after the pass. The delta is frontmatter plus the Demo / Wrong shape / Right shape / Failure mode / Why it works headings required by lint_examples — no prose was migrated out of a rule and none was removed; every code block is byte-identical."
---

# Simplicity and Goal Discipline — wrong/right demos

Recognition surface for [`minimal-safe-diff § Anti-over-engineering`](../../../src/rules/minimal-safe-diff.md)
(own-orphan cleanup, speculative-complexity bans) and the goal-driven
execution clause in `think-before-action`. Per council convergence
(2026-07-10): the demos ARE the enforcement — an agent that has never seen
the violation cannot recognize it, no matter how crisp the checklist question.
Match your diff against the *right* column before presenting.

## Demo 1 — Over-abstraction vs. one function

**Ask:** "Add a function to calculate a percentage discount."

### Wrong shape

Strategy pattern for a single caller (PHP):

```php
interface DiscountStrategy { public function calculate(float $amount): float; }
final class PercentageDiscount implements DiscountStrategy { /* … */ }
final class FixedDiscount implements DiscountStrategy { /* … */ }
final readonly class DiscountConfig { /* strategy, minPurchase, maxDiscount */ }
final class DiscountCalculator { /* 30+ lines of orchestration */ }
```

**Failure mode:** the wrong version is not "bad code" — it is *premature*
code: harder to read, more surface to test, and speculative until the
requirement exists.

### Right shape

One function until the second discount type is real:

```php
function calculateDiscount(float $amount, float $percent): float
{
    return $amount * ($percent / 100);
}
```

### Why it works

No second caller, no second strategy → no abstraction. When the
second type genuinely arrives, refactor then (`prefer-enums-over-literals` /
Strategy sniff test governs that moment).

## Demo 2 — Speculative features vs. just-what-was-asked

**Ask:** "Save user preferences to the database."

### Wrong shape

Options nobody requested (TypeScript):

```ts
class PreferenceManager {
  constructor(db: Db, cache?: Cache, validator?: Validator) { /* … */ }
  save(userId: number, prefs: Prefs,
       opts: { merge?: boolean; validate?: boolean; notify?: boolean } = {}) {
    // merging, validation, cache write, notification fan-out — all unasked
  }
}
```

**Failure mode:** every optional parameter with one call site, every
"flexibility" flag, and every handler for a scenario that cannot occur is
speculative complexity.

### Right shape

The ask, nothing else:

```ts
async function savePreferences(db: Db, userId: number, prefs: Prefs) {
  await db.query('UPDATE users SET preferences = $1 WHERE id = $2',
    [JSON.stringify(prefs), userId]);
}
```

### Why it works

Add caching when performance data demands it, validation when bad
data appears, merging when the requirement lands.

## Demo 3 — Drive-by refactor vs. surgical diff

**Ask:** "Fix the bug where an empty email crashes the validator."

### Wrong shape

The fix PLUS improved email regex, new username length checks,
rewritten comments, and a fresh docstring — four changes, one was asked.

**Failure mode:** the "improvements" belong in a follow-up proposed via
`active-remediation`'s note-and-ask ladder — not smuggled into the bug fix.

### Right shape

Only the lines that make the empty-email case safe change; every
other line of the function is byte-identical.

### Why it works

Every changed line must trace to the stated task
(`minimal-safe-diff`).

## Demo 4 — Style drift vs. match-existing-style

**Ask:** "Add logging to the upload function."

### Wrong shape

The diff adds logging AND flips quote style, adds type hints,
reshapes the boolean return, reflows whitespace — the reviewer can no longer
see the logging change.

**Failure mode:** a diff that reformats while changing behavior hides the
behavior change.

### Right shape

Logger import + three log lines, inserted in the file's existing
style (its quoting, its spacing, its return pattern), even where you would
personally write it differently.

### Why it works

Style consistency is a repo property, not a per-diff taste decision.

## Demo 5 — Own-orphan vs. pre-existing dead code

**Ask:** "Replace the legacy formatter call in `processA` with the new one."

### Wrong shape

**Too little:** `processA` no longer calls `legacyFormat()`, but the
now-unused import and the helper it alone referenced stay behind — the diff
shipped its own litter.

**Too much:** while in the file, the agent also deletes
`oldHelper()`, which `processB` — untouched by this diff — still references
in another module, or which was already orphaned *before* this task.

**Failure mode:** two directions of the same error — the diff shipped its own
litter (too little), or it deleted code that untouched files still reference,
or that was already orphaned before this task (too much).

### Right shape

Remove exactly the imports/variables/functions whose **last
reference disappeared in a file this diff touched**; anything still
referenced from untouched files — or orphaned before the task — is
pre-existing debt: mention it, don't delete it.

### Why it works

The boundary is mechanical (grep after editing), so there is no
judgment call to rationalize — see
[`minimal-safe-diff § Own-orphan cleanup`](../../../src/rules/minimal-safe-diff.md#own-orphan-cleanup).

## Demo 6 — Vague plan vs. verifiable per-step plan

**Ask:** "Add rate limiting to the API."

### Wrong shape

Unverifiable narration:

```
1. Review the code
2. Identify issues
3. Implement rate limiting
4. Test the changes
```

**Failure mode:** a step without a `verify:` is an assumption.

### Right shape

Every step carries its check:

```
1. In-memory limit on one endpoint → verify: 11th request in a minute → 429 (test)
2. Extract to middleware, all endpoints → verify: limit fires on /users AND /posts; existing endpoint tests stay green
3. Shared store backend → verify: counter survives app restart; two instances share the count
```

### Why it works

Strong criteria let the
loop run independently (`verify-before-complete` then has something to
check); "make it work" guarantees clarification churn after the fact instead
of before.

## Key insight

The wrong versions are not obviously wrong — they follow known patterns and
"best practices". The failure is **timing**: complexity added before the
requirement exists costs comprehension, bugs, and test surface today for a
tomorrow that may never come. Solve today's problem simply; refactor when the
second requirement is real.
