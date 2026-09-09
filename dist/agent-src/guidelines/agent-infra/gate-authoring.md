# Gate Authoring — the single path for a new gate

> Lifecycle, gaming-risk block, paired fixtures, ledger obligation, and finding format. Read this BEFORE writing a new `lint_*` / `check_*` / `audit_*` script.

_Origin: `road-to-skill-ecosystem-gate-integrity` Phase 3. It exists because the estate re-learned the same lesson four times at four instances and never wrote the general rule down: a gate that scanned nothing exited green, a budget report printed a share for a dimension it never measured, release gates verified an empty corpus, shape gates ran over frozen corpora. Each was fixed where it was found. This is the authoring surface that stops the fifth._

## The five obligations

A new gate is not done until all five hold. They are ordered by how expensive
they are to add later — the first two are nearly free at authoring time and
nearly impossible to retrofit honestly.

### 1. Account for the work — the ledger obligation

Use `src/scripts/_lib/gate_ledger.ts`. Plan every target, then give each one
exactly one terminal outcome: `complete`, `fail`, `skip(reason)`, or
`outOfScope(reason)`. `finalize()` throws when a planned target reached none.

```ts
const ledger = new GateLedger('lint_example');
ledger.plan(files.map(rel));
for (const f of files) {
    if (isGenerated(f)) { ledger.outOfScope(rel(f), 'generated_artifact'); continue; }
    const finding = check(f);
    if (finding) ledger.fail(rel(f), finding); else ledger.complete(rel(f));
}
ledger.report();   // prints `scanned=N planned=N skipped=N`, throws on unaccounted
```

Skip reasons come from the closed union in that module. An unlisted reason does
not typecheck — deliberately, because "excluded dir" / "too big" / "binary?" in
free prose is not aggregatable, and adding a genuinely new code should be a
one-line diff a reviewer sees.

A gate that genuinely has no per-target structure (a single scalar probe, a
watch-list guard) carries `// ledger-exempt: <reason>` on its own line instead.
`check_gate_completeness` ratchets the un-adopted count; it may only shrink.

**This is not the scan-root guard.** Keep `assertScanned` /
`assertWatchlistResolves` from `_lib/scan_scope.ts` as well. One covers the root,
the other the items under it, and a gate wants both.

### 2. Print the denominator on the green path

Success output states what was inspected, not only that nothing was found.
`ledger.report()` does this; if the gate also carries a floor in
`src/config/gate-coverage.yml`, emit the machine-read `scanned: <N>` line via
`reportScanned` or directly.

Publish the number that was **judged**, not the number that was *enumerated*.
`lint_framework_leakage` published 438 against 368 actually judged until the
ledger made the honest number the cheap one to emit — a 19% over-report of its
own coverage, invisible to every consumer of that line.

### 3. Land advisory, promote on empty

```
A NEW GATE LANDS ADVISORY. ITS FINDINGS ARE CLASSIFIED ON THE REAL CORPUS.
THE BASELINE SHRINKS TO EMPTY. ONLY THEN IS IT PROMOTED TO ERROR.
```

The failure this prevents is recorded: a shape gate wired straight to error over
a frozen corpus produced 8 hits, all 8 unfixable, and could therefore only ever
block. Running a new gate against the real corpus and classifying every hit
BEFORE wiring it is the difference between a ratchet and a wall.

Record the promotion condition in the gate's own header comment, in the form
*"promote to error when `<baseline entry>` reaches 0"*, so the next reader knows
whether advisory is a stage or a permanent hedge.

Use `checkRatchet` from `_lib/gate_baseline.ts` with an entry in
`src/config/gate-violation-baselines.json`; it returns a verdict rather than
printing or exiting, so the gate stays in control of its own output.

### 4. Name one degenerate pass — the gaming-risk block

Every new gate or ratchet carries a `**Gaming risk**` paragraph in its header
comment naming **at least one** concrete way the metric passes without the
underlying property holding, plus the mitigation and — honestly — the residual.

If one degenerate pass is nameable at authoring time, it will be found in
practice. Worked examples from this very roadmap:

| Gate | Degenerate pass | Mitigation | Residual |
|---|---|---|---|
| `check_gate_completeness` | sprinkle `// ledger-exempt:` markers with plausible boilerplate | minimum reason length; the marker lands in the diff | cannot judge whether a reason is *true* |
| `check_suppression_hygiene` | a `falsifier` holding a command that always exits 0 | literal degenerate forms rejected; minimum length | cannot execute the command to prove it discriminates |
| `_lib/gate_ledger` | mark every target `outOfScope` to reach a clean tally | the report prints skip counts per code beside the scanned count | a reviewer must still read the ratio |

