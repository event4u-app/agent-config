/**
 * The fork pilot — `road-to-skills-that-arrive-when-called` 3.2.
 *
 * WHAT A FORK IS FOR. A skill whose job ends in a report does not need to leave
 * its body in the conversation: it runs, it returns a result, and nothing later
 * in the task reads its prose again. The first host has a frontmatter key for
 * exactly that, and this package could not use it until 1.1 renamed the package
 * key that was squatting on it. D2 limits the pilot to `report` skills, because
 * a forked run sees no conversation — for a `standing` skill that is not a
 * saving, it is amnesia.
 *
 * WHY THE KEY IS RENDERED AND NOT AUTHORED. 1.2's lint forbids a package-owned
 * frontmatter key that collides with a host-documented one, and `context` is
 * host-documented. Writing `context: fork` into an authored SKILL.md would put
 * the package straight back into the collision it just climbed out of, and it
 * would apply to every host rather than to the one whose key it is. So the key
 * is written at projection time, for the hosts in the pilot config, and every
 * other host gets the body exactly as before.
 *
 * NOT WIRED INTO THE INSTALLER. The render exists and is tested; no install
 * calls it. 3.3 keeps widening an owner question, and 4.6 keeps the first host
 * on its full install until Phase 5 reads no harm — a pilot that silently
 * shipped to every consumer would be the widening nobody posed.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export const PILOT_CONFIG_REL = path.join('src', 'config', 'skill-fork-pilot.json');
export const OUTPUT_SHAPE_REL = path.join('src', 'config', 'skill-output-shape.json');

export interface ForkPilotConfig {
    status: string;
    max_names: number;
    names: string[];
    hosts: string[];
}

export function readForkPilot(packageRoot: string): ForkPilotConfig {
    const raw = JSON.parse(fs.readFileSync(path.join(packageRoot, PILOT_CONFIG_REL), 'utf-8')) as ForkPilotConfig;
    return {
        status: String(raw.status),
        max_names: Number(raw.max_names),
        names: Array.isArray(raw.names) ? raw.names.map(String) : [],
        hosts: Array.isArray(raw.hosts) ? raw.hosts.map(String) : [],
    };
}

export function readOutputShape(packageRoot: string): Record<string, string> {
    const raw = JSON.parse(fs.readFileSync(path.join(packageRoot, OUTPUT_SHAPE_REL), 'utf-8')) as {
        skills?: Record<string, string>;
        default?: string;
    };
    return raw.skills ?? {};
}

/** The runtime reader `skill-output-shape.json` did not have: a name it does not carry is `standing`. */
export function outputShapeOf(shape: Record<string, string>, name: string): 'report' | 'standing' {
    return shape[name] === 'report' ? 'report' : 'standing';
}

/**
 * Write the host's `context: fork` into a projected SKILL.md.
 *
 * Idempotent, and it never touches a `context:` the document already carries —
 * a value already there was put there by somebody, and overwriting it is the
 * silent host-key rewrite 1.3's snapshot exists to catch.
 */
export function renderForkContext(md: string): string {
    // The closing fence is a whole `---` line: `----` or `--- x` inside the
    // frontmatter must not end it early.
    const m = /^---\r?\n([\s\S]*?)(\r?\n)---(?=\r?\n|$)/.exec(md);
    if (m === null) return md;
    const body = m[1]!;
    if (/^context:[ \t]/m.test(body)) return md;
    const nl = m[2]!;
    return md.slice(0, m.index) + `---${nl}${body}${nl}context: fork${nl}---` + md.slice(m.index + m[0].length);
}

/** Does this projection carry the host's fork key? */
export function hasForkContext(md: string): boolean {
    const m = /^---\r?\n([\s\S]*?)\r?\n---(?=\r?\n|$)/.exec(md);
    return m !== null && /^context:[ \t]*fork[ \t]*$/m.test(m[1]!);
}

export interface PilotProblem {
    name: string;
    message: string;
}

/**
 * Everything that would make the pilot illegal, as data rather than as a throw.
 *
 * Checked by the test rather than at runtime: the config is committed, so a
 * violation is a repository defect that should fail CI, not a condition a
 * consumer's install has to handle.
 */
export function pilotProblems(cfg: ForkPilotConfig, shape: Record<string, string>): PilotProblem[] {
    const out: PilotProblem[] = [];
    // A missing cap reads as NaN, and `n > NaN` is false: no cap is a problem, not a pass.
    if (!Number.isInteger(cfg.max_names) || cfg.max_names < 0) {
        out.push({ name: '(set)', message: `max_names is not a non-negative integer (${String(cfg.max_names)})` });
    } else if (cfg.names.length > cfg.max_names) {
        out.push({ name: '(set)', message: `${cfg.names.length} names exceeds max_names ${cfg.max_names}` });
    }
    if (new Set(cfg.names).size !== cfg.names.length) {
        out.push({ name: '(set)', message: 'duplicate name' });
    }
    for (const n of cfg.names) {
        if (outputShapeOf(shape, n) !== 'report') {
            out.push({ name: n, message: 'not classified `report` — D2 allows only report skills to fork' });
        }
    }
    for (const h of cfg.hosts) {
        // `context` is the first host's documented key. Rendering it for a host
        // that does not document it would be writing a key with no meaning into
        // somebody else's file.
        if (h !== 'claude-code') out.push({ name: h, message: 'host does not document a `context` key' });
    }
    return out;
}
