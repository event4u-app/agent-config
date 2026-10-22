#!/usr/bin/env tsx
/**
 * The free-hands 6.2 shadow window of `internal/bench/free-hands-shadow-PREREG.md`:
 * typed `classify` / `extract` asks over a frozen public-artifact corpus, served
 * by the paid seat and shadowed by a keyless free route, both verified by
 * `fhs-verify/1`, ledgered through the production `askHand` → `askOnce` path.
 *
 * Operator command.
 *
 * From the repository root (the first-party roster gate reads the working
 * directory), with a run-local council file — never the user-global one:
 *
 *   cp internal/bench/free-hands-shadow/council.example.yml /tmp/fhs-council.yml
 *   AI_COUNCIL_CONFIG=/tmp/fhs-council.yml ./scripts-run internal/bench/free-hands-shadow/run.ts
 *   AI_COUNCIL_CONFIG=/tmp/fhs-council.yml ./scripts-run internal/bench/free-hands-shadow/run.ts --ac3-demo
 *   ./scripts-run internal/bench/free-hands-shadow/run.ts audit [--audit-model haiku]
 *   ./scripts-run internal/bench/free-hands-shadow/run.ts report [--out internal/bench/reports/free-hands-shadow.md]
 *
 * The example file (`council.example.yml`, next to this one) is:
 *
 *   enabled: true
 *   cost_budget:
 *     max_total_usd: 0
 *   members:
 *     anthropic:
 *       enabled: true
 *       model: haiku          # the cheapest seat; subscription CLI only
 *       mode: cli             # IGNORED by the loader (an ignored transport key)
 *     hands:
 *       enabled: true
 *       model: discovered-at-run-start
 *       base_url: "https://text.pollinations.ai/openai"
 *       billing_proof:
 *         kind: keyless
 *         url: "https://pollinations.ai/privacy"
 *         checked: "2026-10-22"
 *
 * Why `mode: cli` is not what keeps the paid arm off the API.
 *
 * `ai_council/config.ts` records a member's `mode` as an ignored transport key
 * and resolves every provider member under `auto` (cli → api → ∅), so on a
 * machine without a logged-in `claude` but with an Anthropic key the seat would
 * be built as the metered API client. This harness therefore (1) builds members
 * with `invocation_mode: 'cli'`, the highest-precedence mode layer, and (2)
 * refuses to start unless every paid member is a first-party vendor CLI
 * (`transport: cli`, `billable: false`) and no API-key or cloud-billing variable
 * for that vendor is set — the vendor CLI bills the API when one is
 * (`subscriptionRefusals`). The `hands` model is replaced by the first id of
 * the first-party roster discovered at start (`discoverRouteModels`).
 *
 * The run is paced (free calls ≥ 31 s apart), capped (333 per kind, 2,000 in
 * all), resumable from its run ledger, and backs off on HTTP 429, stops on HTTP
 * 402 and after `FREE_FAILURE_STREAK_MAX` failed free answers in a row. Pacing,
 * back-off and streaks are derived from the run ledger, so a restart honours
 * them. Every row it writes is `manufactured`.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { askHand, type AskResult } from '../../../src/scripts/ask_transport.js';
import type { ExternalAIClient } from '../../../src/scripts/ai_council/clients.js';
import { CouncilEgress } from '../../../src/scripts/ai_council/council_egress.js';
import { EXPOSURE_LEDGER_RELPATH, ExposureLedger, trackedFileCount } from '../../../src/scripts/ai_council/exposure_ledger.js';
import { readShadowLedger, shadowReport, SHADOW_CALL_CAP, type ShadowRow } from '../../../src/scripts/ai_council/free_hand_shadow.js';
import { discoverRouteModels, ROUTE_CATALOG } from '../../../src/scripts/ai_council/free_route_catalog.js';
import { projectLinkingIdentifiers } from '../../../src/scripts/ai_council/hand_payload.js';
import { flipVerdict, isKindFlipped, QUALITY_MARGIN, ESCALATION_KILL, MIN_SHADOW_PER_KIND } from '../../../src/scripts/ai_council/kind_flip.js';
import { routeCandidateFromMember } from '../../../src/scripts/ai_council/route_chooser.js';
import { isUnpaid, type VerifyVerdict } from '../../../src/scripts/_lib/hand_kinds.js';
import { DEFAULT_DIR } from '../../../src/scripts/orchestration_record.js';
import { AUDIT_SEED, buildCorpus, corpusEgress, MEASURED_KINDS, PER_KIND, seededShuffle, type Corpus, type CorpusItem, type MeasuredKind } from './corpus.js';
import { headVerifyFor, verifyAnswer, VERIFIER_VERSION, type SideCapture } from './verify.js';

type Dict = Record<string, unknown>;

export const MIN_FREE_INTERVAL_MS = 31_000;
export const BACKOFF_START_MS = 120_000;
export const BACKOFF_MAX_STREAK = 4;
/** Failed free answers of any class in a row that stop the run: each one also spent a paid call. */
export const FREE_FAILURE_STREAK_MAX = 10;
export const RUN_DIR_RELPATH = path.join('agents', 'runtime', 'bench', 'free-hands-shadow');
export const LABEL = 'manufactured';

