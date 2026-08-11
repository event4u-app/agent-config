// R2 finding 9: the extracted helper shipped with no direct test — the step's
// verify command exercises at most one of its two call sites, leaving the
// off-set an untested cross-module invariant the moment a second module
// depends on it.
import { afterEach, describe, expect, it } from 'vitest';

import { isEnvKillSwitchActive } from '../../../src/scripts/_lib/env_kill_switch.js';

const VAR = 'AGENT_CONFIG_TEST_KILL_SWITCH';

afterEach(() => {
    delete process.env[VAR];
});

describe('isEnvKillSwitchActive — the off-set is explicit', () => {
    it('reads unset as off', () => {
        delete process.env[VAR];
        expect(isEnvKillSwitchActive(VAR)).toBe(false);
    });

    for (const off of ['', '0', 'false', 'False']) {
        it(`reads ${JSON.stringify(off)} as off`, () => {
            process.env[VAR] = off;
            expect(isEnvKillSwitchActive(VAR)).toBe(false);
        });
    }

    for (const on of ['1', 'true', 'yes', 'on']) {
        it(`reads ${JSON.stringify(on)} as on`, () => {
            process.env[VAR] = on;
            expect(isEnvKillSwitchActive(VAR)).toBe(true);
        });
    }

    it('reads the string "false" as OFF — the whole point of the explicit set', () => {
        // `Boolean(process.env.X)` reads this as true and arms a switch the
        // operator explicitly disarmed. That is the defect the helper exists for.
        process.env[VAR] = 'false';
        expect(Boolean(process.env[VAR])).toBe(true);
        expect(isEnvKillSwitchActive(VAR)).toBe(false);
    });

    it('fails toward ON for a spelling outside the off-set', () => {
        // Documented, not accidental: an unrecognised value suppresses nothing,
        // so a typo loses the suppression rather than silently swallowing a log.
        process.env[VAR] = 'FALSE';
        expect(isEnvKillSwitchActive(VAR)).toBe(true);
        process.env[VAR] = ' false';
        expect(isEnvKillSwitchActive(VAR)).toBe(true);
    });
});
