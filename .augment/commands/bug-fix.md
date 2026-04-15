---
name: bug-fix
skills: [bug-analyzer, pest-testing]
description: Plan and implement a bug fix — based on investigation, with quality checks and test verification
disable-model-invocation: true
---

# bug-fix

## Instructions

### 1. Check for prior investigation

- Check if `/bug-investigate` was run in this conversation (context should be loaded).
- If not, ask:

```
⚠️  Has the bug already been analyzed?

1. Yes — I have the context from the previous analysis
2. No — run /bug-investigate first
3. I already know the root cause — start fixing directly
```

If option 3, ask for a brief description of the root cause and affected files.

### 2. Plan the fix

Based on the root cause analysis, create a fix plan:

```
═══════════════════════════════════════════════
  🔧 FIX-PLAN
═══════════════════════════════════════════════

🐛 Bug:    {brief description}
📍 Ursache: {root cause}
🎫 Ticket:  {ticket ID or "none"}

───────────────────────────────────────────────
CHANGES:
───────────────────────────────────────────────

1. 📁 {file1.php}
   → {what to change and why}

2. 📁 {file2.php}
   → {what to change and why}

3. 🧪 Tests
   → {which tests to add/update}

───────────────────────────────────────────────
RISIKO-CHECK:
───────────────────────────────────────────────

  Side effects:     {potential side effects}
  Similar spots:    {other code that might need the same fix}
  Migration needed: {yes/no}
  Breaking change:  {yes/no}

═══════════════════════════════════════════════

> 1. Yes — start implementing
> 2. No — adjust the plan
> 3. Cancel
```

### 3. Implement the fix

For each change:

1. **Read the file** before modifying.
2. **Make the change** using `str-replace-editor`.
3. **Check for downstream effects** — use `codebase-retrieval` to find callers.
4. **Update related code** if signatures or behavior changed.

### 4. Quality checks

After all changes, run quality tools:

```bash
vendor/bin/phpstan analyse           # 1. Check for type errors
vendor/bin/rector process            # 2. Auto-fix refactoring
vendor/bin/ecs check --fix           # 3. Auto-fix code style
vendor/bin/phpstan analyse           # 4. Re-check after Rector/ECS
```

Show results and fix any issues.

### 5. Tests

Check for existing tests that cover the affected code:

```
🧪 Existing tests:
  • {TestFile}::{testMethod} — {what it tests}
  • ...

> 1. Run these tests
> 2. Write new tests for the fix
> 3. Both
> 4. Skip tests for now
```

- **Run affected tests** to verify the fix doesn't break anything.
- **Write new tests** if the bug scenario isn't covered.
- **Run all tests** at the end.

### 6. Show result

```
═══════════════════════════════════════════════
  ✅  FIX IMPLEMENTED
═══════════════════════════════════════════════

🐛 Bug:        {description}
🎫 Ticket:     {ticket ID}

───────────────────────────────────────────────
CHANGES:
───────────────────────────────────────────────

  ✏️  {file1.php} — {summary of change}
  ✏️  {file2.php} — {summary of change}
  🧪 {TestFile.php} — {new/updated test}

───────────────────────────────────────────────
QUALITY:
───────────────────────────────────────────────

  PHPStan:  {✅ passed | ❌ errors}
  Rector:   {✅ no changes | ✏️ auto-fixed}
  Tests:    {✅ all passed | ❌ failures}

═══════════════════════════════════════════════
```

### 7. Offer next steps

```
What next?

1. 🧪 Write more tests
2. 🔍 Check and fix similar spots in the code
3. ✅ Done
```

### Rules

- **Do NOT commit or push** without permission.
- **Always run PHPStan** after changes.
- **Always run affected tests** before declaring the fix done.
- **Check for similar patterns** — if the bug exists in one place, it likely exists elsewhere.
- **Present the fix plan** before implementing — let the user confirm.
- **Update existing tests** that are affected by the change.
- **Write new tests** for the specific bug scenario (regression test).

