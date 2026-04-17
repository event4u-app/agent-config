# Product Maturity Roadmap

Source: GPT system-level review of PR #6 (April 2026).
**Rating: 8.8/10** — technically strong, but user experience lags behind system quality.

## Core Insight

> We have built a very good **system**. We haven't yet built a very good **product**.
> The backend is strong. The frontend (user experience) is lagging.

## Current State Assessment

| Area | Status | Detail |
|---|---|---|
| Settings / Cost Control | ✅ Excellent | Features present but not auto-active. Token control works. |
| Runtime + Observability + Feedback | ✅ Good | Loop exists: linter → CI → reports → feedback. But not yet consumed. |
| Structure / Architecture | ✅ Excellent | Clear layers, clear responsibilities, clear extensibility. |
| Agent Controllability | ✅ Good | `.agent-settings` provides feature flags and cost profiles. |
| Profile System | ❌ Missing | Many settings, no clear "start here" defaults. User asks "what do I enable?" |
| Feedback Consumption | ⚠️ Stored, not used | feedback.json exists, but agent doesn't act on it. |
| Runtime Visibility | ⚠️ Invisible | User doesn't notice when runtime is active or what it does. |
| Observability Relevance | ⚠️ Risk of overkill | metrics, events, audit, feedback, reports — cool for devs, invisible to users. |
| User Journey | ❌ Missing | No clear path: install → start → see value → extend. |

---

## Gap 1: No clear default / Profile system missing

**Problem:** Many settings, many features, but no clear entry point.
User asks: "What should I enable?" and finds no answer.

**Risk:** Wrong settings → wrong expectations → frustration.

**Solution:** Profile system — predefined, documented settings combinations.

### Design principles

1. **Profiles set defaults** — a profile is just a named settings combination
2. **User overrides stay possible** — individual settings in `.agent-settings` override the profile
3. **Profiles are not magic** — they are transparent and documented

### Priority logic (resolution order)

1. Load matrix defaults from `cost_profile=` in `.agent-settings`
2. Read `.agent-settings` for explicit matrix overrides
3. Apply explicit overrides on top of profile defaults

This ensures profiles aren't too rigid — users can deviate on any single matrix value.

### Settings matrix

Authoritative matrix lives in `.augment/templates/agent-settings.md`. Snapshot here for
roadmap context:

| Setting | `minimal` | `balanced` | `full` |
|---|---|---|---|
| `runtime_enabled` | false | true | true |
| `observability_reports` | false | true | true |
| `feedback_collection` | false | true | true |
| `runtime_auto_read_reports` | false | false | true |
| `max_report_lines` | 30 | 50 | 100 |
| `minimal_runtime_context` | true | true | false |
| `ci_summary_enabled` | false | false | true |
| `feedback_suggestions_in_chat` | false | false | true |
| `skill_improvement_pipeline` | false | false | true |

### Profile descriptions

**`minimal`** — governance only, zero overhead
- For: new users, solo devs, first-time adoption
- Active: rules + skills + commands only
- Token cost: zero additional overhead
- Default for all installs

**`balanced`** — recommended for most teams
- For: small-medium teams wanting good quality with controlled overhead
- Active: + runtime, limited observability, feedback persisted locally
- Token cost: low

**`full`** — everything on
- For: platform teams, agent infrastructure work, debugging
- Active: reports auto-read, CI summaries, feedback in chat, skill improvement pipeline
- Token cost: moderate

**`custom`** — opt out of the profile
- Every matrix value must be set explicitly in `.agent-settings`
- No profile defaults applied

### Guardrails (hard rules)

1. **`runtime_auto_read_reports=false` in minimal + balanced** — prevents silent prompt bloating
2. **`minimal_runtime_context=true` in minimal + balanced** — runtime helps, doesn't bloat
3. **`ci_summary_enabled`, `feedback_suggestions_in_chat`, `skill_improvement_pipeline` opt-in only** — active only in `full`

### Profile files (done)

Profiles live as slim `.ini` files containing only the profile marker. The full matrix
is defined in `.augment/templates/agent-settings.md`.

```
config/profiles/
├── minimal.ini   (cost_profile=minimal)
├── balanced.ini  (cost_profile=balanced)
└── full.ini      (cost_profile=full)
```

Personal and project settings come from `config/agent-settings.template.ini` (merged by
`bin/install.php` with the chosen profile into `.agent-settings`).

### Recommended defaults

