---
complexity: lightweight
review_by: 2026-09-25
---

# Stub: road to a code-graph benchmark re-run on the repaired extractor

> **Stub — not active work.** A **drain-run transfer**, not a demand-gated stub.
> Created 2026-08-26 when
> [`road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh`](../archive/road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh.md)
> was drained: its last open step needs **four SHA-256-pinned input files that
> live outside the public tree and three external repository clones**, none of
> which this environment holds or can synthesize. The work could be neither
> completed nor honestly cancelled, so it is transferred. Framework of record:
> [`drain-blocker-dispositions-b.md`](../../evidence/council/drain-blocker-dispositions-b.md).
> Outcome state recorded on the parent: **transferred** — chosen so that
> "archived" can never read as "achieved".
>
> **Transferred, not completed; no re-run was performed.**

## The criterion, verbatim from the parent

Quoted whole rather than summarised, because the whole point of a transfer is
that the next reader does not have to reconstruct it.

> **3.1 Re-run the benchmark on the current build.**
> This is the archived extractor-defect roadmap's unfinished half. It is
> gated on `b-bench-inputs-absent` below; if that blocker resolves, this
> step runs unedited — no threshold is renegotiated after the repair.
> `verify:` `internal/bench/reports/code-graph-vs-grep.{md,json}` carries a
> second run with its own date, and the delta against the 2026-07-28 figures
> is stated whichever direction it goes.

And the blocker it is gated on, also verbatim:

> ### b-bench-inputs-absent — the harness cannot run here
>
> - **Status:** open
> - **Owner:** maintainer
> - **Blocks:** 3.1
> - **What to do:** pick exactly one — (a) supply the three SHA-256-pinned question
>   files under `agents/tmp/bench-local/` and local clones of the three benchmark
>   repositories, and run the harness unedited; or (b) re-pre-register a smaller
>   benchmark against corpora this repository already contains, accepting that its
>   numbers are not comparable to the 2026-07-28 run and saying so in
>   `docs/CLAIMS.md`; or (c) mark `claim:code-graph-retrieval-null` as measuring a
>   superseded build, leave the figures untouched, and make no new claim.
> - **Resolved when:** one of the three is recorded, and if it is (c),
>   `docs/CLAIMS.md:423` says which commit the figures describe.
> - **Recommendation:** (a) — it is the only option that answers the question the
>   repair raised, and the inputs are pinned rather than lost. (c) is the honest
>   fallback and is strictly better than leaving a stale verdict unqualified.
> - **If you do nothing:** the package keeps publishing a `backed` claim whose
>   measurement predates the fix it blames, which is the exact defect
>   `road-to-published-number-truth` exists to stop, on a surface that roadmap's
>   population does not reach.

Disposition **(c) landed on the parent** — `docs/CLAIMS.md` gained a
`measured_on:` field, parsed by `check_claims` and printed as a column in
`docs/proof.md`. **(c) scopes the stale figure; it does not answer the
question.** That is what moves here.

## What moves here — the complete list

| Item | Parent location | Why it moves |
|---|---|---|
| The benchmark re-run itself | Phase 3 step 3.1 | Needs four pinned input files and three external clones. Neither exists here. |
| Blocker `b-bench-inputs-absent`, options (a) and (b) | `## Blockers` | (c) landed. (a) needs the inputs; (b) needs a fresh pre-registration and is explicitly NOT a replacement (below). |
| AC-5's second half | Acceptance criteria | AC-5 reads "either carries a second measurement **or** states which commit its figures describe". The second branch was satisfied; the first is this stub. |
| The maintainer irrecoverability determination | Named by a council seat, owned by nobody | Whether the private inputs are recoverable at all. Only a maintainer can answer it, and the answer either retires this stub or approves a separately named non-comparable benchmark. |

Nothing else transfers. Steps 1.1, 1.2, 1.3, 2.1, 3.2 and 3.3 all landed with
evidence — see the parent's `## Outcome`.

## Why the inputs are external — the structural reason, not an accident

The four files are bound by SHA-256 in
[`internal/bench/code-graph/PREREGISTRATION.md`](../../../internal/bench/code-graph/PREREGISTRATION.md)
lines 44-52, which states they *"contain internal repo paths and therefore live
OUTSIDE the public tree"* and that *"any post-registration edit changes the hash
and voids the run"*.

