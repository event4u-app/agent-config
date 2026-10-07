import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { main, scanText, scanTree } from '../../src/scripts/lint_ticked_unmet_criteria.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

const FIXTURE = [
    '## Acceptance Criteria',
    '',
    '- [x] AC-1 — Fully met.',
    '- [x] AC-2 — One half lands. **The other half',
    '      is NOT met and was refused.**',
    '- [~] AC-3 — Deferred, and NOT met, honestly.',
    '- [ ] AC-4 — Open, NOT met yet.',
    '- [x] AC-5 — Met.',
    '',
    'NOT met — a later paragraph is not part of AC-5.',
    '',
    '```',
    '- [x] AC-6 — inside a fence, NOT met',
    '```',
    '- [x] AC-7 — prose saying it is not met in lower case.',
    '',
].join('\n');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ticked-unmet-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_ticked_unmet_criteria', () => {
    it('reports only a ticked criterion whose own text says NOT met', () => {
        const hits = scanText(FIXTURE, 'f.md');
        expect(hits).toEqual([{ file: 'f.md', line: 4, criterion: 'AC-2' }]);
    });

    it('exits 1 on a planted tick over NOT met, 0 when the glyph is honest', () => {
        const dir = path.join(tmp, 'agents', 'roadmaps', 'archive');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, 'road-to-x.md');
        fs.writeFileSync(file, FIXTURE);
        expect(runInProc(main, ['--root', tmp]).status).toBe(1);
        fs.writeFileSync(file, FIXTURE.replace('- [x] AC-2', '- [~] AC-2'));
        expect(runInProc(main, ['--root', tmp]).status).toBe(0);
    });

    it('exits 2 on a usage error', () => {
        expect(runInProc(main, ['--bogus']).status).toBe(2);
    });

    it('reads the real tree, and reports the archived plumbing AC-3 while it is still ticked', () => {
        const rel = 'agents/roadmaps/archive/road-to-a-kernel-that-guards-its-plumbing.md';
        const ticked = /^- \[x\] AC-3/m.test(fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8'));
        const { hits, scanned } = scanTree(REPO_ROOT);
        expect(scanned).toBeGreaterThan(100);
        const ac3 = hits.filter((h) => h.file === rel && h.criterion === 'AC-3');
        expect(ac3).toHaveLength(ticked ? 1 : 0);
    });
});
