
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
    KIND,
    PromptResolverError,
    build_envelope,
} from '../../../src/agent-src/templates/scripts/work_engine/resolvers/prompt.js';

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
const RESOLVER_PY = path.join(WE, 'resolvers', 'prompt.py');

function tsEnvelope(rawJson: string): string {
    const raw = JSON.parse(rawJson);
    const env = build_envelope(raw);
    return JSON.stringify({ kind: env.kind, data: env.data });
}

function tsError(rawJson: string): string {
    const raw = JSON.parse(rawJson);
    try {
        build_envelope(raw);
        return '__NO_ERROR__';
    } catch (exc) {
        return `${(exc as Error).name}: ${(exc as Error).message}`;
    }
}

describe('resolvers/prompt — TS-side unit checks (no python3 needed)', () => {
    it('KIND constant', () => {
        expect(KIND).toBe('prompt');
    });
    it('builds the canonical envelope shape', () => {
        const env = build_envelope('hi');
        expect(env.kind).toBe('prompt');
        expect(env.data).toEqual({ raw: 'hi', reconstructed_ac: [], assumptions: [] });
    });
    it('throws PromptResolverError on empty', () => {
        expect(() => build_envelope('  ')).toThrow(PromptResolverError);
    });
});
