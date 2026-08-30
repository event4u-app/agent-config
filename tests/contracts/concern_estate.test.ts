/**
 * road-to-concern-admission-ratchet step 1.1 — the shared concern parser.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as url from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    CONCERN_MANIFEST_POSIX,
    concernIds,
    countConcerns,
} from '../../src/scripts/_lib/concern_estate.js';

const repoRoot = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..', '..');
const manifest = fs.readFileSync(path.join(repoRoot, CONCERN_MANIFEST_POSIX), 'utf-8');

describe('the block boundary is the whole point', () => {
    it('stops at the next top-level key', () => {
        // The roadmap's own reproduce command greps the WHOLE file and so also
        // counts members of `roles:`, `platforms:` and `native_event_aliases:`,
        // which sit at the same indent. Measured over its six pins the
        // over-count is exactly 16 every time.
        const ids = concernIds(manifest);
        expect(ids).not.toContain('claude');
        expect(ids).not.toContain('augment');
        expect(ids).not.toContain('developer');
    });

    it('counts real concerns, and names them', () => {
        const ids = concernIds(manifest);
        expect(ids).toContain('chat-history');
        expect(ids).toContain('block-no-verify');
        expect(ids.length).toBe(countConcerns(manifest));
        expect(countConcerns(manifest)).toBeGreaterThan(40);
    });

    it('the proxy grep over-counts this manifest by exactly 16', () => {
        // Pinned so the correction cannot silently drift back: if the manifest
        // grows a fourth top-level map, this number moves and the next author
        // is told rather than left to rediscover it.
        const proxy = manifest.split('\n').filter((l) => /^ {2}[a-z][a-z0-9_-]*:$/.test(l)).length;
        expect(proxy - countConcerns(manifest)).toBe(16);
    });
});

describe('a bare key is a concern; a scalar setting is not', () => {
    it('ignores a key carrying a value', () => {
        const doc = ['concerns:', '  real-one:', '    severity: advisory', '  not_a_concern: 3', 'roles:', '  dev:'].join('\n');
        expect(concernIds(doc)).toEqual(['real-one']);
    });

    it('returns nothing when the block is absent', () => {
        expect(countConcerns('platforms:\n  claude:\n')).toBe(0);
    });

    it('does not resume counting after the block closed', () => {
        const doc = ['concerns:', '  a:', 'roles:', '  b:', 'platforms:', '  c:'].join('\n');
        expect(concernIds(doc)).toEqual(['a']);
    });
});
