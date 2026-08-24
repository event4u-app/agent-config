---
type: "auto"
tier: "2a"
alwaysApply: false
description: "Asking the user about a setting — one question per command execution, a fixed four-slot shape, and the key's class decides where the answer goes"
triggers:
  - keyword: "settings:set"
  - keyword: "canary_name"
  - keyword: "rich_skills"
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
  - "instruction-only: no gate counts the questions in a chat turn; settings:set fences the illegal WRITE, never the badly-shaped ask"
collision_ok:
  "canary_name": "the nickname ask is this protocol's canonical B-class instance — session-canary owns what the NAME then does and which layers already supply it, this rule owns how it is asked for and where the answer goes"
# obligation: line 39
obligation_frequency: "per-task"
# frequency-override: the per-turn phrase at line 175 is a See-also cross-reference to
# ask-when-uncertain's rule, not this rule's own obligation, which is per command execution.
---

# Settings-Ask Protocol

A settings question is the one ask where the agent poses the question *and* owns
where the answer goes. Seven keys can produce one, in two mechanisms that look
identical from outside and differ completely underneath.

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

## The four slots

1. **What is needed** — the key in plain words, not the dotted path alone.
2. **Why now** — the concrete thing in *this* run that cannot proceed without it.
3. **Options, default marked** — the conservative option is always present and
   always marked as what happens if the user says nothing.
4. **Where the answer is stored** — one line, and it is not optional: it is the
   only way to tell a one-run answer from a standing consent.

Slot 4 is read from the class, never from taste:

| Class | Slot 4 reads | Writer |
|---|---|---|
| **B** (3 keys) | "persisted to your global settings — you will not be asked again" | `agent-config settings:set <key> <value> --source jit-answer` |
| **C** set to `ask` | "not saved; making it permanent is a human edit or the GUI" | none — the agent writes nothing |

**"Not saved" is about persistence, not about how long the answer is honoured.**
How long it stays cached in working state is the key's own business, and several
keys state their own scope. Reading the C path as "re-ask every execution" would
turn a fence against illegal writes into a source of extra questions.

## The seven keys

**Class B — persist once**: `personal.canary_name` ·
`personal.open_edited_files` · `memory.learn_on_session_end`. Each ships a
conservative default (`""`, `false`, `false`), so absent is indistinguishable
from *no* and never from *yes*.

**Class C carrying an `ask` value in its own enum** — a runtime question whose
answer dies with the run: `tokens.rich_skills`,
`subagents.adversarial_council`, `decision_engine.on_block`. **None of them
ships as `ask`** — a human sets it, so the whole class is opt-in and no shipped
default routes a question through this protocol at all.

Two deletions got the list here. Always-on orchestration
(road-to-always-on-orchestration Phase 1) removed `subagents.auto` and
`subagents.budget_routing`. ADR-229 removed `worktrees.mode`, which was the last
key that *shipped* as `ask` — worktree creation is instruction-only now, so
there is no setting and nothing to ask about.

## The budget

The first key that genuinely blocks the run gets the question. Every other
undecided key resolves to its conservative default **without a question** and
appears in the end-summary as one line: key, value taken, command that changes it.

**The split is computed, not chosen.** `planSettingsAsks` in
`src/shared/settingsAsks.ts` returns the single key asked, the keys taking their
default silently, and the keys skipped with a reason; `silentDefaultsSummary`
renders lines that ride **inside** the one end-summary
([`direct-answers`](direct-answers.md) Iron Law 3).

Two questions in one execution is the violation this rule prevents.
Batching them into a single numbered-options block is the same violation wearing
a different shape: one *block* is one question only when a single number answers
it ([`user-interaction`](user-interaction.md) § question pacing).

## Non-interactive executions ask nothing, ever

CI, a pipe, a hook, MCP serving, `AGENT_CONFIG_NO_UI`, a headless display: the
budget is **zero**, not one. `nonInteractiveReason` in
`src/shared/interactiveContext.ts` is the predicate; `interactive: false` makes
`planSettingsAsks` carry no ask by construction. Defaults taken are still named —
silent is not invisible. A question nobody can answer is not a question; it is a
hang, or a default taken in the user's name wearing a prompt's clothes.

## Who picks the moment — the half no gate can check

The class contract's B invariant has two halves. Half one (a conservative
default) is linted. Half two binds here: the trigger must be the **user's own
request arriving at a point where the setting is genuinely required**. A
threshold the agent watched, a moment it judged favourable, or a convenient lull
are not triggers. If the run would complete without the setting, there is no
question.

## Worked example — the nickname, the canonical B ask

`personal.canary_name` is un-inferrable and arms the session-degradation canary,
so it is the one settings question a fresh session legitimately asks. Prefill so
accepting costs one keypress:

```bash
git config user.name        # first choice — the name they already chose here
# then: $USER, then $USERNAME (Windows). Never $USER alone.
```

On an answer: `agent-config settings:set personal.canary_name "<name>" --source jit-answer`.

**Do not ask an already-armed user.** The browser wizard writes `identity.name`
into `settings/.agent-user.yml`, the canary's third resolution layer, so a wizard
user is already covered ([`session-canary`](session-canary.md) resolves all
three). Check before asking.

## Before a consent-gated action — verify the record, not the value

`true` a human chose and `true` the machine inferred are the same byte and not
the same permission. `consentVerdict` in `src/shared/settingsConsent.ts` grants on
`jit-answer` / `gui` / `manual` and on a hand-edited file (which the class
contract guarantees carries no stamp); it withholds on the conservative default,
on a permissive value nothing records, and on `auto-detected` — an agent that may
write its own provenance must not reach its own permission by observing the
world. This is also the reader the provenance sidecar was missing: it was written
by `settings:set` and only *displayed* by the GUI.

## When NOT to fire

- Class A — resolves to its default, never asked.
- Class C **not** set to `ask` — no question; a change is a human edit.
- Already decided on any resolution layer, or the run completes without it.
- **The `ask` routes to a permission gate** — a permission ask about an
  *action*, which `scope-control` owns; a storage line there would store
  nothing. `worktrees.mode: ask` was the worked example until ADR-229 deleted
  the key; the carve-out is kept because the shape recurs, not the key.
- **The `ask` is code, not agent-carried.** `decision_engine.on_block: ask` is a
  TTY prompt in `work_engine/hooks/builtin/decision_gate.ts`.

## Honest enforcement — `instruction-only`

No gate counts the questions in a chat turn, and no B key currently gates an
action through a guard: the two that gate behaviour
(`personal.open_edited_files`, `memory.learn_on_session_end`) are read as values,
and the action they govern is prose. So the budget, the four slots, the
who-picks-the-moment half, and the obligation to consult `consentVerdict` are all
model-carried. On a prose-only host ask-once can degrade to ask-never. The
deterministic fences sit one layer down and guard a different thing:
`settings:set` and the GUI write route both refuse every C key and fail closed on
an unreadable contract, so a protocol violation cannot become an illegal *write* —
only a badly-shaped *ask*.

## See also

- [`docs/contracts/settings-classes.md`](../docs/contracts/settings-classes.md) — the A/B/C source of truth; slot 4 is read from it.
- [`ask-when-uncertain`](ask-when-uncertain.md) — one question per turn; this narrows it to one *settings* question per execution.
- [`no-cheap-questions`](no-cheap-questions.md) — the floor a settings question clears before it is asked at all.
- [`user-interaction`](user-interaction.md) — the numbered-options shape slot 3 uses.
- [`session-canary`](session-canary.md) — what the nickname answer activates, and the layers to check first.
