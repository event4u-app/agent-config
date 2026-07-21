# Adversarial-council corpus — subtlety distribution

> Published alongside `corpus.json` per the corpus-validity gate
> (`docs/design/adversarial-council-eval.md`): the corpus must be auditable and
> the residual claim falsifiable. Built 2026-07-21.

## Composition

- **15 fixtures** — 12 planted-defect fixtures + 3 controversial-but-correct clean controls.
- All defect fixtures are authored at **subtlety_tier: high** (designed to survive a single competent review pass), not trivially-detectable hollow impls.

## Defect fixtures by class (12)

| Class | Count | Multi-file? | Fixtures |
|---|---|---|---|
| multi-file-interaction | 3 | yes (2 files each) | mfi-01 keyset-cursor tiebreak omission · mfi-02 non-atomic idempotency check-then-set · mfi-03 one-teardown-per-topic Map overwrite leak |
| logic-inversion | 3 | no | inv-01 RBAC `>=` vs `>` peer-removal · inv-02 pagination `floor` vs `ceil` · inv-03 De Morgan conjunctive-sync inversion |
| security-masked | 3 | no | sec-01 IDOR (ownership check reads body `userId` not session) · sec-02 SSRF (substring allowlist vs parsed host) · sec-03 path-traversal (validate-before-decode) |
| complex-state | 3 | no | state-01 over-fetch `>=` boundary spurious page · state-02 batch reset-after-await lost writes · state-03 missing try/finally connection leak |

## Defect fixtures by category (12)

| Category | Count |
|---|---|
| access-control | 2 (inv-01, sec-01) |
| data-integrity | 2 (mfi-01, inv-03) |
| concurrency | 2 (mfi-02, state-02) |
| resource-leak | 2 (mfi-03, state-03) |
| correctness | 2 (inv-02, state-01) |
| ssrf | 1 (sec-02) |
| path-traversal | 1 (sec-03) |

## Subtlety profile

- **Multi-file interaction:** 3 / 12 (the hardest tier — the defect only manifests from a cross-file contract mismatch; each file reads correctly in isolation).
- **Single-file, plausible-surrounding-code:** 9 / 12 (logic inversions, masked security controls, and rare-state edges where the common path is correct so a shallow read passes).
- **No fixture carries a comment hint or a deliberately hollow / obviously-empty implementation** (that would be the parity-corpus anti-pattern the design doc rejects).

## Clean controls (3) — controversial-but-correct

| id | Controversial pattern | Why it is actually correct |
|---|---|---|
| clean-01 | `value == null` loose equality | canonical safe form: true for null+undefined only, preserves falsy `0`/`''` |
| clean-02 | bitwise `& mask` indexing + power-of-two check + `as T` cast | constructor rejects non-power-of-two so `& mask === % capacity`; cast reads only written slots |
| clean-03 | bare `catch {}` swallowing `mkdir` | post-condition verified independently by the following `stat`; only the benign EEXIST signal is dropped |

## Falsifiability

The residual pool is defined at run time as the defects that survive a strong
2-vendor neutral first pass; the published per-fixture ground truth (defect
location + failing scenario) lets any reader reproduce the scoring and contest
whether a given fixture is genuinely judge-survivable. An independent validity
audit gates the corpus before any paid run.
