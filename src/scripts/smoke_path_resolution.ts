#!/usr/bin/env tsx
/**
 * Smoke-test path resolution against the package's own `.augment/` projection.
 *
 * Ported from the retired Python `src/scripts/smoke_path_resolution.py` (ADR-200, Phase 8
 * / Wave 8h). The CLI contract is pinned — no flags, exit codes
 * (0 all entries resolve, 1 one or more misses, 3 no `.augment/rules/`),
 * byte-identical stdout/stderr. No behaviour changes.
 *
 * Per `agents/roadmaps/road-to-path-fixes.md` Phase 7 (Council Decision 3,
 * 2026-05-06): the package's `.augment/` tree has the same shape as the
 * `.augment/` tree a consumer would receive after `scripts/install.sh`.
 * If `load_context:` entries resolve cleanly here, they resolve cleanly
 * in any consumer.
 *
 * What it does:
 *   - Walks `.augment/rules/*.md`.
 *   - Parses each rule's YAML frontmatter.
 *   - Resolves every `load_context:` and `load_context_eager:` entry
 *     against the rule file's directory.
 *   - Reports any miss with a file:entry line.
 *
 * Exit codes: 0 = all entries resolve, 1 = one or more misses, 3 = no
 * `.augment/rules/` directory found (run `task sync` first).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// Python: ROOT = Path(__file__).resolve().parent.parent.parent
const ROOT = path.resolve(_HERE, '..', '..', '..');
const AUGMENT_RULES = path.join(ROOT, '.augment', 'rules');

type Frontmatter = Record<string, unknown>;

function _splitFrontmatter(text: string): Frontmatter | null {
    if (!text.startsWith('---\n')) {
        return null;
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return null;
    }
    let fm: unknown;
    try {
        fm = parseYaml(text.slice(4, end), { version: '1.1' });
    } catch {
        return null;
    }
    return fm !== null && typeof fm === 'object' && !Array.isArray(fm) ? (fm as Frontmatter) : {};
}

function _isFile(p: string): boolean {
    try {
        // Mirror Path.resolve().is_file() — follow symlinks, must be a file.
        return fs.statSync(fs.realpathSync(p)).isFile();
    } catch {
        return false;
    }
}

function _relativeTo(p: string, root: string): string {
    return path.relative(root, p);
}

function _checkRule(ruleFile: string, misses: Array<[string, string]>): number {
    const fm = _splitFrontmatter(fs.readFileSync(ruleFile, 'utf-8'));
    if (!fm || Object.keys(fm).length === 0) {
        return 0;
    }
    let checked = 0;
    const ruleDir = path.dirname(ruleFile);
    for (const key of ['load_context', 'load_context_eager']) {
        const entries = (fm[key] as unknown) || [];
        if (!Array.isArray(entries)) {
            continue;
        }
        for (const entry of entries) {
            if (typeof entry !== 'string') {
                continue;
            }
            checked += 1;
            const target = path.resolve(ruleDir, entry);
            if (!_isFile(target)) {
                misses.push([_relativeTo(ruleFile, ROOT), entry]);
            }
        }
    }
    return checked;
}

/** Mirror `Path.glob("*.md")` (non-recursive), then `sorted(...)`. */
function _sortedGlobMd(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out = entries
        .filter((e) => e.isFile() && e.name.endsWith('.md'))
        .map((e) => path.join(dir, e.name));
    out.sort(_comparePathComponents);
    return out;
}

function _comparePathComponents(a: string, b: string): number {
    const pa = a.split(path.sep);
    const pb = b.split(path.sep);
    const n = Math.min(pa.length, pb.length);
    for (let i = 0; i < n; i += 1) {
        const x = pa[i] as string;
        const y = pb[i] as string;
        if (x !== y) {
            return x < y ? -1 : 1;
        }
    }
    return pa.length - pb.length;
}

/** Python repr() of a string — single quotes preferred. */
function _pyRepr(s: string): string {
    const hasSingle = s.includes("'");
    const hasDouble = s.includes('"');
    const quote = hasSingle && !hasDouble ? '"' : "'";
    let out = quote;
    for (const ch of s) {
        if (ch === '\\') {
            out += '\\\\';
        } else if (ch === quote) {
            out += '\\' + quote;
        } else if (ch === '\n') {
            out += '\\n';
        } else if (ch === '\r') {
            out += '\\r';
        } else if (ch === '\t') {
            out += '\\t';
        } else {
            out += ch;
        }
    }
    out += quote;
    return out;
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

export function main(): number {
    if (!_isDir(AUGMENT_RULES)) {
        process.stderr.write(
            `❌  ${_relativeTo(AUGMENT_RULES, ROOT)} not found — run \`task sync\` first\n`,
        );
        return 3;
    }

    const misses: Array<[string, string]> = [];
    let ruleCount = 0;
    let entryCount = 0;
    for (const ruleFile of _sortedGlobMd(AUGMENT_RULES)) {
        ruleCount += 1;
        entryCount += _checkRule(ruleFile, misses);
    }

    if (misses.length > 0) {
        process.stdout.write(`❌  ${misses.length} unresolved load_context entr(y/ies):\n`);
        for (const [rule, entry] of misses) {
            process.stdout.write(`    ${rule} → ${_pyRepr(entry)}\n`);
        }
        return 1;
    }

    process.stdout.write(
        `✅  smoke-path-resolution clean ` +
            `(${ruleCount} rules, ${entryCount} load_context entr(y/ies) resolved)\n`,
    );
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

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exitCode = main();
}
