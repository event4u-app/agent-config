// Cross-carrier rule divergence (round-5 Phase 1.3, landed under round-6 4.1).
//
// Two properties are pinned here and neither is a count. First, the three-way
// split must keep the installer's ownership stamp apart from a real content
// difference — collapsing them is what turned round 5's "91 rules load twice in
// two different versions" into a claim its own data did not support (measured
// 2026-08-08: all pairs differed by exactly `package:` + `source_path:`, zero in
// body). Second, the report must stay ADVISORY: a body difference is the normal
// state of a maintainer whose checkout is ahead of their global install, so a
// non-zero exit here would fire on sanctioned behaviour.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { comparePair, stripOwnershipKeys } from '../../src/scripts/_lib/carrier_divergence.js';
import { compareCarriers, main, render } from '../../src/scripts/report_carrier_divergence.js';

const tmps: string[] = [];

function tmpdir(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'carrier-div-'));
    tmps.push(d);
    return d;
}

afterEach(() => {
    while (tmps.length) {
        fs.rmSync(tmps.pop() as string, { recursive: true, force: true });
    }
});

function writeRules(dir: string, files: Record<string, string>): string {
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, body] of Object.entries(files)) {
        fs.writeFileSync(path.join(dir, name), body, 'utf-8');
    }
    return dir;
}

/** What install.ts adds to every installed rule, in the position it adds it. */
function installed(body: string, name: string): string {
    return body.replace(
        /^---\n/,
        `---\npackage: event4u/agent-config\nsource_path: dist/agent-src/rules/${name}\n`,
    );
}

describe('comparePair — the three-way split', () => {
    it('calls identical bytes identical', () => {
        expect(comparePair(Buffer.from('x\n'), Buffer.from('x\n'))).toBe('identical');
    });

    it('calls an ownership-stamp-only difference provenance-only', () => {
        const src = '---\nname: a\n---\n\nbody\n';
        expect(comparePair(Buffer.from(installed(src, 'a.md')), Buffer.from(src))).toBe(
            'provenance-only',
        );
    });

    it('calls a text difference body-diff even when the stamp is also present', () => {
        const a = installed('---\nname: a\n---\n\nOLD claim\n', 'a.md');
        const b = '---\nname: a\n---\n\nNEW claim\n';
        expect(comparePair(Buffer.from(a), Buffer.from(b))).toBe('body-diff');
    });

    it('strips the stamp wherever it sits in the frontmatter, not only at a fixed line', () => {
        const stripped = stripOwnershipKeys('---\na: 1\npackage: x\nb: 2\nsource_path: y\n---\n');
        expect(stripped).toBe('---\na: 1\nb: 2\n---\n');
    });

    it('treats a CRLF-vs-LF body as a body difference, so a line-ending change stays visible', () => {
        // The two carriers would hand the host different bytes; calling that
        // "the same rule" is the equivalence the dedup predicate refuses, and
        // this report must not be softer than the predicate it explains.
        expect(comparePair(Buffer.from('one\r\ntwo\r\n'), Buffer.from('one\ntwo\n'))).toBe(
            'body-diff',
        );
    });
});

