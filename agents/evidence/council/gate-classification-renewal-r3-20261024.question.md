<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (twenty-eighth round that
     day), committed verbatim. The asking agent wrote the reconciler, the ledger
     and the fix below. -->

# Step 7.1: re-attestation at revision 23, and item 4

**Closure standard (the owner's Option A).** Items 1, 4, 5, 6, 7 and 8. Items 1,
5, 6, 7 and 8 were met 2/2 in round 21.

**Item 4's pass condition.** The class predicates are mutually exclusive or have
a defined precedence, and each aspect satisfies its predicate.

**Rule D38.** A council round on the diff renews a pin; its author never does.

The last attested set is revision 16 (`a9a9ecd98d`). This round evaluates
**revision 23**. It is the third renewal attempt on this target.

## What earlier rounds already examined, unchanged since

- **The D46 behaviour fix.** `check_composite_arming` now exits 0 when the
  composite store is absent. It still exits 1 when the store is unreadable,
  malformed or empty. Tests were seen red. Both seats called the fix sound in
  rounds 26 and 27.
- **Check 16 re-inventory.** A separate session redid it from source only, and
  a second session reviewed the three new mappings: 3/3 agree. Both sessions'
  prompts are now committed in `gate-check16-reinventory-prompts-20261024.md`.
- **Revision 22.**
  - Exact flag tokens, with one structured flag per flag-only branch.
  - The effect-versus-code contradiction refusal.
  - The stated code-confirmation coverage: 63 of 167 blocking branches.
  - D46's operational state and revert triggers.

## Round 27's findings, and revision 23's answers

Round 27 was the second renewal round on this target
(`agents/evidence/council/gate-classification-renewal-r2-20261024.md`). It
returned **do not renew** and **item 4 not met**, both 2/2. Attempt 3 changes
the strategy: it re-cuts the renewal unit rather than defending it.

| Finding | Revision 23 |
|---|---|
| Whole-file wiring hashes attest an unexamined change (`--enforce`) | The wiring files are pinned by the **digest of their Phase 7 steps only**. These are YAML blocks around a line that names one of the 16 checks, or names a task whose block names one. `Taskfile.yml` is added, because it orders the Phase 7 tasks and was never pinned. The `--enforce` line lies in no Phase 7 step, so it is outside the unit. Since revision 16 only one Phase 7 step changed: the `tests.yml` arming comment. Three self-test cases cover a change outside a step, a change inside one, and a dropped Taskfile task. The first was seen red. |
| Item 4: label exclusivity shown, but not runtime mode exclusivity; no precedence for overlapping modes | A **precedence table** (`overlaps`) is required for every branch that reaches rows in more than one mode, or whose predicates name a flag other than its rows' modes. It names the row each mode selects, the excluded flags and the tuning parameters. A run with the flag is in the flag's mode. The table must cover the branch's rows, modes and flag tokens exactly. There are 6 entries. Three self-test cases (missing, swapped, undeclared flag) were seen red. |
| (found by that check) Self-test rows were not modes | R2.b, R3.b, R7.b and R16.e name `--self-test` or `--mutation-selftest` in their aspect, and R10.h names `--freshness-days` in its applicability. None of the five had a structured mode. A row's mode is now read from its aspect, applicability or class cell, and must equal the structured mode. There are now 16 structured modes, and two self-test cases cover it. |
| The scanner misses a contradiction when a wider blocking branch also covers the site | The contradiction rule reads the **narrowest** covering branch. A self-test case was seen red under the old every-branch rule. |
| Independence asserted, not shown | The two sessions' prompts are committed in `gate-check16-reinventory-prompts-20261024.md`. The record states what that shows (each session's input boundary) and what it cannot (obedience; both are on the same provider). |

Not changed, with reasons:

- Code confirmation stays at 63 of 167 blocking branches, which is a stated
  limit of syntactic scanning.
- The absent-store exit 0 is the owner's choice (D46). anthropic's
  *"misclassified as non-blocking"* reopens an owner decision, which this lane
  does not do.


## The wiring unit, re-cut

The six whole-file YAML blob pins are replaced by Phase-7-step pins, and
`Taskfile.yml` is added. The values are the steps as they stood at revision 16.
Only one step changed since then.
The `tests.yml` arming step changed because its comment was corrected (D46):

```diff
-        # bench run that failed before writing leaves no store, and the predicate
-        # correctly exits 1 on a store it cannot read (an empty store must not
-        # pass as "no readings yet"). That is the right behaviour for the
-        # predicate and the wrong reason to red this job.
+        # bench run that failed before writing leaves no store, which the
+        # predicate reports as "not measured yet" and exits 0 on (D46); the bench
+        # step above is what fails the job in that case. A store that exists but
+        # is unreadable, malformed or empty still exits 1, which is the right
+        # behaviour for the predicate and the wrong reason to red this job.
```

