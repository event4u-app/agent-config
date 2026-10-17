<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-17, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence: a recorded verdict whose prompt is not
     recoverable is not evidence). Not edited after the run. -->

# Should the CI wait after a push stay in the foreground?

You are deciding one question for a roadmap in a repository that ships rules,
skills and hooks for AI coding agents. Answer on the evidence below. Do not
summarise the evidence back. Name the option you choose, the strongest argument
against it, and a `revisit-if` condition that would reverse it.

## The current behaviour

After every `git push`, a PostToolUse hook injects this instruction into the
agent's context (abridged, verbatim where quoted):

> "Before this turn ends: 1. Settle it: `ci_settle <PR>` … Exit 0 = settled
> green … 1 = settled, something failed · 2 = NOT a verdict … 2. Red? Read only
> the failing part … then fix it and push again."

A skill (`git-workflow`) repeats it. `ci_settle` blocks until every check on the
PR's head settles or a timeout expires, and on its last line already names how
to run the next wait in the background. Agents follow the louder instruction:
they wait in the foreground. A separate turn-end detector ("D") refuses a
completion or delivery claim about a PR whose CI verdict was not read; that
detector is not in question here.

## The earlier decision being revisited

On 2026-10-07 a council (2/2) set the target for the `ci-wait` cause as: "no
foreground wait ends without a verdict". The mitigation chosen was to name the
still-pending checks and a background next wait on the waiter's last line,
rather than failing fast on the first red. Evidence then: 20 of 44 CI waits
ended with no verdict (184 min); 3 ended red (20 min). That target was met.

## The new evidence

- Unattended night runs ("drains") process roadmaps in up to two parallel
  lanes, each lane one roadmap → one branch → one PR. Merged changes per night
  were 10.6 (2026-08-10..23), 7.0 (2026-08-24..09-06) and 6.8
  (2026-09-28..10-13); net ticked roadmap steps per night fell 56.7 → 30.0 →
  19.1 over the same windows. Merges per night are roughly flat; work per merge
  fell.
- Over the 10 most recent sessions (read 2026-10-16), tool calls that blocked
  over 60 s took 555 of 686 tool minutes (blocking share 0.81, against a
  recorded baseline of 0.62). By cause, in minutes: sleep-poll 212, ci-wait
  186, network 115, unknown 38, test 3, build 1, subagent-wait 0, mcp 0,
  user-wait 0.
- A required CI run takes about 14 min at p50. During it the lane does nothing
  else; the next roadmap step in the same lane, or the next roadmap, waits.
- Nobody has measured how much of the `sleep-poll` minutes are hand-written
  CI-polling loops rather than other waits.

## The proposed change

Replace "settle before the turn ends" with a settle **obligation**: after a
push the agent starts `ci_settle` in the background and records an open
obligation; it takes the next workable step meanwhile; a completion or
delivery claim about that PR still needs the settled verdict (detector D
unchanged); the obligation reuses `ci_settle`'s head/branch-tip check, so a
verdict for a superseded head is never read as current. The hook ships to
consumer installs, so the change carries a changelog line, and reverting the
reminder text restores today's behaviour. Nothing merges on its own; a
background wait never becomes a background merge.

## Options

- **(a) Keep the foreground settle.** The 2026-10-07 target holds; the cost of
  a held lane is accepted.
- **(b) Adopt the settle obligation as proposed.**
- **(c) Adopt it only after measuring** what share of `sleep-poll` minutes are
  CI polling and how often a lane had a workable next step while waiting; until
  then keep (a).

Answer with one option, the strongest argument against your choice, and a
`revisit-if`.
