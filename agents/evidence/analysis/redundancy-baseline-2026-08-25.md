<!-- evidence-type: analysis -->
# Redundancy baseline — 2026-08-25

Measured at `a36d4658de87e81bda8299dc3a01b9b9ce583af5`, the base of
`drain/road-to-redundancy-governance`. Every row carries the command that
produced it, so a later reader re-derives the number rather than trusting it.
This artifact asserts what was true when it was written and is never re-bound.

**Source of the claims being checked:** `agents/tmp.old/redundanz/` — six
documents from two chat sessions, all drafted against this same commit. Four of
their figures did not survive the check; those rows are marked and the
correction is stated.

## Method

All counts run from the repository root. `--include='*.ts'` is quoted because an
unquoted glob is expanded by zsh before `grep` sees it and silently returns zero.
Counts are of matching **lines** unless the command uses `-l`, which counts
**files**.

## Implementation duplication

| Fact | Count | Command | Against the source claim |
|---|---|---|---|
| `_pyRound` definitions | 33 files | `grep -rl 'function _pyRound' src/ --include='*.ts' \| wc -l` | claimed 33 — confirmed |
| `_jsonDumpsIndent2` mentions | 18 files | `grep -rl '_jsonDumpsIndent2' src/ --include='*.ts' \| wc -l` | claimed 18 — confirmed |
| Banner divider comments | 657 lines | `grep -rE '^\s*// ?-{10,}' src/ --include='*.ts' \| wc -l` | claimed 657 — confirmed |
| `class ArgparseExit` | 37 | `grep -rE 'class ArgparseExit' src/ --include='*.ts' \| wc -l` | claimed 37 — confirmed |
| `class ArgError` | 20 | `grep -rE 'class ArgError' src/ --include='*.ts' \| wc -l` | **not claimed** — the family is 76, not 37 |
| `class ArgExit` | 19 | `grep -rE 'class ArgExit' src/ --include='*.ts' \| wc -l` | **not claimed** — see above |
| Entry-guard block | 534 files | `grep -rl 'fs.realpathSync(fileURLToPath(import.meta.url))' src/ --include='*.ts' \| wc -l` | **claimed 373 — under-counted by 161** |
| …of those under `templates/` | 14 files | same, scoped to `src/agent-src/templates/` | claimed 13 — off by one |
| `REPO_ROOT` declarations | 245 lines | `grep -rE '(const\|let) REPO_ROOT' src/ --include='*.ts' \| wc -l` | claimed 149 replicas |
| …at the two-level depth | 22 lines | `grep -rF "path.dirname(fileURLToPath(import.meta.url)), '..', '..'" src/ --include='*.ts' \| wc -l` | **refutes interchangeability — see below** |
| `process.argv.slice(2)` | 673 lines | `grep -r 'process.argv.slice(2)' src/ --include='*.ts' \| wc -l` | claimed 497 hand-parsers (different metric) |
| Existing `_lib` modules | 189 | `ls src/scripts/_lib/*.ts \| wc -l` | the extraction target already exists |

None of `_lib/entry_guard.ts`, `_lib/repo_root.ts`, `_lib/python_compat.ts`,
`_lib/cli.ts` or `_lib/schema.ts` exists. The 189 modules are unrelated.

### The `REPO_ROOT` correction

245 declarations against 22 at the two-level depth means the copies encode
**different caller depths** and are not textually interchangeable. Extracting
them behind one helper without caller-location awareness would silently change
where 223 scripts believe the repository root is. The verdict today is
`keep-duplicated`; extraction needs a caller-location-aware resolver and tests
first. The source roadmaps raised this objection and were right to.

## Divergent delivery authority

`package.json` `files` carries **both** `src/scripts/` and
`src/agent-src/templates/scripts/`, so both copies of every twin below reach
consumers. No sync, drift or parity gate compares the two directories.

