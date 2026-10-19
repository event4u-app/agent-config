<!-- evidence-type: analysis -->

# Global entries stay in the consumer lock; their absolute `files[]` do not

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `global-entries-consumer-lock-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (b′), 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(b′)** | no |
| `openai` | **(b′)** ("Agree with (b′), with conditions") | not stated; names no human action |

Both seats: `sync` reads `name`, `scope` and `bridge_marker` and never
`files[]`, and the user-scoped ledger now owns the machine-local paths and
digests, so the absolute global `files[]` in a committed team file cost a
`$HOME` leak and serve no reader. (a) breaks the documented team workflow, (b)
breaks global replay for a new team member, (c) keeps the leak.

**Conditions, both seats.** The `validate` gate and the lock's documented
schema accept a global-scope entry without absolute paths. `openai` adds: state
whether `files` is omitted, empty or replaced by portable identifiers; audit
every reader of the lock (validate, uninstall, migration, drift checks), not
only `sync`; handle existing committed global entries that carry absolute
paths; tests that a global `init` writes no home path into the project lock,
that `sync` still replays global entries, that the ledger keeps paths and
digests, and that project-scope entries keep their file data.
