<!-- evidence-type: analysis -->

# A retention class is not a placement licence

AI council, 2026-10-14. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present, 2 rounds with blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`layout-allowlist-20261014.question.md`.

## What was asked

`check_council_layout` exited 1 on eleven tracked `council-*` files under
`agents/evidence/` (seven in `analysis/`, four branch-keyed review artefacts in
`reviews/`), and step 3.2 of `road-to-local-gates-wired-while-they-are-green`
asks for its findings to be fixed before it is wired into a required job. Four
options were put: exempt all of `agents/evidence/` (A), exempt `reviews/` and
`audits/` and rename-and-move the seven (B), change nothing (C), or another (D).

## Verdict — 2/2 for D, a narrow allowlist with no renaming

Both seats rejected A on the same argument: `tracked-durable` in
`docs/contracts/agents-layout.md` describes how long a file is kept, not where a
council file may sit, and exempting the whole tree would leave the gate blind to
raw council output misplaced anywhere under it. Both rejected C as leaving a
known-broken gate unwired. Both refined B: move the seven into
`agents/evidence/council/` — the sub-directory the layout contract already
names — but keep their names, because for the three analyses of the council
subsystem `council-` is subject matter, not provenance, and the directory is
the boundary.

The allowlist both seats converged on, and the one the gate now enforces:

- `agents/evidence/council/**`;
- `agents/evidence/audits/**` (the path the skill reference already named);
- `agents/evidence/reviews/council-<branch-slug>.findings.md` only — the review
  naming contract, not the directory;
- the three canonical runtime directories, unchanged.

## Risk both seats named

The narrow form costs a gate edit for every future legitimate home, and a file
move carries reference breakage. The second is mitigated in the same change:
every non-frozen inbound reference was rewritten and `check_references` is green.
Frozen review inputs (`*.review-input/`) and `release-findings/14.22.0.json` keep
the old path, because rewriting a frozen record would make it describe a review
that never happened.

## Not adopted

One seat suggested removing the gate's top-level `agents/audits*` exemption.
It is kept: removing an exemption is a separate tightening with its own blast
radius, and nothing in this change needs it.