The `--enforce` line is not inside any extracted step. A test proves that an edit to it does not stale the `ci-fast.yml` pin.

## The new classifier code

```js
// The wiring files are pinned by the Phase 7 steps they contain, not by their
// whole text: a change elsewhere in the file is outside the attestation, and a
// change to a step that runs, names or orders one of the 16 checks is inside
// it. A step is the YAML block around a line that names a check, or names a
// task whose block names one; its header is the nearest list item or
// top-level key above that line.
export const WIRING = ['Taskfile.yml', 'taskfiles/ci-fast.yml', 'taskfiles/content.yml', 'taskfiles/engine.yml', '.github/workflows/standing-payload-delta.yml', '.github/workflows/rule-backstops.yml', '.github/workflows/tests.yml'];
const indentOf = (l) => l.length - l.trimStart().length;
function yamlBlocks(text, tokens, taskfile) {
    const lines = text.split('\n');
    const isHeader = (l) => {
        const t = l.trimStart();
        return t.startsWith('- ') || (taskfile && indentOf(l) === 2 && /^ {2}[\w:-]+:\s*$/.test(l));
    };
    const picked = new Map();
    lines.forEach((l, i) => {
        if (l.trimStart().startsWith('#')) return;
        if (![...tokens].some((t) => new RegExp(`(?<![\\w-])${t.replace(/[-]/g, '\\-')}(?![\\w-])`).test(l))) return;
        let h = i;
        if (!isHeader(lines[i])) {
            h = i - 1;
            while (h >= 0 && !(lines[h].trim() !== '' && indentOf(lines[h]) < indentOf(lines[i]) && isHeader(lines[h]))) h -= 1;
            if (h < 0) h = i;
        }
        let e = h + 1;
        while (e < lines.length && (lines[e].trim() === '' || indentOf(lines[e]) > indentOf(lines[h]) || (lines[h].trimStart().startsWith('- ') && indentOf(lines[e]) === indentOf(lines[h]) && !lines[e].trimStart().startsWith('- ') && !lines[e].trimStart().startsWith('#')))) e += 1;
        picked.set(h, lines.slice(h, e).join('\n').trimEnd());
    });
    return [...picked.entries()].sort((a, b) => a[0] - b[0]).map(([, b]) => b);
}
// … wiringScope collects task names named by those blocks (two passes) and returns the joined blocks per file.

    // Mode overlaps (round 27): every branch that reaches rows in more than one
    // mode, or whose predicates name a flag other than its rows' modes, needs a
    // precedence entry that covers its rows, modes and flag tokens exactly.
    const overlaps = grounds.overlaps ?? {};
    const seenOverlap = new Set();
    for (const c of branchInv.checks) {
        for (const b of c.branches) {
            const target = String(mapping[c.check]?.[b.id] ?? '');
            if (target.startsWith('op:') || target === '') continue;
            const rows = target.split('+');
            const rowModes = rows.map((id) => modes[id] ?? 'default');
            const tokens = [...flagTokens((b.predicates ?? []).join(' '))];
            const foreign = tokens.filter((t) => !rowModes.includes(t));
            if (new Set(rowModes).size < 2 && foreign.length === 0) continue;
            if (rows.length === 1 && foreign.length > 0 && rowModes[0] === 'default' && !MODE_FLAGS.some((f) => foreign.includes(f))) continue;
            const key = `${c.check} ${b.id}`;
            seenOverlap.add(key);
            const e = overlaps[key];
            if (e === undefined) {
                failures.push(`overlap: ${key} reaches ${rows.join(', ')} in modes ${rowModes.join(', ')} with flags ${tokens.join(' ') || 'none'} and has no precedence entry`);
                continue;
            }
            const declared = Object.entries(e).filter(([k]) => k !== 'excluded' && k !== 'parameters');
            const ok = declared.length === rows.length && rows.every((id, i) => e[rowModes[i]] === id) && tokens.every((t) => (t in e && t !== 'excluded' && t !== 'parameters') || (e.excluded ?? []).includes(t) || (e.parameters ?? []).includes(t)) && [...(e.excluded ?? []), ...(e.parameters ?? [])].every((t) => tokens.includes(t));
            if (!ok) failures.push(`overlap: ${key}'s precedence entry does not cover its rows ${rows.join(', ')}, modes ${rowModes.join(', ')} and flags ${tokens.join(' ')} exactly`);
        }
    }
    for (const key of Object.keys(overlaps)) if (!seenOverlap.has(key)) failures.push(`stale overlap entry ${key}: the branch no longer overlaps`);
