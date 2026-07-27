#!/usr/bin/env node
/**
 * Duplicate-surface probe — `session_start` hook
 * (road-to-install-path-convergence Phase 4).
 *
 * Cheap runtime self-detection on every install path, even for users who
 * never run `agent-config doctor`: reads src/config/surface-matrix.yml from
 * the package root, existence-checks each declared duplicate class, and — at
 * most once per day — emits ONE stderr nudge naming the duplicate plus the
 * converge command.
 *
 * Contract:
 *   - fail-open, never blocking — returns 0 on every path, including
 *     unreadable matrix, corrupted state file, and unwritable state dir.
 *   - rate-limited via agents/runtime/state/surface-probe.json in the
 *     CONSUMER project (last_check_utc, 24h window — same precedent as
 *     _lib/update_check.ts). A corrupted state file counts as "due" and is
 *     rewritten.
 *   - suppressed entirely when the surface is clean or when
 *     install.auto_converge is already true in the global settings (the
 *     user has standing consent — converge handles it, no nagging).
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

import { is_replay_mode } from './hooks/state_io.js';
import { readHookStdin } from './hooks/hook_stdin.js';

const CHECK_WINDOW_MS = 24 * 60 * 60 * 1000;
const STATE_REL = ['agents', 'runtime', 'state', 'surface-probe.json'] as const;

function _project_root(): string {
    const env = process.env['CLAUDE_PROJECT_DIR'] || process.env['AGENT_CONFIG_PROJECT_DIR'];
    if (env) {
        return env;
    }
    return process.cwd();
}

function _package_root(): string {
    const env = process.env['AGENT_CONFIG_PACKAGE_ROOT'];
    if (env) {
        return env;
    }
    // surface_probe_hook.ts lives at src/scripts/; parents[2] = package root.
    return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
}

function _readStdinIfNotTty(): void {
    readHookStdin();
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

interface ProbeOptions {
    project_root?: string;
    package_root?: string;
    home?: string;
    global_settings_path?: string;
    now_ms?: number;
}

/** Fail-open read of install.auto_converge from the global settings file. */
function _auto_converge(global_settings_path: string): boolean {
    try {
        const raw = parseYaml(fs.readFileSync(global_settings_path, 'utf-8'), { version: '1.1' }) as
            | Record<string, unknown>
            | null;
        const install = raw?.['install'];
        if (install && typeof install === 'object' && !Array.isArray(install)) {
            return (install as Record<string, unknown>)['auto_converge'] === true;
        }
    } catch {
        /* absent / unreadable → false */
    }
    return false;
}

function _default_global_settings(home: string): string {
    return path.join(home, '.event4u', 'agent-config', 'agent-settings.yml');
}

/** Rate limit: true when the probe already ran inside the window. */
function _rate_limited(state_path: string, now_ms: number): boolean {
    try {
        const raw = JSON.parse(fs.readFileSync(state_path, 'utf-8')) as Record<string, unknown>;
        const last = raw['last_check_utc'];
        if (typeof last === 'number' && now_ms - last < CHECK_WINDOW_MS && last <= now_ms) {
            return true;
        }
    } catch {
        /* missing / corrupted → due */
    }
    return false;
}

function _stamp(state_path: string, now_ms: number): void {
    try {
        fs.mkdirSync(path.dirname(state_path), { recursive: true });
        fs.writeFileSync(state_path, `${JSON.stringify({ last_check_utc: now_ms })}\n`, 'utf-8');
    } catch {
        /* unwritable state dir → fail open, probe just runs again next time */
    }
}

interface Finding {
    tool: string;
    command: string;
}

function _detect(pkg_root: string, home: string): Finding[] {
    const matrix_path = path.join(pkg_root, 'src', 'config', 'surface-matrix.yml');
    let tools: Record<string, unknown> = {};
    try {
        const raw = parseYaml(fs.readFileSync(matrix_path, 'utf-8'), { version: '1.1' }) as Record<
            string,
            unknown
        >;
        const t = raw?.['tools'];
        if (t && typeof t === 'object' && !Array.isArray(t)) {
            tools = t as Record<string, unknown>;
        }
    } catch {
        return []; // unreadable matrix → fail open, no nudge
    }

    const expand = (p: string): string =>
        p.startsWith('~/') ? path.join(home, p.slice(2)) : path.join(pkg_root, p);

    const findings: Finding[] = [];
    for (const [tool_id, entry] of Object.entries(tools)) {
        if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
            continue;
        }
        const e = entry as Record<string, unknown>;
        const dup = e['duplicate'] as Record<string, unknown> | undefined;
        const detect = dup?.['detect'] as Record<string, unknown> | undefined;
        const all_of = detect?.['all_of'];
        if (!Array.isArray(all_of) || all_of.length === 0) {
            continue;
        }
        const present = all_of.every((p) => typeof p === 'string' && _exists(expand(p)));
        if (!present) {
            continue;
        }
        const conv = e['converge'] as Record<string, unknown> | undefined;
        findings.push({ tool: tool_id, command: String(conv?.['command'] ?? '') });
    }
    return findings;
}

export function main(argv?: string[], opts: ProbeOptions = {}): number {
    void argv;
    _readStdinIfNotTty();

    // Replay contract (state_io): fixture re-execution must not mutate
    // state or emit nudges — the probe is a live-session UX concern only.
    if (is_replay_mode()) {
        return 0;
    }

    try {
        const project_root = opts.project_root ?? _project_root();
        const pkg_root = opts.package_root ?? _package_root();
        const home = opts.home ?? os.homedir();
        const global_settings = opts.global_settings_path ?? _default_global_settings(home);
        const now_ms = opts.now_ms ?? Date.now();

        const state_path = path.join(project_root, ...STATE_REL);
        if (_rate_limited(state_path, now_ms)) {
            return 0;
        }
        _stamp(state_path, now_ms);

        if (_auto_converge(global_settings)) {
            return 0; // standing consent — converge owns the cleanup, no nag
        }

        const findings = _detect(pkg_root, home);
        if (findings.length === 0) {
            return 0; // clean surface — fully silent
        }

        const tools = findings.map((f) => f.tool).join(', ');
        const fix = findings.find((f) => f.command !== '')?.command ?? '';
        process.stderr.write(
            `[surface] duplicate install surface: ${tools} — run: agent-config converge` +
                `${fix ? ` (or: ${fix})` : ''}\n`,
        );
        return 0;
    } catch {
        return 0; // fail-open — a probe must never block a session
    }
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function _isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) {
        return false;
    }
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main(process.argv.slice(2)));
}
