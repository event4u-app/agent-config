#!/usr/bin/env node
/**
 * PR risk classifier.
 *
 * TypeScript twin of `src/agent-src/templates/scripts/pr_risk_review.py`
 * (ADR-094). Byte-for-byte behavioural parity with the Python original:
 * same CLI flags, same glob→regex translation, same Markdown report, same
 * single-word risk level, same exit codes, same stdout/stderr split.
 *
 * Reads a list of changed files between two git refs, matches each path
 * against glob patterns defined in a YAML config, and emits a Markdown report
 * plus a single-word risk level (low / medium / high) for downstream CI steps.
 *
 * The classifier is intentionally heuristic — it flags paths that historically
 * correlate with higher blast radius (migrations, auth code, lockfiles, public
 * endpoints). It is a conversation starter for reviewers, not a merge gate.
 *
 * Config file format — see `pr-risk-config.example.yml` alongside this script.
 *
 * Usage:
 *     pr_risk_review.ts \
 *         --base <sha> --head <sha> \
 *         --config .github/pr-risk-config.yml \
 *         --output risk-report.md \
 *         --level-file risk-level.txt
 *
 * Exit codes: 0 = success, 2 = invalid arguments, 3 = git/config error.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import * as fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import type * as YamlModule from 'yaml';

// Mirrors Python's top-level `import yaml` (with its `except ImportError →
// print + sys.exit(3)` fallback). `yaml` is a hard package dependency, so the
// missing-package branch is dead in practice; parsing with version '1.1'
// matches PyYAML's safe_load bool / int / null tolerance for byte-parity.
// Resolve relative to THIS module (not cwd): the script runs `git diff` in the
// caller's cwd, which may carry its own (possibly invalid) package.json, so a
// bare cwd-relative `import 'yaml'` would break under tsx/Bundler resolution.
const YAML = createRequire(import.meta.url)('yaml') as typeof YamlModule;

export const LEVELS = ['high', 'medium', 'low'] as const;

type Dict = Record<string, unknown>;

export const DEFAULT_CONFIG: Dict = {
    patterns: {
        high: [
            '**/migrations/**', '**/migration/**', '**/*.sql',
            '**/auth/**', '**/security/**', '**/policies/**',
            '**/.env*', '**/secrets/**',
            'composer.lock', 'package-lock.json', 'pnpm-lock.yaml',
            'yarn.lock', 'poetry.lock', 'Gemfile.lock', 'go.sum',
            '**/Dockerfile*', '**/docker-compose*.y*ml',
            '.github/workflows/**',
            // What an AI agent can do: tool registrations, MCP servers, agent
            // code and prompts change who can act on whose record.
            '**/mcp/**', '**/*mcp*', '**/agent/**', '**/bot/**', '**/bots/**',
            '**/ai-tools/**', '**/agent-tools/**', '**/prompts/**', '**/*.prompt*',
            '**/agent-actions.y*ml',
        ],
        medium: [
            '**/queue/**', '**/queues/**', '**/jobs/**', '**/listeners/**',
            '**/routes/**', '**/controllers/**', '**/api/**',
            '**/schema/**', '**/models/**', '**/entities/**',
            'composer.json', 'package.json', 'pyproject.toml', 'Gemfile',
        ],
    },
    ignore: [
        '**/*.md', '**/CHANGELOG*', '**/docs/**',
        '**/*.lock.hcl',
    ],
};

export interface Match {
    level: string;
    pattern: string;
    paths: string[];
}

const _compileCache = new Map<string, RegExp>();

/**
 * Translate a gitignore-ish glob to a regex.
 *
 * - `**​/` matches zero or more leading path segments.
 * - `/**` matches zero or more trailing path segments.
 * - `**` matches any characters (including `/`).
 * - `*` matches any characters except `/` (single segment).
 * - `?` matches a single non-slash character.
 */