The three corpora are **private third-party repositories** — a Laravel monolith,
a client-facing legacy repo, and a frontend — carrying proprietary code that
cannot be published, vendored, or synthesized. This is why the blocker is
**structural rather than temporary**: no automation in this repository can
produce them, and no amount of maintainer effort inside this repository will
change that. Recovery is an act outside the tree.

## Producer and probe — named, not wished

- **Producer:** the **maintainer**, operating a machine that holds both the four
  pinned input files and local clones of the three registered corpora. That is
  the named party; nobody else has read access to the corpora, and a substitute
  corpus produces a different measurement (see § Why a substitute cannot close
  this).
- **Probe — four readings, all cheap, all `[ -f ]` tests plus one hash check:**
  1. `agents/tmp/bench-local/repo-a-questions.yaml` exists **and**
     `shasum -a 256` reads `3355305af382ca7ae24e97b3dd92c9a5c6d014d13380f34660d1e5221f5c15af`.
  2. `…/repo-b-questions.yaml` → `a5c8abf09ab0515b52c16dc4798f9e3a9ae0e5550f74769811a0f52098ce6161`.
  3. `…/repo-c-questions.yaml` → `41389a46be59f0dc17fe92232b0bd65fd25e0d64ca4eef94bd68b5c4e70c0336`.
  4. `…/probes.yaml` → `284cea15b5a869dc0628d51a431151e8fe3ff693fe53d1720363b8fd8158e24d`.

  Plus the corpus reading, which is not a hash: local clones of all three
  registered repositories are present and readable at paths `run_bench.ts` can
  be pointed at.

  A hash MISMATCH is not a pass with a caveat — it voids the run by the
  pre-registration's own terms, and the correct response is to stop, not to
  re-pin.

- **Measured on THIS machine, 2026-08-26, so a later reader can tell real
  movement from noise** — every reading is the absent-input control, recorded to
  make the gap explicit rather than to pretend it is data:
  - `agents/tmp/bench-local/` — **does not exist**, in this worktree or in the
    maintainer's main checkout.
  - `find /Users/mathiasberg/projects -maxdepth 6 -name 'repo-?-questions.yaml'`
    → **0 results**. Same search for `probes.yaml` → **0 results**. So all four
    pinned files read **absent**, not stale.
  - Clones of the three corpora: **none reachable**. The corpus identities are
    anonymized in the pre-registration and no path to any of them exists in this
    environment.
  - `internal/bench/code-graph/run_bench.ts` — **present**. The harness is not
    the missing piece; only its inputs are.
  - `git log --oneline -- internal/bench/reports/code-graph-vs-grep.md` →
    **exactly 1 commit**, `297fe9db4`, the original 2026-07-28 run. No second
    run has ever been recorded.
- **Nothing but the pinned inputs plus the three clones moves this stub.** A
  different corpus, a synthesized fixture set, or a re-derived question file all
  produce a measurement of something else.

## Carried forward so the reasoning is not lost with the parent

**The figures this stub exists to replace, and the threshold they failed.**
From `internal/bench/reports/code-graph-vs-grep.md:16-24`, run 2026-07-28:

| Metric (mean) | grep | code graph |
|---|---|---|
| Graph-shaped recall | 0.797 | **0.365** |
| Graph-shaped precision | 0.670 | **0.413** |
| Negative-control recall | 0.833 | **0.111** |

Recall delta **−43.2 pp** against a pre-declared **+10 pp** win threshold;
precision had to land within 5 pp and controls at ≥ 90 % of grep's recall. All
three conditions failed. **The re-run does not renegotiate any of them.**

**Why the re-run matters at all.** The report's own named root cause —
TypeScript arrow-function exports producing no symbol nodes — was **repaired on
2026-08-22** by `f3c2ce814` (`extract.ts:309-371`, `:372-395`). The published
verdict therefore measures a build that no longer exists, and the parent's
2026-08-26 pass improved the extractor further: `EXTRACTED` edges went
**89,452 → 99,022** and a named false positive was removed. One council seat
noted those gains make the old figure *more likely pessimistic* rather than
less — **which is a reason to re-run, not a reason to assume the outcome.**

**Extraction quality is not retrieval quality, and the council was explicit.**
The +9,568 edges are an EXTRACTION measurement; `claim:code-graph-retrieval-null`
is a RETRIEVAL claim. Nothing in the parent's closing change is evidence about
retrieval, and reading it as such is the exact substitution the prior council
refused.

