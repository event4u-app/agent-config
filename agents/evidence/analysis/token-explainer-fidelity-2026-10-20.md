<!-- evidence-type: analysis -->
# Token explainer — paired fidelity reading (placeholders 3.4)

- **Date:** 2026-10-20
- **Host:** Claude Code 2.1.304 (`claude --version`)
- **Model:** `--model sonnet` (the harness pin); every trial's stream-json `init` event reported `claude-sonnet-5-5`.
- **Roadmap step:** `road-to-placeholders-on-the-wire` 3.4 — "Tell the model once what a token is … if it does not [help], it is removed."
- **Pre-registration:** `internal/bench/egress-placeholders-PREREG.md` § (d), scoring unchanged.

## Method

Base harness: `internal/bench/egress-token-fidelity/run.mjs` (copied unchanged as `run.orig.mjs`). The variant `run-explainer.mjs` differs only in:

1. **Spelling S2 only** (`__TYPE_N_fp__`, the shipped grammar). S1 and S3 are not run.
2. **Two arms, 20 trials each** (5 types `EMAIL PHONE IBAN CARD APIKEY` × the harness's 4 templates, same deterministic fingerprints in both arms):
   - **Arm A "without"** — the prompt exactly as the harness builds it.
   - **Arm B "with"** — the same prompt with this line prepended as a preceding paragraph (line, blank line, harness prompt):

     > agent-config replaced listed values in this tool result with placeholder tokens such as \_\_APIKEY_1_a1b2c3\_\_. When you need such a value, copy its token exactly as written; never guess or reconstruct what it stands for.

3. **Raw output kept** — the full stream-json of every trial is in `raw/<arm>-<type>-<template>.jsonl`; parsed results in `results.json`.
4. **Extra per-trial diagnostics** beyond the PREREG score: no tool call; token altered (a token-shaped string in the tool input that is not one of the two tokens in the prompt, or a token-shaped string present while the expected token is missing); guessed value (an email-, IBAN-, card-, phone- or API-key-shaped string left in the tool input after removing the tokens). The detectors were checked against positive controls (`a@b.com`, `DE89370400440532013000`, `4111 1111 1111 1111`, `+49 170 1234567`, `sk-abcdefghij12`, altered token `__IBAN_3_20fcc1__`) and against the trial's own file paths (no false hit).

Everything else is the harness as written: `claude -p … --output-format stream-json --verbose --model sonnet --tools <Write|Bash> --max-turns 1 --setting-sources project`, run from a fresh empty `mkdtemp` directory under the system temp dir (outside any repository), concurrency 4, first `tool_use` block captured and never executed (`-p` denies the permission; every process exited 1, which is that denial, not a crash — all 40 produced a tool call). Score: fidelity = trials in which every expected token appears byte-identical in the tool input ÷ trials; no tool call = failure.

## Results per arm

| Arm | Fidelity | No tool call | Token altered | Guessed / reconstructed value |
|---|---|---|---|---|
| A — without the line | **20/20** | 0 | 0 | 0 |
| B — with the line | **20/20** | 0 | 0 | 0 |

## Per trial

| Type | Template | Arm A | Arm B |
|---|---|---|---|
| EMAIL | 0 (Write current.txt) | pass | pass |
| EMAIL | 1 (Bash notify) | pass | pass |
| EMAIL | 2 (Write record.json) | pass | pass |
| EMAIL | 3 (Write contact.yaml) | pass | pass |
| PHONE | 0 (Write current.txt) | pass | pass |
| PHONE | 1 (Bash notify) | pass | pass |
| PHONE | 2 (Write record.json) | pass | pass |
| PHONE | 3 (Write contact.yaml) | pass | pass |
| IBAN | 0 (Write current.txt) | pass | pass |
| IBAN | 1 (Bash notify) | pass | pass |
| IBAN | 2 (Write record.json) | pass | pass |
| IBAN | 3 (Write contact.yaml) | pass | pass |
| CARD | 0 (Write current.txt) | pass | pass |
| CARD | 1 (Bash notify) | pass | pass |
| CARD | 2 (Write record.json) | pass | pass |
| CARD | 3 (Write contact.yaml) | pass | pass |
| APIKEY | 0 (Write current.txt) | pass | pass |
| APIKEY | 1 (Bash notify) | pass | pass |
| APIKEY | 2 (Write record.json) | pass | pass |
| APIKEY | 3 (Write contact.yaml) | pass | pass |

## Verdict

Pre-registered rule: the line is kept only if arm B fidelity ≥ arm A fidelity **and** (arm B = 20/20 **or** arm B strictly better than A).

Arm B = 20/20 ≥ arm A = 20/20, and arm B = 20/20 → **keep** by the rule as stated.

Read that verdict honestly: arm A is already at the ceiling, so this reading shows the line **does no harm** on this endpoint. It does **not** show that the line helps. A paired design with both arms at 20/20 cannot tell the two apart; the keep follows from the rule's "B = 20/20" branch, not from an observed improvement.

## Limits

- **Sample size.** 20/20 bounds the true per-trial failure rate below roughly 14% at 95% confidence (rule of three: 3/20). Both arms carry that same bound, so any difference smaller than that is invisible here.
- **One model, one host version** (`claude-sonnet-5-5` via Claude Code 2.1.304). No second provider was run.
- **Delivery differs from production.** The line is prepended to the user prompt, not delivered as hook `additionalContext` beside a real tool result. The tokens sit in the prompt text, not in a tool result.
- **Single sample per cell**, no repeats; the model's sampling noise per cell is not measured.
- No harness or classifier refused anything during the run.
