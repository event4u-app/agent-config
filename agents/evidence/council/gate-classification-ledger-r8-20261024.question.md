<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (thirteenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger,
     the mapping and the reconciler. -->

# Step 7.1: with an independent branch inventory reconciled both ways, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The agent asking you wrote the
ledger, the branch-to-row mapping and the reconciler, but not the branch
inventory. Treat what it wrote with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

The previous round said no and named one missing thing, not owner-reserved:

> a source-derived inventory of assertion-producing branches and their
> controlling predicates, reproduced independently of the ledger author

It also named six concrete defects:

- `--global` named a helper rather than an assertion;
- the valid-JSON-but-not-usable store case was untested;
- the `--self-test` mode had never been executed;
- there was no invalidation rule;
- rows had no stable ids;
- the flag categories were a trust boundary.

The response is below, verbatim. Outside this question:

- a per-row CI divergence schema;
- operational definitions of the four classes;
- the preconditions for any enforcement change in step 7.2;
- exhaustive per-row executions, which the previous round itself rejected for
  7.1.

## The governing definition — revision 4

Both seats of the closure round on revision 3 (D33) asked for this before the
verdict is relied on. anthropic made it the condition of acceptance. It binds
every row below:

> **A classification attaches to one currently implemented assertion under one
> explicitly named invocation mode. It is semantic: it states what the
> assertion means, independent of the exit status the script happens to return
> today. Current enforcement is recorded separately, in the next section.
> Proposed behaviour is non-binding migration metadata and is excluded from the
> closure totals.**

The definition has three consequences:

- the two *target* rows of checks 9 and 12 are migration notes, not
  classifications;
- row 16's *store absent* is an observation by its own contract, while its
  current exit 1 is a recorded divergence, not part of the class;
- the mode-qualified rows of checks 8, 10 and 11 classify the assertion in that
  mode only.

**Which checks.** The population is the 16 checks the 2026-10-10 round measured
red or classified on a clean `origin/main` worktree. Its record is
`agents/evidence/council/live-tree-check-classification-20261010.md`, and the
same 16 are re-listed in
`agents/evidence/analysis/live-tree-check-remeasure-20261017.md`. That record is
the Phase 7 start inventory openai asked to have cited.

## Row ids and invalidation — revision 7

**Row ids.** Every row carries a stable id `R<check>.<letter>`. Ids are never
reassigned. A new row takes the next unused letter of its check, and a removed
row's id is not reused. The reconciler fails on a missing or duplicate id.

**Invalidation.** The verdict holds only for the source and wiring it was built
against. The reconciler compares each pinned file's current git blob with the
pin below. A mismatch makes it fail with the verdict **stale** until the ledger
is reviewed against the change and the pins are renewed. This is the
kill-switch both seats asked for: if a check's code, flags or wiring changes
without a matching ledger update, 7.1 reopens. It is a measurement, not a CI
gate. Nothing runs it automatically, and 7.2 has to run it before relying on
any row.

(22 pinned files: the 16 check scripts plus the six task and workflow files that invoke them.)

## Independent branch inventory — revision 8

The twelfth round (D36) asked for an inventory of assertion-producing
**branches**, not flags, *"reproduced independently of the ledger author"*. A
separate agent session produced it. It was told to read only the 16 scripts and
the helpers they import, to open nothing under `agents/`, and to enumerate
without classifying. It never saw this ledger. The result is
`agents/evidence/analysis/gate-branch-inventory-20261024.json`: 198 branches,
each with its file and line, effect, exit code, and controlling predicates
(flags, environment variables, file state, network, git, clock). The level of
independence is another session of the same model. It is not another provider.

The ledger author then mapped each branch, in
`agents/evidence/analysis/gate-branch-mapping-20261024.json`, either to a
binding row or to one of eight declared non-assertion categories:

- usage;
- could-not-run;
- aggregate exit;
- informational;
- write mode;
- presentation;
- silent pass;
- unreachable.

The reconciler checks both directions. Every branch must land on a binding
row of its own check or on a declared category. Every binding row must be
reached by at least one branch, so the ledger has no phantom rows. It was seen
red when the E1 row was removed.

**What the inventory changed in the ledger:**

- **New rows.**
  - `R10.j`: E1, the required keys of an experience card.
  - `R11.g`: no public link into `agents/contexts/`.
- **`--global` made atomic.** The helper `R10.i` named is split into G1 to G6
  (`R10.i`, `R10.k` to `R10.o`), as openai required.
- **Rows corrected.**
  - `R12.c` and `R12.d`: the warnings exist only in consumer mode, so in this
    repository `--strict` changes nothing.
  - `R1.a`: the ratchet fails on three verdicts, including staleness after 56
    days.
  - `R16.b`: an empty store also fails. Executed: a store of valid JSON lines
    that are not usable readings exits 1 and is counted as malformed, so the
    gap round 12 suspected does not exist.
- **Self-tests executed.** The four self-test and mutation-test modes were run,
  and each passed: 7/7, 7/7, 7/7, and the mutation test.

**Defects the inventory found in the checks themselves.** None of these is a
classification. They are recorded so they are not lost, and they are carried to
7.2:

- *Silent passes*:
  - `check_augment_description_cap` exits 0 with zero rules scanned (no
    dead-scope guard);
  - `check_knowledge_cards` exits 0 with no card directory or no cards, and
    skips C5 when git is missing;
  - `check_public_links` skips a link that resolves outside the repository.
- *Promised exit codes with no path*:
  - `check_knowledge_cards` promises exit 3 for internal errors;
  - `lint_rule_enforcement_declaration` promises exit 2 for usage errors and
    ignores unknown flags.
- *Working-directory scope*: checks 9, 12, 14 and 15 resolve their scope
  against the working directory, not the repository root.

Result:

```text
branches 198 · mapped to rows 106 · {"op:could-not-run":48,"op:informational":7,"op:usage":21,"op:unreachable":1,"op:silent-pass":5,"op:aggregate":7,"op:write":2,"op:presentation":1} · binding rows reached 50/50
rows 52 · binding 50 · migration 2 · {"invariant":42,"snapshot":0,"tolerance":0,"observation":8}
OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check's source is named by a binding row; every row has a unique id; 22 pinned files are unchanged; every branch of the independent inventory maps to a binding row or a declared category, and every binding row is reached.
```

## The ledger rows, verbatim (the evidence column abbreviated to keep the prompt within size)

| # | Check | Aspect | Property measured (from source) | Inputs / trust dependencies | Applicability / invocation mode | What makes it vary | Class | Evidence for the class | Row id |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `check_gate_completeness` | adoption ratchet | un-adopted gate count ≤ the recorded count, the recorded count exists, and it was landed or reaffirmed within `STALE_AFTER_DAYS` (56); three verdicts fail: regressed, unbaselined, stale | `src/config/gate-violation-baselines.json` (governed input), gate sources | always | new gates, adoption | **invariant** (shrink-only) | header: the count "may only go down". No authorised upward refresh is documented, and an …| `R1.a` |
| 1 | | exemption marker | every `// ledger-exempt:` carries a reason of minimum length | gate sources | always | gate edits | **invariant** | "an empty or near-empty reason is a hard failure"; form only, the header says truth is a …| `R1.b` |
| 1 | | scan scope | the gate scanned a non-dead scope (the CI-registered gate estate) | `assertScanned` | always | tree layout | **invariant** | dead scope throws, no baseline | `R1.c` |
| 2 | `lint_ticked_unmet_criteria` | ticked-vs-NOT-met | no `[x] AC` whose own text says `NOT met` | roadmaps, frozen digest list in source (governed input) | always | roadmap edits | **invariant** | frozen, digest-pinned exemptions; an unmatched entry is an error, so the list only shrink…| `R2.a` |
| 2 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | a fixed fixture table, no baseline (fixed-policy) | `R2.b` |
| 3 | `check_rule_invariants` | kernel strings present | each string of `tests/golden/invariants.json` is in the kernel rule's source and its `dist/` projection | `tests/golden/invariants.json` (governed input), `src/rules/`, `dist/agent-src/rules/` | needs the projection built | a rule reworded; the expectation file edited | **invariant** | no baseline; the expectation file is the contract and shares edit authority with the rule…| `R3.a` |
| 3 | | mutation self-test — `--mutation-selftest` | removing the first invariant string in memory makes the check fail | `tests/golden/invariants.json` | only with `--mutation-selftest`; no caller found | the expectation file | **invariant** | the header: guards the checker against a silently-green normalisation bug (repository-con…| `R3.b` |
| 4 | `check_augment_description_cap` | description length | every `type: auto` rule description ≤ `DESC_CAP` | `src/rules/*.md` | always | rule edits | **invariant** | fixed cap | `R4.a` |
| 5 | `check_trigger_evals` | freshness | `last_eval` present and not more than 90 days before the run date (a future date computes a negative age and is accepted) | `triggers.json`; clock `asOf()` (pinnable through `AC_AS_OF` or `--today`), local calendar date of the runner | always | the calendar | **invariant, time-qualified** | D24. Window 90 d. Day 90 passes, day 91 fails (`age > 90`). No grace. The runner's local …| `R5.a` |
| 5 | | structure | non-empty queries, each `q` and boolean `trigger`, both classes present | same | always | edits | **invariant** | fixed rule | `R5.b` |
| 6 | `lint_subagent_determinism` | schema consts | five determinism rules on `src/subagents/*.md` | same | always | edits | **invariant** | fixed rules | `R6.a` |
| 7 | `lint_rule_enforcement_declaration` | declaration | a rule outside the legacy list declares `enforced_by:`; `none` states its gap in the body | `src/rules/`, `src/config/rule-enforcement-baseline.json` (governed input) | always | rule additions | **invariant** (shrink-only list) | list "may only shrink"; a stale entry must leave in the same change; declaration only, no…| `R7.a` |
| 7 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | only with `--self-test`; no caller found | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--write-baseline` is a write mode that rewrites the …| `R7.b` |
| 8 | `check_token_quality_golden` | structure | unknown rule ids, bad scenarios, a labelled task without anchors | golden YAML, `dist/router.json` | always, every mode | edits | **invariant** | "Structural errors … always fail" | `R8.a` |
| 8 | | coverage and stubs — default mode | uncovered rules and stub tasks | same | invocation without `--require-complete` | labelling work | **observation** | "REPORTED, not a failure, by default" | `R8.b` |
| 8 | | coverage and stubs — `--require-complete` | no stub, no uncovered rule, required scenarios present, for the given `--scope` | same | invocation with `--require-complete` (the operator-completion gate) | labelling work | **invariant** in that mode | the header names it the completion gate, which fails on any remaining stub | `R8.c` |
| 9 | `check_council_layout` | placement — current | council artefacts only in canonical or allowlisted directories, over **every path on disk** under `agents/` (`fs.readdirSync`), untracked files included | `agents/` on disk | always | untracked local files as well as edits | **invariant** over the disk scope it measures today | fixed rule. This is the row 7.2 may rely on until the scope fix lands | `R9.a` |
| 9 | | placement — target | the same property over the **index**: the paths `git ls-files -- agents/` lists, so a staged addition is in, a staged deletion is out, and a rename counts at its new path. Only path names are checked, so partially staged content cannot change the result | git index | after the scope fix | edits | **invariant** | the canonical scope both seats asked for. No enforcement decision may rely on this row be…| `R9.b` |
| 10 | `check_knowledge_cards` | C1 size | a card ≤ 150 lines | `agents/knowledge/*.md` (external arm) | always | card edits | **invariant** | error | `R10.a` |
| 10 | | C2 pointer present | `links.authoritative` in frontmatter | same | always | card edits | **invariant** | error | `R10.b` |
| 10 | | C3 local pointer | a local pointer path exists | same + the tree | always | card or tree edits | **invariant** | error | `R10.c` |
| 10 | | C3 live URL | the URL answers | same + network | only with `--check-urls` | the remote site | **observation** | network-dependent and opt-in; not reproducible offline | `R10.d` |
| 10 | | C4 trust tag | `trust` present; `type: anti-hallucination` | same | always | card edits | **invariant** | error | `R10.e` |
| 10 | | C5 evidence consistency | distinct `source_version`s form a git-ancestry chain; `observed_at` span ≤ 7 days | same + git history | always | card edits, history | **invariant** | error. The span compares recorded timestamps, not the clock | `R10.f` |
| 10 | | C6 strict sources | `source=<path:line>` references exist and are non-empty | same + the tree | only with `--strict` | tree edits | **invariant** in that mode | error when enabled | `R10.g` |
| 10 | | freshness | newest `observed_at` older than `--freshness-days` | same + clock | only with the flag; default 0 = off | the calendar | **observation** | "Honest freshness signal (NOT a failure)" | `R10.h` |
| 10 | | G1 tier — `--global` | a global-store card carries a valid `tier` | the user-global card store | only with `--global`; no caller found | card edits | **invariant** in that mode | `_check_global_card` error | `R10.i` |
| 10 | | G2 provenance footer — `--global` | the provenance footer is present and carries `first_seen`, `promoted_at`, `last_verified`, `tier`, `seen_in` | same | only with `--global` | card edits | **invariant** in that mode | error per missing field | `R10.k` |
| 10 | | G3 redaction — `--global` | no confidential pattern (secret, email, internal host, external-source name, hidden Unicode) in a global card | same | only with `--global` | card edits | **invariant** in that mode | `redaction_scan` violations are errors | `R10.l` |
| 10 | | G4 sensitivity — `--global` | a global card carries a valid `sensitivity` | same | only with `--global` | card edits | **invariant** in that mode | error | `R10.m` |
| 10 | | G5 ownership fields — `--global` | the footer carries `source_repo`, `owner`, `review_after`, `promotion_reason` | same | only with `--global` | card edits | **invariant** in that mode | error per missing field | `R10.n` |
| 10 | | G6 no prohibited card — `--global` | no card with `sensitivity: prohibited` is in the global store | same | only with `--global` | card edits | **invariant** in that mode | error | `R10.o` |
| 10 | | E1 experience-card keys | a card with `kind: experience` carries every key of `REQUIRED_CARD_FIELDS` | `agents/knowledge/*.md` (experience arm) | always, for experience cards | card edits | **invariant** | error; C1–C6 apply to the external arm only | `R10.j` |
| 11 | `check_public_links` | link target exists | a link from the public surface into `docs/contracts/` resolves to a file | README, AGENTS.md, architecture doc, contract frontmatter | always | doc edits | **invariant** | error severity, exit 1 | `R11.a` |
| 11 | | target declares stability | the linked contract carries `stability:` frontmatter | same | always | contract edits | **invariant** | error severity, exit 1 | `R11.b` |
| 11 | | no experimental link | the public surface never links to an `experimental` contract | same | always | doc edits | **invariant** | error severity, exit 1 | `R11.c` |
| 11 | | contract file declares stability | a contract file itself carries `stability:` frontmatter, as `STABILITY.md` requires | `docs/contracts/` | always | contract edits | **invariant** | error severity, exit 1 | `R11.d` |
| 11 | | beta marker — default mode | a link to a `beta` contract carries a visible `(beta)` or `[beta]` marker | same | invocation without `--strict` | doc edits | **observation** | warning severity, exit 0 | `R11.e` |
| 11 | | beta marker — `--strict` | same property | same | invocation with `--strict` | doc edits | **invariant** in that mode | warnings fail with `--strict` | `R11.f` |
| 11 | | no link into agents contexts | the public surface does not link to an `agents/contexts/*.md` target | README, AGENTS.md, architecture doc | always | doc edits | **invariant** | error severity, exit 1 | `R11.g` |
| 12 | `lint_agents_layout` | top-level allowlist — current | every regular file at the `agents/` root is in `ALLOWED_FLAT_FILES` (both modes), and in source-repo mode every top-level directory is in `ALLOWED_SOURCE_DIRS`; read from disk (`fs.readdirSync`), untracked entries included | `agents/` on disk, `ALLOWED_SOURCE_DIRS` in source | always | untracked local entries as well as edits | **invariant** over the disk scope it measures today | fixed allowlist; the row 7.2 may rely on until the fix | `R12.a` |
| 12 | | top-level allowlist — target | the same property over the top-level entries of the paths `git ls-files -- agents/` lists (index scope, as row 9) | git index | after the scope fix | edits | **invariant** | no enforcement decision relies on it before the fix is verified | `R12.b` |
| 12 | | consumer shape — default mode | in **consumer mode only** (no source-repo markers in the working directory), entries outside the consumer-target shape are reported as warnings | `agents/` on disk | consumer mode, invocation without `--strict`; never in this repository, which is in source-repo mode | consumer layout | **observation** | warnings exit 0 without `--strict`. Corrected in revision 8: revision 6 described these a…| `R12.c` |
| 12 | | consumer shape — `--strict` | no entry outside the consumer-target shape remains | same | consumer mode with `--strict`; in this repository's source-repo mode `--strict` changes nothing | consumer layout | **invariant** in that mode | `if (strict) return 1` after the consumer warnings | `R12.d` |
| 13 | `lint_eval_freshness` | eval attached | `upstream.last_eval` present with `sha_at_eval == upstream.sha` | manifests | in scope when a skill ships triggers and a pinned corpus | corpus SHA bumps | **invariant** | SHA equality, no clock | `R13.a` |
| 14 | `lint_readme_jargon` | above-fold density | ≤ 3 watchlist hits in README lines 1–120 | README.md | always | README edits | **invariant** (numeric bound) | no named risk owner, so not a tolerance | `R14.a` |
| 15 | `lint_readme_serial_comma` | serial comma | no serial comma in README prose | README.md | always | README edits | **invariant** | fixed rule | `R15.a` |
| 16 | `check_composite_arming` | arming verdict | ≥ 10 usable composite readings from ≥ 2 sessions | the composite store | a valid store exists | new readings | **observation** | "'not yet' is a successful measurement, never a build failure" | `R16.a` |
| 16 | | store yields a usable record | a store that exists parses to at least one usable reading; an empty store also fails (dead scope) (a line with a string `session` and a `composite_ms` key) | the composite store | the store exists | a corrupt append | **invariant** | exit 1 when malformed lines leave no usable record (`malformed > 0 && readings.length ===…| `R16.b` |
| 16 | | partial malformation | malformed lines next to usable ones are counted and named per line | same | the store exists | a corrupt append | **observation** | the gate ledger records each dropped line as `precondition_unmet` and the run continues | `R16.c` |
| 16 | | store absent | the store file exists | same | no store file | bootstrap | **observation** | its own contract: no readings yet is "not measured yet" and never a build failure. Runtim…| `R16.d` |
| 16 | | self-test — `--self-test` | the checker's own fixture table behaves as declared: each planted case is accepted or refused as its row says | fixtures in source | `taskfiles/content.yml:386`, `rule-backstops.yml:321` | edits to the checker | **invariant** | fixed fixture table (fixed-policy). `--publish` is a write mode that writes a distributio…| `R16.e` |

## Questions

**Q1.** Do the independent inventory and the two-way reconciliation close the
gap the previous round named, and are the six concrete defects resolved? Name
any row still missing or wrong.

**Q2.** With revision 8 recorded as 7.1's verdict, is the exit criterion met?
Answer yes or no. If no, name the single thing still missing and whether only
the owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
