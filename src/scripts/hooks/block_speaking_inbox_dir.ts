#!/usr/bin/env node
/**
 * PreToolUse guard: refuse the CREATION of a speaking inbox directory under
 * `agents/tmp/` — `road-to-source-silence` Phase 4.2.
 *
 * ## Why a write-time guard, when the directory is gitignored anyway
 *
 * `agents/tmp/` is gitignored, so a speaking round directory looks free. It is
 * the root of the whole leak chain and the chain is measured, not theorised:
 * the name gets quoted into a tracked roadmap `> **Source:**` header, into an
 * evidence artefact, into a review-snapshot FILENAME and into a PR body — and
 * every one of those quotes republishes it in a public repository. Phase 0's
 * census counted **190 block-tier occurrences** of quoted non-opaque
 * `agents/tmp(.old)/<name>/` paths across the tracked tree, plus one tracked
 * findings file named after a round.
 *
 * Every downstream gate in this programme catches the QUOTE. This one catches
 * the name, at the only moment removing it is free: before anything can cite
 * it. Renaming after the first quote lands means chasing the quotes.
 *
 * ## What it refuses, and the four things it does not
 *
 * Refuses: a Write/Edit/NotebookEdit (or cross-platform equivalent) whose
 * target path introduces a **new** first-level directory under `agents/tmp/`
 * or `agents/tmp.old/` whose name is not an opaque round identifier.
 *
 * Allowed, deliberately:
 *
 * 1. **A file directly under `agents/tmp/`** with no subdirectory. Scratch
 *    files are not rounds and have no name to leak.
 * 2. **A directory that already exists.** Blocking every later write into an
 *    already-created speaking directory would wedge a session mid-round without
 *    removing the name — the fix there is a rename, which the deny message of
 *    the creating call already asked for. This is the one filesystem read the
 *    guard performs.
 * 3. **An opaque round identifier** — `isOpaqueRoundId` in
 *    `_lib/source_shape.ts` is the single authority, shared with the gate, so
 *    the guard and the CI check can never disagree about what "opaque" means.
 * 4. **A named working set** — `NON_HARVEST_TMP_DIRS`, same shared module. A
 *    directory named after the WORK leaks nothing; the precedent
 *    (`bench-local`) was added on a measured false positive.
 *
 * ## Severity, stated honestly
 *
 * `severity: blocking` with `fail_closed: false`. A DETECTED violation refuses;
 * a malformed envelope, an unreadable path or any crash ALLOWS. That pairing is
 * deliberate and copied from `block_config_weakening`: the guarantee is about
 * the case the guard actually decided, and a scratch-directory guard must never
 * be the reason an unrelated edit fails. Kill switch for a maintainer who needs
 * it out of the way: `AGENT_CONFIG_ALLOW_SPEAKING_INBOX=1`.
 *
 * Only `claude` both binds `pre_tool_use` and honours a deny. Elsewhere this
 * runs and is ignored, or does not bind at all — `agent-config hooks:status`
 * answers it for the host you are on, and this docstring does not claim
 * otherwise.
 *
 * Exit codes (docs/contracts/hook-architecture-v1.md): 0 allow · 1 block.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { isNonHarvestTmpDir, isOpaqueRoundId } from '../_lib/source_shape.js';
import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_SPEAKING_INBOX';

/** Keys across platforms that carry a tool call's target file path. */
const _PATH_KEYS: readonly string[] = [
    'file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path',
];

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

/** `agents/tmp/<name>/…` or `agents/tmp.old/<name>/…`, after normalisation. */
const INBOX_RE = /(?:^|\/)agents\/tmp(?:\.old)?\/([^/]+)\/./;

/**
 * A DIRECTORY-TERMINAL inbox path — `agents/tmp/<name>` with nothing after it.
 *
 * `mkdir -p agents/tmp/<name>` names the directory with no trailing slash and no
 * file after it, so `INBOX_RE` cannot see it. That is the exact bypass the R2
 * review of this branch found, and the test that pins it caught this second
 * form on the first run.
 *
 * The last segment is read as a DIRECTORY only when it carries no `.` — so
 * `cat agents/tmp/scratch.ts` stays a file reference and is not judged as a
 * round name. That is a heuristic and its limit is real: a directory whose name
 * genuinely contains a dot is missed by this form. It is still caught the moment
 * anything is written INSIDE it, which is the path `INBOX_RE` covers.
 */
const INBOX_DIR_TERMINAL_RE = /(?:^|\/)agents\/tmp(?:\.old)?\/([^/.]+)\/?$/;

/**
 * The first-level directory name this path would place a file under, or `null`
 * when the path is not inside an inbox subdirectory at all.
 *
 * Pure, and separated from the filesystem check so the decision is testable
 * without a tree — the shape half of the guard is what a harness can pin.
 */
export function inboxDirName(filePath: string): string | null {
    if (!filePath) {
        return null;
    }
    const normalized = filePath.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
    const m = INBOX_RE.exec(normalized);
    if (m) {
        return m[1] as string;
    }
    const d = INBOX_DIR_TERMINAL_RE.exec(normalized);
    return d ? (d[1] as string) : null;
}

/**
 * Is this directory name one the confidentiality contract accepts?
 *
 * Delegates entirely to the shared shape module, so "opaque" means exactly what
 * `check_no_external_sources` means by it.
 */
