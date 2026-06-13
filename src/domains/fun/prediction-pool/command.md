---
model_tier: inherit
name: prediction-pool
pack: fun
tier: 2
visibility: internal
description: "Fill a prediction pool (kicktipp, football/basketball WM): optimize expected points under the rules, enter tips via Playwright. Triggers 'Tippspiel', 'kicktipp', 'predict the pool'."
skills: [prediction-pool-optimizer]
suggestion:
  eligible: true
  trigger_description: "fill my Tippspiel, kicktipp tips, predict the pool, betting/prediction pool predictions, optimize my pool tips for an event"
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

# /prediction-pool

`/prediction-pool [<event>] [--pool-url <url>] [--council off|event|match] [--submit] [--fresh|--continue]`

Fills out a **prediction pool** (kicktipp-style company pools: football
WM, basketball WM, …) by optimizing for the **maximum expected points
under the pool's actual scoring rules** — not for the most likely match
outcome. Researches market odds, computes expected-value tips, presents a
table for approval, then enters them into the pool's web UI via Playwright.

The cognition lives in the [`prediction-pool-optimizer`](../skills/prediction-pool-optimizer/SKILL.md)
skill (rules → market odds → expected value → participant field → tip).
This command is the orchestrator: event selection, the persisted analysis,
the optional AI-council pass, the Playwright entry, and the human gates.

**Hard gates (always):**
- **You log in.** The agent opens the page headful; it never reads,
  stores, or types your credentials.
- **The agent never submits.** It fills the candidate tips and stops —
  *you* submit, unless you passed `--submit` (or say so this turn).
- **Not betting or financial advice.** Decision support for a game; you
  approve and submit.

**Block on ambiguity:** an unresolvable event, a missing pool URL with no
saved analysis, or contradictory flags (`--fresh` and `--continue`,
`--council` value not in `off|event|match`) halts with a precise message —
no silent best-guess.

## Inputs

| Input | Required | Meaning |
|---|---|---|
| `<event>` | no | The event to tip (e.g. "Football WM 2026"). Omitted → the command proposes 1–3 upcoming events + free input (Step 1). |
| `--pool-url <url>` | once per event | The pool's tip page. Saved into the per-event analysis; reused on later runs. |
| `--council off\|event\|match` | no | AI-council depth for the analysis. Default `off`; the command offers it at Step 4. `event` = one pass over the whole sheet; `match` = per-match (costlier). |
| `--submit` | no | Pre-authorize the agent to submit after entry. Default: never submit. |
| `--fresh` / `--continue` | no | Force a new analysis vs. build on the saved one (Step 2). Default: ask. |

## Steps

### 1. Resolve the event (block on ambiguity)

- `<event>` supplied → use it; derive a slug (`football-wm-2026`).
- **Omitted → propose, then stop and wait.** Name 1–3 *upcoming* events
  (use the current date; research what is imminent) and offer free input:

  ```
  > Which event should I generate tips for?
  >
  > 1. <imminent event A>
  > 2. <imminent event B>
  > 3. <imminent event C>
  > 4. Something else — name it
  ```

### 2. Resolve the per-event analysis (state ground-truth)

Look for `agents/tmp/prediction-pool/<slug>.md`.

- **None →** start a new analysis (created at Step 9, never before).
- **Exists →** read it. Then:
  - It was **edited externally** since the last run (mtime newer than the
    last `## Run <ts>` header, or it no longer parses) → surface that and
    ask **merge / overwrite / abort** — never silently overwrite manual edits.
  - Otherwise ask **build on it** (`--continue`) or **start fresh**
    (`--fresh`); the flags pre-answer this for non-interactive runs.

The analysis holds the pool URL, the parsed rules, the current tip state,
and standing notes — so re-tuning later is fast.

### 3. Read the pool rules FIRST

Resolve the pool URL (`--pool-url` → saved analysis → ask). Then run the
optimizer skill's **rules pass** against the pool's rule page: exact result
vs. goal-difference vs. tendency points, bonus questions, joker rules,
quote/rarity scoring, special rules, deadlines, strategy limits. **Enumerate
every open question as an explicit checklist** (scores AND every bonus /
award / special question) — that list is the run's contract; each entry must
reach an answer. **No tips before the rules are understood** — the whole
strategy depends on them.

### 4. Run the optimizer + offer the AI-council pass

Run [`prediction-pool-optimizer`](../skills/prediction-pool-optimizer/SKILL.md),
adapted to the event's sport (football / basketball / …): a **de-vigged
consensus across the 5–10 biggest publicly-viewable bookmakers**
(sharp-weighted, never one portal) as the primary signal → expected value
under the Step-3 rules → participant field → tip. **Answer every entry on
the Step-3 checklist** — scores AND every bonus / award / special question
(top scorer, "team of the top scorer", group winners, most cards …); none
left blank. Tournament/outright/award probabilities come from real markets
**or** the skill's executed Poisson helper — **never** a hallucinated
"I simulated 10,000 runs".

**Offer the AI-council pass (default off).** Unless `--council` is set,
ask once:

