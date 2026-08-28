#!/usr/bin/env tsx
/**
 * No cost surface built by `road-to-delivered-cost-truth` prints a currency
 * figure or a per-token rate (AC-7).
 *
 * WHY THIS IS A GATE AND NOT A CONVENTION
 * ---------------------------------------
 * The suite does not know a consumer's contract — subscription, per-token,
 * committed spend, a reseller rate — so any monetary figure it printed would be
 * extrapolated from a rate it invented. That is worse than no number, because it
 * is actionable and wrong, and it is exactly the kind of thing that gets added
 * back later by someone who reasonably thinks a cost report should show cost.
 *
 * SCOPE IS A NAMED LIST, NOT A PATTERN. The gate guards the surfaces this
 * roadmap built, and nothing else: `cache_realization_report` legitimately
 * carries a `cost_usd` block for back-compat with downstream consumers, and a
 * gate that swept `src/scripts/*cost*` would fail on it and be neutered with an
 * allowlist within a release.
 *
 * Exit codes: 0 clean · 1 a currency marker on a guarded surface · 2 misuse.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_no_currency_in_cost_surfaces [--root <dir>] [--quiet]
 *   ./scripts-run src/scripts/check_no_currency_in_cost_surfaces --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { CURRENCY_MARKERS } from './_lib/config_cost.js';
import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertWatchlistResolves, DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const REPO_ROOT = path.resolve(HERE, '..', '..');

/** The surfaces this roadmap built. A named list, deliberately. */
export const GUARDED_SURFACES: readonly string[] = [
    'src/scripts/config_cost_report.ts',
    'src/scripts/asset_delivery_ledger.ts',
    'src/scripts/_lib/config_cost.ts',
    'src/scripts/_lib/asset_delivery_ledger.ts',
];

/**
 * Lines that may name a marker without printing one.
 *
 * A gate over currency SYMBOLS cannot read intent, and every guarded file has to
 * be able to explain the ban — including `CURRENCY_MARKERS` itself, which is a
 * list of the very strings being banned. Comments and the marker declaration are
 * therefore out of scope, and the discriminator is whether the string can reach
 * a rendered line.
 */
function isExempt(line: string): boolean {
    const t = line.trim();
    return t.startsWith('*') || t.startsWith('//') || t.startsWith('/*') || t.includes('CURRENCY_MARKERS');
}

/**
 * Source-level patterns, derived from {@link CURRENCY_MARKERS} with ONE
 * exception that the self-test found and that matters more than it looks.
 *
 * A bare `$` substring matches TEMPLATE-LITERAL INTERPOLATION — `${value}` — so
 * the first cut of this gate flagged every interpolated line in every guarded
 * file, including its own ledger renderer. A gate whose first real run produces
 * dozens of false positives gets an allowlist within a release, and then it
 * guards nothing.
 *
 * Excluding `${` alone was not enough — a REGEX ANCHOR is also a bare `$`, and
 * the second run flagged `/\.md$/`. Both false positives share a shape: `$`
 * appears constantly in TypeScript for reasons that have nothing to do with
 * money.
 *
 * So the pattern is positive rather than subtractive: a currency `$` is followed
 * by a DIGIT (`$42`) or by an interpolated amount (`$${n}`). Anchors, plain
 * interpolation and `$` inside identifiers all fall outside it. Both directions
 * are pinned by self-test cases — a rejecting `$${n}` and an accepting anchor —
 * because a positive pattern that is too narrow fails silently.
 *
 * The companion `isCurrencyFree` keeps plain substring matching, correctly: it
 * reads RENDERED output, where no template or regex syntax survives and a `$` is
 * a dollar sign.
 */
