<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-22, committed verbatim so the
     verdict beside it can be checked against what was actually asked
     (evaluator-independence). Not edited after the run. -->

# What should the published npm description and README headline say about claim checking?

Repository: event4u/agent-config, a governed skill/rule/command suite published to npm.
Release under preparation: 17.0.0. A two-seat release council ruled this item must
be closed before the cut: "Machine-checking a claim's status is not
machine-checking the claim; the published headline is materially misleading while
entries remain unbacked."

## The current wording, on three public surfaces

- `package.json` description (the npm listing): "Governed skills, rules and commands
  for AI coding tools (Claude Code, Cursor, Windsurf, Copilot) — every claim
  machine-checked, including the artifact counts in these badges."
- `README.md` H1: "Agent Config — every claim machine-checked, including the
  artifact counts in these badges"
- `README.md` body: "Every public claim in this README is machine-checked —
  [verify it yourself](docs/proof.md)."
- (The docs site's description says "every claim machine-checked, including zero
  runtime" — a phrasing whose underlying claim `no-runtime-daemon` was WITHDRAWN
  on 2026-08-27.)

The headline was chosen on 2026-07-04 as the package's positioning ("verifiability
as frame"), adopted from a council option. Whether the owner chose it personally
is not recorded.

## What the ledger and gate actually do

- `docs/CLAIMS.md` says: "Only markered claims are enforced. Unmarkered prose is
  never checked." A sentence carrying `<!-- claim:<id> -->` must bind to a
  `status: backed` entry with a resolving evidence pointer, or `check_claims`
  refuses the build.
- Ledger today: 116 entries — 60 backed, 43 unbacked (documented debt), 4
  measured-in-repo (finished readings taken in the maintainer tree, not where a
  consumer stands), 8 resolved-null or withdrawn, 1 in another status.
- Backed entries mostly use a "pointer" form (the evidence file exists and
  contains a substring); 22 of the 60 use an `exec:` form whose command's exit
  code re-derives the claim. `internal/reports/exec-evidence-feasibility.json`
  records `machine_re_verifiable_today: 0` at its 2026-07-25 classification pass.
- The badge counts are re-derived by `update_counts --check`, which does refuse
  the build on a one-off count.

## The governance rule

`decision-revisit-gate` reserves to the OWNER any transition that "creates /
removes / weakens a ... public commitment"; the council decides everything else,
including strengthening and equivalent swaps above a floor.

## The question

1. Is replacing the wording with one that states exactly what the gate does a
   WEAKENING of a public commitment (owner-reserved), or a correction of an
   inaccurate public statement toward what the code shows (council-decidable)?
2. If council-decidable, which replacement? Candidates, any may be amended:
   - (a) "— every markered claim bound to a build-checked ledger, including the
     artifact counts in these badges."
   - (b) "— public claims bound to a ledger the build checks, including the
     artifact counts in these badges."
   - (c) keep the headline and back it: mark every claim-shaped public sentence
     and refuse the build on unmarkered ones (state whether that is feasible
     before the 17.0.0 cut).
   - (d) other; give the exact text.
3. If owner-reserved: what interim state is honest for the release without
   taking the owner's decision?

Answer each part with a choice and a one-sentence reason. No outcome is
expected in either direction.
