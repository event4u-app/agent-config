/**
 * The reference duty, observed at a file act: which `load_context` references
 * the rules triggered by a path require, and whether the session's read ledger
 * shows each one read whole. Observation only — it injects nothing and blocks
 * nothing; whether a gate is worth its cost is measured before one exists.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { allTierRules, ruleSources } from './rule_injection.js';
import type { Router } from './router_match.js';

export interface Duty {
    rule: string;
    /** As the rule writes it — relative to the rule file, e.g. `../contexts/x.md`. */
    reference: string;
    /** Workspace-relative path the reference resolves to, the form ledger keys take. */
    resolved: string;
}

export type DutyState = 'read' | 'required-pending';

/** A basename glob (`*` only), the shape `file_pattern` triggers use. */
export function globMatches(pattern: string, relPath: string): boolean {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(path.basename(relPath));
}

function loadContextOf(ruleFile: string): string[] {
    let text: string;
    try {
        text = fs.readFileSync(ruleFile, 'utf8');
    } catch {
        return [];
    }
    if (!text.startsWith('---')) return [];
    const end = text.indexOf('\n---', 3);
    const fm = end === -1 ? '' : text.slice(3, end);
    const block = /^load_context:\s*\n((?:[ \t]*-[^\n]*\n?)+)/m.exec(fm);
    if (block === null) return [];
    return (block[1] ?? '')
        .split('\n')
        .map((l) => l.replace(/^\s*-\s*/, '').trim().replace(/^["']|["']$/g, ''))
        .filter((l) => l !== '');
}

/** References required by the rules whose path or file trigger matches `relPath`. */
export function dutyForPath(relPath: string, workspaceRoot: string): Duty[] {
    const sources = ruleSources(workspaceRoot);
    if (sources.router === null) return [];
    let router: Router;
    try {
        router = JSON.parse(fs.readFileSync(sources.router, 'utf8')) as Router;
    } catch {
        return [];
    }
    const out: Duty[] = [];
    for (const rule of allTierRules(router)) {
        const hit = rule.triggers.some((t) => {
            const tr = t as Record<string, unknown>;
            if (typeof tr['path_prefix'] === 'string') return relPath.startsWith(tr['path_prefix']);
            if (typeof tr['file_pattern'] === 'string') return globMatches(tr['file_pattern'], relPath);
            return false;
        });
        if (!hit) continue;
        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${rule.id}.md`)));
        if (dir === undefined) continue;
        for (const reference of loadContextOf(path.join(dir, `${rule.id}.md`))) {
            const resolved = path.relative(workspaceRoot, path.resolve(dir, reference));
            out.push({ rule: rule.id, reference, resolved });
        }
    }
    return out;
}

/** `read` when the ledger holds a full read of the path the reference resolves to. */
export function dutyStates(duties: readonly Duty[], reads: Readonly<Record<string, unknown>>): Record<string, DutyState> {
    const states: Record<string, DutyState> = {};
    for (const d of duties) states[`${d.rule}::${d.reference}`] = Object.hasOwn(reads, d.resolved) ? 'read' : 'required-pending';
    return states;
}