/** Variables under which a vendor CLI bills the vendor's API or a cloud account instead of the subscription. */
export const VENDOR_BILLING_ENV: Readonly<Record<string, readonly string[]>> = {
    anthropic: [
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_BASE_URL',
        'CLAUDE_CODE_USE_BEDROCK',
        'CLAUDE_CODE_USE_VERTEX',
        'CLAUDE_CODE_USE_FOUNDRY',
        'ANTHROPIC_FOUNDRY_API_KEY',
    ],
    openai: ['OPENAI_API_KEY', 'CODEX_API_KEY', 'OPENAI_BASE_URL'],
    gemini: ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GOOGLE_GENAI_USE_VERTEXAI'],
};

/** The billing variables of `vendor` that are set in `env`. */
function billingVarsSet(vendor: string, env: NodeJS.ProcessEnv): string[] {
    return (VENDOR_BILLING_ENV[vendor] ?? []).filter((v) => (env[v] ?? '') !== '');
}

/** Why the blind audit head may not run; empty when its CLI can only bill the subscription. */
export function headRefusals(env: NodeJS.ProcessEnv): string[] {
    return billingVarsSet('anthropic', env).map((v) => `anthropic: ${v} is set, so the audit head may bill the API instead of the subscription`);
}

/** A cap or count option: a positive integer, else the reason it is refused. */
export function positiveInt(name: string, v: number | undefined): string | null {
    return v === undefined || (Number.isInteger(v) && v > 0) ? null : `${name} must be a positive integer, got ${String(v)}`;
}

/** Why the members may not run this window; empty when every paid seat is a subscription CLI and the free side is unpaid. */
export function subscriptionRefusals(members: readonly ExternalAIClient[], env: NodeJS.ProcessEnv): string[] {
    const out: string[] = [];
    let paid = 0;
    let free = 0;
    for (const m of members) {
        const route = routeCandidateFromMember(m);
        if (isUnpaid(route.billing)) {
            free++;
            continue;
        }
        paid++;
        const rec = m as unknown as Dict;
        if (rec['transport'] !== 'cli' || rec['billable'] !== false) {
            out.push(`${route.name}: transport ${String(rec['transport'])}, billable ${String(rec['billable'])} — not a subscription CLI`);
            continue;
        }
        if (VENDOR_BILLING_ENV[route.name] === undefined) {
            out.push(`${route.name}: no known subscription-only contract for this CLI`);
            continue;
        }
        for (const v of billingVarsSet(route.name, env)) out.push(`${route.name}: ${v} is set, so its CLI may bill the API instead of the subscription`);
    }
    if (paid === 0) out.push('no paid seat: the paid arm would be absent');
    if (free === 0) out.push('no unpaid route: there is nothing to shadow');
    return out;
}

export interface HarnessDeps {
    /** Repository root: corpus source and state root. */
    readonly root: string;
    readonly env: NodeJS.ProcessEnv;
    readonly now: () => Date;
    readonly sleep: (ms: number) => Promise<void>;
    readonly log: (line: string) => void;
    readonly loadSettings: () => Dict;
    readonly buildMembers: (settings: Dict, opts: { content_class: 'public-artifact'; invocation_mode: 'cli'; model_overrides: Record<string, string> }) => ExternalAIClient[];
    readonly fetchImpl?: typeof fetch;
    readonly corpus?: () => Corpus;
    readonly egress?: CouncilEgress;
    /** First-party list for a route the catalogue does not carry. */
    readonly firstPartyList?: string;
    readonly trackedFiles?: number | null;
    readonly auditDir?: string;
    /** The blind paid head of the audit; returns its raw answer or null. */
    readonly askHead?: (prompt: string) => Promise<string | null> | string | null;
}

export interface WindowOptions {
    readonly perKind?: number;
    readonly maxTotal?: number;
    readonly minIntervalMs?: number;
    readonly kinds?: readonly MeasuredKind[];
}

export interface RunRow {
    readonly type: 'call';
    readonly id: string;
    readonly kind: MeasuredKind;
    readonly started_at: string;
    readonly shadowed: boolean;
    readonly served_by: string | null;
    readonly route_billing: string | null;
    readonly paid_answer: unknown;
    readonly paid_verdict: VerifyVerdict | null;
    readonly free_answer: unknown;
    readonly free_verdict: VerifyVerdict | null;
    readonly free_outcome: string | null;
    readonly paid_outcome: string | null;
    /** Position and timestamp of this call's row in the production shadow ledger; null when none was written. */
    readonly shadow_index: number | null;
    readonly shadow_ts: string | null;
}

