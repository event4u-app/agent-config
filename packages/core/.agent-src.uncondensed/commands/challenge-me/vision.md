---
model_tier: inherit
name: challenge-me:vision
pack: meta
tier: 2
cluster: challenge-me
sub: vision
description: "Stress-test a plan or idea by one-question-at-a-time interview until 95% confidence — emits a copyable Markdown vision pitch for tickets, roadmaps, or fresh-chat handoff."
suggestion:
  eligible: true
  trigger_description: "challenge me on this plan, grill me, grill me on this, grill me on the vision, grill me on the idea, grill me until it's clear, grill me hard, frag mich durch, dreh mich durch die Mangel"
  trigger_context: "user has a fuzzy plan/idea/feature draft and wants it sharpened interactively rather than reconstructed in one shot"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /challenge-me vision

> Walk a decision tree by asking one question at a time, each with a
> recommended answer, until the agent reaches **95% confidence** in what
> the user actually wants — then emit a copyable Markdown pitch the user
> can paste into a ticket, roadmap, or fresh-chat handoff.

## Welcome

If the user invokes `/challenge-me vision` (or `/challenge-me` defaulting
here) with no body, render once:

```
Drop the seed — a plan, idea, ticket draft, or design sketch — and I'll
walk you through a decision tree, one question per turn, until I'm 95%
sure what you want. Then you get a copyable Markdown pitch.

End the interview early any time:
  `!pitch`              — emit pitch, hand back
  `!roadmap`            — emit pitch + auto-route to `/roadmap:create`
  `!ai` / `!council`    — poll the AI council for the open question(s), continue (cost auto-accepted)
```

Skip the welcome if the user invokes `/challenge-me vision <seed>` directly.

## When NOT to use

| Phrasing | Route to |
|---|---|
| "refine this prompt before /work" | [`/refine-prompt`](../refine-prompt.md) |
| "refine this Jira ticket" | [`/refine-ticket`](../refine-ticket.md) |
| "poke holes in my plan" (one-shot, no Q&A) | `adversarial-review` skill |
| "ask another model" | `ai-council` skill |
| "challenge me against existing docs/glossary" | `/challenge-me with-docs` |

## Default stop condition — 95% confidence

Unless the user names a different stop condition (`--until=N`,
`--keep-going`, or natural-language equivalents like `"5 questions"` /
`"keep going forever"`), the default is:

```
KEEP ASKING UNTIL CONFIDENCE ≥ 95% OR THE USER PITCHES.
```

### What "load-bearing" means

A branch is **load-bearing** when its answer would change at least one of:

- the **goal** sentence,
- the **in-scope / out-of-scope** boundary,
- a **hard constraint**, or
- one of the **acceptance criteria**.

A branch that only changes wording, tone, or cosmetics is **not**
load-bearing — close it without asking. This is the same test for the
"why it matters" line in every question block (see Step 1).

**Examples — load-bearing vs cosmetic:**

| Question | Load-bearing? | Why |
|---|---|---|
| "Should anonymous users see this page?" | yes | flips an AC + scope boundary |
| "Soft-delete or hard-delete on cancel?" | yes | flips a hard constraint + rollback path |
| "Should the button be primary or secondary colour?" | no | wording / cosmetic, no AC change |
| "Should we name the column `cancelled_at` or `canceled_at`?" | no | naming, no behaviour change |

### What "branch" means (for Condition 2)

A **branch** = an entry in the agent's internal working list of open
dimensions (Step 0.3 in the procedure). A branch is **new** when the
agent's last applied answer would, on a re-evaluation of dimensions,
add at least one entry that passes the load-bearing test above. A
branch that only refines an existing entry's text without flipping
goal / scope / constraint / AC is **not** new.

### The four 95% conditions (AND, not OR)

Confidence reaches 95% when **all four** hold simultaneously:

1. Every load-bearing branch surfaced so far has a resolved answer
   (recommendation accepted, alternative picked, explicitly skipped).
2. The agent re-evaluated its internal working list (Step 0.3) after
   applying the user's last answer, and **no new load-bearing branch**
   (passing the load-bearing test above) was added.
3. Goal, in-scope, out-of-scope, hard constraints, success criteria, and
   **at least two edge cases that affect AC observability or rollback**
   all have explicit answers (not "TBD", not "probably", not "we'll see").
4. The agent has **cached a draft pitch** (Goal + In/Out + Constraints +
   AC) at the end of every turn, and the user's **last two answers** did
   not modify any of those four sections.

Condition 4 is observable, not introspective: the agent maintains the
draft pitch as state, diffs it against the previous turn's draft, and
declares stable only when two consecutive turns produce identical
sections.

When all four hold, the agent does **not** ask another question — it goes
straight to Step 4.

## Flags

