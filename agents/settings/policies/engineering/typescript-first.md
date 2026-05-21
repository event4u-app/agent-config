# Engineering Policy — TypeScript-First

## Iron Law

```
NEW CLI ENTRY POINTS, INTERNAL TOOLS, AND LOGIC-CARRYING MODULES IN THIS
PACKAGE LAND IN TYPESCRIPT BY DEFAULT. PYTHON IS RESERVED FOR EXISTING
TOOLING (THE WORK ENGINE HARNESS, COMPRESSION/LINT SCRIPTS WIRED INTO
TASKFILE) UNTIL EACH IS PORTED ON ITS OWN ROADMAP.
```

Scope: `event4u/agent-config` only. Downstream consumer projects pick their own stack.

## Triggers

The agent consults this policy when any of the following fires:

- A new CLI subcommand or script is requested — covers the `agent-config.ts` TS shell, `scripts/_cli/cmd_*.py` candidates, and anything that would otherwise produce a fresh `bin/*` entry point.
- A skill, command, or rule asks for "a bridge script", "a helper", or "an executable" without naming the stack.
- An existing Python module needs non-trivial changes that would otherwise extend its surface — pause and consider porting first.
- A roadmap step lands logic that is also reachable from the wizard server (`src/server/**`) — the two surfaces share Zod schemas and IO modules, so duplicating in Python is a category error.

## Required when proposing TypeScript

- Reuse the established TS layout — entry under `src/cli/agent-config.ts`, subcommands under `src/cli/commands/*.ts`, shared IO via `src/server/io/*.ts`, schemas via `src/shared/schemas/*.ts`.
- Strict mode honored — `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` already enforced; new code passes `npm run typecheck` + `npm run lint:ts` before commit.
- Atomic-write helpers reused — `src/server/io/atomicWrite.ts`, never a hand-rolled `fs.writeFileSync` for settings or memory files.
- Tests colocated under `tests/` matching the existing Vitest / Pest split (TS units → Vitest, integration parity → existing harness).

## Forbidden

- Adding a new Python CLI command under `scripts/_cli/cmd_*.py` when the equivalent TS surface is available — the wizard server, settings IO, atomic writes, and Zod schemas already exist in TS.
- Building IPC / HTTP bridges (sentinels, discovery files, bearer tokens) for the Chat ↔ CLI path when both sides run on the host — reserved for the Browser ↔ Server path where the network boundary is real.
- Silent stack drift — a "small Python wrapper" added because a TS port is "too much work" without an ADR or council note.

## Allowed (Python stays)

- The `work_engine` harness (`scripts/work_engine/**`) and its callers — production-grade Python with an established contract; port only on its own roadmap.
- Compression, linting, and skill-validation scripts wired into `Taskfile.yml` (`task lint-skills`, `task sync`, `task generate-tools`, `task lint-rule-budget`) — port opportunistically, never as a side-quest.
- Pest / pytest test harnesses for existing Python surfaces.
- One-shot maintenance scripts that never ship to consumers.

## Refusal / decision path

When a request would land new logic in Python:

1. Surface this file path (`agents/settings/policies/engineering/typescript-first.md`).
2. Name the equivalent TS surface (CLI subcommand, server route, IO helper) or confirm none exists.
3. Emit **one** clarifying question per [`ask-when-uncertain`](../../../.augment/rules/ask-when-uncertain.md) — typically: *"This would add a new Python entry point. The TS equivalent would be `<surface>`. Proceed in (a) TypeScript, (b) Python with an ADR note, or (c) skip?"*
4. Record the decision in the session transcript or roadmap step.

## Enforcement model

LLM-readable decision framework, consistent with `agents/settings/policies/media/README.md § Enforcement model`. No runtime gate; the agent reads the policy when its triggers fire and surfaces it before the diff lands. CI is not asked to classify "is this logic-carrying?" — that judgment stays in the session.

## See also

- [`docs/decisions/ADR-012-typescript-cli-shell.md`](../../../docs/decisions/ADR-012-typescript-cli-shell.md) — the architectural anchor for the TS CLI shell.
- [`agents/roadmaps/archive/onboard-skill-wizard-convergence.md`](../../roadmaps/archive/onboard-skill-wizard-convergence.md) — first roadmap to apply the policy (chat `/onboard` runs against the TS subcommand, not a Python bridge).
- [`.augment/rules/scope-control.md`](../../../.augment/rules/scope-control.md) — scope gate that pairs with this policy when a port is considered.
- [`.augment/rules/minimal-safe-diff.md`](../../../.augment/rules/minimal-safe-diff.md) — keeps the policy from turning into an opportunistic rewrite mandate.
