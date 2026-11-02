#!/usr/bin/env tsx
/**
 * Report how many acceptance-criterion citations in the test tree resolve to
 * exactly one roadmap anchor (road-to-a-grade-that-saw-the-evidence 2.1,
 * owner decision OQ-63 a).
 *
 * REPORT-ONLY, ON PURPOSE. A ratchet over these counts is council-reserved, so
 * this prints numbers and exits 0 whatever they are. Wiring it into a failing
 * pipeline would be that ratchet by another name.
 *
 * Two citation forms are read:
 *   - explicit `<slug>#AC-n` (an optional directory prefix such as `archive/` is
 *     allowed) — the candidate is that slug alone;
 *   - bare `AC-n` — the candidates are every roadmap slug the same file names.
 * A citation is `resolved` when exactly one candidate roadmap file declares the
 * anchor, `ambiguous` when more than one does, `dangling` when none does. A file
 * takes its worst citation's status (dangling > ambiguous > resolved).
 *
 * An anchor is a roadmap line that OPENS with `AC-n` after an optional list,
 * table, checkbox, heading or bold marker — a definition, not a mention.
 *
 * Usage: ./scripts-run src/scripts/report_acceptance_citations [--root <dir>] [--list] [--json]
 * Exit: 0 a report was printed (any counts) · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const ROADMAPS_REL = 'agents/roadmaps';
const TESTS_REL = 'tests';
const TEST_FILE = /\.(?:test|spec)\.[cm]?[jt]sx?$/;
const SKIP_DIRS = new Set(['node_modules', 'fixtures', '__fixtures__', 'dist']);
const ANCHOR_LINE = /^\s*(?:#{1,6}\s+)?(?:[-*+]\s+|\|\s*)?(?:\[[ xX~-]\]\s*)?(?:\*\*)?AC-(\d+)\b/;
const EXPLICIT = /(?:[a-z0-9_-]+\/)*([a-z0-9][a-z0-9-]*)#AC-(\d+)\b/g;
const BARE = /(?<![#\w-])AC-(\d+)\b/g;
const SLUG_TOKEN = /[a-z0-9][a-z0-9-]*[a-z0-9]/g;

export type Status = 'resolved' | 'ambiguous' | 'dangling';

export interface RoadmapFile {
    rel: string;
    anchors: Set<number>;
}

export interface Citation {
    ac: number;
    form: 'explicit' | 'bare';
    candidates: string[];
    status: Status;
    /** Roadmap files that declare the anchor, among the candidates. */
    hits: string[];
}

export interface FileReport {
    rel: string;
    status: Status;
    citations: Citation[];
}

export interface Report {
    roadmaps: number;
    files: FileReport[];
}

function _walk(abs: string, rel: string, keep: (name: string) => boolean, out: string[]): void {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(abs, { withFileTypes: true });
    } catch {
        return;
    }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) {
            if (!SKIP_DIRS.has(e.name)) _walk(path.join(abs, e.name), r, keep, out);
        } else if (keep(e.name)) {
            out.push(r);
        }
    }
}

/** AC numbers a roadmap declares as anchors. */
export function anchorsOf(text: string): Set<number> {
    const out = new Set<number>();
    for (const line of text.split('\n')) {
        const m = ANCHOR_LINE.exec(line);
        if (m) out.add(Number(m[1]));
    }
    return out;
}

/** Every roadmap in the tree (active, archive, later, stubs, skipped), by slug. */
export function roadmapIndex(root: string): Map<string, RoadmapFile[]> {
    const files: string[] = [];
    _walk(path.join(root, ROADMAPS_REL), ROADMAPS_REL, (n) => n.endsWith('.md') && n !== 'README.md', files);
    const index = new Map<string, RoadmapFile[]>();
    for (const rel of files) {
        const slug = path.basename(rel, '.md');
        const entry = { rel, anchors: anchorsOf(fs.readFileSync(path.join(root, rel), 'utf-8')) };
        index.set(slug, [...(index.get(slug) ?? []), entry]);
    }
    return index;
}

