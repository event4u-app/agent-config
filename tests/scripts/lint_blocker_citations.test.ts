import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { citationsIn, main, scanTree } from '../../src/scripts/lint_blocker_citations.js';
import { runInProc } from '../_lib/run_in_process.js';

const REPO_ROOT = path.resolve(__dirname, '..', '..');

function roadmap(blockers: string): string {
    return [
        '# Road to a fixture',
        '',
        'Prose cites `src/a.ts:999`, outside the Blockers section.',
        '',
        '## Blockers',
        '',
        '### blocker: b1',
        `- **What to do:** ${blockers}`,
        '',
        '## Risk Register',
        '',
        'Also outside: `src/a.ts:999`.',
        '',
    ].join('\n');
}

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'blocker-citations-'));
    fs.mkdirSync(path.join(tmp, 'agents', 'roadmaps', 'stubs'), { recursive: true });
    fs.mkdirSync(path.join(tmp, 'src'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'a.ts'), 'one\ntwo\nthree\n');
    fs.mkdirSync(path.join(tmp, 'src', 'config'), { recursive: true });
    fs.writeFileSync(path.join(tmp, 'src', 'config', 'gate-violation-baselines.json'), '{"gates":{}}\n');
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('lint_blocker_citations', () => {
    it('reads citations only inside the Blockers section', () => {
        const cs = citationsIn(roadmap('see `src/a.ts:2-3` and src/a.ts:1'), 'r.md');
        expect(cs.map((c) => `${c.target}:${c.first}-${c.last}`)).toEqual(['src/a.ts:2-3', 'src/a.ts:1-1']);
        expect(cs[0]?.line).toBe(8);
    });

    it('passes a citation within the file and fails one beyond its end or to a missing file', () => {
        const file = path.join(tmp, 'agents', 'roadmaps', 'road-to-x.md');
        fs.writeFileSync(file, roadmap('`src/a.ts:1-3` is in range'));
        expect(scanTree(tmp).misses).toEqual([]);
        expect(runInProc(main, ['--root', tmp]).status).toBe(0);

        fs.writeFileSync(file, roadmap('`src/a.ts:2-4` runs past the end; `src/gone.ts:1` is gone'));
        const { misses } = scanTree(tmp);
        expect(misses.map((m) => m.kind)).toEqual(['beyond-end', 'missing-file']);
        expect(runInProc(main, ['--root', tmp]).status).toBe(1);
    });

    it('resolves a path relative to the citing roadmap', () => {
        fs.writeFileSync(path.join(tmp, 'agents', 'roadmaps', 'sibling.md'), 'a\nb\n');
        fs.writeFileSync(path.join(tmp, 'agents', 'roadmaps', 'road-to-y.md'), roadmap('`sibling.md:2`'));
        expect(scanTree(tmp).misses).toEqual([]);
    });

    it('holds the real tree at or under its recorded baseline', () => {
        expect(runInProc(main, []).status).toBe(0);
        const baselines = JSON.parse(
            fs.readFileSync(path.join(REPO_ROOT, 'src', 'config', 'gate-violation-baselines.json'), 'utf8'),
        ) as { gates: Record<string, { count: number }> };
        expect(scanTree(REPO_ROOT).misses.length).toBeLessThanOrEqual(baselines.gates['lint_blocker_citations']?.count ?? 0);
    });

    it('exits 2 on a usage error', () => {
        expect(runInProc(main, ['--bogus']).status).toBe(2);
    });
});