export function _compile(pattern: string): RegExp {
    const cached = _compileCache.get(pattern);
    if (cached !== undefined) {
        return cached;
    }
    const out: string[] = [];
    let i = 0;
    const n = pattern.length;
    const special = '.^$+{}()[]|\\';
    while (i < n) {
        const c = pattern[i] as string;
        if (c === '*') {
            if (i + 1 < n && pattern[i + 1] === '*') {
                if (i + 2 < n && pattern[i + 2] === '/') {
                    out.push('(?:.*/)?');
                    i += 3;
                    continue;
                }
                if (i > 0 && pattern[i - 1] === '/') {
                    out[out.length - 1] = '(?:/.*)?'; // replace the trailing '/'
                    i += 2;
                    continue;
                }
                out.push('.*');
                i += 2;
                continue;
            }
            out.push('[^/]*');
        } else if (c === '?') {
            out.push('[^/]');
        } else if (special.includes(c)) {
            out.push(`\\${c}`);
        } else {
            out.push(c);
        }
        i += 1;
    }
    const re = new RegExp(`^${out.join('')}$`, 'su');
    if (_compileCache.size < 512) {
        _compileCache.set(pattern, re);
    }
    return re;
}

function _match(p: string, pattern: string): boolean {
    // Python re.match → anchored at start; the pattern is fully anchored
    // with ^…$, so `.match` semantics collapse to a full-string test.
    return _compile(pattern).test(p);
}

class ExitError extends Error {
    constructor(public code: number) {
        super(`__exit__${code}`);
    }
}

