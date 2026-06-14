#!/usr/bin/env tsx
/**
 * Public-link checker for the agent-config public surface.
 *
 * TypeScript twin of `src/scripts/check_public_links.py` (ADR-096, Phase 4 /
 * Wave 4c). The CLI contract is mirrored EXACTLY — `--list` / `--json` /
 * `--strict` flags, exit codes (0 clean, 1 violations, 3 internal error),
 * stdout split, byte-identical finding messages, the same scan order and
 * the same `resolve()` semantics (including its latent quirks: the
 * `("agents", "contexts")` two-part prefix check and the
 * `relative_to(ROOT)` ValueError→skip). No behaviour changes — latent bugs
 * replicated.
 *
 * Scans the public-surface files (README.md, AGENTS.md, docs/architecture.md)
 * for markdown links into `docs/contracts/`, then validates each link against
 * the `stability:` frontmatter declared by the target file (per
 * `docs/contracts/STABILITY.md`).
 *
 * Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const PUBLIC_FILES = ['README.md', 'AGENTS.md', 'docs/architecture.md'] as const;
const CONTRACTS_DIR = 'docs/contracts';
const STABILITY_FILE = `${CONTRACTS_DIR}/STABILITY.md`;

// Mirror Python: re.compile(r"\[(?P<text>[^\]]+)\]\((?P<href>[^)\s]+)(?:\s+\"[^\"]*\")?\)")
const LINK_RE = /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const FRONTMATTER_RE = /^---\s*\n([\s\S]*?)\n---\s*\n/;
const STABILITY_RE = /^stability:\s*(\w+)\s*$/m;

interface Violation {
    file: string;
    line: number;
    href: string;
    reason: string;
    severity: 'error' | 'warning';
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** POSIX-relative path of `child` under `root`. */
function _relPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** `true` when `child` is at or below `root` (mirrors Path.relative_to success). */
function _isUnder(child: string, root: string): boolean {
    const rel = path.relative(root, child);
    return !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** Sorted absolute `*.md` listing of a single directory (mirrors sorted(glob)). */
function _globMdSorted(dir: string): string[] {
    let names: string[];
    try {
        names = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out = names
        .filter((n) => n.endsWith('.md'))
        .map((n) => path.join(dir, n))
        .filter((p) => {
            try {
                return fs.statSync(p).isFile();
            } catch {
                return false;
            }
        });
    out.sort();
    return out;
}

function read_stability(p: string): string | null {
    if (!_exists(p)) {
        return null;
    }
    const txt = fs.readFileSync(p, 'utf-8');
    const m = FRONTMATTER_RE.exec(txt);
    if (!m) {
        return null;
    }
    const sm = STABILITY_RE.exec(m[1]!);
    return sm ? sm[1]! : null;
}

/** Ordered map: contract relpath (POSIX) → stability level | null. */
function collect_contracts(): Map<string, string | null> {
    const out = new Map<string, string | null>();
    for (const p of _globMdSorted(path.join(ROOT, CONTRACTS_DIR))) {
        const rel = _relPosix(p, ROOT);
        out.set(rel, read_stability(p));
    }
    return out;
}

/**
 * Resolve `href` relative to `publicFile`. Returns the repo-relative POSIX
 * path string, `null` (external / anchor-only / outside-root), or throws
 * (mirrors the Python ValueError from `relative_to`, caught by the caller).
 */
function resolve(publicFile: string, href: string): string | null {
    let h = href.split('#', 1)[0]!;
    if (!h || /^(https?:\/\/|mailto:|tel:)/.test(h)) {
        return null;
    }
    if (h.startsWith('/')) {
        // Path(href.lstrip("/")) — relative path, no anchoring to ROOT.
        return h.replace(/^\/+/, '');
    }
    // (public_file.parent / href).resolve().relative_to(ROOT.resolve())
    const parent = path.dirname(publicFile); // public_file is repo-relative
    const resolved = path.resolve(ROOT, parent, h);
    const rootResolved = path.resolve(ROOT);
    if (resolved !== rootResolved && !_isUnder(resolved, rootResolved)) {
        // Python's relative_to raises ValueError here.
        throw new RangeError('not under root');
    }
    return _relPosix(resolved, rootResolved);
}

function scan_file(publicFile: string, contracts: Map<string, string | null>): Violation[] {
    const absPath = path.join(ROOT, publicFile);
    if (!_exists(absPath)) {
        return [];
    }
    const violations: Violation[] = [];
    const lines = fs.readFileSync(absPath, 'utf-8').split('\n');
    for (let i = 0; i < lines.length; i++) {
        const lineno = i + 1;
        const line = lines[i]!;
        LINK_RE.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = LINK_RE.exec(line)) !== null) {
            const href = m[2]!;
            // text (m[1]) is unused beyond mirroring the capture groups.
            let target: string | null;
            try {
                target = resolve(publicFile, href);
            } catch {
                continue;
            }
            if (target === null) {
                continue;
            }
            const parts = target.split('/');
            const suffix = target.endsWith('.md') ? '.md' : path.extname(target);
            if (parts[0] === 'agents' && parts[1] === 'contexts' && suffix === '.md') {
                violations.push({
                    file: publicFile,
                    line: lineno,
                    href,
                    reason:
                        'public surface MUST NOT link into agents/settings/contexts/ — move target to docs/contracts/',
                    severity: 'error',
                });
                continue;
            }
            if (!(parts[0] === 'docs' && parts[1] === 'contracts') || suffix !== '.md') {
                continue;
            }
            if (target === STABILITY_FILE) {
                continue;
            }
            if (!contracts.has(target)) {
                violations.push({
                    file: publicFile,
                    line: lineno,
                    href,
                    reason: `target not found: ${target}`,
                    severity: 'error',
                });
                continue;
            }
            const level = contracts.get(target)!;
            if (level === null) {
                violations.push({
                    file: publicFile,
                    line: lineno,
                    href,
                    reason: `target missing 'stability:' frontmatter: ${target}`,
                    severity: 'error',
                });
                continue;
            }
            if (level === 'experimental') {
                violations.push({
                    file: publicFile,
                    line: lineno,
                    href,
                    reason: `public surface MUST NOT link to experimental contract: ${target}`,
                    severity: 'error',
                });
                continue;
            }
            if (level === 'beta') {
                const window = line.toLowerCase();
                if (!window.includes('(beta)') && !window.includes('[beta]')) {
                    violations.push({
                        file: publicFile,
                        line: lineno,
                        href,
                        reason: `link to beta contract '${target}' lacks visible (beta) marker`,
                        severity: 'warning',
                    });
                }
            }
        }
    }
    return violations;
}

