#!/usr/bin/env tsx
/**
 * Knowledge-card usage counter — Phase 4 v1-safe instrument.
 *
 * TypeScript twin of `src/scripts/knowledge_card_usage.py` (ADR-200). The
 * CLI contract mirrors the Python original EXACTLY — same subcommands
 * (`record --card`, `show`), same flags, same exit codes, same
 * stdout/stderr split, byte-identical messages, same JSON store shape
 * (`json.dumps(..., indent=2, ensure_ascii=False)`), and the same repo-root
 * / repo-slug resolution via git. No behaviour changes — latent bugs are
 * replicated and flagged in the porting report, not fixed.
 *
 * Records which knowledge cards are consulted and in which repo (by
 * owner/repo slug, never by absolute path or file contents).
 *
 * NOTE: `agents/memory/knowledge/session/usage.json` must be gitignored.
 *       The script creates the directory and file but never touches .gitignore.
 *       Maintainer is responsible for the gitignore entry.
 *
 * Phase 4 v1-safe instrument ONLY. No global write, no promotion, no
 * auto->=2. Cross-project reuse is MEASURED here; the decision to build
 * a global layer is a gated follow-up.
 *
 * Subcommands:
 *   record --card <name>   Tick usage for a card in the current repo.
 *   show                   Print the usage JSON to stdout.
 *
 * Exit codes: 0 = success, 1 = usage error, 3 = internal error.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

// First line of the module docstring — argparse `description`.
const DESCRIPTION = 'Knowledge-card usage counter — Phase 4 v1-safe instrument.';
// argparse derives `prog` from sys.argv[0] basename → `knowledge_card_usage.py`.
// Hardcode the `.py` form so error usage strings stay byte-identical.
const PROG = 'knowledge_card_usage.py';

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

const _STORE_RELPATH = path.join('agents', 'memory', 'knowledge', 'session', 'usage.json');

/** Resolve the git repo root; fall back to cwd if git is unavailable. */
function _repo_root(): string {
    const r = spawnSync('git', ['rev-parse', '--show-toplevel'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (r.error || r.status !== 0 || typeof r.stdout !== 'string') {
        return process.cwd();
    }
    return r.stdout.trim();
}

function _store_path(): string {
    return path.join(_repo_root(), _STORE_RELPATH);
}

type Store = Record<string, unknown>;

function _load(store: string): Store {
    if (fs.existsSync(store)) {
        try {
            return JSON.parse(fs.readFileSync(store, 'utf-8')) as Store;
        } catch {
            return { cards: {} };
        }
    }
    return { cards: {} };
}

function _save(store: string, data: Store): void {
    fs.mkdirSync(path.dirname(store), { recursive: true });
    fs.writeFileSync(store, pyJsonDumps(data, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Python-compatible JSON serializer (json.dumps(..., indent=2,
// ensure_ascii=False)). Object key order is preserved (dict insertion order).
// ---------------------------------------------------------------------------

function pyJsonDumps(value: unknown, indent: number): string {
    // ensure_ascii=False → do not escape non-ASCII. JS JSON.stringify with an
    // indent already matches Python's item-separator (`,\n`) and key-separator
    // (`": "`) for the indented form.
    return JSON.stringify(value, null, indent);
}

// ---------------------------------------------------------------------------
// Repo slug — owner/repo from remote.origin.url, never an absolute path
// ---------------------------------------------------------------------------

const _SLUG_RE = /[:/]([^/]+\/[^/]+?)(?:\.git)?$/;

/** Return 'owner/repo' from remote.origin.url, or 'local/unknown'. */
function _repo_slug(): string {
    const r = spawnSync('git', ['config', '--get', 'remote.origin.url'], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!r.error && r.status === 0 && typeof r.stdout === 'string') {
        const url = r.stdout.trim();
        const m = _SLUG_RE.exec(url);
        if (m) {
            return m[1] as string;
        }
    }
    return 'local/unknown';
}

// ---------------------------------------------------------------------------
// Subcommands
// ---------------------------------------------------------------------------

interface RepoEntry {
    count: number;
    last_used: string;
}

/** Tick a usage count for `card` in the current repo. */
function cmd_record(card: string): number {
    const store = _store_path();
    const data = _load(store);
    const cards = _setdefaultObj(data, 'cards');
    const entry = _setdefaultObj(cards, card, { repos: {} });
    const repos = _setdefaultObj(entry, 'repos');
    const slug = _repo_slug();
    const repo_entry = _setdefaultObj(repos, slug, { count: 0, last_used: '' }) as unknown as RepoEntry;
    repo_entry.count += 1;
    repo_entry.last_used = _utcNowStrftime();
    _save(store, data);
    process.stdout.write(`Recorded: ${card} in ${slug} (count=${repo_entry.count})\n`);
    return 0;
}

/** Print the usage JSON to stdout. */
function cmd_show(): number {
    const store = _store_path();
    const data = _load(store);
    process.stdout.write(`${pyJsonDumps(data, 2)}\n`);
    return 0;
}

/**
 * Mirror dict.setdefault(key, default): return the existing value if present,
 * else insert `def` and return it. Preserves insertion order like a Python dict.
 */
function _setdefaultObj(
    obj: Record<string, unknown>,
    key: string,
    def: Record<string, unknown> = {},
): Record<string, unknown> {
    if (!(key in obj)) {
        obj[key] = def;
    }
    return obj[key] as Record<string, unknown>;
}

/** Mirror datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"). */
function _utcNowStrftime(): string {
    const now = new Date();
    const y = now.getUTCFullYear().toString().padStart(4, '0');
    const mo = (now.getUTCMonth() + 1).toString().padStart(2, '0');
    const d = now.getUTCDate().toString().padStart(2, '0');
    const h = now.getUTCHours().toString().padStart(2, '0');
    const mi = now.getUTCMinutes().toString().padStart(2, '0');
    const s = now.getUTCSeconds().toString().padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}:${s}Z`;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

interface ParsedArgs {
    cmd: string | null;
    card: string;
}

function main(): number {
    const args = _parseArgs(process.argv.slice(2));

    if (args.cmd === null) {
        _printHelp();
        return 1;
    }

    try {
        if (args.cmd === 'record') {
            return cmd_record(args.card);
        }
        if (args.cmd === 'show') {
            return cmd_show();
        }
    } catch (exc) {
        process.stderr.write(`Internal error: ${_excMessage(exc)}\n`);
        return 3;
    }

    return 0;
}

function _excMessage(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

/** Minimal argparse-compatible parser for this script's surface. */
function _parseArgs(argv: string[]): ParsedArgs {
    const args: ParsedArgs = { cmd: null, card: '' };
    if (argv.length === 0) {
        return args;
    }

    // -h / --help before any subcommand → top-level help.
    let i = 0;
    if (argv[0] === '-h' || argv[0] === '--help') {
        _printHelp();
        process.exit(0);
    }

    const sub = argv[0] as string;
    if (sub !== 'record' && sub !== 'show') {
        _topError(`argument subcommand: invalid choice: '${sub}' (choose from 'record', 'show')`);
    }
    args.cmd = sub;
    const rest = argv.slice(1);

    if (sub === 'record') {
        let card: string | null = null;
        for (i = 0; i < rest.length; i += 1) {
            const a = rest[i] as string;
            if (a === '--card') {
                card = rest[++i] as string | undefined ?? _subError('record', 'argument --card: expected one argument');
            } else if (a.startsWith('--card=')) {
                card = a.slice('--card='.length);
            } else if (a === '-h' || a === '--help') {
                _printSubHelp('record');
                process.exit(0);
            } else {
                _subError('record', `unrecognized arguments: ${a}`);
            }
        }
        if (card === null) {
            _subError('record', 'the following arguments are required: --card');
        }
        args.card = card as string;
    } else {
        // show
        for (i = 0; i < rest.length; i += 1) {
            const a = rest[i] as string;
            if (a === '-h' || a === '--help') {
                _printSubHelp('show');
                process.exit(0);
            } else {
                _subError('show', `unrecognized arguments: ${a}`);
            }
        }
    }

    return args;
}

const TOP_USAGE = `usage: ${PROG} [-h] subcommand ...\n`;

function _topError(message: string): never {
    process.stderr.write(TOP_USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    process.exit(2);
}

function _subUsage(sub: string): string {
    if (sub === 'record') {
        return `usage: ${PROG} record [-h] --card NAME\n`;
    }
    return `usage: ${PROG} show [-h]\n`;
}

function _subError(sub: string, message: string): never {
    process.stderr.write(_subUsage(sub));
    process.stderr.write(`${PROG} ${sub}: error: ${message}\n`);
    process.exit(2);
}

function _printHelp(): void {
    process.stdout.write(TOP_USAGE);
    process.stdout.write('\n');
    process.stdout.write(`${DESCRIPTION}\n`);
    process.stdout.write('\n');
    process.stdout.write('positional arguments:\n');
    process.stdout.write('  subcommand\n');
    process.stdout.write('    record    Tick usage for a card in the current repo\n');
    process.stdout.write('    show      Print usage JSON to stdout\n');
    process.stdout.write('\n');
    process.stdout.write('optional arguments:\n');
    process.stdout.write('  -h, --help  show this help message and exit\n');
}

function _printSubHelp(sub: string): void {
    process.stdout.write(_subUsage(sub));
}

const _isMain =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;
if (_isMain) {
    process.exit(main());
}

export { main };
