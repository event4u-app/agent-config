---
name: bug-fix
description: "bug-fix"
disable-model-invocation: true
---

# bug-fix

## Instructions

### 1. Check for prior investigation

- Check if `/bug-investigate` was run (context loaded).
- If not:

```
⚠️  Has the bug already been analyzed?

1. Yes — I have the context from the previous analysis
2. No — run /bug-investigate first
3. I already know the root cause — start fixing directly
```

If option 3, ask for a brief description of the root cause and affected files.

### 2. Plan the fix

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

Per change: read file → `str-replace-editor` → check downstream (`codebase-retrieval`) → update related code.

### 4. Quality checks

```bash
vendor/bin/phpstan analyse           # 1. Check for type errors
vendor/bin/rector process            # 2. Auto-fix refactoring
vendor/bin/ecs check --fix           # 3. Auto-fix code style
vendor/bin/phpstan analyse           # 4. Re-check after Rector/ECS
```

Fix any issues.

### 5. Tests

```
🧪 Existing tests:
  • {TestFile}::{testMethod} — {what it tests}
  • ...

> 1. Run these tests
> 2. Write new tests for the fix
> 3. Both
> 4. Skip tests for now
```

Run affected tests → write new if scenario uncovered → run all at end.

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

- Do NOT commit/push without permission
- Run PHPStan + affected tests before declaring done
- Check for similar patterns elsewhere
- Present fix plan before implementing
- Write regression test for bug scenario
