/**
 * Generate every project-scope host bridge into a scratch project, with the
 * project path masked so the output is comparable across machines.
 *
 * Lives outside a `*.test.ts` file so the golden-seeding script can import it
 * without vitest's globals being in scope.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import * as inst from '../../src/scripts/install.js';

export function generateProjectBridges(projectDir: string): Record<string, string> {
    inst.ensure_cursor_bridge(projectDir, false);
    inst.ensure_cline_bridge(projectDir, false);
    inst.ensure_windsurf_bridge(projectDir, false);
    inst.ensure_gemini_bridge(projectDir, false);

    const real = fs.realpathSync(projectDir);
    const mask = (s: string): string =>
        s.split(real).join('<PROJECT>').split(projectDir).join('<PROJECT>');

    const out: Record<string, string> = {};
    for (const rel of ['.cursor/hooks.json', '.windsurf/hooks.json', '.gemini/settings.json']) {
        out[rel] = mask(fs.readFileSync(path.join(projectDir, rel), 'utf8'));
    }
    const clineDir = path.join(projectDir, '.clinerules', 'hooks');
    for (const name of fs.readdirSync(clineDir).sort()) {
        out[`.clinerules/hooks/${name}`] = mask(fs.readFileSync(path.join(clineDir, name), 'utf8'));
    }
    return out;
}
