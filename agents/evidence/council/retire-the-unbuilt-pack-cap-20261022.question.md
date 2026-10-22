<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-22, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# The breached absolute pack-size cap: raise it, retire it, or gate it?

Repository: event4u/agent-config, an npm package. Release under preparation:
17.0.0. A two-seat release council ruled this item must be closed before the cut:
"A breached absolute maximum that no job enforces is false policy state and must
be raised, retired, or restored as a gate."

## The facts

`src/config/pack-size-budget.json` records two payload surfaces of the npm
tarball (`npm pack --dry-run --json --ignore-scripts`, compressed size):

- **UNBUILT** — the tracked tree with no `dist/cli/**` build output. Carries an
  absolute cap `budgets.packed_size_mb.max: 11.5` (set 2026-09-10 by the file's
  own formula, measured × 1.095 rounded down, under a council decision with an
  owner delegation, ADR-273) plus a creep line (`last_measured` + 10 %).
- **BUILT** — what is published: `dist/cli/**` and other build outputs are
  present. Carries ONLY a creep line against the newest recorded built figure
  (14.4989 MB, 2026-10-17). No absolute built cap was ever set by a maintainer,
  and the file says inventing one would be an invented number.

`check_pack_size` routes by surface: an unbuilt payload is judged against `max`,
a built payload against the built creep line. The required CI job always packs
a built tree, so `max` is consulted by no job.

On 2026-10-17 the owner took the position that `max` is "an explicit absolute
policy limit whose raise is a second decision", left it untouched, and recorded
the unbuilt surface (12.053 MB then) as a latent breach, with revisit-if "a job
packs an unbuilt tree and reds on `max`, or a maintainer re-cuts the absolute
cap". Measured today (2026-10-22) on a release-branch worktree: unbuilt 12.58 MB
over 3,492 entries; built 14.31 MB over 3,649 entries — under the built creep
line.

## Governance

`decision-revisit-gate`: a recorded decision is reopened in the council by
default; the owner is reached for the reserved set (purpose, lowering a
safety/privacy floor, irreversible, spend above a threshold, legal/public
commitments, governance self-amendment, unboundable). The venue comes from the
proposed transition, not from who decided originally.

## The question

1. Is changing `max` (any of the options below) council-decidable, or owner-reserved?
2. If council-decidable, which option:
   - (a) RAISE by the file's formula: 12.58 × 1.095 = 13.78, rounded down to 13.7,
     with a dated baseline note; the unbuilt gate stays unexercised by CI.
   - (b) RETIRE `max`: the unbuilt surface is never published, so its absolute
     cap describes nothing a consumer receives; remove `max`, keep the unbuilt
     creep line, and keep the built creep line as the enforced surface.
   - (c) RESTORE AS A GATE: add a CI step that packs the unbuilt tree and judges
     it against `max: 11.5`; that step reports over-cap today on every branch
     until payload shrinks or the cap moves.
   - (d) other; state it.
3. If owner-reserved: which interim state is honest for the release?

Answer each part with a choice and a one-sentence reason. No outcome is
expected in either direction.
