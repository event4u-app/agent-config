/**
 * A `stable` adapter tier must resolve to evidence a reviewer can reach.
 *
 * WHY THIS EXISTS
 * ---------------
 * Seven media adapters carry `# Lifecycle: stable — promoted 2026-06-10
 * (maintainer-authorized)`. `docs/contracts/provider-lifecycle.md` says
 * promotion "requires a maintainer-captured real-API smoke trace under
 * `agents/reference/ai-video/smoke-traces/`" — and `git ls-files` over that
 * path returns **0**. The traces were captured and then deliberately withheld
 * (`d7f5d5d3c`, 2026-06-10, "smoke-traces fully local-only"), a decision
 * reaffirmed by AI council on 2026-08-23. So the evidence is real and the
 * CLAIM was uncheckable: a reviewer holding a clone had nothing to look at,
 * and nothing stopped the next adapter from writing `stable` with no evidence
 * at all.
 *
 * `agents/evidence/ai-video/trace-index.json` (written by
 * `smoke-trace.sh index`) is the five-field projection that makes the claim
 * checkable without publishing one request body. This gate is what makes the
 * index load-bearing rather than decorative.
 *
 * cache-invalidation: the index carries no `v<N>` path segment on purpose. It
 * is regenerated WHOLESALE from the local trace directory on every
 * `smoke-trace.sh index` run — never merged into, never appended to — so there
 * is no window in which a reader can hold a file written under an older shape.
 * A version namespace exists to stop a stale cache being read after its
 * producer changed; here the producer rewrites the whole file, this gate reads
 * it in the same commit, and the five-field shape is asserted directly by
 * `tests/scripts/ai_video_trace_index.test.ts`. Adding `v1/` would create a
 * second path to keep in sync and buy nothing.
 *
 * WHAT IT CHECKS — and the limit, stated rather than implied
 * ---------------------------------------------------------
 * 1. Every adapter header reading `stable` has at least one index row for its
 *    provider whose `captured_at` is within {@link RECHECK_WINDOW_DAYS}.
 * 2. Every `smoke_trace` id referenced by a model-capability manifest resolves
 *    to a row. A dangling reference is a claim pointing at nothing.
 *
 * **It cannot check that the trace was a LIVE, SUCCESSFUL round-trip.** The
 * index carries five fields by design — provider, trace_id, captured_at,
 * model, sha256 — and `mode` and `success` are not among them, because adding
 * fields to reach a stronger check is how a five-field allowlist becomes a
 * body copy. So a dry-run trace satisfies rule 1. That is a real weakness and
 * it is written here instead of behind a stronger-sounding success line: the
 * per-model `verified: true` + `smoke_trace` pair in the manifests is the
 * stronger signal, and rule 2 is what keeps it honest.
 *
 * The staleness window is ONE constant, shared with the `recheck_by` stamp
 * `smoke-trace.sh` writes into every trace, so the two cannot drift apart.
 *
 * COST CALIBRATION (roadmap step 2.3) — warn, never fail
 * -----------------------------------------------------
 * `--cost-diff <base-ref>` warns when a manifest's `cost_per_second_usd`
 * changed without a citation of the cost ledger in the same diff. A WARNING,
 * because a modeled estimate is allowed to be re-modeled by a human; what is
 * not allowed is doing it silently after money was already spent measuring the
 * real figure.
 *
 * Modes:
 *   (bare)                  gate over the real tree
 *   --quiet                 verdict line only
 *   --table                 emit the generated tier table for the contract
 *   --cost-diff <base-ref>  additionally warn on uncited manifest cost changes
 *   --root <dir>            drive a fixture tree (tests)
 *
 * Exit 0 = every stable claim resolves. 1 = a claim does not.
 * 2 = the gate could not run (no index, empty corpus).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as os from 'node:os';

import { GateLedger, LedgerUsageError } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const GATE = 'lint_adapter_tier';

/**
 * How long a smoke trace stands as evidence.
 *
 * 180 days is a STATED DEFAULT, not a measured optimum, and the honest reason
 * to have any window at all is documented in the roadmap's own risk register:
 * vendor endpoints have gained and lost frame conditioning inside weeks, so an
 * undated claim is a claim about the past presented as the present.
 * `AIV_TRACE_RECHECK_DAYS` overrides it in `smoke-trace.sh`; both read the
 * same number so a change moves both sides.
 *
 * Revisit-if: a provider is observed changing a capability inside the window,
 * or two consecutive re-captures find nothing changed.
 */
