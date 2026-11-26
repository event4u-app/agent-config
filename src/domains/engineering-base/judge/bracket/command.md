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
agent-config bracket plan [--tier S1] [--agent-tier S2] \
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

### 2. Write the task file — it is all any line, attacker or judge will see

Subagents do not see this conversation. Write `<file>` to stand on its own: the
request in the user's words, every requirement and constraint stated anywhere in
the conversation, the context a stranger needs (absolute paths, pasted data,
conventions), what "done" means, and — when there is an answer to beat — what the
user disliked about it. Add no requirement the user never gave, and never your own
view of the right answer: that steers every line the same way, which is the
opposite of a bracket. A rejected answer goes verbatim into its own file for § 6.

### 3. Initialise and generate

```bash
agent-config bracket init --run <id> --task <file> --tier S1 [--seed N] [--angles <file>]
```

Right after `init`, **name the run** — 3–6 words on what the arena decides, not
the run id (Agent Switch shows it in place of the id):

```bash
agent-config bracket name --run <id> --text "Session names people recognise"
```

Without `--angles`, every line is dealt a **distinct approach angle** from the
built-in deck — a reasoning mode, a workflow and a trade-off stance; no two lines
share one, and each axis is spread evenly <!-- harvest:arena-dealt-approach-angles -->.
`--angles` replaces the deck with your own list, and is refused when it holds fewer
distinct angles than lines. The angles live in `angles.json`; the judge never sees
them.

Dispatch one subagent per line in waves of `min(subagents.max_parallel, host cap)`,
each reading `briefs/<line>.md` and writing **only** `lines/<line>.md` under
`agents/runtime/bracket/<id>/`. Do not wait on them and do not read their work —
then `scan`. A line missing twice is `NO OUTPUT`. Dedupe near-duplicates into their
lineage before pairing; when two waves add under 20 % new lines, stop spawning and,
where allowed, add another model family instead of more of the same.

### 4. Judge matches

```bash
agent-config bracket advance --run <id>
agent-config bracket briefs  --run <id> --match <M> --seat-id <X> --seat-family <F> --seat-billing <B>
agent-config bracket collect --run <id> --match <M>   # reads matches/<M>/verdict.json in the run
```

Per match, `briefs` first copies both lines into the match folder as
`original-a.md` / `original-b.md` (and `revised-*` as the same text, so an
undefended solution is judged as first written), records the judge seat in
`seat.json`, and writes the five match briefs under `matches/<M>/briefs/`. It
refuses a closed match and a `free-quota` seat. Every role reads only those
match-local copies, so no brief and no file the judge opens names a line.

Then run the project's own deterministic checks (tests, type-checker, linter) on
both revised copies and write their output to `matches/<M>/checks-a.txt` /
`checks-b.txt`, with line ids and run paths scrubbed — a solution failing one
carries an upheld FATAL, whatever the prose says. Dispatch each brief as written,
never edited per agent: `attack-a` + `attack-b` (FATAL / MAJOR / MINOR), then
`defend-a` + `defend-b` (concede and fix, or rebut with evidence; full revised
solution), then `judge` on the **paid** seat you named. The judge brief carries the
rubric with anchors <!-- harvest:bracket-rubric-anchors --> and a verdict skeleton
of placeholders, so a verdict copied unfilled is refused. `collect` refuses a
verdict whose seat differs from `seat.json`. The script decides: an upheld FATAL
loses, otherwise points win, and a pick that contradicts the points is overruled
with a note. The winner's revision becomes its `lines/<id>.md` for the next round;
the pre-match text stays beside it as `lines/<id>.before-<M>.md`.

A judge that fails twice gets a third, fresh run on a paid seat — the orchestrator
never decides a match. A missing attack counts as no attack.

**While it runs:** do not read lines, attacks or verdicts — `next` and `status` are
all you need, and the state survives compaction. After each `advance`, one line to
the user ("round 2 done: 5 of 10 left"), nothing more. On a long run, suggest the
host's accept-edits mode once instead of hundreds of file approvals; never change
the user's settings yourself.

### 5. Appeals and the card

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
- **The appeal jury (shadow).** Beside the card seat, ask up to 5 jurors from
  ≥ 2 **paid** families (subscriptions first; spread over agent-switch profiles
  when linked) the same question twice — the eliminated line shown first, then
  second. Write their answers as JSON (`[{ "seat": {id,family,billing}, "ab":
  "readmit|deny", "ba": "readmit|deny" }]`) and pass `--jury <file>` to `card`
  or `decline`. The vote is **recorded, never used**: the card seat still
  decides. Free or local jurors may sit and are recorded; they are never counted.
  A split, an order-flipping juror or one paid family is `inconclusive`.
  `--jury-mode off` skips it; a jury that could not sit (one paid family, no
  subscription seat free) is `--no-jury "<reason>"` — both are logged. The binding form (`agent-config bracket jury`) is
  refused until the claim `paid-appeal-jury` is backed.

### 6. Close honestly

At `done`, compare the winner blind against the rejected baseline in **both**
orders; a verdict that flips is "no clear winner". Then **record the decision** as one line
saying WHAT was chosen, not only who won — `name` records the current champion
beside it:

```bash
agent-config bracket name --run <id> --decision "Sidecar name.json with PR-style fallbacks"
```

A name or decision the user set in Agent Switch is kept; `--force` replaces it
only when the user asked. An empty value clears the field. Report every card (signal,
seat, path after), the call count, and — if AC decided for the user — record tier,
N, cards and dissent under the run's `## Decisions`. Never apply the winner.

## Rules

- Never call a same-model fan-out a council.
- Never let a free route carry a match verdict or play the card.
- Never send project content to a free route without local proof.

## See also

- [`subagent-orchestration`](../skills/subagent-orchestration/SKILL.md) § do-competitively
- `src/scripts/bracket/` — engine, tiers, seats, simulation
