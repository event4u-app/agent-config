#!/usr/bin/env node
// cost-track — auto-capture token usage from a Claude Code session jsonl
// and append a structured record to agents/cost-tracking/sessions.jsonl.
//
// Derived work. The upstream, its MIT terms and the reproduced copyright and
// permission notice are in CREDITS.md; the transformation record is in
// docs/THIRD-PARTY-NOTICES.md, generated from provenance/borrows.jsonl. The
// first two ship with the package, which is what discharges the obligation for
// a consumer who receives this file from npm. The source is not named here
// because a source name in a tracked source file is what
// `source-confidentiality` forbids, and MIT discharges through a distributed
// notice rather than an in-file one.
// Local-JSONL swap replaces the upstream MCP memory-store dependency. Pricing
// constants are kept in sync with REFERENCE.md.
//
// Dedup + main/subagent split, and the logic driving them, are mirrored
// (not imported) from `src/scripts/_lib/cc_transcript.ts`: this file ships
// to consumers as a plain `.mjs` run via bare `node` (see the `/cost:report`
// command doc), and `tsx` — the only thing in this repo that can execute a
// `.ts` module at runtime — is a devDependency, never shipped. A shared
// `.ts` import here would work in this repo's own dev shell and break for
// every consumer. On this repo's own transcripts, 50.3% of assistant/usage
// records in a single active session file are replays (message.id +
// requestId collide) — the resumed/compacted-session mechanic rewrites
// prior turns back into the transcript — so an un-deduped sum overstates
// real spend by roughly 2x, on top of never having counted subagent legs
// (they live in a sibling `<sessionId>/subagents/agent-*.jsonl` tree the
// old single-file read never visited).
//
// Env:
//   TRACK_CWD=<path>          override which project's sessions to scan
//   TRACK_SESSION=<file>      pin to a specific session jsonl
//   TRACK_OUT=<path>          also write the JSON summary to this path
//   TRACK_DRY_RUN=1           skip the JSONL append
//   TRACK_QUIET=1             suppress markdown summary
//   TRACK_STORE=<path>        override (default: agents/cost-tracking/sessions.jsonl)

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync, appendFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { homedir } from 'node:os';

const PROJECTS_DIR = join(homedir(), '.claude', 'projects');
const DEFAULT_STORE = 'agents/cost-tracking/sessions.jsonl';

// USD per 1M tokens. cache_write_5m / cache_write_1h are Anthropic's two
// cache-write TTL rates (1.25x / 2x of `input`) — a single flat rate here
// previously priced every write at the 5m rate regardless of the TTL the
// call actually used.
const PRICING = {
  haiku:  { input: 0.25,  output: 1.25,  cache_write_5m: 0.30,  cache_write_1h: 0.50,  cache_read: 0.03 },
  sonnet: { input: 3.00,  output: 15.00, cache_write_5m: 3.75,  cache_write_1h: 6.00,  cache_read: 0.30 },
  opus:   { input: 15.00, output: 75.00, cache_write_5m: 18.75, cache_write_1h: 30.00, cache_read: 1.50 },
};

function modelTier(model) {
  if (!model) return 'unknown';
  const m = String(model).toLowerCase();
  if (m.includes('haiku')) return 'haiku';
  if (m.includes('sonnet')) return 'sonnet';
  if (m.includes('opus')) return 'opus';
  return 'unknown';
}

// A record's cache_creation_input_tokens is split into ephemeral_5m /
// ephemeral_1h by `usage.cache_creation` (see usageTokens()). Any part of
// cache_creation_input_tokens NOT covered by that split (older records that
// predate the TTL breakdown) is priced at the 5m rate — Anthropic's default
// TTL — rather than silently dropped.
// A tier with no PRICING row prices at zero. That zero is indistinguishable
// from a genuinely free message, so the ROW carries `rate_missing` and the run
// warns once on stderr — the alternative (throwing) would lose a whole session
// of real token counts over one unrecognised model id. Token counts are kept
// untouched precisely so a later re-pricing pass can backfill the cost.
// Every token class that costs money. A record where this is 0 costs 0 at any
// rate, so a missing rate cannot understate it.
function billableTokens(u) {
  if (!u) return 0;
  return (u.input_tokens || 0) + (u.output_tokens || 0)
       + (u.cache_creation_input_tokens || 0) + (u.cache_read_input_tokens || 0);
}

