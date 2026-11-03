/**
 * The I/O half of `residentPriorityOrder`: reads the two inputs from a rules
 * directory and a skills directory, so the order itself stays pure and testable.
 *
 * Tolerant by design — a missing directory, an unreadable file or malformed
 * frontmatter contributes nothing; a report must not die on one bad file.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import * as yaml from 'js-yaml';

export const PRIORITY_PACK = 'engineering-base';

export interface ResidentPriorityInputs {
    /** Skill name → number of rules whose `routes_to:` names it. */
    routesTo: Map<string, number>;
    /** Skills whose frontmatter `packs:` lists `engineering-base`. */
    packMembers: Set<string>;
}

function frontmatter(file: string): Record<string, unknown> {
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf8');
    } catch {
        return {};
    }
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(raw);
    if (!m) return {};
    try {
        const parsed = yaml.load(m[1]!);
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : {};
    } catch {
        return {};
    }
}

function listDir(dir: string): string[] {
    try {
        return fs.readdirSync(dir).sort();
    } catch {
        return [];
    }
}

export function loadResidentPriorityInputs(rulesDir: string, skillsDir: string): ResidentPriorityInputs {
    const routesTo = new Map<string, number>();
    for (const f of listDir(rulesDir)) {
        if (!f.endsWith('.md')) continue;
        const targets = frontmatter(path.join(rulesDir, f)).routes_to;
        if (!Array.isArray(targets)) continue;
        const named = new Set<string>();
        for (const t of targets) {
            if (typeof t === 'string' && t.startsWith('skill:')) named.add(t.slice('skill:'.length).trim());
        }
        for (const n of named) if (n) routesTo.set(n, (routesTo.get(n) ?? 0) + 1);
    }
    const packMembers = new Set<string>();
    for (const slug of listDir(skillsDir)) {
        const packs = frontmatter(path.join(skillsDir, slug, 'SKILL.md')).packs;
        if (Array.isArray(packs) && packs.includes(PRIORITY_PACK)) packMembers.add(slug);
    }
    return { routesTo, packMembers };
}
