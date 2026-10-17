/**
 * The egress ladder's outgoing `gh pr create`, scripted through the injectable
 * runner (`ReleaseDeps.runner`) rather than shelled out.
 *
 * F4 of road-to-one-upstream-that-checks-what-leaves: `prArgs` carried no
 * `--draft`, so every upstream finding arrived as a review request against a
 * maintainer who had not asked for one. The flag is one argument and nothing
 * watched it, which is how it was absent for the whole life of the ladder.
 *
 * Both rungs are asserted, not just the one the happy path takes. The two
 * share one `prArgs` array today, so one `--draft` does cover both — but the
 * fork rung reaches it down a different path (fork-ensure, whoami, a second
 * remote, then an extra `--head`), and a later split of that array would be
 * invisible to a test that only drove the direct-push rung. The fork route is
 * the one a contributor without push rights actually takes, which is the one
 * that must not quietly start opening ready-for-review.
 */
import { describe, expect, it } from 'vitest';

import type { DefectRecord } from '../../src/scripts/_lib/self_repair.js';
import type {
    Probe,
    ReleaseDeps,
    ReleasePlan,
    RunResult,
    Runner,
} from '../../src/scripts/self_repair_cli.js';
import { consumerDenyList, executeRelease, renderDryRun } from '../../src/scripts/self_repair_cli.js';

const OK: RunResult = { ok: true, out: '', timedOut: false };

// Typed, not cast. An `as unknown as DefectRecord` would switch off exactly
// the check that tells this fixture when the record shape moves under it —
// a fixture that compiles against a type it does not satisfy is a fixture
// that stops reporting drift.
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

function plan(pushVia: 'upstream' | 'fork'): ReleasePlan {
    return {
        route: 'pull-request',
        pushVia,
        blocked: null,
        patch_denied: null,
        title: 'a title',
        body: 'a body',
    };
}

function probe(canFork: boolean): Probe {
    return {
        agentConfigCheckout: '/some/checkout',
        ghAuthenticated: true,
        canPushUpstream: true,
        canFork,
    };
}

/**
 * A runner that answers every command successfully and records the argv of
 * each `gh pr create`. `git branch --show-current` has to answer a real branch
 * name or the ladder refuses before it ever reaches the forge.
 */
