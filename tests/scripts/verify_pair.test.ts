import { describe, expect, it } from 'vitest';

import { classifyClause, pairOf } from '../../src/scripts/_lib/verify_pair.js';

const CMD = 'npx vitest run tests/scripts/x.test.ts';
const fail = { command: CMD, exit_code: 1, stdout_tail: 'Tests  1 failed | 2 passed (3)' };
const pass = { command: CMD, exit_code: 0, stdout_tail: 'Tests  3 passed (3)' };

describe('verify_pair — a green is only a pair when a red came first', () => {
    it('pairs the latest green with an earlier red', () => {
        expect(pairOf(CMD, [fail, pass])).toEqual({ cmd: CMD, red: 'seen', red_at: 0, green_at: 1 });
    });

    it('reports a green with no earlier red as unseen', () => {
        expect(pairOf(CMD, [pass])).toEqual({ cmd: CMD, red: 'unseen', red_at: null, green_at: 0 });
    });

    it('does not count a red that came after the green', () => {
        expect(pairOf(CMD, [pass, fail])).toMatchObject({ red: 'unseen', red_at: null, green_at: 0 });
        expect(pairOf(CMD, [pass, fail, { ...pass }])).toMatchObject({ red: 'seen', red_at: 1, green_at: 2 });
    });

    it('reads only records for the command asked about', () => {
        const other = { ...fail, command: 'npx vitest run tests/scripts/y.test.ts' };
        expect(pairOf(CMD, [other, pass])).toMatchObject({ red: 'unseen', green_at: 1 });
    });

    it('has no green at all when nothing passed', () => {
        expect(pairOf(CMD, [fail])).toEqual({ cmd: CMD, red: 'seen', red_at: 0, green_at: null });
        expect(pairOf(CMD, [])).toEqual({ cmd: CMD, red: 'unseen', red_at: null, green_at: null });
    });

    it('does not read an instrument gap or a kill as red', () => {
        const gap = { command: CMD, exit_code: null };
        const killed = { command: CMD, exit_code: 1, interrupted: true };
        expect(pairOf(CMD, [gap, killed, pass])).toMatchObject({ red: 'unseen', green_at: 2 });
    });

    it('does not read a zero-test run as green', () => {
        const empty = { command: CMD, exit_code: 0, stdout_tail: 'no tests ran in 0.01s' };
        expect(pairOf(CMD, [fail, empty]).green_at).toBeNull();
    });
});

describe('verify_pair — presence is classed wiring, never behavior', () => {
    it.each([
        'ls src/scripts/foo.ts',
        'test -f docs/x.md',
        'test -d src/skills/x',
        'test -e package.json',
        'grep -c "/admin" routes/web.php',
        'grep -q settings src/menu.ts',
        'grep -l foo src/registry.json',
    ])('%s is wiring', (cmd) => {
        expect(classifyClause(cmd)).toBe('wiring');
    });

    it.each([
        'npx vitest run tests/scripts/x.test.ts',
        "grep -c 'never a resident process' docs/architecture.md",
        'curl -s localhost:8080/health',
        'wc -l src/x.ts',
        'test "$(cat x)" = y',
    ])('%s is behavior', (cmd) => {
        expect(classifyClause(cmd)).toBe('behavior');
    });
});
