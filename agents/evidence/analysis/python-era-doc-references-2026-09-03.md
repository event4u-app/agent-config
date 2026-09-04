<!-- evidence-type: analysis -->
# Python-era doc references — the measurement, the narrowing, and what was accepted

<!-- generated-by: hand, road-to-python-era-doc-references · verified against 7211a4274 -->

Evidence note for `road-to-python-era-doc-references`, re-scoped on a 2/2
AI-council verdict. Everything below was measured in this change, not carried
over from the roadmap's own figures — two of which did not reproduce.

## 1. The matcher, pinned

The roadmap's Risk #3 says "a count nobody can reproduce is not a baseline" and
claimed the matcher was pinned in its Context. It was not: the Context described
it in prose, which is why the numbers could not be re-derived. It is now:

```
[A-Za-z0-9_][A-Za-z0-9_./-]*\.py\b
```

over `docs/**/*.md`, historical bucket = `docs/archive/` only.

## 2. What reproduced, and what did not

| Claim | Roadmap | Measured | Verdict |
|---|---|---|---|
| live occurrences | 946 | **946** | reproduces exactly |
| live distinct paths | 449 | **441** | **off by 8** |
| historical occurrences | 143 | **143** | reproduces |
| historical distinct | 51 | **51** | reproduces |
| total occurrences | 1,089 | **1,089** | reproduces |
| total distinct | 475 | **467** | **off by 8** |
| live files | 233 | **233** | reproduces |

Every *occurrence* count reproduces to the digit, so the matcher is the same
one. Only the *distinct* counts differ, which makes 449/475 an arithmetic or
dedup error rather than a matcher difference — and it is inherited verbatim from
the archived roadmap that produced it. The roadmap's AC-1 read "every one of the
449", so it was unsatisfiable by construction.

Internally consistent both ways: 449 + 51 − 25 = 475, and 441 + 51 − 25 = 467.

## 3. The syntactic split, which decided the scope

| Form | Occurrences |
|---|---|
| markdown inline link target — `[x](path)` | **9** |
| inside backticks | **905** |
| bare in prose | **32** |

`docs/decisions/` + `docs/adrs/` alone is **346** occurrences — **36.6 %** of the
live corpus — and the roadmap's own § Two things already ruled that class
leave-alone.

## 4. The precedent, and why it narrowed rather than declined the roadmap

ADR-200 — the record that ended the Python era — declined an analogous change:

> "Renumbering was evaluated and declined: 521 files reference 'ADR-200' as a
> stable identifier; a rename would be a 521-file mechanical churn (projections,
> condensation hashes, docs) for zero behavioral gain."

The original scope (946 occurrences / 233 files) was larger than the churn that
record refused. Both seats converged on **semantic actionability** as the
surviving distinction: a doc asserting that a gate *is enforced by* a file that
does not exist is falsified; a name in a historical sentence is not.

## 5. The search the council asked for, and what it found

Seat 2: *"the glob hid one; there might be more."* There were.

A predicate over present-tense enforcement verbs adjacent to a dead `.py` token
found **35** such claims in `docs/contracts/` alone. Sharpening it twice more —
adding `blocks|returns|wraps`, then a runnable-command predicate for the class
seat 1 asked about and seat 2 refused to accept on syntax alone — surfaced a
tail across `docs/quality.md`, `docs/threat-model.md`, `docs/command-flows.md`,
`docs/command-naming-audit.md`, `docs/setup/`, `docs/distribution/`,
`docs/maintainers/`, `docs/architecture/` and `docs/migration/`.

**Repaired: 94 occurrences across 41 files.** Live-doc count 946 → **852**,
files 233 → **221**.

### The sharpest single instance, and why the roadmap's own filter hid it

`docs/contracts/CHANGELOG-conventions.md` is a **live normative contract**. It
said, present tense, in two places:

> "Cited from the CHANGELOG header and **enforced by** `tests/test_changelog_eras.py`."
> "Drift gate — `tests/test_changelog_eras.py` **fails when** the current era's body … exceeds **250 lines**."

