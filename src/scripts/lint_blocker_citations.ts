#!/usr/bin/env tsx
/**
 * Every `path:line` a roadmap blocker cites must still point at a line.
 *
 * A blocker's `What to do` and `Resolved when` lean on citations like
 * `src/scripts/foo.ts:120-134`. Line numbers move with every edit above them,
 * and nothing re-reads a citation once it is written — `check_references`
 * resolves names, not line numbers. A cited range that now runs past the end
 * of its file sends the reader of the blocker to nothing.
 *
 * Scope: the `## Blockers` section of every active roadmap and every stub.
 * Checked: the file exists and the last cited line is within its length.
 * Not checked: what the line says — a content check would red on every
 * harmless edit above it.
 *
 * A citation is a repository-relative path with a file extension, `:`, a line
 * number and an optional `-<line>` end. A bare `:354-359` with no path is
 * relative to prose above it and is not read.
 *
 * Existing misses are ratcheted (`gate-violation-baselines.json`, gate
 * `lint_blocker_citations`): line numbers drift, so a miss already in the tree
 * is drift rather than a new defect, and the count may only fall.
 *
 * Exit codes: 0 within the ratchet · 1 above it · 2 usage error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { checkRatchet } from './_lib/gate_baseline.js';
import { reportScanned } from './_lib/scan_scope.js';

type MissKind = 'missing-file' | 'beyond-end';

interface Citation {
    roadmap: string;
    line: number;
    target: string;
    first: number;
    last: number;
}

interface Miss extends Citation {
    kind: MissKind;
    length: number | null;
}

const BLOCKERS_SECTION_RE = /^##[ \t]+Blockers[ \t]*$/im;
const NEXT_H2_RE = /^##[ \t]+\S/m;
const CITATION_RE = /(?<![\w./:-])((?:[\w.-]+\/)*[\w-][\w.-]*\.[A-Za-z0-9]+):(\d+)(?:-(\d+))?(?!\d)/g;

/** Citations inside the `## Blockers` section, with their line in the roadmap. */
function citationsIn(text: string, roadmap: string): Citation[] {
    const m = BLOCKERS_SECTION_RE.exec(text);
    if (!m) {
        return [];
    }
    const start = m.index + m[0].length;
    const rest = text.slice(start);
    const h2 = NEXT_H2_RE.exec(rest);
    const section = h2 ? rest.slice(0, h2.index) : rest;
    const lineOffset = text.slice(0, start).split('\n').length - 1;
    const out: Citation[] = [];
    section.split('\n').forEach((raw, i) => {
        for (const c of raw.matchAll(CITATION_RE)) {
            const first = Number(c[2]);
            const last = c[3] === undefined ? first : Number(c[3]);
            out.push({ roadmap, line: lineOffset + i + 1, target: c[1] as string, first, last });
        }
    });
    return out;
}

/** Line count of the cited file, repo-relative first, then relative to the citing roadmap. */
function _lengthOf(root: string, c: Citation): number | null {
    for (const abs of [path.join(root, c.target), path.join(root, path.dirname(c.roadmap), c.target)]) {
        if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
            return fs.readFileSync(abs, 'utf8').replace(/\n$/, '').split('\n').length;
        }
    }
    return null;
}

function checkCitation(root: string, c: Citation, lengths: Map<string, number | null>): Miss | null {
    const key = `${path.dirname(c.roadmap)}\0${c.target}`;
    let length = lengths.get(key);
    if (length === undefined) {
        length = _lengthOf(root, c);
        lengths.set(key, length);
    }
    if (length === null) {
        return { ...c, kind: 'missing-file', length };
    }
    return Math.max(c.first, c.last) > length ? { ...c, kind: 'beyond-end', length } : null;
}

function roadmapFiles(root: string): string[] {
    const out: string[] = [];
    for (const sub of ['', 'stubs']) {
        const dir = path.join(root, 'agents', 'roadmaps', sub);
        let names: string[];
        try {
            names = fs.readdirSync(dir);
        } catch {
            continue;
        }
        for (const n of names.sort()) {
            const abs = path.join(dir, n);
            if (n.endsWith('.md') && fs.statSync(abs).isFile()) {
                out.push(path.relative(root, abs).split(path.sep).join('/'));
            }
        }
    }
    return out;
}

function scanTree(root: string): { misses: Miss[]; scanned: number; citations: number } {
    const lengths = new Map<string, number | null>();
    const files = roadmapFiles(root);
    const misses: Miss[] = [];
    let citations = 0;
    for (const rel of files) {
        for (const c of citationsIn(fs.readFileSync(path.join(root, rel), 'utf8'), rel)) {
            citations += 1;
            const miss = checkCitation(root, c, lengths);
            if (miss) {
                misses.push(miss);
            }
        }
    }
    return { misses, scanned: files.length, citations };
}

const _DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function main(argv: string[] = process.argv.slice(2)): number {
    let root = _DEFAULT_ROOT;
    let baselineRoot = _DEFAULT_ROOT;
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write('lint_blocker_citations: --root requires a value\n');
                return 2;
            }
            root = path.resolve(v);
            baselineRoot = root;
            i += 1;
        } else {
            process.stderr.write(`lint_blocker_citations: unknown argument: ${String(arg)}\n`);
            return 2;
        }
    }
    const { misses, scanned, citations } = scanTree(root);
    reportScanned({
        gate: 'lint_blocker_citations',
        scanned,
        units: 'roadmap file(s)',
        roots: ['agents/roadmaps', 'agents/roadmaps/stubs'],
        allowEmpty: 'EMPTY_VALID: a checkout with no active roadmap cites nothing',
    });
    const verdict = checkRatchet({ gate: 'lint_blocker_citations', actual: misses.length, repoRoot: baselineRoot });
    const lines = misses.map(
        (m) =>
            `  ${m.roadmap}:${String(m.line)} · ${m.target}:${String(m.first)}${m.last !== m.first ? `-${String(m.last)}` : ''} · ` +
            (m.kind === 'missing-file' ? 'file does not exist' : `file has ${String(m.length)} line(s)`),
    );
    if (!verdict.ok) {
        process.stderr.write(`❌  ${verdict.message}\n`);
        process.stderr.write(`${lines.join('\n')}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  lint_blocker_citations: ${String(citations)} citation(s) in ${String(scanned)} roadmap file(s). ${verdict.message}\n`,
    );
    if (lines.length > 0) {
        process.stdout.write(`${lines.join('\n')}\n`);
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv1 = fs.realpathSync(path.resolve(process.argv[1]));
        if (here === argv1) {
            process.exit(main());
        }
    } catch {
        if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
            process.exit(main());
        }
    }
}

export { citationsIn, checkCitation, scanTree, main };
export type { Citation, Miss };
