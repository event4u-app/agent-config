---
complexity: lightweight
---

# Stub: road to the remaining estate-triage batches

> **Stub — not active work.** Drain-run transfer, 2026-08-21, from
> [`road-to-estate-drawdown.md`](../archive/road-to-estate-drawdown.md) steps
> **2.1** and **2.2** plus **AC-2**. Council disposition **B**, outcome state
> **transferred**, both seats confirming in round 2 —
> [`drain-estate-drawdown-residue`](../../evidence/council/drain-estate-drawdown-residue.md),
> framework of record
> [`drain-blocker-dispositions-a`](../../evidence/council/drain-blocker-dispositions-a.md).
> Moved here because the work is **multi-PR by its own text** and the parent
> closed in one.

## Why this stub exists

Step 2.1 caps a triage batch at *"at most ten roadmaps, one PR each"*. One batch
landed — 2026-08-19, ten verdict rows, `agents/decisions/estate-triage-dispositions.yml`.
Measured at `52cfb4bb8`, the commit the council decided against, **71 of 80
files** in the active tree and `later/` carry no verdict row (**70 of 78** on the
merged tree — two files were archived out of the population and only one of them
was untriaged, which is why the numerator moved by one and the denominator by
two; see § Probe). At the step's own ceiling that is **eight further pull
requests**, and the parent roadmap closed in one.

The alternative the council rejected was narrowing AC-2 — *"every file in the
estate carries a terminal verdict row"* — to the batch **form** having been
proven. That would have dropped 71 files with nothing holding them, which is the
parent's own **risk 1, "drawdown by burial"**, firing on the parent itself. The
carrier exists so the count is recoverable rather than forgotten.

**A second, independent reason AC-2 cannot close as written**, recorded so a
future reader does not chase it: AC-2's middle clause requires *"the active count
reaches T1's registered ceiling"*, and **there is no registered ceiling.** The
parent's step 3.1 recorded why — T1's proposed 15/12 sit in
`src/config/estate-count-budget.json` under `target` and are *read by nothing*,
because the parent says both the numbers and the window belong to the maintainer.
So that clause is unsatisfiable by construction, independently of how many batches
run. Registering a ceiling is a maintainer act and is **not** in this stub's scope;
it is named here because a probe on "every file has a verdict" will reach zero
while AC-2 still has an open clause.

## What moved here — the complete list

1. **Step 2.1** — the batch mechanism, for the batches that have not run.
2. **Step 2.2** — the sequencing rule, for those same batches.
3. **AC-2** — in full, including the unsatisfiable ceiling clause above.

Nothing else moved. What the parent **keeps**: batch 1 and its ten verdict rows,
the register file itself, the closed six-word verdict vocabulary, the `resume_probe`
repairs the batch paid for, and the three findings the sweep produced. The register
is append-only per batch and is the durable surface a later batch appends to — it
does not move.

## Transferred items — verbatim, with producer, probe and baseline

Quoted exactly as they stand in the parent, where both carry `[-]`.

```
- [-] **2.1** Batches of at most ten roadmaps, one PR each, one verdict per file
      from a **closed vocabulary**: **EXECUTE** … **ARCHIVE** (dead or superseded;
      migration note plus not-adopted register).
      `verify:` each batch PR carries one verdict row per file, and no file leaves
      a batch without one.
- [-] **2.2** Sequencing: the active tree first, `later/` second, oldest-untouched
      first within each. **The seven roadmaps this cohort added are in the first
      batch, not exempt from it.** The council may decide MERGE-versus-ARCHIVE
      calls inside its configured reversible class; EXECUTE-versus-ARCHIVE on
      anything with shipped surface stays a maintainer call on the sheet.
      `verify:` the batch order is recorded, and every council-decided verdict
      names the class it was decided under.
```

AC-2, verbatim: *"every file in the estate carries a terminal verdict row; the
active count reaches T1's registered ceiling; **no closure lands without its
house-form artifacts.**"*

### Named producer

**The repository maintainer**, scheduling further triage batches under the
existing register.

