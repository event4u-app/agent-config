// The when-loaded split, in CHARACTERS — step 1.1 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// The report already counted how many FILES the host loads unconditionally.
// A ceiling stated in characters cannot be read against a file count, so the
// recorded verdict "the form is over its ceiling" had no reading in the unit
// the ceiling is written in. These cases pin the two figures that close that,
// and pin them to the fixture constants rather than to a real corpus — the
// house style `installed_layer_report.test.ts` states in its own header.
//
// WHAT A PASS HERE DOES NOT ESTABLISH: that any particular real install is
// under or over any ceiling. These are arithmetic properties of the reader.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildInstalledLayerReport,
    readLayer,
    renderInstalledLayerReport,
} from '../../src/scripts/_lib/installed_layer.js';
import { GLOBAL_RULE_DIRS } from '../../src/install/globalRuleLayers.js';

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

/** A rule whose BODY is exactly `chars` characters after the strip. */
function rule(chars: number, opts: { scoped?: boolean } = {}): string {
    const front = opts.scoped
        ? '---\ntype: auto\npaths:\n  - "**/*.php"\n---\n'
        : '---\ntype: auto\n---\n';
    return `${front}<!-- stripped before the count -->\n${'x'.repeat(chars)}`;
}

function stageGlobal(home: string, files: Record<string, string>): string {
    const rel = GLOBAL_RULE_DIRS['claude-code'] as string;
    const dir = path.join(home, rel);
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, text] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), text, 'utf-8');
    }
    return dir;
}

describe('installed layer — the when-loaded split in characters', () => {
    it('splits a directory by whether the host loads the file every session', () => {
        const home = mkTmp('ilu-split-');
        const dir = stageGlobal(home, {
            'always.md': rule(100),
            'also-always.md': rule(40),
            'on-php.md': rule(7, { scoped: true }),
        });
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.unconditional_chars).toBe(140);
        expect(l.scoped_chars).toBe(7);
        // The FILE count and the CHARACTER count are different readings of the
        // same directory, and this fixture is built so they disagree in shape:
        // two of three files are unconditional, but 95 % of the characters are.
        expect(l.unconditional).toBe(2);
    });

    it('the two buckets are exhaustive — no file lands in both or in neither', () => {
        const home = mkTmp('ilu-exh-');
        const dir = stageGlobal(home, {
            'a.md': rule(13),
            'b.md': rule(29, { scoped: true }),
            'c.md': rule(0),
        });
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.unconditional_chars + l.scoped_chars).toBe(l.chars);
    });

    it('a layer with nothing path-scoped reports every character unconditional', () => {
        const home = mkTmp('ilu-alluncond-');
        const dir = stageGlobal(home, { 'a.md': rule(50), 'b.md': rule(50) });
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.scoped_chars).toBe(0);
        expect(l.unconditional_chars).toBe(100);
    });

    it('a layer that is entirely path-scoped reports zero standing characters', () => {
        const home = mkTmp('ilu-allscoped-');
        const dir = stageGlobal(home, {
            'a.md': rule(60, { scoped: true }),
            'b.md': rule(40, { scoped: true }),
        });
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.unconditional_chars).toBe(0);
        expect(l.scoped_chars).toBe(100);
        // And `chars` alone would have said 100 standing characters, which is
        // the misreading the second figure exists to prevent.
        expect(l.chars).toBe(100);
    });

    it('an absent directory reports both figures as zero rather than failing', () => {
        const l = readLayer(
            'claude-code',
            'global',
            path.join(mkTmp('ilu-absent-'), 'nope'),
            new Map(),
        );
        expect(l.present).toBe(false);
        expect(l.unconditional_chars).toBe(0);
        expect(l.scoped_chars).toBe(0);
    });

    it('the totals sum both scopes, and stay exhaustive across them', () => {
        const home = mkTmp('ilu-tot-home-');
        const project = mkTmp('ilu-tot-proj-');
        stageGlobal(home, { 'g.md': rule(11), 'gs.md': rule(5, { scoped: true }) });
        const projDir = path.join(project, '.claude', 'rules');
        fs.mkdirSync(projDir, { recursive: true });
        fs.writeFileSync(path.join(projDir, 'p.md'), rule(22), 'utf-8');
        fs.writeFileSync(path.join(projDir, 'ps.md'), rule(3, { scoped: true }), 'utf-8');
        const t = buildInstalledLayerReport({ home, projectRoot: project }).totals;
        expect(t.unconditional_chars).toBe(33);
        expect(t.scoped_chars).toBe(8);
        expect(t.unconditional_chars + t.scoped_chars).toBe(t.chars);
    });

    it('the when-loaded split is independent of the ownership split', () => {
        // A file can be package-owned AND path-scoped, so the two splits are
        // not refinements of one another. Pinning that keeps a future reader
        // from summing one against the other.
        const home = mkTmp('ilu-indep-');
        const dir = stageGlobal(home, {
            'owned-scoped.md': rule(30, { scoped: true }),
            'foreign-uncond.md': rule(70),
        });
        const recorded = new Map<string, string | null>([
            [path.join(dir, 'owned-scoped.md'), null],
        ]);
        const l = readLayer('claude-code', 'global', dir, recorded);
        expect(l.package_owned_chars).toBe(30);
        expect(l.scoped_chars).toBe(30);
        expect(l.unconditional_chars).toBe(70);
        expect(l.foreign_chars).toBe(70);
    });

    it('the report PRINTS both figures beside `chars`, per layer and in the total', () => {
        const home = mkTmp('ilu-render-');
        stageGlobal(home, {
            'always.md': rule(123),
            'scoped.md': rule(45, { scoped: true }),
        });
        const text = renderInstalledLayerReport(
            buildInstalledLayerReport({ home, projectRoot: mkTmp('ilu-render-proj-') }),
        ).join('\n');
        expect(text).toContain('168 chars (123 unconditional + 45 path-scoped)');
        expect(text).toContain('TOTAL');
        // Twice: once for the claude-code global layer, once for the TOTAL row.
        expect(text.split('123 unconditional + 45 path-scoped').length - 1).toBe(2);
    });
});
