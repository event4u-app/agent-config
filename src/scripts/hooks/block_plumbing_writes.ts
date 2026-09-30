#!/usr/bin/env node
/**
 * PreToolUse guard: refuse a hand edit to a hook BUILD OUTPUT.
 *
 * road-to-a-kernel-that-guards-its-plumbing 1.2 — the other half of a
 * deliberate split, and the split is the whole design:
 *
 *   · plumbing SOURCES (`hook_manifest.yaml`, `host_lowering.yaml`, the
 *     `*-dispatcher.sh` trampolines, both hook budget files) are edited
 *     legitimately all the time. They carry a RECORD — the ADR-268 § 4
 *     ratification gate, path set extended by step 1.1 — not a deny.
 *   · plumbing BUILD OUTPUTS have no legitimate hand edit at all. They carry a
 *     DENY, which is this file.
 *
 * One mechanism per file class. A record for a file whose every hand edit is a
 * mistake would be a record of a mistake; a deny on a file people edit on
 * purpose would be a wedge.
 *
 * WHAT IS REFUSED.
 *
 * - `dist/hooks/dispatch.js` — the esbuild bundle (`npm run build:hooks`).
 *   Every concern the dispatcher runs is inlined here. A hand edit survives
 *   until the next build, reaches every dispatch in the meantime, and is
 *   invisible in a source review.
 * - `hooks/hooks.json` — the host binding file, written by `condense.ts` via
 *   `task sync`. A hand edit here silently unbinds a guard.
 *
 * Both are matched under any parent directory, because a consumer install
 * carries them under its own project root rather than under this repository's.
 *
 * WHAT STILL PASSES, and why that is not a hole.
 *
 * `npm run build:hooks` and `task sync` are the legitimate writers, and both
 * reach these files through a build tool rather than through a shell write
 * shape: the command string carries no redirect into the path, no in-place
 * `sed`, no `tee`/`mv`/`cp` naming it. `shellWriteTarget` matches shapes, not
 * effects, so the builds pass and a hand edit does not. Stated here because it
 * is the property that makes this guard safe to bind `fail_closed`.
 *
 * KNOWN OPEN, stated rather than implied.
 *
 * A write whose target never appears as a path-shaped token — built inside an
 * interpreter's own argument, as in `python3 -c "open('hooks/hooks.json','w')…"`
 * — carries none of the recognised shapes and is NOT detected. This is the same
 * residual `block_kernel_rule_writes.ts` declares for itself and the same
 * boundary: a guard, not write mediation. The honest claim is that the cheap
 * and the accidental paths are closed, not that the determined one is.
 *
 * "Through an interpreter" does not by itself mean undetected, and the tests
 * pin both directions: `sh -c 'printf x > hooks/hooks.json'` IS refused,
 * because the redirect survives the tokenizer inside the quoted argument.
 *
 * MANIFEST DECLARATION.
 *
 * `fail_closed: true`, `severity: blocking`. The fail-closed guarantee is
 * about a DETECTED write: a malformed envelope with no target at all allows,
 * exactly as the kernel guard does, because a guard that blocks what it cannot
 * read turns a shape defect into a wedged session.
 *
 * No agent-accessible kill switch — deliberately, and it is also what
 * `lint_deny_text` (step 1.3) requires of every blocking concern's deny text.
 * The legitimate change is to rebuild the file from its source.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md):
 *   0 — allow
 *   1 — block
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { shellWriteTarget } from '../_lib/shell_write_shapes.js';
import { EDIT_TOOLS } from '../minimal_safe_diff_hook.js';
import { COMMAND_TOOLS } from '../before_complete_hook.js';
import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

/**
 * The generated plumbing artifacts, as trailing path segments.
 *
 * A trailing match rather than a repo-relative one because the same two files
 * exist under every consumer project root and under this repository's, and a
 * guard anchored to one tree would be silent in the other.
 */
export const PLUMBING_BUILD_OUTPUTS: readonly string[] = [
    'dist/hooks/dispatch.js',
    'hooks/hooks.json',
];

/**
 * Where each output comes from, printed in the deny so the reader is told what
 * to run instead of only what not to do.
 */
const REGENERATED_BY: Readonly<Record<string, string>> = {
    'dist/hooks/dispatch.js': 'npm run build:hooks',
    'hooks/hooks.json': 'task sync',
};

// Keys across platforms that carry the tool's target file path.
const _PATH_KEYS: readonly string[] = [
    'file_path',
    'path',
    'target_file',
    'filename',
    'filePath',
    'notebook_path',
];

/** Normalize separators; strip a leading "./" run so segment checks are robust. */
function _normalize(p: string): string {
    return p.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
}