export const SOURCE_PATTERNS: ReadonlyArray<{ marker: string; re: RegExp }> = CURRENCY_MARKERS.map((m) => ({
    marker: m,
    re: m === '$' ? /\$(?=\d|\$\{)/ : new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
}));

export interface Finding {
    file: string;
    line: number;
    marker: string;
    text: string;
}

export function scanFile(source: string, rel: string): Finding[] {
    const out: Finding[] = [];
    source.split('\n').forEach((line, i) => {
        if (isExempt(line)) return;
        for (const p of SOURCE_PATTERNS) {
            if (p.re.test(line)) out.push({ file: rel, line: i + 1, marker: p.marker, text: line.trim().slice(0, 100) });
        }
    });
    return out;
}

export function evaluate(root: string = REPO_ROOT, ledger?: GateLedger): { scanned: number; findings: Finding[] } {
    const findings: Finding[] = [];
    let scanned = 0;
    ledger?.plan(GUARDED_SURFACES);
    for (const rel of GUARDED_SURFACES) {
        const abs = path.join(root, rel);
        if (!fs.existsSync(abs)) {
            ledger?.skip(rel, 'no_applicable_files');
            continue;
        }
        scanned += 1;
        const hits = scanFile(fs.readFileSync(abs, 'utf-8'), rel);
        findings.push(...hits);
        if (hits.length > 0) ledger?.fail(rel, `${String(hits.length)} currency marker(s)`);
        else ledger?.complete(rel);
    }
    return { scanned, findings };
}

// ---------------------------------------------------------------- self-test

function selfTestCases(): SelfTestCase[] {
    const mk = (name: string, expect: 'reject' | 'accept', body: string): SelfTestCase => ({
        name,
        expect,
        run: () => {
            const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cur-'));
            try {
                fs.mkdirSync(path.join(dir, 'src', 'scripts', '_lib'), { recursive: true });
                for (const rel of GUARDED_SURFACES) fs.writeFileSync(path.join(dir, rel), body);
                return runGateCli(REPO_ROOT, 'src/scripts/check_no_currency_in_cost_surfaces.ts', ['--root', dir, '--quiet'], REPO_ROOT);
            } finally {
                fs.rmSync(dir, { recursive: true, force: true });
            }
        },
    });
    return [
        mk('a dollar figure in rendered output → reject', 'reject', `out.push(\`cost: $\${n}\`);\n`),
        mk('a euro figure → reject', 'reject', `out.push(\`Kosten: €\${n}\`);\n`),
        mk('a per-token rate → reject', 'reject', `out.push('rate: 3.00 per token');\n`),
        mk('a USD label → reject', 'reject', `out.push('total USD');\n`),
        mk('tokens only → accept', 'accept', `out.push(\`\${n} tok\`);\n`),
        // Both false positives the first two runs produced, pinned so a future
        // widening of the pattern cannot reintroduce them silently.
        mk('a regex end anchor is not a dollar sign → accept', 'accept', `const x = /\\.md$/.test(name);\n`),
        mk('plain interpolation is not a dollar sign → accept', 'accept', 'out.push(`${a} of ${b}`);\n'),
        mk('a comment explaining the ban → accept', 'accept', `// never print $ or EUR here\nout.push('tok');\n`),
        mk('the marker declaration itself → accept', 'accept', `export const CURRENCY_MARKERS = ['$', 'EUR'] as const;\n`),
    ];
}

// ---------------------------------------------------------------------- CLI

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) {
        return runSelfTest({ gate: 'check_no_currency_in_cost_surfaces', cases: selfTestCases(), minCases: 8, minRejectCases: 4 });
    }
    const quiet = argv.includes('--quiet');
    const ri = argv.indexOf('--root');
    const rootArg = ri !== -1 ? argv[ri + 1] : undefined;
    const root = rootArg !== undefined ? path.resolve(rootArg) : REPO_ROOT;

    const ledger = new GateLedger('check_no_currency_in_cost_surfaces');
    let v: { scanned: number; findings: Finding[] };
    try {
        v = evaluate(root, ledger);
    } catch (err) {
        process.stderr.write(`❌  check_no_currency_in_cost_surfaces: ${(err as Error).message}\n`);
        return 2;
    }

    try {
        // Watchlist-driven: the corpus is a named list of files, not a tree walk,
        // so an empty scan means the watchlist stopped resolving — which is a
        // dead scope, not a clean run.
        assertWatchlistResolves({
            gate: 'check_no_currency_in_cost_surfaces',
            candidates: GUARDED_SURFACES,
            repoRoot: root,
        });
        reportScanned({
            gate: 'check_no_currency_in_cost_surfaces',
            scanned: v.scanned,
            units: 'guarded cost surface(s)',
            roots: GUARDED_SURFACES,
            allowEmpty: 'WATCHLIST_DRIVEN: the corpus is the named surface list above, asserted by assertWatchlistResolves',
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  check_no_currency_in_cost_surfaces: ${err.message}\n`);
            return 2;
        }
        throw err;
    }
    ledger.report();

    if (v.findings.length > 0) {
        for (const f of v.findings) {
            process.stderr.write(`❌  ${f.file}:${String(f.line)} renders '${f.marker}':\n      ${f.text}\n`);
        }
        process.stderr.write(
            '\n    A cost surface here reports TOKENS. The suite does not know the consumer\'s\n' +
                '    contract, so a monetary figure would be extrapolated from a rate it invented —\n' +
                '    actionable and wrong, which is worse than absent.\n',
        );
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`✅  no currency figure or per-token rate on any cost surface (${String(v.scanned)} file(s)).\n`);
    }
    return 0;
}

if (process.env['GATE_SELF_TEST_CHILD'] !== '1' || process.argv.includes('--root')) {
    if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
        process.exit(main());
    }
}