/** An `--ac3-demo` call: it reaches the free route, so the window's pacing counts it. */
export interface DemoRow {
    readonly type: 'demo';
    readonly id: string;
    readonly started_at: string;
}

interface RunHeader {
    readonly type: 'header';
    readonly label: typeof LABEL;
    readonly ref: string;
    readonly digest: string;
    readonly verifier: string;
    readonly started_at: string;
    readonly free_route: string;
    readonly free_model: string;
}

function runDir(root: string): string {
    return path.join(root, RUN_DIR_RELPATH);
}

function readJsonl<T>(file: string): T[] {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return [];
    }
    const out: T[] = [];
    for (const l of raw.split('\n')) {
        if (l.trim() === '') continue;
        try {
            out.push(JSON.parse(l) as T);
        } catch {
            /* a torn line is skipped */
        }
    }
    return out;
}

function appendJsonl(file: string, row: unknown): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${JSON.stringify(row)}\n`, 'utf8');
}

export function readRunLedger(root: string): { header: RunHeader | null; rows: RunRow[]; demos: DemoRow[] } {
    const all = readJsonl<RunHeader | RunRow | DemoRow>(path.join(runDir(root), 'run.jsonl'));
    return {
        header: (all.find((r) => r.type === 'header') as RunHeader | undefined) ?? null,
        rows: all.filter((r): r is RunRow => r.type === 'call'),
        demos: all.filter((r): r is DemoRow => r.type === 'demo'),
    };
}

/** The production shadow rows this run wrote, matched by position and timestamp; rows added by anything else are left out. */
export function windowShadowRows(root: string): { row: RunRow; shadow: ShadowRow }[] {
    const production = readShadowLedger(root);
    const out: { row: RunRow; shadow: ShadowRow }[] = [];
    for (const row of readRunLedger(root).rows) {
        if (!row.shadowed || row.shadow_index === null || row.shadow_index === undefined) continue;
        const shadow = production[row.shadow_index];
        if (shadow !== undefined && shadow.ts === row.shadow_ts && shadow.kind === row.kind) out.push({ row, shadow });
    }
    return out;
}

/** The streaks a resumed run inherits: rate-limited answers and failed answers of any class, trailing the ledger. */
export function trailingStreaks(rows: readonly RunRow[]): { rateLimited: number; failed: number; backoffMs: number } {
    let rateLimited = 0;
    let failed = 0;
    for (const r of rows) {
        if (r.free_outcome === null) continue;
        rateLimited = r.free_outcome === 'rate_limited' || r.free_outcome === 'quota_exhausted' ? rateLimited + 1 : 0;
        failed = r.free_outcome === 'ok' ? 0 : failed + 1;
    }
    return { rateLimited, failed, backoffMs: rateLimited === 0 ? 0 : BACKOFF_START_MS * 2 ** (rateLimited - 1) };
}

interface Prepared {
    readonly members: ExternalAIClient[];
    readonly free: { name: string; model: string };
    readonly corpus: Corpus;
}

/** Settings → free member → discovery → members → guard → flip check → corpus. A string is a refusal. */
async function prepare(deps: HarnessDeps, kinds: readonly MeasuredKind[]): Promise<Prepared | string> {
    const settings = deps.loadSettings();
    const ai = (settings['ai_council'] ?? {}) as Dict;
    const cfg = (ai['members'] ?? {}) as Dict;
    const routes = Object.entries(cfg).filter(([, m]) => {
        const r = (m ?? {}) as Dict;
        return r['enabled'] === true && typeof r['base_url'] === 'string';
    });
    if (routes.length !== 1) return `the council config needs exactly one enabled base_url member; found ${String(routes.length)}`;
    const [name, raw] = routes[0] as [string, Dict];
    const baseUrl = String(raw['base_url']).replace(/\/+$/, '');
    const row = ROUTE_CATALOG.find((r) => r.base_url.replace(/\/+$/, '') === baseUrl);
    const firstParty = row?.first_party_list ?? deps.firstPartyList;
    const roster = await discoverRouteModels(row?.id ?? name, baseUrl, {
        repoRoot: deps.root,
        ...(deps.fetchImpl !== undefined ? { fetchImpl: deps.fetchImpl } : {}),
        ...(firstParty !== undefined ? { firstPartyListUrl: firstParty } : {}),
    });
    if (roster.status !== 'known' || roster.models.length === 0) {
        return `no first-party model discovered on ${name}: ${roster.status === 'known' ? 'empty roster' : roster.reason}`;
    }
    const model = roster.models[0] as string;
    const members = deps.buildMembers(settings, { content_class: 'public-artifact', invocation_mode: 'cli', model_overrides: { [name]: model } });
    const refusals = subscriptionRefusals(members, deps.env);
    if (refusals.length > 0) return `refusing to start — ${refusals.join('; ')}`;
    if (!members.some((m) => routeCandidateFromMember(m).name === name)) return `the free route ${name} was not built (see the SKIP line above)`;
    for (const k of kinds) if (isKindFlipped(deps.root, k)) return `${k} is already flipped to the free route; a shadow window over it measures nothing`;
    const corpus = deps.corpus?.() ?? buildCorpus(deps.root, { linking: projectLinkingIdentifiers(deps.root) });
    return { members, free: { name, model }, corpus };
}

interface CallOutcome {
    readonly result: AskResult | null;
    readonly row: RunRow;
    readonly shadow: ShadowRow | null;
}

async function callOnce(
    deps: HarnessDeps,
    prep: Prepared,
    item: CorpusItem,
    flips: ((k: string) => boolean) | undefined,
): Promise<CallOutcome> {
    const capture: SideCapture = {};
    const before = readShadowLedger(deps.root).length;
    const started = deps.now().toISOString();
    const trackedFiles = deps.trackedFiles !== undefined ? deps.trackedFiles : trackedFileCount(deps.root);
    const result = await askHand(
        { kind: item.kind, spec: item.spec, linking: projectLinkingIdentifiers(deps.root) },
        {
            members: prep.members,
            contentClass: 'public-artifact',
            stateRoot: deps.root,
            auditDir: deps.auditDir ?? path.join(deps.root, DEFAULT_DIR),
            shadowVerify: headVerifyFor(item, capture),
            exposure: {
                ledger: ExposureLedger.load(path.join(deps.root, EXPOSURE_LEDGER_RELPATH)),
                exposes: { files: [item.path], symbols: [] },
                trackedFiles,
            },
            ...(flips !== undefined ? { flips } : {}),
            egress: deps.egress ?? corpusEgress(),
        },
    );
    const after = readShadowLedger(deps.root);
    const shadow = after.length === before + 1 ? (after[after.length - 1] as ShadowRow) : null;
    const row: RunRow = {
        type: 'call',
        id: item.id,
        kind: item.kind,
        started_at: started,
        shadowed: shadow !== null,
        served_by: result?.member ?? null,
        route_billing: result?.route_billing ?? null,
        paid_answer: shadow !== null ? (result?.parsed ?? capture.paid?.parsed ?? null) : null,
        paid_verdict: shadow?.paid.verified ?? null,
        free_answer: shadow !== null ? (capture.free?.parsed ?? null) : (result?.parsed ?? null),
        free_verdict: shadow?.free.verified ?? null,
        free_outcome: shadow?.free.outcome ?? null,
        paid_outcome: shadow?.paid.outcome ?? null,
        shadow_index: shadow !== null ? after.length - 1 : null,
        shadow_ts: shadow?.ts ?? null,
    };
    return { result, row, shadow };
}

/** Wait until the next free call may start: the pacing floor or the back-off, whichever is longer, from the last ledgered start. */
async function pace(deps: HarnessDeps, starts: readonly { started_at: string }[], minIntervalMs: number, backoffMs: number): Promise<void> {
    const last = starts.reduce((t, r) => Math.max(t, Date.parse(r.started_at)), 0);
    const wait = last === 0 ? 0 : last + Math.max(minIntervalMs, backoffMs) - deps.now().getTime();
    if (wait > 0) await deps.sleep(wait);
}

export interface WindowResult {
    readonly code: number;
    readonly calls: number;
    readonly stopped: string;
}

export async function runWindow(deps: HarnessDeps, opts: WindowOptions = {}): Promise<WindowResult> {
    const kinds = opts.kinds ?? MEASURED_KINDS;
    const bad = positiveInt('perKind', opts.perKind) ?? positiveInt('maxTotal', opts.maxTotal);
    if (bad !== null) {
        deps.log(bad);
        return { code: 2, calls: 0, stopped: bad };
    }
    const perKind = opts.perKind ?? PER_KIND;
    const maxTotal = Math.min(opts.maxTotal ?? SHADOW_CALL_CAP, SHADOW_CALL_CAP);
    const minInterval = opts.minIntervalMs ?? MIN_FREE_INTERVAL_MS;
    const prep = await prepare(deps, kinds);
    if (typeof prep === 'string') {
        deps.log(prep);
        return { code: 2, calls: 0, stopped: prep };
    }
    const file = path.join(runDir(deps.root), 'run.jsonl');
    const ledger = readRunLedger(deps.root);
    if (ledger.header !== null && ledger.header.digest !== prep.corpus.digest) {
        const why = `corpus digest ${prep.corpus.digest} differs from the run's ${ledger.header.digest}; this is a new registration, not a resume`;
        deps.log(why);
        return { code: 2, calls: 0, stopped: why };
    }
    const production = readShadowLedger(deps.root);
    for (const k of kinds) {
        const mine = ledger.rows.filter((r) => r.kind === k && r.shadowed).length;
        const theirs = production.filter((r) => r.kind === k).length;
        if (mine !== theirs) {
            const why = `foreign shadow rows: the production ledger has ${String(theirs)} ${k} rows, this run ${String(mine)}`;
            deps.log(why);
            return { code: 2, calls: 0, stopped: why };
        }
    }
    if (ledger.header === null) {
        const header: RunHeader = {
            type: 'header',
            label: LABEL,
            ref: prep.corpus.ref,
            digest: prep.corpus.digest,
            verifier: VERIFIER_VERSION,
            started_at: deps.now().toISOString(),
            free_route: prep.free.name,
            free_model: prep.free.model,
        };
        appendJsonl(file, header);
    }
    const rows = [...ledger.rows];
    const starts: { started_at: string }[] = [...ledger.rows, ...ledger.demos];
    // Only a ledgered shadow row completes an item; one that wrote none is retried.
    const done = new Set(rows.filter((r) => r.shadowed).map((r) => r.id));
    const count = (k?: MeasuredKind): number => rows.filter((r) => r.shadowed && (k === undefined || r.kind === k)).length;
    let calls = 0;
    for (const kind of kinds) {
        for (const item of prep.corpus.items[kind]) {
            if (count() >= maxTotal) return { code: 0, calls, stopped: `window cap ${String(maxTotal)} reached` };
            if (count(kind) >= perKind) break;
            if (done.has(item.id)) continue;
            await pace(deps, starts, minInterval, trailingStreaks(rows).backoffMs);
            const out = await callOnce(deps, prep, item, undefined);
            appendJsonl(file, out.row);
            rows.push(out.row);
            starts.push(out.row);
            calls++;
            if (out.shadow === null) {
                return { code: 1, calls, stopped: `${item.id}: no shadow row was written (free route not admissible, retired or capped); resume later` };
            }
            done.add(item.id);
            if (out.result === null) return { code: 1, calls, stopped: `${item.id}: the paid arm returned nothing (${String(out.row.paid_outcome)}); resume later` };
            const fo = out.shadow.free.outcome;
            if (fo === 'billing') return { code: 1, calls, stopped: `${item.id}: the free route answered 402, which contradicts its keyless proof` };
            const st = trailingStreaks(rows);
            if (st.rateLimited >= BACKOFF_MAX_STREAK) return { code: 1, calls, stopped: `${String(st.rateLimited)} rate-limited free answers in a row; resume later` };
            if (st.failed >= FREE_FAILURE_STREAK_MAX) {
                return { code: 1, calls, stopped: `${String(st.failed)} failed free answers in a row (last: ${fo}); the free route looks dead, resume later` };
            }
            deps.log(`${item.id}: paid ${String(out.row.paid_verdict)} · free ${String(out.row.free_verdict)} (${fo})`);
        }
    }
    return { code: 0, calls, stopped: 'corpus exhausted or every kind at its cap' };
}

