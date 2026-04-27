## Ticket

GT-3-POW — Make power(a, b) handle negative bases correctly

## Persona

senior-engineer

## Plan

1. **Fix power() for negative bases** — Replace the abs(a)**b stub with sign-aware logic
2. **Fix power() for negative bases** — Add test_power_negative_base covering odd + even exponents
3. **Fix power() for negative bases** — Re-run pytest to confirm both assertions pass

## Changes

- `src/calculator.py` — applied by GT recipe
- `tests/test_calculator.py` — applied by GT recipe

## Tests

- **verdict:** success
- **scope:** targeted
- **exit_code:** 0
- **targeted:** ============================== 4 passed in 0.00s ===============================

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