describe('compareCarriers — union view, and what it must not confuse', () => {
    it('names the rule whose two copies differ in body, and only that one', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), {
            'same.md': '---\nname: same\n---\n\nagreed\n',
            'drifted.md': '---\nname: drifted\n---\n\nNEW claim\n',
        });
        const global = writeRules(path.join(root, 'global'), {
            'same.md': installed('---\nname: same\n---\n\nagreed\n', 'same.md'),
            'drifted.md': installed('---\nname: drifted\n---\n\nOLD claim\n', 'drifted.md'),
        });

        const d = compareCarriers(project, global);
        expect(d.bodyDiff).toEqual(['drifted.md']);
        expect(d.provenanceOnly).toEqual(['same.md']);
        expect(d.shared).toBe(2);
    });

    it('splits one-carrier-only rules by direction rather than lumping them as missing', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), { 'new.md': 'x\n' });
        const global = writeRules(path.join(root, 'global'), { 'old.md': 'y\n' });

        const d = compareCarriers(project, global);
        expect(d.projectOnly).toEqual(['new.md']);
        expect(d.globalOnly).toEqual(['old.md']);
        expect(d.shared).toBe(0);
    });

    it('attributes a global-only rule to the ADR-004 manual filter when the source says so', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), {});
        const global = writeRules(path.join(root, 'global'), {
            'stub.md': 'x\n',
            'drift.md': 'y\n',
        });
        // The projection source carries both; only one is `type: manual`, so
        // only one absence is by design. Without the source read, both would
        // read as drift — which is how an expected filter becomes a false
        // finding.
        const source = writeRules(path.join(root, 'source'), {
            'stub.md': '---\ntype: "manual"\n---\n\nx\n',
            'drift.md': '---\ntype: "auto"\n---\n\ny\n',
        });

        const d = compareCarriers(project, global, source);
        expect(d.globalOnly).toEqual(['drift.md', 'stub.md']);
        expect(d.manualOnlyGlobal).toEqual(['stub.md']);
    });

    it('does not attribute anything to the manual filter when no source is given', () => {
        const root = tmpdir();
        const d = compareCarriers(
            writeRules(path.join(root, 'project'), {}),
            writeRules(path.join(root, 'global'), { 'stub.md': 'x\n' }),
        );
        expect(d.manualOnlyGlobal).toEqual([]);
    });

    it('never reports an unreadable copy as a body difference', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), { 'a.md': 'x\n' });
        const global = path.join(root, 'global');
        fs.mkdirSync(global, { recursive: true });
        // A dangling symlink is readdir-visible and read-hostile — the shape a
        // half-finished install leaves behind. Reporting it as body-diff would
        // manufacture the one class this report asks a reader to act on.
        fs.symlinkSync(path.join(root, 'nowhere.md'), path.join(global, 'a.md'));

        const d = compareCarriers(project, global);
        expect(d.bodyDiff).toEqual([]);
        expect(d.shared).toBe(0);
    });

    it('reports an absent global carrier as an answer, not as zero divergence', () => {
        const root = tmpdir();
        const d = compareCarriers(writeRules(path.join(root, 'project'), { 'a.md': 'x\n' }), path.join(root, 'nope'));
        expect(d.globalPresent).toBe(false);
        expect(render(d)).toMatch(/global carrier is absent/);
    });

    it('reports an ungenerated project tree instead of silently reading dist as the project carrier', () => {
        const root = tmpdir();
        const d = compareCarriers(
            path.join(root, 'nope'),
            writeRules(path.join(root, 'global'), { 'a.md': 'x\n' }),
        );
        expect(d.projectPresent).toBe(false);
        const text = render(d);
        expect(text).toMatch(/project rule tree does not exist/);
        // The substitution is refused by name, so a future reader does not
        // "helpfully" add it back: dist holds rules the project tree omits.
        expect(text).toMatch(/would answer a different question/);
    });
});

describe('the report is advisory and must stay that way', () => {
    it('exits 0 with a body difference present', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), { 'a.md': 'NEW\n' });
        const global = writeRules(path.join(root, 'global'), { 'a.md': 'OLD\n' });
        expect(main(['--project', project, '--global', global])).toBe(0);
    });

    it('rejects an unknown flag rather than treating it as a path', () => {
        // The `--quiet` Taskfile injection resolved as a scan root once in this
        // repo and made a gate report zero. An unknown flag must be an error,
        // never a directory.
        expect(main(['--bogus'])).toBe(1);
    });

    it('prints the precedence rule whenever it names a body difference', () => {
        const root = tmpdir();
        const d = compareCarriers(
            writeRules(path.join(root, 'project'), { 'a.md': 'NEW\n' }),
            writeRules(path.join(root, 'global'), { 'a.md': 'OLD\n' }),
        );
        const text = render(d);
        expect(text).toMatch(/PRECEDENCE/);
        // Read at the moment it matters. A body difference with no stated
        // precedence is the exact condition round 5 recorded and could not fix:
        // the agent holds both copies and nothing says which one wins.
        expect(text).toMatch(/project projection is generated from src\/ at this commit and wins/);
    });

    it('says a clean reading is a reading of right now, not a repo property', () => {
        const root = tmpdir();
        const body = '---\nname: a\n---\n\nsame\n';
        const d = compareCarriers(
            writeRules(path.join(root, 'project'), { 'a.md': body }),
            writeRules(path.join(root, 'global'), { 'a.md': installed(body, 'a.md') }),
        );
        expect(d.bodyDiff).toEqual([]);
        expect(render(d)).toMatch(/Re-run it, do not cite it/);
    });
});
