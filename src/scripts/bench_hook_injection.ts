#!/usr/bin/env node
/**
 * Hook-injection byte bench + CI gate (road-to-token-economy-cache Phase 3.2)
 * — the latency harness's twin for the INJECTION side.
 *
 * Runs every concern bound on the `claude` platform against the committed
 * fixture envelope of each slot it is bound to (tests/fixtures/hooks/
 * <event>.json), in-process via CONCERN_REGISTRY with the hook-stdin
 * override, under AGENT_CONFIG_REPLAY=1 (state writes skipped). Measures the
 * bytes of the stdout payload fields a concern injects — `reason` +
 * `additional_context` + `context` — and gates them against
 * `src/config/hook-token-budget.json`:
 *
 *   - a concern whose emission exceeds its row (or the default cap) → RED
 *   - an EMITTING concern with no explicit row above the default is fine;
 *     the default cap IS its row — but a breach names the missing row so
 *     the fix is a registered decision, not a silent default bump
 *   - per-slot SUM over all bound concerns > the slot cap → RED
 *   - per-TURN aggregate (the sum over every non-exempt slot, one fire each)
 *     > `per_turn_aggregate_cap_bytes.cap_bytes` → RED. Added by
 *     road-to-standing-context-40k 4.1, because every row above caps one FIRE
 *     and `pre_tool_use` / `post_tool_use` fire once per tool call — so a turn's
 *     real total was the one axis with no ceiling. The runtime half lives in
 *     `hooks/turn_injection_budget.ts`; this is the authoring-time reading.
 *
 * HONEST SCOPE, stated up front: concerns are conditional-silence by design —
 * a generic fixture triggers few of them, so most measure 0 bytes here. The
 * gate therefore enforces the cap on whatever DOES fire under the committed
 * fixtures (deterministic, CI-reproducible), while the census mode
 * (`--record`) measures REAL sessions: it appends counts-only lines
 * ({ts, slot, concern, bytes}) to agents/runtime/state/injection-census.jsonl
 * — the repeat-injection-census blocker's instrument. Claiming the fixture
 * numbers are the live distribution would be the coverage inflation this
 * repo's gate discipline refuses; the two modes exist because neither
 * substitutes for the other.
 *
 * Class A: in-process, no daemon, no network. Exit 0 green · 1 breach ·
 * 2 unusable invocation. Dead-scope guarded: zero concerns run = RED.
 *
 * Usage:
 *   ./scripts-run src/scripts/bench_hook_injection [--format text|json]
 *     [--record] [--platform claude]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { CONCERN_REGISTRY } from './hooks/concern_registry.js';
import { setHookStdinOverride, clearHookStdinOverride } from './hooks/hook_stdin.js';
import { _load_yaml, _resolve_concerns, EVENT_VOCABULARY, type JsonObject } from './hooks/dispatch_hook.js';

declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
const _IN_BUNDLE = typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__;
const REPO_ROOT = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    ...(_IN_BUNDLE ? ['..'] : ['..', '..']),
);
const MANIFEST = path.join(REPO_ROOT, 'src', 'scripts', 'hook_manifest.yaml');
const BUDGET = path.join(REPO_ROOT, 'src', 'config', 'hook-token-budget.json');
const FIXTURES = path.join(REPO_ROOT, 'tests', 'fixtures', 'hooks');
const CENSUS_FILE = path.join('agents', 'runtime', 'state', 'injection-census.jsonl');

export interface Measurement {
    slot: string;
    concern: string;
    bytes: number;
    cap: number;
    breach: boolean;
}

interface Budget {
    default_cap_bytes: number;
    per_concern_caps_bytes: Record<string, number | string>;
    per_slot_sum_caps_bytes: Record<string, number | string>;
    /** road-to-standing-context-40k 4.1 — optional so an older budget file still benches. */
    per_turn_aggregate_cap_bytes?: {
        cap_bytes?: number;
        exempt_slots?: string[];
    };
}

/** The per-turn aggregate: the sum across every non-exempt slot, one fire each. */
export interface TurnAggregate {
    bytes: number;
    cap: number;
    breach: boolean;
    /** Slots that fed the sum, so the reading is auditable rather than a bare number. */
    slots: string[];
}

function capFor(budget: Budget, concern: string): number {
    const v = budget.per_concern_caps_bytes[concern];
    return typeof v === 'number' ? v : budget.default_cap_bytes;
}

