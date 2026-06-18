// Pure-TS gap coverage for the CLI-layer hook surface — ported from the python
// spec `tests/work_engine/test_cli_hooks.py`. No python3, no golden oracle:
// drive `main()` in-process and assert the HookHalt-per-event → exit-code
// table directly.
//
// Python patches `work_engine.cli._build_hook_registry` (monkeypatch) and stubs
// `memory_lookup.retrieve` (the `fake_memory_lookup` fixture). The TS twin
// mirrors both: `vi.mock('hook_bootstrap.js')` injects a controllable factory
// (`setRegistryFactory`), and `_setRetrieve` (the established memory seam) plays
// the role of `fake_memory_lookup`. stdout/stderr are captured by spying on
// `process.stdout.write` / `process.stderr.write` (the `capsys` analogue).
//
// The `test_build_hook_registry_*` settings-driven cases from the python spec
// are already covered pure-TS in `hook_bootstrap.test.ts`; this file covers the
// `main()`-driven branch table that file does not.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
    HookContext,
    HookEvent,
    HookHalt,
    HookRegistry,
} from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';

// Mutable factory the mocked `_build_hook_registry` delegates to. Declared
// before the hoisted vi.mock factory references it via the module-scope binding.
type RegistryFactory = (args: unknown) => HookRegistry;
let registryFactory: RegistryFactory = () => new HookRegistry();
function setRegistryFactory(fn: RegistryFactory): void {
    registryFactory = fn;
}

vi.mock(
    '../../../src/agent-src/templates/scripts/work_engine/hook_bootstrap.js',
    async (importOriginal) => {
        const actual =
            await importOriginal<
                typeof import('../../../src/agent-src/templates/scripts/work_engine/hook_bootstrap.js')
            >();
        return {
            ...actual,
            _build_hook_registry: (args: unknown) => registryFactory(args),
        };
    },
);

const { main } = await import(
    '../../../src/agent-src/templates/scripts/work_engine/cli.js'
);
const { _build_hook_registry } = await import(
    '../../../src/agent-src/templates/scripts/work_engine/hook_bootstrap.js'
);
const { _setRetrieve } = await import(
    '../../../src/agent-src/templates/scripts/work_engine/directives/backend/memory.js'
);

let tmp: string;
let outChunks: string[];
let errChunks: string[];
const restores: Array<() => void> = [];

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-hooks-'));
    // Mirror the python fake_memory_lookup fixture: retrieve returns nothing.
    _setRetrieve(() => []);
    outChunks = [];
    errChunks = [];
    const outSpy = vi
        .spyOn(process.stdout, 'write')
        .mockImplementation(((chunk: string | Uint8Array): boolean => {
            outChunks.push(String(chunk));
            return true;
        }) as typeof process.stdout.write);
    const errSpy = vi
        .spyOn(process.stderr, 'write')
        .mockImplementation(((chunk: string | Uint8Array): boolean => {
            errChunks.push(String(chunk));
            return true;
        }) as typeof process.stderr.write);
    restores.push(() => outSpy.mockRestore(), () => errSpy.mockRestore());
});

afterEach(() => {
    for (const restore of restores.splice(0)) restore();
    _setRetrieve(null);
    registryFactory = () => new HookRegistry();
    fs.rmSync(tmp, { recursive: true, force: true });
});

function writeTicket(): string {
    const ticket = path.join(tmp, 'ticket.json');
    fs.writeFileSync(
        ticket,
        JSON.stringify({
            id: 'HOOK-1',
            title: 'Wire CLI hooks',
            acceptance_criteria: ['CLI fires the six lifecycle events.'],
        }),
        'utf-8',
    );
    return ticket;
}

/**
 * Seed `registryFactory` with recorder hooks for the given events; each records
 * its firing into `trace` and, when a halt is supplied, raises it. Mirrors the
 * python `_install_hooks`.
 */
function installHooks(
    events: Partial<Record<keyof typeof HookEvent, HookHalt | null>>,
): Array<[string, string]> {
    const trace: Array<[string, string]> = [];
    setRegistryFactory(() => {
        const registry = new HookRegistry();
        for (const [name, halt] of Object.entries(events)) {
            const ev = HookEvent[name as keyof typeof HookEvent];
            registry.register(ev, (_ctx: HookContext) => {
                trace.push(['trace', ev]);
                if (halt) throw halt;
            });
        }
        return registry;
    });
    return trace;
}

