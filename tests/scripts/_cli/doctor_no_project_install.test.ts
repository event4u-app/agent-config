// `doctor` warned "no project lockfile and no consumer install marker" from any
// project without a project-scope install — including every fresh worktree on a
// machine with a working global install, which is the healthy, default shape
// under ADR-020. It now reports which scopes it checked and what each holds.

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { globalInstalledTools, noProjectInstallLines } from '../../../src/scripts/_cli/doctor_ownership_ledger.js';

let tmp: string;
let inventory: string;

function ledger(tools: Record<string, string[]>): void {
    mkdirSync(path.dirname(inventory), { recursive: true });
    writeFileSync(
        inventory,
        JSON.stringify({
            schema_version: 2,
            tools: Object.fromEntries(Object.entries(tools).map(([id, files]) => [id, { anchor: `~/.${id}/`, files }])),
        }),
    );
}

beforeEach(() => {
    tmp = mkdtempSync(path.join(tmpdir(), 'doctor-scope-'));
    inventory = path.join(tmp, 'machine', 'deployed-files.json');
});
afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
});

describe('doctor on a project with no project-scope install', () => {
    it('a global install present is reported as such, on stdout, not as a warning', () => {
        ledger({ 'claude-code': ['skills/a/SKILL.md'] });
        const lines = noProjectInstallLines('/some/worktree', inventory);
        expect(lines.every(([stream]) => stream === 'out')).toBe(true);
        const text = lines.map(([, l]) => l).join('\n');
        expect(text).toContain('global install present (claude-code)');
        expect(text).toContain('expected for a global-only consumer');
        expect(text).not.toContain('⚠️');
    });

    it('names every scope it checked, so the reader knows what "not found" covered', () => {
        ledger({ 'claude-code': ['skills/a/SKILL.md'] });
        const text = noProjectInstallLines('/w', inventory).map(([, l]) => l).join('\n');
        expect(text).toMatch(/global deploy ledger.*project lockfile.*project install marker/);
    });

    it('nothing installed anywhere is still a warning, and says both scopes were empty', () => {
        const lines = noProjectInstallLines('/some/worktree', inventory);
        expect(lines.every(([stream]) => stream === 'err')).toBe(true);
        expect(lines.map(([, l]) => l).join('\n')).toMatch(/not globally.*and not at \/some\/worktree/);
    });

    it('a ledger entry with no files is not a global install', () => {
        ledger({ 'claude-code': [] });
        expect(globalInstalledTools(inventory)).toEqual([]);
        expect(noProjectInstallLines('/w', inventory)[0]?.[0]).toBe('err');
    });
});
