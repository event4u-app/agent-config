import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const CONCEPTS = path.join(REPO, 'docs', 'CONCEPTS.md');

/**
 * `docs/CONCEPTS.md` is an INDEX, not a definition.
 *
 * The whole file rests on one property: every entry points at the artefact that
 * owns the term, so a definition that drifts is detectable rather than silent.
 * A pointer that has rotted turns the index into the second source of truth it
 * was written to avoid — and the reader who lands on the stale half is
 * confidently wrong with no way to notice, which is worse than no file.
 *
 * Risk 1 of the roadmap that authored it names exactly this. This test is the
 * mechanism; the prose rule alone is not one.
 */
/**
 * A POINTER LINE: a line whose entire content is one backticked reference.
 *
 * Deliberately not "every backticked path in the file". The first version
 * matched prose too, and CI caught what that costs: the `projection` entry
 * enumerates the generated trees — `dist/agent-src/`, `.augment/`, …,
 * `GEMINI.md` — and `GEMINI.md` is GENERATED and untracked, so it exists in a
 * working tree and not in a fresh checkout. The test passed locally and failed
 * on CI for a file that was never a pointer.
 *
 * The file's own convention is the right anchor: each entry carries its owner
 * as a standalone reference line. Prose may name any path it likes.
 */
const POINTER_LINE = /^`([A-Za-z0-9_./-]+\.(?:md|ts|yml|json))(?::(\d+)(?:-(\d+))?)?`$/;

interface Ref {
    file: string;
    line: number | null;
}

function refs(): Ref[] {
    const out: Ref[] = [];
    for (const raw of fs.readFileSync(CONCEPTS, 'utf-8').split('\n')) {
        const m = POINTER_LINE.exec(raw.trim());
        if (m === null) continue;
        out.push({ file: m[1] as string, line: m[2] === undefined ? null : Number(m[2]) });
    }
    return out;
}

describe('docs/CONCEPTS.md — every pointer resolves', () => {
    it('the file exists and carries entries', () => {
        expect(fs.existsSync(CONCEPTS)).toBe(true);
        const headings = fs
            .readFileSync(CONCEPTS, 'utf-8')
            .split('\n')
            .filter((l) => l.startsWith('## '));
        // Three seeded terms plus the ambiguities section is the floor the
        // roadmap set; below it the file is not doing its job.
        expect(headings.length).toBeGreaterThanOrEqual(4);
    });

    it('names the three seeded divergences', () => {
        const text = fs.readFileSync(CONCEPTS, 'utf-8');
        for (const term of ['## tier', '## projection', '## delivery']) {
            expect(text, `${term} should be a heading`).toContain(term);
        }
    });

    it('carries a non-empty Flagged ambiguities section', () => {
        // The section that earns the file: a settled definition can live at its
        // owning artefact, an ambiguity has no owner and is recorded nowhere
        // else.
        const text = fs.readFileSync(CONCEPTS, 'utf-8');
        const idx = text.indexOf('## Flagged ambiguities');
        expect(idx).toBeGreaterThan(-1);
        expect(text.slice(idx).split('### ').length - 1).toBeGreaterThanOrEqual(2);
    });

    it('every referenced path exists in the tree', () => {
        const missing = [...new Set(refs().map((r) => r.file))].filter(
            (f) => !fs.existsSync(path.join(REPO, f)),
        );
        expect(missing).toEqual([]);
    });

    it('every referenced line number is inside its file', () => {
        // The half a plain reference checker misses: `foo.md:9999` resolves as
        // a path and points at nothing.
        const bad: string[] = [];
        for (const r of refs()) {
            if (r.line === null) continue;
            const abs = path.join(REPO, r.file);
            if (!fs.existsSync(abs)) continue;
            const lines = fs.readFileSync(abs, 'utf-8').split('\n').length;
            if (r.line > lines) bad.push(`${r.file}:${r.line} (file has ${lines} lines)`);
        }
        expect(bad).toEqual([]);
    });

    it('at least one pointer carries a line number, not just a path', () => {
        // Sensitivity fence for the check above: if every reference degraded to
        // a bare path, the line assertion would pass vacuously forever.
        expect(refs().filter((r) => r.line !== null).length).toBeGreaterThanOrEqual(3);
    });

    it('every concept heading is followed by a pointer line', () => {
        // The property the narrowed regex could otherwise lose: if an entry
        // stopped carrying its owner, `refs()` would simply return fewer rows
        // and every assertion above would still pass. This is what keeps the
        // file an index rather than a definition.
        const lines = fs.readFileSync(CONCEPTS, 'utf-8').split('\n');
        const orphans: string[] = [];
        for (let i = 0; i < lines.length; i += 1) {
            const h = lines[i] as string;
            if (!h.startsWith('## ') || h === '## Flagged ambiguities') continue;
            const window = lines.slice(i + 1, i + 4).map((l) => l.trim());
            if (!window.some((l) => POINTER_LINE.test(l))) orphans.push(h);
        }
        expect(orphans).toEqual([]);
    });
});
