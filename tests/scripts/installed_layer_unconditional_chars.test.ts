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

    it('a `paths:` line in the BODY does not move the file to path-scoped', () => {
        // The predicate partitions characters that come from `ruleBody`, so it
        // must read the same string the measure does. Reading the whole
        // unstripped file meant one line of ordinary prose — a YAML trigger
        // example quoted inside a rule — moved that rule's ENTIRE character
        // count from standing to path-scoped, silently, in the figure the whole
        // ceiling argument is read in.
        const home = mkTmp('ilu-bodypaths-');
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code'] as string);
        fs.mkdirSync(dir, { recursive: true });
        const body = 'A rule whose prose quotes a trigger block:\n\npaths:\n  - "**/*.php"\n';
        fs.writeFileSync(path.join(dir, 'quotes-paths.md'), `---\ntype: auto\n---\n${body}`, 'utf-8');
        const l = readLayer('claude-code', 'global', dir, new Map());
        // Asserted as the BUCKET property rather than a hand-computed length:
        // the file's whole measured body is standing, and none of it is
        // path-scoped. `ruleBody`'s exact trimming is a different question and
        // pinning it here would make this case fail for the wrong reason.
        expect(l.chars).toBeGreaterThan(0);
        expect(l.unconditional_chars).toBe(l.chars);
        expect(l.scoped_chars).toBe(0);
    });

    it('a `paths:` key in the FRONTMATTER still scopes the file', () => {
        // The control for the case above: without it, a predicate that always
        // answered "unconditional" would pass there and break everything else
        // quietly.
        const home = mkTmp('ilu-fmpaths-');
        const dir = stageGlobal(home, { 'scoped.md': rule(40, { scoped: true }) });
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.scoped_chars).toBe(40);
        expect(l.unconditional_chars).toBe(0);
    });

    it('a file whose frontmatter the splitter cannot parse still reads its `paths:`', () => {
        // The blind spot that scoping to the frontmatter opens, and the reason
        // the predicate falls back rather than trusting an empty parse.
        // `splitFrontmatter` returns '' for anything not beginning exactly
        // `---\n`, so a BOM, a leading blank line or CRLF would make a
        // path-scoped rule read as standing — silently, in the figure the
        // ceiling argument is read in. `readLayer` measures every `.md` in the
        // directory, foreign user-authored rules included, so these shapes are
        // not hypothetical.
        const home = mkTmp('ilu-unparsable-');
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code'] as string);
        fs.mkdirSync(dir, { recursive: true });
        const scoped = 'paths:\n  - "**/*.php"\ntype: auto\n';
        fs.writeFileSync(path.join(dir, 'bom.md'), `\uFEFF---\n${scoped}---\nbody\n`, 'utf-8');
        fs.writeFileSync(path.join(dir, 'blank-first.md'), `\n---\n${scoped}---\nbody\n`, 'utf-8');
        fs.writeFileSync(path.join(dir, 'crlf.md'), `---\r\n${scoped}---\r\nbody\r\n`, 'utf-8');
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.files).toBe(3);
        expect(l.unconditional_chars, 'every one must read path-scoped').toBe(0);
    });

    it('a file with NO frontmatter at all is unconditional, not scoped', () => {
        // The control for the fallback: it must not fire for a plain body, or
        // a rule that simply has no frontmatter would be read as conditional
        // and drop out of the standing figure.
        const home = mkTmp('ilu-nofm-');
        const dir = path.join(home, GLOBAL_RULE_DIRS['claude-code'] as string);
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(path.join(dir, 'plain.md'), 'just a body, no frontmatter\n', 'utf-8');
        const l = readLayer('claude-code', 'global', dir, new Map());
        expect(l.scoped_chars).toBe(0);
        expect(l.unconditional_chars).toBe(l.chars);
        expect(l.chars).toBeGreaterThan(0);
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
        // `standing`, not a second `unconditional`. The word already names a
        // FILE count earlier on the same line, and carrying it twice in two
        // units is the ambiguity step 1.1 exists to remove — reintroducing it
        // in the line AC-1 quotes as its evidence would be the defect wearing
        // the fix's clothes.
        expect(text).toContain('168 chars (123 standing + 45 path-scoped)');
        expect(text).toContain('TOTAL');
        // Twice: once for the claude-code global layer, once for the TOTAL row.
        expect(text.split('123 standing + 45 path-scoped').length - 1).toBe(2);
        // And the file count keeps the word, once, with its own unit visible.
        expect(text).toContain('2 files (1 unconditional)');
    });
});
