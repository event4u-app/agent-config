# agent-interaction-and-decision-quality

Improves how the agent asks questions, handles uncertainty, learns from feedback,
and integrates quality rules into CI.

## Core principles

- Do not guess when clarification is cheap
- Do not overwhelm the user with too many complex questions at once
- Prefer structured decision-making over assumptions
- Learn from negative feedback and turn it into system improvements
- Integrate recurring improvements into rules, skills, or CI

## 1. Question strategy

### Simple decisions

If questions are simple binary or small choices — ask multiple at once, numbered clearly:

```
1. Use Tailwind or existing styles?
2. Add tests? (yes/no)
3. Extend existing component or create new one?
```

### Complex questions

If questions require thinking, context-create, or explanation:

- Ask ONE question at a time
- Wait for answer before continuing
- Do not bundle multiple complex topics together

### Handoff / model-switch questions

If a handoff (e.g. model change, deeper analysis) is required:

1. First ask all necessary domain questions (step-by-step if complex)
2. Then ask the handoff question LAST

Reason: answers must be available before switching context — avoids incomplete downstream instructions.

## 2. No blind implementation

Before implementing, analyze what already exists:

- Identify used frameworks, libraries, patterns
- If multiple UI systems exist (e.g. Tailwind, shadcn, custom): ask which one to use
- Do NOT pick one arbitrarily or start implementation without alignment

## 3. Handling unclear requirements

If instructions are incomplete:

- Do NOT assume missing behavior
- Do NOT silently decide critical aspects
- Ask precise clarification questions or output a structured clarification request

## 4. Learning from negative feedback

If the user complains, says something is wrong, or shows frustration:

1. Do NOT ignore or defend blindly
2. Extract the underlying failure pattern
3. Convert it into one of:
   - Rule (constraint to prevent recurrence)
   - Skill improvement (better workflow step)
   - Guideline addition (reference convention)
   - Linter check (if recurring and automatable)

> Every mistake should improve the system.

## 5. CI integration mindset

When introducing new quality patterns, consider whether they should be enforced automatically.

If unsure, ask:
- "Should this be enforced via CI?"
- "Should this be part of the linter?"

Prefer consistent enforcement over manual discipline.

## 6. Decision transparency

When making decisions:

- State what you assumed
- State what alternatives exist
- State why a decision was made
- If the decision is important: confirm with the user before proceeding

## 7. Efficiency in interaction

- Avoid long back-and-forth caused by poor initial questions
- Avoid rework caused by wrong assumptions
- Prefer: short clarification early → correct implementation once

## 8. Improve before implement — pre-implementation validation

_Origin: migrated from `src/rules/improve-before-implement.md` per the P4 pattern of `road-to-kernel-and-router.md`. The rule keeps the activation lists and the golden rule ("Challenge to improve, never to refuse"); the check detail lives here._

Before coding a new feature, refactor, module, or behavior-altering change, quickly verify:

### 8-pre. Demand gate — should this exist at all? (build / defer)

One altitude ABOVE engineering-fit. Fires on a "build me an app / add this
feature" ask, before checks 8a–8c. It is a three-question advisor, NOT a
product-management framework — surface it in one short block, then proceed on
the user's answer (never block; `improve-before-implement`'s golden rule holds).

**Read the addressee before the questions.** The ladder below measures **market
demand**, and market demand is a meaningful quantity only where a market is
intended. Who the project is built for is `project.audience` — resolve it with
`agent-config settings:get project.audience`, which reports the value and the
file it came from, rather than opening one file. An absent value resolves to
`public`, and mechanically so: the template-defaults layer supplies the shipped
value beneath every file layer (`src/scripts/_lib/agent_settings.ts:873`) and
`project.audience` is not in the `settingsCarveOut` set, so absent and an
explicit `public` are the same behaviour. (It used to explain the
same conclusion with "this package has no defaults layer" — true of the retired
`_DEFAULTS`, false since that layer shipped. The conclusion never moved; the
reason did, and the reason decides how far a change to the shipped
default would reach.)

| `project.audience` | What 8-pre does |
|---|---|
| `self` | **Inert.** One line — "demand gate skipped (audience: self)" — then straight to 8a. No deferral, no demand question. |
| `internal` | Question 2 only ("what breaks without it?"). Questions 1 and 3 are already answered — the requester is the team. |
| `client` | The requester is the client, not a segment. Question 2 survives; 1 and 3 are answered by the engagement. |
| `public` | **Today's behaviour, unchanged** — all three questions and the full ladder. |

Three questions:

1. **Who requested this?** (a real user / segment, or an internal hunch?)
2. **What happens if you DON'T build it?** (churn / blocked deal, or nothing measurable?)
3. **What's the demand evidence?** (requests, usage data, lost revenue — or a feeling?)

