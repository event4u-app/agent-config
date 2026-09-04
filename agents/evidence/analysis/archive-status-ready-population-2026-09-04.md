# `status: ready` under `agents/roadmaps/archive/` — the population

<!-- evidence-type: analysis -->

> Taken 2026-09-04 by `road-to-defect-population-sweeps` 3.3, which expected
> one instance. This is the "or the remaining hits are listed with a reason"
> branch that step's own `verify:` line provides.

## The construct, verbatim

```
grep -rl "^status: ready" agents/roadmaps/archive/ | wc -l
```

**331 before this change. 330 after.**

## What the roadmap expected, and what is there

Step 3.3 reads:

> `road-to-self-description-truth.md:3` carries `status: ready` while sitting in
> `archive/` with every box checked — the roadmap that closed this defect class
> carries an instance of it in its own frontmatter.

That is true of that file, and it is fixed (`status: completed`; 13 checked
boxes, 0 open). But it is not one instance. The full status distribution under
`archive/`:

| status | files |
|---|---|
| `ready` | **331** (330 after this change) |
| `active` | 16 |
| `done` | 15 |
| `draft` | 14 |
| `completed` | 12 (13 after) |
| `complete` | 4 |
| `closed` | 4 |
| `archived` | 2 |
| `in_progress`, `locked`, `superseded`, `active \| deprecated \| superseded` | 1 each |

## Why the other 330 are not being rewritten

Three measured reasons, and the third is the one that matters:

1. **No schema constrains a roadmap's `status`.** There is no
   `roadmap.schema.json`, and no gate requires an archived roadmap to carry any
   particular value.
2. **`minimal-safe-diff` forbids it.** 330 frontmatter rewrites in files this
   change otherwise never touches is the drive-by sweep that rule exists to
   stop — inside a roadmap whose own Risk Register 1 warns against exactly this
   ("a census that turns into a sweep").
3. **They are not 330 mistakes.** `src/agent-src/scripts/archive_completed_roadmaps.ts`
   **moves the file and never touches its frontmatter.** So `status: ready` in
   `archive/` is the archival tool's own normal output. The finding is not that
   331 authors were careless; it is that **a convention was assumed and never
   written down or enforced anywhere.**

## Council

2026-09-04, anthropic + openai, 1 round, quorum 2/2, $0.0342. **Both members
ruled out the 331-file rewrite.** They split on whether to also change the
archival tool to rewrite `status:` on move:

- **anthropic → Option A** (this one): fix the named file, record the
  population, report AC-5 as failed-with-a-finding. Decisive line: *"your
  repository's `minimal-safe-diff` rule outranks this roadmap's acceptance
  criteria. A roadmap acceptance criterion cannot compel violation of a
  repository-wide differential-edit rule."* It called the tool change
  "architecturally superior" but "a scope widening — treat it as post-roadmap
  work, not as AC-5 compliance."
- **openai → Option B**: change the tool, hedged with "consider placing the
  tool modification in a controlled experiment first."

Taken: **A**. The split is resolved by a repository rule rather than by vote —
`scope-control` and `minimal-safe-diff` both forbid a behaviour change to shared
tooling that the task did not name, and openai's own answer hedged on the
change it recommended.

## AC-5 is reported FAILED, not claimed

> **AC-5** — No file under `agents/roadmaps/archive/` claims `status: ready`.

330 files do. The criterion is not met and is not claimed. Meeting it literally
requires either the 331-file sweep both council members rejected, or the tooling
change both treated as out of scope for this roadmap.

## The follow-up this hands off

The durable fix is item 3 above: make `archive_completed_roadmaps` rewrite
`status:` when it moves a roadmap, so the class cannot recur, and let the 330
legacy files age out or be swept deliberately in a change whose subject that is.
That is a behaviour change to shared tooling with its own test surface, and it
belongs to a roadmap that names it — not to this one, which would be smuggling
it in under an acceptance criterion.
