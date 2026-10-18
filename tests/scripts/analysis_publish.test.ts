import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    MAX_CI_FIX_ROUNDS,
    PR_BODY_FILE,
    PUBLICATION_FILE,
    PublicationTarget,
    allowedPaths,
    assertRefName,
    gitGhPort,
    prCreateArgs,
    publish,
    recordPublication,
    settleCi,
    type CiVerdict,
    type PublishInput,
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
const sha = (n: number): string => n.toString(16).padStart(40, '0');
const BASE = sha(1);

/** A run in `validated` whose run directory holds the publication record and the PR body. */
function validatedRun(opts: { publication?: boolean; body?: boolean } = {}): { runDir: string; record: RunRecord } {
    const { runDir, record } = createRun(root, { runId: 'r1', pins: { head: 'abc' }, tokenCap: 1000 });
    let rec = record;
    while (rec.state !== 'validated') rec = transition(runDir, rec, legalNext(rec.state)[0] as ForwardState);
    if (opts.publication !== false) recordPublication(runDir, EMITTED);
    if (opts.body !== false) fs.writeFileSync(path.join(runDir, PR_BODY_FILE), '# Analysis round r1\n');
    return { runDir, record: rec };
}

/** An in-memory remote whose push is a compare-and-swap on the expected head, as git's lease is. */
function fakePort(opts: { staged?: string[]; ci?: CiVerdict[]; remoteHead?: string | null; raceOnPush?: string } = {}) {
    const calls: string[] = [];
    const prs: Array<{ number: number; head: string; draft: boolean }> = [];
    const ci = [...(opts.ci ?? [{ green: true, red: [] }])];
    let staged = opts.staged ?? [...EMITTED];
    const chain = [BASE];
    const remote = new Map<string, string>();
    if (opts.remoteHead) remote.set('analysis/r1', opts.remoteHead);
    const head = (): string => chain[chain.length - 1] as string;
    const port: PublishPort = {
        stagedPaths: () => [...staged],
        commit: (message) => {
            calls.push(`commit:${message.split('\n')[0]}`);
            chain.push(sha(chain.length + 1));
            return head();
        },
        localHead: head,
        isAncestor: (a, b) => chain.includes(a) && chain.indexOf(a) <= chain.indexOf(b),
        remoteHead: (target) => remote.get(target.branch) ?? null,
        push: (target, expected) => {
            if (opts.raceOnPush !== undefined) remote.set(target.branch, opts.raceOnPush);
            if ((remote.get(target.branch) ?? null) !== expected) throw new Error(`stale info: ${target.ref}`);
            calls.push(`push:${target.branch}:${String(expected)}`);
            remote.set(target.branch, head());
        },
        findOpenPr: (target) => prs.find((p) => p.head === target.branch)?.number ?? null,
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
        remote,
        setStaged: (s: string[]) => {
            staged = s;
        },
    };
}

const INPUT: PublishInput = {
    base: 'main',
    baseSha: BASE,
    title: 'Analysis round r1',
    message: 'docs(roadmaps): analysis round r1',
};

const ADVERSARIAL_REFS = [
    ':refs/heads/main',
    '+HEAD:refs/heads/x',
    '-f',
    '--force',
    'refs/heads/main',
    'a..b',
    'a b',
    'a~1',
    'a^',
    'a@{0}',
    'a/',
    '/a',
    'a//b',
    'a.lock',
    'a/.b',
    'HEAD',
    '',
];

describe('assertRefName / PublicationTarget (council finding 1)', () => {
    it.each(ADVERSARIAL_REFS)('refuses %j as a branch name', (name) => {
        expect(() => assertRefName(name, 'branch')).toThrow(/branch/);
    });

    it('accepts plain branch names', () => {
        for (const n of ['main', 'analysis/r1', 'release/1.2', 'run-20261018-ab12cd']) expect(assertRefName(n, 'branch')).toBe(n);
    });

    it('owns the destination: the branch is derived from the run id, never named by the caller', () => {
        const t = PublicationTarget.forRun('r1', 'main');
        expect(t.branch).toBe('analysis/r1');
        expect(t.ref).toBe('refs/heads/analysis/r1');
        expect(t.base).toBe('main');
        expect(Object.isFrozen(t)).toBe(true);
    });

    it.each(ADVERSARIAL_REFS.filter((r) => r !== '' && r !== 'HEAD'))('refuses a run id or base that would smuggle %j', (bad) => {
        expect(() => PublicationTarget.forRun(bad, 'main')).toThrow();
        expect(() => PublicationTarget.forRun('r1', bad)).toThrow();
    });
});

