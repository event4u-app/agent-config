---
model_tier: medium
name: challenge-me:with-docs
tier: 2
cluster: challenge-me
sub: with-docs
description: "Doc-aware /challenge-me — 95%-confidence interview with session glossary vs CONTEXT.md, load-bearing claim-vs-code verification, optional CONTEXT.md patch + ADR candidates in the pitch."
suggestion:
  eligible: true
  trigger_description: "challenge me against the docs, grill me with our context, grill me against the docs, grill me against CONTEXT.md, grill me with the project context, frag mich durch und prüf gegen CONTEXT.md, challenge plan with domain docs"
  trigger_context: "user wants the seed challenged against existing project glossary, CONTEXT.md, or ADRs — not a greenfield interview"
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /challenge-me with-docs

> Same one-question-at-a-time interview as `/challenge-me vision`, plus:
> a **session glossary** against `CONTEXT.md`, **load-bearing claim-vs-code
> verification**, and an optional `CONTEXT.md` **patch** + **ADR candidates**
> appended to the final pitch. `/challenge-me` itself never writes to
> disk — the in-interview triggers (`!roadmap`, `!ai`) route to
> `/roadmap:create` and `/council default`, which run under their own
> contracts.

## Welcome

If the user invokes `/challenge-me with-docs` with no body, render once:

```
Drop the seed and I'll grill it against your project docs. Per turn:
one question, recommended answer. I'll surface glossary clashes vs
CONTEXT.md and verify load-bearing claims against the code. At the end
you get a pitch — plus an optional CONTEXT.md patch and ADR candidates
to copy / apply yourself.

End the interview early any time:
  `!pitch`              — emit pitch, hand back
  `!roadmap`            — emit pitch + auto-route to `/roadmap:create`
  `!ai` / `!council`    — poll the AI council for the open question(s), continue (cost auto-accepted)
```

Skip the welcome if the user invokes `/challenge-me with-docs <seed>`
directly.

## When to use this instead of `vision`

| Condition | Pick |
|---|---|
| Project has no `CONTEXT.md` and no ADR dir | `vision` |
| Seed uses domain terms that may already be defined elsewhere | `with-docs` |
| User says "check against our docs" / "make sure it matches CONTEXT.md" | `with-docs` |
| User says "make sure this is consistent with the codebase" | `with-docs` |
| Greenfield brainstorm, no existing constraints to honour | `vision` |

If neither file exists and the user invoked `with-docs` anyway, fall
back gracefully to `vision`-style flow and skip the doc inventory; note
the absence in a single line at the end of Step 0.

## Stop condition, flags, triggers

Inherits **verbatim** from [`vision.md`](vision.md):

- Default stop = the four 95%-conditions (AND, not OR).
- Load-bearing test = answer changes goal / scope / hard constraint / AC.
- `--until=95%` (default) · `--until=N` · `--keep-going`.
- Triggers (full syntax + match rules in `vision.md` § Triggers):
  - `!pitch` / `/pitch` / whole reply `pitch` — emit pitch, hand back.
  - `!roadmap` / `!roadmap:create` (and `/`-prefixed) — emit pitch + auto-route to `/roadmap:create` with the pitch as seed.
  - `!ai` / `!ai-council` / `!council` (and `/`-prefixed) — invoke `/council default` on the open question(s), cost auto-accepted, integrate, resume.
- Step 1 question-block shape, Step 4 pitch validation, Step 4-bis council poll.

The deltas below replace / extend Step 0, Step 1, Step 2, Step 4 and
Step 5. Steps 3 and 6 are unchanged. **`!roadmap` routing in Step 6**
includes the optional `CONTEXT.md` patch + ADR candidates from this
variant in the seed handed to `/roadmap:create` (so the roadmap can
reference them under "Context"). Step 4-bis council poll is identical
to `vision.md`; pass the doc inventory + glossary as additional context
in the council prompt.

## Steps

### Step 0 — Inspect (read-only doc inventory + codebase)

```
EXPLORE THE DOCS AND THE CODEBASE BEFORE THE FIRST QUESTION.
NEVER WRITE TO DISK IN STEP 0. NEVER ASK WHAT view / grep / codebase-retrieval ANSWERS.
```

1. **Read the seed** (same as `vision`).
2. **Doc inventory** — read-only:
   - `view CONTEXT.md` if it exists; init empty **session glossary** in
     agent state (in-memory only).
   - `view CONTEXT-MAP.md` if it exists. If the seed touches > 1 listed
     context, **ask once** (numbered options listing each context) which
     to focus on; record the choice, do not re-ask.
   - Autodetect ADR directory by listing `docs/adr/`, `docs/decisions/`,
     `docs/architecture/decisions/`, `agents/decisions/`. Pick the
     **most-recently-modified** non-empty dir; if none exist, default to
     `docs/adr/` for the patch output (do **not** create the dir).
   - If `agent state` already holds a session glossary from a prior
     `/challenge-me with-docs` invocation **in this same chat**, load
     it. Then re-read `CONTEXT.md` — any term in `CONTEXT.md` overrides
     the session glossary (disk wins over draft). Emit a delta line if
     non-zero: `Loaded N draft terms; CONTEXT.md already has X — carrying
     forward the rest as drafts.`
