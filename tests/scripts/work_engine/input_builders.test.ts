// Tests for work_engine/input_builders.ts (ADR-096 py2ts Phase 1 —
// work_engine TOP/integration layer).
//
// Exercises the `_load_or_build` dispatch paths (existing state file → _load,
// mutual exclusion, no-input, ticket non-object) for behaviour.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ParsedArgs } from '../../../src/agent-src/templates/scripts/work_engine/cli_args.js';
import { _CLIError } from '../../../src/agent-src/templates/scripts/work_engine/errors.js';
import { _load_or_build } from '../../../src/agent-src/templates/scripts/work_engine/input_builders.js';
import { dump } from '../../../src/agent-src/templates/scripts/work_engine/state.js';

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ib-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function baseArgs(over: Partial<ParsedArgs> = {}): ParsedArgs {
    return {
        state_file: path.join(tmp, '.work-state.json'),
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

describe('_load_or_build — dispatch behaviour', () => {
    it('loads an existing state file (format-preserving)', () => {
        // Build a v0 ticket state first, then re-load it.
        const tf = path.join(tmp, 't.json');
        fs.writeFileSync(tf, JSON.stringify({ id: 'T', title: 'x' }), 'utf-8');
        const sf = path.join(tmp, '.work-state.json');
        const [built, fmt] = _load_or_build(sf, baseArgs({ state_file: sf, ticket_file: tf }));
        expect(fmt).toBe('v0');
        dump(built, sf);
        const [loaded, fmt2] = _load_or_build(sf, baseArgs({ state_file: sf }));
        // Round-trip: a v0 file persisted via dump becomes v1 (dump always
        // writes the v1 envelope); _load re-reads it as v1.
        expect(fmt2).toBe('v1');
        expect(loaded.input.kind).toBe('ticket');
    });

    it('rejects two input flags as mutually exclusive', () => {
        const a = path.join(tmp, 'a.json');
        const b = path.join(tmp, 'b.txt');
        fs.writeFileSync(a, '{}', 'utf-8');
        fs.writeFileSync(b, 'p', 'utf-8');
        expect(() =>
            _load_or_build(path.join(tmp, 'none.json'), baseArgs({ ticket_file: a, prompt_file: b })),
        ).toThrow(_CLIError);
    });

    it('rejects no input when no state file exists', () => {
        expect(() => _load_or_build(path.join(tmp, 'none.json'), baseArgs())).toThrow(_CLIError);
    });

    it('rejects a non-object ticket file', () => {
        const tf = path.join(tmp, 'arr.json');
        fs.writeFileSync(tf, '[1, 2, 3]', 'utf-8');
        expect(() =>
            _load_or_build(path.join(tmp, 'none.json'), baseArgs({ ticket_file: tf })),
        ).toThrow(_CLIError);
    });
});
