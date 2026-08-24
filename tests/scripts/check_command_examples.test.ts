// Tests for src/scripts/check_command_examples.ts.
//
// Every sub-check is proven by SABOTAGE, not by a green run: the fixture is
// built compliant, the gate is asserted silent, then one thing is broken and the
// gate is asserted to name it. A check never seen red has unknown sensitivity,
// and this gate's whole value is that it reds — it scans a 23-command corpus
// that is compliant today, so a green run on the real tree proves nothing about
// whether it can fail.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    COMMAND_ROOT,
    GRANDFATHERED,
    IN_SCOPE_VISIBILITY,
    VOCAB_FILE,
    collectCommands,
    evaluate,
    extractExamples,
    flagsUsed,
    invocationResolves,
    invocations,
    main,
    readVocabulary,
} from '../../src/scripts/check_command_examples.js';

const REPO = path.resolve(__dirname, '..', '..');

let root: string;

/** Write a command.md into the fixture tree. */
function writeCommand(name: string, opts: { visibility?: string; body?: string }): string {
    const dir = path.join(root, COMMAND_ROOT, 'fixture-pack', name);
    fs.mkdirSync(dir, { recursive: true });
    const p = path.join(dir, 'command.md');
    fs.writeFileSync(
        p,
        `---\nname: ${name}\ndescription: fixture\ndisable-model-invocation: false\n` +
            `visibility: ${opts.visibility ?? 'visible'}\n---\n\n# ${name}\n\n${opts.body ?? ''}\n`,
    );
    return p;
}

// The flag is documented ABOVE the heading on purpose: sub-check (b) reads the
// body OUTSIDE the section, so a flag documented only inside its own examples
// is not documented. Keeping it above also means swapping the Why literal for
// its heading form cannot accidentally pull the documentation into the section.
const COMPLIANT = [
    'Documented flag: `--deep`.',
    '',
    '## Examples',
    '',
    '```',
    '/fresh-command tests/feature/auth --deep',
    '```',
    '',
    '**Why it works:** measurable-target — it points at a path instead of describing it.',
].join('\n');

/**
 * Findings a fixture tree can actually be responsible for.
 *
 * Every real grandfathered identity is absent from a tmpdir corpus, so
 * `staleGrandfathers` fires 23 times by construction. That check has its own
 * describe below; filtering it here keeps each other assertion about the one
 * thing it seeded.
 */
function seeded(r: string) {
    return evaluate(r).findings.filter((f) => f.check !== 'stale-grandfather');
}

beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cce-'));
    // The vocabulary IS the gate's corpus for sub-check (c); copy the real one
    // so the fixture tests the shipped ids, not invented ones.
    fs.mkdirSync(path.join(root, path.dirname(VOCAB_FILE)), { recursive: true });
    fs.copyFileSync(path.join(REPO, VOCAB_FILE), path.join(root, VOCAB_FILE));
});

afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('the gate is silent on a compliant command', () => {
    it('a fresh visible command with examples, a resolvable invocation and one pattern id passes', () => {
        writeCommand('fresh-command', { body: COMPLIANT });
        expect(evaluate(root).scanned).toBe(1);
        expect(seeded(root)).toEqual([]);
    });

    it('an internal command is out of scope entirely', () => {
        writeCommand('hidden-thing', { visibility: 'internal', body: 'no examples here' });
        expect(evaluate(root).scanned).toBe(0);
        expect(seeded(root)).toEqual([]);
    });
});

describe('sub-check (a) presence — reds on a seeded violation, greens on repair', () => {
    it('a NEW visible command with no Examples section is named', () => {
        writeCommand('fresh-command', { body: 'A body with no examples at all.' });
        const f = seeded(root);
        expect(f).toHaveLength(1);
        expect(f[0]!.check).toBe('presence');
        expect(f[0]!.message).toContain("no '## Examples' section");
    });

    it('adding the section repairs it', () => {
        writeCommand('fresh-command', { body: 'A body with no examples at all.' });
        expect(seeded(root)).toHaveLength(1);
        writeCommand('fresh-command', { body: COMPLIANT });
        expect(seeded(root)).toEqual([]);
    });

    it('a promotion from internal to advanced is what makes an old command newly liable', () => {
        // The forward-only edge: same file, same absent Examples, only the
        // visibility rose. Nothing else in the tree notices this.
        writeCommand('fresh-command', { visibility: 'internal', body: 'nothing' });
        expect(seeded(root)).toEqual([]);
        writeCommand('fresh-command', { visibility: 'advanced', body: 'nothing' });
        expect(seeded(root).map((x) => x.check)).toEqual(['presence']);
    });
});

