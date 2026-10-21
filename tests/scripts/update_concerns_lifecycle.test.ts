/**
 * The state lifecycle of the two update concerns: what each writes, when it
 * stops writing, how it recovers, and that nothing else reads what they write.
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { claimInvite, readInviteState, runInvite, UNREADABLE_INVITE_RECORD, type InviteDeps } from '../../src/scripts/update_invite_hook.js';
import { NOTICE_STATE_SCHEMA, readNoticeState, runNotice, type NoticeDeps } from '../../src/scripts/update_notice_hook.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');

let tmp: string;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'update-lifecycle-'));
});
afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

function install(version: string): string {
    const root = path.join(tmp, 'pkg');
    fs.mkdirSync(path.join(root, 'dist', 'agent-src'), { recursive: true });
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: '@event4u/agent-config', version }));
    fs.writeFileSync(path.join(root, 'CHANGELOG.md'), `# Changelog\n\n## [${version}] - 2026-10-21\n`);
    return root;
}

function probe(candidate: string): string {
    const p = path.join(tmp, 'probe', 'update-check.json');
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify({ last_seen_version: candidate }));
    return p;
}

const statePath = (): string => path.join(tmp, 'state', 'update-notice.json');

function notice(over: Partial<NoticeDeps> = {}): NoticeDeps {
    // The fixture files are shared paths, so a default is written only when the
    // caller did not supply its own — otherwise it would overwrite the override.
    return {
        packageRoot: over.packageRoot ?? install('1.0.0'),
        projectRoot: tmp,
        sessionId: 'own-session',
        env: {},
        isTty: true,
        mode: 'auto',
        probeStatePath: over.probeStatePath ?? probe('2.0.0'),
        noticeStatePath: statePath(),
        registerDir: path.join(tmp, 'register'),
        err: { write: () => undefined },
        ...over,
    };
}

function snapshot(p: string): { body: string; mtimeMs: number } {
    return { body: fs.readFileSync(p, 'utf-8'), mtimeMs: fs.statSync(p).mtimeMs };
}

describe('update-notice state — write', () => {
    it('writes the record atomically at mode 0600 with its schema, leaving no temp file', () => {
        runNotice(notice());
        const body = JSON.parse(fs.readFileSync(statePath(), 'utf-8')) as Record<string, unknown>;
        expect(body).toEqual({ schema: NOTICE_STATE_SCHEMA, staged: '2.0.0', last_seen_installed: '1.0.0' });
        expect(fs.statSync(statePath()).mode & 0o777).toBe(0o600);
        expect(fs.readdirSync(path.dirname(statePath()))).toEqual(['update-notice.json']);
    });

    it('replaces a symlink at the record path instead of writing through it', () => {
        const target = path.join(tmp, 'elsewhere.json');
        fs.writeFileSync(target, 'untouched\n');
        fs.mkdirSync(path.dirname(statePath()), { recursive: true });
        fs.symlinkSync(target, statePath());
        runNotice(notice());
        expect(fs.readFileSync(target, 'utf-8')).toBe('untouched\n');
        expect(fs.lstatSync(statePath()).isSymbolicLink()).toBe(false);
    });
});

describe('update-notice state — recovery', () => {
    it('reads a record that does not parse as empty, and replaces it on the next write', () => {
        fs.mkdirSync(path.dirname(statePath()), { recursive: true });
        fs.writeFileSync(statePath(), '{ not json');
        expect(readNoticeState(statePath())).toEqual({ staged: null, last_seen_installed: null });
        runNotice(notice());
        expect(readNoticeState(statePath()).staged).toBe('2.0.0');
    });

    it('reads a record carrying another schema as empty', () => {
        fs.mkdirSync(path.dirname(statePath()), { recursive: true });
        fs.writeFileSync(statePath(), JSON.stringify({ schema: NOTICE_STATE_SCHEMA + 1, staged: '9.0.0', last_seen_installed: '8.0.0' }));
        expect(readNoticeState(statePath())).toEqual({ staged: null, last_seen_installed: null });
    });
});

describe('update-notice state — reconciliation', () => {
    it('clears a staged candidate once nothing newer than the installed version is cached', () => {
        runNotice(notice());
        expect(readNoticeState(statePath()).staged).toBe('2.0.0');
        runNotice(notice({ packageRoot: install('2.0.0'), probeStatePath: probe('2.0.0') }));
        expect(readNoticeState(statePath())).toEqual({ staged: null, last_seen_installed: '2.0.0' });
    });

    it('leaves the record alone when nothing newer is cached and nothing is stale', () => {
        runNotice(notice({ probeStatePath: probe('1.0.0') }));
        const before = snapshot(statePath());
        runNotice(notice({ probeStatePath: probe('1.0.0') }));
        expect(snapshot(statePath())).toEqual(before);
    });
});

describe('update-notice state — the disable paths neither write nor delete', () => {
    const disabled: Array<[string, Partial<NoticeDeps>]> = [
        ['AGENT_CONFIG_NO_UPDATE_CHECK=1', { env: { AGENT_CONFIG_NO_UPDATE_CHECK: '1' } }],
        ['update.mode off', { mode: 'off' }],
        ['CI', { env: { CI: 'true' } }],
    ];
    for (const [label, over] of disabled) {
        it(`under ${label}, a pre-existing record keeps its bytes and its mtime`, () => {
            runNotice(notice());
            const before = snapshot(statePath());
            const outcome = runNotice(notice({ ...over, probeStatePath: probe('3.0.0') }));
            expect(outcome.lines).toEqual([]);
            expect(snapshot(statePath())).toEqual(before);
        });
    }
});

function invite(statePathFor: string, over: Partial<InviteDeps> = {}): { deps: InviteDeps; out: string[] } {
    const out: string[] = [];
    return {
        out,
        deps: {
            packageRoot: REPO_ROOT,
            workspaceRoot: path.join(tmp, 'ws'),
            sessionId: '',
            mode: 'ask',
            statePath: statePathFor,
            ringZeroText: 'ring-0-exit: yes\n',
            env: {},
            isTty: true,
            out: { write: (t) => void out.push(t) },
            turnEndedOnVerifiedSuccess: true,
            ...over,
        },
    };
}

describe('update-auto-invite state', () => {
    const invitePath = (): string => path.join(tmp, 'state', 'update-invite.json');

    it('reads an absent record as never invited', () => {
        expect(readInviteState(invitePath())).toEqual({ invited_at: null });
    });

    it('reads a record that does not parse as already invited, so corruption never re-opens the question', () => {
        fs.mkdirSync(path.dirname(invitePath()), { recursive: true });
        fs.writeFileSync(invitePath(), '{ not json');
        expect(readInviteState(invitePath())).toEqual({ invited_at: UNREADABLE_INVITE_RECORD });
    });

    it('reads a legacy record without invited_at as already invited', () => {
        fs.mkdirSync(path.dirname(invitePath()), { recursive: true });
        fs.writeFileSync(invitePath(), JSON.stringify({ never: true, invited_at: null }));
        expect(readInviteState(invitePath()).invited_at).not.toBeNull();
    });

    it('under the env kill switch, writes nothing and leaves an existing record untouched', () => {
        fs.mkdirSync(path.dirname(invitePath()), { recursive: true });
        fs.writeFileSync(invitePath(), JSON.stringify({ invited_at: '2026-10-01T00:00:00.000Z' }));
        const before = snapshot(invitePath());
        const { deps, out } = invite(invitePath(), { env: { AGENT_CONFIG_NO_UPDATE_CHECK: '1' } });
        expect(runInvite(deps)).toEqual({ ask: false, reason: 'AGENT_CONFIG_NO_UPDATE_CHECK=1' });
        expect(out).toEqual([]);
        expect(snapshot(invitePath())).toEqual(before);
    });

    it('is shared by every workspace of one config home: the first repository is asked, the second is not', () => {
        const a = invite(invitePath(), { workspaceRoot: path.join(tmp, 'repo-a') });
        expect(runInvite(a.deps).ask).toBe(true);
        expect(a.out.length).toBeGreaterThan(0);
        const b = invite(invitePath(), { workspaceRoot: path.join(tmp, 'repo-b') });
        expect(runInvite(b.deps)).toEqual({ ask: false, reason: 'already invited once' });
        expect(b.out).toEqual([]);
    });

    for (const mode of ['notify', 'off', 'auto'] as const) {
        it(`update.mode ${mode} asks nothing and leaves an existing record untouched`, () => {
            fs.mkdirSync(path.dirname(invitePath()), { recursive: true });
            fs.writeFileSync(invitePath(), JSON.stringify({ invited_at: '2026-10-01T00:00:00.000Z' }));
            const before = snapshot(invitePath());
            const { deps, out } = invite(invitePath(), { mode });
            expect(runInvite(deps)).toEqual({ ask: false, reason: 'no user opt-in: update.mode is not ask' });
            expect(out).toEqual([]);
            expect(snapshot(invitePath())).toEqual(before);
        });
    }

    it('a claim whose write fails throws nothing, leaves no record, and a later claim succeeds', () => {
        const failing = (): void => {
            throw Object.assign(new Error('ENOSPC: no space left on device'), { code: 'ENOSPC' });
        };
        expect(claimInvite(invitePath(), '2026-10-21T00:00:00.000Z', failing)).toBe(false);
        expect(fs.existsSync(invitePath())).toBe(false);
        expect(claimInvite(invitePath(), '2026-10-21T00:00:00.000Z')).toBe(true);
        expect(readInviteState(invitePath())).toEqual({ invited_at: '2026-10-21T00:00:00.000Z' });
    });

    it('three sessions that decide at the same moment produce exactly one invitation', async () => {
        const go = path.join(tmp, 'go');
        const script = path.join(tmp, 'race.ts');
        const hook = path.join(REPO_ROOT, 'src', 'scripts', 'update_invite_hook.ts');
        // Each child imports the hook, then announces it is ready and spins on
        // the go file, so the parent releases them only once all three are
        // loaded and waiting at the same point.
        fs.writeFileSync(
            script,
            [
                `import * as fs from 'node:fs';`,
                `import { runInvite } from ${JSON.stringify(hook)};`,
                `fs.writeFileSync(${JSON.stringify(tmp)} + '/ready-' + process.argv[3], '');`,
                `while (!fs.existsSync(${JSON.stringify(go)})) { /* spin until released */ }`,
                `const d = runInvite({ packageRoot: ${JSON.stringify(REPO_ROOT)}, workspaceRoot: process.argv[2]!, sessionId: '', mode: 'ask',`,
                `  statePath: ${JSON.stringify(invitePath())}, ringZeroText: 'ring-0-exit: yes\\n', env: {}, isTty: true,`,
                `  out: { write: () => undefined }, turnEndedOnVerifiedSuccess: true });`,
                `process.stdout.write(d.ask ? 'asked' : 'silent');`,
            ].join('\n'),
        );
        const tsx = path.join(REPO_ROOT, 'node_modules', '.bin', 'tsx');
        const workers = ['a', 'b', 'c'];
        for (let round = 0; round < 5; round += 1) {
            fs.rmSync(invitePath(), { force: true });
            fs.rmSync(go, { force: true });
            for (const w of workers) fs.rmSync(path.join(tmp, `ready-${w}`), { force: true });
            const runs = workers.map(
                (w) =>
                    new Promise<{ out: string; err: string; code: number | null }>((resolve, reject) => {
                        const child = spawn(tsx, [script, path.join(tmp, `repo-${w}`), w], { cwd: REPO_ROOT });
                        let out = '';
                        let err = '';
                        child.stdout.on('data', (b: Buffer) => (out += b.toString()));
                        child.stderr.on('data', (b: Buffer) => (err += b.toString()));
                        child.on('error', reject);
                        child.on('close', (code) => resolve({ out, err, code }));
                    }),
            );
            const deadline = Date.now() + 60_000;
            while (!workers.every((w) => fs.existsSync(path.join(tmp, `ready-${w}`)))) {
                if (Date.now() > deadline) throw new Error(`round ${String(round)}: workers never all became ready`);
                await new Promise((r) => setTimeout(r, 20));
            }
            fs.writeFileSync(go, '');
            const results = await Promise.all(runs);
            for (const r of results) {
                expect(r.code, r.err).toBe(0);
                expect(r.err).toBe('');
            }
            const outs = results.map((r) => r.out);
            expect(outs.filter((o) => o === 'asked'), `round ${String(round)}: ${outs.join(',')}`).toHaveLength(1);
            expect(outs.filter((o) => o === 'silent')).toHaveLength(2);
        }
    }, 180_000);
});

describe('the read gate — nothing outside the two concerns reads their state', () => {
    const SRC = path.join(REPO_ROOT, 'src');
    const OWNERS = new Set(['src/scripts/update_notice_hook.ts', 'src/scripts/update_invite_hook.ts']);
    const files = (dir: string): string[] =>
        fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) return files(p);
            return /\.(ts|mjs|js)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [p] : [];
        });
    const all = files(SRC);

    it('scans the source tree', () => {
        expect(all.length).toBeGreaterThan(100);
    });

    it('imports either concern module from nowhere but the registry and the invite (which reads the mode)', () => {
        const IMPORTERS = new Set(['src/scripts/hooks/concern_registry.ts', 'src/scripts/update_invite_hook.ts']);
        const importers = all
            .filter((f) => /from\s+['"][^'"]*update_(notice|invite)_hook(\.js)?['"]|import\(\s*['"][^'"]*update_(notice|invite)_hook/.test(fs.readFileSync(f, 'utf-8')))
            .map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'));
        expect(importers.filter((r) => !IMPORTERS.has(r))).toEqual([]);
    });

    it('names update-notice.json and update-invite.json nowhere but in their owners', () => {
        const readers = all
            .filter((f) => /update-(notice|invite)\.json|NOTICE_STATE_FILENAME|INVITE_STATE_FILENAME|readNoticeState|readInviteState/.test(fs.readFileSync(f, 'utf-8')))
            .map((f) => path.relative(REPO_ROOT, f).split(path.sep).join('/'));
        expect(readers.filter((r) => !OWNERS.has(r))).toEqual([]);
    });
});