/** Mirror Python `json.dumps(obj, indent=2)` with `ensure_ascii=True`. */
function _json_dumps_ascii(obj: unknown): string {
    const raw = JSON.stringify(obj, null, 2);
    let out = '';
    for (const ch of raw) {
        const code = ch.codePointAt(0)!;
        if (code < 0x80) {
            out += ch;
        } else {
            for (let k = 0; k < ch.length; k++) {
                out += '\\u' + ch.charCodeAt(k).toString(16).padStart(4, '0');
            }
        }
    }
    return out;
}

interface ParsedArgs {
    list: boolean;
    json: boolean;
    strict: boolean;
}

function parse_args(argv: readonly string[]): ParsedArgs {
    const args: ParsedArgs = { list: false, json: false, strict: false };
    for (const arg of argv) {
        if (arg === '--list') {
            args.list = true;
        } else if (arg === '--json') {
            args.json = true;
        } else if (arg === '--strict') {
            args.strict = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: check_public_links [-h] [--list] [--json] [--strict]\n');
            process.exit(0);
        } else {
            process.stderr.write(`check_public_links: error: unrecognized arguments: ${arg}\n`);
            process.exit(2);
        }
    }
    return args;
}

function main(): number {
    const args = parse_args(process.argv.slice(2));

    const contracts = collect_contracts();
    if (args.list) {
        for (const [p, lvl] of contracts) {
            const label = lvl ?? '(no frontmatter)';
            process.stdout.write(`  ${label.padEnd(14)}  ${p}\n`);
        }
        return 0;
    }

    const missingFm: string[] = [];
    for (const [p, lvl] of contracts) {
        if (lvl === null && p !== STABILITY_FILE) {
            missingFm.push(p);
        }
    }
    const violations: Violation[] = [];
    for (const p of missingFm) {
        violations.push({
            file: p,
            line: 0,
            href: '(self)',
            reason: "missing 'stability:' frontmatter required by docs/contracts/STABILITY.md",
            severity: 'error',
        });
    }
    for (const f of PUBLIC_FILES) {
        violations.push(...scan_file(f, contracts));
    }

    if (args.json) {
        process.stdout.write(_json_dumps_ascii(violations) + '\n');
    } else {
        const errors = violations.filter((v) => v.severity === 'error');
        const warnings = violations.filter((v) => v.severity === 'warning');
        for (const v of violations) {
            const icon = v.severity === 'error' ? '❌' : '⚠️ ';
            const loc = v.line ? `${v.file}:${v.line}` : v.file;
            process.stdout.write(`${icon}  ${loc}  ${v.href}\n     → ${v.reason}\n`);
        }
        if (violations.length === 0) {
            process.stdout.write(
                `✅  public-link check clean — ${contracts.size} contracts scanned, ` +
                    `${PUBLIC_FILES.length} public files clean\n`,
            );
        } else {
            process.stdout.write(
                `\nsummary: ${errors.length} error(s), ${warnings.length} warning(s)\n`,
            );
        }
    }

    const hasErrors = violations.some((v) => v.severity === 'error');
    const hasWarnings = violations.some((v) => v.severity === 'warning');
    if (hasErrors) {
        return 1;
    }
    if (hasWarnings && args.strict) {
        return 1;
    }
    return 0;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    try {
        process.exit(main());
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        process.stderr.write(`❌  internal error: ${msg}\n`);
        process.exit(3);
    }
}

export {
    type Violation,
    ROOT,
    PUBLIC_FILES,
    CONTRACTS_DIR,
    STABILITY_FILE,
    read_stability,
    collect_contracts,
    resolve,
    scan_file,
    main,
};
