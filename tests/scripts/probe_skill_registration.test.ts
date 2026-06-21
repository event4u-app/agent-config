// Tests for src/scripts/probe_skill_registration.ts (py2ts Phase 8 / Wave 8c).
//
// 1:1 port of tests/test_probe_skill_registration.py — synthetic fixtures
// stand in for the six tool surfaces so each duplicate / drift shape is
// exercised in isolation. Plus a golden-parity layer that runs python3 vs
// tsx on the REAL repo across the two CI arg shapes (default + --format=json
// + --strict) — byte-exact stdout/stderr/exit is the contract. Skipped
// without python3.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import { run_probe } from '../../src/scripts/probe_skill_registration.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const TS_SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'probe_skill_registration.ts');
const TSX_BIN = path.join(
    REPO_ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'tsx.cmd' : 'tsx',
);


const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'probe-reg-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    while (tmpDirs.length) {
        const d = tmpDirs.pop()!;
        try {
            fs.rmSync(d, { recursive: true, force: true });
        } catch {
            /* ignore */
        }
    }
});

type Fmt = 'skill_md' | 'mdc' | 'md' | 'single';

function writeSkill(root: string, toolDir: string, skillId: string, description: string, fmt: Fmt = 'skill_md'): void {
    let p: string;
    if (fmt === 'skill_md') {
        p = path.join(root, toolDir, skillId, 'SKILL.md');
    } else if (fmt === 'mdc') {
        p = path.join(root, toolDir, `${skillId}.mdc`);
    } else if (fmt === 'md') {
        p = path.join(root, toolDir, `${skillId}.md`);
    } else {
        p = path.join(root, toolDir, 'copilot-instructions.md');
    }
    fs.mkdirSync(path.dirname(p), { recursive: true });
    const fm = '---\n' + `name: ${skillId}\n` + `description: "${description}"\n` + '---\n# body\n';
    fs.writeFileSync(p, fm, 'utf-8');
}

function writePkgJson(root: string, version: string): void {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ version }), 'utf-8');
}