export function load_config(p: string | null): Dict {
    if (p === null || !_exists(p)) {
        return DEFAULT_CONFIG;
    }
    let data: unknown;
    try {
        data = YAML.parse(fs.readFileSync(p, 'utf-8'), { version: '1.1' });
    } catch (exc) {
        process.stderr.write(`error: config parse failed: ${_yamlErr(exc)}\n`);
        throw new ExitError(3);
    }
    const obj = (data === null || data === undefined) ? {} : data;
    return { ...DEFAULT_CONFIG, ...(obj as Dict) };
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function _yamlErr(exc: unknown): string {
    if (exc instanceof Error) {
        return exc.message;
    }
    return String(exc);
}

export function changed_files(base: string, head: string): string[] {
    const res = spawnSync('git', ['diff', '--name-only', `${base}...${head}`], {
        encoding: 'utf-8',
    });
    if (res.status !== 0) {
        const stderr = res.stderr ?? '';
        process.stderr.write(`error: git diff failed: ${stderr}\n`);
        throw new ExitError(3);
    }
    return (res.stdout ?? '').split('\n').filter((line) => line.trim() !== '');
}

function _asList(v: unknown): unknown[] {
    return Array.isArray(v) ? v : [];
}

export function classify(filesIn: string[], config: Dict): [string, Match[]] {
    const ignore = _asList(config['ignore']);
    let files = filesIn.filter((f) => !ignore.some((pat) => _match(f, pat as string)));
    const patterns = (typeof config['patterns'] === 'object'
        && config['patterns'] !== null
        && !Array.isArray(config['patterns']))
        ? (config['patterns'] as Dict)
        : {};

    // Insertion-ordered map keyed by `${level}\x00${pattern}` to mirror the
    // Python dict's insertion-order semantics.
    const hits = new Map<string, Match>();
    for (const level of ['high', 'medium'] as const) {
        for (const pattern of _asList(patterns[level])) {
            const pat = pattern as string;
            const matched = files.filter((f) => _match(f, pat));
            if (matched.length > 0) {
                hits.set(`${level}\0${pat}`, { level, pattern: pat, paths: matched });
            }
        }
    }

    const keys = [...hits.keys()];
    const level = keys.some((k) => k.startsWith('high\0'))
        ? 'high'
        : (keys.some((k) => k.startsWith('medium\0')) ? 'medium' : 'low');
    return [level, [...hits.values()]];
}

export function render(level: string, hits: Match[], total: number): string {
    const emojiMap: Record<string, string> = { high: '🔴', medium: '🟡', low: '🟢' };
    const emoji = emojiMap[level] as string;
    const lines: string[] = [
        `## ${emoji} PR Risk: **${level}**`,
        '',
        `_${total} changed file(s), ${hits.length} risk signal(s)._`,
        '',
    ];
    if (hits.length === 0) {
        lines.push(
            'No high- or medium-risk patterns matched. Reviewers: still ',
            'inspect the diff — the classifier only flags known hotspots.',
        );
        return `${lines.join('\n')}\n`;
    }

    for (const lvl of ['high', 'medium'] as const) {
        const bucket = hits.filter((h) => h.level === lvl);
        if (bucket.length === 0) {
            continue;
        }
        const headEmoji = lvl === level ? emoji : (lvl === 'medium' ? '🟡' : '🟢');
        lines.push(`### ${headEmoji} ${_capitalize(lvl)}`);
        for (const m of bucket) {
            lines.push(`- \`${m.pattern}\` — ${m.paths.length} file(s)`);
            for (const p of m.paths.slice(0, 5)) {
                lines.push(`  - \`${p}\``);
            }
            if (m.paths.length > 5) {
                lines.push(`  - … and ${m.paths.length - 5} more`);
            }
        }
        lines.push('');
    }

    lines.push(
        '---',
        '_Classifier is heuristic. Merge is not blocked by this check._',
    );
    return `${lines.join('\n')}\n`;
}

/** Mirror Python `str.capitalize()` — first char upper, rest lower. */
function _capitalize(s: string): string {
    if (s.length === 0) {
        return s;
    }
    return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

interface Args {
    base: string;
    head: string;
    config: string | null;
    output: string;
    levelFile: string;
}

function _parseArgs(argv: string[]): Args {
    const a: Partial<Args> = { config: null };
    for (let i = 0; i < argv.length; i += 1) {
        const tok = argv[i] as string;
        const next = (): string => {
            i += 1;
            return argv[i] as string;
        };
        if (tok === '--base') {
            a.base = next();
        } else if (tok === '--head') {
            a.head = next();
        } else if (tok === '--config') {
            a.config = next();
        } else if (tok === '--output') {
            a.output = next();
        } else if (tok === '--level-file') {
            a.levelFile = next();
        } else if (tok.startsWith('--base=')) {
            a.base = tok.slice('--base='.length);
        } else if (tok.startsWith('--head=')) {
            a.head = tok.slice('--head='.length);
        } else if (tok.startsWith('--config=')) {
            a.config = tok.slice('--config='.length);
        } else if (tok.startsWith('--output=')) {
            a.output = tok.slice('--output='.length);
        } else if (tok.startsWith('--level-file=')) {
            a.levelFile = tok.slice('--level-file='.length);
        } else {
            throw new ArgError(`unrecognized arguments: ${tok}`);
        }
    }
    const missing: string[] = [];
    if (a.base === undefined) missing.push('--base');
    if (a.head === undefined) missing.push('--head');
    if (a.output === undefined) missing.push('--output');
    if (a.levelFile === undefined) missing.push('--level-file');
    if (missing.length > 0) {
        throw new ArgError(`the following arguments are required: ${missing.join(', ')}`);
    }
    return a as Args;
}

class ArgError extends Error {}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: Args;
    try {
        args = _parseArgs(argv);
    } catch (exc) {
        if (exc instanceof ArgError) {
            // argparse prints usage + error to stderr and exits 2. The usage
            // line is intentionally not byte-compared in tests.
            process.stderr.write(`error: ${exc.message}\n`);
            return 2;
        }
        throw exc;
    }

    let config: Dict;
    let files: string[];
    let level: string;
    let hits: Match[];
    try {
        config = load_config(args.config);
        files = changed_files(args.base, args.head);
        [level, hits] = classify(files, config);
    } catch (exc) {
        if (exc instanceof ExitError) {
            return exc.code;
        }
        throw exc;
    }

    fs.writeFileSync(args.output, render(level, hits, files.length), { encoding: 'utf-8' });
    fs.writeFileSync(args.levelFile, level, { encoding: 'utf-8' });
    return 0;
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

const _invokedDirectly =
    _isCliEntry();
if (_invokedDirectly) {
    process.exitCode = main();
}