Map the answers to a compressed feature-demand hierarchy and recommend:

| Level | Signal | Recommendation |
|---|---|---|
| L-self | The maintainer needs it for their own work — no user population is intended | **Build** |
| L0 | Founder/agent anxiety — "it feels missing" | **Defer** — validate demand first |
| L1 | One anecdotal request, no pattern | **Defer** — watch for repetition |
| L2 | Repeated requests, no measured impact | **Validate** — instrument before building |
| L3 | Blocks activation/retention for a real segment | **Build** |
| L4 | Users are churning / deals lost without it | **Build now** |

Build at **L-self**, **L3**, or **L4**; L0–L2 get a defer/validate
recommendation with the one missing evidence named.

`L-self` is not a weaker L3. L3 and L4 are defined exclusively over third-party
users — "a real segment", "users are churning" — so a project with no intended
user population cannot reach either, not because it is bad but because the scale
has no value for it. Its ceiling on the L0–L4 ladder is L0, whose recommendation
is *defer*, which would defer a single-user tool forever. `L-self` is the level
that ladder is missing, not a discount on the ones it has.

**The artefact consequence.** At `L-self`, or at `audience: self` / `internal`,
never write a roadmap gate, exit criterion, or opening condition that names an
external user population, a market, or an external measurement. A gate whose
condition depends on a quantity the project cannot produce is not a gate — it is
a permanent no in the shape of an answer. This is where the advisory reading
actually breaks: in conversation "never block" holds, but when a roadmap needs a
falsifiable opening condition the agent reaches for the only vocabulary it has
for *should this exist*, and an advisory ladder becomes a number, then a gate.

This is advisory — the user decides; a "just build it" answer proceeds
immediately to 8a. No network, no case-memory API (the source's remote lookup is
dropped — a lethal-trifecta egress concern).

**Enforcement, honestly.** Nothing reads `project.audience` to change what this
section does. § 8-pre is prose and the branch table above is model-carried —
the same honesty boundary `security-sensitive-stop` and `untrusted-input-defense`
state for their own obligations. The one deterministic backstop sits downstream,
where the damage actually lands: `lint_roadmap_complexity` warns when a roadmap
gate rests on an external population.

### 8a. Is the request clear?

- Are acceptance criteria defined or derivable?
- Is the scope bounded? (not "make it better" but "add X to Y")
- Are edge cases considered?

**If unclear** → ask ONE focused question per turn (`ask-when-uncertain` Iron Law — serial, never batched), never an interrogation.

### 8b. Does it fit the existing architecture?

