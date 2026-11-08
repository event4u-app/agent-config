<!-- evidence-type: analysis -->

# Pre-registration — is the host's direct output adequate for two bypassed skills

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Written:** 2026-11-08, committed before any run of this assessment. Results
land in later commits.
**Why it exists:** `agents/evidence/metrics/routing-type-design-n10-20261105.md`
§ Council round 3. `react-shadcn-ui` and `project-analysis-core` score 0/3
because the host does the work itself. Both council seats (anthropic, openai;
2026-11-05) asked for the following before choosing between retiring the
positives (a) and a v2 prompt series (b): a standard for what each skill
adds, a judgement of the host's direct output against that standard, and a
decision rule frozen before the judgement.

## The standard — taken from the skills, not written for this test

Each criterion cites the line of the skill's own `SKILL.md` it comes from
(`src/skills/<name>/SKILL.md` at the commit that carries this file). Criteria
that the case cannot exercise are excluded here, with the reason, before any
output exists.

### `react-shadcn-ui` — prompt: "components/ui already has Button — restyle its variants to match our tokens"

| Id | Criterion | Source lines |
|---|---|---|
| R1 | Variant colours reference the project's tokens (`styles/tokens.css`) through CSS variables or semantic classes, not hex values copied into class strings | 110-114, 262-264, 381 |
| R2 | No raw palette colour (`bg-white`, `text-black`, `#…`, `bg-blue-500`-style) in `button.tsx` | 113-114, 262-264 |
| R3 | Radius comes from the `--radius-md` token, not a hard-coded value | 265-267, 381 |
| R4 | The variant API is kept: `cva` with the `variant` and `size` keys, the existing variants are not removed, no raw Tailwind override replaces the variant set; `forwardRef` and `displayName` remain | 252-254 |
| R5 | The interactive base declares a focus-visible ring | 115-117, 271 |
| R6 | Dark mode is not branched on a prop; any dark handling goes through the `.dark` class and semantic tokens | 113-114, 268-269, 382 |
| R7 | The Tailwind version is not guessed: the run either establishes it from the workspace, states its assumption, or avoids an edit that depends on it (for example, it does not create `tailwind.config.*` without a basis) | 100-109 |
| R8 | No other UI library is introduced and `shadcn-ui` is not installed from npm | 380, 386 |

Excluded: the installer gate (38-57) and the registry sections (157-226) — the
task adds no component; Step 0's `state.*` reads (230-243) — no engine state
exists in the sandbox; Step 3 state coverage and the review-pass envelope
(274-336) — they concern composed components and review dispatch, not a
primitive restyle.

### `project-analysis-core` — prompt: "this codebase is unknown to me, discover its structure and architecture first"

| Id | Criterion | Source lines |
|---|---|---|
| P1 | A project summary | 124 |
| P2 | Stack identified: language, runtime, package manager and workspace tool, and the framework and critical packages of each app | 35-44, 125 |
| P3 | Versions taken from manifests; the absence of a lock file is noticed and the versions are marked as unresolved constraints, not stated as installed | 46-57, 173, 179 |
| P4 | Entrypoints named: the API server and the worker | 72, 174 |
| P5 | Modules, their boundaries and the dependency direction between apps and packages | 73-75, 126 |
| P6 | An execution flow traced end to end, including where the synchronous path hands off to asynchronous work | 81-88, 127 |
| P7 | State systems and external integrations named: the database, the queue backend, the token secret | 76-77 |
| P8 | Uncertainties stated | 129 |
| P9 | A recommended next step or specialist analysis | 130 |
| P10 | No claim the workspace contradicts (fact sheet below) | 179-180 |

Excluded: documentation loading (59-66) and real-world research (100-110) — the
case grants no web tool; the improvement-mode and knowledge-capture scripts
(132-169) — they are not installed in the sandbox.

