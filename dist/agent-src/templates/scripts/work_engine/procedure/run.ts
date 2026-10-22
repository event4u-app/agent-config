/**
 * The procedure cursor: `agent-config work --procedure <skill>`
 * (road-to-steps-the-skill-cannot-skip Phase 5, default-off).
 *
 * One call loads the skill's sidecar, revalidates every step already recorded
 * as done, and runs the `/work` dispatcher once over the sidecar's own step
 * order (`dispatch(..., order)`, 5.1). A step's handler hands the step out the
 * first time it is reached and checks its exit on every later call, so step
 * n+1 is never handed out before step n's exit is met, recorded as a confirmed
 * judgement, or recorded as `skipped: <reason>`.
 *
 * Bounds (5.6): linear and finite — one dispatch per call, no repeat mode, no
 * background work, no subagent, no process, no hook. Nothing read from a
 * sidecar or a state file is executed.
 *
 * Judgement steps (5.7): a `judgement` exit cannot be verified by code, so the
 * step is self-attested, not verified. Whoever runs the cursor — in practice the
 * agent — answers it with `--procedure-confirm <step-id>`; that explicit
 * confirmation of the current step, given in the same call, is the only answer
 * that clears it, and it is recorded as `by: self-attested` with the step file's
 * hash and a timestamp. An adjudication found in the state file never clears a
 * step. When nobody answers, the step stays the current step on every call — it
 * never times out and never advances itself.
 *
 * Labels say what was corroborated: a `check:` exit that passed is
 * `check-passed` (or `shape` when the check had nothing to corroborate), never
 * "verified"; an `exists:` exit is `shape`. Filesystem exits resolve symlinks
 * and must stay inside the project.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { Outcome, StepResult } from '../delivery_state.js';
import type { Step } from '../delivery_state.js';
import { dispatch } from '../dispatcher.js';
import { Input, WorkState, from_dict, to_dict } from '../state.js';
import { _sync_back, _to_delivery } from '../state_io.js';
import { PROCEDURE_CHECKS, PROCEDURE_CHECK_INPUTS } from './checks.js';
import { SidecarError, containedPath, loadSidecar, sha256, type Sidecar, type SidecarStep } from './sidecar.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));

/** Set to `1` to refuse every procedure activation, whatever the flags say (5.8). */
export const PROCEDURE_KILL_SWITCH = 'AGENT_CONFIG_PROCEDURE_OFF';
export const PROCEDURE_ENGINE_VERSION = 1;
export const PROCEDURE_DATA_SCHEMA = 'procedure/v1';
const DEFAULT_STATE_FILE = '.work-state.json';
const MAX_STATE_BYTES = 1024 * 1024;
const MAX_FAILED = 10;

export type StepStatus = 'emitted' | 'partial' | 'ok' | 'skipped' | 'stale';
const STATUSES: ReadonlySet<string> = new Set(['emitted', 'partial', 'ok', 'skipped', 'stale']);

export interface Adjudication {
    answer: 'confirmed';
    /** The cursor cannot tell who ran it; the record says so instead of naming an operator. */
    by: 'self-attested';
    at: string;
    step_sha: string;
}

export interface StepRecord {
    status: StepStatus;
    failed_approaches: string[];
    reason?: string;
    head?: string;
    step_sha?: string;
    inputs_sha?: string;
    adjudication?: Adjudication;
    /** For a passed `check:` exit: whether the check corroborated anything, or only found nothing to compare. */
    basis?: 'corroborated' | 'shape';
}

export interface ProcedureData {
    schema: string;
    skill: string;
    sidecar_sha: string;
    engine_version: number;
    started_head: string;
    current: string | null;
    /** The sidecar's step ids in order, so a reader of the state file can say "step k of n". */
    order: string[];
    steps: Record<string, StepRecord>;
}

export interface ProcedureRunOptions {
    skill: string;
    projectRoot: string;
    skillsRoot?: string;
    stateFile?: string;
    confirm?: string | null;
    restart?: boolean;
    env?: Record<string, string | undefined>;
}

