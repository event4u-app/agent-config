# Complexity Report

Generated: 2026-10-26 · generator: `src/scripts/complexity_report.ts` (report-only, always exits 0).

> Kill criterion: if this report is cited by zero decisions (ADR/roadmap/PR) within 3 releases, delete the script and record the honest null.

This is a soft ratchet, not a gate: no feature carries a per-change declaration duty against these numbers, and the script never fails CI. It exists to make complexity growth *visible* over time.

**Wired into CI as `task complexity-report`** (report-only, exit 0 always — it never fails the build). Regenerate manually with `npx tsx src/scripts/complexity_report.ts` or `task complexity-report`.

## Metrics

| # | Metric | Value | Method |
|---|---|---|---|
| 1 | Active settings axes | 137 (43 top + 94 second-level) | YAML-parsed `agent-settings.template.yml`: top-level keys + (sum of key-counts of every top-level mapping value). |
| 2 | Runtime-state surfaces (PROXY) | 75 | Grepped `agents/runtime/state/<x>` (slash literal) and `'agents','runtime','state','<x>'` (path.join literal) across every .ts file under `src`; counts the distinct first path segment after `state/` once per name, regardless of call-site count. Tokens containing glob/template characters (`*`, `<`, `>`) are dropped as grep artifacts, not surfaces. Proxy for "surfaces the shipped code writes", not a runtime read/write trace. |
| 3 | Cross-subsystem dependency edges (PROXY) | 301 (source: import-proxy) | No usable discovery-graph cache found at `agents/runtime/state/discovery-graph-v1.json` (gitignored, rebuilding it here would spawn the full manifest builder) — counted relative sibling-`.js` import edges between top-level `src/scripts/*.ts` files instead (subdirectories like `_lib/`, `_cli/` excluded). |
| 4 | Always-loaded rule bytes | 29,425 bytes across 9 rule(s) | Byte sum of `dist/agent-src/rules/<id>.md` for every id in `dist/router.json`'s `kernel` array (the always-loaded rule set the router ships). |
| 5 | Mandatory gates per core workflow (PROXY) | 2.69 avg/file (86 mentions across 32 files) | Case-insensitive whole-word `gate` mention count across every .ts file under `src/agent-src/templates/scripts/work_engine/directives`, divided by the file count. A static text-mention proxy (docstrings + code both count), not a semantic gate-graph analysis. |
| 6 | Rule→skill coupling | 100 targets, 116 backlinks | Reused `rule_backlinks.ts`'s `collect()` over `src/rules/*.md` — distinct routing targets (frontmatter `routes_to:` + "Body migrated to" prose) and total rule→target backlinks. No new scanning logic. |

**Runtime-state surfaces found:** `.dispatcher`, `audit`, `canary-liveness.json`, `chain-nudge.json`, `checkpoints`, `code-graph-context.json`, `code-graph-v1.json`, `config-weakening.json`, `conformance-rates.jsonl`, `context-fill.json`, `context-hygiene.json`, `context-observation.json`, `council-probes.json`, `council-route-liveness.json`, `council-route-models.json`, `decisions`, `design-consistency-shadow.jsonl`, `design-pass-hook.json`, `design-slop-hook.json`, `discovery-graph-v1.json`, `dispatch-issues.jsonl`, `edit-shape`, `egress-observations.jsonl`, `end-review-nudge`, `free-hand-shadow.jsonl`, `gate-budget-ledger.jsonl`, `hand-exposure.json`, `hand-kind-flips.json`, `handoff-context.md`, `injection-census.jsonl`, `injection-turn`, `interruptions.jsonl`, `learning-dogfood.jsonl`, `mcp-tool-fingerprints.json`, `memory-index-v1.sqlite3`, `memory-recall`, `obligations`, `probe-throttle`, `quota-parked`, `recycle-envelope.consumed.json`, `recycle-envelope.json`, `render`, `render-baselines`, `reread-guard`, `review-axis`, `review-baseline`, `roadmap-progress`, `routing-telemetry.jsonl`, `rule-inject`, `rule-trips.json`, `run-continuation.jsonl`, `security`, `session-eol`, `session-index-latch`, `skill-tiers.json`, `source-first-gate.json`, `source-first-gate.jsonl`, `subagent-ledger`, `suggestion-latch.json`, `supervise-relaunches.json`, `surface-probe.json`, `team-review-gate.json`, `telemetry-disclosure.json`, `test-results.json`, `tool-result-census.jsonl`, `toolchain.json`, `turn-end-gate`, `ui-audit.json`, `ui-conformance.json`, `ui-route-nudge.json`, `unattended-budget.json`, `unattended-jobs.json`, `verify-before-complete.json`, `work`, `x.json`

