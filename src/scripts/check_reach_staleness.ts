#!/usr/bin/env tsx
/**
 * check_reach_staleness.ts — offline staleness gate for the reach channel
 * registry (road-to-internet-reach Phase 7, Step 3).
 *
 * WHY THIS EXISTS. The council asked for a weekly cron that probes every
 * upstream backend. A scheduled job against third-party endpoints buys flaky
 * CI plus an implicit availability promise, so it was replaced by this: the
 * registry records WHEN a human last verified each channel (`last_verified:`)
 * and its deprecation path (`lifecycle:` / `removal_after:` / `replacement:`),
 * and this lint reads those fields. Capability rot becomes a red CI line
 * instead of a silent decay — without a single outbound request.
 *
 * OFFLINE AND DETERMINISTIC BY CONSTRUCTION. One file is read and compared
 * against a date. No subprocess, no socket, no PATH lookup. Time is the only
 * external input, so it is INJECTABLE: `--today YYYY-MM-DD` overrides the
 * clock, which is what lets the fixtures below pin a reference date instead of
 * expiring on a calendar boundary. A test whose verdict flips 91 days from now
 * is a broken test, not a passing one.
 *
 * WHAT IT CHECKS (the three roadmap rules, one finding kind each)
 *   (a) stale-verification            — `last_verified` older than 90 days.
 *   (b) deprecated-without-replacement — `lifecycle: deprecated` and no
 *                                        `replacement:` — a dead end with no
 *                                        migration target.
 *   (c) removal-overdue               — today is past `removal_after` and the
 *                                        channel is still in the registry.
 *   plus (defensive) unparseable-date — a missing or non-ISO date field. Shape
 *       validation belongs to check_reach_channels.ts; this kind exists only so
 *       an unreadable date can never be scored as "fresh".
 *
 * REUSE, NOT DUPLICATION. The YAML loader and the exit-3 error class come from
 * check_reach_channels.ts, exactly as validate_reach_prescriptions.ts does.
 *
 * Exit codes:
 *   0 — clean.
 *   1 — at least one staleness violation.
 *   3 — internal error: target missing, unreadable, unparseable, or a bad
 *       `--today` value.
 *
 * Invocation (from project root):
 *   tsx src/scripts/check_reach_staleness.ts [<path-to-yml>] [--today YYYY-MM-DD]
 *       [--quiet] [--help]
 *
 * The optional path argument is what lets the negative fixtures under
 * `tests/fixtures/reach-staleness/` run through the same code path as the real
 * registry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';
import { RegistryLoadError, load_registry } from './check_reach_channels.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const REGISTRY_PATH = path.join(ROOT, 'src', 'config', 'reach-channels.yml');

/** A channel unverified for longer than this is stale (roadmap Phase 7.3). */
export const STALE_AFTER_DAYS = 90;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;

/** Every finding carries the channel id that makes it actionable without a grep. */
export interface StalenessFinding {
    /** `channels[github]` or `channels[github].removal_after`. */
    readonly locator: string;
    /** Machine-stable violation class — tests assert on this, not on prose. */
    readonly kind:
        | 'stale-verification'
        | 'deprecated-without-replacement'
        | 'removal-overdue'
        | 'unparseable-date';
    readonly message: string;
}

function as_object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/**
 * Parse an ISO calendar date to UTC midnight. Returns null for anything that is
 * not a `YYYY-MM-DD` string, so a YAML timestamp (an unquoted date) is rejected
 * rather than silently coerced.
 */
export function parse_iso_date(value: unknown): number | null {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) {
        return null;
    }
    const stamp = Date.parse(`${value}T00:00:00Z`);
    if (Number.isNaN(stamp)) {
        return null;
    }
    // Round-trip guard: `2026-02-31` parses in some engines but is not a date.
    return new Date(stamp).toISOString().slice(0, 10) === value ? stamp : null;
}

/** Whole days between two UTC-midnight stamps. */
export function days_between(fromStamp: number, toStamp: number): number {
    return Math.floor((toStamp - fromStamp) / MS_PER_DAY);
}

/** Today as `YYYY-MM-DD` in UTC — the only place the clock is read. */
export function today_iso(now: Date = asOf()): string {
    return now.toISOString().slice(0, 10);
}

export interface Channel {
    readonly id: string;
    readonly lifecycle?: unknown;
    readonly last_verified?: unknown;
    readonly removal_after?: unknown;
    readonly replacement?: unknown;
}

/**
 * Flatten the registry's `channels:` list. Defensive by design: a malformed
 * registry is reported by the schema gate, so an unexpected entry is skipped
 * here rather than thrown.
 */
