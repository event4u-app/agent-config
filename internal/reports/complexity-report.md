# Complexity Report

Generated: 2026-07-12 · generator: `src/scripts/complexity_report.ts` (report-only, always exits 0).

> Kill criterion: if this report is cited by zero decisions (ADR/roadmap/PR) within 3 releases, delete the script and record the honest null.

This is a soft ratchet, not a gate: no feature carries a per-change declaration duty against these numbers, and the script never fails CI. It exists to make complexity growth *visible* over time.

**Not wired into CI.** Regenerate manually with `npx tsx src/scripts/complexity_report.ts`. The one-line hook a maintainer would add to `Taskfile.yml` (report-only, exit 0 always, so it never blocks CI): `complexity-report: npx tsx src/scripts/complexity_report.ts`.

## Metrics

| # | Metric | Value | Method |
|---|---|---|---|
| 1 | Active settings axes | 108 (32 top + 76 second-level) | YAML-parsed `agent-settings.template.yml`: top-level keys + (sum of key-counts of every top-level mapping value). |
| 2 | Runtime-state surfaces | 15 | Grepped `agents/runtime/state/<x>` (slash literal) and `'agents','runtime','state','<x>'` (path.join literal) across every .ts file under `src`; counts the distinct first path segment after `state/` once per name, regardless of call-site count. Proxy for "surfaces the shipped code writes", not a runtime read/write trace. |
| 3 | Cross-subsystem dependency edges | 78 (source: import-proxy) | No usable discovery-graph cache found at `agents/runtime/state/discovery-graph-v1.json` (gitignored, rebuilding it here would spawn the full manifest builder) — counted import edges of the shape `from './<sibling>.js'` between top-level `src/scripts/*.ts` files instead (subdirectories like `_lib/`, `_cli/` excluded). |
| 4 | Always-loaded rule bytes | 30,563 bytes across 9 rule(s) | Byte sum of `dist/agent-src/rules/<id>.md` for every id in `dist/router.json`'s `kernel` array (the always-loaded rule set the router ships). |
| 5 | Mandatory gates per core workflow | 2.52 avg/file (73 mentions across 29 files) | Case-insensitive whole-word `gate` mention count across every .ts file under `src/agent-src/templates/scripts/work_engine/directives`, divided by the file count. A static text-mention proxy (docstrings + code both count), not a semantic gate-graph analysis. |

**Runtime-state surfaces found:** `*.json`, `.dispatcher`, `.dispatcher.lock`, `<concern>.json`, `<id>.json`, `audit`, `context-hygiene.json`, `design-slop-hook.json`, `discovery-graph-v1.json`, `dispatch-issues.jsonl`, `hot-context.md`, `onboarding-gate.json`, `surface-probe.json`, `toolchain.json`, `work`

**Always-loaded rule ids:** `agent-authority`, `ask-when-uncertain`, `commit-policy`, `direct-answers`, `language-and-tone`, `no-cheap-questions`, `non-destructive-by-default`, `scope-control`, `verify-before-complete`

## Delta vs previous report

Previous report generated: 2026-07-12.

| Metric | Previous | Current | Δ |
|---|---|---|---|
| Active settings axes | 108 | 108 | 0 |
| Runtime-state surfaces | 15 | 15 | 0 |
| Cross-subsystem dependency edges | 78 | 78 | 0 |
| Always-loaded rule bytes | 30,563 | 30,563 | 0 |
| Gate mentions (total) | 73 | 73 | 0 |

## Raw metrics (machine-parseable — do not hand-edit)

The delta section above is computed by parsing this block out of the previous report.

<!-- complexity-report-raw
{
  "schema_version": 1,
  "generated_at": "2026-07-12",
  "settings_axes": {
    "top": 32,
    "second": 76,
    "total": 108,
    "method": "YAML-parsed `agent-settings.template.yml`: top-level keys + (sum of key-counts of every top-level mapping value)."
  },
  "runtime_state": {
    "count": 15,
    "names": [
      "*.json",
      ".dispatcher",
      ".dispatcher.lock",
      "<concern>.json",
      "<id>.json",
      "audit",
      "context-hygiene.json",
      "design-slop-hook.json",
      "discovery-graph-v1.json",
      "dispatch-issues.jsonl",
      "hot-context.md",
      "onboarding-gate.json",
      "surface-probe.json",
      "toolchain.json",
      "work"
    ],
    "method": "Grepped `agents/runtime/state/<x>` (slash literal) and `'agents','runtime','state','<x>'` (path.join literal) across every .ts file under `src`; counts the distinct first path segment after `state/` once per name, regardless of call-site count. Proxy for \"surfaces the shipped code writes\", not a runtime read/write trace."
  },
  "dependency_edges": {
    "count": 78,
    "source": "import-proxy",
    "method": "No usable discovery-graph cache found at `agents/runtime/state/discovery-graph-v1.json` (gitignored, rebuilding it here would spawn the full manifest builder) — counted import edges of the shape `from './<sibling>.js'` between top-level `src/scripts/*.ts` files instead (subdirectories like `_lib/`, `_cli/` excluded)."
  },
  "always_rule_bytes": {
    "count": 9,
    "bytes": 30563,
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
    "total": 73,
    "files": 29,
    "perFile": 2.52,
    "method": "Case-insensitive whole-word `gate` mention count across every .ts file under `src/agent-src/templates/scripts/work_engine/directives`, divided by the file count. A static text-mention proxy (docstrings + code both count), not a semantic gate-graph analysis."
  }
}
-->