/**
 * The build output `filePath` names, or `null`.
 *
 * Two matching rules, because the guard has two kinds of input and only one of
 * them carries enough information to be exact:
 *
 *   · a RELATIVE path is matched EXACTLY, after a leading `./` or `../` run is
 *     stripped. `dist/hooks/dispatch.js` and `./hooks/hooks.json` are the
 *     governed files; `docs/hooks/hooks.json` is a different file that happens
 *     to end the same way, and refusing it would be an over-block on a file
 *     nothing generates.
 *   · an ABSOLUTE path is matched on its trailing segments, because the guard
 *     does not know where the project root is and a host that sends absolute
 *     paths — Claude Code sends every `file_path` absolute — would otherwise
 *     escape it entirely. A fail-open on the main path is the worse of the two
 *     errors.
 *
 * The residual is named rather than hidden: an absolute path ending in
 * `…/hooks/hooks.json` under an unrelated parent is refused too. That is the
 * conservative direction for a two-file guard, and the fix if it ever bites is
 * to relativise against the envelope's `workspace_root`.
 *
 * A bare basename (`dispatch.js`) never matches under either rule — it is not
 * evidence that the governed file is the target.
 */
export function targets_plumbing_output(filePath: string): string | null {
    if (!filePath) {
        return null;
    }
    const normalized = _normalize(filePath);
    const absolute = normalized.startsWith('/') || /^[A-Za-z]:\//.test(normalized);
    const segments = normalized.split('/').filter((s) => s.length > 0 && s !== '.');
    const relevant = absolute ? segments : segments.filter((s) => s !== '..');

    for (const output of PLUMBING_BUILD_OUTPUTS) {
        const want = output.split('/');
        if (absolute) {
            if (relevant.length < want.length) {
                continue;
            }
            const tail = relevant.slice(relevant.length - want.length);
            if (tail.every((s, i) => s === want[i])) {
                return output;
            }
            continue;
        }
        if (relevant.length === want.length && relevant.every((s, i) => s === want[i])) {
            return output;
        }
    }
    return null;
}

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

/** Best-effort read of a shell command off a PreToolUse envelope. */
function _extract_command(envelope: JsonObject): string | null {
    const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
    const ti = _isObject(payload['tool_input'])
        ? payload['tool_input']
        : _isObject(envelope['tool_input'])
          ? envelope['tool_input']
          : null;
    for (const src of [ti, payload]) {
        if (src === null) {
            continue;
        }
        const v = src['command'];
        if (typeof v === 'string' && v) {
            return v;
        }
    }
    return null;
}

/** Return (blocked, reason) for one PreToolUse envelope. Pure — no I/O. */
export function check_envelope(envelope: JsonObject): [boolean, string] {
    const { tool, paths } = _extract(envelope);
    if (!tool) {
        return [false, ''];
    }
    const deny = (output: string): [boolean, string] => [
        true,
        `${output} is a build output, not a source — regenerate it with ` +
            `\`${REGENERATED_BY[output] ?? 'the build that writes it'}\`. ` +
            'See docs/contracts/hook-architecture-v1.md § Plumbing.',
    ];
    if (EDIT_TOOLS.has(tool)) {
        for (const p of paths) {
            const output = targets_plumbing_output(p);
            if (output !== null) {
                return deny(output);
            }
        }
        return [false, ''];
    }
    if (COMMAND_TOOLS.has(tool)) {
        const cmd = _extract_command(envelope);
        if (cmd !== null) {
            const output = shellWriteTarget(cmd, targets_plumbing_output);
            if (output !== null) {
                return deny(output);
            }
        }
    }
    return [false, ''];
}

function _asObject(v: JsonValue | undefined): JsonObject | null {
    return _isObject(v) ? v : null;
}

export function main(): number {
    const raw = readHookStdin();
    let envelope: JsonObject = {};
    if (raw.trim()) {
        try {
            const obj = JSON.parse(raw) as JsonValue;
            envelope = _asObject(obj) ?? {};
        } catch {
            // Malformed envelope — no target to decide about; allow. The
            // fail-closed guarantee applies to a DETECTED write.
            return 0;
        }
    }

    const [blocked, reason] = check_envelope(envelope);
    if (blocked) {
        process.stderr.write(
            `block-plumbing-writes: BLOCKED — ${reason}\n` +
                '  This file is generated. Edit the source it is built from, then rebuild.\n' +
                '  Contract: docs/contracts/hook-architecture-v1.md\n',
        );
        return 1; // EXIT_BLOCK
    }

    return 0; // EXIT_ALLOW
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where
// every module shares the bundle's `import.meta.url`.
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

if (_isCliEntry() || (typeof __AGENT_CONFIG_BUNDLE__ === 'undefined' && process.argv[1] === _HERE)) {
    process.exitCode = main();
}
