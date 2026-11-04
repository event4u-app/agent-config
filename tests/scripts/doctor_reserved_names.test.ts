import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { checkReservedNameShadows, scanReservedNameShadows } from '../../src/scripts/_cli/doctor_reserved_names.js';
import * as inv from '../../src/scripts/_lib/global_deploy_inventory.js';

let tmp: string;
let home: string;
let project: string;
let inventoryFile: string;

function writeSkill(root: string, name: string, body = `---\nname: ${name}\n---\n`): void {
    fs.mkdirSync(path.join(root, name), { recursive: true });
    fs.writeFileSync(path.join(root, name, 'SKILL.md'), body, 'utf-8');
}

function snapshot(dir: string): string[] {
    const out: string[] = [];
    const walk = (d: string): void => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const f = path.join(d, e.name);
            out.push(`${path.relative(tmp, f)}:${e.isDirectory() ? 'd' : fs.readFileSync(f, 'utf-8')}`);
            if (e.isDirectory()) walk(f);
        }
    };
    walk(dir);
    return out.sort();
}

beforeEach(() => {
    tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'reserved-names-')));
    home = path.join(tmp, 'home');
    project = path.join(tmp, 'project');
    inventoryFile = path.join(tmp, 'deployed-files.json');
    const userSkills = path.join(home, '.claude', 'skills');
    writeSkill(userSkills, 'mcp'); // recorded by the package -> ours
    writeSkill(userSkills, 'mcp-tool-use'); // not reserved
    writeSkill(path.join(project, '.claude', 'skills'), 'code-review', 'my own review skill'); // foreign
    const data: inv.Inventory = { schema_version: 2, tools: {} };
    inv.record_deploy('claude-code', path.join(home, '.claude'), new Set(['skills/mcp/SKILL.md', 'skills/mcp-tool-use/SKILL.md']), data);
    inv.save_inventory(data, inventoryFile);
});

afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true });
});

describe('doctor_reserved_names', () => {
    it('lists every reserved directory in both scopes and tells ours from foreign', () => {
        const rows = scanReservedNameShadows({
            roots: [
                { scope: 'user', dir: path.join(home, '.claude', 'skills') },
                { scope: 'project', dir: path.join(project, '.claude', 'skills') },
            ],
            inventory: inv.load_inventory(inventoryFile),
            home,
        });
        expect(rows.map((r) => [r.scope, r.name, r.owner])).toEqual([
            ['user', 'mcp', 'ours'],
            ['project', 'code-review', 'foreign'],
        ]);
        expect(rows[0]?.fix).toContain('agent-config');
        expect(rows[1]?.fix).toContain('rename');
    });

    it('reports a warn naming each shadow and its fix, and writes nothing', () => {
        const before = snapshot(tmp);
        const check = checkReservedNameShadows({
            projectRoot: project,
            env: { HOME: home, AGENT_CONFIG_DEPLOY_INVENTORY: inventoryFile },
        });
        expect(check.id).toBe('reserved-name-shadows');
        expect(check.status).toBe('warn');
        expect(check.message).toContain('/mcp');
        expect(check.message).toContain('ours');
        expect(check.message).toContain('/code-review');
        expect(check.message).toContain('foreign');
        expect(snapshot(tmp)).toEqual(before);
    });

    it('is ok when no reserved directory exists', () => {
        fs.rmSync(path.join(home, '.claude', 'skills', 'mcp'), { recursive: true });
        fs.rmSync(path.join(project, '.claude', 'skills', 'code-review'), { recursive: true });
        const check = checkReservedNameShadows({
            projectRoot: project,
            env: { HOME: home, AGENT_CONFIG_DEPLOY_INVENTORY: inventoryFile },
        });
        expect(check.status).toBe('ok');
    });

    it('skips cleanly when neither skills directory exists', () => {
        const check = checkReservedNameShadows({
            projectRoot: path.join(tmp, 'nowhere'),
            env: { HOME: path.join(tmp, 'nohome'), AGENT_CONFIG_DEPLOY_INVENTORY: inventoryFile },
        });
        expect(check.status).toBe('ok');
    });
});