- `--until=95%` (default) — stop when the four 95% conditions hold.
- `--until=N` — stop after N answered questions, even if confidence is
  lower. Emit the pitch with an `Open assumptions` block listing what
  is still fuzzy.
- `--keep-going` — never auto-stop; only the user's pitch trigger ends
  the interview.

## Steps

### Step 0: Inspect (codebase first, ALWAYS)

```
EXPLORE THE CODEBASE BEFORE THE FIRST QUESTION.
NEVER ASK WHAT `grep`, `view`, OR `codebase-retrieval` ANSWERS IN SECONDS.
```

1. **Read the seed.** The user's first message (or
   `/challenge-me vision <seed>` body) is the artefact under examination —
   a plan, idea, ticket draft, design sketch.
2. **Look up before asking.** Existing routes, model fields, conventions,
   feature flags, previous similar features → resolve from the repo.
   Surface findings briefly in the next question block ("Repo says X
   already exists at `path/to/file.php`"). The user should never have to
   answer a question the codebase already answers.
3. **List the open dimensions** internally — goal, scope, users, data,
   constraints, success criteria, edge cases, rollback. Do not surface
   this list; it is the agent's todo, not the user's.

### Step 1: Ask one question per turn

Every turn after Step 0 emits exactly **one** question block. Before
writing the block, validate the question against the load-bearing test:
**if the answer cannot change goal / scope / hard constraints / AC, do
not ask** — close the branch and move to the next.

````markdown
**Question N · confidence ~XX%**

<one-sentence question, anchored to a specific decision>

**Why it matters:** <one line — which AC, scope boundary, or hard
constraint this unblocks>.

1. **<recommended option>** — recommended because <one line>.
2. <alternative option>
3. <alternative option>
4. Skip / not relevant

> Reply with a number, a free-form answer, or one of:
> **`!pitch`** — emit pitch and hand back ·
> **`!roadmap`** (or **`!roadmap:create`**) — emit pitch + auto-route to `/roadmap:create` ·
> **`!ai`** (alias **`!ai-council`** / **`!council`**) — poll the council on the open question(s),
> cost auto-accepted, then continue the interview.
````

**Rules for the question block.**

- One question per turn — non-negotiable, per
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) Iron Law.
- The recommended option is always **option 1** and labelled **bold**.
- 3–4 options total. More than 4 means the question is too broad — split it.
- "Skip / not relevant" must always be present so the user can prune dead
  branches.
- Walk the tree depth-first: resolve a branch's children before moving
  to the next sibling, unless the user explicitly jumps.
- The `Why it matters` line MUST cite an AC number, a scope boundary, or
  a named hard constraint. "Good to know" / "for context" / "to be safe"
  are placeholders — rewrite or drop the question.

### Step 2: Apply the answer

1. Number reply (`1`, `2`, …) → adopt that option.
2. Free-form reply → integrate verbatim, do not re-interpret.
3. "Skip" / "skip" / "n/a" → branch closed, do not revisit unless reopened.
4. Trigger fired → branch by trigger type (see table below):
   - `!pitch` → jump to Step 4, then Step 5 (emit pitch), then Step 6 hand-back.
   - `!roadmap` / `!roadmap:create` → Step 4 → Step 5 (emit pitch) → Step 6 with **roadmap routing**.
   - `!ai` / `!ai-council` / `!council` → jump to **Step 4-bis (Council poll)**, then resume Step 1 with the answers integrated.

#### Triggers — strict matching

Three trigger families end or branch the interview. All require
**explicit syntax** to avoid false positives on natural prose
("I'd pitch this to the team", "let's run a council later").

| Trigger | Action | Cost gate |
|---|---|---|
| `!pitch` · `/pitch` · whole reply `pitch` | Emit pitch (Step 5), hand back (Step 6) | none |
| `!roadmap` · `!roadmap:create` · `/roadmap` · `/roadmap:create` · whole reply `roadmap` | Emit pitch (Step 5), then route to `/roadmap:create` with the pitch as seed (Step 6) | none — roadmap creation is text-only |
| `!ai` · `!ai-council` · `!council` · `/ai` · `/ai-council` · `/council` · whole reply `ai` / `council` | Snapshot open question(s), invoke `/council default` to draft answers, integrate, resume Step 1 | **auto-accepted** — typing the trigger is the consent (per user opt-in to the trigger contract) |

Match rules apply to **every** trigger above:

| Match | Example | Fires? |
|---|---|---|
| `!<trigger>` at line start | `!pitch`, `!roadmap`, `!council`, `!Vision pitchen` | yes |
| `/<trigger>` at line start | `/pitch`, `/roadmap:create`, `/ai-council` | yes |
| Whole reply exactly the trigger word (case-insensitive) | `pitch`, `roadmap`, `council` | yes |
| Trigger word inside a sentence | "I would pitch this on Monday", "let's poll the council later" | **no** |
| Natural-language fragment (`pitch mich`, `ship vision`) | prose | **no** |

