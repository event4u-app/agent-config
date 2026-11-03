import { describe, expect, it } from 'vitest';

import { parseGateArgs } from '../../src/scripts/_lib/gate_args.js';

const OPTIONS = { base: { type: 'string' }, strict: { type: 'boolean' }, root: { type: 'string', multiple: true } } as const;

describe('parseGateArgs — a flag the gate does not know is refused', () => {
    it('refuses an unknown flag and names it', () => {
        const r = parseGateArgs('lint_x', ['--stirct'], OPTIONS);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.message).toMatch(/lint_x: .*--stirct/);
    });

    it('accepts --flag=value and --flag value alike', () => {
        for (const argv of [['--base=main'], ['--base', 'main']]) {
            const r = parseGateArgs('g', argv, OPTIONS);
            expect(r.ok && r.values.base).toBe('main');
        }
    });

    it('keeps every value of a repeatable flag instead of silently picking one', () => {
        const r = parseGateArgs('g', ['--root', 'a', '--root', 'b'], OPTIONS);
        expect(r.ok && r.values.root).toEqual(['a', 'b']);
    });

    it('refuses a string flag with no value', () => {
        expect(parseGateArgs('g', ['--base'], OPTIONS).ok).toBe(false);
    });

    it('refuses a stray positional unless the gate allows them', () => {
        expect(parseGateArgs('g', ['file.md'], OPTIONS).ok).toBe(false);
        const r = parseGateArgs('g', ['file.md'], OPTIONS, { allowPositionals: true });
        expect(r.ok && r.positionals).toEqual(['file.md']);
    });
});
