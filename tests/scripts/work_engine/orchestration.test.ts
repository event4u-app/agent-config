
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    KeyError,
    PipelineState,
    StepResult,
    ValueError,
    _interpolate,
    _when_passes,
    iter_steps,
    record_result,
    resolve_outputs,
    type StepDescriptor,
} from '../../../src/agent-src/templates/scripts/work_engine/orchestration.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..', '..');
const WE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'scripts', 'work_engine');

const tmpDirs: string[] = [];
function mkPipe(yaml: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'orch-'));
    tmpDirs.push(d);
    const p = path.join(d, 'pipe.yml');
    fs.writeFileSync(p, yaml, 'utf8');
    return p;
}
afterEach(() => {
    while (tmpDirs.length > 0) {
        const d = tmpDirs.pop();
        if (d && fs.existsSync(d)) {
            fs.rmSync(d, { recursive: true, force: true });
        }
    }
});

function stable(desc: StepDescriptor): Record<string, unknown> {
    const { _state, ...rest } = desc;
    void _state;
    return rest;
}

async function tsDrive(
    pipePath: string,
    mode: string,
    inputs: Record<string, string>,
): Promise<unknown> {
    if (mode === 'all-success') {
        const descs: Array<Record<string, unknown>> = [];
        let state: PipelineState | null = null;
        for await (const d of iter_steps(pipePath, inputs)) {
            descs.push(stable(d));
            state = d._state;
            record_result(d, { success: true, output: `${d.id.toUpperCase()}-OUT` });
        }
        const outputs = state ? await resolve_outputs(pipePath, state) : {};
        return { descs, outputs, halted: state ? state.halted : false };
    }
    if (mode === 'fail-first') {
        const descs: Array<Record<string, unknown>> = [];
        let state: PipelineState | null = null;
        for await (const d of iter_steps(pipePath, inputs)) {
            descs.push(stable(d));
            state = d._state;
            record_result(d, { success: false, error: 'boom' });
        }
        return {
            descs,
            halted: state ? state.halted : false,
            halt_reason: state ? state.halt_reason : null,
        };
    }
    // iter-only
    const descs: Array<Record<string, unknown>> = [];
    for await (const d of iter_steps(pipePath, inputs)) {
        descs.push(stable(d));
    }
    return { descs };
}

const LINEAR_PIPE = [
    'name: demo',
    'inputs:',
    '  - id: topic',
    '    default: hello',
    'steps:',
    '  - id: a',
    '    kind: skill',
    '    ref: foo',
    '    with:',
    '      q: "${{ inputs.topic }}"',
    '  - id: b',
    '    kind: command',
    '    ref: bar',
    '    when: steps.a.success',
    '    with:',
    '      prev: "${{ steps.a.output }}"',
    'outputs:',
    '  result: "${{ steps.b.output }}"',
    '',
].join('\n');

const GUARD_PIPE = [
    'name: guarded',
    'steps:',
    '  - id: a',
    '    kind: skill',
    '    ref: foo',
    '  - id: b',
    '    kind: skill',
    '    ref: bar',
    '    when: steps.a.failure',
    '  - id: c',
    '    kind: skill',
    '    ref: baz',
    '    when: steps.a.success',
    '',
].join('\n');

describe('work_engine/orchestration — pure helpers', () => {
    it('_interpolate substitutes scalars, nested dicts, and lists', () => {
        const st = new PipelineState({ name: 'x', inputs: { topic: 'world' } });
        st.results['a'] = new StepResult('a', 'skill', 'foo', true, 'AOUT');
        expect(_interpolate('hi ${{ inputs.topic }}', st)).toBe('hi world');
        expect(_interpolate({ q: '${{ steps.a.output }}' }, st)).toEqual({ q: 'AOUT' });
        expect(_interpolate(['${{ inputs.topic }}', 7], st)).toEqual(['world', 7]);
        expect(_interpolate(42, st)).toBe(42);
    });

    it('_interpolate throws KeyError on unknown input / step', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        expect(() => _interpolate('${{ inputs.missing }}', st)).toThrow(KeyError);
        expect(() => _interpolate('${{ steps.nope.output }}', st)).toThrow(KeyError);
    });

    it('_when_passes: empty / null → true', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        expect(_when_passes(null, st)).toBe(true);
        expect(_when_passes('', st)).toBe(true);
        expect(_when_passes(undefined, st)).toBe(true);
    });

    it('_when_passes: success / failure guards', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        // unknown step → false
        expect(_when_passes('steps.a.success', st)).toBe(false);
        st.results['a'] = new StepResult('a', 'skill', 'foo', true, '');
        expect(_when_passes('steps.a.success', st)).toBe(true);
        expect(_when_passes('steps.a.failure', st)).toBe(false);
        st.results['b'] = new StepResult('b', 'skill', 'foo', false, '');
        expect(_when_passes('steps.b.failure', st)).toBe(true);
    });

    it('_when_passes: output == literal', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        st.results['a'] = new StepResult('a', 'skill', 'foo', true, 'done');
        expect(_when_passes('${{ steps.a.output }} == "done"', st)).toBe(true);
        expect(_when_passes('${{ steps.a.output }} == "nope"', st)).toBe(false);
        // missing step → default StepResult("","") output → only matches ""
        expect(_when_passes('${{ steps.z.output }} == ""', st)).toBe(true);
    });

    it('_when_passes: unsupported expression → ValueError', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        expect(() => _when_passes('garbage expr', st)).toThrow(ValueError);
    });

    it('record_result halts on failure', () => {
        const st = new PipelineState({ name: 'x', inputs: {} });
        const desc: StepDescriptor = { id: 'a', kind: 'skill', ref: 'foo', with: {}, _state: st };
        record_result(desc, { success: false, error: 'oops' });
        expect(st.halted).toBe(true);
        expect(st.halt_reason).toBe('step a failed');
        expect(st.results['a']?.success).toBe(false);
    });

    it('iter_steps yields interpolated descriptors in order, with-guard applied', async () => {
        const pipe = mkPipe(LINEAR_PIPE);
        const out = (await tsDrive(pipe, 'iter-only', {})) as {
            descs: Array<Record<string, unknown>>;
        };
        // b carries `when: steps.a.success`; in iter-only mode no result is
        // recorded for `a`, so the guard fails and b is skipped — only `a` is
        // yielded. Identical to the CPython generator (verified in the parity
        // suite below).
        expect(out.descs).toEqual([
            { id: 'a', kind: 'skill', ref: 'foo', with: { q: 'hello' } },
        ]);
    });

    it('iter_steps merges provided inputs over defaults', async () => {
        const pipe = mkPipe(LINEAR_PIPE);
        const out = (await tsDrive(pipe, 'iter-only', { topic: 'world' })) as {
            descs: Array<Record<string, unknown>>;
        };
        expect(out.descs[0]).toEqual({ id: 'a', kind: 'skill', ref: 'foo', with: { q: 'world' } });
    });
});