`DE: "!Vision pitchen", "!roadmap erstellen", "!Council befragen", whole reply "pitch" · EN: "!pitch the vision", "!roadmap it", "!council on this", whole reply "pitch"`

If the agent is unsure **which** trigger fired (e.g. `!council and pitch`),
it confirms once with numbered options listing the candidates instead of
guessing.

### Step 3: Re-score and continue

Re-evaluate the four 95%-conditions internally. If not yet reached, ask
the next question. If reached, go to Step 4 without asking.

### Step 4: Validate before pitching

Before emitting the pitch, run this checklist internally:

1. All four 95%-conditions hold (or the user fired `!pitch` / `!roadmap`).
2. Every adopted answer is reflected in the pitch — no orphan branches.
3. Acceptance criteria are observable and testable in the project's
   existing test surface — not "works correctly" / "looks better".
4. The recommended next-step command actually exists in this project.

If any check fails, ask one more question instead of pitching.

### Step 4-bis: Council poll (`!ai` / `!ai-council` / `!council` only)

Fires **instead of** Step 4/5 when an AI trigger matches. Cost gate is
auto-accepted by the trigger contract — do **not** re-ask.

1. **Snapshot** the current interview state:
   - The seed (verbatim).
   - All adopted answers so far (as `<question> → <answer>` lines).
   - Open branches and the very-next question on the table.
   - Any open assumptions surfaced so far.
2. **Build the council prompt** as a single block:

   ```
   You are reviewing an in-progress /challenge-me vision interview.
   Seed: <verbatim>
   Adopted: <list>
   Open question(s): <list>
   For each open question, recommend an answer with one-line rationale,
   plus any unstated risk you spot. Be terse.
   ```
3. **Invoke** `/council default prompt:"<above>"` non-interactively
   (auto-accepted cost gate). Pass the host's `ai_council.min_rounds`
   default — do **not** raise rounds inside the trigger.
4. **Integrate** the council output:
   - Surface each council answer **labelled with the source** (e.g.
     `Council recommends: <answer> — rationale: <one line>`).
   - Do **not** silently adopt — the user still picks (`1` to accept,
     free-form to refine, `skip` to discard).
5. **Resume Step 1** with the very-next question, now showing the
   council's recommendation as option 1 (with the existing recommended
   option pushed to option 2 if they differ).

If the council call fails (network, budget, missing member), report the
error in one line and resume Step 1 unchanged — do **not** re-trigger.

### Step 5: Emit the pitch

Output a single fenced Markdown block the user can copy verbatim. Shape:

````markdown
```markdown
# <one-line vision title>

**Goal:** <verb + object + observable result>

**In scope:**
- <bullet>
- <bullet>

**Out of scope:**
- <bullet>

**Constraints (hard):**
- <bullet>

**Acceptance criteria:**
1. <observable, testable>
2. <observable, testable>
3. <observable, testable>

**Open assumptions:**
- assumes: <line>

**Recommended next step:** <one sentence — e.g. "/work \"<pitch goal>\"" or
"create roadmap with /roadmap-create">.
```
````

The outer fence uses four backticks so the inner triple-backtick stays
literal when the user copies it.

### Step 6: Hand back — HARD STOP after artifact

```
PITCH OR ROADMAP LANDED → STOP. NEVER PROPOSE IMPLEMENTATION,
NEVER ASK "READY TO START?". THE USER PICKS THE NEXT MOVE WITH AN
EXPLICIT EXECUTION VERB ON A LATER TURN.
```

Branch on which trigger fired (or the natural 95%-stop):

- **Natural stop or `!pitch`** — end the turn after emitting the pitch.
  Do **not** propose to also implement, write to a roadmap, or commit —
  the pitch is conversational output the user copies into the next
  command (`/work`, `/roadmap:create`, `/feature-plan`, …).