function scriptedRunner(): { runner: Runner; prCalls: string[][] } {
    const prCalls: string[][] = [];
    const runner: Runner = (cmd, args) => {
        if (cmd === 'git' && args[0] === 'branch') {
            return { ok: true, out: 'retro/abc123de\n', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'api') {
            return { ok: true, out: 'some-login\n', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'create') {
            prCalls.push([...args]);
            return { ok: true, out: 'https://example.invalid/pr/1\n', timedOut: false };
        }
        return OK;
    };
    return { runner, prCalls };
}

function deps(runner: Runner): ReleaseDeps {
    return { runner, now: () => '2026-10-14T00:00:00.000Z' };
}

describe('the upstream pull request is a draft', () => {
    it('pr-is-draft — the direct-push rung passes --draft', () => {
        const { runner, prCalls } = scriptedRunner();
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', deps(runner));

        expect(out.published).toBe('pull-request');
        expect(prCalls).toHaveLength(1);
        expect(prCalls[0]).toContain('--draft');
    });

    it('pr-is-draft — the fork rung passes --draft too', () => {
        const { runner, prCalls } = scriptedRunner();
        const out = executeRelease(record(), plan('fork'), probe(true), 'o/r', deps(runner));

        expect(out.published).toBe('pull-request');
        expect(prCalls).toHaveLength(1);
        expect(prCalls[0]).toContain('--draft');
        // The fork rung is the one that adds --head; asserting it here is what
        // makes this a test of the fork path rather than a second copy of the
        // one above.
        expect(prCalls[0]).toContain('--head');
    });

    it('--draft precedes the title, so no value is read as the flag', () => {
        const { runner, prCalls } = scriptedRunner();
        executeRelease(record(), plan('upstream'), probe(false), 'o/r', deps(runner));

        const args = prCalls[0] as string[];
        // The -1 guard is not decoration. Written as `indexOf('--draft') <
        // indexOf('--title')` alone, this case passed with the flag REMOVED —
        // absent is -1, and -1 is less than everything. The sensitivity probe
        // that removes the flag caught it; without this line the case would
        // have shipped as a third assertion that asserts nothing.
        expect(args).toContain('--draft');
        expect(args.indexOf('--draft')).toBeLessThan(args.indexOf('--title'));
        expect(args[args.indexOf('--title') + 1]).toBe('a title');
        expect(args[args.indexOf('--body') + 1]).toBe('a body');
    });
});

/**
 * F2: the privacy floor scanned the record's text while the release pushed a
 * whole branch. These cases script the branch's bytes — its name, the commit
 * identities and messages, every commit's patch — and assert that a finding in
 * any of them refuses the pull request, names WHERE it was found, and never
 * prints the value it found.
 */
interface Payload {
    branch?: string;
    log?: string;
    patches?: string;
    logOk?: boolean;
}

function payloadRunner(p: Payload): { runner: Runner; prCalls: string[][]; issueCalls: number } {
    const state = { prCalls: [] as string[][], issueCalls: 0 };
    const runner: Runner = (cmd, args) => {
        if (cmd === 'git' && args[0] === 'branch') {
            return { ok: true, out: `${p.branch ?? 'fix/neutral'}\n`, timedOut: false };
        }
        if (cmd === 'git' && args[0] === 'log' && args.includes('-p')) {
            return { ok: p.logOk ?? true, out: p.patches ?? '', timedOut: false };
        }
        if (cmd === 'git' && args[0] === 'log') {
            return { ok: p.logOk ?? true, out: p.log ?? '', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'pr' && args[1] === 'create') {
            state.prCalls.push([...args]);
            return { ok: true, out: 'https://example.invalid/pr/1\n', timedOut: false };
        }
        if (cmd === 'gh' && args[0] === 'issue') {
            state.issueCalls += 1;
            return { ok: true, out: 'https://example.invalid/issues/1\n', timedOut: false };
        }
        return OK;
    };
    return {
        runner,
        get prCalls() {
            return state.prCalls;
        },
        get issueCalls() {
            return state.issueCalls;
        },
    };
}

function denyDeps(runner: Runner, deny: string[]): ReleaseDeps {
    return { runner, now: () => '2026-10-17T00:00:00.000Z', denyIdentifiers: deny };
}

describe('the floor covers the whole payload, not only the record text', () => {
    it('consumer-identifier-in-diff-refuses — a consumer identifier in a patch refuses the pull request', () => {
        const r = payloadRunner({ patches: '+++ b/src/rules/x.md\n+see the acmewidgets billing service\n' });
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(r.runner, ['acmewidgets']));

        expect(r.prCalls).toHaveLength(0);
        const scan = out.attempts.find((a) => a.step === 'payload-scan');
        expect(scan?.detail).toMatch(/diff/);
        expect(scan?.detail).not.toMatch(/acmewidgets/i);
        // Degrades to the issue, which carries only the floored record text.
        expect(out.published).toBe('issue');
    });

    it('consumer-identifier-in-diff-refuses — branch name, identity and message are scanned too', () => {
        for (const [p, part] of [
            [{ branch: 'fix/acmewidgets-thing' }, 'branch'],
            [{ log: 'Jane <jane@acmewidgets.example>\nJane <jane@acmewidgets.example>\nfix: x\n\0' }, 'commit'],
            [{ log: 'A <a@users.noreply.github.com>\nA <a@users.noreply.github.com>\nfix: the AcmeWidgets case\n\0' }, 'commit'],
        ] as const) {
            const r = payloadRunner(p);
            const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(r.runner, ['acmewidgets']));
            expect(r.prCalls).toHaveLength(0);
            expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).toMatch(new RegExp(part));
        }
    });

    it('consumer-identifier-in-diff-refuses — a credential from the detector table refuses with its rule named', () => {
        const r = payloadRunner({ patches: '+const k = "AKIAIOSFODNN7EXAMPLE";\n' });
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(r.runner, []));

        expect(r.prCalls).toHaveLength(0);
        const detail = out.attempts.find((a) => a.step === 'payload-scan')?.detail ?? '';
        expect(detail).toMatch(/aws-access-key/);
        expect(detail).not.toMatch(/AKIAIOSFODNN7EXAMPLE/);
    });

    it('consumer-identifier-in-diff-refuses — a payload that cannot be read refuses (fail-closed)', () => {
        const r = payloadRunner({ logOk: false });
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(r.runner, []));

        expect(r.prCalls).toHaveLength(0);
        expect(out.attempts.find((a) => a.step === 'payload-scan')?.detail).toMatch(/could not be read/);
    });

    it('a clean payload still opens the draft pull request', () => {
        const r = payloadRunner({
            log: 'A <a@users.noreply.github.com>\nA <a@users.noreply.github.com>\nfix: tighten a rule\n\0',
            patches: '+++ b/src/rules/x.md\n+a neutral sentence\n',
        });
        const out = executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(r.runner, ['acmewidgets']));

        expect(out.published).toBe('pull-request');
        expect(r.prCalls).toHaveLength(1);
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

describe('a refused title or body does not leave through the issue either', () => {
    it('consumer-identifier-in-diff-refuses — an identifier in the body refuses the issue fallback too', () => {
        const r = payloadRunner({});
        const p = { ...plan('upstream'), body: 'seen in the acmewidgets checkout' };
        const out = executeRelease(record(), p, probe(false), 'o/r', denyDeps(r.runner, ['acmewidgets']));

        expect(r.prCalls).toHaveLength(0);
        expect(r.issueCalls).toBe(0);
        expect(out.published).toBeNull();
    });

    it('the patch read forces text and disables textconv and external diff drivers', () => {
        const seen: string[][] = [];
        const inner = payloadRunner({}).runner;
        const runner: Runner = (cmd, args, cwd) => {
            if (cmd === 'git' && args[0] === 'log' && args.includes('-p')) {
                seen.push([...args]);
            }
            return inner(cmd, args, cwd);
        };
        executeRelease(record(), plan('upstream'), probe(false), 'o/r', denyDeps(runner, []));

        expect(seen).toHaveLength(1);
        for (const flag of ['--text', '--no-textconv', '--no-ext-diff']) {
            expect(seen[0]).toContain(flag);
        }
    });
});