export const RECHECK_WINDOW_DAYS = 180;

export const ADAPTER_DIRS = [
    path.join('src', 'scripts', 'ai-video', 'adapters'),
    path.join('src', 'scripts', 'ai-image', 'adapters'),
] as const;
export const MANIFEST_DIR = path.join('src', 'scripts', 'ai-video', 'lib', 'model-capabilities');
// cache-invalidation: regenerated wholesale by `smoke-trace.sh index` on every
// run, so no version namespace is needed — see the module docstring for why.
export const INDEX_PATH = path.join('agents', 'evidence', 'ai-video', 'trace-index.json');

export interface IndexRow {
    provider: string;
    trace_id: string;
    captured_at: string;
    model: string | null;
    sha256: string;
}

export interface Finding {
    adapter: string;
    reason: string;
}

export interface AdapterTier {
    adapter: string;
    domain: string;
    tier: string;
    file: string;
}

/**
 * Parse `# Lifecycle: <tier>` out of an adapter header.
 *
 * Returns `null` when the header is absent — which the caller treats as a
 * finding for a would-be `stable` claim, never as a pass.
 */
export function parseTier(source: string): string | null {
    const m = /^#\s*Lifecycle:\s*([a-z]+)/m.exec(source);
    return m?.[1] ?? null;
}

/**
 * A capture stamp is filesystem-safe (`2026-06-10T12-36-49Z`), so the two
 * time separators have to come back before `Date` will read it. An
 * unparseable stamp returns `null` and is reported — never silently treated
 * as fresh, which would make a malformed row the easiest way to pass.
 */
export function parseStamp(stamp: string): Date | null {
    const iso = stamp.replace(/T(\d{2})-(\d{2})-(\d{2})Z$/, 'T$1:$2:$3Z');
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d;
}

export function ageInDays(stamp: string, now = new Date()): number | null {
    const d = parseStamp(stamp);
    if (d === null) return null;
    return (now.getTime() - d.getTime()) / 86_400_000;
}

/** Every adapter in the tree with its parsed tier. */
export function collectAdapters(root: string): AdapterTier[] {
    const out: AdapterTier[] = [];
    for (const rel of ADAPTER_DIRS) {
        const dir = path.join(root, rel);
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir).sort()) {
            if (!name.endsWith('.sh')) continue;
            const file = path.join(rel, name);
            const tier = parseTier(fs.readFileSync(path.join(root, file), 'utf-8'));
            out.push({
                adapter: name.replace(/\.sh$/, ''),
                domain: path.basename(path.dirname(rel)),
                tier: tier ?? 'unknown',
                file,
            });
        }
    }
    return out;
}

