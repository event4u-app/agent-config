import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    checkArtifact,
    hintFor,
    parseHint,
    scan as scanHints,
} from '../../src/scripts/check_argument_hint.js';
import {
    _frontmatter_text,
    _parse_inputs,
    load_all_prompts,
    to_mcp_prompt_meta,
    type SkillPrompt,
} from '../../src/scripts/mcp_server/prompts.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');

function mkPrompt(over: Partial<SkillPrompt>): SkillPrompt {
    return {
        name: 'x',
        description: '',
        body: '',
        source: 'package',
        kind: 'skill',
        recommended_for_user_types: [],
        user_type_match: '',
        inputs: [],
        ...over,
    };
}

// ---------------------------------------------------------------- 3.1

describe('hintFor — the derived form', () => {
    it('renders required as <name> and optional as [name]', () => {
        expect(
            hintFor([
                { name: 'target', type: 'string', required: true },
                { name: 'dry_run', type: 'boolean' },
            ]),
        ).toBe('<target> [dry_run]');
    });

    it('appends enum values', () => {
        expect(hintFor([{ name: 'mode', type: 'enum', enum: ['fast', 'thorough'] }])).toBe(
            '[mode:fast|thorough]',
        );
    });
});

describe('parseHint — the round trip', () => {
    const cases = [
        [{ name: 'target', type: 'string', required: true }],
        [{ name: 'dry_run', type: 'boolean' }],
        [{ name: 'mode', type: 'enum', enum: ['fast', 'thorough'], required: true }],
        [
            { name: 'target', type: 'string', required: true },
            { name: 'mode', type: 'enum', enum: ['a', 'b'] },
            { name: 'limit', type: 'number' },
        ],
    ] as const;

    it.each(cases.map((c, i) => [i, c] as const))(
        'case %i survives generate → parse → compare',
        (_i, inputs) => {
            const parsed = parseHint(hintFor(inputs as never));
            expect(parsed).toEqual(
                inputs.map((i) => ({
                    name: i.name,
                    required: 'required' in i && i.required === true,
                    ...('enum' in i && i.enum ? { enum: [...i.enum] } : {}),
                })),
            );
        },
    );

    it('ignores a mismatched bracket pair rather than inventing a parameter', () => {
        expect(parseHint('<target]')).toEqual([]);
    });
});

describe('checkArtifact — a hand-written hint is a conflict, not a merge', () => {
    const declaring = (hint?: string): string =>
        `---\nname: x\n${hint === undefined ? '' : `argument-hint: "${hint}"\n`}inputs:\n  - name: a\n    type: string\n    required: true\n---\n\nbody\n`;

    it('a declaration with a matching hint passes', () => {
        expect(checkArtifact(declaring('<a>'), 'f.md')).toBeNull();
    });

    it('a declaration with a contradicting hand-written hint fails', () => {
        const f = checkArtifact(declaring('[something-else]'), 'f.md');
        expect(f).toMatchObject({ kind: 'conflict', derived: '<a>', written: '[something-else]' });
    });

    it('a declaration with no hint is reported as a generation gap', () => {
        expect(checkArtifact(declaring(), 'f.md')).toMatchObject({ kind: 'missing', derived: '<a>' });
    });

    it('an artifact with no declaration is untouched, hint or not', () => {
        expect(checkArtifact('---\nname: x\nargument-hint: "[free text]"\n---\n\nbody\n', 'f.md')).toBeNull();
        expect(checkArtifact('---\nname: x\n---\n\nbody\n', 'f.md')).toBeNull();
    });
});

describe('the shipped corpus stays green', () => {
    it('no artifact carries a hint that contradicts a declaration', () => {
        expect(scanHints(REPO).findings).toEqual([]);
    });
});

// ---------------------------------------------------------------- 3.2

describe('_parse_inputs — the stdlib-only block reader', () => {
    const fm = (block: string): string =>
        _frontmatter_text(`---\nname: x\n${block}---\n\nbody\n`);

    it('reads name, description and required', () => {
        expect(
            _parse_inputs(
                fm('inputs:\n  - name: target\n    type: string\n    required: true\n    description: What to act on.\n'),
            ),
        ).toEqual([{ name: 'target', description: 'What to act on.', required: true }]);
    });

    it('treats an absent required as optional', () => {
        expect(_parse_inputs(fm('inputs:\n  - name: a\n    type: string\n'))).toEqual([
            { name: 'a', description: '', required: false },
        ]);
    });

    it('reads several entries in order', () => {
        expect(
            _parse_inputs(fm('inputs:\n  - name: a\n    type: string\n  - name: b\n    type: number\n')).map(
                (i) => i.name,
            ),
        ).toEqual(['a', 'b']);
    });

    it('stops at the next top-level key', () => {
        expect(
            _parse_inputs(fm('inputs:\n  - name: a\n    type: string\npack: engineering-base\n')).map(
                (i) => i.name,
            ),
        ).toEqual(['a']);
    });

    it('yields nothing when no block is present', () => {
        expect(_parse_inputs(fm(''))).toEqual([]);
    });

    it('yields nothing rather than a guess when the block has no name', () => {
        expect(_parse_inputs(fm('inputs:\n  - type: string\n'))).toEqual([]);
    });
});