```

The precedence table (`overlaps`) and the modes, from the grounds file:
```json
{
 "modes": {
  "R2.b": "--self-test",
  "R3.b": "--mutation-selftest",
  "R7.b": "--self-test",
  "R8.c": "--require-complete",
  "R10.d": "--check-urls",
  "R10.g": "--strict",
  "R10.h": "--freshness-days",
  "R10.i": "--global",
  "R10.k": "--global",
  "R10.l": "--global",
  "R10.m": "--global",
  "R10.n": "--global",
  "R10.o": "--global",
  "R11.f": "--strict",
  "R12.d": "--strict",
  "R16.e": "--self-test"
 },
 "overlaps": {
  "check_public_links c11-beta-marker": {
   "default": "R11.e",
   "--strict": "R11.f",
   "excluded": [
    "--list"
   ]
  },
  "lint_agents_layout c12-consumer-warning": {
   "default": "R12.c",
   "--strict": "R12.d",
   "excluded": []
  },
  "check_rule_invariants c3-missing-file": {
   "default": "R3.a",
   "excluded": [
    "--mutation-selftest"
   ]
  },
  "check_rule_invariants c3-missing-string": {
   "default": "R3.a",
   "excluded": [
    "--mutation-selftest"
   ]
  },
  "check_token_quality_golden c8-scaffold-notice": {
   "default": "R8.b",
   "excluded": [
    "--json",
    "--require-complete"
   ]
  },
  "check_token_quality_golden c8-require-complete": {
   "--require-complete": "R8.c",
   "excluded": [],
   "parameters": [
    "--scope"
   ]
  }
 },
 "flag_branches": {
  "check_token_quality_golden c8-require-complete": "--require-complete",
  "check_public_links c11-beta-marker": "--strict",
  "lint_agents_layout c12-consumer-warning": "--strict"
 }
}
```

## Verbatim output at `HEAD`
```text
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --aspects | tail -1
aspects 49 · derived 49 · waived 0 · refused 0
$ node agents/evidence/analysis/gate-branch-sites.mjs --self-test | tail -4
ok   a non-blocking effect over a hard exit site is refused
ok   a non-blocking narrowest branch is refused even inside a wider blocking one

self-test: 8/8 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs --self-test (failing cases and summary)
FAIL baseline is clean — got: STALE: a ledger row changed since the table was pinned (a36ea7fff → 30068e36f) | STALE: src/scripts/check_comp

self-test: 43/44 case(s) behaved
$ node agents/evidence/analysis/gate-ledger-reconcile.mjs | tail -14
rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":42,"snapshot":0,"tolerance":0,"observation":7}
pins: 28 files, 51-file helper closure, ledger table

QUARANTINED (10):
- STALE: a ledger row changed since the table was pinned (a36ea7fff → 30068e36f)
- STALE: src/scripts/check_composite_arming.ts changed since the verdict was pinned (899e5d1fa → be71581b2)
- STALE: agents/evidence/analysis/gate-branch-inventory-20261024.json changed since the verdict was pinned (119214ea1 → 5dc4e1648)
- STALE: agents/evidence/analysis/gate-branch-mapping-20261024.json changed since the verdict was pinned (c296fd9f0 → f7c41542f)
- STALE: agents/evidence/analysis/gate-branch-mapping-review-20261024.json changed since the verdict was pinned (46227ecda → 704d26ae8)
- STALE: agents/evidence/analysis/gate-ledger-reconcile.mjs changed since the verdict was pinned (906f66045 → 841c4c964)
- STALE: agents/evidence/analysis/gate-branch-reconciliation-20261024.md changed since the verdict was pinned (d25580a37 → 332d251f3)
- STALE: agents/evidence/analysis/gate-branch-sites.mjs changed since the verdict was pinned (d926f34aa → 0de4977f9)
- STALE: agents/evidence/analysis/gate-class-grounds-20261024.json changed since the verdict was pinned (3ae580599 → bba8986eb)
- STALE: the Phase 7 steps of .github/workflows/tests.yml changed since the verdict was pinned (b27eddc52 → 00fc921e0)
```

The failing baseline case and the STALE lines are the unrenewed pins this round
is asked about.

## Questions

**Q1. Re-attestation (D38).** Should revision 23's input set be renewed as one
attested set? That set is:

- the Phase-7-step wiring pins;
- the remaining blob pins;
- the ledger table;
- the helper closure.

Answer *renew* or *do not renew*. For *do not renew*, name the input and the
concrete defect.

**Q2.** Is item 4 met? Answer *met* or *not met*. For *not met*, name the
concrete shortfall against item 4's pass condition.

**Q3.** Given the round-21 verdicts and your Q1 and Q2, is 7.1 closed under
Option A? Answer yes or no.

Give your confidence.
