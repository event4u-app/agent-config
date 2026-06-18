// End-to-end integration of the chat-history hooks via main() (pure TS).
//
// Behavioural twin of tests/work_engine/test_integration_chat_history.py — the
// Python suite is the spec. It drives the full eight-step flow through `main()`
// with the structural chat-history hooks registered (append + halt_append) and
// a fake subprocess runner capturing every `scripts/chat_history.py` invocation.
// The contract under lock:
//
//   - `append --type phase` fires once per successful step boundary.
//   - `append --type decision` fires when the engine halts with a surfaceable
//     decision (the halt-append hook).
//   - The retired cooperative hooks (`turn-check`, `heartbeat`) never fire.
//
// Python patches `_chat_history_base._default_runner`. The TS twin builds its
// hooks (inside `main()` → `_register_chat_history_hooks`) with the default
// runner, whose only subprocess boundary is `spawnSync` from `node:child_process`
// inside `_default_runner`. We intercept exactly there with `vi.mock`, capturing
// every argv and returning exit 0 — no real subprocess, no python3 spawned. The
// memory step's lazy `memory_lookup.retrieve` seam is stubbed via `_setRetrieve`
// (the TS mirror of the Python `fake_memory_lookup` fixture).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture log shared with the mocked spawnSync (declared before the hoisted
// vi.mock factory references it via the module-scope binding).
const capturedCommands: string[][] = [];

vi.mock('node:child_process', async (importOriginal) => {
    const actual = await importOriginal<typeof import('node:child_process')>();
    return {
        ...actual,
        spawnSync: (program: string, args: string[]) => {
            capturedCommands.push([program, ...(args ?? [])]);
            return { status: 0, stdout: '', stderr: '', signal: null, pid: 0, output: [] };
        },
    };
});

const { main } = await import(
    '../../../src/agent-src/templates/scripts/work_engine/cli.js'
);
const { _setRetrieve } = await import(
    '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js'
);

let tmp: string;

beforeEach(() => {
    capturedCommands.length = 0;
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'chat-history-int-'));
    // Mirror the Python fake_memory_lookup fixture: retrieve returns nothing.
    _setRetrieve(() => []);
});

afterEach(() => {
    _setRetrieve(null);
    fs.rmSync(tmp, { recursive: true, force: true });
});

function settingsWithChatHistory(script: string): string {
    const cfg = path.join(tmp, '.agent-settings.yml');
    fs.writeFileSync(
        cfg,
        [
            'hooks:',
            '  enabled: true',
            '  trace: false',
            '  halt_surface_audit: false',
            '  state_shape_validation: false',
            '  directive_set_guard: false',
            '  chat_history:',
            '    enabled: true',
            `    script: ${script}`,
            'chat_history:',
            '  enabled: true',
            '',
        ].join('\n'),
        'utf-8',
    );
    return cfg;
}

function wellFormedTicket(): string {
    const ticket = path.join(tmp, 'ticket.json');
    fs.writeFileSync(
        ticket,
        JSON.stringify({
            id: 'TICKET-99',
            title: 'Add export button',
            acceptance_criteria: [
                'Users can trigger CSV export from the dashboard.',
                'The export includes every visible column.',
            ],
        }),
        'utf-8',
    );
    return ticket;
}

describe('chat-history hooks — one dispatch cycle through main()', () => {
    it('fires phase appends per step boundary + a decision append on halt', () => {
        const script = path.join(tmp, 'chat_history.py');
        fs.writeFileSync(script, '# stub', 'utf-8');
        const cfg = settingsWithChatHistory(script);
        const stateFile = path.join(tmp, 'state.json');

        const exitCode = main([
            '--state-file',
            stateFile,
            '--ticket-file',
            wellFormedTicket(),
            '--hooks-config',
            cfg,
        ]);

        // First cycle halts BLOCKED at create-plan (agent must resume).
        expect(exitCode).toBe(1);
        expect(fs.existsSync(stateFile)).toBe(true);

        // Only chat-history subprocess invocations matter; the sub-command is at
        // argv index 2 (python3, <script>, <sub-command>, ...).
        const subCommands = capturedCommands.filter((c) => c.length > 2).map((c) => c[2]);
        // No cooperative hooks fire — they were removed.
        expect(subCommands).not.toContain('turn-check');
        expect(subCommands).not.toContain('heartbeat');

        // refine + memory + analyze succeeded before plan blocked → 3 phase
        // appends + 1 decision append for the create-plan halt.
        const appendCalls = capturedCommands.filter((c) => c.length > 2 && c[2] === 'append');
        expect(appendCalls.length).toBeGreaterThanOrEqual(3);

        const typesSeen: string[] = [];
        for (const call of appendCalls) {
            const idx = call.indexOf('--type');
            if (idx !== -1 && idx + 1 < call.length) {
                typesSeen.push(call[idx + 1] as string);
            }
        }
        expect(typesSeen.filter((t) => t === 'phase').length).toBeGreaterThanOrEqual(3);
        expect(typesSeen.filter((t) => t === 'decision').length).toBeGreaterThanOrEqual(1);
    });
});
