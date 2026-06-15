#!/usr/bin/env tsx
/**
 * Evidence Report template automation.
 *
 * TypeScript twin of `src/scripts/evidence_report.py` (ADR-200). The CLI
 * contract mirrors the Python original EXACTLY — same subcommands
 * (`init`, `add`, `git-state`), same flags, same exit codes (0 / 1 / 3),
 * same stdout/stderr split, byte-identical messages, the same
 * skeleton/provenance text, the same heading-insertion logic, and the
 * same git-root / git-dir / git-op detection. No behaviour changes —
 * latent bugs are replicated and flagged in the porting report, not fixed.
 *
 * Scaffolds and updates the per-task Evidence Report (gitignored session
 * scratchpad) so the evidence-first structure-discovery discipline never
 * gets skipped.
 *
 * Subcommands:
 *   init       Create/overwrite agents/memory/knowledge/session/evidence-report.md
 *              with a three-bucket skeleton (Verified / Assumed / Gaps).
 *   add        Append one evidence line to a bucket with inline provenance.
 *   git-state  Detect in-progress git operations (rebase/merge/cherry-pick);
 *              exit 3 if any found, 0 if clean.
 *
 * Contract: src/agent-src/contexts/execution/evidence-discipline.md
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

// argparse `prog` is hardcoded to "evidence_report.py" in the Python original,
// so usage strings stay byte-identical regardless of the `.py`/`.ts` filename.
const PROG = 'evidence_report.py';
// First line of the module docstring — argparse `description`.
const DESCRIPTION = 'Evidence Report template automation.';

// ---------------------------------------------------------------------------
// Repo-root resolution
// ---------------------------------------------------------------------------

/** Return repo root via git, falling back to relative-path heuristic. */
function _repo_root(): string {
    const result = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
        // Script lives at src/scripts/; repo root is two levels up.
        const here = fileURLToPath(import.meta.url);
        return path.resolve(path.dirname(here), '..', '..');
    }
    return result.stdout.trim();
}

function _git_head_short(): string {
    const result = spawnSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf-8' });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
        return 'unknown';
    }
    return result.stdout.trim();
}

// ---------------------------------------------------------------------------
// Session file path
// ---------------------------------------------------------------------------

const SESSION_REL = 'agents/memory/knowledge/session/evidence-report.md';

function _session_path(root: string): string {
    const p = path.join(root, ...SESSION_REL.split('/'));
    fs.mkdirSync(path.dirname(p), { recursive: true });
    return p;
}

// ---------------------------------------------------------------------------
// Subcommand: init
// ---------------------------------------------------------------------------

const SKELETON = `---
task: {task}
generated_at: {generated_at}
head: {head}
---

> This file is gitignored, overwritten each task, and soft-capped to
> ~10–20 decision-relevant facts. It feeds the plan — not a forensic log.

## Verified (confirmed this session)

<!-- Add items via: evidence_report.py add --bucket verified --claim "..." --source "file:line" -->

## Assumed (from card) — hypothesis, confirm before use

<!-- Add items via: evidence_report.py add --bucket assumed --claim "..." --source "file:line" -->

## Gaps (missing evidence)

<!-- Add items via: evidence_report.py add --bucket gaps --claim "..." -->
`;

function cmd_init(args: ParsedArgs, root: string): number {
    const p = _session_path(root);
    const now = _isoTimespecSeconds();
    const head = _git_head_short();
    const content = SKELETON.replace('{task}', args.task || '(unnamed)')
        .replace('{generated_at}', now)
        .replace('{head}', head);
    fs.writeFileSync(p, content, 'utf-8');
    process.stdout.write(`Evidence Report written: ${_relTo(root, p)}\n`);
    return 0;
}

// ---------------------------------------------------------------------------
// Subcommand: add
// ---------------------------------------------------------------------------

const BUCKET_HEADINGS: Record<string, string> = {
    verified: '## Verified (confirmed this session)',
    assumed: '## Assumed (from card) — hypothesis, confirm before use',
    gaps: '## Gaps (missing evidence)',
};

