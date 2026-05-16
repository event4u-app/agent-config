#!/usr/bin/env node
// Cost-budget fixture runner — exercises scripts/cost/budget.mjs and
// scripts/cost/preflight.mjs against the reference suite at
// tests/fixtures/cost/budget/. Step-11 Phase 2 Step 5.
//
// For each fixture dir, asserts:
//   - budget.mjs JSON output (BUDGET_QUIET=1 check) matches expected.json,
//   - preflight.mjs exit code matches expected_exit.
//
// Exit non-zero on any mismatch; print per-fixture diff.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..', '..');
const FIXTURES = resolve(ROOT, 'tests/fixtures/cost/budget');

function runBudget(fixture) {
  const env = {
    ...process.env,
    BUDGET_QUIET: '1',
    BUDGET_STORE: join(fixture, 'sessions.jsonl'),
    AGENT_SETTINGS: join(fixture, 'settings.yml'),
    BUDGET_CONFIG: '/dev/null',
  };
  const r = spawnSync('node', ['scripts/cost/budget.mjs', 'check'], {
    cwd: ROOT, env, encoding: 'utf-8',
  });
  return { stdout: (r.stdout || '').trim(), status: r.status ?? -1 };
}

function runPreflight(fixture) {
  const env = {
    ...process.env,
    PREFLIGHT_QUIET: '1',
    BUDGET_STORE: join(fixture, 'sessions.jsonl'),
    AGENT_SETTINGS: join(fixture, 'settings.yml'),
    BUDGET_CONFIG: '/dev/null',
  };
  const r = spawnSync('node', ['scripts/cost/preflight.mjs'], {
    cwd: ROOT, env, encoding: 'utf-8',
  });
  return { status: r.status ?? -1, stdout: (r.stdout || '').trim(), stderr: (r.stderr || '').trim() };
}

function diff(actual, expected, label) {
  if (actual === expected) return null;
  return `${label} mismatch\n  expected: ${expected}\n  actual:   ${actual}`;
}

function main() {
  const dirs = readdirSync(FIXTURES, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  let failed = 0;
  const results = [];
  for (const name of dirs) {
    const fixture = join(FIXTURES, name);
    const expectedJsonPath = join(fixture, 'expected.json');
    const expectedExitPath = join(fixture, 'expected_exit');
    if (!existsSync(expectedJsonPath) || !existsSync(expectedExitPath)) {
      results.push({ name, status: 'skip', reason: 'no expected files' });
      continue;
    }
    const expectedJson = JSON.parse(readFileSync(expectedJsonPath, 'utf-8'));
    const expectedExit = parseInt(readFileSync(expectedExitPath, 'utf-8').trim(), 10);
    const b = runBudget(fixture);
    let actualJson;
    try { actualJson = JSON.parse(b.stdout); } catch (e) {
      results.push({ name, status: 'fail', reason: `budget.mjs non-JSON: ${b.stdout.slice(0, 200)}` });
      failed++; continue;
    }
    const expectedSerialised = JSON.stringify(expectedJson);
    const actualSerialised = JSON.stringify(actualJson);
    const jsonDiff = diff(actualSerialised, expectedSerialised, 'budget.mjs JSON');
    const p = runPreflight(fixture);
    const exitDiff = diff(String(p.status), String(expectedExit), 'preflight exit');
    if (jsonDiff || exitDiff) {
      results.push({ name, status: 'fail', reason: [jsonDiff, exitDiff].filter(Boolean).join('\n') });
      failed++;
    } else {
      results.push({ name, status: 'pass', tier: actualJson.level, exit: p.status });
    }
  }
  for (const r of results) {
    if (r.status === 'pass') {
      console.log(`✓ ${r.name}  tier=${r.tier}  preflight-exit=${r.exit}`);
    } else if (r.status === 'skip') {
      console.log(`- ${r.name}  skipped (${r.reason})`);
    } else {
      console.log(`✗ ${r.name}`);
      for (const line of r.reason.split('\n')) console.log(`    ${line}`);
    }
  }
  const passed = results.filter((r) => r.status === 'pass').length;
  const skipped = results.filter((r) => r.status === 'skip').length;
  console.log(`\n${passed} passed · ${failed} failed · ${skipped} skipped · ${results.length} total`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
