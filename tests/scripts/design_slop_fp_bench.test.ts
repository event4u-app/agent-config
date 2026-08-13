import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

import { CORPUS_DIR, corpusFiles, corpusHash, scoreCorpus } from '../../internal/bench/design-slop-fp/run.js';

const CLEAN_HEADER = /^(\/\*|<!--|\/\/)\s*clean:\s*\S/;

describe('design-slop FP corpus — shape', () => {
    it('carries 32 files, 8 per class', () => {
        const files = corpusFiles(CORPUS_DIR).map((f) => path.basename(f));
        expect(files.length).toBe(32);
        for (const ext of ['.css', '.html', '.jsx', '.md']) {
            expect(files.filter((f) => f.endsWith(ext)).length, `${ext} count`).toBe(8);
        }
    });

    it('every file states why it is clean, on its first line', () => {
        for (const f of corpusFiles(CORPUS_DIR)) {
            const first = fs.readFileSync(f, 'utf-8').split('\n')[0] ?? '';
            expect(first, `${path.basename(f)} header`).toMatch(CLEAN_HEADER);
        }
    });

    it('is not derived from the rule fixtures — no file is trivially short', () => {
        // A sample written to keep one regex quiet tends to be a one-liner. Real
        // UI is not. This is a shape guard, not a proof of independence.
        for (const f of corpusFiles(CORPUS_DIR)) {
            const lines = fs.readFileSync(f, 'utf-8').trim().split('\n').length;
            expect(lines, `${path.basename(f)} is ${lines} lines`).toBeGreaterThan(10);
        }
    });
});

describe('corpusHash — the epoch pin', () => {
    it('is stable across runs on unchanged content', () => {
        const files = corpusFiles(CORPUS_DIR);
        expect(corpusHash(files)).toBe(corpusHash(files));
    });

    it('changes when any file changes', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-corpus-'));
        try {
            fs.writeFileSync(path.join(dir, 'a.css'), '/* clean: base */\n.a { color: #222; }\n');
            const before = corpusHash(corpusFiles(dir));
            fs.writeFileSync(path.join(dir, 'a.css'), '/* clean: base */\n.a { color: #333; }\n');
            expect(corpusHash(corpusFiles(dir))).not.toBe(before);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});

describe('scoreCorpus — the instrument discriminates', () => {
    it('scores every registry rule', () => {
        const r = scoreCorpus();
        expect(r.ruleCount).toBeGreaterThan(0);
        expect(r.scores.length).toBe(r.ruleCount);
        expect(r.fileCount).toBe(32);
    });

    // A bench that cannot produce a non-zero number is indistinguishable from a
    // bench that scans nothing. This proves the counting path works before any
    // real result is read as evidence of precision.
    it('counts a planted slop file as a false positive', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-planted-'));
        try {
            fs.writeFileSync(
                path.join(dir, 'planted.css'),
                '/* clean: deliberately not — this file plants a known tell */\n' +
                    '.card { transition: all 0.3s ease; }\n',
            );
            const r = scoreCorpus(dir);
            expect(r.impureRules).toBeGreaterThan(0);
            const transitionAll = r.scores.find((s) => s.rule === 'slop-m4-transition-all');
            expect(transitionAll?.falsePositives).toBe(1);
            expect(transitionAll?.files).toEqual(['planted.css']);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('counts per file, not per hit', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-repeat-'));
        try {
            fs.writeFileSync(
                path.join(dir, 'repeat.css'),
                '/* clean: deliberately not */\n' + '.a { transition: all 0.2s; }\n.b { transition: all 0.3s; }\n.c { transition: all 0.4s; }\n',
            );
            const r = scoreCorpus(dir);
            expect(r.scores.find((s) => s.rule === 'slop-m4-transition-all')?.falsePositives).toBe(1);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });

    it('reports an empty corpus as zero files rather than silently scoring nothing', () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'slop-empty-'));
        try {
            expect(corpusFiles(dir)).toEqual([]);
            expect(scoreCorpus(dir).fileCount).toBe(0);
        } finally {
            fs.rmSync(dir, { recursive: true, force: true });
        }
    });
});