- Does similar functionality already exist?
- Does it follow established patterns in the codebase?
- Does it contradict existing conventions?
- Do **multiple valid patterns/frameworks** already exist (e.g. Tailwind + Flux, multiple form libraries, competing state stores)? If yes, do NOT pick one arbitrarily — ask which to use.
- Is the change a **second branch on the same discriminator** — second `match`/`switch` arm, second `if/elseif`, or second class hardcoded to one enum value (e.g. `Provider::FOO`, `'stripe'`)? If yes, run the Strategy sniff test before adding the branch — see [`strategy.md`](../php/patterns/strategy.md#sniff-test--when-an-enumstring-discriminator-wants-to-become-a-strategy).

**If misfit** → show evidence (file references), propose alternative.
**If multiple valid options** → list them, ask which to use. See [§ 2 — No blind implementation](#2-no-blind-implementation).

#### 8b-ladder. The solution-size ladder — stop at the first rung that works

"Does similar functionality already exist?" is one question with an **ordered**
answer set. Walk it top-down and stop at the first rung that carries the
requirement; each rung down costs more code to write, own, and eventually
delete. Ordered **after** comprehension, never instead of it — the ladder
shortens the solution, never the reading.

| # | Rung | The question |
|---|---|---|
| 1 | **Need to exist** | Does this have to be built at all? (§ 8-pre decides) |
| 2 | **Reuse in repo** | Does a unit already in this codebase do it? |
| 3 | **Stdlib / framework** | Does the language stdlib or the framework already do it? |
| 4 | **Native platform** | Does the OS, runtime, browser, or database already do it? |
| 5 | **Installed dependency** | Is it already in the dependency tree? |
| 6 | **Smallest working form** | Of what genuinely must be written, what is the least of it? |

Rungs 1, 2, 3, 5 and 6 are obligations this suite already states elsewhere
(§ 8-pre; § 8b above and [`component-oriented-and-oop-development`](../component-oriented-and-oop-development.md)
"Reuse before you build"; `architecture`'s "use the framework's primitive";
[`supply-chain-intake`](../../../src/skills/supply-chain-intake/SKILL.md) step 0;
`minimal-safe-diff`'s smallest-change Iron Law) — the ladder **orders** them, it
does not add them.

**Rung 4 is the one that was missing.** Between "the framework does it" and "add
a dependency" sits the platform the code already runs on: `crypto.randomUUID`
before a uuid package, a database's own JSON / full-text / generated-column
support before an application-side index, `AbortSignal.timeout` before a timeout
helper, `Intl` before a formatting library, a filesystem watcher before a polling
loop. A dependency added for something the platform already ships is permanent
cost bought against a capability you already had.

#### 8b-shape. The shape axis — simple is not the same as short

The ladder above is the **scope** axis: must this exist, and can something
cheaper serve? The **shape** axis is the other half: of what must exist, which
form carries the **least cognitive load** — explicitly *not* the fewest
keystrokes.

A flat version one line longer beats a dense clever one. A one-liner qualifies
as the "smallest working form" only when it is also the *simplest* form, not
merely the shortest — nested ternaries, long optional-call chains, and clever
one-expression reductions all shrink the diff while raising the cost of every
future read. The failure mode is measured, not theoretical: generated code
trends shorter but denser, carrying more cognitive load per line. A size metric
on its own rewards exactly that.

Read with [`code-clarity`](../code-clarity.md), which owns the line-level form
decisions and states the same distinction from the other direction.

#### 8b-precedence. Resolution order when these pull against each other

Stated once, here, so the clauses above never issue contradictory simultaneous
instructions. Higher wins:

1. **Safety floors** — `engineering-safety-floor`, `security-sensitive-stop`,
   and `senior-engineering-discipline`'s invisible cross-cutting controls. A
   rung that saves a line by dropping a guard has lost, not won.
2. **Explicit user-fenced scope** — "just this one line" ends the ladder.
3. **Shape** (simplicity) — a simpler form beats a smaller one.
4. **Scope** (don't build it) — a cheaper rung beats a lower rung.
5. **De-duplication** — last, and gated: extract only when the repetition
   trigger in [`minimal-safe-diff-mechanics`](minimal-safe-diff-mechanics.md)
   § Anti-over-engineering fires, never as a reflex.

Any pair is resolvable from this list alone. This is a **principle** ordering
and deliberately *not* an entry in `docs/contracts/rule-interactions.yml`, which
is a pairwise contract scoped to the always-on kernel rules — forking that
linted contract with a second prose ordering over a different kind of object is
the drift this ladder exists to avoid.

### 8c. Is the approach sound?

- Is there a simpler way to achieve the same result?
- Are there known problems with the requested approach?
- Does the scope match the stated goal? (not over-engineered, not under-specified)

**If problematic** → explain the concern, propose a better approach.

### How to challenge

- **Be concise** — one sentence per concern, not paragraphs
- **Show evidence** — reference existing code, patterns, or conventions
- **Offer alternatives** — don't just say "this is wrong"
- **Use numbered options** — let the user choose quickly
- **Respect "just do it"** — if the user insists after your challenge, execute immediately

Example:

```
> ⚠️ `UserService` already has a `deactivate()` method that covers this case.
>
> 1. Use existing method — extend with new parameter
> 2. Create new method anyway — I'll explain the overlap in a comment
> 3. Skip validation — implement as requested
```

After presenting concerns: user picks an option → execute immediately; user says "just do it" → execute immediately. Never argue twice about the same point. Never block work — delay is only justified if it prevents a clear mistake.

### Scope limits

- **Max 1-2 challenges per task** — not every request needs validation
- **Max 1 minute of analysis** — if the check takes longer, skip it
- **Never validate simple tasks** — only features, architecture, significant changes
- **Never validate after the user already explained their reasoning**

### Verify with concrete tools, not prose

If the challenge requires you to confirm current behavior before proposing an alternative, use a concrete probe — a `curl` against the endpoint, a Playwright spec, a debugger / `xdebug` step-through, or the project's test runner with a targeted filter. Asserting current behavior from memory is not validation.

### Intent inference (RDP, standard host)

When the literal request and the underlying goal may differ, **state the inferred goal in one line and give ONE recommendation** — do not spread 2–3 framings (that is the overplanning [`direct-answers`](../../../src/rules/direct-answers.md) suppresses). Standard host only; a strong-reasoning host self-infers, so skip it there. Engage per [`rdp-gate`](../../../src/agent-src/contexts/execution/rdp-gate.md).

## Anti-patterns

- Asking 5 complex questions at once
- Mixing clarification and implementation in the same step
- Doing handoff before collecting required context
- Blindly choosing frameworks/tools without checking existing usage
- Ignoring user frustration instead of learning from it
- Introducing new quality rules without considering CI enforcement
- Making important decisions silently without stating reasoning

## Final principle

> Ask better → decide better → build once → improve system continuously