function costForUsage(tier, u) {
  const p = PRICING[tier];
  if (!p || !u) return 0;
  const knownSplit = (u.ephemeral_5m_input_tokens || 0) + (u.ephemeral_1h_input_tokens || 0);
  const unaccounted = Math.max(0, (u.cache_creation_input_tokens || 0) - knownSplit);
  return (u.input_tokens || 0) / 1e6 * p.input
       + (u.output_tokens || 0) / 1e6 * p.output
       + ((u.ephemeral_5m_input_tokens || 0) + unaccounted) / 1e6 * p.cache_write_5m
       + (u.ephemeral_1h_input_tokens || 0) / 1e6 * p.cache_write_1h
       + (u.cache_read_input_tokens || 0) / 1e6 * p.cache_read;
}

// Normalize a raw `message.usage` block into the flat shape costForUsage()
// and the model-tally accumulator both consume, pulling the TTL split out
// of the nested `cache_creation` object Anthropic ships it under.
function usageTokens(raw) {
  const cc = (raw && raw.cache_creation) || {};
  return {
    input_tokens: Number(raw?.input_tokens) || 0,
    output_tokens: Number(raw?.output_tokens) || 0,
    cache_creation_input_tokens: Number(raw?.cache_creation_input_tokens) || 0,
    cache_read_input_tokens: Number(raw?.cache_read_input_tokens) || 0,
    ephemeral_5m_input_tokens: Number(cc.ephemeral_5m_input_tokens) || 0,
    ephemeral_1h_input_tokens: Number(cc.ephemeral_1h_input_tokens) || 0,
  };
}

// Subagent iff a non-empty top-level agentId OR isSidechain === true —
// both signals are checked because observed subagent transcripts carry
// both, but a differently-shaped one could carry only one.
function classifyBucket(rec) {
  const hasAgentId = typeof rec.agentId === 'string' && rec.agentId.length > 0;
  return (hasAgentId || rec.isSidechain === true) ? 'subagent' : 'main';
}

// message.id + requestId together identify one real API call; Claude Code
// can replay the same turn into more than one transcript file (see the
// header comment) and this is what collapses those replays back to one.
function dedupKey(rec) {
  const id = typeof rec.message?.id === 'string' ? rec.message.id : '';
  const reqId = typeof rec.requestId === 'string' ? rec.requestId : '';
  return `${id} ${reqId}`;
}

// Claude Code slugs every character outside [A-Za-z0-9-], not just separators
// and dots: `/x/.claude/y` → `-x--claude-y`, and `feat+wt` → `feat-wt`.
//
// This is an inline copy of `_lib/cc_transcript.projectStoreSlug` — a module
// boundary, not an oversight: this file imports node builtins only. Keep the
// two in step. It was narrowed twice for the same reason (first `/` alone
// missed dotted segments; then `[/.]` missed a `+` worktree and silently
// resolved no project dir at all), which is why the class is now closed rather
// than extended one character per incident.
function encodeProjectPath(cwd) { return cwd.replace(/[^A-Za-z0-9-]/g, '-'); }

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

// Recursively list every *.jsonl under dir — how the sibling
// <sessionId>/subagents/agent-*.jsonl tree gets visited without a second
// code path.
function walkJsonl(dir) {
  const out = [];
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try { entries = readdirSync(cur, { withFileTypes: true }); } catch { continue; }
    for (const entry of entries) {
      const full = join(cur, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
    }
  }
  return out;
}

// The active session's own file plus every transcript under its sibling
// <sessionId>/ directory (subagent legs, and any nested sub-subagent legs).
function collectSessionFiles(projectDir, sessionPath) {
  const files = [sessionPath];
  const sideDir = join(projectDir, basename(sessionPath, '.jsonl'));
  if (existsSync(sideDir) && statSync(sideDir).isDirectory()) {
    files.push(...walkJsonl(sideDir));
  }
  return files;
}

function emptyBucketSlot() {
  return { messages: 0, input_tokens: 0, output_tokens: 0,
    cache_creation_input_tokens: 0, cache_read_input_tokens: 0, cost_usd: 0 };
}

