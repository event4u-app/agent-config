# awesome-list submission — DRAFT (not yet submitted)

> Market-readiness roadmap B5. Submission copy for the community
> "awesome-claude-code" / "awesome-claude-code-subagents" lists. **Draft only** —
> submitting is a human act. Every line here is ledger-consistent: no unbacked
> number, no invented third-party comparison. Lead with the wedge, not the OS.

## Where to submit

Candidate lists (verify each is active + read its CONTRIBUTING before opening a PR):

- `awesome-claude-code` (skills / plugins / tooling)
- `awesome-claude-code-subagents` (the wedge fits here — a single subagent)

Track status in [`registry-submissions.md`](registry-submissions.md).

## Entry A — the wedge (lead with this)

**production-validator** — a read-only Claude Code subagent that runs the last
gate before "done": it hunts mocks, stubs, and placeholders on the shipped
(non-test) path and demands real-system evidence, returning a `READY` / `NOT
READY` verdict with `file:line` citations. One `curl` into `.claude/agents/`, no
other install, no runtime.

- Link: `https://github.com/event4u-app/agent-config/tree/main/docs/wedge/production-validator`
- One-liner (list-row form): `production-validator — the last-gate-before-done subagent: no mock/stub survives on the shipped path; install in one curl.`

## Entry B — the suite (secondary)

**event4u/agent-config** — a governed, no-runtime configuration layer for AI
coding agents: audited skills, review personas, rules, and commands projected
into 7+ hosts (Claude Code, Cursor, Windsurf, Copilot, …). Its distinguishing
discipline: **every public claim is machine-checked** — the README binds each
claim to resolvable evidence in a Claims-Ledger, and a generated proof page lets
anyone reproduce the checks (`docs/proof.md`). Bring your own model.

- Link: `https://github.com/event4u-app/agent-config`
- One-liner: `agent-config — governed skills/rules/personas for AI coding agents, with machine-checked claims and a reproducible proof page. No runtime, bring your own model.`

## Guardrails for whoever submits this

- Do **not** add a performance number or a "better than X" comparison — the
  suite's whole position is that claims are verifiable, so an unverifiable
  submission line would be self-defeating.
- Keep the wedge first: it is the low-friction door. The suite is the follow-on.
- Re-check the target list is still maintained + follow its exact entry format.
