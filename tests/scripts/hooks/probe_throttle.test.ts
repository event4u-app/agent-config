import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { probeRanToday, stampProbeRun } from '../../../src/scripts/hooks/probe_throttle.js';
import { main as profileMain } from '../../../src/scripts/profile_staleness_hook.js';
import { main as wrapperMain } from '../../../src/scripts/wrapper_freshness_hook.js';

const STAMP_DIR = ['agents', 'runtime', 'state', 'probe-throttle'] as const;

function stampPath(root: string, concern: string): string {
    return path.join(root, ...STAMP_DIR, `${concern}.stamp`);
}

function captureStderr() {
    const chunks: string[] = [];
    const orig = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((chunk: string | Uint8Array): boolean => {
        chunks.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString());
        return true;
    }) as typeof process.stderr.write;
    return {
        restore: () => {
            process.stderr.write = orig;
        },
        text: () => chunks.join(''),
    };
}

let tmp: string;
let spy: ReturnType<typeof captureStderr>;
beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-throttle-'));
    spy = captureStderr();
    delete process.env['AGENT_CONFIG_REPLAY'];
});
afterEach(() => {
    spy.restore();
    delete process.env['AGENT_CONFIG_REPLAY'];
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('probe_throttle — daily mtime stamp', () => {
    it('no stamp → probe is due', () => {
        expect(probeRanToday(tmp, 'x')).toBe(false);
    });

    it('same-day stamp → skipped; deleting the stamp only changes WHEN it re-runs', () => {
        stampProbeRun(tmp, 'x');
        expect(probeRanToday(tmp, 'x')).toBe(true);
        fs.rmSync(stampPath(tmp, 'x'));
        expect(probeRanToday(tmp, 'x')).toBe(false);
    });

    it('yesterday stamp (backdated mtime) → due again', () => {
        stampProbeRun(tmp, 'x');
        const p = stampPath(tmp, 'x');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        fs.utimesSync(p, yesterday, yesterday);
        expect(probeRanToday(tmp, 'x')).toBe(false);
    });

    it('future-dated stamp (clock skew) → not "today", probe runs — no lockout', () => {
        stampProbeRun(tmp, 'x');
        const p = stampPath(tmp, 'x');
        const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        fs.utimesSync(p, nextWeek, nextWeek);
        expect(probeRanToday(tmp, 'x')).toBe(false);
    });

    it('stamps are per concern', () => {
        stampProbeRun(tmp, 'a');
        expect(probeRanToday(tmp, 'a')).toBe(true);
        expect(probeRanToday(tmp, 'b')).toBe(false);
    });

    it('replay mode bypasses the throttle and never writes stamps', () => {
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        stampProbeRun(tmp, 'x');
        expect(fs.existsSync(stampPath(tmp, 'x'))).toBe(false);
        delete process.env['AGENT_CONFIG_REPLAY'];
        stampProbeRun(tmp, 'x');
        process.env['AGENT_CONFIG_REPLAY'] = '1';
        expect(probeRanToday(tmp, 'x')).toBe(false); // stamp exists, replay ignores it
    });

    it('unwritable state dir → fail-silent, probe stays due (fail-open)', () => {
        const blocked = path.join(tmp, 'agents');
        fs.mkdirSync(blocked, { recursive: true });
        fs.chmodSync(blocked, 0o444);
        try {
            expect(() => stampProbeRun(tmp, 'x')).not.toThrow();
            expect(probeRanToday(tmp, 'x')).toBe(false);
        } finally {
            fs.chmodSync(blocked, 0o755);
        }
    });
});

describe('probe throttle wired into the session_start probes', () => {
    it('profile-staleness: second same-day run is skipped (roadmap verify)', () => {
        const overlay = path.join(tmp, 'agents', 'settings', '.agent-settings.local.yml');
        fs.mkdirSync(path.dirname(overlay), { recursive: true });
        fs.writeFileSync(overlay, 'runtime:\n  active_packs:\n    - laravel\n');

        expect(profileMain(['--root', tmp])).toBe(0);
        expect(spy.text()).toContain('[profile]');
        expect(fs.existsSync(stampPath(tmp, 'profile-staleness'))).toBe(true);

        const before = spy.text().length;
        expect(profileMain(['--root', tmp])).toBe(0);
        expect(spy.text().length).toBe(before); // silent — skipped same day

        // next-day session runs again (backdate the stamp)
        const p = stampPath(tmp, 'profile-staleness');
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        fs.utimesSync(p, yesterday, yesterday);
        expect(profileMain(['--root', tmp])).toBe(0);
        expect(spy.text().slice(before)).toContain('[profile]');
    });

    it('wrapper-freshness: second same-day run is skipped', () => {
        // A non-source-repo root with no wrapper: first run completes the
        // probe (no-op) and stamps; the second returns on the throttle.
        expect(wrapperMain(['--root', tmp])).toBe(0);
        expect(fs.existsSync(stampPath(tmp, 'wrapper-freshness'))).toBe(true);
        expect(wrapperMain(['--root', tmp])).toBe(0);
    });
});