| Audience | Recommended profile |
|---|---|
| New users / first install | `minimal` |
| Most teams | `balanced` |
| Platform teams / agent infra | `full` |

### Tasks

- [x] Create profile .ini files in `config/profiles/` directory (slim, marker-only)
- [x] `bin/install.php` sets `cost_profile=minimal` by default via `config/agent-settings.template.ini`
- [x] Create `.agent-settings` template with `cost_profile=minimal` as default
- [x] Validate: unknown profile name → error with list of valid profiles
- [x] Document profiles in `.augment/templates/agent-settings.md` with full matrix
- [x] Profile switching without reinstall (just change `cost_profile=` in `.agent-settings`)
- [ ] Implement matrix resolution in agent runtime (read `cost_profile`, apply matrix, honour overrides)
- [x] Profile auto-detection: if runtime package installed → suggest `balanced` (`suggest_profile_upgrade()` in `scripts/install.py`; detects `vendor/event4u/agent-config-runtime` and `node_modules/@event4u/agent-config-runtime`)
- [x] Add profile section to README (see "You don't need everything" section with Minimal/Balanced/Full table)

### Success metric
New user installs, does NOT configure anything, and gets a good experience.
That's `minimal` profile working silently. No JSON files created, no overhead, just better agent behavior.

---

## Gap 2: Feedback exists but is not consumed

**Problem:** feedback.json and metrics are collected but the agent doesn't use them.
This is dangerous: complexity without direct value.

**Risk:** Users see files being generated but no improvement. "Why does this exist?"

### Feedback Consumption Strategy

Define **who** consumes feedback and **how**:

| Consumer | What it uses | How | Priority |
|---|---|---|---|
| **CI pipeline** | Regression data, failure patterns | ci_summary.py reads feedback.json → PR comment | ✅ Already works |
| **Skill linter** | Health scores, usage frequency | Linter reads metrics → warns on unhealthy skills | ✅ Partially works |
| **Agent (on request)** | Past failures, improvement suggestions | Agent reads feedback ONLY when asked or when `cost_profile=full` | 🟡 Not yet |
| **Agent (automatic)** | Pattern detection, repeated failures | Opt-in via explicit overrides on `full` (no dedicated tier) | 🔴 Not yet |
| **Developer (reports)** | Dashboard, lifecycle, health | `task report-stdout` reads all data | ✅ Works |

### Tasks

- [x] Define feedback consumption rules per profile (see `agents/docs/feedback-consumption.md`)
- [x] `minimal` + `balanced`: feedback stored, never auto-injected (matrix + design doc)
- [x] `full`: feedback available on request ("show me recent failures") and suggestions in chat (design doc)
- [x] Pattern auto-injection: explicit opt-in via override, not a separate profile tier (design doc)
- [x] Document: "feedback.json exists for CI and reports, not for the agent by default" (`agents/docs/feedback-consumption.md`)
- [x] Consider: should feedback influence skill selection? — **No** (see design doc "Open questions")

### Anti-pattern to avoid
Do NOT build a system where feedback auto-generates rules or modifies skills without human review.
Feedback → suggestion → human approval → change. Never: feedback → automatic change.

---

## Gap 3: Runtime is invisible

**Problem:** User doesn't notice when runtime is active, what skills are executing,
or what difference it makes. Runtime exists but has no "surface area".

**Risk:** Users install runtime package, enable it, and see... nothing different.

### Tasks

- [x] Define what "runtime is active" looks like to the user (3 levels: silent/subtle/verbose in `agents/docs/runtime-visibility.md`)
- [x] Output format for runtime executions: `▸ runtime: skill-name (assisted)` prefix (design doc)
- [x] Do NOT make runtime noisy — subtle indicators, not debug spam (non-negotiables in design doc)
- [x] Document: "What does runtime do? Why should I enable it?" (`agents/docs/runtime-visibility.md`)
- [x] Before/After comparison: agent behavior with runtime off vs on (`agents/docs/vanilla-vs-governed.md` covers the rule side; runtime section to be added when runtime package exists)

### Key principle
Runtime should feel like **"the agent got smarter"**, not **"the agent got more verbose"**.


---

## Gap 4: Observability could become overkill

**Problem:** metrics, events, audit, feedback, reports — a lot of infrastructure.
Cool for maintainers. Invisible and irrelevant to most users.

**Risk:** "Why are there 5 JSON files in my project that I never look at?"

### Solution: Clear separation of audiences