The residual column is the point. A gaming-risk block that claims full coverage
is itself a false green.

### 5. Ship a paired fixture

A gate with no negative fixture cannot be shown to discriminate. Minimum set:

- the **real repo tree** passes, and the denominator is asserted (not just the
  exit code — a gate that scanned nothing also exits 0);
- a **planted violation** fails, and the message names the offender;
- the **boundary** case, where the gate declares one (exactly-at-cap, exactly-
  at-minimum);
- a **dead scan root** fails rather than passing green;
- `--quiet` changes the output, not the verdict.

Where the gate has a self-test mode (§ Second-order guards below), the
assertion-count floor is itself asserted: a truncated fixture block must fail
rather than print success.

## Finding format — the suppression key is in the message

A finding message carries its own suppression key inline, copy-pasteable:

```
❌  src/skills/example/SKILL.md:42  framework-leakage  /artisan/  …
    suppress: {"file":"src/skills/example/SKILL.md","anchor":"php artisan migrate","reason":"<why>","falsifier":"<command>"}
```

Friction in the suppression path is what drives a maintainer to disable the gate
instead of narrowing it. Make the honest narrow easier than the blunt off-switch.

Prefer a **content anchor** over a line number in any new suppression entry.
Position-keyed entries re-fire on an insertion nobody made, and this repository
has already paid for that: 18 of 18 framework-leakage entries are line-keyed,
and `check_suppression_hygiene` prints that count every run until they migrate.

## Derived pages — render only what was measured

```
A CATEGORY WITH NO MEASUREMENT RENDERS AS ABSENT OR EXPLICITLY "NOT MEASURED".
NEVER AS A ZERO. NEVER AS A COMPUTED SHARE.
```

Any generator that writes a derived page uses `_lib/measured_render.ts`:
`renderShare` returns `not measured` for an empty denominator instead of
`0.0%`, and `renderCoverage` prints the **gap list** beside the coverage number.

The recorded failure: the always-budget report printed a share for a dimension
it counted zero artefacts in. `0 / 0` became `0.0%`, which reads as a
measurement that came back low — the most confident possible way to say nothing.

Two rules follow from it:

- **A coverage number is published with its gaps.** Naming the un-covered
  artefacts costs one line and removes the reader's assumption that the
  remainder is small. When the list is capped for length, the true remainder is
  still stated — a silently truncated gap list reads as "covered everything"
  exactly like the bare number it was meant to qualify.
- **The paired test asserts the NEGATIVE.** Given an unmeasured dimension, the
  rendered output must contain no `%` at all. Asserting only that it says "not
  measured" still passes a renderer that helpfully appends `(0.0%)` beside it.

Adoption is a ratchet, not a sweep: `check_gate_completeness` is the worked
example, and a generator that neither imports the helper nor carries the
negative assertion is the gap this section exists to close as generators are
touched.

## Registering the gate

1. Task stanza in `taskfiles/ci-fast.yml`, `cmd: ./scripts-run src/scripts/<id> {{.QUIET_FLAG}}`.
2. `- task: <name>` in the `ci:` list in `Taskfile.yml`.
3. `src/config/gate-coverage.yml` entry **if** the gate emits `scanned: <N>` — a
   test fails the build on an emitting-but-unregistered gate.
4. Verify under **both** argv forms — bare and the CI-injected `--quiet`. A
   wrongly-consumed flag has silently become a scan root in this repo before.

Set the coverage floor **below** the live count. A floor pinned at today's exact
number reds on the very change that legitimately retires one unit, while a floor
well above zero still catches the collapse that matters.

## See also

- [`false-green.md`](false-green.md) — the catalogue of ways a green result can be false, each with its detection command.
- `src/scripts/_lib/gate_ledger.ts` — completeness accounting.
- `src/scripts/_lib/scan_scope.ts` — scan-root and watch-list assertions.
- `src/scripts/_lib/ratchet_base_ref.ts` — shrink-only against the base ref.
- `src/scripts/_lib/gate_baseline.ts` — the count ratchet and its staleness expiry.
- `docs/contracts/ci-green-floor.md` — what CI guarantees, and the local↔remote delta.
