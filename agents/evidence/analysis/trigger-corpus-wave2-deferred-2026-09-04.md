<!-- evidence-type: analysis -->
# The trigger corpus is held — the wave that proved it, preserved

`road-to-the-tenth-arrival` step 2.2. The step's premise is **false**, and this
file is both the evidence for that and the preservation of the work that
established it.

## The premise

The roadmap states of the trigger-corpus sub-item: *"Held by nothing. Both
council seats agreed"* and *"it inherited a blocker by association."* On that
premise the step says to expand coverage.

It is held. Not by the blocker it inherited — that part of the routing
correction stands — but by three published measurement records and one reserved
governance decision, none of which the roadmap's authors looked for.

## How it was established: author the wave, run the suite

14 corpus files were authored to the full discipline and every corpus-local
gate went green:

```
$ ./scripts-run src/scripts/check_routing_coverage
  = skills  114 / 299  = 0.3813  (seed 0.3813)
$ ./scripts-run src/scripts/lint_skill_trigger_corpus
  114 corpus file(s) hold the discipline
$ ./scripts-run src/scripts/check_trigger_evals
  114 trigger set(s) fresh + valid
$ ./scripts-run src/scripts/check_trigger_eval_presence
  114/299 skills carry evals/triggers.json (185 grandfathered, shrink-only)
```

The full suite then failed in **three** files, 8 tests — every one a
reproduce-from-tree pin over that exact corpus:

| pin | what it asserts | reading with the wave |
|---|---|---|
| `tests/scripts/trigger_corpus_holdout_pin.test.ts` | the SET-SHA256 published in `agents/evidence/analysis/trigger-corpus-holdout-2026-08-30.md` recomputes over every `src/skills/*/evals/triggers.json`, plus one row per file | new set hash; 14 rows with no published counterpart |
| `tests/scripts/routing_signal_measurement.test.ts` | corpus and train-partition sizes | `expected 114 to be 100`; `expected 93 to be 82` |
| `tests/scripts/delivery_set_compatibility.test.ts` | published derived metrics | `precision_at_k` 82.508 measured against 82.934 published |

**Green corpus-discipline gates were necessary and not sufficient.** They check
corpus-local shape — counts, classes, freshness, a German positive. The
constraint that actually binds is a cross-phase ordering property, which no
shape gate can see.

## Why re-pinning is not the agent's to do

The frozen artefact anticipates growth and reserves the decision, verbatim:

> **It freezes the files that exist, not the ones that will.** A corpus authored
> in wave 2 is outside this frozen set. Whether it joins the holdout, joins the
> train set, or forms a second frozen generation is **a Phase 5 decision**; the
> honest default is that this generation's hash stops describing the corpus the
> moment a file is added, which the set hash makes visible rather than silent.

and, on its partition rule: *"A change is legal; a silent change is the
compromise this step exists to prevent."*

The ordering matters and has already elapsed. `road-to-governed-harness-evolution`
AC-6 asserts the holdout's content hash **predates the first commit of any
proposer capability**, and the artefact verifies it with
`git merge-base --is-ancestor`: the freeze (2026-08-30 22:11) precedes
`ac2501313` (2026-08-31 00:44), which added `candidate_proposer.ts`. A re-pin
taken now would post-date the proposer, so the generation it certifies would no
longer be the one AC-6 is about — and the name-hash would silently answer the
partition question the artefact reserves, by putting each new skill in whichever
bucket its own name falls into.

`precision_at_k` moving 82.934 → 82.508 makes the point concretely: the wave
does not just age a snapshot, it changes a published result.

## Decision

AI council 2026-09-04, anthropic/claude-sonnet-4-5 + openai/codex-default,
2 rounds, quorum 2/2, $0.00 (both seats subscription-authed). Convergent on
**revert the wave**. The one-answering first attempt reached the same verdict
independently before the second seat was reached, and is not counted toward the
quorum.

Both seats: the premise is demonstrably false; a found governance constraint is
valid closure for the step rather than a failure; the wave is preserved as
Phase 5 input rather than discarded; and the durable fix is an explicitly
versioned **second corpus generation** with its own partition provenance, never
a rewrite of the first generation's pins.