**The question set, so a promoter knows what they are re-running.** 18
questions across the three repos: impact analysis (7), call path (3), symbol
ownership (2), refactor scope (2), hidden/dynamic dispatch (3, including one
cross-language seam), and grep-optimal negative controls (3, one doubling as the
cross-language literal). Two arms, no per-question tuning, zero model calls.

**What the prior council ruled, and why this stub is not a contradiction of it.**
AI council 2026-08-26 (2/2 convergent) ruled that step 3.1 must **not** be marked
done: *"closing 3.1 would convert 'cannot measure' into 'measured' when the
question is still answerable, just not here."* A transfer marks it `[~]`
**deferred and unmet** — it does not claim the measurement happened. The second
council (2026-08-26, 2/2 convergent on transfer) addressed the point directly:
the prior ruling forbade evidentiary completion, and this is a work-item
placement. One seat observed that the prior ruling had already named this
closure shape — *"an indefinitely blocked step becomes misleading operational
debt when its private inputs may never be recovered"*.

## Why a substitute cannot close this

Option (b) of the parent's blocker — a smaller benchmark against corpora this
repository already contains — was refused by both seats of the first council and
re-confirmed by the second: **different corpora destroy the comparability that
makes the re-run worth doing.** The 2026-07-28 figures are only meaningful as a
before-value if the after-value measures the same questions against the same
code.

A non-comparable in-repo benchmark **may be pursued independently under a
distinct claim id**. It neither replaces this obligation nor closes this stub.
The second council was explicit on the boundary: *"a new non-comparable benchmark
alone does not satisfy this condition."*

It was not chosen NOW for one reason, recorded so a later reader does not re-open
the question: the value of this measurement is the delta, and a fresh
pre-registration against different code has no delta to report.

## Promotion gates

The README's shared promotion criteria (recruited customer, funded security
audit, ADR sign-off) **do not govern this stub** — see that file's
§ The two classes. These do:

1. **All four pinned files present with matching SHA-256**, at
   `agents/tmp/bench-local/`. A mismatch voids the run rather than qualifying it.
2. **All three registered corpus clones readable** on the same machine.

Gate 1 AND gate 2 — either alone is insufficient. Pinned questions with no
corpus have nothing to query; a corpus with unpinned questions is a different
benchmark wearing this one's name.

## Closing in the other direction — the honest-null path

A drain-run transfer closes when its criterion is satisfied **in either
direction**. The null direction here is a **maintainer determination that the
inputs are irrecoverable** — the private corpora are gone, access lapsed, or the
pinned files cannot be reproduced. That determination:

- closes this stub, and
- either retires the re-run obligation outright, or approves a separately named,
  explicitly non-comparable benchmark under its own claim id.

Recording that determination is a complete outcome and needs no measurement.
What is **not** a complete outcome is leaving it unanswered indefinitely, which
is the operational debt this transfer exists to make visible rather than hide.

## Seed content on promotion

- Verify all four hashes **before** running anything. A mismatch stops the run.
- Run `internal/bench/code-graph/run_bench.ts` **unedited**, against the three
  clones. No threshold is renegotiated after the repair — that is stated in the
  parent's step text and is the point of a pre-registration.
- Write both outputs: `internal/bench/reports/code-graph-vs-grep.md` and
  `.json`, each carrying its own run date, **without overwriting** the
  2026-07-28 figures — the delta is the deliverable.
- State the delta against 2026-07-28 **in whichever direction it goes**. A second
  null is a legitimate outcome and closes this stub as legitimately as a win.
- Then update `claim:code-graph-retrieval-null` in `docs/CLAIMS.md`: clear or
  re-scope `measured_on:`, refresh `last_verified:`, and state the new figures.
  If the re-run confirms the null on the repaired build, the claim's consequence
  bound (`code_graph.enabled` stays false by default) is re-established on
  current evidence rather than on a superseded build.
- Re-read `docs/decisions/ADR-246-code-graph-parsers-stay-devdependencies.md`
  first. It records that a better graph is still a graph no consumer can load,
  and that an EXTRACTION improvement is explicitly not a trigger to revisit the
  packaging choice. A retrieval win would be a different matter — that record
  names the conditions.