**Always-loaded rule ids:** `agent-authority`, `ask-when-uncertain`, `commit-policy`, `direct-answers`, `language-and-tone`, `no-cheap-questions`, `non-destructive-by-default`, `scope-control`, `verify-before-complete`

## Delta vs previous report

Previous report generated: 2026-08-26.

| Metric | Previous | Current | Δ |
|---|---|---|---|
| Active settings axes | 136 | 137 | +1 |
| Runtime-state surfaces | 59 | 75 | +16 |
| Cross-subsystem dependency edges | 173 | 301 | +128 |
| Always-loaded rule bytes | 29,466 | 29,425 | -41 |
| Gate mentions (total) | 79 | 86 | +7 |
| Rule→skill coupling (backlinks) | 109 | 116 | +7 |

## Ratchet vs baseline

Baseline: `internal/reports/complexity-baseline.json` (baselined 2026-07-12 — "initial baseline (feedback-8.11-2 Phase 1)").

| Metric | Baseline | Current | Δ |
|---|---|---|---|
| Active settings axes | 108 | 137 | +29 |
| Runtime-state surfaces | 12 | 75 | +63 |
| Cross-subsystem dependency edges | 83 | 301 | +218 |
| Always-loaded rule bytes | 30,563 | 29,425 | -1,138 |
| Gate mentions (total) | 73 | 86 | +13 |
| Rule→skill coupling (backlinks) | 81 | 116 | +35 |

WARN: Active settings axes is above baseline (108 → 137, +29) — justify in the PR that raises it, or re-baseline deliberately (update complexity-baseline.json in the same PR with a one-line reason field).
WARN: Runtime-state surfaces is above baseline (12 → 75, +63) — justify in the PR that raises it, or re-baseline deliberately (update complexity-baseline.json in the same PR with a one-line reason field).
WARN: Cross-subsystem dependency edges is above baseline (83 → 301, +218) — justify in the PR that raises it, or re-baseline deliberately (update complexity-baseline.json in the same PR with a one-line reason field).
WARN: Gate mentions (total) is above baseline (73 → 86, +13) — justify in the PR that raises it, or re-baseline deliberately (update complexity-baseline.json in the same PR with a one-line reason field).
WARN: Rule→skill coupling (backlinks) is above baseline (81 → 116, +35) — justify in the PR that raises it, or re-baseline deliberately (update complexity-baseline.json in the same PR with a one-line reason field).
Improved: Always-loaded rule bytes is below baseline (30,563 → 29,425, -1,138).

## Raw metrics (machine-parseable — do not hand-edit)

The delta section above is computed by parsing this block out of the previous report.

