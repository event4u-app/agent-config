# Completion review — no issue left open without a decision

**Skipped:** no code surface for this completion — the diff is two authoring documents, one gate-state list and one byte-identical projection, and the gate itself measures zero code paths of five changed files, scope 7b09a7ae1113f68e5cd16e68c94bdbac95c3a4eb1dbfef19aec025fd539bdd7f, declared 2026-08-12

## Why a skip rather than a review

The change edits `src/rules/active-remediation.md` and its mechanics guideline,
adds one row to `docs/contracts/rule-interactions.yml`, removes one entry from
`src/config/rule-enforcement-baseline.json`, and regenerates
`dist/agent-src/rules/active-remediation.md` from the rule. No script, no hook,
no schema, no test. `check_completion_review` classifies the diff as zero code
paths of five changed files, which is exactly the condition this declaration
covers.

The JSON is the one file that could be mistaken for code. It is a gate-state
list — the shrink-only baseline of rules that predate
`lint_rule_enforcement_declaration` — and the gate that reads it was run on this
branch and reports the shrink it expects (84 → 83, no stale entry).

## What replaces a code review here

Each falsifiable claim in the diff was checked against the thing it describes,
not asserted from memory:

- **The hole is in the rule text, and was read there.** The Iron Law's first
  line, "AT MINIMUM, NOTE IT", is satisfiable by prose alone; the third line's
  "NOTE IT … THEN ASK" never states that the note without the ask is
  non-compliant. Nothing else in the rule or its mechanics closed that, so
  note-as-discharge was a legal reading of the file before this change, not a
  misreading of it.
- **The trigger set genuinely excluded failing checks.** The "what to remediate"
  list was code-shaped — security gaps, coverage, dead code, duplication, stale
  idioms — with no member a red gate or a lint batch matches. The extension is
  additive; no existing category changed meaning.
- **The precedence claim is registered, not implied.** The new rule line naming
  `no-cheap-questions` with "subordinate to" is exactly what
  `lint_rule_interactions`' closure check detects between two declared
  participants, and both slugs are in the register's `rules:` list. The row was
  added in the same commit; the linter reports 30 pairs and passes.
- **The enforcement line claims nothing it cannot hold.** `enforced_by: none`,
  with the structural reason: the note, the ask and the user's decision are all
  prose, and the issue set is whatever the agent happened to see, so no gate can
  separate a discharged issue from a mentioned one. The declaration also moves
  the rule off the legacy baseline rather than adding a claim to it.
- **The new obligation does not contradict a standing user preference.** The
  package records "no proactive quality tools — remote CI gates only". The
  clause is therefore bounded to output the agent already has in hand, and says
  so in the rule body; it creates no obligation to run a check.

Gates green on this branch: `task preflight` (22 gates, including
`check_condensation`, which asserts the projection is byte-identical to the
rewritten source, and `lint_regression`), `lint_rule_enforcement_declaration`,
`lint_rule_interactions`, `validate_frontmatter` (436 artefacts),
`check_references`, `check_rule_projection_integrity`, `check_md_language` on
the three touched markdown files, `lint_hidden_unicode`, `skill_linter
--changed` PASS on the projected rule, and
`vitest tests/scripts/{cmd_route_explain,explain_run}.test.ts` (32 tests).

## Re-bound after the token-budget commit

The first push went red on `check_token_regression` — `eager_rule_load` 106,928
against a 101,670 baseline, +5.2% over a +5% cliff — and the re-bind records how
that was decided, because the cheap answer was available and was not taken.

The contribution was measured rather than assumed: the projected rule grew from
1,101 to 2,032 tokens with `token_count.gpt_tokens` (exact BPE), and it is the
only projected rule in the diff, so `main` stood at 105,997 — **+4.26% of a +5%
budget before this branch existed**, and the overshoot was 174 tokens.
`--update-baseline` would have cleared the red in one command and re-anchored
that inherited 4.26% into a number nobody chose, which is what the package's own
re-anchor discipline warns against. Instead the explanation moved to the
mechanics guideline (not part of `eager_rule_load`) and the obligation stayed in
the rule: delta 931 → 707, surface 106,704, +5.0%, green with 49 tokens of slack.

That slack is a finding and is stated as one: the next non-trivial edit to any
always-loaded rule crosses this cliff regardless of its own size. The decision it
needs — re-anchor, or scope rules with `paths:` — is a maintainer's, not a thing
to absorb inside an unrelated PR.

`check_standing_rule_delivery` is red on this branch (191,901 tok / 110,000) and
red on `main` at the same commit (185,207 tok) — a local install topology where
both the global and project rule layers are present, which CI does not
reproduce. It is surfaced to the maintainer rather than folded in silently; the
gate's own remedy (`agent-config install --layer=…`) changes the developer's
machine, not this repository.

## Standing caveat

A skip declaration is a statement about the diff's surface, not a claim that the
prose is right. The strongest objection to this change is that it adds an
obligation nothing can enforce to a rule that already had one — if the ladder
was being read as note-OR-ask before, a stronger sentence in the same file is
not obviously the thing that changes it. The counter is that the previous text
was genuinely ambiguous rather than ignored, and that the two additions with
real teeth are the ones that are not exhortation: the failing-check category
gives the ladder something to fire on that it previously had no member for, and
the option anatomy makes a compliant ask concretely describable instead of a
matter of taste. Whether the rate moves is unmeasured, and is not claimed.
