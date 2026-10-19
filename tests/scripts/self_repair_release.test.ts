/**
 * The egress ladder's outgoing bytes, against a real repository.
 *
 * Each case builds a throwaway "upstream" (a bare repository) and a checkout
 * of it with an author branch, then runs the real `executeRelease`: git runs
 * for real, so the commit the release synthesises, the objects it pushes and
 * the identity they carry are read back out of the bare repository rather
 * than asserted from a scripted argv. Only `gh` is scripted — it is the forge,
 * and nothing here may reach one.
 *
 * Road-to-one-upstream-that-checks-what-leaves, Phases 2–4: the release
 * pushes ONE commit built from the author branch's net change on the base,
 * under a noreply identity and a `retro/<fingerprint>` branch; the floor walks
 * every object that commit adds; and nothing is sent without an approval of
 * the exact bytes the dry run printed.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { gitEnv } from '../../src/scripts/_lib/git_env.js';
import { chooseEgress, type DefectRecord } from '../../src/scripts/_lib/self_repair.js';
import { noreplyIdentity, outgoingDigest } from '../../src/scripts/_lib/self_repair_outgoing.js';
import type { Probe, ReleaseDeps, ReleasePlan, RunResult, Runner } from '../../src/scripts/self_repair_cli.js';
import {
    capabilityOf,
    collectOutgoing,
    consumerDenyList,
    executeRelease,
    findAgentConfigCheckout,
    renderDryRun,
    runCommand,
} from '../../src/scripts/self_repair_cli.js';

// Typed, not cast: a fixture that compiles against a type it does not
// satisfy stops reporting drift when the record shape moves under it.
function record(): DefectRecord {
    return {
        fingerprint: 'abc123def4567890',
        defect_class: 'user-reported',
        source: 'user-reported',
        evidence: 'a sanitized span',
        suggested_surface: 'src/rules/example.md',
        first_seen: '2026-10-14T00:00:00.000Z',
        last_seen: '2026-10-14T00:00:00.000Z',
        occurrences: 1,
        status: 'open',
    };
}

function plan(pushVia: 'upstream' | 'fork', over: Partial<ReleasePlan> = {}): ReleasePlan {
    return { route: 'pull-request', pushVia, blocked: null, patch_denied: null, title: 'a title', body: 'a body', ...over };
}

const LOGIN = 'some-login';
const ACCOUNT_ID = '4242';
const NOREPLY = `${ACCOUNT_ID}+${LOGIN}@users.noreply.github.com`;

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]): string {
    return execFileSync('git', args, { cwd, encoding: 'utf-8', env: gitEnv() });
}

interface Repo {
    checkout: string;
    origin: string;
    /** Write a file and commit it on the current branch of the checkout. */
    commit: (file: string, content: string | Buffer | null, message?: string) => void;
}

/**
 * A bare upstream with one commit on `main`, and a checkout of it on
 * `fix/neutral` whose configured identity is a company address — the case
 * the noreply identity exists for.
 */
function repo(): Repo {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-release-'));
    dirs.push(dir);
    const origin = path.join(dir, 'origin.git');
    const checkout = path.join(dir, 'checkout');
    fs.mkdirSync(checkout);
    git(dir, 'init', '-q', '--bare', '-b', 'main', origin);
    git(checkout, 'init', '-q', '-b', 'main');
    git(checkout, 'config', 'user.name', 'Jane Example');
    git(checkout, 'config', 'user.email', 'jane@acme-corp.example');
    git(checkout, 'config', 'commit.gpgsign', 'false');
    const commit = (file: string, content: string | Buffer | null, message = 'change'): void => {
        const p = path.join(checkout, file);
        if (content === null) {
            fs.rmSync(p);
        } else {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, content);
        }
        git(checkout, 'add', '-A', '--', file);
        git(checkout, 'commit', '-q', '-m', message);
    };
    commit('README.md', 'base\n', 'base');
    git(checkout, 'remote', 'add', 'origin', origin);
    git(checkout, 'push', '-q', '-u', 'origin', 'main');
    git(checkout, 'switch', '-q', '-c', 'fix/neutral');
    return { checkout, origin, commit };
}

function probe(r: Repo, canFork = false): Probe {
    return { agentConfigCheckout: r.checkout, ghAuthenticated: true, canPushUpstream: true, canFork };
}

