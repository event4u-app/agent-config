import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { main, read, valueSpecifiers } from '../../src/scripts/report_consumer_gate_reach.js';

const made: string[] = [];

function tree(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-reach-'));
    made.push(root);
    for (const [rel, body] of Object.entries(files)) {
        const abs = path.join(root, rel);
        fs.mkdirSync(path.dirname(abs), { recursive: true });
        fs.writeFileSync(abs, body);
    }
    return root;
}

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

const BASE: Record<string, string> = {
    'src/scripts/hook_manifest.yaml': 'concerns:\n  - id: x\n    script: src/scripts/hooks/concern_x.ts\n',
    'src/scripts/hooks/dispatch_entry.ts': "import { a } from '../_lib/helper_reached_by_hooks.js';\n",
    'src/scripts/hooks/concern_x.ts': "export const x = await import('../lint_reached_dynamically.js');\n",
    'src/scripts/_lib/helper_reached_by_hooks.ts': "export { run } from '../check_reached_statically.js';\n",
    'src/scripts/_cli/cmd_thing.ts': "const p = 'src/scripts/audit_reached_by_spawn.ts';\n",
    'src/scripts/check_reached_statically.ts': 'export const run = 1;\n',
    'src/scripts/lint_reached_dynamically.ts': 'export const y = 1;\n',
    'src/scripts/audit_reached_by_spawn.ts': 'export const z = 1;\n',
    'src/scripts/check_never_reached.ts': 'export const n = 1;\n',
    'src/scripts/check_type_only_target.ts': 'export type T = number;\n',
    'src/scripts/check_reached_statically.test.ts': '',
    'src/scripts/lint_some_allowlist.json': '[]',
};

describe('report_consumer_gate_reach', () => {
    it('follows static, dynamic and spawn edges and nothing else', () => {
        const root = tree({
            ...BASE,
            'src/cli/agent-config.ts': "import type { T } from '../scripts/check_type_only_target.js';\n",
        });
        const r = read(root);
        expect(r.reachable).toEqual([
            'src/scripts/audit_reached_by_spawn.ts',
            'src/scripts/check_reached_statically.ts',
            'src/scripts/lint_reached_dynamically.ts',
        ]);
        expect(r.reachable).not.toContain('src/scripts/check_never_reached.ts');
        expect(r.reachable).not.toContain('src/scripts/check_type_only_target.ts');
    });

    it('counts data files and tests in the prefix census but not as gates', () => {
        const r = read(tree(BASE));
        expect(r.prefixEntries).toBe(7);
        expect(r.gates).toHaveLength(5);
    });

    it('a commented-out import is not an edge', () => {
        expect(valueSpecifiers("// import { a } from './x.js';\n/* import './y.js' */\n")).toEqual([]);
    });

    it('exits 1 on a tree with no dispatcher rather than reporting zero', () => {
        const root = tree({ 'src/scripts/hook_manifest.yaml': 'concerns: []\n', 'src/scripts/check_a.ts': '' });
        expect(main(['--root', root])).toBe(1);
    });

    it('reads this repository without error and finds a non-empty subset', () => {
        const r = read(path.resolve(__dirname, '..', '..'));
        expect(r.reachable.length).toBeGreaterThan(0);
        expect(r.reachable.length).toBeLessThan(r.gates.length);
    });
});
