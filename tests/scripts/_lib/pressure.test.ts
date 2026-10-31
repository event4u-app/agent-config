import { describe, expect, it } from 'vitest';

import type { QuotaSnapshot } from '../../../src/scripts/_lib/quota_ledger.js';
import {
    classify,
    describeWindow,
    exhaustedResetAt,
    planPressure,
    sessionContextFill,
    STALE_AFTER_MS,
    windowPressure,
} from '../../../src/scripts/_lib/pressure.js';

const NOW = Date.UTC(2026, 9, 25, 12, 0, 0);
const MIN = 60_000;
const RESET_IN_3H = Math.trunc((NOW + 180 * MIN) / 1000);

function snap(minAgo: number, pct: number, resets_at: number | null = RESET_IN_3H, extra: Partial<QuotaSnapshot> = {}): QuotaSnapshot {
    return { ts: NOW - minAgo * MIN, session: 's1', five_hour: { pct, resets_at }, ...extra };
}

describe('classify', () => {
    it.each([
        [10, null, 'ok'],
        [55, null, 'warm'],
        [85, null, 'hot'],
        [100, null, 'exhausted'],
        [104, null, 'exhausted'],
    ] as const)('fill %i with no projection → %s', (fill, eta, state) => {
        expect(classify(fill, eta, RESET_IN_3H)).toBe(state);
    });

    it('a projection that runs out before the reset makes a low fill warm and a half fill hot', () => {
        const early = NOW + 60 * MIN;
        expect(classify(30, early, RESET_IN_3H)).toBe('warm');
        expect(classify(55, early, RESET_IN_3H)).toBe('hot');
    });

    it('a projection past the reset changes nothing', () => {
        expect(classify(55, NOW + 400 * MIN, RESET_IN_3H)).toBe('warm');
        expect(classify(30, NOW + 400 * MIN, RESET_IN_3H)).toBe('ok');
    });
});

describe('windowPressure', () => {
    it('the 60-minute drain: 30 % rising 1 %/min is warm long before half the window', () => {
        const ledger = [snap(10, 20), snap(5, 25), snap(0, 30)];
        const w = windowPressure(ledger, 'five_hour', NOW);
        expect(w.state).toBe('warm');
        expect(w.burn_per_min).toBeCloseTo(1, 5);
        expect(w.eta_full_ms).toBe(NOW + 70 * MIN);
    });

    it('a slow week at 60 % with no burn is warm, not hot', () => {
        const w = windowPressure([snap(10, 60), snap(5, 60), snap(0, 60)], 'five_hour', NOW);
        expect(w.state).toBe('warm');
        expect(w.eta_full_ms).toBeNull();
    });

    it('a burst of refreshes under five minutes apart gives no burn rate', () => {
        const w = windowPressure([snap(2, 20), snap(1, 30), snap(0, 40)], 'five_hour', NOW);
        expect(w.burn_per_min).toBeNull();
    });

    it('fewer than three points give no burn rate', () => {
        const w = windowPressure([snap(5, 40), snap(0, 45)], 'five_hour', NOW);
        expect(w.burn_per_min).toBeNull();
        expect(w.state).toBe('ok');
    });

    it('stale is unknown, never ok', () => {
        const w = windowPressure([snap(STALE_AFTER_MS / MIN + 1, 10)], 'five_hour', NOW);
        expect(w.state).toBe('unknown');
        expect(w.fill).toBe(10);
    });

    it('a window one second past its reset is no reading, not exhausted', () => {
        const passed = Math.trunc(NOW / 1000) - 1;
        const w = windowPressure([snap(4, 99, passed), snap(2, 100, passed), snap(0, 100, passed)], 'five_hour', NOW);
        expect(w.state).toBe('unknown');
        expect(w.fill).toBeNull();
        expect(w.eta_full_ms).toBeNull();
    });

    it('a window resetting exactly now still reads', () => {
        const w = windowPressure([snap(0, 100, Math.trunc(NOW / 1000) + 1)], 'five_hour', NOW);
        expect(w.state).toBe('exhausted');
    });

    it('an empty ledger is unknown', () => {
        expect(windowPressure([], 'seven_day', NOW).state).toBe('unknown');
    });

    it('points from before a reset do not bend the slope', () => {
        const oldReset = RESET_IN_3H - 5 * 3600;
        const ledger = [snap(12, 95, oldReset), snap(11, 96, oldReset), snap(6, 2), snap(3, 3), snap(0, 4)];
        const w = windowPressure(ledger, 'five_hour', NOW);
        expect(w.fill).toBe(4);
        expect(w.burn_per_min).toBeGreaterThan(0);
        expect(w.state).toBe('ok');
    });
});

