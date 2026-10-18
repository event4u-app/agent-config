import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    MAX_CI_FIX_ROUNDS,
    allowedPaths,
    prCreateArgs,
    publish,
    settleCi,
    type CiVerdict,
    type PublishPort,
} from '../../src/scripts/analysis_publish.js';
import { createRun, legalNext, loadRun, transition, type ForwardState, type RunRecord } from '../../src/scripts/analysis_run.js';

let root: string;

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'analysis-publish-'));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

const EMITTED = ['agents/roadmaps/road-to-x.md'];

function validatedRun(): { runDir: string; record: RunRecord } {
    const { runDir, record } = createRun(root, { runId: 'r1', pins: { head: 'abc' }, tokenCap: 1000 });
    let rec = record;
    while (rec.state !== 'validated') rec = transition(runDir, rec, legalNext(rec.state)[0] as ForwardState);
    return { runDir, record: rec };
}

/** An in-memory remote: branches, PRs and a scripted CI verdict sequence. */
function fakePort(opts: { staged?: string[]; ci?: CiVerdict[]; remoteHead?: string | null } = {}) {
    const calls: string[] = [];
    const prs: Array<{ number: number; head: string; draft: boolean }> = [];
    const ci = [...(opts.ci ?? [{ green: true, red: [] }])];
    let staged = opts.staged ?? [...EMITTED];
    let head = 'h0';
    const remote = new Map<string, string>();
    if (opts.remoteHead) remote.set('analysis/r1', opts.remoteHead);
    const port: PublishPort = {
        stagedPaths: () => [...staged],
        commit: (message) => {
            calls.push(`commit:${message.split('\n')[0]}`);
            head = `h${calls.length}`;
            return head;
        },
        localHead: () => head,
        remoteHead: (branch) => remote.get(branch) ?? null,
        push: (branch, expected) => {
            calls.push(`push:${branch}:${String(expected)}`);
            remote.set(branch, head);
        },
        findOpenPr: (branch) => prs.find((p) => p.head === branch)?.number ?? null,
        createPr: (args) => {
            calls.push(`pr-create:${args.join(' ')}`);
            const number = 100 + prs.length;
            prs.push({ number, head: args[args.indexOf('--head') + 1] as string, draft: args.includes('--draft') });
            return number;
        },
        prIsDraft: (n) => prs.find((p) => p.number === n)?.draft ?? true,
        ciSettle: () => ci.shift() ?? { green: false, red: ['unscripted'] },
    };
    return {
        port,
        calls,
        prs,
        setStaged: (s: string[]) => {
            staged = s;
        },
    };
}

const INPUT = {
    branch: 'analysis/r1',
    base: 'main',
    baseSha: 'b0',
    title: 'Analysis round r1',
    bodyFile: 'body.md',
    emitted: EMITTED,
    message: 'docs(roadmaps): analysis round r1',
};

describe('allowedPaths', () => {
    it('is the emitted roadmaps plus the dashboard regenerated for them', () => {
        expect(allowedPaths(EMITTED)).toEqual(['agents/roadmaps-progress.md', 'agents/roadmaps/road-to-x.md']);
    });
});

describe('prCreateArgs', () => {
    it('never carries --draft', () => {
        const args = prCreateArgs({ title: 't', bodyFile: 'b', base: 'main', head: 'analysis/r1' });
        expect(args).not.toContain('--draft');
        expect(args.slice(0, 2)).toEqual(['pr', 'create']);
    });
});

describe('publish (step 3.3)', () => {
    it('refuses a staged file outside the allowed set and hands the run back naming it', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort({ staged: [...EMITTED, 'src/rules/x.md'] });
        const out = publish(f.port, runDir, record, INPUT);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/src\/rules\/x\.md/);
        expect(f.calls).toEqual([]);
    });

    it('opens a non-draft PR and reads isDraft false', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const out = publish(f.port, runDir, record, INPUT);
        expect(out.record.state).toBe('pr-open');
        expect(out.pr).toBe(100);
        expect(f.prs[0]?.draft).toBe(false);
    });

    it('a re-run opens no second PR', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        publish(f.port, runDir, record, INPUT);
        const again = publish(f.port, runDir, loadRun(runDir), INPUT);
        expect(again.pr).toBe(100);
        expect(f.prs).toHaveLength(1);
        expect(f.calls.filter((c) => c.startsWith('pr-create'))).toHaveLength(1);
    });

    it('stops before pushing when the remote branch already moved', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort({ remoteHead: 'someone-else' });
        const out = publish(f.port, runDir, record, INPUT);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/expected-head/);
        expect(f.calls.some((c) => c.startsWith('push:'))).toBe(false);
    });
});

describe('settleCi (step 3.3)', () => {
    function openRun(ci: CiVerdict[]) {
        const { runDir, record } = validatedRun();
        const f = fakePort({ ci });
        const out = publish(f.port, runDir, record, INPUT);
        return { runDir, record: out.record, f, pr: out.pr as number };
    }

    it('green on the first settle ends done', () => {
        const { runDir, record, f, pr } = openRun([{ green: true, red: [] }]);
        const out = settleCi(f.port, runDir, record, { ...INPUT, pr }, () => EMITTED);
        expect(out.state).toBe('done');
    });

    it('a fourth red CI round ends in handed-back naming the red', () => {
        const red: CiVerdict = { green: false, red: ['Rule backstops'] };
        const { runDir, record, f, pr } = openRun([red, red, red, red]);
        let fixes = 0;
        const out = settleCi(f.port, runDir, record, { ...INPUT, pr }, () => {
            fixes += 1;
            return EMITTED;
        });
        expect(fixes).toBe(MAX_CI_FIX_ROUNDS);
        expect(out.state).toBe('handed-back');
        expect(out.handed_back_reason).toMatch(/Rule backstops/);
        expect(f.calls.filter((c) => c.startsWith('push:'))).toHaveLength(1 + MAX_CI_FIX_ROUNDS);
    });

    it('a CI fix that stages a file outside the allowed set stops publication', () => {
        const { runDir, record, f, pr } = openRun([{ green: false, red: ['lint'] }]);
        const out = settleCi(f.port, runDir, record, { ...INPUT, pr }, () => {
            f.setStaged(['src/scripts/other.ts']);
            return ['src/scripts/other.ts'];
        });
        expect(out.state).toBe('handed-back');
        expect(out.handed_back_reason).toMatch(/src\/scripts\/other\.ts/);
    });
});
