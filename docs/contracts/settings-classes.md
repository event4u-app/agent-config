---
stability: beta
keep-beta-until: 2026-11-24
---

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

### The provenance sidecar's record shape

"Persisted with provenance" means one record per dotted key in
`settings/.agent-settings.provenance.json`, written by `settings:set` beside
the value: `{ "source": "auto-detected" | "jit-answer" | "manual" | "gui",
"at": "<ISO timestamp>" }`. For a class-B key the `at` stamp IS the grant
time — the consent reader (`consentVerdict`) grants on `jit-answer` / `gui` /
`manual` provenance, so source + timestamp together are the audit record of
who consented and when. `expires_at` / `revoked_at` / contract-version fields
stay deliberately unbuilt until a reader needs them — a field nothing reads is
surface without a consumer.

**A fifth source exists on the READ side only: `org-pack`** (ADR-233). It
records that a human org administrator decided, which is a consent — but one
given by someone other than the person it binds, so it grants **only** for
keys under `telemetry.remote.*` and withholds everywhere else. It is
deliberately absent from `settings:set`'s own `ProvenanceSource`, so
`--source org-pack` is rejected like a typo and no agent-reachable path can
write it; the org-pack install route writes the sidecar entry directly. That
asymmetry between the reader's vocabulary and the writer's is the safety
property rather than an inconsistency — `auto-detected` remains never-consent
verbatim, and this class must not become the precedent that erodes it.

## What the fence covers — and what it does not

**It governs writes, not reads.** Every class is readable by everything. A C
class does not hide a value; it refuses to let a non-human change it.

**It governs writes, not asks.** Three settings ship an `ask` value in their own
enum (`tokens.rich_skills`, `subagents.adversarial_council`,
`decision_engine.on_block`). It was four until ADR-229 deleted
`worktrees.mode`.
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

## Class B is a persistence property, not an enforcement claim

Recorded 2026-08-13, from `road-to-zero-settings` step 3.2 — the step that asked
each class-B key *"does the action need authorising at all?"*. Two of the three
answers turned out not to be about the keys.

```
CLASS B SAYS: MAY BE ASKED ONCE, THEN PERSISTED. IT SAYS NOTHING ABOUT
WHETHER ANYTHING CAN REFUSE THE ACTION. THE DISPOSITION SAYS THAT.
A `consent` KEY NEEDS A MECHANISM THAT CAN WITHHOLD, OR AN EXPLICIT
PROSE-ONLY LABEL. AN `un-inferrable` KEY NEEDS ONLY PERSISTENCE.
```

The two axes are independent, and reading class B as implying an enforcement
obligation is what made two non-problems look like problems:

- **`personal.canary_name`** authorises nothing — it holds a nickname used as a
  liveness marker. It is class B because it cannot be inferred and is worth
  keeping once answered, and its disposition (`un-inferrable`) already says so.
  There is no gate to build here and never was.
- **`personal.open_edited_files`** is a genuine `consent` key with **no mechanism
  that can refuse the action** — its only reader is prose in
  `src/skills/file-editor/SKILL.md`. The suite's standing rule is *never claim
  enforcement you do not have*, and the discharge of that rule is to **declare
  the limit**, not to delete the user's choice: it is carried as an explicitly
  prose-only preference. An unenforceable flag that says it is unenforceable is
  honest; one that presents as a gate is not.
- **`memory.learn_on_session_end`** is what a consent key looks like when the
  mechanism exists: `src/scripts/memory_learn_hook.ts` reads it and can withhold
  the write, and the default is conservative.

Splitting class B into `B-consent` and `B-config` was considered and **not
taken** — it would churn a contract, a linter and every consumer's mental model
to express what this paragraph expresses. What the split would have bought is
the obligation stated above; stating it directly costs one section.

**Consequence for anyone adding a class-B key:** the § B eligibility invariant
still binds in full. This section adds one question on top of it — *if the
disposition is `consent`, what can refuse the action?* An answer of "nothing"
is allowed, and must then be written down as such.

## The one exception — `emergency.orchestration_halt`

The always-on-orchestration doctrine (subagents, council, team) deletes every
per-layer on/off setting: `subagents.enabled`, `subagents.auto`, and
`subagents.host_capabilities` are gone from the template, and the layer
activates on any capable host with an EMPTY settings file.

`hooks.turn_end_gate.*` was deleted the same way on 2026-08-12, and its
deletion carries an argument worth keeping: the switch existed so the gate
could **soak** before it bound, and a concern that is off does not run, so the
switch made the soak it was protecting impossible. What decides whether that
gate fires is now what should have decided it from the start — each detector's
own trigger conditions. A leftover block warns once and is ignored
(`REMOVED_KEYS`, `src/scripts/_lib/agent_settings.ts`).

