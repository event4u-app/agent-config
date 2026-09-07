/**
 * D1: the stub write was host-independent
 * (road-to-delivery-for-every-host step 1.2).
 *
 * Under `thin`/`delivery` the write at the top of the emit loop fired for every
 * `TOOL_DIRS` entry and BEFORE the `.claude/rules` branch, so a project-wide
 * flip reduced Cursor and Cline to pointer files on hosts where hook delivery is
 * unmeasured — a silent capability loss that every file-COUNT check passes,
 * because the files are all still there.
 *
 * The assertion that matters is therefore not "Claude got stubs". It is that the
 * two other trees are BYTE-IDENTICAL to what an `eager-all` run writes. Both
 * directions are asserted, and the pre-fix behaviour is pinned by
 * `thinsHost` unit coverage in `lean_projection_hosts.test.ts` rather than by
 * reverting the fix here.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    MODULE_STATE,
    _getStateForTest,
    _resetStateForTest,
    generate_rule_symlinks,
} from '../../src/scripts/condense.js';
import { is_thin_entry, thin_entry } from '../../src/scripts/project_thin_rules.js';
import { thinnedTreeFindings } from '../../src/scripts/check_rule_projection_integrity.js';
import { compareTrees } from '../../src/scripts/check_host_tree_parity.js';

const RULES = ['alpha-rule.md', 'beta-rule.md'] as const;

let tmp: string;
let saved: ReturnType<typeof _getStateForTest>;
let savedHome: string | undefined;

/** A project root with a two-rule projection and the given `lean_projection` block. */
function seed(root: string, leanBlock: string): void {
    const dist = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(dist, { recursive: true });
    for (const name of RULES) {
        fs.writeFileSync(
            path.join(dist, name),
            `---\ntype: "auto"\ntriggers:\n  - keyword: "${name}"\n---\n\n# ${name}\n\nBody of ${name}.\n`,
            'utf-8',
        );
    }
    fs.writeFileSync(path.join(root, '.agent-settings.yml'), leanBlock, 'utf-8');
}

/** Every emitted entry in `dir`, as `name -> content`. A symlink is read through. */
function treeContents(root: string, rel: string): Record<string, string> {
    const dir = path.join(root, rel);
    const out: Record<string, string> = {};
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort()) {
        if (name === 'README.md') continue;
        try {
            out[name] = fs.readFileSync(path.join(dir, name), 'utf-8');
        } catch {
            out[name] = '<unreadable>';
        }
    }
    return out;
}

interface HostTrees {
    readonly claude: Record<string, string>;
    readonly cursor: Record<string, string>;
    readonly cline: Record<string, string>;
}

/** Seed a fresh root, run the generator once, and return every host tree it wrote. */
function generateInto(leanBlock: string, label: string): HostTrees {
    const root = path.join(tmp, label);
    seed(root, leanBlock);
    _resetStateForTest(root);
    generate_rule_symlinks();
    return {
        claude: treeContents(root, path.join('.claude', 'rules')),
        cursor: treeContents(root, path.join('.cursor', 'rules')),
        cline: treeContents(root, '.clinerules'),
    };
}

beforeEach(() => {
    saved = _getStateForTest();
    savedHome = process.env['HOME'];
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'lph-scope-'));
    // An empty HOME: user-scope dedup must find no twin, or the trees under
    // comparison would differ for a reason that has nothing to do with the host
    // axis. The failure this guards against is a green test on an empty tree.
    const home = path.join(tmp, 'home');
    fs.mkdirSync(home, { recursive: true });
    process.env['HOME'] = home;
});