export function isAcceptableInboxDir(name: string): boolean {
    return isOpaqueRoundId(name) || isNonHarvestTmpDir(name);
}

/**
 * The guard's verdict for one target path. `existsSync` is injected so the
 * harness can pin the already-exists branch without touching a real tree.
 */
export function verdictFor(
    filePath: string,
    exists: (p: string) => boolean,
    repoRoot = '',
): { block: boolean; dir: string | null; reason: string } {
    const dir = inboxDirName(filePath);
    if (dir === null) {
        return { block: false, dir: null, reason: 'not inside an inbox subdirectory' };
    }
    if (isAcceptableInboxDir(dir)) {
        return { block: false, dir, reason: 'opaque round identifier or named working set' };
    }
    // Already created — a rename is the fix, and refusing every later write
    // would wedge the round without removing the name.
    //
    // The probe path is derived from the SAME anchored match that found the
    // directory, not from `indexOf('agents/tmp')`. That prefix also matches
    // `agents/tmp-notes/` and `agents/tmpfiles/`, and taking the FIRST
    // occurrence meant a path carrying a decoy earlier segment probed the wrong
    // directory — in either direction. Found by the R2 review of this branch.
    const normalized = filePath.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
    const m =
        /(?:^|\/)(agents\/tmp(?:\.old)?\/[^/]+)\//.exec(normalized) ??
        /(?:^|\/)(agents\/tmp(?:\.old)?\/[^/.]+)\/?$/.exec(normalized);
    if (m === null) {
        // `inboxDirName` matched but this did not — treat as unattributable and
        // BLOCK, since the name is speaking and we cannot prove it pre-exists.
        return { block: true, dir, reason: 'new inbox directory with a speaking name (path not re-anchorable)' };
    }
    const upto = m[1] as string;
    const probe = repoRoot === '' ? upto : path.join(repoRoot, upto);
    if (exists(probe)) {
        return { block: false, dir, reason: 'directory already exists — rename, do not re-refuse' };
    }
    return { block: true, dir, reason: 'new inbox directory with a speaking name' };
}

/** The deny message — names the rule, the fix and the accepted forms. */
export function denyMessage(dir: string): string {
    return (
        `block-speaking-inbox-dir: BLOCKED — creating \`agents/tmp/${dir}/\` would name an\n` +
        'inbox round after its source. That name is the root of the leak chain: it gets\n' +
        'quoted into tracked roadmap `Source:` headers, evidence artefacts, review-snapshot\n' +
        'filenames and PR bodies, and every quote republishes it in a public repository.\n' +
        '\n' +
        'Use an opaque round identifier instead:\n' +
        '  inbox-2026-08-h      round-dated, optional 1-3 char disambiguator\n' +
        '  round-a91f3c         content-free hex (also set-, src-set-, source-set-)\n' +
        '  S17                  a set number\n' +
        '\n' +
        'Record the true source ONCE, encrypted, in the round\'s intake note:\n' +
        "  printf '%s' '<the real source>' | ./scripts-run src/scripts/_lib/link_crypto encrypt\n" +
        '\n' +
        'Naming rule: /analyze:inbox Phase 1. Rule: src/rules/source-confidentiality.md.\n' +
        `Maintainer kill switch: ${KILL_SWITCH}=1.\n`
    );
}

export function main(): number {
    if ((process.env[KILL_SWITCH] ?? '') !== '') {
        return 0;
    }
    let envelope: JsonObject;
    try {
        const raw = readHookStdin();
        if (!raw) {
            return 0;
        }
        envelope = JSON.parse(raw) as JsonObject;
    } catch {
        return 0; // fail_closed: false — a malformed envelope never blocks.
    }
    try {
        const payload = _isObject(envelope['payload']) ? envelope['payload'] : envelope;
        const ti = _isObject(payload['tool_input'])
            ? payload['tool_input']
            : _isObject(envelope['tool_input'])
              ? envelope['tool_input']
              : null;
        if (ti === null) {
            return 0;
        }
        const repoRoot = typeof envelope['project_dir'] === 'string' ? envelope['project_dir'] : '';
        const candidates: string[] = [];
        for (const key of _PATH_KEYS) {
            const v = ti[key];
            if (typeof v === 'string' && v) {
                candidates.push(v);
            }
        }
        // A shell command creates the directory just as effectively as a Write,
        // and this guard read only the path keys — so `mkdir -p
        // agents/tmp/<speaking-name>`, a `git mv` into one, or a redirect
        // bypassed it entirely. Both siblings on this slot (`block_no_verify`,
        // `block_kernel_rule_writes`) parse the command string; this one did
        // not, and the R2 review of this branch caught it. Every whitespace
        // token of the command is offered to the same pure verdict, so the
        // decision logic is shared rather than duplicated.
        const cmd = ti['command'] ?? (_isObject(envelope['payload']) ? (envelope['payload'] as JsonObject)['command'] : undefined);
        if (typeof cmd === 'string' && cmd) {
            for (const tok of cmd.split(/[\s"'`(){};|&<>]+/)) {
                if (tok) {
                    candidates.push(tok);
                }
            }
        }
        for (const v of candidates) {
            const verdict = verdictFor(v, (p) => fs.existsSync(p), repoRoot);
            if (verdict.block && verdict.dir !== null) {
                process.stderr.write(denyMessage(verdict.dir));
                return 1;
            }
        }
    } catch {
        return 0;
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
        return true;
    }
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
