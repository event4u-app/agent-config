// Tests for the base-into-narrow edge of src/scripts/lint_pack_boundaries.ts.
//
// The gate's own baseline note recorded a mismatch rather than a backlog: for
// a link running from a BASE pack into a NARROWER one — `engineering-base ->
// react`, `meta -> git`, `frontend-design -> brand` — none of the three
// documented fixes applies. `requires` is transitive and install-forcing, so
// declaring it would push the narrow pack into every install of the base;
// retargeting needs an in-pack equivalent that does not exist; moving the
// artefact changes which install ships it.
//
// D5 of `road-to-gates-a-pull-request-can-hear` (AI council 2026-10-07,
// anthropic + openai, 2/2) chose option (a): `packs.yml` gains an advisory,
// non-installing `suggests` edge that this gate reads as permitting the link,
// on the condition that every link such an edge permits degrades safely when
// the target pack is absent.
//
// Every acceptance below is paired with its denial. A gate tested only on the
// case it should permit cannot distinguish "the edge works" from "the rule is
// gone".
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as lpb from '../../src/scripts/lint_pack_boundaries.js';
import { runInProc } from '../_lib/run_in_process.js';

/** Captured before any test repoints it (ESM live binding of a `let`). */
const REAL_ROOT = lpb.ROOT;

describe('lint_pack_boundaries — the advisory `suggests` edge', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lpb-bn-'));
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    const ALWAYS = new Set(['core']);

    // --- The unit rule, both polarities. ---

    it('permits a base -> narrow link when the base declares `suggests`', () => {
        expect(lpb._is_allowed('base', 'narrow', [], ALWAYS, ['narrow'])).toBe(true);
    });

    it('still rejects the same link when the base declares no `suggests`', () => {
        expect(lpb._is_allowed('base', 'narrow', [], ALWAYS, [])).toBe(false);
    });

    it('rejects a `suggests` edge that names a different pack', () => {
        expect(lpb._is_allowed('base', 'narrow', [], ALWAYS, ['other'])).toBe(false);
    });

    // --- The edge stays one-way and one-hop. ---

    it('is one-way: the target suggesting the source does not permit the link', () => {
        // `narrow -> base` is permitted only if NARROW declares the edge.
        expect(lpb._is_allowed('narrow', 'base', [], ALWAYS, [])).toBe(false);
    });

    it('is one-hop: `suggests` is never expanded transitively', () => {
        const direct = new Map<string, string[]>([
            ['base', []],
            ['mid', []],
            ['leaf', []],
        ]);
        const suggests = new Map<string, string[]>([
            ['base', ['mid']],
            ['mid', ['leaf']],
        ]);
        const closureOf = (p: string): Set<string> => lpb._requires_closure(p, direct);
        const suggestsOf = (p: string): readonly string[] => suggests.get(p) ?? [];

        expect(lpb._link_allowed(['base'], ['mid'], closureOf, ALWAYS, suggestsOf)).toBe(true);
        expect(lpb._link_allowed(['base'], ['leaf'], closureOf, ALWAYS, suggestsOf)).toBe(false);
    });

    // --- The permitting edge is named, not merely applied. ---

    it('names which edge permitted the link', () => {
        const direct = new Map<string, string[]>([
            ['base', ['dep']],
            ['dep', []],
            ['narrow', []],
        ]);
        const closureOf = (p: string): Set<string> => lpb._requires_closure(p, direct);
        const suggestsOf = (p: string): readonly string[] =>
            p === 'base' ? ['narrow'] : [];

        expect(lpb._link_permit_reason(['base'], ['base'], closureOf, ALWAYS, suggestsOf)).toBe(
            'same-pack',
        );
        expect(lpb._link_permit_reason(['base'], ['core'], closureOf, ALWAYS, suggestsOf)).toBe(
            'always-installed',
        );
        expect(lpb._link_permit_reason(['base'], ['dep'], closureOf, ALWAYS, suggestsOf)).toBe(
            'requires',
        );
        expect(lpb._link_permit_reason(['base'], ['narrow'], closureOf, ALWAYS, suggestsOf)).toBe(
            'suggests',
        );
        expect(
            lpb._link_permit_reason(['narrow'], ['dep'], closureOf, ALWAYS, suggestsOf),
        ).toBeNull();
    });

    // --- End to end over a planted corpus, both polarities. ---

    const skill = (name: string, pack: string, body: string): [string, string] => [
        `skills/${name}/SKILL.md`,
        `---\nname: ${name}\npacks: [${pack}]\n---\n\n${body}\n`,
    ];

    function plant(files: Record<string, string>): string {
        const dir = fs.mkdtempSync(path.join(tmp, 'corpus-'));
        for (const [rel, content] of Object.entries(files)) {
            const p = path.join(dir, rel);
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, content, 'utf-8');
        }
        // Realpath, not the mkdtemp path: on macOS `os.tmpdir()` is a symlink
        // (`/var` -> `/private/var`), and link resolution canonicalises the
        // target while the root would not — the relative keys then miss the
        // index and every link reads as out-of-tree, i.e. a silent green.
        return fs.realpathSync(dir);
    }

    function run(dir: string, extra: string[] = []): { code: number; out: string } {
        lpb._set_paths_for_test({ root: dir });
        try {
            const r = runInProc(lpb.main, ['--quiet', ...extra]);
            return { code: r.status, out: r.stdout + r.stderr };
        } finally {
            lpb._set_paths_for_test({ root: REAL_ROOT });
        }
    }

    const corpus = (packsYml: string): Record<string, string> => ({
        'packs.yml': packsYml,
        ...Object.fromEntries([
            skill('base-one', 'base', 'reaches [n](../narrow-one/SKILL.md)'),
            skill('narrow-one', 'narrow', 'leaf'),
        ]),
    });

    it('exits 0 on a corpus whose only cross-pack link a `suggests` edge permits', () => {
        const dir = plant(
            corpus('- id: base\n  requires: []\n  suggests: [narrow]\n- id: narrow\n  requires: []\n'),
        );
        expect(run(dir).code).toBe(0);
    });

    it('exits 1 on the same corpus with the `suggests` edge removed', () => {
        const dir = plant(corpus('- id: base\n  requires: []\n- id: narrow\n  requires: []\n'));
        expect(run(dir).code).toBe(1);
    });

    it('reports the permitting edge under --show-permitted', () => {
        const dir = plant(
            corpus('- id: base\n  requires: []\n  suggests: [narrow]\n- id: narrow\n  requires: []\n'),
        );
        const { code, out } = run(dir, ['--show-permitted']);
        expect(code).toBe(0);
        expect(out).toContain('suggests');
        expect(out).toContain('base -> narrow');
    });

    it('says nothing about a permitted link without --show-permitted', () => {
        const dir = plant(
            corpus('- id: base\n  requires: []\n  suggests: [narrow]\n- id: narrow\n  requires: []\n'),
        );
        expect(run(dir).out).not.toContain('base -> narrow');
    });
});
