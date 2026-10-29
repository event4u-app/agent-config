// A dropped connection is not a release failure.
//
// Measured 2026-10-28 on 19.0.0: the branch push died on
// `ssh: connect to host github.com port 22: Undefined error: 0`, the tag push on
// `Connection reset by peer` / `Broken pipe`, and a `git fetch` hung for 1 h 47 min
// after the laptop slept. Every one of them needed a human to notice and re-run
// `task release -- --resume`, although nothing was wrong with the release.
//
// The discriminator is pinned in both directions: the transport wordings retry,
// and a pre-push gate, credentials or protection refusal stays fatal on the first
// attempt, so a real error is never retried into silence.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
    _is_transient_network_failure,
    _push_tag,
    _set_exec_override,
    _set_network_retry_delays,
    _test_trend_line_in_section,
    git_network_env,
} from '../../src/scripts/release_publication.js';
import { bump_workflow_major_pins } from '../../src/scripts/release_env.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

afterEach(() => {
    _set_exec_override(null);
    _set_network_retry_delays(null);
});

describe('_is_transient_network_failure — only the transport drops retry', () => {
    it('recognises the 19.0.0 branch-push failure, verbatim', () => {
        const stderr = [
            'ssh: connect to host github.com port 22: Undefined error: 0',
            'fatal: Could not read from remote repository.',
            '',
            'Please make sure you have the correct access rights',
            'and the repository exists.',
        ].join('\n');
        expect(_is_transient_network_failure(stderr, '')).toBe(true);
    });

    it('recognises the 19.0.0 tag-push failure, verbatim', () => {
        const stderr = [
            'Read from remote host github.com: Connection reset by peer',
            'client_loop: send disconnect: Broken pipe',
            'send-pack: unexpected disconnect while reading sideband packet',
            'fatal: the remote end hung up unexpectedly',
        ].join('\n');
        expect(_is_transient_network_failure(stderr, '')).toBe(true);
    });

    it('recognises a DNS failure and a connect timeout', () => {
        expect(_is_transient_network_failure('ssh: Could not resolve hostname github.com: nodename nor servname provided', '')).toBe(true);
        expect(_is_transient_network_failure('ssh: connect to host github.com port 22: Operation timed out', '')).toBe(true);
    });

    it('does NOT retry a missing key, even though git says it could not read', () => {
        const stderr = [
            'git@github.com: Permission denied (publickey).',
            'fatal: Could not read from remote repository.',
        ].join('\n');
        expect(_is_transient_network_failure(stderr, '')).toBe(false);
    });

    it('does NOT retry a pre-push gate, a protected branch or a moved ref', () => {
        expect(_is_transient_network_failure('❌  Preflight failed.\nerror: failed to push some refs', '')).toBe(false);
        expect(_is_transient_network_failure('remote: error: GH006: Protected branch update failed', '')).toBe(false);
        expect(_is_transient_network_failure(' ! [rejected]        main -> main (fetch first)', '')).toBe(false);
    });
});

describe('_push_tag — retries a dropped connection, never a refusal', () => {
    const DROP = 'Read from remote host github.com: Connection reset by peer\nfatal: the remote end hung up unexpectedly';

    it('a drop followed by success publishes the tag', () => {
        _set_network_retry_delays([0, 0]);
        const calls: string[] = [];
        _set_exec_override((args) => {
            calls.push(args.join(' '));
            const pushes = calls.filter((c) => c.startsWith('git push')).length;
            return pushes === 1 ? { status: 128, stdout: '', stderr: DROP } : { status: 0, stdout: '', stderr: '' };
        });
        expect(() => _push_tag('19.0.0')).not.toThrow();
        expect(calls.filter((c) => c === 'git push origin 19.0.0')).toHaveLength(2);
    });

    it('three drops in a row still fail, naming the network', () => {
        _set_network_retry_delays([0, 0]);
        let pushes = 0;
        _set_exec_override((args) => {
            if (args[0] === 'git' && args[1] === 'push') pushes += 1;
            return { status: 128, stdout: '', stderr: DROP };
        });
        const written: string[] = [];
        const spy = vi.spyOn(process.stderr, 'write').mockImplementation((chunk) => {
            written.push(String(chunk));
            return true;
        });
        try {
            expect(() => _push_tag('19.0.0')).toThrow();
        } finally {
            spy.mockRestore();
        }
        expect(pushes).toBe(3);
        expect(written.join('')).toMatch(/the network kept dropping/);
    });

    it('a pre-push refusal fails on the first attempt', () => {
        _set_network_retry_delays([0, 0]);
        let pushes = 0;
        _set_exec_override((args) => {
            if (args[0] === 'git' && args[1] === 'push') pushes += 1;
            return { status: 1, stdout: '', stderr: '❌  Preflight failed.\nerror: failed to push some refs' };
        });
        expect(() => _push_tag('19.0.0')).toThrow();
        expect(pushes).toBe(1);
    });
});

