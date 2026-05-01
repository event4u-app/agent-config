# ADR — Context-Aware Command Suggestion

> **Status:** Decided · Phases 1–7 shipped · 2026-04-30
> **Roadmap:** [`road-to-context-aware-command-suggestion.md`](../roadmaps/road-to-context-aware-command-suggestion.md)
> **Rule:** [`command-suggestion`](../../.agent-src.uncompressed/rules/command-suggestion.md)
> **Eligibility table:** [`command-suggestion-eligibility.md`](command-suggestion-eligibility.md)
> **Engine:** `scripts/command_suggester/`
> **Orthogonal to:** R1 (`adr-work-engine-rename.md`) — the suggester is a
> read-only shortcut *finder*; it never invokes a command. Engine boundaries
> stay intact.

## Decision

Add a **deterministic, read-only** suggestion layer that scans every
non-`/`-prefixed user turn against eligible command frontmatter
(`suggestion.trigger_description` + `trigger_context`) and surfaces matches
as a **numbered-options block** with the user-interaction Iron Law shape:

- N command options, neutral labels (no inline `(recommended)` tag).
- Always-last "Just run the prompt as-is, no command" escape hatch.
- Exactly one `**Recommendation: K — /command**` line, omitted when the
  top two scores are within `0.05` of each other.

The suggester **never executes** anything — option-N is what triggers the
standard slash-command flow on the next turn (with all per-command halts
intact). The user picks every time.

## Why this was a real question

A maintainer who types "Setze Ticket ABC-123 um" got a generic
implementation walk-through, not the `/implement-ticket` engine. The
package owns 75 commands; the agent has the list in context but no
contract telling it "when the prompt looks like *this*, offer *that*
command". Three forces converged:

1. **Discoverability gap.** Users learn `/command` only when documented;
   most never type it.
2. **Safety anchor.** Auto-execution is non-negotiably out (`scope-control`,
   per-command halts). Anything we ship cannot weaken that floor.
3. **Determinism.** ML-based intent detection is non-replayable; goldens
   would drift. Pattern + keyword matching keeps GT-CS replays byte-stable.

Three alternatives were rejected:

- **Auto-route to commands** (bypass the user). Rejected: violates the
  "user always picks" anchor; one wrong route inside `/implement-ticket`
  is a multi-hour blast radius.
- **Trigger-based command auto-prefix** (silently rewrite the prompt
  to `/command <prompt>`). Rejected: same anchor breach, plus the user
  loses the "skip" option.
- **LLM intent classifier**. Rejected: non-deterministic, untestable in
  the GT-CS harness, and the eligibility table is small enough that
  pattern matching reaches the same precision at zero cost.

## Eligibility rubric

A command is **eligible** (default `true`) unless:

- Invocation is **intentional-only** (`/onboard`, `/package-reset`,
  `/mode`, `/agent-handoff`, `/chat-history-clear`).
- Triggers would overlap so heavily with normal prose that the floor +
  cooldown can't suppress the noise.
- The command has no natural-language signal distinct from neighbours.

The locked table is
[`command-suggestion-eligibility.md`](command-suggestion-eligibility.md).
Eligibility changes are roadmap follow-ups, not drive-by edits.

## Anti-noise heuristics

`rank.py` drops matches that fail any of:

- Score below `confidence_floor` (default `0.6`; per-command override
  via frontmatter).
- Single match within `floor + 0.1` of the floor and no structural
  bonus (high uncertainty isn't worth interrupting).
- Short prompt (< 6 words) hitting > 2 commands without a structural
  bonus (too vague to disambiguate).
- Pure continuation phrase (`ok`, `weiter`, `mach weiter`, `go on`,
  `continue`) with no structural bonus.
- Same `(command, evidence)` pair shown within `cooldown_seconds`
  (default `600`, per-command override).

Structural bonuses (ticket key, file path, branch shape) override
suppression when they signal real intent.

## Hardening — what suggestion must never do

The rule (`.agent-src.uncompressed/rules/command-suggestion.md`)
binds the engine to five non-negotiables, mirrored as goldens:

1. **No execution without user pick.** `SUGGEST. NEVER INVOKE.` is the
   first Iron Law in the rule.
2. **No multi-question stacks.** Clarification (`ask-when-uncertain`)
   wins; suggestion stays silent that turn.
3. **No conversation hijack.** `enabled: false`, no matches above floor,
   or a senior rule active → zero output.
4. **No echo-trigger.** `sanitize.py` strips fenced/inline code and the
   engine's own previous block shape (`> N. /command — …`,
   `**Recommendation: N — …**`) before scoring.
5. **Hard subordination.** `scope-control`, `ask-when-uncertain`,
   `verify-before-complete`, and any active role-mode contract outrank
   suggestion.

GT-CS1 through GT-CS9 (`tests/test_command_suggester_goldens.py`) lock
the contract end-to-end.

## Three opt-out paths

| Path | Mechanism | Scope |
|---|---|---|
| Global | `commands.suggestion.enabled: false` in `.agent-settings.yml` | Whole project |
| Per-command | `commands.suggestion.blocklist: [/cmd]` | Specific command stays as-is |
| Per-conversation | `/command-suggestion-off` directive | Until user re-enables or chat ends |

All three are deterministic and tested. `/command-suggestion-on`
re-enables mid-conversation.

## Consequences

**Positive.** The maintainer's intent surfaces commands they didn't
remember to type. Anti-noise heuristics keep the layer near-silent on
prose. Goldens replay byte-stable; GT-CS9 covers adversarial echo.

**Negative.** A new always-on rule adds context budget — kept under
size budget by the size-enforcement rule. Per-command frontmatter now
carries `suggestion.*` keys; the linter enforces them so drift is
caught early.

**Open.** Trigger drift over time — a command's
`trigger_description` gets stale as conventions move. Mitigation: the
artefact-engagement telemetry pipeline (default-off) measures
suggestion pick-rate per command, surfacing weak triggers as
retirement candidates without a hard SLA.

## See also

- [`command-suggestion`](../../.agent-src.uncompressed/rules/command-suggestion.md) — runtime rule
- [`command-suggestion-eligibility.md`](command-suggestion-eligibility.md) — locked eligibility table
- [`road-to-context-aware-command-suggestion.md`](../roadmaps/road-to-context-aware-command-suggestion.md) — phased delivery
- [`adr-prompt-driven-execution.md`](adr-prompt-driven-execution.md) — `/work` entrypoint that explicit slash invocations route to
- [`agent-settings`](../../.agent-src.uncompressed/templates/agent-settings.md) — `commands.suggestion.*` reference