/** Real git, scripted `gh`. Records every forge call. */
function forge(opts: { identity?: string | null; login?: string } = {}): { runner: Runner; pr: string[][]; issues: string[][]; pushes: string[][] } {
    const state = { pr: [] as string[][], issues: [] as string[][], pushes: [] as string[][] };
    const login = opts.login ?? LOGIN;
    const runner: Runner = (cmd, args, cwd, env, runOpts) => {
        if (cmd === 'git') {
            if (args[0] === 'push') state.pushes.push([...args]);
            // A fork remote is not reachable from a test: answer it as pushed.
            if (args[0] === 'push' && args[1] === 'self-repair-fork') return { ok: true, out: '', timedOut: false };
            return runCommand(cmd, args, cwd, env, runOpts);
        }
        if (args[0] === 'api' && args.includes('.login')) return { ok: true, out: `${login}\n`, timedOut: false };
        if (args[0] === 'api') {
            const id = opts.identity === undefined ? `${ACCOUNT_ID} ${login}` : opts.identity;
            return id === null ? { ok: false, out: 'HTTP 401', timedOut: false } : { ok: true, out: `${id}\n`, timedOut: false };
        }
        if (args[0] === 'pr' && args[1] === 'create') {
            state.pr.push([...args]);
            return { ok: true, out: 'https://example.invalid/pr/1\n', timedOut: false };
        }
        if (args[0] === 'issue') {
            state.issues.push([...args]);
            return { ok: true, out: 'https://example.invalid/issues/1\n', timedOut: false };
        }
        return { ok: true, out: '', timedOut: false } satisfies RunResult;
    };
    return { runner, pr: state.pr, issues: state.issues, pushes: state.pushes };
}

/** Deps carrying the digest of exactly what the dry run would print now. */
function approved(
    r: Repo,
    f: ReturnType<typeof forge>,
    p: ReleasePlan,
    deny: string[] = [],
    rec = record(),
    repo = 'o/r',
): ReleaseDeps {
    const collected = collectOutgoing(rec, p, probe(r, p.pushVia === 'fork'), f.runner, repo);
    return {
        runner: f.runner,
        now: () => '2026-10-17T00:00:00.000Z',
        denyIdentifiers: deny,
        approvedDigest: outgoingDigest(collected.outgoing),
    };
}

const BRANCH = 'retro/abc123de';

function pushedLog(r: Repo): string {
    return git(r.origin, 'log', '-p', '--format=%an <%ae>%n%cn <%ce>%n%cd%n%B', `main..${BRANCH}`);
}

function hasPushedBranch(r: Repo): boolean {
    return git(r.origin, 'branch', '--list', BRANCH).trim() !== '';
}