Consequence, recorded rather than worked around: **AC-3 is not met.** Its
"expanded with a positive and a near-miss fixture per addition" conjunct is
unmet, so the roadmap does not close and is not archived.

## The wave, preserved

Selection rule, reproducible: the skills carrying a deterministic
`MUST` / `NEVER` / `ALWAYS` obligation per `report_skill_activation` — 34 names,
16 without a corpus — minus `motion-choreographer` and `upstream-contribute`,
which the council's 10–15 band did not reach. Every file below holds
`lint_skill_trigger_corpus`'s discipline as authored: at least three positives,
at least two negatives, one declared German positive, and a declared case class
per query.

Restoring the wave is a copy of each block below to
`src/skills/<name>/evals/triggers.json`, and it is **not** a thing to do without
the Phase 5 partition decision this file exists to route to.

### `src/skills/ai-council/evals/triggers.json`

```json
{
    "skill": "ai-council",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two in-session critique surfaces whose vocabulary ('second opinion', 'poke holes') overlaps entirely; the discriminator is whether a model OUTSIDE the host session is polled.",
    "queries": [
        {
            "q": "get a second opinion on this roadmap from another model",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "cross-check this design with OpenAI and Anthropic before I commit to it",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "hol bitte eine neutrale Zweitmeinung von einem externen Modell zu diesem Diff",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "poke holes in this plan — be brutal",
            "trigger": false,
            "class": "near-miss",
            "note": "an in-session adversarial teardown by the host model itself, no external seat polled -> adversarial-review"
        },
        {
            "q": "review the changes on this branch",
            "trigger": false,
            "class": "near-miss",
            "note": "routine review by the host, not a neutral external second opinion -> code-review"
        },
        {
            "q": "which model should we use for the production summarisation endpoint?",
            "trigger": false,
            "class": "counterexample",
            "note": "a provider/model selection question about the product, not a governance consult -> llm-provider-knowledge"
        }
    ]
}
```

### `src/skills/dependency-upgrade/evals/triggers.json`

```json
{
    "skill": "dependency-upgrade",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two package surfaces that share the word 'package'; the discriminator is whether a dependency ALREADY in the manifest moves version, versus one arriving for the first time.",
    "queries": [
        {
            "q": "bump the framework to the next major and tell me what breaks",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "upgrade our packages and review the changelogs for breaking changes",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "wir müssen die Abhängigkeiten aktualisieren — welche Breaking Changes kommen da?",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "we want to add a new charting library — is it safe to install?",
            "trigger": false,
            "class": "near-miss",
            "note": "intake of a dependency that is not yet in the manifest -> supply-chain-intake"
        },
        {
            "q": "how do I publish this as a composer package?",
            "trigger": false,
            "class": "near-miss",
            "note": "authoring/publishing a package rather than moving an installed one -> composer-packages"
        },
        {
            "q": "upgrade the staging instance to a larger machine type",
            "trigger": false,
            "class": "counterexample",
            "note": "infrastructure sizing that reuses the word 'upgrade' -> aws-infrastructure"
        }
    ]
}
```

### `src/skills/judge-bug-hunter/evals/triggers.json`

```json
{
    "skill": "judge-bug-hunter",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two sibling judges dispatched over the same diff by the same command, which is the sharpest edge in the family: same input, same trigger verbs, different lens.",
    "queries": [
        {
            "q": "check this diff for null-safety and off-by-one errors",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "are there unhandled edge cases or races in these changes?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "prüf den Diff auf Korrektheitsfehler — Randfälle, Fehlerbehandlung, Nebenläufigkeit",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "is this diff readable? check naming and single-responsibility",
            "trigger": false,
            "class": "near-miss",
            "note": "the readability lens over the same diff -> judge-code-quality"
        },
        {
            "q": "does this diff need a regression test?",
            "trigger": false,
            "class": "near-miss",
            "note": "the coverage lens over the same diff -> judge-test-coverage"
        },
        {
            "q": "here is a Sentry stack trace from production — find the root cause",
            "trigger": false,
            "class": "counterexample",
            "note": "a live defect in shipped code, not a review of a proposed diff -> bug-analyzer"
        }
    ]
}
```

