/**
 * Masked exit codes: does a recorded exit code belong to the verifier, or to a
 * `tail`, an `echo` or a later command on the same line?
 *
 * OFF THE LIVE HOOK PATH, by owner decision (2026-11-21, option 2). The
 * turn-end gate's dispatch bundle may not grow, so nothing the hook dispatcher
 * imports reaches this module: the roadmap lint, the coverage report and the
 * tests read it. Wiring `exit_masked` into `classifyRun` on the live path, and
 * the bundle raise that needs, is `road-to-done-claims-with-read-exit-codes-live-wiring`.
 */

import {
    failureIsDiscarded,
    segmentVerifies,
    splitSegments,
    stripComment,
    type Segment,
} from './verification_command.js';
import { classifyRun, type VerificationVerdict } from './verification_evidence.js';

/** How a command line hides its verifier's exit code from the recorder. */
export type ExitMasking = 'pipe' | 'trailing';

/** Whether a shell option covers a pipeline; `unknown` when the text cannot say. */
type Setting = 'on' | 'off' | 'unknown';

/** One pipeline: its segments, the separator after it, and the options covering it. */
interface Pipeline {
    readonly segs: readonly Segment[];
    readonly sepAfter: '&&' | '||' | ';' | null;
    readonly pipefail: Setting;
    readonly errexit: Setting;
}

/**
 * What a plain `set` turns on or off: `-e`, `-o errexit`, `-o pipefail`, and the
 * `+` forms, in clusters (`-euo pipefail`). null for anything else it is given.
 */
function setOptions(words: readonly string[]): { pipefail?: boolean; errexit?: boolean } | null {
    if (words[0] !== 'set' || words.length < 2) return null;
    const out: { pipefail?: boolean; errexit?: boolean } = {};
    for (let i = 1; i < words.length; i += 1) {
        const w = words[i] as string;
        if (!/^[-+][A-Za-z]+$/.test(w)) return null;
        const on = w[0] === '-';
        for (const flag of w.slice(1)) {
            if (flag === 'e') out.errexit = on;
            else if (flag === 'o') {
                const name = words[i + 1];
                if (name === 'pipefail') out.pipefail = on;
                else if (name === 'errexit') out.errexit = on;
                else return null;
                i += 1;
            } else if (!'uxv'.includes(flag)) return null;
        }
    }
    return out;
}

function pipelinesOf(command: string): Pipeline[] {
    const out: Pipeline[] = [];
    let cur: Segment[] = [];
    let pipefail: Setting = 'off';
    let errexit: Setting = 'off';
    let sepBefore: Pipeline['sepAfter'] = null;
    for (const seg of splitSegments(stripComment(command))) {
        cur.push(seg);
        if (seg.nextSep === '|') continue;
        out.push({ segs: cur, sepAfter: seg.nextSep as Pipeline['sepAfter'], pipefail, errexit });
        // A plain `set` that runs for sure and in this shell — alone (a pipeline runs it in
        // a subshell), not behind `&&` / `||` — sets pipefail / errexit on or off. Any other
        // segment with a `set` or `shopt` word leaves them `unknown` (D10): the walk then
        // follows both settings, so neither is assumed.
        const sure = cur.length === 1 && (sepBefore === null || sepBefore === ';');
        const opts = sure ? setOptions((cur[0] as Segment).words) : null;
        if (opts !== null) {
            if (opts.pipefail !== undefined) pipefail = opts.pipefail ? 'on' : 'off';
            if (opts.errexit !== undefined) errexit = opts.errexit ? 'on' : 'off';
        } else if (cur.some((x) => /\b(?:set|shopt)\b/.test(x.words.join(' ')))) {
            pipefail = 'unknown';
            errexit = 'unknown';
        }
        sepBefore = seg.nextSep as Pipeline['sepAfter'];
        cur = [];
    }
    return out;
}

/** Index, within its pipeline, of the verifying segment; -1 when none. */
function verifierIndex(p: Pipeline): number {
    for (let i = p.segs.length - 1; i >= 0; i -= 1) {
        const seg = p.segs[i] as Segment;
        if (!failureIsDiscarded(seg) && segmentVerifies(seg.words)) return i;
    }
    return -1;
}


/**
 * One pass over the line's pipelines, tracking every shell state that can reach
 * each one. A state is the current status (0 / nonzero), the outcome of the last
 * verifier that ran, whether that verifier's pipeline reports a filter's status,
 * and whether the shell ended. There are at most 24 distinct states, so the pass is linear in the line.
 *
 * Both `exitMasking` and `commandSegments` read this one walk, so "which commands
 * can run" and "whose status is recorded" follow the same reachability rules:
 * `;` always runs the next pipeline, `&&` only on 0, `||` only on nonzero; a lone
 * `exit` ends the shell (inside a pipeline it ends only its subshell); a top-level
 * `return` in a Bash call errors and the line goes on, so it is an ordinary command.
 */
