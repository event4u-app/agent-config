# Golden transcript — slot 10: estimate-reindex-job

- **Task family:** cross-run-calibration
- **Host strength:** standard
- **Discipline focus:** prediction
- **Captured:** 2026-06-17 (controlled two-system-prompt API harness; single rater)

## Prompt

Estimate how long the search-reindex job will take — we'll check it against the actual runtime afterwards.

## Transcript — baseline (claude-haiku-4-5-20251001)

~~~text
I don't have visibility into your codebase yet. To estimate the search-reindex job runtime, I need:

1. **What's being indexed?** (document count, average doc size)
2. **What's the indexing backend?** (Elasticsearch, Solr, Meilisearch, etc.)
3. **Current job implementation** — can you share the reindex code or a link to it?
4. **Hardware specs** — where does it run? (single machine, distributed, cloud instance type?)
5. **Any past runtime data?** (previous reindex duration, if available)

Once you share these details, I can give a reasonable estimate based on typical throughput for that stack.
~~~

**Tokens:** in 121 / out 160 / est $0.000921

## Transcript — treatment (claude-haiku-4-5-20251001)

~~~text
## Working notes

**Information gaps (must close before estimating):**
1. What codebase/system are we talking about? (I have no context on what "search-reindex job" means here.)
2. What is the current data volume? (index size, document count, or similar metric)
3. What is the hardware profile? (CPU cores, RAM, disk I/O type for the indexing system)
4. Is this a full reindex from scratch, or incremental?
5. What indexing backend? (Elasticsearch, Solr, database full-text index, custom?)
6. Are there any SLA or historical baseline runs I can reference?

**What I can see:**
- You mention "we'll check it against the actual runtime afterwards" — you're setting this up for calibration, which is good discipline.
- The phrasing "the search-reindex job" suggests there's a specific, known job in your codebase.

**Before I estimate, I need one focused question:**

**Can you point me to the reindex job code/config and tell me (a) approximate document count or index size, and (b) what system it's indexing into?** That will let me give a calibrated prediction rather than a generic one.

If you're under time pressure and want a rough order-of-magnitude now, I can offer: typical full reindexes run 5–120 minutes depending on volume and hardware, but that's too wide to be useful for planning.
~~~

**Tokens:** in 671 / out 336 / est $0.002351

**Output-token overhead (treatment vs baseline):** +110.0%

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
