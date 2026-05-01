## Ticket

GT-5-NEG — Add negate(a) to the toy calculator

## Persona

senior-engineer

## Plan

1. **Add negate(a)** — Append negate(a: int) -> int to src/calculator.py
2. **Add negate(a)** — Append test_negate_returns_negation to tests/test_calculator.py
3. **Add negate(a)** — Run pytest to confirm both edge cases pass

## Changes

- `src/calculator.py` — applied by GT recipe
- `tests/test_calculator.py` — applied by GT recipe

## Tests

- **verdict:** success
- **scope:** targeted
- **exit_code:** 0
- **targeted:** ============================== 4 passed in <DURATION>s ===============================

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
