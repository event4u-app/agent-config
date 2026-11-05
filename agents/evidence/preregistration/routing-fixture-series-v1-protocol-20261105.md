<!-- evidence-type: analysis -->

# Pre-registration — the fixture series v1 for the five carried units

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Written:** 2026-11-05, committed before any case of this series runs. Its
results land in later commits.
**Why it exists:** `agents/evidence/metrics/routing-carried-units-20261105.md` —
the host stops before routing when the sandbox lacks the material a prompt
names, and both AI-council rounds of 2026-11-05 asked for a versioned fixture
series beside the old one, with this contract frozen first.

## The series

| Unit | Case | Fixture (`internal/bench/trigger-fixtures/`) | sha256[0:8] | Extra tools |
|---|---|---|---|---|
| `type-design` | `q5` | `type-design/q5/scaffold.sh` (the pilot's, unchanged) | `9663e579` | — |
| `react-shadcn-ui` | `rsu-e2` | `react-shadcn-ui/rsu-e2/scaffold.sh` (the pilot's, unchanged) | `d4061c2f` | Edit, Write |
| `dependency-upgrade` | `q2` | `dependency-upgrade/q2/scaffold.sh` (new) | `1a9d7b14` | Edit, Write |
| `project-analysis-core` | `q1` | `project-analysis-core/q1/scaffold.sh` (new, 20 files) | `059d2030` | — |
| `wireframe` | `q3` | none — its prompt names no material | — | — |

- Prompts are the corpus text unchanged, under the same rank-prefixed case names
  as the canary (`compile_trigger_evals --baseline-plan --units 999 --per-unit 1
  --only <the five> --fixtures internal/bench/trigger-fixtures`).
- No fixture names a skill or the task. The `project-analysis-core` fixture
  replaces the pilot's five one-line files, which every pilot run judged too
  small to need a skill; it is sized as a small real monorepo **before** any run
  sees it, and it is not resized after.
- Edit and Write are a **declared experimental condition** for the two prompts
  that ask for a change: the pilot showed the run delegating the edit to a
  subagent when it could not make it.

## Frozen

- Instrument: `claude plugin eval --scaffold`, model `claude-opus-5-5`,
  `--runs 3`, `--ablation none`, `--no-publish`, `--trust-plugin`,
  `--keep-temp`, `max_turns: 10`, through the subscription CLI. The artefact
  names the host version.
- Catalogue: `dist/agent-src/skills/` at the commit carrying this file; the
  artefact names its hash.
- **Pass rule, unchanged from the baseline grader:** the run called `Skill` with
  the unit's own name. A router skill that does not dispatch, a subagent, or a
  direct answer does not count.
- **Floor:** the registered rule over the original baseline —
  `docs/contracts/routing-assurance-floors.json`, 0.90 for each of the five,
  i.e. 3/3. Classified by `compile_trigger_evals --classify` against
  `routing-baseline-20261027.json`.
- No retries; an errored run is UNKNOWN and is not replaced.

## After the run

- A unit at 3/3 closes for this series. A unit below records the trace shape of
  its misses as its reason; the fixture is **not** edited in response — a
  changed fixture is a new version and needs a new contract.
- These rows become the fixture series' own baseline for later canaries. The
  old, unfixtured series stays as it is; neither replaces the other.
