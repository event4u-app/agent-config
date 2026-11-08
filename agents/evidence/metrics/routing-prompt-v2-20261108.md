<!-- evidence-type: analysis -->

# Prompt series v2: the two carried units on realistic requests, 2026-11-08

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.

**Protocol:** `agents/evidence/preregistration/routing-prompt-series-v2-protocol-20261108.md`. It was committed (`794dc058b4`) before any run. A fresh session that did not author the direct-output assessment wrote it, together with the prompts and fixtures. This session ran the measurement and wrote nothing the contract froze.

**Rows:**
- `routing-prompt-v2-rsu-20261108.json` and `routing-prompt-v2-pac-20261108.json`, ingested by `compile_trigger_evals --ingest`.
- `…-classified-20261108.json`, from `compile_trigger_evals --classify` against `routing-baseline-20261027.json` and `docs/contracts/routing-assurance-floors.json`.

**Run conditions:**
- Host **2.1.316**, `claude-opus-5-5`, catalogue `828f2e07…` (the hash the contract froze).
- Three runs per case, no retries, no errored run.
- Run through the subscription CLI, with CLI estimates of 3.49 + 1.66 USD.

## Result

| Unit | Case | Passed | What every run did instead |
|---|---|---|---|
| `react-shadcn-ui` | `rsu-v2-add` | 0/3 | read the app, wrote the dialog and edited the page itself |
| `react-shadcn-ui` | `rsu-v2-compose` | 0/3 | read the app, wrote the table and menu components itself |
| `react-shadcn-ui` | `rsu-v2-polish` | 0/3 | read the section and edited it itself |
| `project-analysis-core` | `pac-v2-onboard` | 0/3 | read 20 files and answered directly |
| `project-analysis-core` | `pac-v2-versions` | 0/3 | read 20 files and answered directly |

Both units are classified **REGRESSION**: 0/9 and 0/6 against a floor of 0.90. No run called `Skill`, delegated to a subagent, or asked for material. Per run, from the kept traces:

| Case | Tools used, per run |
|---|---|
| `rsu-v2-add` | Read 6–8 · Glob · Grep · Write 1 · Edit 4–6 |
| `rsu-v2-compose` | Read 8–10 · Glob · Write 5 · Edit 3–6 |
| `rsu-v2-polish` | Read 3–4 · Glob · Grep · Edit 3–4 |
| `pac-v2-onboard` | Read 20 · Glob (one run: Grep) |
| `pac-v2-versions` | Read 20 · Glob |

## Deviation, disclosed

The contract named two invocations by `--tag skill:<unit>`. The compiled cases carry no tags, so `--tag` would have selected nothing. Instead the five cases ran from two copies of the compiled plugin root: the three `react-shadcn-ui` cases with `--allow-tools Edit Write`, and the two `project-analysis-core` cases without it. Cases, prompts, fixtures, flags and run counts are unchanged.

**Where the cases live, changed after the run.** The contract added the five cases to `src/skills/<unit>/evals/triggers.json`, and the run compiled them from there. Published records pin that corpus by hash: the holdout `SET-SHA256`, the routing-signal 5.1 verdict and the delivery-set 6.4 record. CI showed all three failing to reproduce, so the cases moved to `internal/bench/trigger-fixtures/series-v2/cases.json` with the same ids, prompts and fixtures. The measurement above is unchanged. A re-run compiles them from a scratch skills root via `--skills`, matching cases by id.

## Reading

Three series now agree:
- the unfixtured canary;
- fixture series v1;
- this v2 series of realistic requests written by an independent author.

On this host the two units' requests are handled directly. Neither the prompt wording nor the workspace changed that. The direct-output assessment (`routing-direct-output-assessment-20261108.md`) found that the direct handling falls short of what each skill states. The gap is therefore real, and prompt or fixture changes have not closed it. Per the contract, no prompt or fixture is edited in response. A changed prompt would be a v3 and needs a new contract.

What remains for 1.3 is a disposition that prompt series cannot provide. This report does not choose one.
