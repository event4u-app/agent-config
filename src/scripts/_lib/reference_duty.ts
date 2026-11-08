/**
 * The reference duty, observed at a file act: which `load_context` references
 * the rules triggered by a path require, and whether the session's read ledger
 * shows each one read whole. Observation only — it injects nothing and blocks
 * nothing; whether a gate is worth its cost is measured before one exists.
 *
 * Every rule the act matches yields its duties or a {@link DutySourceError}; a
 * source that cannot be read is never reported as "no duty".
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import actReferences from '../../config/act-references.json';
import { ledgerKey } from './ledger_key.js';
import { ruleSources } from './rule_injection.js';
import { commandRunsAct } from './shell_acts.js';
import { trigger_matches, type Trigger } from './router_match.js';

export interface Duty {
    rule: string;
    /** As the rule writes it — relative to the rule file, e.g. `../contexts/x.md`. */
    reference: string;
    /** The reference's {@link ledgerKey} — the form read-ledger keys take. */
    resolved: string;
}

export type DutyState = 'read' | 'required-pending';

export class DutySourceError extends Error {}

/** The loader checks this before using the chunk; bump it when the exports change. */
export const REFERENCE_DUTY_SCHEMA = 1;

export { ledgerKey };

function loadContextOf(ruleFile: string): string[] {
    let text: string;
    try {
        text = fs.readFileSync(ruleFile, 'utf8');
    } catch (e) {
        throw new DutySourceError(`rule unreadable: ${ruleFile}: ${(e as Error).message}`);
    }
    if (!/^---[ \t]*\r?\n/.test(text)) return [];
    const close = /\r?\n---[ \t]*(?:\r?\n|$)/.exec(text.slice(3));
    if (close === null) throw new DutySourceError(`rule frontmatter unterminated: ${ruleFile}`);
    let fm: unknown;
    try {
        fm = parseYaml(text.slice(3, 3 + close.index));
    } catch (e) {
        throw new DutySourceError(`rule frontmatter unparsable: ${ruleFile}: ${(e as Error).message}`);
    }
    if (fm === null || fm === undefined) return [];
    if (typeof fm !== 'object' || Array.isArray(fm)) throw new DutySourceError(`rule frontmatter is not a mapping: ${ruleFile}`);
    const lc = (fm as Record<string, unknown>)['load_context'];
    if (lc === undefined || lc === null) return [];
    if (!Array.isArray(lc) || !lc.every((x) => typeof x === 'string')) {
        throw new DutySourceError(`rule load_context is not a list of paths: ${ruleFile}`);
    }
    return lc as string[];
}

/** The router's tier rules, or a source error when the shape is not the router's. */
function tierRules(router: unknown, file: string): Array<{ id: string; triggers: Trigger[] }> {
    if (typeof router !== 'object' || router === null || Array.isArray(router)) throw new DutySourceError(`router is not an object: ${file}`);
    const out: Array<{ id: string; triggers: Trigger[] }> = [];
    for (const tier of ['tier_1', 'tier_2']) {
        const list = (router as Record<string, unknown>)[tier];
        if (list === undefined) continue;
        if (!Array.isArray(list)) throw new DutySourceError(`router ${tier} is not a list: ${file}`);
        for (const r of list) {
            if (typeof r !== 'object' || r === null || Array.isArray(r)) throw new DutySourceError(`router ${tier} entry is not an object: ${file}`);
            const e = r as Record<string, unknown>;
            const triggers = e['triggers'];
            if (typeof e['id'] !== 'string' || !Array.isArray(triggers)) {
                throw new DutySourceError(`router ${tier} entry without id and trigger list: ${file}`);
            }
            if (!triggers.every((t) => typeof t === 'object' && t !== null && !Array.isArray(t))) {
                throw new DutySourceError(`router ${tier} entry ${e['id']} has a trigger that is not an object: ${file}`);
            }
            out.push({ id: e['id'], triggers: triggers as Trigger[] });
        }
    }
    return out;
}

export interface DutyScan {
    duties: Duty[];
    /** One message per matched rule whose duties could not be read. */
    errors: string[];
}

/**
 * References required by the rules whose path or file trigger matches `relPath`,
 * matched by the router's own `trigger_matches`. A broken matched rule costs only
 * its own duties and is listed in `errors`; an unusable router is one error; a
 * missing router is no duty.
 */
export function scanDuties(relPath: string, workspaceRoot: string): DutyScan {
    const sources = ruleSources(workspaceRoot);
    if (sources.router === null) return { duties: [], errors: [] };
    let rules: Array<{ id: string; triggers: Trigger[] }>;
    try {
        rules = tierRules(JSON.parse(fs.readFileSync(sources.router, 'utf8')), sources.router);
    } catch (e) {
        return { duties: [], errors: [`router unusable: ${sources.router}: ${(e as Error).message}`] };
    }
    const duties: Duty[] = [];
    const errors: string[] = [];
    for (const rule of rules) {
        const hit = rule.triggers.some((t) => ('path_prefix' in t || 'file_pattern' in t) && trigger_matches(t, '', [relPath]));
        if (!hit) continue;
        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${rule.id}.md`)));
        try {
            if (dir === undefined) throw new DutySourceError(`matched rule has no file: ${rule.id}`);
            for (const reference of loadContextOf(path.join(dir, `${rule.id}.md`))) {
                duties.push({ rule: rule.id, reference, resolved: ledgerKey(workspaceRoot, path.resolve(dir, reference)) });
            }
        } catch (e) {
            errors.push((e as Error).message);
        }
    }
    return { duties, errors };
}

/**
 * `read` when the ledger holds a full read of the path the reference resolves to
 * AND the file still has the size and mtime recorded at that read: a reference
 * edited since the read was not read in its current form. Metadata equality, not
 * content identity; and credit is given at the read's pre_tool_use, before the
 * host returns the result, so a read the host then refuses would still count.
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
                const st = fs.statSync(path.isAbsolute(d.resolved) ? d.resolved : path.join(workspaceRoot, d.resolved));
                current = rec.mtime === st.mtimeMs && rec.size === st.size;
            } catch {
                current = false;
            }
        }
        states[`${d.rule}::${d.reference}`] = current ? 'read' : 'required-pending';
    }
    return states;
}

/** One act-time binding: a shell command and the rules whose references it makes due. */
export interface ActBinding {
    shell_command: string;
    rules: string[];
}

/**
 * References due when `command` runs a bound shell act (`src/config/act-references.json`).
 * The table names rule ids only; each reference comes from the rule's own
 * `load_context`. A bound rule that cannot be read is listed in `errors`.
 */
export function scanActDuties(
    command: string,
    workspaceRoot: string,
    bindings: readonly ActBinding[] = actReferences.bindings,
): DutyScan {
    const rules = new Set<string>();
    for (const b of bindings) if (commandRunsAct(command, b.shell_command)) for (const r of b.rules) rules.add(r);
    if (rules.size === 0) return { duties: [], errors: [] };
    const sources = ruleSources(workspaceRoot);
    const duties: Duty[] = [];
    const errors: string[] = [];
    for (const id of rules) {
        const dir = sources.dirs.find((d) => fs.existsSync(path.join(d, `${id}.md`)));
        try {
            if (dir === undefined) throw new DutySourceError(`bound rule has no file: ${id}`);
            for (const reference of loadContextOf(path.join(dir, `${id}.md`))) {
                duties.push({ rule: id, reference, resolved: ledgerKey(workspaceRoot, path.resolve(dir, reference)) });
            }
        } catch (e) {
            errors.push((e as Error).message);
        }
    }
    return { duties, errors };
}
