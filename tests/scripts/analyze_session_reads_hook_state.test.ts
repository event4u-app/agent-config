/**
 * Regression test for step 1.1 of road-to-signals-that-mean-what-they-say:
 * `cmd_analyze_session.ts` must read the context-hygiene hook's state from
 * the path the hook actually writes (`STATE_FILE`, exported by
 * `context_hygiene_hook.ts`), not from an independently spelled path that
 * can drift.
 *
 * Before the fix, `cmd_analyze_session.ts` spelled its own
 * `agents/runtime/state/context-hygiene.json` while the hook writes
 * `agents/state/context-hygiene.json` — a fixture placed at the hook's real
 * path was invisible to the analyser.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { STATE_FILE } from '../../src/scripts/context_hygiene_hook.js';
import { _load_context_hygiene } from '../../src/scripts/_cli/cmd_analyze_session.js';

describe('cmd_analyze_session reads the hook-exported STATE_FILE path', () => {
    let tmp: string;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-session-hook-state-'));
    });

    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('is the same path the hook exports (no independent spelling)', () => {
        expect(STATE_FILE).toBe(path.join('agents', 'state', 'context-hygiene.json'));
    });

    it('finds a fixture written at the hook-exported STATE_FILE path', () => {
        const target = path.join(tmp, STATE_FILE);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, JSON.stringify({ tool_calls: 5, loop_detected: false }), 'utf-8');

        const result = _load_context_hygiene(tmp);
        expect(result).not.toBeNull();
        expect(result?.['tool_calls']).toBe(5);
    });

    it('does NOT find a fixture at the old drifted path (agents/runtime/state/)', () => {
        const oldPath = path.join(tmp, 'agents', 'runtime', 'state', 'context-hygiene.json');
        fs.mkdirSync(path.dirname(oldPath), { recursive: true });
        fs.writeFileSync(oldPath, JSON.stringify({ tool_calls: 99 }), 'utf-8');

        const result = _load_context_hygiene(tmp);
        expect(result).toBeNull();
    });
});