| Feature | Audience | Default active | Profile |
|---|---|---|---|
| Skill linter | Package developers | Always (dev only) | All |
| CI summary | PR reviewers | Only in CI | All |
| metrics.json | Package developers | No | `full`+ |
| feedback.json | Package developers, CI | No | `balanced`+ |
| tool-audit.json | Package developers | No | `full`+ |
| report-stdout | Package developers | On request | All |
| Lifecycle reports | Package developers | On request | `full`+ |

### Tasks

- [x] Classify every observability feature: user-facing vs developer-facing (audience table in `agents/docs/observability-scoping.md`)
- [x] User-facing: CI summary, linter warnings — always available (Taskfile targets)
- [x] Developer-facing: metrics, feedback, audit — opt-in only (file creation matrix in design doc)
- [x] No observability files created by default in `minimal` profile (enforced by installer + design doc; runtime enforcement pending runtime package)
- [x] Document: "Observability features are for package maintainers, not end users" (`agents/docs/observability-scoping.md`)

---

## Gap 5: No clear user journey — First 5 Minutes Experience

**Core UX principle:** The user must not understand the system — they must **experience** it.
No theory first. No settings discussion. User acts, sees the difference, then (optionally) learns why.

**Current experience:**
1. Install → works
2. ... now what? Understand the system?
3. Configure settings?
4. Hope it works?

**Target experience:**
1. Install → works immediately (minimal profile, zero config)
2. Use agent → agent behaves noticeably differently
3. See value → "this is better than before"
4. Understand why → optional, after the aha-moment
5. Extend → add runtime, tools, observability when ready

### The First 5 Minutes — Detailed UX Flow

#### Minute 0-1: Installation

User does exactly ONE thing:

```bash
composer require --dev event4u/agent-config-core
bash vendor/event4u/agent-config-core/scripts/setup.sh
```

Output:
```
✅ agent-config installed. Profile: minimal.
Your agent now analyzes before coding and follows your team's standards.

Try it: ask your agent to "refactor this function".
```

What happens in the background:
- Rules active (think-before-action, ask-when-uncertain, improve-before-implement, etc.)
- Core skills active (30 skills)
- Core commands active (20 commands)
- No runtime overhead, no reports, no token explosion
- System is light but effective

#### Minute 1-2: First real interaction (AHA MOMENT #1)

User follows the prompt from install output:

```
"Refactor this function"
```

**Expected agent behavior (different from vanilla):**
- Does NOT immediately start coding
- Analyzes the function first
- Checks existing patterns in the codebase
- May ask clarifying questions
- Proposes structured changes with reasoning

**The aha-moment:** "Oh — the agent thinks first."

#### Minute 2-3: Vague request test (AHA MOMENT #2)

User gives an intentionally vague request:

```
"Add caching to this"
```

**Expected agent behavior:**
- Does NOT guess what "this" means
- Asks: "Which layer? Redis? Application cache? Query cache?"
- Validates against existing caching patterns
- Proposes approach before implementing

**The aha-moment:** "It doesn't just do random stuff."

#### Minute 3-4: Feature implementation test (AHA MOMENT #3)

User requests a real feature:

```
"Implement this feature"
```

**Expected agent behavior:**
- Reads existing code patterns
- Follows project conventions (naming, structure, testing)
- Considers existing architecture
- Does NOT build isolated new structure that ignores what's there

**The aha-moment:** "It works like a developer, not like ChatGPT."

#### Minute 4-5: Explainer + optional upgrade

NOW (and only now) the user gets context:

```
What you just experienced:
- Agent analyzes before acting (think-before-action rule)
- Agent asks instead of guessing (ask-when-uncertain rule)
- Agent respects existing code (improve-before-implement rule)

This is enforced automatically. No configuration needed.

Want more? Set cost_profile=balanced in .agent-settings to enable:
- Runtime execution layer
- Better validation
- Limited observability
Still cost-controlled.
```

### Three tests, three aha-moments

| Test | What it shows | User thinks |
|---|---|---|
| "Refactor this function" | Agent analyzes first | "Oh, it thinks before acting" |
| "Add caching to this" | Agent asks instead of guessing | "It doesn't just make stuff up" |
| "Implement this feature" | Agent respects existing code | "It works like a real developer" |

### What must work for this flow

