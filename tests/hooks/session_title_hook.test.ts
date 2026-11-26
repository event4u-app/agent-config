import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { clearHookStdinOverride, setHookStdinOverride } from '../../src/scripts/hooks/hook_stdin.js';
import { main, tick } from '../../src/scripts/hooks/session_title_hook.js';
import {
    MILESTONES,
    effectiveTitle,
    isMilestone,
    readHostTitles,
    readState,
    sidecarPath,
    writeRefinedTitle,
} from '../../src/scripts/_lib/session_title.js';
import { cmd_session_title } from '../../src/scripts/session_title_cli.js';

let tmp: string;
let root: string;
let transcript: string;
const SID = 'abc-123';

function line(o: Record<string, unknown>): string {
    return `${JSON.stringify(o)}\n`;
}

function transcriptWith(...lines: Record<string, unknown>[]): void {
    fs.writeFileSync(transcript, lines.map(line).join(''));
}

/** Count `n` real prompts, returning every nudge emitted. */
function prompts(n: number): (string | null)[] {
    const out: (string | null)[] = [];
    for (let i = 0; i < n; i++) out.push(tick({ sessionId: SID, transcriptPath: transcript, prompt: `task ${i}`, root }));
    return out;
}

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'session-title-'));
    root = path.join(tmp, 'event4u');
    vi.stubEnv('EVENT4U_CONFIG_HOME', root);
    transcript = path.join(tmp, 'projects', 'p', `${SID}.jsonl`);
    fs.mkdirSync(path.dirname(transcript), { recursive: true });
    transcriptWith({ type: 'user', cwd: tmp }, { type: 'ai-title', aiTitle: 'Fix stuff', sessionId: SID });
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
    vi.unstubAllEnvs();
});

describe('isMilestone', () => {
    it('fires on each listed milestone and then on the repeat cadence, nowhere else', () => {
        const fired = Array.from({ length: 400 }, (_, i) => i + 1).filter(isMilestone);
        const last = MILESTONES[MILESTONES.length - 1] as number;
        expect(fired).toEqual([...MILESTONES, last + 100, last + 200, last + 300]);
    });
});

describe('tick', () => {
    it('nudges only at milestones, naming the current host title and the session id', () => {
        const out = prompts(MILESTONES[1] as number);
        const nudged = out.map((n, i) => (n === null ? null : i + 1)).filter((x) => x !== null);
        expect(nudged).toEqual([MILESTONES[0], MILESTONES[1]]);
        expect(out[(MILESTONES[0] as number) - 1]).toContain('«Fix stuff»');
        expect(out[(MILESTONES[0] as number) - 1]).toContain(`--session ${SID}`);
        expect(readState(SID, root)).toMatchObject({ prompts: MILESTONES[1], transcript_path: transcript });
    });

    it('shows the refined title, not the host one, once the agent set one', () => {
        writeRefinedTitle(transcript, SID, 'Refactor billing export');
        const out = prompts(MILESTONES[0] as number);
        expect(out.at(-1)).toContain('«Refactor billing export»');
    });

    it('stays silent for good once the user renamed the session, but keeps counting', () => {
        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine', sessionId: SID }));
        expect(prompts(MILESTONES[2] as number).every((n) => n === null)).toBe(true);
        expect(readState(SID, root)?.prompts).toBe(MILESTONES[2]);
    });

    it('does not count harness turns as prompts', () => {
        for (let i = 0; i < 5; i++) tick({ sessionId: SID, transcriptPath: transcript, prompt: '<task-notification>x', root });
        expect(readState(SID, root)).toBeNull();
    });
});

describe('readHostTitles', () => {
    it('takes the last title of each kind, across read-chunk boundaries', () => {
        const filler = line({ type: 'assistant', text: 'x'.repeat(1024) }).repeat(1500);
        fs.writeFileSync(
            transcript,
            line({ type: 'ai-title', aiTitle: 'Old' }) + filler + line({ type: 'ai-title', aiTitle: 'New' }),
        );
        expect(fs.statSync(transcript).size).toBeGreaterThan(1 << 20);
        expect(readHostTitles(transcript)).toEqual({ custom: null, ai: 'New' });
    });
});

describe('main', () => {
    function run(workspace: string): { rc: number; out: string } {
        let out = '';
        const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
            out += String(chunk);
            return true;
        });
        setHookStdinOverride(
            JSON.stringify({
                event: 'user_prompt_submit',
                session_id: SID,
                workspace_root: workspace,
                payload: { prompt: 'add the export', transcript_path: transcript },
            }),
        );
        try {
            return { rc: main(), out };
        } finally {
            spy.mockRestore();
            clearHookStdinOverride();
        }
    }

    it('emits the nudge at a milestone by default, and nothing when sessions.auto_title is false', () => {
        const on =path.join(tmp, 'on');
        fs.mkdirSync(on);
        const outs = Array.from({ length: MILESTONES[0] as number }, () => run(on));
        expect(outs.at(-1)?.out).toContain('session-title: milestone');
        expect(outs.slice(0, -1).every((r) => r.out === '')).toBe(true);

        const off = path.join(tmp, 'off');
        fs.mkdirSync(off);
        fs.writeFileSync(path.join(off, '.agent-settings.yml'), 'sessions:\n  auto_title: false\n');
        fs.rmSync(path.join(root, 'state'), { recursive: true, force: true });
        const silent = Array.from({ length: MILESTONES[1] as number }, () => run(off));
        expect(silent.every((r) => r.out === '')).toBe(true);
    });
});

describe('session:title CLI', () => {
    function cli(...argv: string[]): { rc: number; out: string[] } {
        const out: string[] = [];
        const rc = cmd_session_title(argv, { cwd: tmp, root, out: (l) => out.push(l), err: (l) => out.push(l) });
        return { rc, out };
    }

    it('publishes a refined title the readers prefer over the host title, revision by revision', () => {
        prompts(1);
        expect(cli('--session', SID, 'Billing', 'export').rc).toBe(0);
        expect(cli('--session', SID, 'Billing CSV export').out[0]).toContain('revision 2');
        expect(JSON.parse(fs.readFileSync(sidecarPath(transcript), 'utf8'))).toMatchObject({ title: 'Billing CSV export', revision: 2 });
        expect(effectiveTitle(transcript)).toEqual({ title: 'Billing CSV export', source: 'refined' });
    });

    it('never overrides a title the user set', () => {
        prompts(1);
        fs.appendFileSync(transcript, line({ type: 'custom-title', customTitle: 'Mine' }));
        const r = cli('--session', SID, 'Something else');
        expect(r.rc).toBe(0);
        expect(r.out[0]).toContain('final');
        expect(fs.existsSync(sidecarPath(transcript))).toBe(false);
        expect(effectiveTitle(transcript)).toEqual({ title: 'Mine', source: 'custom' });
    });

    it('fails with a hint when the session is unknown, and rejects a missing title', () => {
        expect(cli('--session', 'nope', 'x').rc).toBe(1);
        prompts(1);
        expect(cli('--session', SID).rc).toBe(2);
    });
});
