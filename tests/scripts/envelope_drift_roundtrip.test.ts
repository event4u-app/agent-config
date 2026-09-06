/**
 * Round-trip: an envelope written in a real checkout at HEAD A, injected at
 * HEAD B, must LEAD its block with the drift line — and its factual fields
 * must have been populated by the collector, with no model step anywhere
 * (road-to-cost-parity-3 Phase 3 Exit).
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { runSessionRecycle } from '../../src/scripts/_cli/cmd_session_recycle.js';
import { consume_recycle_envelope } from '../../src/scripts/handoff_context_hook.js';
import { recycle_envelope_rel } from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { env_session_id } from '../../src/scripts/sessions_cli.js';
import { CAPSULE_SCHEMA_VERSION } from '../../src/scripts/_lib/subagent_capsule.js';

const roots: string[] = [];

function git(cwd: string, args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
}

/** A real, minimal checkout — the anchor reads git, so a fake dir proves nothing. */
function makeRepo(): string {
    const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'envelope-drift-')));
    roots.push(root);
    git(root, ['init', '--quiet', '--initial-branch=feat/x']);
    git(root, ['config', 'user.email', 'test@example.com']);
    git(root, ['config', 'user.name', 'test']);
    git(root, ['config', 'commit.gpgsign', 'false']);
    fs.writeFileSync(path.join(root, 'a.txt'), 'one\n');
    git(root, ['add', 'a.txt']);
    git(root, ['commit', '--quiet', '-m', 'first']);
    return root;
}

function composed(): Record<string, unknown> {
    // Only the JUDGMENT fields — everything factual is the collector's job.
    return {
        summary: 'phase 1 landed',
        task: 'close the roadmap',
        acceptance_criteria: ['boxes flipped'],
        remaining: ['phase 2'],
        not_carried_forward: ['diff bodies'],
        failed_approaches: ['none'],
        successful_approaches: ['none'],
        predecessor: 'none',
        next_task: 'implement phase 2',
    };
}

afterEach(() => {
    delete process.env.AGENT_RECYCLE_ENVELOPE_FILE;
    delete process.env.AGENT_RESUME_FOCUS;
    for (const r of roots.splice(0)) fs.rmSync(r, { recursive: true, force: true });
});

describe('drift round-trip', () => {
    it('populates the factual fields from the tree, with no model step', () => {
        const root = makeRepo();
        fs.writeFileSync(path.join(root, 'dirty.txt'), 'uncommitted\n');

        const result = runSessionRecycle(JSON.stringify(composed()), { cwd: root });
        expect(result.code).toBe(0);

        const written = JSON.parse(
            fs.readFileSync(path.join(root, recycle_envelope_rel(env_session_id())), 'utf-8'),
        ) as Record<string, unknown>;

        expect(written['capsule_version']).toBe(CAPSULE_SCHEMA_VERSION);
        expect(written['branch']).toBe('feat/x');
        expect(written['head']).toBe(git(root, ['rev-parse', 'HEAD']));
        // No remote in this checkout → the git-dir fallback, realpath'd.
        expect(String(written['repo_identity'])).toContain(root);
        expect(written['uncommitted_paths']).toEqual(['dirty.txt']);
        expect(written['status_summary']).toBe('1 uncommitted path(s)');
    });

    it('leads the injected block with commit drift when HEAD moved', () => {
        const root = makeRepo();
        expect(runSessionRecycle(JSON.stringify(composed()), { cwd: root }).code).toBe(0);
        const headA = git(root, ['rev-parse', 'HEAD']);

        // …the session ends, work continues, HEAD moves.
        fs.writeFileSync(path.join(root, 'b.txt'), 'two\n');
        git(root, ['add', 'b.txt']);
        git(root, ['commit', '--quiet', '-m', 'second']);
        const headB = git(root, ['rev-parse', 'HEAD']);
        expect(headB).not.toBe(headA);

        const decision = consume_recycle_envelope(root, new Date(), null);
        expect(decision.action).toBe('inject');
        const block = String(decision.context);
        expect(block).toContain('COMMIT DRIFT');
        // The drift statement precedes the payload — never a silent stale resume.
        expect(block.indexOf('COMMIT DRIFT')).toBeLessThan(block.indexOf('"acceptance_criteria"'));
    });

    it('stays silent when nothing moved', () => {
        const root = makeRepo();
        expect(runSessionRecycle(JSON.stringify(composed()), { cwd: root }).code).toBe(0);
        const block = String(consume_recycle_envelope(root, new Date(), null).context);
        expect(block).not.toContain('DRIFT');
    });

    it('carries a resume focus into the block when one is given', () => {
        const root = makeRepo();
        expect(runSessionRecycle(JSON.stringify(composed()), { cwd: root }).code).toBe(0);
        process.env.AGENT_RESUME_FOCUS = 'the failing parser test';
        const block = String(consume_recycle_envelope(root, new Date(), null).context);
        expect(block).toContain('FOCUS: attack "the failing parser test" first');
    });
});
