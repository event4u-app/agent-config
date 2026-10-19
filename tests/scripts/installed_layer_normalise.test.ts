// The environment-independent measurement D7 of
// `road-to-an-installed-layer-that-is-thinned` names as the precondition for
// any ceiling over the installed layer.
//
// D7, verbatim: "a ceiling over the installed layer may not rest on a STORED
// baseline, in any shape, until the measurement is environment-independent;
// the acceptable forms are a normalised total (every absolute-path occurrence
// stripped or substituted, with tests over differing root lengths) or a
// base-ref comparison that stores nothing and requires `head <= base`."
//
// This file builds the FIRST form and proves exactly the property the decision
// asks to see: the same corpus, installed under two package roots of different
// length, reads the same NORMALISED total while its raw total differs by the
// predicted amount. The raw assertion is not decoration — a test that only
// asserted equality of the normalised figure would also pass over a corpus
// that was never environment-dependent in the first place, so it would prove
// nothing about the defect D7 describes.
//
// Every expectation is DERIVED FROM THE FIXTURE, never copied from a run, in
// the house style `installed_layer_report.test.ts` states.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { readLayer } from '../../src/scripts/_lib/installed_layer.js';
import {
    ABSOLUTE_PATH_TOKEN,
    normaliseLayerText,
} from '../../src/scripts/_lib/installed_layer_normalise.js';
import { absoluteBodyLinkPrefix, thin_entry } from '../../src/scripts/_lib/thin_rules.js';

const tmps: string[] = [];

function tmp(prefix: string): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length > 0) {
        const d = tmps.pop();
        if (d !== undefined) fs.rmSync(d, { recursive: true, force: true });
    }
});

/** A rule source in the shape `thin_entry` reads: frontmatter plus a body. */
function ruleSource(id: string): string {
    return [
        '---',
        `description: what ${id} is for`,
        'triggers:',
        `  - ${id}`,
        '---',
        '',
        `# ${id}`,
        '',
        'Body text that carries no absolute path at all.',
        '',
    ].join('\n');
}

/**
 * Write one thinned rule layer whose body pointers are rooted at `root`.
 *
 * This is the stub form the installer writes — `installThinLayer` builds its
 * pointer with the same `absoluteBodyLinkPrefix`, so the varying part of the
 * measurement is reproduced here rather than imitated.
 */
function writeThinnedLayer(root: string, ids: readonly string[]): string {
    const dir = tmp('iln-layer-');
    const prefix = absoluteBodyLinkPrefix(root);
    for (const id of ids) {
        fs.writeFileSync(
            path.join(dir, `${id}.md`),
            `---\npackage: event4u/agent-config\n---\n\n${thin_entry(id, ruleSource(id), prefix)}`,
            'utf-8',
        );
    }
    return dir;
}

describe('installed-layer normalisation — the unit', () => {
    it('substitutes an absolute POSIX path with a fixed-width token', () => {
        const text = 'Body: /Users/someone/projects/agent-config/dist/agent-src/rules/foo.md\n';
        expect(normaliseLayerText(text)).toBe(`Body: ${ABSOLUTE_PATH_TOKEN}\n`);
    });

    it('substitutes a Windows drive path too, because the installer runs there', () => {
        const text = 'Body: C:\\Users\\someone\\agent-config\\dist\\agent-src\\rules\\foo.md\n';
        expect(normaliseLayerText(text)).toBe(`Body: ${ABSOLUTE_PATH_TOKEN}\n`);
    });

    it('leaves a RELATIVE path alone — it does not move with the root', () => {
        const text = 'see `src/scripts/_lib/thin_rules.ts` and `dist/agent-src/rules/x.md`\n';
        expect(normaliseLayerText(text)).toBe(text);
    });

    it('leaves prose with a slash alone — `and/or` is not a path', () => {
        const text = 'Fires on a read and/or a write, per the matrix.\n';
        expect(normaliseLayerText(text)).toBe(text);
    });

    it('is idempotent: normalising twice reads the same as once', () => {
        const text = 'Body: /a/b/c/d.md and Body: /much/longer/root/here/d.md\n';
        const once = normaliseLayerText(text);
        expect(normaliseLayerText(once)).toBe(once);
    });

    it('substitutes EVERY occurrence, not only the first', () => {
        const text = '/one/two/three and /four/five/six\n';
        expect(normaliseLayerText(text)).toBe(
            `${ABSOLUTE_PATH_TOKEN} and ${ABSOLUTE_PATH_TOKEN}\n`,
        );
    });
});

describe('installed-layer normalisation — environment independence, over differing root lengths', () => {
    // 89 stubs is the real corpus size the roadmap's 2026-10-06 measurement
    // read; the figure here is the SHAPE, and every expectation below is
    // computed from these two constants rather than from that reading.
    const ids = Array.from({ length: 12 }, (_, i) => `rule-${String(i).padStart(2, '0')}`);
    const shortRoot = '/r';
    const longRoot = '/a-considerably-longer-package-root-directory-name';

    it('the RAW total moves with the root length, which is the defect D7 names', () => {
        const short = readLayer('claude-code', 'global', writeThinnedLayer(shortRoot, ids), new Map());
        const long = readLayer('claude-code', 'global', writeThinnedLayer(longRoot, ids), new Map());
        expect(short.files).toBe(ids.length);
        expect(long.files).toBe(ids.length);
        // One stub carries one pointer, so the delta is exactly the prefix
        // delta times the stub count — the roadmap's "89 chars per char".
        expect(long.chars - short.chars).toBe(ids.length * (longRoot.length - shortRoot.length));
    });

    it('the NORMALISED total does not move, which is what a ceiling may rest on', () => {
        const short = readLayer('claude-code', 'global', writeThinnedLayer(shortRoot, ids), new Map());
        const long = readLayer('claude-code', 'global', writeThinnedLayer(longRoot, ids), new Map());
        expect(long.normalised_chars).toBe(short.normalised_chars);
        // And it is a real measurement, not a constant: it still counts the
        // text that is not a path.
        expect(short.normalised_chars).toBeGreaterThan(0);
        expect(short.normalised_chars).toBeLessThan(short.chars);
    });

    it('a corpus with no absolute path reads the same normalised as raw', () => {
        const dir = tmp('iln-plain-');
        fs.writeFileSync(path.join(dir, 'plain.md'), '---\nx: 1\n---\n\nNo path here.\n', 'utf-8');
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.normalised_chars).toBe(l.chars);
    });

    it('per FILE as well as per layer, so the largest-files ranking can be read in it', () => {
        const dir = writeThinnedLayer(longRoot, ids);
        const l = readLayer('claude-code', 'global', dir, new Map());
        for (const f of l.top) {
            expect(f.normalised_chars).toBeLessThan(f.chars);
        }
        expect(l.normalised_chars).toBe(
            l.top.reduce((n, f) => n + f.normalised_chars, 0),
        );
    });
});
