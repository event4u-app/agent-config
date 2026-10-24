# Free-hands shadow window — evidence summary

> Label: **manufactured**. Pre-registration: `internal/bench/free-hands-shadow-PREREG.md`. Verifier `fhs-verify/1`, corpus ref `44493165ebbeee3673ae2ad6ff4c9de6c6494fc2`, digest `606bba390208438d`.
> Spend: USD 0.00 on both arms by construction (subscription CLI and a keyless route); tokens below. Verify tokens are 0: the verifier is deterministic.

| kind | calls | paid pass | free pass | free verify-fail | free escalation | 429 | 402 | quality bar | relief bar | audit agreement |
|---|---|---|---|---|---|---|---|---|---|---|
| classify | 333 | 97.9 % | 96.7 % | 3.3 % | 0.0 % | 0 | 1 | met | met | 98.5 % of 66 |
| extract | 333 | 100.0 % | 92.2 % | 7.8 % | 0.0 % | 0 | 0 | null | met | 98.5 % of 65 |

## kind_flip readiness

- classify: ready
- extract: not ready — quality margin: free 0.078 > paid 0.000 + 0.05

## Tokens

- classify: paid 31832 · free 203021 · verify 0
- extract: paid 71681 · free 172617 · verify 0

## Audit disagreements (the deterministic verdict stays the record)

- classify: classify:tests/scripts/memory_signal.test.ts#free
- extract: extract:src/skills/conventional-commits-writing/SKILL.md#free

## Path class and frontmatter disagree

- none among the corpus files
