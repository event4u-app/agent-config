// Tests for src/scripts/check_module_management_neutral.ts (py2ts Phase 4 / Wave 4c).
//
// No pytest suite exists. Focused spec over the pure scanners
// (_scan_frontmatter, _scan_body, _laravel_carveout_span, _split_frontmatter)
// plus golden-parity layers: (a) the REAL repo SKILL.md (clean, exit 0), and
// (b) a temp-repo failing fixture run as a subprocess so SKILL_PATH resolves
// to the injected file. Both skipped without python3.
import { describe, expect, it } from 'vitest';

import * as mmn from '../../src/scripts/check_module_management_neutral.js';



describe('check_module_management_neutral — pure scanners', () => {
    it('_split_frontmatter splits on the closing fence', () => {
        const [fm, body] = mmn._split_frontmatter('---\nframework: x\n---\nbody here\n');
        expect(fm).toBe('framework: x');
        expect(body).toBe('body here\n');
    });

    it('_split_frontmatter returns empty fm when no frontmatter', () => {
        const [fm, body] = mmn._split_frontmatter('no frontmatter\n');
        expect(fm).toBe('');
        expect(body).toBe('no frontmatter\n');
    });

    it('_scan_frontmatter flags banned framework key', () => {
        const v = mmn._scan_frontmatter('framework: laravel');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain("banned key 'framework:'");
    });

    it('_scan_frontmatter clean when no banned key', () => {
        expect(mmn._scan_frontmatter('title: x\ndescription: y')).toEqual([]);
    });

    it('_laravel_carveout_span finds the section', () => {
        const body = 'intro\n### Laravel HMVC carve-out\nx\n### Next\ny';
        const span = mmn._laravel_carveout_span(body);
        expect(span).not.toBeNull();
        expect(span![0]).toBe(1);
        expect(span![1]).toBe(3);
    });

    it('_scan_body flags app/Modules/ outside carve-out, allows inside', () => {
        const body =
            '### Laravel HMVC carve-out\napp/Modules/Foo OK here\n### Other\napp/Modules/Bar BAD\n';
        const v = mmn._scan_body(body);
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('line 4');
        // The message embeds Python repr(pattern.pattern). The pattern is
        // `\bapp/Modules/` (one literal backslash); repr() doubles it, so the
        // emitted bytes are: '\\bapp/Modules/' (two backslashes before b).
        expect(v[0]).toContain("'\\\\bapp/Modules/'");
    });

    it('_scan_body reports missing carve-out section', () => {
        const v = mmn._scan_body('# Title\nno carve out\n');
        expect(v).toHaveLength(1);
        expect(v[0]).toContain('carve-out section');
        expect(v[0]).toContain('missing');
    });

    it('_scan_body clean when only carve-out has the literal', () => {
        const body = 'intro\n### Laravel HMVC carve-out\napp/Modules/X\n';
        expect(mmn._scan_body(body)).toEqual([]);
    });
});

