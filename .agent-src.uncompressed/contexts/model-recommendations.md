# Model Recommendations

Loaded by the `model-recommendation` rule when the agent detects a task type mismatch.

## Model Profiles (as of 2026-04)

| Model | Alias | Strengths |
|---|---|---|
| Claude Opus | `opus` | Refactoring, architecture decisions, complex debugging, code review, multi-file changes, design patterns |
| Claude Sonnet | `sonnet` | Daily coding, bug fixes, tests, simple features, quality checks, quick tasks |
| GPT | `gpt` | Large-scale analysis, multi-step workflows, automation, research, planning |

## Task → Model Mapping

| Task Type | Recommended | Why |
|---|---|---|
| **Architecture / Refactoring** | `opus` | Deep structural reasoning, pattern recognition |
| **Code review** | `opus` | Catches subtle issues, understands intent |
| **Complex debugging** (unknown root cause, cross-layer) | `opus` | Follows chains across files and systems |
| **Design decisions** | `opus` | Weighs trade-offs, considers long-term |
| **Multi-file feature** (cross-domain / architecture relevant) | `opus` | Maintains coherence across layers |
| **Debugging** (known issue, reproducible) | `sonnet` | Fast, efficient fixes |
| **Write tests** | `sonnet` | Pattern-based, no deep reasoning required |
| **Single-layer feature** (CRUD, same layer) | `sonnet` | Straightforward implementation |
| **Quality checks** (PHPStan, ECS, Rector) | `sonnet` | Mechanical fixes, fast iteration |
| **Config changes** | `sonnet` | Simple edits |
| **Documentation** | `sonnet` | Clear writing, fast output |
| **Implementation after Opus planning** | `sonnet` | Plan is done, execution is mechanical |
| **Large codebase analysis** | `gpt` | Handles long context efficiently |
| **Pattern search across files** | `gpt` | Efficient scanning and summarization |
| **Agent workflows / automation** | `gpt` | Multi-step orchestration |
| **Research / analysis** | `gpt` | Structured thinking, long context |
| **Roadmap creation** | `gpt` | Planning and structured output |

## Detection Heuristics

| Signal | Task Type |
|---|---|
| "refactor", "restructure", "extract", "move to module" | Architecture / Refactoring |
| PR review request | Code review |
| "bug" with unclear cause or spanning multiple layers | Complex debugging |
| "bug" with clear error and reproducible case | Debugging (known issue) |
| "should I", "which approach", "what pattern" | Design decision |
| Feature touching multiple domains/layers | Multi-file feature |
| Feature within same layer (e.g. controller/service CRUD) | Single-layer feature |
| "PHPStan", "ECS", "Rector" | Quality checks |
| "config", "env", "docker", "CI" | Config changes |
| "README", "docs", comments | Documentation |
| "analyze project", "scan codebase" | Large codebase analysis |
| /feature-plan, /roadmap-create, /project-analyze | Research / planning |
| "automate", "workflow", "agent flow" | Agent workflows / automation |
| Opus just finished architecture/refactoring/debugging | Implementation after Opus planning |

## Senior Developer Mindset — for ALL models

These instructions apply regardless of the model. They help Sonnet and GPT
produce opus-level quality by enforcing habits that weaker models skip by default.

### Before writing code

- **Think before you type.** Read the surrounding code, understand the context, check conventions.
  Do NOT start coding from the first line of the user's message.
- **Check for existing patterns.** Search the codebase for how similar things are done.
  Follow the existing pattern — do NOT invent a new one.
- **Question assumptions.** If the user asks "add a method to X", verify that X is the right place.
  A senior suggests a better location if appropriate.

### While writing code

- **Consider downstream impact.** Every change affects callers, tests, types, and imports.
  Check them BEFORE presenting the result — not as an afterthought.
- **Name things like a senior.** Variables, methods, classes — naming reveals understanding.
  If you can't name it well, you don't understand it well enough yet.
- **Handle edge cases.** Null checks, empty arrays, missing config — think about what can go wrong.
  Don't write only the happy path.

### After writing code

- **Self-review.** Before presenting code to the user, re-read it as if reviewing someone else's PR.
  Would you approve it? If not, fix it first.
- **Verify, don't assume.** Run the test, check the output, read the error. "Should work" is not proof.

### When stuck

- **Stop after 2 failed attempts.** Don't loop — rethink the approach or ask the user.
- **Admit uncertainty.** "I'm not sure about X" is better than a confident wrong answer.
- **Ask one good question** instead of guessing three times.

## Cost Optimization

- **Default to `sonnet`** — it's the cost-efficient workhorse.
- **Escalate to `opus`** only when architecture, refactoring, or unclear debugging is involved.
- **After Opus work** (architecture plan, refactoring design, root cause found):
  → Recommend switching back to `sonnet` for implementation.
- **Use `gpt`** for large-scale analysis, searching across many files, or automation.

## Recommendation Flow

### When to check

- **At conversation start**: detect model from system prompt identity
- **When task type clearly changes**: user switches from one category to another
- **NOT on every message** — only on clear task boundaries

### When to recommend

Only if ALL conditions are true:
1. The detected task type maps to a DIFFERENT model than the detected model
2. The mismatch is significant (e.g., sonnet doing architecture, not sonnet doing a slightly complex bug fix)
3. You haven't already recommended for this task in this conversation

### Switch confirmation flow

When user says they switched:
- Accept and continue. No follow-up question — trust the user.

When user says they want to continue with the current model:
- Accept immediately — no pushback.
- Don't ask again until the task type changes significantly.

### Downgrade reminder

After completing an opus-level task (architecture plan done, refactoring complete, root cause found),
remind the user to switch back to sonnet for the implementation phase:

```
> 💡 The {architecture/debugging/design} phase is done.
> For implementation, **sonnet** is more cost-efficient.
>
> 1. I've switched to sonnet — continue
> 2. Stay on opus
```

### Gemini warning

If detected model is `gemini`: Gemini is **not recommended** for this project.
The codebase relies heavily on structured agent rules, skills, and conventions
that Gemini handles poorly compared to Claude/GPT models.

- Suggest switching to the best model for the current task (opus/sonnet/gpt).
- Show the same numbered options as for a regular mismatch.
- If dismissed, repeat the warning **once more** — then accept the user's choice.
