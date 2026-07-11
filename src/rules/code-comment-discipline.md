---
type: "auto"
tier: "2b"
alwaysApply: false
description: "Writing/editing code in any language — a comment states a WHY or a constraint the code cannot show; never restate what names/types already say; no signature-mirroring docblocks"
triggers:
  - intent: "writing or generating code"
  - intent: "adding a class / method / function"
  - intent: "refactoring code"
  - keyword: "comment"
  - keyword: "docblock"
  - keyword: "phpdoc"
  - keyword: "jsdoc"
  - keyword: "docstring"
  - keyword: "implement"
  - keyword: "class"
  - keyword: "method"
  - keyword: "refactor"
workspaces: [engineering]
packs: [engineering-base]
---

# Code Comment Discipline

AI-written code over-comments: docblocks that mirror the signature, comments that narrate the next line, banner headers, change-log notes. Every redundant comment costs tokens on every future read, bloats the file, and rots into misinformation the moment the code changes. The default for any new comment is **no** — a comment must earn its place.

## The Iron Law

```
A COMMENT STATES A WHY OR A CONSTRAINT THE CODE CANNOT SHOW — NOTHING ELSE.
NEVER RESTATE WHAT THE CODE, THE NAME, OR THE TYPE ALREADY SAYS.
NO DOCBLOCK THAT ONLY MIRRORS THE NATIVE SIGNATURE.
DOCBLOCKS EARN THEIR PLACE ONLY WITH MACHINE-RELEVANT PRECISION
(GENERICS, ARRAY SHAPES, NON-TRIVIAL UNIONS) OR GENUINE WHY-CONTEXT.
WHEN IN DOUBT: NO COMMENT. SHORTER IS BETTER. NONE IS OFTEN BEST.
```

## What a comment is FOR

Exactly five legitimate jobs — everything else is noise:

1. **A why** — the non-obvious reason this approach was chosen over the obvious one.
2. **An invariant or constraint** the code cannot express — ordering requirements, units, concurrency assumptions, "must run before X".
3. **A warning** — a known trap, a workaround for a specific upstream bug (name it), a performance cliff.
4. **Machine-relevant type precision** the native type system cannot carry — see the carve-out below.
5. **A spec linkage** where an external contract defines the behavior (RFC section, protocol field) — the contract, not the ticket history.

Test before writing any comment: *would deleting it leave a future reader confused about a non-obvious constraint?* No → don't write it.

## Banned comment classes

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

## Carve-out — machine-relevant precision docblocks STAY

A docblock that carries type information the native type system cannot express is **not** redundant — static analyzers and IDEs consume it. Keep (and write) these:

- PHP generics / array shapes for PHPStan/Psalm: `@return Collection<int, Post>`, `@param array<string, User> $usersByEmail`, `@template T`, `@phpstan-type`.
- Union/shape refinements the language can't express natively.
- Tool-consumed markers: `@deprecated` (with the successor), `@internal`, `@throws` for checked flows the caller must handle.
- Python typing that only a docstring/stub can carry in the project's toolchain.

The line: the docblock must add information **beyond** the native signature. `@param array<int, Order> $orders` earns its place; `@param array $orders` does not.

## Public-API carve-out — `code_style.docblocks`

Read `code_style.docblocks` from `.agent-settings.yml` (missing → `minimal`):

- `minimal` (default) — the full discipline above; exported/public symbols get no summary docblock unless one of the five legitimate jobs applies.
- `full` — the **exported public surface of a library package** (published API consumers see in their IDE) MAY carry a one-line summary docblock per symbol. The redundancy ban still holds in `full`: no `@param`/`@return` lines that mirror the signature, ever.

## Worked examples

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

```ts
// ❌ Redundant — TS already knows all of this
/**
 * Formats the price.
 * @param amount - the amount
 * @returns the formatted price
 */
export function formatPrice(amount: number): string

// ✅ A real constraint the signature can't show
// Rounds half-up to match the invoice PDF renderer; Intl default is half-even.
export function formatPrice(amount: number): string
```

```python
# ❌ Narration
# loop over the items and sum the totals
total = sum(item.total for item in items)

# ✅ A why that survives
# Stripe amounts are integer cents; convert once at the boundary, never downstream.
total_cents = sum(item.total_cents for item in items)
```

## Scope boundary

This rule governs **new and edited code only**. It is never a license to strip comments from untouched code — [`minimal-safe-diff`](minimal-safe-diff.md) wins on diff shape ("no docstrings/comments on untouched code" cuts both ways: don't add, don't remove). Sweeping a file's existing comments is a separate, explicitly-requested cleanup task.

## When NOT to fire

- Prose surfaces: docs, READMEs, roadmaps, config commentary — different register, not code comments.
- The user explicitly asks for documented code / teaching examples ("erkläre im Code", "annotate this for juniors") — that turn's ask wins.
- License headers or file-level pragmas a toolchain requires.

## Fixtures

Behavioral baseline: `tests/code-comments/eval-fixtures.md` (`ccd-php-class-generation`, `ccd-ts-module-generation`, `ccd-untouched-preservation`, `ccd-explicit-teaching-override`); the decidable criteria are proven by `tests/scripts/code_comment_fixtures.test.ts`.

## See also

- [`code-clarity.md § Comment discipline`](../docs/guidelines/code-clarity.md#comment-discipline--state-a-constraint-not-a-narration) — canonical long-form with per-language keep/drop tables.
- [`minimal-safe-diff`](minimal-safe-diff.md) — diff-shape twin; no comment additions or removals on untouched code.
- [`output-discipline`](output-discipline.md) — adjacent but distinct: bans placeholder prose (`// TODO: implement`); this rule bans redundant prose.
- `docs/guidelines/php/php-coding-patterns.md` § PHPDoc — PHP-specific operationalization.
