# Current Safety Behavior — Baseline (pre-step-15)

> **Status:** descriptive baseline · **Owner:** package maintainer ·
> **Last reviewed:** 2026-05-16
>
> Documents the **current** safety / autonomy surface so the Phase 2
> Universal Safety Model ADR (step-15 item 9) has a baseline to diff
> against. Council v3 action #4 prerequisite. This file describes what
> ships today; it is **not** a proposal for what should ship next.

## Scope

The current package has **one autonomy switch** plus **four
non-overridable floors**. The Phase 2 ADR will replace the single switch
with per-profile, per-domain `deny / ask / allow` declarations. Before
that ADR can specify "replace X", X has to be written down.

## The one switch — `personal.autonomy`

**Where defined:** `.agent-settings.yml` under `personal.autonomy`.
Template: `src/config/agent-settings.template.yml`.

**Values:** `on` · `off` · `auto`.

**Read site:** [`.agent-src/rules/autonomous-execution.md`](../../.agent-src/rules/autonomous-execution.md)
(Iron-Law rule, kernel-loaded in every profile). Cached on the first
turn; missing key treated as `on`.

**What it gates:** trivial workflow questions (suppression). Examples:
"Should I run the tests now?", "Should I create the branch?", "Continue
with the next phase?". These are suppressed when `autonomy` resolves to
`on`.

**What it does NOT gate:** any of the four floors below, any
[`scope-control`](../../.agent-src/rules/scope-control.md) git operation,
or any [`commit-policy`](../../.agent-src/rules/commit-policy.md) commit
default. The switch only narrows the **trivial-question** surface.

### State table

| State | Behavior on trivial workflow questions | Blocking / Hard-Floor / Commit gates |
|---|---|---|
| `on` | **Suppress** — agent acts, surfaces what it did | Unchanged — still apply |
| `off` | **Ask** — numbered options, single question | Unchanged — still apply |
| `auto` | Same as `off` until the user opts in via a standing autonomy directive ("just work", "arbeite eigenständig"). Then sticky-flip to `on` for the rest of the conversation. Mirror opt-out flips back. | Unchanged — still apply |  <!-- md-language-check: ignore -->

### Opt-in detection

Intent-matched, not literal-string-matched. Speech-act-checked: the
phrase must be a meta-instruction, not content / quote / code. Detail:
[`autonomy-detection`](../../.agent-src/contexts/execution/autonomy-detection.md),
[`autonomy-mechanics`](../../.agent-src/contexts/execution/autonomy-mechanics.md).

### Task scope vs conversation scope

Two distinct autonomy shapes:

| Shape | Trigger | Scope |
|---|---|---|
| **Conversation-wide trivial-question suppression** | "stop asking on trivial steps" — no deliverable named | Sticky for the rest of the conversation. Suppresses trivial workflow questions only. |
| **Task-scoped autonomous execution** | "work autonomously on X", "arbeite die Roadmap Y komplett ab" — deliverable named | Bound to that task. Ends when the task ends. Does NOT authorize a different later deliverable. |  <!-- md-language-check: ignore -->

Per [`autonomous-execution § task-scope`](../../.agent-src/rules/autonomous-execution.md#task-scope--autonomy-is-bound-to-the-named-task).

## The four non-overridable floors

No value of `personal.autonomy` lifts any of these. Standing
autonomy directives, roadmap authorizations, or "just keep going"
phrases never reach them.

### 1. Hard Floor — `non-destructive-by-default`

[`.agent-src/rules/non-destructive-by-default.md`](../../.agent-src/rules/non-destructive-by-default.md).
Stops on: production-branch merges; deploy / release; push to remote;
production data / infra writes; whimsical bulk deletions; commits
containing bulk deletions or infra changes. **Always confirm this turn.**

### 2. Git-ops Permission Gate — `scope-control`

[`.agent-src/rules/scope-control.md § Git operations`](../../.agent-src/rules/scope-control.md#git-operations--permission-gated).
Stops on: commit · push · merge · rebase · force-push · branch create /
switch / delete · PR create / close / retarget · tag / release / pin.
Permission must be **this turn or a standing instruction not yet
revoked**.

### 3. Commit Default — `commit-policy`

[`.agent-src/rules/commit-policy.md`](../../.agent-src/rules/commit-policy.md).
**Never commit, never ask about committing.** Four exceptions: user
says so this turn · standing instruction · `/commit` invoked · roadmap
authorization. Anything else → no commit.

### 4. Security-sensitive STOP — `security-sensitive-stop`

[`.agent-src/rules/security-sensitive-stop.md`](../../.agent-src/rules/security-sensitive-stop.md).
Stops on: auth, billing, tenant boundaries, secrets, uploads,
integrations, webhooks, public endpoints. Threat-model **before**
editing.

## Coverage map

| Surface | What governs it |
|---|---|
| Trivial workflow question | `personal.autonomy` (the switch) |
| Blocking architectural / scope question | [`ask-when-uncertain`](../../.agent-src/rules/ask-when-uncertain.md) (always) |
| Tool / MCP call cost | None today — Phase 1 item 4 introduces preset-loader Hard Enforcement |
| Skill / command allowlist per audience | None today — Phase 2 item 7 introduces packs |
| Per-domain `deny / ask / allow` | None today — Phase 2 item 9 introduces this |
| Hard Floor (prod, deploy, push, bulk-destructive) | Universal — not switchable |
| Git ops | Universal permission gate — not switchable |
| Commit | Universal default-deny — not switchable |

## Gaps the Phase 2 ADR will address

1. **One switch, one granularity.** Today, `autonomy: on` suppresses
   *every* trivial question identically. A founder running the
   `content-engine` pack may want autonomy for content, ask-mode for
   spend; the current model cannot express that.
2. **No per-domain policy.** Domain-safety rules
   (`.agent-src/rules/domain-safety-*.md`) act as output floors but do
   not declare `deny / ask / allow` per profile. The Phase 2 model
   centralizes this.
3. **No machine-readable safety schema.** The current behavior is
   distributed across four rules. A consuming tool (the wizard, the
   explain command) cannot ask "what is this install's safety posture?"
   without reading rule prose.

The Phase 2 ADR (`docs/contracts/safety-model.md`) inherits this
baseline and adds: per-profile policy table, machine-readable schema,
explain-trace integration. It MUST NOT silently relax any of the four
floors above.

## See also

- [`autonomous-execution`](../../.agent-src/rules/autonomous-execution.md) · [`non-destructive-by-default`](../../.agent-src/rules/non-destructive-by-default.md) · [`scope-control`](../../.agent-src/rules/scope-control.md) · [`commit-policy`](../../.agent-src/rules/commit-policy.md) · [`security-sensitive-stop`](../../.agent-src/rules/security-sensitive-stop.md).
- [`docs/safety.md`](../safety.md) — domain-safety output floors.
- [`agents/roadmaps/step-15-product-refinement.md`](../../agents/roadmaps/step-15-product-refinement.md) — Phase 1 item 2a (this doc) and Phase 2 item 9 (Universal Safety Model ADR).
