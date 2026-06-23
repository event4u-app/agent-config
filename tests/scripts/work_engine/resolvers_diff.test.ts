
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    DiffResolverError,
    KIND,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/diff.js';

const REPO_ROOT = path.resolve(
    fileURLToPath(import.meta.url),
    '..',
    '..',
    '..',
    '..',
);

const WE = path.join(
    REPO_ROOT,
    'src',
    'agent-src',
    'templates',
    'scripts',
    'work_engine',
);
const STATE_PY = path.join(WE, 'state.py');
const RESOLVER_PY = path.join(WE, 'resolvers', 'diff.py');

function tsEnvelope(rawJson: string): string {
    const env = build_envelope(JSON.parse(rawJson));
    return JSON.stringify({ kind: env.kind, data: env.data });
}

function tsError(rawJson: string): string {
    try {
        build_envelope(JSON.parse(rawJson));
        return '__NO_ERROR__';
    } catch (exc) {
        return `${(exc as Error).name}: ${(exc as Error).message}`;
    }
}

const GIT_DIFF = [
    'diff --git a/foo.ts b/foo.ts',
    'index e69de29..4b825dc 100644',
    '--- a/foo.ts',
    '+++ b/foo.ts',
    '@@ -0,0 +1 @@',
    '+const x = 1;',
].join('\n');

const UNIFIED_DIFF = [
    '--- old.txt',
    '+++ new.txt',
    '@@ -1 +1 @@',
    '-a',
    '+b',
].join('\n');

describe('resolvers/diff — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('diff');
    });
    it('accepts a git diff and builds the canonical shape', () => {
        const env = build_envelope(GIT_DIFF);
        expect(env.kind).toBe('diff');
        expect(env.data).toEqual({ raw: GIT_DIFF, reconstructed_ac: [], assumptions: [] });
    });
    it('rejects prose with no markers', () => {
        expect(() => build_envelope('just words here')).toThrow(DiffResolverError);
    });
});
