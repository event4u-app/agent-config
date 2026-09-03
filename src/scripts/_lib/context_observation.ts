/**
 * The situational-awareness fingerprint a run last OBSERVED, recorded where a
 * stop-path concern can read it without spawning anything.
 *
 * `road-to-wired-instruments` Phase 2.1. The fingerprint itself is built by
 * `roadmap_context.ts` from `origin/main` plus every open PR head — which costs
 * a `gh` call, so it can only be taken by the probe and never by a hook on the
 * Stop path, where a subprocess is a cost paid on every reply.
 *
 * ## Why a file, and why this comparison and not another
 *
 * `run_checkpoint.RunCheckpoint.context_fingerprint` already had the right idea
 * and no producer: `session_eol_hook` built its checkpoints without ever passing
 * one, so the field was `null` in every checkpoint this package has ever
 * written. A drift detector whose input is structurally always-null reports no
 * drift, forever — the defect class this roadmap exists over, in the mechanism
 * meant to catch it. This module is the missing producer, and it makes the
 * value reachable from BOTH consumers: the checkpoint and the continuation
 * ladder.
 *
 * The comparison the ladder makes is deliberately narrow: the fingerprint this
 * run ENGAGED under, against the newest one the run itself has OBSERVED. It is
 * not "has `origin/main` moved", which changes constantly and would halt every
 * long run within a day (Risk 1 of the roadmap). Nothing is observed unless the
 * run re-probes, so the rung cannot fire on repository traffic the run never
 * looked at — it fires when the run looked, and what it saw had changed.
 *
 * Best-effort throughout. A failed write or an unreadable file is `null`, which
 * reads as "not known" and never as "unchanged": an absent observation must
 * never manufacture a halt, and must never assert the world stood still either.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

import { atomicWriteJson } from './loop_guards.js';

export const CONTEXT_OBSERVATION_REL = path.join(
    'agents',
    'runtime',
    'state',
    'context-observation.json',
);

/**
 * One probe's reading.
 *
 * NOT keyed on a roadmap, because the fingerprint is not scoped to one:
 * `contextFingerprint(base_sha, open_prs)` takes the base ref and every open PR
 * head and no roadmap at all. A per-roadmap file would key a repository-wide
 * fact on something it does not depend on, and would then miss every observation
 * taken by an unscoped `roadmap:context` run. `roadmap` is recorded as
 * provenance — which invocation took the reading — never as a lookup key.
 */
export interface ContextObservation {
    readonly schema_version: 1;
    /** The roadmap the probe was scoped to, or `''` when it was unscoped. */
    readonly roadmap: string;
    /** `roadmap_context.contextFingerprint()` — compared, never parsed. */
    readonly fingerprint: string;
    /** ISO-8601 instant of the observation. */
    readonly at: string;
}

/** The single observation file. */
export function observationFile(repoRoot: string): string {
    return path.join(repoRoot, CONTEXT_OBSERVATION_REL);
}

/**
 * Record what the probe just saw. Returns whether the write landed.
 *
 * Never throws: this is called from a reporting command, and a command that
 * fails because it could not write a diagnostic breadcrumb is worse than one
 * whose breadcrumb is missing.
 */
export function recordContextObservation(
    repoRoot: string,
    scope: string,
    fingerprint: string,
    now: () => Date = () => new Date(),
): boolean {
    if (fingerprint.trim() === '') return false;
    const obs: ContextObservation = {
        schema_version: 1,
        roadmap: scope,
        fingerprint,
        at: now().toISOString(),
    };
    try {
        fs.mkdirSync(path.dirname(observationFile(repoRoot)), { recursive: true });
    } catch {
        return false;
    }
    return atomicWriteJson(observationFile(repoRoot), obs);
}

/** The newest recorded observation, or `null` when none reads. */
export function readContextObservation(repoRoot: string): ContextObservation | null {
    try {
        const parsed: unknown = JSON.parse(fs.readFileSync(observationFile(repoRoot), 'utf-8'));
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
        const o = parsed as Record<string, unknown>;
        if (typeof o['fingerprint'] !== 'string' || o['fingerprint'] === '') return null;
        if (typeof o['at'] !== 'string') return null;
        return {
            schema_version: 1,
            roadmap: typeof o['roadmap'] === 'string' ? o['roadmap'] : '',
            fingerprint: o['fingerprint'],
            at: o['at'],
        };
    } catch {
        return null;
    }
}

/**
 * Has the plan premise moved?
 *
 * TRUE only when both sides are known AND differ. An unknown on either side is
 * "not known", exactly as `run_checkpoint.verifyCheckpoint` treats `head` and
 * `context_fingerprint`: a detector that reads "I could not tell" as "it moved"
 * halts healthy runs, and one false alarm on a rung that ends a run costs more
 * than a missed one, because it trains the operator to switch the rung off.
 */
export function premiseMoved(
    claimed: string | null | undefined,
    observed: string | null | undefined,
): boolean {
    if (claimed === null || claimed === undefined || claimed === '') return false;
    if (observed === null || observed === undefined || observed === '') return false;
    return claimed !== observed;
}
