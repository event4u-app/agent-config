---
type: "auto"
tier: "2a"
description: "Prohibits placeholder-prose output in generated code and UI — no truncation shorthands; on budget overflow emit a clean PAUSED breakpoint instead"
triggers:
  - intent: "generating code, UI components, or multi-section output"
  - keyword: "// rest of component"
  - keyword: "for brevity"
  - keyword: "rest follows the same pattern"
  - phrase: "similar pattern"
workspaces:
  - engineering
packs:
  - engineering-base
---

# Output Discipline

## Iron Law — no placeholder prose in emitted code

```
NEVER EMIT PLACEHOLDER PROSE IN GENERATED CODE OR UI.
PLACEHOLDER PROSE IS INCOMPLETE OUTPUT, NOT A STYLE CHOICE.
ON BUDGET OVERFLOW: EMIT A CLEAN PAUSED MARKER. NEVER TRUNCATE SILENTLY.
```

## Banned placeholder patterns

The following patterns are **absolutely banned** in generated code, components,
templates, and UI markup. They signal "I gave up midway" and leave the codebase
in a broken state:

| Banned pattern | What to do instead |
|---|---|
| `// rest of component` | Write the rest of the component. If budget runs out, emit `[PAUSED]` marker |
| `// ... (unchanged)` | Emit the unchanged code or omit it from the diff with a clean explanation of what was NOT changed |
| `// TODO: implement` | Implement it. If genuinely deferred, name the deferral explicitly in the brief, not in the code |
| `/* similar pattern */` | Write the similar pattern in full |
| `"for brevity"` in code comments | There is no brevity in broken code |
| `// rest follows same pattern` | Follow the same pattern — write it |
| `...` / `…` as an ellipsis replacing code content | Write the content |
| `[Your component here]` / `<YourComponentName>` | Use the actual component name or write the component |
| `Lorem ipsum` / `dolor sit amet` in UI output intended for review | Use realistic placeholder content or ask for content |

The banned patterns above are also detected by `lint_output_slop.ts` (see
`src/scripts/lint_output_slop.ts`) — violations cause a CI exit-code-2.

## On budget overflow — PAUSED protocol

When output genuinely reaches a context budget limit mid-generation:

1. Complete the current logical unit (function body, component, section).
2. Emit a clean breakpoint marker on its own line:
   ```
   [PAUSED — section X of Y complete. Continue prompt: "continue from <last-completed-unit>"]
   ```
3. Stop. Do **not** truncate with `// rest follows...` or `...`.

The user will prompt "continue" and the next turn resumes cleanly from the
named unit.

## Interaction with `verify-before-complete`

`verify-before-complete` requires fresh verification before claiming work is
done. `output-discipline` adds the pre-condition: **there must be nothing to
verify that was never written**. A component with `// rest of component` is
not a complete artifact — it cannot be verified, it cannot be committed.

## Inline-ignore escape (for legitimate edge cases)

In the rare case where a pattern above is intentional (e.g., a documentation
example showing what NOT to do), use the inline-ignore escape:

```javascript
// lint-output-slop-disable-next-line impl-placeholder -- showing a negative example in documentation
// rest of component
```

Or for a whole file: `// lint-output-slop-disable-file impl-placeholder -- test fixture`

## See also

- `verify-before-complete` — no completion claim without evidence
- `downstream-changes` — every edit is incomplete until all callers are updated
- `src/scripts/lint_output_slop.ts` — the CI linter enforcing this rule