type Verdict = 'none' | 'pass' | 'fail';
interface FlowState {
    readonly zero: boolean;
    readonly last: Verdict;
    /** The last verifier ran inside a pipeline whose status is a filter's. */
    readonly filtered: boolean;
    readonly ended: boolean;
}

interface Flow {
    /** For each pipeline, whether any state runs it. */
    readonly runs: readonly boolean[];
    /** The states the line can end in. */
    readonly finals: readonly FlowState[];
}

function keyOf(s: FlowState): string {
    return `${s.zero ? 0 : 1}${s.last}${s.filtered ? 1 : 0}${s.ended ? 1 : 0}`;
}

function uniq(states: readonly FlowState[]): FlowState[] {
    const seen = new Map<string, FlowState>();
    for (const s of states) if (!seen.has(keyOf(s))) seen.set(keyOf(s), s);
    return [...seen.values()];
}

/** The states running pipeline `p` can leave behind, from state `s`. */
function step(s: FlowState, p: Pipeline): FlowState[] {
    const runs =
        p.pipefail === 'unknown' ? [...stepUnder(s, p, true), ...stepUnder(s, p, false)] : stepUnder(s, p, p.pipefail === 'on');
    // errexit ends the shell on a failing pipeline that closes its list (`;` or the end);
    // a failure inside an `&&` / `||` list does not. Unknown: both.
    if (p.errexit === 'off' || p.sepAfter === '&&' || p.sepAfter === '||') return runs;
    return runs.flatMap((r) => {
        if (r.zero || r.ended) return [r];
        const exited = { ...r, ended: true };
        return p.errexit === 'on' ? [exited] : [r, exited];
    });
}

