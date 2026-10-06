<!-- evidence-type: analysis -->

# Touched-file quality — shadow readings, 2026-Q4

Phase 2 step 2.1 of `road-to-touched-files-that-pass-their-own-tools`. Opened on
`drain/touched-files-own-tools-20261001` (base `a03f60c46`, 2026-10-01); the
release window opened and was read on `drain/touched-files-own-tools-20261006`
(base `f3cc5db98`, 2026-10-06).

**STATUS: THE WINDOW IS OPEN. THE FIELD READING IS ZERO, AND THAT ZERO IS NOW A
FACT ABOUT THE DEFAULT RATHER THAN ABOUT THE RELEASE.** A replay over 30 real
merged commits supplies the decision input the field could not, and it is
unflattering in three separate ways. All three are below.

## 1. The window is open — the command, not a claim

The two earlier revisions of this page asserted "no release carries the
instrumentation", first in prose and then as a command with a control. The
command is the one that decides this step, and it has flipped:

```
git tag --contains d4760bb4f        # the whole instrumentation, one commit
```

| Run | Output | Reading |
|---|---|---|
| `git tag --contains d4760bb4f` | `16.3.0` | **a release carries it** |
| `git tag --contains 9bc8cd4f` | `16.2.0`, `16.3.0` | the control still reports a tag when one exists |

