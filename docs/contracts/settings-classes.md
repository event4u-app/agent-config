# Settings classes — A / B / C

> Every leaf key in `src/config/agent-settings.template.yml` carries exactly one
> class. The class answers ONE question: **who may write this key.**
>
> `src/scripts/lint_settings_classes.ts` fails the build when a template key has
> no row here, when a row names a key the template does not have, or when a row
> carries a class outside `A | B | C`. The table below is the single source —
> there is no second machine-readable copy to drift from it.

Origin: Phase 1 of `road-to-zero-ceremony-settings`. It exists because the
package is about to grow an agent-writable settings path (`settings set`), and
an agent-writable path without a fence is an injection surface: anything that
can reach the model's input can reach a setting, and some of these settings
raise a spend ceiling, empty an allowlist, or switch off a gate.

## The three classes

| Class | Who may write it | Is the user ever asked? |
|---|---|---|
| **A — preference** | the agent (via `settings set`), the GUI, a hand-edit | **never.** It resolves to its default until someone states otherwise. |
| **B — consent** | the agent, but only after ONE just-in-time ask that the user answered | **once**, then persisted with provenance. |
| **C — guarded** | the GUI's write route or a hand-edit, by a human | never asked by the agent; **every agent write path refuses it.** |

## What the fence covers — and what it does not

**It governs writes, not reads.** Every class is readable by everything. A C
class does not hide a value; it refuses to let a non-human change it.

**It governs writes, not asks.** Four settings ship an `ask` value in their own
enum (`tokens.rich_skills`, `subagents.adversarial_council`, `worktrees.mode`,
`decision_engine.on_block`).
Those are C-class here, and that is not a contradiction: the class says who may
*persist* a new value; the `ask` value says what happens *at runtime* when the
setting is already set to `ask`. A C-class key set to `ask` still produces a
runtime question, the answer applies to that run, and persisting it stays on the
human path.

**It is not a permission model for the user.** The user may edit anything in
their own file with an editor. C means the *agent* does not do it for them.

## Why "master flag → C" is read narrowly

The roadmap's instruction is *"put every budget-raising key, allow/deny list,
kill-switch, strict mode, and master flag in C"*. Read literally, "master flag"
swallows every boolean named `enabled`, and a fence that contains everything
fences nothing — it just makes the writer useless and pushes the next author to
carve an exception.

So the rule applied here is the acceptance criterion's own wording — **no key
with an irreversible or spend-raising effect sits outside C** — expanded into
eight tests. A key is C when it governs any of:

1. money, tokens, or a quota;
2. an allow-list or a deny-list;
3. a gate, a confirmation, or a safety floor;
4. the agent's own authority, autonomy, or reasoning discipline;
5. which code runs or which artefacts project into the agent's context;
6. egress of repository or conversation content;
7. a credential, an executed binary, or a filesystem path;
8. audit, observability, or a background safety check — anything that changes
   what the user can later **see** about what the agent did.

Test 8 came out of the council review below, and it is the only one that looks
backwards. Tests 1–7 ask *what can the attacker do*; test 8 asks *what can the
attacker hide*. A settings write that erases the trail is not less severe than
one that raises a budget — it is the one that makes the other invisible.

`commands.suggestion.enabled` is the worked counter-example: it is a master
switch, and it is **A**, because switching it off removes no gate, no spend, no
authority, and no audit trail — it removes a convenience.

## B eligibility — the invariant

```
A KEY MAY BE CLASS B ONLY IF ITS TEMPLATE DEFAULT IS THE CONSERVATIVE VALUE,
AND THE ASK FIRES ONLY WHEN THE USER'S OWN REQUEST NEEDS THE SETTING —
NEVER AT A MOMENT THE AGENT CHOSE.
```

**Half one — the conservative default.** If a B key shipped with the permissive
value as its default, then "never asked" and "answered yes" would be
indistinguishable, and the ask would be decoration on a decision already made in
the user's name. Under this invariant an unanswered B key is always the safe
value, and the ask is the only path to the permissive one.
`lint_settings_classes` enforces this half mechanically: a B row whose template
default is not `false` / `""` / `0` / `[]` / `null` / `{}` fails the build.

