---
complexity: lightweight
review_by: 2026-10-07
---

# Stub: the 14.21.0 findings ledger is ingestible, and the recorded cause is refuted

> **Stub — not active work.** Found 2026-09-07 by
> [`/analyze:inbox`](../../../src/domains/analysis-workbench/analyze/inbox/command.md)
> on round `inbox-2026-09-v`, whose own subject is unrelated. `check_estate_count`
> and every roadmap gate were green; CI was red on a check this change did not
> cause, and reading it rather than handing it back (`fix-what-you-see`)
> produced the refutation below. Recorded rather than repaired for two reasons
> named in § Why this is not fixed here.

> **Arrivals:** 3 — latest 2026-09-07 (release 14.21.0); earlier:
> [`road-to-the-unwritten-ledger.md`](../archive/road-to-the-unwritten-ledger.md)
> (fixed 14.16.0, left the recurrence open) and
> [`road-to-the-ledger-two-releases-skipped.md`](../archive/road-to-the-ledger-two-releases-skipped.md)
> (recorded 14.17.0 + 14.18.0, arrivals 2, archived). Both are archived, so the
> subject has had no live owner since.

## The red

`check_finding_dispositions` fails on `main` at `2c75232fe` — the same SHA every
current branch is based on, so this is inherited and not branch-local:

```
14.21.0 has shipped and carries no findings ledger at
agents/evidence/release-findings/14.21.0.json.
```

Reproduced on `main`'s own run `34134525424`, job `Sync + Generate Tools
Consistency`, identical message. `agents/evidence/release-findings/` holds
`9.14.0`, `14.15.0`–`14.20.0`. `14.21.0` is absent; `package.json` is `14.21.0`.

## What is new — the recorded cause no longer holds

The `14.20.0.json` ledger records a prediction, verbatim:

> so `14.21.0` reproduces this too unless the gate chunks or scopes the diff

That prediction is **refuted**. Measured 2026-09-07:

| Release | self-review outcome | artifact |
|---|---|---|
| 14.17.0 – 14.20.0 | NEUTRAL, HTTP 400 `prompt is too long` (413191 / 450336 / 260998 tokens vs the 200000 cap) | none uploaded |
| **14.21.0** | **`live-advisory :: success`**, run `34130214783`, model call ran 13:57:39 → 14:01:23 | **`self-review-findings`, 11148 B, artifact ID `10021912308`, `expired=false`** |

So the four-release cause — the release-span prompt exceeding the model cap —
was fixed in the window (`worktree-fix-self-review-prompt-budget` and
`feat/release-written-answer-obligation-removed` both carry green
`self-review-gate.yml` runs dated 2026-09-07). The ledger is therefore **not**
missing because the review failed. It is missing because **nobody ran the
ingestion step on a review that succeeded**.

This inverts the disposition. For 14.17.0–14.20.0 the only honest ledger was a
`NOT REVIEWED` null, and writing anything else was the fabricated-empty-ledger
failure that `road-to-the-ledger-two-releases-skipped` ranks first in its Risk
Register. For 14.21.0 a null would be the **false** record: a real review
produced 11 KB of real findings, and they are recoverable right now.

That archived roadmap named its own falsifier and it has fired:

> if run … is shown to contain a completed model call, or an artifact or machine
> block for … is produced, this reason is wrong and the ledger must be
> re-ingested

## What closes it

1. Pull the artifact while it lives —
   `gh api repos/event4u-app/agent-config/actions/artifacts/10021912308/zip`,
   or `gh run download 34130214783 --name self-review-findings`.
2. **Disposition each finding** and write
   `agents/evidence/release-findings/14.21.0.json` <!-- ref-ignore --> from the
   real set, against
   `src/scripts/schemas/review-findings.schema.json`. `assurance` is `reviewed`
   here, not `unreviewed` — unlike its four predecessors.
3. Re-run `./scripts-run src/scripts/check_finding_dispositions --release 14.21.0`
   and confirm it exits 0.
4. Correct the `14.20.0.json` prediction in place rather than leaving it
   standing, since its mechanism claim is what a later reader would inherit.

## The perishable part

The artifact is the only copy of the review's output, and it is the first one
that has ever existed for this defect. Artifact retention is finite and the
window opened 2026-09-07T14:01. Every earlier arrival of this subject was
unrecoverable *because nothing had been produced*; this one is recoverable and
will stop being so. `review_by` above is set inside the plausible retention
window for that reason and not as a courtesy — past it, this stub is a record of
a fix that was available and expired.

## Why this is not fixed here

- **Dispositioning real findings on a shipped release is owner work.** The gate
  is named `Blocking review findings dispositioned`. Deciding accept / fix /
  defer per finding is a release judgement, and burying it inside a PR about
  reasoning-layer roadmaps would hide a release decision in an unrelated change
  (`minimal-safe-diff`).
- **A parallel session holds the adjacent surface.** `self-review-gate.yml` and
  the release obligation text were both edited on 2026-09-07 by
  `feat/release-written-answer-obligation-removed`, which was live at the time
  of writing. Writing a ledger from a second branch risks recording a cause
  their change has already moved.

## Why a stub and not a roadmap

Three arrivals of one subject argue for a live owner, and two of the three steps
above are single commands. What makes it a stub rather than an active roadmap is
step 2: it needs a human to read findings and decide, so an active roadmap would
sit on that decision with nothing an autonomous run may do. Promotion is a move
up one directory plus the complexity frontmatter — and if the artifact has
expired by then, the honest promotion is a `NOT REVIEWED — artifact expired`
ledger plus the reason, which is a strictly worse outcome than acting now.
