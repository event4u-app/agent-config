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

import {
    comparePair,
    proseEqual,
    stripFrontmatter,
    stripOwnershipKeys,
} from '../../src/scripts/_lib/carrier_divergence.js';
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

// ── frontmatter-only, the class that WAS the whole body-diff bucket ─────────
//
// Measured 2026-08-10 over the live carriers at a5b2f4cb7: 109 shared rules, 0
// byte-identical, 109 reported `body-diff` — and 0 of the 109 differing in
// prose. The project emitter writes frontmatter-less real files (or a
// `paths:`-only block); `install.ts` writes agent-config's full vocabulary plus
// its stamp. So the report was manufacturing its one actionable class out of a
// metadata block the host does not even deliver.
describe('frontmatter-only is not prose divergence', () => {
    it('strips a fenced frontmatter block and leaves a fence-less file alone', () => {
        expect(stripFrontmatter('---\na: 1\n---\n\nbody\n')).toBe('\nbody\n');
        expect(stripFrontmatter('# no frontmatter\n')).toBe('# no frontmatter\n');
    });

    it('leaves an unterminated fence untouched rather than swallowing the rule', () => {
        // A malformed fence must not silently delete a rule's whole text — that
        // would report every governed obligation as absent.
        expect(stripFrontmatter('---\na: 1\nbody with no closing fence\n')).toBe(
            '---\na: 1\nbody with no closing fence\n',
        );
    });

    it('calls the real measured shape equal — full frontmatter vs none, same prose', () => {
        const withFm = '---\ntype: "always"\npackage: event4u/agent-config\n---\n\n# Rule\n\nobey\n';
        const withoutFm = '# Rule\n\nobey\n';
        expect(proseEqual(withFm, withoutFm)).toBe(true);
    });

    it('still calls a real prose difference unequal, frontmatter or not', () => {
        expect(proseEqual('---\na: 1\n---\n\nNEW\n', '# x\n\nOLD\n')).toBe(false);
    });

    it('keeps CRLF-vs-LF a prose difference, so it is no softer than the dedup predicate', () => {
        expect(proseEqual('one\r\ntwo\n', 'one\ntwo\n')).toBe(false);
    });

    it('does NOT relax comparePair — the dedup predicate stays byte-identity', () => {
        // The separation is load-bearing: `measure_scope_dedup` asks whether a
        // byte-identity dedup could skip the pair, and a frontmatter difference
        // is a real byte difference. Folding `proseEqual` into `comparePair`
        // would relax the predicate `dedup-reachability-refusal.md` keeps strict.
        const withFm = '---\ntype: "always"\n---\n\nsame prose\n';
        expect(comparePair(Buffer.from(withFm), Buffer.from('same prose\n'))).toBe('body-diff');
        expect(proseEqual(withFm, 'same prose\n')).toBe(true);
    });

    it('classifies the pair as frontmatter-only and keeps prose divergence separate', () => {
        const root = tmpdir();
        const project = writeRules(path.join(root, 'project'), {
            'meta.md': '# Meta\n\nagreed\n',
            'drifted.md': '# Drifted\n\nNEW claim\n',
        });
        const global = writeRules(path.join(root, 'global'), {
            'meta.md': '---\ntype: "always"\npackage: event4u/agent-config\n---\n\n# Meta\n\nagreed\n',
            'drifted.md': '---\ntype: "always"\n---\n\n# Drifted\n\nOLD claim\n',
        });

        const d = compareCarriers(project, global);
        expect(d.frontmatterOnly).toEqual(['meta.md']);
        expect(d.bodyDiff).toEqual(['drifted.md']);
        expect(d.shared).toBe(2);
    });

    it('reports the count without naming every pair, and without the prose-divergence block', () => {
        const root = tmpdir();
        const d = compareCarriers(
            writeRules(path.join(root, 'project'), { 'meta.md': '# Meta\n\nagreed\n' }),
            writeRules(path.join(root, 'global'), {
                'meta.md': '---\ntype: "always"\n---\n\n# Meta\n\nagreed\n',
            }),
        );
        const text = render(d);
        expect(text).toMatch(/differ ONLY in frontmatter {9}1/);
        expect(text).toMatch(/prose byte-identical/);
        // The whole point: this must not read as the class a reader acts on.
        expect(text).not.toMatch(/PROSE DIVERGENCE/);
        expect(text).not.toMatch(/- meta\.md/);
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

    it('states the host resolves nothing whenever it names a prose difference', () => {
        const root = tmpdir();
        const d = compareCarriers(
            writeRules(path.join(root, 'project'), { 'a.md': 'NEW\n' }),
            writeRules(path.join(root, 'global'), { 'a.md': 'OLD\n' }),
        );
        const text = render(d);
        expect(text).toMatch(/PROSE DIVERGENCE/);
        // Read at the moment it matters. A prose difference with nothing said
        // about binding is the exact condition round 5 recorded and could not
        // fix: the agent holds both copies and nothing says which one binds.
        expect(text).toMatch(/UNDEFINED/);
        // WHY THIS ASSERTION INVERTED (2026-08-10). It used to pin "the project
        // projection … and wins", and that claim is false about this host:
        // `agents/evidence/analysis/claude-code-rules-dir-contract.md` records,
        // from the host's own documentation and a first-party observation at
        // 2.1.226, that rules without a `paths` key load at launch with the same
        // priority as CLAUDE.md and no precedence marker exists between the
        // layers. The project copy is the NEWER text — recency, not precedence —
        // and a reader who acted on "wins" would have believed the host resolved
        // something it does not. A test that pins a false statement about the
        // host is a test that defends the defect.
        expect(text).toMatch(/recency/);
        expect(text).not.toMatch(/and wins/);
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

// ── R2 completion-review repair (2026-08-08) ───────────────────────────────

describe('flag VALUES are not paths either', () => {
    it('rejects a flag in the value position instead of resolving it as a directory', () => {
        // `--project --global /x` used to resolve a directory literally named
        // `--global` and silently drop `/x`, then report "tree does not exist" —
        // a usage error dressed as a measurement. The flag-NAME half of this hole
        // was already closed; this is the flag-VALUE half.
        expect(main(['--project', '--global', '/x'])).toBe(1);
        expect(main(['--project'])).toBe(1);
    });
});