afterEach(() => {
    _resetStateForTest(saved.PROJECT_ROOT);
    if (savedHome === undefined) delete process.env['HOME'];
    else process.env['HOME'] = savedHome;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('1.2 — delivery with hosts: [claude-code]', () => {
    it('stubs Claude and leaves Cursor and Cline byte-identical to eager-all', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'eager');
        const scoped = generateInto(
            'lean_projection:\n  mode: delivery\n  hosts: [claude-code]\n',
            'scoped',
        );

        // The fixture is only meaningful if the eager run actually wrote the
        // trees being compared. An empty-vs-empty comparison is the classic
        // way this assertion passes while proving nothing.
        expect(Object.keys(eager.cursor).length).toBeGreaterThan(0);
        expect(Object.keys(eager.cline).length).toBeGreaterThan(0);

        expect(scoped.cursor).toEqual(eager.cursor);
        expect(scoped.cline).toEqual(eager.cline);

        // Claude DID change — otherwise the host gate would be trivially
        // satisfied by a flip that does nothing at all.
        expect(scoped.claude).not.toEqual(eager.claude);
        for (const name of RULES) {
            const stub = scoped.claude[name];
            expect(stub).toBeDefined();
            expect(stub as string).not.toContain('Body of');
            expect(is_thin_entry(stub as string)).toBe(true);
        }
    });

    it('naming cursor thins cursor and still leaves cline untouched', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'eager2');
        const scoped = generateInto(
            'lean_projection:\n  mode: delivery\n  hosts: [cursor]\n',
            'scoped2',
        );
        expect(scoped.cline).toEqual(eager.cline);
        expect(scoped.claude).toEqual(eager.claude);
        expect(scoped.cursor).not.toEqual(eager.cursor);
    });

    it('an absent hosts key thins Claude only — the default is not "all"', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'eager3');
        const scoped = generateInto('lean_projection:\n  mode: delivery\n', 'scoped3');
        expect(scoped.cursor).toEqual(eager.cursor);
        expect(scoped.cline).toEqual(eager.cline);
        expect(scoped.claude).not.toEqual(eager.claude);
    });

    it('a typo in hosts thins NO host, and never falls back to Claude', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'eager4');
        const scoped = generateInto(
            'lean_projection:\n  mode: delivery\n  hosts: [claud-code]\n',
            'scoped4',
        );
        expect(scoped.claude).toEqual(eager.claude);
        expect(scoped.cursor).toEqual(eager.cursor);
        expect(scoped.cline).toEqual(eager.cline);
    });

    it('mode eager-all with a hosts list left behind thins nothing', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'eager5');
        const stale = generateInto(
            'lean_projection:\n  mode: eager-all\n  hosts: [claude-code, cursor, cline]\n',
            'stale',
        );
        expect(stale).toEqual(eager);
    });
});

void MODULE_STATE;

describe('1.3 — the projection-integrity gate reads the host axis', () => {
    /** A tiny expectation set, so the audit's own emit plan is not in play. */
    const expected = {
        '.claude/rules': [...RULES],
        '.cursor/rules': [...RULES],
        '.clinerules': [...RULES],
    } as const;

    /** Write `text` as every rule entry in every tree under `root`. */
    function plant(root: string, per: (tree: string, rule: string) => string): void {
        for (const tree of Object.keys(expected)) {
            fs.mkdirSync(path.join(root, tree), { recursive: true });
            for (const rule of RULES) {
                fs.writeFileSync(path.join(root, tree, rule), per(tree, rule), 'utf-8');
            }
        }
    }

    it('a stub is COMPLETE for a delivery host and a DEFECT everywhere else', () => {
        const root = path.join(tmp, 'axis');
        fs.mkdirSync(root, { recursive: true });
        plant(root, (tree, rule) =>
            tree === '.claude/rules' ? thin_entry(rule.replace(/\.md$/, ''), '---\n---\nx\n') : `# ${rule}\n\nbody\n`,
        );
        const findings = thinnedTreeFindings(root, expected, ['claude-code']);
        expect(findings).toEqual([]);
    });

    it('a stub in .clinerules FAILS and names the host and the reason', () => {
        const root = path.join(tmp, 'axis2');
        fs.mkdirSync(root, { recursive: true });
        plant(root, (tree, rule) =>
            tree === '.clinerules' ? thin_entry(rule.replace(/\.md$/, ''), '---\n---\nx\n') : `# ${rule}\n\nbody\n`,
        );
        const findings = thinnedTreeFindings(root, expected, ['claude-code']);
        expect(findings.map((f) => f.tree)).toEqual(['.clinerules', '.clinerules']);
        expect(findings[0]?.kind).toBe('thinned');
        expect(findings[0]?.message).toContain('cline');
        expect(findings[0]?.message).toContain('lean_projection.hosts');
    });

    it('an empty delivery-host list makes every stub a finding — a rolled-back mode exempts nothing', () => {
        const root = path.join(tmp, 'axis3');
        fs.mkdirSync(root, { recursive: true });
        plant(root, (_tree, rule) => thin_entry(rule.replace(/\.md$/, ''), '---\n---\nx\n'));
        expect(thinnedTreeFindings(root, expected, []).length).toBe(6);
    });

    it('an unmapped tool dir fails CLOSED rather than being silently exempted', () => {
        const root = path.join(tmp, 'axis4');
        const odd = { '.someneweditor/rules': [...RULES] } as const;
        fs.mkdirSync(path.join(root, '.someneweditor/rules'), { recursive: true });
        for (const rule of RULES) {
            fs.writeFileSync(
                path.join(root, '.someneweditor/rules', rule),
                thin_entry(rule.replace(/\.md$/, ''), '---\n---\nx\n'),
                'utf-8',
            );
        }
        const findings = thinnedTreeFindings(root, odd, ['claude-code', 'cursor', 'cline']);
        expect(findings.length).toBe(2);
        expect(findings[0]?.message).toContain('unmapped');
    });

    it('a missing entry is not reported here — missing and dangling already own that case', () => {
        const root = path.join(tmp, 'axis5');
        fs.mkdirSync(path.join(root, '.clinerules'), { recursive: true });
        expect(thinnedTreeFindings(root, expected, ['claude-code'])).toEqual([]);
    });
});

