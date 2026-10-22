<!-- evidence-type: analysis -->

# Result — the effect of the arrival work

**Roadmap step:** `road-to-skills-that-arrive-when-called` 5.2.
**Pre-registration:** `agents/evidence/preregistration/skill-arrival-effect-20261020.md`,
sha256 `0a771eeb06e101b53e178bdd9d7796a34d58c604b5aa91394abc83597c030c81`,
committed in `edde62bff` before the readings below were taken. That hash is of
the file **as committed there** — a later commit prepended the `evidence-type`
marker this tree's evidence lint requires, so the working copy hashes
differently and
`git show edde62bff:agents/evidence/preregistration/skill-arrival-effect-20261020.md | shasum -a 256`
reproduces the value quoted here.
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

### S3 — a non-resident skill stays invocable. **FALSIFIED, two-armed.**

Three runs, after two earlier attempts at the control were lost to `429`:

| run | ask | answer |
|---|---|---|
| `01a1573b` | invoke `docker` (non-resident) | `UNAVAILABLE`, **no tool call** |
| `01a15755` | invoke `accessibility-auditor` (resident) | the first line of its body — by `sed`-reading the file, **not** through the skill mechanism |
| `01a15751` | which of the two are in your skills list | `RESIDENT=YES` · `NONRESIDENT=NO` |

The third run is what makes the pair conclusive, and the second is why it was
needed: the "positive control" did not exercise the skill mechanism either, it
read a path it already knew. So the clean statement is the listing one.

**Established:** a skill carrying `policy.allow_implicit_invocation: false` is
**not in the model-visible skills list**, and a model that cannot see it does
not reach for it. **Not established:** that the host would refuse an invocation
if something named it anyway — neither run got that far. **Also true and easy
to over-read:** its body stays readable by a caller that already knows the
path, which is a filesystem read, not reach as a skill.

Consequence for the buckets: `unlisted` stays factually correct — installed,
not listed — and must not be read as *reachable*. `skill_reach` keeps it, with
that caveat written into its own comment rather than left for a reader to
infer. Recorded as the probe row `unlisted-skill-not-in-model-list` in
`src/config/skill-lifecycle-probes-codex.json`.

This is why AC-1 and AC-4 do not close, and the open part is no longer the
measurement — it is the remedy. Blocker: `second-host-unlisted-reachability`.

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

- **G1 — skill-not-found at invocation. 1 treated, explained.** The one
  `UNAVAILABLE` is S3's finding above, a not-found on a skill the treated
  configuration made non-resident on purpose. (Corrected 2026-10-22, release
  finding `378dbe246014`: this line read "0 treated", which reclassified the
  event the guard counts after seeing it. The count is the event; the
  explanation sits beside it.)
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
`second-host-unlisted-reachability`. The probe it was waiting for has now been
taken and is recorded; what is left is a decision about the remedy, which is
the blocker's content.