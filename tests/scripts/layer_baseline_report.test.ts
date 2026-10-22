import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { buildBaseline, parseArgs, readHookCommands, readRuleLayer, renderBaseline } from '../../src/scripts/layer_baseline_report.js';
import { THIN_ENTRY_MARKER } from '../../src/scripts/_lib/thin_rules.js';

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), '..', '..', '..');
const made: string[] = [];

afterEach(() => {
    while (made.length > 0) fs.rmSync(made.pop() as string, { recursive: true, force: true });
});

function mkTmp(): string {
    const dir = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'layer-baseline-test-')));
    made.push(dir);
    return dir;
}

describe('layer_baseline_report', () => {
    it('two runs at one commit are byte-equal, and every layer row names that commit', () => {
        const first = renderBaseline(buildBaseline(REPO_ROOT, ['claude-code']));
        const second = renderBaseline(buildBaseline(REPO_ROOT, ['claude-code']));
        expect(second).toBe(first);

        const commit = /Measured at commit `([0-9a-f]{9}|unknown)`/.exec(first)?.[1];
        expect(commit).toMatch(/^[0-9a-f]{9}$/);
        expect(first).toContain('Every row below names that commit.');
        expect(first).toContain('| claude-code | installed | `<HOME>/.claude/rules` |');
        expect(first).not.toContain(os.tmpdir());
    }, 300_000);

    it('a pointer stub is counted as a stub, a body as full', () => {
        const dir = mkTmp();
        fs.writeFileSync(path.join(dir, 'a.md'), '# A\n\nA full body.\n');
        fs.writeFileSync(path.join(dir, 'b.md'), `# B\n\n${THIN_ENTRY_MARKER}\n\nBody: /x/b.md\n`);
        const layer = readRuleLayer('claude-code', 'installed', dir, '<HOME>/.claude/rules');
        expect(layer.files.map((f) => [f.name, f.form])).toEqual([
            ['a.md', 'full'],
            ['b.md', 'stub'],
        ]);
        expect([layer.full, layer.stub]).toEqual([1, 1]);
    });

    it('an absent layer is reported absent, never as an empty one', () => {
        const layer = readRuleLayer('cline', 'installed', path.join(mkTmp(), 'missing'), '<HOME>/Documents/Cline/Rules');
        expect(layer.present).toBe(false);
        expect(layer.files).toEqual([]);
    });

    it('hook commands carry <HOME>, never the scratch path', () => {
        const home = mkTmp();
        fs.mkdirSync(path.join(home, '.claude'));
        fs.writeFileSync(
            path.join(home, '.claude', 'settings.json'),
            JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: `node ${home}/x.js` }] }] } }),
        );
        expect(readHookCommands(home)).toEqual(['Stop: node <HOME>/x.js']);
    });

    it('hook commands carry <PACKAGE_ROOT>, never the measured checkout path', () => {
        const home = mkTmp();
        const pkg = mkTmp();
        fs.mkdirSync(path.join(home, '.claude'));
        fs.writeFileSync(
            path.join(home, '.claude', 'settings.json'),
            JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: `node ${pkg}/dist/hooks/dispatch.js` }] }] } }),
        );
        expect(readHookCommands(home, pkg)).toEqual(['Stop: node <PACKAGE_ROOT>/dist/hooks/dispatch.js']);
    });

    it('rejects an unknown host', () => {
        expect(parseArgs(['--hosts', 'no-such-host'])).toBeNull();
        expect(parseArgs(['--hosts', 'cursor'])?.hosts).toEqual(['cursor']);
    });
});
