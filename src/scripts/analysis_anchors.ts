/**
 * analysis_anchors.ts — the anchor table of the analysis doors for any project
 * (step 4.3, ADR-288): what the scope already says is wrong or wanted, read in
 * a fixed order, each row typed so an opportunity is never presented as a
 * defect.
 *
 * Order: skipped tests, open issues (passed in; the door reads them with `gh`
 * when present), the FIXME/TODO census, open roadmap steps, ADRs, then
 * `docs/CLAIMS.md`. A scope carrying `docs/CLAIMS.md` keeps this package's own
 * profile (the door's § 1b). No row at all → feature mode, anchored on
 * `--goal`; without one the door has to ask for it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

export const ANCHOR_TYPES = [
    'defect',
    'capability_gap',
    'product_opportunity',
    'maintainability',
    'security',
    'performance',
] as const;
export type AnchorType = (typeof ANCHOR_TYPES)[number];

export const SOURCE_ORDER = ['skipped-tests', 'issues', 'todo-fixme', 'roadmaps', 'adrs', 'claims'] as const;
export const MAX_ROWS_PER_SOURCE = 50;

export interface AnchorRow {
    type: AnchorType;
    source: 'skipped-test' | 'issue' | 'fixme' | 'todo' | 'roadmap' | 'goal';
    anchor: string;
    text: string;
}

export interface Issue {
    number: number;
    title: string;
    labels: string[];
}

export interface AnchorTable {
    profile: 'package' | 'consumer';
    mode: 'anchored' | 'feature' | 'feature-needs-goal';
    rows: AnchorRow[];
    sources_read: string[];
    /** ADR files present — decisions the rows must not contradict, never rows themselves. */
    adrs: number;
}

const SKIP_DIRS = new Set(['node_modules', 'vendor', 'dist', 'build', 'coverage', 'target', 'out']);
const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|php|rb|go|rs|java|kt|swift|cs|c|h|cpp|vue|svelte|sh)$/;
const TEST_FILE = /(\.|_)(test|spec)\.[a-z]+$|^test_.*\.py$|Test\.php$/;
const SKIPPED = /\b(?:it|test|describe)\.skip\(|\bxit\(|@pytest\.mark\.skip|markTestSkipped\(|\bt\.Skip\(/;
const MARKER = /\b(FIXME|TODO)\b[:(]?\s*(.*)$/;

/** Every non-hidden file under `root`, relative and sorted, skipping build and dependency trees. */
export function walk(root: string, rel = ''): string[] {
    const out: string[] = [];
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        const r = rel === '' ? entry.name : `${rel}/${entry.name}`;
        if (entry.isDirectory()) out.push(...walk(root, r));
        else if (entry.isFile()) out.push(r);
    }
    return out;
}

function lines(root: string, rel: string): string[] {
    return fs.readFileSync(path.join(root, rel), 'utf8').split('\n');
}

export function typeIssue(labels: readonly string[]): AnchorType {
    const l = labels.map((x) => x.toLowerCase());
    if (l.some((x) => x.includes('security'))) return 'security';
    if (l.some((x) => x === 'bug' || x.includes('defect') || x.includes('regression'))) return 'defect';
    if (l.some((x) => x.includes('perf'))) return 'performance';
    if (l.some((x) => x.includes('debt') || x.includes('refactor') || x.includes('cleanup'))) return 'maintainability';
    return 'product_opportunity';
}

export function buildAnchorTable(input: { root: string; goal?: string; issues?: readonly Issue[] }): AnchorTable {
    const { root } = input;
    const files = walk(root);
    const code = files.filter((f) => TEXT_EXT.test(f));
    const cap = (rows: AnchorRow[]): AnchorRow[] => rows.slice(0, MAX_ROWS_PER_SOURCE);

    const skipped: AnchorRow[] = [];
    for (const f of code.filter((x) => TEST_FILE.test(path.basename(x)) || x.split('/').includes('tests'))) {
        lines(root, f).forEach((line, i) => {
            if (SKIPPED.test(line)) skipped.push({ type: 'defect', source: 'skipped-test', anchor: `${f}:${String(i + 1)}`, text: line.trim() });
        });
    }

    const issues: AnchorRow[] = (input.issues ?? []).map((i) => ({
        type: typeIssue(i.labels),
        source: 'issue',
        anchor: `#${String(i.number)}`,
        text: i.title,
    }));

    const markers: AnchorRow[] = [];
    for (const f of code) {
        lines(root, f).forEach((line, i) => {
            const m = MARKER.exec(line);
            if (m === null) return;
            const fixme = m[1] === 'FIXME';
            markers.push({
                type: fixme ? 'defect' : 'maintainability',
                source: fixme ? 'fixme' : 'todo',
                anchor: `${f}:${String(i + 1)}`,
                text: (m[2] ?? '').trim(),
            });
        });
    }

    const roadmaps: AnchorRow[] = [];
    for (const f of files.filter((x) => /^agents\/roadmaps\/[^/]+\.md$/.test(x))) {
        lines(root, f).forEach((line, i) => {
            if (/^- \[ \] /.test(line)) {
                roadmaps.push({ type: 'capability_gap', source: 'roadmap', anchor: `${f}:${String(i + 1)}`, text: line.slice(6).trim() });
            }
        });
    }

    const adrs = files.filter((x) => /^docs\/(decisions|adrs?)\/.+\.md$/.test(x) && !/(INDEX|README)\.md$/.test(x)).length;
    const profile = fs.existsSync(path.join(root, 'docs/CLAIMS.md')) ? 'package' : 'consumer';
    const rows = [...cap(skipped), ...cap(issues), ...cap(markers), ...cap(roadmaps)];

    if (rows.length > 0) return { profile, mode: 'anchored', rows, sources_read: [...SOURCE_ORDER], adrs };
    const goal = input.goal?.trim();
    if (goal === undefined || goal === '') return { profile, mode: 'feature-needs-goal', rows: [], sources_read: [...SOURCE_ORDER], adrs };
    return {
        profile,
        mode: 'feature',
        rows: [{ type: 'product_opportunity', source: 'goal', anchor: '--goal', text: goal }],
        sources_read: [...SOURCE_ORDER],
        adrs,
    };
}
