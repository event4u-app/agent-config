/**
 * Phase 1.6 acceptance: 2PC crash-recovery semantics.
 *
 * Council HIGH 2026-05-18: a crash mid-commit must never leave the
 * project in a mixed (one-file-new / one-file-stale) state. The recovery
 * contract is in `src/server/io/atomicMultiWrite.ts`:
 *
 *   - Marker present + every tmp exists → finish the renames on replay.
 *   - Marker present + any tmp missing  → abort (unlink tmps + marker).
 *
 * These tests exercise the replay machinery directly — no Fastify boot
 * needed — by seeding marker + tmp files into `agents/state/` and
 * driving `replayPendingCommits` against the fixture project.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitMulti, replayPendingCommits } from '../../src/server/io/atomicMultiWrite.js';
import { tempPathFor } from '../../src/server/io/atomicWrite.js';

describe('2PC commit + crash recovery', () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), 'agent-config-2pc-'));
        mkdirSync(join(projectRoot, 'agents', 'state'), { recursive: true });
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    it('commitMulti writes both files atomically in the success path', async () => {
        const settingsPath = join(projectRoot, '.agent-settings.yml');
        const userMdPath = join(projectRoot, '.agent-user.md');
        const { txnId } = await commitMulti(
            [
                { target: settingsPath, contents: 'cost_profile: balanced\n', mode: 0o600 },
                { target: userMdPath, contents: '# user md\n', mode: 0o600 },
            ],
            { projectRoot },
        );
        expect(txnId.length).toBeGreaterThan(0);
        expect(readFileSync(settingsPath, 'utf8')).toBe('cost_profile: balanced\n');
        expect(readFileSync(userMdPath, 'utf8')).toBe('# user md\n');
        // Marker must be gone after a clean commit.
        expect(existsSync(join(projectRoot, 'agents', 'state', `wizard-intent-${txnId}.json`))).toBe(false);
    });

    it('replay finishes a marker whose every tmp is present (crash AFTER marker, BEFORE rename)', async () => {
        const settingsPath = join(projectRoot, '.agent-settings.yml');
        const userMdPath = join(projectRoot, '.agent-user.md');
        const txnId = 'fixed-finish-txn';
        const settingsTmp = tempPathFor(settingsPath, txnId);
        const userMdTmp = tempPathFor(userMdPath, txnId);

        // Seed both tmps + the marker, but DO NOT perform the rename.
        writeFileSync(settingsTmp, 'cost_profile: minimal\n', { mode: 0o600 });
        writeFileSync(userMdTmp, '# replayed user md\n', { mode: 0o600 });
        const marker = {
            version: 1,
            txnId,
            createdAt: new Date().toISOString(),
            entries: [
                { tmp: settingsTmp, target: settingsPath, mode: 0o600 },
                { tmp: userMdTmp, target: userMdPath, mode: 0o600 },
            ],
        };
        writeFileSync(join(projectRoot, 'agents', 'state', `wizard-intent-${txnId}.json`), JSON.stringify(marker));

        const result = await replayPendingCommits(projectRoot);
        expect(result.completed).toContain(txnId);
        expect(result.aborted).toHaveLength(0);
        expect(readFileSync(settingsPath, 'utf8')).toBe('cost_profile: minimal\n');
        expect(readFileSync(userMdPath, 'utf8')).toBe('# replayed user md\n');
        // Marker must be cleaned up.
        expect(existsSync(join(projectRoot, 'agents', 'state', `wizard-intent-${txnId}.json`))).toBe(false);
    });

    it('replay aborts a marker whose tmps are missing (crash mid-prepare)', async () => {
        const settingsPath = join(projectRoot, '.agent-settings.yml');
        const userMdPath = join(projectRoot, '.agent-user.md');
        const txnId = 'fixed-abort-txn';
        const settingsTmp = tempPathFor(settingsPath, txnId);
        const userMdTmp = tempPathFor(userMdPath, txnId);

        // Seed ONLY the marker — one tmp is missing → replay must abort,
        // not invent contents, not touch the targets.
        writeFileSync(settingsTmp, 'cost_profile: minimal\n', { mode: 0o600 });
        const marker = {
            version: 1,
            txnId,
            createdAt: new Date().toISOString(),
            entries: [
                { tmp: settingsTmp, target: settingsPath, mode: 0o600 },
                { tmp: userMdTmp, target: userMdPath, mode: 0o600 },
            ],
        };
        writeFileSync(join(projectRoot, 'agents', 'state', `wizard-intent-${txnId}.json`), JSON.stringify(marker));

        const result = await replayPendingCommits(projectRoot);
        expect(result.aborted).toContain(txnId);
        expect(result.completed).toHaveLength(0);
        // Targets untouched.
        expect(existsSync(settingsPath)).toBe(false);
        expect(existsSync(userMdPath)).toBe(false);
        // Marker + leftover tmps cleaned up.
        expect(existsSync(join(projectRoot, 'agents', 'state', `wizard-intent-${txnId}.json`))).toBe(false);
        expect(existsSync(settingsTmp)).toBe(false);
    });

    it('replay tolerates a corrupt marker by aborting it', async () => {
        writeFileSync(
            join(projectRoot, 'agents', 'state', 'wizard-intent-corrupt.json'),
            '{not valid json',
            { mode: 0o600 },
        );
        const result = await replayPendingCommits(projectRoot);
        expect(result.aborted).toContain('wizard-intent-corrupt.json');
        expect(existsSync(join(projectRoot, 'agents', 'state', 'wizard-intent-corrupt.json'))).toBe(false);
    });

    it('replay is a no-op when no markers are pending', async () => {
        const result = await replayPendingCommits(projectRoot);
        expect(result.completed).toEqual([]);
        expect(result.aborted).toEqual([]);
    });
});
