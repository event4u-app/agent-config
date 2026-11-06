<!-- evidence-type: analysis -->

# Council review — wiring the code graph's review checks into the self-review gate (AC-8), 2026-11-06

Five rounds, two seats (anthropic, openai), design lens, invoked as owner-directed council
use. The prompt of every round is committed beside this file
(`graph-checks-self-review*-20261106.question.md`); each carries the full diff it reviewed.

| Round | anthropic | openai | What it turned on |
|---|---|---|---|
| 1 | refused (implicit) | refused | graph work outside the `try`, static graph imports in the gate, exhibits naming `HEAD` while quoting the working tree, no gate-level tests |
| 2 | confirmed-non-expanding, with required changes | refused | no hard kill on timeout, unvalidated child output, unbounded rows, no off switch |
| 3 | refused | refused | `check` coercion, normalisation before truncation, exhibits unbounded, no conclusion-level test, execution context unstated |
| 4 | refused | refused | the shared reporting path: graph rows entering the model's artifact, ingestion and PR comment; control characters and forged comment markers; write failures |
| 5 | refused | refused | optional graph work still on the gate's required completion path (latency, parse and write bounds, sidecar as a consumer boundary, marker reconstruction across a single-pass strip, a CLI flag parser reading `argv[0]` when a flag is absent) |

Round 5 moved the graph step after the model review was written, posted and decided, into its
own artifact and summary section. Both seats still refused; openai named the alternative it
would accept — a separate, non-required reporting job — which is a change to what AC-8 asks
("the self-review gate consumes the three checks"), not an implementation of it.

**Disposition.** The wiring is withdrawn from this change; the gate is untouched. AC-8 stays
open. Narrowing it to "a separate, non-required job reports the checks beside the gate" weakens
a recorded criterion, which is the owner's decision, not the council's or the agent's.
