#!/usr/bin/env node
/**
 * `./agent-config telemetry:record` — append one engagement event.
 *
 * TypeScript twin of `telemetry_record.py` (ADR-094). Byte-for-byte parity on
 * stdout / stderr / exit code and on the written JSONL line.
 *
 * Default-off: when `enabled: false` (default) the script exits 0 silently and
 * performs zero file IO.
 *
 * Exit codes:
 *   0   success or disabled (silent)
 *   1   schema-validation failure
 *   2   IO / settings parse error
 */
import * as fs from 'node:fs';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { record_event } from './telemetry/boundary.js';
import {
    ALLOWED_OUTCOMES,
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
} from './telemetry/engagement.js';
import { type TelemetrySettings, read_settings } from './telemetry/settings.js';

/** Mirror Python `raise SystemExit(msg)` — prints msg to stderr, exit 1. */
class SystemExitError extends Error {
    constructor(public payload: string) {
        super(payload);
    }
}

/** Turn `["skills:a", "skills:b", "rules:c"]` into a kind→ids dict. */
function _parse_kv_list(values: string[]): Record<string, string[]> {
    const out: Record<string, string[]> = {};
    for (const raw of values) {
        if (!raw.includes(':')) {
            throw new SystemExitError(
                `❌  --consulted/--applied must be 'kind:id', got ${_reprStr(raw)}`,
            );
        }
        const idx = raw.indexOf(':');
        const kind = raw.slice(0, idx).trim();
        const art_id = raw.slice(idx + 1).trim();
        if (!kind || !art_id) {
            throw new SystemExitError(`❌  empty kind or id in ${_reprStr(raw)}`);
        }
        (out[kind] ??= []).push(art_id);
    }
    return out;
}

function _reprStr(s: string): string {
    return `'${s}'`;
}

interface RecordArgs {
    task_id: string;
    boundary: string;
    consulted: string[] | null;
    applied: string[] | null;
    outcome: string[] | null;
    ts: string;
    payload_file: string | null;
    stdin: boolean;
    settings: string;
    force: boolean;
}

function _build_event_from_args(args: RecordArgs): EngagementEvent {
    return new EngagementEvent({
        ts: args.ts || now_utc_iso(),
        task_id: args.task_id,
        boundary_kind: args.boundary,
        consulted: _parse_kv_list(args.consulted ?? []),
        applied: _parse_kv_list(args.applied ?? []),
        outcomes: args.outcome && args.outcome.length > 0 ? [...args.outcome] : null,
    });
}

function _build_event_from_payload(raw: string): EngagementEvent {
    let data: unknown;
    try {
        data = JSON.parse(raw);
    } catch (exc) {
        throw new SystemExitError(
            `❌  payload is not valid JSON: ${exc instanceof Error ? exc.message : String(exc)}`,
        );
    }
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
        throw new SystemExitError('❌  payload must be a JSON object');
    }
    const d = data as Record<string, unknown>;
    return new EngagementEvent({
        ts: (d['ts'] as string) || now_utc_iso(),
        task_id: (d['task_id'] as string) ?? '',
        boundary_kind: (d['boundary_kind'] as string) ?? '',
        consulted: _orEmpty(d['consulted']),
        applied: _orEmpty(d['applied']),
        outcomes: (d['outcomes'] as string[] | null | undefined) ?? null,
        tokens_estimate: (d['tokens_estimate'] as Record<string, number> | null | undefined) ?? null,
    });
}

function _orEmpty(v: unknown): Record<string, string[]> {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
        return v as Record<string, string[]>;
    }
    return {};
}

class ArgError extends Error {}

function _parseArgs(argv: string[]): RecordArgs {
    const a: RecordArgs = {
        task_id: '',
        boundary: 'task',
        consulted: null,
        applied: null,
        outcome: null,
        ts: '',
        payload_file: null,
        stdin: false,
        settings: '.agent-settings.yml',
        force: false,
    };
    const boundaryChoices = ['task', 'phase-step', 'tool-call'];
    for (let i = 0; i < argv.length; i += 1) {
        let tok = argv[i] as string;
        let inlineVal: string | null = null;
        const eq = tok.indexOf('=');
        if (tok.startsWith('--') && eq !== -1) {
            inlineVal = tok.slice(eq + 1);
            tok = tok.slice(0, eq);
        }
        const next = (): string => {
            if (inlineVal !== null) {
                return inlineVal;
            }
            i += 1;
            return argv[i] as string;
        };
        if (tok === '--task-id') a.task_id = next();
        else if (tok === '--boundary') {
            const v = next();
            if (!boundaryChoices.includes(v)) {
                throw new ArgError(
                    `argument --boundary: invalid choice: ${_reprStr(v)} `
                    + `(choose from ${boundaryChoices.map(_reprStr).join(', ')})`,
                );
            }
            a.boundary = v;
        } else if (tok === '--consulted') (a.consulted ??= []).push(next());
        else if (tok === '--applied') (a.applied ??= []).push(next());
        else if (tok === '--outcome') {
            const v = next();
            if (!(ALLOWED_OUTCOMES as readonly string[]).includes(v)) {
                throw new ArgError(
                    `argument --outcome: invalid choice: ${_reprStr(v)} `
                    + `(choose from ${ALLOWED_OUTCOMES.map(_reprStr).join(', ')})`,
                );
            }
            (a.outcome ??= []).push(v);
        } else if (tok === '--ts') a.ts = next();
        else if (tok === '--payload-file') a.payload_file = next();
        else if (tok === '--stdin') a.stdin = true;
        else if (tok === '--settings') a.settings = next();
        else if (tok === '--force') a.force = true;
        else throw new ArgError(`unrecognized arguments: ${argv[i]}`);
    }
    return a;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: RecordArgs;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof ArgError) {
            // argparse prints usage + error to stderr, exits 2.
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    let settings: TelemetrySettings;
    try {
        settings = read_settings(args.settings);
    } catch (exc) {
        process.stderr.write(`❌  cannot read settings: ${_osErr(exc)}\n`);
        return 2;
    }

    if (!settings.enabled && !args.force) {
        // Default-off: silent success, zero work attributable to telemetry.
        return 0;
    }

    let event: EngagementEvent;
    try {
        if (args.payload_file) {
            let raw: string;
            try {
                raw = fs.readFileSync(args.payload_file, 'utf-8');
            } catch (exc) {
                process.stderr.write(`❌  cannot read --payload-file: ${_osErr(exc)}\n`);
                return 2;
            }
            event = _build_event_from_payload(raw);
        } else if (args.stdin) {
            event = _build_event_from_payload(fs.readFileSync(0, 'utf-8'));
        } else {
            if (!args.task_id) {
                process.stderr.write('❌  --task-id required (or pass --payload-file/--stdin)\n');
                return 1;
            }
            event = _build_event_from_args(args);
        }
    } catch (exc) {
        if (exc instanceof SystemExitError) {
            process.stderr.write(`${exc.payload}\n`);
            return 1;
        }
        throw exc;
    }

    try {
        record_event(settings.log_path, event);
    } catch (exc) {
        if (exc instanceof EngagementSchemaError) {
            process.stderr.write(`❌  schema validation failed: ${exc.message}\n`);
            return 1;
        }
        process.stderr.write(`❌  cannot write engagement log: ${_osErr(exc)}\n`);
        return 2;
    }

    return 0;
}

function _osErr(exc: unknown): string {
    return exc instanceof Error ? exc.message : String(exc);
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
