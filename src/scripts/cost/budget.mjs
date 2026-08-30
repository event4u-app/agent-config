#!/usr/bin/env node
// cost-budget — set / get / check the project's cost budget against
// accumulated session spend in agents/cost-tracking/sessions.jsonl.
//
// Derived work. Upstream, its license and the full transformation record are in
// NOTICE, docs/THIRD-PARTY-NOTICES.md and provenance/borrows.jsonl — the three
// surfaces that ship with the package. The source is not named here because a
// source name in a tracked source file is what `source-confidentiality` forbids,
// and MIT discharges through a distributed notice rather than an in-file one.
// Local-JSONL swap replaces the upstream MCP memory-store dependency. Budget
// config lives next to the sessions store as budget.json.
//
// Usage: node scripts/cost/budget.mjs {set <usd>|get|check}
// Env: BUDGET_STORE, BUDGET_CONFIG, BUDGET_PERIOD={today|week|month|all}, BUDGET_QUIET=1

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const STORE = process.env.BUDGET_STORE || 'agents/cost-tracking/sessions.jsonl';
const CONFIG = process.env.BUDGET_CONFIG || 'agents/cost-tracking/budget.json';
const SETTINGS = process.env.AGENT_SETTINGS || '.agent-settings.yml';

// Minimal YAML reader for the `cost:` block — avoids a yaml dep. Reads
// only the keys this script needs (cost.budgets.{daily,weekly,monthly},
// cost.enforcement) from the well-formed two-space-indent template.
function loadSettingsCost() {
  if (!existsSync(SETTINGS)) return null;
  let inCost = false, inBudgets = false;
  const out = { budgets: {}, enforcement: null };
  for (const raw of readFileSync(SETTINGS, 'utf-8').split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line || line.startsWith('#')) continue;
    if (/^[a-z_]+:/.test(line)) inCost = inBudgets = false;
    if (line === 'cost:') { inCost = true; continue; }
    if (!inCost) continue;
    if (/^  budgets:/.test(line)) { inBudgets = true; continue; }
    if (inBudgets && /^    [a-z]+:/.test(line)) {
      const [k, v] = line.trim().split(':').map((s) => s.trim());
      const n = parseFloat(v);
      if (Number.isFinite(n) && n > 0) out.budgets[k] = n;
      continue;
    }
    if (/^  enforcement:/.test(line)) {
      out.enforcement = line.split(':')[1].trim().replace(/['"]/g, '');
      inBudgets = false;
    }
  }
  const hasAny = Object.keys(out.budgets).length || out.enforcement;
  return hasAny ? out : null;
}

function loadConfig() {
  // Settings file wins when it carries any cost.* values.
  const fromSettings = loadSettingsCost();
  if (fromSettings) {
    const period = process.env.BUDGET_PERIOD || 'all';
    const periodKey = ({ today: 'daily', week: 'weekly', month: 'monthly' })[period];
    const budget_usd = periodKey ? fromSettings.budgets[periodKey] : (
      fromSettings.budgets.monthly || fromSettings.budgets.weekly || fromSettings.budgets.daily
    );
    if (Number.isFinite(budget_usd) && budget_usd > 0) {
      return {
        budget_usd,
        enforcement: fromSettings.enforcement || 'advisory',
        source: 'agent-settings.yml',
        setAt: null,
      };
    }
  }
  if (!existsSync(CONFIG)) return null;
  try {
    const cfg = JSON.parse(readFileSync(CONFIG, 'utf-8'));
    cfg.source = cfg.source || 'budget.json';
    cfg.enforcement = cfg.enforcement || 'advisory';
    return cfg;
  } catch { return null; }
}

function saveConfig(cfg) {
  mkdirSync(dirname(CONFIG), { recursive: true });
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
}

function loadSessions() {
  if (!existsSync(STORE)) return [];
  const out = [];
  for (const line of readFileSync(STORE, 'utf-8').split('\n')) {
    if (!line.trim()) continue;
    try { out.push(JSON.parse(line)); } catch { /* skip malformed line */ }
  }
  return out;
}

function periodFilter(period) {
  const now = Date.now();
  const day = 24 * 3600 * 1000;
  if (period === 'today') return (ts) => ts && new Date(ts).toDateString() === new Date().toDateString();
  if (period === 'week')  return (ts) => ts && (now - new Date(ts).getTime()) < 7 * day;
  if (period === 'month') return (ts) => ts && (now - new Date(ts).getTime()) < 30 * day;
  return () => true;
}

function alertLevel(u) {
  if (u >= 1.00) return { level: 'HARD_STOP', emoji: '🛑', threshold: 100 };
  if (u >= 0.90) return { level: 'CRITICAL',  emoji: '🔴', threshold: 90 };
  if (u >= 0.75) return { level: 'WARNING',   emoji: '🟠', threshold: 75 };
  if (u >= 0.50) return { level: 'INFO',      emoji: '🟡', threshold: 50 };
  return { level: 'OK', emoji: '🟢', threshold: 0 };
}

function recommendedAction(level) {
  return ({
    OK: 'within budget — no action.',
    INFO: '50% consumed — log notification, no UX disruption.',
    WARNING: '75% consumed — suggest /set-cost-profile balanced→minimal.',
    CRITICAL: '90% consumed — recommend model downgrades, consider /set-cost-profile minimal.',
    HARD_STOP: '100% consumed — halt non-essential work; review /cost:report before continuing.',
  }[level]);
}

function cmdSet(args) {
  const amount = parseFloat(args[0]);
  if (!Number.isFinite(amount) || amount <= 0) {
    console.error('usage: budget.mjs set <usd-amount>  (positive number)');
    process.exit(2);
  }
  const config = {
    budget_usd: amount,
    setAt: new Date().toISOString(),
    thresholds: { info: 0.50, warning: 0.75, critical: 0.90, hard_stop: 1.00 },
  };
  saveConfig(config);
  if (process.env.BUDGET_QUIET === '1') {
    console.log(JSON.stringify(config));
  } else {
    console.log(`✓ Budget set: $${amount.toFixed(2)} (config: ${CONFIG})`);
    console.log('  Alerts: 50% INFO · 75% WARNING · 90% CRITICAL · 100% HARD_STOP');
  }
}

function cmdGet() {
  const cfg = loadConfig();
  if (process.env.BUDGET_QUIET === '1') {
    console.log(JSON.stringify(cfg || { error: 'no budget configured' }));
    return;
  }
  if (!cfg) {
    console.log(`No budget configured (config: ${CONFIG}).`);
    console.log('Set one with: node scripts/cost/budget.mjs set <usd>');
    return;
  }
  console.log(`Budget: $${cfg.budget_usd?.toFixed(2)}  (set ${cfg.setAt})`);
  console.log('Thresholds: 50/75/90/100%');
}

function cmdCheck() {
  const cfg = loadConfig();
  const period = process.env.BUDGET_PERIOD || 'all';
  const filt = periodFilter(period);
  const filtered = loadSessions().filter((r) => filt(r.capturedAt || r.endedAt));
  const totalSpend = filtered.reduce((s, r) => s + (r.total_cost_usd || 0), 0);
  if (!cfg || !Number.isFinite(cfg.budget_usd)) {
    const out = { period, totalSpend, recordCount: filtered.length, error: 'no budget configured' };
    if (process.env.BUDGET_QUIET === '1') return console.log(JSON.stringify(out));
    console.log(`Period: ${period}`);
    console.log(`Spent so far: $${totalSpend.toFixed(2)} across ${filtered.length} sessions`);
    console.log('No budget set — run `node scripts/cost/budget.mjs set <usd>` to enable alerts.');
    return;
  }
  const utilization = totalSpend / cfg.budget_usd;
  const alert = alertLevel(utilization);
  const out = {
    period,
    budget_usd: cfg.budget_usd,
    spent_usd: totalSpend,
    remaining_usd: Math.max(0, cfg.budget_usd - totalSpend),
    utilization_pct: utilization * 100,
    level: alert.level,
    threshold: alert.threshold,
    recommended_action: recommendedAction(alert.level),
    sessionCount: filtered.length,
    enforcement: cfg.enforcement || 'advisory',
    source: cfg.source || 'budget.json',
  };
  const hardStop = alert.level === 'HARD_STOP' && out.enforcement === 'hard-stop';
  if (process.env.BUDGET_QUIET === '1') {
    console.log(JSON.stringify(out));
  } else {
    console.log(`# Budget check (period: ${period})\n`);
    console.log('| Metric | Value |\n|---|---:|');
    console.log(`| Budget | $${cfg.budget_usd.toFixed(2)} |`);
    console.log(`| Spent | $${totalSpend.toFixed(2)} |`);
    console.log(`| Remaining | $${out.remaining_usd.toFixed(2)} |`);
    console.log(`| Utilization | ${out.utilization_pct.toFixed(1)}% |`);
    console.log(`| Sessions counted | ${filtered.length} |`);
    console.log(`| **Alert** | **${alert.emoji} ${alert.level}** |`);
    console.log(`| Enforcement | ${out.enforcement} (source: ${out.source}) |`);
    console.log(`\nAction: ${out.recommended_action}`);
  }
  // Only fail closed when enforcement is hard-stop; advisory mode reports
  // the breach but exits clean so wrappers keep working.
  if (hardStop) process.exit(1);
}

// --- Per-tier budget state (docs/contracts/budget-routing.md) -------------
// v1 window for per-tier ceilings: rolling 24h for SPEND (ledger entries
// tagged `tier:`).
//
// The pending-RESERVE half was removed 2026-08-16 with the permit lifecycle it
// belonged to (converged council verdict, anthropic + openai 2 of 2; migration
// record in the contract above). This reader summed `tier-reserves.jsonl`, whose
// only writer was `acquireBudgetPermit` — a function with no production caller —
// so `reserved_usd` was provably always 0 here, and a reader could not tell that
// zero from "nothing is currently reserved". The shared-TTL config it loaded
// (src/config/budget-routing.json) existed solely to keep the two reserve
// readers in step and went with them.

function loadPerTierCeilings() {
  const out = { cheap: null, medium: null, strong: null };
  if (!existsSync(SETTINGS)) return out;
  let inPerTier = false;
  for (const line of readFileSync(SETTINGS, 'utf-8').split('\n')) {
    if (/^ {4}per_tier:/.test(line)) { inPerTier = true; continue; }
    if (inPerTier) {
      const m = line.match(/^ {6}(cheap|medium|strong):\s*([0-9.]+|null)\s*(#.*)?$/);
      if (m) {
        out[m[1]] = m[2] === 'null' ? null : Number(m[2]);
        continue;
      }
      if (/^ {0,5}\S/.test(line)) inPerTier = false;
    }
  }
  return out;
}

function cmdTier(rest) {
  const tier = rest[0];
  if (!['cheap', 'medium', 'strong'].includes(tier)) {
    console.error('usage: budget.mjs tier {cheap|medium|strong}');
    process.exit(2);
  }
  const dayMs = 24 * 3600 * 1000;
  const now = Date.now();
  const inWindow = (ts) => ts && (now - new Date(ts).getTime()) < dayMs;
  const spent = loadSessions()
    .filter((s) => s.tier === tier && inWindow(s.capturedAt || s.endedAt || s.ts))
    .reduce((acc, s) => acc + (Number(s.total_cost_usd ?? s.cost_usd ?? 0) || 0), 0);
  const ceiling = loadPerTierCeilings()[tier];
  const available = ceiling === null ? true : spent < ceiling;
  console.log(JSON.stringify({
    tier,
    window: 'rolling-24h',
    ceiling_usd: ceiling,
    spent_usd: spent,
    available,
  }));
}

function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  switch (cmd) {
    case 'set':   return cmdSet(rest);
    case 'get':   return cmdGet();
    case 'check': return cmdCheck();
    case 'tier':  return cmdTier(rest);
    default:
      console.error('usage: budget.mjs {set <usd>|get|check|tier <cheap|medium|strong>}');
      process.exit(2);
  }
}

main();