export interface ProcedureRunResult {
    code: 0 | 1 | 2;
    output: string;
}

class Refusal extends Error {}

const RECORD_KEYS = new Set(['status', 'failed_approaches', 'reason', 'head', 'step_sha', 'inputs_sha', 'adjudication', 'basis']);
const HEX64 = /^[0-9a-f]{64}$/;
const HEAD_RE = /^(?:[0-9a-f]{40}|[0-9a-f]{64}|none)$/;
const ADJ_KEYS = new Set(['answer', 'by', 'at', 'step_sha']);

function validAdjudication(v: unknown): boolean {
    if (!isDict(v)) return false;
    for (const k of Object.keys(v)) if (!ADJ_KEYS.has(k)) return false;
    return (
        v['answer'] === 'confirmed' &&
        v['by'] === 'self-attested' &&
        typeof v['at'] === 'string' &&
        !Number.isNaN(Date.parse(v['at'])) &&
        typeof v['step_sha'] === 'string' &&
        HEX64.test(v['step_sha'])
    );
}

/** Every optional field of a step record, typed; anything else is a refusal. */
function validRecordFields(rec: Record<string, unknown>): boolean {
    const fa = rec['failed_approaches'];
    if (!Array.isArray(fa) || fa.length > MAX_FAILED || !fa.every((x) => typeof x === 'string')) return false;
    if ('reason' in rec && typeof rec['reason'] !== 'string') return false;
    if ('head' in rec && (typeof rec['head'] !== 'string' || !HEAD_RE.test(rec['head']))) return false;
    for (const k of ['step_sha', 'inputs_sha']) {
        if (k in rec && (typeof rec[k] !== 'string' || !HEX64.test(rec[k] as string))) return false;
    }
    if ('adjudication' in rec && !validAdjudication(rec['adjudication'])) return false;
    if ('basis' in rec && rec['basis'] !== 'corroborated' && rec['basis'] !== 'shape') return false;
    return true;
}
const DATA_KEYS = new Set(['schema', 'skill', 'sidecar_sha', 'engine_version', 'started_head', 'current', 'order', 'steps']);