<!-- complexity-report-raw
{
  "schema_version": 1,
  "generated_at": "2026-10-26",
  "settings_axes": {
    "top": 43,
    "second": 94,
    "total": 137,
    "method": "YAML-parsed `agent-settings.template.yml`: top-level keys + (sum of key-counts of every top-level mapping value)."
  },
  "runtime_state": {
    "count": 75,
    "names": [
      ".dispatcher",
      "audit",
      "canary-liveness.json",
      "chain-nudge.json",
      "checkpoints",
      "code-graph-context.json",
      "code-graph-v1.json",
      "config-weakening.json",
      "conformance-rates.jsonl",
      "context-fill.json",
      "context-hygiene.json",
      "context-observation.json",
      "council-probes.json",
      "council-route-liveness.json",
      "council-route-models.json",
      "decisions",
      "design-consistency-shadow.jsonl",
      "design-pass-hook.json",
      "design-slop-hook.json",
      "discovery-graph-v1.json",
      "dispatch-issues.jsonl",
      "edit-shape",
      "egress-observations.jsonl",
      "end-review-nudge",
      "free-hand-shadow.jsonl",
      "gate-budget-ledger.jsonl",
      "hand-exposure.json",
      "hand-kind-flips.json",
      "handoff-context.md",
      "injection-census.jsonl",
      "injection-turn",
      "interruptions.jsonl",
      "learning-dogfood.jsonl",
      "mcp-tool-fingerprints.json",
      "memory-index-v1.sqlite3",
      "memory-recall",
      "obligations",
      "probe-throttle",
      "quota-parked",
      "recycle-envelope.consumed.json",
      "recycle-envelope.json",
      "render",
      "render-baselines",
      "reread-guard",
      "review-axis",
      "review-baseline",
      "roadmap-progress",
      "routing-telemetry.jsonl",
      "rule-inject",
      "rule-trips.json",
      "run-continuation.jsonl",
      "security",
      "session-eol",
      "session-index-latch",
      "skill-tiers.json",
      "source-first-gate.json",
      "source-first-gate.jsonl",
      "subagent-ledger",
      "suggestion-latch.json",
      "supervise-relaunches.json",
      "surface-probe.json",
      "team-review-gate.json",
      "telemetry-disclosure.json",
      "test-results.json",
      "tool-result-census.jsonl",
      "toolchain.json",
      "turn-end-gate",
      "ui-audit.json",
      "ui-conformance.json",
      "ui-route-nudge.json",
      "unattended-budget.json",
      "unattended-jobs.json",
      "verify-before-complete.json",
      "work",
      "x.json"
    ],
    "method": "Grepped `agents/runtime/state/<x>` (slash literal) and `'agents','runtime','state','<x>'` (path.join literal) across every .ts file under `src`; counts the distinct first path segment after `state/` once per name, regardless of call-site count. Tokens containing glob/template characters (`*`, `<`, `>`) are dropped as grep artifacts, not surfaces. Proxy for \"surfaces the shipped code writes\", not a runtime read/write trace."
  },
  "dependency_edges": {
    "count": 301,
    "source": "import-proxy",
    "method": "No usable discovery-graph cache found at `agents/runtime/state/discovery-graph-v1.json` (gitignored, rebuilding it here would spawn the full manifest builder) — counted relative sibling-`.js` import edges between top-level `src/scripts/*.ts` files instead (subdirectories like `_lib/`, `_cli/` excluded)."
  },
  "always_rule_bytes": {
    "count": 9,
    "bytes": 29425,
    "ids": [
      "agent-authority",
      "ask-when-uncertain",
      "commit-policy",
      "direct-answers",
      "language-and-tone",
      "no-cheap-questions",
      "non-destructive-by-default",
      "scope-control",
      "verify-before-complete"
    ],
    "method": "Byte sum of `dist/agent-src/rules/<id>.md` for every id in `dist/router.json`'s `kernel` array (the always-loaded rule set the router ships)."
  },
  "gate_mentions": {
    "total": 86,
    "files": 32,
    "perFile": 2.69,
    "method": "Case-insensitive whole-word `gate` mention count across every .ts file under `src/agent-src/templates/scripts/work_engine/directives`, divided by the file count. A static text-mention proxy (docstrings + code both count), not a semantic gate-graph analysis."
  },
  "rule_skill_coupling": {
    "targets": 100,
    "backlinks": 116,
    "method": "Reused `rule_backlinks.ts`'s `collect()` over `src/rules/*.md` — distinct routing targets (frontmatter `routes_to:` + \"Body migrated to\" prose) and total rule→target backlinks. No new scanning logic."
  }
}
-->
