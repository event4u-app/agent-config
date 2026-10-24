<!-- evidence-type: analysis -->

<!-- The prompt given to the council on 2026-10-24 (fifteenth round that day),
     committed verbatim so the verdict beside it can be checked against what
     was actually asked. It tells the seats the asking agent wrote the ledger,
     the mapping and the reconciler. -->

# Step 7.1: with the Phase 7 manifest tied to git, every review verdict binding and the reconciler mutation-tested, is the exit criterion met?

You are advising on step 7.1 of an internal governance roadmap. Answer on the
evidence below. Where a fact is missing, say so.

The asking agent wrote the ledger, the mapping, the reconciler and its
self-test. It did not write the branch inventory or the mapping review:
separate sessions of the same model wrote those, so this is not a
cross-provider review. Treat what the asking agent wrote with suspicion.

## Background

The exit criterion is: "every live-tree check pinned red at Phase 7 start
carries a classification in 7.1's record." The four classes are invariant,
snapshot, tolerance and observation.

A classification attaches to one currently implemented assertion under one
named invocation mode. It is semantic, and current exit behaviour is recorded
separately. A check is classified when every one of its binding aspects
carries a class.

The previous round answered at one seat. It said no and named one missing
thing, not owner-reserved: a pinned, authoritative Phase 7 start manifest
reconciled to the binding aspects. It also asked for five more things:

- decisions on two `unsure` mapping verdicts;
- a reconciler that rejects every unresolved verdict;
- mutation tests of the reconciler: omitted historical checks, unresolved
  verdicts, category laundering, altered applicability, stale pins and
  withdrawn-row mishandling;
- suspend, rollback and re-attestation rules for step 7.2;
- an owner for pin renewal.

Out of scope: any enforcement change in 7.2, a per-row CI divergence schema,
operational definitions of the four classes, and fixing the defects found in
the checks themselves.

## What revision 10 added, verbatim

**Phase 7 start manifest (revision 10).** openai, round 14: closure over the
current set is not closure over the historical one. Phase 7 start manifest: measured at `bbe5b73be4f06faa528d494a271d2c8b21e28bb2`, recorded in `7a7a55b2d8947d2c2e26ff59862bc8e9fac3f573`.

The 2026-10-10 round measured the population on a clean `origin/main`
worktree at the first commit, and its record landed in the second, unchanged
since. The reconciler checks three things against git, not against this file:

- the record equals the version that landed;
- every one of its 16 checks existed at the measured commit;
- every one still exists under the same path today, so none was renamed,
  merged or removed.

`R1.c` was counted as a binding row from revision 3 to revision 8 and withdrawn
in revision 9. The withdrawal and its reason sit on the row itself.

**Ledger table, pinned (revision 10).** A row edited after the independent
review would otherwise pass silently. The reconciler hashes the table rows. The
recorded value is the ledger table: sha256 `5d6fca5aa20eef9bdfad29fe56845631d2d87e31cfb18ee06cb196931938631e`.

**Unsure verdicts, recorded decisions (from the mapping file):**

- `lint_ticked_unmet_criteria c2-duplicate-historical` → `R2.a`: Revision 9 widened R2.a's property to name exemption-list well-formedness (no duplicate key, no entry matching nothing), so the duplicate-key branch is a finding about the same in-source list R2.a classifies.
- `check_public_links c11-resolve-outside-root` → `op:scope-exclusion`: A link resolving outside the repository cannot point into docs/contracts by construction; skipping it bounds R11.a's scope (stated on R11.a) rather than passing a run that measured nothing, so it gets its own category.
- `check_trigger_evals c6-unreadable-json` → `R5.b`: One implemented catch reports one finding text for both a read failure and a parse failure, so there is one implemented assertion: the trigger file is readable valid JSON. Under the governing definition the ledger classifies the code as it is; splitting it would classify code that does not exist. That an I/O failure reads as a finding is a defect carried to 7.2.
- `lint_eval_freshness c13-manifest-unreadable` → `R13.a`: One implemented branch reports unreadable, invalid JSON and literal null alike, so the implemented assertion is that an in-scope manifest is a readable JSON object, part of R13.a. Same reasoning as c6-unreadable-json: classify the code as it is; the I/O-versus-content conflation is a defect carried to 7.2.

**Step 7.2, suspend, rollback and re-attestation, verbatim from the roadmap:**

**Suspend, rollback and re-attestation (D38).**
- *Suspend.* Reliance on the ledger stops at once in any of three cases:
  the reconciler reports stale or failed; a mapping is disproved; or a
  7.2 change reveals a divergence between a row's class and a check's
  behaviour that the ledger does not record.
- *Re-attest.* Renewing a pin is never a refresh by itself. The diff
  that made the pin stale is re-reviewed against the affected rows, and
  that re-opens 7.1 for those rows. The author of the change does not
  renew the pin alone; a council round on the diff does.
- *Sequencing.* A 7.2 change to a pinned check, helper or proof artefact
  therefore makes the reconciler fail by design. 7.1's re-attestation of
  the affected rows is a prerequisite of that 7.2 change landing, and
  not a step after it.
- *Rollback.* Any enforcement change 7.2 makes is reverted when
  reliance is suspended, until re-attestation passes.

## Reconciler output and its self-test

