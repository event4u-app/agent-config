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

## Comment discipline — state a constraint, not a narration

A code comment earns its place only by stating a constraint the code
itself can't show — a non-obvious invariant, a workaround for a specific
bug, a hidden dependency. It never narrates:

- **Provenance** — "added for the X feature", "per ticket #123". That
  belongs in the commit message or PR description, not the code; it rots
  the moment the feature or ticket is forgotten.
- **What the next line does** — well-named identifiers already say it.
  A comment repeating the code is noise the reader skips past.
- **Why the change is correct** — that's a message to the reviewer, not
  to the next person reading the file after it's merged.

Test: would removing the comment leave a future reader confused about a
non-obvious constraint? If yes, keep it — tightened to the constraint
alone. If the comment only restates what identifiers already convey, or
explains the change's history rather than the code's behavior, cut it.

This is the canonical long-form behind the
[`code-comment-discipline`](../../src/rules/code-comment-discipline.md)
rule. External consensus in one line each: comments explain **why, never
what** (competent readers get the what from the code); Google's style
guides (C++/Go/Python/TS) ban stating the obvious — Go: prefer
self-describing names over redundant comments; Python: "never describe
the code"; modern PHP (framework-mainstream since PHP 8 typing) drops
docblocks that only restate native type hints; TSDoc/JSDoc type
annotations are redundant in typed TypeScript.

### Per-language keep/drop tables

Docblocks earn their place only with **machine-relevant precision** the
native type system cannot carry, or genuine why-context. Per language:

#### PHP / PHPDoc

| Keep | Drop |
|---|---|
| `@return Collection<int, Post>` — generic the native type can't carry | `@return bool` on `): bool` |
| `@param array<string, User> $usersByEmail` — array shape for PHPStan/Psalm | `@param string $name The name.` on `string $name` |
| `@template T`, `@phpstan-type`, `@phpstan-assert` | `/** @var LoggerInterface */` on a natively-typed property |
| `@throws PaymentDeclined` where callers must handle it | `/** Constructor. */` |
| `@deprecated use X instead` — tool-consumed | Method summary that re-words the method name |

```php
// ❌ Drop — five lines, zero information beyond the signature
/**
 * Deactivate the user.
 *
 * @param User $user The user to deactivate.
 * @return void
 */
public function deactivate(User $user): void

// ✅ Keep — the docblock carries what PHP's type system cannot
/** @param array<int, OrderLine> $lines */
public function totalCents(array $lines): int
```

#### TypeScript / JSDoc-TSDoc

| Keep | Drop |
|---|---|
| A why: `// half-up to match the invoice renderer; Intl default is half-even` | `@param {string} id` on `id: string` |
| `@deprecated` with the successor named | `@returns the formatted price` on `: string` |
| `@internal` when the build strips internals | Restating a type the compiler already enforces |
| Non-obvious unit/contract: `/** epoch millis, NOT seconds */` | `// call the API` above `await api.call()` |

```ts
// ❌ Drop — TS carries every fact stated here
/**
 * Formats the price.
 * @param amount - the amount to format
 * @returns the formatted string
 */
export function formatPrice(amount: number): string

// ✅ Keep — constraint the signature can't show
// Rounds half-up to match the invoice PDF renderer; Intl default is half-even.
export function formatPrice(amount: number): string
```

#### Python / docstrings

| Keep | Drop |
|---|---|
| Contract detail: raises, units, side effects a caller must know | `"""Return the user."""` on `get_user()` |
| Public-API docstring where the toolchain renders it (Sphinx/mkdocs) | Args section restating annotated params |
| Type info only expressible in a docstring in this project's toolchain | `# loop over items` above a comprehension |

```python
# ❌ Drop
def get_user(user_id: int) -> User | None:
    """Get the user by id and return it or None."""

# ✅ Keep — behavior the signature can't show
def get_user(user_id: int) -> User | None:
    """Reads through the request-local cache; never hits the DB twice per request."""
```

#### Go / doc comments

| Keep | Drop |
|---|---|
| Exported-symbol doc comment (`godoc` renders it) — one sentence, adds intent | Doc comment that re-words the function name |
| A why on non-obvious concurrency/ordering | `// increment i` |

Go is the one ecosystem where exported symbols conventionally carry a
doc comment — keep the convention, but the comment still must say
something the name doesn't.

### Redundancy self-check (any language)

Before emitting a comment or docblock, all three must be true:

1. It states something **beyond** the names and native types.
2. It will still be true after the next refactor of the lines below it.
3. It addresses the future reader of the file — not the reviewer of the diff.

One "no" → drop it. When in doubt: no comment.

## See also

- Language-specific anchors that link to this guideline:
  - PHP: `docs/guidelines/php/general.md` § Variables
  - PHP: `docs/guidelines/php/php-coding-patterns.md` § Variables
- `code-comment-discipline` rule — the always-loaded enforcement surface
  for the comment-discipline clause above.
- `minimal-safe-diff` rule — orthogonal but aligned: smallest change
  that solves the stated problem; also owns "no comment additions or
  removals on untouched code".
- `direct-answers` rule — same spirit at the prose level: shortest
  version that fully answers the question.
