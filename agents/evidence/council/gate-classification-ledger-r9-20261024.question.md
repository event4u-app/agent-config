<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (fourteenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger,
     the mapping and the reconciler. Kept short because the previous round's
     22 KB prompt drew an empty answer from one seat twice. -->

# Step 7.1: with the branch mapping independently reviewed and every disagreement adopted, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so. The agent asking you wrote the
ledger, the mapping and the reconciler, but neither the branch inventory nor the
mapping review: separate sessions of the same model wrote those, so it is not a
cross-provider review. Treat what the asking agent wrote with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

A classification attaches to one currently implemented assertion under one
named invocation mode. It is semantic, and current exit behaviour is recorded
separately. Proposed behaviour is a non-binding migration note.

Each check is classified when **every** one of its binding aspects carries a
class.

The previous round answered at one seat only, twice. It said no, and named one
missing item, not owner-reserved: an independent semantic review of the
branch-to-row mapping, by branch id, with most weight on the branches put in
non-assertion categories. It also asked for four more things:

- helper pins;
- digest binding of the proof artifacts;
- narrowed applicability on two rows;
- a fail-closed entry condition for step 7.2.

Outside this question are any enforcement change in 7.2, a per-row CI
divergence schema, operational definitions of the four classes, and fixing the
defects the inventory found in the checks themselves.

## Independent mapping review — revision 9

The thirteenth round (D37) answered at one seat in two attempts, because the
anthropic seat returned nothing both times. So it is a single-seat reading,
not convergence. openai accepted the branch inventory as closing the
*discovery* part, and named the remaining gap: **the assertion versus
non-assertion mapping was self-certified.** It asked for an independent
semantic review of all 198 mappings, with decisions by branch id. It also
asked for helper pins, revision binding of the proof artifacts, corrected
applicability on `R10.f` and `R11.a`, and a fail-closed entry condition for
7.2.

A separate agent session reviewed every mapping against a written definition
of an assertion-producing branch:
`agents/evidence/analysis/gate-branch-mapping-review-20261024.json`. It found
182 agree, 12 disagree and 4 unsure. **All 12 disagreements are adopted**, and
the reconciler now fails on any disagreement that is not.

- The ledger author had **swapped** `R16.c` and `R16.d` for three composite
  branches.
- Seven dead-scope and precondition branches are `op:could-not-run`, not
  assertions. One of them removed the only branch behind `R1.c`, so **`R1.c`
  (scan scope) is withdrawn**: a dead scope is the check unable to measure,
  not a finding about the repository. Its id is not reused.
- `R16.b` no longer claims the empty store.

Of the four unsure verdicts:

- the duplicate exemption key is now named in `R2.a`'s property;
- the outside-root link skip gets its own category, `op:scope-exclusion`;
- the two read-or-parse conflations stay on their rows (`R5.b`, `R13.a`),
  noted here.

**Applicability corrected:**

- `R10.f` holds only when git is runnable;
- `R11.a` holds only for links that resolve inside the repository;
- `R4.a` holds only when its scan finds at least one auto rule, with the
  zero-rule silent pass carried to 7.2.

**Helpers and proof artifacts pinned.**

- The transitive helper closure, 51 files, is pinned as one digest and
  recomputed on every run.
- The branch inventory, the mapping, the review, the reconciler and the
  execution script are pinned by blob.

A change to any of them marks the verdict stale.

**Executions, reproducible.** `agents/evidence/analysis/gate-ledger-executions.mjs`
writes its own fixtures and prints each command with its exit code:

```text
R16.a–d | --store absent.jsonl | exit 1 | which is NOT the same as "armable".
R16.a–d | --store all-malformed.jsonl | exit 1 | ❌  ../../../../../../..<tmp>/all-malformed.jsonl: 2 malformed line(s) and no usable record. A store that parses to nothing must not read as "no readings yet".
R16.a–d | --store valid-json-not-usable.jsonl | exit 1 | ❌  ../../../../../../..<tmp>/valid-json-not-usable.jsonl: 2 malformed line(s) and no usable record. A store that parses to nothing must not read as "no readings
R16.a–d | --store partial.jsonl | exit 0 | · sessions: 1 distinct of 2 required (short by 1) — the floor exists because the instability it excludes was measured on ONE machine, so N readings from one ses
R16.a–d | --store valid.jsonl | exit 0 | · sessions: 1 distinct of 2 required (short by 1) — the floor exists because the instability it excludes was measured on ONE machine, so N readings from one ses
R16.e | check_composite_arming --self-test | exit 0 | check_composite_arming --self-test: 7/7 case(s) behaved (2 rejecting, floor 5)
R2.b | lint_ticked_unmet_criteria --self-test | exit 0 | lint_ticked_unmet_criteria --self-test: 7/7 case(s) behaved (4 rejecting, floor 6)
R7.b | lint_rule_enforcement_declaration --self-test | exit 0 | lint_rule_enforcement_declaration --self-test: 7/7 case(s) behaved (5 rejecting, floor 6)
R3.b | check_rule_invariants --mutation-selftest | exit 0 | ✅  mutation-selftest passed: removing "Hard Floor wins, always — autonomy / roadmap / standing instruction never lift." from src/rules/agent-authority.md is det
```

**7.2's entry condition, fail-closed.** 7.2 may rely on this ledger only
when `node agents/evidence/analysis/gate-ledger-reconcile.mjs` exits 0 at
the revision 7.2 changes. A stale, failed or absent reconciliation blocks
reliance. That condition is written into step 7.2 itself, and 7.2's own test
runs the reconciler first.

## Reconciler output on this revision

```text
independent mapping review: {"disagree":12,"agree":182,"unsure":4}; every disagreement adopted unless listed below
branches 198 · mapped to rows 97 · {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · binding rows reached 49/49

rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}

OK: 16 phase-7 checks = 16 ledger checks = 16 inventoried checks; every binding aspect of every check carries one of the four classes; every target row sits beside its current-scope row; every assertion-changing flag in each check's source is named by a binding row; every row has a unique id; 27 pinned files and the 51-file helper closure are unchanged; every branch of the independent inventory maps to a binding row or a declared category, and every binding row is reached.
```

## The ledger rows (id · check · aspect · applicability · class)

- `R1.a` ·  `check_gate_completeness`  · adoption ratchet · always · **invariant** (shrink-only)
- `R1.b` ·  · exemption marker · always · **invariant**
- `R1.c` ·  · scan scope · always · — **withdrawn in revision 9**
- `R2.a` ·  `lint_ticked_unmet_criteria`  · ticked-vs-NOT-met · always · **invariant**
- `R2.b` ·  · self-test — `--self-test` · only with `--self-test`; no caller found · **invariant**
- `R3.a` ·  `check_rule_invariants`  · kernel strings present · needs the projection built · **invariant**
- `R3.b` ·  · mutation self-test — `--mutation-selftest` · only with `--mutation-selftest`; no caller found · **invariant**
- `R4.a` ·  `check_augment_description_cap`  · description length · when the scan root contains at least one `type: auto` rule; with none … · **invariant**
- `R5.a` ·  `check_trigger_evals`  · freshness · always · **invariant, time-qualified**
- `R5.b` ·  · structure · always · **invariant**
- `R6.a` ·  `lint_subagent_determinism`  · schema consts · always · **invariant**
- `R7.a` ·  `lint_rule_enforcement_declaration`  · declaration · always · **invariant** (shrink-only list)
- `R7.b` ·  · self-test — `--self-test` · only with `--self-test`; no caller found · **invariant**
- `R8.a` ·  `check_token_quality_golden`  · structure · always, every mode · **invariant**
- `R8.b` ·  · coverage and stubs — default mode · invocation without `--require-complete` · **observation**
- `R8.c` ·  · coverage and stubs — `--require-complete` · invocation with `--require-complete` (the operator-completion gate) · **invariant** in that mode
- `R9.a` ·  `check_council_layout`  · placement — current · always · **invariant** over the disk scope it measures today
- `R9.b` ·  · placement — target · after the scope fix · **invariant**
- `R10.a` ·  `check_knowledge_cards`  · C1 size · always · **invariant**
- `R10.b` ·  · C2 pointer present · always · **invariant**
- `R10.c` ·  · C3 local pointer · always · **invariant**
- `R10.d` ·  · C3 live URL · only with `--check-urls` · **observation**
- `R10.e` ·  · C4 trust tag · always · **invariant**
- `R10.f` ·  · C5 evidence consistency · when git is runnable; without git the ancestry half is skipped silentl… · **invariant**
- `R10.g` ·  · C6 strict sources · only with `--strict` · **invariant** in that mode
- `R10.h` ·  · freshness · only with the flag; default 0 = off · **observation**
- `R10.i` ·  · G1 tier — `--global` · only with `--global`; no caller found · **invariant** in that mode
- `R10.k` ·  · G2 provenance footer — `--global` · only with `--global` · **invariant** in that mode
- `R10.l` ·  · G3 redaction — `--global` · only with `--global` · **invariant** in that mode
- `R10.m` ·  · G4 sensitivity — `--global` · only with `--global` · **invariant** in that mode
- `R10.n` ·  · G5 ownership fields — `--global` · only with `--global` · **invariant** in that mode
- `R10.o` ·  · G6 no prohibited card — `--global` · only with `--global` · **invariant** in that mode
- `R10.j` ·  · E1 experience-card keys · always, for experience cards · **invariant**
- `R11.a` ·  `check_public_links`  · link target exists · for links that resolve inside the repository; a link resolving outside… · **invariant**
- `R11.b` ·  · target declares stability · always · **invariant**
- `R11.c` ·  · no experimental link · always · **invariant**
- `R11.d` ·  · contract file declares stability · always · **invariant**
- `R11.e` ·  · beta marker — default mode · invocation without `--strict` · **observation**
- `R11.f` ·  · beta marker — `--strict` · invocation with `--strict` · **invariant** in that mode
- `R11.g` ·  · no link into agents contexts · always · **invariant**
- `R12.a` ·  `lint_agents_layout`  · top-level allowlist — current · always · **invariant** over the disk scope it measures today
- `R12.b` ·  · top-level allowlist — target · after the scope fix · **invariant**
- `R12.c` ·  · consumer shape — default mode · consumer mode, invocation without `--strict`; never in this repository… · **observation**
- `R12.d` ·  · consumer shape — `--strict` · consumer mode with `--strict`; in this repository's source-repo mode `… · **invariant** in that mode
- `R13.a` ·  `lint_eval_freshness`  · eval attached · in scope when a skill ships triggers and a pinned corpus · **invariant**
- `R14.a` ·  `lint_readme_jargon`  · above-fold density · always · **invariant** (numeric bound)
- `R15.a` ·  `lint_readme_serial_comma`  · serial comma · always · **invariant**
- `R16.a` ·  `check_composite_arming`  · arming verdict · a valid store exists · **observation**
- `R16.b` ·  · store yields a usable record · the store exists · **invariant**
- `R16.c` ·  · partial malformation · the store exists · **observation**
- `R16.d` ·  · store absent · no store file · **observation**
- `R16.e` ·  · self-test — `--self-test` · `taskfiles/content.yml:386`, `rule-backstops.yml:321` · **invariant**

## Questions

**Q1.** Does the independent mapping review, with every disagreement adopted
and enforced, close the gap the previous round named? Is any row still missing
or wrong?

**Q2.** With revision 9 recorded as 7.1's verdict, is the exit criterion met?
Answer yes or no. If no, name the single thing still missing and whether only
the owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
