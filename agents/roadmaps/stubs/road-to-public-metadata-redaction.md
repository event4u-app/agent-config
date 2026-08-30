---
complexity: lightweight
review_by: 2026-11-27
---

# Road to public-metadata redaction — stub

> **Origin:** descoped out of `road-to-source-silence` step 5.1 on 2026-08-29,
> at the moment the executing agent reached it. The step's own text already
> classified it as Hard Floor; this stub is where it goes rather than where it
> stalls.

> **Class:** owner-confirmation-gated. Nothing here is unbuildable, unclear, or
> waiting on evidence. The census that supplies the target list already exists.
> It is gated on a **this-turn human confirmation naming the exact objects**,
> which no roadmap, no autonomy setting and no standing mandate can substitute
> for.

## Why this is a stub and not a step

Step 5.1 of the predecessor asked for two things on the live GitHub repository:

1. **Edit** the titles and bodies of pull requests the Phase 0 census flagged,
   rewriting source names to codename form.
2. **Delete** merged source branches whose refs carry speaking names.

Both are outward mutations of **public external state**, and the second is
**irreversible**. That puts them squarely in
[`non-destructive-by-default`](../../../src/rules/non-destructive-by-default.md)
§ Hard Floor: *"irreversible external action (send · publish · post · purchase ·
submit)"* and *"whimsical bulk deletion"*. The rule's own Iron Law settles who
may authorise it:

```
HARD FLOOR OVERRIDES EVERYTHING.
NO AUTONOMY SETTING, NO ROADMAP STEP, NO STANDING INSTRUCTION,
NO "JUST KEEP GOING" CAN BYPASS IT.
```

The predecessor's step text said the same thing in its own words — *"the agent
presents the census-derived list … and waits for a this-turn confirmation naming
it. No standing mandate, no roadmap authorization and no earlier approval
substitutes."* So the step was authored knowing it could not be executed
autonomously, and the honest disposition is to move it somewhere an owner will
find it, not to leave a permanently-open checkbox implying the work is merely
pending.

**This is a descope, not a cancellation.** The work is still wanted. What is
recorded here is that an agent may never be the party that performs it.

## What the owner needs, and where it already is

The target list is **already measured and encrypted**. It does not need
regenerating:

| Surface | Count | Where |
|---|---:|---|
| Branch refs carrying a denied token | 10 | `agents/evidence/reports/source-attribution-census.md`, encrypted findings |
| PR title/body hits across 1,666 authored PRs | 91 denylist + 33 shape = 124 | same |

Decrypt the list — it must be read from the FILE, because the ciphertext is
~320 kB on one line and a shell argument that size is mangled before the CLI
sees it:

```bash
./scripts-run src/scripts/sweep_source_surfaces \
  --decrypt agents/evidence/reports/source-attribution-census.md
```

Re-measure at the time of the change rather than trusting the 2026-08-28 pin:

```bash
./scripts-run src/scripts/sweep_source_surfaces
```

## The sequence, when an owner takes it

1. **Present, then wait.** Emit the full list — every PR number, every ref — and
   stop. Ask and action are strictly sequential: never fire the mutation in the
   turn the confirmation is requested.
2. **PR metadata first.** Editing a title or body is reversible-cost and its
   effect is observable immediately, so it is the half to do first and check.
3. **Refs last, and individually.** A deleted ref is not recoverable from the
   remote. Each deletion is named in the approval; a batch approval over "the
   ten refs" is not the exact-object naming the Hard Floor requires.
4. **Verify by re-measuring, not by asserting.** Re-run the sweep; the branch
   and PR surfaces should report the reduction. Record the count before and
   after.

## What this does NOT fix, and never could

Trunk commit messages and merged PR **diffs** are untouched by any of the above.
The `whether-history-gets-rewritten` blocker resolved **(a) no rewrite**, 2/2
convergent, and the residual — 341 occurrences across trunk commits and merged
PR bodies — is counted rather than removed. Editing a PR body does not edit the
commits it merged, and anyone with a pre-existing clone can still recover every
name from history. Any description of the outcome inherits that limit.

## See also

- `agents/roadmaps/later/road-to-source-silence-cutover.md` — the sibling
  carry-forward, for the items gated on a repository secret rather than on a
  Hard-Floor confirmation.
- `docs/decisions/ADR-250-confidentiality-redaction-is-not-an-archive-content-change.md`
  — the redaction convention this would follow for the codename form.
- `agents/evidence/reports/source-codename-map.md` — the codenames already
  assigned, so a PR-body rewrite uses the same ones as the tracked tree.