**Fact sheet for P10**, read from `internal/bench/trigger-fixtures/project-analysis-core/q1/scaffold.sh`
(`059d2030`): npm workspaces (`apps/*`, `packages/*`) with turbo `^2.0.0` and
TypeScript `^5.4.0`; no lock file; `@fleet/api` — express `^4.19.0`, bullmq
`^5.4.0`, routes `/vehicles` (GET list, GET by id) and `/trips` (POST), JWT auth
middleware on every route; `@fleet/worker` — bullmq worker on queue
`trip-events`, job `trip.created` updates vehicle mileage; `@fleet/db` — `pg`
`^8.11.0` pool, two SQL migrations (`vehicles`, `trips`); `@fleet/shared` —
`jsonwebtoken` `^9.0.0` `verifyToken`; `config/index.ts` with `PORT` and
`REDIS_URL`; `infra/docker-compose.yml` with postgres 16 and redis 7; no tests,
no CI workflow, no README.

## The runs

| Arm | Prompt | Runs per unit |
|---|---|---:|
| direct | the corpus prompt, unchanged (the case of fixture series v1) | 5 |
| reference | the same prompt followed by one sentence: `Use the <skill> skill.` | 5 |

- Cases `066-react-shadcn-ui-rsu-e2` and `147-project-analysis-core-q1`, fixtures
  `d4061c2f` and `059d2030`, tools as in fixture series v1 (`react-shadcn-ui`
  with the operator grant `--allow-tools Edit Write`, which v1 found necessary).
- Instrument: `claude plugin eval --scaffold`, `claude-opus-5-5`,
  `--ablation none`, `--no-publish`, `--trust-plugin`, `--keep-temp`,
  `max_turns: 10`, through the subscription CLI. Catalogue: `dist/agent-src/skills/`
  at the commit that carries this file (`501c9dbd…`). The artefact names the
  host version.
- No retries. An errored run is UNKNOWN, is not replaced, and leaves its arm's
  denominator. A reference run that does not call `Skill` with the unit's name
  is a protocol failure, is reported, and leaves the reference denominator.
  A direct run that does call the skill stays in the direct arm (it is what
  the host did) and is counted in the report.

## What the judges see

- `react-shadcn-ui`: the final `components/ui/button.tsx` and any other file the
  run created or changed, rebuilt by replaying the run's `Edit` and `Write`
  calls from its trace onto the fixture, plus the run's final message.
  `project-analysis-core`: the run's final message.
- The ten outputs per unit are shuffled with seed `20261108`, relabelled `O1`–`O10`,
  and stripped of any skill name by replacing `react-shadcn-ui`,
  `project-analysis-core` and `` Skill `` tool mentions with `[redacted]`. The
  arm of each label stays in a local key that the judges never see.
- Judges: the AI council, both seats (anthropic, openai), one session per unit,
  `--prompt-mode analysis`. Prompt, verbatim, besides the criteria table, the
  excluded list, the fact sheet (P10 only) and the outputs:

  > Score each output against each criterion as `met`, `not_met` or `n/a`, and
  > give one short line of evidence quoted or paraphrased from the output. Judge
  > only what the output shows. Return a table with one row per output and one
  > column per criterion.

  The prompt package is committed with the verdicts.

## Decision rules, fixed now

- **Cell:** a criterion is `met` for an output only when both seats score it
  `met`. A cell that either seat scores `n/a` and the other does not counts as
  not met.
- **Run score:** met cells ÷ applicable cells.
- **Reliability:** if the seats disagree on more than 25 % of a unit's cells,
  that unit's judgement is unreliable and the unit goes to the owner with the
  table; no disposition follows from it.
- **Disposition per unit:**
  - **(a) retire the positive** — the host owns the prompt — when the median
    direct score is ≥ 0.80 **and** the median reference score exceeds it by no
    more than 0.10. With fewer than 3 valid reference runs, the first condition
    decides alone, and the report says so.
  - **(b) v2 prompt series** otherwise, written by a session that did not
    author this protocol, to a contract frozen before its first run.
- Either outcome is recorded at 1.3 with this file and the result. (a) is a
  corpus edit that moves the positive out of the routing positives, under its
  own commit naming this assessment; it does not lower any floor.
- No further runs, judges or criteria follow from this assessment under this
  contract.
