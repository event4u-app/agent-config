<!-- evidence-type: analysis -->

# Completion-review severity by round

Measured 2026-10-21 against `main` `8d69deaf7`, for step 0.1 of
`road-to-a-review-that-ends`. It re-derives the table that roadmap's Context
row F4 took from a supplied plan, so that no decision cites a figure the tree
did not produce.

## Result

| round | findings | high+critical | high+critical share | medium | low | other severity |
|---|---|---|---|---|---|---|
| 1 | 1757 | 234 | 13.3 % | 39.0 % | 47.3 % | 6 |
| 2 | 194 | 34 | 17.5 % | 41.8 % | 40.7 % | 0 |
| 3+ | 504 | 44 | 8.7 % | 38.3 % | 53.0 % | 0 |

Rows sum to 2,455 findings in 492 `*.findings.md` files.

## What it changes against the supplied figure

The supplied plan read 14.1 % → 11.5 % → 7.4 % for rounds 1, 2 and 3+. The
direction from round 1 to round 3+ holds: round 3+ carries about two thirds
of round 1's high+critical share and a larger low share. **Round 2 does not
fall — it rises to 17.5 %.** A cap that ended reviews after round 1 would
drop the round with the highest severity share; a cap after round 2 keeps it.
This is the measured reason the roadmap's cap is two rounds, not one.

## Method and its limits

- A finding is a table row whose first cell is a number; its severity is the
  second cell, lower-cased.
- A file's round is read from its name: a `-roundN` / `.roundN` / `-rN`
  suffix immediately before `.findings.md`; no suffix is round 1.
  `conformance-round5-stop-refusal` is a subject name, not a round, and the
  pattern correctly reads it as round 1.
- **Undercount, stated:** 18 findings files carry several rounds in one file
  under `# Completion review round N` headings (the § 2.5 in-place re-bind).
  Those rows are all counted as round 1 here, so round 1 is slightly inflated
  and rounds 2 and 3+ slightly deflated. Splitting them needs a per-heading
  parser; the `round:` header of step 1.2 makes the round machine-readable
  from then on.
- "Other severity" is six round-1 rows whose severity cell is neither of the
  four values (for example `info`).

## What round 3+ high/critical rows were (step 0.2)

Each of the 44 high/critical rows of round ≥ 3 was classified by a fresh
subagent against the previous round's artefact and, where that was silent,
against `git show <round-1 diff>:<path>` and the commit that introduced the
code. Two rows were re-checked by hand
(`run-continuation-provenance.round5` row 1 — the finding names the round-4
reset; `worktree-long-horizon.round4` — `e8bc15e20` is an ancestor of the
round-1 diff `f631031b7`); both held.

| class | rows | meaning |
|---|---|---|
| fix-delta | 27 | introduced by a fix made in response to an earlier round |
| missed | 15 | present in the scope earlier rounds reviewed, not reported |
| unclear | 2 | `conformance-round7`: "round7" names a project round, not a review round |

**Only `missed` is a cost of a round cap.** 15 rows over all reviews that ran
past round 2 — against 268 high/critical rows found in rounds 1 and 2. Six of
the 15 sit in a single review (`feat-svg-roadmaps-all-20261011`, rounds 3, 5
and 6). The fix-delta rows are the loop feeding itself: 27 of 44 are defects
the previous round's repair created. A round 2 restricted to the fix delta is
aimed at exactly that class.

Per row (file · round · class · reason):

