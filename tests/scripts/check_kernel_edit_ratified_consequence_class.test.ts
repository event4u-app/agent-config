import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import { classifyTarget } from '../../src/scripts/classify_merge_risk.js';
import { CLASS_CONFIG_REL, CLAUSES } from '../../src/scripts/_lib/rule_consequence_class.js';
import { ConsequenceClassUnreadable } from '../../src/scripts/_lib/ratification_subject.js';
import { RATIFICATION_DIR } from '../../src/scripts/_lib/ratification_artifact.js';
import { commitAll } from './ratification_git_fixture.js';

/**
 * Step 4.2 — rule law beyond the nine kernel rules.
 *
 * The 2026-10-19 attempt was refused 2/2 on two dealbreakers, and each has its
 * own describe block here: the list failed OPEN (an unreadable list became an
 * empty class and the gate exited 0), and membership was read from one side
 * only, so a change that ADDED a member while editing that rule left the
 * rule's bytes outside the digest its record carried.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const LIST = gate.CONSEQUENCE_CLASS_PATH;
const ALPHA = 'src/rules/alpha.md';
const BETA = 'src/rules/beta.md';

let root: string;

function write(rel: string, body: string): void {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
}

function listOf(...slugs: string[]): string {
    const members: Record<string, { clause: string }> = {};
    for (const s of slugs) members[s] = { clause: 'authority-bypass' };
    return `${JSON.stringify({ members }, null, 2)}\n`;
}

function reader(files: Record<string, string>): (rel: string) => string | null {
    return (rel) => (Object.prototype.hasOwnProperty.call(files, rel) ? (files[rel] as string) : null);
}

function unreadable(files: Record<string, string>): string {
    try {
        gate.consequenceRuleSlugsIn(reader(files), 'the fixture');
    } catch (err) {
        expect(err).toBeInstanceOf(ConsequenceClassUnreadable);
        return (err as Error).message;
    }
    throw new Error('expected a refusal');
}

function record(name: string, subject: string): string {
    const rel = path.join(RATIFICATION_DIR, name);
    write(
        rel,
        [
            '---',
            'proposed_by: claude/session-a',
            'implemented_by: claude/session-a',
            'reviewed_by: council/anthropic+openai',
            `subject: ${subject}`,
            'verdict: ratified',
            'effective_after: merge',
            'providers:',
            '  - anthropic',
            '  - openai',
            'seats:',
            '  anthropic: ratified',
            '  openai: ratified',
            '---',
            '',
            '<!-- evidence-type: ratification -->',
            '',
            'Review body.',
            '',
        ].join('\n'),
    );
    return rel;
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'kercc-'));
    write(LIST, listOf('alpha'));
    write(ALPHA, 'alpha law\n');
    write(BETA, 'beta law\n');
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the list path and the watch list', () => {
    it('names the same file and the same three clauses the class library reads', () => {
        expect(LIST).toBe(CLASS_CONFIG_REL);
        expect([...gate.CONSEQUENCE_CLAUSES].sort()).toEqual([...CLAUSES].sort());
    });

    it('every tracked copy of a member rule in this repository is classified as one', () => {
        // Inventory-backed: the class read from this checkout, against every
        // tracked file named for a member. A projection that placed a member
        // outside a `rules/` directory would show up here as unclassified.
        const members = gate.consequenceRuleSlugsOfCheckout();
        const env = { ...process.env };
        for (const k of ['GIT_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_COMMON_DIR']) delete env[k];
        const tracked = spawnSync('git', ['-C', REPO, 'ls-files', '-z'], { encoding: 'utf8', env })
            .stdout.split('\u0000')
            .filter((p) => p.endsWith('.md') && members.has(path.posix.basename(p, '.md')))
            .filter((p) => !/^(?:agents|docs|tests)\//u.test(p));
        // Each member has its source and its packaged projection tracked here.
        for (const slug of members) {
            expect(tracked, slug).toContain(`src/rules/${slug}.md`);
            expect(tracked, slug).toContain(`dist/agent-src/rules/${slug}.md`);
        }
        const kernel = new Set(gate.classifyPaths(tracked, []).kernelRules);
        const unclassified = tracked.filter(
            (p) => !kernel.has(p) && !gate.classifyPaths([p], []).consequenceRules.includes(p),
        );
        expect(unclassified).toEqual([]);
    });

    it('the list is a mechanism path; the schema that states the criterion is not', () => {
        expect(gate.isMechanismPath(LIST)).toBe(true);
        expect(gate.classifyPaths([LIST], [], new Set()).self).toBe(true);
        // The gate never reads the schema, so it changes no membership.
        expect(gate.isMechanismPath('src/scripts/schemas/rule.schema.json')).toBe(false);
    });
});

describe('classification', () => {
    const cls = new Set(['alpha', 'commit-policy']);

    it('a member outside the kernel is a high-consequence rule, as source and as projection', () => {
        expect(gate.classifyPaths([ALPHA], [], cls).consequenceRules).toEqual([ALPHA]);
        for (const projection of [
            '.claude/rules/alpha.md',
            '.augment/rules/alpha.md',
            'dist/agent-src/rules/alpha.md',
            '.cursor/rules/alpha.md',
        ]) {
            expect(gate.classifyPaths([projection], [], cls).consequenceRules, projection).toEqual([projection]);
        }
        expect(gate.requiresRatification(gate.classifyPaths([ALPHA], [], cls))).toBe(true);
    });

    it('a rule outside the class is not gated', () => {
        const g = gate.classifyPaths([BETA], [], cls);
        expect(g.consequenceRules).toEqual([]);
        expect(gate.requiresRatification(g)).toBe(false);
    });

    it('a kernel rule in the class is still reported as a kernel rule', () => {
        const g = gate.classifyPaths(['src/rules/commit-policy.md'], [], cls);
        expect(g.kernelRules).toEqual(['src/rules/commit-policy.md']);
        expect(g.consequenceRules).toEqual([]);
    });

    it('the real class of this checkout reaches a member beyond the kernel', () => {
        expect(gate.classifyPaths(['src/rules/tool-safety.md'], []).consequenceRules).toEqual([
            'src/rules/tool-safety.md',
        ]);
    });
});

describe('dealbreaker 1 — the list fails CLOSED', () => {
    const rules = { [ALPHA]: 'x', [BETA]: 'y' };

    it('a valid list reads as its members, and an empty one as empty', () => {
        expect([...gate.consequenceRuleSlugsIn(reader({ ...rules, [LIST]: listOf('alpha', 'beta') }), 'f')]).toEqual([
            'alpha',
            'beta',
        ]);
        expect(gate.consequenceRuleSlugsIn(reader({ [LIST]: listOf() }), 'f').size).toBe(0);
    });

    it.each([
        ['absent', {}, 'absent'],
        ['not JSON', { [LIST]: '{ members: ' }, 'not JSON'],
        ['a top level that is an array', { [LIST]: '[]' }, 'top level'],
        ['members missing', { [LIST]: '{}' }, '`members`'],
        ['members an array', { [LIST]: '{"members": ["alpha"]}' }, '`members`'],
        ['a key that is not a slug', { ...rules, [LIST]: '{"members": {"Alpha_1": {"clause": "x"}}}' }, 'not a rule slug'],
        ['a __proto__ key', { ...rules, [LIST]: '{"members": {"__proto__": {"clause": "x"}}}' }, 'not a rule slug'],
        ['an entry with no clause', { ...rules, [LIST]: '{"members": {"alpha": {}}}' }, 'no `clause` of the criterion'],
        [
            'a clause outside the criterion',
            { ...rules, [LIST]: '{"members": {"alpha": {"clause": "important"}}}' },
            'no `clause` of the criterion',
        ],
        ['a member with no rule file', { [LIST]: listOf('ghost') }, 'names no rule file'],
    ])('%s is a refusal, never an empty class', (_name, files, detail) => {
        expect(unreadable(files as Record<string, string>)).toContain(detail);
    });

    it('the gate refuses a diff whose head list is unreadable, even one gating nothing else', () => {
        const base = commitAll(root);
        write(LIST, '{ broken');
        write('docs/note.md', 'prose\n');
        commitAll(root);
        const r = gate.evaluate([LIST, 'docs/note.md'], root, 2, 'HEAD', base);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('cannot be read');
    });

    it('the gate refuses a head commit that has NO list at all', () => {
        const base = commitAll(root);
        fs.rmSync(path.join(root, LIST));
        write('docs/note.md', 'prose\n');
        commitAll(root);
        const r = gate.evaluate([LIST, 'docs/note.md'], root, 2, 'HEAD', base);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain('the file is absent');
    });

    it('the gate refuses a base commit that has NO list at all', () => {
        fs.rmSync(path.join(root, LIST));
        const base = commitAll(root, 'base without a list');
        write(LIST, listOf('alpha'));
        commitAll(root);
        const r = gate.evaluate([LIST], root, 2, 'HEAD', base);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain(`commit ${base}`);
        expect(r.lines.join('\n')).toContain('the file is absent');
    });

    it('the gate refuses when the BASE list is unreadable', () => {
        write(LIST, 'not json');
        const base = commitAll(root);
        write(LIST, listOf('alpha'));
        commitAll(root);
        const r = gate.evaluate(['docs/none.md'], root, 2, 'HEAD', base);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain(`commit ${base}`);
    });

    it('polarity: a readable list and an ungated diff pass with nothing to ratify', () => {
        const base = commitAll(root);
        write('docs/note.md', 'prose\n');
        commitAll(root);
        const r = gate.evaluate(['docs/note.md'], root, 2, 'HEAD', base);
        expect(r.exitCode, r.lines.join('\n')).toBe(0);
        expect(r.lines.join('\n')).toContain('nothing to ratify');
    });
});

describe('dealbreaker 2 — membership is read at both commits the subject binds to', () => {
    it('an edit of a member with no record is refused and names the rule', () => {
        const base = commitAll(root);
        write(ALPHA, 'alpha law, weakened\n');
        commitAll(root);
        const r = gate.evaluate([ALPHA], root, 2, 'HEAD', base);
        expect(r.exitCode).toBe(1);
        expect(r.lines.join('\n')).toContain(`high-consequence rule ${ALPHA}`);
    });

    it('ADDING a member while editing that rule puts the rule inside the digest', () => {
        const base = commitAll(root);
        write(LIST, listOf('alpha', 'beta'));
        write(BETA, 'beta law, edited in the same change\n');
        commitAll(root);
        const s = gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base);
        expect(s.gatedFiles).toEqual([LIST, BETA]);
    });

    it('DROPPING a member while editing that rule keeps the rule inside the digest', () => {
        const base = commitAll(root);
        write(LIST, listOf());
        write(ALPHA, 'alpha law, edited once it left the class\n');
        commitAll(root);
        const s = gate.expectedSubjectFor([LIST, ALPHA], root, 'HEAD', base);
        expect(s.gatedFiles).toEqual([LIST, ALPHA]);
    });

    it('the merge classifier entry point routes a member dropped while edited to the owner', () => {
        // Through `classifyTarget`, the function the merge command runs, over
        // real commits: nothing is injected, so this proves the entry point
        // itself computes the base-and-head union and hands it to owner routing.
        const base = commitAll(root);
        write(LIST, listOf());
        write(ALPHA, 'alpha law, edited once it left the class\n');
        const head = commitAll(root);
        const r = classifyTarget(root, { range: `${base}..${head}` });
        expect(r.verdict).toBe('needs-owner');
        const governance = r.triggers.find((t) => t.id === 'governance-surface');
        expect(governance?.paths).toContain(ALPHA);

        // Polarity: a rule in neither side's list is not routed for governance.
        write(BETA, 'beta law, edited, never a member\n');
        const later = commitAll(root);
        const quiet = classifyTarget(root, { range: `${head}..${later}` });
        expect(quiet.triggers.map((t) => t.id)).not.toContain('governance-surface');
    });

    it('a record bound to that digest passes, and one edit after it turns red', () => {
        const base = commitAll(root);
        write(LIST, listOf('alpha', 'beta'));
        write(BETA, 'beta law, edited in the same change\n');
        commitAll(root);
        const rel = record('add-beta.md', gate.expectedSubjectFor([LIST, BETA], root, 'HEAD', base).digest);
        commitAll(root);
        const green = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
        expect(green.exitCode, green.lines.join('\n')).toBe(0);

        write(BETA, 'beta law, changed after the review\n');
        commitAll(root);
        const red = gate.evaluate([LIST, BETA, rel], root, 2, 'HEAD', base);
        expect(red.exitCode).toBe(1);
    });
});