describe('the release builds one clean commit and scans every object it adds', () => {
    it('release-scans-whole-object-graph — history added and removed on the branch never leaves', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'see the acmewidgets billing service\n', 'wip for acmewidgets');
        r.commit('src/rules/x.md', 'a neutral sentence\n', 'tidy');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream'), ['acmewidgets']));

        expect(out.published).toBe('pull-request');
        expect(git(r.origin, 'rev-list', '--count', `main..${BRANCH}`).trim()).toBe('1');
        const log = pushedLog(r);
        expect(log).toMatch(/a neutral sentence/);
        expect(log).not.toMatch(/acmewidgets|wip|tidy|fix\/neutral/i);
    });

    it('release-scans-whole-object-graph — an identifier in a blob refuses, nothing is pushed', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'see the acmewidgets billing service\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream'), ['acmewidgets']));

        expect(f.pr).toHaveLength(0);
        expect(f.pushes).toHaveLength(0);
        expect(hasPushedBranch(r)).toBe(false);
        const scan = out.attempts.find((a) => a.step === 'payload-scan')?.detail ?? '';
        expect(scan).toMatch(/consumer-identifier in object/);
        expect(scan).not.toMatch(/acmewidgets/i);
        // Degrades to the issue, which carries only the floored record text.
        expect(out.published).toBe('issue');
    });

    it('release-scans-whole-object-graph — a path, not only content, is an object the floor reads', () => {
        const r = repo();
        r.commit('docs/acmewidgets/notes.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream'), ['acmewidgets']));

        expect(f.pushes).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).toMatch(/object/);
    });

    it('release-scans-whole-object-graph — a credential from the detector table refuses with its rule named', () => {
        const r = repo();
        r.commit('src/scripts/k.ts', 'const k = "AKIAIOSFODNN7EXAMPLE";\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(f.pushes).toHaveLength(0);
        const detail = out.attempts.find((a) => a.step === 'payload-scan')?.detail ?? '';
        expect(detail).toMatch(/aws-access-key/);
        expect(detail).not.toMatch(/AKIAIOSFODNN7EXAMPLE/);
    });

    it('binary-blob-fails-closed — a token in a binary blob beside invalid UTF-8 refuses the push', () => {
        // UTF-16LE spells the token with a NUL after every byte, so no text
        // view of the blob carries it as one run; 0xFF 0xFE and a lone 0xC3
        // are not UTF-8 at all. A blob the floor cannot read as text is a
        // blob it cannot clear, so it refuses rather than guesses.
        const r = repo();
        const token = Buffer.from('AKIAIOSFODNN7EXAMPLE', 'utf16le');
        r.commit('assets/blob.bin', Buffer.concat([Buffer.from([0xff, 0xfe]), token, Buffer.from([0xc3])]));
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(f.pushes).toHaveLength(0);
        expect(hasPushedBranch(r)).toBe(false);
        expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).toMatch(/unscannable-binary in object/);
        expect(out.published).toBe('issue');
    });

    it('binary-blob-fails-closed — an ASCII token beside invalid UTF-8 bytes is read from the original bytes', () => {
        const r = repo();
        r.commit('assets/blob.bin', Buffer.concat([Buffer.from([0xc3]), Buffer.from('AKIAIOSFODNN7EXAMPLE'), Buffer.from([0xff])]));
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(f.pushes).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).toMatch(/in object/);
    });

    it('a branch with no change against the base sends nothing at all', () => {
        const r = repo();
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(out.published).toBeNull();
        expect(f.issues).toHaveLength(0);
        expect(out.attempts[0]?.detail).toMatch(/no change/);
    });
});

describe('the identity the commit carries', () => {
    it('company-identity-is-never-committed — author and committer are the noreply identity, dated in UTC', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(out.published).toBe('pull-request');
        const raw = git(r.origin, 'cat-file', 'commit', BRANCH);
        expect(raw).toMatch(new RegExp(`^author ${LOGIN} <${NOREPLY.replace(/[.+]/g, '\\$&')}> \\d+ \\+0000$`, 'm'));
        expect(raw).toMatch(new RegExp(`^committer ${LOGIN} <${NOREPLY.replace(/[.+]/g, '\\$&')}> \\d+ \\+0000$`, 'm'));
        expect(raw).not.toMatch(/acme-corp|Jane/);
        expect(raw).not.toMatch(/gpgsig/);
    });

    it('company-identity-is-never-committed — no resolvable noreply identity means no push', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge({ identity: null });
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(f.pushes).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'identity')?.detail).toMatch(/noreply/);
        expect(out.published).toBe('issue');
    });

    it('a malformed login or id is refused rather than turned into an address', () => {
        expect(noreplyIdentity('some-login', '4242')?.email).toBe(NOREPLY);
        expect(noreplyIdentity('some login', '4242')).toBeNull();
        expect(noreplyIdentity('some-login', 'x42')).toBeNull();
        expect(noreplyIdentity('', '4242')).toBeNull();
    });
});

describe('the upstream pull request is a draft on a neutral branch', () => {
    it('pr-is-draft — the direct-push rung passes --draft and names the retro branch', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        expect(out.published).toBe('pull-request');
        expect(f.pr).toHaveLength(1);
        const args = f.pr[0] as string[];
        expect(args).toContain('--draft');
        expect(args[args.indexOf('--head') + 1]).toBe(BRANCH);
        expect(f.pushes[0]).toEqual(['push', 'origin', expect.stringMatching(new RegExp(`^[0-9a-f]{40}:refs/heads/${BRANCH}$`))]);
    });

    it('pr-is-draft — the fork rung passes --draft too, with the fork owner in --head', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('fork'), probe(r, true), 'o/r', approved(r, f, plan('fork')));

        expect(out.published).toBe('pull-request');
        const args = f.pr[0] as string[];
        expect(args).toContain('--draft');
        expect(args[args.indexOf('--head') + 1]).toBe(`${LOGIN}:${BRANCH}`);
    });

    it('--draft precedes the title, so no value is read as the flag', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        executeRelease(record(), plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream')));

        const args = f.pr[0] as string[];
        // The -1 guard is not decoration: absent is -1, and -1 is less than
        // everything, so the index comparison alone passes with the flag gone.
        expect(args).toContain('--draft');
        expect(args.indexOf('--draft')).toBeLessThan(args.indexOf('--title'));
        expect(args[args.indexOf('--title') + 1]).toBe('a title');
        expect(args[args.indexOf('--body') + 1]).toBe('a body');
    });
});

