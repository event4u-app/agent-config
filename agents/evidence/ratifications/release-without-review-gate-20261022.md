---
proposed_by: the repository owner, in session on 2026-10-22 ("Releases brauchen kein Owner Review … Releases sollen einfach online gehen")
implemented_by: claude-opus-5.5 session on fix/release-without-review-gate
reviewed_by: AI council, 2 seats, provider-diverse (anthropic + openai), rounds 1-4 of 2026-10-22
providers: [anthropic, openai]
verdict: ratified
seats:
  anthropic: ratified
  openai: ratified
effective_after: merge
subject: 33103e6109c27efbd46f16a428042dbb2856036c50f50c1d71e591a883c84ef8
---

<!-- evidence-type: ratification -->

# Ratification — a release waits for no review ledger

`check_kernel_edit_ratified` gates one file on this branch,
`.github/workflows/consistency.yml`, because that workflow also runs the
ratification gate. The ratification step itself is not touched. The `subject:`
digest above covers that file, computed with
`./scripts-run src/scripts/ratification_subject --files .github/workflows/consistency.yml`.

## What was ratified

The owner decided on 2026-10-22 that a release must not wait for a self-review,
because every commit on main is already reviewed and merged before a cut. The
17.0.0 release stopped for a day at `release.ts` step 7 on a findings ledger
whose review never finished, and was then published without one. The change:

- `release.ts` step 7 no longer reads the ledger; the step stays numbered.
- `release-validation.yml` loses the `finding-dispositions` job.
- `consistency.yml` loses the step that refused a shipped version with no ledger.
- `self-review-gate.yml` loses the two jobs that built a ledger and pushed it
  onto the release branch with `RELEASE_PR_TOKEN`; no job in it writes any more.
  The review stays advisory.
- `check_finding_dispositions` reads an absent ledger as empty, shipped or not.
  The consistency coverage guard still executes it, so a committed ledger must
  remain valid.
- The unused ledger helpers, the release drill's ledger scenarios, the docs and
  the cancelled steps of `road-to-hook-guards-that-hold-17-findings` follow.

## The review

Four rounds, prompts committed beside the council record:
`agents/evidence/council/release-without-review-gate-ratification-r1-20261022.question.md`,
`-r2-`, `-r3-`, `-r4-`.

- **Round 1:** anthropic `ratified`, openai `refused` on documentation the
  change had made false — the gate's `EMPTY_VALID` evidence, the `--ingest`
  message, `docs/succession.md`, a comment in `check_release_pr_shape.ts`, the
  override doc, and a test comment contradicting the config notes. Fixed in
  `docs: say everywhere that a release waits for no review ledger`.
- **Round 2:** anthropic `confirmed-non-expanding`, openai `refused`; both named
  "no workflow runs it as a gate" as false while the coverage guard executes the
  check. Replaced with the seats' wording.
- **Round 3:** both `refused` on two remaining "no gate waits for it". Fixed.
- **Round 4:** both `ratified`, no remaining defects named.

Both seats stated in round 1 that the change does not touch the ratification
gate, branch protection or any security gate, and that removing the two
repository-writing jobs reduces token and write exposure.
