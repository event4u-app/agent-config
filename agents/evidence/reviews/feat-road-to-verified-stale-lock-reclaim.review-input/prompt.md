# R2 completion review — feat-road-to-verified-stale-lock-reclaim

You are a FRESH reviewer subagent. You have no implementation context and
you must not acquire any (blind-review pattern, plan-review-gates.md §5).

## Review mode

Senior-engineer review of the branch diff. Search grid — hunt for:

- errors
- inconsistent logic
- inefficiencies
- bug-producing patterns

## Severity

Severity binds to correctness and to the requirements the change states
(the roadmap step, its acceptance criteria):

- `critical` / `high` — wrong behaviour, a broken or missing check, a data
  or security exposure, or a stated requirement not met.
- `medium` — a defect that misleads a reader or fails under a condition the
  change itself names.
- `low` — style, naming, formatting or wording that changes no behaviour,
  including in record prose (roadmaps, evidence, decision records, comments).

A false statement in record prose — a wrong figure, path or status — is not
style: it keeps the severity of what it breaks, which is high when a gate,
a command or the next step acts on it and medium when nothing does.

## Rules

- Review only — write no code, fix nothing.
- Tool allowlist (contract §5): branch-scoped `git diff` + reads of
  branch-touched files only; no `git log` beyond the branch, no repo-wide
  grep, no reads of `agents/runtime/` or session artifacts.

## Inputs

- diff: `diff.patch` — the review scope (branch head 8e24a81947c72f0191589d01166879e436bd5e11, review
  artefacts excluded), scope hash `f0586ab6d63b4fde0a1a8c2fe94bb674c8eb1465894ace3acd288baf21d4b7fe`
- roadmap under review: `roadmap.md` — NO acceptance criteria could be EXTRACTED from it, in either recognised form (an `## Acceptance criteria` heading, or inline `- **AC-n:**` bullets), so `acceptance-criteria.md` is empty. Two different things produce that result and the dispatcher cannot tell them apart: the roadmap declares none, or it declares them in a shape the extractor does not recognise. Open `roadmap.md`, decide which, and report a finding if the criteria are there.

Changed files:

- agents/evidence/council/verified-stale-lock-reclaim-ratification-r1-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r10-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r11-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r12-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r13-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r14-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r15-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r2-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r3-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r4-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r5-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r6-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r7-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r8-20261113.question.md
- agents/evidence/council/verified-stale-lock-reclaim-ratification-r9-20261113.question.md
- agents/evidence/ratifications/verified-stale-lock-reclaim-20261113.md
- agents/roadmaps/road-to-verified-stale-lock-reclaim.md
- src/config/hook-bundle-budget.json
- src/scripts/_lib/egress_session_table.ts
- src/scripts/_lib/generation_lock.ts
- src/scripts/_lib/project_registry.ts
- src/scripts/_lib/session_pins.ts
- src/scripts/advisories.ts
- src/scripts/ai_council/budget_guard.ts
- src/scripts/ai_council/cli_call_budget.ts
- src/scripts/hooks/state_io.ts
- src/scripts/language_mirror_hook.ts
- src/scripts/worktree_cleanup_check.ts
- tests/scripts/_lock_interleaving_harness.ts
- tests/scripts/generation_lock_interleavings.test.ts
- tests/scripts/hooks/state_io.test.ts
- tests/scripts/language_mirror_hook.test.ts
- tests/scripts/lock_sites_interleavings.test.ts
- tests/scripts/session_pins.test.ts
- tests/scripts/state_io_lock_interleavings.test.ts

## Output format (contract §2.2)

Fill the findings table in `feat-road-to-verified-stale-lock-reclaim.findings.md`:

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- Severity ∈ {`critical`, `high`, `medium`, `low`}, rows sorted descending
  by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- A row is LIVE wherever it appears — a code fence around it changes
  nothing. If you quote the template as an illustration, its Status cell
  must be exactly `example`, or the gate reads it as a real finding.
- 0 findings → replace the table with exactly this honest-null line
  (contract §2.3):

```markdown
**Honest-null:** 0 findings, scope f0586ab6d63b4fde0a1a8c2fe94bb674c8eb1465894ace3acd288baf21d4b7fe, reviewed <YYYY-MM-DD>
```

## Return channel

Final message = the return envelope and nothing else: {summary, handoff, confidence, findings, risks}. Shape + the write-to-disk-first rule: contexts/execution/subagent-response-contract.md. The findings table stays a file.
