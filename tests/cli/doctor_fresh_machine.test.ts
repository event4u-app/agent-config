/**
 * road-to-docs-that-sell 4.4 / AC-6 — `doctor` before anything is installed.
 *
 * Measured before the fix, on an empty HOME and an empty project: ~80 lines,
 * a red ❌ hook-wiring check, exit 2, `agents/reports/neighbour-scan.json`
 * written into the project, and other vendors' CLIs started — which left
 * `~/.codex/tmp/` and `~/.gemini/*.tmp` behind in HOME.
 *
 * The assertion is a filesystem diff of both trees, so it catches a vendor CLI
 * that was started without having to know which one.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const TSX = resolve(ROOT, 'node_modules/.bin/tsx');
const MAIN = resolve(ROOT, 'src/cli/main.ts');

let home: string;
let project: string;
beforeEach(() => {
    home = mkdtempSync(join(tmpdir(), 'doctor-fresh-home-'));
    project = mkdtempSync(join(tmpdir(), 'doctor-fresh-project-'));
    spawnSync('git', ['init', '-q', project]);
});
afterEach(() => {
    rmSync(home, { recursive: true, force: true });
    rmSync(project, { recursive: true, force: true });
});

function snapshot(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const name of readdirSync(d)) {
            const p = join(d, name);
            const st = statSync(p);
            out.push(`${p}@${st.mtimeMs}`);
            if (st.isDirectory()) walk(p);
        }
    };
    walk(dir);
    return out.sort();
}

function doctor(args: string[] = []): { status: number | null; stdout: string; stderr: string } {
    const env: NodeJS.ProcessEnv = { ...process.env, HOME: home, AGENT_CONFIG_NO_UPDATE_CHECK: '1' };
    for (const k of ['EVENT4U_CONFIG_HOME', 'CODEX_HOME', 'CLAUDE_CONFIG_DIR', 'PROJECT_ROOT', 'AGENT_CONFIG_PROJECT_ROOT']) delete env[k];
    const res = spawnSync(TSX, [MAIN, 'doctor', ...args], { cwd: project, encoding: 'utf8', env, timeout: 60_000 });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
}

describe('doctor on a machine with no install', () => {
    it('reports one neutral state, no red check, and exits 0', () => {
        const r = doctor();
        const all = `${r.stdout}${r.stderr}`;
        expect(r.status, all).toBe(0);
        expect(all).toContain('not installed — run `agent-config init`');
        expect(all).not.toContain('❌');
        expect(all.trim().split('\n').length).toBeLessThanOrEqual(3);
    });

    it('writes nothing to HOME or the project and starts no other CLI', () => {
        const before = [snapshot(home), snapshot(project)];
        doctor();
        expect([snapshot(home), snapshot(project)]).toEqual(before);
    });

    it('keeps the machine contract: --json still reports the full no-install payload', () => {
        const r = doctor(['--json', '--check', 'scope']);
        expect(r.stdout).toContain('"checks"');
    });
});