describe('allowedPaths / recordPublication (council finding 3)', () => {
    it('is the emitted roadmaps plus the dashboard regenerated for them', () => {
        expect(allowedPaths(EMITTED)).toEqual(['agents/roadmaps-progress.md', 'agents/roadmaps/road-to-x.md']);
    });

    it.each(['src/rules/x.md', 'agents/roadmaps/../../src/x.md', 'agents/roadmaps/archive/road-to-x.md', '/etc/passwd', 'agents/roadmaps/road-to-x.ts'])(
        'refuses to record %j as a publishable path',
        (bad) => {
            const { runDir } = validatedRun({ publication: false });
            expect(() => recordPublication(runDir, [bad])).toThrow(/publishable/);
            expect(fs.existsSync(path.join(runDir, PUBLICATION_FILE))).toBe(false);
        },
    );
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

    it('ignores a caller-named branch: a refspec never reaches the push (finding 1)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const hostile = { ...INPUT, branch: ':refs/heads/main' } as PublishInput;
        const out = publish(f.port, runDir, record, hostile);
        expect(out.record.state).toBe('pr-open');
        expect(f.calls.filter((c) => c.startsWith('push:'))).toEqual(['push:analysis/r1:null']);
        expect([...f.remote.keys()]).toEqual(['analysis/r1']);
    });

    it.each([':refs/heads/main', '-f', 'a..b'])('hands back on a base of %j before any remote effect (finding 1)', (base) => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const out = publish(f.port, runDir, record, { ...INPUT, base });
        expect(out.record.state).toBe('handed-back');
        expect(f.calls).toEqual([]);
    });

    it('hands back when the remote head moves between the check and the push (finding 2)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort({ raceOnPush: sha(99) });
        const out = publish(f.port, runDir, record, INPUT);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/expected-head/);
        expect(f.remote.get('analysis/r1')).toBe(sha(99));
        expect(f.calls.some((c) => c.startsWith('pr-create'))).toBe(false);
    });

    it('hands back when the base SHA is not an ancestor of the run head (finding 2)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const out = publish(f.port, runDir, record, { ...INPUT, baseSha: sha(77) });
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/base/);
        expect(f.calls).toEqual([]);
    });

    it('hands back on a base SHA that is not a full object id, even where the port would resolve it (finding 2)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const port: PublishPort = { ...f.port, isAncestor: () => true };
        const out = publish(port, runDir, record, { ...INPUT, baseSha: 'HEAD~1' });
        expect(out.record.state).toBe('handed-back');
        expect(f.calls).toEqual([]);
    });

    it('reads the allowed set from the run directory, never from the caller (finding 3)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort({ staged: [...EMITTED, 'src/rules/x.md'] });
        const hostile = { ...INPUT, emitted: [...EMITTED, 'src/rules/x.md'] } as PublishInput;
        const out = publish(f.port, runDir, record, hostile);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/src\/rules\/x\.md/);
        expect(f.calls).toEqual([]);
    });

    it('hands back when the publication record is missing or names a path outside the fixed shape (finding 3)', () => {
        const missing = validatedRun({ publication: false });
        const f = fakePort();
        expect(publish(f.port, missing.runDir, missing.record, INPUT).record.state).toBe('handed-back');

        fs.rmSync(path.join(root, 'agents'), { recursive: true, force: true });
        const tampered = validatedRun({ publication: false });
        fs.writeFileSync(path.join(tampered.runDir, PUBLICATION_FILE), JSON.stringify({ schema_version: '1.0', emitted: ['src/rules/x.md'] }));
        const g = fakePort({ staged: ['src/rules/x.md'] });
        const out = publish(g.port, tampered.runDir, tampered.record, INPUT);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/publishable/);
        expect(f.calls).toEqual([]);
        expect(g.calls).toEqual([]);
    });

    it('takes the PR body from the run directory, ignoring a caller-named file (finding 4)', () => {
        const { runDir, record } = validatedRun();
        const f = fakePort();
        const hostile = { ...INPUT, bodyFile: '/etc/passwd' } as PublishInput;
        publish(f.port, runDir, record, hostile);
        const create = f.calls.find((c) => c.startsWith('pr-create:')) as string;
        expect(create).toContain(`--body-file ${path.join(runDir, PR_BODY_FILE)}`);
        expect(create).not.toContain('/etc/passwd');
    });

    it('hands back when the PR body is missing, a directory, or a symbolic or hard link (finding 4)', () => {
        const missing = validatedRun({ body: false });
        const f = fakePort();
        expect(publish(f.port, missing.runDir, missing.record, INPUT).record.state).toBe('handed-back');
        expect(f.calls).toEqual([]);

        fs.rmSync(path.join(root, 'agents'), { recursive: true, force: true });
        const linked = validatedRun({ body: false });
        const secret = path.join(root, 'secret.txt');
        fs.writeFileSync(secret, 'token\n');
        fs.symlinkSync(secret, path.join(linked.runDir, PR_BODY_FILE));
        const g = fakePort();
        const out = publish(g.port, linked.runDir, linked.record, INPUT);
        expect(out.record.state).toBe('handed-back');
        expect(out.record.handed_back_reason).toMatch(/body/);
        expect(g.calls).toEqual([]);

        fs.rmSync(path.join(root, 'agents'), { recursive: true, force: true });
        const dir = validatedRun({ body: false });
        fs.mkdirSync(path.join(dir.runDir, PR_BODY_FILE));
        const h = fakePort();
        expect(publish(h.port, dir.runDir, dir.record, INPUT).record.handed_back_reason).toMatch(/regular file/);
        expect(h.calls).toEqual([]);

        fs.rmSync(path.join(root, 'agents'), { recursive: true, force: true });
        const hard = validatedRun({ body: false });
        fs.linkSync(secret, path.join(hard.runDir, PR_BODY_FILE));
        const k = fakePort();
        expect(publish(k.port, hard.runDir, hard.record, INPUT).record.handed_back_reason).toMatch(/hard-linked/);
        expect(k.calls).toEqual([]);
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

    it('a fix push whose lease fails hands back instead of throwing (finding 2)', () => {
        const red: CiVerdict = { green: false, red: ['lint'] };
        const { runDir, record, f, pr } = openRun([red, red]);
        const port: PublishPort = {
            ...f.port,
            push: (target) => {
                f.remote.set(target.branch, sha(98));
                throw new Error('stale info');
            },
        };
        const out = settleCi(port, runDir, record, { ...INPUT, pr }, () => EMITTED);
        expect(out.state).toBe('handed-back');
        expect(out.handed_back_reason).toMatch(/expected-head/);
    });
});

