// Tests for work_engine/hook_bootstrap.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer).
//
// `hook_bootstrap.ts` assembles a HookRegistry from `.agent-settings.yml`. The
// registered callbacks are closures, so coverage is on the *per-event callback
// count* — the observable shape of the registry. Cases: --no-hooks (empty) and
// missing settings (empty).
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ParsedArgs } from '../../../src/agent-src/templates/scripts/work_engine/cli_args.js';
import { _build_hook_registry } from '../../../src/agent-src/templates/scripts/work_engine/hook_bootstrap.js';
import { HookEvent } from '../../../src/agent-src/templates/scripts/work_engine/hooks/index.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hb-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function baseArgs(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        state_file: '.work-state.json',
        ticket_file: null,
        prompt_file: null,
        diff_file: null,
        file_file: null,
        persona: null,
        no_hooks: false,
        hooks_config: null,
        ...over,
    };
}

const ALL_EVENTS = Object.values(HookEvent) as HookEvent[];

/** TS: per-event callback counts for the registry built from `args`. */
function tsCounts(args: ParsedArgs): Record<string, number> {
    const reg = _build_hook_registry(args);
    const out: Record<string, number> = {};
    for (const ev of ALL_EVENTS) {
        out[ev] = reg.for_event(ev).length;
    }
    return out;
}

describe('_build_hook_registry — local', () => {
    it('--no-hooks yields an empty registry', () => {
        const counts = tsCounts(baseArgs({ no_hooks: true }));
        expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    });

    it('missing settings file yields an empty registry', () => {
        const counts = tsCounts(baseArgs({ hooks_config: path.join(tmp, 'absent.yml') }));
        expect(Object.values(counts).every((n) => n === 0)).toBe(true);
    });
});
