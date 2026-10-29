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
        // Council round 1: a leading acknowledgement does not make a task a continuation.
        'Go ahead and implement the retry policy described in this ticket',
        'ok, then build the CSV export with a month filter',
        // A non-interrogative-leading embedded question followed by an instruction is a task.
        'The export is slow? Add an index on invoices.created_at and measure it',
        'Add a retry with backoff to the webhook sender.\nCover it with a test and update the changelog.',
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
        // Deliberate: a polite request phrased as a question is answered or clarified
        // first (rule question-not-instruction), so the pass does not fire on it.
        ['a question-form request', 'Could you add retries to the webhook sender and tests for them?'],
        ['a question with a trailing qualifier', 'Why is the webhook sender failing on staging? Please explain'],
        ['a punctuation-free German question', 'Warum schlägt der Export auf Staging immer wieder fehl'],
        // Council round 3 follow-ups: both boundaries are deliberate and pinned here.
        ['an interrogative start followed by an instruction', 'Why is the export slow? Add an index and measure it'],
        ['a resume prefix carrying a further task', 'continue with the roadmap and also add a CSV export for invoices'],
        ['a resume order of any length', 'continue with the next roadmap step and keep the same branch as before'],
        ['a release phrased differently', "Rename the config key everywhere and don't ask me anything"],
        ['a German release', 'Benenne den Schlüssel überall um, ohne Rückfragen und ohne Pause'],
        ['a harness turn','<task-notification>task finished with output and many more words here</task-notification>'],
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
