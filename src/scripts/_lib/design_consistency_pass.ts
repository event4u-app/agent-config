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
 *   consistency-raw-control      DELIVERED. A retroactive shadow window of
 *                                1,565 UI writes met all four flip conditions
 *                                (docs/CLAIMS.md `design-consistency-default-on`).
 *   consistency-sibling-metrics  SHADOW. The same window read no box metric on
 *                                either side of a single comparison, so it has
 *                                no distribution to derive a tolerance from.
 *
 * Every call appends one shadow row, so the window keeps recording live.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { ARTEFACT_REL, computeUiAudit, gitHead, type UiAuditArtefact } from '../../cli/commands/uiAudit.js';
import { consistencyFindings, SHADOW_REL, shadowRecord } from '../lint_design_consistency.js';

export interface ConsistencyNotice {
    line: number;
    message: string;
}

/**
 * The role map, recomputed only when HEAD moved. A single edit does not move a
 * project's canonical, and the content-digest staleness check `ui:audit` uses
 * would recompute on every write.
 */
function roles(root: string): UiAuditArtefact['control_roles'] {
    const out = path.join(root, ARTEFACT_REL);
    const head = gitHead(root);
    try {
        const a = JSON.parse(fs.readFileSync(out, 'utf8')) as Partial<UiAuditArtefact>;
        if (a.control_roles && head !== null && a.stamp?.head === head) return a.control_roles;
    } catch {
        // absent or unreadable: computed below
    }
    const fresh = computeUiAudit(root, root);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, `${JSON.stringify(fresh, null, 2)}\n`);
    return fresh.control_roles;
}

export function consistencyPass(root: string, file: string, content: string): ConsistencyNotice[] {
    const rel = path.relative(root, path.resolve(root, file)).split(path.sep).join('/');
    const map = roles(root);
    const shadow = path.join(root, SHADOW_REL);
    fs.mkdirSync(path.dirname(shadow), { recursive: true });
    // A live row is stamped with the wall clock on purpose; `asOf` would warn on every write.
    fs.appendFileSync(shadow, `${JSON.stringify(shadowRecord(content, rel, map, new Date()))}\n`);
    return consistencyFindings(content, rel, map)
        .filter((f) => f.rule === 'consistency-raw-control')
        .map((f) => ({ line: f.line, message: f.message }));
}
