#!/usr/bin/env tsx
/**
 * Procedure sidecar lint (road-to-steps-the-skill-cannot-skip Phase 3).
 *
 * A skill whose procedure is handed out step by step carries
 * `src/skills/<skill>/procedure.yaml` beside its SKILL.md. The sidecar is data
 * with no runtime here: this lint holds its shape so the `/work` cursor can
 * trust it later.
 *
 *   - Keys are closed at every level. No step names another skill — a `skill:`
 *     key per step would be the skill-to-skill chain the skill-DAG lock rejects.
 *   - `exit` is exactly one of `exists: <path>`, `schema: <path>#<id>`,
 *     `check: <id>` (registered in `_lib/procedure_checks.ts`) or `judgement`.
 *     Nothing a manifest says is ever executed.
 *   - `when` takes a predicate from a closed vocabulary; a step not taken is
 *     recorded by the runner as `skipped: <reason>`, never silently.
 *   - Every step `file` exists under `references/steps/`, is linked from the
 *     head, and no path escapes the skill directory; ids are unique.
 *
 * The share of `judgement` exits is reported, never gated.
 *
 * Exit codes: 0 clean, 1 violations, 2 usage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import YAML from 'yaml';

import { registeredCheckIds } from './_lib/procedure_checks.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';
import { relativeTargets } from './lint_skill_link_reach.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const SIDECAR = 'procedure.yaml';
const STEPS_DIR = 'references/steps/';
const TOP_KEYS = new Set(['schema_version', 'brief', 'steps']);
const BRIEF_KEYS = new Set(['goal', 'inputs', 'done_when']);
const STEP_KEYS = new Set(['id', 'file', 'exit', 'when']);
const STEP_ID = /^[a-z0-9][a-z0-9-]*$/;
const CHECK_ID = /^[a-z0-9][a-z0-9-]*$/;

/** The closed `when:` vocabulary — each takes one project-relative path. */
export const WHEN_PREDICATES: ReadonlySet<string> = new Set(['file-exists', 'file-absent']);

export type ExitKind = 'exists' | 'schema' | 'check' | 'judgement';

export interface ParsedExit {
    kind?: ExitKind;
    error?: string;
}

/** A relative path that stays where it was resolved: no absolute, no `..`, no scheme. */
function containedPath(p: string): boolean {
    if (p === '' || path.isAbsolute(p) || /^[a-z][a-z0-9+.-]*:/i.test(p) || /[\s;&|`$<>]/.test(p)) return false;
    return !p.split(/[\\/]/).includes('..');
}

export function parseExit(raw: unknown, skillDir: string, checks: ReadonlySet<string> = registeredCheckIds()): ParsedExit {
    if (typeof raw !== 'string') return { error: 'exit must be a string' };
    if (raw === 'judgement') return { kind: 'judgement' };
    const m = /^(exists|schema|check): (.+)$/.exec(raw);
    if (m === null) {
        return { error: `exit '${raw}' is not one of exists: <path> · schema: <path>#<id> · check: <id> · judgement` };
    }
    const kind = m[1] as ExitKind;
    const arg = (m[2] as string).trim();
    if (kind === 'exists') {
        return containedPath(arg) ? { kind } : { error: `exit 'exists: ${arg}' must name a relative path that does not escape` };
    }
    if (kind === 'check') {
        if (!CHECK_ID.test(arg)) return { error: `exit 'check: ${arg}' must name a check id, not a command` };
        if (!checks.has(arg)) return { error: `exit 'check: ${arg}' names no function registered in _lib/procedure_checks.ts` };
        return { kind };
    }
    const hash = arg.lastIndexOf('#');
    const file = hash === -1 ? '' : arg.slice(0, hash);
    const id = hash === -1 ? '' : arg.slice(hash + 1);
    if (file === '' || id === '' || !containedPath(file)) {
        return { error: `exit 'schema: ${arg}' must be <path inside the skill>#<schema-id>` };
    }
    const abs = path.join(skillDir, file);
    if (!fs.existsSync(abs)) return { error: `exit 'schema: ${arg}' — ${file} does not exist in the skill` };
    try {
        const doc = JSON.parse(fs.readFileSync(abs, 'utf-8')) as Record<string, unknown>;
        const declared = String(doc['$id'] ?? '');
        if (declared !== id && declared.replace(/\.schema\.json$/, '') !== id) {
            return { error: `exit 'schema: ${arg}' — ${file} declares $id '${declared}', not '${id}'` };
        }
    } catch {
        return { error: `exit 'schema: ${arg}' — ${file} is not valid JSON` };
    }
    return { kind };
}

function parseWhen(raw: unknown): string | undefined {
    if (typeof raw !== 'string') return 'when must be a string';
    const m = /^([a-z-]+): (.+)$/.exec(raw);
    if (m === null || !WHEN_PREDICATES.has(m[1] as string)) {
        return `when '${raw}' is not one of ${[...WHEN_PREDICATES].map((p) => `${p}: <path>`).join(' · ')}`;
    }
    return containedPath((m[2] as string).trim()) ? undefined : `when '${raw}' must name a relative path that does not escape`;
}

function unknownKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>, where: string): string[] {
    return Object.keys(obj)
        .filter((k) => !allowed.has(k))
        .map((k) => `${where}: unknown key '${k}' (allowed: ${[...allowed].join(', ')})`);
}

