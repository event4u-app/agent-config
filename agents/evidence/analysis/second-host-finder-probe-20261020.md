<!-- evidence-type: analysis -->

# Second host: an unlisted skill reached through the finder

**Date:** 2026-10-20 · **Host:** codex-cli 0.148.0, one machine · **Label:**
first-party live observations, plus a deterministic offline census over the
committed tree.

Taken for the blocker `second-host-unlisted-reachability`, remedy (a), as the
AI council asked (`agents/evidence/council/second-host-unlisted-reachability-20261020.md`).

## Setup

`codex exec -s read-only` in an empty scratch project under a scratch `HOME`
and `CODEX_HOME` carrying dereferenced copies of both skill roots the host reads
(`~/.codex/skills`: 309 entries, `~/.agents/skills`: 459) plus the auth and
config files. Every `agents/openai.yaml` was deleted first, then
`applyCodexResidentSet` ran on that home: `37 listed (7769 of 7798 chars), 729
newly unlisted, finder written`. 7,798 is the 8,000-character budget minus the
finder's own reserved entry. Nothing of the maintainer's was written.

Two non-resident skills were given a distinctive last line, so "followed" is
observable rather than inferred: `docker` → print `CANARY-DOCKER-7Q3` first,
`sql-writing` → print `CANARY-SQL-5K8` first. Both sit at the END of their
files, the hardest place for a partial read.

## Readings

| # | session | ask | result |
|---|---|---|---|
| L | `01a15902-2356-7a70-bc4f-86c28634249b` | is the finder / `docker` in your skills list (no tools) | `FINDER=YES` · `DOCKER=NO`; **no omission warning** on stderr |
| N1 | `01a15902-4c7a-7c10-afd7-e8fe1799b5c9` | use the docker skill | read the finder, then `docker/SKILL.md` lines 1–260 of 276 — **canary missed** |
| N2 | `01a15902-c78d-7aa3-a5cf-8af3541c2c52` | same, after the finder text was changed | read the finder, then `cat docker/SKILL.md`; first line `CANARY-DOCKER-7Q3` — **met** |
| S | `01a15909-e404-7620-a795-25a15790880f` | find the agent-config skill that fits, then follow it (SQL duplicates) | finder → `agent-config route:explain --skills "<task>"` → `cat sql-writing/SKILL.md`; canary printed, and the answer names the skill — **met** |
| U | `01a1590a-35ac-7772-acc6-a015728db02e` | use the `kubernetes-wizard` skill (not a skill) | read the finder only; "isn't installed. Closest available skills include `docker` and `terraform`" — **fails safely**, no path built from the name |
| T | `01a15909-9e93-7181-8cc0-2450cb989e82` | the SQL task with no mention of skills | answered directly, no tool call, no skill — **not reached** |

Four attempts were lost to `429 Too Many Requests` and are not counted.

## What changed because of a reading

N1 is why the finder now says to read a skill WHOLE with `cat`, never a ranged
read: the model read 260 of 276 lines and missed an instruction on the last
one. N2 is the same ask after that change.

## What is established, and what is not

**Established:** the finder is listed inside the budget with no warning; a
named non-resident skill is loaded and an instruction on its last line is
followed (the `called-by-name` trigger of 4.2); a task routed through the
package's search is ranked, read whole and followed (the `search-read`
trigger); an unknown name is refused with the nearest real names.

**Not established, and stated rather than hidden (T):** a model given an
ordinary task, with nothing pointing it at skills, does not consult the finder
on its own. That is the `model-suggested` path, which 4.2 deliberately does
NOT count as a trigger — so it does not bear on AC-4, which is worded against
4.2's triggers. It is also not specific to the finder: the session made no tool
call at all and consulted no listed skill either.

## Offline census

`doctor --check skill-reach` against the scratch home and this tree's
projection: `codex (~/.codex/skills): installed 35 (described 35 · name-only 0 ·
unlisted 0) · reachable-not-installed 266 · degraded 0 · unreachable 0 — of 301
authored`, status `ok`. Every unlisted skill passes `finderRoutes` — indexed
once, under a root the package writes, file present — so the count is
exhaustive, not sampled. Removing the finder flips the same check to `warn`
(`tests/scripts/skill_reach.test.ts`).