export function extract_channels(registry: unknown): Channel[] {
    const root = as_object(registry);
    const channels = Array.isArray(root?.channels) ? root.channels : [];
    const out: Channel[] = [];
    channels.forEach((rawChannel, index) => {
        const channel = as_object(rawChannel);
        if (!channel) {
            return;
        }
        out.push({
            id: typeof channel.id === 'string' ? channel.id : `#${index}`,
            lifecycle: channel.lifecycle,
            last_verified: channel.last_verified,
            removal_after: channel.removal_after,
            replacement: channel.replacement,
        });
    });
    return out;
}

/**
 * The three roadmap rules, evaluated against an injected reference date.
 *
 * All three are reported independently: a channel can be simultaneously stale,
 * replacement-less and overdue, and hiding two of those behind the first would
 * make the fix a guessing game.
 */
export function check_channels(registry: unknown, todayStamp: number): StalenessFinding[] {
    const findings: StalenessFinding[] = [];

    for (const channel of extract_channels(registry)) {
        const at = `channels[${channel.id}]`;

        // (a) staleness of the human verification.
        const verified = parse_iso_date(channel.last_verified);
        if (verified === null) {
            findings.push({
                locator: `${at}.last_verified`,
                kind: 'unparseable-date',
                message: `\`last_verified\` is missing or not a quoted ISO date (YYYY-MM-DD), got ${JSON.stringify(channel.last_verified ?? null)} — staleness cannot be judged (fix via \`task check-reach-channels\`)`,
            });
        } else {
            const age = days_between(verified, todayStamp);
            if (age > STALE_AFTER_DAYS) {
                findings.push({
                    locator: at,
                    kind: 'stale-verification',
                    message: `\`last_verified\` is ${age} days old (${String(channel.last_verified)}), over the ${STALE_AFTER_DAYS}-day floor — re-verify the channel (\`./agent-config reach:doctor --deep\`) and commit a fresh date, or retire the channel`,
                });
            }
        }

        const isDeprecated = channel.lifecycle === 'deprecated';

        // (b) a deprecated channel with no migration target.
        if (isDeprecated) {
            const replacement =
                typeof channel.replacement === 'string' ? channel.replacement.trim() : '';
            if (replacement === '') {
                findings.push({
                    locator: at,
                    kind: 'deprecated-without-replacement',
                    message:
                        'channel is `lifecycle: deprecated` but declares no `replacement:` — a deprecation with no successor is a dead end; name the channel id that supersedes it, or drop the channel',
                });
            }
        }

        // (c) a channel that outlived its own removal date.
        //
        // NOT A LEXICOGRAPHIC DATE COMPARISON — flagged as one by review, so the
        // two facts that refute it are recorded here rather than re-derived:
        //   1. Both operands are NUMBERS. `parse_iso_date` (line 92 of this
        //      file) returns a UTC-midnight epoch stamp or `null`, and `null`
        //      takes the `unparseable-date` branch below instead of any
        //      comparison; `todayStamp` comes from the same function. The `>`
        //      below is therefore numeric — as is the `age` test in (a) above,
        //      which goes through `days_between`.
        //   2. The input shape is pinned upstream regardless:
        //      `src/scripts/schemas/reach-channels.schema.json` constrains
        //      `last_verified` (line 52) and `removal_after` (line 57) to
        //      `^[0-9]{4}-[0-9]{2}-[0-9]{2}$`, and `ISO_DATE_RE` (line 65) is
        //      re-checked here, so an unpadded or non-ISO date cannot reach the
        //      parse at all.
        if (channel.removal_after !== undefined && channel.removal_after !== null) {
            const removal = parse_iso_date(channel.removal_after);
            if (removal === null) {
                findings.push({
                    locator: `${at}.removal_after`,
                    kind: 'unparseable-date',
                    message: `\`removal_after\` is not a quoted ISO date (YYYY-MM-DD), got ${JSON.stringify(channel.removal_after)} — the removal deadline cannot be judged (fix via \`task check-reach-channels\`)`,
                });
            } else if (todayStamp > removal) {
                const overdue = days_between(removal, todayStamp);
                findings.push({
                    locator: at,
                    kind: 'removal-overdue',
                    message: `channel is ${overdue} day(s) past its \`removal_after\` date (${String(channel.removal_after)}) and is still present in the registry — remove it, or move the date with the reason recorded in internal/upstream-changes.md`,
                });
            }
        }
    }

    return findings;
}