export function check(
    root: string,
    opts: { now?: Date; quiet?: boolean } = {},
): { code: number; findings: Finding[]; scanned: number; adapters: AdapterTier[] } {
    const now = opts.now ?? new Date();
    const findings: Finding[] = [];
    const adapters = collectAdapters(root);

    const indexAbs = path.join(root, INDEX_PATH);
    if (!fs.existsSync(indexAbs)) {
        process.stderr.write(
            `❌  ${GATE}: trace index not found at ${INDEX_PATH}.\n` +
                `    Regenerate it with:\n` +
                `      bash src/scripts/ai-video/smoke-trace.sh index\n` +
                `    Exit 2, not 0: with no index every stable claim is unverifiable, which is\n` +
                `    the condition this gate exists to refuse — not a clean tree.\n`,
        );
        return { code: 2, findings, scanned: adapters.length, adapters };
    }

    let rows: IndexRow[];
    try {
        rows = JSON.parse(fs.readFileSync(indexAbs, 'utf-8')) as IndexRow[];
        if (!Array.isArray(rows)) throw new Error('not an array');
    } catch (err) {
        process.stderr.write(`❌  ${GATE}: ${INDEX_PATH} is not a readable row array (${String(err)}).\n`);
        return { code: 2, findings, scanned: adapters.length, adapters };
    }

    try {
        reportScanned({
            gate: GATE,
            scanned: adapters.length,
            units: 'adapter header(s)',
            roots: [...ADAPTER_DIRS],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned: adapters.length, adapters };
        }
        throw err;
    }

    const byProvider = new Map<string, IndexRow[]>();
    for (const r of rows) {
        const list = byProvider.get(r.provider) ?? [];
        list.push(r);
        byProvider.set(r.provider, list);
    }
    const traceIds = new Set(rows.map((r) => r.trace_id));

    const ledger = new GateLedger(GATE);
    try {
        // One planned unit per adapter header, plus one per manifest reference:
        // both are claims, and a claim that is never adjudicated is what the
        // ledger exists to surface.
        const refs = manifestTraceRefs(root);
        ledger.plan([
            ...adapters.map((a) => `adapter:${a.file}`),
            ...refs.map((r) => `ref:${r.manifest}:${r.model}`),
        ]);

        for (const a of adapters) {
            const id = `adapter:${a.file}`;
            if (a.tier !== 'stable') {
                ledger.complete(id);
                continue;
            }
            const candidates = byProvider.get(a.adapter) ?? [];
            if (candidates.length === 0) {
                const reason =
                    `header claims \`stable\` but the trace index holds no row for provider ` +
                    `\`${a.adapter}\` — the promotion evidence is unreachable from a clone`;
                findings.push({ adapter: a.adapter, reason });
                ledger.fail(id, reason);
                continue;
            }
            let freshest: { age: number; id: string } | null = null;
            let unparseable = 0;
            for (const c of candidates) {
                const age = ageInDays(c.captured_at, now);
                if (age === null) {
                    unparseable += 1;
                    continue;
                }
                if (freshest === null || age < freshest.age) freshest = { age, id: c.trace_id };
            }
            if (freshest === null) {
                const reason =
                    `header claims \`stable\` and all ${String(unparseable)} index row(s) for ` +
                    `\`${a.adapter}\` carry an unparseable \`captured_at\` — an undatable trace ` +
                    `is not dated evidence`;
                findings.push({ adapter: a.adapter, reason });
                ledger.fail(id, reason);
                continue;
            }
            if (freshest.age > RECHECK_WINDOW_DAYS) {
                const reason =
                    `header claims \`stable\` but its freshest trace \`${freshest.id}\` is ` +
                    `${freshest.age.toFixed(0)} days old, past the ${String(RECHECK_WINDOW_DAYS)}-day ` +
                    `window — stale, so re-capture or demote the header; nothing is demoted for you`;
                findings.push({ adapter: a.adapter, reason });
                ledger.fail(id, reason);
                continue;
            }
            ledger.complete(id);
        }

        for (const r of refs) {
            const id = `ref:${r.manifest}:${r.model}`;
            if (traceIds.has(r.traceId)) {
                ledger.complete(id);
                continue;
            }
            const reason =
                `manifest \`${r.manifest}\` model \`${r.model}\` cites smoke_trace ` +
                `\`${r.traceId}\`, which resolves to no index row — a dangling evidence pointer`;
            findings.push({ adapter: r.manifest, reason });
            ledger.fail(id, reason);
        }
    } catch (err) {
        if (err instanceof LedgerUsageError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return { code: 2, findings, scanned: adapters.length, adapters };
        }
        throw err;
    }
    ledger.report();

    return { code: findings.length > 0 ? 1 : 0, findings, scanned: adapters.length, adapters };
}

export interface TraceRef {
    manifest: string;
    model: string;
    traceId: string;
}

