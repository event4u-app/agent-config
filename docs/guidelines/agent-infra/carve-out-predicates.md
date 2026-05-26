# Decidable Carve-Out Predicates

Companion to [`frugality-charter`](../../../.agent-src.uncondensed/contexts/contracts/frugality-charter.md). Each carve-out below carries a one-sentence test. If the test cannot be answered yes/no from the artifact alone, the carve-out does not fire and default-terse rules apply.

## Predicates

- **Iron-Law literal** — the prose is an ALL-CAPS fenced block inside a rule whose title appears in [`docs/contracts/kernel-membership.md`](../../contracts/kernel-membership.md).

- **Numbered-options with genuine trade-off** — the options differ in consequence (a chosen path produces a measurably different artifact or state), not in sequencing or output format. Per [`no-cheap-questions § What counts as cheap`](../../../.agent-src.uncondensed/rules/no-cheap-questions.md#what-counts-as-cheap).

- **Security-sensitive prompt** — the prompt requires credential input OR modifies auth / tenant / secret state, matching a trigger in [`security-sensitive-stop`](../../../.agent-src.uncondensed/rules/security-sensitive-stop.md).

- **Structured CLI contract** — the script's stdout is consumed by another script (a downstream parser exists under `scripts/` or `.augment/scripts/`), so the format is part of an interface contract, not narration.

## How to use

Writer skills (`skill-writing`, `rule-writing`, `command-writing`, `guideline-writing`, `context-authoring`, `agent-docs-writing`, `conventional-commits-writing`, `readme-writing`, `readme-writing-package`, `adr-create`, `persona-writing`, `roadmap-writing`) cite this file when an artifact's pre-save check needs a decidable test for a carve-out exception. The default is **terse** — predicates here only fire when the artifact provides the yes/no evidence.
