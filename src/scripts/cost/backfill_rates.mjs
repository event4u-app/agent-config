#!/usr/bin/env node
// cost-backfill — re-price ledger rows that `track.mjs` flagged `rate_missing`,
// using a rate table supplied for the model ids that had none at capture time.
//
// Why this exists: `track.mjs` prices an unrecognised model at $0 rather than
// throwing, because losing a whole session of real token counts over one
// unknown id is worse than an understated total. It keeps the token counts and
// sets `rate_missing` precisely so the cost can be repaired later. This is that
// repair pass.
//
// BUILT AGAINST AN OBSERVED ROW, NOT A GUESSED ONE. The shape below was read
// off a real flagged row produced from this repo's own transcripts on
// 2026-08-16 (`claude-fable-5`, 468 messages, 236,695,963 cache-read tokens,
// cost 0). Two limits are properties of that observed shape, and both are
// stated rather than papered over — a re-priced row that looks exact while
// resting on an invented split would be worse than the zero it replaces:
//
//   1. THE CACHE-WRITE TTL SPLIT IS NOT RETAINED ON THE ROW. `track.mjs`
//      prices `ephemeral_5m` and `ephemeral_1h` cache writes at different
//      rates (1.25x / 2x of input), but `byModel[m]` aggregates both into one
//      `cache_creation_input_tokens` tally. A backfill therefore prices every
//      cache write at the 5m rate — Anthropic's default TTL, and the same
//      fallback `costForUsage` already applies to any unaccounted remainder.
//      A session that really used 1h writes is under-priced by the difference.
//      Recorded per row as `cache_ttl_assumed: "5m"`.
//
//   2. `byBucket[*].cost_usd` IS NOT REPAIRED. The row records per-bucket
//      totals and per-model totals, but not per-bucket-per-model tokens, so
//      the recovered cost cannot be attributed across main vs subagent. The
//      alternative is not a better number but an invented one — the same
//      honest-limit stance `cost-summary-schema` takes for `by_date`. The
//      bucket figures stay as captured and the report says so.
//
// Rates file (JSON), either form per model id:
//   { "claude-fable-5": "opus" }                       // reuse a known tier's rates
//   { "claude-fable-5": { "input": 5, "output": 25,    // explicit USD per 1M
//                         "cache_write_5m": 6.25, "cache_write_1h": 10,
//                         "cache_read": 0.5 } }
//
// Usage: node src/scripts/cost/backfill_rates.mjs --rates <file.json> [--apply]
// Env:
//   BACKFILL_STORE=<path>   ledger to re-price (default: agents/cost-tracking/sessions.jsonl)
//   BACKFILL_RATES=<path>   rates file (same as --rates)
//   BACKFILL_APPLY=1        write the result (same as --apply); default is a dry run
//   BACKFILL_QUIET=1        suppress the report; exit code and writes are unchanged

import { readFileSync, writeFileSync, renameSync, existsSync } from 'node:fs';

const DEFAULT_STORE = 'agents/cost-tracking/sessions.jsonl';

// Mirrored from track.mjs PRICING. It is a copy rather than an import for the
// reason that file's own header gives: track.mjs exports nothing and calls
// main() at module scope, so importing it would scan the developer's real
// ~/.claude as a side effect. Keep the two in step.
const PRICING = {
  haiku: { input: 0.25, output: 1.25, cache_write_5m: 0.30, cache_write_1h: 0.50, cache_read: 0.03 },
  sonnet: { input: 3.00, output: 15.00, cache_write_5m: 3.75, cache_write_1h: 6.00, cache_read: 0.30 },
  opus: { input: 15.00, output: 75.00, cache_write_5m: 18.75, cache_write_1h: 30.00, cache_read: 1.50 },
};

const RATE_KEYS = ['input', 'output', 'cache_write_5m', 'cache_write_1h', 'cache_read'];

