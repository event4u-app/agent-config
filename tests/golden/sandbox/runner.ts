/**
 * Recipe-driven capture runner for the Golden Transcript sandbox (TS twin of
 * the retired `runner.py`).
 *
 * Plays the orchestrator role in the Option-A loop:
 *   1. Spawn `./agent-config implement-ticket` (ticket mode) or `work`
 *      (prompt/diff/file mode) against a sandbox repo.
 *   2. Read the resulting state JSON, stdout, exit code.
 *   3. Hand the post-cycle state to a recipe step keyed by the directive (or
 *      by `_no_directive` when the engine halts without one).
 *   4. Persist the mutated state and re-invoke the engine.
 *   5. Stop on exit 0 (SUCCESS), an unhandled halt, exit 2, or the cycle cap.
 *
 * The runner never edits engine state via private imports — all mutation goes
 * through the same JSON file the agent would write, keeping captured
 * transcripts representative of production use. The replay subject is the live
 * `.ts` work_engine invoked through `./agent-config`, exactly as production.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Dict } from './recipes/_helpers.js';

/** `tests/golden/sandbox` — directory of this file. */
export const SANDBOX_ROOT = path.dirname(fileURLToPath(import.meta.url));
/** Maintainer repo root — where `./agent-config` lives (sandbox → golden → tests → root). */
export const REPO_ROOT = path.resolve(SANDBOX_ROOT, '..', '..', '..');
/** Pristine toy-domain template; copied into a workspace per run. */
export const REPO_FIXTURE = path.join(SANDBOX_ROOT, 'repo');
/** Maintainer-facing CLI entry point used by the captures. */
export const AGENT_CONFIG = path.join(REPO_ROOT, 'agent-config');
/** Hard cap on cycles per scenario — guards against runaway recipes. */
export const DEFAULT_CYCLE_CAP = 10;

export const CMD_TICKET = 'implement-ticket';
export const CMD_WORK = 'work';

export interface CycleRecord {
    index: number;
    cmd: string[];
    exit_code: number;
    stdout: string;
    stderr: string;
    state_after: Dict;
    directive: string | null;
    recipe_action: string | null;
    recipe_notes: string[];
}

export interface CaptureResult {
    gt_id: string;
    ticket_file: string | null;
    persona: string | null;
    workspace: string;
    prompt_file: string | null;
    diff_file: string | null;
    file_file: string | null;
    subcommand: string;
    cycles: CycleRecord[];
    final_outcome: string;
    final_exit_code: number;
}

/** Recipe contract: take post-cycle state + record, return mutated state. */
export type RecipeStep = (state: Dict, record: CycleRecord) => Dict;

/** Materialise a fresh copy of the toy repo into `target`. */
export function prepare_workspace(target: string): void {
    if (fs.existsSync(target)) fs.rmSync(target, { recursive: true, force: true });
    fs.cpSync(REPO_FIXTURE, target, { recursive: true });
}

/** Run one engine cycle and return `[exit, stdout, stderr, state]`. */
export function invoke_engine(
    workspace: string,
    opts: {
        state_file: string;
        ticket_file?: string | null;
        prompt_file?: string | null;
        diff_file?: string | null;
        file_file?: string | null;
        subcommand?: string;
        persona?: string | null;
    },
): [number, string, string, Dict] {
    const subcommand = opts.subcommand ?? CMD_TICKET;
    // --no-hooks at runtime so a future settings change cannot silently
    // invalidate captured goldens.
    const args = [subcommand, '--state-file', opts.state_file, '--no-hooks'];
    if (opts.ticket_file != null) args.push('--ticket-file', opts.ticket_file);
    if (opts.prompt_file != null) args.push('--prompt-file', opts.prompt_file);
    if (opts.diff_file != null) args.push('--diff-file', opts.diff_file);
    if (opts.file_file != null) args.push('--file-file', opts.file_file);
    if (opts.persona != null) args.push('--persona', opts.persona);

    const proc = spawnSync(AGENT_CONFIG, args, {
        cwd: workspace,
        encoding: 'utf-8',
        env: {
            ...process.env,
            LC_ALL: 'C.UTF-8',
            LANG: 'C.UTF-8',
            NO_COLOR: '1',
            AGENT_CONFIG_QUIET_DEPRECATION: '1',
        },
    });
    let state: Dict = {};
    if (fs.existsSync(opts.state_file)) {
        try {
            state = JSON.parse(fs.readFileSync(opts.state_file, 'utf-8')) as Dict;
        } catch {
            state = {};
        }
    }
    return [proc.status ?? -1, proc.stdout ?? '', proc.stderr ?? '', state];
}