describe('planPressure', () => {
    it('worst picks the more pressing window', () => {
        const ledger: QuotaSnapshot[] = [
            { ts: NOW, session: 's', five_hour: { pct: 10, resets_at: RESET_IN_3H }, seven_day: { pct: 97, resets_at: null } },
        ];
        const r = planPressure(ledger, NOW);
        expect(r.billing_class).toBe('plan');
        expect(r.worst.window).toBe('seven_day');
        expect(r.worst.state).toBe('hot');
    });
});

describe('exhaustedResetAt', () => {
    const later = RESET_IN_3H + 3600;
    it('reads the reset of the freshest snapshot with an exhausted window', () => {
        expect(exhaustedResetAt([snap(30, 100, later), snap(5, 100), snap(0, 40)])).toBe(RESET_IN_3H);
    });

    it('takes the later reset when both windows of that snapshot are exhausted', () => {
        const both = snap(0, 100, RESET_IN_3H, { seven_day: { pct: 100, resets_at: later } });
        expect(exhaustedResetAt([both])).toBe(later);
    });

    it('is null with no exhausted window, an unknown reset, or a reset already passed', () => {
        expect(exhaustedResetAt([snap(0, 99)])).toBeNull();
        expect(exhaustedResetAt([snap(0, 100, null)])).toBeNull();
        expect(exhaustedResetAt([snap(0, 100, Math.trunc(NOW / 1000) - 1)])).toBe(Math.trunc(NOW / 1000) - 1);
        expect(exhaustedResetAt([])).toBeNull();
    });
});

describe('sessionContextFill', () => {
    it('returns this session’s newest fresh fill only', () => {
        const ledger = [snap(3, 1, RESET_IN_3H, { context_used_pct: 70 }), snap(1, 1, RESET_IN_3H, { session: 'other', context_used_pct: 99 })];
        expect(sessionContextFill(ledger, 's1', NOW)).toBe(70);
        expect(sessionContextFill(ledger, 'nobody', NOW)).toBeNull();
        expect(sessionContextFill(ledger, 's1', NOW + STALE_AFTER_MS + 4 * MIN)).toBeNull();
    });
});

describe('describeWindow', () => {
    it('names fill, projected full and reset', () => {
        const text = describeWindow(windowPressure([snap(10, 20), snap(5, 25), snap(0, 30)], 'five_hour', NOW));
        expect(text).toMatch(/^5h window 30 % · projected full \d\d:\d\d · resets \d\d:\d\d$/);
    });
});

describe('planWindowHot', () => {
    it('reads the ledger and is true only at hot or worse', async () => {
        const fs = await import('node:fs');
        const os = await import('node:os');
        const path = await import('node:path');
        const { appendQuotaSnapshot } = await import('../../../src/scripts/_lib/quota_ledger.js');
        const { planWindowHot } = await import('../../../src/scripts/_lib/pressure.js');
        const home = fs.mkdtempSync(path.join(os.tmpdir(), 'pressure-hot-'));
        const env = { EVENT4U_CONFIG_HOME: home };
        try {
            expect(planWindowHot(env, NOW)).toBe(false);
            appendQuotaSnapshot({ ts: NOW, session: 's', five_hour: { pct: 60, resets_at: RESET_IN_3H } }, env);
            expect(planWindowHot(env, NOW)).toBe(false);
            appendQuotaSnapshot({ ts: NOW, session: 's', five_hour: { pct: 90, resets_at: RESET_IN_3H } }, env);
            expect(planWindowHot(env, NOW)).toBe(true);
        } finally {
            fs.rmSync(home, { recursive: true, force: true });
        }
    });
});
