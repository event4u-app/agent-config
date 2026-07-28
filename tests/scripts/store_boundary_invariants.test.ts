import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    run as runStoreBoundary,
    SANCTIONED_MODULES,
    scanFile,
} from '../../src/scripts/lint_store_boundary.js';
import { scanText, TRIPWIRE_PATTERNS } from '../../src/scripts/lint_memory_tripwire.js';
import {
    _assert_project_writable,
    _origin_is_global,
    _setIntakeRoot,
    emit,
    ProvenanceRefusedError,
} from '../../src/scripts/memory_signal.js';

let tmp: string;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'store-boundary-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    _setIntakeRoot(path.join('agents', 'memory', 'intake'));
});

describe('invariant 1 — store-boundary lint (ADR-130)', () => {
    it('the real tree is clean', () => {
        expect(runStoreBoundary(path.resolve('.'))).toEqual([]);
    });

    it('RED: a homedir literal in index code is a violation', () => {
        const p = path.join(tmp, 'fake_index.ts');
        fs.writeFileSync(p, "const root = os.homedir() + '/.event4u/agent-config';\n", 'utf8');
        const hits = scanFile(p, 'fake_index.ts');
        expect(hits).toHaveLength(1);
        expect(hits[0]!.line).toBe(1);
    });

    it('GREEN: doc-comment prose and ignore-marked lines do not trip', () => {
        const p = path.join(tmp, 'fake_index.ts');
        fs.writeFileSync(
            p,
            [
                ' * lives at `~/.event4u/agent-config/knowledge/`.',
                "const x = os.homedir(); // lint-store-boundary: ignore — sanctioned example",
            ].join('\n'),
            'utf8',
        );
        expect(scanFile(p, 'fake_index.ts')).toEqual([]);
    });

    it('the sanctioned modules are exactly the two path owners', () => {
        expect(SANCTIONED_MODULES).toEqual([
            'src/scripts/_lib/user_global_paths.ts',
            'src/scripts/_lib/knowledge_global.ts',
        ]);
    });
});

describe('invariant 2 — provenance gate at the write edge (ADR-130)', () => {
    it('symbolic origins are not paths', () => {
        expect(_origin_is_global('agent')).toBe(false);
        expect(_origin_is_global('claude')).toBe(false);
    });

    it('an origin under the user-global store is refused', () => {
        expect(_origin_is_global('~/.event4u/agent-config/knowledge/card.yml')).toBe(true);
        expect(() =>
            _assert_project_writable({ origin: '~/.event4u/agent-config/knowledge/card.yml' }),
        ).toThrow(ProvenanceRefusedError);
    });

    it('subject: user is refused for tracked project targets', () => {
        expect(() => _assert_project_writable({ origin: 'agent', subject: 'user' })).toThrow(
            ProvenanceRefusedError,
        );
    });

    it('emit(): normal record passes and gains subject: project by default', () => {
        _setIntakeRoot(path.join(tmp, 'intake'));
        const rec = emit('historical-patterns', 'src/x.ts', 'Use the helper', {
            origin: 'claude',
            force: true,
        });
        expect(rec).not.toBeNull();
        expect(rec!.subject).toBe('project');
    });

    it('emit(): global-store origin is refused at the write edge, nothing written', () => {
        _setIntakeRoot(path.join(tmp, 'intake'));
        expect(() =>
            emit('historical-patterns', 'src/x.ts', 'leak', {
                origin: '~/.event4u/agent-config/knowledge/foo.yml',
                force: true,
            }),
        ).toThrow(ProvenanceRefusedError);
        expect(fs.existsSync(path.join(tmp, 'intake'))).toBe(false);
    });

    it('emit(): explicit subject: user via extra is refused', () => {
        _setIntakeRoot(path.join(tmp, 'intake'));
        expect(() =>
            emit('historical-patterns', 'src/x.ts', 'personal fact', {
                origin: 'claude',
                extra: { subject: 'user' },
                force: true,
            }),
        ).toThrow(ProvenanceRefusedError);
    });
});

describe('invariant 3 — tripwire (retained as evidence; honest-null, NOT CI-wired)', () => {
    it('detects first-person preference vocabulary DE+EN', () => {
        expect(scanText('body: I prefer tabs over spaces', 'f.yml', 'worktree')).toHaveLength(1);
        expect(scanText('body: ich bevorzuge Tabs', 'f.yml', 'worktree')).toHaveLength(1);
        expect(scanText('body: my email is x@y.de', 'f.yml', 'worktree')).toHaveLength(1);
    });

    it('does not trip on ordinary engineering prose', () => {
        expect(scanText('body: The retry helper handles I/O errors', 'f.yml', 'worktree')).toEqual([]);
        expect(scanText('body: callers must never use the raw client', 'f.yml', 'worktree')).toEqual([]);
    });

    it('patterns are word-boundary anchored (no substring tripping)', () => {
        for (const re of TRIPWIRE_PATTERNS) {
            expect(re.flags).toContain('i');
        }
        expect(scanText('MyEmailFormatter renders headers', 'f.yml', 'worktree')).toEqual([]);
    });
});
