import { describe, expect, it } from 'vitest';

import { ProgressBar, formatDuration, isInteractive, lineSink, renderBar } from '../../../src/scripts/_lib/progress_bar.js';

function sink(): { out: { write: (t: string) => void }; text: () => string } {
    let buf = '';
    return { out: { write: (t: string) => void (buf += t) }, text: () => buf };
}

describe('ProgressBar — a log gets lines, a terminal gets one redrawn bar', () => {
    it('without a TTY each step is one plain line and nothing is redrawn', () => {
        const s = sink();
        const bar = new ProgressBar({ total: 3, out: s.out, tty: false });
        bar.step('installing …');
        bar.step('deploying …');
        bar.log('  ⚠️  a warning');
        bar.step('checking …');
        bar.finish('done in 1.0 s');
        expect(s.text()).toBe('  [1/3] installing …\n  [2/3] deploying …\n  ⚠️  a warning\n  [3/3] checking …\n');
        expect(s.text()).not.toContain('\r');
    });

    it('on a TTY the bar is redrawn in place and fills as steps complete', () => {
        const s = sink();
        const bar = new ProgressBar({ total: 2, out: s.out, tty: true, width: 4 });
        bar.step('one');
        bar.step('two');
        bar.finish('done');
        const frames = s.text().split('\r\x1b[2K').filter(Boolean);
        expect(frames).toEqual(['  [░░░░] 1/2  one', '  [██░░] 2/2  two', '  [████] 2/2  done\n']);
    });

    it('a logged line clears the bar, stays above it, and the bar comes back', () => {
        const s = sink();
        const bar = new ProgressBar({ total: 2, out: s.out, tty: true, width: 2 });
        bar.step('one');
        bar.log('kept line');
        expect(s.text()).toBe('\r\x1b[2K  [░░] 1/2  one\r\x1b[2Kkept line\n\r\x1b[2K  [░░] 1/2  one');
    });

    it('extra steps never push the count past the total', () => {
        const s = sink();
        const bar = new ProgressBar({ total: 1, out: s.out, tty: false });
        bar.step('a');
        bar.step('b');
        expect(s.text()).toBe('  [1/1] a\n  [1/1] b\n');
    });
});

describe('progress helpers', () => {
    it('renderBar clamps and rounds', () => {
        expect(renderBar(0, 4, 4)).toBe('[░░░░]');
        expect(renderBar(2, 4, 4)).toBe('[██░░]');
        expect(renderBar(9, 4, 4)).toBe('[████]');
        expect(renderBar(1, 0, 2)).toBe('[██]');
    });

    it('isInteractive needs a TTY, and neither TERM=dumb nor CI', () => {
        expect(isInteractive({ isTTY: true }, {})).toBe(true);
        expect(isInteractive({ isTTY: false }, {})).toBe(false);
        expect(isInteractive({ isTTY: true }, { TERM: 'dumb' })).toBe(false);
        expect(isInteractive({ isTTY: true }, { CI: 'true' })).toBe(false);
        expect(isInteractive({ isTTY: true }, { CI: '1' })).toBe(false);
        expect(isInteractive({ isTTY: true }, { CI: 'false' })).toBe(true);
        expect(isInteractive({ isTTY: true }, { CI: '0' })).toBe(true);
    });

    it('formatDuration', () => {
        expect(formatDuration(850)).toBe('850 ms');
        expect(formatDuration(12_345)).toBe('12.3 s');
    });

    it('lineSink hands over complete lines only', () => {
        const got: string[] = [];
        const s = lineSink((l) => got.push(l));
        s.write('a\nb');
        s.write('c\n\n');
        expect(got).toEqual(['a', 'bc', '']);
    });
});
