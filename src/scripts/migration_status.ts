#!/usr/bin/env tsx
/**
 * migration_status.ts — Python→TypeScript migration dashboard.
 *
 * Phase 1 Step 13 of `agents/roadmaps/road-to-typescript-only-scripts.md`.
 *
 * Counts the remaining tracked `.py` files (via `git ls-files '*.py'`),
 * buckets them into the roadmap's migration categories, compares each
 * bucket against the hardcoded Phase-1 baseline, and emits a markdown
 * dashboard (default: `agents/evidence/migration-status.md`).
 *
 * Usage:
 *   npx tsx src/scripts/migration_status.ts [--out <path>]
 *
 * Node builtins only — no third-party imports.
 */

import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// ---------------------------------------------------------------------------
// Categories and phase mapping
// ---------------------------------------------------------------------------

export type Category =
    | 'libs'
    | 'installer'
    | 'linters'
    | 'pipeline'
    | 'hooks'
    | 'memory-telemetry'
    | 'misc'
    | 'consumer-templates'
    | 'council'
    | 'parity'
    | 'tests';

/** Roadmap phase that owns each category (road-to-typescript-only-scripts.md). */
const PHASE_BY_CATEGORY: Readonly<Record<Category, string>> = {
    parity: '1',
    libs: '2',
    installer: '3+11',
    linters: '4',
    pipeline: '5',
    hooks: '6',
    'memory-telemetry': '7',
    misc: '8',
    'consumer-templates': '9',
    council: '10',
    tests: '12',
};

/** Render order — by owning phase. */
export const CATEGORY_ORDER: readonly Category[] = [
    'parity',
    'libs',
    'installer',
    'linters',
    'pipeline',
    'hooks',
    'memory-telemetry',
    'misc',
    'consumer-templates',
    'council',
    'tests',
];

/**
 * Baseline `.py` counts captured at Phase 1 (2026-06-11, branch
 * feat/py2ts-phase1-infra). Hardcoded on purpose: the dashboard measures
 * progress against this fixed snapshot, not against a moving target.
 * Total: 955 tracked `.py` files after exclusions (1062 before — the
 * delta is the generated `dist/` mirror).
 */
const BASELINE: Readonly<Record<Category, number>> = {
    parity: 0,
    libs: 29,
    installer: 1,
    linters: 109,
    pipeline: 7,
    hooks: 14,
    'memory-telemetry': 9,
    misc: 222,
    'consumer-templates': 99,
    council: 51,
    tests: 414,
};

/**
 * Path prefixes excluded from the count (gitignore-style; `dist/` is
 * tracked but generated, so it is excluded explicitly).
 */
const EXCLUDED_PREFIXES: readonly string[] = [
    'node_modules/',
    '.venv',
    'dist/',
    '.claude/',
    '.augment/',
    'internal/bench/',
    'tmp/',
    '.tmp/',
];

// ---------------------------------------------------------------------------
// Categorization
// ---------------------------------------------------------------------------

const SCRIPTS_ROOT_HOOK = /^src\/scripts\/[^/]*_hook\.py$/;

const PIPELINE_BASENAMES = new Set([
    'condense.py',
    'update_counts.py',
    'build_discovery_manifest.py',
]);

export function categorize(path: string): Category {
    if (path.startsWith('src/scripts/_lib/')) return 'libs';
    if (path.startsWith('src/scripts/ai_council/') || path === 'src/scripts/council_cli.py') {
        return 'council';
    }
    if (path.startsWith('src/scripts/hooks/') || SCRIPTS_ROOT_HOOK.test(path)) return 'hooks';
    if (path.startsWith('src/scripts/parity/')) return 'parity';
    if (path === 'src/scripts/install.py') return 'installer';

    const isScriptsRootFile = path.startsWith('src/scripts/') && path.split('/').length === 3;
    if (isScriptsRootFile) {
        const base = path.slice(path.lastIndexOf('/') + 1);
        if (
            base.startsWith('check_') ||
            base.startsWith('lint_') ||
            base.startsWith('validate_') ||
            base === 'skill_linter.py'
        ) {
            return 'linters';
        }
        if (base.startsWith('sync_') || PIPELINE_BASENAMES.has(base)) return 'pipeline';
        if (base.startsWith('memory_') || base.includes('telemetry')) return 'memory-telemetry';
    }

    if (path.startsWith('src/agent-src/templates/scripts/')) return 'consumer-templates';
    if (path.startsWith('tests/')) return 'tests';
    return 'misc';
}

// ---------------------------------------------------------------------------
// Data collection
// ---------------------------------------------------------------------------

function git(args: readonly string[], cwd: string): string {
    return execFileSync('git', [...args], { cwd, encoding: 'utf-8' }).trim();
}