### `src/skills/judge-code-quality/evals/triggers.json`

```json
{
    "skill": "judge-code-quality",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the sibling correctness judge over the same diff and the skill that PERFORMS a refactor rather than judging one.",
    "queries": [
        {
            "q": "review this diff for naming, dead code and duplication",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "does this change match the conventions used elsewhere in the codebase?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "bewerte die Lesbarkeit dieses Diffs — Benennung, Verantwortlichkeiten, Duplikate",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "check this diff for off-by-one and null-safety bugs",
            "trigger": false,
            "class": "near-miss",
            "note": "the correctness lens over the same diff -> judge-bug-hunter"
        },
        {
            "q": "extract this duplicated block into a shared helper",
            "trigger": false,
            "class": "near-miss",
            "note": "performing the cleanup rather than judging the diff -> code-refactoring"
        },
        {
            "q": "the linter is complaining about formatting — fix it",
            "trigger": false,
            "class": "counterexample",
            "note": "a deterministic tool finding, not a readability judgement -> quality-tools"
        }
    ]
}
```

### `src/skills/judge-security-auditor/evals/triggers.json`

```json
{
    "skill": "judge-security-auditor",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two security surfaces that fire BEFORE code exists (threat model) or over a whole request chain rather than a diff (authz review).",
    "queries": [
        {
            "q": "does this diff introduce an injection or mass-assignment risk?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "security-review these changes for secrets, SSRF and unsafe deserialization",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "prüf diesen Diff auf Sicherheitsrisiken — Injection, XSS, offengelegte Secrets",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "we are about to add file uploads — what could go wrong?",
            "trigger": false,
            "class": "near-miss",
            "note": "abuse-case enumeration before the code is written -> threat-modeling"
        },
        {
            "q": "walk the authorization chain for this endpoint from route to response",
            "trigger": false,
            "class": "near-miss",
            "note": "an end-to-end chain audit, not a diff lens -> authz-review"
        },
        {
            "q": "rotate the API signing key and move it out of the repo",
            "trigger": false,
            "class": "counterexample",
            "note": "credential handling, no diff under review -> secrets-management"
        }
    ]
}
```

### `src/skills/judge-test-coverage/evals/triggers.json`

```json
{
    "skill": "judge-test-coverage",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two testing surfaces that WRITE tests or teach test authoring, versus judging whether an existing diff is covered.",
    "queries": [
        {
            "q": "does this diff have enough tests, or are branches uncovered?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "this bug fix has no regression test — flag what is missing",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "prüf ob dieser Diff ausreichend getestet ist — fehlende Assertions, zu viel gemockt",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "write the tests for this new service class",
            "trigger": false,
            "class": "near-miss",
            "note": "authoring the tests rather than judging coverage of a diff -> tests-create"
        },
        {
            "q": "what makes an assertion tautological?",
            "trigger": false,
            "class": "near-miss",
            "note": "guidance about test smells in general, no diff under review -> testing-anti-patterns"
        },
        {
            "q": "the test suite takes nine minutes — make it faster",
            "trigger": false,
            "class": "counterexample",
            "note": "runtime of the suite, not coverage of a change -> test-performance"
        }
    ]
}
```

### `src/skills/quality-tools/evals/triggers.json`

```json
{
    "skill": "quality-tools",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. This skill is PHP-toolchain-scoped (PHPStan / Rector / ECS); the counterexample guards the widest failure mode, firing on any 'the linter is red' phrasing regardless of stack.",
    "queries": [
        {
            "q": "phpstan says this is mixed — how do I type it properly?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "run rector and fix the code style errors it reports",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "ECS meckert über den Code-Style in dieser Datei — bitte beheben",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "this Eloquent query is hard to read — clean it up",
            "trigger": false,
            "class": "near-miss",
            "note": "writing/refactoring model code, no analyser output in play -> eloquent"
        },
        {
            "q": "review this diff for readability and naming",
            "trigger": false,
            "class": "near-miss",
            "note": "a human-judgement review, not a static-analyser finding -> judge-code-quality"
        },
        {
            "q": "eslint is failing on the frontend build",
            "trigger": false,
            "class": "counterexample",
            "note": "a JavaScript toolchain finding; this skill covers the PHP analysers only"
        }
    ]
}
```