function summarizeSession(files) {
  const byModel = {};
  const byTier = { haiku: 0, sonnet: 0, opus: 0, unknown: 0 };
  const byBucket = { main: emptyBucketSlot(), subagent: emptyBucketSlot() };
  let messageCount = 0, totalCost = 0, firstTs = null, lastTs = null;
  let sessionId = null, cwd = null;
  let totalSeen = 0;
  const seen = new Set();
  // Model ids that priced at zero because no PRICING tier claimed them.
  const rateMissingModels = new Set();

  for (const file of files) {
    let text;
    try { text = readFileSync(file, 'utf-8'); } catch { continue; }
    for (const line of text.split('\n')) {
      if (!line.trim()) continue;
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (!sessionId && m.sessionId) sessionId = m.sessionId;
      if (!cwd && m.cwd) cwd = m.cwd;
      if (m.timestamp) {
        if (!firstTs || m.timestamp < firstTs) firstTs = m.timestamp;
        if (!lastTs || m.timestamp > lastTs) lastTs = m.timestamp;
      }
      if (m.type !== 'assistant' || !m.message?.usage) continue;

      totalSeen++;
      const key = dedupKey(m);
      if (seen.has(key)) continue; // replay — see the header comment
      seen.add(key);

      const bucket = classifyBucket(m);
      const model = m.message.model || 'unknown';
      const tier = modelTier(model);
      const u = usageTokens(m.message.usage);
      const cost = costForUsage(tier, u);
      // Key on the ACTUAL zero condition — `!PRICING[tier]`, what
      // costForUsage returns 0 on — not on `tier === 'unknown'`. The two
      // coincide only because `unknown` is today the sole tier modelTier()
      // returns that PRICING lacks; adding a vendor family without a rate row
      // would otherwise restore the exact silent zero this flag removes.
      // The usage guard keeps the flag worth reading: a message with no
      // billable tokens costs nothing at any rate, so flagging it would claim
      // an understatement that is not there.
      if (!PRICING[tier] && billableTokens(u) > 0) rateMissingModels.add(model);

      const slot = byModel[model] || { tier, input_tokens: 0, output_tokens: 0,
        cache_creation_input_tokens: 0, cache_read_input_tokens: 0, messages: 0, cost_usd: 0 };
      slot.input_tokens += u.input_tokens;
      slot.output_tokens += u.output_tokens;
      slot.cache_creation_input_tokens += u.cache_creation_input_tokens;
      slot.cache_read_input_tokens += u.cache_read_input_tokens;
      slot.messages++; slot.cost_usd += cost;
      byModel[model] = slot;

      const bs = byBucket[bucket];
      bs.input_tokens += u.input_tokens;
      bs.output_tokens += u.output_tokens;
      bs.cache_creation_input_tokens += u.cache_creation_input_tokens;
      bs.cache_read_input_tokens += u.cache_read_input_tokens;
      bs.messages++; bs.cost_usd += cost;

      messageCount++; byTier[tier] += cost; totalCost += cost;
    }
  }

  const dedupedCount = messageCount;
  const dedup_ratio = totalSeen > 0 ? (totalSeen - dedupedCount) / totalSeen : 0;
  return { sessionId, cwd, startedAt: firstTs, endedAt: lastTs, messageCount,
    byModel, byTier, byBucket, total_cost_usd: totalCost,
    // `rate_missing` marks a row whose total_cost_usd is understated because
    // at least one model priced at zero for want of a rate — never because the
    // work was free. `rate_missing_models` carries the ids so a backfill has a
    // shape to work against instead of re-deriving it from the transcript.
    rate_missing: rateMissingModels.size > 0,
    rate_missing_models: [...rateMissingModels].sort(),
    totalRecordsSeen: totalSeen, dedupedRecordsCount: dedupedCount, dedup_ratio,
    capturedAt: new Date().toISOString() };
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
  const files = collectSessionFiles(projectDir, sessionPath);
  const summary = summarizeSession(files);
  // ONE warning per run, before the quiet return: a suppressed report is a
  // display choice, an understated cost figure is a data-integrity problem.
  if (summary.rate_missing) {
    console.error(
      `cost-track: rate_missing — no price tier for ${summary.rate_missing_models.join(', ')}; ` +
        `those messages priced at $0 and the session total is understated. ` +
        `Token counts are kept, so the row can be re-priced later.`,
    );
  }
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
  console.log(`| Assistant messages (deduped) | ${summary.messageCount} |`);
  console.log(`| Replay dedup ratio | ${(summary.dedup_ratio * 100).toFixed(1)}% (${summary.dedupedRecordsCount}/${summary.totalRecordsSeen} records kept) |`);
  console.log(`| Transcript files scanned | ${files.length} |`);
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
  console.log('\n## Agent-bucket breakdown\n');
  console.log('_main = the orchestrator session; subagent = Task-tool legs, previously uncounted or merged in._\n');
  console.log('| Bucket | Messages | Input | Output | Cache write | Cache read | Cost |');
  console.log('|---|---:|---:|---:|---:|---:|---:|');
  for (const bucket of ['main', 'subagent']) {
    const b = summary.byBucket[bucket];
    console.log(`| ${bucket} | ${b.messages} | ${b.input_tokens} | ${b.output_tokens} | ${b.cache_creation_input_tokens} | ${b.cache_read_input_tokens} | $${b.cost_usd.toFixed(6)} |`);
  }
}

main();