> **There is no defaults layer, and this contract used to imply one.** The
> sentence here previously read *"a sparse settings file means absent =
> default"*. No code implements that: `_DEFAULTS` in
> `src/scripts/_lib/agent_settings.ts` is `{}`, so the merged settings contain
> exactly what some file set and nothing else. What makes half one hold is not a
> defaults layer but the **reader** — each reader supplies its own fallback, and
> the lint above guarantees the template value a reader is expected to mirror is
> the conservative one.
>
> That distinction is load-bearing rather than pedantic, because the two are not
> equivalent for every key. Nine keys are carved out in
> [`src/shared/settingsCarveOut.ts`](../../src/shared/settingsCarveOut.ts) where
> a reader deliberately resolves an absent key to something **other** than the
> template default — `quality.local_auto_run` is the sharp one: the template
> ships `false`, which ARMS a gate, and an absent key resolves to `true` at its
> reader, which disarms it. Under a literal "absent = default" reading that key
> would be safe, and it is not.
>
> `agent-config settings:get <key>` reports both facts — the value with the file
> that set it, and the carve-out warning when absent is not the default. Use it
> rather than reasoning from this contract about what an absent key does.

**Half two — who picks the moment.** The council review below found the hole in
half one: an agent free to choose *when* to ask can engineer consent. Asking
"may I learn from this session?" straight after solving something painful is
still a just-in-time ask, and the answer is still coerced. So the trigger must
be the user's own request arriving at a point where the setting is genuinely
required — the user asked for an edit, so `personal.open_edited_files` is asked;
the user ended the session, so `memory.learn_on_session_end` is asked. A
threshold the agent watched, a moment it judged favourable, or a convenient lull
are not triggers. This half is **prose, not lint** — no gate can read the
agent's reason for choosing a moment, and claiming otherwise would be the
coverage inflation this repository's gate discipline exists to refuse.

That invariant is why B is small — **three keys**. It is not a placeholder for a
larger set; it is the set that passes both halves.

| Key | Why a just-in-time ask is the right shape | Conservative default |
|---|---|---|
| `personal.open_edited_files` | it starts running the binary named in `personal.ide` on every edit — the user should say yes once before that begins | `false` |
| `personal.canary_name` | un-inferrable, and answering arms the session-degradation canary; one keypress to accept the prefill | `""` (canary dark) |
| `memory.learn_on_session_end` | it turns on automatic memory writes at the end of every session — a standing write the user should authorise | `false` |

## The one exception — `emergency.orchestration_halt`

The always-on-orchestration doctrine (subagents, council, team) deletes every
per-layer on/off setting: `subagents.enabled`, `subagents.auto`, and
`subagents.host_capabilities` are gone from the template, and the layer
activates on any capable host with an EMPTY settings file. One switch survives
that deletion on purpose, and it is not the same shape wearing a different
name.

```
ON-BY-DEFAULT, NOT OFF-BY-DEFAULT. ABSENT OR false MEANS THE STACK RUNS.
ARMING THE HALT IS CEREMONY-FREE — INCIDENTS ARE URGENT.
DISARMING IT REQUIRES A NON-EMPTY orchestration_halt_justification.
INCIDENT-RESPONSE USE ONLY.
```

**Enforcement, stated honestly (`enforced_by: none`).** The settings file is
hand-edited YAML — no machine sits on the write path, so the
justification-on-disarm rule and any per-transition telemetry are
MODEL-CARRIED conventions, not checked gates (the same honesty stance as
`security-sensitive-stop`). What IS checked: readers treat only strict
`true` as halted, and the `no-activation-gates` lint prevents the switch
from ever growing activation siblings. An agent editing this key follows
the convention; a human editing it is the owner exercising it.

The distinguishing test against "an activation gate under a new name": an
activation gate is symmetric — flipping it either way costs the same nothing,
and its purpose is to let a capability sit unused by default. This switch is
asymmetric by convention — cheap to arm during an incident, costed (a stated
reason) to disarm, never a silent preference. `subagents.downshift`, `subagents.quota_arbitrage`, and
`subagents.model_map` are unaffected by the deletion — they tune HOW a
dispatch runs, not WHETHER the layer exists, so they keep their own C rows.

