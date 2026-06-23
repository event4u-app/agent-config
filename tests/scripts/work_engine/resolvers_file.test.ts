
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    FileResolverError,
    KIND,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/file.js';

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
const RESOLVER_PY = path.join(WE, 'resolvers', 'file.py');

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

describe('resolvers/file — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('file');
    });
    it('builds the canonical envelope and posix-normalises backslashes', () => {
        const env = build_envelope('a\\b\\c.tsx');
        expect(env.kind).toBe('file');
        expect(env.data).toEqual({ path: 'a/b/c.tsx', reconstructed_ac: [], assumptions: [] });
    });
    it('rejects URLs', () => {
        expect(() => build_envelope('https://x.com')).toThrow(FileResolverError);
    });
});
