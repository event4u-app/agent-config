/**
 * Installed Claude Code mods in the neighbour census
 * (road-to-a-mod-that-decides-nothing-new Phase 3).
 *
 * Every fixture plants a real plugin tree under a fixture home, the way the host
 * lays it out: `~/.claude/plugins/installed_plugins.json` (version 2) naming an
 * install path whose `hooks/hooks.json` carries a `modules` array.
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { main } from '../../src/scripts/_cli/cmd_doctor_neighbours.js';
import { classifyModuleSource, installedMods, renderMods } from '../../src/scripts/_lib/host_mod_census.js';

const dirs: string[] = [];

function tmp(): string {
    const d = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'mods-'));
    dirs.push(d);
    return d;
}

function write(root: string, rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}

function plantPlugin(home: string, id: string, moduleSource: string | null): string {
    const installPath = path.join(home, '.claude', 'plugins', 'cache', id, '0.1.0');
    if (moduleSource === null) {
        write(installPath, 'hooks/hooks.json', JSON.stringify({ hooks: {} }));
    } else {
        write(installPath, 'hooks/hooks.json', JSON.stringify({ modules: ['./register.ts'] }));
        write(installPath, 'hooks/register.ts', moduleSource);
    }
    return installPath;
}

function plantRegistry(home: string, entries: Record<string, string>): void {
    const plugins: Record<string, unknown[]> = {};
    for (const [id, installPath] of Object.entries(entries)) plugins[id] = [{ scope: 'user', installPath }];
    write(home, '.claude/plugins/installed_plugins.json', JSON.stringify({ version: 2, plugins }));
}

const VERDICT = "export const register = (on) => { on('tool.check', async ($, e, next) => ({ decision: 'allow' })) }";
const PROMPT = "export const register = (on) => { on('prompt.submit', ($, e, next) => next({ ...e, text: 'x' })) }";
const DISPLAY = "export const register = (on) => { on('turn.complete', async ($, e, next) => { const r = await next(e); $.ui.status('hi'); return r }) }";
const NET = "export const register = (on) => { on('turn.complete', async ($, e, next) => { await $.http.fetch('u'); return next(e) }) }";

afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

describe('classifyModuleSource', () => {
    it('names the strongest capability a module hooks or calls', () => {
        expect(classifyModuleSource(VERDICT)).toBe('verdict-capable');
        expect(classifyModuleSource(PROMPT)).toBe('prompt-capable');
        expect(classifyModuleSource(NET)).toBe('process-net');
        expect(classifyModuleSource(DISPLAY)).toBe('display-only');
    });

    it('ranks verdict above prompt above process when a module does several', () => {
        expect(classifyModuleSource(`${PROMPT}\n${VERDICT}`)).toBe('verdict-capable');
        expect(classifyModuleSource(`${NET}\n${PROMPT}`)).toBe('prompt-capable');
    });
});

describe('installedMods', () => {
    it('finds and classifies every installed plugin that ships a hooks module', () => {
        const home = tmp();
        plantRegistry(home, {
            'guard@m': plantPlugin(home, 'guard', VERDICT),
            'rewrite@m': plantPlugin(home, 'rewrite', PROMPT),
            'status@m': plantPlugin(home, 'status', DISPLAY),
            'plain@m': plantPlugin(home, 'plain', null),
        });
        const r = installedMods(home);
        expect(r.registry).toBe('read');
        expect(r.mods.map((m) => [m.id, m.capability])).toEqual([
            ['guard@m', 'verdict-capable'],
            ['rewrite@m', 'prompt-capable'],
            ['status@m', 'display-only'],
        ]);
    });

    it('reports an unreadable module instead of guessing a class', () => {
        const home = tmp();
        const p = plantPlugin(home, 'gone', DISPLAY);
        fs.rmSync(path.join(p, 'hooks', 'register.ts'));
        plantRegistry(home, { 'gone@m': p });
        expect(installedMods(home).mods).toEqual([
            expect.objectContaining({ id: 'gone@m', capability: 'unreadable' }),
        ]);
    });

    it('reports a broken registry and lists nothing', () => {
        const home = tmp();
        write(home, '.claude/plugins/installed_plugins.json', '{ not json');
        expect(installedMods(home)).toEqual({ registry: 'unreadable', mods: [] });
    });

    it('is absent on a home with no plugin registry', () => {
        expect(installedMods(tmp())).toEqual({ registry: 'absent', mods: [] });
    });
});

describe('renderMods and doctor neighbours', () => {
    it('is silent when no mod is installed', () => {
        expect(renderMods({ registry: 'absent', mods: [] })).toEqual([]);
    });

    it('prints the section, the honest limit and the opt-in command through the CLI', () => {
        const home = tmp();
        const project = tmp();
        plantRegistry(home, { 'guard@m': plantPlugin(home, 'guard', VERDICT) });
        const chunks: string[] = [];
        const orig = process.stdout.write.bind(process.stdout);
        process.stdout.write = ((s: string) => {
            chunks.push(String(s));
            return true;
        }) as typeof process.stdout.write;
        try {
            expect(main(['neighbours', '--project', project, '--home', home])).toBe(0);
        } finally {
            process.stdout.write = orig;
        }
        const text = chunks.join('');
        expect(text).toContain('claude code mods (1)');
        expect(text).toContain('guard@m  verdict-capable');
        expect(text).toContain('can override');
        expect(text).toContain('claude plugin marketplace add');
    });
});
