/**
 * Does a delivered rule body actually reach the model's context on this host?
 *
 * `road-to-delivery-on-hook-hosts` step 1.1, and the record owner ruling E3
 * admits a host on.
 *
 * THE ONE THING THIS MODULE EXISTS TO REFUSE
 * ------------------------------------------
 * A host that BINDS `user_prompt_submit` looks, from every artefact in this
 * tree, exactly like a host that DELIVERS. Cowork is the proof that they are
 * different: it binds eight slots and its trampoline discards dispatcher output
 * and `exit 0`s (`docs/enforcement-by-host.md:21`). Cursor and Cline bind the
 * same slot the delivery concern needs, and whether their hook stdout reaches
 * the model is unmeasured.
 *
 * So the binding is computable and the effect is not. This module keeps them
 * apart by construction:
 *
 *   · `emits`             — computed. Is the concern bound on the slot at all?
 *                           Read from the manifest. Cheap, always available,
 *                           and NEVER promoted to an observation.
 *   · `injection_effect`  — observed. Did a model visibly act on a delivered
 *                           body? Read from a committed record and from nowhere
 *                           else. There is no code path that derives it.
 *
 * An `observed-*` value is admissible only with the four-part citation the
 * host-capability observation protocol requires (host · host version ·
 * transcript or artefact reference · date) — see
 * `_lib/host_capability.ts:183`. A record missing any part is rejected rather
 * than downgraded, because a half-cited observation is the shape that gets
 * quoted as a whole one.
 *
 * `unobserved` is a RESULT, not a gap. Most hosts cannot be observed from a
 * Claude Code session at all, and the roadmap's K6 makes that an outcome: the
 * host keeps its full rule bodies and loses nothing while it waits.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Where the committed observations live. One file, so there is one place to audit. */
export const RECORD_REL = path.join('src', 'config', 'host-injection-effect.json');

/**
 * The three states, and the reason there is no fourth.
 *
 * `observed-false` is not "probably not" — it is a recorded observation that a
 * delivered body did NOT reach the model, which is as citable as the positive.
 * Anything not observed in either direction is `unobserved`.
 */
export const INJECTION_STATES = ['observed-true', 'observed-false', 'unobserved'] as const;
export type InjectionState = (typeof INJECTION_STATES)[number];

export interface InjectionObservation {
    readonly state: InjectionState;
    /** Host version the observation was taken on. Required for an `observed-*` state. */
    readonly host_version: string | null;
    /** Transcript or artefact reference. Required for an `observed-*` state. */
    readonly transcript: string | null;
    /** ISO date of the observation. Required for an `observed-*` state. */
    readonly date: string | null;
    /** Why it reads the way it does — required always, including for `unobserved`. */
    readonly reason: string;
}

export type InjectionRecord = Readonly<Record<string, InjectionObservation>>;

/** A malformed or under-cited row, in the words a maintainer needs to fix it. */
export interface InjectionProblem {
    readonly host: string;
    readonly message: string;
}

/**
 * Validate a record.
 *
 * The citation requirement is enforced HERE rather than at the reader, so every
 * consumer gets the same answer: an `observed-*` row without all three citation
 * fields is a problem, and `unobserved` needs only its reason.
 */
export function recordProblems(rec: InjectionRecord): InjectionProblem[] {
    const out: InjectionProblem[] = [];
    for (const [host, obs] of Object.entries(rec)) {
        // A leading `_comment` is the convention every config JSON in this tree
        // uses to carry its own contract, and it is not a host row. Skipping the
        // underscore prefix rather than a literal `_comment` keeps a second
        // annotation key from becoming a fake host with a fake verdict.
        if (host.startsWith('_')) continue;
        if (!(INJECTION_STATES as readonly string[]).includes(obs.state)) {
            out.push({ host, message: `state ${JSON.stringify(obs.state)} is not one of ${INJECTION_STATES.join(' | ')}` });
            continue;
        }
        if (typeof obs.reason !== 'string' || obs.reason.trim().length < 20) {
            out.push({ host, message: 'reason is missing or shorter than 20 characters — an unexplained row reads as answered' });
        }
        if (obs.state === 'unobserved') continue;
        for (const field of ['host_version', 'transcript', 'date'] as const) {
            const v = obs[field];
            if (typeof v !== 'string' || v.trim() === '') {
                out.push({
                    host,
                    message:
                        `state ${obs.state} without \`${field}\` — the observation protocol ` +
                        '(host · host version · transcript · date) admits no partial citation',
                });
            }
        }
    }
    return out;
}

/** Load the committed record. A missing file is an empty record, never a throw. */
export function loadRecord(root: string): InjectionRecord {
    try {
        return JSON.parse(fs.readFileSync(path.join(root, RECORD_REL), 'utf-8')) as InjectionRecord;
    } catch {
        return {};
    }
}

/**
 * The state for one host — `unobserved` when the record says nothing.
 *
 * Defaulting to `unobserved` rather than to a computed guess is the whole
 * contract: a host nobody has looked at must never inherit a neighbour's
 * verdict, and a bound slot must never imply a delivered body.
 */
export function stateFor(rec: InjectionRecord, host: string): InjectionState {
    return rec[host]?.state ?? 'unobserved';
}

/**
 * Is the concern bound on this host's slot? Computed from the manifest.
 *
 * Deliberately a separate function from `stateFor`, with a name that cannot be
 * mistaken for it. This answers "could a body be emitted here", never "did one
 * arrive".
 */
export function concernBound(
    platforms: Readonly<Record<string, Readonly<Record<string, readonly string[]>>>>,
    host: string,
    slot: string,
    concern: string,
): boolean {
    return (platforms[host]?.[slot] ?? []).includes(concern);
}

/** Does this host admit to `lean_projection.hosts` under E3? Observation only. */
export function admissibleUnderE3(rec: InjectionRecord, host: string): boolean {
    return stateFor(rec, host) === 'observed-true';
}
