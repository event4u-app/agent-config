import { describe, expect, it } from 'vitest';

import {
    TAG_TRIGGERED_WORKFLOWS,
    dispatchTagWorkflows,
    tagPushProbe,
} from '../../src/scripts/_lib/release_tag_dispatch.js';

describe('tagPushProbe', () => {
    function probe(answers: Array<{ returncode: number; stdout: string }>) {
        const calls: string[][] = [];
        const sleeps: number[] = [];
        let i = 0;
        const p = tagPushProbe(
            (args) => {
                calls.push([...args]);
                return answers[Math.min(i++, answers.length - 1)]!;
            },
            (ms) => sleeps.push(ms),
            4,
            10,
        );
        return { p, calls, sleeps };
    }

    it('re-asks an empty listing until the push run appears, then believes it', () => {
        const { p, calls, sleeps } = probe([
            { returncode: 0, stdout: '0\n' },
            { returncode: 0, stdout: '1\n' },
        ]);
        expect(p.alreadyFired('release-guard.yml', '20.0.0')).toBe(true);
        expect(calls).toHaveLength(2);
        expect(sleeps).toEqual([10]);
        expect(calls[0]).toEqual(expect.arrayContaining(['--branch', '20.0.0', '--event', 'push']));
    });

    it('waits only once: after an empty first workflow, later workflows are asked once without sleeping', () => {
        const { p, calls, sleeps } = probe([{ returncode: 0, stdout: '0' }]);
        expect(p.alreadyFired('release-guard.yml', '20.0.0')).toBe(false);
        expect(calls).toHaveLength(4);
        expect(sleeps).toHaveLength(3);
        expect(p.alreadyFired('publish-npm.yml', '20.0.0')).toBe(false);
        expect(calls).toHaveLength(5);
        expect(sleeps).toHaveLength(3);
    });

    it('treats an unreadable listing as not fired, so the dispatch still happens', () => {
        const { p } = probe([{ returncode: 1, stdout: '' }]);
        expect(p.alreadyFired('cloud-release.yml', '20.0.0')).toBe(false);
    });
});

function harness(fired: Set<string>, code = 0) {
    const dispatched: string[] = [];
    const warnings: string[] = [];
    const infos: string[] = [];
    dispatchTagWorkflows(
        {
            run: (argv) => {
                dispatched.push(argv[3]!);
                return { returncode: code };
            },
            warn: (s) => warnings.push(s),
            info: (s) => infos.push(s),
            trunk: 'main',
            alreadyFired: (wf) => fired.has(wf),
        },
        '20.0.0',
    );
    return { dispatched, warnings, infos };
}

describe('dispatchTagWorkflows', () => {
    it('dispatches every tag workflow when the tag push fired none (GITHUB_TOKEN-pushed tag)', () => {
        const { dispatched, infos } = harness(new Set());
        expect(dispatched).toEqual([...TAG_TRIGGERED_WORKFLOWS]);
        expect(infos).toEqual([]);
    });

    it('skips a workflow the tag push already started, so it never runs twice (PAT-pushed tag)', () => {
        const { dispatched, infos } = harness(new Set(TAG_TRIGGERED_WORKFLOWS));
        expect(dispatched).toEqual([]);
        expect(infos).toHaveLength(TAG_TRIGGERED_WORKFLOWS.length);
        expect(infos[0]).toContain('already started');
    });

    it('dispatches only the workflows the push did not start', () => {
        const { dispatched } = harness(new Set(['publish-npm.yml']));
        expect(dispatched).toEqual(['release-guard.yml', 'cloud-release.yml']);
    });

    it('warns and continues when a dispatch fails, never throwing', () => {
        const { dispatched, warnings } = harness(new Set(), 1);
        expect(dispatched).toHaveLength(TAG_TRIGGERED_WORKFLOWS.length);
        expect(warnings).toHaveLength(TAG_TRIGGERED_WORKFLOWS.length);
    });
});
