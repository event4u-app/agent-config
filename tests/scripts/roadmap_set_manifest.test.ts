import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { buildManifest, slugsFromFiles } from '../../src/scripts/roadmap_set_manifest.js';

let root: string;

function roadmap(rel: string, fm: string): void {
    const p = path.join(root, 'agents', 'roadmaps', rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, `---\ncomplexity: lightweight\n${fm}---\n# T\n\n- [ ] **1.1 a**\n`, 'utf8');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'set-manifest-'));
});
afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('slugsFromFiles', () => {
    it('names roadmap candidates from a PR file list and ignores archive, skipped and other files', () => {
        expect(
            slugsFromFiles([
                'agents/roadmaps/road-to-a.md',
                'agents/roadmaps/later/road-to-b.md',
                'agents/roadmaps/archive/road-to-c.md',
                'agents/roadmaps/skipped/road-to-d.md',
                'agents/roadmaps-progress.md',
                'src/x.ts',
                'agents/roadmaps/road-to-a.md',
            ]),
        ).toEqual(['road-to-a', 'road-to-b']);
    });
});

describe('buildManifest', () => {
    it('orders active members by depends and keeps input order where nothing binds them', () => {
        roadmap('road-to-a.md', 'depends:\n  - road-to-c\n');
        roadmap('road-to-b.md', '');
        roadmap('road-to-c.md', 'relates:\n  - slug: road-to-b\n    relation: depends\n    note: "x"\n');
        const m = buildManifest(root, ['road-to-a', 'road-to-b', 'road-to-c'], { kind: 'roadmaps' });
        expect(m.ok).toBe(true);
        expect(m.order).toEqual(['road-to-b', 'road-to-c', 'road-to-a']);
    });

    it('ignores a depends edge to a roadmap outside the set', () => {
        roadmap('road-to-a.md', 'depends:\n  - road-to-elsewhere\n');
        roadmap('road-to-b.md', '');
        expect(buildManifest(root, ['road-to-b', 'road-to-a'], { kind: 'roadmaps' }).order).toEqual([
            'road-to-b',
            'road-to-a',
        ]);
    });

    it('refuses a cycle and names it', () => {
        roadmap('road-to-a.md', 'depends:\n  - road-to-b\n');
        roadmap('road-to-b.md', 'depends:\n  - road-to-a\n');
        const m = buildManifest(root, ['road-to-a', 'road-to-b'], { kind: 'roadmaps' });
        expect(m.ok).toBe(false);
        expect(m.cycle).toEqual(expect.arrayContaining(['road-to-a', 'road-to-b']));
        expect(m.order).toEqual([]);
    });

    it('excludes parked, archived and missing members with a reason instead of running them', () => {
        roadmap('road-to-a.md', '');
        roadmap('later/road-to-b.md', '');
        roadmap('archive/road-to-c.md', '');
        const m = buildManifest(root, ['road-to-a', 'road-to-b', 'road-to-c', 'road-to-d'], { kind: 'roadmaps' });
        expect(m.order).toEqual(['road-to-a']);
        expect(m.excluded).toEqual([
            { slug: 'road-to-b', reason: 'later' },
            { slug: 'road-to-c', reason: 'archive' },
            { slug: 'road-to-d', reason: 'missing' },
        ]);
    });

    it('binds a PR source to its head revision and never adds members the input did not name', () => {
        roadmap('road-to-a.md', 'depends:\n  - road-to-z\n');
        roadmap('road-to-z.md', '');
        const m = buildManifest(root, ['road-to-a'], { kind: 'pr', pr: 2583, head: 'f6226af' });
        expect(m.source).toEqual({ kind: 'pr', pr: 2583, head: 'f6226af' });
        expect(m.order).toEqual(['road-to-a']);
    });

    it('rejects a slug that is not a roadmap name instead of resolving a path from it', () => {
        expect(() => buildManifest(root, ['../etc/passwd'], { kind: 'roadmaps' })).toThrow(/not a roadmap slug/);
    });
});
