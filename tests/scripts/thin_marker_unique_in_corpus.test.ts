// The shortened marker still says what to do, and still says it uniquely —
// step 2.2 of `road-to-a-thinned-layer-measured-in-one-unit`.
//
// Shortening the marker is a saving multiplied by the stub count: it is paid
// once per stub, 89 times on the measured layer. It is also the one change in
// this roadmap that can break the detector in BOTH directions at once, which is
// why this file asserts both rather than the saving.
//
//   Too long  → the saving is not taken.
//   Too short → `is_thin_entry` is a substring test over the whole file, so a
//               marker that occurs inside ordinary rule prose makes that rule
//               read as a stub. Nine rule files carry blockquote lines.
//
// Neither direction is checked by anything else in the tree, and the second
// fails silently: a full rule body misread as a stub is a rule the conformance
// verb stops asking about.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    build_thin,
    is_thin_entry,
    THIN_ENTRY_MARKER,
} from '../../src/scripts/_lib/thin_rules.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const SOURCE_RULES = path.join(REPO_ROOT, 'src', 'rules');
const PROJECTED_RULES = path.join(REPO_ROOT, 'dist', 'agent-src', 'rules');

function mdFiles(dir: string): string[] {
    return fs.readdirSync(dir).filter((n) => n.endsWith('.md'));
}

describe('the stub marker is short, instructive, and unique to a stub', () => {
    it('is at most 28 characters', () => {
        // The budget step 2.2 sets. It is a ceiling and not a target: the
        // instruction below is what decides how much of it is spent.
        expect(THIN_ENTRY_MARKER.length).toBeLessThanOrEqual(28);
    });

    it('still instructs — it says the BODY is to be LOADED', () => {
        // D2 and K6: a bare token would have saved more and left nothing a
        // reader could follow, and nothing in this repository can check whether
        // an unstated instruction is still obeyed. The two words are therefore
        // the content of the constant, not decoration on it.
        expect(THIN_ENTRY_MARKER.toLowerCase()).toContain('load');
        expect(THIN_ENTRY_MARKER.toLowerCase()).toContain('body');
    });

    it('is true for every entry `build_thin` emits as a stub', () => {
        const emitted = build_thin();
        // The control: an empty map would make every assertion below vacuous.
        expect(emitted.size, 'the control: build_thin emitted entries').toBeGreaterThan(50);
        let stubs = 0;
        for (const [name, text] of emitted) {
            if (!text.includes('Body: [')) continue; // kept full-bodied, not a stub
            stubs += 1;
            expect(is_thin_entry(text), `${name} is a stub the detector missed`).toBe(true);
        }
        expect(stubs, 'the control: at least one entry was emitted as a stub').toBeGreaterThan(
            20,
        );
    });

    it('is false for every rule body in `src/rules/`', () => {
        // The direction that fails silently. A marker generic enough to appear
        // in rule prose turns a real rule into a stub as far as every detector
        // is concerned.
        const names = mdFiles(SOURCE_RULES);
        expect(names.length, 'the control: src/rules/ has rule files').toBeGreaterThan(50);
        const hits = names.filter((n) =>
            is_thin_entry(fs.readFileSync(path.join(SOURCE_RULES, n), 'utf-8')),
        );
        expect(hits).toEqual([]);
    });

    it('is false for every projected rule body in `dist/agent-src/rules/`', () => {
        // The same question asked of the tree an install actually copies. The
        // projection is byte-identical to the source apart from path rewrites,
        // so a difference here would be a finding about the rewriter.
        const names = mdFiles(PROJECTED_RULES);
        expect(names.length, 'the control: the projection has rule files').toBeGreaterThan(50);
        const hits = names.filter((n) =>
            is_thin_entry(fs.readFileSync(path.join(PROJECTED_RULES, n), 'utf-8')),
        );
        expect(hits).toEqual([]);
    });

    it('does not occur inside any BLOCKQUOTE line of a rule, which is the near-miss', () => {
        // The nine blockquote-carrying rules are the population risk 3 names.
        // Asserted as its own case because the whole-file check above would
        // also pass for a marker that collided with a non-blockquote line, and
        // the collision this one is about is specifically with `> ` prose.
        const names = mdFiles(SOURCE_RULES);
        const quoted: string[] = [];
        let blockquoteLines = 0;
        for (const n of names) {
            for (const line of fs.readFileSync(path.join(SOURCE_RULES, n), 'utf-8').split('\n')) {
                if (!line.startsWith('> ')) continue;
                blockquoteLines += 1;
                if (line.includes(THIN_ENTRY_MARKER)) quoted.push(`${n}: ${line}`);
            }
        }
        // The control, and the reason an empty `quoted` is a finding: the
        // corpus really does carry blockquote lines to collide with.
        expect(blockquoteLines, 'the control: rules carry blockquote lines').toBeGreaterThan(20);
        expect(quoted).toEqual([]);
    });
});