## Counts

| Class | Keys |
|---|---|
| A — preference | 27 |
| B — consent | 3 |
| C — guarded | 111 |
| **Total** | **141** |

The total is every leaf in the template, where *leaf* means anything that is not
a **non-empty** map. An empty map (like the former `subagents.host_capabilities: {}`) is a real
configurable value with a real default, so such keys count as leaves here — one row more than
the template↔schema parity test walks, deliberately, because a key with no
class is exactly what this contract exists to prevent.

`secrets.link_encryption_key` is commented out in the template and therefore has
no row. It is a credential; were it ever uncommented it is C, and the lint would
demand a row before the build went green.

## The table

Rows follow template order, so a diff against the template reads straight down.

| Key | Class | Default | Why |
|---|---|---|---|
| `agent_config_version` | C | `""` | installer-owned pin selecting which package code executes |
| `profile.id` | C | `developer` | master axis selecting the projected skill and command surface |
| `projection.mode` | C | `scoped` | governs which artefacts reach the host trees at all |
| `projection.rule_workspaces` | C | 9 workspaces | allowlist deciding which rules reach the agent |
| `projection.rule_packs` | C | `[]` | second allowlist axis on rule projection |
| `discipline_profile` | C | `__DISCIPLINE_PROFILE__` | master switch for the discipline rule tier |
| `rule_loading_tier` | C | `__RULE_LOADING_TIER__` | legacy master switch for rule loading |
| `lean_projection.mode` | C | `eager-all` | `thin` removes rule bodies from the agent's context |
| `telegraph.speak` | C | `false` | ships a rule body; a token-cost lever in both directions |
| `telegraph.speak_scope` | A | `"off"` | output register once that rule ships |
| `tokens.rich_skills` | C | `"on"` | token-spend lever |
| `cost.budgets.daily` | C | `0` | rolling spend ceiling |
| `cost.budgets.weekly` | C | `0` | rolling spend ceiling |
| `cost.budgets.monthly` | C | `0` | rolling spend ceiling |
| `cost.budgets.per_tier.cheap` | C | `null` | per-tier spend ceiling |
| `cost.budgets.per_tier.medium` | C | `null` | per-tier spend ceiling |
| `cost.budgets.per_tier.strong` | C | `null` | per-tier spend ceiling |
| `cost.enforcement` | C | `advisory` | decides whether a breach blocks or is merely logged |
| `model.auto_switch` | C | `suggest` | authorises native model overrides, which is spend |
| `personal.ide` | C | `""` | names a binary the agent would execute |
| `personal.open_edited_files` | B | `false` | starts invoking that binary on every edit |
| `personal.rtk_installed` | A | `false` | auto-detected machine fact |
| `personal.minimal_output` | A | `true` | reply-shape preference |
| `personal.play_by_play` | A | `false` | narration preference |
| `personal.canary_name` | B | `""` | arms the session-degradation canary |
| `personal.pr_comment_bot_icon` | A | `false` | comment cosmetics |
| `personal.pr_progress_comments` | C | `false` | authorises unsolicited outbound comments on a PR |
| `personal.autonomy` | C | `auto` | suppresses confirmation questions |
| `personal.user_type` | C | `"__USER_TYPE__"` | master axis filtering the projected surface |
| `verbosity.intent_announcements` | A | `false` | narration preference |
| `verbosity.preview_artifacts` | C | `false` | removes pre-action review of commits, PRs, and branches |
| `verbosity.routine_confirmations` | C | `false` | removes confirmation prompts |
| `verbosity.offer_council_in_delivery` | A | `false` | offers a paid step; never takes it |
| `verbosity.post_action_reports` | A | `minimal` | size of a status block |
| `project.pr_template` | C | `.github/pull_request_template.md` | filesystem path whose contents reach an outbound PR |
| `project.upstream_repo` | C | `""` | destination of outbound improvement PRs |
| `project.improvement_pr_branch_prefix` | A | `improve/agent-` | branch-name cosmetics |
| `github.pr_reply_method` | A | `create_review_comment` | picks between two endpoints of one operation |
| `augment.rules_use_symlinks` | A | `false` | reversible install mechanics |
| `eloquent.access_style` | A | `getters_setters` | code convention |
| `chat_history.enabled` | C | `true` | kill-switch over a path that writes conversation content to disk |
| `chat_history.frequency` | C | `__CHAT_HISTORY_FREQUENCY__` | capture granularity — a value that reduces what is captured erases the trail |
| `chat_history.max_size_kb` | C | `__CHAT_HISTORY_MAX_SIZE_KB__` | cap on how much conversation lands on disk |
| `chat_history.on_overflow` | C | `__CHAT_HISTORY_ON_OVERFLOW__` | decides what survives when the log fills; an audit-integrity choice, not a preference |
| `chat_history.text_limits.user` | C | `0` | cap on how much user text is written to disk |
| `chat_history.text_limits.agent` | C | `5000` | cap on how much agent text is written to disk |
| `chat_history.text_limits.tool` | C | `200` | cap on how much tool payload is written to disk |
| `chat_history.text_limits.phase` | C | `200` | cap on how much phase text is written to disk |
| `pipelines.skill_improvement` | A | `true` | proposes a capture; the user still decides |
| `reasoning.enabled` | C | `true` | master switch for the agent's own reasoning discipline |
| `reasoning.auto_gate` | C | `true` | decides when that discipline engages |
| `reasoning.components.orchestrator` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.notes_first` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.grounding` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.intent` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.complexity_first` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.verifier_default` | C | `true` | disabling it removes a verification step |
| `reasoning.components.prediction_tracking` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.decision_ledger` | C | `true` | a component of the agent's own discipline |
| `reasoning.components.uncertainty_budget` | C | `true` | a component of the agent's own discipline |
| `roadmap.skip_pre_run_gate` | C | `true` | disables a pre-run confirmation gate |
| `roadmap.quality_cadence` | C | `end_of_roadmap` | governs when verification runs |
| `roadmap.dashboard_regen_cadence` | A | `every_5_steps` | beat of a derived view |
| `roadmap.horizon_weeks` | C | `0` | a non-zero value relaxes a lint's plate-token ban |
| `planning.challenge_on_create` | C | `true` | disables the plan-confidence gate |
| `planning.risk_review` | C | `true` | disables the risk-register validator |
| `planning.completion_review` | C | `true` | disables the completion-review validator |
| `quality.local_auto_run` | C | `false` | governs whether local verification runs at all |
| `quality.wait_for_remote_ci` | C | `false` | governs whether the authoritative gate is waited on |
| `design.fidelity_mode` | C | `strict` | strict-mode selector, one of whose values is a Hard Floor |
| `consistency.cross_source` | C | `"on"` | disables the cross-source discrepancy gate |
| `screenshots.identity_allowlist` | C | `[]` | allowlist of identities that ship unredacted |
| `screenshots.forbid_terminal_capture` | C | `true` | kill-switch over the highest-leak capture path |
| `screenshots.data_bearing_gate` | C | `"on"` | the human-confirmation gate over a published egress |
| `code_style.docblocks` | A | `minimal` | code convention |
| `subagents.downshift` | C | `true` | routes to another model tier, which is spend and quality |
| `subagents.quota_arbitrage` | C | `true` | spends from a separate quota pool |
| `subagents.model_map.lite` | C | `""` | names an external model endpoint |
| `subagents.model_map.medium` | C | `""` | names an external model endpoint |
| `subagents.model_map.high` | C | `""` | names an external model endpoint |
| `subagents.implementer_model` | C | `""` | names an external model endpoint |
| `subagents.judge_model` | C | `""` | names an external model endpoint |
| `subagents.model_ceiling` | C | `""` | session-wide subagent model cap (exported as `CLAUDE_CODE_SUBAGENT_MODEL` by suite-owned CLI spawn wrappers), which is spend and quality |
| `subagents.max_parallel` | C | `3` | parallelism cap, and therefore a spend rate |
| `subagents.adversarial_council` | C | `"off"` | governs a paid verification step |
| `worktrees.mode` | C | `ask` | standing permission for autonomous worktree creation |
| `ai_team.model` | C | `auto` | names an external model |
| `ai_team.allow_delegate` | C | `false` | grants an external tool write access to the repository |
| `ai_team.max_calls_per_day` | C | `50` | quota cap on a shared budget |
| `ai_team.suppress_setup_hint` | A | `false` | hint cosmetics |
| `ai_team.review_gate.managed` | C | `false` | governs an upstream review gate |
| `ai_team.review_gate.max_consecutive_blocks` | C | `3` | circuit-breaker threshold |
| `emergency.orchestration_halt` | C | `false` | the one audited incident switch over the always-on orchestration stack — see § The one exception above |
| `emergency.orchestration_halt_justification` | C | `""` | required non-empty before the halt may be lifted; an audit-trail field |
| `onboarding.onboarded` | C | `false` | flipping it bypasses the onboarding gate |
| `commands.auto_detect` | C | `enabled` | kill-switch for orchestrator auto-detection |
| `commands.suggestion.enabled` | A | `true` | a convenience layer; governs no gate and no spend |
| `commands.suggestion.confidence_floor` | A | `0.6` | tuning of that convenience layer |
| `commands.suggestion.cooldown_seconds` | A | `600` | tuning of that convenience layer |
| `commands.suggestion.max_options` | A | `4` | tuning of that convenience layer |
| `commands.suggestion.blocklist` | C | `[]` | a deny-list |
| `commands.create_pr.preview_description` | C | `false` | removes pre-publish review of an outbound artefact |
| `commands.create_pr.detail_level` | A | `min` | verbosity of a generated body |
| `commands.create_pr.api_examples` | A | `true` | verbosity of a generated body |
| `commands.create_pr.screenshots` | C | `false` | puts captured screenshots into a published PR body |
| `commands.create_pr.ui_paths` | C | `[]` | glob allowlist |
| `commands.create_pr.api_paths` | C | `[]` | glob allowlist |
| `memory.cadence` | C | `always` | suppressing the visibility line hides what the agent learned from the user |
| `memory.review_threshold` | A | `10` | when a review preview surfaces; governs no gate |
| `memory.redact_patterns` | C | `[]` | deny-list of secret and PII regexes |
| `memory.session_index` | A | `"off"` | injects a compact index at session start |
| `memory.learn_on_session_end` | B | `false` | turns on automatic memory writes at session end |
| `knowledge.global_sharing.enabled` | C | `true` | kill-switch over cross-project egress |
| `knowledge.global_sharing.allowed_tiers` | C | `[public]` | allowlist for that egress |
| `knowledge.global_sharing.redaction.enabled` | C | `true` | disabling it removes the redaction floor |
| `knowledge.global_sharing.redaction.halt_on_trigger` | C | `true` | disabling it removes halt-and-prompt |
| `knowledge.global_sharing.auto_promote_threshold` | C | `2` | threshold governing that egress |
| `knowledge.global_sharing.freshness.hypothesis_after_days` | A | `90` | freshness heuristic on a card already shared |
| `knowledge.global_sharing.freshness.stale_after_days` | A | `180` | freshness heuristic on a card already shared |
| `hooks.concern_budget.max_per_event` | C | `8` | budget cap on hook concerns |
| `hooks.concern_budget.tier1_concerns` | C | `[]` | allowlist of concerns permitted to fail closed |
| `hooks.concern_budget.hard_fail` | C | `false` | weakens the budget gate to warn-only |
| `hooks.injection_scan.enabled` | C | `false` | the prompt-injection scanner |
| `hooks.rtk_wrap.enabled` | C | `false` | configures code that runs on every tool call |
| `hooks.design_slop.enabled` | C | `false` | configures code that runs on every tool call |
| `hooks.code_graph.enabled` | C | `false` | configures code that runs on every tool call |
| `hooks.turn_end_gate.enabled` | C | `false` | arms the only concern that can REFUSE a turn-end; an agent must never be able to switch its own delivery gate on |
| `hooks.turn_end_gate.promissory` | C | `true` | which refusal the turn-end gate may raise; inert while the master switch is off |
| `hooks.turn_end_gate.language` | C | `true` | which refusal the turn-end gate may raise; inert while the master switch is off |
| `decision_engine.surface_traces` | C | `false` | the decision engine’s own black box; the agent must not be able to close it |
| `decision_engine.min_confidence` | C | `"off"` | the confidence gate |
| `decision_engine.block_on_risk` | C | `"off"` | the risk-class gate |
| `decision_engine.require_memory_hits` | C | `false` | a phase gate |
| `decision_engine.on_block` | C | `stop` | `warn` advances past a gate that fired |
| `decision_engine.ask_timeout_seconds` | C | `30` | how long a fired gate waits before falling back |
| `decision_engine.on_block_fallback` | C | `stop` | fail-safe versus fail-open after that timeout |
| `update_check.enabled` | C | `true` | a background safety check; disabling it pins the user to known-vulnerable code |
| `explain.enable_last` | A | `true` | a read-only diagnostics surface |
| `legal_review_prep.acknowledged` | C | `false` | the consent gate; the safety floor requires the wizard checkbox |
| `legal_review_prep.consented_at` | C | `""` | the record of that consent |
| `legal_review_prep.require_council` | C | `true` | a fail-closed defence-in-depth gate |