```
behavior-vocabulary-close-round13	r13	fix-delta	round-11 fix half-closed it and pinned the wrong answer
behavior-vocabulary-close-round15	r15	missed	roadmap already over the line cap at the round-1 diff
behavior-vocabulary-close-round3	r3	fix-delta	round-2 finding 1 fix made the step 3.2 / AC-4 evidence stale
behavior-vocabulary-close-round4	r4	fix-delta	MEDIUM downgrade and its comment were the round-2 finding 3 fix
conformance-round7	r7	unclear	"round7" is the project round; no earlier review round of this diff
conformance-round7	r7	unclear	scope staleness from a merged PR, no earlier review round
drain-adversarial-verification-close-round3	r3	fix-delta	stale figures written by the round-2 fix
drain-adversarial-verification-close-round4	r4	fix-delta	misplaced provenance marker was the round-3 fix
drain-adversarial-verification-close-round4	r4	fix-delta	figures written by the round-3 fix
drain-adversarial-verification-close-round5	r5	fix-delta	two round-1 fixes combined into a fractional timeout
drain-ranker-that-routes-round4	r4	missed	rounding and tiebreak in round-1 scope, unreported in r1-r3
drain-roadmap-6-one-resolver-r3	r3	fix-delta	segment() replaced stripNonCode as the round-2 fix
drain-roadmap-6-one-resolver-r4	r4	fix-delta	AST check from the round-3 fix repaired one half only
drain-roadmap-6-one-resolver-r5	r5	fix-delta	sits inside the repair that closed round-4 finding 2
feat-svg-roadmaps-all-20261011-r3	r3	fix-delta	isPassSurface split was the round-1 finding 6 fix
feat-svg-roadmaps-all-20261011-r3	r3	fix-delta	same widening from the round-1 fix
feat-svg-roadmaps-all-20261011-r3	r3	missed	header claim and divergent skip present at the round-1 diff
feat-svg-roadmaps-all-20261011-r3	r3	missed	static discharge and severity predate round 2
feat-svg-roadmaps-all-20261011-r5	r5	missed	quote-only regex present at the round-1 diff
feat-svg-roadmaps-all-20261011-r5	r5	missed	unconditional 'verified' return present at the round-1 diff
feat-svg-roadmaps-all-20261011-r5	r5	missed	non-greedy svg regex present at the round-1 diff
feat-svg-roadmaps-all-20261011-r6	r6	missed	the old regex had the same hole (disposition)
fix-release-shape-allows-its-own-census.round19	r19	missed	rows already in the table at the round-1 diff
fix-release-shape-allows-its-own-census.round21	r21	fix-delta	added by the round-20 finding 2 fix
release-ledger-round4	r4	missed	cat-file argv existed before the round-4 commits
release-ledger-round4	r4	fix-delta	re-probe added in response to round-3 finding 6
release-ledger-round4	r4	fix-delta	head-subject guard added in the round-3 response
release-ledger-round4	r4	fix-delta	retry path added in the round-3 response
release-ledger-round4	r4	missed	remediation text already present while the CI job existed
run-continuation-provenance.round3	r3	missed	progress read predates the round-2 fix
run-continuation-provenance.round3	r3	fix-delta	session_cwd added by the round-2 finding 1 fix
run-continuation-provenance.round5	r5	fix-delta	history_source reset was the round-4 finding 2 fix
run-continuation-provenance.round5	r5	fix-delta	per-directory resolution was the round-4 finding 1 fix
run-continuation-provenance.round6	r6	fix-delta	new rung from the round-5 fix
run-continuation-provenance.round7	r7	fix-delta	round-5 rung's state clear; round-6 guard covered one path
run-continuation-provenance.round7	r7	fix-delta	absent branch from the round-5 fix lacks the round-6 guard
run-continuation-round9	r9	fix-delta	blocked terminal came from the round-8 fix
worktree-long-horizon.round3	r3	fix-delta	readHead was the fix for round-2 finding 5
worktree-long-horizon.round4	r4	missed	claim registered before the round-1 diff
worktree-long-horizon.round5	r5	fix-delta	detectIndentWidth added by the round-4 fix
worktree-long-horizon.round6	r6	missed	refusal set present at the round-1 diff
worktree-long-horizon.round6	r6	fix-delta	file created by the round-1 fix commit
worktree-long-horizon.round6	r6	fix-delta	routing through detectIndentWidth was the round-5 fix
worktree-long-horizon.round6	r6	missed	classifier present at the round-1 diff
```

## Reproduce

Save as `severity_by_round.mjs` and run `node severity_by_round.mjs` from the
repository root; `--rows 3` prints the high/critical rows of round ≥ 3 that
step 0.2 classifies.

```js
import { readdirSync, readFileSync } from 'node:fs';

const dir = 'agents/evidence/reviews';
const rowsFrom = process.argv.includes('--rows') ? Number(process.argv[process.argv.indexOf('--rows') + 1]) : 0;
const buckets = new Map();
for (const f of readdirSync(dir).filter((n) => n.endsWith('.findings.md')).sort()) {
    const m = /[-.](?:round|r)(\d+)\.findings\.md$/.exec(f);
    const round = m ? Number(m[1]) : 1;
    const bucket = round >= 3 ? '3+' : String(round);
    for (const line of readFileSync(`${dir}/${f}`, 'utf8').split('\n')) {
        const cells = line.split('|');
        if (!/^\|\s*\d+\s*\|/.test(line) || cells.length < 4) continue;
        const sev = cells[2].replace(/[\s*`]/g, '').toLowerCase();
        const b = buckets.get(bucket) ?? { n: 0, hc: 0, medium: 0, low: 0, other: 0 };
        b.n++;
        if (sev === 'high' || sev === 'critical') b.hc++;
        else if (sev === 'medium') b.medium++;
        else if (sev === 'low') b.low++;
        else b.other++;
        buckets.set(bucket, b);
        if (rowsFrom && round >= rowsFrom && (sev === 'high' || sev === 'critical')) {
            console.log(`${f}\tr${round}\t${sev}\t${cells[3].trim()}\t${cells[4].trim().slice(0, 400)}`);
        }
    }
}
if (!rowsFrom) {
    const pct = (x, n) => `${((100 * x) / n).toFixed(1)} %`;
    console.log('| round | findings | high+critical | high+critical share | medium | low | other severity |');
    console.log('|---|---|---|---|---|---|---|');
    for (const k of ['1', '2', '3+']) {
        const b = buckets.get(k);
        if (b) console.log(`| ${k} | ${b.n} | ${b.hc} | ${pct(b.hc, b.n)} | ${pct(b.medium, b.n)} | ${pct(b.low, b.n)} | ${b.other} |`);
    }
}
```