describe('gitGhPort against a real bare remote (findings 1 and 2)', () => {
    function git(args: string[], cwd: string): string {
        return execFileSync('git', ['-c', 'user.email=t@example.com', '-c', 'user.name=t', ...args], { cwd, stdio: 'pipe' }).toString().trim();
    }

    function setup(): { origin: string; work: string; other: string } {
        const origin = path.join(root, 'origin.git');
        const work = path.join(root, 'work');
        const other = path.join(root, 'other');
        fs.mkdirSync(origin);
        git(['init', '-q', '--bare', '-b', 'main'], origin);
        fs.mkdirSync(work);
        git(['init', '-q', '-b', 'main'], work);
        git(['remote', 'add', 'origin', origin], work);
        fs.writeFileSync(path.join(work, 'a.md'), 'a\n');
        git(['add', 'a.md'], work);
        git(['commit', '-q', '-m', 'base'], work);
        git(['push', '-q', 'origin', 'main'], work);
        git(['clone', '-q', origin, other], root);
        return { origin, work, other };
    }

    it('pushes only the run branch, refuses a lease on a moved head and a create over an existing branch', () => {
        const { origin, work, other } = setup();
        const mainBefore = git(['rev-parse', 'refs/heads/main'], origin);
        const port = gitGhPort(work);
        const target = PublicationTarget.forRun('r1', 'main');

        expect(port.remoteHead(target)).toBeNull();
        fs.writeFileSync(path.join(work, 'b.md'), 'b\n');
        git(['add', 'b.md'], work);
        const first = port.commit('first');
        port.push(target, null);
        expect(port.remoteHead(target)).toBe(first);
        expect(git(['rev-parse', 'refs/heads/main'], origin)).toBe(mainBefore);
        expect(port.isAncestor(mainBefore, first)).toBe(true);
        expect(port.isAncestor(first, mainBefore)).toBe(false);

        // Someone else rewinds the branch to an ancestor of ours: a plain push would fast-forward over it,
        // the lease on the head we last saw must refuse and change nothing.
        git(['push', '-q', '--force', 'origin', `${mainBefore}:refs/heads/analysis/r1`], other);
        fs.writeFileSync(path.join(work, 'd.md'), 'd\n');
        git(['add', 'd.md'], work);
        port.commit('second');
        expect(() => port.push(target, first)).toThrow();
        expect(port.remoteHead(target)).toBe(mainBefore);
        expect(() => port.push(target, null)).toThrow();
        expect(port.remoteHead(target)).toBe(mainBefore);
        expect(git(['rev-parse', 'refs/heads/main'], origin)).toBe(mainBefore);
    });

    it('refuses an expected head that is not a full object id', () => {
        const { work } = setup();
        const port = gitGhPort(work);
        expect(() => port.push(PublicationTarget.forRun('r1', 'main'), 'main')).toThrow(/object id/);
    });
});