3. **Codebase lookup** — same as `vision` Step 0.2 (existing routes,
   model fields, conventions, feature flags).
4. **List the open dimensions** internally — same as `vision` Step 0.3.

### Step 1 — Glossary-aware questioning

Every question block runs an extra check **before** emit:

- **Glossary conflict** — does the seed (or a prior turn) use a term
  that conflicts with the existing `CONTEXT.md` glossary, including a
  case-insensitive match? → first question of the session is the
  glossary disambiguation:

  > Your `CONTEXT.md` defines **Account** as the billing entity. Your
  > seed uses "account" for the logged-in person. Which is it?
  > 1. **Match CONTEXT.md** — rename "account" in the plan to "user".
  > 2. Override CONTEXT.md — the plan introduces a new meaning; we patch
  >    the glossary at pitch time.
  > 3. Skip / not relevant.

- **Fuzzy / overloaded term** — propose a canonical term as option 1.

- **No glossary present** → skip the check; behave like `vision`.

The glossary check is itself **load-bearing only when the term flips an
AC or scope boundary OR when it conflicts with an existing CONTEXT.md
entry**. Pure naming preference with no conflict is closed silently
(same load-bearing test as `vision`, with the conflict-extension).

Otherwise the question-block shape, recommended-option rule, 3–4 option
cap, and `Why it matters` requirement are identical to
[`vision.md § Step 1`](vision.md#step-1-ask-one-question-per-turn).

### Step 2 — Apply the answer + session glossary (in-memory)

Adopt-the-answer rules are identical to
[`vision.md § Step 2`](vision.md#step-2-apply-the-answer).

When a term is resolved, write to **session glossary** (agent state
only). **Never write to disk in this step.** Every turn's reply ends
with a compact echo block when the glossary is non-empty:

```
**Session glossary (draft, not yet written):**
- **Cancellation** — refund + reversal, excludes disputes (turn 3)
- **Account** — maps to `User` entity (turn 5)
```

After the **fifth** session-glossary turn, condense the echo to:

```
**Session glossary (draft):** N terms · M ADR candidates — see pitch for full list.
```

If the session glossary is empty, omit the echo block entirely.

### Step 3 — Re-score and continue

Identical to [`vision.md § Step 3`](vision.md#step-3-re-score-and-continue).

### Step 3.5 — ADR candidate check (no write)

After each branch closes, run the three-test on the resolution:

1. **Hard-to-reverse** — would unwinding it require code or schema rollback?
2. **Surprising-without-context** — would a future contributor read the
   choice and ask "why this and not the obvious alternative?"
3. **Result of a real trade-off** — were the rejected options realistic?

If **all three** pass, append the candidate to an in-memory ADR-candidate
list. Do **not** ask, do **not** write. Surfaces only in Step 5.

### Step 4 — Validate before pitching

Identical to [`vision.md § Step 4`](vision.md#step-4-validate-before-pitching),
plus:

- Pitch uses the **canonical glossary spelling** for every term in the
  session glossary.
- The `CONTEXT.md` patch block is **always** appended when the session
  glossary is non-empty — agent has no signal whether the user already
  applied a previous patch in-chat. The patch block carries a header
  the user reads before applying (see Step 5).

### Step 5 — Emit the pitch with optional doc patches

Emit the same fenced Markdown pitch as `vision`, then append up to two
optional sections **inside** the same outer four-backtick fence:

`````markdown
````markdown
# <one-line vision title>

**Goal:** <verb + object + observable result>

**In scope:**
- <bullet>

**Out of scope:**
- <bullet>

**Constraints (hard):**
- <bullet>

**Acceptance criteria:**
1. <observable, testable>

**Open assumptions:**
- assumes: <line>

**Recommended next step:** <one sentence — e.g. "/work \"<pitch goal>\"" >.

---

**CONTEXT.md patch (apply via `patch -p1` or your IDE's Apply Patch — only
if you haven't already merged these terms):**

```diff
@@ ... @@
+ ## Cancellation
+ Refund + reversal, excludes disputes.
```

**ADR candidate(s) — apply only if useful:**
- `docs/adr/0007-cancellation-semantics.md` — captures the soft-vs-hard
  delete decision (hard-to-reverse · surprising · real-tradeoff).

**Glossary touched this session:** Cancellation, Account, Refund (3 terms).
````
`````

The outer fence uses **five backticks** so the inner four-backtick fence
(which itself contains a triple-backtick diff) stays literal when the
user copies the whole block.

Omission rules:

- Session glossary empty → omit the `CONTEXT.md patch`, `Glossary touched`,
  and the preceding `---` separator entirely.
- No ADR candidate qualified → omit the `ADR candidate(s)` section.
- Both empty → pitch is identical to a `vision` pitch.

### Step 6 — Hand back

Identical to [`vision.md § Step 6`](vision.md#step-6-hand-back). Never
auto-write the patches, never auto-invoke `/work`.

## Code-vs-claim guard (gated)

When the user states "X is implemented as Y" AND the claim is
**load-bearing** (would change an AC, scope boundary, or hard
constraint), agent runs `view` / `grep` / `codebase-retrieval` to
verify. Mismatch → single question block:

> Your seed says X works via Y. The code (`path/to/file.php:123`) shows
> it via Z. Which is right?
> 1. **Code is right, my seed was wrong** — recommended.
> 2. Seed is right, code is stale — separate fix needed.
> 3. Both — they're both real paths.

Non-load-bearing claims (cosmetic, naming, internal style) — agent
trusts the user's statement, no lookup. This gate keeps verification
cost O(load-bearing-decisions), not O(every-statement).

## Output format

1. **Per-turn question block** — one numbered question with a
   recommended option, until 95% or pitch trigger.
2. **Session-glossary echo** — appended every turn while the glossary is
   non-empty (full list in turns 1–5, condensed line from turn 6 on).
3. **Final pitch** — a single copyable five-backtick fenced block
   (Step 5 shape) holding the standard pitch + optional `CONTEXT.md`
   patch + optional ADR candidates.

## Examples

```
/challenge-me with-docs
/challenge-me with-docs Add a per-tenant rate limit on the public API
/challenge-me with-docs --until=5 Migrate cancellations from soft-delete to hard-delete
/challenge-me with-docs --keep-going Re-architect the notifications pipeline
```

## Gotchas

- Inherits every gotcha from
  [`vision.md § Gotchas`](vision.md#gotchas) — confidence inflation,
  recommendation drift, stacked questions, too many options.
- **Glossary clutter** — if the agent echoes the full session glossary
  past turn 5 the reply gets noisy. Condense per Step 2.
- **Patch redundancy** — agent has no signal whether the user already
  applied a previous in-chat `CONTEXT.md` patch. Always emit the patch
  with the "only if you haven't already merged these terms" header so
  the user can dedupe.
- **ADR over-eager** — the three-test (hard-to-reverse · surprising ·
  real-tradeoff) is the gate. A pure naming choice or a default that
  could flip without rollback is **not** an ADR candidate.
- **Multi-context confusion** — if `CONTEXT-MAP.md` lists multiple
  contexts and the seed touches several, ask **once** in Step 0; never
  re-ask which context to focus on.

## Rules

- Inherits every rule from [`vision.md § Rules`](vision.md#rules) —
  one question per turn, no auto-execution, no file writes, codebase
  first, welcome once, mirror the user's language.
- **No file writes** — even though this variant produces glossary
  patches and ADR candidates, those go **into the pitch block** for the
  user to apply. Agent never writes `CONTEXT.md` or any `docs/adr/*`
  file itself, per `non-destructive-by-default`.
- **Two-gate verification** — the glossary check fires on AC-flipping
  terms OR `CONTEXT.md` conflicts; the code-vs-claim check fires only
  on load-bearing claims. Non-load-bearing trivia → no lookup, no
  question.
- **Session glossary persists within a chat** — a second
  `/challenge-me with-docs` invocation in the same chat inherits draft
  terms; disk state (`CONTEXT.md`) overrides drafts on every Step 0.

## Do NOT

- Inherits every prohibition from
  [`vision.md § Do NOT`](vision.md#do-not).
- Do NOT write to `CONTEXT.md` directly — emit the diff in the pitch.
- Do NOT create files in `docs/adr/` — emit the path + rationale in the
  pitch and let the user create the file.
- Do NOT verify every user statement — only load-bearing claims trigger
  the code-vs-claim guard.
- Do NOT echo the full session glossary past turn 5 — condense.

## See also

- [`/challenge-me vision`](vision.md) — sibling without doc inventory,
  glossary check, or claim verification.
- [`/refine-prompt`](../refine-prompt.md) — one-shot prompt scoring.
- [`/refine-ticket`](../refine-ticket.md) — ticket reconstruction.
- [`ask-when-uncertain`](../../rules/ask-when-uncertain.md) — the
  one-question-per-turn Iron Law.
- [`non-destructive-by-default`](../../rules/non-destructive-by-default.md)
  — why the patches live in the pitch block, not on disk.
- Inspiration: `mattpocock/skills/skills/engineering/grill-with-docs/SKILL.md`
  — same intent (interview against domain docs), restructured to honour
  the project's non-destructive floor (session glossary in-memory,
  patches emitted as copyable diffs in the pitch).
