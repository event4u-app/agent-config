---
stability: beta
keep-beta-until: 2026-11-24
owner: maintainer
---

# Eval measurement integrity

> The conventions a benchmark in this repository follows so that a number it
> publishes is worth acting on. Written by
> `road-to-skill-ecosystem-eval-integrity`; the executable halves live in
> `src/scripts/_lib/paired_verdict.ts`, `_lib/judge_hygiene.ts` and
> `_lib/eval_publication.ts`, and this page is the part no function can hold.

## The frozen-snapshot convention

**The comparison arm is a committed predecessor snapshot, and it must not drift
with live edits.**

A control arm that reads the working tree is not a control: every commit moves
it, so a measured delta mixes the change under test with everything else that
landed since. The snapshot is therefore a committed artifact under
`internal/bench/snapshots/<name>/`, referenced by path and never by "the current
`src/`".

### The re-baselining ritual

A snapshot that is never refreshed silently measures against an increasingly
irrelevant predecessor, which is the failure mode of the convention itself. So
re-baselining is a defined act, not a maintenance chore:

1. **It commits separately.** A re-baseline never rides along with a change that
   is measured against it — that is the one combination whose result cannot be
   read, because the arms and the treatment moved together.
2. **It records what shifted**, in the commit body: which files the snapshot
   picked up, and the one-line reason the old predecessor stopped being the
   right comparison.
3. **It invalidates cached baselines by construction.** The identity hash
   (`baselineIdentity`) includes the fixtures, so a refreshed snapshot produces a
   different key and no stale result is served.
4. **It never happens after seeing a result.** Re-baselining because a run came
   out badly is fitting to data with extra steps. If a result motivates the
   re-baseline, that reasoning goes in the commit body and the affected run is
   re-run afterwards, not reinterpreted.

## Evaluate the packaged surface, not the source tree

**A benchmark arm installs the projection a consumer would get and runs against
that.**

Running against `src/` measures a tree no consumer has. This repository's own
recorded trap is sharper than the general argument: *a release-gated path is an
untested path* — the surfaces that only exist after packing (the `files[]`
payload, the installed `dist/agent-src/`, path-reachability of shell entry
points) are exactly the ones a source-tree run never exercises, and they have
produced real `ERR_MODULE_NOT_FOUND` failures in a global install that every
source-tree check passed.

`src/scripts/pack_install_smoke.ts` is the existing instrument: it packs a real
tarball, installs it into a throwaway prefix, and runs consumer probes from the
installed tree. A benchmark arm that claims to measure "the package" uses that
path or states plainly that it measured the source tree instead.

## A run that never reached the model is not a trial

**An attempt that ended before any model call — a startup-hook timeout, a
harness crash — measured the environment, not the arm. It is rerun, up to a
bound the pre-registration names before data, and it is reported with its
abort reason; it is never scored.**

The rule exists because the alternative was decided once after the data: on
2026-11-09 two `trapC-ambig-01` runs timed out in the startup hook, the frozen
protocol did not say whether they counted as blind asks, and the verdict moved
between INCONCLUSIVE and NON-INFERIOR on that reading alone. A reading chosen
after the result is known is the weakest kind of evidence a benchmark can
offer, however reasonable the choice.

Two limits keep it from becoming a way to drop inconvenient runs. An abort
counts as pre-model only on positive evidence (`reachedModel: false` on the
receipt); an abort that does not say is kept as the trial. And a timeout
after a model call stays the trial, exactly as attempt-one accounting keeps
any other first attempt. A case whose every attempt within the bound missed
the model is listed as an environment failure, so the denominator stays
visible.

The A/B runner applies it on container sweeps: `bench_ab_v2_run --isolation
container --pre-model-reruns N`, where `N` is the bound the pre-registration
named (default `0`: no rerun, the trial is still marked an environment failure).

## The non-inference section

**Every measurement artifact carries a section enumerating the inferences its
data does NOT license.**

A measured figure outlives its measurement. It gets quoted without the corpus,
the arm count, or the population it ran over, and a reader with only the headline
cannot tell which neighbouring reading it does not support. The section is short
and specific — three or four sentences naming the readings a careful person would
otherwise take — and it is not a disclaimer: "results may vary" enumerates
nothing.

On the claims ledger the same obligation is the `non_inference:` field, scoped to
`backed` + `kind: quant` and held by a shrink-only ratchet
(`check_claims:non-inference`). A field shorter than 20 characters is a finding
at any count: that is answering the question with silence, and it reads as
answered.

## Where each rule is executable

| Convention | Executable half |
|---|---|
| Direction decides, magnitude reports | `_lib/paired_verdict.decidePairedVerdict` |
| Trial floor derived from the applied test | `_lib/paired_verdict.deriveMinDiscordant` |
| Underpowered excluded from any pass rate | `_lib/paired_verdict.passRate` |
| An assertion is worth what it separates | `_lib/judge_hygiene.auditAssertions` |
| A pass verdict needs evidence, not a label | `_lib/judge_hygiene.evidenceDeficit` |
| An arm that cannot discriminate is not a result | `_lib/eval_publication.discriminationDeficit` |
| A missed plant is an implicit zero | `_lib/eval_publication.scoreWithImplicitZeros` |
| The denial is verified on the transcript | `_lib/eval_publication.scanLeaks` |
| A cache key includes the criteria | `_lib/eval_publication.baselineIdentity` |
| Attempt-one-only accounting | `_lib/eval_publication.firstAttempts` |
| Completeness before publication | `_lib/eval_publication.completenessVerdict` |
| An abort is a truthful receipt | `_lib/eval_publication.ABORT_REASONS` |
| A pre-model abort is not a trial | `_lib/eval_publication.countedTrials` |
| Coverage excludes non-self-activating artifacts | `_lib/eval_publication.coverageExcludingNonActivating` |
| A declared indeterminate branch | `_lib/eval_publication.evaluateThreshold` |
| The measurement inputs are gated | `src/scripts/lint_eval_specs.ts` |
| The non-inference field | `src/scripts/check_claims.ts` |

The three rows with no executable half — the frozen snapshot, the packaged
surface, and the prose non-inference SECTION — are conventions this page holds
and nothing enforces. That is stated rather than implied: no gate can tell a
snapshot that was refreshed for a good reason from one refreshed after seeing a
result, and none of them is satisfiable by a check that reads a file.