/** AC-3: one classify ask the production chooser serves on the free route, verified by the head. */
export async function ac3Demo(deps: HarnessDeps, opts: Pick<WindowOptions, 'minIntervalMs'> = {}): Promise<WindowResult> {
    const prep = await prepare(deps, ['classify']);
    if (typeof prep === 'string') {
        deps.log(prep);
        return { code: 2, calls: 0, stopped: prep };
    }
    const item = prep.corpus.items.classify[0];
    if (item === undefined) return { code: 2, calls: 0, stopped: 'empty classify corpus' };
    const ledger = readRunLedger(deps.root);
    await pace(deps, [...ledger.rows, ...ledger.demos], opts.minIntervalMs ?? MIN_FREE_INTERVAL_MS, trailingStreaks(ledger.rows).backoffMs);
    const auditDir = deps.auditDir ?? path.join(deps.root, DEFAULT_DIR);
    const out = await callOnce(deps, prep, item, (k) => k === 'classify');
    const demo: DemoRow = { type: 'demo', id: item.id, started_at: out.row.started_at };
    appendJsonl(path.join(runDir(deps.root), 'run.jsonl'), demo);
    const r = out.result;
    const verdict = r === null ? 'fail' : verifyAnswer('classify', item.truth, r.parsed);
    const servedFree = r !== null && r.route_billing !== undefined && isUnpaid(r.route_billing);
    if (r !== null && r.work_id !== undefined && r.route_billing !== undefined) {
        const { main: record } = await import('../../../src/scripts/orchestration_record.js');
        record([
            '--work-id', r.work_id, '--route-taken', 'ask', '--spawn-count', '0', '--token-delta', '0',
            '--phase', 'verify', '--hand-kind', 'classify', '--route-billing', r.route_billing,
            '--verified', verdict, '--verify-tokens', '0', '--dir', auditDir,
        ]);
    }
    const evidence = {
        label: LABEL,
        ts: out.row.started_at,
        item: item.id,
        served_by: r?.member ?? null,
        route_billing: r?.route_billing ?? null,
        model_served: r?.model_served ?? null,
        verified: verdict,
        verifier: VERIFIER_VERSION,
        work_id: r?.work_id ?? null,
    };
    fs.mkdirSync(runDir(deps.root), { recursive: true });
    fs.writeFileSync(path.join(runDir(deps.root), 'ac3-demo.json'), `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    deps.log(`AC-3 demo: served by ${String(evidence.served_by)} (${String(evidence.route_billing)}), head verify ${verdict}`);
    return servedFree
        ? { code: 0, calls: 1, stopped: 'served on the free route' }
        : { code: 1, calls: 1, stopped: 'the chooser did not serve the ask on a free route' };
}

export interface AuditRow {
    readonly id: string;
    readonly kind: MeasuredKind;
    readonly side: 'paid' | 'free';
    readonly deterministic: VerifyVerdict | null;
    readonly head: boolean | null;
}

export function auditPrompt(spec: string, answer: unknown): string {
    return (
        'You are auditing one answer a worker gave to a bounded task. Judge only whether the answer is correct for the task.\n\n' +
        `Task:\n${spec}\n\nThe worker's answer (JSON):\n${JSON.stringify(answer)}\n\n` +
        'Reply with exactly one JSON object, {"correct": true} or {"correct": false}, and nothing else.'
    );
}

