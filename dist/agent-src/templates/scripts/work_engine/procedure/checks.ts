/**
 * Registry of `check:` exits a skill's `procedure.yaml` may name
 * (road-to-steps-the-skill-cannot-skip 3.2).
 *
 * A step's exit is data, and no string from that data is ever executed. A
 * `check: <id>` exit therefore names a function registered here — deterministic,
 * read-only and offline — and a manifest can only name an id that exists in this
 * map. A check is added with the pilot step that needs it, never speculatively.
 *
 * Per D15 a check that only confirms a key exists is a shape check and does not
 * verify a step. Every check here corroborates the recorded output against the
 * project tree, or against the earlier step output it depends on.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { GREENFIELD_DECISIONS } from '../state.js';

export interface ProcedureCheckContext {
    /** Absolute path of the project the procedure runs against. */
    projectRoot: string;
    /** Absolute path of the skill directory that owns the procedure. */
    skillDir: string;
}

export interface ProcedureCheckResult {
    ok: boolean;
    /** Why the exit is not met; shown to the agent as the step's PARTIAL reason. */
    reason?: string;
    /** `shape` when a pass corroborated nothing (there was nothing to compare against); default `corroborated`. */
    basis?: 'corroborated' | 'shape';
}

export type ProcedureCheck = (ctx: ProcedureCheckContext) => ProcedureCheckResult;

type Dict = Record<string, unknown>;

const STATE_FILE = '.work-state.json';
const PATTERN_KEYS = ['forms', 'tables', 'modals', 'empty_states', 'navigation', 'data_display'] as const;
const AUDIT_KEYS = [
    'components',
    'design_system',
    'design_tokens',
    'shadcn_inventory',
    'patterns',
    'candidates',
    'greenfield',
    'component_taxonomy',
    'component_root',
] as const;
const CANDIDATE_FLOOR = 0.3;
const CANDIDATE_MAX = 5;
const OVERVIEW = 'agents/evidence/analysis/overview.md';
/** Package-name parts too generic to count as a project naming its stack. */
const GENERIC_NAME_PARTS = new Set(['php', 'framework', 'core', 'sdk', 'cli', 'utils', 'tools', 'common', 'types']);

const ok: ProcedureCheckResult = { ok: true };
const fail = (reason: string): ProcedureCheckResult => ({ ok: false, reason });

