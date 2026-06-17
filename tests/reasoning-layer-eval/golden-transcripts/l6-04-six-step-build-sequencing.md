# Golden transcript — slot 04: six-step-build-sequencing

- **Task family:** multi-stage-impl
- **Host strength:** standard
- **Discipline focus:** complexity-first
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

We have a 6-step build ahead (schema change, API layer, background job, UI, caching, docs). Which part should we tackle first?

## Transcript — distributed (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Load-bearing unknowns:**
1. Do the schema changes block the API layer, or can they proceed in parallel?
2. Is the background job triggered by the API, or independent?
3. Does caching depend on knowing the API surface first?
4. Are there deployment constraints (e.g., must schema migrate before code ships)?

**Inferred dependencies (most likely):**
- Schema change → API layer (API needs the new schema)
- API layer → background job (job likely consumes API or same DB state)
- UI depends on stable API contract
- Caching depends on API surface being finalized
- Docs are blocking only if they gate external consumption

**Risk hierarchy:**
- **Schema**: Hardest to reverse; blocks API. If the schema design is wrong, everything downstream fails.
- **API**: Once locked, contracts bind UI and jobs. If unstable, rework cascades.
- **Background job**: Depends on API; lower reversal cost if logic is wrong.
- **UI**: Depends on API stability; lowest risk if API changes.
- **Caching**: Depends on knowing what to cache (API finalized).
- **Docs**: Never blocks, but needed before launch.

---

## Answer

**Tackle the schema change first.**

**Why:** 
Schema is the load-bearing constraint. It blocks the API layer, and any design flaw forces rework across all downstream steps (API contract, job payloads, caching keys, UI endpoints). It's also the hardest to reverse in production.

**Before you start:**
- Lock the schema design in a design doc or spike (1–2 hours)—get sign-off on it, don't guess
- Verify: does your deployment pipeline support schema-first, code-second releases, or do they go together?

**Then, sequence as:**
1. Schema change (+ migration code)
2. API layer (define contracts, stubs OK at first)
3. Background job (now you have stable inputs)
4. UI (API is locked)
5. Caching (know what queries are hot)
6. Docs (final sweep)

If schema design is uncertain or contentious, resolve that *before* writing migrations.
~~~

**Tokens:** in 681 / out 507 / est $0.003216

## Transcript — orchestrated (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Load-bearing unknowns:**
1. Do schema changes block the API layer? (likely yes — API reads/writes need schema)
2. Does the background job depend on API or schema? (depends on the job's role)
3. Does caching depend on API being testable? (likely yes)
4. Are there data migration or rollback risks in the schema change?
5. What's the deployment constraint — can schema and code ship independently, or must they be locked-step?

**Inference of real goal:** You need to unblock the longest dependency chain and surface the riskiest/least-reversible step before committing engineering time downstream.

**Dependency skeleton (most likely):**
- Schema → API layer (blocks it)
- API layer → background job (probably depends on API endpoints/contracts)
- API layer → caching (can't cache what doesn't exist)
- UI depends on API being stable
- Docs depend on API being finalized
- Background job timing: unclear if it's triggered by API or independent

---

## Answer

**Tackle the schema change first.**

**Why:**
- It's load-bearing: the API layer cannot be implemented or tested without it.
- It's the least reversible: once in production, schema migrations require coordination and data handling. If you build API and caching on a schema design that later changes, rework is expensive.
- It's the place to surface deployment risk early: if the schema change requires zero-downtime migration strategy or rollback planning, that conversation should happen *before* code ships.

**Before you start:**
Clarify one blocking question with your team:
- **Can schema changes and API code deploy independently, or must they ship together?** If independently, schema goes first and you can iterate API later. If locked-step, confirm the migration/rollback strategy now.

**Sequence after schema:**
1. **API layer** (unblocks everything downstream)
2. **Background job** (depends on API contracts being stable)
3. **Caching** (depends on API being queryable and measurable)
4. **UI** (depends on stable API)
5. **Docs** (last; documents final design)
~~~

**Tokens:** in 835 / out 496 / est $0.003315

**Output-token overhead (orchestrated vs distributed):** -2.2%

## Rubric score (0–3 each) — fill during scoring

| dim | distributed | orchestrated | evidence (quote the transcript line) |
|---|---|---|---|
| 1 notes-first adherence |  |  |  |
| 2 grounding |  |  |  |
| 3 premature-solution avoidance |  |  |  |
| 4 coherence / re-grounded summary |  |  |  |

- **distributed mean:** _ / 3 · **orchestrated mean:** _ / 3 · **delta:** _
- **reasoning_extraction refusal seen?** no
- **notes:** 