export function parseAuditAnswer(raw: string | null): boolean | null {
    if (raw === null) return null;
    const m = /\{\s*"correct"\s*:\s*(true|false)\s*\}/.exec(raw);
    return m === null ? null : m[1] === 'true';
}

/**
 * The blind head: `claude -p` from an empty directory, project and local settings
 * only. It refuses (null, nothing spawned) while a billing variable is set, and
 * still strips them from the child's environment.
 */
export function claudeHead(model: string, env: NodeJS.ProcessEnv = process.env): (prompt: string) => string | null {
    return (prompt) => {
        if (headRefusals(env).length > 0) return null;
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fhs-audit-'));
        try {
            const clean: NodeJS.ProcessEnv = { ...env };
            for (const v of VENDOR_BILLING_ENV['anthropic'] ?? []) delete clean[v];
            const r = spawnSync('claude', ['-p', '--setting-sources', 'project,local', '--model', model, prompt], {
                cwd: dir,
                env: clean,
                encoding: 'utf8',
                timeout: 180_000,
            });
            return r.status === 0 ? r.stdout : null;
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    };
}

const auditKey = (a: { id: string; side: 'paid' | 'free' }): string => `${a.id}#${a.side}`;

/** The audit rows of this run's shadowed ids, one per question: an answered row wins over an unanswered one. */
export function readAudit(root: string): AuditRow[] {
    const ids = new Set(readRunLedger(root).rows.filter((r) => r.shadowed).map((r) => r.id));
    const by = new Map<string, AuditRow>();
    for (const a of readJsonl<AuditRow>(path.join(runDir(root), 'audit.jsonl'))) {
        if (!ids.has(a.id)) continue;
        const prev = by.get(auditKey(a));
        if (prev === undefined || (prev.head === null && a.head !== null)) by.set(auditKey(a), a);
    }
    return [...by.values()];
}

/** Audits the sample once: a question with an answered row is never asked again, so a rerun neither re-bills nor double-counts. */
export async function runAudit(deps: HarnessDeps, model = 'haiku'): Promise<AuditRow[]> {
    if (deps.askHead === undefined) {
        const refused = headRefusals(deps.env);
        if (refused.length > 0) {
            deps.log(`refusing to audit — ${refused.join('; ')}`);
            return [];
        }
    }
    const answered = new Set(readAudit(deps.root).filter((a) => a.head !== null).map(auditKey));
    const rows = windowShadowRows(deps.root).map((x) => x.row);
    const corpus = deps.corpus?.() ?? buildCorpus(deps.root, { linking: projectLinkingIdentifiers(deps.root) });
    const specs = new Map([...corpus.items.classify, ...corpus.items.extract].map((i) => [i.id, i.spec]));
    const ask = deps.askHead ?? claudeHead(model, deps.env);
    const questions: { row: RunRow; side: 'paid' | 'free' }[] = [];
    for (const kind of MEASURED_KINDS) {
        const pool = rows.filter((r) => r.kind === kind && r.shadowed);
        const k = Math.ceil(pool.length * 0.1);
        for (const row of seededShuffle(pool, AUDIT_SEED, (r) => r.id).slice(0, k)) {
            questions.push({ row, side: 'paid' }, { row, side: 'free' });
        }
    }
    const out: AuditRow[] = [];
    const file = path.join(runDir(deps.root), 'audit.jsonl');
    for (const q of seededShuffle(questions, AUDIT_SEED, (x) => `${x.row.id}#${x.side}`)) {
        if (answered.has(auditKey({ id: q.row.id, side: q.side }))) continue;
        const answer = q.side === 'paid' ? q.row.paid_answer : q.row.free_answer;
        const spec = specs.get(q.row.id);
        const deterministic = q.side === 'paid' ? q.row.paid_verdict : q.row.free_verdict;
        const head = answer === null || spec === undefined ? null : parseAuditAnswer(await ask(auditPrompt(spec, answer)));
        const a: AuditRow = { id: q.row.id, kind: q.row.kind, side: q.side, deterministic, head };
        appendJsonl(file, a);
        out.push(a);
    }
    return out;
}

interface KindReport {
    kind: MeasuredKind;
    calls: number;
    paid_pass: number;
    free_pass: number;
    free_verify_fail: number;
    free_escalation: number;
    paid_verify_fail: number;
    rate_limited: number;
    billing: number;
    quality: 'met' | 'null' | 'underpowered';
    relief: 'met' | 'null' | 'underpowered';
    readiness: string[];
    audit: { questions: number; agreement: number | null; suspect: boolean; disagreements: string[] };
    tokens: { paid: number; free: number; verify: number };
}

export function buildReport(deps: Pick<HarnessDeps, 'root'>, corpus: Corpus | null): { kinds: KindReport[]; markdown: string; inconsistencies: Corpus['inconsistencies'] } {
    const shadow = windowShadowRows(deps.root).map((x) => x.shadow);
    const stats = shadowReport(shadow);
    const audit = readAudit(deps.root);
    const kinds: KindReport[] = MEASURED_KINDS.map((kind) => {
        const rs = shadow.filter((r) => r.kind === kind);
        const n = rs.length;
        const rate = (f: (r: ShadowRow) => boolean): number => (n === 0 ? 0 : rs.filter(f).length / n);
        const s = stats.find((x) => x.kind === kind);
        const powered = n >= MIN_SHADOW_PER_KIND;
        const qualityOk = s !== undefined && s.free_rate <= s.paid_rate + QUALITY_MARGIN && s.free_rate < ESCALATION_KILL;
        const reliefOk = s !== undefined && s.weeks.length > 0 && s.weeks.every((w) => w.net > 0);
        const au = audit.filter((a) => a.kind === kind && a.head !== null && a.deterministic !== null);
        const agree = au.filter((a) => a.head === (a.deterministic === 'pass'));
        const agreement = au.length === 0 ? null : agree.length / au.length;
        return {
            kind,
            calls: n,
            paid_pass: rate((r) => r.paid.verified === 'pass'),
            free_pass: rate((r) => r.free.verified === 'pass'),
            free_verify_fail: rate((r) => r.free.verified === 'fail'),
            free_escalation: rate((r) => r.free.verified === 'skipped'),
            paid_verify_fail: rate((r) => r.paid.verified === 'fail'),
            rate_limited: rs.filter((r) => r.free.outcome === 'rate_limited' || r.free.outcome === 'quota_exhausted').length,
            billing: rs.filter((r) => r.free.outcome === 'billing').length,
            quality: !powered ? 'underpowered' : qualityOk ? 'met' : 'null',
            relief: !powered ? 'underpowered' : reliefOk ? 'met' : 'null',
            readiness: flipVerdict(s).reasons,
            audit: {
                questions: au.length,
                agreement,
                suspect: agreement !== null && agreement < 0.9,
                disagreements: au.filter((a) => a.head !== (a.deterministic === 'pass')).map((a) => `${a.id}#${a.side}`),
            },
            tokens: {
                paid: rs.reduce((t, r) => t + r.paid.tokens, 0),
                free: rs.reduce((t, r) => t + r.free.tokens, 0),
                verify: rs.reduce((t, r) => t + r.free.verify_tokens + r.paid.verify_tokens, 0),
            },
        };
    });
    const pct = (x: number): string => `${(x * 100).toFixed(1)} %`;
    const inconsistencies = corpus?.inconsistencies ?? [];
    const lines = [
        '# Free-hands shadow window — evidence summary',
        '',
        `> Label: **${LABEL}**. Pre-registration: \`internal/bench/free-hands-shadow-PREREG.md\`. Verifier \`${VERIFIER_VERSION}\`` +
            (corpus !== null ? `, corpus ref \`${corpus.ref}\`, digest \`${corpus.digest}\`.` : '.'),
        '> Spend: USD 0.00 on both arms by construction (subscription CLI and a keyless route); tokens below. Verify tokens are 0: the verifier is deterministic.',
        '',
        '| kind | calls | paid pass | free pass | free verify-fail | free escalation | 429 | 402 | quality bar | relief bar | audit agreement |',
        '|---|---|---|---|---|---|---|---|---|---|---|',
        ...kinds.map(
            (k) =>
                `| ${k.kind} | ${String(k.calls)} | ${pct(k.paid_pass)} | ${pct(k.free_pass)} | ${pct(k.free_verify_fail)} | ${pct(k.free_escalation)} | ` +
                `${String(k.rate_limited)} | ${String(k.billing)} | ${k.quality} | ${k.relief} | ` +
                `${k.audit.agreement === null ? 'not run' : `${pct(k.audit.agreement)} of ${String(k.audit.questions)}${k.audit.suspect ? ' · verifier-suspect' : ''}`} |`,
        ),
        '',
        '## kind_flip readiness',
        '',
        ...kinds.map((k) => `- ${k.kind}: ${k.readiness.length === 0 ? 'ready' : `not ready — ${k.readiness.join('; ')}`}`),
        '',
        '## Tokens',
        '',
        ...kinds.map((k) => `- ${k.kind}: paid ${String(k.tokens.paid)} · free ${String(k.tokens.free)} · verify ${String(k.tokens.verify)}`),
        '',
        '## Audit disagreements (the deterministic verdict stays the record)',
        '',
        ...kinds.map((k) => `- ${k.kind}: ${k.audit.disagreements.length === 0 ? 'none' : k.audit.disagreements.join(', ')}`),
        '',
        '## Path class and frontmatter disagree',
        '',
        ...(inconsistencies.length === 0 ? ['- none among the corpus files'] : inconsistencies.map((i) => `- \`${i.path}\` (${i.label}): ${i.reason}`)),
        '',
    ];
    return { kinds, markdown: lines.join('\n'), inconsistencies };
}

function _gitRoot(cwd: string): string | null {
    const r = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
    return r.status === 0 ? r.stdout.trim() : null;
}

async function _productionDeps(root: string): Promise<HarnessDeps> {
    const cli = await import('../../../src/scripts/council_cli.js');
    return {
        root,
        env: process.env,
        now: () => new Date(),
        sleep: (ms) => new Promise((res) => setTimeout(res, ms)),
        log: (l) => process.stdout.write(`${l}\n`),
        loadSettings: () => cli.load_settings(undefined, { ai_council_path: process.env['AI_COUNCIL_CONFIG'] as string }),
        buildMembers: (settings, opts) => cli.build_members(settings, opts),
    };
}

function flag(argv: readonly string[], name: string): string | undefined {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
}

export async function main(argv: readonly string[]): Promise<number> {
    const root = _gitRoot(process.cwd());
    if (root === null || path.resolve(root) !== path.resolve(process.cwd())) {
        process.stderr.write('run.ts: start it from the repository root (the first-party roster gate reads the working directory)\n');
        return 2;
    }
    const sub = argv[0] === 'audit' || argv[0] === 'report' ? argv[0] : 'run';
    if (sub === 'report') {
        const out = flag(argv, '--out') ?? path.join('internal', 'bench', 'reports', 'free-hands-shadow.md');
        const corpus = buildCorpus(root, { linking: projectLinkingIdentifiers(root) });
        const rep = buildReport({ root }, corpus);
        fs.mkdirSync(path.dirname(path.resolve(root, out)), { recursive: true });
        fs.writeFileSync(path.resolve(root, out), rep.markdown, 'utf8');
        process.stdout.write(`${rep.markdown}\n`);
        return 0;
    }
    if (sub === 'audit') {
        const deps = { ...(await _productionDeps(root)), loadSettings: () => ({}) };
        const rows = await runAudit(deps, flag(argv, '--audit-model') ?? 'haiku');
        process.stdout.write(`audit: ${String(rows.length)} questions, ${String(rows.filter((r) => r.head === null).length)} unanswered\n`);
        return 0;
    }
    const cfg = process.env['AI_COUNCIL_CONFIG'];
    if (cfg === undefined || !path.isAbsolute(cfg) || !fs.existsSync(cfg)) {
        process.stderr.write('run.ts: set AI_COUNCIL_CONFIG to the absolute path of a run-local council file\n');
        return 2;
    }
    const deps = await _productionDeps(root);
    const fp = flag(argv, '--first-party-list');
    const d: HarnessDeps = fp !== undefined ? { ...deps, firstPartyList: fp } : deps;
    const num = (name: string): number | undefined => {
        const v = flag(argv, name);
        return v === undefined ? undefined : /^\d+$/.test(v) ? Number(v) : Number.NaN;
    };
    const perKind = num('--per-kind');
    const maxTotal = num('--max-total');
    const bad = positiveInt('--per-kind', perKind) ?? positiveInt('--max-total', maxTotal);
    if (bad !== null) {
        process.stderr.write(`run.ts: ${bad}\n`);
        return 2;
    }
    const res = argv.includes('--ac3-demo')
        ? await ac3Demo(d)
        : await runWindow(d, { ...(perKind !== undefined ? { perKind } : {}), ...(maxTotal !== undefined ? { maxTotal } : {}) });
    process.stdout.write(`stopped: ${res.stopped} (${String(res.calls)} calls)\n`);
    return res.code;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    void main(process.argv.slice(2)).then((code) => process.exit(code));
}
