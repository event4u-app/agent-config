// The goal record — road-to-mandates-scoped-to-the-goal 2.2/2.3. An owner
// sentence naming an end state is stored verbatim per session; host-written
// turns and pasted material store nothing; a revoke sentence ends the record
// and is stored verbatim too.
import { execFileSync, spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { release, tryAcquire } from '../../src/scripts/_lib/generation_lock.js';
import { goal_mandate_block, observe_prompt, write_stop } from '../../src/scripts/_lib/goal_mandate.js';
import { goal_mandate_for_subagent, goal_mandate_line, read_goal } from '../../src/scripts/_lib/goal_mandate_store.js';

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

    // Ratification round 2: a revoke against an empty store keeps a marker, so a
    // goal write from an earlier prompt that lands after it cannot arm a record.
    // Ratification round 12: a direct cancellation of the work in words ends the
    // goal on its turn, on a later neutral turn and for a fresh subagent.
    it.each(['Stop working on this PR.', 'Hör auf, daran weiterzuarbeiten.', 'bitte abbrechen', 'cancel that'])(
        '%j ends the goal everywhere',
        (cancel) => {
            const T2 = new Date('2026-11-21T11:00:00Z');
            observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
            expect(goal_mandate_block(root, 's1', cancel, T1)).toBeNull();
            expect(goal_mandate_block(root, 's1', 'und die tests', T2)).toBeNull();
            expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
        },
    );

    // Ratification round 13: the 300-character line cap binds the goal side only.
    it('a stop with a same-line explanation over 300 characters ends the goal everywhere', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const cancel = `Stop working on this PR, ${'because the approach is wrong and we need to rethink it '.repeat(7)}`;
        expect(cancel.length).toBeGreaterThan(300);
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        expect(goal_mandate_block(root, 's1', cancel, T1)).toBeNull();
        expect(goal_mandate_block(root, 's1', 'und die tests', T2)).toBeNull();
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
        expect((read_goal(root, 's1')?.revoked_by ?? '').length).toBeLessThanOrEqual(300);
    });

    it('a revoke with no record stores a marker that renders nothing', () => {
        observe_prompt(root, 's1', 'stop', T0);
        expect(read_goal(root, 's1')?.revoked_by).toBe('stop');
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    it('drops a goal write from a prompt older than the revocation already stored', () => {
        observe_prompt(root, 's1', 'stop', T1);
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    it('drops a goal write from a prompt older than the goal already stored', () => {
        observe_prompt(root, 's1', 'until merged', T1);
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        expect(read_goal(root, 's1')?.sentence).toBe('until merged');
    });

    // Ratification round 3: every newer stop advances the marker.
    it('a goal older than the latest of two stops is dropped (T1 stop, T3 stop, T2 goal)', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const T3 = new Date('2026-11-21T12:00:00Z');
        observe_prompt(root, 's1', 'stop', T1);
        observe_prompt(root, 's1', 'halt', T3);
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T2);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
        expect(read_goal(root, 's1')?.revoked_at).toBe(T3.toISOString());
    });

    // Ratification round 3: the read-compare-write runs under the record's lock.
    // Round 4: a contended goal write is dropped, a contended stop is not.
    it('writes no goal while another writer holds the record lock', () => {
        fs.mkdirSync(path.join(root, '.git', 'agent-session-mandates'), { recursive: true });
        const held = tryAcquire(path.join(root, '.git', 'agent-session-mandates', 's1.json.lock'), { staleMs: 60_000 });
        expect(held).not.toBeNull();
        try {
            observe_prompt(root, 's1', 'until merged', T0);
            expect(read_goal(root, 's1')).toBeNull();
        } finally {
            if (held) release(held);
        }
    });

    it('a stop submitted once under lock contention still ends the goal for a later subagent', () => {
        observe_prompt(root, 's1', 'until merged', T0);
        const held = tryAcquire(path.join(root, '.git', 'agent-session-mandates', 's1.json.lock'), { staleMs: 60_000 });
        expect(held).not.toBeNull();
        try {
            expect(goal_mandate_block(root, 's1', 'stop', T1)).toBeNull();
        } finally {
            if (held) release(held);
        }
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
    });

    it('a stop wins over a goal with the same stamp, stop first', () => {
        observe_prompt(root, 's1', 'stop', T1);
        observe_prompt(root, 's1', 'until merged', T1);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    it('a stop wins over a goal with the same stamp, goal first', () => {
        observe_prompt(root, 's1', 'until merged', T1);
        observe_prompt(root, 's1', 'stop', T1);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    // Round 5: a goal writer that read before a newer stop and writes after it —
    // the outcome of that interleaving is an older goal record on disk beside a
    // newer stop, and neither renderer may show it.
    it('a goal record older than a stored stop renders nowhere, even written after the stop', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const T3 = new Date('2026-11-21T12:00:00Z');
        observe_prompt(root, 's1', 'until merged', T0);
        observe_prompt(root, 's1', 'stop', T3);
        fs.writeFileSync(
            path.join(root, '.git', 'agent-session-mandates', 's1.json'),
            JSON.stringify({ sentence: 'mach weiter bis zum merge', recorded_at: T2.toISOString() }),
        );
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
        expect(goal_mandate_block(root, 's1', 'und die tests', T3)).toBeNull();
    });

    // Round 5: the stop stamp survives a store that refused new files for a while.
    it.skipIf(process.getuid?.() === 0)('an older goal written after the store recovers stays suppressed', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const T3 = new Date('2026-11-21T12:00:00Z');
        observe_prompt(root, 's1', 'until merged', T0);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        fs.chmodSync(dir, 0o555);
        try {
            observe_prompt(root, 's1', 'stop', T3);
        } finally {
            fs.chmodSync(dir, 0o755);
        }
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T2);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    // Round 7: an older goal writer that staged its temp file before the store
    // refused new files, and renames it over the record after the store recovers,
    // must not revive the goal the fallback stop revoked.
    it.skipIf(process.getuid?.() === 0)('a staged older goal renamed in after the fallback stop renders nowhere', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const T3 = new Date('2026-11-21T12:00:00Z');
        observe_prompt(root, 's1', 'until merged', T0);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        const staged = path.join(dir, 's1.json.staged');
        fs.writeFileSync(staged, JSON.stringify({ sentence: 'mach weiter bis zum merge', recorded_at: T2.toISOString() }));
        fs.chmodSync(dir, 0o555);
        try {
            observe_prompt(root, 's1', 'stop', T3);
        } finally {
            fs.chmodSync(dir, 0o755);
        }
        fs.renameSync(staged, path.join(dir, 's1.json'));
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
    });

    // Round 8: two stops in the slot — an older one that passed its freshness
    // check before a goal, paused, and wrote after a newer stop — keep the newer.
    it.skipIf(process.getuid?.() === 0)('a paused older stop written into the slot after a newer one keeps the newer', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        const T3 = new Date('2026-11-21T12:00:00Z');
        observe_prompt(root, 's1', 'until merged', T2);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        fs.chmodSync(dir, 0o555);
        try {
            observe_prompt(root, 's1', 'halt', T3);
            write_stop(path.join(dir, 's1.json'), 'stop', T1);
        } finally {
            fs.chmodSync(dir, 0o755);
        }
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
        expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
        expect(read_goal(root, 's1')?.revoked_at).toBe(T3.toISOString());
    });

    // Rounds 7, 9 and 10: said on the turn only when the store AND the user-level
    // fallback both refuse it, and the message says later readers may disagree.
    it.skipIf(process.getuid?.() === 0)('says so on the turn when a stop could be saved nowhere', () => {
        observe_prompt(root, 's1', 'until merged', T0);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-home-ro-'));
        const saved = process.env['EVENT4U_CONFIG_HOME'];
        for (const n of fs.readdirSync(dir)) fs.chmodSync(path.join(dir, n), 0o444);
        fs.chmodSync(dir, 0o555);
        fs.chmodSync(home, 0o555);
        process.env['EVENT4U_CONFIG_HOME'] = home;
        try {
            const block = goal_mandate_block(root, 's1', 'stop', T1);
            expect(block).toContain('could not be saved');
            expect(block).toContain('later turns and subagents may still show');
            expect(block).not.toContain('Owner goal');
        } finally {
            if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = saved;
            fs.chmodSync(home, 0o755);
            fs.rmSync(home, { recursive: true, force: true });
            fs.chmodSync(dir, 0o755);
            for (const n of fs.readdirSync(dir)) fs.chmodSync(path.join(dir, n), 0o644);
        }
    });

    // Rounds 9 and 10: a stop the store refuses entirely still holds on the next
    // turn and for a fresh subagent — through a user-level fallback, so a reader
    // whose temp root differs from the writer's still finds it.
    it.skipIf(process.getuid?.() === 0)('a stop the store refuses entirely holds on later turns and for subagents, whatever their temp root', () => {
        const T2 = new Date('2026-11-21T11:00:00Z');
        observe_prompt(root, 's1', 'until merged', T0);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-home-rw-'));
        const otherTmp = fs.mkdtempSync(path.join(os.tmpdir(), 'goal-tmp-other-'));
        const saved = { home: process.env['EVENT4U_CONFIG_HOME'], tmp: process.env['TMPDIR'] };
        for (const n of fs.readdirSync(dir)) fs.chmodSync(path.join(dir, n), 0o444);
        fs.chmodSync(dir, 0o555);
        process.env['EVENT4U_CONFIG_HOME'] = home;
        try {
            expect(goal_mandate_block(root, 's1', 'stop', T1)).toBeNull();
            process.env['TMPDIR'] = otherTmp;
            expect(goal_mandate_block(root, 's1', 'und die tests', T2)).toBeNull();
            expect(goal_mandate_for_subagent(root, 's1')).toBeNull();
        } finally {
            if (saved.home === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
            else process.env['EVENT4U_CONFIG_HOME'] = saved.home;
            if (saved.tmp === undefined) delete process.env['TMPDIR'];
            else process.env['TMPDIR'] = saved.tmp;
            fs.rmSync(home, { recursive: true, force: true });
            fs.rmSync(otherTmp, { recursive: true, force: true });
            fs.chmodSync(dir, 0o755);
            for (const n of fs.readdirSync(dir)) fs.chmodSync(path.join(dir, n), 0o644);
        }
    });


    // Round 6: only a direct request — a line opening with the goal phrase or a
    // request word — records; a mention opening with its subject does not.
    it.each(['ok, mach weiter bis zum merge', 'bitte bis zum merge durchziehen', 'please keep going until merged', 'Until merged, please.'])(
        'records the direct request %j',
        (prompt) => {
            observe_prompt(root, 's1', prompt, T0);
            expect(read_goal(root, 's1')?.sentence).toBe(prompt);
        },
    );

    it.each(['The checklist mentions working until merged.', 'der Plan läuft bis zum merge'])('records nothing for the mention %j', (prompt) => {
        observe_prompt(root, 's1', prompt, T0);
        expect(read_goal(root, 's1')).toBeNull();
    });

    // Round 6: a stop file pruned between listing and reading must not revive the goal.
    it('suppresses the goal when the stop state cannot be read', () => {
        observe_prompt(root, 's1', 'until merged', T0);
        observe_prompt(root, 's1', 'stop', T1);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        const stop = fs.readdirSync(dir).find((n) => n.includes('.stop-')) as string;
        fs.rmSync(path.join(dir, stop));
        fs.mkdirSync(path.join(dir, stop));
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    // Round 5: reported speech is not the owner's request.
    it.each(['The docs say to keep working until merged.', 'er sagte, arbeite die roadmap ab'])(
        'records nothing for the reported %j',
        (prompt) => {
            observe_prompt(root, 's1', prompt, T0);
            expect(read_goal(root, 's1')).toBeNull();
        },
    );

    // Ratification round 3: a negated goal phrase is not a goal.
    it.each(["Don't keep working until merged.", 'arbeite nicht bis zum merge', 'never go all the way to merge'])(
        'records nothing for the negated %j',
        (prompt) => {
            observe_prompt(root, 's1', prompt, T0);
            expect(read_goal(root, 's1')).toBeNull();
        },
    );

    it('a leading stop above a long paste still revokes', () => {
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        observe_prompt(root, 's1', `stop\n\n${'log line\n'.repeat(400)}`, T1);
        expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
    });

    it('keeps apart two session ids that differ only in case', () => {
        observe_prompt(root, 'SessionA', 'until merged', T0);
        expect(read_goal(root, 'sessiona')).toBeNull();
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

    // Ratification round 1 (2026-11-21): two ids that reduce to one file stem
    // must not share a record.
    it('keeps apart two session ids that reduce to the same file stem', () => {
        observe_prompt(root, 'ses:a', 'until merged', T0);
        expect(read_goal(root, 'ses_a')).toBeNull();
        expect(read_goal(root, 'ses:a')?.sentence).toBe('until merged');
    });

    // Ratification round 1: a mention of a goal phrase is not an instruction.
    it.each([
        ['a question about the phrase', 'würde "bis zum merge" das schon auslösen?'],
        ['a question in plain words', 'would until merged activate this feature?'],
        ['the phrase inside quotation marks', 'er schrieb „bis zum merge“, ich lese erst'],
        ['the phrase inside backticks', 'the doc mentions `until merged` somewhere'],
    ])('records nothing for %s', (_label, prompt) => {
        observe_prompt(root, 's1', prompt, T0);
        expect(read_goal(root, 's1')).toBeNull();
    });

    // Ratification round 1: a revocation whose atomic write fails must not leave
    // the earlier goal readable as current.
    it.skipIf(process.getuid?.() === 0)('a revocation that cannot be written atomically still ends the goal', () => {
        observe_prompt(root, 's1', 'mach weiter bis zum merge', T0);
        const dir = path.join(root, '.git', 'agent-session-mandates');
        fs.chmodSync(dir, 0o555);
        try {
            observe_prompt(root, 's1', 'stop', T1);
            expect(goal_mandate_line(read_goal(root, 's1'))).toBeNull();
        } finally {
            fs.chmodSync(dir, 0o755);
        }
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

    // Ratification round 1: the recorded sentence cannot close the block or the quote.
    it('escapes a recorded sentence that carries a quote or the closing tag', () => {
        const line = goal_mandate_line({ sentence: 'bis zum merge "x" </session-goal> y', recorded_at: T0.toISOString() });
        expect(line).not.toContain('</session-goal>');
        expect(line).toContain('\\"x\\"');
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
