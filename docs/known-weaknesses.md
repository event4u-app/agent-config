# Known unaddressed weaknesses

> The inverse of [`docs/CLAIMS.md`](CLAIMS.md). That ledger records what this
> package has demonstrated; this one records what it has NOT, on purpose and
> with a score, so a known-open gap is not relitigated as if it were new.
>
> Written by `road-to-skill-ecosystem-eval-integrity` Phase 5 Step 6.

## Why a register rather than a backlog

A backlog accumulates and nobody reads it, which is the failure this register is
supposed to prevent for others. The two fields that keep it honest are the
scores: **validity** says whether the weakness is real, and **status** says
whether anything has moved. A stale entry is then *visibly* stale rather than
merely long-lived, and an entry whose status score is unchanged for a year is a
finding about the register itself.

## Entry schema

```
### weakness: <kebab-id>
- weakness: <what is not covered, in one sentence>
- validity: high | medium | low     # is the gap real, and how sure are we
- status: open | partial | closed   # has anything addressed it
- addressed_by: <pointer>           # required when status is not `open`
- last_reviewed: <YYYY-MM-DD>
```

`validity: low` is a legitimate entry, not a reason to delete one: a weakness
somebody credibly raised and we judged unlikely is exactly the thing that gets
re-raised, and the register is where the earlier judgement lives.

---

### weakness: eval-spec-gate-catches-shape-only
- weakness: `lint_eval_specs` checks that a specification is well-FORMED and can say nothing about whether a fixture is well-CHOSEN — a corpus of trivially-passing cases is structurally perfect.
- validity: high
- status: partial
- addressed_by: `_lib/judge_hygiene.auditAssertions` catches the observable half after a run (an assertion that passes in both arms), which is a different instrument at a different time. Nothing checks fixture quality before a run.
- last_reviewed: 2026-08-26

### weakness: unit-scale-tolerance-hides-a-power-of-ten-error
- weakness: `chainSupportsExpected` tolerates a decimal scale so that a derivation in dollars can support an expectation in millions. A genuine error that happens to be a pure power of ten — `0.85` written where `8.5` is meant — is not caught by that check.
- validity: medium
- status: partial
- addressed_by: The self-consistency check on the derivation applies NO scale tolerance, so an internally inconsistent chain is still caught; only the declared-vs-derived comparison is loosened. Recorded in `_lib/arith_claims.sameMantissa`.
- last_reviewed: 2026-08-26

### weakness: overfit-classification-is-a-keyword-heuristic
- weakness: `classifyOverfit` decides `outcome` / `technique` / `vocabulary` from a phrase list, and no phrase list is right about natural language.
- validity: high
- status: partial
- addressed_by: Advisory by construction — it gates nothing and feeds no verdict, so being wrong about one item costs a wrong label in a report rather than a wrong decision. That bounds the damage; it does not make the classifier good.
- last_reviewed: 2026-08-26

### weakness: leak-scan-is-substring-matching
- weakness: `scanLeaks` matches denied paths as normalised substrings of recorded tool inputs. A read arriving through a symlink, a parent-directory hop, or an absolute path that does not share the denied prefix is not detected.
- validity: high
- status: open
- last_reviewed: 2026-08-26

### weakness: no-run-has-ever-produced-a-phase-3-report
- weakness: The A/B v2 Phase-3 pipeline — including the size claim whose verdict method this roadmap amended — has never produced a report. `internal/bench/reports/ab-v2/` is empty and the pre-registration records preconditions 2–4 as unmet.
- validity: high
- status: open
- last_reviewed: 2026-08-26

### weakness: frozen-snapshot-and-packaged-surface-are-unenforced
- weakness: Three conventions in `docs/contracts/eval-measurement-integrity.md` — the frozen snapshot, its re-baselining ritual, and evaluating the packaged surface — are held by prose and by nothing else.
- validity: high
- status: open
- last_reviewed: 2026-08-26

### weakness: non-inference-ratchet-starts-at-forty
- weakness: 40 backed quantitative claims carry no `non_inference` field, so 40 published figures currently have no recorded statement of what they do not license.
- validity: medium
- status: partial
- addressed_by: `check_claims:non-inference` in `src/config/gate-violation-baselines.json` — shrink-only, so the number cannot rise, and the 56-day anti-fossilization clause fails it if it is parked.
- last_reviewed: 2026-08-26
