## Ticket

GT-3-POW — Make power(a, b) handle negative bases correctly

## Persona

senior-engineer

## Plan

1. **Fix power() for negative bases** — Replace the Math.abs(a) ** b stub with sign-aware logic
2. **Fix power() for negative bases** — Add a negative-base power test covering odd + even exponents
3. **Fix power() for negative bases** — Re-run vitest to confirm both assertions pass

## Changes

- `src/calculator.ts` — applied by GT recipe
- `tests/calculator.test.ts` — applied by GT recipe

## Tests

- **verdict:** success
- **scope:** targeted
- **exit_code:** 0
- **targeted:** Tests 4 passed (4)

## Verify

- **verdict:** success
- **confidence:** high
- **judges:** ['bug-hunter', 'security', 'test-coverage', 'code-quality']
- **findings:** []

## Follow-ups

_(none)_

## Suggested next commands

- `/commit`
- `/create-pr`