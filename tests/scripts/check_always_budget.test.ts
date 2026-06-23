// Tests for src/scripts/check_always_budget.ts (py2ts Phase 4 / Wave 4a).
//
// Two layers:
//   1. A 1:1 port of tests/test_always_budget.py — the F1.5 CI guard on the
//      `type: "always"` rule extended budget. The pytest suite recomputes
//      extended size with its own helpers; this port mirrors that logic so
//      the TS twin and the test stay in lock-step exactly as the Python pair
//      did.
//   2. Golden parity — python3 vs tsx of the CLI on the REAL REPO in
//      --no-trend modes (the trend log is a side effect; --no-trend keeps the
//      run pure), asserting byte-identical stdout + stderr + exit code.
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const REPO_ROOT = resolve(import.meta.dirname, '..', '..');
const RULES_DIR = join(REPO_ROOT, 'dist/agent-src', 'rules');
const SRC_PREFIX = '.agent-src.uncondensed/';
const COMP_PREFIX = 'dist/agent-src/';

const TOTAL_CAP = 49_000;
const TOLERANCE_BAND = 0.02;
const FAIL_THRESHOLD = 0.9;
const PER_RULE_CAP = 6_000;
const TOP3_CAP = Math.trunc(TOTAL_CAP / 2);
const TOP5_CEILING = 33_313;
const MAX_DEPTH = 2;
const RECOVERY_BAND_ENABLED = true;
const BASELINE_FILE = join(REPO_ROOT, '.github', 'budget-baseline.txt');

const KNOWN_PER_RULE_BREACHES: Record<string, number> = {
    'non-destructive-by-default.md': 7_908,
    'scope-control.md': 8_550,
};

// --- helpers mirroring tests/test_always_budget.py ---------------------------

function loadBaseline(): number | null {
    if (!existsSync(BASELINE_FILE)) return null;
    for (let line of readFileSync(BASELINE_FILE, 'utf-8').split('\n')) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        return /^[+-]?\d+$/.test(line) ? Number.parseInt(line, 10) : null;
    }
    return null;
}

