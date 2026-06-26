#!/usr/bin/env tsx
/**
 * Token-regression gate (token-saving Phase 0).
 *
 * Fails CI when a tracked always-loaded / projected token surface grows more
 * than the tolerance (default 5%) over a committed baseline. This is the
 * RELATIVE guard — distinct from `audit-tokens-budget` (absolute budgets) and
 * from the cache-prefix byte-stability guard (Phase 5).
 *
 * Source of truth is `internal/bench/reports/projection-cost.json`, which is
 * now produced with EXACT counts via the real tokenizer
 * (`src/scripts/_lib/token_count.ts` → js-tiktoken cl100k_base). Run
 * `task audit-tokens` first so the report reflects the working tree.
 *
 * Gated metrics (all `tokens_gpt`):
 *   - eager_rule_load    — thin_projection.eager_gpt (the eager always-on load)
 *   - thin_rule_load     — thin_projection.thin_gpt
 *   - skill_descriptions — description_catalog.skills_core_source.tokens_gpt
 *   - command_descriptions — description_catalog.commands_core_source.tokens_gpt
 *   - mcp_schemas        — Σ mcp_tool_schemas[*].tokens_gpt
 *
 * A baseline captured under a different `token_method` (e.g. proxy → exact)
 * is a legitimate reset, not a regression — the gate WARNS and asks for a
 * `--update-baseline` rather than failing on the method switch alone.
 *
 * CLI:
 *   ./scripts-run src/scripts/check_token_regression            # gate (read-only)
 *   ./scripts-run src/scripts/check_token_regression --json     # machine output
 *   ./scripts-run src/scripts/check_token_regression --tolerance 0.05
 *   ./scripts-run src/scripts/check_token_regression --update-baseline  # record current as baseline
 *
 * Exit codes:
 *   0 — within tolerance (or baseline written / warmup: no baseline yet)
 *   1 — argument / file error
 *   2 — regression: a metric exceeded baseline by more than the tolerance
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
// REPO_ROOT = <repo>/src/scripts/<file> → up two.
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

const PROJECTION_REPORT = path.join(
  REPO_ROOT,
  'internal/bench/reports/projection-cost.json',
);
const BASELINE_FILE = path.join(
  REPO_ROOT,
  'internal/bench/reports/token-baseline.json',
);
const DEFAULT_TOLERANCE = 0.05;

type Json = Record<string, unknown>;

interface Metrics {
  token_method: string;
  metrics: Record<string, number>;
}

function _num(obj: unknown, ...keys: string[]): number {
  let cur: unknown = obj;
  for (const k of keys) {
    if (cur && typeof cur === 'object' && k in (cur as Json)) {
      cur = (cur as Json)[k];
    } else {
      return 0;
    }
  }
  return typeof cur === 'number' ? cur : 0;
}

/** Extract the flat gated-metric map from a projection-cost report. */
function extract_metrics(report: Json): Metrics {
  const mcp = (report['mcp_tool_schemas'] as Json) ?? {};
  let mcp_total = 0;
  for (const server of Object.values(mcp)) {
    mcp_total += _num(server, 'tokens_gpt');
  }
  return {
    token_method: String(report['token_method'] ?? 'unknown'),
    metrics: {
      eager_rule_load: _num(report, 'thin_projection', 'eager_gpt'),
      thin_rule_load: _num(report, 'thin_projection', 'thin_gpt'),
      skill_descriptions: _num(
        report,
        'description_catalog',
        'skills_core_source',
        'tokens_gpt',
      ),
      command_descriptions: _num(
        report,
        'description_catalog',
        'commands_core_source',
        'tokens_gpt',
      ),
      mcp_schemas: mcp_total,
    },
  };
}

function _readJson(file: string): Json | null {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as Json;
  } catch {
    return null;
  }
}

interface Row {
  id: string;
  current: number;
  baseline: number;
  pct: number; // signed fraction, e.g. 0.07 = +7%
  regressed: boolean;
}

export interface GateResult {
  status: 'ok' | 'regression' | 'warmup' | 'method-changed';
  tolerance: number;
  current_method: string;
  baseline_method: string | null;
  rows: Row[];
}

