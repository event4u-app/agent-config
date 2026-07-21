# production-validator — the 30-second Claude Code subagent

A single, self-contained Claude Code subagent that runs the **last gate before
"done"**: it audits that no mock, stub, fake, `TODO`, or placeholder remains on
your shipped code, and that the change was actually exercised against a real
system — not just green tests over hollow code.

One file. No install of anything else. No runtime, no daemon, no account.

<!-- claim:wedge-hollow-detection -->On its published eval it returned the
correct verdict on both fixtures — `NOT READY` with the exact `file:line` on a
planted hollow implementation, `READY` with zero spurious findings on the clean
control — at ~45k fewer tokens per task than the same check run inline
([evidence](../../../internal/bench/orchestration/pv-a3-results.md)). Two
planted fixtures on a Claude Code host — a scoped, reproducible promise, not a
hit-rate.<!-- /claim -->

## What it does

Before you call a feature done, `@production-validator` greps the shipped path
(excluding tests/mocks) for hollow implementations, checks that each "done"
claim has real-system evidence, and returns a `READY` / `NOT READY` verdict with
`file:line` citations. It reads and runs; it never modifies your code.

## Install (30 seconds)

Drop the one file into your repo's project-level agents directory:

```bash
mkdir -p .claude/agents
curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/production-validator.md \
  -o .claude/agents/production-validator.md
```

Or copy [`production-validator.md`](production-validator.md) into
`.claude/agents/` by hand. That's the whole install.

## Use

In Claude Code, ask for it explicitly or let it auto-delegate before you ship:

```text
@production-validator check this branch is actually done
```

Example output:

```text
production-validator
  blocker  src/payments/refund.ts:42 — refund() returns a hard-coded {ok:true};
           no call to the payment provider on the shipped path.
  must-fix src/payments/refund.test.ts mocks the provider; no integration run
           exercises the real API.
  Final gate: NOT READY — refund() is a stub; validate against the real provider.
```

## Optional: record your first run (local-only, opt-in)

Nothing is measured unless you run it. After your first verdict, you can keep a
private local record — one aggregate line, written into YOUR repo, no network:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/event4u-app/agent-config/main/docs/wedge/production-validator/first-run-check.sh) ready
```

Outcomes: `ready` · `not-ready` · `abandoned`. The log
(`.claude/wedge-first-run.local.log`) never leaves your machine — the package
runs zero telemetry by default
([contract](../../contracts/adoption-signal-floor.md)). The same outcome
vocabulary feeds the proctored install-friction study
(`agents/recruit-sessions/_install-friction-runbook.md`).

## Why this one

It carries an anti-hallucination discipline (Evidence-First): "done" is a claim
until the real path is shown to run. It is read-only and single-purpose, so it is
safe to try on any repo in one command.

Part of [`event4u/agent-config`](../../../README.md) — a governed skill / rule /
persona layer for AI coding agents. This subagent is the standalone wedge; the
full suite adds the router, orchestration, and governance around it.
