/**
 * Every path that can activate or broaden the tool-output store is gated by a
 * fixed rule, not by its position in the dispatcher's import closure — the first
 * of the five conditions the 2026-10-20 council round set for ratification.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import * as gate from '../../src/scripts/check_kernel_edit_ratified.js';
import { classifyPaths, closureArrivals, storeImporters } from '../../src/scripts/check_kernel_edit_ratified.js';
import { commitAll } from './ratification_git_fixture.js';

const NO_CLOSURE: readonly string[] = [];

describe('store activation paths are gated without the import closure', () => {
    it.each([
        'src/scripts/_lib/tool_output_selection.ts',
        'src/scripts/_lib/tool_output_spool.ts',
        'src/scripts/_lib/tool_output_spool_loader.ts',
        'src/scripts/_lib/content_class.ts',
        'src/scripts/_lib/egress_engine.ts',
        'src/scripts/hooks/egress_stage.ts',
        'src/scripts/hooks/egress_engine_loader.ts',
        'src/scripts/hook_chunks.mjs',
    ])('%s is plumbing even when the closure is empty', (p) => {
        expect(classifyPaths([p], NO_CLOSURE, []).plumbing).toEqual([p]);
    });

    it('a module that imports the store is gated, so a new caller cannot arrive unreviewed', () => {
        const caller = 'src/scripts/hooks/some_new_concern.ts';
        expect(classifyPaths([caller], NO_CLOSURE, []).plumbing).toEqual([]);
        expect(classifyPaths([caller], NO_CLOSURE, [caller]).plumbing).toEqual([caller]);
    });

    it('an unrelated module stays record-free', () => {
        expect(classifyPaths(['src/scripts/_lib/egress_counts.ts'], NO_CLOSURE, []).plumbing).toEqual([]);
    });
});

describe('storeImporters', () => {
    let root = '';
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'store-importers-'));
        fs.mkdirSync(path.join(root, 'src/scripts/_lib'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src/scripts/hooks'), { recursive: true });
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('finds every source importer of a store module, and nothing else', () => {
        const w = (rel: string, body: string): void => fs.writeFileSync(path.join(root, rel), body);
        w('src/scripts/hooks/a.ts', "import { spoolResult } from '../_lib/tool_output_spool_loader.js';\n");
        w('src/scripts/b.ts', "import { readHandle } from './_lib/tool_output_spool.js';\n");
        w('src/scripts/_lib/c.ts', "export { SPOOL_SELECTED_CLASSES } from './tool_output_selection.js';\n");
        w('src/scripts/_lib/d.ts', "const s = require('./tool_output_spool.js');\n");
        w('src/scripts/_lib/e.ts', "import { x } from './tool_output_spool_extra.js';\n// tool_output_spool.js named in a comment\n");
        expect(storeImporters(root)).toEqual([
            'src/scripts/_lib/c.ts',
            'src/scripts/_lib/d.ts',
            'src/scripts/b.ts',
            'src/scripts/hooks/a.ts',
        ]);
    });

    it('on this tree finds the stage door and the read path', () => {
        const found = storeImporters();
        expect(found).toContain('src/scripts/_lib/egress_engine.ts');
        expect(found).toContain('src/scripts/report_reducible_classes.ts');
    });
});

/**
 * The round-2 ask: a store under a NEW name, with its own activation source,
 * must not land unreviewed. It can run only as a dispatcher import or as a
 * concern, and both arrivals are gated without naming it anywhere.
 */
describe('an independently named replacement store cannot arrive unreviewed', () => {
    let root = '';
    beforeEach(() => {
        root = fs.mkdtempSync(path.join(os.tmpdir(), 'replacement-store-'));
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    function tree(files: Record<string, string>): void {
        for (const [rel, body] of Object.entries(files)) {
            fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
            fs.writeFileSync(path.join(root, rel), body);
        }
    }

    it('a renamed store and a settings-driven activation source reachable from the dispatcher are both gated', () => {
        tree({
            'src/scripts/hooks/dispatch_hook.ts': "import { persist } from '../_lib/result_cache.js';\nexport const run = persist;\n",
            'src/scripts/_lib/result_cache.ts':
                "import * as fs from 'node:fs';\nimport { enabledClasses } from './result_cache_policy.js';\n" +
                "export function persist(b: string): void { if (enabledClasses().size > 0) fs.writeFileSync('/tmp/x', b); }\n",
            'src/scripts/_lib/result_cache_policy.ts':
                "export function enabledClasses(): Set<string> { return new Set(String(process.env['X'] ?? '').split(',')); }\n",
        });
        const arrived = closureArrivals(root);
        expect(arrived).toContain('src/scripts/_lib/result_cache.ts');
        expect(arrived).toContain('src/scripts/_lib/result_cache_policy.ts');
        commitAll(root);
        for (const f of ['src/scripts/_lib/result_cache.ts', 'src/scripts/_lib/result_cache_policy.ts']) {
            expect(gate.evaluate([f], root, 2).exitCode, f).toBe(1);
        }
    });

    it('a replacement store shipped as a new concern needs a manifest entry, and the manifest is gated', () => {
        expect(classifyPaths(['src/scripts/hook_manifest.yaml'], [], []).plumbing).toEqual(['src/scripts/hook_manifest.yaml']);
    });
});