/** Every `smoke_trace` reference across the model-capability manifests. */
export function manifestTraceRefs(root: string): TraceRef[] {
    const dir = path.join(root, MANIFEST_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: TraceRef[] = [];
    for (const name of fs.readdirSync(dir).sort()) {
        if (!name.endsWith('.json')) continue;
        let doc: { models?: Record<string, { smoke_trace?: unknown }> };
        try {
            doc = JSON.parse(fs.readFileSync(path.join(dir, name), 'utf-8')) as typeof doc;
        } catch {
            continue;
        }
        for (const [model, entry] of Object.entries(doc.models ?? {})) {
            const t = entry.smoke_trace;
            if (typeof t === 'string' && t !== '') {
                out.push({ manifest: name.replace(/\.json$/, ''), model, traceId: t });
            }
        }
    }
    return out;
}

/**
 * The generated tier table for `docs/contracts/provider-lifecycle.md` § 5.
 *
 * §5 was a hand-written day-one snapshot that said all five adapters were
 * `experimental` while seven headers read `stable`. The contract self-scoped
 * that table to its landing day, so it was stale rather than wrong — but a
 * stale snapshot in a contract is still something a reader trips over.
 * Generating it means the snapshot cannot drift again.
 */
export function tierTable(root: string, now = new Date()): string {
    const adapters = collectAdapters(root);
    const indexAbs = path.join(root, INDEX_PATH);
    let rows: IndexRow[] = [];
    if (fs.existsSync(indexAbs)) {
        try {
            rows = JSON.parse(fs.readFileSync(indexAbs, 'utf-8')) as IndexRow[];
        } catch {
            rows = [];
        }
    }
    const lines = [
        '| Adapter | Domain | Tier | Freshest reachable trace |',
        '|---|---|---|---|',
    ];
    for (const a of adapters) {
        const mine = rows.filter((r) => r.provider === a.adapter);
        let evidence = '— (none in the index)';
        if (mine.length > 0) {
            let best: IndexRow | null = null;
            let bestAge = Number.POSITIVE_INFINITY;
            for (const r of mine) {
                const age = ageInDays(r.captured_at, now);
                if (age !== null && age < bestAge) {
                    bestAge = age;
                    best = r;
                }
            }
            evidence =
                best === null
                    ? `${String(mine.length)} row(s), none datable`
                    : `\`${best.captured_at}\` (${String(mine.length)} row(s))`;
        }
        lines.push(`| \`${a.adapter}\` | ${a.domain} | \`${a.tier}\` | ${evidence} |`);
    }
    return lines.join('\n');
}

/**
 * Step 2.3 — warn when a manifest cost changed with no ledger citation.
 *
 * Deliberately a WARNING and never a failure: re-modeling an estimate is a
 * legitimate human act. Doing it silently *after* a live run measured the real
 * charge is the thing worth noticing, because that is the moment the modeled
 * number stops being a guess and starts being a contradicted measurement.
 */
export function costDiffWarnings(root: string, baseRef: string): string[] {
    const warnings: string[] = [];
    let diff = '';
    try {
        // GIT_DIR / GIT_WORK_TREE are scrubbed, not inherited. A gate invoked
        // from a hook or a worktree runs with those set to somebody else's
        // repository, and `cwd` is then silently ignored — the diff comes back
        // from the wrong tree and the warning is computed about the wrong
        // change. `cwd` must be the only thing that decides which repo this is.
        const env = { ...process.env };
        delete env.GIT_DIR;
        delete env.GIT_WORK_TREE;
        delete env.GIT_INDEX_FILE;
        diff = execFileSync('git', ['diff', '--unified=0', baseRef, '--', MANIFEST_DIR, LEDGER_PATH], {
            cwd: root,
            encoding: 'utf-8',
            env,
            maxBuffer: 32 * 1024 * 1024,
        });
    } catch {
        return [`${GATE}: could not diff against \`${baseRef}\` — cost-change warning skipped, not passed`];
    }
    const costChanged = /^[+-].*"cost_per_second_usd"/m.test(diff);
    const ledgerCited = diff.split('\n').some((l) => l.startsWith('+') && l.includes(LEDGER_PATH));
    const ledgerTouched = diff.includes(LEDGER_PATH);
    if (costChanged && !ledgerCited && !ledgerTouched) {
        warnings.push(
            `${GATE}: a manifest \`cost_per_second_usd\` changed in this diff with no row added to ` +
                `\`${LEDGER_PATH}\`. A modeled cost may only be re-modeled from measured charges — ` +
                `cite the ledger rows the new figure averages, or say in the commit why none exist.`,
        );
    }
    return warnings;
}

export const LEDGER_PATH = path.join('agents', 'evidence', 'ai-video', 'cost-ledger.jsonl');

export const CONTRACT_PATH = path.join('docs', 'contracts', 'provider-lifecycle.md');
export const BEGIN_MARKER = '<!-- BEGIN GENERATED: adapter-tier-table -->';
export const END_MARKER = '<!-- END GENERATED: adapter-tier-table -->';

/**
 * Splice the generated table into the contract between its markers.
 *
 * Returns the new file text. Idempotent by construction: the block between the
 * markers is REPLACED, never appended to, so running the writer twice produces
 * the same bytes.
 */
export function spliceContract(contractText: string, table: string): string {
    const b = contractText.indexOf(BEGIN_MARKER);
    const e = contractText.indexOf(END_MARKER);
    if (b === -1 || e === -1 || e < b) {
        throw new Error(
            `${GATE}: ${CONTRACT_PATH} is missing the generated-table markers ` +
                `(${BEGIN_MARKER} … ${END_MARKER}). Restore them rather than hand-writing the table.`,
        );
    }
    const head = contractText.slice(0, b + BEGIN_MARKER.length);
    const tail = contractText.slice(e);
    return `${head}\n${table}\n${tail}`;
}

/**
 * Does the contract's generated block match the tree?
 *
 * This is the half that makes "generated" a fact rather than a comment. A
 * `DO NOT EDIT BY HAND` marker with nothing checking it is a request, and the
 * defect this replaced was precisely a table nobody re-derived for ten weeks.
 */
export function contractDrift(root: string, now = new Date()): string | null {
    const abs = path.join(root, CONTRACT_PATH);
    if (!fs.existsSync(abs)) return `${CONTRACT_PATH} not found`;
    const text = fs.readFileSync(abs, 'utf-8');
    const want = spliceContract(text, tierTable(root, now));
    return want === text ? null : `${CONTRACT_PATH} § 5 table is stale — regenerate with \`--write-contract\``;
}


const SELF = 'src/scripts/lint_adapter_tier.ts';
const SELF_TEST_MIN_CASES = 6;
const SELF_TEST_MIN_REJECT = 3;

/**
 * A minimal tree with the same shape as the real one, so the self-test drives
 * the REAL binary over a fixture rather than re-asserting the pure functions
 * a unit test already covers.
 */
function _fixtureTree(opts: { tier: string; rows: unknown[]; withContract?: boolean }): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'adapter-tier-st-'));
    for (const rel of ADAPTER_DIRS) fs.mkdirSync(path.join(root, rel), { recursive: true });
    fs.mkdirSync(path.join(root, MANIFEST_DIR), { recursive: true });
    fs.mkdirSync(path.join(root, path.dirname(INDEX_PATH)), { recursive: true });
    fs.writeFileSync(
        path.join(root, ADAPTER_DIRS[0], 'zz-fixture.sh'),
        `#!/usr/bin/env bash\n# Lifecycle: ${opts.tier} — fixture\nexit 0\n`,
    );
    fs.writeFileSync(path.join(root, INDEX_PATH), JSON.stringify(opts.rows));
    if (opts.withContract !== false) {
        fs.mkdirSync(path.join(root, path.dirname(CONTRACT_PATH)), { recursive: true });
        const seed = `# fixture\n\n${BEGIN_MARKER}\n${END_MARKER}\n`;
        fs.writeFileSync(path.join(root, CONTRACT_PATH), spliceContract(seed, tierTable(root)));
    }
    return root;
}

