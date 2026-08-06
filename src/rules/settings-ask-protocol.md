---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Asking the user about a setting — one question per command execution, a fixed four-slot shape, and the key's class decides where the answer goes"
triggers:
  - keyword: "settings:set"
  - keyword: "canary_name"
  - keyword: "rich_skills"
  - keyword: "budget_routing"
  - keyword: "adversarial_council"
  - keyword: "learn_on_session_end"
  - keyword: "open_edited_files"
  - phrase: "ask about a setting"
  - phrase: "settings question"
  - phrase: "should I enable"
  - phrase: "nickname"
  - path_prefix: "docs/contracts/settings-classes.md"
self_contained: true
workspaces: [agent-config-maintainer, engineering]
packs: [meta]
routes_to:
  - "contract:settings-classes"
enforced_by:
  - "none"
collision_ok:
  "canary_name": "the nickname ask is this protocol's canonical B-class instance — session-canary owns what the NAME then does and which layers already supply it, this rule owns how it is asked for and where the answer goes"
---

# Settings-Ask Protocol

A settings question is the one ask where the agent both poses the question and
owns where the answer goes. Nine keys can produce one, in two mechanisms that
look identical from the outside and differ completely underneath. This rule
normalises the shape and fixes the destination, so a consent the user gave once
is not asked again and a guarded key is never persisted in their name.

## The Iron Law

```
AT MOST ONE SETTINGS QUESTION PER COMMAND EXECUTION. NEVER TWO.
THE KEY'S CLASS DECIDES WHERE THE ANSWER GOES — NEVER THE CONVENIENCE OF THE MOMENT.
CLASS B → PERSIST VIA `settings:set --source jit-answer`. ASKED ONCE, EVER.
CLASS C SET TO `ask` → THIS RUN ONLY. THE AGENT NEVER PERSISTS IT.
FURTHER UNDECIDED KEYS TAKE THE CONSERVATIVE DEFAULT SILENTLY AND ARE NAMED
IN THE END-SUMMARY WITH THE COMMAND THAT CHANGES THEM.
A SILENT PERMISSIVE DEFAULT IS A DECISION TAKEN IN THE USER'S NAME. NEVER TAKE ONE.
```

## The four slots — every settings question, same shape

1. **What is needed** — the key, in plain words, not the dotted path alone.
2. **Why now** — the concrete thing in *this* run that cannot proceed without it.
3. **Options, with the default marked** — the conservative option is always
   present and always marked as what happens if the user says nothing.
4. **Where the answer is stored** — one line, and it is not optional: it is the
   only way the user can tell a one-run answer from a standing consent.

Slot 4 is filled from the class, never from taste:

| Class | Slot 4 reads | Writer |
|---|---|---|
| **B** (3 keys) | "persisted to your global settings — you will not be asked again" | `agent-config settings:set <key> <value> --source jit-answer` |
| **C** set to `ask` | "applies to this run only; making it permanent is a human edit or the GUI" | none — the agent writes nothing |

## The nine keys

**Class B — persist once** (`docs/contracts/settings-classes.md`):
`personal.canary_name` · `personal.open_edited_files` ·
`memory.learn_on_session_end`. Each ships a conservative default (`""`,
`false`, `false`), so absent is indistinguishable from *no* and never from *yes*.

**Class C carrying an `ask` value in its own enum** — a runtime question whose
answer dies with the run: `subagents.budget_routing` and `worktrees.mode` (both
**ship** as `ask`), plus `tokens.rich_skills`, `subagents.auto`,
`subagents.adversarial_council`, `decision_engine.on_block` (which can be set to
`ask` by a human but do not ship that way).

## The budget, and what "further undecided" means

The first key that genuinely blocks the run gets the question. Every other
undecided key in the same execution resolves to its conservative default
**without a question** and appears in the end-summary as one line: the key, the
value taken, and the command that changes it. `isConservativeDefault` in
`src/shared/settingsClasses.ts` is the test — `null`, `false`, `''`, `0`, `[]`,
`{}`.

**The split is computed, not chosen.** `planSettingsAsks` in
`src/shared/settingsAsks.ts` takes the keys this execution needs, the class
index, and the defaults, and returns which single key is asked, which take their
default silently, and which are skipped with a reason (already decided · class A
· class C · unclassified · a default that is not conservative). Use it rather
than deciding the split per run; `silentDefaultsSummary` renders the lines that
ride **inside** the one end-summary
([`direct-answers`](direct-answers.md) Iron Law 3), never as a second one.

Two questions in one execution is the violation this rule exists to prevent.
Batching them into a single numbered-options block is the same violation wearing
a different shape: one *block* is one question only when a single number answers
it ([`user-interaction`](user-interaction.md) § question pacing).

## Non-interactive executions ask nothing, ever

CI, a pipe, a hook, MCP serving, `AGENT_CONFIG_NO_UI`, a headless display: the
budget is **zero**, not one. Every needed key takes its conservative default,
nothing is written, and the defaults are still named in the end-summary — silent
is not the same as invisible. `nonInteractiveReason` in
`src/shared/interactiveContext.ts` is the predicate; pass `interactive: false` to
`planSettingsAsks` and the plan carries no ask by construction.

A question nobody can answer is not a question. It is either a hang or a default
taken in the user's name while wearing a prompt's clothes.

## Who picks the moment — the half no gate can check

The class contract's B invariant has two halves. Half one (a conservative
default) is linted. Half two is not, and it binds here: the trigger must be the
**user's own request arriving at a point where the setting is genuinely
required**. A threshold the agent watched, a moment it judged favourable, or a
convenient lull are not triggers. If the run would complete without the setting,
there is no question to ask.

## Worked example — the nickname, the canonical B ask

`personal.canary_name` is un-inferrable and arms the session-degradation canary,
so it is the one settings question a fresh session legitimately asks. Prefill it
so accepting costs one keypress, in this order:

```bash
git config user.name        # first choice — the name they already chose here
# then: $USER, then $USERNAME (Windows). Never $USER alone.
```

Then, on an answer: `agent-config settings:set personal.canary_name "<name>" --source jit-answer`.

Already-armed cases where the question must **not** fire: the browser wizard
writes `identity.name` into `settings/.agent-user.yml`, which is the canary's
third resolution layer — a wizard user is already covered, and
[`session-canary`](session-canary.md) resolves all three layers before the canary
is dark. Check before asking.

## When NOT to fire

- The key is class A — it resolves to its default and is never asked.
- The key is class C **not** set to `ask` — there is no question; a change is a
  human edit.
- The setting is already decided on any resolution layer.
- The run completes without it.

## Honest enforcement — `enforced_by: none`

No gate counts the questions in a chat turn. The one-per-execution budget, the
four-slot shape, and the who-picks-the-moment half are model-carried, and saying
so is the point: the deterministic fences that DO exist sit one layer down and
guard a different thing — `settings:set` and the GUI write route both refuse
every C key and fail closed on an unreadable contract, so a protocol violation
cannot become an illegal *write*. It can only become a badly-shaped *ask*.

## See also

- [`docs/contracts/settings-classes.md`](../docs/contracts/settings-classes.md) — the A/B/C source of truth; slot 4 is read from it.
- [`ask-when-uncertain`](ask-when-uncertain.md) — one question per turn; this rule narrows it to one *settings* question per execution and fixes the shape.
- [`no-cheap-questions`](no-cheap-questions.md) — the floor a settings question must clear before it is asked at all.
- [`user-interaction`](user-interaction.md) — the numbered-options shape and the recommendation line slot 3 uses.
- [`session-canary`](session-canary.md) — what the nickname answer activates, and the three layers to check before asking.
