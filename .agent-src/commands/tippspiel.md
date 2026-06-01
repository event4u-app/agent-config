---
model_tier: inherit
name: tippspiel
tier: 2
description: "Fill a prediction pool (kicktipp, football/basketball WM): optimize expected points under the rules, enter tips via Playwright (you submit). Triggers 'fill my Tippspiel', 'kicktipp tips'."
skills: [tippspiel-optimizer]
suggestion:
  eligible: true
  trigger_description: "fill my Tippspiel, kicktipp tips, betting/prediction pool predictions, optimize my pool tips for an event"
  trigger_context: "user wants tips for a prediction pool (kicktipp etc.) for an upcoming sports event and wants them computed and/or entered into the pool's web UI"
workspaces:
  - small-business
packs:
  - fun
lifecycle: experimental
trust:
  level: experimental
install:
  default: false
  removable: true
---

# /tippspiel

`/tippspiel [<event>] [--pool-url <url>] [--council off|event|match] [--submit] [--fresh|--continue]`

Fills a **prediction pool** (kicktipp-style company pools: football WM,
basketball WM, …) optimizing for **maximum expected points under the pool's
actual scoring rules** — not the most likely outcome. Researches market
odds, computes expected-value tips, presents a table for approval, then
enters them into the pool's web UI via Playwright.

Cognition lives in [`tippspiel-optimizer`](../skills/tippspiel-optimizer/SKILL.md)
(rules → market odds → expected value → participant field → tip). This
command orchestrates: event selection, persisted analysis, optional
AI-council pass, Playwright entry, human gates.

**Hard gates (always):**
- **You log in.** Agent opens the page headful; never reads, stores, or
  types your credentials.
- **Agent never submits.** Fills candidate tips and stops — *you* submit,
  unless you passed `--submit` (or say so this turn).
- **Not betting or financial advice.** Decision support for a game; you
  approve and submit.

**Block on ambiguity:** unresolvable event, missing pool URL with no saved
analysis, or contradictory flags (`--fresh` and `--continue`, `--council`
not in `off|event|match`) halts with a precise message — no silent best-guess.

## Inputs

| Input | Required | Meaning |
|---|---|---|
| `<event>` | no | Event to tip (e.g. "Football WM 2026"). Omitted → command proposes 1–3 upcoming events + free input (Step 1). |
| `--pool-url <url>` | once per event | Pool's tip page. Saved into the per-event analysis; reused later. |
| `--council off\|event\|match` | no | AI-council depth. Default `off`; offered at Step 4. `event` = one pass over the whole sheet; `match` = per-match (costlier). |
| `--submit` | no | Pre-authorize submit after entry. Default: never submit. |
| `--fresh` / `--continue` | no | Force new analysis vs. build on saved one (Step 2). Default: ask. |

## Steps

### 1. Resolve the event (block on ambiguity)