/** Return the directive verb when the engine halted with an `@agent-directive:` line. */
export function detect_directive(state: Dict): string | null {
    const questions = (state['questions'] as unknown[] | undefined) ?? [];
    if (questions.length === 0) return null;
    const first = questions[0];
    if (typeof first !== 'string') return null;
    const marker = '@agent-directive:';
    if (!first.includes(marker)) return null;
    const after = first.split(marker, 2)[1]!.trim();
    if (!after) return null;
    return after.split(/\s+/)[0]!;
}

/** Persist `state` exactly the way the engine itself does (indented JSON + trailing newline). */
export function write_state(state_file: string, state: Dict): void {
    fs.mkdirSync(path.dirname(state_file), { recursive: true });
    fs.writeFileSync(state_file, `${JSON.stringify(state, null, 2)}\n`, 'utf-8');
}

function _rel(base: string, target: string): string {
    const r1 = path.relative(base, target);
    if (!r1.startsWith('..') && !path.isAbsolute(r1)) return r1;
    const r2 = path.relative(SANDBOX_ROOT, target);
    if (!r2.startsWith('..') && !path.isAbsolute(r2)) return r2;
    return target;
}

function _relative_cmd(
    workspace: string,
    opts: {
        subcommand: string;
        ticket?: string | null;
        prompt?: string | null;
        diff?: string | null;
        file?: string | null;
        persona?: string | null;
        state_file: string;
    },
): string[] {
    const cmd = ['./agent-config', opts.subcommand, '--state-file', _rel(workspace, opts.state_file)];
    if (opts.ticket != null) cmd.push('--ticket-file', _rel(workspace, opts.ticket));
    if (opts.prompt != null) cmd.push('--prompt-file', _rel(workspace, opts.prompt));
    if (opts.diff != null) cmd.push('--diff-file', _rel(workspace, opts.diff));
    if (opts.file != null) cmd.push('--file-file', _rel(workspace, opts.file));
    if (opts.persona != null) cmd.push('--persona', opts.persona);
    return cmd;
}