describe('the person approves the exact bytes', () => {
    it('changed-bytes-void-approval — a commit after the dry run voids the approval, nothing leaves', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const deps = approved(r, f, plan('upstream'));
        r.commit('src/rules/x.md', 'a different sentence\n');
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', deps);

        expect(out.published).toBeNull();
        expect(f.pushes).toHaveLength(0);
        expect(f.issues).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'approval')?.detail).toMatch(/not the text that would be sent/);
    });

    it('changed-bytes-void-approval — a changed body voids it too, on the issue route', () => {
        const r = repo();
        const f = forge();
        const issuePlan = plan('upstream', { route: 'issue', pushVia: null });
        const deps = approved(r, f, issuePlan);
        const out = executeRelease(record(), { ...issuePlan, body: 'another body' }, probe(r), 'o/r', deps);

        expect(out.published).toBeNull();
        expect(f.issues).toHaveLength(0);
    });

    it('changed-bytes-void-approval — no approval at all refuses', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', { runner: f.runner, now: () => '2026-10-17T00:00:00.000Z' });

        expect(out.published).toBeNull();
        expect(f.pushes).toHaveLength(0);
        expect(out.attempts[0]?.detail).toMatch(/--approve/);
    });

    it('changed-destination-voids-approval — the same content sent to another repository is refused', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/other', approved(r, f, plan('upstream'), [], record(), 'o/r'));

        expect(out.published).toBeNull();
        expect(f.pushes).toHaveLength(0);
        expect(f.issues).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'approval')).toBeDefined();
    });

    it('changed-destination-voids-approval — the same content sent from another account is refused', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const deps = approved(r, forge(), plan('upstream'));
        const other = forge({ login: 'another-login' });
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', { ...deps, runner: other.runner });

        expect(out.published).toBeNull();
        expect(other.pushes).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'approval')).toBeDefined();
    });

    it('changed-destination-voids-approval — the same issue sent from another account is refused', () => {
        const r = repo();
        const issuePlan = plan('upstream', { route: 'issue', pushVia: null });
        const deps = approved(r, forge(), issuePlan);
        const other = forge({ login: 'another-login' });
        const out = executeRelease(record(), issuePlan, probe(r), 'o/r', { ...deps, runner: other.runner });

        expect(out.published).toBeNull();
        expect(other.issues).toHaveLength(0);
    });

    it('changed-destination-voids-approval — a moved base voids it, since the commit would sit on another parent', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const deps = approved(r, f, plan('upstream'));
        // A second commit on the base, published, then fetched.
        git(r.checkout, 'switch', '-q', 'main');
        r.commit('README.md', 'base moved\n', 'moved');
        git(r.checkout, 'push', '-q', 'origin', 'main');
        git(r.checkout, 'switch', '-q', 'fix/neutral');
        git(r.checkout, 'fetch', '-q', 'origin');
        const out = executeRelease(record(), plan('upstream'), probe(r), 'o/r', deps);

        expect(out.published).toBeNull();
        expect(f.pushes).toHaveLength(0);
    });

    it('the dry run prints every byte it digests — branch, identity, message, diff, title, body', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const collected = collectOutgoing(record(), plan('upstream'), probe(r), f.runner, 'o/r');
        const text = renderDryRun(plan('upstream'), LOGIN, collected);

        for (const needle of [BRANCH, NOREPLY, 'Self-repair fingerprint: abc123def4567890', '+a neutral sentence', 'a title', 'a body', 'o/r', LOGIN, r.origin, 'upstream']) {
            expect(text).toContain(needle);
        }
        expect(text).toContain(`DIGEST ${outgoingDigest(collected.outgoing)}`);
        expect(text).not.toMatch(/acme-corp|fix\/neutral/);
        expect(f.pushes).toHaveLength(0);
    });
});

