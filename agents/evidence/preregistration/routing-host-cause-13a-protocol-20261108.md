<!-- evidence-type: analysis -->

# Pre-registration: step 1.3a, the host as the cause of the two carried units

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3a.

**Written:** 2026-11-08. It is committed before any run of this comparison, and its results land in later commits.

**Question:** do `react-shadcn-ui` and `project-analysis-core` route on the baseline host 2.1.311, where both fired on 2026-10-27, on the same cases on which today's host 2.1.316 handles them directly (`routing-prompt-v2-20261108.md`)?

## Frozen

- **Cases:** the five v2 cases (`internal/bench/trigger-fixtures/series-v2/cases.json`), unchanged: `rsu-v2-add`, `rsu-v2-compose`, `rsu-v2-polish`, `pac-v2-onboard`, `pac-v2-versions`.
- **Plugin roots:** the two compiled roots the v2 run used, unchanged. They hold catalogue `828f2e07…` and the same fixtures (`d90aec2a`, `059d2030`). Both hosts run the identical directories, so the catalogue is held constant.
- **Hosts:**
  - **A**, baseline host `2.1.311`, invoked as `npx -y @anthropic-ai/claude-code@2.1.311` and not installed globally;
  - **B**, today's host `2.1.316`.

  Each artefact records the version it ran.
- **Instrument, both hosts:** `plugin eval --scaffold --trust-plugin --keep-temp --runs 3 --ablation none --no-publish --model claude-opus-5-5 --max-cost-usd 10`. The `react-shadcn-ui` root also gets `--allow-tools Edit Write`, the `project-analysis-core` root does not, as in v2.
- **Order:** A then B for each unit. No retries. An errored run is UNKNOWN and is not replaced.
- **Pass rule:** unchanged. The run called `Skill` with the unit's own name.

## Decision rule, fixed now

Per unit, using pooled passes over its cases (9 runs for `react-shadcn-ui`, 6 for `project-analysis-core`):

- **Host is the cause:** A passes at least two thirds of its runs (≥ 6/9, ≥ 4/6), and B passes at most one third (≤ 3/9, ≤ 2/6).
- **Host is not the cause:** A passes at most one third. The unit misses on the baseline host too, so the cause lies elsewhere: the catalogue as it is today, or the cases.
- **Undecided:** anything between those bounds. It is reported as undecided and not rounded towards either reading.

## What this cannot show

This is one model and three runs per case. "Host is the cause" names the version step 2.1.311 → 2.1.316 and nothing within it. It does not say whether that change was intended, and it does not license any mechanism; that is 1.3b's question.
