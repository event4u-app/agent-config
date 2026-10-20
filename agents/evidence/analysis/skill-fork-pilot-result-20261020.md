# Result — the skill fork pilot

**Roadmap step:** `road-to-skills-that-arrive-when-called` 3.2.
**Pre-registration:** `agents/evidence/preregistration/skill-fork-pilot-20261020.md`,
sha256 `e8e4fe1e51445ae4c76df5e5797646368f994d06a6ea268f5e067df14a0dab3b`,
committed before this run in `7ee747481`.
**Honesty label:** first-party observation of one host build on one machine.
Not a general claim about the host, and not a claim about any other build.

**Close: HARM**, by the pre-registered falsifier for A3. The step names a harm
reading a valid close, and this is one: the set stays at five, `context: fork`
widens to nothing, and 3.3 poses widening with this attached.

## How it was run

Host `claude` build 2.1.302, `claude -p` in a scratch project at
`/private/tmp/claude-501/fork-probe-run`, two project-scoped skills under
`.claude/skills` so nothing was written into the user skills root:

- `zz-fork-probe-i` — the control, no `context` key.
- `zz-fork-probe-f` — identical body, plus `context: fork` written by
  `renderForkContext`.

Both bodies ask for a canary word stated earlier in the conversation and then
for their own name. The conversation states `ZORBLAX` before either invocation.

Transcript:
`~/.claude/projects/-private-tmp-claude-501-fork-probe-run/d7167da4-a5ad-4382-87b9-59bf4a59f5b9.jsonl`
(machine-local, named not committed). A shakedown run of the same harness the
same day, before the pre-registration was committed, is not reported here and
produced the same two readings.

## Arm by arm

### A1 — does the host fork at all? **Confirmed.**

The host says so in its own words. The control returned
`Launching skill: zz-fork-probe-i` and then injected the whole SKILL.md into the
conversation as a message. The fork returned one tool result:

```
Skill "zz-fork-probe-f" completed (forked execution).

Result:
CANARY=NONE
SKILL=zz-fork-probe-f
```

This is the arm that was most likely to fail — 0.2 (d) had already observed the
host ignoring an unknown value on this key without erroring, so the live
question was whether `fork` is a value it actually implements. It is.

### A2 — main-conversation tokens per invocation. **A real saving, and it scales.**

Characters the invocation contributed to the main transcript, counted from the
transcript rows:

| | control (inline) | fork |
|---|---|---|
| launch notice | 46 | — |
| body / result | 364 (base-directory line + the whole SKILL.md) | 110 (the result) |
| **total** | **410** | **110** |

The number that matters is not 410 against 110 — the probe bodies are ~330
characters. It is the SHAPE: the inline cost carries the body and therefore
grows with it, while the forked cost carries the result and does not. The five
skills in the pilot are 3,824 / 5,273 / 5,417 / 13,546 / 16,777 bytes of
SKILL.md, and the six D4 skills the body budget flags are all ≥ 20,193. Well
above the 10 % floor the pre-registration set for a null.

### A3 — harm guard. **Harm.**

| | canary |
|---|---|
| control (inline) | `CANARY=ZORBLAX` |
| fork | `CANARY=NONE` |

The positive control holds — an inline skill does see the conversation, which
is what 0.2 (d) observed too — so the fork's `NONE` is the mechanism and not a
broken probe. By the falsifier written down before the run ("the forked run
cannot report the canary"), **A3 reads harm**.

Stated plainly, and kept separate from the verdict because reinterpreting a
falsifier after seeing the data is exactly what pre-registration exists to
prevent: this reading is also the mechanism behaving as designed. A fork that
could see the conversation would not be a fork. What the reading settles is
that the saving in A2 is **paid for**, not free — a skill moved to `fork`
loses every fact the conversation carries, and no amount of token saving tells
you whether a given skill needed one. That is why D2 restricts the key to
`report` skills, and why the close is harm rather than a green light.

### A4 — re-entry after compaction. **Not measured**, as declared in advance.

A compaction cannot be forced deterministically from a scripted probe in this
lane. Declared in the pre-registration so this line reads as what it is — an
arm nobody measured — and not as a null.

### A5 — background execution and artifacts returned. **Confirmed.**

The forked run returned a result string the invoking conversation quoted and
acted on in the same turn. The fork is not fire-and-forget.

## What follows

The pre-registered decision rule: A1 confirmed, A3 harm → the pilot closes as
harm, the set stays at five, the key does not widen. `renderForkContext` ships
unwired; no install calls it, and a test greps `src/` to keep that true.

3.3 poses widening to the owner on this record. The question it carries is not
"is the saving real" — it is, and A2 says how it scales. It is: **which report
skills genuinely need no fact from the conversation they were called in?** A2
and A3 together say that is a per-skill judgement about content, not a
threshold anybody can read off a byte count.
