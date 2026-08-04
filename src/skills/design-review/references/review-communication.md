# design-review — review communication

> Section-level entry point of the `design-review` skill (progressive
> disclosure, 2026-08-04). Content moved VERBATIM from SKILL.md —
> load this file when the section index in SKILL.md routes here.

## Before / After / Why output format

When reporting a finding with a specific remediation, use this table format:

| Field | Content |
|---|---|
| **Before** | The current state (quote the code, value, or describe the pattern) |
| **After** | The corrected state (specific value or alternative) |
| **Why** | The mechanism: why is Before wrong and After better? (one sentence, states the principle) |

**Wrong format** (do not use):
```
Before:
  button { transition: all 0.3s ease; }
After:
  button { transition: transform 0.2s ease-out, opacity 0.2s ease-out; }
```

**Right format:**

| | |
|---|---|
| **Before** | `transition: all 0.3s ease` |
| **After** | `transition: transform 0.2s ease-out, opacity 0.2s ease-out` |
| **Why** | `transition: all` animates layout properties on every state change, causing browser reflow; enumerate only the properties that move. |

The Why column carries the reasoning — it's the part that teaches the developer
and prevents the same finding from recurring.

## Communication principles

### Problems over prescriptions

Describe **what's wrong and why it matters**, not how to fix it.

```
❌ "Change margin to 16px"
✅ "Spacing feels inconsistent with adjacent elements, creating visual clutter near the CTA."
```

### Triage matrix

Every issue gets a severity:

| Severity | Meaning | Action |
|---|---|---|
| **Blocker** | Must fix before merge | Blocks PR |
| **High** | Should fix before merge | Strong recommendation |
| **Medium** | Consider for follow-up | Suggestion |
| **Nitpick** | Optional polish | Prefix with "Nit:" |

### Evidence-based

Screenshots required for all visual issues. Reference specific viewport and state.

### Start positive

Acknowledge what works well before listing issues.

## Report structure

```markdown
## Design Review Summary
[Positive opening + overall assessment]

### 🚫 Blockers
[Critical issues — must fix]

### ⚠️ High Priority
[Significant issues — should fix]

### 💡 Suggestions
[Improvements for follow-up]

### ✨ Nitpicks
[Minor aesthetic details]

### Testing Evidence
[Screenshots: Desktop, Tablet, Mobile]

### Next Steps
1. [Fix blockers]
2. [Address high-priority]

**Overall: [Ready to merge | Needs revisions]**
```
