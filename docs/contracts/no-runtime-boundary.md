# No-Runtime Boundary Contract

> **Audience:** Every Mission-Mode decision, skill author, and recipe reviewer.
> Read this before asking "is X allowed in a mission step?"

AC is a **file-first, no-runtime suite** — skills and missions emit text and
files; they do not spawn processes, own state stores, or poll the environment.
This contract makes that boundary explicit for the Mission-Mode layer.

See also: `lethal-trifecta-guard` (no private-data + untrusted-content +
external-comms in one autonomous path), and the internal agent-memory sunset
decision (cross-session persistent stores rejected as architecturally unsound
and violating the no-runtime principle).

---

## Allowed

| Category | Examples | Notes |
|---|---|---|
| **Codegen / file emit** | Write a migration file, emit a `UPGRADE.md` plan, produce a diff patch | The canonical mission output |
| **File I/O** | Read `composer.json`, write `.work-state.json`, append to a report | Single-invocation scope only |
| **Multi-turn prompting** | Agent asks user to run `php artisan migrate`, user pastes result back | Human stays in the loop; agent interprets the pasted output |
| **git-as-state** | `git commit -m "mission:upgrade step=11 status=ok"`, `git revert HEAD`, `git reset --soft HEAD~1` | AC shells out to git constantly — structured commit messages are logging, not a daemon; rollback is `git revert` / branch reset on a provisional `mission/…` branch |
| **Shell invocation (single-shot)** | `composer install`, `php artisan test --filter=…` run once per step and their output piped back | One-shot, result returned immediately; never a background job |
| **Report / plan files** | Write `agents/evidence/mission-upgrade-decision.md`, emit a breaking-change checklist | Authoring-time output, not a runtime artifact |

---

## Prohibited

| Category | Why |
|---|---|
| **Background processes / daemons** | No spawned subprocesses that outlive the current agent turn |
| **Cross-session persistent state stores** | No SQLite, pgvector, MCP memory servers, Redis, or any store that persists beyond the git working tree — agent-memory layer sunset applies here |
| **Event loops / polling** | No `while true; do …; done`, no `inotifywait`, no cron-inside-mission |
| **Auto-PR / auto-push** | Hard-Floor (`non-destructive-by-default`): missions never push to remote or open PRs autonomously; those gates require explicit user confirmation every turn |
| **Network egress from mission scripts** | Mission scripts may not initiate outbound HTTP calls; skills that need network access declare `allowed_tools` explicitly and go through the normal lethal-trifecta gate |

---

## Gray — requires council review before adopting

| Pattern | Risk | Gate |
|---|---|---|
| **Conditional branching on prior step outputs** | Missions could become implicit state machines, defeating the no-runtime constraint | Must be expressed as a skill decision tree with explicit LLM judgment — not a script `if`/`else`; council sign-off required per mission |
| **File-based state within a single invocation** | `.work-state.json` already exists and may gain a `mission_history` key — that is allowed; adding new control-flow primitives (loops, conditional keys that drive execution) is **not** | Extension of `.work-state.json` for logging is OK; adding execution-control semantics requires a new ADR |
| **Nested sub-missions** | Could create unbounded depth; Phase 1 PoC must first prove a flat sequence is sufficient | Defer until Phase 1 evidence shows a real need |

---

## Decision authority

A mission step that is unclear against this contract goes to the AI Council
(`python3 src/scripts/council_cli.py`) before any build work starts.
The council verdict becomes an ADR if it changes this table.
