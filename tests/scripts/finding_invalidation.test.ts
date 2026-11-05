/**
 * Finding invalidation (road-to-a-graph-that-wins step 3.3, AC-4).
 *
 * A closed finding pins the files it was about and a checksum over their
 * contents at closure time. When one of those files changes or disappears, the
 * closure no longer describes the tree: it flips to `stale` and the release gate
 * asks for a fresh disposition. A closure without `affected_files` behaves
 * exactly as before.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    disposition_tally,
    missing_dispositions,
    type LedgerFinding,
} from '../../src/scripts/check_finding_dispositions.js';
import {
    evidenceChecksum,
    fsFileReader,
    invalidateClosures,
    staleClosures,
} from '../../src/scripts/_lib/finding_invalidation.js';

const _REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'finv-'));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body, 'utf-8');
    }
    return root;
}

function closed(root: string, extra: Partial<LedgerFinding> = {}): LedgerFinding {
    return {
        finding_id: 'aaaaaaaaaaaa',
        severity: 'high',
        kind: 'security',
        title: 'path traversal in a.ts',
        status: 'fixed',
        commit: 'abc1234',
        rationale: 'guarded the join',
        verified_by: 'test → green',
        affected_files: ['a.ts'],
        evidence_checksum: evidenceChecksum(['a.ts'], fsFileReader(root)),
        ...extra,
    };
}

describe('evidenceChecksum', () => {
    it('is order-independent over the path list and sensitive to content', () => {
        const root = tree({ 'a.ts': 'one', 'b.ts': 'two' });
        const read = fsFileReader(root);
        expect(evidenceChecksum(['a.ts', 'b.ts'], read)).toBe(evidenceChecksum(['b.ts', 'a.ts'], read));
        expect(evidenceChecksum(['a.ts'], read)).toMatch(/^[0-9a-f]{64}$/);
        const before = evidenceChecksum(['a.ts'], read);
        fs.writeFileSync(path.join(root, 'a.ts'), 'one!', 'utf-8');
        expect(evidenceChecksum(['a.ts'], read)).not.toBe(before);
    });

    it('does not let a path boundary shift collide two different trees', () => {
        const r1 = tree({ 'a.ts': 'xy', 'b.ts': '' });
        const r2 = tree({ 'a.ts': 'x', 'b.ts': 'y' });
        expect(evidenceChecksum(['a.ts', 'b.ts'], fsFileReader(r1))).not.toBe(
            evidenceChecksum(['a.ts', 'b.ts'], fsFileReader(r2)),
        );
    });
});

describe('staleClosures / invalidateClosures', () => {
    it('unchanged affected file → still closed', () => {
        const root = tree({ 'a.ts': 'export const a = 1;\n' });
        const f = closed(root);
        expect(staleClosures([f], fsFileReader(root))).toEqual([]);
        const [out] = invalidateClosures([f], fsFileReader(root));
        expect(out!.status).toBe('fixed');
        expect(missing_dispositions([out!])).toEqual([]);
    });

    it('edited affected file → stale, and the gate asks for a re-disposition', () => {
        const root = tree({ 'a.ts': 'export const a = 1;\n' });
        const f = closed(root);
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 2;\n', 'utf-8');
        const stale = staleClosures([f], fsFileReader(root));
        expect(stale).toHaveLength(1);
        expect(stale[0]!.finding_id).toBe('aaaaaaaaaaaa');
        expect(stale[0]!.changed_files).toEqual(['a.ts']);
        expect(stale[0]!.previous_status).toBe('fixed');
        const [out] = invalidateClosures([f], fsFileReader(root));
        expect(out!.status).toBe('stale');
        const problems = missing_dispositions([out!]);
        expect(problems).toHaveLength(1);
        expect(problems[0]).toMatch(/stale/);
        expect(problems[0]).toMatch(/re-disposition/);
        // The original row is not mutated: invalidation is a view, never a write.
        expect(f.status).toBe('fixed');
    });

    it('deleted affected file → stale, named as deleted', () => {
        const root = tree({ 'a.ts': 'x' });
        const f = closed(root);
        fs.rmSync(path.join(root, 'a.ts'));
        const stale = staleClosures([f], fsFileReader(root));
        expect(stale).toHaveLength(1);
        expect(stale[0]!.deleted_files).toEqual(['a.ts']);
    });

    it('closure without affected_files → unchanged behaviour', () => {
        const root = tree({ 'a.ts': 'x' });
        const { affected_files: _a, evidence_checksum: _c, ...f } = closed(root);
        fs.writeFileSync(path.join(root, 'a.ts'), 'changed', 'utf-8');
        expect(staleClosures([f], fsFileReader(root))).toEqual([]);
        expect(invalidateClosures([f], fsFileReader(root))[0]).toBe(f);
    });

    it('an open row is never flipped: only a closure can go stale', () => {
        const root = tree({ 'a.ts': 'x' });
        const f = closed(root, { status: 'open' });
        fs.writeFileSync(path.join(root, 'a.ts'), 'changed', 'utf-8');
        expect(staleClosures([f], fsFileReader(root))).toEqual([]);
    });

    it('a stale non-blocking closure stops counting as terminal', () => {
        const root = tree({ 'a.ts': 'x' });
        const f = closed(root, { severity: 'low', kind: 'style', status: 'false_positive' });
        fs.writeFileSync(path.join(root, 'a.ts'), 'changed', 'utf-8');
        const t = disposition_tally(invalidateClosures([f], fsFileReader(root)));
        expect(t.nonBlockingTotal).toBe(1);
        expect(t.nonBlockingTerminal).toBe(0);
    });
});

function runGate(dir: string, root: string): { code: number; out: string } {
    const tsx = path.join(_REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');
    const res = spawnSync(
        tsx,
        [
            path.join(_REPO_ROOT, 'src/scripts/check_finding_dispositions.ts'),
            '--release',
            '1.0.0',
            '--dir',
            dir,
            '--root',
            root,
        ],
        { cwd: _REPO_ROOT, encoding: 'utf-8', maxBuffer: 32 * 1024 * 1024 },
    );
    return { code: res.status ?? 1, out: `${res.stdout ?? ''}${res.stderr ?? ''}` };
}

describe('check_finding_dispositions CLI — stale closures', () => {
    it('green while the affected file is unchanged, red once it changes', () => {
        const root = tree({ 'a.ts': 'export const a = 1;\n' });
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'finv-ledger-'));
        fs.writeFileSync(
            path.join(dir, '1.0.0.json'),
            JSON.stringify({ schema_version: 1, release: '1.0.0', findings: [closed(root)] }),
            'utf-8',
        );
        expect(runGate(dir, root).code).toBe(0);
        fs.writeFileSync(path.join(root, 'a.ts'), 'export const a = 2;\n', 'utf-8');
        const red = runGate(dir, root);
        expect(red.code).toBe(1);
        expect(red.out).toMatch(/stale/);
        expect(red.out).toMatch(/a\.ts/);
    });
});
