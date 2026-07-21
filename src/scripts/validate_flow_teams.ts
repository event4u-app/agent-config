#!/usr/bin/env tsx
/**
 * Validate the optional `team:` annotation on flows (`src/flows/*.yaml`).
 *
 * A demand-probe primitive (road-to-persona-library-harvest.md Phase 3): a flow
 * MAY declare `team: { personas: [...], skills: [...] }` naming the persona/skill
 * team its work typically pulls in. This validator checks referential
 * integrity — every persona id resolves to `src/agent-src/personas/<id>.md`,
 * every skill slug to a real `skills/<slug>/SKILL.md` — so a typo is caught, but
 * it adds NO execution semantics (subagent-orchestration stays the executor) and
 * no new artifact class. If organic use grows (≥ 5 flows carrying `team:` with a
 * repeated conditional shape), THAT is the signal to design a roster schema —
 * not before.
 *
 * Exit 0 clean (incl. no flow carrying `team:`) · 1 on an unresolved reference
 * · 2 usage.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import YAML from 'yaml';

import { resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const FLOWS_DIR = path.join(ROOT, 'src', 'flows');
const PERSONAS_DIR = path.join(ROOT, 'src', 'agent-src', 'personas');
const NON_FLOW = new Set(['surface-map.yaml', 'cookbook.yaml']);

function _isFile(p: string): boolean {
    try { return fs.statSync(p).isFile(); } catch { return false; }
}
function _rel(p: string): string {
    return path.relative(ROOT, p).split(path.sep).join('/');
}
function _personaExists(id: string): boolean {
    return _isFile(path.join(PERSONAS_DIR, `${id}.md`));
}
function _skillExists(slug: string): boolean {
    return resolve_logical(`skills/${slug}/SKILL.md`) !== null;
}

interface Violation { file: string; reason: string; }

export function checkFile(abs: string): Violation[] {
    const rel = _rel(abs);
    let data: unknown;
    try {
        data = YAML.parse(fs.readFileSync(abs, 'utf-8'), { version: '1.1' });
    } catch (e) {
        return [{ file: rel, reason: `not valid YAML: ${e instanceof Error ? e.message : String(e)}` }];
    }
    if (data === null || typeof data !== 'object' || Array.isArray(data)) return [];
    const team = (data as Record<string, unknown>)['team'];
    if (team === undefined || team === null) return [];
    if (typeof team !== 'object' || Array.isArray(team)) {
        return [{ file: rel, reason: '`team` must be a mapping with optional `personas` / `skills` arrays' }];
    }
    const vios: Violation[] = [];
    const personas = (team as Record<string, unknown>)['personas'];
    for (const id of Array.isArray(personas) ? personas : []) {
        if (typeof id === 'string' && !_personaExists(id)) {
            vios.push({ file: rel, reason: `team.personas: persona '${id}' does not resolve (no src/agent-src/personas/${id}.md)` });
        }
    }
    const skills = (team as Record<string, unknown>)['skills'];
    for (const slug of Array.isArray(skills) ? skills : []) {
        if (typeof slug === 'string' && !_skillExists(slug)) {
            vios.push({ file: rel, reason: `team.skills: skill '${slug}' does not resolve (no skills/${slug}/SKILL.md)` });
        }
    }
    return vios;
}

export function main(argv?: string[]): number {
    const args = argv ?? process.argv.slice(2);
    if (args.includes('-h') || args.includes('--help')) {
        process.stdout.write('usage: validate_flow_teams [--quiet]\n');
        return 0;
    }
    const unknown = args.filter((a) => a !== '--quiet');
    if (unknown.length > 0) {
        process.stderr.write(`unrecognized argument: ${unknown[0]}\nusage: validate_flow_teams [--quiet]\n`);
        return 2;
    }
    const quiet = args.includes('--quiet');

    let files: string[];
    try {
        files = fs.readdirSync(FLOWS_DIR).filter((n) => n.endsWith('.yaml') && !NON_FLOW.has(n)).sort();
    } catch {
        process.stderr.write(`flows dir not found: ${FLOWS_DIR}\n`);
        return 0; // nothing to validate
    }

    const vios: Violation[] = [];
    let annotated = 0;
    for (const name of files) {
        const abs = path.join(FLOWS_DIR, name);
        vios.push(...checkFile(abs));
        if (/^team:/m.test(fs.readFileSync(abs, 'utf-8'))) annotated++;
    }

    if (vios.length > 0) {
        process.stderr.write(`validate_flow_teams: ${vios.length} unresolved reference(s):\n`);
        for (const v of vios) process.stderr.write(`  ${v.file}: ${v.reason}\n`);
        return 1;
    }
    if (!quiet) {
        process.stdout.write(`validate_flow_teams: OK — ${annotated} flow(s) carry a \`team:\` annotation, all references resolve.\n`);
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch { return false; }
}

if (_isCliEntry()) {
    process.exit(main());
}