describe('sub-check (b) resolvability — the rename check', () => {
    it('an invocation naming the OLD slug after a rename is named', () => {
        writeCommand('fresh-command', {
            body: COMPLIANT.replace('/fresh-command', '/stale-command'),
        });
        const f = seeded(root).filter((x) => x.check === 'resolvable');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain("does not resolve to 'fresh-command'");
    });

    it('a flag used in an example but absent from the body is named', () => {
        writeCommand('fresh-command', { body: COMPLIANT.replace('Documented flag: `--deep`.', '') });
        const f = seeded(root).filter((x) => x.check === 'resolvable');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain("'--deep'");
        expect(f[0]!.message).toContain('never documents it');
    });

    it('an Examples section with prose but no invocation line is named', () => {
        writeCommand('fresh-command', {
            body: '## Examples\n\nRun it however you like.\n\n**Why it works:** say-the-format — n/a.',
        });
        const f = seeded(root).filter((x) => x.check === 'resolvable');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain('no invocation line');
    });

    it('accepts the three host renderings of one name, and rejects a non-name alias', () => {
        expect(invocationResolves('/mission-upgrade 11', 'mission-upgrade')).toBe(true);
        expect(invocationResolves('/mission:upgrade 11', 'mission-upgrade')).toBe(true);
        expect(invocationResolves('/mission upgrade 11', 'mission-upgrade')).toBe(true);
        // An alias that is not the `name:` must NOT pass — otherwise the rename
        // check degrades to "starts with a slash".
        expect(invocationResolves('/pr:create', 'git-pr-create')).toBe(false);
        expect(invocationResolves('/work', 'work')).toBe(true);
        expect(invocationResolves('/worker', 'work')).toBe(false);
    });
});

describe('sub-check (c) pedagogy — the Why line and its vocabulary', () => {
    it('a NEW command with examples but no Why line is named', () => {
        writeCommand('fresh-command', {
            body: '## Examples\n\n```\n/fresh-command x\n```\n',
        });
        const f = seeded(root).filter((x) => x.check === 'why-line');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain('no Why line');
    });

    it('an unregistered pattern id is named', () => {
        writeCommand('fresh-command', {
            body: COMPLIANT.replace('measurable-target', 'be-nice-to-the-model'),
        });
        const f = seeded(root).filter((x) => x.check === 'why-line');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain('cites no registered pattern id');
    });

    it('citing two ids is named — the convention is exactly one', () => {
        writeCommand('fresh-command', {
            body: COMPLIANT.replace(
                'measurable-target —',
                'measurable-target and say-the-format —',
            ),
        });
        const f = seeded(root).filter((x) => x.check === 'why-line');
        expect(f).toHaveLength(1);
        expect(f[0]!.message).toContain('cite exactly one');
    });

    it('the heading literal is accepted as well as the inline one', () => {
        writeCommand('fresh-command', {
            body: COMPLIANT.replace(
                '**Why it works:** measurable-target —',
                '### Why it works\n\nmeasurable-target —',
            ),
        });
        expect(seeded(root)).toEqual([]);
    });
});