describe('1.4 — byte-identity parity for every non-delivery host', () => {
    /**
     * The RED direction, end to end through the real projector rather than
     * through a hand-built pair of directories: with `hosts: []` no host is a
     * delivery host, so a `delivery` run must differ from `eager-all` on all
     * three trees and the comparison must say so. A gate that only ever runs on
     * a passing configuration has unknown sensitivity.
     */
    it('reds when a thinning mode reaches a host outside the delivery set', () => {
        const eager = generateInto('lean_projection:\n  mode: eager-all\n', 'p-eager');
        void eager;
        const eagerRoot = path.join(tmp, 'p-eager');
        const testRoot = path.join(tmp, 'p-test');
        seed(testRoot, 'lean_projection:\n  mode: delivery\n  hosts: [claude-code, cursor, cline]\n');
        _resetStateForTest(testRoot);
        generate_rule_symlinks();

        // Every host IS a delivery host here, so parity is not asserted for any
        // of them and the finding list is empty by construction.
        expect(compareTrees(eagerRoot, testRoot, ['claude-code', 'cursor', 'cline'])).toEqual([]);

        // The same two trees, judged with an EMPTY delivery set: now every
        // stubbed entry is a parity break, and cline is among them.
        const findings = compareTrees(eagerRoot, testRoot, []);
        expect(findings.length).toBe(RULES.length * 3);
        expect(findings.some((f) => f.tree === '.clinerules')).toBe(true);
        expect(findings.every((f) => f.reason.includes('content differs'))).toBe(true);
    });

    it('reds on a one-byte change in a Cline entry', () => {
        const eagerRoot = path.join(tmp, 'b-eager');
        const testRoot = path.join(tmp, 'b-test');
        for (const [root, label] of [[eagerRoot, 'b-eager'], [testRoot, 'b-test']] as const) {
            void label;
            seed(root, 'lean_projection:\n  mode: eager-all\n');
            _resetStateForTest(root);
            generate_rule_symlinks();
        }
        expect(compareTrees(eagerRoot, testRoot, ['claude-code'])).toEqual([]);

        // One byte, in the entry itself. A symlinked entry is replaced by a real
        // file so the planted change survives the read-through.
        const victim = path.join(testRoot, '.clinerules', RULES[0]);
        const before = fs.readFileSync(victim, 'utf-8');
        fs.rmSync(victim);
        fs.writeFileSync(victim, `${before} `, 'utf-8');

        const findings = compareTrees(eagerRoot, testRoot, ['claude-code']);
        expect(findings.length).toBe(1);
        expect(findings[0]?.tree).toBe('.clinerules');
        expect(findings[0]?.host).toBe('cline');
        expect(findings[0]?.rule).toBe(RULES[0]);
    });

    it('a MISSING entry is reported distinctly from a changed one', () => {
        const eagerRoot = path.join(tmp, 'm-eager');
        const testRoot = path.join(tmp, 'm-test');
        for (const root of [eagerRoot, testRoot]) {
            seed(root, 'lean_projection:\n  mode: eager-all\n');
            _resetStateForTest(root);
            generate_rule_symlinks();
        }
        fs.rmSync(path.join(testRoot, '.cursor', 'rules', RULES[1]));
        const findings = compareTrees(eagerRoot, testRoot, ['claude-code']);
        expect(findings.length).toBe(1);
        expect(findings[0]?.reason).toContain('MISSING under the thinning mode');
    });
});
