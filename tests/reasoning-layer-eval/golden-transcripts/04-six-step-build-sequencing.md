# Golden transcript — slot 04: six-step-build-sequencing

- **Task family:** multi-stage-impl
- **Host strength:** standard
- **Discipline focus:** complexity-first
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

We have a 6-step build ahead (schema change, API layer, background job, UI, caching, docs). Which part should we tackle first?

## Transcript — baseline (claude-haiku-4-5-20251001)

~~~text
Schema change first.

**Reasoning:**
- It's the dependency bottleneck. API, background job, and caching all need the new schema to exist.
- It's the highest risk for coordination issues (migrations, rollback procedures, data consistency). Better to validate this early while the scope is still focused.
- Once it's in, the remaining 5 pieces can proceed in parallel without blocking each other.

**Secondary order:** API layer next (blocks the other layers from having concrete endpoints to integrate against), then the remaining pieces can genuinely run concurrently.

Is the schema change backwards-compatible, or will this require coordinating a cutover?
~~~

**Tokens:** in 131 / out 144 / est $0.000851

## Transcript — treatment (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Load-bearing unknowns:**
1. Does the schema change unlock or block the other five? (dependency order)
2. Are there integration points that create risk if done out of sequence? (e.g., API depends on schema, jobs consume API)
3. What's the verification/test strategy—can we validate pieces in isolation or only end-to-end?
4. Is there a parallel path (e.g., UI + caching independent from core logic)?

**Implicit constraints:**
- Schema changes are typically irreversible in production; they set the shape for everything downstream.
- UI + caching are almost certainly *dependent* on stable API contracts.
- Background jobs likely consume the API or database directly.

**Assumption:** Standard web app flow where schema → API → jobs/UI build on that foundation.

---

## Answer

**Tackle the schema change first.**

**Why:**
- Schema is the load-bearing wall. It defines what the API layer can expose, what the jobs consume, and what the UI displays. Wrong schema = rework downstream.
- It's the only irreversible step; you want to validate it before the next five layers pile on.
- Blocks nothing; everything else can start once the schema is reviewed (and ideally migrated to a staging environment).
- Testing is local and fast—no coordination needed with other layers yet.

**Sequence after that:**
1. **API layer** (consumes schema, unblocks jobs + UI)
2. **Background job** (consumer of API/schema; independent of UI and caching)
3. **UI** (consumes API; now has a stable contract)
4. **Caching** (optimizes the now-complete read path; lowest risk to move)
5. **Docs** (follows, not ahead)

**One question to confirm:** Are the schema and API contract frozen by someone (product/design) before you start, or do you discover constraints as you build layers? If it's the latter, you may want a brief design review *before* the schema is locked.
~~~

**Tokens:** in 681 / out 464 / est $0.003001

**Output-token overhead (treatment vs baseline):** +222.2%

## Rubric score (0–3 each) — fill during scoring

| dim | baseline | treatment | evidence (quote the transcript line) |
|---|---|---|---|
| 1 notes-first adherence |  |  |  |
| 2 grounding |  |  |  |
| 3 premature-solution avoidance |  |  |  |
| 4 coherence / re-grounded summary |  |  |  |

- **baseline mean:** _ / 3 · **treatment mean:** _ / 3 · **delta:** _
- **reasoning_extraction refusal seen?** no
- **notes:** 
