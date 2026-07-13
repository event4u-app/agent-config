# Checklist — test-only change

Loaded on demand by [`code-review`](../SKILL.md) when the diff touches **only**
test files (no production-path change).

| Check | What to look for |
|---|---|
| **Behaviour, not implementation** | Tests assert observable behaviour, not internal call sequences that break on refactor. |
| **General, not overfit** | Expected values are derived from inputs / seeded data, not hardcoded to what the code currently emits. |
| **Boundary + error + abuse** | Coverage includes empty/null/max/Unicode, error paths, and — on security paths — an abuse case, not just the happy path. |
| **No hidden production change** | Confirm the diff really is test-only; a "test" that edits a factory/seeder consumed in production is not test-only. |
| **Framework idiom** | Correct conventions for the project's runner — see the stack carve-out. |
| **No flakiness introduced** | Clock frozen, no reliance on execution order or wall-clock timing. |