**Must be active (in minimal profile):**
- `think-before-action` rule — agent analyzes before coding
- `ask-when-uncertain` rule — agent asks instead of guessing
- `improve-before-implement` rule — agent validates before building
- `scope-control` rule — agent doesn't over-engineer
- `verify-before-complete` rule — agent verifies with real execution
- Core skills for the user's domain (Laravel, PHP, testing, etc.)

**Must NOT happen:**
- No runtime overhead visible
- No JSON files created
- No extra prompting about settings or profiles
- No "understanding the system" required

### Anti-patterns to avoid in UX design

- ❌ **Explaining before testing** — kills the aha-moment
- ❌ **Settings first** — overwhelms immediately
- ❌ **No concrete example** — user doesn't know what to do
- ❌ **Too many options** — decision fatigue
- ❌ **"Read the docs to get started"** — install must work without reading anything

### Optional: CLI support for guided first run

```bash
task first-run
```

Output:
```
🚀 First Run Guide

Your agent-config is active with profile: minimal

Try these 3 things to see the difference:

1. Ask: "Refactor this function"
   → Watch: agent analyzes before coding

2. Ask: "Add caching to this"
   → Watch: agent asks clarifying questions

3. Ask: "Implement this feature"
   → Watch: agent respects your existing codebase

After that, check docs/getting-started.md for next steps.
```

### Tasks

- [x] Design install.sh success output with try-it prompt (3 aha-moment prompts in `scripts/install.py`)
- [x] Create `docs/getting-started.md` with the 3-test flow
- [x] Verify: think-before-action, ask-when-uncertain, improve-before-implement
  rules are always-active in minimal profile (see `.augment/rules/`)
- [x] `task first-run` CLI guide (`Taskfile.yml` target → `scripts/first-run.sh`)
- [x] `/agent-status` command showing conversation stats (see `.augment/commands/agent-status.md`)
- [x] Add "What you just experienced" section to getting-started.md
- [ ] Test the flow with a fresh project: is the difference obvious in 5 minutes? (manual validation, requires external project)

---

## Gap 6: Minimal mode must feel magical

**The most important sentence:**
> The user must not understand the system — they must **experience** it.

**Target:** User installs `core` with `minimal` profile and feels:
> "This agent is better. It thinks before acting, catches mistakes,
> and follows conventions I didn't even know I had."

### What "magical" means concretely

After install, without ANY configuration, the agent:
1. Analyzes code before changing it (visible: agent reads files, traces flow)
2. Asks when requirements are unclear (visible: numbered options, specific questions)
3. Follows coding standards (visible: consistent naming, patterns, structure)
4. Writes structured commits (visible: Conventional Commits format)
5. Validates before claiming done (visible: runs tests, quality checks)

These 5 behaviors should be **immediately noticeable** to any developer.

### Rules & Skills alignment for the 3 aha-moments

The 3 tests in the First 5 Minutes flow MUST work reliably. Here's which rules/skills
power each test and what might need adjustment.

**Test 1: "Refactor this function" → agent analyzes first**

| What powers this | Already exists | Status |
|---|---|---|
| `think-before-action` rule (always) | ✅ Yes | Strong. Developer Workflow (Understand → Analyze → Plan → Implement → Verify) |
| `scope-control` rule (always) | ✅ Yes | "Stay within established project structure" |
| `developer-like-execution` skill | ✅ Yes | Think → analyze → verify → execute workflow |
| Dedicated "structured-refactoring" skill | ❌ No | **Consider creating.** GPT suggested this — a skill specifically for structured, safe refactoring with analysis → goals → approach → apply → validate steps. |

**Potential gap:** No dedicated refactoring skill. The rules enforce analysis-first behavior,
but a refactoring-specific skill would ensure the OUTPUT is consistently structured
(short analysis → explanation → improved code → validation).

**Test 2: "Add caching to this" → agent asks instead of guessing**

| What powers this | Already exists | Status |
|---|---|---|
| `ask-when-uncertain` rule (always) | ✅ Yes | Good, but triggers could be more explicit |
| `improve-before-implement` rule (auto) | ✅ Yes | "Is the request clear?" check |
| Dedicated "handle-vague-request" skill | ❌ No | **Consider creating.** A skill for detecting ambiguity, identifying missing info, and asking targeted clarification questions. |

**Potential gap:** `ask-when-uncertain` says "when in doubt, ask" but doesn't explicitly
list vague-request patterns. Consider adding explicit triggers:
```
Agent MUST ask if request matches: "improve", "optimize", "add caching",
"make it better", "clean up", "fix this" (without specifying what's broken).
```