function frontmatter(p: string): Record<string, unknown> {
    const text = readFileSync(p, 'utf-8');
    if (!text.startsWith('---\n')) return {};
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return {};
    try {
        const parsed = YAML.parse(text.slice(4, end));
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function isAlways(p: string): boolean {
    return frontmatter(p)['type'] === 'always';
}

function loadContextPaths(p: string): string[] {
    const fm = frontmatter(p);
    const out: string[] = [];
    for (const key of ['load_context', 'load_context_eager']) {
        const list = fm[key];
        if (Array.isArray(list)) for (const e of list) out.push(String(e));
    }
    return out;
}

function srcToCondensed(entry: string): string {
    if (entry.startsWith(SRC_PREFIX)) {
        return join(REPO_ROOT, COMP_PREFIX + entry.slice(SRC_PREFIX.length));
    }
    return join(REPO_ROOT, entry);
}

function walkContexts(rule: string): [Set<string>, Array<[string, string]>] {
    const seen = new Set<string>();
    const violations: Array<[string, string]> = [];
    const name = basename(rule);
    const stack: Array<[string, number, string]> = [[rule, 0, name]];
    while (stack.length > 0) {
        const [node, depth, chain] = stack.pop() as [string, number, string];
        for (const entry of loadContextPaths(node)) {
            const comp = srcToCondensed(entry);
            const newChain = `${chain} → ${entry}`;
            if (depth + 1 > MAX_DEPTH) {
                violations.push([name, newChain]);
                continue;
            }
            if (!existsSync(comp) || seen.has(comp)) continue;
            seen.add(comp);
            stack.push([comp, depth + 1, newChain]);
        }
    }
    return [seen, violations];
}

function mdFiles(): string[] {
    return readdirSync(RULES_DIR)
        .filter((n) => n.endsWith('.md'))
        .map((n) => join(RULES_DIR, n));
}

function alwaysRules(): string[] {
    return mdFiles()
        .filter((p) => isAlways(p))
        .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

function extendedSize(rule: string): number {
    const [contexts] = walkContexts(rule);
    let total = statSize(rule);
    for (const c of contexts) total += statSize(c);
    return total;
}

function statSize(p: string): number {
    return statSync(p).size;
}

// --- ported pytest suite (1:1 with tests/test_always_budget.py) --------------

describe('test_always_budget (port of tests/test_always_budget.py)', () => {
    it('test_always_rules_total_extended_within_tolerance', () => {
        const rules = alwaysRules();
        const sizes = rules.map((r): [string, number] => [basename(r), extendedSize(r)]);
        const total = sizes.reduce((s, [, v]) => s + v, 0);
        const upper = Math.trunc(TOTAL_CAP * (1 + TOLERANCE_BAND));
        const detail = [...sizes]
            .sort((a, b) => b[1] - a[1])
            .map(([n, s]) => `  ${n}: ${s}`)
            .join('\n');
        expect(
            total,
            `always-rule extended budget breach beyond G3 tolerance: ` +
                `${total} > ${upper} chars (cap ${TOTAL_CAP}, tolerance ` +
                `${(TOLERANCE_BAND * 100).toFixed(0)}%) across ${rules.length} rules.\n${detail}`,
        ).toBeLessThanOrEqual(upper);
    });

    it('test_recovery_band_invariant', () => {
        if (!RECOVERY_BAND_ENABLED) return; // pytest.skip
        const total = alwaysRules().reduce((s, r) => s + extendedSize(r), 0);
        const pct = total / TOTAL_CAP;
        if (pct < FAIL_THRESHOLD || pct >= 1.0) return;
        const baseline = loadBaseline();
        expect(baseline, 'recovery band engaged but no baseline file').not.toBeNull();
        expect(total).toBeLessThan(baseline as number);
    });

    it('test_no_unallowlisted_per_rule_breach', () => {
        const over: Array<[string, number]> = [];
        for (const r of alwaysRules()) {
            const ext = extendedSize(r);
            if (ext <= PER_RULE_CAP) continue;
            if (!(basename(r) in KNOWN_PER_RULE_BREACHES)) over.push([basename(r), ext]);
        }
        expect(
            over,
            `per-rule extended cap breach (> ${PER_RULE_CAP} chars, not allowlisted): ` +
                over.map(([n, s]) => `${n}=${s}`).join(', '),
        ).toHaveLength(0);
    });

    it('test_allowlisted_breaches_do_not_grow', () => {
        const grew: Array<[string, number, number]> = [];
        for (const r of alwaysRules()) {
            const ceiling = KNOWN_PER_RULE_BREACHES[basename(r)];
            if (ceiling === undefined) continue;
            const ext = extendedSize(r);
            if (ext > ceiling) grew.push([basename(r), ext, ceiling]);
        }
        expect(
            grew,
            'allowlisted per-rule breach grew above its recorded ceiling: ' +
                grew.map(([n, ext, c]) => `${n}=${ext} > ${c}`).join(', '),
        ).toHaveLength(0);
    });

    it('test_top3_extended_under_cap', () => {
        const sizes = alwaysRules()
            .map((r) => extendedSize(r))
            .sort((a, b) => b - a);
        const top3 = sizes.slice(0, 3).reduce((s, v) => s + v, 0);
        expect(
            top3,
            `top-3 always-rule extended cap breach: ${top3} > ${TOP3_CAP} chars`,
        ).toBeLessThanOrEqual(TOP3_CAP);
    });

    it('test_top5_extended_under_ceiling', () => {
        const sizes = alwaysRules()
            .map((r) => extendedSize(r))
            .sort((a, b) => b - a);
        const top5 = sizes.slice(0, 5).reduce((s, v) => s + v, 0);
        expect(
            top5,
            `top-5 always-rule extended ceiling breach: ${top5} > ${TOP5_CEILING} chars`,
        ).toBeLessThanOrEqual(TOP5_CEILING);
    });

    it('test_load_context_depth_within_cap', () => {
        const violations: Array<[string, string]> = [];
        for (const r of alwaysRules()) {
            const [, v] = walkContexts(r);
            violations.push(...v);
        }
        expect(
            violations,
            `load_context: chain exceeds depth-${MAX_DEPTH} cap:\n` +
                violations.map(([n, c]) => `  ${n}: ${c}`).join('\n'),
        ).toHaveLength(0);
    });
});

// --- golden CLI parity -------------------------------------------------------

const TSX_BIN = join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);
const TS = join(REPO_ROOT, 'src', 'scripts', 'check_always_budget.ts');

interface RunResult {
    status: number | null;
    stdout: string;
    stderr: string;
}

function run(bin: string, scriptArgs: readonly string[]): RunResult {
    const r = spawnSync(bin, scriptArgs, { cwd: REPO_ROOT, encoding: 'utf8' });
    return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}
