<!-- evidence-type: analysis -->

# Pre-registration — the frozen routing-baseline protocol

**Roadmap:** `road-to-routing-assurance-live-floors`, step 0.2 and blocker
`b-live-baseline-independence`.
**Written:** 2026-10-27, before any baseline case ran.
**Ordering:** this file lands in its own commit. The baseline artefact lands in
a LATER commit and names this file's sha256, so the order is a property of the
history and not of this sentence.

## Who froze it, and why that session may

The blocker asks for a session that did NOT author the Phase-2 corpus
(`src/skills/*/evals/triggers.json`). This session wrote no corpus file: its
commits before this one touch `src/scripts/compile_trigger_evals.ts`, a new
`src/scripts/_lib/routing_baseline.ts` and their tests, and nothing under
`src/skills/`. `git log -- 'src/skills/*/evals/triggers.json'` on this branch
shows no commit from it. The protocol below was chosen here, before any corpus
case ran; the owner decision of 2026-10-26 (OQ-15) fixed only the instrument
(the host evaluator, option 1) and the spend cap (25 USD, cumulative).

## Disclosure — what ran before the freeze

Pre-registration is worth nothing if its own ordering is fudged, so every run
before this commit is listed. None touched a corpus query.

| Run | Content | Purpose | Cost (USD) |
|---|---|---|---:|
| C1 | one synthetic skill `zebra-feeding`, prompt "What should I feed my zebra this winter?", throwaway `HOME` | does the runner work at all | 0.000 (errored: not logged in, spawn refused) |
| C2, C3 | the same synthetic case, real `HOME` | cost of one run; whether the run isolates the user's own skills | 0.116 |
| C4 | the same case, three `tool_used` graders | whether `input_match` is a regex over the call's JSON input, and whether frontmatter `tags` are read by `--tag` | 0.057 |
| C5 | `--tag nosuchtag` | that `--tag` excludes | 0.000 (no case matched) |
| C6 | the full projected catalogue (301 skills) as a plugin, two synthetic prompts (zebra diet; a Postgres table for zebra feeding schedules) | cost per run against the real catalogue | 0.302 |
| | | **spent before the freeze** | **0.475** |

What the calibration established, each on host **2.1.311**:

1. **The run isolates its configuration.** The child runs under its own
   generated home; the init event listed 18 skills for C3 (the plugin's one plus
   host built-ins) although the user has 313 skills installed globally. So the
   "throwaway HOME" input is satisfied by the host itself, and overriding `HOME`
   by hand breaks authentication (C1).
2. **The compiled grader could not measure what it claimed.** It was an `llm`
   grader whose default focus is the last message, which never shows a skill
   invocation. It is now a deterministic `tool_used` check on the Skill call,
   `input_match: '[":]<skill>"'`, `arm: both` (fixed in the commit before this
   one; verified on C4: the right name matched, a prefix did not, `min: 0
   max: 0` failed on a call that happened).
3. **Tags were in a file the host ignores.** They are now in the prompt
   frontmatter; C4 and C5 show `--tag` reads them there.
4. **Cost.** 0.125 and 0.177 USD per run against the full catalogue on the
   default model; almost all of it is a 14.5k-token cache write per child,
   which no later child reused.

## The protocol