One switch survives these deletions on purpose, and it is not the same shape
wearing a different name.

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
| A — preference | 26 |
| B — consent | 3 |
| C — guarded | 109 |
| **Total** | **138** |

The total was 140 until 2026-08-12, when five of the six keys no code path read were
deleted, minus the one held open (§ The six unread keys, below): one A
(`telegraph.speak_scope`) and four C. It dropped to 134 on 2026-08-13 when
ADR-229 deleted `worktrees.mode` — a fifth C, and the first deletion in this
series of a key that WAS read: the doctrine there is that the decision was never
the agent's to make, not that nothing consulted it.

It rose to 136 on 2026-08-20 when `road-to-gate-autonomy`'s
`b-gate-budget-preauth` was decided: the two class-1 gate-budget caps are the
first keys added to this contract since the deletions above, and both are C on
test 1 (money).

It rose to 138 on 2026-08-24 when `road-to-suggestion-block-capture` Phase 2
added `hooks.suggestion_capture.enabled`. C on test 1 — it configures code that
runs at every turn end and every prompt — and the third `hooks.*` key here.

Its disposition is **`consent`**, and the first draft of this row said
`derivable`, which was wrong in the way the disposition axis exists to catch. The
`derivable` argument was that the sink's own line count answers whether the soak
window is running — true, and it answers the wrong question. What the key
authorises is *the package observing this operator's turns and writing a record
of them*, and no predicate computes whether someone consents to that. The
`derivable-surface` ratchet caught it immediately: it is shrink-only, so a new
`derivable` key reds by construction, and being unable to add one is the
mechanism working rather than an obstacle.

The distinction against its `design_pass` neighbour still holds and is the reason
this is not `policy` either: that concern can **block**, so arming it is a risk
preference. This one only observes and exits 0 on every path — the question is
not risk, it is permission.

It rose to 137 on 2026-08-23 when `road-to-frontend-power` E1.1–E1.3 added
`hooks.design_pass.enabled`. C on test 1 (it configures code that runs on every
tool call and at every turn end), and the only hook key in this contract whose
concern can **block** rather than warn — which is why the class matters here
more than for its two `hooks.*` neighbours. The disposition is `policy`, not
`derivable`, and the block is why: whether an operator accepts a gate that can
refuse a turn is a risk preference, and no predicate computes it. Its two
`hooks.*` neighbours are `derivable` because they only ever warn.

The total is every leaf in the template, where *leaf* means anything that is not
a **non-empty** map. An empty map (like the former `subagents.host_capabilities: {}`) is a real
configurable value with a real default, so such keys count as leaves here — one row more than
the template↔schema parity test walks, deliberately, because a key with no
class is exactly what this contract exists to prevent.

`secrets.link_encryption_key` is commented out in the template and therefore has
no row. It is a credential; were it ever uncommented it is C, and the lint would
demand a row before the build went green.

## The disposition axis — should the key exist at all?

A/B/C answers **who may write a key**. It does not answer **whether the key
should exist**, so a second, orthogonal axis carries that question. Every leaf
lands in exactly one disposition; a key with no disposition is the finding,
because it means nobody has said.

| Disposition | Meaning | Action |
|---|---|---|
| `derivable` | the mechanism itself can decide, from the situation, better than a flag can | delete; move the decision into the mechanism |
| `un-inferrable` | a fact about the human that nothing in the environment carries (name, language, IDE binary) | keep — this is the floor |
| `consent` | a standing authorisation for something the package would otherwise do to the user | keep, but re-examine whether the ACTION needs authorising at all |
| `policy` | a project-level fact the tree could carry instead (audience, jurisdiction) | move into the project surface, then delete the key |

**A `derivable` row must name its replacement**, written after an em dash:
`derivable — <what decides instead>`. That clause is the falsifier. Without it
the label degrades into a synonym for "inconvenient to keep", and the direction
of this axis pushes every borderline row toward exactly that. A row that cannot
name a concrete mechanism is reclassified, not deleted —
`lint_settings_classes` rejects the bare label.

**Spend and irreversible outward actions are never `derivable`.** A flag whose
stated purpose is to delay a mechanism usually prevents the evidence that would
justify the mechanism, which makes "should this run?" keys the strongest
deletion candidates — but a key that bounds cost or authorises something the
user cannot un-see is `consent` however inferable it looks. The direction is
toward fewer keys, not toward fewer confirmations.

The axis lives in the same table and the same gate as the class, deliberately.
A separate classification artefact would be a second thing to keep in sync with
the template, which is the drift this contract exists to prevent.

## Dispositions

| Disposition | Keys |
|---|---|
| derivable | 83 |
| un-inferrable | 9 |
| consent | 40 |
| policy | 6 |
| **Total** | **138** |