function stepUnder(s: FlowState, p: Pipeline, pipefail: boolean): FlowState[] {
    const lone = p.segs.length === 1;
    // The shell's own `exit`, not an executable that happens to be named so.
    if (lone && p.segs[0]?.words[0] === 'exit') {
        // The argument without its redirections (`>x`, `2>&1`, `-1>x`, or `>` and its
        // target). Digits right before `<` / `>` name a file descriptor, not an argument.
        const words = p.segs[0].words.slice(1);
        const args: string[] = [];
        let redirected = false;
        for (let i = 0; i < words.length; i += 1) {
            const w = words[i] as string;
            const at = w.search(/[<>]/);
            if (at === -1) {
                args.push(w);
                continue;
            }
            redirected = true;
            const before = w.slice(0, at);
            if (before !== '' && !/^\d+$/.test(before)) args.push(before);
            if (/^[<>]+&?$/.test(w.slice(at))) i += 1;
        }
        const arg = args.join(' ').replace(/^["']|["']$/g, '');
        let ran: FlowState[];
        if (arg === '' || arg === '$?') ran = [{ ...s, ended: true }];
        else if (/^[+-]?\d+$/.test(arg)) ran = [{ ...s, zero: BigInt(arg) % 256n === 0n, ended: true }];
        // Any other argument, `${PIPESTATUS[k]}` included (D10): the text cannot say which
        // pipeline ran last, so the status it hands on is unknown.
        else ran = [{ ...s, zero: true, ended: true }, { ...s, zero: false, ended: true }];
        // A failed redirection stops `exit` from running; the line goes on with a nonzero.
        return redirected ? [...ran, { ...s, zero: false }] : ran;
    }
    const k = verifierIndex(p);
    // The pipeline's status is its last command's; under pipefail any failing member fails
    // it, and it passes only when every member does. `true` / `:` pass and `false` fails;
    // any other non-verifier member may do either. One rule, with or without a verifier.
    // The bare words only: `/x/true` is an executable, not the builtin; and a segment with
    // a redirection can fail on the redirection, so its status is unknown.
    const heads = p.segs.map((seg) => (seg.words.some((w) => /[<>]/.test(w)) ? '' : (seg.words[0] ?? '')));
    const lastAt = heads.length - 1;
    const passes = (x: string): boolean => x === 'true' || x === ':';
    const others = heads.filter((_, i) => i !== k);
    const zeros = (verifier: Verdict): boolean[] => {
        if (pipefail) {
            if (verifier === 'fail' || others.includes('false')) return [false];
            return others.every(passes) ? [true] : [true, false];
        }
        if (k === lastAt) return [verifier === 'pass'];
        const last = heads[lastAt] as string;
        if (last === 'false') return [false];
        return passes(last) ? [true] : [true, false];
    };
    // A plain `set` the walk read succeeds.
    if (k === -1 && lone && setOptions((p.segs[0] as Segment).words) !== null) return [{ ...s, zero: true }];
    if (k === -1) return zeros('none').map((zero) => ({ ...s, zero }));
    // A 0 says nothing about the verifier when a filter after it reports the status.
    const filtered = !pipefail && k !== lastAt;
    const out: FlowState[] = [];
    for (const last of ['pass', 'fail'] as const) {
        for (const zero of zeros(last)) out.push({ ...s, zero, last, filtered });
    }
    return out;
}

function flowOf(ps: readonly Pipeline[]): Flow {
    let states: FlowState[] = [{ zero: true, last: 'none', filtered: false, ended: false }];
    const runs: boolean[] = [];
    for (let i = 0; i < ps.length; i += 1) {
        const p = ps[i] as Pipeline;
        const sep = i === 0 ? ';' : (ps[i - 1] as Pipeline).sepAfter;
        const next: FlowState[] = [];
        let ran = false;
        for (const s of states) {
            const go = !s.ended && (sep === ';' || sep === null || (sep === '&&' ? s.zero : !s.zero));
            if (!go) {
                next.push(s);
                continue;
            }
            ran = true;
            next.push(...step(s, p));
        }
        runs.push(ran);
        states = uniq(next);
    }
    return { runs, finals: states };
}

/** The segments of a command line that can run, as text: the commands it runs, not the words it mentions. */
export function commandSegments(command: string): string[] {
    if (!command) return [];
    const ps = pipelinesOf(command);
    const { runs } = flowOf(ps);
    const out: string[] = [];
    ps.forEach((p, i) => {
        if (runs[i]) for (const seg of p.segs) out.push(seg.words.join(' '));
    });
    return out;
}

/**
 * Does the exit code of this command line belong to something other than the
 * command that verified?
 *
 * The recorder keeps ONE exit code per call: the status of the last pipeline
 * that ran. `tsc | tail -5` reports `tail`'s 0, and `task ci; echo "exit=$?"`
 * reports `echo`'s 0, so a failing run reads as a pass. The question asked of
 * the line is exact: can it end with a 0 while the last verifier that ran did
 * not pass (or none ran)? If so, a recorded 0 proves nothing about the verifier.
 *
 * - `pipe`: that 0 can come from a filter after the verifier — no earlier
 *   unconditional `set -o pipefail` covers the pipeline. `PIPESTATUS`, printed
 *   or passed to `exit`, carries nothing (D10). A pipefail from an rc file is
 *   invisible here, which is why the reason is an instrument gap.
 * - `trailing`: that 0 can come from a later command — `cmd; echo`, `cmd || echo`,
 *   `cmd || false; echo ready`, `cmd || exit 0`, or a verifier that `||` skips.
 *   `cmd && echo ok`, `cmd || exit 1`, `cmd; exit $?` and `task sync; task ci`
 *   end with a 0 only when the verifier passed. `cmd || true` is a discard,
 *   not a verifier.
 */
export function exitMasking(command: string): ExitMasking | null {
    if (!command) return null;
    const ps = pipelinesOf(command);
    if (!ps.some((p) => verifierIndex(p) !== -1)) return null;
    const bad = flowOf(ps).finals.filter((s) => s.zero && s.last !== 'pass');
    if (bad.length === 0) return null;
    return bad.some((s) => s.filtered) ? 'pipe' : 'trailing';
}


/** `classifyRun`'s verdicts plus the one this module adds. */
export type MaskedVerdict = VerificationVerdict | { readonly kind: 'INVALID_RUN'; readonly reason: 'exit_masked' };

/**
 * `classifyRun`, with a masked exit code read as a gap instead of a pass.
 *
 * Only a pass is replaced (D9): a nonzero code keeps the verdict it always had,
 * so masking can turn a pass into a gap but never demote a refusal. A printed
 * failure, a load failure and an empty suite are read off the output by
 * `classifyRun` and are never passes, so they keep their verdicts. No `exit=N`
 * line in the output is read in place of the code (D8).
 */
export function classifyRunWithMasking(record: unknown): MaskedVerdict {
    const verdict = classifyRun(record);
    if (verdict.kind !== 'PASS_EVIDENCE_OK') return verdict;
    const command = (record as { command?: unknown }).command;
    if (typeof command === 'string' && exitMasking(command) !== null) {
        return { kind: 'INVALID_RUN', reason: 'exit_masked' };
    }
    return verdict;
}

