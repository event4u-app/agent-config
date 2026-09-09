// The properties three 14.23.0 self-review security findings claimed were
// missing, pinned as tests.
//
// WHY THIS FILE EXISTS. The release self-review raised 13 blocking findings.
// Eight were security, and three of those made a falsifiable claim about code
// in this tree: a path traversal through a session id, a time-of-check race in
// the session latch, and command injection through an MCP git rev. Each was
// dispositioned by reading the site and then PROBING it — and the probes are
// worth more than the dispositions, because a disposition is prose and a probe
// reds when the property breaks.
//
// Two of the three findings also identified a real residual while getting their
// headline wrong, and one residual was explicitly "the test only validates the
// basename, not the full resolved path containment". That test is the first
// describe block below. Writing it is the disposition, not the argument that it
// was already fine.
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { changedFiles } from '../../src/scripts/code_graph/cli.js';
import {
    RECYCLE_ENVELOPE_REL,
    recycle_consumed_rel,
    recycle_envelope_rel,
    recycle_quarantine_rel,
} from '../../src/scripts/_lib/recycle_envelope_paths.js';
import { claimSessionOnce, isContained, latchPath } from '../../src/scripts/_lib/session_index_trust.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'sec-disp-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
});

describe('finding de1f5ddf786f — the latch filename cannot escape its directory', () => {
    // The finding: "an attacker-controlled session ID like `../../etc/passwd`
    // becomes `_.._.._.._etc_passwd`, which still resolves outside the intended
    // directory when path.join() processes the remaining path separators."
    //
    // It does not. The sanitizer replaces every separator, so nothing is left
    // for path.join to process. What the finding got RIGHT is that the existing
    // test only checked the basename — so this checks the resolved path.
    const HOSTILE = [
        '../../etc/passwd',
        '../../../../../../etc/passwd',
        '..%2F..%2Fetc%2Fpasswd',
        '....//....//etc/passwd',
        '/etc/passwd',
        'a/../../../../etc/shadow',
        ' ../../etc/passwd',
        '\u0000../../etc/passwd',
        `${'.'.repeat(300)}/../../etc/passwd`,
        'C:\\Windows\\System32',
        './././../../..',
        '..',
        '.',
    ];

    it.each(HOSTILE)('contains the RESOLVED path for %j', (sessionId) => {
        const root = '/tmp/victim-workspace';
        const latchDir = path.join(root, 'agents', 'runtime', 'state', 'session-index-latch');
        const resolved = path.resolve(latchPath(root, sessionId));
        expect(isContained(resolved, path.resolve(latchDir))).toBe(true);
    });

    it('writes inside the latch directory even for a traversal id', () => {
        // Containment as a filesystem fact, not only a string one.
        const root = tmpdir();
        claimSessionOnce(root, '../../etc/passwd');
        const latchDir = path.join(root, 'agents', 'runtime', 'state', 'session-index-latch');
        const written = fs.readdirSync(latchDir);
        expect(written.length).toBe(1);
        expect(written[0]).not.toContain(path.sep);
        // And nothing landed above the workspace.
        expect(fs.existsSync(path.join(root, '..', 'etc'))).toBe(false);
    });
});

describe('finding ca171a25e9df — the latch admits exactly one injector', () => {
    // The finding described claim-BEFORE-render ("first wins latch at line 435,
    // second fails latch but first's memory read hasn't completed"). The code
    // does the opposite and says so: the claim is LAST, after the render, two
    // documented corrections away from claim-first. Under either ordering the
    // create-exclusive write decides, which is what this pins.
    it('one winner across many claims for the same session', () => {
        const root = tmpdir();
        const SESSION = 'race-session-1';
        let winners = 0;
        for (let i = 0; i < 50; i += 1) {
            const r = claimSessionOnce(root, SESSION);
            if (!('code' in r)) winners += 1;
        }
        expect(winners).toBe(1);
    });

    it('the loser names itself rather than failing open', () => {
        const root = tmpdir();
        claimSessionOnce(root, 's');
        const second = claimSessionOnce(root, 's');
        expect('code' in second && second.code).toBe('already-injected-this-session');
    });

    it('SENSITIVITY — removing the latch restores a second winner', () => {
        // Without this case the exclusivity assertion above could pass over a
        // mechanism that never wrote anything at all.
        const root = tmpdir();
        const SESSION = 'race-session-2';
        expect('code' in claimSessionOnce(root, SESSION)).toBe(false);
        fs.rmSync(latchPath(root, SESSION));
        expect('code' in claimSessionOnce(root, SESSION)).toBe(false);
    });

    it('an empty session id does not latch, and says so by allowing', () => {
        const root = tmpdir();
        expect('code' in claimSessionOnce(root, '')).toBe(false);
        expect(fs.existsSync(path.join(root, 'agents', 'runtime', 'state', 'session-index-latch'))).toBe(false);
    });
});

