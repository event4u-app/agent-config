import { describe, expect, it } from 'vitest';

import { docsLayer } from '../../src/scripts/code_graph/docs_layer.js';

const files = new Set(['src/a.ts', 'src/b/c.ts', 'docs/guide.md', 'docs/other.md', 'README.md']);

describe('the docs layer (6.3)', () => {
    it('links a document to the files it links or names, and nothing else', () => {
        const { edges } = docsLayer(
            [
                {
                    path: 'docs/guide.md',
                    source: [
                        'See [the other guide](other.md#setup) and [root readme](/README.md).',
                        'The engine lives in `src/a.ts:12` and `src/b/c.ts`.',
                        'A [web page](https://example.com/src/a.ts), a [missing file](gone.md),',
                        'a glob `src/**/*.ts` and an escape [up](../../outside.md) name nothing.',
                    ].join('\n'),
                },
            ],
            files,
        );
        expect(edges.map((e) => e.target).sort()).toEqual(['README.md', 'docs/other.md', 'src/a.ts', 'src/b/c.ts']);
        expect(edges.every((e) => e.relation === 'documents' && e.source === 'docs/guide.md')).toBe(true);
    });

    it('gives every document a file node, linked or not', () => {
        const { nodes } = docsLayer([{ path: 'docs/other.md', source: 'no links' }], files);
        expect(nodes).toEqual([
            { id: 'docs/other.md', label: 'docs/other.md', kind: 'file', source_file: 'docs/other.md', source_location: [] },
        ]);
    });
});
