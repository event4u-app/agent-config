<!-- evidence-type: analysis -->

# Pre-registration — the skill fork pilot

**Roadmap step:** `road-to-skills-that-arrive-when-called` 3.2.
**Written:** 2026-10-20, before the first run.
**Hash:** this file's own sha256 is recorded in the commit message that lands
it, and the result is committed in a LATER commit — so the ordering is in the
history and not in a sentence.

**Disclosure, because pre-registration is worth nothing if its own ordering is
fudged.** The harness was first exercised on 2026-10-20 BEFORE this file was
committed, as a shakedown of the probe itself. That run is not the pilot and
its numbers are not reported as the result. The reported run is the one taken
AFTER this file was committed with its hash, against this text unchanged.

## What is being tested

The first host documents `context: fork` on a skill: the body runs in a forked
context instead of entering the invoking conversation. This package could not
use the key until step 1.1 renamed the package key that was squatting on it.
D2 limits the pilot to `report` skills — a forked run sees no conversation, so
for a `standing` skill a fork is not a saving, it is amnesia.

**Set under test**, from `src/config/skill-fork-pilot.json`, five of the six
skills that carried the retired `context: large` key, all classified `report`:
`deep-reading-analyst`, `project-analysis-core`,
`project-analysis-hypothesis-driven`, `project-analyzer`, `repomix-packer`.
`universal-project-analysis` is the sixth and is deliberately held out as the
untouched sibling.

**Host:** the first host only. Every other host gets the body.

## Arms, each with the observation that would falsify it

Written before the run. An arm that cannot be read is reported as not read —
not quietly dropped, and not reported as a null.

### A1 — does the host fork at all?

Claim: a skill carrying `context: fork` runs OUTSIDE the invoking conversation.
Falsifier: the body arrives as a message in the invoking conversation, the way
0.2 (d) observed `context: large` arrive. That reading would make the whole
pilot moot and is the single most likely outcome, because 0.2 (d) already
showed the host ignoring an unknown value on this key without erroring.

### A2 — main-conversation tokens per invocation

Claim: a forked invocation adds materially fewer characters to the invoking
conversation than an inline one of the same skill on the same prompt.
Measurement: characters the invocation contributes to the main transcript,
forked vs inline, same skill, same prompt, same session shape.
Falsifier: no material difference. A difference under 10 % is a null.

### A3 — harm guard: a fork that needed context it could not see

Claim: a forked run cannot see the conversation, and that is a cost, not only a
saving. Measurement: a canary word is stated in the conversation before the
invocation; the skill is asked to repeat it. 0.2 (d) observed the INLINE case
seeing exactly such a canary, so the inline arm is the positive control.
Harm reading: the forked run cannot report the canary.
**A harm reading is a valid close of 3.2.** It does not fail the step; it
answers it.

### A4 — re-entry after compaction

Claim: a forked body is not re-attached after compaction, because it was never
in the conversation.
**Declared NOT MEASURED in this pilot**, up front: forcing a compaction inside a
scripted probe is not something this lane can do deterministically, and a
measurement that cannot be forced cannot be pre-registered honestly. Recorded
here so the result cannot later present silence as a null.

### A5 — background execution and artifacts returned

Claim: a forked run returns a usable result to the invoking conversation rather
than only a transcript.
Measurement: whether the invoking turn can act on what the fork returned.

## Decision rule, fixed in advance

- A1 falsified → the pilot closes as **null**, the fork set stays at five, and
  3.3's widening question is posed with a null attached. No key ships.
- A1 confirmed and A3 reads harm → the pilot closes as **harm**; the set stays
  at five and the key does not widen.
- A1 confirmed, A3 no harm, A2 a real saving → 3.3 poses widening to the owner.
  Widening is never taken here, whatever the numbers say.

## What this pilot will NOT do

- It will not wire the render into the installer. `renderForkContext` exists and
  is tested; no install calls it. 4.6 keeps the first host on its full install
  until Phase 5 reads no harm, and a pilot that shipped to every consumer would
  be the widening 3.3 exists to pose.
- It will not change any authored SKILL.md. The key is host-documented, so
  authoring it would re-create the 1.2 collision that 1.1 just removed.

## Honesty label

The result carries the claims gate's label. A probe run in a scratch project on
one machine, on one host build, is a first-party observation of that build —
never a general claim about the host.