export function evaluate(
  current: Metrics,
  baseline: Metrics | null,
  tolerance: number,
): GateResult {
  if (baseline === null) {
    return {
      status: 'warmup',
      tolerance,
      current_method: current.token_method,
      baseline_method: null,
      rows: [],
    };
  }
  const method_changed = baseline.token_method !== current.token_method;
  const rows: Row[] = [];
  for (const [id, cur] of Object.entries(current.metrics)) {
    const base = baseline.metrics[id] ?? 0;
    const pct = base > 0 ? (cur - base) / base : 0;
    rows.push({
      id,
      current: cur,
      baseline: base,
      pct,
      // A method switch is a legitimate baseline reset, not a regression.
      regressed: !method_changed && base > 0 && pct > tolerance,
    });
  }
  rows.sort((a, b) => b.pct - a.pct);
  const anyRegressed = rows.some((r) => r.regressed);
  const status: GateResult['status'] = anyRegressed
    ? 'regression'
    : method_changed
      ? 'method-changed'
      : 'ok';
  return {
    status,
    tolerance,
    current_method: current.token_method,
    baseline_method: baseline.token_method,
    rows,
  };
}

function _fmtPct(p: number): string {
  const sign = p >= 0 ? '+' : '';
  return `${sign}${(p * 100).toFixed(1)}%`;
}

function main(argv: string[]): number {
  let tolerance = DEFAULT_TOLERANCE;
  let asJson = false;
  let updateBaseline = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--update-baseline') updateBaseline = true;
    else if (a === '--tolerance') {
      const v = Number(argv[(i += 1)]);
      if (!Number.isFinite(v) || v < 0) {
        process.stderr.write(`error: invalid --tolerance\n`);
        return 1;
      }
      tolerance = v;
    } else if (a === '-h' || a === '--help') {
      process.stdout.write(
        'usage: check_token_regression [--json] [--tolerance F] [--update-baseline]\n',
      );
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
  }

  const report = _readJson(PROJECTION_REPORT);
  if (report === null) {
    process.stderr.write(
      `error: cannot read ${path.relative(REPO_ROOT, PROJECTION_REPORT)} — run \`task audit-tokens\` first\n`,
    );
    return 1;
  }
  const current = extract_metrics(report);

  if (updateBaseline) {
    const payload = JSON.stringify(current, null, 2) + '\n';
    fs.writeFileSync(BASELINE_FILE, payload);
    process.stdout.write(
      `✅  token baseline written: ${path.relative(REPO_ROOT, BASELINE_FILE)} (method: ${current.token_method})\n`,
    );
    return 0;
  }

  const baselineRaw = _readJson(BASELINE_FILE);
  const baseline: Metrics | null =
    baselineRaw === null ? null : (baselineRaw as unknown as Metrics);
  const result = evaluate(current, baseline, tolerance);

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (result.status === 'warmup') {
    process.stdout.write(
      `⚠️  no token baseline yet — run \`./scripts-run src/scripts/check_token_regression --update-baseline\` to record one.\n`,
    );
  } else {
    for (const r of result.rows) {
      const mark = r.regressed ? '❌' : '✅';
      process.stdout.write(
        `${mark}  ${r.id}: ${r.current} vs baseline ${r.baseline} (${_fmtPct(r.pct)})\n`,
      );
    }
    if (result.status === 'method-changed') {
      process.stdout.write(
        `⚠️  token_method changed (${result.baseline_method} → ${result.current_method}); ` +
          `baseline reset is legitimate — run --update-baseline to re-anchor.\n`,
      );
    } else if (result.status === 'regression') {
      process.stdout.write(
        `❌  token regression: a projection grew >${(tolerance * 100).toFixed(0)}% over baseline.\n`,
      );
    } else {
      process.stdout.write(
        `✅  token surfaces within +${(tolerance * 100).toFixed(0)}% of baseline.\n`,
      );
    }
  }

  return result.status === 'regression' ? 2 : 0;
}

const _IS_MAIN =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { extract_metrics, main };
