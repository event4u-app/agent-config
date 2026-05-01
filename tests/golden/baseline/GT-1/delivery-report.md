## Ticket

GT-1-MULT — Add multiply(a, b) to the toy calculator

## Persona

senior-engineer

## Plan

1. **Add multiply(a, b)** — Append multiply(a: int, b: int) -> int to src/calculator.py
2. **Add multiply(a, b)** — Append test_multiply_returns_product to tests/test_calculator.py
3. **Add multiply(a, b)** — Run pytest to confirm the new test passes

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