## The council review of the C list (2026-08-05)

The C list was reviewed by a two-member AI council (`claude-sonnet-4-5`,
`gpt-4o`), asked one question in one direction only: **name every key
classified A or B that should be C.** Arguing a C key down to A was explicitly
out of scope, because over-fencing is not the failure this fence exists to
prevent. The review ran because completeness is the property a single author is
worst placed to certify about their own list.

**Converged, and applied — five keys moved A → C:**

| Key | The abuse both members named |
|---|---|
| `update_check.enabled` | a background safety check; switching it off pins the user to known-vulnerable code |
| `chat_history.frequency` | reduces what is captured, so the trail thins |
| `chat_history.on_overflow` | decides what survives when the log fills |
| `memory.cadence` | suppresses the line that tells the user what the agent learned |
| `decision_engine.surface_traces` | the decision engine's own black box |

**Converged, and applied — a missing test.** All five share a shape the original
seven tests could not express: they do not let an attacker *do* more, they let
an attacker *hide* what was done. That is now test 8, and it is the one to reach
for first when classifying a new key, because it is the one the other seven
cannot cover by analogy.

**Converged, and applied — the B invariant had a hole.** Conservative-default
alone is satisfiable by an agent that picks a coercive moment to ask. Half two
of the invariant above is that finding.