### `src/skills/recursive-verification/evals/triggers.json`

```json
{
    "skill": "recursive-verification",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the general orchestration surface this specialises and the repair loop it is most often confused with; the discriminator is the DEPTH-BOUNDED attempt -> critic -> re-attempt knob.",
    "queries": [
        {
            "q": "run a depth-bounded attempt-critic-reattempt loop on this task",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "spend more test-time compute: let a critic score the output and retry twice",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "lass das Ergebnis von einem Kritiker bewerten und bis zu zwei Mal nachbessern",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "which orchestration mode fits these three independent slices?",
            "trigger": false,
            "class": "near-miss",
            "note": "mode selection across the nine modes, not the self-correction knob -> subagent-orchestration"
        },
        {
            "q": "the verification failed — fix it and re-run",
            "trigger": false,
            "class": "near-miss",
            "note": "a single repair pass, not a bounded critic loop -> verify-repair-loop"
        },
        {
            "q": "is this feature finished? show me the evidence",
            "trigger": false,
            "class": "counterexample",
            "note": "a completion-evidence check, no loop involved -> verify-completion-evidence"
        }
    ]
}
```

### `src/skills/requesting-code-review/evals/triggers.json`

```json
{
    "skill": "requesting-code-review",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the two neighbours on either side of the request: who should review it, and what to do once feedback arrives.",
    "queries": [
        {
            "q": "this is ready to merge — open the PR",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "I want a review on this branch; what context should I give the reviewer?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "die Änderung ist fertig — bereite sie für den Review vor",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "who on the team should review this change?",
            "trigger": false,
            "class": "near-miss",
            "note": "reviewer selection and risk flags -> review-routing"
        },
        {
            "q": "the reviewer left six comments — how do I respond?",
            "trigger": false,
            "class": "near-miss",
            "note": "handling feedback after the review -> receiving-code-review"
        },
        {
            "q": "review this diff for me",
            "trigger": false,
            "class": "counterexample",
            "note": "the agent performing a review, not the author requesting one -> code-review"
        }
    ]
}
```

### `src/skills/review-routing/evals/triggers.json`

```json
{
    "skill": "review-routing",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the author-side request and the act of reviewing; this skill answers WHO and WHAT RISK, never the review itself.",
    "queries": [
        {
            "q": "who should review this change, and what is the risk level?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "map the touched paths to owners and flag any historical bug patterns",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "wer sollte diesen PR reviewen, und wie riskant ist er?",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "this is ready to merge — open the PR",
            "trigger": false,
            "class": "near-miss",
            "note": "the author-side request, not reviewer selection -> requesting-code-review"
        },
        {
            "q": "review this diff for correctness and style",
            "trigger": false,
            "class": "near-miss",
            "note": "performing the review rather than routing it -> code-review"
        },
        {
            "q": "route this prompt to the right skill",
            "trigger": false,
            "class": "counterexample",
            "note": "artefact routing inside the suite, not reviewer assignment -> analysis-skill-router"
        }
    ]
}
```

### `src/skills/rtk-output-filtering/evals/triggers.json`

```json
{
    "skill": "rtk-output-filtering",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the broader token-budget surfaces that share the vocabulary 'tokens' and 'context'; this skill is specifically about wrapping a verbose CLI command.",
    "queries": [
        {
            "q": "this command floods the context — wrap it so it costs fewer tokens",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "set up rtk so the test output does not blow up the session",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "die CLI-Ausgabe ist viel zu lang — filtere sie, bevor sie in den Kontext geht",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "how do we cut the token cost of this session overall?",
            "trigger": false,
            "class": "near-miss",
            "note": "the whole budget-lever index, not one command's output -> token-optimizer"
        },
        {
            "q": "this conversation is getting long — should I start fresh?",
            "trigger": false,
            "class": "near-miss",
            "note": "conversation freshness, not command output -> context-hygiene"
        },
        {
            "q": "the build output shows an error — what is it?",
            "trigger": false,
            "class": "counterexample",
            "note": "reading a specific failure out of output, not filtering it"
        }
    ]
}
```

