/**
 * Where the PROJECT tree's rule-layer form comes from, now that no settings key
 * carries it.
 *
 * WHY THIS EXISTS. ADR-292 removed `lean_projection.*`, and the shipped
 * settings template was the last layer of the cascade `resolveLeanProjection`
 * read — so the project tree on the first host got its `delivery` from a key
 * that no longer exists. Removing the key with nothing in its place would have
 * flipped that tree to the full form: a default change for a tree whose form
 * ADR-267 decided ON EVIDENCE (616/616 byte-equal deliveries, 101/101 labelled
 * rules reachable, 0 of 212 near-misses fired on the frozen routing-matrix
 * corpus), with nothing measured against it. That is not a "no worse" move, and
 * it would also leave Phase 5 with no live arm to compare.
 *
 * WHY IT IS NOT THE KEY UNDER ANOTHER NAME. `src/config/project-tree-form.json`
 * is package-owned and ships in the repository: there is no consumer-writable
 * layer, no cascade, and no merge. `modeExplicit` stays false for it, exactly as
 * it did for the template, so nothing here is read as a consumer's consent. And
 * it carries its own replacement condition rather than a value alone — a row
 * without the measurement that justifies it is REFUSED, so the file cannot
 * become a place to write a form someone merely wants.
 *
 * PRECEDENCE, WHICH IS THE WHOLE SAFETY ARGUMENT. A valid OBSERVED verdict from
 * the layer-form decision function supersedes this record for that host, in both
 * directions — an observed `full` wins over a record saying `delivery`. The
 * record stands only while that function can answer nothing but
 * `delivery-unobserved`, which is its state today for every host. Without that
 * rule this file would be a permanent bypass of the decision function rather
 * than a stand-in for it, which is the one risk the reviewing seat named.
 *
 * WHY ONE SEAT WAS ENOUGH TO BUILD ON, AND NOT ENOUGH TO CLOSE. The choice was
 * reviewed at a degraded quorum, so step 3.6 stays open and its blocker carries
 * the confirmation. Acting on it meanwhile is bounded by what the option does:
 * it changes no behaviour at all — it reproduces what the shipped template
 * produced — and every alternative did. The record lives with the roadmap.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { DEFAULT_LEAN_PROJECTION_MODE, type LeanProjectionMode } from './lean_projection_mode.js';

export const PROJECT_TREE_FORM_REL = path.join('src', 'config', 'project-tree-form.json');

/** One host's shipped form, with the evidence that justifies it. */
export interface ProjectTreeForm {
    readonly form: LeanProjectionMode;
    readonly basis: string;
}

/** The shape this module needs from a decision verdict; the full type lives in `layer_form_decision.ts`. */
export interface FormVerdict {
    readonly form: 'full' | 'thinned';
    readonly reason: string;
}

const FORMS: readonly string[] = ['eager-all', 'thin', 'delivery'];

/**
 * The reason that means "the function could not look", as opposed to a verdict
 * it actually reached. Only this one yields to the shipped record.
 */
export const UNOBSERVED_REASON = 'delivery-unobserved';

function isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Every host row the record carries. A row without a `measured` block, or with
 * a form the projector does not have, is dropped: this file records measured
 * forms, and a row that records neither is not evidence.
 */
export function readProjectTreeForms(packageRoot: string): Map<string, ProjectTreeForm> {
    const out = new Map<string, ProjectTreeForm>();
    let raw: unknown;
    try {
        raw = JSON.parse(fs.readFileSync(path.join(packageRoot, PROJECT_TREE_FORM_REL), 'utf8'));
    } catch {
        return out; // absent or unreadable: every host gets the full form
    }
    if (!isRecord(raw) || !isRecord(raw['hosts'])) return out;
    for (const [host, row] of Object.entries(raw['hosts'])) {
        if (!isRecord(row)) continue;
        const form = row['form'];
        if (typeof form !== 'string' || !FORMS.includes(form)) continue;
        if (!isRecord(row['measured'])) continue;
        out.set(host, { form: form as LeanProjectionMode, basis: typeof row['basis'] === 'string' ? row['basis'] : 'unrecorded' });
    }
    return out;
}

/**
 * The form the project tree is built with for `host`.
 *
 * `verdict` is the layer-form decision for this host where one exists. An
 * observed verdict — anything whose reason is not {@link UNOBSERVED_REASON} —
 * decides, and the record is not consulted. A host with no row and no observed
 * verdict gets the full form, which is what an absent key always meant.
 */
export function projectTreeForm(
    packageRoot: string,
    host: string,
    verdict: FormVerdict | null,
): LeanProjectionMode {
    if (verdict !== null && verdict.reason !== UNOBSERVED_REASON) {
        return verdict.form === 'full' ? DEFAULT_LEAN_PROJECTION_MODE : (readProjectTreeForms(packageRoot).get(host)?.form ?? DEFAULT_LEAN_PROJECTION_MODE);
    }
    return readProjectTreeForms(packageRoot).get(host)?.form ?? DEFAULT_LEAN_PROJECTION_MODE;
}

/**
 * The `{ mode, hosts }` pair the projector asks for, derived from the record.
 *
 * The record is per host, the projector's API is one mode plus the host list it
 * applies to, and this is the one place the two shapes meet. `mode` is the
 * strongest form any row carries — `delivery` over `thin` over `eager-all` —
 * and `hosts` is every row carrying exactly that form. A tree with no record,
 * or with rows the reader refused, gets the full form and no hosts, which is
 * what an absent key always meant.
 */
export function shippedProjection(packageRoot: string): { mode: LeanProjectionMode; hosts: string[] } {
    const forms = readProjectTreeForms(packageRoot);
    const rank: Record<string, number> = { 'eager-all': 0, thin: 1, delivery: 2 };
    let mode: LeanProjectionMode = DEFAULT_LEAN_PROJECTION_MODE;
    for (const row of forms.values()) {
        if ((rank[row.form] ?? 0) > (rank[mode] ?? 0)) mode = row.form;
    }
    const hosts = [...forms.entries()].filter(([, row]) => row.form === mode).map(([host]) => host).sort();
    return { mode, hosts: mode === DEFAULT_LEAN_PROJECTION_MODE ? [] : hosts };
}
