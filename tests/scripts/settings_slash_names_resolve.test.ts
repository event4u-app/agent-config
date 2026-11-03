// road-to-a-loss-that-can-be-appealed 0.3 — a slash name in a settings
// description is a promise to the reader that the command exists. Seven such
// promises pointed at nothing (`/do-in-parallel`, `/do-competitively`,
// `/create-pr`, `/feature-plan`, `/review-changes`, `/roadmap-create`), so the
// description is checked against the command and skill trees, not trusted.

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SETTINGS = path.join(REPO_ROOT, 'src/server/schemas/settings.ts');
/** Host commands no tree in this repo carries. */
const HOST_BUILTINS = new Set(['model']);

function commandNames(): Set<string> {
    const names = new Set<string>();
    const domains = path.join(REPO_ROOT, 'src/domains');
    const walk = (dir: string, rel: string[]): void => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
            if (!e.isDirectory()) continue;
            const next = [...rel, e.name];
            if (existsSync(path.join(dir, e.name, 'command.md'))) names.add(next.join(':'));
            walk(path.join(dir, e.name), next);
        }
    };
    for (const pack of readdirSync(domains, { withFileTypes: true })) {
        if (pack.isDirectory()) walk(path.join(domains, pack.name), []);
    }
    for (const skill of readdirSync(path.join(REPO_ROOT, 'src/skills'), { withFileTypes: true })) {
        if (skill.isDirectory()) names.add(skill.name);
    }
    return names;
}

/** Slash names quoted inside single-quoted describe() strings. */
function slashNames(source: string): string[] {
    const out = new Set<string>();
    for (const lit of source.match(/'(?:[^'\\]|\\.)*'/g) ?? []) {
        for (const m of lit.matchAll(/(?:^|[\s(`'"])\/([a-z][a-z0-9-]*(?::[a-z0-9-]+)*)/g)) {
            out.add(m[1] ?? '');
        }
    }
    return [...out].filter((n) => n !== '').sort();
}

describe('settings descriptions name only commands that exist', () => {
    it('extracts slash names, not paths', () => {
        expect(slashNames("'run /judge bracket or /pr:create; see rules/x.md'")).toEqual(['judge', 'pr:create']);
        expect(slashNames("'a path src/x/y and a url https://a.b/c'")).toEqual([]);
    });

    it('every slash name resolves to a command or skill', () => {
        const known = commandNames();
        const names = slashNames(readFileSync(SETTINGS, 'utf8'));
        expect(names.length).toBeGreaterThan(5);
        // A name that resolves only by its prefix (`/roadmap:process-` before a
        // glob) counts when some command starts with it.
        const unresolved = names.filter((n) => !known.has(n) && !HOST_BUILTINS.has(n) && ![...known].some((k) => k.startsWith(n) && n.endsWith('-')));
        expect(unresolved).toEqual([]);
    });
});
