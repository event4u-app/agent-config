"""Scoring helpers for prompt-driven execution.

The package owns deterministic, heuristic-based scorers that the
``refine`` step consults when ``input.kind="prompt"``. Splitting them
from the dispatcher keeps the rubric replaceable and easy to tune in
isolation: the dispatcher only reads the resulting band, never the
per-dimension breakdown.

R2 Phase 3 ships the first scorer (:mod:`work_engine.scoring.confidence`).
Future scorers (estimate-effort, risk-band, UI-readiness) plug in here
with the same shape — pure function in, immutable result out, no LLM
calls, no side effects.
"""
from __future__ import annotations
