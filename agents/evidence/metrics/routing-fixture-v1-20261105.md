<!-- evidence-type: analysis -->

# Fixture series v1 — the five carried units with their workspace, 2026-11-05

**Roadmap:** `road-to-routing-assurance-live-floors-carried` 1.3.
**Protocol:** `agents/evidence/preregistration/routing-fixture-series-v1-protocol-20261105.md`,
committed before the run.
**Rows:** `routing-fixture-v1-20261105.json` (the run), the two granted re-runs
`routing-fixture-v1-rsu-granted-20261105.json` and
`routing-fixture-v1-du-granted-20261105.json`, and
`routing-fixture-v1-classified-20261105.json` (`compile_trigger_evals --classify`
against `routing-baseline-20261027.json` and its floors).
Host **2.1.316**, `claude-opus-5-5`, today's catalogue (`e0ec68d3…`), three runs
per unit, through the subscription CLI. CLI estimates 5.49 + 0.62 + 0.75 USD.

## Result

| Unit | v1 | Classified | What the misses did |
|---|---|---|---|
| `dependency-upgrade` | 3/3 (granted re-run: 3/3) | PASSED | — |
| `wireframe` | 3/3 | PASSED | — |
| `type-design` | 0/3 | REGRESSION | read the SVG, delegated the font build to a subagent |
| `react-shadcn-ui` | 0/3 (granted re-run: 0/3) | REGRESSION | with Edit granted, edited `button.tsx` directly |
| `project-analysis-core` | 0/3 | REGRESSION | read the 20-file repository and answered directly |

The gate stays red for three units. Per the protocol, no fixture was changed in
response; each miss's trace shape is its recorded reason.

## Deviation, disclosed

The protocol declared Edit and Write for `react-shadcn-ui` and
`dependency-upgrade` through each case's `allowed_tools`. On this host that does
not grant them: both tools were absent from the run's tool list, and an operator
grant (`--allow-tools Edit Write`) is also required. The two units were re-run
once with that grant and nothing else changed. Both re-runs matched the first
run: `dependency-upgrade` 3/3, `react-shadcn-ui` 0/3. The classification above
reads the first run, and the re-runs leave it unchanged.

## `type-design` — sensitive to catalogue composition, not to one skill

In the pilot on the frozen catalogue, `type-design` fired 3/3. In this series,
on today's catalogue, it fired 0/3 with the same fixture and host. A discovery
ablation followed, outside the protocol and certifying nothing: the same case
at three runs each against variants of today's catalogue.

| Catalogue | Skills | Fired |
|---|---:|---|
| frozen baseline `1c967b17…` (pilot + re-check) | 301 | 6/6 |
| today `e0ec68d3…` | 303 | 0/3 |
| today minus the four skills added since the baseline | 299 | 3/3 |
| today minus `founder-idea-interview`, `mcp-tool-use` | 301 | 3/3 |
| today minus `code-film`, `code-review-lens` | 301 | 1/3 |
| today minus `founder-idea-interview` | 302 | 1/3 |
| today minus `mcp-tool-use` | 302 | 1/3 |

No single added skill explains the drop, and no run invoked any of them. The
listing's total name-and-description size is unchanged (58 074 vs 58 077
characters). The unit sits near a decision boundary that the catalogue's
composition moves. At three runs per cell, 1/3 and 3/3 are not sharply
separable, so the bisection stopped here instead of measuring noise.

## What this leaves for 1.3

| Unit | Cause, as far as measured | Disposition |
|---|---|---|
| `dependency-upgrade`, `wireframe` | the empty sandbox; noise | closed at 3/3 |
| `react-shadcn-ui` | the host makes a two-file edit itself, with or without the skill available | recorded reason: the prompt is a direct edit on this host |
| `project-analysis-core` | the host reads a small repository itself, whether it has 5 files or 20 | recorded reason: direct reading on this host |
| `type-design` | routing near a boundary that catalogue composition shifts | open: measure at a run count that separates 1/3 from 3/3 |