function _resolve(ac: number, form: Citation['form'], candidates: string[], index: Map<string, RoadmapFile[]>): Citation {
    const hits = candidates.flatMap((s) => (index.get(s) ?? []).filter((f) => f.anchors.has(ac)).map((f) => f.rel));
    const status: Status = hits.length === 1 ? 'resolved' : hits.length > 1 ? 'ambiguous' : 'dangling';
    return { ac, form, candidates, status, hits };
}

/** Classify every AC citation in one file's text. */
export function citationsIn(text: string, index: Map<string, RoadmapFile[]>): Citation[] {
    const out: Citation[] = [];
    for (const m of text.matchAll(EXPLICIT)) out.push(_resolve(Number(m[2]), 'explicit', [m[1] as string], index));
    const named = [...new Set([...text.matchAll(SLUG_TOKEN)].map((m) => m[0]).filter((t) => index.has(t)))].sort();
    for (const m of text.matchAll(BARE)) out.push(_resolve(Number(m[1]), 'bare', named, index));
    return out;
}

const _RANK: Record<Status, number> = { resolved: 0, ambiguous: 1, dangling: 2 };

export function buildReport(root: string): Report {
    const index = roadmapIndex(root);
    const tests: string[] = [];
    _walk(path.join(root, TESTS_REL), TESTS_REL, (n) => TEST_FILE.test(n), tests);
    const files: FileReport[] = [];
    for (const rel of tests) {
        const citations = citationsIn(fs.readFileSync(path.join(root, rel), 'utf-8'), index);
        if (citations.length === 0) continue;
        const worst = citations.reduce<Status>((w, c) => (_RANK[c.status] > _RANK[w] ? c.status : w), 'resolved');
        files.push({ rel, status: worst, citations });
    }
    return { roadmaps: [...index.values()].reduce((n, v) => n + v.length, 0), files };
}

function _count<T>(xs: T[], f: (x: T) => Status): Record<Status, number> {
    const out: Record<Status, number> = { resolved: 0, ambiguous: 0, dangling: 0 };
    for (const x of xs) out[f(x)] += 1;
    return out;
}

export function renderReport(r: Report, list: boolean): string {
    const byFile = _count(r.files, (f) => f.status);
    const all = r.files.flatMap((f) => f.citations);
    const byCite = _count(all, (c) => c.status);
    const lines = [
        `acceptance citations (report-only, no ratchet) — ${r.roadmaps} roadmap file(s) indexed`,
        `test files citing AC-n: ${r.files.length}`,
        `  files    resolved ${byFile.resolved} · ambiguous ${byFile.ambiguous} · dangling ${byFile.dangling}`,
        `  citations resolved ${byCite.resolved} · ambiguous ${byCite.ambiguous} · dangling ${byCite.dangling} (of ${all.length}; explicit <slug>#AC-n: ${all.filter((c) => c.form === 'explicit').length})`,
    ];
    if (list) {
        for (const f of r.files) {
            const bad = f.citations.find((c) => c.status === f.status);
            const why = f.status === 'resolved' ? '' : ` — AC-${bad?.ac} among [${bad?.candidates.join(', ') || 'no roadmap named'}]`;
            lines.push(`${f.status.padEnd(9)} ${f.rel}${why}`);
        }
    }
    return lines.join('\n');
}

export function main(argv: readonly string[]): number {
    let root = REPO_ROOT;
    let list = false;
    let json = false;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--list') list = true;
        else if (a === '--json') json = true;
        else if (a === '--root' && argv[i + 1] !== undefined) root = path.resolve(argv[++i] as string);
        else {
            process.stderr.write(`report_acceptance_citations: unknown argument ${a}\n`);
            return 2;
        }
    }
    const r = buildReport(root);
    process.stdout.write(`${json ? JSON.stringify(r, null, 2) : renderReport(r, list)}\n`);
    return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