First measured 2026-08-12 at 140 leaves (derivable 88 · consent 38 ·
un-inferrable 9 · policy 5), from the table below rather than predicted — the
numbers were deliberately not guessed in advance, because a target set before the
classification is a target the classification then argues toward. The six unread
keys were deleted the same day, which is where the −5 `derivable` comes from;
`consent` is unchanged because the one consent-classified key among them was
held open rather than deleted.

`derivable` is the **deletion queue, not a deletion**: a row stays until the
mechanism it names actually exists, so 83 measures work outstanding, not keys
about to disappear. The count is expected to fall while `un-inferrable` does not
— those 9 plus whatever survives re-examination in `consent` are the floor this
surface has, and stating it is the point. `policy` is the smallest class and the
only one whose action is a *move* rather than a keep or a delete: five keys carry
a project fact the tree could hold instead.

## The floor — the nine keys no mechanism can derive

This is the residual set: not "what is left over today", but what stays after the
`derivable` queue drains to zero. A floor asserted without reasons is where the
next round quietly re-grows, so each key carries the argument for why the
situation cannot answer it. The test each one passes is **not** "hard to detect" —
it is that a probe could at best enumerate candidates while the *choice among them*
belongs to the human, and choosing wrong has a cost the agent cannot take back.

`consent` (38) and `policy` (5) are deliberately **not** part of this floor:
consent rows survive only what re-examination leaves of them, and every policy row
is scheduled to move into the project surface and then disappear. The floor is the
nine below.

| Key | Why nothing can derive it |
|---|---|
| `profile.id` | Selects which product surface is projected at all. The same repository is worked by a developer, a founder, and an ops engineer on different days — the axis is a fact about the person in the chair, and the tree carries no trace of it. |
| `personal.ide` | Names a binary the agent will execute. A probe can enumerate installed editors; it cannot know which one the human wants opened, and having several installed is the normal case rather than the ambiguous one. Guessing here does not misconfigure a preference, it runs the wrong program. |
| `personal.canary_name` | How the user wants to be addressed. `git config user.name` is a commit identity, not a form of address, and the two differ for most people who use a nickname at all — deriving one from the other is how the canary ends up greeting a stranger. |
| `subagents.model_map.lite` | Names an external model endpoint for the cheapest tier. Which endpoints an account can actually reach is not in the tree, and the only probe that would establish it is a paid call. |
| `subagents.model_map.medium` | Same, for the middle tier — and the tier boundaries are a spend judgement, not a capability fact, so even a complete endpoint list would not choose. |
| `subagents.model_map.high` | Same, for the top tier, where a wrong guess is the most expensive one available. |
| `subagents.implementer_model` | Names the endpoint that does the bulk of the work, so it is where a wrong default costs the most per run. Empty means "same tier as the session model", which is a deferral to a human choice already made, not a derivation. |
| `subagents.judge_model` | Names the endpoint that reviews the implementer. Its default is stated relative to the implementer rather than derived from the environment, and pinning it to a specific model is the reason someone sets it at all. |
| `ai_team.model` | Names the external model a teammate session runs. Availability is an account and auth fact that lives outside this repository entirely. |

Five of the nine are model endpoints, and they share one argument: an endpoint list
is account state, and the only mechanism that could observe it spends money to do
so. That is the shape of an `un-inferrable` row — not "we did not bother", but "the
observation is itself the thing the user is deciding whether to pay for".

## The six unread keys — five deleted, one held open

**Six keys had no reader at all** — found while classifying, not sought:
`telegraph.speak_scope`, `chat_history.max_size_kb`, `chat_history.on_overflow`,
`quality.wait_for_remote_ci`, `screenshots.data_bearing_gate`, and
`legal_review_prep.consented_at`. Each was in the template, in the schema, on the
reference page, and in several cases in the setup wizard; none was consulted by
any code path. They were configured, documented, surfaced and inert. That is a
sharper finding than the 83, because a key nothing reads cannot be defended on
the grounds that someone depends on it.

**Five of the six are gone (2026-08-12, `road-to-zero-settings` Phase 2.1).**
They are the one batch whose removal is provably free: a key nothing reads
cannot change a default by leaving, so no replacement mechanism had to ship
first. Each carries its own reason string in `REMOVED_KEYS`, so an older install
that still sets one warns once and boots unchanged.

The sixth, `screenshots.data_bearing_gate`, **stays** — and the reason it stays
is the finding, not an exception. It is `consent`, and its missing reader means
the authorisation it appears to carry is not enforced anywhere. Deleting it
would remove the appearance of a gate and leave the unguarded action; the
repair is to build the reader, which is Phase 3 work with a real behaviour
change behind it. `legal_review_prep.consented_at` looked like the same case and
is not: it is the *timestamp* of a consent whose actual gate is
`legal_review_prep.acknowledged`, which is read and stays.

