<!-- evidence-type: analysis -->

# Which completeness skills owe: reach, and declared skills are kept

**Date:** 2026-10-18 · **Members:** `anthropic` (claude-sonnet-4-5), `openai` (codex-default)
**Mode:** prompt, one round · **Cost:** $0.00 (subscription transport, nothing billed)
**Quorum:** 2/2 · **Prompt:** `completeness-skills-owe-20261018.question.md`, beside this file
**Authority:** the owner's delegation of 2026-10-18 ("versuche die offenen entscheidungen im ai council zu lösen")

## Verdict — (b) reach, and 6.3 keep-declared, 2/2

| Seat | Choice | Owner-only |
|---|---|---|
| `anthropic` | **(b)** ; 6.3 **keep-declared** | no |
| `openai` | **(b)** ; 6.3 **keep-declared** ("choose reach and retain declared dependencies") | not stated; names no human action |

Both seats read the measured host truncation as ruling out (a), and (c) as
turning a broken dependency graph into the specification. On 6.3 both held
that pruning working commands to match the skill inventory inverts the
dependency; keeping the 13 declared skills (about 229 → 242 of 300) is bounded.

**Conditions both seats attached.** The promise needs an operational definition
before it is published as met: supported hosts, what "one deterministic step"
is, version selection, offline and failure behaviour, preserved semantics.
`openai` replaced the drafted README sentence with a stricter one —
"On supported hosts, every packaged skill is either installed locally or
retrievable by its canonical name in one deterministic operation. Retrieval
returns the skill from the installed package version and fails explicitly if
that exact skill cannot be supplied." — `anthropic` accepted the draft. ADR-289
records the stricter wording as the contract text, and `README.md:59` cites the
ADR without claiming the contract is met today: 71 skills are still unreachable
without the MCP server, so stating it as achieved would be a doc claim the code
contradicts. `openai` also asked that `projection.mode` not be removed before the
reach mechanism and its tests exist.

## Run history, stated because there were two

A first run of this prompt used the `analysis` prompt mode. That mode frames
the input as an analysis report to critique, and the `openai` seat answered in
that frame — a findings table, no choice — so the run produced no verdict on
the question, not an unwelcome one. It also lost the prompt's first line to the
neutrality filter, which drops lines naming a host agent. The prompt's first
line was reworded and the question re-run once in `prompt` mode; the seven
other questions of this sweep ran in `prompt` mode only. The first run's
`openai` substance (reach is under-specified as a public promise; dependency
closure is immediately actionable) is the same as its second answer.
