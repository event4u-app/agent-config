/**
 * Tests for permanent wizard-recommendation dismissals
 * (road-to-reciprocal-ecosystem § Phase 1). We point
 * `AGENT_CONFIG_WIZARD_DISMISSALS` at a temp file so the test never touches
 * the real `~/.event4u/agent-config/wizard-dismissals.json`. The module
 * resolves the path lazily inside each call (never at import time), so a
 * static top-level import is safe even though the env var is set per-test.
 *
 * See src/install/wizardDismissals.ts for the module under test.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { dismissRecommendation, readDismissedRecommendations } from '../../src/install/wizardDismissals.js';

describe('wizardDismissals', () => {
    let dir: string;
    let file: string;
    const prev = process.env['AGENT_CONFIG_WIZARD_DISMISSALS'];

    beforeEach(() => {
        dir = mkdtempSync(join(tmpdir(), 'wizard-dismissals-'));
        file = join(dir, 'sub', 'wizard-dismissals.json');
        process.env['AGENT_CONFIG_WIZARD_DISMISSALS'] = file;
    });
    afterEach(() => {
        rmSync(dir, { recursive: true, force: true });
        if (prev === undefined) delete process.env['AGENT_CONFIG_WIZARD_DISMISSALS'];
        else process.env['AGENT_CONFIG_WIZARD_DISMISSALS'] = prev;
    });

    it('returns an empty list when the file does not exist yet', () => {
        expect(readDismissedRecommendations()).toEqual([]);
    });

    it('persists a dismissal so it is readable back', () => {
        dismissRecommendation('agent-switch');
        expect(readDismissedRecommendations()).toEqual(['agent-switch']);
    });

    it('is idempotent — dismissing the same id twice does not duplicate it', () => {
        dismissRecommendation('agent-switch');
        dismissRecommendation('agent-switch');
        expect(readDismissedRecommendations()).toEqual(['agent-switch']);
    });

    it('accumulates distinct ids across calls', () => {
        dismissRecommendation('agent-switch');
        dismissRecommendation('some-other-recommendation');
        expect(readDismissedRecommendations().slice().sort()).toEqual(['agent-switch', 'some-other-recommendation']);
    });

    it('returns an empty list for a corrupted file (best-effort, never throws)', () => {
        mkdirSync(join(dir, 'sub'), { recursive: true });
        writeFileSync(file, 'not valid json {{{', 'utf8');
        expect(readDismissedRecommendations()).toEqual([]);
    });

    it('returns an empty list when the "dismissed" field is not an array', () => {
        mkdirSync(join(dir, 'sub'), { recursive: true });
        writeFileSync(file, JSON.stringify({ dismissed: 'not-an-array' }), 'utf8');
        expect(readDismissedRecommendations()).toEqual([]);
    });

    it('filters out non-string entries in the "dismissed" array', () => {
        mkdirSync(join(dir, 'sub'), { recursive: true });
        writeFileSync(file, JSON.stringify({ dismissed: ['agent-switch', 42, null] }), 'utf8');
        expect(readDismissedRecommendations()).toEqual(['agent-switch']);
    });

    it('never throws even when the target directory cannot be created (best-effort write)', () => {
        // Point at a path whose parent is a FILE, not a directory — mkdirSync
        // will fail, and dismissRecommendation must swallow it.
        const blockerFile = join(dir, 'blocker');
        writeFileSync(blockerFile, 'x', 'utf8');
        process.env['AGENT_CONFIG_WIZARD_DISMISSALS'] = join(blockerFile, 'wizard-dismissals.json');
        expect(() => dismissRecommendation('agent-switch')).not.toThrow();
    });
});
