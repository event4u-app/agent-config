/**
 * J.7a — one `scan` verb for the skills' backstop sweeps: `file:line:rule-id`.
 * Secret-shaped strings are assembled at runtime, never written literally.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SCAN_RULES, scanMain, scanText, selectRules } from '../../src/scripts/code_graph/scan.js';
import { Repo } from './_bugs/repo.js';

const all = SCAN_RULES;

describe('scanText', () => {
    it('reports file:line:rule-id for each pack', () => {
        const src = ['el.innerHTML = html;', 'const q = "SELECT * FROM t WHERE id=" + id;', "it.skip('x', () => {});", 'try { a() } catch (e) {}'].join('\n');
        expect(scanText('src/a.ts', src, all).map((h) => `${h.line}:${h.rule}`)).toEqual(['1:render-sink', '2:string-built-sql', '3:test-skip', '4:swallowed-error']);
    });

    it('honours file scopes and unless-patterns', () => {
        const key = `AKIA${'A'.repeat(16)}`;
        expect(scanText('.mcp.json', `{"key": "${key}"}`, all).map((h) => h.rule)).toEqual(expect.arrayContaining(['config-raw-secret']));
        expect(scanText('src/x.ts', `{"key": "${key}"}`, all).map((h) => h.rule)).not.toContain('config-raw-secret');
        expect(scanText('a.svg', '<svg onload="x()">', all).map((h) => h.rule)).toEqual(['svg-active-content']);
        expect(scanText('a.tsx', '<a target="_blank" rel="noopener">', all)).toEqual([]);
        expect(scanText('r.php', "'file' => 'mimes:png|extensions:png'", all)).toEqual([]);
    });

    it('selects by pack or by id', () => {
        expect(selectRules('tests', []).map((r) => r.id)).toEqual(['test-skip']);
        expect(selectRules(null, ['render-sink']).map((r) => r.id)).toEqual(['render-sink']);
        expect(new Set(SCAN_RULES.map((r) => r.id)).size).toBe(SCAN_RULES.length);
    });
});

describe('scanMain', () => {
    let repo: Repo;
    let out: string[];
    beforeEach(() => {
        repo = new Repo();
        out = [];
        vi.spyOn(process.stdout, 'write').mockImplementation((s) => (out.push(String(s)), true));
    });
    afterEach(() => {
        vi.restoreAllMocks();
        repo.cleanup();
    });

    it('scans tracked files only', () => {
        repo.write('src/a.ts', 'x.innerHTML = y;\n');
        repo.write('.gitignore', 'dist/\n');
        repo.write('dist/b.js', 'x.innerHTML = y;\n');
        repo.commit('feat: a');
        expect(scanMain(['--pack', 'frontend', '--root', repo.dir])).toBe(0);
        expect(out.join('')).toBe('src/a.ts:1:render-sink\n');
    });

    it('lists the rules and refuses an unknown one', () => {
        repo.commit('chore: empty');
        expect(scanMain(['--list', '--pack', 'tests', '--root', repo.dir])).toBe(0);
        expect(out.join('')).toMatch(/^test-skip\ttests\t/);
        vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
        expect(scanMain(['--rule', 'nope', '--root', repo.dir])).toBe(2);
    });
});
