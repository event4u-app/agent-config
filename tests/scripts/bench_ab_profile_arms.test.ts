import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

import { ARMS, profile_rules_text } from '../../internal/bench/core/_lib/bench_ab_arms.js';

function fixture(profiles: Record<string, string[]>): { router: string; rules: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'profile-arms-'));
    const rules = path.join(dir, 'rules');
    fs.mkdirSync(rules);
    for (const id of ['k1', 'k2', 't1a', 't2a', 't2b', 'extra']) fs.writeFileSync(path.join(rules, `${id}.md`), `BODY-${id}\n`);
    const router = path.join(dir, 'router.json');
    fs.writeFileSync(
        router,
        JSON.stringify({ kernel: ['k1', 'k2'], tier_1: [{ id: 't1a' }], tier_2: [{ id: 't2a' }, { id: 't2b' }], profiles }),
    );
    return { router, rules };
}

const PROFILES = { minimal: ['__kernel__'], essential: ['__kernel__', 'extra'], full: ['__kernel__', '__tier_1__', '__tier_2__'] };
const bodiesOf = (text: string) => text.match(/BODY-[a-z0-9]+/g);

describe('profile_rules_text', () => {
    it('expands each profile from the router, never from a hard-coded list', () => {
        const f = fixture(PROFILES);
        expect(bodiesOf(profile_rules_text('minimal', f.router, f.rules))).toEqual(['BODY-k1', 'BODY-k2']);
        expect(bodiesOf(profile_rules_text('essential', f.router, f.rules))).toEqual(['BODY-k1', 'BODY-k2', 'BODY-extra']);
        expect(bodiesOf(profile_rules_text('full', f.router, f.rules))).toEqual(['BODY-k1', 'BODY-k2', 'BODY-t1a', 'BODY-t2a', 'BODY-t2b']);
    });

    it('follows a changed profile definition', () => {
        const f = fixture({ ...PROFILES, essential: ['__kernel__', 't2b'] });
        expect(bodiesOf(profile_rules_text('essential', f.router, f.rules))).toEqual(['BODY-k1', 'BODY-k2', 'BODY-t2b']);
    });

    it('refuses a profile the router does not define', () => {
        const f = fixture(PROFILES);
        expect(() => profile_rules_text('balanced', f.router, f.rules)).toThrow(/no profile "balanced"/);
    });
});

describe('profile arms', () => {
    it('run with the plugin off and the profile injected as text', () => {
        for (const p of ['minimal', 'essential', 'full']) {
            expect(ARMS[`profile-${p}`]).toMatchObject({ setting_sources: 'project,local', inject: `profile-${p}` });
        }
    });

    it('exempt only the kernel-only arm from the footprint-lift audit', () => {
        expect(ARMS['profile-minimal']?.min_lift_ratio).toBeNull();
        expect(ARMS['profile-essential']?.min_lift_ratio).toBeUndefined();
        expect(ARMS['profile-full']?.min_lift_ratio).toBeUndefined();
    });
});
