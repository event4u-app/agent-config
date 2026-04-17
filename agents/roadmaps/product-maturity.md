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

**Solution:** Profile system (partially designed in multi-package-architecture roadmap).

### Tasks

- [ ] Implement profile presets: `minimal`, `balanced`, `full`, `enterprise`
- [ ] Profile selection during `setup.sh` or first agent interaction
- [ ] Default profile: `minimal` — zero configuration needed
- [ ] Profile auto-detection: if runtime package installed → suggest `balanced`
- [ ] Clear documentation: what each profile activates, what it costs (tokens)
- [ ] Profile switching without reinstall (just change `.agent-settings`)

### Success metric
New user installs, does NOT configure anything, and gets a good experience.
That's `minimal` profile working silently.

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
| **Agent (automatic)** | Pattern detection, repeated failures | Auto-inject ONLY at `enterprise` profile | 🔴 Not yet |
| **Developer (reports)** | Dashboard, lifecycle, health | `task report-stdout` reads all data | ✅ Works |

### Tasks

- [ ] Define feedback consumption rules per profile
- [ ] `minimal` + `balanced`: feedback stored, never auto-injected
- [ ] `full`: feedback available on request ("show me recent failures")
- [ ] `enterprise`: feedback auto-injected for repeated failure patterns
- [ ] Document: "feedback.json exists for CI and reports, not for the agent by default"
- [ ] Consider: should feedback influence skill selection? (e.g., "this skill failed 3x → suggest alternative")

### Anti-pattern to avoid
Do NOT build a system where feedback auto-generates rules or modifies skills without human review.
Feedback → suggestion → human approval → change. Never: feedback → automatic change.

---

## Gap 3: Runtime is invisible

**Problem:** User doesn't notice when runtime is active, what skills are executing,
or what difference it makes. Runtime exists but has no "surface area".

**Risk:** Users install runtime package, enable it, and see... nothing different.

### Tasks

- [ ] Define what "runtime is active" looks like to the user
- [ ] Options (pick appropriate ones):
  - Agent mentions: "Executing skill X (assisted mode)"
  - Agent mentions: "Validation step triggered by runtime"
  - Structured output format when runtime executes a skill
  - Execution log visible via `task runtime-list` or `task report-stdout`
- [ ] Do NOT make runtime noisy — subtle indicators, not debug spam
- [ ] Document: "What does runtime do? Why should I enable it?"
- [ ] Before/After comparison: agent behavior with runtime off vs on

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

- [ ] Classify every observability feature: user-facing vs developer-facing
- [ ] User-facing: CI summary, linter warnings — always available
- [ ] Developer-facing: metrics, feedback, audit — opt-in only
- [ ] No observability files created by default in `minimal` profile
- [ ] Document: "Observability features are for package maintainers, not end users"

---

## Gap 5: No clear user journey

**Problem:** This is the biggest UX gap.

**Current experience:**
1. Install → works
2. ... now what? Understand the system?
3. Configure settings?
4. Hope it works? 😄

**Target experience:**
1. Install → works immediately (minimal profile, zero config)
2. Use agent → agent behaves differently (analyzes first, validates, follows standards)
3. See value → "wow, this is better" (before/after is visible)
4. Extend → add runtime, add tools for GitHub/Jira integration

### First 5 Minutes Experience

**Minute 0-1:** Install
```bash
composer require --dev event4u/agent-config-core
bash vendor/event4u/agent-config-core/scripts/setup.sh
# Output: "✅ agent-config installed. Profile: minimal. Your agent now follows team standards."
```

**Minute 1-2:** First interaction — agent analyzes first, checks patterns, proposes structured changes.
The difference should be **noticeable without explanation**.

**Minute 2-3:** Agent demonstrates value — asks clarifying questions instead of guessing,
validates changes against existing code, mentions running quality checks.

**Minute 3-5:** Discovery — user asks "what can you do?" → agent lists available skills and commands.

### Tasks

- [ ] Design the "first 5 minutes" flow
- [ ] install.sh prints clear success message with profile info
- [ ] Agent's first interaction demonstrates governance value
- [ ] Consider: `/status` command that lists available skills
- [ ] Consider: post-install guide (3 things to try)
- [ ] Create docs/getting-started.md with guided first experience

---

## Gap 6: Minimal mode must feel magical

**Target:** User installs `core` with `minimal` profile and feels:
> "This agent is better. It thinks before acting, catches mistakes,
> and follows conventions I didn't even know I had."

### Tasks

- [ ] Audit every rule in core: does it improve the first experience?
- [ ] Remove/disable rules that add friction without visible value in minimal
- [ ] Ensure immediately noticeable behaviors:
  - Analyzes before editing
  - Asks instead of guessing
  - Validates changes
  - Follows coding standards
  - Writes structured commits
- [ ] Test: minimal-mode agent vs vanilla agent on same task. Is difference obvious?

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