describe('cli hooks — default registry', () => {
    it('build_hook_registry returns an empty registry by default', () => {
        // Real (un-mocked behaviour): a Namespace with no settings → empty.
        const registry = _build_hook_registry({} as never);
        expect(registry).toBeInstanceOf(HookRegistry);
        expect([...registry.events()]).toEqual([]);
    });
});

describe('cli hooks — runner threaded through dispatch', () => {
    it('same registry powers both CLI and dispatcher events, in order', () => {
        const trace = installHooks({
            BEFORE_LOAD: null,
            AFTER_LOAD: null,
            BEFORE_DISPATCH: null,
            BEFORE_STEP: null,
            AFTER_DISPATCH: null,
            BEFORE_SAVE: null,
            AFTER_SAVE: null,
        });

        main([
            '--state-file',
            path.join(tmp, 'state.json'),
            '--ticket-file',
            writeTicket(),
        ]);

        const fired = trace.map(([, ev]) => ev);
        // CLI events fire in declared order, dispatcher events fire in between.
        expect(fired.slice(0, 2)).toEqual([HookEvent.BEFORE_LOAD, HookEvent.AFTER_LOAD]);
        expect(fired[2]).toBe(HookEvent.BEFORE_DISPATCH);
        // At least one BEFORE_STEP between BEFORE_DISPATCH and AFTER_DISPATCH.
        const before = fired.indexOf(HookEvent.BEFORE_DISPATCH);
        const after = fired.indexOf(HookEvent.AFTER_DISPATCH);
        expect(fired.slice(before + 1, after)).toContain(HookEvent.BEFORE_STEP);
        // Save events fire after dispatch.
        expect(fired.slice(after + 1)).toEqual([
            HookEvent.BEFORE_SAVE,
            HookEvent.AFTER_SAVE,
        ]);
    });
});

describe('cli hooks — halt branch table (exit 2)', () => {
    const beforeSaveEvents: Array<keyof typeof HookEvent> = [
        'BEFORE_LOAD',
        'AFTER_LOAD',
        'BEFORE_DISPATCH',
        'AFTER_DISPATCH',
        'BEFORE_SAVE',
    ];

    for (const haltEvent of beforeSaveEvents) {
        it(`halt on ${haltEvent} → exit 2, no state persisted`, () => {
            const surface = ['> 1. Resolve the halt.', '> 2. Abort.'];
            const halt = new HookHalt('cli_test', surface);
            installHooks({ [haltEvent]: halt });

            const stateFile = path.join(tmp, 'state.json');
            const exitCode = main([
                '--state-file',
                stateFile,
                '--ticket-file',
                writeTicket(),
            ]);

            expect(exitCode).toBe(2);
            const err = errChunks.join('');
            for (const line of surface) expect(err).toContain(line);
            // Halt fired before _save → no state on disk.
            expect(fs.existsSync(stateFile)).toBe(false);
        });
    }

    it('halt on AFTER_SAVE → exit 2, state persisted', () => {
        const surface = ['> 1. Acknowledge persisted state.'];
        const halt = new HookHalt('after_save_test', surface);
        installHooks({ AFTER_SAVE: halt });

        const stateFile = path.join(tmp, 'state.json');
        const exitCode = main([
            '--state-file',
            stateFile,
            '--ticket-file',
            writeTicket(),
        ]);

        expect(exitCode).toBe(2);
        expect(errChunks.join('')).toContain(surface[0]);
        // Halt fired after _save → state IS persisted, valid JSON.
        expect(fs.existsSync(stateFile)).toBe(true);
        expect(JSON.parse(fs.readFileSync(stateFile, 'utf-8'))).toBeTruthy();
    });
});

describe('cli hooks — empty registry is byte-compatible with pre-P3', () => {
    it('default empty registry → exit 1, state exists, create-plan directive', () => {
        // No installHooks() → registryFactory stays the empty default.
        const stateFile = path.join(tmp, 'state.json');
        const exitCode = main([
            '--state-file',
            stateFile,
            '--ticket-file',
            writeTicket(),
        ]);

        expect(exitCode).toBe(1); // BLOCKED at create-plan, same as pre-P3.
        expect(fs.existsSync(stateFile)).toBe(true);
        expect(outChunks.join('')).toContain('@agent-directive: create-plan');
    });
});
