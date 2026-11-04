/**
 * The consistency check as the `design-pass` hook runs it on a UI write —
 * road-to-a-control-that-matches-its-neighbours 3.8.
 *
 * Shipped as a conditional chunk (`hook_chunks.mjs`) and loaded only for a UI
 * write, because the dispatch bundle every hook event parses has no room for
 * `ui:audit` and the role parser (D11).
 *
 * Two postures in one call, per `docs/contracts/concern-activation-policy.md`:
 *
 *   consistency-raw-control      RETURNED. A retroactive shadow window of
 *                                1,565 UI writes met conditions 1, 2 and 4; the
 *                                benefit of condition 3 is an estimate
 *                                (docs/CLAIMS.md `design-consistency-default-on`),
 *                                so the caller delivers it only with `shadow: false`.
 *   consistency-sibling-metrics  SHADOW. The same window read no box metric on
 *                                either side of a single comparison, so it has
 *                                no distribution to derive a tolerance from.
 *
 * Every call appends one shadow row, so the window keeps recording live.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ARTEFACT_REL, computeUiAudit, gitHead, type UiAuditArtefact } from '../../cli/commands/uiAudit.js';
import { consistencyFindings, SHADOW_REL, shadowRecord } from './design_consistency_rules.js';
import { definedComponents, roleOfTag } from './control_roles.js';
import { isUiPath } from './ui_surface.js';

export interface ConsistencyNotice {
    line: number;
    message: string;
}

const CACHE_REL = path.join('agents', 'runtime', 'state', 'design-consistency-roles.json');

/**
 * Every uncommitted UI file, with the control-role components it defines (an
 * empty list included). Adding, removing or renaming a project primitive, and
 * a file becoming dirty or clean, change it without moving HEAD. Null outside
 * a git work tree.
 */
export function dirtyPrimitives(root: string): string[] | null {
    let status: string;
    try {
        status = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all'], {
            cwd: root,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore'],
            // Runs on every UI write: a stalled process costs the answer, never the hook event.
            timeout: 3000,
        });
    } catch {
        return null;
    }
    const out: string[] = [];
    const entries = status.split('\0');
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]!;
        // A rename or copy is followed by its source path, which carries no status.
        if (/^[RC]/.test(entry)) i++;
        const rel = entry.slice(3);
        if (entry.length < 4 || !isUiPath(rel)) continue;
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, rel), 'utf8');
        } catch {
            out.push(`${rel}:removed`);
            continue;
        }
        // Every dirty UI file enters, with an empty list too: a file that lost
        // its last primitive must change the stamp as much as one that gained one.
        out.push(`${rel}:${primitiveDefs(rel, text).join(',')}`);
    }
    return out.sort();
}

function primitiveDefs(rel: string, text: string): string[] {
    return definedComponents(rel, text)
        .filter((t) => roleOfTag(t, '') !== null)
        .sort();
}

/**
 * The cache key: HEAD plus the dirty files that define a primitive now or did
 * when the map was last computed. A dirty file that never defined one cannot
 * change which component a role resolves to except through usage drift, so it
 * does not force a recompute.
 */
function stampOf(head: string | null, dirty: string[] | null, primitiveFiles: ReadonlySet<string>): string | null {
    if (head === null || dirty === null) return null;
    const kept = dirty.filter((e) => {
        const i = e.lastIndexOf(':');
        const defs = e.slice(i + 1);
        return (defs !== '' && defs !== 'removed') || primitiveFiles.has(e.slice(0, i));
    });
    return `${head}|${kept.join(';')}`;
}

/**
 * The role map, recomputed when HEAD moves or a dirty file gains, loses or
 * changes a primitive. Not on every write: the content digest `ui:audit` uses
 * would recompute on each one. The accepted bound is usage drift in
 * uncommitted files — uses of an existing component that would shift which
 * implementation is most used — which waits for the next stamp change.
 */
function roles(root: string, head: string | null): UiAuditArtefact['control_roles'] {
    const cache = path.join(root, CACHE_REL);
    const dirty = dirtyPrimitives(root);
    try {
        const c = JSON.parse(fs.readFileSync(cache, 'utf8')) as {
            stamp?: string;
            primitive_files?: string[];
            control_roles?: UiAuditArtefact['control_roles'];
        };
        const stamp = stampOf(head, dirty, new Set(c.primitive_files ?? []));
        // A map written before `families` existed would silence every finding.
        const current = c.control_roles && Object.values(c.control_roles).every((e) => !e || e.canonical === null || e.families);
        if (stamp !== null && c.stamp === stamp && current && c.control_roles) return c.control_roles;
    } catch {
        // absent or unreadable: computed below
    }
    let primitiveFiles: string[] = [];
    const fresh = computeUiAudit(root, root, (pairs) => {
        primitiveFiles = pairs.filter(([rel, text]) => isUiPath(rel) && primitiveDefs(rel, text).length > 0).map(([rel]) => rel);
    });
    const stamp = stampOf(head, dirty, new Set(primitiveFiles));
    fs.mkdirSync(path.dirname(cache), { recursive: true });
    fs.writeFileSync(path.join(root, ARTEFACT_REL), `${JSON.stringify(fresh, null, 2)}\n`);
    fs.writeFileSync(cache, `${JSON.stringify({ stamp, primitive_files: primitiveFiles, control_roles: fresh.control_roles })}\n`);
    return fresh.control_roles;
}

export function consistencyPass(root: string, file: string, content: string): ConsistencyNotice[] {
    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
    const head = gitHead(root);
    const map = roles(root, head);
    const shadow = path.join(root, SHADOW_REL);
    fs.mkdirSync(path.dirname(shadow), { recursive: true });
    // A live row is stamped with the wall clock on purpose; `asOf` would warn on every write.
    const row = { ...shadowRecord(content, rel, map, new Date()), head };
    fs.appendFileSync(shadow, `${JSON.stringify(row)}\n`);
    return consistencyFindings(content, rel, map)
        .filter((f) => f.rule === 'consistency-raw-control')
        .map((f) => ({ line: f.line, message: f.message }));
}