function isDict(v: unknown): v is Record<string, unknown> {
    return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/** The persisted procedure record is untrusted: a closed, versioned shape or a refusal. */
function validateData(raw: unknown, sidecar: Sidecar): ProcedureData {
    if (!isDict(raw)) throw new Refusal('the procedure record in the state file is not an object');
    for (const k of Object.keys(raw)) if (!DATA_KEYS.has(k)) throw new Refusal(`unknown key '${k}' in the procedure record`);
    if (raw['schema'] !== PROCEDURE_DATA_SCHEMA) throw new Refusal(`the procedure record is not ${PROCEDURE_DATA_SCHEMA}`);
    const steps = raw['steps'];
    if (!isDict(steps)) throw new Refusal('the procedure record carries no step map');
    const ids = new Set(sidecar.steps.map((s) => s.id));
    for (const [id, rec] of Object.entries(steps)) {
        if (!ids.has(id)) throw new Refusal(`the procedure record names step '${id}', which the sidecar does not`);
        if (!isDict(rec) || !STATUSES.has(String(rec['status'])) || !Array.isArray(rec['failed_approaches'])) {
            throw new Refusal(`the record of step '${id}' is malformed`);
        }
        for (const k of Object.keys(rec)) if (!RECORD_KEYS.has(k)) throw new Refusal(`unknown key '${k}' in step '${id}'`);
        if (!validRecordFields(rec)) throw new Refusal(`the record of step '${id}' carries a field of the wrong type`);
    }
    const order = raw['order'];
    if (!Array.isArray(order) || order.join('\n') !== sidecar.steps.map((s) => s.id).join('\n')) {
        throw new Refusal('the step order in the state file is not the sidecar\'s');
    }
    const current = raw['current'];
    if (current !== null && (typeof current !== 'string' || !ids.has(current))) throw new Refusal('the current step is unknown');
    for (const k of ['skill', 'sidecar_sha', 'started_head'] as const) {
        if (typeof raw[k] !== 'string') throw new Refusal(`the procedure record's ${k} is not a string`);
    }
    if (typeof raw['engine_version'] !== 'number') throw new Refusal('the procedure record\'s engine_version is not a number');
    return raw as unknown as ProcedureData;
}

function freshData(sidecar: Sidecar, head: string): ProcedureData {
    return {
        schema: PROCEDURE_DATA_SCHEMA,
        skill: sidecar.skill,
        sidecar_sha: sidecar.sha,
        engine_version: PROCEDURE_ENGINE_VERSION,
        started_head: head,
        current: null,
        order: sidecar.steps.map((s) => s.id),
        steps: {},
    };
}

/** HEAD read from the repository files, so no process is started for it. */
export function readHead(projectRoot: string): string {
    let dir = path.resolve(projectRoot);
    for (;;) {
        const dotGit = path.join(dir, '.git');
        if (fs.existsSync(dotGit)) {
            let gitDir = dotGit;
            if (fs.statSync(dotGit).isFile()) {
                const m = /^gitdir: (.+)$/m.exec(fs.readFileSync(dotGit, 'utf-8'));
                if (m === null) return 'none';
                gitDir = path.resolve(dir, (m[1] as string).trim());
            }
            const head = readOr(path.join(gitDir, 'HEAD')).trim();
            const ref = /^ref: (.+)$/.exec(head);
            if (ref === null) return head === '' ? 'none' : head;
            const common = readOr(path.join(gitDir, 'commondir')).trim();
            const roots = [gitDir, ...(common === '' ? [] : [path.resolve(gitDir, common)])];
            for (const r of roots) {
                const loose = readOr(path.join(r, ref[1] as string)).trim();
                if (loose !== '') return loose;
                const packed = readOr(path.join(r, 'packed-refs'))
                    .split('\n')
                    .find((l) => l.endsWith(` ${ref[1] as string}`));
                if (packed !== undefined) return packed.split(' ')[0] as string;
            }
            return 'none';
        }
        const parent = path.dirname(dir);
        if (parent === dir) return 'none';
        dir = parent;
    }
}

function readOr(file: string): string {
    try {
        return fs.readFileSync(file, 'utf-8');
    } catch {
        return '';
    }
}

/** The real path of `rel` when it exists and, symlinks resolved, stays inside the project; else null. */
function realInTree(projectRoot: string, rel: string): string | null {
    if (!containedPath(rel)) return null;
    try {
        const root = fs.realpathSync(projectRoot);
        const abs = fs.realpathSync(path.join(projectRoot, rel));
        return abs === root || abs.startsWith(root + path.sep) ? abs : null;
    } catch {
        return null;
    }
}

function inTree(projectRoot: string, rel: string): boolean {
    return realInTree(projectRoot, rel) !== null;
}

function existsFingerprint(projectRoot: string, rel: string): string {
    const abs = realInTree(projectRoot, rel);
    if (abs === null) return 'absent';
    try {
        const st = fs.statSync(abs);
        return st.isDirectory() ? fs.readdirSync(abs).sort().join('\n') : sha256(fs.readFileSync(abs));
    } catch {
        return 'absent';
    }
}

function stepSha(sidecar: Sidecar, step: SidecarStep): string {
    return sha256(fs.readFileSync(path.join(sidecar.skillDir, step.file)));
}

function inputsSha(sidecar: Sidecar, step: SidecarStep, projectRoot: string): string {
    const exit = step.exit;
    if (exit.kind === 'exists') return sha256(existsFingerprint(projectRoot, exit.path));
    if (exit.kind === 'check') {
        const inputs = PROCEDURE_CHECK_INPUTS[exit.id];
        return sha256(inputs === undefined ? '' : inputs({ projectRoot, skillDir: sidecar.skillDir }));
    }
    return sha256('');
}

interface ExitResult {
    ok: boolean;
    reason: string;
    basis?: 'corroborated' | 'shape';
}

/**
 * `confirmedNow` is the adjudication `--procedure-confirm` wrote in THIS call. A
 * judgement step that is not yet `ok` clears only on it; one already `ok` is
 * re-checked against the adjudication it was recorded with.
 */
function evaluate(
    sidecar: Sidecar,
    step: SidecarStep,
    rec: StepRecord | undefined,
    projectRoot: string,
    confirmedNow: string | null = null,
): ExitResult {
    const exit = step.exit;
    if (exit.kind === 'exists') {
        return inTree(projectRoot, exit.path) ? { ok: true, reason: '' } : { ok: false, reason: `${exit.path} does not exist` };
    }
    if (exit.kind === 'check') {
        const check = PROCEDURE_CHECKS[exit.id];
        if (check === undefined) return { ok: false, reason: `check '${exit.id}' is not registered` };
        const r = check({ projectRoot, skillDir: sidecar.skillDir });
        return { ok: r.ok, reason: r.reason ?? '', basis: r.basis ?? 'corroborated' };
    }
    if (exit.kind === 'schema') {
        return { ok: false, reason: 'schema exits are not executable by this engine version' };
    }
    const adj = rec?.adjudication;
    if (adj === undefined) return { ok: false, reason: 'awaiting confirmation' };
    if (rec?.status !== 'ok' && confirmedNow !== step.id) return { ok: false, reason: 'awaiting confirmation' };
    if (adj.step_sha !== stepSha(sidecar, step)) {
        return { ok: false, reason: 'the step file changed after it was confirmed' };
    }
    return { ok: true, reason: '' };
}

function whenHolds(step: SidecarStep, projectRoot: string): boolean {
    if (step.when === undefined) return true;
    const present = inTree(projectRoot, step.when.path);
    return step.when.predicate === 'file-exists' ? present : !present;
}

function exitClass(step: SidecarStep, rec?: StepRecord): string {
    if (step.exit.kind === 'check') return rec?.basis === 'shape' ? 'shape' : 'check-passed';
    if (step.exit.kind === 'judgement') return 'self-attested, not verified';
    return 'shape';
}

function pushFailed(rec: StepRecord, reason: string): void {
    if (reason === '' || rec.failed_approaches.includes(reason)) return;
    rec.failed_approaches = [...rec.failed_approaches, reason].slice(-MAX_FAILED);
}

function atomicWrite(file: string, text: string): void {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, text, 'utf-8');
    fs.renameSync(tmp, file);
}

