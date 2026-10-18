/**
 * The procedure cursor in the `/work` engine (road-to-steps-the-skill-cannot-skip
 * Phase 5). One call checks the exit of step n and, when it is met, hands out
 * step n+1; a judgement step waits for an explicit confirmation; a resumed
 * `SUCCESS` is revalidated against its inputs; the cursor can be switched off
 * and reads its sidecar and its state file as untrusted input.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { KNOWN_INPUT_KINDS } from '../../../src/agent-src/templates/scripts/work_engine/state.js';
import {
    PROCEDURE_KILL_SWITCH,
    run_procedure,
    type ProcedureRunOptions,
} from '../../../src/agent-src/templates/scripts/work_engine/procedure/run.js';
import {
    PROCEDURE_CHECK_INPUTS,
    registeredCheckIds,
} from '../../../src/agent-src/templates/scripts/work_engine/procedure/checks.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const PROCEDURE_SRC = path.join(REPO, 'src', 'agent-src', 'templates', 'scripts', 'work_engine', 'procedure');

let project: string;
let skills: string;

const SIDECAR = [
    'schema_version: 1',
    'brief:',
    '  goal: Write a, decide, maybe write c, write d.',
    '  inputs: [the project tree]',
    '  done_when: out/d.txt exists.',
    'steps:',
    '  - id: write-a',
    '    file: references/steps/01-a.md',
    "    exit: 'exists: out/a.txt'",
    '  - id: decide',
    '    file: references/steps/02-decide.md',
    '    exit: judgement',
    '  - id: maybe',
    '    file: references/steps/03-maybe.md',
    "    exit: 'exists: out/c.txt'",
    "    when: 'file-exists: enable-c'",
    '  - id: write-d',
    '    file: references/steps/04-d.md',
    "    exit: 'exists: out/d.txt'",
    '',
].join('\n');

function writeSkill(name: string, sidecar: string, extra: Record<string, string> = {}): void {
    const dir = path.join(skills, name);
    fs.mkdirSync(path.join(dir, 'references', 'steps'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `# ${name}\n`);
    fs.writeFileSync(path.join(dir, 'procedure.yaml'), sidecar);
    for (const f of ['01-a.md', '02-decide.md', '03-maybe.md', '04-d.md']) {
        fs.writeFileSync(path.join(dir, 'references', 'steps', f), `# ${f}\n`);
    }
    for (const [rel, body] of Object.entries(extra)) fs.writeFileSync(path.join(dir, rel), body);
}

function put(rel: string, body = 'x'): void {
    fs.mkdirSync(path.dirname(path.join(project, rel)), { recursive: true });
    fs.writeFileSync(path.join(project, rel), body);
}

function run(extra: Partial<ProcedureRunOptions> = {}): { code: number; output: string } {
    return run_procedure({ skill: 'demo', projectRoot: project, skillsRoot: skills, env: {}, ...extra });
}

function state(): Record<string, unknown> {
    return JSON.parse(fs.readFileSync(path.join(project, '.work-state.json'), 'utf8')) as Record<string, unknown>;
}

function stepRecord(id: string): Record<string, unknown> {
    const input = state()['input'] as { data: { steps: Record<string, Record<string, unknown>> } };
    return input.data.steps[id] as Record<string, unknown>;
}

beforeEach(() => {
    project = fs.mkdtempSync(path.join(os.tmpdir(), 'procedure-project-'));
    skills = fs.mkdtempSync(path.join(os.tmpdir(), 'procedure-skills-'));
    writeSkill('demo', SIDECAR);
});

afterEach(() => {
    fs.rmSync(project, { recursive: true, force: true });
    fs.rmSync(skills, { recursive: true, force: true });
});

describe('procedure cursor (5.2)', () => {
    it('procedure is an accepted input kind', () => {
        expect(KNOWN_INPUT_KINDS.has('procedure')).toBe(true);
    });

    it('one-call-per-step: a call checks step n and hands out step n+1 with the brief', () => {
        const first = run();
        expect(first.code).toBe(1);
        expect(first.output).toContain('step 1 of 4 (write-a)');
        expect(first.output).toContain('goal: Write a, decide, maybe write c, write d.');
        expect(first.output).toContain('remaining: decide, maybe, write-d');

        const unmet = run();
        expect(unmet.code).toBe(1);
        expect(unmet.output).toContain('exit not met');
        expect(unmet.output).toContain('out/a.txt');
        expect(unmet.output).toMatch(/failed_approaches: .*out\/a\.txt/);

        put('out/a.txt');
        const next = run();
        expect(next.code).toBe(1);
        expect(next.output).toContain('step 2 of 4 (decide)');
        expect(stepRecord('write-a')['status']).toBe('ok');
    });
});

describe('judgement exits (5.7)', () => {
    it('judgement-adjudication: only an explicit confirmation of that step clears it, and it is recorded', () => {
        put('out/a.txt');
        run();
        run();
        const waiting = run();
        expect(waiting.code).toBe(1);
        expect(waiting.output).toContain('sequenced, not verified');
        expect(waiting.output).toContain('--procedure-confirm decide');

        expect(run({ confirm: 'write-d' }).code).toBe(2);

        const cleared = run({ confirm: 'decide' });
        expect(cleared.code).toBe(1);
        const adjudication = stepRecord('decide')['adjudication'] as Record<string, unknown>;
        expect(adjudication['answer']).toBe('confirmed');
        expect(adjudication['by']).toBe('operator');
        expect(typeof adjudication['at']).toBe('string');
        expect(stepRecord('maybe')['status']).toBe('skipped');
        expect(String(stepRecord('maybe')['reason'])).toContain('file-exists: enable-c');
        expect(cleared.output).toContain('step 4 of 4 (write-d)');

        put('out/d.txt');
        const done = run();
        expect(done.code).toBe(0);
        expect(done.output).toContain('procedure demo complete');
    });

    it('judgement-adjudication: nobody answering leaves the step where it is, never advanced', () => {
        put('out/a.txt');
        run();
        run();
        for (let i = 0; i < 3; i += 1) expect(run().output).toContain('step 2 of 4 (decide)');
        expect(stepRecord('decide')['adjudication']).toBeUndefined();
    });
});

describe('resume revalidation (5.3)', () => {
    it('stale-after-input-change: a changed input marks the step stale and re-checks only its exit', () => {
        put('out/a.txt', 'one');
        run();
        run();
        expect(stepRecord('write-a')['status']).toBe('ok');

        put('out/a.txt', 'two');
        const revalidated = run();
        expect(revalidated.output).toContain('revalidated: write-a');
        expect(revalidated.output).toContain('step 2 of 4 (decide)');
        expect(revalidated.output).not.toContain('step 1 of 4');
        expect(stepRecord('write-a')['status']).toBe('ok');

        fs.rmSync(path.join(project, 'out', 'a.txt'));
        const stale = run();
        expect(stale.code).toBe(1);
        expect(stale.output).toContain('stale');
        expect(stale.output).toContain('write-a');
        expect(stepRecord('write-a')['status']).toBe('stale');
    });

    it('stale-after-input-change: an edited step file marks a confirmed judgement stale', () => {
        put('out/a.txt');
        run();
        run();
        run({ confirm: 'decide' });
        fs.writeFileSync(path.join(skills, 'demo', 'references', 'steps', '02-decide.md'), '# changed\n');
        const out = run();
        expect(out.code).toBe(1);
        expect(out.output).toContain('stale');
        expect(out.output).toContain('--procedure-confirm decide');
        expect(stepRecord('decide')['status']).toBe('stale');
    });
});

describe('kill switch and state integrity (5.8)', () => {
    it('kill-switch-refuses: the switch refuses activation and writes nothing', () => {
        const out = run({ env: { [PROCEDURE_KILL_SWITCH]: '1' } });
        expect(out.code).toBe(2);
        expect(out.output).toContain(PROCEDURE_KILL_SWITCH);
        expect(fs.existsSync(path.join(project, '.work-state.json'))).toBe(false);
    });

    it('kill-switch-refuses: a state file bound to another skill fails closed until an explicit restart', () => {
        run();
        writeSkill('other', SIDECAR);
        const bound = run({ skill: 'other' });
        expect(bound.code).toBe(2);
        expect(bound.output).toContain('--procedure-restart');
        expect(run({ skill: 'other', restart: true }).code).toBe(1);
    });

    it('kill-switch-refuses: a state file holding another kind of run is not overwritten', () => {
        const prompt = { version: 1, input: { kind: 'prompt', data: { raw: 'x' } } };
        fs.writeFileSync(path.join(project, '.work-state.json'), JSON.stringify(prompt));
        expect(run().code).toBe(2);
        expect(JSON.parse(fs.readFileSync(path.join(project, '.work-state.json'), 'utf8'))).toEqual(prompt);
    });

    it('kill-switch-refuses: a step file that is a symlink out of the skill is refused', () => {
        const outside = path.join(project, 'secret.md');
        fs.writeFileSync(outside, 'secret');
        const step = path.join(skills, 'demo', 'references', 'steps', '01-a.md');
        fs.rmSync(step);
        fs.symlinkSync(outside, step);
        const out = run();
        expect(out.code).toBe(2);
        expect(out.output).toContain('symlink');
    });

    it('kill-switch-refuses: an oversized or unknown-key sidecar is refused', () => {
        writeSkill('demo', SIDECAR + `# ${'x'.repeat(70_000)}\n`);
        expect(run().code).toBe(2);
        writeSkill('demo', SIDECAR.replace('schema_version: 1', 'schema_version: 1\nnext: other-skill'));
        expect(run().code).toBe(2);
    });

    it('kill-switch-refuses: a corrupted procedure record fails closed', () => {
        run();
        const s = state();
        (s['input'] as { data: Record<string, unknown> }).data['steps'] = 'not a map';
        fs.writeFileSync(path.join(project, '.work-state.json'), JSON.stringify(s));
        expect(run().code).toBe(2);
    });
});

describe('bounds (5.6)', () => {
    it('bounds-no-shell-no-subagent: the cursor module starts no process, thread, timer or subagent', () => {
        for (const f of fs.readdirSync(PROCEDURE_SRC).filter((x) => x.endsWith('.ts'))) {
            const src = fs.readFileSync(path.join(PROCEDURE_SRC, f), 'utf8');
            for (const banned of ['child_process', 'worker_threads', 'spawn(', 'execSync', 'execFile', 'setInterval', 'setTimeout', 'eval(', 'new Function']) {
                expect(src.includes(banned), `${f} contains ${banned}`).toBe(false);
            }
        }
    });

    it('bounds-no-shell-no-subagent: a command string in an exit is refused and never runs', () => {
        writeSkill('demo', SIDECAR.replace("exit: 'exists: out/a.txt'", "exit: 'check: $(touch pwned)'"));
        expect(run().code).toBe(2);
        expect(fs.existsSync(path.join(project, 'pwned'))).toBe(false);
    });

    it('bounds-no-shell-no-subagent: one call runs at most one exit check and one hand-out, then returns', () => {
        put('out/a.txt');
        put('out/d.txt');
        run();
        const out = run();
        expect(out.output.match(/step \d+ of 4/g)).toHaveLength(1);
    });

    it('every registered check declares the inputs it reads', () => {
        expect(Object.keys(PROCEDURE_CHECK_INPUTS).sort()).toEqual([...registeredCheckIds()].sort());
    });
});
