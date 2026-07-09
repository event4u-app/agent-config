/**
 * Learning-sidecar display merge into retrieve() output
 * (road-to-retrieval-substrate-hardening B3 display-merge). The verdict is
 * attached at display time and NEVER mutates the curated YAML; absent a
 * sidecar the envelope is byte-identical.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
    _setIntakeRoot,
    _setKnowledgeRoot,
    _setMemoryRoot,
    memory_get_v1,
    retrieve_v1,
} from '../../src/scripts/memory_lookup.js';

let dir = '';
const ANCHOR = 'src/scripts/compile_router.ts';

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lmerge-'));
    fs.writeFileSync(
        path.join(dir, 'ownership.yml'),
        [
            'version: 1',
            'entries:',
            '  - id: own-router',
            `    key: ${ANCHOR}`,
            '    body: "the router compiler is owned by the platform team"',
        ].join('\n') + '\n',
    );
    _setMemoryRoot(dir);
    _setKnowledgeRoot(path.join(dir, 'knowledge-none'));
    _setIntakeRoot(path.join(dir, 'intake-none'));
});
afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
    _setMemoryRoot(dir); // reset overlay cache off the deleted dir
});

function writeSidecar(verdict: string): void {
    fs.writeFileSync(
        path.join(dir, '.agent-learning.json'),
        JSON.stringify({
            schema_version: 1,
            generated_at: '2026-07-10T00:00:00.000Z',
            lessons: [{ entry_type: 'ownership', path: ANCHOR, verdict, corroborations: 3 }],
        }) + '\n',
    );
    _setMemoryRoot(dir); // invalidate the memoised overlay so the new file loads
}

describe('no sidecar → byte-identical (no learning field)', () => {
    it('full entries carry no `learning`', () => {
        const env = retrieve_v1(['ownership'], [ANCHOR], 5);
        const e = (env['entries'] as Array<Record<string, unknown>>)[0];
        expect((e?.['body'] as Record<string, unknown>)?.['learning']).toBeUndefined();
    });
});

describe('sidecar present → verdict attached to the matching entry', () => {
    it('retrieve_v1 full body carries the learning verdict', () => {
        writeSidecar('dead_end');
        const env = retrieve_v1(['ownership'], [ANCHOR], 5);
        const e = (env['entries'] as Array<Record<string, unknown>>).find((x) => x['id'] === 'own-router');
        expect((e?.['body'] as Record<string, unknown>)['learning']).toBe('dead_end');
    });

    it('memory_get_v1 body carries the verdict', () => {
        writeSidecar('preferred');
        const env = memory_get_v1(['own-router']);
        const e = (env['entries'] as Array<Record<string, unknown>>)[0];
        expect((e?.['body'] as Record<string, unknown>)['learning']).toBe('preferred');
    });

    it('a non-matching anchor gets no verdict', () => {
        fs.writeFileSync(
            path.join(dir, '.agent-learning.json'),
            JSON.stringify({
                schema_version: 1,
                generated_at: 'x',
                lessons: [{ entry_type: 'ownership', path: 'src/other.ts', verdict: 'preferred' }],
            }) + '\n',
        );
        _setMemoryRoot(dir);
        const env = retrieve_v1(['ownership'], [ANCHOR], 5);
        const e = (env['entries'] as Array<Record<string, unknown>>)[0];
        expect((e?.['body'] as Record<string, unknown>)?.['learning']).toBeUndefined();
    });

    it('index rows carry the verdict too', () => {
        writeSidecar('contested');
        const env = retrieve_v1(['ownership'], [ANCHOR], 5, { detail: 'index' });
        const e = (env['entries'] as Array<Record<string, unknown>>).find((x) => x['id'] === 'own-router');
        expect(e?.['learning']).toBe('contested');
        expect(e?.['body']).toBeUndefined(); // still an index row
    });
});