| Item | Frozen value |
|---|---|
| Instrument | `claude plugin eval`, Claude Code **2.1.311** |
| Target | a throwaway skills-dir plugin named `ac`, built by `compile_trigger_evals --baseline-plan`: `dist/agent-src/skills/` copied verbatim (the projection a host loads, 301 skills), plus the selected cases under `evals/` |
| Commit | the commit that lands this file; the artefact records the exact SHA it ran at |
| Model | **`claude-opus-5-5`**, passed explicitly with `--model` — the model the host ran by default in C2–C6 |
| Judge model | none — no `llm` grader is used |
| Prompt | the corpus query verbatim as the case body; frontmatter `max_turns: 10`, `allowed_tools: [Read, Glob, Grep, Skill]` |
| Grader | one `tool_used` grader per case: `tool: Skill`, `input_match: '[":]<unit>"'`, `arm: both` |
| Selection | **positives only.** Per unit, the positive whose `sha256(unit + "\0" + id)` is smallest; units ordered by `sha256(unit)`; **every** unit with a positive is selected (`selectBaseline`, `--units 999 --per-unit 1`) |
| Order | case directories are numbered in selection order, so the run order is the hash order |
| Runs per case | **1** (`--runs 1`) |
| Sampling | the host's defaults; it exposes no temperature control |
| Ablation | **`none`** — the no-plugin arm cannot select a skill it does not carry |
| Concurrency | `-j 4` |
| Publishing | `--no-publish` (report stays local) |
| Spend ceiling | `--max-cost-usd 22.5`. With 0.475 already spent and at most four runs in flight past the ceiling, the cumulative spend stays under the owner's 25 USD |
| Retries | **none.** A run is never repeated. |
| Exclusions | negatives and near-misses (the registered floors are recall floors); units with no positive; catalogue skills with no corpus stay in the catalogue as distractors and are not measured |
| Failure handling | a run whose `error` is set is **UNKNOWN**: it is neither a miss nor a pass, its unit gets no recall from it, and the count is reported |
| Partial run | if the ceiling stops the run, the units already run are the baseline and the rest have no row — a hash-ordered sample, not the tail of the alphabet |
| Aggregation | per-unit recall = fired / non-UNKNOWN runs (`unitRows`); the corpus mean is over measured units only and is reported beside the measured-unit count |
| Fingerprint per row | unit, case id, query sha256, the unit's `SKILL.md` sha256; per artefact: catalogue sha256, host version, model, commit, this file's sha256 |
| Artefact | `agents/evidence/metrics/routing-baseline-20261027.json`, written by `compile_trigger_evals --ingest` |

The exact command, after `--baseline-plan` has built the target under a
gitignored path:

```bash
claude plugin eval --ablation none --runs 1 -j 4 --max-cost-usd 22.5 \
  --model claude-opus-5-5 --no-publish --trust-plugin --keep-temp \
  --json <aggregate.json> <plugin-root>
```

`--keep-temp` keeps each run's trace so the artefact can record which skills a
run actually invoked; it changes nothing the child sees.

## Floors — derived, never chosen

Step 0.4 applies the rule `docs/contracts/routing-assurance-metrics.md`
registered on 2026-08-25, mechanically (`deriveFloors`): floor = baseline recall
− **0.10**, clamped at 0, for every unit with a measured recall. No other floor
is written.

**What one run per unit buys, stated now.** A per-unit recall from one run is 0
or 1, so every derived floor is 0.90 or 0. A 0.90 floor means "the unit must
fire on its baseline prompt"; a 0 floor gates nothing. This is the pilot the
budget pays for — breadth across units over per-unit confidence, the order the
roadmap's own 6.3 prefers — and 6.1–6.2 restate the floors as rates once
repetition exists.

## Known deviations from production, recorded before the result

- **Namespaced names.** A plugin skill is listed as `ac:<name>`; a user-level
  install lists `<name>`. The grader matches both.
- **Plugin skills ignore `skillOverrides`.** The consumer path with overrides
  active is not what this measures.
- **The listing is not observable.** The host truncates descriptions when its
  listing overflows (C6 wrote 14.5k tokens for 301 skills), and the trace shows
  skill names only, not which descriptions survived. A miss can therefore mean
  "not listed with a description" as well as "not chosen". This is recorded as
  a limitation of every row rather than repaired here.

## The inputs offered for this session — taken or refused

From `inbox-2026-10-an` and `inbox-2026-10-at`, each decided here:

- **Listing snapshot per run** — refused for this pilot: the trace does not
  carry the listing (see above), so a snapshot would be a reconstruction.
- **Hook on/off arm; previous-release arm** — refused: the evaluator runs
  without this package's hooks, and a second release doubles spend the cap
  does not cover.
- **Two control fixtures** — refused: they are new cases, and this file adds
  no case to the corpus.
- **Four report axes, infrastructure failure UNKNOWN** — the UNKNOWN half is
  taken (see Failure handling); this pilot reports the selection axis only.
- **Natural vs explicit pairs; three listing arms** — refused: each doubles or
  triples the runs per unit, and the cap buys one run per unit.
- **Fingerprint per row** — taken, in the reduced form listed above.
- **Fail-closed start guard** — satisfied by the instrument: the host isolates
  its configuration (calibration point 1) and the printed command always
  carries `--no-publish`.
