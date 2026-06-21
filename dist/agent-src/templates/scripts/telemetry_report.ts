#!/usr/bin/env node
/**
 * `./agent-config telemetry:report` — aggregate the engagement log.
 *
 * TypeScript twin of `telemetry_report.py` (ADR-200). Byte-for-byte parity on
 * stdout / stderr / exit code for both markdown and JSON formats.
 *
 * Exit codes:
 *   0   success (empty log → empty-but-valid report)
 *   2   IO / settings parse error, unparseable --since, or redaction-validator
 *       failure on a row sourced from the log
 */
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { aggregate } from './telemetry/aggregator.js';
import { EngagementSchemaError } from './telemetry/engagement.js';
import { render_json, render_markdown } from './telemetry/report_renderer.js';
import { read_settings } from './telemetry/settings.js';

const _DURATION_RE = /^\s*(\d+)\s*([dhm])\s*$/u;

/**
 * Parse `30d` / `7d` / `24h` / `60m` into a UTC cutoff (epoch ms).
 * Returns `[cutoff_or_null, human_label]`. `null` / `"all"` → no lower bound.
 * Throws on malformed input so the CLI surfaces a clean error and exits 2.
 */
function _parse_since(value: string | null): [number | null, string | null] {
    if (value === null || value.trim().toLowerCase() === 'all') {
        return [null, null];
    }
    const match = _DURATION_RE.exec(value);
    if (!match) {
        throw new ValueError(`--since must be <int>{d,h,m} or 'all', got ${_reprStr(value)}`);
    }
    const qty = Number(match[1]);
    const unit = match[2] as string;
    const ms: Record<string, number> = {
        d: qty * 86400000,
        h: qty * 3600000,
        m: qty * 60000,
    };
    const cutoff = Date.now() - (ms[unit] as number);
    const label = `last ${qty}${unit}`;
    return [cutoff, label];
}

class ValueError extends Error {}

function _reprStr(s: string): string {
    return `'${s}'`;
}

interface ReportArgs {
    since: string;
    top: number;
    format: string;
    log_path: string | null;
    settings: string;
}

class ArgError extends Error {}

function _parseArgs(argv: string[]): ReportArgs {
    const a: ReportArgs = {
        since: '30d',
        top: 20,
        format: 'markdown',
        log_path: null,
        settings: '.agent-settings.yml',
    };
    const formatChoices = ['markdown', 'json'];
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
        if (tok === '--since') a.since = next();
        else if (tok === '--top') {
            const v = next();
            if (!/^[+-]?\d+$/u.test(v.trim())) {
                throw new ArgError(`argument --top: invalid int value: ${_reprStr(v)}`);
            }
            a.top = parseInt(v, 10);
        } else if (tok === '--format') {
            const v = next();
            if (!formatChoices.includes(v)) {
                throw new ArgError(
                    `argument --format: invalid choice: ${_reprStr(v)} `
                    + `(choose from ${formatChoices.map(_reprStr).join(', ')})`,
                );
            }
            a.format = v;
        } else if (tok === '--log-path') a.log_path = next();
        else if (tok === '--settings') a.settings = next();
        else throw new ArgError(`unrecognized arguments: ${argv[i]}`);
    }
    return a;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: ReportArgs;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof ArgError) {
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    let cutoff: number | null;
    let since_label: string | null;
    try {
        [cutoff, since_label] = _parse_since(args.since);
    } catch (exc) {
        if (exc instanceof ValueError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    let log_path: string;
    if (args.log_path !== null) {
        log_path = args.log_path;
    } else {
        try {
            const settings = read_settings(args.settings);
            log_path = settings.log_path;
        } catch (exc) {
            process.stderr.write(`❌  cannot read settings: ${_osErr(exc)}\n`);
            return 2;
        }
    }

    let result;
    try {
        result = aggregate(log_path, { since: cutoff });
    } catch (exc) {
        process.stderr.write(`❌  cannot read log ${log_path}: ${_osErr(exc)}\n`);
        return 2;
    }

    const top = args.top <= 0 ? null : args.top;
    let rendered: string;
    try {
        if (args.format === 'json') {
            rendered = render_json(result, { top, since_label });
        } else {
            rendered = render_markdown(result, { top, since_label });
        }
    } catch (exc) {
        if (exc instanceof EngagementSchemaError) {
            process.stderr.write(`❌  redaction validator refused report: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }
    process.stdout.write(rendered);

    if (result.skipped_lines) {
        process.stderr.write(`⚠️   skipped ${result.skipped_lines} malformed line(s)\n`);
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