/** Drive a Golden Transcript end-to-end and return the transcript. */
export function run_capture(opts: {
    gt_id: string;
    workspace: string;
    recipe: Record<string, RecipeStep>;
    ticket_file?: string | null;
    prompt_file?: string | null;
    diff_file?: string | null;
    file_file?: string | null;
    persona?: string | null;
    cycle_cap?: number;
    state_filename?: string;
    seed_state?: Dict | null;
}): CaptureResult {
    const ticket_file = opts.ticket_file ?? null;
    const prompt_file = opts.prompt_file ?? null;
    const diff_file = opts.diff_file ?? null;
    const file_file = opts.file_file ?? null;
    const persona = opts.persona ?? null;
    const cycle_cap = opts.cycle_cap ?? DEFAULT_CYCLE_CAP;
    const seed_state = opts.seed_state ?? null;
    const state_filename = opts.state_filename ?? '.implement-ticket-state.json';

    const supplied = [ticket_file, prompt_file, diff_file, file_file].filter((p) => p != null);
    if (supplied.length !== 1) {
        throw new Error(
            'run_capture requires exactly one of ticket_file / prompt_file / diff_file / file_file; ' +
                `got ticket_file=${ticket_file}, prompt_file=${prompt_file}, diff_file=${diff_file}, ` +
                `file_file=${file_file}`,
        );
    }
    const subcommand = ticket_file != null ? CMD_TICKET : CMD_WORK;
    prepare_workspace(opts.workspace);
    const state_file = path.join(opts.workspace, state_filename);
    if (seed_state != null) write_state(state_file, seed_state);

    const result: CaptureResult = {
        gt_id: opts.gt_id,
        ticket_file,
        prompt_file,
        diff_file,
        file_file,
        subcommand,
        persona,
        workspace: opts.workspace,
        cycles: [],
        final_outcome: 'unknown',
        final_exit_code: -1,
    };

    for (let cycle_index = 1; cycle_index <= cycle_cap; cycle_index += 1) {
        const first_cycle = cycle_index === 1 && seed_state == null;
        const ticket_arg = first_cycle ? ticket_file : null;
        const prompt_arg = first_cycle ? prompt_file : null;
        const diff_arg = first_cycle ? diff_file : null;
        const file_arg = first_cycle ? file_file : null;
        const persona_arg = first_cycle ? persona : null;

        const [exit_code, stdout, stderr, state] = invoke_engine(opts.workspace, {
            state_file,
            ticket_file: ticket_arg,
            prompt_file: prompt_arg,
            diff_file: diff_arg,
            file_file: file_arg,
            subcommand,
            persona: persona_arg,
        });
        const directive = Object.keys(state).length > 0 ? detect_directive(state) : null;
        const record: CycleRecord = {
            index: cycle_index,
            cmd: _relative_cmd(opts.workspace, {
                subcommand,
                ticket: ticket_arg,
                prompt: prompt_arg,
                diff: diff_arg,
                file: file_arg,
                persona: persona_arg,
                state_file,
            }),
            exit_code,
            stdout,
            stderr,
            state_after: state,
            directive,
            recipe_action: null,
            recipe_notes: [],
        };
        result.cycles.push(record);

        if (exit_code === 0) {
            result.final_outcome = 'success';
            result.final_exit_code = 0;
            return result;
        }
        if (exit_code === 2) {
            result.final_outcome = 'config_error';
            result.final_exit_code = 2;
            return result;
        }

        const key = directive ?? '_no_directive';
        const step = opts.recipe[key];
        if (step === undefined) {
            result.final_outcome = `halt_unhandled:${key}`;
            result.final_exit_code = exit_code;
            return result;
        }
        record.recipe_action = key;
        const new_state = step(state, record);
        write_state(state_file, new_state);
    }

    result.final_outcome = 'cycle_cap_reached';
    result.final_exit_code = result.cycles[result.cycles.length - 1]!.exit_code;
    return result;
}

function _rel_fixture(p: string | null): string | null {
    if (p == null) return null;
    const r = path.relative(SANDBOX_ROOT, p);
    if (!r.startsWith('..') && !path.isAbsolute(r)) return r;
    return p;
}

/** Produce the JSON-safe transcript payload for a Capture Pack. */
export function serialise_capture(result: CaptureResult): Dict {
    const payload: Dict = { gt_id: result.gt_id };
    if (result.prompt_file != null) {
        payload['subcommand'] = result.subcommand;
        payload['prompt_file'] = _rel_fixture(result.prompt_file);
    } else if (result.diff_file != null) {
        payload['subcommand'] = result.subcommand;
        payload['diff_file'] = _rel_fixture(result.diff_file);
    } else if (result.file_file != null) {
        payload['subcommand'] = result.subcommand;
        payload['file_file'] = _rel_fixture(result.file_file);
    } else {
        payload['ticket_file'] = _rel_fixture(result.ticket_file);
    }
    payload['persona'] = result.persona;
    payload['final_outcome'] = result.final_outcome;
    payload['final_exit_code'] = result.final_exit_code;
    payload['cycles'] = result.cycles.map((c) => ({ ...c }));
    return payload;
}