/**
 * Resolve one rates-file entry to `{ tier, rates }`.
 * A string is a tier alias; an object is an explicit table. Anything else, or
 * a table missing a key, is rejected by name — a silently-defaulted rate would
 * reintroduce the understatement this pass exists to remove.
 */
function resolveRate(model, spec) {
  if (typeof spec === 'string') {
    const rates = PRICING[spec];
    if (!rates) throw new Error(`rates["${model}"]: unknown tier alias "${spec}" (known: ${Object.keys(PRICING).join(', ')})`);
    return { tier: spec, rates };
  }
  if (spec && typeof spec === 'object') {
    const missing = RATE_KEYS.filter((k) => typeof spec[k] !== 'number');
    if (missing.length) throw new Error(`rates["${model}"]: missing numeric ${missing.join(', ')}`);
    return { tier: 'backfilled', rates: spec };
  }
  throw new Error(`rates["${model}"]: expected a tier alias or a rate table, got ${typeof spec}`);
}

/**
 * Cost for one `byModel` entry at the supplied rates.
 * Cache writes price at the 5m rate — see honest limit 1 in the header.
 */
function costForModelEntry(entry, rates) {
  return (entry.input_tokens || 0) / 1e6 * rates.input
    + (entry.output_tokens || 0) / 1e6 * rates.output
    + (entry.cache_creation_input_tokens || 0) / 1e6 * rates.cache_write_5m
    + (entry.cache_read_input_tokens || 0) / 1e6 * rates.cache_read;
}

/** Mirrors track.mjs's flag condition: a row with no billable tokens costs 0 at any rate. */
function billableTokens(entry) {
  if (!entry) return 0;
  return (entry.input_tokens || 0) + (entry.output_tokens || 0)
    + (entry.cache_creation_input_tokens || 0) + (entry.cache_read_input_tokens || 0);
}

/**
 * Re-price one row in place. Returns the per-model repairs made, or [] when
 * the row is not flagged, carries no supplied rate, or was already backfilled
 * for that model — which is what makes a second run a no-op rather than a
 * double count.
 */
export function backfillRow(row, rateTable) {
  if (!row || row.rate_missing !== true) return [];
  const already = new Set((row.rate_backfill || []).map((b) => b.model));
  const repairs = [];

  for (const model of row.rate_missing_models || []) {
    if (already.has(model)) continue;
    const spec = rateTable[model];
    if (!spec) continue;
    const entry = (row.byModel || {})[model];
    if (!entry || billableTokens(entry) <= 0) continue;

    const { tier, rates } = spec;
    const cost = costForModelEntry(entry, rates);
    const previous = entry.cost_usd || 0;
    const delta = cost - previous;

    entry.cost_usd = cost;
    entry.tier = tier;
    row.byTier = row.byTier || {};
    row.byTier[tier] = (row.byTier[tier] || 0) + delta;
    row.total_cost_usd = (row.total_cost_usd || 0) + delta;

    repairs.push({ model, tier, cost_usd: cost, delta_usd: delta });
  }

  if (!repairs.length) return [];

  row.rate_backfill = [
    ...(row.rate_backfill || []),
    ...repairs.map((r) => ({
      model: r.model,
      tier: r.tier,
      cost_usd: r.cost_usd,
      cache_ttl_assumed: '5m',
      bucket_split_repaired: false,
      at: new Date().toISOString(),
    })),
  ];

  // Whatever is still unpriced keeps the flag. A row re-priced for one model
  // and not another is still understated, and saying otherwise is the exact
  // silent zero 2.4 removed.
  const remaining = (row.rate_missing_models || []).filter(
    (m) => !row.rate_backfill.some((b) => b.model === m),
  );
  row.rate_missing_models = remaining;
  row.rate_missing = remaining.length > 0;

  return repairs;
}

