import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createConflictTracker } from '../../src/install/conflictTracker.js';
import { INVENTORY_ENV } from '../../src/scripts/_lib/global_deploy_inventory.js';

// The would-write digest builds a temp file. A host rule directory loads every
// `.md` in it, so a temp file left there by a killed process would be loaded as
// a rule; the temp must live outside the target's directory.

let tmp: string;
let savedInventory: string | undefined;

beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'would-digest-'));
    savedInventory = process.env[INVENTORY_ENV];
});

afterEach(() => {
    if (savedInventory === undefined) delete process.env[INVENTORY_ENV];
    else process.env[INVENTORY_ENV] = savedInventory;
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('wouldWriteDigest', () => {
    it('never writes its temp file into the target directory', () => {
        const anchor = path.join(tmp, 'anchor');
        const rulesDir = path.join(anchor, 'rules');
        fs.mkdirSync(rulesDir, { recursive: true });
        const target = path.join(rulesDir, 'a.md');
        fs.writeFileSync(target, '# edited by someone\n');
        const source = path.join(tmp, 'pkg-a.md');
        fs.writeFileSync(source, '# packaged\n');

        // A schema-1 ledger lists the file with no digest, which is the
        // migration branch — the only caller of the would-write digest.
        const inventory = path.join(tmp, 'deployed-files.json');
        fs.writeFileSync(
            inventory,
            JSON.stringify({ schema_version: 1, tools: { cursor: { anchor, files: ['rules/a.md'] } } }),
        );
        process.env[INVENTORY_ENV] = inventory;

        const tagged: Array<{ tmpPath: string; siblings: string[] }> = [];
        const tracker = createConflictTracker({
            warn: () => undefined,
            fail: (msg: string): never => {
                throw new Error(msg);
            },
            logWrite: () => undefined,
            emitProgress: () => undefined,
            tagDeployed: (t: string) => {
                tagged.push({ tmpPath: t, siblings: fs.readdirSync(rulesDir) });
            },
        });
        tracker.begin(null);
        tracker.resolve(target, false, { from: source, packageRoot: null });

        expect(tagged).toHaveLength(1);
        const [call] = tagged;
        expect(path.extname(call!.tmpPath)).toBe('.md');
        expect(path.dirname(path.resolve(call!.tmpPath))).not.toBe(path.resolve(rulesDir));
        expect(call!.siblings).toEqual(['a.md']);
        expect(fs.existsSync(call!.tmpPath)).toBe(false);
    });
});
