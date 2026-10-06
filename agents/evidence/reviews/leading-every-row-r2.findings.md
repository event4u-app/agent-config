# Completion review — road-to-leading-every-row, round 2, 2026-10-06

**Skipped:** no code surface for this completion — seven changed files, all roadmap prose, one ADR note and one regenerated census; no script, schema, config, workflow or projection is touched, scope bb017d43bcee7e18fb00b7120f499ee4eaaeab6e214d5a6875f56db588b98988, declared 2026-10-06

## Why R2 has nothing to bind to

`git diff --name-only origin/main...HEAD` returns seven paths: five under
`agents/roadmaps/`, one `docs/decisions/ADR-088-*.md`, one regenerated
`agents/evidence/analysis/adr-evidence-census-2026-08.md`. `task sync` and
`task generate-tools` have no input — nothing under `src/` changed, so no
projection moves. Nothing grants an authority, narrows a floor, or changes what
any gate does.

What the change *does* do is record decisions, which is exactly the surface a
code reviewer cannot check and a careful reader can. So the section below is
longer than the skip.

## What a reviewer would catch, recorded rather than hidden

**1 — the weakest call in the change is b6's visibility limb, and it is mine.**
It is recorded as **council-resolved** (D13 of the neighbours lane). But two of
the four seat-opinions put *visibility* on the owner's side of the line while
agreeing on the answer. I recorded it as council-resolved on the ground that the
enumerated owner-reserved set contains no row it matches — it lowers no floor, is
reversible, creates no external commitment, and K16 already decided it once on
evidence still in the tree. That reasoning is in D13 where it can be checked. A
reviewer who weighs the authority split above the substance convergence should
reopen it; the cost of being wrong is one `## Decisions` row, and reversing it
costs nothing but an edit. **No other decision in this change rests on a
contested authority reading.**

**2 — b2 closed on one agent's reading, with no council pass.** It was not in the
council brief: five questions went, b2 did not, because its exit condition
enumerates a record the blocker itself permits and its facts are two literals
(`Owner-set end date: 14.21.0` against `package.json` `16.3.0`). That is still a
single-reader close on an owner-set boundary, and it is the one place in this
change where a second opinion would have cost one line of the brief and was not
bought. Mitigation taken: the record is written temporally, states explicitly
that it does not decide the window stays closed, and the re-arm option is carried
to the owner rather than treated as disposed of.

**3 — the b7 outcome is not the option b7 enumerated, and the deviation is
deliberate.** Option (a) said *replace the sentence*. Nothing was replaced. The
history check (`git log -S'ensure_managed_hooks'`) showed `f1a7644b8` landed
2026-07-07, twenty-six days **after** ADR-088 was accepted — so the premise was
true when written, and "correcting" it would have overwritten the basis the
decision was actually made on. A reviewer should check that the note changes no
sentence, and that it enumerates § 3's federation reservation as untouched; both
are mechanical reads of the diff.

**4 — a second-order effect was surfaced, not absorbed.** The note's dated code
reading moves ADR-088 from `E0` to `E1` in the evidence census, which
`task preflight` caught before the first push. The regeneration is in this change
with its reason in the commit body. The grade rose on a **measurement** — council
markers cannot raise one above `E0` by construction — and per
`decision-revisit-gate` a grade grants nothing, so ADR-088 reopens no further
than the note.

**5 — the easy close on step 3.2 was available again and refused again.** Its
exit cannot reach `:0` whatever the owner answers: two of its four `PENDING` hits
are a fenced instruction block quoting the grep command, and row `D12` of a
different blocker. The narrowed form has been written out since 2026-10-05.
Installing it and flipping the box was one edit away. Both council passes were
asked whether a run may repair its own oracle; one of four refused outright, and
the three permitting seats attached conditions this run cannot meet **inside the
run the oracle gates** — chiefly non-retroactivity, and the observation that a
bare `grep -c` returns `0` for a row that was *deleted*, so the replacement
passes vacuously unless it also asserts each row exists. The box stays `[ ]` and
the defect is documented for a separate change with an independent reviewer.

**6 — two council passes ran where one was budgeted, and the second was my
error.** The first (`--depth deep`) returned to a terminal that showed a quorum
line and no output path, so it read as having produced nothing; a second pass
(`--depth standard`) was launched. The first had in fact written its response.
Both were subscription-transported and billed $0, so the cost was quota
(anthropic 10/50, openai 4/50 at the time) rather than money, and the second pass
is genuinely load-bearing — it is where the 1-of-4 refusal on the oracle question
came from, and two independent passes are a stronger record than one. Recorded
because "it turned out useful" is not the same as "it was intended", and a later
reader should not infer a deliberate two-pass protocol from the artefact.

**7 — one upstream trap cost a wasted call and is already in the memory store.**
The first council attempt returned `0/2 present — INCONCLUSIVE` because
`agents/runtime/state/council-probes.json` is gitignored and absent in a fresh
worktree. It still spent quota. The fix was to copy the probe record in before
dispatching.

**8 — the change created one stale pointer and then fixed it.** Resolving `b1`
left step 3.1's `blocked-by` marker naming a closed blocker. That marker is read
by `run-continuation`, whose regex matches a flipped box as well as an open one,
so a resolved id sitting there is a live wrong pointer rather than a harmless
historical note. Repointed to `b4`, which the owner has still not answered, with
the substitution recorded inline. `lint_roadmap_blockers` passes either way —
the contract does not check whether a cited blocker is still open, which is
worth knowing about that gate.

## What was verified, and with what

- `lint_decision_classes` — green, 21 roadmap files, 0 violations, after each
  Decisions-table edit rather than once at the end. It caught one real defect:
  `resolved by: council` without a record id is not a permitted token.
- `lint_roadmap_blockers` — green, 144 roadmaps blocker-contract-clean, 0 ids
  open in both an active and an archived roadmap, decidability 0 violations.
- `check_adr_frontmatter` — no errors. The three warnings it prints are
  pre-existing partial-supersession notes on ADR-266 and ADR-268, untouched here.
- `adr/evidence_census` — regenerated; the only semantic change is ADR-088's row.
- `agent-config roadmap:progress` — run; produced no diff, which is correct,
  because no checkbox moved.
- `task preflight` on every push.

## What is NOT verified, stated plainly

No council verdict in this change was independently re-run; the records are the
transcripts of the two passes as they came back. The four seat-opinions are two
models over two passes, not four independent reviewers — anthropic and openai
each appear twice, and the second pass saw the first's reasoning under the blind
map, so the opinions are **correlated and not four independent draws**. Tallies
in this change say "seat-opinions" rather than "seats" for that reason, and a
3-of-4 should be read as two models that mostly agreed rather than as a quorum
of four.