describe('probe_skill_registration — differential (run_probe)', () => {
    it('no findings when only one scope', () => {
        const tmp = mkTmp();
        const project = path.join(tmp, 'project');
        fs.mkdirSync(project);
        writePkgJson(project, '3.3.0');
        writeSkill(project, '.claude/skills', 'alpha', 'First skill');
        const result = run_probe({ home: path.join(tmp, 'empty-home'), project });
        expect(result.registrations.length).toBe(1);
        expect(result.duplicates.size).toBe(0);
        expect(result.drift.size).toBe(0);
    });

    it('same skill in both scopes flags DUPLICATE (not DRIFT)', () => {
        const tmp = mkTmp();
        const home = path.join(tmp, 'home');
        const project = path.join(tmp, 'project');
        fs.mkdirSync(home);
        fs.mkdirSync(project);
        writePkgJson(home, '3.3.0');
        writePkgJson(project, '3.3.0');
        writeSkill(home, '.claude/skills', 'alpha', 'Same description');
        writeSkill(project, '.claude/skills', 'alpha', 'Same description');
        const result = run_probe({ home, project });
        expect(result.duplicates.has('claude:alpha')).toBe(true);
        expect(result.drift.has('claude:alpha')).toBe(false);
    });

    it('same skill different descriptions flags DRIFT', () => {
        const tmp = mkTmp();
        const home = path.join(tmp, 'home');
        const project = path.join(tmp, 'project');
        fs.mkdirSync(home);
        fs.mkdirSync(project);
        writePkgJson(home, '3.3.0');
        writePkgJson(project, '3.3.0');
        writeSkill(home, '.claude/skills', 'copilot-config', 'Stale description from older install');
        writeSkill(project, '.claude/skills', 'copilot-config', 'Fresh description from current install');
        const result = run_probe({ home, project });
        expect(result.duplicates.has('claude:copilot-config')).toBe(true);
        expect(result.drift.has('claude:copilot-config')).toBe(true);
    });

    it('same skill different versions flags DRIFT', () => {
        const tmp = mkTmp();
        const home = path.join(tmp, 'home');
        const project = path.join(tmp, 'project');
        fs.mkdirSync(home);
        fs.mkdirSync(project);
        writePkgJson(home, '2.9.0');
        writePkgJson(project, '3.3.0');
        writeSkill(home, '.claude/skills', 'alpha', 'Same description');
        writeSkill(project, '.claude/skills', 'alpha', 'Same description');
        const result = run_probe({ home, project });
        expect(result.drift.has('claude:alpha')).toBe(true);
    });

    it('plugin manifest is a separate source', () => {
        const tmp = mkTmp();
        const project = path.join(tmp, 'project');
        fs.mkdirSync(project);
        writePkgJson(project, '3.3.0');
        writeSkill(project, '.claude/skills', 'alpha', 'From filesystem');
        const manifest = path.join(project, '.claude-plugin', 'marketplace.json');
        fs.mkdirSync(path.dirname(manifest), { recursive: true });
        fs.writeFileSync(
            manifest,
            JSON.stringify({ plugins: [{ name: 'agent-config', skills: ['./.claude/skills/alpha'] }] }),
            'utf-8',
        );
        const result = run_probe({ home: path.join(tmp, 'empty-home'), project });
        expect(result.duplicates.has('claude:alpha')).toBe(true);
    });

    it('cursor / cline / windsurf / copilot readers each emit a row', () => {
        const tmp = mkTmp();
        const project = path.join(tmp, 'project');
        fs.mkdirSync(project);
        writePkgJson(project, '3.3.0');
        writeSkill(project, '.cursor/rules', 'rule-one', 'Cursor rule', 'mdc');
        writeSkill(project, '.clinerules', 'rule-two', 'Cline rule', 'md');
        writeSkill(project, '.windsurf/rules', 'rule-three', 'Windsurf rule', 'md');
        writeSkill(project, '.github', 'copilot-instructions', 'n/a', 'single');
        const result = run_probe({ home: path.join(tmp, 'empty-home'), project });
        const tools = new Set(result.registrations.map((r) => r.tool));
        for (const t of ['cursor', 'cline', 'windsurf', 'copilot']) {
            expect(tools.has(t)).toBe(true);
        }
    });

    it('CLI --strict exits non-zero on findings (tsx)', () => {
        const tmp = mkTmp();
        const home = path.join(tmp, 'home');
        const project = path.join(tmp, 'project');
        fs.mkdirSync(home);
        fs.mkdirSync(project);
        writePkgJson(home, '3.3.0');
        writePkgJson(project, '3.3.0');
        writeSkill(home, '.claude/skills', 'alpha', 'Stale');
        writeSkill(project, '.claude/skills', 'alpha', 'Fresh');
        const r = spawnSync(
            TSX_BIN,
            [TS_SCRIPT, '--strict', '--home', home, '--project', project, '--format=json'],
            { encoding: 'utf8' },
        );
        expect(r.status).toBe(2);
    });

    it('CLI default exits zero even with findings (tsx)', () => {
        const tmp = mkTmp();
        const home = path.join(tmp, 'home');
        const project = path.join(tmp, 'project');
        fs.mkdirSync(home);
        fs.mkdirSync(project);
        writePkgJson(home, '3.3.0');
        writePkgJson(project, '3.3.0');
        writeSkill(home, '.claude/skills', 'alpha', 'Stale');
        writeSkill(project, '.claude/skills', 'alpha', 'Fresh');
        const r = spawnSync(TSX_BIN, [TS_SCRIPT, '--home', home, '--project', project], { encoding: 'utf8' });
        expect(r.status).toBe(0);
        expect(r.stdout).toContain('DRIFT');
    });
});
