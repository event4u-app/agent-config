#!/usr/bin/env tsx
/**
 * On-demand rule-load latency micro-benchmark (token-saving Phase 0).
 *
 * Under thin projection, a non-kernel rule body is a router-resolved pointer
 * that the agent loads ON DEMAND when the rule fires. This measures the
 * mechanical cost the suite controls: resolve the rule id → read its body file
 * from `dist/agent-src/rules/<id>.md`. It reports the TAIL (p50/p95/p99), not
 * just the mean — a fat tail on pointer resolution would erode the thin-
 * projection win.
 *
 * Honest scope: this is the file-IO + locate cost, NOT the live-agent
 * round-trip (model re-reading context). It bounds the part the package owns;
 * it does not model host latency.
 *
 * Kernel rules are always-loaded (never on-demand), so they are excluded.
 *
 * CLI:
 *   ./scripts-run src/scripts/bench_rule_load_latency
 *   ./scripts-run src/scripts/bench_rule_load_latency --iterations 100 --json
 *   ./scripts-run src/scripts/bench_rule_load_latency --write   # → internal/bench/reports/rule-load-latency.json
 *
 * Exit codes: 0 measured · 1 file error. Measurement only — never gates.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { performance } from 'node:perf_hooks';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const RULES_SOURCE = path.join(REPO_ROOT, 'dist/agent-src/rules');
const ROUTER = path.join(REPO_ROOT, 'dist/router.json');
const REPORT = path.join(REPO_ROOT, 'internal/bench/reports/rule-load-latency.json');

type Json = Record<string, unknown>;

/** Non-kernel (on-demand) rule ids from the router: tier_1 + tier_2. */
export function on_demand_rule_ids(router: Json): string[] {
  const ids: string[] = [];
  for (const key of ['tier_1', 'tier_2']) {
    const arr = router[key];
    if (!Array.isArray(arr)) continue;
    for (const entry of arr) {
      if (typeof entry === 'string') ids.push(entry);
      else if (entry && typeof entry === 'object' && typeof (entry as Json).id === 'string') {
        ids.push((entry as Json).id as string);
      }
    }
  }
  return ids;
}

export interface Summary {
  count: number;
  mean_ms: number;
  p50_ms: number;
  p95_ms: number;
  p99_ms: number;
  max_ms: number;
  min_ms: number;
}

/** Nearest-rank percentile over an ascending-sorted sample (p in [0,100]). */
export function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((p / 100) * sortedAsc.length);
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[idx] ?? 0;
}

export function summarize(samples: number[]): Summary {
  if (samples.length === 0) {
    return { count: 0, mean_ms: 0, p50_ms: 0, p95_ms: 0, p99_ms: 0, max_ms: 0, min_ms: 0 };
  }
  const sorted = [...samples].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const round = (x: number) => Math.round(x * 1000) / 1000; // µs precision
  return {
    count: sorted.length,
    mean_ms: round(sum / sorted.length),
    p50_ms: round(percentile(sorted, 50)),
    p95_ms: round(percentile(sorted, 95)),
    p99_ms: round(percentile(sorted, 99)),
    max_ms: round(sorted[sorted.length - 1] ?? 0),
    min_ms: round(sorted[0] ?? 0),
  };
}

function main(argv: string[]): number {
  let iterations = 50;
  let asJson = false;
  let write = false;
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--json') asJson = true;
    else if (a === '--write') write = true;
    else if (a === '--iterations') {
      const v = Number(argv[(i += 1)]);
      if (!Number.isInteger(v) || v < 1) {
        process.stderr.write('error: --iterations must be a positive integer\n');
        return 1;
      }
      iterations = v;
    } else if (a === '-h' || a === '--help') {
      process.stdout.write('usage: bench_rule_load_latency [--iterations N] [--json] [--write]\n');
      return 0;
    } else {
      process.stderr.write(`error: unknown argument: ${a}\n`);
      return 1;
    }
  }

  let router: Json;
  try {
    router = JSON.parse(fs.readFileSync(ROUTER, 'utf-8')) as Json;
  } catch {
    process.stderr.write(`error: cannot read ${path.relative(REPO_ROOT, ROUTER)} — run \`task sync\` first\n`);
    return 1;
  }
  const ids = on_demand_rule_ids(router);
  const paths: string[] = [];
  for (const id of ids) {
    const p = path.join(RULES_SOURCE, `${id}.md`);
    if (fs.existsSync(p)) paths.push(p);
  }
  if (paths.length === 0) {
    process.stderr.write('error: no on-demand rule bodies found under dist/agent-src/rules\n');
    return 1;
  }

  // Warm-up pass (page the files in) so we measure steady-state, not cold cache.
  for (const p of paths) fs.readFileSync(p, 'utf-8');

  const samples: number[] = [];
  for (let it = 0; it < iterations; it += 1) {
    for (const p of paths) {
      const t0 = performance.now();
      fs.readFileSync(p, 'utf-8'); // resolve + read = the on-demand load
      samples.push(performance.now() - t0);
    }
  }

  const summary = summarize(samples);
  const payload = {
    measured_at: new Date().toISOString(),
    rules_measured: paths.length,
    iterations,
    note: 'mechanical resolve+read latency of on-demand (non-kernel) rule bodies; excludes live-agent round-trip',
    ...summary,
  };

  if (write) {
    fs.writeFileSync(REPORT, JSON.stringify(payload, null, 2) + '\n');
  }
  if (asJson) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
  } else {
    process.stdout.write(
      `on-demand rule load (${paths.length} rules × ${iterations} iters, ${summary.count} samples):\n` +
        `  p50 ${summary.p50_ms}ms · p95 ${summary.p95_ms}ms · p99 ${summary.p99_ms}ms · ` +
        `mean ${summary.mean_ms}ms · max ${summary.max_ms}ms\n` +
        (write ? `→ wrote ${path.relative(REPO_ROOT, REPORT)}\n` : ''),
    );
  }
  return 0;
}

const _IS_MAIN =
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (_IS_MAIN) {
  process.exit(main(process.argv.slice(2)));
}

export { main };
