---
model_tier: high
name: judge-bracket
pack: engineering-base
visibility: internal
cluster: judge
sub: bracket
skills: [subagent-orchestration]
description: Run a resumable bracket of competing solutions whose losses can be appealed — AC sizes it (default 10), the script scores, a paid seat plays the second-chance card
argument-hint: "[task | --tier S1..S4 | --n N]"
suggestion:
  eligible: false
  rationale: "Spend-bearing fan-out; explicit invocation only, or offered once after dissatisfaction."
workspaces:
  - agent-config-maintainer
packs:
  - meta
---

# /judge bracket

The bracket route of `do-competitively`: several lines solve the **same** task,
meet in pairwise matches, and a lost match can be appealed. Driven by one state
file, so it survives compaction — the driver always names the one action that is due.

## Instructions

### 1. Plan, and show the plan

```bash
./scripts-run src/scripts/bracket/cli plan [--tier S1] [--agent-tier S2] \
  [--security-surface "<row>"] [--owner-reserved "<row>"] \
  [--content public-artifact|project-content] [--local-proven]
```

The plan line names the tier, its signal, the line ceiling, the call ceiling
(`6N − 5` before appeals) and the free-seat line. Rules the driver enforces:

- **Default S1 = 10 lines.** S2 = 20, S3 ≤ 64, S4 = 100.
- **You may lower freely and raise to S2 on your own reading.** Above S2 only a
  deterministic signal (a security-surface row the changed paths hit, an
  owner-reserved transition) or the user's own words count. A refused raise is
  printed — say it, never work around it.
- **S3 and S4 ask once** with the plan before anything is spawned. An offered
  bracket (after "wrong", "try again", or ladder rungs 7–10) asks once at any tier.
- **S4 prepares an owner decision; the owner signs it.** Never apply it.
- **Free seats only where the content allows:** a public artifact may fill up to
  half the lines and 4 of 5 jury seats from free routes; project content only with
  proven local weights; otherwise 0, and the plan line says so. A free route that
  answers 402 is `NO OUTPUT`, never a silent paid fallback.

### 2. Initialise and generate

```bash
./scripts-run src/scripts/bracket/cli init --run <id> --task <file> --tier S1 [--seed N] [--angles <file>]
```

Dispatch one subagent per line in waves of `min(subagents.max_parallel, host cap)`,
each reading `briefs/<line>.md` and writing **only** `lines/<line>.md` under
`agents/runtime/bracket/<id>/`. Do not wait on them and do not read their work —
then `scan`. A line missing twice is `NO OUTPUT`. Dedupe near-duplicates into their
lineage before pairing; when two waves add under 20 % new lines, stop spawning and,
where allowed, add another model family instead of more of the same.

### 3. Judge matches

```bash
./scripts-run src/scripts/bracket/cli advance --run <id>
./scripts-run src/scripts/bracket/cli collect --run <id> --match <M> --verdict <file.json>
```

Per match: run the project's own deterministic checks (tests, type-checker, linter)
on both lines first — a line failing one carries an upheld FATAL, whatever the prose
says. Then each side attacks the other (FATAL / MAJOR / MINOR), each defends and
revises, then one **paid** judge returns rubric scores (0–10 per criterion) and a
pick as JSON. The script decides: an upheld FATAL loses, otherwise points win, and
a pick that contradicts the points is overruled with a note. A `free-quota` seat's
verdict is refused. The judge never sees card state, lineage, or model family.

### 4. Appeals and the card

`next` lists losses with an appeal signal (close gap, pick ≠ points, loser more
correct, FATAL rebutted, audit sample). For each:

- **A judging error** (misread check, unsupported FATAL) → `correct --reason …`:
  the match is reversed and no card is spent.
- **Otherwise a paid seat** reads both revised solutions blind and answers one
  question — does the eliminated line deserve a second chance? Yes → `card …`; no →
  `decline …`. At most **2 cards per lineage**; the second needs new evidence; no
  card while an upheld FATAL stands. The returnee meets a new opponent; the winner
  stays in. With no council and no local model on project content, the card seat is
  a paid judge one tier higher, reported as a **second look**, never as a council.

### 5. Close honestly

At `done`, compare the winner blind against the rejected baseline in **both**
orders; a verdict that flips is "no clear winner". Report every card (signal,
seat, path after), the call count, and — if AC decided for the user — record tier,
N, cards and dissent under the run's `## Decisions`. Never apply the winner.

## Rules

- Never call a same-model fan-out a council.
- Never let a free route carry a match verdict or play the card.
- Never send project content to a free route without local proof.

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) § do-competitively
- `src/scripts/bracket/` — engine, tiers, seats, simulation