function _build_provenance(args: ParsedArgs): string {
    const observed_at = args.observed_at || _isoTimespecSeconds();
    const parts: string[] = [`observed_at=${observed_at}`];
    if (args.source) {
        parts.push(`source=${args.source}`);
    }
    if (args.version) {
        parts.push(`version=${args.version}`);
    }
    if (args.bucket === 'gaps') {
        if (args.searched) {
            parts.push(`searched=${args.searched}`);
        }
        if (args.not_searched) {
            parts.push(`not_searched=${args.not_searched}`);
        }
    }
    return parts.join(' · ');
}

function cmd_add(args: ParsedArgs, root: string): number {
    const p = _session_path(root);
    if (!fs.existsSync(p)) {
        process.stderr.write('No evidence-report.md found; run `init` first.\n');
        return 1;
    }

    const heading = BUCKET_HEADINGS[args.bucket as string] as string;
    const provenance = _build_provenance(args);
    const new_line = `- ${args.claim}  \`[${provenance}]\`\n`;

    const text = fs.readFileSync(p, 'utf-8');
    if (!text.includes(heading)) {
        process.stderr.write(`Heading '${heading}' not found in report.\n`);
        return 1;
    }

    // Insert after the heading (and any immediately following comment block).
    const lines = _splitlinesKeepends(text);
    let insert_at: number | null = null;
    let in_target = false;
    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (line.trim() === heading) {
            in_target = true;
            continue;
        }
        if (in_target) {
            // Skip blank lines and HTML comment blocks right after heading.
            const stripped = line.trim();
            if (stripped === '' || stripped.startsWith('<!--') || stripped.endsWith('-->')) {
                continue;
            }
            // Insert before the first non-empty, non-comment line,
            // or at the next heading boundary.
            insert_at = i;
            break;
        }
        // NOTE: dead branch in the Python original (in_target is false here);
        // replicated faithfully — never reached.
        if (in_target && line.startsWith('## ')) {
            insert_at = i;
            break;
        }
    }

    if (insert_at === null) {
        // Bucket is at end of file; just append.
        lines.push(new_line);
    } else {
        lines.splice(insert_at, 0, new_line);
    }

    fs.writeFileSync(p, lines.join(''), 'utf-8');
    const claim = args.claim as string;
    const truncated = _pyLen(claim) > 60 ? `${_pySlice(claim, 60)}…` : claim;
    process.stdout.write(`Added to [${args.bucket}]: ${truncated}\n`);
    return 0;
}

// ---------------------------------------------------------------------------
// Subcommand: git-state
// ---------------------------------------------------------------------------

// Live git-op markers only. NOTE: `.git/REBASE_HEAD` is deliberately excluded —
// it lingers as a stale ref after a *completed* rebase and would cause a false
// fail-fast on every run. The authoritative "rebase in progress" markers are the
// `rebase-merge` / `rebase-apply` directories (removed on completion).
const GIT_OP_MARKERS = ['MERGE_HEAD', 'CHERRY_PICK_HEAD'];
const GIT_OP_DIRS = ['rebase-merge', 'rebase-apply'];

function _git_dir(root: string): string | null {
    const result = spawnSync('git', ['rev-parse', '--git-dir'], { encoding: 'utf-8', cwd: root });
    if (result.error || result.status !== 0 || typeof result.stdout !== 'string') {
        return null;
    }
    const gd = result.stdout.trim();
    const p = path.isAbsolute(gd) ? gd : path.join(root, gd);
    return path.resolve(p);
}

