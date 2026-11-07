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

export class DutySourceError extends Error {}

/**
 * References required by the rules whose path or file trigger matches `relPath`.
 * Throws {@link DutySourceError} when the router exists but cannot be read, so a
 * broken source is not mistaken for "no duty"; a missing router is no duty.
 */
export function dutyForPath(relPath: string, workspaceRoot: string): Duty[] {
    const sources = ruleSources(workspaceRoot);
    if (sources.router === null) return [];
    let router: Router;
    try {
        router = JSON.parse(fs.readFileSync(sources.router, 'utf8')) as Router;
    } catch (e) {
        throw new DutySourceError(`router unreadable: ${sources.router}: ${(e as Error).message}`);
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

/**
 * `read` when the ledger holds a full read of the path the reference resolves to
 * AND the file still has the size and mtime recorded at that read: a reference
 * edited since the read was not read in its current form. Credit is given at the
 * pre_tool_use of the read, before the host returns the result — a read the host
 * then refuses would still count, which this observation cannot see.
 */
export function dutyStates(
    duties: readonly Duty[],
    reads: Readonly<Record<string, unknown>>,
    workspaceRoot: string,
): Record<string, DutyState> {
    const states: Record<string, DutyState> = {};
    for (const d of duties) {
        const rec = reads[d.resolved] as { mtime?: unknown; size?: unknown } | undefined;
        let current = false;
        if (rec !== undefined) {
            try {
                const st = fs.statSync(path.join(workspaceRoot, d.resolved));
                current = rec.mtime === st.mtimeMs && rec.size === st.size;
            } catch {
                current = false;
            }
        }
        states[`${d.rule}::${d.reference}`] = current ? 'read' : 'required-pending';
    }
    return states;
}