**The counter-argument is recorded rather than settled**, because it was raised
against this decision in parallel and is not obviously wrong: a data-bearing
screenshot embed is a *published egress*, so its confirmation routes into
`non-destructive-by-default`, which refuses a settings override by construction.
On that reading an `off` could never have been honoured at all, the reference
page advertises an opt-out that cannot exist, and the key is `derivable` with the
unconditional gate in `doc-screenshot-hygiene` as its replacement. Which reading
wins decides whether Phase 3 builds a reader or deletes a false promise, so it is
a product call and it is left to the maintainer. Kept as-is meanwhile: the
conservative side of that disagreement is the one that changes nothing.

## The table

Rows follow template order, so a diff against the template reads straight down.

| Key | Class | Default | Why | Disposition |
|---|---|---|---|---|
| `agent_config_version` | C | `""` | installer-owned pin selecting which package code executes | derivable — the installed package's own `package.json` version; `check_template_pin_drift` already enforces pin == package.json |
| `profile.id` | C | `developer` | master axis selecting the projected skill and command surface | un-inferrable |
| `projection.mode` | C | `scoped` | governs which artefacts reach the host trees at all | derivable — the resolved active-profile + `runtime.active_packs` set `_resolve_scoped_projection` already computes |
| `projection.rule_workspaces` | C | 9 workspaces | allowlist deciding which rules reach the agent | derivable — the rule's own `workspaces:` frontmatter intersected with the active profile/pack set, as `rule_scope.ts` already performs for `rule_packs: auto` |
| `projection.rule_packs` | C | `[]` | second allowlist axis on rule projection | derivable — the `auto` derivation already implemented in `src/install/rule_scope.ts` |
| `discipline_profile` | C | `__DISCIPLINE_PROFILE__` | master switch for the discipline rule tier | derivable — its own `auto` resolution against `src/config/host-capabilities.yml` |
| `rule_loading_tier` | C | `__RULE_LOADING_TIER__` | legacy master switch for rule loading | derivable — `discipline_profile` supersedes it with a documented mapping (minimal→off, balanced→essential, full→full) |
| `lean_projection.mode` | C | `eager-all` | `thin` removes rule bodies from the agent's context | derivable — `probe_host_compliance.ts` already computes the per-host thin/eager recommendation |
| `telegraph.speak` | C | `false` | ships a rule body; a token-cost lever in both directions | derivable — the telegraph kill-criterion bench verdict is a package-level decision, not a per-install one |
| `tokens.rich_skills` | C | `"on"` | token-spend lever | derivable — the skill's own `token_budget_class: rich` declaration plus the CI ceiling in `lint_token_budget_discipline.ts` |
| `cost.budgets.daily` | C | `0` | rolling spend ceiling | consent |
| `cost.budgets.weekly` | C | `0` | rolling spend ceiling | consent |
| `cost.budgets.monthly` | C | `0` | rolling spend ceiling | consent |
| `cost.budgets.per_tier.cheap` | C | `null` | per-tier spend ceiling | consent |
| `cost.budgets.per_tier.medium` | C | `null` | per-tier spend ceiling | consent |
| `cost.budgets.per_tier.strong` | C | `null` | per-tier spend ceiling | consent |
| `cost.enforcement` | C | `advisory` | decides whether a breach blocks or is merely logged | consent |
| `model.auto_switch` | C | `suggest` | authorises native model overrides, which is spend | consent |
| `personal.ide` | C | `""` | names a binary the agent would execute | un-inferrable |
| `personal.open_edited_files` | B | `false` | starts invoking that binary on every edit | consent |
| `personal.rtk_installed` | A | `false` | auto-detected machine fact | derivable — the wizard's own two-stage PATH probe (`which rtk` plus an identity check), which already overwrites the key |
| `personal.minimal_output` | A | `true` | reply-shape preference | derivable — `direct-answers` Iron Law 3 already fixes reply length per reply |
| `personal.play_by_play` | A | `false` | narration preference | derivable — `direct-answers`' narration ban is the standing default; an in-turn request is the only thing that lifts it |
| `personal.canary_name` | B | `""` | arms the session-degradation canary | un-inferrable |
| `personal.pr_comment_bot_icon` | A | `false` | comment cosmetics | derivable — `no-decorative-emojis-in-git-surfaces` already forbids the icon in PR comments |
| `personal.pr_progress_comments` | C | `false` | authorises unsolicited outbound comments on a PR | consent |
| `personal.autonomy` | C | `auto` | suppresses confirmation questions | derivable — `no-cheap-questions`' mode-independent Pre-Send Self-Check decides per question |
| `personal.user_type` | C | `"__USER_TYPE__"` | master axis filtering the projected surface | derivable — `profile.id` already carries the persona axis over a near-identical value set |
| `verbosity.intent_announcements` | A | `false` | narration preference | derivable — `personal.play_by_play` already gates the narration carve-out this key sits under |
| `verbosity.preview_artifacts` | C | `false` | removes pre-action review of commits, PRs, and branches | derivable — the Iron-Law gates already decide which artefacts need a pre-action look |
| `verbosity.routine_confirmations` | C | `false` | removes confirmation prompts | derivable — `no-cheap-questions`' Pre-Send Self-Check already decides whether a confirmation carries a real trade-off |
| `verbosity.offer_council_in_delivery` | A | `false` | offers a paid step; never takes it | derivable — `agent-config council:status`, which answers whether there is anything to offer |
| `verbosity.post_action_reports` | A | `minimal` | size of a status block | derivable — `direct-answers` Iron Law 3 and the reply-close contract already fix the status block to ONE end-summary |
| `project.pr_template` | C | `.github/pull_request_template.md` | filesystem path whose contents reach an outbound PR | derivable — GitHub's own PR-template resolution order; the key only caches a filesystem lookup |
| `project.upstream_repo` | C | `""` | destination of outbound improvement PRs | derivable — the installed package's own `package.json` repository field |
| `project.improvement_pr_branch_prefix` | A | `improve/agent-` | branch-name cosmetics | derivable — the repo's own branch-naming convention, observable from `git branch -r` |
| `project.audience` | C | `public` | C-test 4 — it governs the agent's own reasoning discipline: `self` makes the § 8-pre demand gate inert. Who a project is built for is a fact only its maintainer knows, so the agent never infers it and never asks; hand-edit or the GUI write route. The default is today's behaviour, so an install that never sets it is unchanged | policy |
| `github.pr_reply_method` | A | `create_review_comment` | picks between two endpoints of one operation | derivable — the `auto` value already in the enum: the routing detects the working endpoint on first use and writes it back |
| `augment.rules_use_symlinks` | A | `false` | reversible install mechanics | derivable — dev-mode detection at install time plus a symlink-capability probe on the target filesystem |
| `eloquent.access_style` | A | `getters_setters` | code convention | derivable — the convention the project's existing models already use; `standards-from-config` reads it off the tree |
| `chat_history.enabled` | C | `true` | kill-switch over a path that writes conversation content to disk | consent |
| `chat_history.frequency` | C | `__CHAT_HISTORY_FREQUENCY__` | capture granularity — a value that reduces what is captured erases the trail | consent |
| `chat_history.text_limits.user` | C | `0` | cap on how much user text is written to disk | consent |
| `chat_history.text_limits.agent` | C | `5000` | cap on how much agent text is written to disk | consent |
| `chat_history.text_limits.tool` | C | `200` | cap on how much tool payload is written to disk | consent |
| `chat_history.text_limits.phase` | C | `200` | cap on how much phase text is written to disk | consent |
| `pipelines.skill_improvement` | A | `true` | proposes a capture; the user still decides | derivable — the pipeline's own trigger condition; the capture is already a user-confirmed proposal |
| `reasoning.enabled` | C | `true` | master switch for the agent's own reasoning discipline | derivable — the RDP gate's own task-triviality and host self-assessment signals already decide per turn |
| `reasoning.auto_gate` | C | `true` | decides when that discipline engages | derivable — it only removes the RDP gate's host self-assessment signal, its cheapest and most situational input |
| `reasoning.components.orchestrator` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's task signal (complex / multi-component vs trivial) |
| `reasoning.components.notes_first` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's task signal; the notes file only exists once the gate engaged |
| `reasoning.components.grounding` | C | `true` | a component of the agent's own discipline | derivable — `think-before-action`'s own info-gap condition, which `source-discovery-gate` already tests |
| `reasoning.components.intent` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's host self-assessment signal |
| `reasoning.components.complexity_first` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's task signal (a load-bearing unknown exists or it does not) |
| `reasoning.components.verifier_default` | C | `true` | disabling it removes a verification step | derivable — the verifier's own structural-complexity gate |
| `reasoning.components.prediction_tracking` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's task signal; a turn with no prediction to log produces no entry |
| `reasoning.components.decision_ledger` | C | `true` | a component of the agent's own discipline | derivable — the escalation litmus in `notes-first-reasoning` (tactical to notes, durable to ADR) |
| `reasoning.components.uncertainty_budget` | C | `true` | a component of the agent's own discipline | derivable — the RDP gate's task signal; the score feeds adaptive effort only where the gate already engaged |
| `roadmap.skip_pre_run_gate` | C | `true` | disables a pre-run confirmation gate | derivable — the pre-run gate's own ambiguity condition; a genuine ambiguity prompts regardless |
| `roadmap.quality_cadence` | C | `end_of_roadmap` | governs when verification runs | derivable — `quality.local_auto_run` decides whether local verification runs, and the `verify-before-complete` evidence gate decides the moment |
| `roadmap.dashboard_regen_cadence` | A | `every_5_steps` | beat of a derived view | derivable — the dashboard is derived: `roadmap:progress` regenerates deterministically from the roadmap files |
| `roadmap.horizon_weeks` | C | `0` | a non-zero value relaxes a lint's plate-token ban | policy |
| `roadmap.gate_budget.max_cost_per_run_usd` | C | `5` | per-run spend ceiling on class-1 gate execution | consent |
| `roadmap.gate_budget.max_cost_per_rolling_7d_usd` | C | `25` | rolling spend ceiling on class-1 gate execution | consent |
| `planning.challenge_on_create` | C | `true` | disables the plan-confidence gate | derivable — the gate's own confidence conditions; a confident plan passes straight through |
| `planning.risk_review` | C | `true` | disables the risk-register validator | derivable — `lint_plan_risk_register`'s own scope predicate (ready, non-draft plans only) |
| `planning.completion_review` | C | `true` | disables the completion-review validator | derivable — `check_completion_review`'s own scope predicate, bound to the current diff hash |
| `quality.local_auto_run` | C | `false` | governs whether local verification runs at all | consent |
| `design.fidelity_mode` | C | `strict` | strict-mode selector, one of whose values is a Hard Floor | policy |
| `consistency.cross_source` | C | `"on"` | disables the cross-source discrepancy gate | derivable — the rule's own trigger condition; a discrepancy exists only when two present sources contradict |
| `screenshots.identity_allowlist` | C | `[]` | allowlist of identities that ship unredacted | consent |
| `screenshots.forbid_terminal_capture` | C | `true` | kill-switch over the highest-leak capture path | consent |
| `screenshots.data_bearing_gate` | C | `"on"` | the human-confirmation gate over a published egress | consent |
| `code_style.docblocks` | A | `minimal` | code convention | derivable — the project's own linter/style config and the docblock density of the touched file, which `standards-from-config` reads off the tree |
| `subagents.downshift` | C | `true` | routes to another model tier, which is spend and quality | derivable — the per-slice tier assignment in `auto-dispatch-classification`, which the orchestrator already computes per dispatch |
| `subagents.quota_arbitrage` | C | `true` | spends from a separate quota pool | consent |
| `subagents.model_map.lite` | C | `""` | names an external model endpoint | un-inferrable |
| `subagents.model_map.medium` | C | `""` | names an external model endpoint | un-inferrable |
| `subagents.model_map.high` | C | `""` | names an external model endpoint | un-inferrable |
| `subagents.implementer_model` | C | `""` | names an external model endpoint | un-inferrable |
| `subagents.judge_model` | C | `""` | names an external model endpoint | un-inferrable |
| `subagents.model_ceiling` | C | `""` | session-wide subagent model cap (exported as `CLAUDE_CODE_SUBAGENT_MODEL` by suite-owned CLI spawn wrappers), which is spend and quality | consent |
| `subagents.max_parallel` | C | `3` | parallelism cap, and therefore a spend rate | consent |
| `subagents.adversarial_council` | C | `"off"` | governs a paid verification step | consent |
| `ai_team.model` | C | `auto` | names an external model | un-inferrable |
| `ai_team.allow_delegate` | C | `false` | grants an external tool write access to the repository | consent |
| `ai_team.max_calls_per_day` | C | `50` | quota cap on a shared budget | consent |
| `ai_team.suppress_setup_hint` | A | `false` | hint cosmetics | derivable — the hint's own precondition; `agent-config doctor --check team` already knows whether team mode is configured |
| `ai_team.review_gate.managed` | C | `false` | governs an upstream review gate | consent |
| `ai_team.review_gate.max_consecutive_blocks` | C | `3` | circuit-breaker threshold | derivable — the existing N=3 validation-loop budget in `autonomous-execution`, which already bounds consecutive failed attempts on one target |
| `emergency.orchestration_halt` | C | `false` | the one audited incident switch over the always-on orchestration stack — see § The one exception above | consent |
| `emergency.orchestration_halt_justification` | C | `""` | required non-empty before the halt may be lifted; an audit-trail field | consent |
| `onboarding.onboarded` | C | `false` | flipping it bypasses the onboarding gate | derivable — the wizard's own completion artefacts; the onboarding hook can read whether setup actually ran instead of trusting a self-reported flag |
| `commands.auto_detect` | C | `enabled` | kill-switch for orchestrator auto-detection | derivable — the orchestrator's own confidence-tiered detection table plus the non-interactive TTY/CI probe |
| `commands.suggestion.enabled` | A | `true` | a convenience layer; governs no gate and no spend | derivable — the suggester's own match-score threshold and cooldown; a prompt that matches nothing already produces silence |
| `commands.suggestion.confidence_floor` | A | `0.6` | tuning of that convenience layer | derivable — the suggester's calibrated constant, with the existing per-command frontmatter override where one command needs a different bar |
| `commands.suggestion.cooldown_seconds` | A | `600` | tuning of that convenience layer | derivable — the per-command cooldown tracker, which already reads session behaviour |
| `commands.suggestion.max_options` | A | `4` | tuning of that convenience layer | derivable — the number of matches that clear the confidence floor, bounded by the numbered-options shape `user-interaction` fixes |
| `commands.suggestion.blocklist` | C | `[]` | a deny-list | derivable — the same cooldown tracker that reads whether the user picks a suggestion; repeated non-selection is the signal a hand-maintained deny-list stands in for |
| `commands.create_pr.preview_description` | C | `false` | removes pre-publish review of an outbound artefact | consent |
| `commands.create_pr.detail_level` | A | `min` | verbosity of a generated body | derivable — the diff the command already reads (changed-file count and risk surface) |
| `commands.create_pr.api_examples` | A | `true` | verbosity of a generated body | derivable — the command's own API-surface detection plus its grounded-source requirement |
| `commands.create_pr.screenshots` | C | `false` | puts captured screenshots into a published PR body | consent |
| `commands.create_pr.ui_paths` | C | `[]` | glob allowlist | derivable — the frontend-surface heuristic the PR-description flow already applies when the glob list is empty |
| `commands.create_pr.api_paths` | C | `[]` | glob allowlist | derivable — the API-endpoint heuristic the same flow already applies as its documented empty-list fallback |
| `memory.cadence` | C | `always` | suppressing the visibility line hides what the agent learned from the user | derivable — the hits/asks count the memory-visibility summary already computes; the line only exists when memory was consulted |
| `memory.review_threshold` | A | `10` | when a review preview surfaces; governs no gate | derivable — the unreviewed-intake count `/memory load` already computes before rendering its preview |
| `memory.redact_patterns` | C | `[]` | deny-list of secret and PII regexes | policy |
| `memory.session_index` | A | `"off"` | injects a compact index at session start | derivable — the row cap and index cost the mechanism already computes; the flag only holds an unproven ship-criterion open |
| `memory.learn_on_session_end` | B | `false` | turns on automatic memory writes at session end | consent |
| `knowledge.global_sharing.enabled` | C | `true` | kill-switch over cross-project egress | consent |
| `knowledge.global_sharing.allowed_tiers` | C | `[public]` | allowlist for that egress | consent |
| `knowledge.global_sharing.redaction.enabled` | C | `true` | disabling it removes the redaction floor | derivable — the redaction scan's own match result; no violation means no-op, so the flag can only remove a floor on an already-authorised path |
| `knowledge.global_sharing.redaction.halt_on_trigger` | C | `true` | disabling it removes halt-and-prompt | derivable — the violations list the redaction scan already returns; a non-empty list IS the halt condition |
| `knowledge.global_sharing.auto_promote_threshold` | C | `2` | threshold governing that egress | derivable — the distinct-repo count the promotion candidates already compute; promotion stays suggest-only and human-confirmed |
| `knowledge.global_sharing.freshness.hypothesis_after_days` | A | `90` | freshness heuristic on a card already shared | derivable — the age computation over the card's own `last_verified` provenance footer |
| `knowledge.global_sharing.freshness.stale_after_days` | A | `180` | freshness heuristic on a card already shared | derivable — the same age computation; the cut-point is advisory because the card is a cache, never a source of truth |
| `hooks.concern_budget.max_per_event` | C | `8` | budget cap on hook concerns | derivable — the gate's own constant over `hook_manifest.yaml`, with no consumer-situational input to read |
| `hooks.concern_budget.tier1_concerns` | C | `[]` | allowlist of concerns permitted to fail closed | policy |
| `hooks.concern_budget.hard_fail` | C | `false` | weakens the budget gate to warn-only | derivable — the gate's own `--strict` argv, which CI already passes to sibling gates |
| `hooks.injection_scan.enabled` | C | `false` | the prompt-injection scanner | derivable — the scanner's own signature match on the tool envelope; warn-only and silent on no hit |
| `hooks.rtk_wrap.enabled` | C | `false` | configures code that runs on every tool call | derivable — the live PATH and identity probe the hook already runs; silent when rtk is absent |
| `hooks.design_slop.enabled` | C | `false` | configures code that runs on every tool call | derivable — the rule-registry match plus the hook's own per-signature silence cap |
| `hooks.ui_route_nudge.enabled` | C | `false` | configures code that runs on every tool call | derivable — the UI-surface predicate plus the hook's own two-nudges-per-session cap |
| `hooks.design_pass.enabled` | C | `false` | C-test 1 — it configures code that runs on every tool call and at every turn end, and unlike its two `hooks.*` neighbours its stop pass can BLOCK rather than warn | policy — whether an operator accepts a gate that can refuse a turn is a risk preference, not a fact the tree can compute. The two neighbours are `derivable` because they only ever warn; the block is the discriminator. `road-to-frontend-power` transfers the default flip to the owner for the same reason |
| `hooks.code_graph.enabled` | C | `false` | configures code that runs on every tool call | derivable — the index-detection probe the nudge already runs; no index means silence |
| `hooks.suggestion_capture.enabled` | C | `false` | configures code that runs at every turn end and every prompt | consent |
| `decision_engine.surface_traces` | C | `false` | the decision engine’s own black box; the agent must not be able to close it | derivable — the engine's own active-gate state; there is nothing to surface when no gate fired |
| `decision_engine.min_confidence` | C | `"off"` | the confidence gate | derivable — the confidence band the scoring engine already computes at the plan phase |
| `decision_engine.block_on_risk` | C | `"off"` | the risk-class gate | derivable — the risk class the engine already computes at the implement phase; the Hard Floor covers the irreversible end unconditionally |
| `decision_engine.require_memory_hits` | C | `false` | a phase gate | derivable — the memory-hit count at the refine phase; its own template comment says the flag delays that soak |
| `decision_engine.on_block` | C | `stop` | `warn` advances past a gate that fired | derivable — the non-interactive probe decides ask-versus-stop, and the fired gate's own action decides the rest |
| `decision_engine.ask_timeout_seconds` | C | `30` | how long a fired gate waits before falling back | derivable — the same non-interactive probe: where nobody can answer there is nothing to wait for |
| `decision_engine.on_block_fallback` | C | `stop` | fail-safe versus fail-open after that timeout | derivable — the same non-interactive detection; a gate that fires with no one to answer resolves fail-safe by construction |
| `update_check.enabled` | C | `true` | a background safety check; disabling it pins the user to known-vulnerable code | consent |
| `explain.enable_last` | A | `true` | a read-only diagnostics surface | derivable — the presence of a work-state trace to render; with no trace the command is already a no-op |
| `legal_review_prep.acknowledged` | C | `false` | the consent gate; the safety floor requires the wizard checkbox | consent |
| `legal_review_prep.require_council` | C | `true` | a fail-closed defence-in-depth gate | consent |

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
<!-- Historical record: `chat_history.on_overflow` was deleted 2026-08-12 as one
     of the six unread keys. The A → C move above still stands as what the
     council decided about it while it existed. -->

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

