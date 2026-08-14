/**
 * Deploy-time catalogue-truncation warning
 * (road-to-skill-catalogue-budget Phase 1).
 *
 * A host can accept every file the deploy writes and then hand the model only
 * a fraction of them. The install reports success either way, so without this
 * line the truncation is invisible until a skill is missing mid-task.
 *
 * The load-bearing assertion is the SILENT one. A host whose observation log
 * carries no published dropped count has no measured truncation, and the warning
 * must not fire for it — inventing a number for an unmeasured host is exactly
 * the failure the whole instrument exists to avoid. A test that only checked
 * the firing case would pass for a warning that fires on everything.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { USER_SCOPE_PATHS, _catalogue_truncation_warnings, type DeployResult } from '../../src/scripts/install.js';

let configHome: string;
let hostRoot: string;
let prevEnv: string | undefined;
let prevAnchor: string | undefined;

/** A codex-shaped host tree: `skills/<name>/SKILL.md` plus a command set. */
function seedHostTree(skills: number, commands: number): void {
    for (let i = 0; i < skills; i += 1) {
        const dir = join(hostRoot, 'skills', `skill-${i}`);
        mkdirSync(dir, { recursive: true });
        writeFileSync(join(dir, 'SKILL.md'), `---\nname: skill-${i}\ndescription: does thing ${i}\n---\n`);
    }
    mkdirSync(join(hostRoot, 'commands'), { recursive: true });
    for (let i = 0; i < commands; i += 1) {
        writeFileSync(join(hostRoot, 'commands', `cmd-${i}.md`), '# cmd\n');
    }
}

function seedObservationLog(lines: Record<string, unknown>[]): void {
    const dir = join(configHome, 'state');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
        join(dir, 'skill-catalogue.jsonl'),
        `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`,
    );
}

const DEPLOYED: Record<string, DeployResult> = { codex: [10, 0, 'deployed', []] };

beforeEach(() => {
    configHome = mkdtempSync(join(tmpdir(), 'e4u-cat-warn-cfg-'));
    hostRoot = mkdtempSync(join(tmpdir(), 'e4u-cat-warn-host-'));
    prevEnv = process.env['EVENT4U_CONFIG_HOME'];
    process.env['EVENT4U_CONFIG_HOME'] = configHome;
    prevAnchor = USER_SCOPE_PATHS['codex'];
    USER_SCOPE_PATHS['codex'] = hostRoot;
});

afterEach(() => {
    if (prevEnv === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
    else process.env['EVENT4U_CONFIG_HOME'] = prevEnv;
    if (prevAnchor === undefined) delete USER_SCOPE_PATHS['codex'];
    else USER_SCOPE_PATHS['codex'] = prevAnchor;
    rmSync(configHome, { recursive: true, force: true });
    rmSync(hostRoot, { recursive: true, force: true });
});

describe('deploy-time catalogue-truncation warning', () => {
    it('warns for a codex-shaped host at or above its measured truncation volume', () => {
        seedHostTree(30, 20); // 50 artefacts offered
        seedObservationLog([
            {
                schema: 1,
                observed_at: '2026-08-15',
                host: 'codex',
                entries_total: 50,
                bare_count: 8,
                described_count: 0,
                bare_names: [],
                verdict: 'insufficient-observation',
                separating_candidates: [],
                truncation_mode: 'budget-strip-and-drop',
                observation_source: 'host-event',
                dropped_count: 42,
            },
        ]);

        const lines = _catalogue_truncation_warnings(DEPLOYED, null);

        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain('codex: deploying 50 catalogue artefacts');
        expect(lines[0]).toContain('dropping 42 entries');
        // A number with no way to reproduce it is noise.
        expect(lines[0]).toContain('capture_skill_catalogue --limits');
    });

    it('stays silent for a host whose observation published no dropped count', () => {
        seedHostTree(30, 20);
        seedObservationLog([
            {
                schema: 1,
                observed_at: '2026-08-12',
                host: 'codex',
                entries_total: 336,
                bare_count: 16,
                described_count: 19,
                bare_names: ['a'],
                verdict: 'no-selector',
                separating_candidates: [],
                // Self-reported, per-entry: states WHICH entries arrived bare,
                // which is a selector fact and not a truncation quantity.
            },
        ]);

        expect(_catalogue_truncation_warnings(DEPLOYED, null)).toEqual([]);
    });

    it('stays silent when nothing has been observed at all', () => {
        seedHostTree(30, 20);

        expect(_catalogue_truncation_warnings(DEPLOYED, null)).toEqual([]);
    });

    it('stays silent when the deploy is smaller than the volume that truncated', () => {
        seedHostTree(3, 1); // 4 artefacts, well under the 50 that was measured
        seedObservationLog([
            {
                schema: 1,
                observed_at: '2026-08-15',
                host: 'codex',
                entries_total: 50,
                bare_count: 8,
                described_count: 0,
                bare_names: [],
                verdict: 'insufficient-observation',
                separating_candidates: [],
                truncation_mode: 'budget-strip-and-drop',
                observation_source: 'host-event',
                dropped_count: 42,
            },
        ]);

        expect(_catalogue_truncation_warnings(DEPLOYED, null)).toEqual([]);
    });

    it('ignores a host the deploy skipped', () => {
        seedHostTree(30, 20);
        seedObservationLog([
            {
                schema: 1,
                observed_at: '2026-08-15',
                host: 'codex',
                entries_total: 50,
                bare_count: 8,
                described_count: 0,
                bare_names: [],
                verdict: 'insufficient-observation',
                separating_candidates: [],
                truncation_mode: 'budget-strip-and-drop',
                observation_source: 'host-event',
                dropped_count: 42,
            },
        ]);

        const skipped: Record<string, DeployResult> = { codex: [0, 0, 'unsupported', []] };

        expect(_catalogue_truncation_warnings(skipped, null)).toEqual([]);
    });
});
