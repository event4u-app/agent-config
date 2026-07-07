import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import * as run from '../../src/scripts/bench_ab_v2_run';

// CI runners have no codex binary; codex_executable() checks the CODEX_CLI
// env FIRST, so pointing it at the node executable (exists everywhere)
// makes the stubbed-spawn tests host-independent.
let savedCodexCli: string | undefined;
beforeAll(() => {
    savedCodexCli = process.env['CODEX_CLI'];
    process.env['CODEX_CLI'] = process.execPath;
});
afterAll(() => {
    if (savedCodexCli === undefined) {
        delete process.env['CODEX_CLI'];
    } else {
        process.env['CODEX_CLI'] = savedCodexCli;
    }
});

const EVENTS_OK = [
    '{"type":"turn.started"}',
    '{"type":"item.completed","item":{"type":"agent_message","text":"Edited util.js as requested."}}',
    '{"type":"turn.completed","usage":{"input_tokens":1200,"cached_input_tokens":300,"output_tokens":80}}',
    'not-json noise line',
    '{"type":"item.completed","item":{"type":"agent_message","text":"Done."}}',
    '{"type":"turn.completed","usage":{"input_tokens":900,"output_tokens":40}}',
].join('\n');

const EVENTS_FAILED = [
    '{"type":"turn.failed","error":{"message":"Your access token could not be refreshed."}}',
].join('\n');

describe('parse_codex_events', () => {
    it('sums nested token usage across turns and collects agent messages', () => {
        const parsed = run.parse_codex_events(EVENTS_OK);
        expect(parsed.tokens).toBe(1200 + 300 + 80 + 900 + 40);
        expect(parsed.num_turns).toBe(2);
        expect(parsed.transcript).toContain('Edited util.js');
        expect(parsed.failed).toBeNull();
    });

    it('surfaces turn.failed as the failure reason', () => {
        const parsed = run.parse_codex_events(EVENTS_FAILED);
        expect(parsed.failed).toContain('access token');
    });
});

describe('codex_prompt', () => {
    it('prepends injected rules in a marked block; vanilla passes through', () => {
        expect(run.codex_prompt(null, 'do the task')).toBe('do the task');
        const p = run.codex_prompt('RULE BODY', 'do the task');
        expect(p.indexOf('<project-instructions>')).toBe(0);
        expect(p).toContain('RULE BODY');
        expect(p.endsWith('do the task')).toBe(true);
    });
});

describe('run_live_codex (stubbed spawn)', () => {
    const task = { id: 'trapE-scope-01', prompt: 'Fix the bug.' };

    it('maps a clean run to errored=false with summed tokens', () => {
        const r = run.run_live_codex(task, '/tmp', 60, {
            model: 'gpt-5-nano',
            inject_text: 'RULES',
            spawn: ((_bin: string, args: string[]) => {
                // model pin + prompt-injection reach the CLI invocation
                expect(args).toContain('-m');
                expect(args).toContain('gpt-5-nano');
                expect(args[args.length - 1]).toContain('<project-instructions>');
                return { status: 0, stdout: EVENTS_OK, stderr: '', error: undefined, signal: null };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
            }) as any,
        });
        expect(r['errored']).toBe(false);
        expect(r['tokens']).toBe(2520);
        expect(String(r['transcript'])).toContain('Edited util.js');
    });

    it('maps turn.failed / non-zero exit to errored=true', () => {
        const r = run.run_live_codex(task, '/tmp', 60, {
            model: null,
            inject_text: null,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            spawn: (() => ({ status: 1, stdout: EVENTS_FAILED, stderr: '', error: undefined, signal: null })) as any,
        });
        expect(r['errored']).toBe(true);
        expect(String(r['reason'])).toContain('access token');
    });
});

describe('--host codex arm validation', () => {
    it('CODEX_VALID_ARMS excludes plugin-dependent arms', () => {
        expect(run.CODEX_VALID_ARMS).toContain('vanilla');
        expect(run.CODEX_VALID_ARMS).toContain('rules-kernel-dc');
        expect(run.CODEX_VALID_ARMS).not.toContain('package');
        expect(run.CODEX_VALID_ARMS).not.toContain('package-rdp');
        expect(run.CODEX_VALID_ARMS).not.toContain('package-recursive');
    });

    it('main() refuses a plugin arm under --host codex', () => {
        const code = run.main([
            '--mode',
            'dry-run',
            '--host',
            'codex',
            '--arms',
            'vanilla,package',
        ]);
        expect(code).toBe(1);
    });

    it('main() dry-runs injection arms under --host codex', () => {
        const code = run.main([
            '--mode',
            'dry-run',
            '--host',
            'codex',
            '--arms',
            'vanilla,rules-kernel-dc',
            '--seeds',
            '3',
        ]);
        expect(code).toBe(0);
    });
});