function isDict(v: unknown): v is Dict {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function readJson(file: string): unknown {
    try {
        return JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown;
    } catch {
        return undefined;
    }
}

/** A project-relative path that stays inside the project and exists. */
function inTree(ctx: ProcedureCheckContext, rel: unknown, kind: 'file' | 'dir' | 'any' = 'any'): boolean {
    if (typeof rel !== 'string' || rel === '' || path.isAbsolute(rel)) return false;
    const abs = path.resolve(ctx.projectRoot, rel);
    if (abs !== ctx.projectRoot && !abs.startsWith(ctx.projectRoot + path.sep)) return false;
    try {
        const st = fs.statSync(abs);
        return kind === 'any' || (kind === 'file' ? st.isFile() : st.isDirectory());
    } catch {
        return false;
    }
}

function readAudit(ctx: ProcedureCheckContext): Dict | string {
    const state = readJson(path.join(ctx.projectRoot, STATE_FILE));
    if (!isDict(state)) return `${STATE_FILE} is missing or not a JSON object`;
    const audit = state['ui_audit'];
    return isDict(audit) ? audit : `${STATE_FILE} carries no ui_audit object`;
}

function withAudit(fn: (audit: Dict, ctx: ProcedureCheckContext) => ProcedureCheckResult): ProcedureCheck {
    return (ctx) => {
        const audit = readAudit(ctx);
        return typeof audit === 'string' ? fail(audit) : fn(audit, ctx);
    };
}

function componentPaths(audit: Dict): string[] | string {
    const components = audit['components'];
    if (!Array.isArray(components)) return 'ui_audit.components is not an array';
    const out: string[] = [];
    for (const c of components) {
        if (!isDict(c) || typeof c['path'] !== 'string') return 'every ui_audit.components entry needs a string path';
        out.push(c['path']);
    }
    return out;
}

const componentsInTree = withAudit((audit, ctx) => {
    const paths = componentPaths(audit);
    if (typeof paths === 'string') return fail(paths);
    const missing = paths.filter((p) => !inTree(ctx, p));
    return missing.length === 0 ? ok : fail(`components not in the project tree: ${missing.join(', ')}`);
});

const taxonomyRootInTree = withAudit((audit, ctx) => {
    const taxonomy = audit['component_taxonomy'];
    if (typeof taxonomy !== 'string' || taxonomy === '') return fail('ui_audit.component_taxonomy is not a string');
    if (taxonomy === 'none') return ok;
    return inTree(ctx, audit['component_root'], 'dir')
        ? ok
        : fail(
              `component_taxonomy '${taxonomy}' names component_root '${String(audit['component_root'])}', ` +
                  'which is not a directory in the tree',
          );
});

const patternsInTree = withAudit((audit, ctx) => {
    const patterns = audit['patterns'];
    if (!isDict(patterns)) return fail('ui_audit.patterns is not an object');
    const missing: string[] = [];
    for (const key of PATTERN_KEYS) {
        const list = patterns[key];
        if (!Array.isArray(list)) return fail(`ui_audit.patterns.${key} is not an array`);
        for (const p of list) if (!inTree(ctx, p)) missing.push(`${key}: ${String(p)}`);
    }
    return missing.length === 0 ? ok : fail(`pattern entries not in the project tree: ${missing.join(', ')}`);
});

const candidatesFromInventory = withAudit((audit) => {
    const paths = componentPaths(audit);
    if (typeof paths === 'string') return fail(paths);
    const candidates = audit['candidates'];
    if (!Array.isArray(candidates)) return fail('ui_audit.candidates is not an array');
    if (candidates.length > CANDIDATE_MAX) return fail(`${candidates.length} candidates, at most ${CANDIDATE_MAX}`);
    const inventory = new Set(paths);
    for (const c of candidates) {
        if (!isDict(c) || typeof c['path'] !== 'string') return fail('every candidate needs a string path');
        if (!inventory.has(c['path'])) return fail(`candidate ${c['path']} is not in the step 1 inventory`);
        const score = c['score'];
        if (typeof score !== 'number' || score < CANDIDATE_FLOOR) {
            return fail(`candidate ${c['path']} scores ${String(score)}, under the ${CANDIDATE_FLOOR} floor`);
        }
    }
    return ok;
});

/** Token groups carry a `source` marker (step 3); an empty group with only that marker is still empty. */
function emptyTokens(tokens: unknown): boolean {
    if (!isDict(tokens)) return false;
    return Object.entries(tokens).every(([key, group]) => {
        if (key === 'source') return true;
        if (Array.isArray(group)) return group.length === 0;
        return isDict(group) && Object.keys(group).filter((k) => k !== 'source').length === 0;
    });
}

const greenfieldConsistent = withAudit((audit) => {
    const paths = componentPaths(audit);
    if (typeof paths === 'string') return fail(paths);
    const greenfield = audit['greenfield'];
    if (typeof greenfield !== 'boolean') return fail('ui_audit.greenfield is not a boolean');
    const empty = paths.length === 0 && audit['design_system'] === 'custom-or-none' && emptyTokens(audit['design_tokens']);
    if (greenfield !== empty) {
        return fail(
            `ui_audit.greenfield is ${String(greenfield)} but components, design_system and design_tokens say ${String(empty)}`,
        );
    }
    if (greenfield && !GREENFIELD_DECISIONS.includes(String(audit['greenfield_decision']))) {
        return fail(`greenfield is true and greenfield_decision is not one of ${GREENFIELD_DECISIONS.join(', ')}`);
    }
    return ok;
});

const auditComplete = withAudit((audit, ctx) => {
    const missing = AUDIT_KEYS.filter((k) => !(k in audit));
    if (missing.length > 0) return fail(`ui_audit lacks ${missing.join(', ')}`);
    for (const check of [componentsInTree, patternsInTree, candidatesFromInventory, greenfieldConsistent, taxonomyRootInTree]) {
        const r = check(ctx);
        if (!r.ok) return r;
    }
    return ok;
});

function manifestNames(ctx: ProcedureCheckContext): string[] {
    const names: string[] = [];
    const npm = readJson(path.join(ctx.projectRoot, 'package.json'));
    if (isDict(npm)) {
        for (const k of ['dependencies', 'devDependencies']) {
            const deps = npm[k];
            if (isDict(deps)) names.push(...Object.keys(deps));
        }
    }
    const composer = readJson(path.join(ctx.projectRoot, 'composer.json'));
    if (isDict(composer)) {
        for (const k of ['require', 'require-dev']) {
            const deps = composer[k];
            if (isDict(deps)) names.push(...Object.keys(deps));
        }
    }
    return names;
}

/** Parts shorter than this are too likely to be an ordinary word to count as naming a dependency. */
const MIN_PART = 4;
/** How many distinct dependencies the overview must name, capped by how many there are. */
const MIN_NAMED = 2;

/** The words a dependency may appear as in prose: its full name and its distinctive, non-generic parts. */
function nameForms(name: string): string[] {
    const lower = name.toLowerCase();
    if (lower.startsWith('@types/') || lower.startsWith('ext-')) return [];
    const forms = new Set<string>();
    if (!GENERIC_NAME_PARTS.has(lower)) forms.add(lower);
    for (const part of lower.replace(/^@/, '').split('/')) {
        if (part.length >= MIN_PART && !GENERIC_NAME_PARTS.has(part)) forms.add(part);
    }
    return [...forms];
}

function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** A whole-word occurrence: a fragment inside a longer word does not count. */
function namesWord(lower: string, form: string): boolean {
    return new RegExp(`(?<![a-z0-9_@/-])${escapeRe(form)}(?![a-z0-9_-])`, 'u').test(lower);
}

const overviewMatchesManifests: ProcedureCheck = (ctx) => {
    let text: string;
    try {
        text = fs.readFileSync(path.join(ctx.projectRoot, OVERVIEW), 'utf-8');
    } catch {
        return fail(`${OVERVIEW} does not exist`);
    }
    if (text.trim() === '') return fail(`${OVERVIEW} is empty`);
    const deps = [...new Set(manifestNames(ctx))].map((n) => nameForms(n)).filter((f) => f.length > 0);
    // Nothing declared to compare against: the overview exists, and that is all this pass shows.
    if (deps.length === 0) return { ok: true, basis: 'shape' };
    const lower = text.toLowerCase();
    const named = deps.filter((forms) => forms.some((f) => namesWord(lower, f))).length;
    const need = Math.min(MIN_NAMED, deps.length);
    return named >= need
        ? ok
        : fail(
              `${OVERVIEW} names ${String(named)} of the dependencies package.json or composer.json declare; ` +
                  `at least ${String(need)} must appear as whole words`,
          );
};

export const PROCEDURE_CHECKS: Readonly<Record<string, ProcedureCheck>> = Object.freeze({
    'ui-audit-components-in-tree': componentsInTree,
    'ui-audit-taxonomy-root-in-tree': taxonomyRootInTree,
    'ui-audit-patterns-in-tree': patternsInTree,
    'ui-audit-candidates-from-inventory': candidatesFromInventory,
    'ui-audit-greenfield-consistent': greenfieldConsistent,
    'ui-audit-complete': auditComplete,
    'analysis-overview-matches-manifests': overviewMatchesManifests,
});

function readOr(file: string): string {
    try {
        return fs.readFileSync(file, 'utf-8');
    } catch {
        return '';
    }
}

/** What a ui-audit check reads: the `ui_audit` slice, not the whole state file the cursor itself rewrites. */
const auditInputs = (ctx: ProcedureCheckContext): string => {
    const audit = readAudit(ctx);
    return typeof audit === 'string' ? '' : JSON.stringify(audit);
};

/**
 * The inputs each check reads, as one string, so a resumed `SUCCESS` can be
 * revalidated when they change (road-to-steps-the-skill-cannot-skip 5.3).
 */
export const PROCEDURE_CHECK_INPUTS: Readonly<Record<string, (ctx: ProcedureCheckContext) => string>> = Object.freeze({
    'ui-audit-components-in-tree': auditInputs,
    'ui-audit-taxonomy-root-in-tree': auditInputs,
    'ui-audit-patterns-in-tree': auditInputs,
    'ui-audit-candidates-from-inventory': auditInputs,
    'ui-audit-greenfield-consistent': auditInputs,
    'ui-audit-complete': auditInputs,
    'analysis-overview-matches-manifests': (ctx: ProcedureCheckContext): string =>
        [OVERVIEW, 'package.json', 'composer.json'].map((f) => readOr(path.join(ctx.projectRoot, f))).join('\0'),
});

export function registeredCheckIds(): Set<string> {
    return new Set(Object.keys(PROCEDURE_CHECKS));
}