```text
Phase 7 manifest: 16 checks, record and paths verified against git
independent mapping review: {"disagree":12,"agree":182,"unsure":4}
branches 198 · mapped to rows 97 · {"op:could-not-run":56,"op:informational":7,"op:usage":22,"op:unreachable":1,"op:silent-pass":4,"op:aggregate":7,"op:write":2,"op:presentation":1,"op:scope-exclusion":1} · binding rows reached 49/49
rows 52 · binding 49 · non-binding 3 (migration notes and withdrawn rows) · {"invariant":41,"snapshot":0,"tolerance":0,"observation":8}
pins: 27 files, 51-file helper closure, ledger table

OK: the Phase 7 manifest matches its landed record and git history; the ledger, the invocation inventory and the manifest name the same 16 checks; every binding aspect carries one of the four classes; every assertion-changing flag is named; every branch of the independent inventory maps to a binding row or a declared category and every binding row is reached; every independent review verdict is honoured; every pin is current.

ok   baseline is clean
ok   a Phase 7 check is dropped from the ledger
ok   the Phase 7 record is altered
ok   an unsure review verdict loses its resolution
ok   a reviewed row branch is laundered into a category
ok   a review disagreement is reverted
ok   a pinned source changes
ok   a helper on the closure changes
ok   a row's applicability is edited after review
ok   a branch is mapped to the withdrawn row
ok   an unknown flag appears in a check

self-test: 11/11 case(s) behaved
```

## The ledger rows (id · aspect · applicability · class)

- `R1.a` · adoption ratchet · always · **invariant** (shrink-only)
- `R1.b` · exemption marker · always · **invariant**
- `R1.c` · scan scope · always · — **withdrawn in revision 9**
- `R2.a` · ticked-vs-NOT-met · always · **invariant**
- `R2.b` · self-test — `--self-test` · only with `--self-test`; no caller found · **invariant**
- `R3.a` · kernel strings present · needs the projection built · **invariant**
- `R3.b` · mutation self-test — `--mutation-selftest` · only with `--mutation-selftest`; no caller found · **invariant**
- `R4.a` · description length · when the scan root contains at least one `type: auto` rule; … · **invariant**
- `R5.a` · freshness · always · **invariant, time-qualified**
- `R5.b` · structure · always · **invariant**
- `R6.a` · schema consts · always · **invariant**
- `R7.a` · declaration · always · **invariant** (shrink-only list)
- `R7.b` · self-test — `--self-test` · only with `--self-test`; no caller found · **invariant**
- `R8.a` · structure · always, every mode · **invariant**
- `R8.b` · coverage and stubs — default mode · invocation without `--require-complete` · **observation**
- `R8.c` · coverage and stubs — `--require-complete` · invocation with `--require-complete` (the operator-completio… · **invariant** in that mode
- `R9.a` · placement — current · always · **invariant** over the disk scope it measures today
- `R9.b` · placement — target · after the scope fix · **invariant**
- `R10.a` · C1 size · always · **invariant**
- `R10.b` · C2 pointer present · always · **invariant**
- `R10.c` · C3 local pointer · always · **invariant**
- `R10.d` · C3 live URL · only with `--check-urls` · **observation**
- `R10.e` · C4 trust tag · always · **invariant**
- `R10.f` · C5 evidence consistency · when git is runnable; without git the ancestry half is skipp… · **invariant**
- `R10.g` · C6 strict sources · only with `--strict` · **invariant** in that mode
- `R10.h` · freshness · only with the flag; default 0 = off · **observation**
- `R10.i` · G1 tier — `--global` · only with `--global`; no caller found · **invariant** in that mode
- `R10.k` · G2 provenance footer — `--global` · only with `--global` · **invariant** in that mode
- `R10.l` · G3 redaction — `--global` · only with `--global` · **invariant** in that mode
- `R10.m` · G4 sensitivity — `--global` · only with `--global` · **invariant** in that mode
- `R10.n` · G5 ownership fields — `--global` · only with `--global` · **invariant** in that mode
- `R10.o` · G6 no prohibited card — `--global` · only with `--global` · **invariant** in that mode
- `R10.j` · E1 experience-card keys · always, for experience cards · **invariant**
- `R11.a` · link target exists · for links that resolve inside the repository; a link resolvi… · **invariant**
- `R11.b` · target declares stability · always · **invariant**
- `R11.c` · no experimental link · always · **invariant**
- `R11.d` · contract file declares stability · always · **invariant**
- `R11.e` · beta marker — default mode · invocation without `--strict` · **observation**
- `R11.f` · beta marker — `--strict` · invocation with `--strict` · **invariant** in that mode
- `R11.g` · no link into agents contexts · always · **invariant**
- `R12.a` · top-level allowlist — current · always · **invariant** over the disk scope it measures today
- `R12.b` · top-level allowlist — target · after the scope fix · **invariant**
- `R12.c` · consumer shape — default mode · consumer mode, invocation without `--strict`; never in this … · **observation**
- `R12.d` · consumer shape — `--strict` · consumer mode with `--strict`; in this repository's source-r… · **invariant** in that mode
- `R13.a` · eval attached · in scope when a skill ships triggers and a pinned corpus · **invariant**
- `R14.a` · above-fold density · always · **invariant** (numeric bound)
- `R15.a` · serial comma · always · **invariant**
- `R16.a` · arming verdict · a valid store exists · **observation**
- `R16.b` · store yields a usable record · the store exists · **invariant**
- `R16.c` · partial malformation · the store exists · **observation**
- `R16.d` · store absent · no store file · **observation**
- `R16.e` · self-test — `--self-test` · `taskfiles/content.yml:386`, `rule-backstops.yml:321` · **invariant**

## Questions

**Q1.** Is each item the previous round named now resolved? Name any that is
not.

**Q2.** With revision 10 recorded as 7.1's verdict, is the exit criterion met?
Answer yes or no. If no, name the single thing still missing and whether only
the owner-reserved second principal can supply it.

Answer each with a recommendation, the strongest objection, and your
confidence.
