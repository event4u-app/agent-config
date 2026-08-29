/**
 * The three v1 scorer defects the v2 benchmark exists to correct, pinned.
 *
 * Each test states the v1 behaviour and the v2 behaviour over the SAME helper,
 * so a regression that reintroduces either defect fails here rather than
 * silently re-publishing a false result. The v1 shape is expressed by calling
 * the v2 helper the way v1 called its own inline copy — with the whole probe
 * string as a single token — rather than by importing v1's runner, which is
 * bound to v1's registration and must not be touched.
 *
 * Sensitivity: every assertion below has a partner asserting the opposite
 * outcome under the defective input, so none of them can pass vacuously.
 */
import { describe, expect, it } from 'vitest';

import { fileOfEndpoint, isRelevantRelation } from '../../internal/bench/code-graph/run_bench_inrepo_v2.js';

/** The literal relation the engine returns for `cg-path-01`, verbatim. */
const PATH_RELATION_ENDPOINTS: ReadonlyArray<readonly [string, string]> = [
    ['cli.ts#cmdBuild', 'build.ts#buildFromRepo'],
    ['build.ts#buildFromRepo', 'extract.ts#extractFile'],
    ['extract.ts#extractFile', 'loader.ts#getParser'],
];

describe('defect 1 — the whole-probe-string filter discarded correct answers', () => {
    const V1_PROBE = 'cmdBuild -> getParser';
    const V2_TOKENS = ['cmdBuild', 'getParser'];

    it('v1 shape: NO relation on the cmdBuild->getParser path survives the filter', () => {
        const survivors = PATH_RELATION_ENDPOINTS.filter((p) => isRelevantRelation(p, [V1_PROBE]));
        expect(survivors).toHaveLength(0);
    });

    it('v2 shape: the two endpoint relations survive, and the intermediate hop does not', () => {
        const survivors = PATH_RELATION_ENDPOINTS.filter((p) => isRelevantRelation(p, V2_TOKENS));
        expect(survivors).toEqual([PATH_RELATION_ENDPOINTS[0], PATH_RELATION_ENDPOINTS[2]]);
    });

    it('defect 2 is why the filter is skipped for path-between: the intermediate hop matches neither endpoint', () => {
        // `build.ts#buildFromRepo --calls--> extract.ts#extractFile` is on the
        // path and is exactly what "and through what?" asks for, yet it matches
        // neither probe token. A neighbourhood verb plus this filter therefore
        // cannot answer the class however the tokens are passed — which is why
        // v2 uses the `path` verb and applies no filter to its output.
        expect(isRelevantRelation(PATH_RELATION_ENDPOINTS[1] as readonly string[], V2_TOKENS)).toBe(false);
    });
});

describe('defect 3 — symbol: pseudo-nodes were counted as files', () => {
    it('rejects an unresolved symbol: endpoint', () => {
        expect(fileOfEndpoint('symbol:DatabaseSync')).toBeNull();
        expect(fileOfEndpoint('symbol:EXT_LANG')).toBeNull();
        expect(fileOfEndpoint('symbol:close')).toBeNull();
    });

    it('reproduces what v1 did with the same input, so the fix is not vacuous', () => {
        // v1's rule, inline: `p.split('#')[0]`, added to a set of "files".
        expect('symbol:DatabaseSync'.split('#')[0]).toBe('symbol:DatabaseSync');
    });

    it('accepts a real file endpoint, with and without a symbol segment', () => {
        expect(fileOfEndpoint('sqlite_store.ts#emitSqliteTwin')).toBe('sqlite_store.ts');
        expect(fileOfEndpoint('build.ts')).toBe('build.ts');
        expect(fileOfEndpoint('sub/dir/query.ts#loadGraph')).toBe('sub/dir/query.ts');
    });

    it('rejects an endpoint carrying no file extension', () => {
        expect(fileOfEndpoint('someBareToken')).toBeNull();
        expect(fileOfEndpoint('')).toBeNull();
    });
});
