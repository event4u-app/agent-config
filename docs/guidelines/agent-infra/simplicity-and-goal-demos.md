# Simplicity and Goal Discipline — wrong/right demos

Recognition surface for [`minimal-safe-diff § Anti-over-engineering`](../../src/rules/minimal-safe-diff.md)
(own-orphan cleanup, speculative-complexity bans) and the goal-driven
execution clause in `think-before-action`. Per council convergence
(2026-07-10): the demos ARE the enforcement — an agent that has never seen
the violation cannot recognize it, no matter how crisp the checklist question.
Match your diff against the *right* column before presenting.

## 1. Over-abstraction vs. one function

**Ask:** "Add a function to calculate a percentage discount."

**Wrong — Strategy pattern for a single caller (PHP):**

```php
interface DiscountStrategy { public function calculate(float $amount): float; }
final class PercentageDiscount implements DiscountStrategy { /* … */ }
final class FixedDiscount implements DiscountStrategy { /* … */ }
final readonly class DiscountConfig { /* strategy, minPurchase, maxDiscount */ }
final class DiscountCalculator { /* 30+ lines of orchestration */ }
```

**Right — one function until the second discount type is real:**

```php
function calculateDiscount(float $amount, float $percent): float
{
    return $amount * ($percent / 100);
}
```

**Why:** No second caller, no second strategy → no abstraction. When the
second type genuinely arrives, refactor then (`prefer-enums-over-literals` /
Strategy sniff test governs that moment). The wrong version is not "bad
code" — it is *premature* code: harder to read, more surface to test, and
speculative until the requirement exists.

## 2. Speculative features vs. just-what-was-asked

**Ask:** "Save user preferences to the database."

**Wrong — options nobody requested (TypeScript):**

```ts
class PreferenceManager {
  constructor(db: Db, cache?: Cache, validator?: Validator) { /* … */ }
  save(userId: number, prefs: Prefs,
       opts: { merge?: boolean; validate?: boolean; notify?: boolean } = {}) {
    // merging, validation, cache write, notification fan-out — all unasked
  }
}
```

**Right — the ask, nothing else:**

```ts
async function savePreferences(db: Db, userId: number, prefs: Prefs) {
  await db.query('UPDATE users SET preferences = $1 WHERE id = $2',
    [JSON.stringify(prefs), userId]);
}
```

**Why:** Every optional parameter with one call site, every "flexibility"
flag, and every handler for a scenario that cannot occur is speculative
complexity. Add caching when performance data demands it, validation when bad
data appears, merging when the requirement lands.

## 3. Drive-by refactor vs. surgical diff

**Ask:** "Fix the bug where an empty email crashes the validator."

**Wrong:** the fix PLUS improved email regex, new username length checks,
rewritten comments, and a fresh docstring — four changes, one was asked.

**Right:** only the lines that make the empty-email case safe change; every
other line of the function is byte-identical.

**Why:** Every changed line must trace to the stated task
(`minimal-safe-diff`). The "improvements" belong in a follow-up proposed via
`active-remediation`'s note-and-ask ladder — not smuggled into the bug fix.

## 4. Style drift vs. match-existing-style

**Ask:** "Add logging to the upload function."

**Wrong:** the diff adds logging AND flips quote style, adds type hints,
reshapes the boolean return, reflows whitespace — the reviewer can no longer
see the logging change.

**Right:** logger import + three log lines, inserted in the file's existing
style (its quoting, its spacing, its return pattern), even where you would
personally write it differently.

**Why:** Style consistency is a repo property, not a per-diff taste decision.
A diff that reformats while changing behavior hides the behavior change.

## 5. Own-orphan vs. pre-existing dead code

**Ask:** "Replace the legacy formatter call in `processA` with the new one."

**Wrong (too little):** `processA` no longer calls `legacyFormat()`, but the
now-unused import and the helper it alone referenced stay behind — the diff
shipped its own litter.

**Wrong (too much):** while in the file, the agent also deletes
`oldHelper()`, which `processB` — untouched by this diff — still references
in another module, or which was already orphaned *before* this task.

**Right:** remove exactly the imports/variables/functions whose **last
reference disappeared in a file this diff touched**; anything still
referenced from untouched files — or orphaned before the task — is
pre-existing debt: mention it, don't delete it.

**Why:** The boundary is mechanical (grep after editing), so there is no
judgment call to rationalize — see
[`minimal-safe-diff § Own-orphan cleanup`](../../src/rules/minimal-safe-diff.md#own-orphan-cleanup).

## 6. Vague plan vs. verifiable per-step plan

**Ask:** "Add rate limiting to the API."

**Wrong — unverifiable narration:**

```
1. Review the code
2. Identify issues
3. Implement rate limiting
4. Test the changes
```

**Right — every step carries its check:**

```
1. In-memory limit on one endpoint → verify: 11th request in a minute → 429 (test)
2. Extract to middleware, all endpoints → verify: limit fires on /users AND /posts; existing endpoint tests stay green
3. Shared store backend → verify: counter survives app restart; two instances share the count
```

**Why:** A step without a `verify:` is an assumption. Strong criteria let the
loop run independently (`verify-before-complete` then has something to
check); "make it work" guarantees clarification churn after the fact instead
of before.

## Key insight

The wrong versions are not obviously wrong — they follow known patterns and
"best practices". The failure is **timing**: complexity added before the
requirement exists costs comprehension, bugs, and test surface today for a
tomorrow that may never come. Solve today's problem simply; refactor when the
second requirement is real.
