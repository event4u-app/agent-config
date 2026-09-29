import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    declaredInputs,
    scan,
    unbackedReferences,
} from '../../src/scripts/check_input_references.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures', 'input-references');

const fixture = (name: string): string =>
    fs.readFileSync(path.join(FIXTURES, `${name}.md`), 'utf8');

describe('unbackedReferences — the pair the roadmap names', () => {
    it('a fixture declaring inputs.a and referencing ${b} fails', () => {
        const found = unbackedReferences(fixture('unbacked'), 'unbacked.md');
        expect(found).toEqual([{ file: 'unbacked.md', name: 'b', declared: ['a'] }]);
    });

    it('the same fixture referencing ${a} passes', () => {
        expect(unbackedReferences(fixture('backed'), 'backed.md')).toEqual([]);
    });
});

describe('unbackedReferences — scope', () => {
    it('an artifact with no inputs block is not checked, however it references', () => {
        // The body references ${anything}. Out of scope is not the same as clean,
        // and this is the property that lets the gate ship with zero findings.
        expect(declaredInputs(fixture('no-block'))).toBeNull();
        expect(unbackedReferences(fixture('no-block'), 'no-block.md')).toEqual([]);
    });

    it('foreign interpolation inside a fence is not read as a reference', () => {
        // The fence carries ${local.env.aws_account_id}. Reporting it would be a
        // false positive on working content — the failure that gets a young gate
        // switched off.
        expect(unbackedReferences(fixture('fenced-foreign'), 'fenced-foreign.md')).toEqual([]);
    });

    it('a repeated unbacked reference is reported once, not once per occurrence', () => {
        const text = `---\nname: x\ninputs:\n  - name: a\n    type: string\n---\n\n\${b} and \${b} again.\n`;
        expect(unbackedReferences(text)).toHaveLength(1);
    });
});

describe('declaredInputs', () => {
    it('returns the declared names for a declaring artifact', () => {
        expect(declaredInputs(fixture('backed'))).toEqual(['a']);
    });

    it('returns null — not [] — when no block is present', () => {
        // The distinction is the scope rule: [] would mean "declares nothing",
        // which is a declaration, and every reference would then be unbacked.
        expect(declaredInputs(fixture('no-block'))).toBeNull();
    });

    it('returns null on malformed frontmatter rather than throwing', () => {
        expect(declaredInputs('---\nname: [unclosed\n---\n\nbody\n')).toBeNull();
    });

    it('returns null when inputs is not a list', () => {
        expect(declaredInputs('---\nname: x\ninputs: nope\n---\n\nbody\n')).toBeNull();
    });
});

describe('scan — the corpus stays green', () => {
    const root = path.resolve(HERE, '..', '..');

    it('reports no unbacked reference across the shipped corpus', () => {
        expect(scan(root).findings).toEqual([]);
    });

    it('scans a non-empty corpus — a green over zero files would prove nothing', () => {
        expect(scan(root).scanned).toBeGreaterThan(400);
    });
});
