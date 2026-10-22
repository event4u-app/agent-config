/**
 * Test fixture: record skills as deployed for one tool in the deploy inventory
 * under the test's EVENT4U_CONFIG_HOME, the way the installer's ledger does,
 * with the anchor tilde-relative as the real inventory stores it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { inventory_path, load_inventory, record_deploy, save_inventory } from '../../src/scripts/_lib/global_deploy_inventory.js';

export function recordDeployedSkills(home: string, toolId: string, anchorRaw: string, names: readonly string[]): void {
    void home;
    const target = inventory_path();
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const inv = load_inventory(target);
    record_deploy(toolId, anchorRaw, new Set(names.map((n) => `skills/${n}/SKILL.md`)), inv);
    save_inventory(inv, target);
}