/** Run one registered concern in-process with the fixture envelope; return payload bytes. */
export function runConcernOnce(
    script: string,
    args: readonly string[],
    envelope: JsonObject,
): number {
    const main = CONCERN_REGISTRY[script];
    if (main === undefined) return -1; // not in registry — parity tests own that failure
    let out = '';
    const prevWrite = process.stdout.write;
    const prevErr = process.stderr.write;
    const prevArgv = process.argv;
    const prevReplay = process.env['AGENT_CONFIG_REPLAY'];
    setHookStdinOverride(JSON.stringify(envelope));
    process.env['AGENT_CONFIG_REPLAY'] = '1';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stdout.write = ((chunk: any, enc?: any, cb?: any): boolean => {
        out += typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
        const callback = typeof enc === 'function' ? enc : cb;
        if (typeof callback === 'function') callback();
        return true;
    }) as typeof process.stdout.write;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    process.stderr.write = ((chunk: any, enc?: any, cb?: any): boolean => {
        const callback = typeof enc === 'function' ? enc : cb;
        if (typeof callback === 'function') callback();
        return true;
    }) as typeof process.stderr.write;
    try {
        process.argv = [prevArgv[0] as string, script, ...args, '--platform', 'claude'];
        main([...args, '--platform', 'claude']);
    } catch {
        /* a crashing concern injects nothing — latency/parity suites own crashes */
    } finally {
        process.stdout.write = prevWrite;
        process.stderr.write = prevErr;
        process.argv = prevArgv;
        if (prevReplay === undefined) delete process.env['AGENT_CONFIG_REPLAY'];
        else process.env['AGENT_CONFIG_REPLAY'] = prevReplay;
        clearHookStdinOverride();
    }
    const text = out.trim();
    if (!text) return 0;
    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        let bytes = 0;
        for (const key of ['reason', 'additional_context', 'context']) {
            const v = parsed[key];
            if (typeof v === 'string') bytes += Buffer.byteLength(v, 'utf-8');
        }
        return bytes;
    } catch {
        return Buffer.byteLength(text, 'utf-8'); // non-JSON stdout counts whole
    }
}

export function bench(opts: { platform?: string; budgetPath?: string } = {}): { measurements: Measurement[]; slotSums: Record<string, { bytes: number; cap: number; breach: boolean }>; turnAggregate: TurnAggregate | null; errors: string[] } {
    const platform = opts.platform ?? 'claude';
    const manifest = _load_yaml(MANIFEST);
    const budget = JSON.parse(fs.readFileSync(opts.budgetPath ?? BUDGET, 'utf8')) as Budget;
    const measurements: Measurement[] = [];
    const slotSums: Record<string, { bytes: number; cap: number; breach: boolean }> = {};
    const errors: string[] = [];

    for (const event of EVENT_VOCABULARY) {
        const fixtureFile = path.join(FIXTURES, `${event}.json`);
        if (!fs.existsSync(fixtureFile)) continue;
        const envelope = JSON.parse(fs.readFileSync(fixtureFile, 'utf8')) as JsonObject;
        const concerns = _resolve_concerns(manifest, platform, event);
        let sum = 0;
        for (const concern of concerns) {
            const bytes = runConcernOnce(String(concern['script']), Array.isArray(concern['args']) ? concern['args'].map(String) : [], envelope);
            if (bytes < 0) {
                errors.push(`${event}/${String(concern['name'])}: not in CONCERN_REGISTRY`);
                continue;
            }
            const cap = capFor(budget, String(concern['name']));
            const breach = bytes > cap;
            measurements.push({ slot: event, concern: String(concern['name']), bytes, cap, breach });
            sum += bytes;
        }
        const slotCapRaw = budget.per_slot_sum_caps_bytes[event];
        const slotCap = typeof slotCapRaw === 'number' ? slotCapRaw : Number.MAX_SAFE_INTEGER;
        slotSums[event] = { bytes: sum, cap: slotCap, breach: sum > slotCap };
    }

    // Per-turn aggregate (road-to-standing-context-40k 4.1). The per-slot rows
    // above cap ONE fire each; a turn spans several slots, so this sums the
    // non-exempt ones.
    //
    // NOT THE ENFORCED NUMBER, and the distinction was a review finding worth
    // stating rather than glossing. This bench sums every bound concern's
    // `reason` + `additional_context` + `context` per slot, regardless of exit
    // code. The runtime enforcer sums only the messages whose `rc` equals the
    // reduced verdict, never reads `context` outside the exempt `session_start`,
    // and counts neither the reason join nor the `hookSpecificOutput` JSON
    // envelope the host actually receives. So the two measure different
    // populations and neither is a check on the other — calling this "the
    // reading the enforcer accumulates against" (as an earlier draft of this
    // comment did) asserted a comparability that does not hold in either
    // direction.
    //
    // HONEST SCOPE, inherited from this bench's header: the fixtures fire one of
    // each slot, so this is a per-turn FLOOR over committed fixtures, not the
    // live distribution. A real turn with n tool calls fires pre/post_tool_use n
    // times and the true aggregate is higher — that axis is what the dispatcher
    // enforces at runtime and the injection census measures.
    const turnRow = budget.per_turn_aggregate_cap_bytes;
    let turnAggregate: TurnAggregate | null = null;
    if (turnRow !== undefined && typeof turnRow.cap_bytes === 'number') {
        const exempt = new Set(turnRow.exempt_slots ?? []);
        const slots = Object.keys(slotSums).filter((s) => !exempt.has(s));
        const bytes = slots.reduce((n, s) => n + (slotSums[s]?.bytes ?? 0), 0);
        turnAggregate = { bytes, cap: turnRow.cap_bytes, breach: bytes > turnRow.cap_bytes, slots };
    }
    return { measurements, slotSums, turnAggregate, errors };
}

