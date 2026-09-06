// 2.3 — `surface` is an envelope field, not a platform key.
//
// The verify is deliberately narrow: a marked payload resolves `cloud`, an
// unmarked one resolves `unknown`, and `hooks:status` is untouched. There is no
// `ide`/`cli` assertion because nothing in this tree can distinguish them, and a
// test asserting a guess would make the guess look established.
import { describe, expect, it } from 'vitest';

import { collect } from '../../src/scripts/hooks_status.js';
import { _build_envelope } from '../../src/scripts/hooks/dispatch_hook.js';
import { CLOUD_PAYLOAD_MARKERS, detectSurface, readSurface, SURFACES } from '../../src/scripts/_lib/surface.js';

const args = { platform: 'claude', event: 'session_start', native_event: 'SessionStart' } as never;

describe('surface detection', () => {
    it('resolves cloud from a background-agent marker in the payload', () => {
        for (const marker of CLOUD_PAYLOAD_MARKERS) {
            const env = _build_envelope(args, JSON.stringify({ session_id: 's1', [marker]: true }));
            expect(env['surface'], `${marker} should resolve cloud`).toBe('cloud');
        }
    });

    it('resolves unknown for an unmarked payload', () => {
        const env = _build_envelope(args, JSON.stringify({ session_id: 's1' }));
        expect(env['surface']).toBe('unknown');
    });

    it('resolves unknown for an empty payload', () => {
        expect(_build_envelope(args, '')['surface']).toBe('unknown');
    });

    it('honours an explicit override but refuses an unrecognised one', () => {
        expect(detectSurface({}, { AGENT_CONFIG_SURFACE: 'ide' })).toBe('ide');
        expect(detectSurface({}, { AGENT_CONFIG_SURFACE: 'not-a-surface' })).toBe('unknown');
    });

    it('reads an unrecognised persisted value as unknown', () => {
        expect(readSurface('cloud')).toBe('cloud');
        expect(readSurface('from-a-newer-build')).toBe('unknown');
        expect(readSurface(undefined)).toBe('unknown');
    });

    it('keeps the vocabulary closed', () => {
        expect([...SURFACES]).toEqual(['ide', 'cli', 'cloud', 'unknown']);
    });
});

describe('hooks:status is untouched by the surface field', () => {
    it('emits no surface key on any platform row', () => {
        const matrix = collect(process.cwd(), { platforms: {} });
        for (const row of matrix.platforms) {
            expect(Object.keys(row).sort()).toEqual(
                ['bindings', 'bridge_path', 'fallback_only', 'hint', 'platform', 'status'].sort(),
            );
        }
    });
});