function defaultSkillsRoot(skill: string): string {
    const candidates = [path.resolve(HERE, '..', '..', '..', '..', 'skills'), path.resolve(HERE, '..', '..', '..', '..', '..', 'skills')];
    return candidates.find((c) => fs.existsSync(path.join(c, skill, 'procedure.yaml'))) ?? (candidates[0] as string);
}

function loadWork(statePath: string, sidecar: Sidecar, restart: boolean, head: string): WorkState {
    const fresh = (): WorkState =>
        new WorkState({ input: new Input('procedure', freshData(sidecar, head) as unknown as Record<string, never>) });
    if (!fs.existsSync(statePath)) return fresh();
    const st = fs.lstatSync(statePath);
    if (st.isSymbolicLink() || !st.isFile()) throw new Refusal(`${statePath} is not a regular file`);
    if (st.size > MAX_STATE_BYTES) throw new Refusal(`${statePath} is over the ${MAX_STATE_BYTES}-byte limit`);
    let payload: unknown;
    try {
        payload = JSON.parse(fs.readFileSync(statePath, 'utf-8')) as unknown;
    } catch {
        throw new Refusal(`${statePath} is not valid JSON`);
    }
    const kind = isDict(payload) && isDict(payload['input']) ? payload['input']['kind'] : undefined;
    if (kind !== 'procedure') {
        throw new Refusal(`${statePath} holds a '${String(kind)}' run; pass --state-file to start a procedure elsewhere`);
    }
    if (restart) return fresh();
    let work: WorkState;
    try {
        work = from_dict(payload as never);
    } catch (exc) {
        throw new Refusal(`${statePath} does not validate: ${(exc as Error).message}`);
    }
    const data = validateData(work.input.data, sidecar);
    const restartHint = 'run again with --procedure-restart to start over';
    if (data.skill !== sidecar.skill) throw new Refusal(`the state file is bound to procedure '${data.skill}'; ${restartHint}`);
    if (data.engine_version !== PROCEDURE_ENGINE_VERSION) {
        throw new Refusal(`the state file was written by procedure engine v${String(data.engine_version)}; ${restartHint}`);
    }
    if (data.sidecar_sha !== sidecar.sha) throw new Refusal(`the ${sidecar.skill} sidecar changed since this run started; ${restartHint}`);
    return work;
}