### `src/skills/sql-writing/evals/triggers.json`

```json
{
    "skill": "sql-writing",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the ORM surface and the schema-design surface, both of which share the words 'query' and 'table'; the discriminator is RAW SQL text.",
    "queries": [
        {
            "q": "write the raw SQL for this report — MariaDB, parameterised",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "why is this query slow? SELECT o.* FROM orders o JOIN customers c ON c.id = o.customer_id WHERE c.region = ?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "schreib das als rohes SQL-Statement für den Seeder mit DB::statement",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "build this filter with the query builder instead",
            "trigger": false,
            "class": "near-miss",
            "note": "ORM/query-builder composition rather than raw SQL -> eloquent"
        },
        {
            "q": "how should we model this many-to-many relationship?",
            "trigger": false,
            "class": "near-miss",
            "note": "schema design, no SQL text to write -> database"
        },
        {
            "q": "add an index on the orders.customer_id column",
            "trigger": false,
            "class": "counterexample",
            "note": "a migration change; the SQL is generated by the migration API -> laravel-migration"
        }
    ]
}
```

### `src/skills/subagent-orchestration/evals/triggers.json`

```json
{
    "skill": "subagent-orchestration",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses are the policy rule that decides WHETHER to delegate and the self-correction specialisation of one of the nine modes.",
    "queries": [
        {
            "q": "split this into independent slices and run them as parallel subagents",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "which orchestration mode fits: implementer plus judge, or a debate?",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "verteil das auf mehrere Subagenten und lass einen Judge das Ergebnis prüfen",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "should I be delegating this at all, or just do it here?",
            "trigger": false,
            "class": "near-miss",
            "note": "the delegate-or-not decision, upstream of mode selection -> delegation-policy"
        },
        {
            "q": "run a bounded critic loop over this single output",
            "trigger": false,
            "class": "near-miss",
            "note": "one mode's specialisation, not mode selection -> recursive-verification"
        },
        {
            "q": "orchestrate the release pipeline steps",
            "trigger": false,
            "class": "counterexample",
            "note": "CI/release sequencing that reuses the word 'orchestrate' -> github-ci"
        }
    ]
}
```

### `src/skills/using-git-worktrees/evals/triggers.json`

```json
{
    "skill": "using-git-worktrees",
    "last_eval": "2026-09-04",
    "description": "Authored 2026-09-04 under road-to-the-tenth-arrival 2.2, wave selected by the priority rule in agents/evidence/analysis/tenth-arrival-coverage-2026-09-04.md: skills carrying a deterministic MUST/NEVER/ALWAYS obligation (report_skill_activation) that had no corpus. 3 exemplars (1 de) + 2 near-misses + 1 counterexample. Near-misses mirror the boundary already declared from the other side in worktree-lifecycle's own corpus: creation mechanics here, governance of an existing worktree there.",
    "queries": [
        {
            "q": "spawn a worktree so I can try this on the side without touching my branch",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "set up an isolated checkout for this experiment with a clean test baseline",
            "trigger": true,
            "class": "exemplar"
        },
        {
            "q": "leg ein separates Worktree an, damit ich parallel daran arbeiten kann",
            "trigger": true,
            "class": "exemplar",
            "language": "de"
        },
        {
            "q": "is this worktree merge-ready, and can I clean it up safely?",
            "trigger": false,
            "class": "near-miss",
            "note": "governance and teardown of an existing worktree -> worktree-lifecycle"
        },
        {
            "q": "switch to the feature branch and keep working there",
            "trigger": false,
            "class": "near-miss",
            "note": "a plain branch switch in the same checkout -> git-workflow"
        },
        {
            "q": "create a branch for this fix",
            "trigger": false,
            "class": "counterexample",
            "note": "branch creation without isolation; no second working directory -> git-workflow"
        }
    ]
}
```