function cmd_git_state(_args: ParsedArgs, root: string): number {
    const git_dir = _git_dir(root);
    if (git_dir === null) {
        process.stderr.write('Not a git repository or git not found.\n');
        return 3;
    }

    const active: string[] = [];
    for (const marker of GIT_OP_MARKERS) {
        if (fs.existsSync(path.join(git_dir, marker))) {
            active.push(marker.replace('_HEAD', '').toLowerCase());
        }
    }
    for (const d of GIT_OP_DIRS) {
        if (_isDir(path.join(git_dir, d))) {
            active.push(d);
        }
    }

    if (active.length > 0) {
        process.stdout.write(`git-op-in-progress: ${active.join(', ')}\n`);
        return 3;
    }

    process.stdout.write('clean\n');
    return 0;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mirror datetime.now(timezone.utc).isoformat(timespec="seconds") → +00:00 offset. */
function _isoTimespecSeconds(): string {
    const now = new Date();
    const y = now.getUTCFullYear().toString().padStart(4, '0');
    const mo = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = now.getUTCDate().toString().padStart(2, '0');
    const h = now.getUTCHours().toString().padStart(2, '0');
    const mi = now.getUTCMinutes().toString().padStart(2, '0');
    const s = now.getUTCSeconds().toString().padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}:${s}+00:00`;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** Mirror pathlib path.relative_to(root) → POSIX-style relative string. */
function _relTo(root: string, p: string): string {
    const rel = path.relative(root, p);
    return rel.split(path.sep).join('/');
}

/** Mirror str.splitlines(keepends=True): keep the line terminator on each line. */
function _splitlinesKeepends(text: string): string[] {
    if (text === '') {
        return [];
    }
    const out: string[] = [];
    let buf = '';
    for (let i = 0; i < text.length; i += 1) {
        const ch = text[i] as string;
        buf += ch;
        if (ch === '\n') {
            out.push(buf);
            buf = '';
        } else if (ch === '\r') {
            if (text[i + 1] === '\n') {
                buf += '\n';
                i += 1;
            }
            out.push(buf);
            buf = '';
        }
    }
    if (buf !== '') {
        out.push(buf);
    }
    return out;
}

/** Mirror Python len(str) — code-point count, not UTF-16 unit count. */
function _pyLen(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Mirror Python str[:n] — first n code points. */
function _pySlice(s: string, n: number): string {
    let out = '';
    let count = 0;
    for (const ch of s) {
        if (count >= n) {
            break;
        }
        out += ch;
        count += 1;
    }
    return out;
}

// ---------------------------------------------------------------------------
// Argument parser
// ---------------------------------------------------------------------------

interface ParsedArgs {
    root: string | null;
    command: string | null;
    task: string;
    bucket: string;
    claim: string;
    source: string;
    observed_at: string;
    version: string;
    searched: string;
    not_searched: string;
}

const BUCKET_CHOICES = ['verified', 'assumed', 'gaps'];

const TOP_USAGE = `usage: ${PROG} [-h] [--root ROOT] subcommand ...\n`;
const ADD_USAGE =
    `usage: ${PROG} add [-h] --bucket {verified,assumed,gaps} --claim\n` +
    `                              CLAIM [--source SOURCE]\n` +
    `                              [--observed-at OBSERVED_AT] [--version VERSION]\n` +
    `                              [--searched SEARCHED]\n` +
    `                              [--not-searched NOT_SEARCHED]\n`;
const INIT_USAGE = `usage: ${PROG} init [-h] [--task TASK]\n`;
const GIT_STATE_USAGE = `usage: ${PROG} git-state [-h]\n`;

function _topError(message: string): never {
    process.stderr.write(TOP_USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

function _subUsage(sub: string): string {
    if (sub === 'add') {
        return ADD_USAGE;
    }
    if (sub === 'init') {
        return INIT_USAGE;
    }
    return GIT_STATE_USAGE;
}

function _subError(sub: string, message: string): never {
    process.stderr.write(_subUsage(sub));
    process.stderr.write(`${PROG} ${sub}: error: ${message}\n`);
    process.exit(2);
}

function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = {
        root: null,
        command: null,
        task: '',
        bucket: '',
        claim: '',
        source: '',
        observed_at: '',
        version: '',
        searched: '',
        not_searched: '',
    };

    // Top-level option parsing up to the subcommand token.
    let i = 0;
    for (; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            _printTopHelp();
            process.exit(0);
        } else if (a === '--root') {
            const v = argv[++i];
            if (v === undefined) {
                _topError('argument --root: expected one argument');
            }
            args.root = v;
        } else if (a.startsWith('--root=')) {
            args.root = a.slice('--root='.length);
        } else if (a.startsWith('-')) {
            _topError(`unrecognized arguments: ${a}`);
        } else {
            break; // subcommand token
        }
    }

    if (i >= argv.length) {
        // sub.required = True
        _topError('the following arguments are required: subcommand');
    }

    const sub = argv[i] as string;
    if (sub !== 'init' && sub !== 'add' && sub !== 'git-state') {
        _topError(`argument subcommand: invalid choice: '${sub}' (choose from 'init', 'add', 'git-state')`);
    }
    args.command = sub;
    const rest = argv.slice(i + 1);

    if (sub === 'init') {
        _parseInit(rest, args);
    } else if (sub === 'add') {
        _parseAdd(rest, args);
    } else {
        _parseGitState(rest);
    }

    return args;
}

function _parseInit(rest: string[], args: ParsedArgs): void {
    for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(INIT_USAGE);
            process.exit(0);
        } else if (a === '--task') {
            const v = rest[++j];
            if (v === undefined) {
                _subError('init', 'argument --task: expected one argument');
            }
            args.task = v;
        } else if (a.startsWith('--task=')) {
            args.task = a.slice('--task='.length);
        } else {
            _subError('init', `unrecognized arguments: ${a}`);
        }
    }
}

function _parseAdd(rest: string[], args: ParsedArgs): void {
    let bucketSet = false;
    let claimSet = false;
    for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j] as string;
        const eq = a.indexOf('=');
        const flag = a.startsWith('--') && eq !== -1 ? a.slice(0, eq) : a;
        const inlineVal = a.startsWith('--') && eq !== -1 ? a.slice(eq + 1) : null;
        const takeVal = (name: string): string => {
            if (inlineVal !== null) {
                return inlineVal;
            }
            const v = rest[++j];
            if (v === undefined) {
                _subError('add', `argument ${name}: expected one argument`);
            }
            return v;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(ADD_USAGE);
            process.exit(0);
        } else if (flag === '--bucket') {
            const v = takeVal('--bucket');
            if (!BUCKET_CHOICES.includes(v)) {
                _subError('add', `argument --bucket: invalid choice: '${v}' (choose from 'verified', 'assumed', 'gaps')`);
            }
            args.bucket = v;
            bucketSet = true;
        } else if (flag === '--claim') {
            args.claim = takeVal('--claim');
            claimSet = true;
        } else if (flag === '--source') {
            args.source = takeVal('--source');
        } else if (flag === '--observed-at') {
            args.observed_at = takeVal('--observed-at');
        } else if (flag === '--version') {
            args.version = takeVal('--version');
        } else if (flag === '--searched') {
            args.searched = takeVal('--searched');
        } else if (flag === '--not-searched') {
            args.not_searched = takeVal('--not-searched');
        } else {
            _subError('add', `unrecognized arguments: ${a}`);
        }
    }
    const missing: string[] = [];
    if (!bucketSet) {
        missing.push('--bucket');
    }
    if (!claimSet) {
        missing.push('--claim');
    }
    if (missing.length > 0) {
        _subError('add', `the following arguments are required: ${missing.join(', ')}`);
    }
}

function _parseGitState(rest: string[]): void {
    for (let j = 0; j < rest.length; j += 1) {
        const a = rest[j] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(GIT_STATE_USAGE);
            process.exit(0);
        } else {
            _subError('git-state', `unrecognized arguments: ${a}`);
        }
    }
}

function _printTopHelp(): void {
    // Help prose is excluded from the byte-parity contract; emit the usage line.
    process.stdout.write(TOP_USAGE);
    process.stdout.write('\n');
    process.stdout.write(`${DESCRIPTION}\n`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

function main(): number {
    const args = _parseArgs(process.argv.slice(2));
    const root = args.root ? args.root : _repo_root();

    if (args.command === 'init') {
        return cmd_init(args, root);
    }
    if (args.command === 'add') {
        return cmd_add(args, root);
    }
    if (args.command === 'git-state') {
        return cmd_git_state(args, root);
    }

    _printTopHelp();
    return 1;
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (_isMain) {
    process.exit(main());
}

export { main };