function brief(sidecar: Sidecar, data: ProcedureData, step: SidecarStep, headline: string): string[] {
    const n = sidecar.steps.length;
    const k = sidecar.steps.findIndex((s) => s.id === step.id) + 1;
    const rec = data.steps[step.id];
    const remaining = sidecar.steps.slice(k).map((s) => s.id);
    const lines = [
        `procedure ${sidecar.skill}@${data.started_head.slice(0, 12)} · step ${String(k)} of ${String(n)} (${step.id})`,
        headline,
        `goal: ${sidecar.brief.goal}`,
        `done_when: ${sidecar.brief.done_when}`,
        `step file: ${path.join(sidecar.skillDir, step.file)}`,
        `exit: ${step.exitText} (${exitClass(step, rec)})`,
        `remaining: ${remaining.length === 0 ? 'none' : remaining.join(', ')}`,
        `failed_approaches: ${rec === undefined || rec.failed_approaches.length === 0 ? 'none' : rec.failed_approaches.join('; ')}`,
    ];
    if (step.exit.kind === 'judgement') {
        lines.push(
            'This step is self-attested, not verified: no code can check it. Do it, state the decision you took, ' +
                `then run: agent-config work --procedure ${sidecar.skill} --procedure-confirm ${step.id}`,
        );
    }
    return lines;
}