describe('the grandfather set is a one-way ratchet, not an exemption list', () => {
    it('a grandfathered command with no Examples is silent', () => {
        writeCommand(GRANDFATHERED.presence[0]!, { body: 'nothing' });
        expect(seeded(root).filter((x) => x.check === 'presence')).toEqual([]);
    });

    it('a grandfathered command that GAINS a section must leave the set', () => {
        const n = GRANDFATHERED.presence[0]!;
        writeCommand(n, { body: COMPLIANT.replace(/\/fresh-command/g, `/${n}`) });
        const f = evaluate(root).findings.filter((x) => x.check === 'stale-grandfather');
        expect(f.length).toBeGreaterThanOrEqual(1);
        expect(f.some((x) => x.message.includes('The set only shrinks'))).toBe(true);
    });

    it('a grandfathered name that is no longer an in-scope command is named', () => {
        // Empty fixture tree: every grandfathered identity is stale by
        // construction, which is the check firing.
        const f = evaluate(root).findings;
        const expected = GRANDFATHERED.presence.length + GRANDFATHERED.whyLine.length;
        expect(f).toHaveLength(expected);
        expect(f.every((x) => x.check === 'stale-grandfather')).toBe(true);
    });
});

describe('the vocabulary is the corpus for (c), so an empty one is a dead scope', () => {
    it('an empty approved_patterns list throws rather than passing everything', () => {
        fs.writeFileSync(
            path.join(root, VOCAB_FILE),
            'approved_patterns: []\nwhy_line_literals:\n  - "**Why it works:**"\n',
        );
        expect(() => evaluate(root)).toThrow(/carries no approved_patterns/);
    });

    it('main() maps a dead scope to exit 2, never to a green run', () => {
        fs.writeFileSync(path.join(root, VOCAB_FILE), 'approved_patterns: []\n');
        expect(main(['--quiet'], root)).toBe(2);
    });

    it('the shipped vocabulary holds the six ids and the two literals', () => {
        const v = readVocabulary(REPO);
        expect(v.patterns).toEqual([
            'outcome-not-steps',
            'self-check-loop',
            'measurable-target',
            'give-the-artifact',
            'point-at-reference',
            'say-the-format',
        ]);
        // Adopted verbatim from lint_examples.ts, whose own scope stays untouched.
        expect(v.literals).toEqual(['**Why it works:**', '### Why it works']);
    });
});

describe('the live tree', () => {
    it('is green, and the corpus is the measured 23 — not the roadmap\'s 61', () => {
        const { findings, scanned } = evaluate(REPO);
        expect(findings).toEqual([]);
        expect(scanned).toBe(23);
    });

    it('IN_SCOPE_VISIBILITY is the two values command.schema.json calls user-facing', () => {
        expect([...IN_SCOPE_VISIBILITY]).toEqual(['visible', 'advanced']);
    });

    it('the grandfather set covers exactly the 23 in scope, split 18 / 5', () => {
        // The pre-registered "4 of 61" was wrong twice over. Pinning both halves
        // here means a future reader cannot re-derive the wrong denominator.
        expect(GRANDFATHERED.presence).toHaveLength(18);
        expect(GRANDFATHERED.whyLine).toHaveLength(5);
        const live = collectCommands(REPO).map((c) => c.name).sort();
        expect(live).toHaveLength(23);
        expect([...GRANDFATHERED.presence, ...GRANDFATHERED.whyLine].sort()).toEqual(live);
    });

    it('not one shipped command carries a Why line today — the (c) grandfather is total', () => {
        // The finding that made forward-only the only workable posture: the
        // sections that exist are bare fences.
        const withSection = collectCommands(REPO).filter((c) => c.examples !== null);
        expect(withSection).toHaveLength(5);
        for (const c of withSection) {
            expect(c.examples).not.toContain('**Why it works:**');
            expect(c.examples).not.toContain('### Why it works');
        }
    });
});

describe('parsing helpers', () => {
    it('extractExamples stops at the next same-or-higher heading', () => {
        const s = extractExamples('## Examples\n\n/a\n\n## See also\n\nnot this\n');
        expect(s).toContain('/a');
        expect(s).not.toContain('not this');
    });

    it('invocations strips trailing comments and ignores prose', () => {
        expect(invocations('/work x   # asks for the prompt\nsome prose\n/work y')).toEqual([
            '/work x',
            '/work y',
        ]);
    });

    it('flagsUsed reports long flags once, sorted, without their values', () => {
        expect(flagsUsed('/x --personas=+qa --deep --personas=+sec')).toEqual([
            '--deep',
            '--personas',
        ]);
    });
});