That file does not exist. The roadmap's historical bucket was `docs/archive/` ∪
`CHANGELOG*` ∪ `docs/migrations/` — and measured, `docs/archive/` is **43 files,
all of them `CHANGELOG*`**, while `docs/migrations/` holds exactly one. So the
`CHANGELOG*` glob added nothing except the one file it should never have caught,
and the roadmap's AC-4 required "the CHANGELOGs" byte-identical, which would have
**preserved** the defect.

The successor's identity is established beyond basename: `tests/lib/changelog_eras.test.ts`
carries the comment *"mirror of tests/test_changelog_eras.py"* and enforces the
same `CURRENT_ERA_BODY_CAP = 250`, with the original Python test names
(`test_changelog_has_current_era`, `test_current_era_body_under_cap`) preserved.
26 tests, green.

### How each repair cleared the three-fact rule

Both seats required, before any replacement: the reference concerns **this**
repository; it claims **present** applicability; and the successor identity rests
on **more than a matching basename**. Fact 3 was established per site, not by the
unique-basename rule:

- several targets name themselves the port in their own headers — *"TypeScript
  twin (py2ts Phase 1)"*, *"TypeScript twin"*, *"(py2ts)"*, *"py2ts ADR-200"*;
- one is the same path with a `.ts` extension (`src/cli/python/workspace_hosts.py` → `.ts`);
- the settings-sync successor was confirmed by **running it**: the contract
  claims "15 tests" and `tests/scripts/sync_agent_settings.test.ts` reports 15;
- every documented **flag** was verified present in the successor before a
  runnable command was written — `--kernel-budget-check`, `--all-kernel`,
  `--all`, `--quiet`, `--generate-tools`, `--sarif`, `--format`.

Ambiguous-by-basename sites were resolved by a **per-site read**, the council's
D3(a): `install.py` (98 occurrences, 10.4 % of the corpus) has two candidates —
`src/scripts/install.ts` and `src/server/routes/install.ts` — and every site's
own sentence named the installer, not the HTTP route. `dist/` matches were
excluded as projections rather than counted as candidates.

### Two defects the repair itself introduced, caught in the same pass

Fixing a path can create a new false claim in the sentence around it. Two did:

- `docs/contracts/local-knowledge-ingestion.md` said "**The Python module** …
  lives at `src/cli/python/knowledge_ingest.ts`";
- `docs/contracts/gui-wizard.md` said "**Python** `src/scripts/install.ts`
  payload-router".

Both corrected. A sweep for `Python` adjacent to a `.ts` path across the whole
diff returns only the `src/cli/python/` **directory name**, which is a real
pre-existing directory holding `.ts` files.

## 6. Described rather than renamed

Where no successor exists, the roadmap's own 2.2 rule and the
`docs/capability-matrix.md` precedent apply — say what happened rather than
invent a path:

| Reference | What happened |
|---|---|
| `tests/test_mcp_server.py` (2 sites) | **Split** at ADR-200 into three files — and the import-surface half did not survive *because its subject no longer applies*: it asserted no `subprocess`, `os.system`, `os.popen`, which are Python constructs. No test in the tree carries that guard. |
| `tests/test_sync_round_trip.py` (34 tests) | **Dropped**, no successor under any name. Named as a gap rather than as a path. |
| `scripts/check_kernel_rule_integrity.py` | No successor. Described. |
| `install.py:229-243` | A Python-era **line range**. The path has a successor; the line range does not survive a port, so the citation was replaced with prose rather than repointed at `.ts` line numbers that would be wrong. |

## 7. The accepted classes, each with its reason

**12 references remain, and every one is an accepted class:**

