# Code-Comment-Discipline Eval Fixtures

Behavioral baseline for the [`code-comment-discipline`](../../src/rules/code-comment-discipline.md)
rule (road-to-fable-feedback-5 Phase 1d). Each fixture carries a stable `id`,
a generation scenario, and a pass criterion. Where the criterion is
mechanically decidable it is written as a checkable pattern — the decidable
subset is exercised by `tests/scripts/code_comment_fixtures.test.ts` against
the embedded samples, so the criteria themselves are proven decidable.
Rubric parts are judged in PR review, never by a hidden LLM judge (same
scoring model as `tests/design-artifacts/eval-fixtures.md`).

## Decidable patterns (shared by fixtures below)

- **P1 signature-mirroring `@param`** — a docblock `@param <nativeType> $x`
  (no generics `<...>`, no shape, no prose beyond the parameter name) on a
  natively-typed parameter.
- **P2 bare `@return`** — `@return <nativeType>` with no generics/shape on a
  natively-typed return.
- **P3 redundant `@var`** — `/** @var T */` on a property natively typed `T`.
- **P4 what-narration** — a line comment that only restates the next
  statement (`// increment the counter` over `counter++`).
- **P5 JSDoc type restatement** — `@param {T} x` / `@returns {T}` in a `.ts`
  file where the signature already carries the type.

## Fixtures

### ccd-php-class-generation
- **scenario:** "Create a PHP 8.3 `InvoiceService` with a typed constructor
  (`LoggerInterface $logger`), a `totalCents(array $lines): int` method over
  `OrderLine` objects, and a `publishedInvoices(): Collection` method
  returning `Collection<int, Invoice>`."
- **pass (decidable):** zero P1/P2/P3/P4 hits in the emitted class; the
  generic docblocks `@param array<int, OrderLine> $lines` AND
  `@return Collection<int, Invoice>` ARE present (the machine-precision
  carve-out must not be overshot into "no docblocks ever").
- **pass (rubric):** any remaining comment states a why/constraint; no banner
  comments, no summary lines re-wording method names.

#### sample-wrong

```php
class InvoiceService
{
    /** @var LoggerInterface The logger. */
    private LoggerInterface $logger;

    /**
     * Calculate the total.
     *
     * @param array $lines The lines.
     * @return int The total.
     */
    public function totalCents(array $lines): int
    {
        // loop over the lines and sum the totals
        return array_sum(array_map(fn (OrderLine $l) => $l->totalCents, $lines));
    }
}
```

#### sample-right

```php
class InvoiceService
{
    public function __construct(private readonly LoggerInterface $logger)
    {
    }

    /** @param array<int, OrderLine> $lines */
    public function totalCents(array $lines): int
    {
        return array_sum(array_map(fn (OrderLine $l) => $l->totalCents, $lines));
    }

    /** @return Collection<int, Invoice> */
    public function publishedInvoices(): Collection
    {
        return Invoice::query()->wherePublished()->get();
    }
}
```

### ccd-ts-module-generation
- **scenario:** "Create a TS module with `formatPrice(amount: number): string`
  (half-up rounding to match an invoice PDF renderer) and an exported
  `parseSku(raw: string): Sku`."
- **pass (decidable):** zero P5 hits; zero P4 hits.
- **pass (rubric):** the half-up rounding constraint appears as ONE why-comment
  (it is a genuine non-obvious constraint); nothing else is commented.

#### sample-wrong

```ts
/**
 * Formats the price.
 * @param {number} amount - the amount to format
 * @returns {string} the formatted price
 */
export function formatPrice(amount: number): string {
    // round the amount
    return roundHalfUp(amount).toFixed(2);
}
```

#### sample-right

```ts
// Rounds half-up to match the invoice PDF renderer; Intl default is half-even.
export function formatPrice(amount: number): string {
    return roundHalfUp(amount).toFixed(2);
}
```

### ccd-untouched-preservation
- **scenario:** An existing file carries a verbose legacy docblock on a method
  the task does NOT touch; the task edits a sibling method.
- **pass (rubric):** the legacy docblock is byte-preserved — the rule is never
  a license to strip comments from untouched code (`minimal-safe-diff` wins on
  diff shape). Only the edited method follows the discipline.

### ccd-explicit-teaching-override
- **scenario:** "Annotate this function heavily for a junior — explain every
  step in comments."
- **pass (rubric):** the agent complies (the turn's explicit ask wins); no
  refusal, no silent minimalism.

## Baseline

| fixture | status |
|---|---|
| ccd-php-class-generation | decidable subset proven via `tests/scripts/code_comment_fixtures.test.ts` (sample-wrong fails P1–P4, sample-right passes + keeps carve-out docblocks); generation scoring pending first host run |
| ccd-ts-module-generation | decidable subset proven (sample-wrong fails P4/P5, sample-right passes); generation scoring pending first host run |
| ccd-untouched-preservation | rubric-only; pending first host run |
| ccd-explicit-teaching-override | rubric-only; pending first host run |
