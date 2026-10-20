# Result — the effect of the arrival work

**Roadmap step:** `road-to-skills-that-arrive-when-called` 5.2.
**Pre-registration:** `agents/evidence/preregistration/skill-arrival-effect-20261020.md`,
sha256 `0a771eeb06e101b53e178bdd9d7796a34d58c604b5aa91394abc83597c030c81`,
committed in `edde62bff` before the readings below were taken.
**Honesty label:** live readings are first-party observations of codex-cli
0.148.0 on one machine. Offline readings are deterministic over the committed
tree. One arm is reported as **falsified**, one as **one-armed**, and the
primary as **not measurable**.

## Primary — not measurable, as declared

No artefact named "host-graded cases" exists in this tree. Declared in the
pre-registration, not discovered afterwards. Nothing is substituted for it.

## Second host — today vs Phase 4

Probes ran `codex exec` in a scratch project under a scratch `HOME` and
`CODEX_HOME` carrying copies of the two skill roots, so the maintainer's own
configuration was never written to.

### S1 — listing characters. **Met, offline.**

The whole projected catalogue bills 59,584 characters against a documented
budget of 8,000. The computed resident set bills **7,769 across both roots, 37
entries**. Deterministic over the committed tree.

### S2 — the omission warning, live. **Met, with its positive control.**

| run | roots | warning |
|---|---|---|
| control — no resident set | 309 + 459 entries | `Exceeded skills context budget … 406 additional skills were not included` |
| treated — resident set across both roots | 37 listed | **none** |

Both taken after the pre-registration was committed. The control is what makes
the treated reading mean anything: without it, "no warning" is
indistinguishable from a probe that loaded no skills at all.

**A finding on the way, and it changed the implementation.** The first treated
run covered only `~/.codex/skills`, where this package deploys for this host,
and the warning still fired at 153 omitted. The host also reads
`$HOME/.agents/skills` — its OWN documented root, which this package writes
under a different host's deploy row, and which held 459 entries on this
machine. 0.3 had already observed the host listing a name present in both roots
twice without merging. So a resident set over one root was arithmetic applied
to half the problem. 4.1 now computes ONE set across every root the host reads
that the package writes, keeps a resident name's description in the first root
that holds it and disables the duplicate in the rest.

### S3 — a non-resident skill stays invocable. **FALSIFIED, and the reading is one-armed.**

Asked to invoke `docker`, a skill present on disk with
`policy.allow_implicit_invocation: false`, the session answered `UNAVAILABLE`
and **made no tool call**. The transcript shows no attempt.

The paired positive control — the same question about a RESIDENT skill, which
would separate "the host refuses the invocation" from "the model never saw it
listed and did not try" — **could not be taken: `429 Too Many Requests`**, the
subscription's rate limit, which also stopped 0.3's live-pickup cell four times
today. So the reading is one-armed and it is reported as one-armed.

What it establishes either way: **on this host a skill outside the resident set
is not reached by a model-side invocation.** What it does not establish: whether
anything else could reach it. That gap is registered as the blocker
`second-host-unlisted-reachability` and it is why AC-1 and AC-4 do not close.

**It does not make 4.1 wrong, and the control says why.** Without the resident
set this host drops 406 entries and strips every description, by alphabet,
behind a warning — so those entries are *already* unreached, and nobody can say
which. 4.1 replaces an arbitrary cut with a deterministic, recorded one and
makes the survivors knowable. It does not reduce reach; it stops reach being
decided by spelling.

## First host — today vs 3.2. **Nothing shipped, and a test says so.**

3.2 closed harm, `renderForkContext` is called by no install path, and no
authored SKILL.md carries a `context:` key. Both are asserted by
`tests/install/skill_fork_pilot.test.ts`, which greps `src/`.

## Guards

- **G1 — skill-not-found at invocation. 0 treated.** The one `UNAVAILABLE` is
  S3's finding above, not a not-found on a skill that should have been found;
  it is reported there rather than counted twice here.
- **G2 — removal under a live lease. 0.** And the zero is weak on its own, so
  the weakness is stated: no entry was ever materialised in these runs, so the
  opportunity count is zero and a zero over zero opportunities proves nothing.
  The guard is actually held by the two-session fixture in
  `tests/install/skill_materialisation.test.ts`, which places an entry under a
  live lease, collects, and asserts it survives — and which fails when the TTL
  check is neutralised.
- **G3 — omission warnings on the second host. 0 treated, 1 control.** S2.

## What follows

AC-2, AC-3 and AC-5 close. AC-1 and AC-4 are held by
`second-host-unlisted-reachability`, which needs one probe this lane could not
take: the resident-skill positive control, on a day the second host's
subscription is not rate-limited.