export function repoRoot(): string {
    return git(['rev-parse', '--show-toplevel'], process.cwd());
}

export function trackedPythonFiles(root: string): string[] {
    const raw = git(['ls-files', '*.py'], root);
    if (raw === '') return [];
    return raw
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
        .filter((line) => !EXCLUDED_PREFIXES.some((prefix) => line.startsWith(prefix)));
}

function countByCategory(paths: readonly string[]): Record<Category, number> {
    const counts = Object.fromEntries(
        CATEGORY_ORDER.map((category) => [category, 0]),
    ) as Record<Category, number>;
    for (const path of paths) {
        counts[categorize(path)] += 1;
    }
    return counts;
}

/** Count divergence records: `.md` in docs/migration/divergences/, minus README/_template. */
function countDivergences(root: string): number {
    let entries: string[];
    try {
        entries = readdirSync(resolve(root, 'docs/migration/divergences'));
    } catch {
        return 0;
    }
    return entries.filter(
        (name) =>
            name.endsWith('.md') && name !== 'README.md' && !name.startsWith('_template'),
    ).length;
}

/** Commits on origin/main not yet on HEAD — "n/a" when the ref is unavailable. */
function syncLag(root: string): string {
    try {
        return git(['rev-list', '--count', 'HEAD..origin/main'], root);
    } catch {
        return 'n/a';
    }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function percentDone(remaining: number, baseline: number): string {
    if (baseline === 0) return '—';
    const done = ((baseline - remaining) / baseline) * 100;
    return `${done.toFixed(1)}%`;
}

function renderDashboard(
    counts: Readonly<Record<Category, number>>,
    divergences: number,
    lag: string,
    timestamp: string,
): string {
    const lines: string[] = [];
    lines.push('# Python → TypeScript Migration Status');
    lines.push('');
    lines.push(
        `> Generated by \`src/scripts/migration_status.ts\` — do not edit by hand. Timestamp: ${timestamp}`,
    );
    lines.push('');
    lines.push(
        'Tracks remaining tracked `.py` files per roadmap phase of ' +
            '`agents/roadmaps/road-to-typescript-only-scripts.md`. ' +
            'Baseline = Phase 1 snapshot (hardcoded in the script).',
    );
    lines.push('');
    lines.push('| Phase | Category | Remaining .py | Baseline .py | % done |');
    lines.push('|---|---|---:|---:|---:|');

    let remainingTotal = 0;
    let baselineTotal = 0;
    for (const category of CATEGORY_ORDER) {
        const remaining = counts[category];
        const baseline = BASELINE[category];
        remainingTotal += remaining;
        baselineTotal += baseline;
        lines.push(
            `| ${PHASE_BY_CATEGORY[category]} | ${category} | ${remaining} | ${baseline} | ${percentDone(remaining, baseline)} |`,
        );
    }
    lines.push(
        `| — | **total** | **${remainingTotal}** | **${baselineTotal}** | **${percentDone(remainingTotal, baselineTotal)}** |`,
    );
    lines.push('');
    lines.push('## Signals');
    lines.push('');
    lines.push(`- Open divergences (\`docs/migration/divergences/\`): ${divergences}`);
    lines.push(`- python2ts sync lag vs origin/main: ${lag}`);
    lines.push('');
    return lines.join('\n');
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseOutPath(argv: readonly string[]): string {
    const defaultOut = 'agents/evidence/migration-status.md';
    const flagIndex = argv.indexOf('--out');
    if (flagIndex === -1) {
        const inline = argv.find((arg) => arg.startsWith('--out='));
        return inline !== undefined ? inline.slice('--out='.length) : defaultOut;
    }
    const value = argv[flagIndex + 1];
    if (value === undefined || value.startsWith('--')) {
        throw new Error('--out requires a path argument');
    }
    return value;
}

function main(): void {
    const root = repoRoot();
    const outPath = resolve(root, parseOutPath(process.argv.slice(2)));

    const pyFiles = trackedPythonFiles(root);
    const counts = countByCategory(pyFiles);
    const divergences = countDivergences(root);
    const lag = syncLag(root);
    const timestamp = new Date().toISOString();

    const markdown = renderDashboard(counts, divergences, lag, timestamp);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, markdown, 'utf-8');

    process.stdout.write(`Wrote ${outPath}\n`);
    process.stdout.write(`Tracked .py after exclusions: ${pyFiles.length}\n`);
}

// Run the CLI only when executed directly (`npx tsx src/scripts/migration_status.ts`),
// not when imported (e.g. by src/scripts/parity/phase_gate.ts for `categorize`).
const isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isCliEntry) {
    main();
}
