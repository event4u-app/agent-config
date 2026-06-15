// Parity test for work_engine/directives/index.ts vs directives/__init__.py
// (ADR-096 py2ts Phase 1 — work_engine TOP/integration layer). The Python
// `__init__` declares `__all__ = []` (no re-exports); the TS twin is the empty
// package-marker module. Parity is the empty public surface.
import { spawnSync } from 'node:child_process';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import * as directives from '../../../src/agent-src/templates/scripts/work_engine/directives/index.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const SCRIPTS_ROOT = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts');

function hasPython3(): boolean {
    return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0;
}

const py = hasPython3();
const describeParity = py ? describe : describe.skip;

describe('directives/index — empty package marker', () => {
    it('exposes no runtime members (mirrors __all__ = [])', () => {
        // `export {}` yields a module object with no own enumerable members.
        expect(Object.keys(directives)).toEqual([]);
    });
});

describeParity('directives/__init__ — __all__ parity', () => {
    it('python __all__ is empty', () => {
        const code = [
            'import sys, json',
            `sys.path.insert(0, ${JSON.stringify(SCRIPTS_ROOT)})`,
            'm = __import__("work_engine.directives", fromlist=["x"])',
            'sys.stdout.write(json.dumps(getattr(m, "__all__", None)))',
        ].join('\n');
        const r = spawnSync('python3', ['-c', code], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toBe('[]');
    });
});