**Split, and recorded rather than resolved:** `github.pr_reply_method`. One
member wanted C ("redirects a communication path"); the other kept A, on the
concrete ground that both enum values post a comment on the same PR through the
same API — the worst outcome is a comment of the wrong type, which is visible
and cosmetic. Kept **A** on the stronger-evidenced side. If that key ever gains
a value that targets a different destination, it becomes C under test 6 and this
paragraph is the reason to revisit it.

**Rejected, with the reason:** `pipelines.skill_improvement`, `personal.rtk_installed`,
`commands.create_pr.api_examples`, and `knowledge.global_sharing.freshness.*`
were each proposed for C by one member and argued back to A by the other.
The load-bearing distinctions: an auto-detected fact is not a control surface; a
tuning knob inside an already-guarded flow is not a second gate; and a boolean
that says "include examples" is bounded by the C-classed allow-list that decides
*which* examples. `pipelines.skill_improvement` carries a stated litmus — if its
approval ever stops being a separate mechanical step and becomes an in-turn
"ok", it moves to C.

## Adding a key

1. Add it to `src/config/agent-settings.template.yml` and to
   `src/server/schemas/settings.ts` (the parity test enforces both directions).
2. Add a row here. The lint fails until you do — that is the point.
3. If you reach for **B**, check the invariant above first: the template default
   must be the conservative value.
4. If you reach for **A**, check it against all eight C tests — test 8 first,
   because it is the one the other seven cannot cover by analogy. If any of them
   fires, it is C.

## See also

- [`settings-api.md`](settings-api.md) — the GUI's REST surface; its `PUT` route
  is the one write path a C-class key may travel.
- `src/scripts/lint_settings_classes.ts` — the gate.
- `src/config/agent-settings.template.yml` — the defaults-and-schema source.
- `tests/server/schemas/parity.test.ts` — the template↔schema parity gate this
  contract sits beside and never relaxes.