describe('git_network_env — a dead connection ends instead of hanging', () => {
    it('adds ssh keepalives when nothing configures ssh', () => {
        const env = git_network_env({ PATH: '/usr/bin' }, null);
        expect(env.GIT_SSH_COMMAND).toMatch(/ServerAliveInterval=\d+/);
        expect(env.GIT_SSH_COMMAND).toMatch(/ServerAliveCountMax=\d+/);
        expect(env.GIT_SSH_COMMAND).toMatch(/ConnectTimeout=\d+/);
        expect(env.GIT_HTTP_LOW_SPEED_LIMIT).toBeDefined();
        expect(env.GIT_HTTP_LOW_SPEED_TIME).toBeDefined();
    });

    it('never overrides an ssh command the operator chose', () => {
        expect(git_network_env({ GIT_SSH_COMMAND: 'ssh -i ~/.ssh/deploy' }, null).GIT_SSH_COMMAND).toBe('ssh -i ~/.ssh/deploy');
        expect(git_network_env({}, 'ssh -i ~/.ssh/work').GIT_SSH_COMMAND).toBeUndefined();
    });
});

// A resume must not pay a full vitest collection for a footer it already wrote.
// On 19.0.0 the probe timed out twice (ETIMEDOUT at 180 s under load) and ran
// again on a resume whose PR was already merged.
describe('_test_trend_line_in_section — a resume reuses the footer it wrote', () => {
    const CHANGELOG = [
        '# Changelog',
        '',
        '## [19.0.0](https://example.invalid/compare/18.2.0...19.0.0) (2026-10-28)',
        '',
        '### Features',
        '',
        '* something',
        '',
        'Tests: 35403 (+1868 since 18.2.0)',
        '',
        '## [18.2.0](https://example.invalid) (2026-10-27)',
        '',
        'Tests: 33535',
    ].join('\n');

    it('returns the footer of the target section verbatim', () => {
        expect(_test_trend_line_in_section(CHANGELOG, '19.0.0')).toBe('Tests: 35403 (+1868 since 18.2.0)');
    });

    it('never borrows the footer of a neighbouring section', () => {
        const without = CHANGELOG.replace('Tests: 35403 (+1868 since 18.2.0)\n', '');
        expect(_test_trend_line_in_section(without, '19.0.0')).toBeNull();
        expect(_test_trend_line_in_section(CHANGELOG, '20.0.0')).toBeNull();
    });
});

// 19.0.0 shipped with `pr-risk-review.yml` still installing `@18` and
// `advisories-daily.yml` still running `@16`: the cut bumped the settings
// template's pin and nothing else, so a consumer copying the workflow got the
// previous major. The bump now rewrites every major pin in the shipped
// workflow templates.
describe('bump_workflow_major_pins — the workflow templates follow the major', () => {
    it('rewrites every npm major pin to the target major', () => {
        const before = [
            'run: npm install -g @event4u/agent-config@18',
            'run: npx --yes @event4u/agent-config@16 audit:deps refresh --force',
        ].join('\n');
        expect(bump_workflow_major_pins(before, '19.0.0')).toBe(
            [
                'run: npm install -g @event4u/agent-config@19',
                'run: npx --yes @event4u/agent-config@19 audit:deps refresh --force',
            ].join('\n'),
        );
    });

    it('leaves an exact or prerelease pin, and other packages, alone', () => {
        const text = 'a: @event4u/agent-config@18.2.0\nb: @event4u/agent-config-extra@18\nc: @other/pkg@18';
        expect(bump_workflow_major_pins(text, '19.0.0')).toBe(text);
    });

    it('the shipped workflow templates carry the current major', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8')) as { version: string };
        const dir = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'github-workflows');
        for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.yml'))) {
            const text = fs.readFileSync(path.join(dir, f), 'utf8');
            expect(bump_workflow_major_pins(text, pkg.version), f).toBe(text);
        }
    });
});

// Neutral review of #2737, round 2.
describe('review findings on the release hardening', () => {
    it.each([
        'error: RPC failed; curl 18 transfer closed with outstanding read data remaining',
        'error: RPC failed; curl 56 GnuTLS recv error (-54): Error in the pull function.',
        'Connection closed by 140.82.121.4 port 22',
        'Connection to github.com closed by remote host.',
        'fatal: early EOF',
    ])('retries the transport drop: %s', (stderr) => {
        expect(_is_transient_network_failure(stderr, '')).toBe(true);
    });

    it('a stable version never borrows the footer of its release candidate', () => {
        const text = '## [20.0.0-rc.1](x) (2026-11-01)\n\nTests: 1 (+1 since 19.0.0)\n';
        expect(_test_trend_line_in_section(text, '20.0.0')).toBeNull();
        expect(_test_trend_line_in_section(text, '20.0.0-rc.1')).toBe('Tests: 1 (+1 since 19.0.0)');
    });
});