export interface RunOptions {
    readonly registryPath?: string | undefined;
    /** Injected clock: `YYYY-MM-DD`. Defaults to the real UTC date. */
    readonly today?: string | undefined;
}

/**
 * Everything the CLI reports, as data. Throws RegistryLoadError for the exit-3
 * class so an unusable file is never reported as "0 violations".
 */
export function run_checks(options: RunOptions = {}): StalenessFinding[] {
    const registryPath = options.registryPath ?? REGISTRY_PATH;
    const today = options.today ?? today_iso();
    const todayStamp = parse_iso_date(today);
    if (todayStamp === null) {
        throw new RegistryLoadError(`--today must be an ISO date (YYYY-MM-DD), got ${today}`);
    }
    return check_channels(load_registry(registryPath), todayStamp);
}

const HELP = `check_reach_staleness — offline staleness gate for the reach channel registry

Usage:
  tsx src/scripts/check_reach_staleness.ts [<registry.yml>] [options]

Options:
  --today <YYYY-MM-DD>  Reference date (default: the real UTC date). Time is the
                        only external input, so it is injectable — the fixtures
                        pin it instead of expiring on a calendar boundary.
  --quiet               Suppress the success line
  --help                This text

Checks (all offline — no network, no subprocess):
  stale-verification             last_verified older than ${STALE_AFTER_DAYS} days
  deprecated-without-replacement lifecycle: deprecated with no replacement:
  removal-overdue                today is past removal_after and the channel is still present
  unparseable-date               a missing or non-ISO date field (defensive; shape is
                                 owned by task check-reach-channels)

Replaces a scheduled network probe on purpose: a cron against third-party
endpoints buys flaky CI plus an implicit availability promise. Real requests are
operator-invoked only (\`./agent-config reach:doctor --deep\`).

Exit codes: 0 clean · 1 violations · 3 unusable input (missing / unparseable file or --today).
`;

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(HELP);
        return 0;
    }
    const quiet = argv.includes('--quiet');

    let today: string | undefined;
    const positional: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined) {
            continue;
        }
        if (arg === '--today') {
            const value = argv[index + 1];
            if (!value) {
                process.stderr.write('check_reach_staleness: --today needs a date\n');
                return 3;
            }
            today = value;
            index += 1;
        } else if (arg.startsWith('--today=')) {
            today = arg.slice('--today='.length);
        } else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }
    if (positional.length > 1) {
        process.stderr.write('check_reach_staleness: at most one path argument is accepted\n');
        return 3;
    }

    const registryPath = positional[0] ? path.resolve(positional[0]) : REGISTRY_PATH;
    const relTarget = path.relative(ROOT, registryPath) || registryPath;

    let findings: StalenessFinding[];
    let channelCount: number;
    try {
        findings = run_checks({ registryPath, today });
        // `load_registry` already refuses a missing / unparseable file (exit 3),
        // but a registry that PARSES with no `channels:` list is the blind case:
        // `extract_channels` is defensive by contract and returns [], so every
        // per-channel check iterates nothing and the gate prints the ✅ line.
        // Re-reading the (small) YAML keeps run_checks / extract_channels — both
        // exported and pinned by fixtures — untouched.
        channelCount = extract_channels(load_registry(registryPath)).length;
    } catch (err) {
        if (err instanceof RegistryLoadError) {
            process.stderr.write(`❌  check_reach_staleness: ${err.message}\n`);
            return 3;
        }
        throw err;
    }

    // No `allowEmpty`: a registry with zero channels is a registry this gate
    // cannot judge, and it reads exactly like a clean one. Exit 3 (unusable
    // input) over 1 (violations) — a dead scope means the gate could not run.
    try {
        assertScanned({
            gate: 'check_reach_staleness',
            scanned: channelCount,
            units: 'channel(s)',
            roots: [`${path.relative(ROOT, registryPath) || registryPath} → channels[]`],
        });
    } catch (err) {
        if (err instanceof DeadScopeError) {
            process.stderr.write(`❌  ${err.message}\n`);
            return 3;
        }
        throw err;
    }

    if (findings.length > 0) {
        process.stdout.write(`❌  ${relTarget}: ${findings.length} staleness violation(s):\n`);
        for (const finding of findings) {
            process.stdout.write(`  - [${finding.kind}] ${finding.locator}: ${finding.message}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  ${relTarget}: every channel is verified within ${STALE_AFTER_DAYS} days, deprecations name a replacement, and no removal date is overdue (offline check, reference date ${today ?? today_iso()}).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path while argv[1] keeps the symlink path) — compare
    // realpaths so the CLI still fires when run through a projection symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
