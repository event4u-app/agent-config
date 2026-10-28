import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import { INTAKE_LINE, isTaskPrompt, main } from '../../src/scripts/hooks/intake_pass_hook.js';

function run(prompt: string, event = 'user_prompt_submit'): { rc: number; out: string } {
    let out = '';
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
        out += String(chunk);
        return true;
    });
    setHookStdinOverride(JSON.stringify({ event, payload: { prompt } }));
    try {
        return { rc: main(), out };
    } finally {
        spy.mockRestore();
        clearHookStdinOverride();
    }
}

afterEach(() => {
    delete process.env['AGENT_CONFIG_NO_INTAKE_PASS'];
});

describe('intake-pass — which prompts are tasks (OQ-25)', () => {
    it.each([
        'Baue einen CSV-Export für die Rechnungsliste mit Filter nach Monat',
        'Add a retry with backoff to the webhook sender and cover it with a test',
        'Refactor the invoice service so totals are computed in one place',
    ])('fires on a task prompt: %s', (prompt) => {
        expect(isTaskPrompt(prompt)).toBe(true);
    });

    it.each([
        ['a question', 'Warum ist das kein conventional commit, bzw. pr?'],
        ['a continuation', 'mach weiter wo du warst, genau an den stellen, mit den subagents'],
        ['an option pick', '2'],
        ['a short reply', 'ja passt so'],
        ['a slash command', '/roadmap:process-full agents/roadmaps/foo.md and then open the pr'],
        ['an explicit interview request', 'Plan the billing export with me and interview me before you start'],
        ['a release from questions', 'Rename the config key everywhere, just do it without asking'],
        ['a harness turn', '<task-notification>task finished with output and many more words here</task-notification>'],
    ])('stays silent on %s', (_label, prompt) => {
        expect(isTaskPrompt(prompt)).toBe(false);
    });
});

describe('intake-pass — emission', () => {
    it('injects the intake line on a task prompt and only there', () => {
        const fired = run('Add a retry with backoff to the webhook sender and cover it with a test');
        expect(fired.rc).not.toBe(0);
        const payload = JSON.parse(fired.out.trim());
        expect(payload.additional_context).toBe(INTAKE_LINE);
        expect(Buffer.byteLength(fired.out, 'utf8')).toBeLessThan(1024);

        expect(run('Warum schlägt der Test fehl?')).toEqual({ rc: 0, out: '' });
    });

    it('never rewrites the prompt — the line names the pass, not "interview me"', () => {
        expect(INTAKE_LINE).not.toMatch(/interview me/i);
        expect(INTAKE_LINE).toMatch(/owner-owned gap/);
    });

    it('is silent on other events and under the kill switch', () => {
        const task = 'Add a retry with backoff to the webhook sender and cover it with a test';
        expect(run(task, 'stop')).toEqual({ rc: 0, out: '' });
        process.env['AGENT_CONFIG_NO_INTAKE_PASS'] = '1';
        expect(run(task)).toEqual({ rc: 0, out: '' });
    });
});
