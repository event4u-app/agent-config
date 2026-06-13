#!/usr/bin/env tsx
/**
 * Skill-composition graph gate (roadmap 3.4).
 *
 * TypeScript twin of `src/scripts/check_skill_requires.py` (ADR-092,
 * Phase 4 / Wave 4c). Mirrors the Python CLI contract EXACTLY — no flags,
 * exit codes (0 clean, 1 violations), stdout, byte-identical messages
 * (including Python list-repr of sorted pack sets), same skill collection
 * (iter_artefacts SKILL.md), packs.yml closure, and sorted iteration. No
 * behaviour changes.
 *
 * Validates the `requires_skills:` skill→skill composition graph for
 * (1) referential integrity and (2) co-availability across packs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { ROOT, iter_artefacts } from './_lib/agent_src.js';
import { parse_frontmatter } from './validate_frontmatter.js';

const _HERE = fileURLToPath(import.meta.url);

function PACKS_YML(): string {
    return path.join(ROOT(), 'src', 'config', 'discovery', 'packs.yml');
}

/** Mirror Python `repr(sorted(set_of_strings))` — a list of single-quoted strings. */
function _pyList(items: readonly string[]): string {
    const sorted = items.slice().sort();
    return '[' + sorted.map((s) => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ') + ']';
}

function _load_pack_closure(): Record<string, Set<string>> {
    const raw =
        (YAML.parse(fs.readFileSync(PACKS_YML(), 'utf-8'), { version: '1.1' }) as unknown) ?? [];
    const entries = Array.isArray(raw) ? (raw as Array<Record<string, unknown>>) : [];
    const direct: Record<string, Set<string>> = {};
    for (const entry of entries) {
        const pid = entry['id'] as string;
        const reqs = (entry['requires'] ?? entry['requires_hint'] ?? []) as unknown;
        direct[pid] = new Set(Array.isArray(reqs) ? (reqs as string[]) : []);
    }

    const closure: Record<string, Set<string>> = {};

    const resolve = (pid: string, seen: Set<string>): Set<string> => {
        if (pid in closure) {
            return closure[pid]!;
        }
        const acc = new Set<string>([pid]);
        for (const dep of direct[pid] ?? new Set<string>()) {
            if (seen.has(dep)) {
                continue;
            }
            for (const x of resolve(dep, new Set([...seen, pid]))) {
                acc.add(x);
            }
        }
        closure[pid] = acc;
        return acc;
    };

    for (const pid of Object.keys(direct)) {
        resolve(pid, new Set());
    }
    return closure;
}

interface SkillInfo {
    packs: Set<string>;
    requires_skills: string[];
    path: string;
}

function _collect_skills(): Record<string, SkillInfo> {
    const skills: Record<string, SkillInfo> = {};
    for (const p of iter_artefacts('SKILL.md')) {
        const skill_id = path.basename(path.dirname(p));
        const [fm] = parse_frontmatter(fs.readFileSync(p, 'utf-8'));
        if (fm === null) {
            continue;
        }
        const packsVal = (fm as Record<string, unknown>)['packs'];
        const reqVal = (fm as Record<string, unknown>)['requires_skills'];
        skills[skill_id] = {
            packs: new Set(Array.isArray(packsVal) ? (packsVal as string[]) : []),
            requires_skills: Array.isArray(reqVal) ? (reqVal as string[]).slice() : [],
            path: path.relative(ROOT(), p).split(path.sep).join('/'),
        };
    }
    return skills;
}

// Injectable hooks for test monkeypatch parity.
const _hooks = {
    collect_skills: _collect_skills,
    load_pack_closure: _load_pack_closure,
};

function _set_hooks_for_test(overrides: Partial<typeof _hooks>): void {
    Object.assign(_hooks, overrides);
}

function main(): number {
    const closure = _hooks.load_pack_closure();
    const skills = _hooks.collect_skills();
    const errors: string[] = [];

    for (const skill_id of Object.keys(skills).sort()) {
        const info = skills[skill_id]!;
        const reqs = info.requires_skills;
        if (reqs.length === 0) {
            continue;
        }
        const parent_packs = info.packs;
        for (const req of reqs) {
            const target = skills[req];
            // (1) referential integrity
            if (target === undefined) {
                errors.push(
                    `${info.path}: requires_skills → unknown skill '${req}' ` +
                        `(no skills/${req}/SKILL.md in the suite).`,
                );
                continue;
            }
            // (2) co-availability
            const req_packs = target.packs;
            if (req_packs.size === 0) {
                continue; // always-on sub-skill reachable from anywhere
            }
            if (parent_packs.size === 0) {
                errors.push(
                    `${info.path}: always-on skill '${skill_id}' requires ` +
                        `'${req}' which is pack-gated (${_pyList([...req_packs])}); a base ` +
                        `install would ship '${skill_id}' without '${req}'.`,
                );
                continue;
            }
            for (const p of [...parent_packs].sort()) {
                const reachable = closure[p] ?? new Set<string>([p]);
                if (_intersects(req_packs, reachable)) {
                    continue;
                }
                const hint = [...req_packs].filter((x) => !reachable.has(x));
                errors.push(
                    `${info.path}: skill '${skill_id}' (pack '${p}') requires ` +
                        `'${req}' (pack ${_pyList([...req_packs])}), but '${p}' does not reach ` +
                        `it. Add requires: ${_pyList(hint)} to pack '${p}' in ` +
                        `src/config/discovery/packs.yml, or move '${req}' into a reachable pack.`,
                );
            }
        }
    }

    if (errors.length > 0) {
        process.stdout.write(
            '❌  check_skill_requires: skill-composition graph has unmet edges:\n',
        );
        for (const e of errors) {
            process.stdout.write(`  🔴 ${e}\n`);
        }
        process.stdout.write(
            '\nEvery sub-skill a parent\'s body invokes must ship wherever the ' +
                'parent ships. Declare the missing pack dependency or co-locate the skill.\n',
        );
        return 1;
    }

    const values = Object.values(skills);
    const n_edges = values.reduce((acc, i) => acc + i.requires_skills.length, 0);
    const n_skills = values.filter((i) => i.requires_skills.length > 0).length;
    process.stdout.write(
        `✅  check_skill_requires: ${n_edges} composition edge(s) across ` +
            `${n_skills} skill(s) — all sub-skills co-available.\n`,
    );
    return 0;
}

function _intersects(a: Set<string>, b: Set<string>): boolean {
    for (const x of a) {
        if (b.has(x)) {
            return true;
        }
    }
    return false;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    PACKS_YML,
    _load_pack_closure,
    _collect_skills,
    main,
    _set_hooks_for_test,
    type SkillInfo,
};