| Twin (`src/scripts/` ↔ `src/agent-src/templates/scripts/`) | added | removed | changed lines |
|---|---|---|---|
| `memory_lookup.ts` | 24 | 763 | 787 |
| `check_memory.ts` | 18 | 251 | 269 |
| `check_memory_proposal.ts` | 23 | 38 | 61 |
| `memory_signal.ts` | 8 | 53 | 61 |
| `memory_report.ts` | 8 | 20 | 28 |
| `memory_status.ts` | 6 | 10 | 16 |
| `memory_hash.ts` | 4 | 2 | 6 |

Reproduce with:

```
for f in $(ls src/agent-src/templates/scripts/*.ts | xargs -n1 basename); do
  [ -f "src/scripts/$f" ] && git diff --no-index --numstat \
    "src/scripts/$f" "src/agent-src/templates/scripts/$f"
done
```

**The metric is `git diff --numstat`, deliberately, and it replaced `diff -u |
wc -l`.** A unified-diff line count includes context lines and hunk headers, so
it varies with the local `diff` implementation: the same seven pairs measured
980 / 384 here and 975 / 381 on another machine. A number that moves with the
tooling is not evidence. `--numstat` counts only added and removed lines and
reproduces anywhere git does. It also reorders the table — `check_memory_proposal`
and `memory_signal` read 125 and 92 under the old metric and tie at 61 under this
one, because the old number was measuring how *scattered* the changes were rather
than how many there are.

All seven pairs diverge. Which side is intended is a behavioural judgement per
file, not a mechanical one — every resolution changes what consumers already
run. `check_single_delivery.ts` exists and solves this class at the rule layer;
at the code layer it is unsolved.

### What an ADR has to settle

1. **Does `src/scripts/` become the sole authored authority**, with the template
   copies produced by the build so the standalone property survives in the
   artifact while the knowledge lives once in the source — or do the two
   directories stay independently authored with a drift gate between them?
2. **What happens to consumers pinned to current template behaviour.** Seven
   files diverge by up to 787 changed lines; reconciling each is a behaviour change
   shipped to installs that already run the template side. The ADR states
   whether that is a patch, a minor, or gated behind a migration note.

## Enforcement gaps

| Fact | Count | Command |
|---|---|---|
| Comment rules in `eslint.config.js` | 0 | `grep -icE 'comment' eslint.config.js` |
| Redundancy classes in `design_slop_rules.ts` | 0 | `grep -icE 'placeholder\|tooltip\|aria-label' src/scripts/design_slop_rules.ts` |
| `DRY` mentions in `code-review/SKILL.md` | 1 | `grep -c 'DRY' src/skills/code-review/SKILL.md` |
| Redundancy content in `code-refactoring/SKILL.md` | 0 | `grep -icE 'redundan\|duplicat\|clone' src/skills/code-refactoring/SKILL.md` |
| `check_*` gates | 134 | `ls src/scripts/check_*.ts \| wc -l` |
| `lint_*` gates | 135 | `ls src/scripts/lint_*.ts \| wc -l` |
| `scripts-run` references in taskfiles | 441 | `grep -rho 'scripts-run' Taskfile.yml taskfiles/*.yml \| wc -l` |

`design_slop_rules.ts` is 712 lines of aesthetic-provenance rules and contains
no redundancy class at all: the placeholder-equals-label, tooltip-equals-label
and aria-label-echo family is genuinely absent, not merely weak.
`lint_output_slop.ts` carries six classes and every one is a placeholder or
filler class, none a redundancy class. The single `DRY` token in `code-review`
is one word inside a checklist line with nothing behind it, and
`code-refactoring` — the skill that performs extractions — never asks whether an
extraction should happen.

## Unverifiable here

- **jscpd: 45,807 duplicated lines / 6.59 %.** Neither `jscpd` nor `ast-grep` is
  a dependency (`node_modules/.bin` carries neither), and this pass ran offline.
  The figure is unverified, not refuted. Adding a scanner is a supply-chain
  intake decision, not a measurement step.
- **248 files pinned byte-identical under ADR-200.** The parity comments exist
  (`check_always_budget.ts:139`, `check_artifact_checksums.ts:8`) and confirm the
  mechanism; the exact file count was not re-derived.
- **`agent-switch` figures.** A different repository, out of scope for this pass.