- `<event>` supplied → use it; derive a slug (`football-wm-2026`).
- **Omitted → propose, then stop and wait.** Name 1–3 *upcoming* events
  (use the current date; research what's imminent) + free input:

  ```
  > Which event should I generate tips for?
  >
  > 1. <imminent event A>
  > 2. <imminent event B>
  > 3. <imminent event C>
  > 4. Something else — name it
  ```

### 2. Resolve the per-event analysis (state ground-truth)

Look for `agents/tmp/tippspiel/<slug>.md`.

- **None →** start a new analysis (created at Step 9, never before).
- **Exists →** read it. Then:
  - **Edited externally** since last run (mtime newer than last
    `## Run <ts>` header, or no longer parses) → surface that, ask
    **merge / overwrite / abort** — never silently overwrite manual edits.
  - Otherwise ask **build on it** (`--continue`) or **start fresh**
    (`--fresh`); flags pre-answer this for non-interactive runs.

Analysis holds pool URL, parsed rules, current tip state, standing notes —
re-tuning later is fast.

### 3. Read the pool rules FIRST

Resolve the pool URL (`--pool-url` → saved analysis → ask). Run the
optimizer's **rules pass** against the rule page: exact result vs.
goal-difference vs. tendency points, bonus questions, joker rules,
quote/rarity scoring, special rules, deadlines, strategy limits. **No tips
before the rules are understood** — the whole strategy depends on them.

### 4. Run the optimizer + offer the AI-council pass

Run [`tippspiel-optimizer`](../skills/tippspiel-optimizer/SKILL.md),
adapted to the event's sport (football / basketball / …): market odds as
primary signal → expected value under Step-3 rules → participant field →
tip. Tournament/outright probabilities come from real outright odds **or**
the skill's executed Poisson helper — **never** a hallucinated "I simulated
10,000 runs".

**Offer the AI-council pass (default off).** Unless `--council` is set,
ask once:

```
> Run the AI council over the analysis for a sharper second opinion?
>
> 1. No — use my analysis as is
> 2. Yes, per event — one council pass over the whole tip sheet
> 3. Yes, per match — each match judged separately (more accurate, costlier)
```

When on, run **graduated** to control cost: a cheap single-model pass flags
the riskiest matches first, then the full council reviews only flagged
matches (`event`) or every match (`match`). Fold verdicts back into the
table before Step 5. Council spend always asks first per
[`ai-council`](../../../core/.agent-src.uncondensed/skills/ai-council/SKILL.md).

### 5. Output the approval table — ask whether & where to enter

Present tips exactly as they'd be entered, then **wait**:

| Match | Tip | Prob / EV | Risk | 1-line reason | Odds used |
|---|---|---|---|---|---|

Follow with group standings, the full bracket, bonus-question answers where
the event has them. Then ask **whether to enter** and **into which pool**
(saved URL, a different one, or none). Do **not** write the analysis yet
(Step 9) — tips not yet confirmed.

### 6. Enter via Playwright (you log in)

Open the pool page **headful**. **You log in yourself** — agent waits,
never touches credentials. Resolve the platform adapter:

- **Known platform** (e.g. kicktipp) → load the declarative selector map
  `scripts/tippspiel/adapters/<platform>.yml` (field → CSS selector). The
  generic, trusted driver fills the inputs from the map — adapter is
  **data, not code**.
- **Unknown platform → vision-assisted synthesis.** Screenshot the page,
  identify the tip inputs, **highlight them**, ask you to confirm the
  mapping, then fill from the confirmed ephemeral map. No code runs from an
  untrusted source.

### 7. Stop before submit

Fill candidate results and **stop**. *You* press submit. Agent submits only
if `--submit` was passed or you authorize it **this turn** (mirrors
[`non-destructive-by-default`](../../../core/.agent-src.uncondensed/rules/non-destructive-by-default.md)).

### 8. Offer a second pool

Ask whether to also enter the same (or re-optimized) tips on another
pool / site. If yes, loop Steps 3–7 for that pool.

### 9. Persist / extend the analysis (only now)

Append a run-stamped section to `agents/tmp/tippspiel/<slug>.md`: pool
URL(s), parsed rules, entered tips with state `entered, not submitted` (or
`submitted` if Step 7 submitted), council verdicts if any, standing notes.
Append-only — earlier runs stay as history. This is the base the next run
reads (Step 2).

### 10. New-platform adapter — offer to contribute (gated)

If Step 6 synthesized a new selector map, offer to (a) save it locally and
(b) open a **PR** adding `scripts/tippspiel/adapters/<platform>.yml` so
coverage grows for everyone. The PR carries **declarative selector data
only** — never executable code — and only on explicit permission (no
auto-commit, no auto-push).

### 11. Report

Print: event + slug, pool URL(s), rules summary, council depth used,
matches tipped, entry result (`entered, not submitted` | `submitted`),
adapter (`<platform>.yml` | `vision-synthesized` | `pr-offered`), analysis
file path. No commit. No push.

## Rules

- **You log in; agent never handles credentials.** Headful only.
- **Agent never submits** unless `--submit` or this-turn authorization.
- **Rules first.** No tips before the pool's scoring is parsed.
- **No hallucinated simulation.** Outright odds or executed Poisson code —
  never a claimed-but-unrun Monte-Carlo.
- **Analysis is written only after tips are confirmed** (Step 9), never
  before — and never silently over an externally edited file.
- **Adapters are declarative data, not code.** Unknown platforms use the
  ephemeral vision path; contributed adapters are selector maps via PR.
- **AI council is opt-in, default off**, always asks before spending.
- **Not betting or financial advice.** A fun tool; you decide and submit.
- **No commit, no push, no PR** without explicit permission (the adapter PR
  offer is gated).
- **Kill-switch.** Ships `lifecycle: experimental` · `install.default:
  false`. Disable = remove the command + `tippspiel-optimizer` skill, then
  regenerate the projected tool trees.

## See also

- [`tippspiel-optimizer`](../skills/tippspiel-optimizer/SKILL.md) — the
  rules → odds → EV → field → tip cognition.
- [`scripts/tippspiel/adapters/_schema.md`](../../../scripts/tippspiel/adapters/_schema.md) —
  declarative adapter data contract (PR contributions).
- [`ai-council`](../../../core/.agent-src.uncondensed/skills/ai-council/SKILL.md) —
  optional second-opinion pass (Step 4).
- [`playwright-architect`](../../../core/.agent-src.uncondensed/skills/playwright-architect/SKILL.md) —
  browser-automation patterns for the entry step.