export interface ProcedureReport {
    errors: string[];
    steps: number;
    judgement: number;
}

export function lintProcedure(
    skillDir: string,
    text: string,
    checks: ReadonlySet<string> = registeredCheckIds(),
): ProcedureReport {
    const errors: string[] = [];
    let doc: unknown;
    try {
        doc = YAML.parse(text);
    } catch (exc) {
        return { errors: [`not valid YAML: ${(exc as Error).message.split('\n')[0]}`], steps: 0, judgement: 0 };
    }
    if (doc === null || typeof doc !== 'object' || Array.isArray(doc)) {
        return { errors: ['the sidecar must be a mapping'], steps: 0, judgement: 0 };
    }
    const top = doc as Record<string, unknown>;
    errors.push(...unknownKeys(top, TOP_KEYS, 'top level'));
    if (top['schema_version'] !== 1) errors.push('schema_version must be 1');
    const brief = top['brief'];
    if (brief === null || typeof brief !== 'object' || Array.isArray(brief)) {
        errors.push('brief must be a mapping with goal, inputs, done_when');
    } else {
        errors.push(...unknownKeys(brief as Record<string, unknown>, BRIEF_KEYS, 'brief'));
        for (const k of BRIEF_KEYS) {
            if (!(k in (brief as Record<string, unknown>))) errors.push(`brief.${k} is required`);
        }
    }
    const steps = top['steps'];
    if (!Array.isArray(steps) || steps.length === 0) {
        errors.push('steps must be a non-empty list');
        return { errors, steps: 0, judgement: 0 };
    }
    const head = fs.existsSync(path.join(skillDir, 'SKILL.md')) ? fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8') : '';
    const linked = new Set(relativeTargets(head).map((t) => path.posix.normalize(t.split('#')[0] ?? '')));
    const seen = new Set<string>();
    let judgement = 0;
    steps.forEach((raw, i) => {
        const where = `steps[${i}]`;
        if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
            errors.push(`${where} must be a mapping`);
            return;
        }
        const step = raw as Record<string, unknown>;
        errors.push(...unknownKeys(step, STEP_KEYS, where));
        const id = step['id'];
        if (typeof id !== 'string' || !STEP_ID.test(id)) {
            errors.push(`${where}: id must be a lower-case slug`);
        } else if (seen.has(id)) {
            errors.push(`${where}: duplicate id '${id}'`);
        } else {
            seen.add(id);
        }
        const file = step['file'];
        if (typeof file !== 'string' || !file.startsWith(STEPS_DIR) || !containedPath(file)) {
            errors.push(`${where}: file must be a path under ${STEPS_DIR} that does not escape the skill`);
        } else if (!fs.existsSync(path.join(skillDir, file))) {
            errors.push(`${where}: file ${file} does not exist`);
        } else if (!linked.has(path.posix.normalize(file))) {
            errors.push(`${where}: file ${file} is not linked from SKILL.md`);
        }
        const exit = parseExit(step['exit'], skillDir, checks);
        if (exit.error !== undefined) errors.push(`${where}: ${exit.error}`);
        if (exit.kind === 'judgement') judgement += 1;
        if ('when' in step) {
            const bad = parseWhen(step['when']);
            if (bad !== undefined) errors.push(`${where}: ${bad}`);
        }
    });
    return { errors, steps: steps.length, judgement };
}

export function main(argv: string[] = process.argv.slice(2), root: string = REPO_ROOT): number {
    if (argv.length > 0) {
        process.stderr.write(`lint_skill_procedures: unknown argument ${argv[0]}\n`);
        return 2;
    }
    const skillsRoot = path.join(root, 'src', 'skills');
    const skills = fs.existsSync(skillsRoot)
        ? fs.readdirSync(skillsRoot).filter((s) => fs.existsSync(path.join(skillsRoot, s, 'SKILL.md'))).sort()
        : [];
    try {
        reportScanned({
            gate: 'lint_skill_procedures',
            scanned: skills.length,
            units: 'skill(s)',
            roots: ['src/skills'],
            allowEmpty: root === REPO_ROOT ? undefined : 'EMPTY_VALID: a fixture root may carry no skills',
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }
    const failures: string[] = [];
    let procedures = 0;
    let steps = 0;
    let judgement = 0;
    for (const s of skills) {
        const sidecar = path.join(skillsRoot, s, SIDECAR);
        if (!fs.existsSync(sidecar)) continue;
        procedures += 1;
        const r = lintProcedure(path.join(skillsRoot, s), fs.readFileSync(sidecar, 'utf-8'));
        steps += r.steps;
        judgement += r.judgement;
        for (const e of r.errors) failures.push(`src/skills/${s}/${SIDECAR}: ${e}`);
    }
    const share = steps === 0 ? 'n/a' : `${Math.round((100 * judgement) / steps)} %`;
    if (failures.length > 0) {
        process.stdout.write(`❌  lint_skill_procedures: ${failures.length} violation(s):\n`);
        for (const f of failures) process.stdout.write(`  🔴 ${f}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  lint_skill_procedures: ${procedures} procedure sidecar(s) across ${skills.length} skill(s) valid.\n` +
            `   reported, not gated: ${judgement} of ${steps} step exit(s) are judgement (${share}).\n`,
    );
    return 0;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
