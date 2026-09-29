import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { compare, scan, yamlInputs } from '../../src/scripts/check_inputs_parity.js';
import { _frontmatter_text, _parse_inputs } from '../../src/scripts/mcp_server/prompts.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const doc = (block: string): string => `---\nname: x\n${block}---\n\nbody\n`;
const server = (block: string): ReturnType<typeof _parse_inputs> =>
    _parse_inputs(_frontmatter_text(doc(block)));

/**
 * Each case below is a form the SCHEMA accepts and an earlier reader misread.
 * They are kept as a set rather than folded into one test, because the point is
 * that every one of them is now either read correctly or refused — never read
 * differently and served to a host.
 */
describe('_parse_inputs — forms an earlier reader got wrong', () => {
    it('a nested mapping under an item key no longer overwrites the name', () => {
        // The reported defect: `default:` carrying `name:` as its first child
        // renamed the parameter, so the wire offered an argument nobody declared.
        const block = 'inputs:\n  - name: opts\n    type: string\n    default:\n      name: fallback\n';
        expect(server(block).map((i) => i.name)).not.toContain('fallback');
        // It is refused rather than guessed at — and the parity gate says so.
        expect(compare(doc(block), 'f.md')).not.toBeNull();
    });

    it('required: True is read as required, not as optional', () => {
        expect(server('inputs:\n  - name: a\n    type: string\n    required: True\n')[0]).toEqual({
            name: 'a',
            description: '',
            required: true,
        });
    });

    it('a comment at column zero does not truncate the block', () => {
        const block = 'inputs:\n  - name: a\n    type: string\n# a note\n  - name: b\n    type: string\n';
        expect(server(block).map((i) => i.name)).toEqual(['a', 'b']);
    });

    it('an inline comment is not part of the value', () => {
        expect(server('inputs:\n  - name: a\n    type: string\n    description: x # y\n')[0]!.description).toBe(
            'x',
        );
    });

    it('the flow form is refused rather than read as empty and passed off as parity', () => {
        const block = 'inputs: [{name: target, type: string}]\n';
        expect(server(block)).toEqual([]);
        // YAML sees one input, the server sees none — that IS the divergence the
        // gate reports, instead of a prompt silently losing its argument.
        expect(compare(doc(block), 'f.md')).toMatchObject({ server: [], yaml: [{ name: 'target' }] });
    });

    it('a block scalar is refused rather than served as ">"', () => {
        const block = 'inputs:\n  - name: a\n    type: string\n    description: >\n      long text\n';
        expect(server(block)).toEqual([]);
        expect(compare(doc(block), 'f.md')).not.toBeNull();
    });
});

describe('_parse_inputs — the supported shape still reads correctly', () => {
    it('reads name, description and required', () => {
        expect(
            server('inputs:\n  - name: target\n    type: string\n    required: true\n    description: What to act on.\n'),
        ).toEqual([{ name: 'target', description: 'What to act on.', required: true }]);
    });

    it('reads several items in order and stops at the next top-level key', () => {
        expect(
            server('inputs:\n  - name: a\n    type: string\n  - name: b\n    type: number\npack: x\n').map(
                (i) => i.name,
            ),
        ).toEqual(['a', 'b']);
    });

    it('a quoted value keeps its content', () => {
        expect(server('inputs:\n  - name: a\n    type: string\n    description: "x # y"\n')[0]!.description).toBe(
            'x # y',
        );
    });
});

describe('yamlInputs', () => {
    it('returns null when no block is declared — absent is not empty', () => {
        expect(yamlInputs('name: x\n')).toBeNull();
    });

    it('returns the reduced shape for a declared block', () => {
        expect(yamlInputs('name: x\ninputs:\n  - name: a\n    type: string\n    required: true\n')).toEqual([
            { name: 'a', description: '', required: true },
        ]);
    });
});

describe('parity over the shipped corpus', () => {
    it('holds for every declaring artifact', () => {
        expect(scan(REPO).findings).toEqual([]);
    });

    it('scans a non-empty corpus', () => {
        expect(scan(REPO).scanned).toBeGreaterThan(400);
    });
});
