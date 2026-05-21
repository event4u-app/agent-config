# Vanilla vs Governed Agent

A side-by-side comparison of how an agent behaves with and without the `agent-config`
rule set active. Three scenarios — chosen to match the **Aha-moment prompts** shown by
`scripts/install.py` after installation.

This document exists so users can see **concretely** what minimal profile changes, without
installing the package just to find out.

## Setup

- **Vanilla**: a capable coding agent, no project rules loaded.
- **Governed**: same agent, with `.augment/rules/` active (minimal profile). The relevant
  always-on rules for these scenarios: `ask-when-uncertain`, `think-before-action`,
  `scope-control`, `verify-before-complete`, `user-interaction`, `improve-before-implement`.

---

## Scenario 1 — "Refactor this function"

User opens a file, selects a 40-line function, says: `Refactor this function`.

| Step | Vanilla | Governed |
|---|---|---|
| 1. Intake | Starts rewriting immediately | Reads the function first (`think-before-action`) |
| 2. Clarification | None | Asks **one** question if goal is ambiguous (`ask-when-uncertain`: "refactor X") |
| 3. Analysis | Implicit | States current structure + target shape in 2-3 lines |
| 4. Change | Full rewrite, may change signature | Keeps signature unless told otherwise (`scope-control`) |
| 5. Verification | "This should work." | Runs the targeted test / explains why verification is not possible |

**What the user notices:** The governed agent asks *what* to optimize for (readability,
performance, testability) instead of picking a direction.

---

## Scenario 2 — "Add caching to this"

User points at an endpoint/method, says: `Add caching to this`.

| Step | Vanilla | Governed |
|---|---|---|
| 1. Intake | Adds a cache wrapper with arbitrary TTL | Triggers **vague-request** rule |
| 2. Questions | None | "Which cache store? What invalidates it? What's the TTL?" |
| 3. Discovery | May invent a `Cache::remember()` pattern | Checks existing cache usage in the codebase first |
| 4. Change | Introduces new conventions | Follows the project's existing cache patterns |
| 5. Confirmation | "Done." | Lists what was changed + known edge cases |

**What the user notices:** The governed agent surfaces **decisions** instead of making
them silently — especially around cache invalidation, the #1 source of caching bugs.

---

## Scenario 3 — "Implement this feature"

User describes a feature loosely, expects the agent to build it.

| Step | Vanilla | Governed |
|---|---|---|
| 1. Intake | Designs architecture freshly | Searches codebase for similar features first (`improve-before-implement`) |
| 2. Duplicates | May reinvent existing helpers | Flags overlap with existing code |
| 3. Scope | Expands freely | Stays within the described scope (`scope-control`) |
| 4. Architecture | Introduces new patterns | Follows established patterns in the same module |
| 5. Completion | Claims done after typing | Runs the minimum verification for the task type (`verify-before-complete`) |

**What the user notices:** The governed agent fits the feature into the *existing* system
instead of building a parallel one.

---

## What's *not* different

Honesty matters — minimal profile is intentionally thin. These things are **the same**
between vanilla and governed:

- Code quality of individual lines
- Speed for trivial tasks ("rename this variable", "add a log line")
- Knowledge of frameworks and libraries
- Creativity when building something new from scratch

The governed agent's advantage shows up on **ambiguous, mid-size, codebase-aware** tasks.
On trivial or greenfield tasks, the difference is small.

---

## Rule audit — friction check

All always-on rules in minimal profile, rated for onboarding friction:

| Rule | Friction | Note |
|---|---|---|
| `ask-when-uncertain` | Low | New users *want* clarifying questions |
| `think-before-action` | Low | Invisible; just changes how the agent responds |
| `scope-control` | Low | Prevents surprise rewrites — net positive |
| `user-interaction` | Low | Numbered options are universally preferred |
| `verify-before-complete` | Medium | Can slow short tasks; balanced by fewer regressions |
| `language-and-tone` | Low | User-configurable; German default suits the project |
| `token-efficiency` | Low | Agent is just quieter by default |
| `context-hygiene` | Low | Kicks in only on long sessions |
| `model-recommendation` | Medium | Can nag if user is on the "wrong" model; dismissible |

**Verdict:** No rule in minimal profile is recommended for removal. Two rules
(`verify-before-complete`, `model-recommendation`) have a one-time adjustment cost
for new users, justified by the value they deliver later.

---

## Skill evaluation

Two proposed skills from Gap 6 — decisions based on this comparison:

| Proposed skill | Decision | Rationale |
|---|---|---|
| `structured-refactoring` | **Defer** | Scenario 1 already improves with existing rules. A skill adds marginal value while increasing surface area. Revisit if users report inconsistent refactoring output. |
| `handle-vague-request` | **Not needed** | Covered by the new vague-request triggers table in `ask-when-uncertain`. A standalone skill would duplicate rule content. |

---

## How to reproduce these scenarios

1. Install agent-config with `cost_profile=minimal`.
2. Open any Laravel / Node / Python project.
3. Try one of the three prompts exactly as shown above.
4. Compare with a fresh chat session where `.augment/` is not loaded.

See `docs/getting-started.md` for the full walkthrough.
