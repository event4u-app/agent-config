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
 * or `agents/tmp.old/` whose name is not an opaque round identifier — and a
 * shell command whose own segments would bring one into existence. That scope
 * is now what the code implements: a read tool's `file_path` is filtered by
 * `_READ_ONLY_TOOLS`, and a command's tokens by `creatableTokens`. Both were
 * scanned unconditionally before, so the sentence above described an intent
 * the file did not carry.
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
import { invokedSegments } from './git_command_classifier.js';
import { readHookStdin } from './hook_stdin.js';

const _HERE = fileURLToPath(import.meta.url);

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };
type JsonObject = { [k: string]: JsonValue };

const KILL_SWITCH = 'AGENT_CONFIG_ALLOW_SPEAKING_INBOX';

/** Keys across platforms that carry a tool call's target file path. */
const _PATH_KEYS: readonly string[] = [
    'file_path', 'path', 'target_file', 'filename', 'filePath', 'notebook_path',
];

/**
 * Tools whose `file_path` names something to READ, never something to write.
 *
 * `_PATH_KEYS` covers `file_path` and `path`, which is exactly what a Read,
 * Grep or Glob call carries — so a search under a speaking round that does not
 * exist yet was refused by a guard whose own docstring scopes itself to
 * `Write/Edit/NotebookEdit`. Filtering here rather than through the manifest's
 * `tools:` key on purpose: that key is an exact match on the host's own tool
 * name, so an allowlist written in Claude's vocabulary would silence this
 * guard on every host that spells its write tools differently. A DENY-list of
 * read tools fails the other way — an unrecognised tool is still judged.
 *
 * An envelope with no tool name is judged too, for the same reason
 * `_concern_matches_tool` runs a concern when the field is absent: a key that
 * cannot decide must not be what silences a blocking guard.
 */
const _READ_ONLY_TOOLS: ReadonlySet<string> = new Set([
    'read', 'grep', 'glob', 'notebookread', 'ls', 'view', 'search',
    'codebase-retrieval', 'codebase_retrieval', 'file_search', 'grep_search',
    'read_file', 'list_dir', 'semantic_search',
]);