## The floor — the residual `un-inferrable` set, with the reason each survives

These nine are the answer to *"how few keys can this surface have?"*, and the
answer is published rather than asserted: each row states what a mechanism would
have to observe to derive the value, and why nothing in the environment carries
that. A row here is falsifiable — name the probe and it stops being
un-inferrable.

The direction this contract encodes is fewer keys. This section is where that
direction stops, and stating the stopping point is what keeps "we are down to N"
from being a slogan. `un-inferrable` is the only disposition expected NOT to
shrink; `derivable` is a queue, `consent` is under re-examination, and `policy`
moves into the project surface.

| Key | Why no mechanism can derive it |
|---|---|
| `profile.id` | Which of the six audience identities the human *is*. The tree carries what the project contains, never who is sitting in front of it — a repo full of TypeScript is equally a developer's, an agency's, and a founder's. |
| `personal.ide` | Names a binary to execute. A probe can list what is installed; it cannot know which one the human wants opened, and guessing wrong executes the wrong program. |
| `personal.canary_name` | What the human wants to be called. `git config user.name` supplies a *prefill*, never the answer — the two differ for most people, and a wrong name is worse than none, because the canary then signals on a token the user never watches for. |
| `subagents.model_map.lite` | Names an external model endpoint. Which endpoints an account may call is a billing fact behind a vendor, not a property of the machine or the repo. |
| `subagents.model_map.medium` | Same — the endpoint this account may call at this tier. |
| `subagents.model_map.high` | Same — the endpoint this account may call at this tier. |
| `subagents.implementer_model` | Same, for the implementer role: which endpoint is permitted and paid for is outside anything the package can observe. |
| `subagents.judge_model` | Same, for the judge role — and here a wrong default is worse than an empty one, because it would silently judge with the model under test. |
| `ai_team.model` | Same, for the team surface. `auto` is a resolution *strategy*, not a derivation: it still needs the endpoint list this key supplies. |

The `consent` class (39) is deliberately NOT part of this floor. Those keys are
kept for now but sit under the Phase-3 re-examination that asks whether the
ACTION needs authorising at all — a consent gate on something the package should
not be doing is two problems wearing one flag, and the repair may remove the
action rather than the key.

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