**The producer is the maintainer independently of anything else in the parent**,
and that is a binding condition of the council's confirmation, not a stylistic
choice. The draft of this stub also named the parent's Phase-4 recurring pass as
an alternate producer. The same council session **abandoned** that pass (row 5 —
it is specified over a delegate path the council declined in batch B), so naming
it would have made this stub's producer depend on something that no longer exists.
It is deliberately not named. The openai seat's confirmation reads: *"provided the
maintainer remains the producer independently of step 4.1."*

### Probe, and its measured baseline at transfer

Count the files in the active tree and `later/` that carry no `- file:` row and
are not the target of a `moved_to:` row in
`agents/decisions/estate-triage-dispositions.yml`:

```python
import re, pathlib
root = pathlib.Path('agents/roadmaps')
reg  = pathlib.Path('agents/decisions/estate-triage-dispositions.yml').read_text(encoding='utf-8')
seen = set(re.findall(r'^\s*-\s+file:\s*(\S+)\s*$', reg, re.M))
seen |= set(re.findall(r'^\s*moved_to:\s*(agents/\S+)\s*$', reg, re.M))
act = {f'agents/roadmaps/{p.name}' for p in root.glob('*.md')}
lat = {f'agents/roadmaps/later/{p.name}' for p in (root/'later').glob('*.md')}
un  = (act | lat) - seen
print(f'untriaged={len(un)} (active {len(act-seen)}, later {len(lat-seen)})')
```

**Measured 2026-08-21 at `52cfb4bb8`, the commit the council decided against:
`untriaged=71 (active 24, later 47)`.**

**Re-measured on the merged tree this stub actually ships in: `untriaged=70
(active 23, later 47)`.** The decision-time figure is kept rather than
overwritten — the council decided against 71 at a named commit, and rewriting a
scope-bound number falsifies what was decided — but **70 is the live baseline a
future reader should measure against.**

The one-file drop is the warning below firing inside this very change:
`origin/main` archived `road-to-session-closeout`, a file that carried **no
verdict row**, so it left the denominator without any batch running. Nothing was
triaged. Re-entry completes when this reaches **0** — plus the ceiling clause
above, which no batch can discharge.

The probe reads current paths on both sides, so a file archived by some other
mechanism leaves the denominator without being counted as triaged. That is
deliberate: a roadmap that reaches `archive/` with the house-form closure is
terminal by the parent's own CUT list (*"Counting `archive/` growth as failure"* is
cut), and the probe should not demand a verdict row for a file that already
terminated. It also means **the count can fall without a single batch running**,
which is the honest reading of what is happening — roughly 25 concurrent
per-roadmap drain PRs were open against `main` on the transfer date, each
archiving one roadmap. A future reader must not read a falling number as batch
progress — and this is not a hypothetical: the baseline above moved 71 → 70
between the council's decision commit and the merge that shipped this stub,
entirely from one such PR.

### Collision and snapshot policy — required before a batch runs

Attached by the council to its confirmation of B, because the population moves
under a batch while it is being selected.

1. **Snapshot.** A batch names the commit it selected against, in its own
   `batches[].` entry. A verdict row is a statement about a file at a named
   commit.
2. **Collision skip.** A file held by an open pull request at selection time is
   **skipped, with the reason recorded in the batch entry** — never silently
   dropped and never edited under a concurrent PR. Batch 1 already did this
   informally for `road-to-per-turn-hook-economy` (`file_untouched_because`);
   this makes it the rule.
3. **Ten is a ceiling, not a target.** A batch of three files with three honest
   verdicts is a batch. Filling to ten by selecting files held by open PRs
   violates rule 2.

## Dissent, recorded

The anthropic seat argued `A / narrowed` in round 1: the batch **form** was
delivered by batch 1, the ~25 concurrent per-roadmap drain PRs are the estate's
real drain mechanism, and the 71 files are in that queue rather than buried. It
confirmed `B` in round 2. The dissent is kept because it names the mechanism that
is actually reducing the count, and if the count reaches zero without a second
batch ever running, the dissent was right about the mechanism and this stub
retires unused.