function _freshRow(provider: string, daysAgo: number, traceId = `${provider}-t`) {
    const d = new Date(Date.now() - daysAgo * 86_400_000);
    return {
        provider,
        trace_id: traceId,
        captured_at: d.toISOString().replace(/:/g, '-').replace(/\.\d+Z$/, 'Z'),
        model: null,
        sha256: 'x'.repeat(64),
    };
}

function selfTest(): number {
    const repoRoot = path.resolve(_HERE, '..', '..', '..');
    const drive = (root: string) => runGateCli(repoRoot, SELF, ['--quiet', '--root', root], repoRoot);
    const withTree = (opts: Parameters<typeof _fixtureTree>[0], f: (root: string) => number): number => {
        const root = _fixtureTree(opts);
        try {
            return f(root);
        } finally {
            fs.rmSync(root, { recursive: true, force: true });
        }
    };

    const cases: SelfTestCase[] = [
        {
            name: 'rejects a stable header with no index row at all',
            expect: 'reject',
            run: () => withTree({ tier: 'stable', rows: [] }, drive),
        },
        {
            name: 'rejects a stable header whose only row is past the 180-day window',
            expect: 'reject',
            run: () => withTree({ tier: 'stable', rows: [_freshRow('zz-fixture', 400)] }, drive),
        },
        {
            name: 'rejects a stable header whose row carries an unparseable captured_at',
            expect: 'reject',
            run: () =>
                withTree(
                    {
                        tier: 'stable',
                        rows: [{ provider: 'zz-fixture', trace_id: 'z', captured_at: 'not-a-date', model: null, sha256: 'x' }],
                    },
                    drive,
                ),
        },
        {
            name: 'accepts a stable header with a fresh row',
            expect: 'accept',
            run: () => withTree({ tier: 'stable', rows: [_freshRow('zz-fixture', 3)] }, drive),
        },
        {
            name: 'accepts an experimental header with no evidence — the tier claims nothing',
            expect: 'accept',
            run: () => withTree({ tier: 'experimental', rows: [] }, drive),
        },
        {
            name: 'the real tree is green, and its contract block matches',
            expect: 'accept',
            run: () => (contractDrift(repoRoot) === null && check(repoRoot).code === 0 ? 0 : 1),
        },
        {
            name: 'a hand-edited contract table is detected as stale',
            expect: 'reject',
            run: () => {
                const text = fs.readFileSync(path.join(repoRoot, CONTRACT_PATH), 'utf-8');
                const hacked = text.replace(BEGIN_MARKER, `${BEGIN_MARKER}\n| hand | edited | row | here |`);
                return hacked === text || spliceContract(hacked, tierTable(repoRoot)) !== hacked ? 1 : 0;
            },
        },
    ];
    return runSelfTest({
        gate: GATE,
        cases,
        minCases: SELF_TEST_MIN_CASES,
        minRejectCases: SELF_TEST_MIN_REJECT,
    });
}

