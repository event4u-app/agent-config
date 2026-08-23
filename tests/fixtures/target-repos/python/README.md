# `python` fixture

A Python-primary target: `pyproject.toml` and no `composer.json` / `package.json`.

It carries a pytest config, a mutmut config and Hypothesis, so test presence and
test strength are genuinely detectable. What is NOT detectable is static analysis
and types, because `quality-tools` routes PHP and JS/TS only — and that dimension
is a knockout, so this fixture must grade `L0 — bound by static analysis & types`
with `not detectable — quality-tools has no Python mode` printed as the reason.

The distinction the fixture exists to pin: **`not detectable` is not `0`.** A `0`
would claim this project lacks static analysis. It may well have mypy; the tool
cannot tell, and saying so is the honest output.
