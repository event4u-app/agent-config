/**
 * Checkpoint / resume for the ab-v2 sweep, and the float wrapper its lossless
 * round-trip needs. Moved out of `bench_ab_v2_run.ts`, which sits past the
 * source-size cap; that file re-exports every name here.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';

type Dict = Record<string, unknown>;

/** A number that renders as a Python float (`1.0`, not `1`) in the report. */
export class PyFloat {
    constructor(readonly value: number) {}
}

// ── checkpoint / resume ─────────────────────────────────────────────────────
//
// A sweep of tasks × arms × seeds can run for hours; without a checkpoint, a
// kill (manual stop, harness timeout, machine sleep) loses EVERY completed run
// because results only exist in memory until the single final report write.
// The checkpoint is a JSONL file (one line per completed run) so each write is
// a single atomic-enough append and a truncated tail line (killed mid-write)
// is simply skipped on load. The file is keyed by a hash of the run config —
// a restart with different flags gets a different checkpoint and never mixes
// results from an incompatible sweep.

/** Stable id key for one run inside a sweep. */
export function run_key(task_id: string, arm: string, seed: number): string {
    return `${task_id}|${arm}|${seed}`;
}

/**
 * Hash of the sweep configuration — everything that changes what a run means.
 * Same flags → same key → resume; any config change → fresh checkpoint file.
 */
export function checkpoint_key(cfg: {
    corpus: string;
    model: string;
    seeds: number;
    arms: string[];
    budget: number;
    timeout: number;
    host: string;
    /** Set only for a non-host isolation, so every existing host key stays byte-identical. */
    isolation?: string;
    task_ids: string[];
}): string {
    const stable = JSON.stringify([
        cfg.corpus,
        cfg.model,
        cfg.seeds,
        cfg.arms,
        cfg.budget,
        cfg.timeout,
        cfg.host,
        cfg.task_ids,
        ...(cfg.isolation ? [cfg.isolation] : []),
    ]);
    return createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

/**
 * JSON round-trip loses the PyFloat wrapper (1.0 parses back as 1), which
 * would break the byte-parity float rendering of the final report on resume.
 * freeze/thaw make the checkpoint lossless: PyFloat → {"__pyfloat__": n} on
 * write, restored to PyFloat on load.
 */
export function freeze_result(v: unknown): unknown {
    if (v instanceof PyFloat) {
        return { __pyfloat__: v.value };
    }
    if (Array.isArray(v)) {
        return v.map((x) => freeze_result(x));
    }
    if (v && typeof v === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            out[k] = freeze_result(val);
        }
        return out;
    }
    return v;
}

export function thaw_result(v: unknown): unknown {
    if (Array.isArray(v)) {
        return v.map((x) => thaw_result(x));
    }
    if (v && typeof v === 'object') {
        const o = v as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 1 && keys[0] === '__pyfloat__' && typeof o['__pyfloat__'] === 'number') {
            return new PyFloat(o['__pyfloat__']);
        }
        const out: Record<string, unknown> = {};
        for (const [k, val] of Object.entries(o)) {
            out[k] = thaw_result(val);
        }
        return out;
    }
    return v;
}

/**
 * Load completed runs from a checkpoint file. Tolerant by design: a missing
 * file → empty map; an unparseable line (truncated tail from a mid-write
 * kill) → skipped; a duplicate key → last line wins.
 */
export function load_checkpoint(file: string): Map<string, Dict> {
    const map = new Map<string, Dict>();
    let raw: string;
    try {
        raw = fs.readFileSync(file, 'utf-8');
    } catch {
        return map;
    }
    for (const line of raw.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        let entry: unknown;
        try {
            entry = JSON.parse(trimmed);
        } catch {
            continue; // truncated tail — the run it held simply re-executes
        }
        if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const e = entry as Record<string, unknown>;
            if (typeof e['key'] === 'string' && e['result'] && typeof e['result'] === 'object') {
                map.set(e['key'], thaw_result(e['result']) as Dict);
            }
        }
    }
    return map;
}

/** Append one completed run to the checkpoint (single-line atomic append). */
export function append_checkpoint(file: string, key: string, result: Dict): void {
    fs.appendFileSync(file, JSON.stringify({ key, result: freeze_result(result) }) + '\n', {
        encoding: 'utf-8',
    });
}

export interface CheckpointIO {
    /** Checkpoint file to append completed runs to (created on first append). */
    path: string;
    /** Runs already completed by a prior (killed) sweep — reused, not re-run. */
    completed: Map<string, Dict>;
}

