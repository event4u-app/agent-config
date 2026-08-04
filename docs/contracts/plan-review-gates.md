---
stability: beta
keep-beta-until: 2026-09-04
---

# Plan review gates — machine-checked grammars (v1)

**Purpose.** Single source of every machine-checked grammar in the plan
governance layer: Gate R1 (plan-risk review), Gate R2 (completion review),
and the Gate C→R1 handoff state. The validators
([`lint_plan_risk_register.ts`](../../src/scripts/lint_plan_risk_register.ts),
[`check_completion_review.ts`](../../src/scripts/check_completion_review.ts))
implement exactly what this file defines; a divergence is a validator bug,
never a contract reinterpretation.

**Scope.** Marker + table grammars, honest-null and skip-declaration line
grammars, the substantial-change heuristic, the R2 context-manifest schema,
the C→R1 handoff state schema, the metrics event floor, and the validator
exit-code contract. Agent-side procedure lives in
[`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md)
(Gate C) and the gated surfaces. Settings keys:
`planning.challenge_on_create` / `planning.risk_review` /
`planning.completion_review` in
[`agent-settings.template.yml`](../../src/config/agent-settings.template.yml)
(missing key = `true`).

**Host boundary.** Hook-capable hosts get the pre-push layer;
instruction-file-only hosts (e.g. Copilot) rely on the agent-side authoring
step plus CI as the authoritative gate. CI is authoritative on every host;
the pre-push hook is defence-in-depth, the agent-side step is advisory.

## 1. Gate R1 — Risk Register grammar (`risk-review: v1`)

A **ready** (non-draft) plan file under a roadmaps directory MUST contain a
`## Risk Register` section. `status: draft` frontmatter exempts the file
until it flips to ready.

**Grandfather clause (council 2026-08-04, anthropic/claude-sonnet-4-5 +
openai/gpt-4o, convergent).** Gate activation date: **2026-08-04** — this
line is the committed source of the constant the validator carries
(`RISK_REGISTER_GATE_ACTIVATION`). A ready roadmap without a register is
**exempt** while its content has had no *substantial* change (§ 3) since
the activation date, measured against the file's last committed version
**on or before** the activation date (a file first committed after the
date has no baseline and is never exempt). Any later substantial change
lifts the exemption for that file permanently. Exempted files are reported as `grandfathered`,
never silently skipped. Rationale: no retro-noise on ~14 pre-existing
active roadmaps, no bulk agent-written pro-forma registers (the Risk-4
gate-fatigue failure), and the exemption self-expires as files churn.

### 1.1 Marker line

The first non-blank line after the `## Risk Register` heading MUST be:

```
<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <agent-id|human> -->
```

- `reviewed:` — ISO date. **Staleness rule:** the date may not be older
  than the date of the last *substantial* change to the plan (§ 3). Stale
  = fail.
- `reviewer:` — free identifier (`claude/host`, `human`, `gpt-4o`, …);
  non-empty.

### 1.2 Table rules

```markdown
| Rank | Item | Risk type | Description | Mitigation | Anchored under |
|------|------|-----------|-------------|------------|----------------|
| 1    | ...  | product \| implementation | ... | ... | Phase 2 Step 3 |
```

- Header row exactly these six columns, in this order.
- `Rank` strictly ascending integers starting at 1 (most → least risky).
- `Risk type` ∈ {`product`, `implementation`}.
- `Mitigation` non-empty on every row.
- `Anchored under` non-empty on every row and MUST reference a
  phase/step/section heading that exists **in the same document**
  (substring match against the document's headings and `**Step N:**`
  bullets). Dangling reference = fail.

### 1.3 Honest-null grammar (exact)

An empty register is valid **only** as exactly this shape (marker line per
§ 1.1, then one line):

```markdown
## Risk Register
<!-- risk-review: v1 | reviewed: YYYY-MM-DD | reviewer: <id> -->
**Honest-null:** no material product or implementation risks identified because: <reason>.
```

- The line MUST start `**Honest-null:**` and MUST contain `because:`
  followed by a non-empty reason.
- A missing `## Risk Register` section is NOT an empty section: missing =
  fail. An empty section, or a prose-only section ("no risks here")
  without the exact honest-null line = fail.

## 2. Gate R2 — findings artifact grammar (`completion-review: v1`)

Trigger events: (1) a roadmap reaching `count_open == 0` in a session,
(2) PR creation. One artifact covers both when the diff hash matches.
Artifact location: `agents/evidence/reviews/<branch-or-roadmap-slug>.findings.md`
(tracked — `agents/evidence/` owns "everything evidential" per the
[`agents-layout`](agents-layout.md) directory table; a new top-level
`agents/reviews/` would need a layout-contract edit for no gain).

**Advisory window (Stage A, verdict #20):** until the enforced-mode
threshold is committed to `CLAIMS.md` (after the 10-PR advisory
baseline), the CI wiring invokes the validator with `--advisory`:
violations are reported as warnings and the exit code is `0`. The
enforced-mode switch is the removal of that flag — nothing else changes.

### 2.1 Header

```markdown
# Findings: <id>
<!-- completion-review: v1 | reviewed: YYYY-MM-DD | diff: <sha> | reviewer: <fresh-subagent-id> -->
```

- `diff:` — the full SHA of the branch head the review ran on. **Stale
  rule:** artifact diff SHA ≠ current diff SHA → stale review → block
  (a push after review forces re-review).
- `reviewer:` — the fresh reviewer context id written by the dispatcher
  (§ 5), never the implementing session.

### 2.2 Findings table

```markdown
| # | Severity | File:Line | Finding | Status | Reason/Ref |
|---|----------|-----------|---------|--------|------------|
| 1 | critical | src/x.ts:42 | ... | open | |
```

- `Severity` ∈ {`critical`, `high`, `medium`, `low`}, rows sorted
  descending by severity (ties keep authoring order).
- Initial status of every finding: `open`.
- Terminal statuses (Phase-2 fix pass): exactly one of
  - `fixed` — `Reason/Ref` MUST carry a commit ref;
  - `accepted-risk` — `Reason/Ref` MUST carry a reason and who accepts;
  - `deferred` — `Reason/Ref` MUST carry a ticket/issue/roadmap ref.
- Gate rules: any `open` finding → block · `deferred` without ref →
  block · `accepted-risk` without reason → block.

### 2.3 Honest-null grammar (exact)

"0 findings" is valid **only** as exactly this line in place of the table:

```markdown
**Honest-null:** 0 findings, diff <sha>, reviewed YYYY-MM-DD
```

### 2.4 Skip-declaration grammar (exact)

R2 reviews a **code diff surface**. When there is none (plan-only change,
prose/docs-only deliverable, out-of-repo session, analysis-only session),
the gate records an explicit skip **instead of** a findings artifact —
same file location, this exact body line:

```markdown
**Skipped:** no code surface for this completion — <reason>, diff <sha|none>, declared YYYY-MM-DD
```

- A missing artifact is never a valid skip; the declaration is.
- The validator REJECTS a skip declaration when the diff does touch code
  paths. Code paths = any changed file matching
  `**/*.{ts,tsx,js,mjs,cjs,py,php,go,rs,sh}` or `src/scripts/**`;
  markdown, YAML/JSON config-only and `agents/**` changes do not count
  as code for this guard.

### 2.5 Findings-before-fixes (anti-silent-fixing)

The findings artifact MUST be committed before the first fix commit:

- **Ancestry check:** the commit that first adds the findings artifact
  must be an ancestor of (or equal to) every commit that marks a finding
  `fixed`. Fix commits that predate the artifact → block.
- **Backdating:** an artifact amended/rewritten to postdate fixes is
  detected via commit ancestry (the artifact's first-add commit is what
  counts, not its latest edit) → block.
- Enforcement point: pre-push hook + CI, dual layer, **CI
  authoritative**; the agent-side check is advisory (warns, never blocks
  local work).

## 3. Substantial-change heuristic (R1 trigger)

A plan diff is **substantial** when at least one of:

1. a phase/milestone heading (`## Phase …`, `## Milestone …`) is added,
   removed, or renamed;
2. deliverable checkbox lines (`- [ ]` / `- [x]` / `- [~]` / `- [-]`) are
   added or removed (count change, not state change);
3. content inside the `## Acceptance Criteria` section changes.

**Never substantial:** checkbox state flips (`[ ]`→`[x]` etc.), typo /
prose-only edits outside the blocks above, dashboard regen, archival
moves. FP/FN fixtures for this heuristic are part of the validator test
suite and act as its regression contract.

## 4. C→R1 handoff state schema

Written by the Gate C flow only, at
`agents/runtime/state/gate-c-<plan-slug>.json` (gitignored, local-only):

```json
{
  "plan_slug": "csv-export-events-dashboard",
  "plan_hash": "<sha256 of the pitch/plan draft the interview converged on>",
  "timestamp": "2026-08-04T09:30:00Z",
  "resolved_branches": [{ "q": "<question>", "a": "<resolved answer>" }],
  "transcript_ref": {
    "path": "agents/runtime/state/gate-c-<plan-slug>.transcript.md",
    "content_hash": "<sha256 of the transcript file>"
  }
}
```

- `transcript_ref` is **mandatory** — path + content hash of the interview
  transcript artifact. The R1 reader checks existence + hash match: a
  forged state file requires a forged transcript, which is visible and
  auditable.
- Freshness: R1 consumes the state only when present, `plan_hash` matches
  the current draft, and the session is the same one that wrote it;
  otherwise R1 runs fresh. No TTL — session-bound by design.
- **Write-path rule:** only the Gate C flow writes
  `agents/runtime/state/gate-c-*.json`; generic write operations on that
  glob are a lint violation.
- **Threat model (explicit, verdict #19):** this guard defends against
  *silent agent shortcuts*, not against the local human — who holds a
  legitimate settings escape hatch (`planning.challenge_on_create: false`)
  anyway, so forgery gains nothing that cannot be done openly.
  Detectability over prevention, by design. Cryptographic tamper-proofing
  is refused: a secret stored in a local repo is not a secret.

## 5. R2 context manifest — verification, not self-attestation

The Phase-1 reviewer is a **fresh subagent without the implementation
context** (blind-review pattern). The artifact header carries a context
manifest so isolation is checkable:

```markdown
<!-- context-manifest: v1
inputs:
  diff_sha: <sha>
  diff_hash: <sha256 of the diff body>
  roadmap: <path>
  roadmap_hash: <sha256>
  ac_hash: <sha256 of the extracted Acceptance Criteria block>
excluded: [session-history, agents/runtime, implementation-context]
tools: [git-diff-branch-scoped, file-read-branch-paths]
dispatched: YYYY-MM-DDTHH:MM:SSZ
-->
```

- **Dispatcher-writes-manifest rule (verdict #18):** the reviewer input is
  never assembled by the implementing agent. The deterministic dispatcher
  ([`dispatch_r2_reviewer.ts`](../../src/scripts/dispatch_r2_reviewer.ts))
  constructs the reviewer context itself (branch diff via git, roadmap
  file, extracted AC), computes the `inputs` hashes, and writes the
  manifest. CI re-derives the expected hashes from the PR's diff SHA +
  roadmap path and blocks on mismatch.
- **Tool allowlist for the reviewer context:** branch-scoped `git diff` +
  reads of branch-touched files only; no `git log` beyond the branch, no
  repo-wide grep, no reads of `agents/runtime/` or session artifacts.
- **Residual (`accepted-risk`):** host-level context injection outside the
  dispatcher (a host that prepends extra context to the subagent) is not
  preventable from inside the repo. Detection floor: the adversarial-leak
  E2E in the R2 acceptance suite.

## 6. Validator exit-code contract

Both validators (and every future gate in this family) obey:

| Exit | Meaning | Caller behaviour (hook + CI) |
|------|---------|------------------------------|
| `0`  | pass | proceed |
| `1`  | policy violation | **block** |
| `2`  | internal error (crash / timeout / parse failure) | **degraded advisory mode** — log a warning, allow the operation |

A broken gate must never block its own fix. Only policy violations block.
Both validators emit the machine-readable `scanned: <N>` line and are
registered in [`gate-coverage.yml`](../../src/config/gate-coverage.yml)
with real `min_scanned` floors.

## 7. Metrics floor (Phase 7 consumers)

Events append to the tracked JSONL `agents/evidence/metrics/gate-metrics.jsonl`
(the layout table's `evidence/metrics/` sub-dir; a new top-level
`agents/metrics/` would need a layout-contract edit) —
PII-free by construction: ids + counters only, each event carries the PR
id / branch hash so concurrent branches merge without conflict. Event
names: `gate_c_bypass`, `gate_c_interview`, `gate_c_direct`,
`r1_register_written`, `r2_review`, `r2_skip`, `r2_honest_null`,
`gate_latency`. The measurement protocol and thresholds are pre-registered
in [`CLAIMS.md`](../CLAIMS.md) (two-stage: protocol before any data,
enforced threshold derived from the 10-PR advisory baseline — verdict #20).
Quarterly `r1_mitigation_hit_rate` annotation:
[`annotate_r1_outcomes.ts`](../../src/scripts/annotate_r1_outcomes.ts).

## Cross-references

- [`plan-confidence-gate`](../../src/agent-src/contexts/execution/plan-confidence-gate.md) — Gate C agent-side procedure.
- [`lint_plan_risk_register.ts`](../../src/scripts/lint_plan_risk_register.ts) · [`check_completion_review.ts`](../../src/scripts/check_completion_review.ts) — the validators.
- [`dispatch_r2_reviewer.ts`](../../src/scripts/dispatch_r2_reviewer.ts) — R2 reviewer dispatcher.
- [`gate-coverage.yml`](../../src/config/gate-coverage.yml) — `scanned:` / `min_scanned` registration.
- [`templates/roadmaps.md`](../../src/agent-src/templates/roadmaps.md) — authoring rule pointing here.