describe('a refused title or body does not leave through the issue either', () => {
    it('consumer-identifier-in-diff-refuses — an identifier in the body refuses the issue fallback too', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'a neutral sentence\n');
        const f = forge();
        const p = plan('upstream', { body: 'seen in the acmewidgets checkout' });
        const out = executeRelease(record(), p, probe(r), 'o/r', approved(r, f, p, ['acmewidgets']));

        expect(f.pr).toHaveLength(0);
        expect(f.issues).toHaveLength(0);
        expect(f.pushes).toHaveLength(0);
        expect(out.published).toBeNull();
        expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).not.toMatch(/acmewidgets/i);
    });

    it('consumer-identifier-in-diff-refuses — the re-rendered issue body of a degraded pull request is scanned too', () => {
        const r = repo();
        r.commit('src/rules/x.md', 'see the acmewidgets billing service\n');
        const f = forge();
        const rec = { ...record(), evidence: 'seen in the acmewidgets checkout' };
        const out = executeRelease(rec, plan('upstream'), probe(r), 'o/r', approved(r, f, plan('upstream'), ['acmewidgets'], rec));

        expect(f.issues).toHaveLength(0);
        expect(out.published).toBeNull();
    });

    it('the deny list never contains the target repository itself', () => {
        expect(consumerDenyList(['acmewidgets', 'event4u', 'agent-config', 'event4u-app'], 'event4u-app/agent-config')).toEqual([
            'acmewidgets',
        ]);
    });
});

describe('the dry run says which account the send will carry', () => {
    it('dry-run-names-the-account — a pull request and an issue both name the account', () => {
        for (const route of ['pull-request', 'issue'] as const) {
            const text = renderDryRun({ ...plan('upstream'), route }, 'some-login');
            expect(text).toMatch(/some-login/);
            expect(text).toMatch(/a title/);
        }
    });

    it('dry-run-names-the-account — an unresolvable account is said out loud, not omitted', () => {
        const text = renderDryRun({ ...plan('upstream'), route: 'issue' }, null);
        expect(text).toMatch(/account.*could not be resolved/i);
    });

    it('dry-run-names-the-account — a local-only plan names no account, since nothing leaves', () => {
        const text = renderDryRun({ ...plan('upstream'), route: 'local-only' }, 'some-login');
        expect(text).not.toMatch(/some-login/);
    });
});

describe('a consumer project reaches the issue step, not a pull request (D5)', () => {
    function packageCheckout(): string {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-checkout-'));
        dirs.push(dir);
        fs.mkdirSync(path.join(dir, 'src', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(dir, 'src', 'scripts'), { recursive: true });
        fs.writeFileSync(path.join(dir, 'src', 'scripts', 'hook_manifest.yaml'), '');
        return dir;
    }

    it('AGENT_CONFIG_SOURCE set in a consumer project widens nothing', () => {
        const checkout = packageCheckout();
        const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-consumer-'));
        dirs.push(consumer);
        expect(findAgentConfigCheckout({ AGENT_CONFIG_SOURCE: checkout }, consumer)).toBeNull();
        expect(findAgentConfigCheckout({}, consumer)).toBeNull();
    });

    it('AGENT_CONFIG_SOURCE names the checkout from inside it, and the checkout itself is found without it', () => {
        const checkout = packageCheckout();
        expect(findAgentConfigCheckout({ AGENT_CONFIG_SOURCE: checkout }, path.join(checkout, 'src', 'rules'))).toBe(checkout);
        expect(findAgentConfigCheckout({}, checkout)).toBe(checkout);
    });

    // AC-5 as D5 rewords it: the consumer's ladder ends at the issue even when
    // every forge capability is present, and the same capabilities inside the
    // checkout reach the pull request — so the stop is the checkout, not gh.
    it('consumer-reaches-the-issue-step — full forge rights from a consumer plan an issue, from the checkout a pull request', () => {
        const checkout = packageCheckout();
        const consumer = fs.mkdtempSync(path.join(os.tmpdir(), 'self-repair-consumer-'));
        dirs.push(consumer);
        const rights = { ghAuthenticated: true, canPushUpstream: true, canFork: true };
        const env = { AGENT_CONFIG_SOURCE: checkout };
        const fromConsumer: Probe = { agentConfigCheckout: findAgentConfigCheckout(env, consumer), ...rights };
        const fromCheckout: Probe = { agentConfigCheckout: findAgentConfigCheckout(env, checkout), ...rights };
        expect(chooseEgress(capabilityOf(fromConsumer)).route).toBe('issue');
        expect(chooseEgress(capabilityOf(fromCheckout)).route).toBe('pull-request');
    });
});