function parseArgs(argv) {
  const out = { rates: process.env.BACKFILL_RATES || null, store: process.env.BACKFILL_STORE || DEFAULT_STORE, apply: process.env.BACKFILL_APPLY === '1' };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--apply') out.apply = true;
    else if (a === '--rates') out.rates = argv[++i];
    else if (a === '--store') out.store = argv[++i];
    else if (a.startsWith('--rates=')) out.rates = a.slice('--rates='.length);
    else if (a.startsWith('--store=')) out.store = a.slice('--store='.length);
    else throw new Error(`unknown argument: ${a}`);
  }
  return out;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (e) {
    console.error(`cost-backfill: ${e.message}`);
    process.exit(2);
  }
  if (!args.rates) {
    console.error('cost-backfill: --rates <file.json> is required (or BACKFILL_RATES)');
    process.exit(2);
  }
  if (!existsSync(args.rates)) {
    console.error(`cost-backfill: rates file not found: ${args.rates}`);
    process.exit(2);
  }
  if (!existsSync(args.store)) {
    console.error(`cost-backfill: ledger not found: ${args.store}`);
    process.exit(2);
  }

  let rateTable;
  try {
    const raw = JSON.parse(readFileSync(args.rates, 'utf-8'));
    rateTable = Object.fromEntries(Object.entries(raw).map(([m, spec]) => [m, resolveRate(m, spec)]));
  } catch (e) {
    console.error(`cost-backfill: ${e.message}`);
    process.exit(2);
  }

  const lines = readFileSync(args.store, 'utf-8').split('\n').filter((l) => l.trim().length > 0);
  const rows = [];
  const repaired = [];
  let flaggedRows = 0;

  for (const line of lines) {
    let row;
    try {
      row = JSON.parse(line);
    } catch {
      // A malformed line is preserved verbatim rather than dropped: this pass
      // repairs prices, it does not curate the ledger.
      rows.push(line);
      continue;
    }
    if (row.rate_missing === true) flaggedRows++;
    const repairs = backfillRow(row, rateTable);
    if (repairs.length) repaired.push({ sessionId: row.sessionId, repairs, stillMissing: row.rate_missing_models });
    rows.push(JSON.stringify(row));
  }

  if (args.apply && repaired.length) {
    const tmp = `${args.store}.backfill.tmp`;
    writeFileSync(tmp, rows.join('\n') + '\n');
    renameSync(tmp, args.store);
  }

  if (process.env.BACKFILL_QUIET === '1') return;

  const total = repaired.reduce((s, r) => s + r.repairs.reduce((t, x) => t + x.delta_usd, 0), 0);
  console.log(`# cost-backfill — ${args.apply ? 'APPLIED' : 'DRY RUN (pass --apply to write)'}`);
  console.log('');
  console.log(`Ledger: \`${args.store}\` · rows ${lines.length} · flagged ${flaggedRows} · re-priced ${repaired.length}`);
  console.log('');
  if (!repaired.length) {
    console.log('No row was re-priced — either nothing is flagged, or no rate was supplied for the flagged ids.');
  } else {
    console.log('| Session | Model | Tier | Recovered | Still missing |');
    console.log('|---|---|---|---:|---|');
    for (const r of repaired) {
      for (const x of r.repairs) {
        console.log(`| \`${(r.sessionId || '').slice(0, 8)}\` | \`${x.model}\` | ${x.tier} | $${x.delta_usd.toFixed(6)} | ${r.stillMissing.length ? r.stillMissing.join(', ') : '—'} |`);
      }
    }
    console.log('');
    console.log(`**Recovered total: $${total.toFixed(6)}** — previously reported as $0.`);
  }
  console.log('');
  console.log('Two limits of the recovered figure, both properties of the stored row:');
  console.log('- Cache writes price at the **5m** rate; the row does not retain the 5m/1h TTL split, so a session that used 1h writes stays under-priced by the difference.');
  console.log('- `byBucket[*].cost_usd` is **not** repaired — the row carries no per-bucket-per-model tokens, so the recovered cost cannot be attributed to main vs subagent.');
}

// Importable for tests; runs only when invoked directly, unlike track.mjs.
if (process.argv[1] && process.argv[1].endsWith('backfill_rates.mjs')) main();
