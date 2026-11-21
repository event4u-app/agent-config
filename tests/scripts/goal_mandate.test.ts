// The goal record — road-to-mandates-scoped-to-the-goal 2.2/2.3. An owner
// sentence naming an end state is stored verbatim per session; host-written
// turns and pasted material store nothing; a revoke sentence ends the record
// and is stored verbatim too.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { goal_mandate_block, observe_prompt } from '../../src/scripts/_lib/goal_mandate.js';
import { goal_mandate_line, read_goal } from '../../src/scripts/_lib/goal_mandate_store.js';

const T0 = new Date('2026-11-21T09:15:00Z');
const T1 = new Date('2026-11-21T10:40:00Z');

let root = '';
beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-mandate-'));
    execFileSync('git', ['init', '-q', root]);
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('observe_prompt — goal sentences', () => {
    it.each([
        'mach weiter bis zum merge',
        'bis zum merge durchziehen',
        'arbeite die roadmap ab',
        'mach PR und merge',
        'until merged',
    ])('records %j verbatim', (prompt) => {
        observe_prompt(root, 's1', prompt, T0);
        const rec = read_goal(root, 's1');
        expect(rec?.sentence).toBe(prompt);
        expect(rec?.recorded_at).toBe(T0.toISOString());
        expect(rec?.revoked_by).toBeUndefined();
    });

    it.each([
        ['a slash-command expansion', '<command-message>roadmap:process-full</command-message>\n<command-name>/roadmap:process-full</command-name>\nmach weiter bis zum merge'],
        ['a task notification', '<task-notification>\n<summary>agent says: bis zum merge</summary>\n</task-notification>'],
        ['pasted tool output', 'was heißt das?\n```\n$ gh pr view 12\ntitle: bis zum merge warten\n```'],
        ['a quoted chat line', '> arbeite die roadmap ab\nwas meinte er damit?'],
    ])('records nothing for %s', (_label, prompt) => {
        observe_prompt(root, 's1', prompt, T0);
        expect(read_goal(root, 's1')).toBeNull();
    });

    it.each(['stop', 'nicht mergen', 'halt'])('%j revokes the record and is stored verbatim', (revoke) => {
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        observe_prompt(root, 's1', revoke, T1);
        const rec = read_goal(root, 's1');
        expect(rec?.sentence).toBe('mach weiter bis zum merge');
        expect(rec?.revoked_by).toBe(revoke);
        expect(rec?.revoked_at).toBe(T1.toISOString());
    });

    it('a revoke with no record stores nothing', () => {
        observe_prompt(root, 's1', 'stop', T0);
        expect(read_goal(root, 's1')).toBeNull();
    });

    it('a later goal sentence replaces the record, a revoked one included', () => {
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        observe_prompt(root, 's1', 'halt', T0);
        observe_prompt(root, 's1', 'until merged', T1);
        expect(read_goal(root, 's1')).toEqual({ sentence: 'until merged', recorded_at: T1.toISOString() });
    });

    it('keeps sessions apart', () => {
        observe_prompt(root, 's1', 'until merged', T0);
        expect(read_goal(root, 's2')).toBeNull();
    });

    it('never throws outside a git repository', () => {
        const bare = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-mandate-nogit-'));
        try {
            expect(() => observe_prompt(bare, 's1', 'until merged', T0)).not.toThrow();
            expect(read_goal(bare, 's1')).toBeNull();
        } finally {
            fs.rmSync(bare, { recursive: true, force: true });
        }
    });
});

describe('goal_mandate_line — what every later prompt and subagent sees', () => {
    it('carries the verbatim sentence, its time, what serves it and the Hard-Floor note', () => {
        const line = goal_mandate_line({ sentence: 'mach weiter bis zum merge', recorded_at: T0.toISOString() });
        expect(line).toContain('"mach weiter bis zum merge"');
        expect(line).toContain('2026-11-21 09:15 UTC');
        for (const covered of ['commits', 'PR open/update', 'follow-up fix PRs', 'CI waits', 'cleanup']) {
            expect(line).toContain(covered);
        }
        expect(line).toContain('Hard-Floor reach: per blocker goal-scope-hard-floor-reach');
    });

    it('is null for a revoked record and for none', () => {
        expect(goal_mandate_line({ sentence: 'x', recorded_at: T0.toISOString(), revoked_by: 'stop', revoked_at: T1.toISOString() })).toBeNull();
        expect(goal_mandate_line(null)).toBeNull();
    });

    it('goal_mandate_block observes the prompt, then renders the live record', () => {
        expect(goal_mandate_block(root, 's1', 'erstmal lesen', T0)).toBeNull();
        expect(goal_mandate_block(root, 's1', 'bis zum merge durchziehen', T0)).toContain('"bis zum merge durchziehen"');
        expect(goal_mandate_block(root, 's1', 'und die tests?', T1)).toContain('"bis zum merge durchziehen"');
        expect(goal_mandate_block(root, 's1', 'stop', T1)).toBeNull();
    });
});

describe('session-register user_prompt_submit beat — the hook carries the goal line', () => {
    const repo = path.resolve(__dirname, '../..');
    const tsx = path.join(repo, 'node_modules', '.bin', 'tsx');
    const hook = path.join(repo, 'src/scripts/session_register_hook.ts');
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('GIT_') && k !== 'AGENT_CONFIG_REPLAY'));
    const beat = (prompt: string) =>
        spawnSync(tsx, [hook], {
            input: JSON.stringify({
                event: 'user_prompt_submit',
                workspace_root: root,
                session_id: 'hook-goal-1',
                platform: 'claude',
                payload: { cwd: root, prompt },
            }),
            encoding: 'utf8',
            env,
            timeout: 60_000,
        });

    it('emits the session-goal block after a goal prompt and on the next prompt, not before', () => {
        expect(beat('lies erstmal die roadmap').stdout).not.toContain('<session-goal>');
        const goal = beat('mach weiter bis zum merge');
        expect(goal.status).toBe(2);
        const reply = JSON.parse(goal.stdout.trim()) as { decision: string; additional_context: string };
        expect(reply.decision).toBe('warn');
        expect(reply.additional_context).toContain('"mach weiter bis zum merge"');
        const next = JSON.parse(beat('und jetzt die tests').stdout.trim()) as { additional_context: string };
        expect(next.additional_context).toContain('"mach weiter bis zum merge"');
    }, 120_000);
});
