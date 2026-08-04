/**
 * check_host_loadability.ts — U4 real-host loadability smoke
 * (road-to-ecosystem-harvest-reliability-measurement).
 *
 * The condensation-hash + linter gates prove the SOURCE tree's shape; this
 * check proves the GENERATED host trees are actually loadable by their hosts:
 *   - .claude/skills/<dir>/SKILL.md — frontmatter parses, has name +
 *     description, and name matches the directory (Claude Code's load rule).
 *   - .cursor/rules/*.mdc — frontmatter parses (Cursor rejects the file
 *     silently otherwise).
 * Run AFTER the projection is generated (CI: the sync-consistency job).
 * Exit 1 on the first malformed artefact, naming it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

/** @returns how many skill directories were examined. */
export function check_claude_skills(root: string, errors: string[]): number {
    const dir = path.join(root, '.claude', 'skills');
    if (!fs.existsSync(dir)) return 0;
    const names = fs.readdirSync(dir);
    for (const name of names) {
        const skillMd = path.join(dir, name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
            errors.push(`${skillMd}: missing SKILL.md`);
            continue;
        }
        const src = fs.readFileSync(skillMd, 'utf-8');
        const m = src.match(/^---\n([\s\S]*?)\n---/);
        if (!m) { errors.push(`${skillMd}: no frontmatter`); continue; }
        let meta: Record<string, unknown>;
        try { meta = parseYaml(m[1] ?? '') as Record<string, unknown>; }
        catch (e) { errors.push(`${skillMd}: frontmatter YAML invalid (${(e as Error).message})`); continue; }
        if (typeof meta['name'] !== 'string' || !meta['name']) errors.push(`${skillMd}: missing name`);
        else if (meta['name'] !== name) errors.push(`${skillMd}: name '${meta['name']}' != dir '${name}'`);
        if (typeof meta['description'] !== 'string' || !meta['description']) errors.push(`${skillMd}: missing description`);
    }
    return names.length;
}

/** @returns how many `.mdc` rule files were examined. */
export function check_cursor_rules(root: string, errors: string[]): number {
    const dir = path.join(root, '.cursor', 'rules');
    if (!fs.existsSync(dir)) return 0;
    let scanned = 0;
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.mdc')) continue;
        scanned += 1;
        const p = path.join(dir, name);
        const src = fs.readFileSync(p, 'utf-8');
        const m = src.match(/^---\n([\s\S]*?)\n---/);
        if (!m) { errors.push(`${p}: no frontmatter`); continue; }
        // Cursor's documented .mdc format writes `globs: *.php` UNQUOTED —
        // valid for Cursor's parser, invalid strict YAML (`*` starts an
        // alias). Quote the globs value before the strict parse so the check
        // mirrors the host's acceptance, not the YAML spec's.
        const lenient = (m[1] ?? '').replace(
            /^(globs:[ \t]*)([^"'\s[][^\n]*)$/m,
            (_all, key: string, val: string) => `${key}"${val.trim()}"`,
        );
        try { parseYaml(lenient); }
        catch (e) { errors.push(`${p}: frontmatter YAML invalid (${(e as Error).message})`); }
    }
    return scanned;
}

export function run(root: string): string[] {
    const errors: string[] = [];
    // Both host trees are generated and gitignored, and each checker returns
    // early when its tree is absent — so "no malformed artefacts" and "no
    // artefacts" are the same green. Thrown, not returned: `errors` names
    // malformed files, and an unprojected tree is not one.
    const scanned = check_claude_skills(root, errors) + check_cursor_rules(root, errors);
    assertScanned({
        gate: 'check_host_loadability',
        scanned,
        units: 'host artefact(s)',
        roots: ['.claude/skills', '.cursor/rules'],
    });
    return errors;
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    const rootIdx = process.argv.indexOf('--root');
    const root = rootIdx !== -1 ? process.argv[rootIdx + 1] ?? '.' : '.';
    let errors: string[];
    try {
        errors = run(root);
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        // Exit 1 is this gate's only failure code.
        process.stderr.write(`❌  ${exc.message}\n`);
        process.exit(1);
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  ${e}\n`);
        process.exit(1);
    }
    process.stdout.write('✅  host trees loadable (.claude skills + .cursor mdc)\n');
    process.exit(0);
}
