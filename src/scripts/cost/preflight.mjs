#!/usr/bin/env node
// Cost preflight hook — process-entry gate per ADR docs/adrs/cost/0001-hard-stop-hook.md.
//
// Wraps scripts/cost/budget.mjs check. Reads cost.enforcement from
// .agent-settings.yml. Exits non-zero only when:
//   - enforcement: hard-stop, AND
//   - level: HARD_STOP
//
// Default behaviour without any budget configured: exit 0 (fail-open).
// Designed to be invoked by shell / CI wrappers BEFORE composing a
// turn: `task cost:preflight` or `node scripts/cost/preflight.mjs`.

import { spawnSync } from 'node:child_process';

const QUIET = process.env.PREFLIGHT_QUIET === '1';

function runBudgetCheck() {
  const env = { ...process.env, BUDGET_QUIET: '1' };
  const r = spawnSync('node', ['scripts/cost/budget.mjs', 'check'], { env, encoding: 'utf-8' });
  if (r.error) return { ok: false, fatal: true, msg: String(r.error) };
  const out = (r.stdout || '').trim();
  if (!out) return { ok: true, unbudgeted: true };
  // budget.mjs prints a single JSON line under BUDGET_QUIET=1 when a
  // budget is set; otherwise it prints a no-budget plaintext notice.
  if (!out.startsWith('{')) return { ok: true, unbudgeted: true };
  try {
    const data = JSON.parse(out);
    // budget.mjs JSON shape carries `error: 'no budget configured'`
    // when cost.budgets are all 0 / absent — treat as unbudgeted.
    if (data.error || !Number.isFinite(data.budget_usd)) return { ok: true, unbudgeted: true };
    return { ok: true, data, childExit: r.status ?? 0 };
  } catch (e) {
    return { ok: false, fatal: true, msg: `parse: ${e.message}`, raw: out };
  }
}

function refuse(data) {
  if (QUIET) {
    console.log(JSON.stringify({
      preflight: 'refused',
      reason: 'cost-hard-stop',
      level: data.level,
      utilization_pct: data.utilization_pct,
      budget_usd: data.budget_usd,
      spent_usd: data.spent_usd,
      enforcement: data.enforcement,
      source: data.source,
    }));
    return;
  }
  console.error('# 🛑 Cost preflight — HARD STOP\n');
  console.error('| Metric | Value |');
  console.error('|---|---:|');
  console.error(`| Budget | $${data.budget_usd.toFixed(2)} |`);
  console.error(`| Spent | $${data.spent_usd.toFixed(2)} |`);
  console.error(`| Utilization | ${data.utilization_pct.toFixed(1)}% |`);
  console.error(`| Enforcement | ${data.enforcement} (source: ${data.source}) |`);
  console.error('\nBypass (pick one — see docs/contracts/cost-enforcement.md):');
  console.error('  1. Raise the budget: edit .agent-settings.yml § cost.budgets.<period>');
  console.error('  2. Reset the ledger: node scripts/cost/track.mjs reset --confirm');
  console.error('  3. Disable enforcement: set cost.enforcement: advisory');
}

function main() {
  const r = runBudgetCheck();
  if (!r.ok && r.fatal) {
    // Fail-open on infra error — never block work because the hook itself broke.
    if (!QUIET) console.error(`# cost-preflight: skipped (${r.msg})`);
    process.exit(0);
  }
  if (r.unbudgeted) {
    if (!QUIET) console.log('# cost-preflight: no budget configured — pass.');
    process.exit(0);
  }
  const d = r.data;
  const hardStop = d.level === 'HARD_STOP' && d.enforcement === 'hard-stop';
  if (hardStop) {
    refuse(d);
    process.exit(1);
  }
  if (!QUIET) {
    console.log(`# cost-preflight: ${d.level} (${d.utilization_pct.toFixed(1)}% of $${d.budget_usd.toFixed(2)}, enforcement=${d.enforcement})`);
  } else {
    console.log(JSON.stringify({ preflight: 'pass', level: d.level, enforcement: d.enforcement, utilization_pct: d.utilization_pct }));
  }
  process.exit(0);
}

main();
