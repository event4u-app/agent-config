// road-to-tells-a-near-miss-can-refute 3.1: the design-slop hook says only what
// the write introduced; what the committed file already carried is a count.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { attribute, committedBlob } from '../../src/scripts/_lib/finding_baseline.js';
import { scanFile } from '../../src/scripts/lint_design_slop.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NO_CTX = { raw: '', has: () => false };
const OLD = '.a { border-left: 4px solid #7c3aed; padding: 12px; }\n';
const NEW = '.b { border-left: 4px solid #0ea5e9; padding: 8px; }\n';

describe('attribute', () => {
    it('a pre-existing and a new side-stripe split into introduced 1, incumbent 1', () => {
        const found = scanFile(OLD + NEW, 'x.css', NO_CTX);
        const { introduced, incumbent } = attribute(found, scanFile(OLD, 'x.css', NO_CTX));
        expect(found).toHaveLength(2);
        expect(introduced.map((f) => [f.snippet, f.line])).toEqual([['.b', 2]]);
        expect(incumbent).toBe(1);
    });

    it('matches as a multiset — a second copy of an incumbent finding is introduced', () => {
        const f = { rule: 'r', snippet: 'same' };
        expect(attribute([f, f], [f])).toEqual({ introduced: [f], incumbent: 1 });
    });

    it('a moved count is the same finding', () => {
        const r = attribute([{ rule: 'cp1', snippet: '7 em-dashes in ~400 words' }], [{ rule: 'cp1', snippet: '6 em-dashes in ~386 words' }]);
        expect(r.incumbent).toBe(1);
    });
});

function git(root: string, ...args: string[]): void {
    execFileSync('git', ['-C', root, ...args], { stdio: 'ignore' });
}

function repoWith(file: string, body: string): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ds-baseline-'));
    git(root, 'init', '-q');
    fs.writeFileSync(path.join(root, file), body);
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), 'hooks:\n  design_slop:\n    enabled: true\n');
    git(root, 'add', '.');
    git(root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'base');
    return root;
}

describe('committedBlob', () => {
    it('reads HEAD for a tracked file and is empty for an untracked one', () => {
        const root = repoWith('a.css', OLD);
        expect(committedBlob(root, path.join(root, 'a.css'))).toBe(OLD);
        expect(committedBlob(root, 'new.css')).toBe('');
    });
});

function runHook(envelope: unknown): { code: number; out: string } {
    const r = spawnSync('npx', ['tsx', path.join(REPO, 'src/scripts/hooks/design_slop_hook.ts')], {
        input: JSON.stringify(envelope),
        encoding: 'utf-8',
        cwd: REPO,
        timeout: 120_000,
    });
    return { code: r.status ?? -1, out: r.stdout ?? '' };
}

describe('the hook reports introduced, counts incumbent', () => {
    it('a write that keeps the committed stripe and adds one names only the new one', () => {
        const root = repoWith('a.css', OLD);
        const r = runHook({ cwd: root, tool_name: 'Write', tool_input: { file_path: path.join(root, 'a.css'), content: OLD + NEW } });
        expect(r.code).toBe(2);
        expect(r.out).toContain('a.css:2 ');
        expect(r.out).not.toContain('a.css:1 ');
        expect(r.out).toContain('1 incumbent finding(s)');
    }, 240_000);

    it('a write that only re-states the committed stripe is silent', () => {
        const root = repoWith('a.css', OLD);
        const r = runHook({ cwd: root, tool_name: 'Write', tool_input: { file_path: path.join(root, 'a.css'), content: OLD } });
        expect(r.code).toBe(0);
    }, 240_000);
});