export function main(argv: readonly string[]): number {
    let format: 'text' | 'json' = 'text';
    let record = false;
    let platform = 'claude';
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--format') format = argv[++i] === 'json' ? 'json' : 'text';
        else if (a === '--record') record = true;
        else if (a === '--platform') platform = argv[++i] ?? platform;
    }
    let result: ReturnType<typeof bench>;
    try {
        result = bench({ platform });
    } catch (err) {
        process.stderr.write(`bench_hook_injection: ${err instanceof Error ? err.message : String(err)}\n`);
        return 2;
    }
    // Dead-scope guard: a bench that ran zero concerns proves nothing (a
    // gate that scans nothing exits green is the recorded failure class).
    if (result.measurements.length === 0) {
        process.stderr.write('bench_hook_injection: DEAD SCOPE — zero concerns ran; fixtures or manifest unreadable\n');
        return 1;
    }
    if (record) {
        try {
            const file = path.join(process.cwd(), CENSUS_FILE);
            fs.mkdirSync(path.dirname(file), { recursive: true });
            const ts = new Date().toISOString();
            for (const m of result.measurements) {
                if (m.bytes > 0) {
                    fs.appendFileSync(file, JSON.stringify({ ts, slot: m.slot, concern: m.concern, bytes: m.bytes }) + '\n');
                }
            }
        } catch {
            /* census is observability — never fails the bench */
        }
    }
    const breaches = result.measurements.filter((m) => m.breach);
    const slotBreaches = Object.entries(result.slotSums).filter(([, s]) => s.breach);
    if (format === 'json') {
        process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    } else {
        const emitting = result.measurements.filter((m) => m.bytes > 0);
        process.stdout.write(`bench_hook_injection: ${result.measurements.length} concern-slot pairs · ${emitting.length} emitted under the committed fixtures\n`);
        for (const m of emitting) {
            process.stdout.write(`  ${m.slot.padEnd(20)} ${m.concern.padEnd(24)} ${String(m.bytes).padStart(6)} B (cap ${m.cap})${m.breach ? '  ❌ BREACH' : ''}\n`);
        }
        for (const [slot, s] of Object.entries(result.slotSums)) {
            if (s.bytes > 0) process.stdout.write(`  slot-sum ${slot.padEnd(20)} ${String(s.bytes).padStart(6)} B (cap ${s.cap === Number.MAX_SAFE_INTEGER ? '—' : s.cap})${s.breach ? '  ❌ BREACH' : ''}\n`);
        }
        if (result.turnAggregate !== null) {
            const t = result.turnAggregate;
            process.stdout.write(
                `  turn-aggregate ${String(t.bytes).padStart(6)} B (cap ${t.cap}) over ${t.slots.length} non-exempt slot(s), one fire each` +
                `${t.breach ? '  ❌ BREACH' : ''}\n`,
            );
        } else {
            process.stdout.write('  turn-aggregate — no per_turn_aggregate_cap_bytes row in the budget; not measured\n');
        }
        for (const e of result.errors) process.stdout.write(`  warn: ${e}\n`);
    }
    const turnBreach = result.turnAggregate?.breach === true;
    if (breaches.length > 0 || slotBreaches.length > 0 || turnBreach) {
        process.stderr.write(`bench_hook_injection: ${breaches.length} concern breach(es), ${slotBreaches.length} slot-sum breach(es)${turnBreach ? ', per-turn aggregate breached' : ''} — the budget row is the decision surface (src/config/hook-token-budget.json)\n`);
        return 1;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (_IN_BUNDLE) return false;
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}
if (_isCliEntry()) process.exit(main(process.argv.slice(2)));
