/**
 * Tests for src/scripts/_cli/cmd_analyze_session.ts — the read-only
 * post-session report.
 *
 * Covers the pure `render_report` renderer (deterministic, no I/O) and the
 * `_analyze_session` path end-to-end against fixtures in a tmpdir: a
 * work-state envelope shaped like GT-U10 cycle-06.json plus a context-hygiene
 * snapshot. No network, no model calls.
 */
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { render_report, _analyze_session } from '../../src/scripts/_cli/cmd_analyze_session.js';

// A work-state envelope shaped like GT-U10 cycle-06.json: one touched file,
// a blocked `test` directive, and an empty halts array.
const WORK_STATE = {
    version: 1,
    halts: [],
    changes: [
        {
            kind: 'ui',
            stack: 'plain',
            file: 'resources/views/demo/showcase.blade.php',
            summary: 'Bare demo page scaffolded with Tailwind defaults',
        },
    ],
    outcomes: {
        refine: 'success',
        memory: 'success',
        analyze: 'success',
        plan: 'success',
        implement: 'success',
        test: 'blocked',
    },
};

const HYGIENE = {
    tool_calls: 17,
    consecutive_same_tool: 2,
    loop_detected: false,
    tool_history: ['view', 'edit', 'view'],
    checked_at: '2026-06-25T00:00:00Z',
};

describe('render_report — deterministic output', () => {
    it('lists the touched file, the blocked directive, and tool-call count', () => {
        const out = render_report(WORK_STATE, HYGIENE);
        // Files touched.
        expect(out).toContain('## Files touched (1)');
        expect(out).toContain('resources/views/demo/showcase.blade.php');
        // Blocked directive is flagged.
        expect(out).toContain('## Outcomes (6)');
        expect(out).toContain('`test`: blocked');
        expect(out).toContain('**Blocked directives (1):** test');
        // Halts.
        expect(out).toContain('## Halts (0)');
        // Tool activity from context-hygiene.
        expect(out).toContain('Tool calls: 17');
        expect(out).toContain('Loop detected: no');
        // Honest token/cost note — no fabricated numbers.
        expect(out).toContain('Token/cost: not tracked (no per-session source).');
    });

    it('renders a graceful note when context-hygiene is absent', () => {
        const out = render_report(WORK_STATE, null);
        expect(out).toContain('_Context-hygiene snapshot not available._');
    });

    it('is deterministic — same inputs, byte-identical output', () => {
        expect(render_report(WORK_STATE, HYGIENE)).toBe(render_report(WORK_STATE, HYGIENE));
    });
});

describe('_analyze_session — end-to-end against fixtures', () => {
    let tmp: string;
    let writes: string[];
    let original: typeof process.stdout.write;

    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'analyze-session-'));
        writes = [];
        original = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((chunk: unknown): boolean => {
            writes.push(String(chunk));
            return true;
        }) as typeof process.stdout.write;
    });

    afterEach(() => {
        process.stdout.write = original;
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('reads both fixtures and emits the report (exit 0)', () => {
        const stateFile = path.join(tmp, '.work-state.json');
        fs.writeFileSync(stateFile, JSON.stringify(WORK_STATE), 'utf-8');
        const hygieneDir = path.join(tmp, 'agents', 'runtime', 'state');
        fs.mkdirSync(hygieneDir, { recursive: true });
        fs.writeFileSync(path.join(hygieneDir, 'context-hygiene.json'), JSON.stringify(HYGIENE), 'utf-8');

        const code = _analyze_session(tmp, stateFile);
        const out = writes.join('');

        expect(code).toBe(0);
        expect(out).toContain('resources/views/demo/showcase.blade.php');
        expect(out).toContain('`test`: blocked');
        expect(out).toContain('Tool calls: 17');
    });

    it('returns exit 1 when the work-state file is missing', () => {
        const code = _analyze_session(tmp, path.join(tmp, 'missing.json'));
        expect(code).toBe(1);
    });
});