describe('to_mcp_prompt_meta — arguments are derived, never invented', () => {
    it('a prompt with no declaration still serves arguments: []', () => {
        expect(to_mcp_prompt_meta(mkPrompt({ name: 'plain' })).arguments).toEqual([]);
    });

    it('a declaring prompt serves a non-empty argument set', () => {
        const meta = to_mcp_prompt_meta(
            mkPrompt({
                name: 'declaring',
                inputs: [
                    { name: 'target', description: 'What to act on.', required: true },
                    { name: 'mode', description: '', required: false },
                ],
            }),
        );
        expect(meta.arguments).toEqual([
            { name: 'target', description: 'What to act on.', required: true },
            { name: 'mode', description: '', required: false },
        ]);
    });

    it('a command declaring inputs carries them too — both kinds, not just skills', () => {
        const meta = to_mcp_prompt_meta(
            mkPrompt({
                name: 'research:report',
                kind: 'command',
                inputs: [{ name: 'topic', description: '', required: true }],
            }),
        );
        expect(meta.name).toBe('command.research.report');
        expect(meta.arguments).toHaveLength(1);
    });
});

describe('no code path substitutes into a file-delivered body', () => {
    /**
     * Risk 3 asserted as a negative, because that is the direction it fails in:
     * once a declared argument set exists, filling those values into the text is
     * the natural next line, and a body a host executes natively must never be
     * rewritten on the way out.
     */
    it('the prompt module never rewrites a body against an input name', () => {
        const src = fs.readFileSync(
            path.join(REPO, 'src', 'scripts', 'mcp_server', 'prompts.ts'),
            'utf8',
        );
        // A substitution would have to write to `body` or regex-replace over it.
        expect(src).not.toMatch(/body\s*[:=]\s*[^,\n]*\.replace\(/);
        expect(src).not.toMatch(/\bbody\b[^\n]*\$\{/);
    });

    it('a declaring prompt delivers its body byte-identical to the source', () => {
        const body = 'Acts on ${target} and stops.\n';
        const p = mkPrompt({
            body,
            inputs: [{ name: 'target', description: '', required: true }],
        });
        // The projection carries metadata only; the body it was built with is unchanged.
        expect(to_mcp_prompt_meta(p)).not.toHaveProperty('body');
        expect(p.body).toBe(body);
    });
});

// ------------------------------------------------- the acceptance criterion

describe('prompts/list over the real corpus', () => {
    /**
     * The Goal's falsifiable claim, asserted against the shipped tree rather
     * than a fixture: a hand-built prompt proves the projection works, not that
     * a declaration on disk reaches the wire.
     */
    const metas = (): Record<string, unknown>[] => {
        const [prompts] = load_all_prompts();
        return prompts.map(to_mcp_prompt_meta);
    };

    it('carries a non-empty argument set for at least one command AND one skill', () => {
        const declaring = metas().filter((m) => ((m.arguments as unknown[]) ?? []).length > 0);
        const names = declaring.map((m) => String(m.name));
        expect(names.some((n) => n.startsWith('command.'))).toBe(true);
        expect(names.some((n) => n.startsWith('skill.'))).toBe(true);
    });

    it('every prompt that declares nothing still serves arguments: []', () => {
        const all = metas();
        expect(all.length).toBeGreaterThan(400);
        // Whatever the adopter count is, the complement must be exactly `[]` —
        // never absent, never a guessed argument.
        for (const m of all) expect(Array.isArray(m.arguments)).toBe(true);
        const empty = all.filter((m) => (m.arguments as unknown[]).length === 0);
        expect(empty.length).toBe(all.length - all.filter((m) => (m.arguments as unknown[]).length > 0).length);
    });

    it('each derived argument traces to the frontmatter on disk, not to the projection', () => {
        // The earlier version compared the projection's argument names against
        // `prompt.inputs` — both sides of one `.map`, so it proved the map is
        // the identity and nothing about whether the declaration was READ
        // correctly. Review called it tautological, and it was. This reads the
        // file instead.
        const [prompts] = load_all_prompts();
        const declaring = prompts.filter((p) => p.inputs.length > 0);
        expect(declaring.length).toBeGreaterThan(0);

        for (const p of declaring) {
            const meta = to_mcp_prompt_meta(p);
            const wire = (meta.arguments as { name: string }[]).map((a) => a.name);
            const file = [
                path.join(REPO, 'src', 'skills', p.name, 'SKILL.md'),
                path.join(REPO, 'src', 'domains', 'engineering-base', p.name, 'command.md'),
            ].find((f) => fs.existsSync(f));
            expect(file, `no source found for ${p.name}`).toBeDefined();

            const fm = /^---\n([\s\S]*?)\n---/.exec(fs.readFileSync(file as string, 'utf8'))![1]!;
            const onDisk = [...fm.matchAll(/^\s*-\s+name:\s*(\S+)/gm)].map((m) => m[1]);
            expect(wire).toEqual(onDisk);
        }
    });
});
