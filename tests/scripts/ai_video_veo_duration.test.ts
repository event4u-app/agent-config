/**
 * Veo renders 4, 6 or 8 seconds only. A requested duration outside that grid is
 * still rendered (D3: announced, not refused), but the clamp is said on stderr
 * so a planner sees `requested 5s -> rendered 6s` instead of a clip that is
 * silently longer than the scene it was cut for.
 *
 * The helper is read out of the adapter and run on its own: sourcing the whole
 * adapter would execute its dispatcher, and the submit path is live-only.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ADAPTER = path.join(REPO_ROOT, 'src', 'scripts', 'ai-video', 'adapters', 'gemini-veo.sh');

function helperSource(): string {
    const text = fs.readFileSync(ADAPTER, 'utf8');
    const m = text.match(/^_veo_duration\(\) \{[\s\S]*?^\}$/m);
    expect(m, '_veo_duration() not found in gemini-veo.sh').not.toBeNull();
    return m![0];
}

function duration(requested: string): { stdout: string; stderr: string; status: number } {
    const script = `ADAPTER_ID=gemini-veo\n${helperSource()}\n_veo_duration "$1"`;
    const r = spawnSync('bash', ['-c', script, 'bash', requested], { encoding: 'utf-8' });
    return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status ?? -1 };
}

describe('gemini-veo duration grid', () => {
    it.each([
        ['5', '6'],
        ['3', '4'],
        ['10', '8'],
        ['7.5', '8'],
    ])('announces requested %ss -> rendered %ss on stderr', (req, out) => {
        const r = duration(req);
        expect(r.status).toBe(0);
        expect(r.stdout).toBe(out);
        expect(r.stderr).toBe(`gemini-veo: requested ${req}s -> rendered ${out}s (durationSeconds enum)\n`);
    });

    it.each(['4', '6', '8'])('stays silent on a grid value (%ss)', (req) => {
        const r = duration(req);
        expect(r.stdout).toBe(req);
        expect(r.stderr).toBe('');
    });

    it('defaults a null duration to 8s without a notice', () => {
        const r = duration('null');
        expect(r.stdout).toBe('8');
        expect(r.stderr).toBe('');
    });

    it('is what submit uses to pick durationSeconds', () => {
        expect(fs.readFileSync(ADAPTER, 'utf8')).toMatch(/dur="\$\(_veo_duration /);
    });
});
