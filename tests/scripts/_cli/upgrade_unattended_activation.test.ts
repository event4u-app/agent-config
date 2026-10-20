/**
 * Step 1.4, the consumer half — `upgrade --unattended` stops being blocked by
 * a constant and starts being blocked by a MEASUREMENT.
 *
 * `ACTIVATION_BLOCKED` was a standing refusal: the production wiring passed it
 * unconditionally, so the unattended run refused whether or not a session was
 * live. With the machine-wide register in place the refusal has to come from
 * reading that register, which means both directions are now observable — and
 * both are asserted here, because a gate tested only in its refusing direction
 * is indistinguishable from the constant it replaced.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { activation_blocked_reason } from '../../../src/scripts/_cli/upgrade_unattended.js';
import { iso_now, write_record } from '../../../src/scripts/_lib/session_register.js';

let home: string;
let dir: string;

beforeEach(() => {
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'unattended-activation-'));
    dir = path.join(home, 'runtime', 'sessions');
});

afterEach(() => {
    fs.rmSync(home, { recursive: true, force: true });
});

function record(session_id: string, worktree: string, last_seen: string) {
    return {
        session_id,
        platform: 'claude',
        worktree,
        branch: 'main',
        roadmap_slug: null,
        started_at: last_seen,
        last_seen,
    };
}

describe('activation_blocked_reason', () => {
    it('returns null when no session is registered anywhere on the machine', () => {
        expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).toBeNull();
    });

    it('returns null when the only records have aged past their TTL', () => {
        fs.mkdirSync(dir, { recursive: true });
        const old = new Date(Date.now() - 48 * 3600 * 1000);
        write_record(dir, record('stale', '/repo/a', iso_now(old)));
        expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).toBeNull();
    });

    it('refuses while a session is live, naming the hooks it would break', () => {
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('live-one', '/repo/a', iso_now()));
        const reason = activation_blocked_reason({ EVENT4U_CONFIG_HOME: home });
        expect(reason).not.toBeNull();
        expect(reason).toMatch(/running session/i);
    });

    it('refuses for a session registered from a DIFFERENT repository', () => {
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('peer', '/an/unrelated/checkout', iso_now()));
        expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).not.toBeNull();
    });

    it('stops refusing once the live record is removed', () => {
        fs.mkdirSync(dir, { recursive: true });
        write_record(dir, record('live-one', '/repo/a', iso_now()));
        expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).not.toBeNull();
        fs.rmSync(path.join(dir, 'live-one.json'));
        expect(activation_blocked_reason({ EVENT4U_CONFIG_HOME: home })).toBeNull();
    });
});
