// road-to-checks-that-name-their-catch Phase 4: the settle decision and the manifest rows, without a browser.
import { describe, expect, it } from 'vitest';

import {
    CONSOLE_TEXT_MAX,
    consoleRow,
    settleVerdict,
    type SettleSample,
    type ViewportCapture,
} from '../../src/cli/commands/uiRender.js';

const series = (sigs: string[], step = 50): SettleSample[] => sigs.map((sig, i) => ({ t: i * step, sig }));

describe('settleVerdict', () => {
    it('is pending with no samples', () => {
        expect(settleVerdict([])).toEqual({ pending: true });
    });

    it('settles once the signature holds for the quiet window, at the start of the still run', () => {
        // Changes at 0, 50, 100; still from 100 on. Quiet 250 → settled at t=350, reporting 100.
        const sigs = ['a', 'b', 'c', 'c', 'c', 'c', 'c', 'c'];
        expect(settleVerdict(series(sigs.slice(0, 7)), 250, 5000)).toEqual({ pending: true });
        expect(settleVerdict(series(sigs), 250, 5000)).toEqual({ settled_ms: 100 });
    });

    it('a page that is still from the first sample settles at 0', () => {
        expect(settleVerdict(series(['x', 'x', 'x', 'x', 'x', 'x']), 250, 5000)).toEqual({ settled_ms: 0 });
    });

    it('a page still mutating at the cap reports unsettled with the cap', () => {
        const sigs = Array.from({ length: 101 }, (_, i) => String(i)); // t = 0 … 5000, changes every sample
        expect(settleVerdict(series(sigs), 250, 5000)).toEqual({ unsettled: true, cap_ms: 5000 });
        expect(settleVerdict(series(sigs.slice(0, 100)), 250, 5000)).toEqual({ pending: true });
    });

    it('a still run that completes exactly at the cap counts as settled, not unsettled', () => {
        const sigs = [...Array.from({ length: 95 }, (_, i) => String(i)), ...Array(6).fill('z')]; // still from 4750 to 5000
        expect(settleVerdict(series(sigs), 250, 5000)).toEqual({ settled_ms: 4750 });
    });
});

describe('consoleRow', () => {
    it('keeps short text verbatim', () => {
        expect(consoleRow('error', 'boom')).toEqual({ type: 'error', text: 'boom' });
    });

    it('truncates long text to the cap plus an ellipsis', () => {
        const row = consoleRow('pageerror', 'x'.repeat(CONSOLE_TEXT_MAX + 100));
        expect(row.text).toHaveLength(CONSOLE_TEXT_MAX + 1);
        expect(row.text.endsWith('…')).toBe(true);
    });
});

describe('ViewportCapture serialisation', () => {
    const base: ViewportCapture = {
        viewport: 'desktop',
        width: 1440,
        height: 900,
        screenshot: 's.png',
        dom: 'd.html',
        styles: 's.json',
        document_scroll_width: 1440,
        horizontal_overflow: false,
    };

    it('writes settled_ms and console rows when present', () => {
        const c: ViewportCapture = { ...base, settled_ms: 120, console: [consoleRow('warning', 'w')] };
        const round = JSON.parse(JSON.stringify(c));
        expect(round.settled_ms).toBe(120);
        expect(round.unsettled).toBeUndefined();
        expect(round.console).toEqual([{ type: 'warning', text: 'w' }]);
    });

    it('writes unsettled with its cap, and omits absent optional keys entirely', () => {
        const c: ViewportCapture = { ...base, unsettled: true, settle_cap_ms: 5000, console: [] };
        expect(Object.keys(JSON.parse(JSON.stringify(c)))).toEqual([...Object.keys(base), 'unsettled', 'settle_cap_ms', 'console']);
        expect(Object.keys(JSON.parse(JSON.stringify(base)))).not.toContain('settled_ms');
    });
});
