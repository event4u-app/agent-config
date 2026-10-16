<!-- evidence-type: analysis -->

# Lineage gate: split on where the quote strip lives, agreed on direction

AI council, 2026-10-16. anthropic/claude-sonnet-4-5 + openai/codex-default,
2/2 present after the run, blind peer review, `$0.00` (both seats
subscription-authed). The prompt is committed verbatim beside this file as
`lineage-gate-parse-and-direction-20261016.question.md`. Raw response:
`agents/runtime/council/responses/lineage-gate-parse-and-direction-20261016.md`
(local, gitignored). For `road-to-gates-that-read-what-was-written`, steps
1.1, 1.2, 2.1, 2.2.

## Q1 — split

- **openai — (b).** AC-1 is a helper contract; strip one matching quote pair
  inside `normalizeParent`, both around the whole input and around the
  selected token, and remove the global strip at `:168`.
- **anthropic — (a) for this roadmap.** On the merits it preferred
  centralising, but held D1 and the roadmap's "does not touch `normalizeParent`
  itself" as the binding constraint, and recommended amending AC-1's wording to
  the integration-level test that was built.

A split is not a decision. What landed is the one change both seats accept as
correct on its own: `:177` strips quotes as `:168` does (D1, as written). The
helper-level clause of 1.1 / AC-1 is **not built** and stays open; reopening D1
is the transition that would settle it.

## Q2 — convergent, option (b)

Both seats: a sibling is downstream of the consolidating file when it names
that file in `supersedes:`, `supersedes_proposals:`, or a `relates:` entry whose
`relation` is in an allowlist of exactly one value, `extends` — the only
directional value with evidence in the corpus. Option (c) (any mention) was
rejected by both: `references`, `disjoint` and the like do not state direction.
Option (a) knowingly leaves a false positive. Required inverse cases: an empty
supersession key, `extends` over another file, and a non-directional relation
over the file all still report.

## Slug-shaped versus prose — convergent, then widened on measurement

Both seats proposed a canonical `road-to-*` lowercase grammar. Implemented
wider, `^[A-Za-z0-9._]+(?:[-_][A-Za-z0-9._]+)+$`, on two facts the seats did
not have: the gate already supports non-roadmap parents
(`deep-plan-2026-09-30.md`, pinned by an existing test), and the archived
estate carries names with dots and capitals (`road-to-6.0.0-…`,
`…-HUMAN-MEASUREMENT`). Every `road-to-*.md` basename under `agents/roadmaps/`
and the test fixtures matches it; the prose ghost normalises to `AC`, which
does not.
