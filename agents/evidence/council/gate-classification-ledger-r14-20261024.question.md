<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (nineteenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger,
     the mapping, the reconciler, the site scanner and the dispositions. -->

# Step 7.1: with a model-free source scan, atomic rows and a second independent rerun, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so.

The asking agent wrote four things: the ledger, the mapping, the reconciler,
and the site scanner with its dispositions. Separate sessions of the same model
wrote three others: the branch inventory, the mapping review and both reruns.
Treat the asking agent's work with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

A classification attaches to one implemented assertion under one named mode.
The previous round was 2/2. It saw the 198-branch artefact and a byte-identical
independent rerun, said no, and named these items, none of them
owner-reserved:

1. a source-derived completeness attestation, mechanically or independently
   generated, compared with zero difference against the records;
2. atomic records for the two compound branches;
3. the `unsure` rationales inside the package;
4. the exact clean-checkout command, an immutable rerun id, and an
   invalidation rule.

One seat also wanted every branch to have been red at Phase 7 start. The other
disagreed: the criterion is about checks pinned red, not about every control
path failing. The narrower reading was taken.

## 1. The mechanical source scan

`agents/evidence/analysis/gate-branch-sites.mjs` uses no model. It reads the 16
check scripts and flags, by syntax alone, every line that can turn a run into a
finding or a non-zero end:

- a non-zero `return`;
- `process.exit`;
- `throw`;
- a `push` into a reported list.

Comment lines are skipped. Each flagged site must lie within two lines of the
`where` of an inventoried branch of the same file. Otherwise it needs a
recorded disposition, and a disposition that names a branch must name one the
inventory has. A disposition with no site behind it also fails the scan.

The result, reproduced by the second rerun: **159 sites. 134 lie inside an
inventoried branch. 25 lie outside, each with a disposition. 0 are
undisposed.** Sensitivity: appending `if (x) return 7;` to one check made it
fail, with `undisposed site lint_readme_jargon:228`.

The 25 dispositions, verbatim:

- `lint_ticked_unmet_criteria:238` — collector: recursive file walk; collects paths to scan, reports nothing
- `lint_ticked_unmet_criteria:240` — collector: file walk; collects a path to scan
- `lint_ticked_unmet_criteria:252` — aggregate:c2-hit: spreads the hits scanText found; each hit is inventoried as c2-hit
- `check_rule_invariants:250` — usage:c3-unknown-arg: _argparse_error helper; its callers are inventoried as c3-unknown-arg and c3-root-missing-value
- `check_rule_invariants:279` — could-not-run:c3-json-read-or-parse: the catch-all internal-error return (exit 3) behind c3-json-* and c3-selftest-src-unreadable
- `check_trigger_evals:267` — collector: lists triggers.json candidates to scan
- `check_trigger_evals:350` — usage:c6-unknown-arg: _argparse_error helper; callers inventoried as c6-unknown-arg, c6-today-missing-value, c6-bad-today
- `check_trigger_evals:385` — aggregate:c6-report: spreads the per-file findings of _check_one into the list c6-report exits on
- `lint_rule_enforcement_declaration:329` — aggregate:c7-undeclared-new: the exit 1 over findings already inventoried as c7-undeclared-new, c7-gap-not-in-body, c7-baseline-stale, c7-baseline-shrink
- `check_council_layout:79` — collector: sorted rglob; collects paths
- `check_knowledge_cards:287` — aggregate:c10-G1-tier-missing: spreads _check_global_card's G1–G6 findings, each inventoried (c10-G*)
- `check_knowledge_cards:388` — aggregate:c10-G1-tier-missing: second call site of _check_global_card; same G1–G6 findings
- `check_knowledge_cards:523` — collector: date parser output, not a finding
- `check_knowledge_cards:589` — silent-pass:c10-C5-git-missing: git spawn error rethrown and caught by the caller, which skips C5 silently
- `check_knowledge_cards:641` — collector: collects source_version values
- `check_knowledge_cards:656` — collector: collects observed_at values
- `check_knowledge_cards:713` — could-not-run:c10-freshness-relative-throw: _relativeToStrict throw, the documented relative_to crash
- `check_knowledge_cards:760` — collector: lists card files
- `check_knowledge_cards:866` — usage:c10-unknown-arg: _topError helper; callers inventoried as c10-unknown-arg, c10-missing-value, c10-bad-int
- `check_public_links:316` — aggregate:c11-report: spreads scan_file's violations into the list c11-report exits on
- `lint_agents_layout:258` — aggregate:c12-flat-file: exit 1 over the unknown entries inventoried as c12-flat-file and c12-unknown-dir
- `lint_agents_layout:270` — aggregate:c12-consumer-warning: the --strict exit after consumer warnings, inventoried as c12-consumer-warning (R12.d)
- `lint_eval_freshness:117` — collector: lists manifest paths
- `lint_readme_jargon:164` — aggregate:c14-over-budget: accumulates hits; c14-over-budget fails when they exceed the bound
- `lint_readme_serial_comma:111` — aggregate:c15-serial-comma: accumulates hits; c15-serial-comma reports them

(Branch ids such as `c6-*` are the inventory session's own numbering, which
differs from the Phase 7 table's numbering. They are identifiers, not
positions.)

## 2. Atomic rows

The artefact now has 200 rows for 198 branches. The two compound branches each
appear as two rows, one per (mode, aspect):

| `check_public_links` | `c11-beta-marker` | src/scripts/check_public_links.ts:213-219 | default | R11.e observation | agree |
| `check_public_links` | `c11-beta-marker` | src/scripts/check_public_links.ts:213-219 | --strict | R11.f invariant | agree |
| `lint_agents_layout` | `c12-consumer-warning` | src/scripts/lint_agents_layout.ts:214, | consumer mode, default | R12.c observation | agree |
| `lint_agents_layout` | `c12-consumer-warning` | src/scripts/lint_agents_layout.ts:214, | consumer mode, --strict | R12.d invariant | agree |

## 3 and 4. Inside the artefact, verbatim from its header

A branch whose code serves two aspects in two modes is written as two rows, one per (mode, aspect), so every row is one assertion under one mode.

**Reproduce from a clean checkout** (node and git only, no install): `git worktree add --detach <dir> <commit> && cd <dir> && node agents/evidence/analysis/gate-ledger-reconcile.mjs && node agents/evidence/analysis/gate-branch-sites.mjs && node agents/evidence/analysis/gate-ledger-reconcile.mjs --branches | cmp - agents/evidence/analysis/gate-branch-reconciliation-20261024.md`.

**Invalidation.** The reconciler reports the verdict stale, and 7.1 reopens for the affected rows, when any pinned check, helper closure, invocation wiring, inventory, mapping, review, site disposition, reconciler, this artefact or the ledger table changes, or when a later finding shows an omitted or mis-destined branch (`agents/evidence/analysis/gate-7-2-reliance-rules-20261024.md`).

Totals: 198 branches (200 rows) · 97 branches to binding aspects · 101 to non-assertion categories {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · 49 binding aspects {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}.

**Unsure review verdicts and their recorded decisions:**

- `lint_ticked_unmet_criteria c2-duplicate-historical` → `R2.a`: Revision 9 widened R2.a's property to name exemption-list well-formedness (no duplicate key, no entry matching nothing), so the duplicate-key branch is a finding about the same in-source list R2.a classifies.
- `check_public_links c11-resolve-outside-root` → `op:scope-exclusion`: A link resolving outside the repository cannot point into docs/contracts by construction; skipping it bounds R11.a's scope (stated on R11.a) rather than passing a run that measured nothing, so it gets its own category.
- `check_trigger_evals c6-unreadable-json` → `R5.b`: One implemented catch reports one finding text for both a read failure and a parse failure, so there is one implemented assertion: the trigger file is readable valid JSON. Under the governing definition the ledger classifies the code as it is; splitting it would classify code that does not exist. That an I/O failure reads as a finding is a defect carried to 7.2.
- `lint_eval_freshness c13-manifest-unreadable` → `R13.a`: One implemented branch reports unreadable, invalid JSON and literal null alike, so the implemented assertion is that an in-scope manifest is a readable JSON object, part of R13.a. Same reasoning as c6-unreadable-json: classify the code as it is; the I/O-versus-content conflation is a defect carried to 7.2.

## The second independent rerun, at commit `907b83bd6678e4a6a03ae81591dc4f0e84da5cef` (a separate session; its report is committed as `gate-ledger-rerun-2-20261024.md`)

- The worktree was a fresh detached checkout with an empty
  `git status --porcelain` before and after. Node v26.7.0, no install step.
- Exit codes, all 0:
  - the reconciler: `OK`, 198 branches, binding rows reached 49/49, 31 pins;
  - its self-test: 13/13;
  - the site scanner: 159 sites, 134 inside, 25 disposed, `OK`;
  - `--branches | cmp -` against the committed artefact: byte-identical,
    SHA-256 `6d630458…39ce`.
- Its own recount, with awk over the artefact:
  - 200 rows, 198 distinct branch ids;
  - 99 rows to aspects, covering 97 distinct branches; 101 to `op:*`;
  - 0 malformed rows;
  - 49 distinct aspect ids;
  - all 25 uncovered sites keyed in the dispositions file, with no extras.
- Blobs:
  - the reconciler `a3977560…`;
  - the artefact `9fcb5576…`;
  - the scanner `234eb91b…`;
  - the dispositions `668181e7…`;
  - the first rerun report `fc0c90df…`.

## Questions

**Q1.** Are the four items the last round named now supplied? Name any
disposition you judge wrong, or anything still missing.

**Q2.** With this recorded as 7.1's verdict, is the exit criterion met? Answer
yes or no. If no, name the single thing still missing and whether only the
owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
