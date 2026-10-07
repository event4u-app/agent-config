# Dispatcher import closure — 2026-10

<!-- evidence-type: analysis -->

> **Pin:** `adaad0aa2` (`main`, 2026-10-07). The roadmap step named `a75bb3210`;
> the reading was taken at the later `main` the lane branched from, and the
> dispatcher's import block (`src/scripts/hooks/dispatch_hook.ts:40-75`) is the
> one the roadmap's Context quotes. Written by step 1.1 of
> `road-to-a-ratification-fence-that-follows-its-imports` as the reading the
> ratification gate's derived set is built from.

## Command

```bash
npx tsx src/scripts/report_dispatch_import_closure.ts --markdown
```

## Method

The static closure of `src/scripts/hooks/dispatch_hook.ts`, following relative
imports only (`import … from`, `export … from`, side-effect `import`), walked
transitively. The walk stops at `src/scripts/hooks/concern_registry.ts`: every
module it imports is a concern, classed `concern` and not walked into, because
concerns stay outside the fence. Classes are decided from each module's own
source (`src/scripts/_lib/dispatch_import_closure.ts`):

- **verdict** — names an exit-code constant, or exports a function whose name
  says it decides a refusal (`deny…`, `…block…`, `…verdict…`, `…fail_closed…`);
- **payload** — names the payload or stdin a concern receives;
- **neither** — everything else.

## Reading

| Class | Module |
|---|---|
| verdict | `src/scripts/hooks/bundle_integrity.ts` |
| verdict | `src/scripts/hooks/concern_failure_policy.ts` |
| verdict | `src/scripts/hooks/exit_codes.ts` |
| verdict | `src/scripts/hooks/host_lowering.ts` |
| verdict | `src/scripts/hooks/host_semantics.ts` |
| verdict | `src/scripts/hooks/injection_budget.ts` |
| verdict | `src/scripts/hooks/permission_gate.ts` |
| verdict | `src/scripts/hooks/stdin_failure_policy.ts` |
| payload | `src/scripts/_lib/collector_denominator.ts` |
| payload | `src/scripts/_lib/collector_record.ts` |
| payload | `src/scripts/_lib/stdin.ts` |
| payload | `src/scripts/_lib/surface.ts` |
| payload | `src/scripts/hooks/concern_registry.ts` |
| payload | `src/scripts/hooks/concern_timings.ts` |
| payload | `src/scripts/hooks/hook_stdin.ts` |
| payload | `src/scripts/hooks/payload_stub.ts` |
| payload | `src/scripts/hooks/state_io.ts` |
| neither | `src/scripts/_lib/collector_store.ts` |
| neither | `src/scripts/_lib/session_role.ts` |
| neither | `src/scripts/_lib/spawn_env.ts` |
| neither | `src/scripts/_lib/sqlite_guard.ts` |
| neither | `src/scripts/hooks/category_a.ts` |
| neither | `src/scripts/hooks/dispatch_issues.ts` |
| neither | `src/scripts/hooks/fallback_yaml.ts` |
| neither | `src/scripts/hooks/py_json_dumps.ts` |
| neither | `src/scripts/hooks/table_fingerprint.ts` |

Totals: verdict 8 · payload 9 · neither 9 · concern 61. The 61 `concern` rows
are omitted from the table.

## What the reading says

- The module release finding `21900086c1a0` turned on —
  `concern_failure_policy.ts`, whose `_resolve_execution_failure` returns
  `EXIT_BLOCK` for a crashed blocking concern — reads as `verdict`, and so does
  `stdin_failure_policy.ts`, whose `denyOnStdinFailure` decides whether a
  failed read refuses. Neither was in the gate's hand-written pattern.
- `stdin_failure_policy.ts` names no exit-code constant. A constant-only
  classifier would have put it in `payload`; the export-name signal is what
  catches it. Recorded because it is the case a narrower classifier gets wrong.
- `py_json_dumps.ts` and `fallback_yaml.ts`, which the roadmap listed beside
  the policies, read as `neither`: they serialise and parse and decide no
  code. They stay outside the fence, which is the roadmap's Risk 1 mitigation.
- `host_lowering.ts` and `host_semantics.ts` read as `verdict`: they decide
  which slot can refuse and how a refusal is emitted per host — the authority
  the compiled `host_lowering.json` already carries a record for, reached one
  file later.

## Limits

- Static only. A dynamic `import()` is not followed.
- The classifier reads names, not behaviour. A verdict-deciding module that
  names no exit-code constant and exports no refusal-named function reads as
  `payload` or `neither`. Both signals are pinned in
  `tests/scripts/report_dispatch_import_closure.test.ts`.
