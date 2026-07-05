/**
 * Tests for src/scripts/check_media_deps.ts — the B8 media-tooling
 * detect-and-instruct check. Deterministic: probes `node` (always on PATH) and
 * a guaranteed-absent binary; asserts per-platform install hints.
 */
import { describe, expect, it } from 'vitest';

import { installHint, isPresent, MEDIA_TOOLS, missingTools, type MediaTool } from '../../src/scripts/check_media_deps.js';

describe('check_media_deps — isPresent()', () => {
    it('detects a binary that is on PATH', () => {
        expect(isPresent('node')).toBe(true);
    });
    it('reports a guaranteed-absent binary as missing', () => {
        expect(isPresent('definitely-not-a-real-binary-xyz-42')).toBe(false);
    });
});

describe('check_media_deps — installHint()', () => {
    const tool = MEDIA_TOOLS[0] as MediaTool;
    it('returns the platform-specific command', () => {
        expect(installHint(tool, 'darwin')).toBe(tool.install.darwin);
        expect(installHint(tool, 'linux')).toBe(tool.install.linux);
        expect(installHint(tool, 'win32')).toBe(tool.install.other);
    });
});

describe('check_media_deps — missingTools()', () => {
    it('returns tools whose binary is absent', () => {
        const fake: MediaTool = {
            bin: 'definitely-not-a-real-binary-xyz-42',
            purpose: 'test',
            install: { darwin: 'x', linux: 'y', other: 'z' },
        };
        const present: MediaTool = { bin: 'node', purpose: 'test', install: { darwin: 'x', linux: 'y', other: 'z' } };
        expect(missingTools([fake, present])).toEqual([fake]);
    });
    it('MEDIA_TOOLS declares asciinema + agg with all three platform hints', () => {
        expect(MEDIA_TOOLS.map((t) => t.bin)).toEqual(['asciinema', 'agg']);
        for (const t of MEDIA_TOOLS) {
            expect(t.install.darwin).toBeTruthy();
            expect(t.install.linux).toBeTruthy();
            expect(t.install.other).toBeTruthy();
        }
    });
});
