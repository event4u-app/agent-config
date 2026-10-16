/**
 * One detector, two callers. The package gate (`check_agent_artifact_location`)
 * and the consumer check (`doctor`'s `artifact-location` row) must both read
 * `_lib/agent_artifact_location.ts`. Replacing the detector once has to move
 * BOTH verdicts; a caller that kept a private copy would stay green here, which
 * is the drift this file exists to catch.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

const made: string[] = [];

function emptyTreeWithOneDoc(): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'artloc-two-'));
    made.push(dir);
    fs.writeFileSync(path.join(dir, 'notes.md'), '# plain notes\n');
    return dir;
}

afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
    vi.doUnmock('../../src/scripts/_lib/agent_artifact_location.js');
    vi.resetModules();
});

async function verdicts(root: string): Promise<{ gate: number; doctor: string }> {
    const gate = await import('../../src/scripts/check_agent_artifact_location.js');
    const reach = await import('../../src/scripts/_lib/install_reach_checks.js');
    const stderr = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
        return { gate: gate.main(['--root', root, '--quiet']), doctor: reach.checkArtifactLocation(root).status };
    } finally {
        stderr.mockRestore();
    }
}

describe('artifact-location detector — two callers, one implementation', () => {
    it('with the real detector both callers see a clean tree', async () => {
        vi.resetModules();
        expect(await verdicts(emptyTreeWithOneDoc())).toEqual({ gate: 0, doctor: 'ok' });
    });

    it('a changed detector changes both verdicts', async () => {
        vi.resetModules();
        vi.doMock('../../src/scripts/_lib/agent_artifact_location.js', async (importOriginal) => {
            const real = await importOriginal<typeof import('../../src/scripts/_lib/agent_artifact_location.js')>();
            return {
                ...real,
                scan: () => ({ findings: [{ rel: 'notes.md', signals: ['a planted signal'] }], scanned: 1 }),
            };
        });
        expect(await verdicts(emptyTreeWithOneDoc())).toEqual({ gate: 1, doctor: 'warn' });
    });
});
