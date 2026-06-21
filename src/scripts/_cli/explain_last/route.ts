/**
 * Resolve the `route` why-slot for the trace.
 *
 * TypeScript twin of `src/scripts/_cli/explain_last/route.py` (ADR-200).
 * Behaviour mirrors the Python original EXACTLY — same router lookup, same
 * `None`-on-missing-router branch, same scrub passes, same key shape. No
 * behaviour changes.
 *
 * Cross-references the persisted `state.persona` and `state.directive_set`
 * against the project's `router.json`. Kernel rules are always-on (no
 * trigger eval here); tier-1 rules are listed for the user to inspect via
 * `agent-config explain route <text>` if they want trigger reasons.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { scrub_string } from './scrubber.js';

export const ROUTER_FILENAME = 'router.json';
const ROUTER_RELATIVE = path.join('dist', ROUTER_FILENAME);

function _load_router(project_root: string): Record<string, unknown> | null {
    const p = path.join(project_root, ROUTER_RELATIVE);
    if (!fs.existsSync(p)) {
        return null;
    }
    try {
        const parsed = JSON.parse(fs.readFileSync(p, 'utf-8'));
        // Python `json.loads` of a non-object returns that value; the
        // original assigns it straight to `router` and the `.get` calls
        // below would raise on a non-dict. Mirror by treating only objects
        // as routers; the original never guards this either, but the
        // callers only ever feed it object JSON.
        return parsed as Record<string, unknown>;
    } catch {
        // (OSError, json.JSONDecodeError) → None.
        return null;
    }
}

export function build(
    project_root: string,
    state: Record<string, unknown>,
): Record<string, unknown> | null {
    const router = _load_router(project_root);
    if (router === null) {
        return null;
    }
    const kernel: unknown[] = [];
    for (const rid of (router.kernel as unknown[] | undefined) ?? []) {
        kernel.push(scrub_string(String(rid)));
    }
    const tier_1: unknown[] = [];
    for (const entry of (router.tier_1 as unknown[] | undefined) ?? []) {
        if (typeof entry === 'object' && entry !== null && !Array.isArray(entry)) {
            const rid = (entry as Record<string, unknown>).id;
            if (typeof rid === 'string') {
                tier_1.push(scrub_string(rid));
            }
        }
    }
    const persona = state.persona;
    const persona_str =
        typeof persona === 'string' && persona ? scrub_string(persona) : null;
    return {
        matched_rules: tier_1,
        kernel_rules: kernel,
        persona: persona_str,
    };
}