- **`!roadmap` / `!roadmap:create`** — emit the pitch (Step 5) **and**
  immediately route to [`/roadmap:create`](../roadmap/create.md) using
  the pitch as the seed for its Step 1 ("Title / goal", "Context",
  "Phases"). The user keeps full control inside `/roadmap:create` —
  this is opt-in routing, not silent execution. Mention the route in a
  single line under the pitch (e.g. *"Routing to `/roadmap:create` —
  this pitch becomes the seed for title + context + phase 1."*).
  The chain ends when `/roadmap:create` saves the file — its own Step
  9 is a hard stop ([`roadmap/create § 9`](../roadmap/create.md)), no
  execution offer rides on the back of `!roadmap`.
- **`!ai` / `!ai-council` / `!council`** — handled by Step 4-bis, never
  reaches Step 6.

If the user wants any other follow-up, they invoke it explicitly. The
"Recommended next step" line in the pitch (Step 5) names a *command*
(`/work`, `/roadmap:create`, …) — it is a suggestion the user copies,
**not** an offer this command auto-routes through.

## Output format

1. **Per-turn question block** — one numbered question with a recommended
   option, until 95% or a trigger (`!pitch` / `!roadmap` / `!ai`).
2. **Final pitch** — a single copyable fenced Markdown block (Step 5 shape).
3. **One-line handoff suggestion** under the pitch — which command to run
   next (`/work`, `/roadmap:create`, `/feature-plan`, etc.).
   - For `!roadmap` triggers, this line is the route announcement
     instead of a suggestion (Step 6).
4. **Council-poll output** (only if `!ai` fired) — labelled council
   answers integrated into the next question block (Step 4-bis), not a
   final pitch. The interview resumes.

## Examples

```
/challenge-me vision
/challenge-me vision We need a shareable read-only view for non-paying users
/challenge-me vision --until=5 Build a CSV export for the dashboard
/challenge-me vision --keep-going Re-architect the notifications pipeline
```

## Gotchas

- The model wants to ask *the user* what the codebase already answers
  (existing routes, conventions, model fields). Run the lookup first;
  only ask when the codebase is silent.
- Confidence inflation — the model marks itself 95% after 2 questions
  because the user nodded along. The four conditions are AND, not OR.
  Recheck **all four** every turn before stopping.
- Recommendation drift — the agent keeps changing option 1 across turns
  because new context arrived. That is fine *within* the interview; it
  is a red flag *at pitch time*. If the pitch shape changed in the last
  turn, ask one more question.
- Stacked questions — the model bundles "scope and rollback?" into one
  block. Split. Always one decision per question.
- Too many options — 7-option blocks are not a tree, they are a survey.
  Cap at 4; split the question if 4 is not enough.

## Rules

- **One question per turn** — non-negotiable, per
  [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) Iron Law.
- **No auto-execution** — emit the pitch, not the implementation it
  describes. Do not chain into `/work` or `/roadmap:create` without
  explicit user invocation. The `!roadmap` trigger **is** explicit
  invocation by user opt-in; routing under it is permitted **and ends
  at file save** — never propose "ready to start Phase 1?" after the
  roadmap lands. See [`scope-mechanics § Post-artifact hard stop`](../../contexts/authority/scope-mechanics.md).
- **No file writes from /challenge-me itself** — the pitch is
  conversational. No commits, no roadmap edits, no `agents/` writes.
  The `!roadmap` trigger routes to `/roadmap:create`, which writes
  under its own contract (with its own user confirmation in Step 6).
- **Council cost gate is auto-accepted under `!ai`** — typing the
  trigger is the consent. Do not surface a second confirmation. If
  `personal.autonomy: auto`, the trigger still consents on its own —
  the user explicitly opted in by typing it.
- **Codebase first** — Step 0 forbids asking what `grep`, `view`, or
  `codebase-retrieval` would answer in seconds.
- **Welcome once** — render the welcome only on the first no-body
  invocation per session.
- **Mirror the user's language** — the question blocks and pitch use
  the language the user wrote in (`language-and-tone` Iron Law). All
  trigger syntax (`!pitch`, `!roadmap`, `!ai` and their aliases) stays
  literal in any language.

## Do NOT

- Do NOT ask multiple questions in one turn.
- Do NOT proceed past 95% without emitting the pitch — silent inflation
  defeats the contract.
- Do NOT paraphrase the user's free-form answers when applying them.
  Verbatim or summarised-with-quote, never re-worded.
- Do NOT include implementation steps in the pitch. The pitch is intent
  + acceptance criteria; implementation is the next command's job.
- Do NOT skip the "skip / not relevant" option — pruning is part of the
  tree.
- Do NOT re-emit the full pitch every turn. Pitch only fires at 95% or
  on explicit trigger.

## See also

- [`/challenge-me with-docs`](with-docs.md) — sibling variant that adds
  glossary / `CONTEXT.md` awareness and load-bearing claim-vs-code
  verification.
- [`/refine-prompt`](../refine-prompt.md) — one-shot prompt scoring before
  `/work`.
- [`/refine-ticket`](../refine-ticket.md) — ticket reconstruction.
- [`/optimize-prompt`](../optimize-prompt.md) — sibling pattern (interactive
  polishing).
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — the
  one-question-per-turn Iron Law this command is built on.
- Inspiration: `mattpocock/skills/skills/productivity/grill-me/SKILL.md`
  — same spirit (relentless decision-tree interview, one question at a
  time, recommended answer per question), restructured to our command
  shape with explicit stop heuristic and copyable pitch contract.
