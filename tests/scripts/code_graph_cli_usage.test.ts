import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { cliVerbs } from '../../src/scripts/code_graph/map_area_payloads.js';

describe('code-graph usage', () => {
    it('names every verb the CLI routes, the systems, provenance and branch verbs among them', () => {
        let err = '';
        try {
            execFileSync(path.resolve('node_modules/.bin/tsx'), [path.resolve('src/scripts/code_graph/cli.ts'), 'no-such-verb'], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'pipe'] });
        } catch (e) {
            err = (e as { stderr?: string }).stderr ?? '';
        }
        const listed = /<([a-z|-]+)>/.exec(err)?.[1]?.split('|') ?? [];
        for (const v of ['why', 'usage', 'remove-plan', 'provenance', 'branches', 'branch-diff', 'on-branches']) expect(listed).toContain(v);
        const routed = [...cliVerbs(path.resolve('src/scripts/code_graph'))];
        expect(routed.filter((v) => !listed.includes(v))).toEqual([]);
    }, 60_000);
});
