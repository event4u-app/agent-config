# Code Clarity

> Cross-language coding-clarity conventions. Cited by language-specific
> guidelines (`php/general.md`, `php/php-coding-patterns.md`, …) so
> consumers in any stack get the same baseline.

Applies to PHP, JavaScript / TypeScript, Python, Go, Ruby, and any
other language the package guides. Language-specific files reference
this one — they don't duplicate it.

## Don't assign single-use values to a variable

If a value is used **exactly once**, pass the expression directly.
Don't bind it to a temporary variable just to feed it into the next
call.

The named variable buys nothing — it adds a line, an identifier the
reader has to track, and a false signal that the value will be reused.

```php
// ❌ Avoid — $db is referenced exactly once.
$db = db::getInstance();
$this->columnExists($db, 'table', 'column');

// ✅ Prefer — value flows directly to the call.
$this->columnExists(db::getInstance(), 'table', 'column');
```

```ts
// ❌ Avoid
const user = await getCurrentUser();
return renderProfile(user);

// ✅ Prefer
return renderProfile(await getCurrentUser());
```

```python
# ❌ Avoid
config = load_config()
return Worker(config)

# ✅ Prefer
return Worker(load_config())
```

## Carve-outs — keep the variable when

The rule is "single use, no extra meaning". Bind to a variable when
**any** of these hold:

| Carve-out | Why |
|---|---|
| **Used 2 or more times** | Inlining duplicates the expression — re-evaluation, repeated side effects, more diff churn. |
| **Expression has side effects** | A network call, a write, an `INSERT`, a counter bump must run exactly once and be visible to the reader as such. |
| **The name carries domain meaning** | `$activeMembership = …; allow($activeMembership)` — the identifier documents intent the call site can't. |
| **Inlining pushes past the line-length budget** | A 130-char single line is harder to read than two named lines. Match the project's formatter. |
| **Used inside a loop body** | Hoist the invariant out of the loop; keep the binding. |
| **Debugger / breakpoint affordance** | Stepping through a named value is materially easier than inspecting an expression mid-call. Prefer the variable in code paths under active investigation. |
| **Type-narrowing assertion** | `const x: Foo = maybeFoo!; …` where the binding pins the type for the type-checker. |

When in doubt — and the expression is short, side-effect-free, and
used once — inline it.

## Why this matters

- **Smaller diffs.** Two lines (`$x = ...; f($x)`) become one (`f(...)`)
  — fewer review points, less merge conflict surface.
- **Less cognitive load.** Readers don't track an identifier whose
  whole purpose is "the next line".
- **Honest signals.** A named variable says "this value is reusable
  or worth labeling". Single-use bindings break that contract and
  train readers to ignore names.
- **Faster refactor.** Renaming the call site doesn't drag a now-stale
  variable name with it.

## Anti-patterns this rule rejects

- **"Variable for the debugger."** If the file is not under active
  debugging, drop the binding. Don't ship debug scaffolding.
- **"Variable to align line lengths."** Use the formatter, not a
  fake intermediate.
- **"Variable so I have somewhere to put the type."** Modern type
  inference makes this redundant in PHP 8+, TS, Python 3.10+, Go,
  Rust, etc. Annotate the parameter or return type instead.

## See also

- Language-specific anchors that link to this guideline:
  - PHP: `docs/guidelines/php/general.md` § Variables
  - PHP: `docs/guidelines/php/php-coding-patterns.md` § Variables
- `minimal-safe-diff` rule — orthogonal but aligned: smallest change
  that solves the stated problem.
- `direct-answers` rule — same spirit at the prose level: shortest
  version that fully answers the question.
