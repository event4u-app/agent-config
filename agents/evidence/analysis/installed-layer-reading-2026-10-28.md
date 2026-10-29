<!-- evidence-type: analysis -->
# The installed layer on a maintainer machine, read 2026-10-28

Evidence for Phase 6 of `road-to-an-installed-layer-that-is-thinned` (round
`inbox-2026-10-bg`). It is deliberately **not** named `installed-arrival-*`: every
session below loaded the FULL layer, and the `default-flip-of-the-installed-layer`
blocker reserves that name for an arrival record of a thinned layer.

## Readings

| Reading | Value | Command |
|---|---|---|
| Files under `~/.claude/rules` | 106 | `ls ~/.claude/rules \| wc -l` |
| Bytes under `~/.claude/rules` | 367,904 | `cat ~/.claude/rules/*.md \| wc -c` |
| Characters the report counts for `claude-code` | 353,151 (all package-owned) | `./scripts-run src/scripts/installed_layer_report` |
| Against the combined limit, 1M window | 235.4 % of 150,000 | same |
| Against the combined limit, 200K window | 294.3 % of 120,000 | same, after Phase 6 step 6.1 |
| Sessions in the arrival report | 10, host version 2.1.312, all `visible`, dispatcher reached | `./scripts-run src/scripts/arrival_report` |
| User-layer rules loaded at session start | 104 in every session; 0 declaring `paths:` | same |
| Shadow layer-form decision | `claude-code would-be: full (delivery-unobserved)`; last arrival record on host 2.1.312, `visible`; layer on disk `full` | `agent-config doctor --check layer-form` |

The total has grown since round `inbox-2026-10-c` reproduced the notice at
338,225 characters, and the arrival instrument now produces real sessions on the
current host version. So of the decision's inputs for `claude-code`, the arrival
record is present and visible; the one input reading negative is
`delivery-unobserved`, which `deliveryObservedFor` derives from the behavioural
effect state (`src/scripts/_lib/layer_form_decision.ts`, the docstring calling it
"stricter than the step's wording, deliberately").

## The host's published figures, read 2026-10-28

From the host's memory documentation, the section on the per-file limit:

- per-file limit for on-demand files: 40,000 characters on a 200K window;
  150,000 on a 1M window for models after the 4.6 generation, 200,000 for the
  4.6 generation;
- that limit truncates an on-demand file (the model receives the start and a
  pointer to read the rest) and applies to on-demand files since host 2.1.309;
- `paths` is the only frontmatter field the host reads from a rule; frontmatter
  is removed before loading; a rule without `paths` loads at launch;
- the combined limit fires a startup **warning**; its value is not stated there.

The combined figure per window (120,000 / 150,000) is therefore recorded as
`reported`, not `vendor-published`, in `src/config/host-instruction-limits.json`.

## What this does not show

It does not show that a thinned layer would arrive, nor anything about the
behavioural effect of hook-delivered bodies. One machine, one host version.
