/**
 * The resume path, driven through the real dispatcher
 * (`road-to-a-recycle-envelope-that-is-consumed` step 2.3).
 *
 * A unit call proved the defect; only a dispatcher run proves the repair, and
 * the reason is specific rather than ceremonial: the bug lived in WHICH id the
 * caller passes. `handoff_context_hook` takes the id from the dispatcher
 * envelope, so a library-level test can be made green by passing the right id
 * in the test — proving the resolver and not the wiring. That is the shape that
 * produced seven findings on a sibling surface earlier the same day.
 *
 * So these cases write a record as session A and start session B, both through
 * `dispatch_hook`, and assert on B's stdout.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterAll, describe, expect, it } from 'vitest';

import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';
import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const DISPATCH = path.join(REPO, 'src', 'scripts', 'hooks', 'dispatch_hook.ts');

const cleanups: string[] = [];

afterAll(() => {
    for (const d of cleanups) fs.rmSync(d, { recursive: true, force: true });
});

const NEXT_TASK = 'finish the ratchet claim and re-run check_estate_count';

/** A real git workspace — the branch gate reads the branch with git. */
function workspace(branch = 'feat/resume-probe'): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'resume-e2e-')));
    cleanups.push(root);
    const run = (...args: string[]): void => {
        spawnSync('git', args, { cwd: root, encoding: 'utf-8' });
    };
    run('init', '--initial-branch', branch);
    run('config', 'user.email', 't@example.com');
    run('config', 'user.name', 't');
    fs.writeFileSync(path.join(root, 'seed'), 'seed');
    run('add', '-A');
    run('commit', '-m', 'seed');
    return root;
}

/** What session A leaves behind, at the path the producer actually writes. */
function writeRecordAs(root: string, producerId: string, branch: string | null): string {
    const envelope: Record<string, unknown> = {
        capsule_version: CAPSULE_SCHEMA_VERSION,
        variant: 'main_session',
        summary: 'phase 2 landed; phase 3 open',
        task: 'close the roadmap',
        workspace: root,
        written_at: new Date().toISOString(),
        acceptance_criteria: ['boxes flipped'],
        remaining: ['phase 3'],
        not_carried_forward: ['diff bodies'],
        failed_approaches: ['none'],
        successful_approaches: ['none'],
        predecessor: 'none',
        next_task: NEXT_TASK,
        session_id: producerId,
    };
    if (branch !== null) envelope['branch'] = branch;
    const target = path.join(root, recycle_envelope_rel(producerId));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(envelope, null, 2));
    return target;
}

function sessionStart(root: string, sessionId: string): string {
    const r = spawnSync(
        'npx',
        ['tsx', DISPATCH, '--platform', 'claude', '--event', 'session_start',
         '--native-event', 'SessionStart', '--project-dir', root],
        {
            input: JSON.stringify({ session_id: sessionId, source: 'startup' }),
            encoding: 'utf-8',
            cwd: REPO,
            timeout: 180_000,
        },
    );
    return r.stdout ?? '';
}

describe('a successor resumes its predecessor through the dispatcher', () => {
    it("injects the predecessor's next_task into a session with a different id", () => {
        const root = workspace();
        const target = writeRecordAs(root, 'sess-A-producer', 'feat/resume-probe');

        const out = sessionStart(root, 'sess-B-successor');

        expect(out).toContain('recycle-envelope');
        expect(out).toContain(NEXT_TASK);
        // consumed: moved, not copied, so it cannot reach a third session
        expect(fs.existsSync(target)).toBe(false);
    });

    it('does NOT inject the same record into a third session', () => {
        const root = workspace();
        writeRecordAs(root, 'sess-A-producer', 'feat/resume-probe');

        expect(sessionStart(root, 'sess-B-successor')).toContain(NEXT_TASK);
        expect(sessionStart(root, 'sess-C-third')).not.toContain(NEXT_TASK);
    });

    it('does not hand a session its OWN record back', () => {
        // The loop case. Reachable before the fix because a session can receive
        // more than one session_start (resume, host reconnect).
        const root = workspace();
        writeRecordAs(root, 'sess-A-producer', 'feat/resume-probe');

        expect(sessionStart(root, 'sess-A-producer')).not.toContain(NEXT_TASK);
    });

    it('leaves a record from another branch unclaimed', () => {
        const root = workspace('feat/here');
        const target = writeRecordAs(root, 'sess-A-producer', 'feat/elsewhere');

        expect(sessionStart(root, 'sess-B-successor')).not.toContain(NEXT_TASK);
        // Unclaimed, not consumed — a session on `feat/elsewhere` can still use it.
        expect(fs.existsSync(target)).toBe(true);
    });

    it('starts clean when two predecessor records leave it unable to choose', () => {
        const root = workspace();
        writeRecordAs(root, 'sess-peer-a', 'feat/resume-probe');
        writeRecordAs(root, 'sess-peer-b', 'feat/resume-probe');

        expect(sessionStart(root, 'sess-B-successor')).not.toContain(NEXT_TASK);
    });
});