export function run_procedure(opts: ProcedureRunOptions): ProcedureRunResult {
    const env = opts.env ?? process.env;
    if (env[PROCEDURE_KILL_SWITCH] === '1') {
        return { code: 2, output: `procedure cursor disabled by ${PROCEDURE_KILL_SWITCH}=1; nothing was read or written` };
    }
    const projectRoot = path.resolve(opts.projectRoot);
    try {
        const sidecar = loadSidecar(opts.skillsRoot ?? defaultSkillsRoot(opts.skill), opts.skill);
        const statePath = path.resolve(projectRoot, opts.stateFile ?? DEFAULT_STATE_FILE);
        const head = readHead(projectRoot);
        const work = loadWork(statePath, sidecar, opts.restart === true, head);
        const data = work.input.data as unknown as ProcedureData;
        const byId = new Map(sidecar.steps.map((s) => [s.id, s]));
        const notes: string[] = [];

        if (opts.confirm !== undefined && opts.confirm !== null) {
            const target = byId.get(opts.confirm);
            const rec = data.steps[opts.confirm];
            if (target === undefined || target.exit.kind !== 'judgement' || data.current !== opts.confirm || rec === undefined || rec.status === 'ok') {
                throw new Refusal(`--procedure-confirm ${opts.confirm}: only the current judgement step can be confirmed (current: ${String(data.current)})`);
            }
            rec.adjudication = { answer: 'confirmed', by: 'self-attested', at: new Date().toISOString(), step_sha: stepSha(sidecar, target) };
        }
        const confirmedNow = opts.confirm ?? null;

        for (const step of sidecar.steps) {
            const rec = data.steps[step.id];
            if (rec === undefined || rec.status !== 'ok' || work.outcomes[step.id] !== Outcome.SUCCESS) continue;
            const now = { head, step_sha: stepSha(sidecar, step), inputs_sha: inputsSha(sidecar, step, projectRoot) };
            if (now.head === rec.head && now.step_sha === rec.step_sha && now.inputs_sha === rec.inputs_sha) continue;
            const again = evaluate(sidecar, step, rec, projectRoot);
            if (again.ok) {
                Object.assign(rec, now);
                notes.push(`revalidated: ${step.id} (stale, exit re-checked and still met)`);
            } else {
                rec.status = 'stale';
                rec.reason = again.reason;
                Reflect.deleteProperty(work.outcomes, step.id);
            }
        }

        let handedOut: string | null = null;
        const handler = (step: SidecarStep): Step => () => {
            const rec = data.steps[step.id];
            if (!whenHolds(step, projectRoot)) {
                data.steps[step.id] = { status: 'skipped', reason: `skipped: ${String(step.whenText)} is false`, failed_approaches: [] };
                return new StepResult({ outcome: Outcome.SUCCESS });
            }
            if (rec === undefined || rec.status === 'skipped') {
                data.steps[step.id] = { status: 'emitted', failed_approaches: rec?.failed_approaches ?? [] };
                data.current = step.id;
                handedOut = step.id;
                return new StepResult({ outcome: Outcome.PARTIAL, questions: [`do step ${step.id}`], message: 'handed out' });
            }
            const result = evaluate(sidecar, step, rec, projectRoot, confirmedNow);
            if (result.ok) {
                const done: StepRecord = {
                    status: 'ok',
                    failed_approaches: rec.failed_approaches,
                    head,
                    step_sha: stepSha(sidecar, step),
                    inputs_sha: inputsSha(sidecar, step, projectRoot),
                };
                if (rec.adjudication !== undefined) done.adjudication = rec.adjudication;
                if (step.exit.kind === 'check' && result.basis !== undefined) done.basis = result.basis;
                data.steps[step.id] = done;
                return new StepResult({ outcome: Outcome.SUCCESS });
            }
            if (rec.status !== 'stale') rec.status = 'partial';
            rec.reason = result.reason;
            if (step.exit.kind !== 'judgement' || rec.status === 'stale') pushFailed(rec, result.reason);
            data.current = step.id;
            return new StepResult({ outcome: Outcome.PARTIAL, questions: [result.reason], message: result.reason });
        };

        const steps = new Map<string, Step>(sidecar.steps.map((s) => [s.id, handler(s)]));
        const delivery = _to_delivery(work);
        const [final, halting] = dispatch(delivery, steps, null, sidecar.steps.map((s) => s.id));
        _sync_back(work, delivery);
        if (final === Outcome.SUCCESS) data.current = null;
        atomicWrite(statePath, `${JSON.stringify(to_dict(work), null, 2)}\n`);

        if (final === Outcome.SUCCESS) {
            const recs = sidecar.steps.map((s) => ({ s, r: data.steps[s.id] }));
            const skipped = recs.filter((x) => x.r?.status === 'skipped').length;
            const taken = recs.filter((x) => x.r?.status !== 'skipped');
            const count = (cls: string): number => taken.filter((x) => exitClass(x.s, x.r) === cls).length;
            return {
                code: 0,
                output: [
                    ...notes,
                    `procedure ${sidecar.skill} complete — ${String(sidecar.steps.length)} steps: ${String(count('check-passed'))} check-passed, ` +
                        `${String(count('shape'))} shape, ${String(count('self-attested, not verified'))} self-attested, ${String(skipped)} skipped`,
                ].join('\n'),
            };
        }
        const step = byId.get(String(halting)) as SidecarStep;
        const rec = data.steps[step.id] as StepRecord;
        const headline =
            handedOut === step.id
                ? 'handed out — do this step, then run the cursor again'
                : rec.status === 'stale'
                  ? `stale: ${String(rec.reason)} — the exit is re-checked, the step is not handed out again`
                  : step.exit.kind === 'judgement'
                    ? 'awaiting confirmation'
                    : `exit not met: ${String(rec.reason)}`;
        return { code: 1, output: [...notes, ...brief(sidecar, data, step, headline)].join('\n') };
    } catch (exc) {
        if (exc instanceof Refusal || exc instanceof SidecarError) return { code: 2, output: `procedure: ${exc.message}` };
        throw exc;
    }
}