`d4760bb4f` — *"feat(hooks): run the project's own quality tools over the files a
turn edited (#2152)"*, 2026-10-01, 12 files — is the single commit carrying the
whole pass, so containment of it is a complete test. `16.3.0` was tagged
**2026-10-06 00:28:26 +0200**, roughly four hours before this reading. The window
is open; it is also very young, and that matters for § 2.

## 2. The field reading — zero, and why it will stay zero

This repository's own host install is a consumer of its own stop hook. Its record
store at `agents/state/verify-before-complete/` holds **22 session records**, of
which **3** fall inside the release window (mtimes after 2026-10-05T22:28Z).

| Counter | Value | What the value means |
|---|---|---|
| session records in store | 22 | — |
| records inside the release window | 3 | window is ~4 h old |
| records carrying a `quality_runs` key | **0** | — |

Zero, and this time the reason is not the release. `touched_file_quality` ships
`off` (`src/config/agent-settings.template.yml:1520`), this install carries no
`verify_before_complete` block at all, so the key resolves to the shipped default
and the pass never ran. **An opt-in feature collects nothing from consumers who
did not opt in**, and nothing in the release changed that. Waiting longer does not
fix it; only an opt-in or a default flip does, and the default flip (2.3) is the
decision this reading was supposed to inform. That circularity is real and is the
first unflattering finding.

### The counters cannot be recovered from the store afterwards — in any mode

Sharper than the above, and it invalidates the collection method the first
revision of this page assumed. `quality_runs` is written at stop
(`src/scripts/before_complete_hook.ts:906`) and **deleted at the next turn
boundary** (`:703-704`, alongside `quality_files_source`), by the design 1.2
adopted deliberately so that an install which never opted in keeps a
byte-identical record shape.

The consequence was not drawn at the time: the record is a **per-session state
file that is overwritten every turn, not an append-only event log.** So
`stops_with_edits`, `stops_with_entries` and `stops_with_a_verdict` — defined as
counts over *stop events* — are not derivable from the store at any later moment,
even on a fleet of installs all running `shadow`. At best a reader finds the last
stop of each session, and only if that session never started another turn.

2.1's own oracle was therefore unbuildable as written. `median_wall_ms` was the
one counter that never needed the store, which is why it is the one the earlier
revision could fill.

## 3. The replay — 30 real commits, real repository, real toolchain

Since the field cannot supply the counters, the next-best evidence is the real
pass over real touched-file sets. The last 30 first-parent commits on `main`
(`8031e09d6` 2026-10-03 … `f3cc5db98` 2026-10-06) were replayed: for each, its
changed files were filtered to those still present in the working tree and handed
to `runTouchedFileQuality` — the exact function the stop path calls — against this
repository with its real, installed `node_modules`.

This is a **replay, not a field observation**, and the difference is named rather
than buried: these are *merged* commits, so every one of them had already passed
CI, which runs `eslint` over the same tree. The red count below is consequently a
**lower bound and is biased toward zero by construction.** At a live stop the
files are mid-edit and have passed nothing.

The resolver's list for this repository is exactly two commands:

```
resolve_toolchain(root).quality  ->  ["npx tsc --noEmit", "npx eslint ."]
```

### Row census — 60 rows over 30 commits

| Outcome | Rows | Share |
|---|---|---|
| executed, verdict recorded | 12 | 20 % |
| `skipped: unscoped` (`tsc --noEmit`, every commit) | 30 | 50 % |
| `skipped: no_files` (no JS/TS in the set) | 18 | 30 % |
| `skipped: mutating` | 0 | — |
| `skipped: absent` | 0 | — |

### The three stop-counters, in replay form

| Counter | Replay value | Note |
|---|---|---|
| commits with ≥ 1 touched file | 30 / 30 | every commit changed something |
| commits with ≥ 1 executed command | **12 / 30** | 18 produced only skip rows |
| commits with ≥ 1 non-zero verdict | **0 / 30** | lower bound — see the bias note above |

**Twelve of thirty turns would have produced any verdict at all.** The other
eighteen touched only markdown, YAML, or files under `agents/**`, and the pass
recorded two skip rows and nothing else. `tsc --noEmit` was `unscoped` on all
thirty — it never ran once, which is risk 1 of the roadmap discharged in
measurement rather than prose, and simultaneously the reason § 5 exists.

## 4. Latency — the published median was an order of magnitude low

| Source | Shape | median ms | p95 ms | range |
|---|---|---|---|---|
| bench (1.4), 2026-10-01 … 10-05 | synthetic 5-file fixture, flat ESLint config | 243 – 322 | 302 – 444 | — |
| **replay, 2026-10-06** | **real repository, 12 executing commits** | **3,546** | **4,043** | 3,268 – 4,043 |

The earlier figure was not wrong about what it measured; it was wrong about what a
reader would carry away from it. Its own caveat — *"one machine's, and its dominant
term is whichever tools the fixture's resolver emits"* — turns out to understate
the gap by a factor of about **eleven, for this very repository**, which is the
nearest consumer the bench had. A synthetic fixture with a flat ESLint config and
five files does not approximate a project whose ESLint config is type-aware and
loads `tsconfig.json`.

The cost is also **near-flat in file count**, which the five-file fixture could not
reveal:

| commit | files passed | ms |
|---|---|---|
| `97a5a6474` | 2 | 3,482 |
| `6aa3c36f9` | 12 | 3,514 |
| `df7ea7928` | 29 | 4,012 |
| `c58d7eae8` | 43 | 4,043 |

Twenty-one times the files buys 16 % more wall time. The term that dominates is
ESLint start-up plus typed-config load, not the work. So the honest summary is
**~3.5 s whenever any JS/TS file is touched, and ~0 ms otherwise** — and the
median across *all* thirty commits is **0 ms**, because 60 % of them execute
nothing. A single median hides both halves; both are reported.

## 5. Two soundness findings the controls produced

The replay's `0 / 30` is a negative claim, so the instrument was controlled before
the claim was trusted. Three probes, run against the real repository and deleted
in the same process:

| Probe | Path | Recorded |
|---|---|---|
| A — `const` reassignment | `agents/tmp/…ts` | `exit_code: 0` |
| B — `const` reassignment | `src/scripts/…ts` (linted) | `exit_code: 0` |
| C — parse error | `src/scripts/…ts` (linted) | **`exit_code: 1`**, `Parsing error: ':' expected` |

Probe C is the control: the pass does report a red when one exists, so § 3's
`0 / 30` is a finding and not a broken instrument. Probes A and B are the other
two unflattering findings, and neither was anticipated by the roadmap.

**(a) An ignored file is recorded as a clean file.** This repository's ESLint
config ignores `agents/**` (`eslint.config.js:28`). Probe A was never linted — the
output head says so in words, *"File ignored because of a matching ignore
pattern"* — and the recorded row is `exit_code: 0`, `skipped: null`, which is the
exact shape of a passing check. The four-reason skip taxonomy (`mutating`,
`unscoped`, `absent`, `no_files`) has **no row for "ran, but the tool declined to
look"**, so a consumer whose source lives under its own lint-ignore patterns gets
a page of green that means nothing. 2.1's counting rule — *skips are counted apart
from verdicts, never as verdicts* — is sound and does not cover this, because this
is not a skip: it is a verdict about nothing.

**(b) For this repository the pass cannot catch a type error at all.** Probe B is
a genuine type error in a genuinely linted path, and it recorded `exit_code: 0`.
`const` reassignment is caught by `tsc`, not by this repo's ESLint rule set — and
`tsc --noEmit` is `skipped: unscoped` on every single row, by rule 3, because it
has no per-file form. The one tool that would catch the error is structurally
never run. For a project whose resolver emits exactly these two commands, the
shadow pass is a lint pass and nothing more. That is a defensible scope; it is not
what "the quality commands the project's own toolchain already lists" implies to a
reader, and it should be said in the open rather than discovered by the first
consumer who flips the key expecting type safety.

## 6. What this means for 2.3 — the `shadow → warn` default flip

2.3 is deferred to the owner and this page does not decide it. What it supplies is
the reading the deferral was waiting on, stated at face value:

- Over 30 real merged commits, a `warn` default would have emitted **zero**
  advisory lines.
- It would have cost **~3.5 s at 12 of those 30 stops**, and ~0 s at the other 18.
- The red count is a lower bound: merged commits are post-CI-green, so the live
  rate at a mid-edit stop is unknown and is certainly higher than zero. How much
  higher is not measurable from this tree, and no number here should be read as
  if it were.
- For this repository the pass is lint-only (§ 5b), so the upside it can offer is
  bounded by what ESLint catches that CI would catch minutes later anyway.

Weighing a bounded, unquantified upside against a measured ~3.5 s at one stop in
two-point-five is an owner call, and the roadmap already routes it there. The one
thing this reading does settle is that the flip should not be taken on the
243–322 ms figure, which described a fixture and not a project.

## 7. What a better reading would require

Named so the next attempt does not repeat the collection method that failed:

1. **An append-only sink.** The counters need stop events, and the state record
   deletes them at the turn boundary by design (§ 2). Counting them means writing
   somewhere that is not the per-session record — which is a change to the
   instrument, not a longer wait.
2. **A fifth skip reason, or a verdict qualifier,** separating "ran and passed"
   from "ran and the tool declined to look" (§ 5a).
3. **At least one consumer that opted in.** Absent that, the field reading is
   structurally zero at any window length (§ 2).

## Appendix — what `shadow` is

`hooks.verify_before_complete.touched_file_quality: shadow` makes the existing
`verify-before-complete` stop concern run the commands the consumer's own
toolchain resolver already lists against the files the turn edited, recording the
result in `quality_runs[]`. It emits nothing, exits 0 on every path, and nothing
it records is read as verification. The default is `off`, where none of the above
happens and the record is byte-identical to what it was before the field existed.

### The skip taxonomy, as shipped

| Skip reason | Meaning | Counted as |
|---|---|---|
| `absent` | ENOENT or exit 127 — the tool is not installed | neither pass nor fail |
| `unscoped` | no per-file form, so it was never run | neither |
| `mutating` | the command writes files and has no known check form | neither |
| `no_files` | the turn touched nothing this tool reads | neither |

`skipped:*` rows are counted apart and never as verdicts. Detection upstream is by
manifest (`typescript` in `devDependencies`), not by presence on PATH, so a clean
machine never reports as a failing one. § 5a is the gap this table does not cover.

### Reproducing § 3 and § 4

The replay harness was a scratch script, deliberately not committed: it pins
absolute paths to one machine's checkout and a 30-commit window that moves with
`main`, so a committed copy would rot into a gate that fails for reasons unrelated
to the instrument. It is six steps and reproduces from this description —
`git log --first-parent --diff-merges=first-parent --max-count=30 --name-only`,
filter each commit's files to those present in the tree, call
`resolve_toolchain(root).quality`, call `runTouchedFileQuality({ root, commands,
files })`, time it with `performance.now()`, and count rows by `skipped` and
`exit_code`. The committed, maintained measurement of the same function remains
`src/scripts/bench_touched_file_quality.ts`; § 4 is the statement that its fixture
does not represent this project.
