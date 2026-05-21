/**
 * Tests for the agent-mode state machine.
 *
 * Each turn is independent: the machine receives the manifest plus the
 * accumulated `--answer` flags and either emits the next `question`,
 * the terminal `done`, or an `error`. Assertions stream stdout through
 * a `PassThrough` and JSON-parse each envelope.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { PassThrough } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runAgentInit } from '../src/agent-mode/machine.js';
import type { AgentResponse } from '../src/types.js';
import { makeArtefact, makeManifest, makePack, makeWorkspace } from './_fixtures.js';

async function captureStdout(fn: (stream: PassThrough) => Promise<number>): Promise<{ code: number; envelopes: AgentResponse[] }> {
    const stream = new PassThrough();
    const chunks: Buffer[] = [];
    stream.on('data', (c: Buffer) => chunks.push(c));
    const code = await fn(stream);
    const text = Buffer.concat(chunks).toString('utf8');
    const envelopes = text
        .split('\n')
        .filter((l) => l.length > 0)
        .map((l) => JSON.parse(l) as AgentResponse);
    return { code, envelopes };
}

function baseManifest() {
    return makeManifest({
        workspaces: [
            makeWorkspace({ id: 'engineering', default_packs: ['eng-base'] }),
            makeWorkspace({ id: 'product', default_packs: ['prod-base'] }),
        ],
        packs: [
            makePack({ id: 'eng-base', workspaces: ['engineering'] }),
            makePack({ id: 'prod-base', workspaces: ['product'] }),
            makePack({ id: 'shared', workspaces: ['engineering'], requires_hint: ['eng-base'] }),
        ],
    });
}

describe('runAgentInit — turn sequence', () => {
    let pkg: string;
    let proj: string;

    beforeEach(() => {
        pkg = mkdtempSync(join(tmpdir(), 'installer-pkg-'));
        proj = mkdtempSync(join(tmpdir(), 'installer-proj-'));
    });

    afterEach(() => {
        rmSync(pkg, { recursive: true, force: true });
        rmSync(proj, { recursive: true, force: true });
    });

    function inputs(answers: readonly string[]) {
        return {
            manifest: baseManifest(),
            manifestSha256: 'sha256:deadbeef',
            packageRoot: pkg,
            projectRoot: proj,
            dryRun: true,
            answers,
            now: () => '2026-05-21T00:00:00Z',
        };
    }

    it('turn 1 — no answers → asks q1.workspaces', async () => {
        const { code, envelopes } = await captureStdout((s) => runAgentInit({ ...inputs([]), stdout: s }));
        expect(code).toBe(0);
        expect(envelopes).toHaveLength(1);
        const env = envelopes[0]!;
        expect(env.status).toBe('question');
        if (env.status !== 'question') return;
        expect(env.id).toBe('q1.workspaces');
        expect(env.multi).toBe(true);
        expect(env.choices?.map((c) => c.value)).toEqual(['engineering', 'product']);
        expect(env.next_call).toContain('--answer q1.workspaces=<value>');
    });

    it('turn 2 — workspace answered → asks q2.packs scoped to that workspace', async () => {
        const { code, envelopes } = await captureStdout((s) =>
            runAgentInit({ ...inputs(['q1.workspaces=engineering']), stdout: s }),
        );
        expect(code).toBe(0);
        const env = envelopes[0]!;
        expect(env.status).toBe('question');
        if (env.status !== 'question') return;
        expect(env.id).toBe('q2.packs');
        expect(env.choices?.map((c) => c.value).sort()).toEqual(['eng-base', 'shared']);
        expect(env.next_call).toContain('--answer q1.workspaces=engineering');
    });

    it('unknown workspace → error envelope, exit 2', async () => {
        const { code, envelopes } = await captureStdout((s) =>
            runAgentInit({ ...inputs(['q1.workspaces=nope']), stdout: s }),
        );
        expect(code).toBe(2);
        expect(envelopes[0]?.status).toBe('error');
        if (envelopes[0]?.status !== 'error') return;
        expect(envelopes[0].reason).toBe('unknown_workspace');
    });

    it('malformed answer → error envelope, exit 2', async () => {
        const { code, envelopes } = await captureStdout((s) =>
            runAgentInit({ ...inputs(['not-a-pair']), stdout: s }),
        );
        expect(code).toBe(2);
        expect(envelopes[0]?.status).toBe('error');
        if (envelopes[0]?.status !== 'error') return;
        expect(envelopes[0].reason).toBe('answer_malformed');
    });

    it('packs without auto-added → skips q3.confirm, terminates with done (dry-run)', async () => {
        writeFileSync(join(pkg, '.dummy'), '');
        const { code, envelopes } = await captureStdout((s) =>
            runAgentInit({
                ...inputs(['q1.workspaces=engineering', 'q2.packs=eng-base']),
                stdout: s,
            }),
        );
        expect(code).toBe(0);
        expect(envelopes[0]?.status).toBe('done');
    });

    it('packs with auto-added → asks q3.confirm, then completes on yes', async () => {
        const turn = await captureStdout((s) =>
            runAgentInit({
                ...inputs(['q1.workspaces=engineering', 'q2.packs=shared']),
                stdout: s,
            }),
        );
        expect(turn.envelopes[0]?.status).toBe('question');
        if (turn.envelopes[0]?.status !== 'question') return;
        expect(turn.envelopes[0].id).toBe('q3.confirm');

        const final = await captureStdout((s) =>
            runAgentInit({
                ...inputs(['q1.workspaces=engineering', 'q2.packs=shared', 'q3.confirm=yes']),
                stdout: s,
            }),
        );
        expect(final.code).toBe(0);
        expect(final.envelopes[0]?.status).toBe('done');
    });

    it('q3.confirm=no → aborted_by_agent error, exit 2', async () => {
        const { code, envelopes } = await captureStdout((s) =>
            runAgentInit({
                ...inputs(['q1.workspaces=engineering', 'q2.packs=shared', 'q3.confirm=no']),
                stdout: s,
            }),
        );
        expect(code).toBe(2);
        expect(envelopes[0]?.status).toBe('error');
        if (envelopes[0]?.status !== 'error') return;
        expect(envelopes[0].reason).toBe('aborted_by_agent');
    });
});
