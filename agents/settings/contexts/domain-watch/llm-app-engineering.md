# Watch note — LLM-app engineering vertical

**Status:** deferred, demand-gated (ecosystem harvest, 2026-07-12; council
2026-07-11 confirmed the gate).

## What was proposed

A net-new vertical for **building** LLM applications — RAG pipelines, embedding
models, vector-index / hybrid-search selection, fine-tuning, and model serving
(sources: a multi-harness marketplace and a CLI component-template catalog —
provenance encrypted in the ecosystem-harvest index). Two independent reviewers
flagged it as the single biggest net-new gap in the survey.

## Why deferred — the missing gate evidence

Opening it is a **category error**, and `domain-adoption-policy` Gate 1 (demand
signal) is not met:

- It is tooling for *building* an AI product (LangChain territory), not for
  *using* this suite inside an AI IDE — the suite's actual mission. RAG / chunk
  sizing / embedding-model choice / vector-index selection are out of mission.
- **No consumer project** ships an LLM feature through the suite today.
- **No named owner** for the vertical and **no CI decision** on how eval-fixture
  tooling would run in the pipeline.

The one in-mission slice was carved out and adopted instead: the black-box
[`evaluate-llm-feature`](../../../../src/skills/evaluate-llm-feature/SKILL.md)
skill (evaluate a *shipped* LLM feature, not build one).

## Re-open trigger — all three gates

Re-evaluate at the next harvest cycle only when ALL hold:

- **Demand:** ≥ 2 consumer projects shipping LLM features through the suite.
- **Owner:** a named maintainer owning the vertical.
- **CI decision:** an explicit call on eval-fixture tooling (fixtures-in-CI vs
  reference-only), per `domain-adoption-policy`.

Until then the vertical stays closed; do not relitigate wholesale adoption —
only the narrow black-box evaluator is in scope.