function _isObject(v: JsonValue | undefined): v is JsonObject {
    return v !== null && v !== undefined && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Segment-leading command words that cannot bring a path into existence.
 *
 * READING IS NOT CREATING, AND THE COMMAND SCAN DID NOT KNOW IT. The scan in
 * `main` offered every whitespace token of a shell command to the same verdict
 * that judges a Write target, so `ls -d agents/tmp/<name>-*` — a read, over a
 * glob, that creates nothing — was refused exactly like `mkdir`. Measured
 * twice in one session while running the inbox flow over a real round: the
 * command that lists which round identifiers are already taken is a command
 * this guard blocked, so the guard stood between the operator and the naming
 * rule it exists to enforce.
 *
 * A closed allowlist of read-only verbs rather than a deny-list of creating
 * ones, so an unknown verb is still scanned and closing the false positive
 * opens no bypass. `echo` and `printf` are listed because their only creating
 * form is a redirect, which {@link _redirectTargets} judges separately.
 *
 * `git` is deliberately absent: `git mv` creates, and separating its read
 * subcommands would buy one rare case (`git log -- agents/tmp/<name>/`, over a
 * gitignored tree that returns nothing) for a second place to get the split
 * wrong.
 */
const _READ_ONLY_VERBS: ReadonlySet<string> = new Set([
    'awk', 'basename', 'bat', 'cat', 'cmp', 'column', 'cut', 'diff', 'dirname',
    'du', 'echo', 'egrep', 'fd', 'fgrep', 'file', 'find', 'grep', 'head', 'jq',
    'less', 'ls', 'nl', 'printf', 'readlink', 'realpath', 'rg', 'sed', 'sort',
    'stat', 'tail', 'test', 'tr', 'type', 'uniq', 'wc', 'which', 'yq',
]);

/**
 * Per-verb markers that turn one of the verbs above into a writing one.
 *
 * FOUR OF THE ALLOWLISTED VERBS CAN CREATE, and the first version of this
 * allowlist said they could not. `sed -i` edits in place and `sed`'s `w`
 * command opens a file; `find -exec` runs anything and `-fprint` writes;
 * `awk`'s `system()` and `print >` do both. A neutral review of this change
 * probed all of them and every one came back allowed where the token scan this
 * commit replaced had blocked it — a coverage regression, not a false
 * positive, which is the direction that matters for a blocking guard.
 *
 * Scoped per verb rather than as one combined pattern, because the obvious
 * combined form checks for `-i` and `grep -i` is a read: a shared regex would
 * reintroduce the false positive at the other end.
 */
const _WRITING_MARKERS: ReadonlyMap<string, RegExp> = new Map([
    ['sed', /(?:^|\s)(?:-[a-zA-Z]*i|--in-place)(?:\b|=)|(?:^|['"\s;])[wW]\s/],
    ['find', /(?:^|\s)-(?:exec|execdir|ok|okdir|delete|fprint|fprintf|fls)(?:\b|$)/],
    ['awk', /\bsystem\s*\(|\bprintf?\b[^|]*>/],
]);

/** The command word of one segment, without its directory prefix or arguments. */
function _verbOf(segment: string): string {
    const head = segment.trim().split(/\s+/)[0] ?? '';
    return (head.split('/').pop() ?? '').toLowerCase();
}

/**
 * The paths a redirect inside one segment would create.
 *
 * `splitOutsideQuotes` treats `;`, `|`, `&` and newline as separators and `>`
 * as ordinary text, so a redirect target stays inside its segment — and a
 * read-only verb would otherwise carry it past the allowlist above.
 * `echo hi > agents/tmp/<name>/note.md` creates the directory as surely as
 * `mkdir` does; `ls … 2>/dev/null` does not. The difference is the target, not
 * the verb, so targets are judged even when the verb is read-only.
 */
function _redirectTargets(segment: string): string[] {
    const out: string[] = [];
    const re = /(?:^|[^0-9<>&])[0-9]*>>?\s*([^\s|&;<>]+)/g;
    let m: RegExpExecArray | null = re.exec(segment);
    while (m !== null) {
        // The character class stops at whitespace and separators but NOT at a
        // quote, while both inbox regexes require `agents` at a `/` or at the
        // start of the string. So `> "agents/tmp/<name>/x"` came back as
        // `"agents/tmp/…` and read as not-an-inbox-path — allowed, where the
        // unquoted form blocked. A neutral review probed it; stripping the
        // quotes is the whole fix.
        const target = (m[1] ?? '').replace(/^['"`]+|['"`]+$/g, '');
        if (target) {
            out.push(target);
        }
        m = re.exec(segment);
    }
    return out;
}

/** Is this ONE segment incapable of bringing a path into existence? */
function _segmentIsReadOnly(segment: string): boolean {
    const verb = _verbOf(segment);
    if (!_READ_ONLY_VERBS.has(verb)) {
        return false;
    }
    const marker = _WRITING_MARKERS.get(verb);
    return marker === undefined || !marker.test(segment);
}

/**
 * The tokens of a shell command whose CREATION this guard should judge.
 *
 * THE GATE IS THE WHOLE COMMAND, NOT THE SEGMENT, and the first version of
 * this function skipped per segment. That looked more precise and was a hole:
 * in `echo <path> | xargs mkdir -p` the path sits in the read-only segment and
 * the creating segment carries no path at all, so both halves passed. Nothing
 * is lost by widening it — a read token only ever causes a refusal when it
 * names a speaking inbox directory, and in a command that also creates, that
 * is the conservative answer.
 *
 * A HEREDOC IS JUDGED FROM THE RAW TEXT. Segmentation reuses
 * `git_command_classifier`'s `invokedSegments`, so this guard and its two
 * siblings on the slot agree about what a segment is — but that module answers
 * "which commands run" and therefore strips heredoc BODIES as data. This guard
 * asks "which paths appear", so the discarded text is exactly its input:
 * `cat <<'EOF' > <inbox>/x` and a `python3 - <<PY` body calling `makedirs`
 * both came back empty. A heredoc writes content somewhere by construction, so
 * its presence drops the read-only skip and the raw command is scanned.
 *
 * Both widenings come from a neutral review of this change, which probed eight
 * bypasses against the token scan this function replaced. They are coverage
 * regressions rather than false positives — the direction that matters when
 * the concern is `severity: blocking`.
 *
 * Exported so the harness can pin the polarity pair on the tokens themselves,
 * without an envelope.
 */
export function creatableTokens(command: string): string[] {
    const out: string[] = [];
    const segments = invokedSegments(command);
    const hasHeredoc = /<<-?\s*['"]?[A-Za-z_]/.test(command);
    const allReadOnly = !hasHeredoc && segments.every(_segmentIsReadOnly);
    for (const seg of segments) {
        out.push(..._redirectTargets(seg));
    }
    if (allReadOnly) {
        return out;
    }
    const scanned = hasHeredoc ? [...segments, command] : segments;
    for (const text of scanned) {
        for (const tok of text.split(/[\s"'`(){};|&<>]+/)) {
            if (tok) {
                out.push(tok);
            }
        }
    }
    return out;
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
    // THE CAPTURE CARRIES THE PATH'S OWN PREFIX, and it did not. Anchoring the
    // group at `agents/` discarded everything before it, so a nested inbox —
    // `app/Modules/<m>/agents/tmp/<round>/…`, the shape a module-per-package
    // tree produces — probed `<repoRoot>/agents/tmp/<round>`, a directory that
    // does not exist. The already-exists carve-out could therefore never fire
    // there, and every write into a nested speaking round was refused forever
    // instead of once.
    //
    // The prefix group is `??` — optional AND preferring ABSENT — and that is
    // the half a neutral review had to point out. A greedy `(?:.*\/)?`
    // resolves to the LAST inbox segment in the path while `inboxDirName`
    // reads the FIRST, so a path carrying two of them judged one directory and
    // probed another, reporting "already exists" for a name that does not.
    // Making only `.*` lazy is NOT enough: `(...)?` still prefers one
    // repetition, so the engine grows the prefix rather than trying the
    // no-prefix branch, and the long match wins anyway — the test for this
    // caught exactly that. `??` tries no-prefix first, so both reads agree.
    // The decoy case below still resolves: `agents/tmp-notes/` fails the `/`
    // after `tmp`, so the no-prefix branch is rejected and the match advances.
    const normalized = filePath.replace(/\\/g, '/').replace(/^(\.\/)+/, '');
    const m =
        /^((?:.*?\/)??agents\/tmp(?:\.old)?\/[^/]+)\//.exec(normalized) ??
        /^((?:.*?\/)??agents\/tmp(?:\.old)?\/[^/.]+)\/?$/.exec(normalized);
    if (m === null) {
        // `inboxDirName` matched but this did not — treat as unattributable and
        // BLOCK, since the name is speaking and we cannot prove it pre-exists.
        return { block: true, dir, reason: 'new inbox directory with a speaking name (path not re-anchorable)' };
    }
    const upto = m[1] as string;
    const probe = repoRoot === '' || path.isAbsolute(upto) ? upto : path.join(repoRoot, upto);
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
        const rawTool = payload['tool_name'] ?? envelope['tool_name'];
        const toolName = typeof rawTool === 'string' ? rawTool.trim().toLowerCase() : '';
        const candidates: string[] = [];
        if (!_READ_ONLY_TOOLS.has(toolName)) {
            for (const key of _PATH_KEYS) {
                const v = ti[key];
                if (typeof v === 'string' && v) {
                    candidates.push(v);
                }
            }
        }
        // A shell command creates the directory just as effectively as a Write,
        // and this guard read only the path keys — so `mkdir -p
        // agents/tmp/<speaking-name>`, a `git mv` into one, or a redirect
        // bypassed it entirely. Both siblings on this slot (`block_no_verify`,
        // `block_kernel_rule_writes`) parse the command string; this one did
        // not, and the R2 review of this branch caught it. The tokens that
        // could CREATE something are offered to the same pure verdict, so the
        // decision logic is shared rather than duplicated — see
        // `creatableTokens` for why "every whitespace token" was too many.
        const cmd = ti['command'] ?? (_isObject(envelope['payload']) ? (envelope['payload'] as JsonObject)['command'] : undefined);
        if (typeof cmd === 'string' && cmd) {
            candidates.push(...creatableTokens(cmd));
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
