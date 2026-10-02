# Standing instructions, per spawn and per session

<!-- evidence-type: analysis -->

> **Produced on** `main` @ `01b4a2219`, 2026-10-02, for step 1.6 of
> `road-to-rule-triggers-and-links-that-hold`. Three of the four figures below
> are reproducible anywhere in a checkout; the fourth is explicitly a reading
> of one maintainer machine and is marked as such.

## What the step asked, and what the answer turns on

The host loads the instruction hierarchy into **every non-built-in subagent**.
So the standing rule payload is not paid once per session — it is paid once per
session *plus* once per spawn, and nothing in this tree had recorded the second
multiplier next to the first.

The per-spawn figure is not a separate measurement. It is the **same** standing
payload, charged again, which is the whole point: there is no second, smaller
bundle for a subagent. What had to be measured is the **multiplier**, and that
is where the honest part of this report is.

## The four figures

| Reading | Value | Unit | Reproducible where |
|---|---:|---|---|
| projected rule corpus — the upper bound a host is handed | 485,282 | **bytes** | any checkout |
| the same, in bytes/4 tokens | 121,321 | tokens | any checkout |
| installed rule layer, this machine, all files | 375,874 | **bytes** (372,220 chars) | this machine only |
| installed rule layer, this machine, **files with no `paths:`** | **351,894** | **bytes** (348,446 chars) | this machine only |

**Bytes, not characters, and the distinction is small but real.** `wc -c` and
`report_standing_payload_by_host` both count bytes; the rule corpus is UTF-8
with enough em-dashes and typographic quotes to put characters about 1 % below
bytes. Every arithmetic below uses the byte figure consistently. The token
column inherits the same base, so it is a bytes/4 estimate rather than a
character/4 one — neither is the exact BPE count, which is a different
instrument (`check_rule_activation_census` has it).

The fourth row is the per-prompt and per-spawn number that matters. A rule
carrying a `paths:` block loads on a file match; a rule without one loads
unconditionally, so **102 of the 105 installed rule files are standing text**.
The gap between 485,282 and 375,874 is the two install-local filters —
user-scope dedup and workspace/pack scope — doing what they are for: every
narrowing moves a machine DOWN from the projection's upper bound, never up.

The first two rows come from
`./scripts-run src/scripts/report_standing_payload_by_host`, which reads the
projection source rather than any local tree, precisely so the number is not a
property of one disk.

## The multiplier, measured

Counting distinct `Agent` tool-use ids across every transcript this machine
holds for this project:

| Quantity | Value |
|---|---:|
| project transcript directories | 12 |
| transcript files | 741 |
| distinct subagent spawns | **647** |

So on this machine the spawn count is roughly **0.87 per transcript file** —
and since a transcript file is not quite a session (continuations and
compactions write their own), the honest statement is a ratio near 1:1 rather
than a precise per-session rate.

Taken against the fourth figure above, spawns add on the order of
**647 × 351,894 ≈ 228 million characters** of standing text against the
**741 × 351,894 ≈ 261 million** the session layer itself costs — i.e. spawning
roughly **doubles** the standing-instruction bill, and it does so invisibly,
because no spawn is ever shown the bundle it was charged for.

**This is one machine's history, not a rate anyone else should adopt.** It is
reported because the alternative was to state the per-spawn unit with no sense
of how often it is paid, and a unit with no multiplier is not a cost.

## Before and after the installed-layer flip

The step asks for the reading **before and after** the installed-layer flip.
The "after" column is empty, and that is a fact about the tree rather than an
omission here: the flip has not happened. The thinning work is held by its own
roadmap, which may not start before the carrier roadmap's Phase 1 has merged,
and that phase is open.

| | Session (characters) | Per spawn (characters) |
|---|---:|---:|
| before the flip (2026-10-02) | 351,894 | 351,894 |
| after the flip | — | — |

Re-run the two commands under **How to reproduce** at the flip commit and fill
the second row. The per-spawn column is not independently measurable: as long
as the host loads the hierarchy into every non-built-in subagent, it equals the
session column by construction, and the day that stops being true is the day
this table needs a third row rather than a second.

## What this does NOT say

- **Not that the payload is wasted.** A standing rule is standing because
  something decided it must survive compaction and arrive before the first
  edit. This report prices the decision; it does not second-guess it.
- **Not that a subagent reads it.** Delivery and consumption are different
  axes. A spawn handed 351,894 characters it never acts on costs exactly the
  same as one that acts on all of them.
- **Not a per-session rate for anyone else.** The 647 is this machine's
  history. A consumer who never spawns pays the session column alone.

## How to reproduce

```bash
./scripts-run src/scripts/report_standing_payload_by_host   # rows 1-2
ls ~/.claude/rules/*.md | wc -l                             # installed files
cat ~/.claude/rules/*.md | wc -c                            # row 3
cd ~/.claude/rules && grep -L '^paths:' *.md | tr '\n' '\0' | xargs -0 cat | wc -c   # row 4
```

The spawn count, from the transcript store:

```bash
cd ~/.claude/projects
find . -path '*agent-config*' -name '*.jsonl' \
  -exec grep -oh '"type":"tool_use","id":"[^"]*","name":"Agent"' {} + | sort -u | wc -l
```

Counting the bare `"name":"Agent"` instead returns 1,473 — continuations and
compactions replay the same tool-use block, so the deduplicated id count is the
one to read. Reporting the larger figure would have overstated the multiplier
by a factor of 2.3.