**Test 3: "Implement this feature" → agent respects existing code**

| What powers this | Already exists | Status |
|---|---|---|
| `improve-before-implement` rule (auto) | ✅ Yes | "Does it fit existing architecture?" check |
| `scope-control` rule (always) | ✅ Yes | "Don't replace existing patterns" |
| `validate-feature-fit` skill | ✅ Yes | Check for duplicates, contradictions, scope creep |
| Dedicated "respect-existing-codebase" rule | ❌ No | **Not needed.** Already covered by scope-control + improve-before-implement. |

**No gap.** This test should already work well with existing rules.

### Summary of needed changes

| Change | Type | Priority | Effort |
|---|---|---|---|
| Strengthen `ask-when-uncertain` with vague-request triggers | Rule update | High | Low |
| Consider "structured-refactoring" skill | New skill | Medium | Medium |
| Consider "handle-vague-request" skill | New skill | Medium | Medium |
| "respect-existing-codebase" rule | NOT needed | — | — |
| "enforce-analysis-gate" rule | NOT needed | — | — |

Note: Our existing rules (`think-before-action`, `ask-when-uncertain`, `improve-before-implement`,
`scope-control`) are already MORE detailed and stronger than GPT's suggested replacements.
The gap is not in rule content but in skill-level guidance for specific scenarios.

### Tasks

- [x] Audit every rule in core: does it improve the first experience? (see `agents/docs/vanilla-vs-governed.md` — "Rule audit" section)
- [x] Strengthen `ask-when-uncertain`: add explicit vague-request pattern triggers (8 patterns + escape hatch in `.augment.uncompressed/rules/ask-when-uncertain.md`)
- [x] Evaluate: create "structured-refactoring" skill — **Deferred** (see `agents/docs/vanilla-vs-governed.md` — "Skill evaluation")
- [x] Evaluate: create "handle-vague-request" skill — **Not needed** (covered by vague-request triggers in `ask-when-uncertain`)
- [x] Remove/disable rules that add friction without visible value in minimal (audit complete; no removals recommended — see rule audit)
- [ ] Test: minimal-mode agent vs vanilla agent on same task — is difference obvious? (manual validation, requires external project)
- [x] Create comparison document: "vanilla agent output" vs "governed agent output" for 3 tasks (`agents/docs/vanilla-vs-governed.md`)
- [x] Ensure install output includes a concrete "try this" prompt (3 aha-moment prompts + getting-started link in scripts/install.py)

---

## Implementation Priority

| Priority | Gap | Impact | Effort |
|---|---|---|---|
| 🔥 1 | **Profile system** | Solves entry barrier, settings confusion | Medium |
| 🔥 2 | **First 5 minutes UX** | Solves "now what?" problem | Medium |
| 🔥 3 | **Minimal mode magic** | Solves adoption → retention | Low-Medium |
| 🟡 4 | **Feedback consumption** | Makes stored data useful | Medium |
| 🟡 5 | **Runtime visibility** | Makes runtime worth enabling | Low |
| 🟡 6 | **Observability scoping** | Prevents feature bloat perception | Low |

### Phase 1: User Experience Foundation
Gaps 1 + 2 + 3. Must-haves before marketing or external adoption.

### Phase 2: Feature Depth
Gaps 4 + 5 + 6. Makes advanced features worth their complexity.

---

## Anti-patterns to avoid

- **Feedback auto-generates rules** — Never. Feedback → suggestion → human approval → change.
- **Runtime makes agent verbose** — Runtime should make agent smarter, not noisier.
- **Observability creates files by default** — No JSON files in minimal profile.
- **Settings without defaults** — Every setting must have a sane default that works without config.
- **"Read the docs to get started"** — Install must work without reading anything.

---

## Scoring Target

| Area | Current (PR #6) | After product maturity |
|---|---|---|
| System quality | 8.8/10 | 9/10 |
| User experience | 6/10 | **8.5/10** |
| Adoption readiness | 7/10 | **9/10** |
| Feature utilization | 5/10 | **8/10** |
| **Overall product score** | **7/10** | **8.5/10** |

## Relationship to other roadmaps

| Roadmap | Focus | Overlap |
|---|---|---|
| `readme-and-docs-improvement.md` | README, onboarding, quickstart | Phase 1-2 here feeds README |
| `multi-package-architecture.md` | Package split, distribution | Profile system is shared |
| **This roadmap** | Product maturity, UX, feature depth | The "how it feels" layer |