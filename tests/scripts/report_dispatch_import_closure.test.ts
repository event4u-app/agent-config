// The dispatcher's import closure — what the ratification gate derives part of
// its watched set from. Pinned: the walk follows relative imports transitively,
// stops at the concern table, and classes a module as `verdict` both when it
// names an exit-code constant and when it only exports a refusal-deciding
// policy. Against the real tree, the two modules the release finding named
// (the crashed-concern policy and the stdin-failure policy) read as `verdict`.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import {
    classifySource,
    dispatchImportClosure,
    relativeSpecifiers,
    verdictModules,
} from '../../src/scripts/_lib/dispatch_import_closure.js';
import { render } from '../../src/scripts/report_dispatch_import_closure.js';

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function fixture(files: Record<string, string>): string {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'dispatch-closure-'));
    for (const [rel, body] of Object.entries(files)) {
        fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
        fs.writeFileSync(path.join(root, rel), body);
    }
    return root;
}

describe('relativeSpecifiers', () => {
    it('reads import-from, export-from and side-effect imports, skips packages and comments', () => {
        const src = [
            "import { a } from './a.js';",
            "import type { B } from '../b.js';",
            "export { c } from './c.js';",
            "import './side.js';",
            "import fs from 'node:fs';",
            "// import { gone } from './gone.js';",
        ].join('\n');
        expect(relativeSpecifiers(src)).toEqual(['./a.js', '../b.js', './c.js', './side.js']);
    });
});

describe('classifySource', () => {
    it('an exit-code constant is a verdict', () => {
        expect(classifySource('return EXIT_BLOCK;')).toBe('verdict');
    });
    it('a refusal-named export without a constant is a verdict', () => {
        expect(classifySource('export function denyOnFailure(): boolean { return true; }')).toBe('verdict');
    });
    it('a payload reader is payload, anything else is neither', () => {
        expect(classifySource('export function read(payload: unknown) {}')).toBe('payload');
        expect(classifySource('export function fingerprint(s: string) {}')).toBe('neither');
    });
});

describe('dispatchImportClosure on a fixture tree', () => {
    const root = fixture({
        'src/scripts/hooks/dispatch_hook.ts':
            "import { p } from './policy.js';\nimport { R } from './concern_registry.js';",
        'src/scripts/hooks/policy.ts': "import { EXIT_BLOCK } from './exit_codes.js';\nexport const p = EXIT_BLOCK;",
        'src/scripts/hooks/exit_codes.ts': 'export const EXIT_BLOCK = 2;',
        'src/scripts/hooks/concern_registry.ts': "import { main } from './some_concern.js';\nexport const R = { payload: main };",
        'src/scripts/hooks/some_concern.ts': "import { EXIT_BLOCK } from './exit_codes.js';\nimport { x } from './deep.js';",
        'src/scripts/hooks/deep.ts': 'export const x = EXIT_WARN;',
    });

    it('walks transitively, stops at the concern table, never lists the dispatcher', () => {
        const byPath = Object.fromEntries(dispatchImportClosure(root).map((e) => [e.path, e.class]));
        expect(byPath).toEqual({
            'src/scripts/hooks/concern_registry.ts': 'payload',
            'src/scripts/hooks/exit_codes.ts': 'verdict',
            'src/scripts/hooks/policy.ts': 'verdict',
            'src/scripts/hooks/some_concern.ts': 'concern',
        });
    });

    it('a tree without a dispatcher has an empty closure', () => {
        expect(dispatchImportClosure(fixture({ 'x.ts': '' }))).toEqual([]);
    });
});

describe('the real tree', () => {
    const verdict = verdictModules(REPO);

    it('reads the crashed-concern and stdin-failure policies as verdict-deciding', () => {
        expect(verdict).toContain('src/scripts/hooks/concern_failure_policy.ts');
        expect(verdict).toContain('src/scripts/hooks/stdin_failure_policy.ts');
        expect(verdict).toContain('src/scripts/hooks/exit_codes.ts');
    });

    it('keeps concerns and pure payload helpers out of the verdict class', () => {
        expect(verdict).not.toContain('src/scripts/hooks/py_json_dumps.ts');
        expect(verdict).not.toContain('src/scripts/hooks/fallback_yaml.ts');
        expect(verdict.some((p) => /_hook\.ts$/.test(p))).toBe(false);
    });

    it('renders a totals line naming every class', () => {
        const out = render(dispatchImportClosure(REPO), false);
        expect(out.at(-1)).toMatch(/^totals: verdict \d+ · payload \d+ · neither \d+ · concern \d+$/);
    });
});
