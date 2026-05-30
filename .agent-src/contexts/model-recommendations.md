# Model Recommendations

Loaded by the `model-recommendation` rule. Expresses recommendations as
**vendor-neutral capability tiers** (`lite | medium | high`, ADR-035), never
vendor model names. Each agent resolves a tier to its own best model in that
band; the package's only tier→model mapping is the Claude generator's
(`high→opus`, `medium→sonnet`, `lite→haiku`).

## Tier Profiles

| Tier | Band | Claude resolution | Use for |
|---|---|---|---|
| `high` | strongest reasoning | Opus | Architecture, refactoring, complex debugging, code review, design decisions, multi-file changes, large-scale analysis / research / planning |
| `medium` | balanced daily | Sonnet (latest) | Daily coding, known-cause bug fixes, tests, single-layer features, quality checks, config, documentation, implementation after a `high`-tier plan |
| `lite` | fastest / cheapest | Haiku | Trivial mechanical edits — formatting, one-line config, rote renames, boilerplate stamping |
| `inherit` | — | (session model) | Genuinely model-agnostic / meta work |

Long context is **orthogonal** to the tier (ADR-035): a skill that must read a
very large input declares the optional `context: large` modifier *in addition*
to its tier (e.g. `high` + `context: large` for large-codebase analysis). The
tier is the reasoning band; `context: large` is the context-window need.

## Task → Tier Mapping

| Task Type | Tier | Why |
|---|---|---|
| **Architecture / Refactoring** | `high` | Deep structural reasoning, pattern recognition |
| **Code review** | `high` | Catches subtle issues, understands intent |
| **Complex debugging** (unknown root cause, cross-layer) | `high` | Follows chains across files and systems |
| **Design decisions** | `high` | Weighs trade-offs, considers long-term |
| **Multi-file feature** (cross-domain / architecture relevant) | `high` | Maintains coherence across layers |
| **Large codebase analysis / research / planning** | `high` (+ `context: large`) | Strong reasoning over a long input |
| **Debugging** (known issue, reproducible) | `medium` | Fast, efficient fixes |
| **Write tests** | `medium` | Pattern-based, no deep reasoning required |
| **Single-layer feature** (CRUD, same layer) | `medium` | Straightforward implementation |
| **Quality checks** (linters, type-checks, formatters) | `medium` | Mechanical fixes, fast iteration |
| **Config changes** | `medium` | Simple edits |
| **Documentation** | `medium` | Clear writing, fast output |
| **Implementation after a `high`-tier plan** | `medium` | Plan is done, execution is mechanical |
| **Trivial mechanical** (formatting, one-line config, rote rename) | `lite` | No reasoning required; fastest tier suffices |

## Detection Heuristics

| Signal | Task Type | Tier |
|---|---|---|
| "refactor", "restructure", "extract", "move to module" | Architecture / Refactoring | `high` |
| PR review request | Code review | `high` |
| "bug" with unclear cause or spanning multiple layers | Complex debugging | `high` |
| "should I", "which approach", "what pattern" | Design decision | `high` |
| Feature touching multiple domains/layers | Multi-file feature | `high` |
| "analyze project", "scan codebase", research / roadmap creation | Large analysis / planning | `high` + `context: large` |
| "bug" with clear error and reproducible case | Debugging (known) | `medium` |
| Feature within same layer (controller/service CRUD) | Single-layer feature | `medium` |
| linters / type-checks / formatters | Quality checks | `medium` |
| "config", "env", "docker", "CI" | Config changes | `medium` |
| "README", "docs", comments | Documentation | `medium` |
| `high`-tier work just finished | Implementation phase | `medium` |
| pure formatting / rote rename / boilerplate | Trivial mechanical | `lite` |

## Senior Developer Mindset — for ALL tiers

These instructions apply regardless of the tier. They help the `medium`/`lite`
tiers produce `high`-tier-quality output by enforcing habits weaker models skip.

### Before writing code

- **Think before you type.** Read the surrounding code, understand the context, check conventions.
  Do NOT start coding from the first line of the user's message.
- **Check for existing patterns.** Search the codebase for how similar things are done.
  Follow the existing pattern — do NOT invent a new one.
- **Question assumptions.** If the user asks "add a method to X", verify that X is the right place.

### While writing code

- **Consider downstream impact.** Every change affects callers, tests, types, and imports.
  Check them BEFORE presenting the result — not as an afterthought.
- **Name things like a senior.** Naming reveals understanding. If you can't name it well, you don't understand it well enough yet.
- **Handle edge cases.** Null checks, empty arrays, missing config — don't write only the happy path.

### After writing code

- **Self-review.** Re-read it as if reviewing someone else's PR. Would you approve it?
- **Verify, don't assume.** Run the test, check the output, read the error. "Should work" is not proof.

### When stuck

- **Stop after 2 failed attempts.** Don't loop — rethink the approach or ask the user.
- **Admit uncertainty.** "I'm not sure about X" beats a confident wrong answer.
- **Ask one good question** instead of guessing three times.

## Cost Optimization

- **Default to `medium`** — the cost-efficient daily workhorse.
- **Escalate to `high`** only for architecture, refactoring, design, or unclear debugging.
- **Drop to `lite`** for genuinely trivial mechanical work.
- **After `high`-tier work** (architecture plan, refactoring design, root cause found):
  → recommend switching back to `medium` for implementation.

## Recommendation Flow

### When to check

- **At conversation start**: detect the active model from the system-prompt identity.
- **When the task type clearly changes**: user switches from one category to another.
- **NOT on every message** — only on clear task boundaries.

### When to recommend

Only if ALL are true:
1. The detected task type maps to a DIFFERENT tier than the active model's band.
2. The mismatch is significant (e.g. a `lite`/`medium` model doing architecture).
3. You haven't already recommended for this task in this conversation.

### Switch confirmation flow

- User says they switched → accept and continue, no follow-up. Trust the user.
- User says they want to stay → accept immediately, no pushback. Don't ask again until the task type changes.

### Downgrade reminder

After completing a `high`-tier task (architecture plan done, refactoring complete,
root cause found), remind the user to drop to the **`medium`** tier for the
implementation phase:

```
> 💡 The {architecture/debugging/design} phase is done.
> For implementation, your **medium**-tier model is more cost-efficient.
>
> 1. I've switched to the medium tier — continue
> 2. Stay on the current model
```

### Gemini warning

If the detected model is `gemini`: Gemini is **not recommended** for this
project. The codebase relies heavily on structured agent rules, skills, and
conventions that Gemini handles poorly compared to Claude / GPT-class models.

- Suggest switching to the best model for the current task's **tier**
  (`high`/`medium`/`lite` — resolved to the user's strongest/balanced/fastest model).
- Show the same numbered options as for a regular mismatch.
- If dismissed, repeat the warning **once more** — then accept the user's choice.
