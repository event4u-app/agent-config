// Fixture G3 of road-to-a-claim-that-is-not-a-key: four tool registrations —
// one undeclared, one write tool with a subject argument, one unknown
// framework, one clean — must yield exactly three findings, one of them
// `unknown`, and the shipped inventory template must parse without findings.
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { detect, parseInventory } from '../../src/scripts/agent_actions_detect.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const FIXTURE = path.join(REPO_ROOT, 'tests', 'fixtures', 'agent-actions', 'repo');
const SCRIPT = path.join(REPO_ROOT, 'src', 'scripts', 'agent_actions_detect.ts');
const TEMPLATE = path.join(REPO_ROOT, 'src', 'agent-src', 'templates', 'contexts', 'agent-actions.yml');
const TSX_BIN = path.join(REPO_ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'tsx.cmd' : 'tsx');

const tmpDirs: string[] = [];
function mkTmp(): string {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-actions-'));
    tmpDirs.push(d);
    return d;
}
afterEach(() => {
    for (const d of tmpDirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('agent_actions_detect — fixture G3', () => {
    const report = detect({ root: FIXTURE });

    it('recognises the three known-shape registrations and leaves the clean one without a finding', () => {
        expect(report.registrations.map((r) => r.name).sort()).toEqual(
            ['change_recovery_email', 'lookup_shipping', 'search_orders'],
        );
        const flagged = new Set(report.findings.map((f) => f.tool));
        expect(flagged.has('search_orders')).toBe(false);
    });

    it('yields exactly: one undeclared, one subject argument, one unknown', () => {
        const kinds = report.findings.map((f) => `${f.kind}:${f.tool ?? '-'}`).sort();
        expect(kinds).toEqual([
            'subject-argument:change_recovery_email',
            'undeclared:lookup_shipping',
            'unknown:-',
        ]);
    });

    it('names file and line for every finding', () => {
        for (const f of report.findings) {
            expect(f.file, f.kind).not.toBe('');
            expect(f.line, f.kind).toBeGreaterThan(0);
        }
        const subject = report.findings.find((f) => f.kind === 'subject-argument');
        expect(subject?.file).toBe('src/mcp/server.js');
        expect(subject?.detail).toContain('account');
        const unknown = report.findings.find((f) => f.kind === 'unknown');
        expect(unknown?.file).toBe('bot/actions.js');
    });
});

describe('agent_actions_detect — inventory', () => {
    it('parses the shipped template without findings', () => {
        const root = mkTmp();
        const r = detect({ root, inventoryPath: TEMPLATE });
        expect(r.inventory.length).toBeGreaterThan(0);
        expect(r.findings).toEqual([]);
    });

    it('rejects an entry with an unknown effect or a missing field', () => {
        const bad = parseInventory('version: 1\nactions:\n  - name: x\n    effect: maybe\n', 'agent-actions.yml');
        expect(bad.findings.map((f) => f.kind)).toContain('invalid-inventory');
        expect(bad.findings.some((f) => f.detail.includes('effect'))).toBe(true);
        expect(bad.findings.some((f) => f.detail.includes('verifier'))).toBe(true);
    });

    it('reports every registration undeclared when there is no inventory', () => {
        const root = mkTmp();
        fs.mkdirSync(path.join(root, 'agent'));
        fs.copyFileSync(path.join(FIXTURE, 'agent', 'tools.py'), path.join(root, 'agent', 'tools.py'));
        const r = detect({ root });
        expect(r.inventoryFound).toBe(false);
        expect(r.findings.map((f) => f.kind)).toEqual(['undeclared']);
    });

    it('a repository with no agent tooling reports nothing', () => {
        const root = mkTmp();
        fs.writeFileSync(path.join(root, 'util.ts'), 'export const add = (a: number, b: number) => a + b;\n');
        expect(detect({ root }).findings).toEqual([]);
    });
});

describe('agent_actions_detect — CLI', () => {
    it('exits 1 on the fixture and prints JSON with --json', () => {
        const r = spawnSync(TSX_BIN, [SCRIPT, '--root', FIXTURE, '--json'], { encoding: 'utf8' });
        expect(r.status).toBe(1);
        const out = JSON.parse(r.stdout) as { findings: unknown[] };
        expect(out.findings).toHaveLength(3);
    });

    it('is read-only and offline by construction', () => {
        const src = fs.readFileSync(SCRIPT, 'utf8');
        expect(src).not.toMatch(/writeFileSync|appendFileSync|mkdirSync|rmSync|fetch\(|node:https?|node:net|child_process/);
    });
});
