#!/usr/bin/env node
// cost-track — auto-capture token usage from a Claude Code session jsonl
// and append a structured record to agents/cost-tracking/sessions.jsonl.
//
// Forked from ruvnet/ruflo plugins/ruflo-cost-tracker/scripts/track.mjs.
// Local-JSONL swap replaces the upstream `mcp__claude-flow__memory_store`
// dependency. Pricing constants are kept in sync with REFERENCE.md.
//
// Env:
//   TRACK_CWD=<path>          override which project's sessions to scan
//   TRACK_SESSION=<file>      pin to a specific session jsonl
//   TRACK_OUT=<path>          also write the JSON summary to this path
//   TRACK_DRY_RUN=1           skip the JSONL append
//   TRACK_QUIET=1             suppress markdown summary
//   TRACK_STORE=<path>        override (default: agents/cost-tracking/sessions.jsonl)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const DEFAULT_STORE = 'agents/cost-tracking/sessions.jsonl';

// USD per 1M tokens.
const PRICING = {
  haiku:  { input: 0.25,  output: 1.25,  cache_write: 0.30,  cache_read: 0.03 },
  sonnet: { input: 3.00,  output: 15.00, cache_write: 3.75,  cache_read: 0.30 },
  opus:   { input: 15.00, output: 75.00, cache_write: 18.75, cache_read: 1.50 },
};

function modelTier(model) {
  if (!model) return 'unknown';
  const m = String(model).toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('opus')) return 'opus';
  return 'unknown';
}

function costForUsage(tier, u) {
  const p = PRICING[tier];
  if (!p || !u) return 0;
  return (u.input_tokens || 0) / 1e6 * p.input
       + (u.output_tokens || 0) / 1e6 * p.output
       + (u.cache_creation_input_tokens || 0) / 1e6 * p.cache_write
       + (u.cache_read_input_tokens || 0) / 1e6 * p.cache_read;
}

function encodeProjectPath(cwd) { return cwd.replace(/\//g, '-'); }

function findProjectDir(cwd) {
  const c = join(PROJECTS_DIR, encodeProjectPath(cwd));
  return existsSync(c) ? c : null;
}

function findActiveSession(dir) {
  const e = readdirSync(dir).filter((f) => f.endsWith('.jsonl'))
    .map((f) => ({ f, mtime: statSync(join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  return e[0] ? join(dir, e[0].f) : null;
}

function summarizeSession(jsonlPath) {
  const lines = readFileSync(jsonlPath, 'utf-8').split('\n').filter(Boolean);
  const byModel = {};
  const byTier = { haiku: 0, sonnet: 0, opus: 0, unknown: 0 };
  let messageCount = 0, totalCost = 0, firstTs = null, lastTs = null;
  let sessionId = null, cwd = null;
  for (const line of lines) {
    let m; try { m = JSON.parse(line); } catch { continue; }
    if (!sessionId && m.sessionId) sessionId = m.sessionId;
    if (!cwd && m.cwd) cwd = m.cwd;
    if (m.timestamp) {
      if (!firstTs || m.timestamp < firstTs) firstTs = m.timestamp;
      if (!lastTs || m.timestamp > lastTs) lastTs = m.timestamp;
    }
    if (m.type !== 'assistant' || !m.message?.usage) continue;
    messageCount++;
    const model = m.message.model || 'unknown';
    const tier = modelTier(model);
    const u = m.message.usage;
    const cost = costForUsage(tier, u);
    const slot = byModel[model] || { tier, input_tokens: 0, output_tokens: 0,
      cache_creation_input_tokens: 0, cache_read_input_tokens: 0, messages: 0, cost_usd: 0 };
    slot.input_tokens += u.input_tokens || 0;
    slot.output_tokens += u.output_tokens || 0;
    slot.cache_creation_input_tokens += u.cache_creation_input_tokens || 0;
    slot.cache_read_input_tokens += u.cache_read_input_tokens || 0;
    slot.messages++; slot.cost_usd += cost;
    byModel[model] = slot; byTier[tier] += cost; totalCost += cost;
  }
  return { sessionId, cwd, startedAt: firstTs, endedAt: lastTs, messageCount,
    byModel, byTier, total_cost_usd: totalCost, capturedAt: new Date().toISOString() };
}

function persistJsonl(summary, store) {
  mkdirSync(dirname(store), { recursive: true });
  appendFileSync(store, JSON.stringify(summary) + '\n');
  return { ok: true, path: store };
}

function main() {
  const targetCwd = process.env.TRACK_CWD || process.cwd();
  const projectDir = findProjectDir(targetCwd);
  if (!projectDir) {
    console.error(`cost-track: no Claude Code project dir for cwd=${targetCwd}`);
    console.error(`looked under ${PROJECTS_DIR}/${encodeProjectPath(targetCwd)}`);
    process.exit(2);
  }
  const sessionPath = process.env.TRACK_SESSION || findActiveSession(projectDir);
  if (!sessionPath || !existsSync(sessionPath)) {
    console.error(`cost-track: no session jsonl in ${projectDir}`); process.exit(2);
  }
  const summary = summarizeSession(sessionPath);
  if (process.env.TRACK_OUT) writeFileSync(process.env.TRACK_OUT, JSON.stringify(summary, null, 2));
  const store = process.env.TRACK_STORE || DEFAULT_STORE;
  let res = { ok: false, reason: 'dry-run' };
  if (process.env.TRACK_DRY_RUN !== '1') res = persistJsonl(summary, store);
  if (process.env.TRACK_QUIET === '1') return;

  console.log(`# cost-track — session ${(summary.sessionId || '').slice(0, 8) || 'unknown'}`);
  console.log('');
  console.log('| Metric | Value |\n|---|---:|');
  console.log(`| Session ID | \`${summary.sessionId}\` |`);
  console.log(`| Project | \`${summary.cwd}\` |`);
  console.log(`| First message | ${summary.startedAt} |`);
  console.log(`| Last message | ${summary.endedAt} |`);
  console.log(`| Assistant messages | ${summary.messageCount} |`);
  console.log(`| **Total cost** | **$${summary.total_cost_usd.toFixed(6)}** |`);
  console.log(`| Persisted | ${res.ok ? `\`${res.path}\`` : `**FAILED** (${res.reason})`} |`);
  console.log('\n## Per-model breakdown\n');
  console.log('| Model | Tier | Messages | Input | Output | Cache write | Cache read | Cost |');
  console.log('|---|---|---:|---:|---:|---:|---:|---:|');
  for (const [m, s] of Object.entries(summary.byModel).sort((a, b) => b[1].cost_usd - a[1].cost_usd)) {
    console.log(`| \`${m}\` | ${s.tier} | ${s.messages} | ${s.input_tokens} | ${s.output_tokens} | ${s.cache_creation_input_tokens} | ${s.cache_read_input_tokens} | $${s.cost_usd.toFixed(6)} |`);
  }
  console.log('\n## Per-tier breakdown\n');
  console.log('| Tier | Cost |\n|---|---:|');
  for (const [t, c] of Object.entries(summary.byTier).sort((a, b) => b[1] - a[1])) {
    if (c > 0) console.log(`| ${t} | $${c.toFixed(6)} |`);
  }
}

main();
