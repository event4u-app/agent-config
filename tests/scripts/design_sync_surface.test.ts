// road-to-a-canvas-the-code-owns 0.1 — the tree sees the host's sync surface only
// through declared carriers.
//
// The control reading, taken at main@17f028941 with
// `git grep -l -e '\.design-sync' -e ds-bundle -e _ds_sync -e dsCard -e render-check 17f028941 -- src docs tests`,
// returned ONE file: `tests/scripts/ai_council/synthesis_check.test.ts`, whose
// "render-check" is a council synthesis check and has nothing to do with the
// host. The tree was blind to the sync surface (defect D1). That commit is not
// guaranteed to exist in a shallow CI clone, so the reading is recorded here and
// the live test asserts the census against a declared carrier list instead.
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const NAMES = /\.design-sync|ds-bundle|_ds_sync|dsCard|render-check/;
const CONTROL_UNRELATED = 'tests/scripts/ai_council/synthesis_check.test.ts';

/** Every file allowed to name a host sync artefact, and why. */
const CARRIERS: Record<string, string> = {
    [CONTROL_UNRELATED]: 'unrelated council render-check (the control reading)',
    'docs/guidelines/design-fidelity-routing.md': 'routing matrix row for .design-sync/',
    'src/rules/design-fidelity.md': 'path trigger + the mechanical leg sentence',
    'src/scripts/_lib/ui_surface.ts': 'the one handover shape list',
    'src/domains/engineering-base/design-system/command.md': 'head offers plan when .design-sync/ exists',
    'src/domains/engineering-base/design-system/sync/command.md': 'the sync command',
    'src/scripts/design_sync.ts': 'the sync CLI',
    'src/scripts/_lib/design_sync_ledger.ts': 'ledger schema',
    'src/scripts/_lib/design_sync_plan.ts': 'plan',
    'src/scripts/_lib/design_sync_verify.ts': 'render-check reader',
    'tests/scripts/design_fidelity_routing.test.ts': 'routing rows',
    'tests/scripts/ui_route_nudge_artifact_read.test.ts': 'handover predicate',
    'tests/scripts/design_sync_plan.test.ts': 'plan tests',
    'tests/scripts/design_sync_reconcile.test.ts': 'reconcile tests',
    'tests/scripts/design_sync_verify.test.ts': 'verify tests',
    'tests/scripts/sync_ledger_schema.test.ts': 'ledger schema tests',
    'tests/scripts/design_sync_surface.test.ts': 'this census',
};

function census(): string[] {
    const hits: string[] = [];
    const walk = (dir: string): void => {
        for (const name of fs.readdirSync(dir)) {
            if (name === 'node_modules' || name === 'fixtures') continue;
            const abs = path.join(dir, name);
            const st = fs.lstatSync(abs);
            if (st.isDirectory()) walk(abs);
            else if (st.isFile() && st.size < 2_000_000 && /\.(ts|md|json|ya?ml|js|mjs)$/.test(name)) {
                if (NAMES.test(fs.readFileSync(abs, 'utf-8'))) hits.push(path.relative(REPO_ROOT, abs).split(path.sep).join('/'));
            }
        }
    };
    for (const root of ['src', 'docs', 'tests']) walk(path.join(REPO_ROOT, root));
    return hits.sort();
}

describe('design sync surface', () => {
    it('control: the recorded reading names one unrelated file, and that file still is unrelated', () => {
        const text = fs.readFileSync(path.join(REPO_ROOT, CONTROL_UNRELATED), 'utf-8');
        expect(text).toMatch(/render-check/);
        expect(text).not.toMatch(/\.design-sync|ds-bundle|_ds_sync|dsCard/);
    });

    it('every file naming a host sync artefact is a declared carrier, and every carrier still names one', () => {
        const hits = census();
        expect(hits.filter((f) => !(f in CARRIERS))).toEqual([]);
        expect(Object.keys(CARRIERS).filter((f) => !hits.includes(f)).sort()).toEqual([]);
    });
});
