// Ownership on a GLOBAL-ONLY install, END TO END — step 1.2 of
// `road-to-a-thinned-layer-measured-in-one-unit`.
//
// SEPARATED FROM THE UNIT CASES ON PURPOSE. This runs the real bash
// orchestrator in a subprocess, so it costs minutes rather than milliseconds.
// It lived in `tests/scripts/` beside the unit cases for the step, where it
// added that cost to every unit run with nothing marking it as different;
// `tests/install/global_install_hooks_smoke.test.ts` is the existing precedent
// for this shape and this is where it belongs.
//
// What it establishes that the unit cases cannot: that the ownership resolver,
// the installer and the inventory the installer writes agree on a REAL install
// rather than on a staged directory — package-owned equals the number of rule
// files the installer actually wrote, by the explicit path and by the default,
// with the receipt printing the same ownership sentence.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import {
    buildInstalledLayerReport,
    ownershipLine,
} from '../../src/scripts/_lib/installed_layer.js';
import { installReceiptBudgetLines } from '../../src/install/installThinLayer.js';
import { GLOBAL_RULE_DIRS } from '../../src/install/globalRuleLayers.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const CLAUDE_RULES_REL = GLOBAL_RULE_DIRS['claude-code'] as string;

const made: string[] = [];

function mkTmp(prefix: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
    made.push(dir);
    return dir;
}

afterEach(() => {
    while (made.length > 0) {
        const dir = made.pop() as string;
        fs.rmSync(dir, { recursive: true, force: true });
    }
});

describe('ownership resolution — a real first install into an empty HOME', () => {
    it(
        'reports package-owned equal to the rule files the installer wrote, and the receipt agrees',
        { timeout: 600_000 },
        () => {
            const home = mkTmp('ilo-real-home-');
            const r = spawnSync(
                'bash',
                [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes'],
                {
                    cwd: REPO_ROOT,
                    encoding: 'utf8',
                    timeout: 540_000,
                    env: {
                        ...process.env,
                        HOME: home,
                        EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                        AGENT_CONFIG_NO_UI: '1',
                        CI: '1',
                    },
                },
            );
            expect(r.status, `install failed:\n${r.stdout ?? ''}\n${r.stderr ?? ''}`).toBe(0);

            const rulesDir = path.join(home, CLAUDE_RULES_REL);
            const written = fs
                .readdirSync(rulesDir)
                .filter((n) => n.endsWith('.md'))
                .length;
            expect(written, 'the installer wrote no rule files').toBeGreaterThan(0);

            // THE INSTALL IS GLOBAL-ONLY, so there is no project manifest —
            // which is the whole case. The inventory the install just wrote is
            // the evidence, and it is read from the HOME the install used.
            const inventoryPath = path.join(
                home,
                '.event4u',
                'agent-config',
                'deployed-files.json',
            );
            expect(fs.existsSync(inventoryPath), 'the global install wrote no inventory').toBe(
                true,
            );

            const report = buildInstalledLayerReport({
                home,
                projectRoot: mkTmp('ilo-real-proj-'),
                manifestPath: null,
                inventoryPath,
            });
            expect(report.ownership_source).toBe('global-inventory');
            const claude = report.layers.filter(
                (l) => l.host === 'claude-code' && l.scope === 'global' && l.present,
            );
            const owned = claude.reduce((n, l) => n + l.package_owned, 0);
            expect(owned).toBe(written);

            // The receipt, run the way the installer runs it, resolves the same
            // ownership — the step's "the receipt prints the same".
            // `manifestPath: null` is what makes this case hermetic. The
            // receipt otherwise reads `manifest_path(REPO_ROOT)`, a gitignored
            // lock absent in CI and present on any checkout where a
            // project-scoped install has run — so without it this 540-second
            // case is green in CI and red on a maintainer's machine for a
            // reason that has nothing to do with the behaviour under test.
            const receipt = installReceiptBudgetLines(REPO_ROOT, home, {
                inventoryPath,
                manifestPath: null,
            }).join('\n');
            expect(receipt).toContain(ownershipLine('global-inventory'));
            const ownedChars = claude.reduce((n, l) => n + l.package_owned_chars, 0);
            expect(receipt).toContain(`${String(ownedChars)} package-owned`);

            // AND WITH NO PATH SUPPLIED AT ALL — the production shape. The
            // default follows the home being measured, not the home of the
            // process asking, so a report about a staged install must not pick
            // up the inventory of whatever install the runner itself is under.
            const byDefault = buildInstalledLayerReport({
                home,
                projectRoot: mkTmp('ilo-real-proj2-'),
                manifestPath: null,
            });
            expect(byDefault.ownership_source).toBe('global-inventory');
            expect(
                byDefault.layers
                    .filter((l) => l.host === 'claude-code' && l.scope === 'global' && l.present)
                    .reduce((n, l) => n + l.package_owned, 0),
            ).toBe(written);
        },
    );
});
