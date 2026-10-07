<!-- evidence-type: analysis -->

# What does a rebase do to the commits a completion review cites?

> Council record for `road-to-a-rebase-that-leaves-a-way-back` step 3.4. Run
> 2026-10-07. Verdict: option (b) — under a strategy other than `merge` the
> completion review binds after the last rebase, and a review taken before a
> rebase is re-bound after it. Written into `docs/contracts/plan-review-gates.md`
> § 2.5.

## Attendance, honestly

Two seats answered, from two providers: `anthropic/claude-sonnet-4-5` and
`openai/codex-default`, both over the CLI transport on a subscription, billed
$0.00. The run reports `rounds: 2` and a concluded quorum of 2 of 2 present;
each seat's answer refers to the other's earlier-round position as "Reviewer
A" / "Reviewer B", so this is a two-seat convergence after one exchange, not two
isolated readings. The run file also carries an `absent_members` line naming the
anthropic member as unavailable by a live probe, while the same run holds an
answer from that seat; the line is reproduced here rather than reconciled.

## The question

A `fixed` row in a findings file cites a commit by SHA. A plain rebase rewrites
the findings file's first-add commit and every cited fix, so the gate fails
`fix-before-artifact` locally and `unresolvable-fix-ref` in a transport clone
(measured, and pinned by `tests/scripts/check_completion_review_after_rebase.test.ts`).
Three options, the gate's strictness unchanged in each:

- **(a)** the documented path re-points the `fixed` refs of the branch's own
  findings file through commits whose stable patch ids match, in a commit of
  its own;
- **(b)** under a strategy other than `merge` the completion review binds after
  the last rebase;
- **(c)** only a conflict-free rebase whose patch ids all match may re-point;
  anything else re-binds.

## Verdict — both seats chose (b)

**`anthropic/claude-sonnet-4-5`.** A findings row citing a commit is a claim
about that commit object; re-pointing it because a patch id matches converts a
reviewed fact into an inferred equivalence — "evidence laundering, not evidence
preservation". The gate's ancestry check also proves an order, findings before
fixes, which a rewrite destroys whatever the patch ids say. The "review churn"
objection to (b) is answered by the order of work: rebase first, review after,
and a post-review rebase is the rare case. Tooling may assist — propose a
mapping, mark conflicted rows — but the human confirmation is what makes it
evidence.

**`openai/codex-default`.** Agreed with (b) under a stricter definition of
"re-bound": an explicit, attributable attestation, not an automatic edit. It
disagreed with one framing: editing version-controlled evidence by tool is not
improper in itself; the violation is letting that edit stand in for an
attestation. It also held that a unique stable patch-id match is strong
evidence of patch-text equivalence — but not of correctness against the new
base, which is the decisive limit. Its sharpest point: the gate proves two
properties — the finding existed before its fix, and the cited fix belongs to
the history being accepted — and patch ids reach neither for the rewritten
history.

## The refinement both seats agreed on

Tooling MAY PROPOSE an old→new mapping from unique, one-to-one stable patch-id
matches, as a clearly labelled draft for the re-binding reviewer. It must never
write that mapping into a findings file as accepted evidence. Patch-id
correspondence is not completion evidence, and a pair is never inferred from a
subject, a timestamp or a position.

## Rejected, and why

- **(a)** silently promotes correspondence to attestation: matched rows acquire
  authoritative-looking citations nobody attested to. It also needs rules for
  duplicate patch ids and for commits that become empty, split, squashed or
  reordered.
- **(c)** is false assurance from a weak global condition: a conflict-free
  rebase whose patch ids all match still proves patch-text equivalence, not
  correctness against the new base, and duplicate patch ids can make the
  mapping non-unique.

## Revisit if

A portable rewrite-provenance record exists **and** equivalence of the
resulting reviewed state can be shown — not merely equality of individual
patches.

## What was built

`docs/contracts/plan-review-gates.md` § 2.5 and
`src/skills/git-workflow/references/branch-update.md` state the order;
`tests/scripts/check_completion_review_rebase_remedy.test.ts` shows the gate red
after a rebase and green after a re-bound review, and refusing a record that
keeps the pre-rebase citation. No tool edits a review record, and no mapping
proposer was built: the contract permits one, nothing requires it.

The raw responses are a gitignored runtime artefact and are not committed; the
substance of each seat's answer is reproduced above.
