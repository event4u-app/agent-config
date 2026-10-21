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
