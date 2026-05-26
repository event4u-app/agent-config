# Current `/onboard` Baseline (pre-step-15)

> **Status:** descriptive baseline · **Owner:** package maintainer ·
> **Last reviewed:** 2026-05-16
>
> Documents the **current** `/onboard` flow so the Phase 1 Guided
> Setup Wizard (step-15 item 2) has a baseline to extend. Council v3
> unique finding (cannot "extend" an undocumented surface). This file
> describes what ships today; it is **not** a proposal.

## Surface

`/onboard` lives at [`.agent-src.uncondensed/commands/onboard.md`](../../.agent-src.uncondensed/commands/onboard.md)
(canonical source) and is triggered by the
[`onboarding-gate`](../../.agent-src/rules/onboarding-gate.md) rule on
the first turn when `onboarding.onboarded == false` in
`.agent-settings.yml`. Cloud surfaces (Claude.ai Web, Skills API): fully
inert — no settings file, no flow.

## The 12 steps today

| # | Step | Captures | Asked if |
|---|---|---|---|
| 1 | Greet + set expectations | — | always |
| 2 | Offer user-global cross-project defaults | intent flag for step 9 | first-time-setup heuristic only |
| 3 | `personal.user_name` | first name | unset |
| 4 | `personal.ide` (+ auto-detect via `ps aux`) and `personal.open_edited_files` | IDE id, auto-open flag | unset |
| 5 | `personal.pr_comment_bot_icon` | bool | always (no detection possible) |
| 6 | `personal.rtk_installed` (via `which rtk`) | bool + install action | rtk not found |
| 7 | `cost_profile` and `pipelines.skill_improvement` | profile id, learning bool | always (one summary screen) |
| 8 | Mark `onboarding.onboarded: true` | — | always |
| 9 | Write user-global `~/.event4u/agent-config/agent-settings.yml` | six whitelisted keys | step 2 captured "yes" |
| 10 | Summary block | — | always |
| 11 | Quickstart pointer (`/work` and `/implement-ticket`) | — | local only |
| 12 | Maintainer telemetry hint (opt-in) | — | local only |

## What `/onboard` does **not** capture today

Step-15 Phase 1 item 2 introduces a new role-selection step ("8 options
covering Software / Content / Founder / Consulting / Marketing / Finance
/ Handwerk / Self-configure") that produces a `user_type`. Today, no
`user_type` is captured. Specifically:

- **No audience/role question.** `/onboard` knows the developer's name,
  IDE, and rtk install status — never the audience taxonomy.
- **No `profile.id`.** `profile.id` does not exist as a key in
  `.agent-settings.yml`. Per
  [ADR-010](../decisions/ADR-010-profile-pack-preset-boundary.md), it
  is owned by the Phase 1 item 1 profile loader.
- **No `preset.id`.** Same status — `preset.id` arrives with Phase 1
  item 4.
- **No `pack.id`.** Arrives with Phase 2 item 7.
- **No risk-appetite question.** The current flow defers risk posture
  to `personal.autonomy`, which is itself not part of the onboard
  questions (it inherits the template default).
- **No stack question.** Stack is inferred at runtime by detectors
  (`scripts/detect/*`), not asked here.

## Settings keys written today

```yaml
personal:
  user_name: "<first-name>"        # step 3
  ide: "code|phpstorm|cursor"       # step 4
  open_edited_files: true|false     # step 4
  pr_comment_bot_icon: true|false   # step 5
  rtk_installed: true|false         # step 6
cost_profile: "balanced"             # step 7 (default unchanged)
pipelines:
  skill_improvement: true            # step 7 (default unchanged)
onboarding:
  onboarded: true                    # step 8
```

User-global file (step 9, opt-in): the six whitelisted keys in
[`scripts/_lib/agent_settings.py`](../../scripts/_lib/agent_settings.py)
— `name`, `ide`, `cost_profile`, `personal.bot_icon`,
`personal.autonomy`, `telegraph.speak_scope`.

## Iron Laws today

- **One question per turn** ([`ask-when-uncertain`](../../.agent-src/rules/ask-when-uncertain.md)).
- **Re-runnable** — invoking `/onboard` when `onboarded: true` walks the
  flow again, never silently rewrites a value (asks before overwriting
  `user_name` / `ide`).
- **Never commits** — `.agent-settings.yml` is git-ignored.
- **User-global write is opt-in + one-shot + never silent** — step 2
  captures intent, step 9 re-confirms.

## Gaps the wizard (Phase 1 item 2) must close

1. **Add role-selection step** producing a `user_type` (later mapped to
   `profile.id`). Eight options covering Software / Content / Founder /
   Consulting / Marketing / Finance / Handwerk / Self-configure.
   Inserted **before** step 8 (mark onboarded) so the profile loader
   has a value to read on the next session start.
2. **Add stack-detection confirmation step.** Run the existing
   `scripts/detect/*` detectors, present the result, allow the user
   to override. Without confirmation, profile-aware presets cannot
   resolve.
3. **Add risk-appetite question.** Maps to `preset.id` from
   [`config-presets.md`](../contracts/config-presets.md). Three
   options: `fast` / `balanced` / `strict`.
4. **Write the new keys.** `profile.id`, `preset.id`, optionally
   `pack.id`, plus the user-typed `user_type` as a stable audit field.

## Wizard contract (Phase 1 item 2 acceptance)

The wizard MUST:

- Preserve every existing step semantically (no silent removal).
- Insert role + stack + risk-appetite questions **before** step 8.
- Honor the one-question-per-turn Iron Law.
- Write `profile.id`, `preset.id`, and `user_type` to
  `.agent-settings.yml` using the section-aware merge rules.
- Be re-runnable (idempotent for unchanged answers).
- Work offline (no network call required for any question).
- Skip itself on cloud surfaces (inherit current cloud-noop behavior).

## See also

- [`/onboard` command](../../.agent-src.uncondensed/commands/onboard.md) — canonical source.
- [`onboarding-gate`](../../.agent-src/rules/onboarding-gate.md) — trigger rule.
- [`ADR-010`](../decisions/ADR-010-profile-pack-preset-boundary.md) — boundary the wizard must respect.
- [`config-presets.md`](../contracts/config-presets.md) — preset axis the wizard writes.
- [`agents/roadmaps/step-15-product-refinement.md`](../../agents/roadmaps/step-15-product-refinement.md) — Phase 1 item 2.