export function main(argv = process.argv.slice(2)): number {
    if (argv.includes('--self-test') && process.env.GATE_SELF_TEST_CHILD !== '1') return selfTest();
    const quiet = argv.includes('--quiet');
    let root = path.resolve(_HERE, '..', '..', '..');
    const rootIdx = argv.indexOf('--root');
    const rootArg = rootIdx === -1 ? undefined : argv[rootIdx + 1];
    if (rootArg !== undefined) root = path.resolve(rootArg);

    if (argv.includes('--table')) {
        process.stdout.write(`${tierTable(root)}\n`);
        return 0;
    }

    if (argv.includes('--write-contract')) {
        const abs = path.join(root, CONTRACT_PATH);
        const before = fs.readFileSync(abs, 'utf-8');
        const after = spliceContract(before, tierTable(root));
        if (after !== before) fs.writeFileSync(abs, after);
        process.stdout.write(
            after === before
                ? `✅  ${CONTRACT_PATH} § 5 table already current.\n`
                : `✅  ${CONTRACT_PATH} § 5 table regenerated.\n`,
        );
        return 0;
    }

    const res = check(root, { quiet });

    const costIdx = argv.indexOf('--cost-diff');
    const baseRef = costIdx === -1 ? undefined : argv[costIdx + 1];
    if (baseRef !== undefined) {
        for (const w of costDiffWarnings(root, baseRef)) {
            process.stdout.write(`⚠️  ${w}\n`);
        }
    }

    if (res.code === 2) return 2;

    // The contract's generated block is checked on every run, so `DO NOT EDIT
    // BY HAND` is enforced rather than requested.
    const drift = contractDrift(root);
    if (drift !== null) {
        process.stdout.write(`❌  ${drift}\n`);
        process.stdout.write(`    npx tsx src/scripts/lint_adapter_tier.ts --write-contract\n`);
        return 1;
    }

    if (res.findings.length > 0) {
        process.stdout.write('❌  adapter tier claim without reachable evidence:\n\n');
        for (const f of res.findings) {
            process.stdout.write(`  ${f.adapter} — ${f.reason}\n`);
        }
        process.stdout.write(
            `\nThe index is the reviewer-facing evidence surface; the raw traces stay local-only\n` +
                `(council 2026-08-23). Regenerate the index with\n` +
                `  bash src/scripts/ai-video/smoke-trace.sh index\n` +
                `or demote the header. This gate never demotes an adapter for you — a tier is a\n` +
                `maintainer claim, and silently rewriting one would be the drift it exists to stop.\n`,
        );
        return 1;
    }
    if (!quiet) {
        const stable = res.adapters.filter((a) => a.tier === 'stable').length;
        process.stdout.write(
            `✅  ${String(stable)} stable claim(s) resolve to a trace inside ${String(RECHECK_WINDOW_DAYS)} days ` +
                `(${String(res.scanned)} adapter header(s) scanned).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
