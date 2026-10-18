/**
 * A skill's `procedure.yaml`, read as untrusted input
 * (road-to-steps-the-skill-cannot-skip 5.8).
 *
 * The lint (`lint_skill_procedures`) holds the authored shape in this
 * repository; this reader is what the cursor trusts at run time, on a consumer
 * machine where the sidecar may have been edited by anyone. So it repeats the
 * closed schema rather than assuming the lint ran, refuses a file over
 * {@link MAX_SIDECAR_BYTES}, and refuses any step file that is a symlink or
 * resolves outside the skill directory. Nothing it reads is ever executed: an
 * exit is a typed value, and a `check:` exit names a registered function.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import YAML from 'yaml';

import { registeredCheckIds } from './checks.js';

export const SIDECAR_FILE = 'procedure.yaml';
export const MAX_SIDECAR_BYTES = 64 * 1024;
export const MAX_STEP_FILE_BYTES = 256 * 1024;
const STEPS_DIR = 'references/steps/';
const SKILL_NAME = /^[a-z0-9][a-z0-9-]*$/;
const STEP_ID = /^[a-z0-9][a-z0-9-]*$/;
const TOP_KEYS = new Set(['schema_version', 'brief', 'steps']);
const BRIEF_KEYS = new Set(['goal', 'inputs', 'done_when']);
const STEP_KEYS = new Set(['id', 'file', 'exit', 'when']);
const WHEN_PREDICATES = new Set(['file-exists', 'file-absent']);

export type Exit =
    | { kind: 'exists'; path: string }
    | { kind: 'schema'; path: string; id: string }
    | { kind: 'check'; id: string }
    | { kind: 'judgement' };

export interface When {
    predicate: 'file-exists' | 'file-absent';
    path: string;
}

export interface SidecarStep {
    id: string;
    file: string;
    exit: Exit;
    exitText: string;
    when?: When;
    whenText?: string;
}

export interface Sidecar {
    skill: string;
    skillDir: string;
    sha: string;
    brief: { goal: string; inputs: string[]; done_when: string };
    steps: SidecarStep[];
}

export class SidecarError extends Error {}

/** A relative path with no `..`, no scheme, no shell metacharacter. */
export function containedPath(p: string): boolean {
    if (p === '' || path.isAbsolute(p) || /^[a-z][a-z0-9+.-]*:/i.test(p) || /[\s;&|`$<>\\]/.test(p)) return false;
    return !p.split('/').includes('..');
}

function isDict(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

function closedKeys(obj: Record<string, unknown>, allowed: ReadonlySet<string>, where: string): void {
    for (const k of Object.keys(obj)) {
        if (!allowed.has(k)) throw new SidecarError(`${where}: unknown key '${k}'`);
    }
}

function parseExit(raw: unknown, where: string): Exit {
    if (raw === 'judgement') return { kind: 'judgement' };
    const m = typeof raw === 'string' ? /^(exists|schema|check): (\S+)$/.exec(raw) : null;
    if (m === null) throw new SidecarError(`${where}: exit is not one of exists: · schema: · check: · judgement`);
    const arg = m[2] as string;
    if (m[1] === 'check') {
        if (!STEP_ID.test(arg) || !registeredCheckIds().has(arg)) {
            throw new SidecarError(`${where}: exit 'check: ${arg}' names no registered check`);
        }
        return { kind: 'check', id: arg };
    }
    if (m[1] === 'exists') {
        if (!containedPath(arg)) throw new SidecarError(`${where}: exit path '${arg}' escapes the project`);
        return { kind: 'exists', path: arg };
    }
    const hash = arg.lastIndexOf('#');
    const file = hash === -1 ? '' : arg.slice(0, hash);
    if (file === '' || !containedPath(file)) throw new SidecarError(`${where}: schema exit must be <path>#<id>`);
    return { kind: 'schema', path: file, id: arg.slice(hash + 1) };
}

function parseWhen(raw: unknown, where: string): When {
    const m = typeof raw === 'string' ? /^([a-z-]+): (\S+)$/.exec(raw) : null;
    if (m === null || !WHEN_PREDICATES.has(m[1] as string) || !containedPath(m[2] as string)) {
        throw new SidecarError(`${where}: when is not file-exists: <path> or file-absent: <path>`);
    }
    return { predicate: m[1] as When['predicate'], path: m[2] as string };
}

/** The real path of a file inside `dir`, refusing a symlink and any escape. */
export function containedFile(dir: string, rel: string, maxBytes: number): string {
    const abs = path.join(dir, rel);
    let st: fs.Stats;
    try {
        st = fs.lstatSync(abs);
    } catch {
        throw new SidecarError(`${rel} does not exist`);
    }
    if (st.isSymbolicLink()) throw new SidecarError(`${rel} is a symlink; a procedure file must be a regular file`);
    if (!st.isFile()) throw new SidecarError(`${rel} is not a regular file`);
    if (st.size > maxBytes) throw new SidecarError(`${rel} is ${st.size} bytes, over the ${maxBytes}-byte limit`);
    const real = fs.realpathSync(abs);
    const root = fs.realpathSync(dir);
    if (!real.startsWith(root + path.sep)) throw new SidecarError(`${rel} resolves outside the skill`);
    return real;
}

export function sha256(text: string | Buffer): string {
    return createHash('sha256').update(text).digest('hex');
}

export function loadSidecar(skillsRoot: string, skill: string): Sidecar {
    if (!SKILL_NAME.test(skill)) throw new SidecarError(`'${skill}' is not a skill name`);
    const skillDir = path.join(skillsRoot, skill);
    if (!fs.existsSync(path.join(skillDir, SIDECAR_FILE))) {
        throw new SidecarError(`skill '${skill}' carries no ${SIDECAR_FILE}`);
    }
    const file = containedFile(skillDir, SIDECAR_FILE, MAX_SIDECAR_BYTES);
    const text = fs.readFileSync(file, 'utf-8');
    let doc: unknown;
    try {
        doc = YAML.parse(text);
    } catch {
        throw new SidecarError(`${SIDECAR_FILE} is not valid YAML`);
    }
    if (!isDict(doc)) throw new SidecarError(`${SIDECAR_FILE} must be a mapping`);
    closedKeys(doc, TOP_KEYS, 'top level');
    if (doc['schema_version'] !== 1) throw new SidecarError('schema_version must be 1');
    const brief = doc['brief'];
    if (!isDict(brief)) throw new SidecarError('brief must be a mapping');
    closedKeys(brief, BRIEF_KEYS, 'brief');
    const inputs = brief['inputs'];
    if (typeof brief['goal'] !== 'string' || typeof brief['done_when'] !== 'string' || !Array.isArray(inputs)) {
        throw new SidecarError('brief needs a string goal, a string done_when and an inputs list');
    }
    const rawSteps = doc['steps'];
    if (!Array.isArray(rawSteps) || rawSteps.length === 0) throw new SidecarError('steps must be a non-empty list');
    const seen = new Set<string>();
    const steps = rawSteps.map((raw, i): SidecarStep => {
        const where = `steps[${i}]`;
        if (!isDict(raw)) throw new SidecarError(`${where} must be a mapping`);
        closedKeys(raw, STEP_KEYS, where);
        const id = raw['id'];
        if (typeof id !== 'string' || !STEP_ID.test(id) || seen.has(id)) {
            throw new SidecarError(`${where}: id must be a unique lower-case slug`);
        }
        seen.add(id);
        const stepFile = raw['file'];
        if (typeof stepFile !== 'string' || !stepFile.startsWith(STEPS_DIR) || !containedPath(stepFile)) {
            throw new SidecarError(`${where}: file must be under ${STEPS_DIR}`);
        }
        containedFile(skillDir, stepFile, MAX_STEP_FILE_BYTES);
        const step: SidecarStep = { id, file: stepFile, exit: parseExit(raw['exit'], where), exitText: String(raw['exit']) };
        if ('when' in raw) {
            step.when = parseWhen(raw['when'], where);
            step.whenText = String(raw['when']);
        }
        return step;
    });
    return {
        skill,
        skillDir,
        sha: sha256(text),
        brief: { goal: brief['goal'], inputs: inputs.map(String), done_when: brief['done_when'] },
        steps,
    };
}