```
> Run the AI council over the analysis for a sharper second opinion?
>
> 1. No — use my analysis as is
> 2. Yes, per event — one council pass over the whole tip sheet
> 3. Yes, per match — each match judged separately (more accurate, costlier)
```

When on, run **graduated** to control cost: a cheap single-model pass
flags the riskiest matches first, then the full council reviews only the
flagged matches (`event`) or every match (`match`). Fold the council's
verdicts back into the table before Step 5. Council spend always asks
first per [`ai-council`](../../../core/.agent-src.uncondensed/skills/ai-council/SKILL.md).

### 5. Output the approval table — ask whether & where to enter

Present the tips exactly as they would be entered, then **wait**:

| Match | Tip | Prob / EV | Risk | 1-line reason | Books used |
|---|---|---|---|---|---|

Follow with group standings, the full bracket, **and a bonus/special-answer
table with one row per open question from the Step-3 checklist — every entry
answered, none blank**:

| Question | Answer | Prob / EV | Risk | 1-line reason | Source (market / model) |
|---|---|---|---|---|---|

Then ask **whether to enter** and **into which pool** (the saved URL, a
different one, or none). Do **not** write the analysis yet (Step 9) — tips
are not yet confirmed.

### 6. Enter via Playwright (you log in)

Open the pool page **headful**. **You log in yourself** — the agent waits
and never touches credentials. Resolve the platform adapter:

- **Known platform** (e.g. kicktipp) → load the declarative selector map
  `scripts/prediction-pool/adapters/<platform>.yml` (field → CSS selector). The
  generic, trusted driver fills the inputs from the map — the adapter is
  **data, not code**.
- **Unknown platform → vision-assisted synthesis.** Screenshot the page,
  identify the tip inputs, **highlight them** and ask you to confirm the
  mapping, then fill from the confirmed ephemeral map. No code is run from
  an untrusted source.

### 7. Stop before submit

Fill the candidate results and **stop**. *You* press submit. The agent
submits only if `--submit` was passed or you authorize it **this turn**
(mirrors [`non-destructive-by-default`](../../../core/.agent-src.uncondensed/rules/non-destructive-by-default.md)).

### 8. Offer a second pool

Ask whether to also enter the same (or re-optimized) tips on another
pool / site. If yes, loop Steps 3–7 for that pool.

### 9. Persist / extend the analysis (only now)

Append a run-stamped section to `agents/tmp/prediction-pool/<slug>.md`: pool
URL(s), parsed rules, the entered tips with state `entered, not submitted`
(or `submitted` if Step 7 submitted), council verdicts if any, and
standing notes. Append-only — earlier runs stay as history. This is the
base the next run reads (Step 2).

### 10. New-platform adapter — offer to contribute (gated)

If Step 6 synthesized a new selector map, offer to (a) save it locally and
(b) open a **PR** adding `scripts/prediction-pool/adapters/<platform>.yml` so
coverage grows for everyone. The PR carries **declarative selector data
only** — never executable code — and only on explicit permission (no
auto-commit, no auto-push).

### 11. Report

Print: event + slug, pool URL(s), rules summary, council depth used,
matches tipped, entry result (`entered, not submitted` | `submitted`),
adapter (`<platform>.yml` | `vision-synthesized` | `pr-offered`), analysis
file path. No commit. No push.

## Rules

- **You log in; the agent never handles credentials.** Headful only.
- **The agent never submits** unless `--submit` or this-turn authorization.
- **Rules first.** No tips before the pool's scoring is parsed.
- **Answer every open question.** Scores AND every bonus / award / special
  question; a run that ships scorelines only and leaves bonus questions blank
  is incomplete.
- **Consensus odds, not one portal.** Build the base from a de-vigged,
  sharp-weighted consensus across the 5–10 biggest viewable books — never
  mirror a single bookmaker.
- **No hallucinated simulation.** Outright odds or executed Poisson code —
  never a claimed-but-unrun Monte-Carlo.
- **Analysis is written only after tips are confirmed** (Step 9), never
  before — and never silently over an externally edited file.
- **Adapters are declarative data, not code.** Unknown platforms use the
  ephemeral vision path; contributed adapters are selector maps via PR.
- **AI council is opt-in, default off**, and always asks before spending.
- **Not betting or financial advice.** A fun tool; you decide and submit.
- **No commit, no push, no PR** without explicit permission (the adapter
  PR offer is gated).
- **Kill-switch.** Ships `lifecycle: experimental` · `install.default:
  false`. Disable = remove the command + `prediction-pool-optimizer` skill, then
  regenerate the projected tool trees.

## See also

- [`prediction-pool-optimizer`](../skills/prediction-pool-optimizer/SKILL.md) — the
  rules → odds → EV → field → tip cognition.
- [`scripts/prediction-pool/adapters/_schema.md`](../../../scripts/prediction-pool/adapters/_schema.md) —
  the declarative adapter data contract (for PR contributions).
- [`ai-council`](../../../core/.agent-src.uncondensed/skills/ai-council/SKILL.md) —
  the optional second-opinion pass (Step 4).
- [`playwright-architect`](../../../core/.agent-src.uncondensed/skills/playwright-architect/SKILL.md) —
  browser-automation patterns for the entry step.
