#!/usr/bin/env node
// MIGRATE: precompiled-hook-layer — carry this hook when road-to-credible-install
// Phase 1 precompiles the hook path (touch-once preserved at migration).
/**
 * PreToolUse guard: block Write/Edit/NotebookEdit (and cross-platform
 * equivalents) targeting a kernel rule file — Layer 1 of kernel immutability
 * (road-to-ai-employee-borrowings Phase 1, council-confirmed 2026-07-27).
 *
 * The nine kernel rules (docs/contracts/kernel-membership.md § 4) are the
 * Iron-Law floor: `agent-authority`, `ask-when-uncertain`, `commit-policy`,
 * `direct-answers`, `language-and-tone`, `no-cheap-questions`,
 * `non-destructive-by-default`, `scope-control`, `verify-before-complete`.
 * A model that can edit its own kernel rules can quietly loosen the floor it
 * is supposed to be bound by — this hook makes that a tool-call-time deny,
 * not just a documented convention.
 *
 * Deny reach: the SOURCE tree (`src/rules/<kernel>.md`) AND every projection
 * (`dist/agent-src/rules/`, `.claude/**​/rules/`, `.augment/rules/`, etc.) —
 * any path whose basename is a kernel rule filename under a `rules/` path
 * segment. A kernel-named file living OUTSIDE a `rules/` directory (e.g. a
 * doc, a fixture) is not a rule file and is allowed through.
 *
 * Mirrors `block_no_verify.ts`'s PreToolUse contract exactly: reads the
 * dispatcher's stdin envelope (`--command`-less here — there is no CLI
 * shortcut, the payload always carries the tool call), decides purely from
 * exported pure functions, and reports via the same stderr-block-message +
 * exit-code shape (0 allow · 1 block). `fail_closed: true` in the manifest —
 * ADR-127 permits more than one blocking hook; this is the second (after
 * block-no-verify). No agent-accessible override: the sole legitimate bypass
 * is the human-owned exception registry the deny message points to.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block
 */

import * as fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';

import { is_kernel_rule } from '../_lib/kernel_rules.js';
import { EDIT_TOOLS } from '../minimal_safe_diff_hook.js';

const _HERE = fileURLToPath(import.meta.url);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

// Keys across platforms that carry the tool's target file path (Write /
// Edit / MultiEdit / NotebookEdit / str-replace-editor / save-file / …).
const _PATH_KEYS: readonly string[] = [
    'file_path',
    'path',
    'target_file',
    'filename',
    'filePath',
    'notebook_path',
];

/** Best-effort (toolName, candidate target paths) read off a PreToolUse envelope. */
function _extract(envelope: JsonObject): { tool: string; paths: string[] } {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const nameVal =
        payload['tool_name'] ??
        payload['toolName'] ??
        payload['tool'] ??
        envelope['tool_name'] ??
        envelope['tool'];
    const tool = typeof nameVal === 'string' ? nameVal : '';

    const ti = _isObject(payload['tool_input'])
        ? payload['tool_input']
        : _isObject(envelope['tool_input'])
          ? envelope['tool_input']
          : null;

    const paths: string[] = [];
    if (ti !== null) {
        for (const key of _PATH_KEYS) {
            const v = ti[key];
            if (typeof v === 'string' && v) {
                paths.push(v);
            }
        }
    }
    return { tool, paths };
}

/** Normalize path separators; strip a leading "./" run so segment checks are robust. */
function _normalize(p: string): string {
    return p.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

/**
 * True when `filePath` names a kernel rule file — its basename matches a
 * kernel rule id/filename AND the path carries a `rules` directory segment
 * (source tree or any projection). A kernel-named file outside a `rules/`
 * directory (e.g. `docs/notes/commit-policy.md`) is not a rule file.
 */
export function targets_kernel_rule(filePath: string): string | null {
    if (!filePath) {
        return null;
    }
    const normalized = _normalize(filePath);
    const segments = normalized.split('/').filter((s) => s.length > 0);
    if (segments.length === 0) {
        return null;
    }
    const basename = segments[segments.length - 1] as string;
    if (!is_kernel_rule(basename)) {
        return null;
    }
    const dirSegments = segments.slice(0, -1);
    if (!dirSegments.includes('rules')) {
        return null;
    }
    return basename.replace(/\.md$/, '');
}

/** Return (blocked, reason) for one PreToolUse envelope. Pure — no I/O beyond the arg. */
export function check_envelope(envelope: JsonObject): [boolean, string] {
    const { tool, paths } = _extract(envelope);
    if (!tool || !EDIT_TOOLS.has(tool)) {
        return [false, ''];
    }
    for (const p of paths) {
        const ruleName = targets_kernel_rule(p);
        if (ruleName !== null) {
            return [
                true,
                `kernel rule ${ruleName} is immutable — tighten-only via the override ` +
                    'exception registry; see docs/contracts/kernel-membership.md',
            ];
        }
    }
    return [false, ''];
}

function _asObject(v: JsonValue | undefined): JsonObject | null {
    return _isObject(v) ? v : null;
}

function _readStdin(): string {
    try {
        if (process.stdin.isTTY) {
            return '';
        }
        return fs.readFileSync(0, 'utf-8');
    } catch {
        return '';
    }
}

export function main(): number {
    const raw = _readStdin();
    let envelope: JsonObject = {};
    if (raw.trim()) {
        try {
            const obj = JSON.parse(raw) as JsonValue;
            envelope = _asObject(obj) ?? {};
        } catch {
            // Malformed envelope — nothing actionable to detect; allow. (The
            // fail-closed guarantee below applies to a DETECTED kernel-rule
            // write, not to an unparsable envelope with no target at all.)
            return 0;
        }
    }

    const [blocked, reason] = check_envelope(envelope);
    if (blocked) {
        process.stderr.write(
            `block-kernel-rule-writes: BLOCKED — ${reason}\n` +
                '  Legitimate change requires a human action outside the agent session:\n' +
                '  edit via the override exception registry, or disable/remove the\n' +
                "  'block-kernel-rule-writes' entry in src/scripts/hook_manifest.yaml.\n" +
                '  Contract: docs/contracts/kernel-membership.md\n',
        );
        return 1; // EXIT_BLOCK
    }

    return 0; // EXIT_ALLOW
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation (e.g. via an installed `.augment/` projection,
    // or macOS /var → /private/var temp dirs) makes the raw URLs differ:
    // import.meta.url is the resolved real path while argv[1] keeps the
    // symlink path. Compare realpaths so the entry guard still fires
    // (without this the CLI silently no-ops when run through a symlink).
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
