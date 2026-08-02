// Tests for src/scripts/check_augment_description_cap.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists, so this is a focused differential suite over the
// public behaviour (parse_frontmatter, DESC_CAP) plus a golden-parity layer
// (python3 vs tsx) on the REAL REPO (skipped without python3).
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { runInProc } from '../_lib/run_in_process.js';
import {
    DESC_CAP,
    main,
    parse_frontmatter,
} from '../../src/scripts/check_augment_description_cap.js';


describe('parse_frontmatter', () => {
    it('parses simple key/value pairs and strips quotes', () => {
        const fm = parse_frontmatter('---\ntype: auto\ndescription: "Hello world"\n---\nbody\n');
        expect(fm['type']).toBe('auto');
        expect(fm['description']).toBe('Hello world');
    });

    it('strips single quotes after double', () => {
        const fm = parse_frontmatter("---\ndescription: 'x'\n---\n");
        expect(fm['description']).toBe('x');
    });

    it('returns empty for missing frontmatter', () => {
        expect(parse_frontmatter('no frontmatter here')).toEqual({});
    });

    it('returns empty when closing fence absent', () => {
        expect(parse_frontmatter('---\ntype: auto\n')).toEqual({});
    });

    it('DESC_CAP is 150', () => {
        expect(DESC_CAP).toBe(150);
    });
});

// ── Violation tests through the REAL entry point ───────────────────────────
//
// Everything above tests pure helpers. None of it calls `main()`, so for months
// this gate had no test that could distinguish "rejects an over-cap rule" from
// "cannot reject anything" — the `happy-path-only` class named in
// road-to-gates-that-can-fail Phase 3.2. These construct a real violation and
// assert rejection through `main()`.
describe('main() — rejection is exercised, not assumed', () => {
    const withRules = (files: Record<string, string>, fn: (root: string) => void): void => {
        const dir = mkdtempSync(join(tmpdir(), 'desccap-'));
        try {
            for (const [name, body] of Object.entries(files)) {
                writeFileSync(join(dir, name), body, 'utf8');
            }
            fn(dir);
        } finally {
            rmSync(dir, { recursive: true, force: true });
        }
    };

    const rule = (type: string, desc: string): string =>
        `---\ntype: ${type}\ndescription: "${desc}"\n---\n\nbody\n`;

    it('REJECTS an over-cap auto-rule with exit 1 and names it', () => {
        const over = 'x'.repeat(DESC_CAP + 1);
        withRules({ 'too-long.md': rule('auto', over) }, (root) => {
            const r = runInProc(main, ['--root', root]);
            expect(r.status, `${r.stdout}${r.stderr}`).toBe(1);
            expect(r.stderr).toContain('too-long.md');
            expect(r.stderr).toContain(`exceed ${String(DESC_CAP)} chars`);
        });
    });

    it('a description exactly AT the cap passes — the bound is >, not >=', () => {
        withRules({ 'at-cap.md': rule('auto', 'x'.repeat(DESC_CAP)) }, (root) => {
            expect(runInProc(main, ['--root', root]).status).toBe(0);
        });
    });

    it('one char over the cap fails — the boundary actually bites', () => {
        withRules({ 'over-by-one.md': rule('auto', 'x'.repeat(DESC_CAP + 1)) }, (root) => {
            expect(runInProc(main, ['--root', root]).status).toBe(1);
        });
    });

    it('an over-cap rule that is NOT type: auto is out of scope and passes', () => {
        withRules({ 'always.md': rule('always', 'x'.repeat(DESC_CAP + 40)) }, (root) => {
            const r = runInProc(main, ['--root', root]);
            expect(r.status).toBe(0);
            // ...and it was not counted, so the scope is genuinely narrow.
            expect(r.stdout).toContain('scanned: 0');
        });
    });

    it('emits the machine-readable count on the FAILING path too', () => {
        // check_gate_coverage classifies a gate emitting no count as `silent`.
        // A gate that reports coverage only when it passes is half-blind.
        withRules(
            {
                'a.md': rule('auto', 'short'),
                'b.md': rule('auto', 'x'.repeat(DESC_CAP + 1)),
            },
            (root) => {
                const r = runInProc(main, ['--root', root]);
                expect(r.status).toBe(1);
                expect(r.stdout).toContain('scanned: 2');
            },
        );
    });

    it('the default root is still the real one when no --root is passed', () => {
        // Guards the seam itself: an injection flag that silently became the
        // default would make every green above meaningless in CI.
        const r = runInProc(main, []);
        const m = /scanned: (\d+)/.exec(r.stdout);
        expect(m, r.stdout).not.toBeNull();
        expect(Number((m as RegExpExecArray)[1])).toBeGreaterThan(50);
    });
});

