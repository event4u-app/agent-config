/**
 * Where the PROJECT tree's rule-layer form comes from, now that no settings key
 * carries it.
 *
 * WHY THIS EXISTS. ADR-293 removed `lean_projection.*`, and the shipped
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
 * ON THE LIVE PATH, AND SCOPED BY TYPE (council 2/2, 2026-10-24). The full
 * quorum confirmed the record and named two defects in how it met the tree: the
 * precedence rule had no caller outside its test, and it decided by a reason
 * STRING, so an installed-layer verdict could cross into the project tree. Now
 * {@link shippedProjection} runs every row through {@link projectTreeForm}, and
 * a verdict counts only when it carries `scope: 'project-tree'` — the installed
 * user-global layer's verdict is refused whatever its reason. No producer of a
 * project-tree verdict exists yet, so the live input is
 * {@link noProjectTreeObservation} and the record stands; when one exists, it
 * is passed here and nothing else changes. {@link KILL_SWITCH_ENV}`=full` forces
 * the full form for every host, the operator rollback that needs no release.
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

/**
 * A verdict about the PROJECT tree. `scope` is the provenance, carried in the
 * type rather than inferred from `reason`: a verdict without it — the installed
 * layer's, from `layer_form_decision.ts` — never decides a project tree.
 */
export interface FormVerdict {
    readonly form: 'full' | 'thinned';
    readonly reason: string;
    readonly scope?: string;
}

/** Operator rollback: `full` forces the full form for every project tree. */
export const KILL_SWITCH_ENV = 'AGENT_CONFIG_PROJECT_TREE_FORM';

/** The live verdict source while no project-tree observer exists: none, so the record stands. */
export const noProjectTreeObservation = (_host: string): FormVerdict | null => null;

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
        // At least one measured figure, each a non-empty string: `{}` records no measurement.
        const measured = row['measured'];
        if (!isRecord(measured)) continue;
        const figures = Object.values(measured);
        if (figures.length === 0 || !figures.every((v) => typeof v === 'string' && v.trim() !== '')) continue;
        out.set(host, { form: form as LeanProjectionMode, basis: typeof row['basis'] === 'string' ? row['basis'] : 'unrecorded' });
    }
    return out;
}

/**
 * The form the project tree is built with for `host`.
 *
 * The kill switch wins over everything. Then an observed PROJECT-TREE verdict —
 * `scope: 'project-tree'` and a reason other than {@link UNOBSERVED_REASON} —
 * decides: `full` gives the full form, `thinned` keeps the measured row. Any
 * other verdict is ignored and the record stands. A host with no row gets the
 * full form, which is what an absent key always meant.
 */
export function projectTreeForm(
    packageRoot: string,
    host: string,
    verdict: FormVerdict | null,
    env: NodeJS.ProcessEnv = process.env,
    forms: Map<string, ProjectTreeForm> = readProjectTreeForms(packageRoot),
): LeanProjectionMode {
    if (env[KILL_SWITCH_ENV] === 'full') return DEFAULT_LEAN_PROJECTION_MODE;
    const observed = verdict !== null && verdict.scope === 'project-tree' && verdict.reason !== UNOBSERVED_REASON;
    if (observed && verdict.form === 'full') return DEFAULT_LEAN_PROJECTION_MODE;
    return forms.get(host)?.form ?? DEFAULT_LEAN_PROJECTION_MODE;
}

/**
 * The `{ mode, hosts }` pair the projector asks for, derived from the record.
 *
 * The record is per host, the projector's API is one mode plus the host list it
 * applies to, and this is the one place the two shapes meet. Each row is
 * resolved through {@link projectTreeForm}; `mode` is the strongest result —
 * `delivery` over `thin` over `eager-all` — and `hosts` every row resolving to
 * exactly that form. A tree with no record,
 * or with rows the reader refused, gets the full form and no hosts, which is
 * what an absent key always meant.
 */
export function shippedProjection(
    packageRoot: string,
    verdictFor: (host: string) => FormVerdict | null = noProjectTreeObservation,
    env: NodeJS.ProcessEnv = process.env,
): { mode: LeanProjectionMode; hosts: string[] } {
    const rows = readProjectTreeForms(packageRoot);
    const forms = new Map([...rows.keys()].map((host) => [host, projectTreeForm(packageRoot, host, verdictFor(host), env, rows)]));
    const rank: Record<string, number> = { 'eager-all': 0, thin: 1, delivery: 2 };
    let mode: LeanProjectionMode = DEFAULT_LEAN_PROJECTION_MODE;
    for (const form of forms.values()) {
        if ((rank[form] ?? 0) > (rank[mode] ?? 0)) mode = form;
    }
    const hosts = [...forms.entries()].filter(([, form]) => form === mode).map(([host]) => host).sort();
    return { mode, hosts: mode === DEFAULT_LEAN_PROJECTION_MODE ? [] : hosts };
}