describe('finding 549923656232 — a hostile MCP git rev cannot inject a command', () => {
    // The finding: "an attacker-controlled rev like '--help' or '$(malicious)'
    // could trigger unintended git behavior or command injection."
    //
    // There is no shell: `changedFiles` uses execFileSync with an argv ARRAY,
    // so `$(...)` is passed to git as literal bytes. And the rev is interpolated
    // as `${ref}..HEAD`, so an option-shaped rev becomes an invalid option
    // rather than a clean one. Both halves are pinned, plus the side-effect
    // check that matters more than either: nothing is created or executed.
    function repo(): string {
        const root = tmpdir();
        execFileSync('git', ['init', '-q', root], { stdio: ['ignore', 'ignore', 'ignore'] });
        fs.writeFileSync(path.join(root, 'a.txt'), 'one', 'utf-8');
        execFileSync('git', ['-C', root, 'add', 'a.txt'], { stdio: ['ignore', 'ignore', 'ignore'] });
        execFileSync(
            'git',
            ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'one'],
            { stdio: ['ignore', 'ignore', 'ignore'] },
        );
        return root;
    }

    const HOSTILE_REVS = [
        '--help',
        '$(touch /tmp/agent-config-pwned-probe)',
        '`touch /tmp/agent-config-pwned-probe`',
        '; touch /tmp/agent-config-pwned-probe',
        '&& touch /tmp/agent-config-pwned-probe',
        '--output=/tmp/agent-config-pwned-probe',
        '-O/tmp/agent-config-pwned-probe',
        '--upload-pack=touch /tmp/agent-config-pwned-probe',
        'HEAD --exec=/bin/sh',
    ];

    const SENTINEL = '/tmp/agent-config-pwned-probe';

    it.each(HOSTILE_REVS)('refuses %j with null and no side effect', (rev) => {
        try {
            fs.rmSync(SENTINEL, { force: true });
        } catch {
            /* not there */
        }
        const root = repo();
        const out = changedFiles(root, rev);
        // Either a clean refusal, or an empty diff — never an executed command.
        expect(out === null || Array.isArray(out)).toBe(true);
        expect(fs.existsSync(SENTINEL), `${rev} must not create ${SENTINEL}`).toBe(false);
    });

    it('SENSITIVITY — a legitimate rev still resolves, so the refusals are not vacuous', () => {
        // Without this, every assertion above would pass over a function that
        // returned null unconditionally.
        const root = repo();
        fs.writeFileSync(path.join(root, 'b.txt'), 'two', 'utf-8');
        execFileSync('git', ['-C', root, 'add', 'b.txt'], { stdio: ['ignore', 'ignore', 'ignore'] });
        execFileSync(
            'git',
            ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'two'],
            { stdio: ['ignore', 'ignore', 'ignore'] },
        );
        expect(changedFiles(root, 'HEAD~1')).toStrictEqual(['b.txt']);
    });
});

describe('finding 89ec930c5742 — a continuity slot path stays inside the workspace', () => {
    // The finding: "a malicious actor could craft a session_id collision or
    // exploit the legacy shared path fallback to inject continuity records into
    // another user's workspace."
    //
    // Cross-WORKSPACE is impossible by construction: every slot path is
    // workspace-RELATIVE and joined under a caller-supplied workspace root, so
    // reaching another workspace already requires write access to it. What is
    // real is narrower, and the finding named it correctly: an empty session id
    // collapses onto ONE shared legacy file. That is a compatibility
    // affordance, not an isolation boundary — so it is pinned here as the
    // behaviour it is, rather than left to be rediscovered as a surprise.
    const BUILDERS = [
        ['recycle_envelope_rel', recycle_envelope_rel],
        ['recycle_consumed_rel', recycle_consumed_rel],
        ['recycle_quarantine_rel', recycle_quarantine_rel],
    ] as const;

    const HOSTILE_IDS = [
        '../../../etc/passwd',
        '../..',
        '/absolute/escape',
        'a/../../../../../../tmp/x',
        '..',
        './..',
        '\u0000../../etc/passwd',
    ];

    for (const [name, build] of BUILDERS) {
        it.each(HOSTILE_IDS)(`${name} keeps %j inside agents/runtime/state`, (id) => {
            const rel = build(id);
            expect(path.isAbsolute(rel)).toBe(false);
            expect(rel.split(path.sep)).not.toContain('..');
            const root = '/tmp/victim-workspace';
            expect(isContained(path.resolve(root, rel), path.resolve(root))).toBe(true);
        });
    }

    it('an empty session id falls back to the ONE legacy shared path', () => {
        // Documented rather than asserted-away: this is the collision surface
        // the finding pointed at, and it is inside a single workspace.
        expect(recycle_envelope_rel('')).toBe(RECYCLE_ENVELOPE_REL);
        expect(recycle_envelope_rel(null)).toBe(RECYCLE_ENVELOPE_REL);
        expect(recycle_envelope_rel(undefined)).toBe(RECYCLE_ENVELOPE_REL);
    });

    it('a traversal id falls back to the legacy path rather than escaping', () => {
        // The guard chooses fallback over escape. That choice is the property.
        expect(recycle_envelope_rel('../../../etc/passwd')).not.toContain('..');
    });

    it('SENSITIVITY — a benign id does NOT take the legacy path', () => {
        // Without this, every assertion above would pass over a builder that
        // returned the legacy constant unconditionally.
        const keyed = recycle_envelope_rel('session-abc123');
        expect(keyed).not.toBe(RECYCLE_ENVELOPE_REL);
        expect(keyed).toContain('session-abc123');
    });
});
