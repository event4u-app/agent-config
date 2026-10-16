// road-to-skills-that-arrive-when-called 2.1: on a default global install a
// skill the install did not write must still be reachable by the shell search
// path, labelled `not-installed`. The search path never touches an MCP server,
// so this is the reach a session has when the MCP tool is not registered.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { build_skills_report, render_skills_text } from '../../src/scripts/_cli/cmd_route_explain.js';
import { parse_frontmatter } from '../../src/scripts/validate_frontmatter.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const ORCHESTRATOR = path.join(REPO_ROOT, 'src', 'scripts', 'install');
const PROJECTION = path.join(REPO_ROOT, 'dist', 'agent-src', 'skills');

function skillDirs(root: string): string[] {
    return fs.readdirSync(root).filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md')));
}

describe('a default global install reaches the skills it did not write', () => {
    let home: string;
    let workspace: string;

    beforeEach(() => {
        home = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-reach-home-'));
        workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-reach-ws-'));
    });
    afterEach(() => {
        fs.rmSync(home, { recursive: true, force: true });
        fs.rmSync(workspace, { recursive: true, force: true });
    });

    it('labels an uninstalled skill not-installed and never an installed one', () => {
        const r = spawnSync('bash', [ORCHESTRATOR, '--global', '--tools=claude-code', '--yes', '--quiet'], {
            cwd: REPO_ROOT,
            encoding: 'utf8',
            timeout: 180_000,
            env: {
                ...process.env,
                HOME: home,
                EVENT4U_CONFIG_HOME: path.join(home, '.event4u', 'agent-config'),
                AGENT_CONFIG_NO_UI: '1',
                CI: '1',
            },
        });
        expect(r.status, `install failed:\n${r.stdout}\n${r.stderr}`).toBe(0);

        const hostRoot = path.join(home, '.claude', 'skills');
        const installed = new Set(skillDirs(hostRoot));
        const missing = skillDirs(PROJECTION).filter((n) => !installed.has(n)).sort();
        // The defect only exists while the default install is a subset.
        expect(missing.length, 'a default install wrote every skill').toBeGreaterThan(0);

        const target = missing[0] as string;
        const [fm] = parse_frontmatter(fs.readFileSync(path.join(PROJECTION, target, 'SKILL.md'), 'utf-8'));
        const description = String((fm as Record<string, unknown> | null)?.['description'] ?? '');
        const report = build_skills_report(`${target.replace(/-/g, ' ')} ${description}`, {
            workspaceRoot: workspace,
            packageRoot: REPO_ROOT,
            home,
            limit: 10,
        });

        expect(report.skills_roots).toEqual([hostRoot]);
        expect(report.package_fallback_used).toBe(false);
        const reached = report.not_installed.map((row) => row.skill);
        expect(reached, `${target} not reached`).toContain(target);
        for (const name of reached) expect(installed.has(name), name).toBe(false);
        expect(render_skills_text(report)).toContain(`· ${target}  [`);
        expect(render_skills_text(report)).toMatch(new RegExp(`· ${target} {2}\\[[\\d.]+\\] {2}not-installed`));
    }, 240_000);
});
