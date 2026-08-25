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

- **Smaller diffs — by removing indirection, never by compression.** Two lines
  (`$x = ...; f($x)`) become one (`f(...)`) because the naming step carried no
  information, not because one line is a goal in itself. **Simple is not the
  same as short:** a flat form one line *longer* beats a dense clever one, and a
  nested ternary or a long optional-call chain that shrinks the diff while
  raising the cost of every future read is a regression here, not a win. The
  shape axis in
  [`agent-interaction-and-decision-quality` § 8b-shape](agent-infra/agent-interaction-and-decision-quality.md)
  states the same distinction from the scope side.
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
rule (whose body is merged here per P4 of `road-to-kernel-and-router.md`).
External consensus in one line each: comments explain **why, never
what** (competent readers get the what from the code); Google's style
guides (C++/Go/Python/TS) ban stating the obvious — Go: prefer
self-describing names over redundant comments; Python: "never describe
the code"; modern PHP (framework-mainstream since PHP 8 typing) drops
docblocks that only restate native type hints; TSDoc/JSDoc type
annotations are redundant in typed TypeScript.

### Banned comment classes

| Banned | Example | Instead |
|---|---|---|
| What-narration | `// increment the counter` above `counter++` | Nothing — the code says it |
| Signature-mirroring docblock | `@param string $name The name` on `string $name` | Nothing — the typehint says it |
| Redundant `@return` | `@return bool` on `): bool` | Nothing |
| Banner / section divider | `// ---------- Helpers ----------` | Structure the file; extract a class |
| Change-log comment | `// added for the export feature`, `// per ticket #123` | Commit message / PR description |
| Reviewer-directed justification | `// this is safe because my change …` | PR description |
| Redundant property docblock | `/** @var LoggerInterface */` on a typed property | Nothing — the property type says it |
| Type-restating JSDoc in typed TS | `/** @param {string} id */` on `id: string` | Nothing — TS carries the type |
| Obvious docstring | `"""Return the user."""` on `get_user()` | Nothing, or a real contract note |
| Commented-out code | dead code kept "for reference" | Delete — git history is the tombstone |

### Carve-out — machine-relevant precision docblocks STAY

A docblock that carries type information the native type system cannot express is **not** redundant — static analyzers and IDEs consume it. Keep (and write) these:

- PHP generics / array shapes for PHPStan/Psalm: `@return Collection<int, Post>`, `@param array<string, User> $usersByEmail`, `@template T`, `@phpstan-type`.
- Union/shape refinements the language can't express natively.
- Tool-consumed markers: `@deprecated` (with the successor), `@internal`, `@throws` for checked flows the caller must handle.
- Python typing that only a docstring/stub can carry in the project's toolchain.

The line: the docblock must add information **beyond** the native signature. `@param array<int, Order> $orders` earns its place; `@param array $orders` does not.

### Public-API carve-out — `code_style.docblocks`

Read `code_style.docblocks` from `.agent-settings.yml` (missing → `minimal`):

- `minimal` (default) — the full discipline above; exported/public symbols get no summary docblock unless one of the five legitimate jobs applies.
- `full` — the **exported public surface of a library package** (published API consumers see in their IDE) MAY carry a one-line summary docblock per symbol. The redundancy ban still holds in `full`: no `@param`/`@return` lines that mirror the signature, ever.

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

Those three conditions are the code-comment instance of a wider test. The
generalised form — five questions covering comments, docblocks, labels, hints,
tooltips, placeholders, badges and empty states alike — is the Information Delta
Test in [`redundancy-taxonomy`](redundancy-taxonomy.md), together with the
representation classes that name what a redundant surface *is*. Reach for it
whenever the surface is not a code comment, and whenever a reduction would touch
the semantic channel: an accessibility name is required information, so it is a
hard guard and never a deletion candidate. The rule is not "less text" — it is
that if removing the text loses no information in any required channel, remove
it, and if the information is required, express it once, in the strongest native
form available.

The same document carries the **naming** half, which fires earlier than any of
this: before introducing a term for a concept, search for the term the tree
already uses. A second word for an existing concept costs a reader more than a
redundant sentence does — a redundant sentence is skipped, a second name makes
them check whether they are looking at one thing or two.

### Additional worked examples

(The TypeScript `formatPrice` pair above is the canonical TS example; these
cover the remaining shapes.)

```php
// ❌ Redundant — every line restates the signature
/**
 * Get the user by id.
 *
 * @param int $id The user id.
 * @return User|null The user or null.
 */
public function getUserById(int $id): ?User

// ✅ Nothing to add — the signature is the documentation
public function getUserById(int $id): ?User
```

```php
// ✅ Docblock KEPT — the generic is machine-relevant (PHPStan), the native type can't carry it
/** @return Collection<int, Post> */
public function publishedPosts(): Collection
```

```python
# ❌ Narration
# loop over the items and sum the totals
total = sum(item.total for item in items)

# ✅ A why that survives
# Stripe amounts are integer cents; convert once at the boundary, never downstream.
total_cents = sum(item.total_cents for item in items)
```

### Scope boundary

The comment discipline governs **new and edited code only**. It is never a
license to strip comments from untouched code —
[`minimal-safe-diff`](../../src/rules/minimal-safe-diff.md) wins on diff shape
("no docstrings/comments on untouched code" cuts both ways: don't add, don't
remove). Sweeping a file's existing comments is a separate,
explicitly-requested cleanup task.

### Fixtures

Behavioral baseline: `tests/code-comments/eval-fixtures.md`
(`ccd-php-class-generation`, `ccd-ts-module-generation`,
`ccd-untouched-preservation`, `ccd-explicit-teaching-override`); the decidable
criteria are proven by `tests/scripts/code_comment_fixtures.test.ts`.

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
- [`redundancy-taxonomy`](redundancy-taxonomy.md) — the shared classes,
  verdicts and Information Delta Test this section instantiates for code
  comments; also cited by the review and refactoring skills.