| Class | Count | Why it stays |
|---|---|---|
| Dead markdown link target | 9 (2 visible in this sweep) | **Already dispositioned** by the archived `road-to-contract-review-deadlines` step 4.2: each names a file the migration *deleted*, six of nine sit in `docs/contracts/`, and each is "a coverage claim with nothing behind it". Re-checked here: **none** has a successor under any name, which strengthens that record. Its stated repair condition — deciding whether seven contracts' coverage still exists — is a maintainer's call and is not re-taken. |
| Upstream third-party helpers | 6 | `docs/guidelines/agent-infra/ios-simulator-guide.md` says in its own text to *"clone the upstream repo at the pinned SHA, run the helper from there"*. Correct as written. Filing them as this repository's migration leftovers would be a **fresh false claim**. |
| A linter's own search pattern | 1 | `docs/evaluator.md` documents `lint_pre_migration_refs` as matching "pip install / python install.py". The dead path *is* the pattern the gate looks for; repointing it would break the gate's documentation. |
| Dated history rows | 2 | `kernel-membership.md`'s `2026-05-06 \| P2.2 condensation + …` row, and a migration-divergence record whose subject *is* the Python↔TS parity test. |
| Correct against a different root | (not in the sweep) | `docs/end-to-end-walkthroughs.md` names `src/calculator.py`; live twins exist at `tests/golden/sandbox/repo/src/calculator.ts`. The doc describes a **sandbox repo's own root** — the unique-basename rule would have repointed a *correct* document at a repo-root path. Risk #1 firing on real data. |
| Decision records | 346 (36.6 %) | History wearing a live path, by the roadmap's own § Two things and by ADR-200's churn reasoning. |

## 8. The gate question — answered no, with three measured reasons

1. **The instrument already exists and declines to be a gate for a recorded
   reason.** `src/scripts/measure_docs_dead_links.ts` breaks `.py` out as its
   own class and states *"MEASUREMENT ONLY … a gate landed before that decision
   would pre-empt it."* Ran green: 297 dead links of 4,626 across 731 files,
   9 with a `.py` target — unchanged before and after this change, so nothing
   broke and no link was invented.
2. **A backticked-token gate would need an allowlist covering ~37 % of the
   corpus** — the decision-record class alone. That is the "unignorable
   exclusion list" the roadmap's own Risk #4 names as the shape a warning takes
   on its way to being ignored.
3. **It could not be registered without renaming it.** Gate registration keys
   on a name prefix (`lint|check|audit|skill|verify`), so `measure_*` is not
   registrable — and renaming it would assert the gate status its own header
   declines.

The scope question it defers was also already answered **narrow** one surface
over: `check_references` scans `['dist/agent-src', 'agents', 'docs/guidelines']`,
and widening it to all of `docs/` was priced at ~300 findings and rejected as
the flood that gets a gate waived rather than adopted. Re-measured: 297.

## 9. Council round — 2026-09-03

Members configured 2 (anthropic, openai); **both answered**; cost $0.0000,
subscription-authed; multi-round with peer review.

| Decision | Verdict |
|---|---|
| D0 — is the roadmap worth doing at all? | **(b) narrow**, not decline. Repair where the path-vs-identifier distinction holds; accept the rest with ADR-200's own reasoning, per class |
| D1 — the 8-path discrepancy | **(c)** pin the regex, re-measure, declare that the baseline |
| D2 — the historical filter | **(a)** `docs/archive/` only, **and search for other live contracts** |
| D3 — `install.py`'s 98 occurrences | **(a)** path-tail plus a per-site read, inside the narrowed set |
| D4 — is bucket B safe to batch? | **No.** Resolve against the *stated root*; the sandbox counter-example is decisive |
| D5 — the partition | **(a)** add the classes; do **not** call external helpers "historical" — that manufactures false provenance |
| D6 — the gate | **(a)** no gate; keep the standing measurement |

Both seats also required two **separate denominators** — inventory completeness
(every candidate gets a reason-coded disposition) and repair completeness (every
*actionable* reference is corrected) — so that "100 % disposition" can never be
read as "946 repaired". AC-1 and AC-2 are split accordingly.

**Both seats said the roadmap should stay `status: draft` until its matcher,
taxonomy, counts and acceptance criteria were rewritten.** All four were
rewritten in this change, which is the condition they attached; the status
question is therefore a maintainer's to close, and this change does not flip it.
