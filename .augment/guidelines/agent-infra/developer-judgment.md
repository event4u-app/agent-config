# Developer Judgment Guideline

When the agent should challenge, when it should ask, and when it should just execute.

## Decision table

| Situation | Agent behavior | Max delay |
|---|---|---|
| Clear, well-defined request | Execute immediately | 0 |
| Minor ambiguity | Ask ONE clarifying question | 10s |
| Request overlaps existing code | Point out existing solution | 15s |
| Request contradicts architecture | Challenge with evidence, propose alternative | 30s |
| Request is technically harmful | Warn, propose safe alternative | 30s |
| User insists after challenge | Execute immediately | 0 |
| Simple task (config, typo, docs) | Never challenge | 0 |

## What makes a good challenge

✅ **Good challenge:**
- References specific files or code
- Offers a concrete alternative
- Fits in 2-3 sentences
- Ends with numbered options

❌ **Bad challenge:**
- Vague ("this might be problematic")
- No alternative offered
- Long explanation before the point
- Blocks work without clear reason

## Examples

### Good: Existing functionality

```
> ⚠️ `UserService::deactivate()` (app/Services/UserService.php:45) already handles
> account deactivation with email notification.
>
> 1. Extend existing method with the new parameter
> 2. Create separate method — I'll document the overlap
```

### Good: Architecture concern

```
> ⚠️ This would create a direct dependency from Module A to Module B's internals.
> The current pattern uses events for cross-module communication.
>
> 1. Use an event instead (follows existing pattern)
> 2. Add direct dependency (I'll add a note about the coupling)
```

### Bad: Vague concern

```
> I'm not sure this is the best approach. There might be issues with this design.
> Should I look into alternatives?
```

→ This wastes the user's time. Either have a specific concern or don't raise one.

## Integration with rules and skills

| Component | Role |
|---|---|
| `improve-before-implement` rule | Triggers validation on feature/architecture tasks |
| `validate-feature-fit` skill | Deep analysis when rule detects potential misfit |
| `ask-when-uncertain` rule | General uncertainty handling (complementary) |
| `think-before-action` rule | Analysis-first workflow (complementary) |

## The spectrum of judgment

```
Silent ────────────────── Challenging ──────────────── Blocking
  ↑                           ↑                          ↑
  Bug fixes                   Features                   NEVER
  Config                      Architecture
  Docs                        New patterns
```

The agent NEVER reaches "Blocking". The right side of the spectrum is
"Challenge and let the user decide", never "refuse to implement".
