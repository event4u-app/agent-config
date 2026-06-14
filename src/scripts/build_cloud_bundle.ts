#!/usr/bin/env tsx
/**
 * build_cloud_bundle.ts — package skills as Anthropic Skills ZIP bundles.
 *
 * TypeScript twin of `src/scripts/build_cloud_bundle.py` (ADR-096 —
 * Python→TS migration, Phase 8 / Wave 8b). The CLI contract is mirrored
 * EXACTLY — the mutually-exclusive `--skill` / `--all` / `--check` flags,
 * `--out` / `--strict-budget` / `--clean`, exit codes, the stdout/stderr
 * split, byte-identical console messages, and byte-identical `manifest.json`
 * (`json.dumps(indent=2)` — insertion-order keys, 2-space indent,
 * ensure_ascii=True, trailing newline). The per-skill SKILL.md/reference/asset
 * CONTENTS written into each ZIP are byte-identical.
 *
 * Imports the `audit_cloud_compatibility` twin (the SAME `scan` /
 * `detect_cloud_marker` surfaces the Python original imports) for tier
 * classification.
 *
 * DIVERGENCE CANDIDATE (documented under the ADR-096 process):
 * the raw ZIP container bytes are NOT byte-identical to Python's
 * `zipfile.ZipFile(..., ZIP_DEFLATED)` output — the two differ in
 * deflate parameters, the fixed timestamp, the version/extra/external-attr
 * header fields, and entry ordering of siblings (`Path.rglob` is unordered
 * in CPython). The ZIP is a transport container; the contract that matters
 * is the per-entry CONTENT, which is byte-identical. Golden parity therefore
 * compares decompressed entry maps (name → bytes), the manifest JSON, and the
 * console output — not the raw archive bytes.
 *
 * Note on error semantics: the Python original raises bare
 * `SystemExit("❌  …")` for budget / source / T3-H failures. A string
 * SystemExit prints the message to stderr and exits with code 1 (NOT the
 * 2/3/4/5 codes named in the docstring, which never fire). This twin
 * replicates the actual behaviour: message → stderr, exit 1.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { detect_cloud_marker, scan } from './audit_cloud_compatibility.js';
import { zip_write_sync, type ZipEntry } from './_lib/zip_min.js';

const _HERE = fileURLToPath(import.meta.url);

export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const SOURCE_SKILLS = path.join(ROOT, 'dist/agent-src', 'skills');
export const DEFAULT_OUT = path.join(ROOT, 'dist', 'cloud');
export const DESC_LIMIT_WEB = 200;
export const DESC_LIMIT_SPEC = 1024;

// Mutable config to mirror the Python tests' monkeypatch surface
// (`monkeypatch.setattr(bcb, "SOURCE_SKILLS", …)` / `"load_tier_map"`).
const _cfg = {
    SOURCE_SKILLS,
    load_tier_map: load_tier_map_default,
};

export function _setConfigForTest(overrides: Partial<typeof _cfg>): void {
    Object.assign(_cfg, overrides);
}

// FRONTMATTER_RE = re.compile(r"^---\s*\n(.*?\n)---\s*\n(.*)$", re.DOTALL)
const FRONTMATTER_RE = /^---[ \t]*\n([\s\S]*?\n)---[ \t]*\n([\s\S]*)$/;
const NAME_RE = /^name:\s*(.+?)\s*$/m;
const DESC_RE = /^description:\s*"?(.+?)"?\s*$/m;
// CLOUD_BEHAVIOR_RE = re.compile(r"(?ms)^##\s+Cloud Behavior\s*\n(.*?)(?=^##\s+|\Z)")
const CLOUD_BEHAVIOR_RE = /^##\s+Cloud Behavior\s*\n([\s\S]*?)(?=^##\s+|$(?![\s\S]))/m;
const TITLE_RE = /^#\s+(.+?)\s*$/m;
const MARKER_LINE_RE = /^\s*<!--\s*cloud_safe:\s*(?:noop|degrade)\s*-->\s*\n?/m;

const PATH_SWAP_PATTERNS: Array<[RegExp, string]> = [
    [/`\.agent-src\.uncondensed\//g, '`<package-source>/'],
    [/`dist\/agent-src\//g, '`<package-source>/'],
    [/\(\.agent-src\.uncondensed\//g, '(<package-source>/'],
    [/\(dist\/agent-src\//g, '(<package-source>/'],
];

const SANDBOX_NOTE =
    '> **Cloud sandbox.** This skill is running on Claude.ai Web or the\n' +
    '> Anthropic Skills API. The host has no access to the user\'s repository.\n' +
    '> References to `dist/agent-src/`, `agents/`, or local task commands are\n' +
    '> descriptive: emit content for the user to save, don\'t try to read or\n' +
    '> write those paths. Quality scripts (`task ci`, linters) run on the\n' +
    '> user\'s machine after they apply the suggested change.\n';

const NOOP_BODY_FALLBACK =
    'On platforms without persistent filesystem (Claude.ai Web, the Anthropic\n' +
    'Skills API), this artefact is fully inert. None of its local procedures\n' +
    'apply. The agent does nothing on this rule\'s behalf.\n';

export interface BuildResult {
    skill: string;
    status: string; // "ok" | "skipped" | "error"
    tier: string;
    reason: string;
    zip_path: string;
    description_truncated: boolean;
    cloud_marker: string; // "noop" | "degrade" | ""
    warnings: string[];
}

function newBuildResult(skill: string, status: string, tier = ''): BuildResult {
    return {
        skill,
        status,
        tier,
        reason: '',
        zip_path: '',
        description_truncated: false,
        cloud_marker: '',
        warnings: [],
    };
}

interface TierInfo {
    tier: string;
    cloud_marker: string | null;
    raw_tier: string;
}

export function load_tier_map_default(): Record<string, TierInfo> {
    const tier_map: Record<string, TierInfo> = {};
    for (const row of scan()) {
        if (row.kind !== 'skills') {
            continue;
        }
        // row.path = .agent-src.uncondensed/skills/<name>/SKILL.md
        const parts = row.path.split('/');
        if (parts.length >= 3) {
            tier_map[parts[2] as string] = {
                tier: row.tier,
                cloud_marker: row.cloud_marker,
                raw_tier: row.raw_tier ?? row.tier,
            };
        }
    }
    return tier_map;
}

/** Thrown to mirror Python's `raise SystemExit(str)` — message to stderr, exit 1. */
class StringSystemExit extends Error {}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

/** `sorted(d for d in iterdir() if d.is_dir())`. */
function _sortedSubdirs(dir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
            out.push(full);
        }
    }
    out.sort();
    return out;
}

/** `sib.rglob("*")` yielding files — recursive descend (unordered in CPython). */
function _rglobFiles(root: string): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const ent of entries) {
            const full = path.join(dir, ent.name);
            // Python rglob("*") yields dirs and files; we only zip files.
            if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(full))) {
                walk(full);
            } else if (ent.isFile() || (ent.isSymbolicLink() && _isFile(full))) {
                out.push(full);
            }
        }
    };
    walk(root);
    return out;
}

export function parse_skill_md(text: string): [{ name: string; description: string }, string] {
    const m = FRONTMATTER_RE.exec(text);
    if (!m) {
        throw new Error('SKILL.md missing YAML frontmatter');
    }
    const fm_raw = m[1] as string;
    const body = m[2] as string;
    const nm = NAME_RE.exec(fm_raw);
    const dm = DESC_RE.exec(fm_raw);
    if (!nm || !dm) {
        throw new Error("frontmatter requires both 'name' and 'description'");
    }
    return [{ name: (nm[1] as string), description: (dm[1] as string) }, body];
}

/** Code-point length (Python `len(str)`). */
function _len(s: string): number {
    let n = 0;
    for (const _ of s) {
        n += 1;
    }
    return n;
}

/** Slice by code point (Python `s[:n]`). */
function _slicePoints(s: string, end: number): string {
    let out = '';
    let i = 0;
    for (const ch of s) {
        if (i >= end) {
            break;
        }
        out += ch;
        i += 1;
    }
    return out;
}

/** Python `str.rsplit(" ", 1)[0]`. */
function _rsplitFirst(s: string): string {
    const idx = s.lastIndexOf(' ');
    return idx === -1 ? s : s.slice(0, idx);
}

/** Python `str.rstrip(chars)`. */
function _rstripChars(s: string, chars: string): string {
    let end = s.length;
    while (end > 0 && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(0, end);
}

export function enforce_description_budget(desc: string, strict: boolean, warnings: string[]): [string, boolean] {
    const n = _len(desc);
    if (n > DESC_LIMIT_SPEC) {
        throw new StringSystemExit(
            `❌  description exceeds Anthropic spec limit ` + `(${n} > ${DESC_LIMIT_SPEC} chars). Source must be fixed.`,
        );
    }
    if (n <= DESC_LIMIT_WEB) {
        return [desc, false];
    }
    if (strict) {
        throw new StringSystemExit(
            `❌  description exceeds cloud cap in strict mode ` + `(${n} > ${DESC_LIMIT_WEB} chars).`,
        );
    }
    const cut = _rstripChars(_rsplitFirst(_slicePoints(desc, DESC_LIMIT_WEB - 1)), ',.;:—–-');
    const truncated = cut + '…';
    warnings.push(`description truncated: ${n} → ${_len(truncated)} chars`);
    return [truncated, true];
}

export function swap_paths(body: string): string {
    let out = body;
    for (const [pat, repl] of PATH_SWAP_PATTERNS) {
        out = out.replace(pat, repl);
    }
    return out;
}

export function strip_marker(body: string): string {
    return body.replace(MARKER_LINE_RE, '');
}

export function extract_cloud_body_for_noop(body: string, name: string): string {
    const title_match = TITLE_RE.exec(body);
    const title = title_match ? (title_match[1] as string) : name;
    const section = CLOUD_BEHAVIOR_RE.exec(body);
    const section_text = section ? (section[1] as string).trim() : NOOP_BODY_FALLBACK;
    return `# ${title}\n\n## Cloud Behavior\n\n${section_text.trim()}\n`;
}

export function render_skill_md(
    name: string,
    description: string,
    body: string,
    opts: { swap: boolean; cloud_marker?: string | null },
): string {
    const { swap, cloud_marker = null } = opts;
    let b = strip_marker(body);
    if (cloud_marker === 'noop') {
        b = extract_cloud_body_for_noop(b, name);
        b = SANDBOX_NOTE + '\n' + b;
    } else if (swap) {
        b = swap_paths(b);
        b = SANDBOX_NOTE + '\n' + b;
    }
    const fm = `---\nname: ${name}\ndescription: "${description}"\n---\n`;
    if (!b.startsWith('\n')) {
        b = '\n' + b;
    }
    return fm + b;
}

export function build_skill_zip(
    skill_dir: string,
    out_dir: string,
    tier: string,
    opts: { strict: boolean; dry_run: boolean; cloud_marker?: string | null },
): BuildResult {
    const { strict, dry_run } = opts;
    // Python's signature is `cloud_marker: str | None = None`. The re-detection
    // guard is `if cloud_marker is None:` — it CANNOT distinguish an explicitly
    // passed None from the default, so it re-detects whenever the value is None.
    // Replicate that: re-detect on null regardless of whether it was passed.
    let cloud_marker = opts.cloud_marker ?? null;
    const name = path.basename(skill_dir);
    const result = newBuildResult(name, 'ok', tier);
    if (cloud_marker) {
        result.cloud_marker = cloud_marker;
    }
    const skill_md = path.join(skill_dir, 'SKILL.md');
    if (!_isFile(skill_md)) {
        result.status = 'error';
        result.reason = 'SKILL.md missing';
        return result;
    }

    const text = fs.readFileSync(skill_md, 'utf-8');
    let meta: { name: string; description: string };
    let body: string;
    try {
        [meta, body] = parse_skill_md(text);
    } catch (e) {
        result.status = 'error';
        result.reason = (e as Error).message;
        return result;
    }
    // If caller didn't pass a marker (or passed None), detect from the raw body.
    if (cloud_marker === null) {
        cloud_marker = detect_cloud_marker(text);
        if (cloud_marker) {
            result.cloud_marker = cloud_marker;
        }
    }

    const [desc, truncated] = enforce_description_budget(meta.description, strict, result.warnings);
    result.description_truncated = truncated;

    const needs_swap = (tier === 'T2' || tier === 'T3-S') && cloud_marker !== 'noop';
    const rendered = render_skill_md(meta.name, desc, body, { swap: needs_swap, cloud_marker });

    if (dry_run) {
        return result;
    }

    fs.mkdirSync(out_dir, { recursive: true });
    const zip_path = path.join(out_dir, `${name}.zip`);
    const entries: ZipEntry[] = [];
    entries.push({ name: `${name}/SKILL.md`, data: Buffer.from(rendered, 'utf-8') });
    for (const sibling of ['references', 'assets', 'scripts']) {
        const sib = path.join(skill_dir, sibling);
        if (!_isDir(sib)) {
            continue;
        }
        for (const f of _rglobFiles(sib)) {
            const arc = `${name}/${_relativeToPosix(f, skill_dir)}`;
            entries.push({ name: arc, data: fs.readFileSync(f) });
        }
    }
    fs.writeFileSync(zip_path, zip_write_sync(entries));
    result.zip_path = _relativeToRootOr(zip_path);
    return result;
}

function _relativeToPosix(child: string, root: string): string {
    return path.relative(root, child).split(path.sep).join('/');
}

/** Python `zip_path.relative_to(ROOT)` with ValueError → str(zip_path). */
function _relativeToRootOr(p: string): string {
    const rel = path.relative(ROOT, p);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return p;
    }
    return rel.split(path.sep).join('/');
}

export function build_all(
    out_dir: string,
    opts: { only: string | null; strict: boolean; dry_run: boolean },
): [BuildResult[], BuildResult[]] {
    const { only, strict, dry_run } = opts;
    const tier_map = _cfg.load_tier_map();
    if (!_isDir(_cfg.SOURCE_SKILLS)) {
        throw new StringSystemExit(`❌  source not found: ${_cfg.SOURCE_SKILLS}`);
    }

    let skill_dirs: string[];
    if (only) {
        const skill_dir = path.join(_cfg.SOURCE_SKILLS, only);
        if (!_isDir(skill_dir)) {
            throw new StringSystemExit(`❌  skill not found: ${only}`);
        }
        skill_dirs = [skill_dir];
    } else {
        skill_dirs = _sortedSubdirs(_cfg.SOURCE_SKILLS);
    }

    const built: BuildResult[] = [];
    const skipped: BuildResult[] = [];
    for (const sd of skill_dirs) {
        const name = path.basename(sd);
        const info = tier_map[name] ?? { tier: 'T1', cloud_marker: null, raw_tier: 'T1' };
        const tier = info.tier;
        const cloud_marker = info.cloud_marker ?? null;
        if (tier === 'T3-H') {
            const sk = newBuildResult(name, 'skipped', tier);
            sk.reason = 'T3-H — Phase 2 cloud-aware variant required';
            if (only) {
                throw new StringSystemExit(
                    `❌  '${only}' is T3-H (script-hard). ` +
                        'Bundle blocked until Phase 2 ships a cloud-aware variant.',
                );
            }
            skipped.push(sk);
            continue;
        }
        const result = build_skill_zip(sd, out_dir, tier, { strict, dry_run, cloud_marker });
        if (result.status === 'ok') {
            built.push(result);
        } else {
            skipped.push(result);
        }
    }
    return [built, skipped];
}

// --- json.dumps(indent=2) replica (insertion-order keys, ensure_ascii) -------

function _jsonDumpsIndent2(obj: unknown): string {
    const pad = '  ';
    function enc(value: unknown, depth: number): string {
        if (value === null || value === undefined) {
            return 'null';
        }
        if (typeof value === 'boolean') {
            return value ? 'true' : 'false';
        }
        if (typeof value === 'number') {
            return String(value);
        }
        if (typeof value === 'string') {
            return encStr(value);
        }
        if (Array.isArray(value)) {
            if (value.length === 0) {
                return '[]';
            }
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Record<string, unknown>;
        const keys = Object.keys(o);
        if (keys.length === 0) {
            return '{}';
        }
        const inner = keys.map((k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k], depth + 1));
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }
    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }
    return enc(obj, 0);
}

export function write_manifest(out_dir: string, built: BuildResult[], skipped: BuildResult[]): string {
    fs.mkdirSync(out_dir, { recursive: true });
    const manifest = {
        summary: {
            built: built.length,
            skipped: skipped.length,
            truncated_descriptions: built.filter((r) => r.description_truncated).length,
        },
        built: built.map(_resultDict),
        skipped: skipped.map(_resultDict),
    };
    const p = path.join(out_dir, 'manifest.json');
    fs.writeFileSync(p, _jsonDumpsIndent2(manifest) + '\n', 'utf-8');
    return p;
}

/** `r.__dict__` — field order from the dataclass definition. */
function _resultDict(r: BuildResult): Record<string, unknown> {
    return {
        skill: r.skill,
        status: r.status,
        tier: r.tier,
        reason: r.reason,
        zip_path: r.zip_path,
        description_truncated: r.description_truncated,
        cloud_marker: r.cloud_marker,
        warnings: r.warnings,
    };
}

interface ParsedArgs {
    skill: string | null;
    all: boolean;
    check: boolean;
    out: string;
    strict_budget: boolean;
    clean: boolean;
}

function _argError(msg: string): never {
    process.stderr.write('usage: build_cloud_bundle [-h] (--skill SKILL | --all | --check) [--out OUT] [--strict-budget] [--clean]\n');
    process.stderr.write(`build_cloud_bundle: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = {
        skill: null,
        all: false,
        check: false,
        out: DEFAULT_OUT,
        strict_budget: false,
        clean: false,
    };
    let mutexChosen: string | null = null;
    const claimMutex = (flag: string): void => {
        if (mutexChosen !== null && mutexChosen !== flag) {
            _argError(`argument ${flag}: not allowed with argument ${mutexChosen}`);
        }
        mutexChosen = flag;
    };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1 && a.startsWith('--')) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                _argError(`argument ${flag}: expected one argument`);
            }
            i += 1;
            return next;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: build_cloud_bundle [-h] (--skill SKILL | --all | --check) [--out OUT] [--strict-budget] [--clean]\n',
            );
            process.exit(0);
        } else if (a === '--skill' || a.startsWith('--skill=')) {
            claimMutex('--skill');
            out.skill = value('--skill');
        } else if (a === '--all') {
            claimMutex('--all');
            out.all = true;
        } else if (a === '--check') {
            claimMutex('--check');
            out.check = true;
        } else if (a === '--out' || a.startsWith('--out=')) {
            out.out = value('--out');
        } else if (a === '--strict-budget') {
            out.strict_budget = true;
        } else if (a === '--clean') {
            out.clean = true;
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    if (mutexChosen === null) {
        _argError('one of the arguments --skill --all --check is required');
    }
    return out;
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    if (args.clean && _exists(args.out) && !args.check) {
        fs.rmSync(args.out, { recursive: true, force: true });
    }

    const only = args.skill ? args.skill : null;
    const dry_run = Boolean(args.check);

    const [built, skipped] = build_all(args.out, { only, strict: args.strict_budget, dry_run });

    if (!dry_run) {
        write_manifest(args.out, built, skipped);
    }

    // Console report
    const label = dry_run ? 'check' : 'build';
    process.stdout.write(`📦  cloud-bundle ${label}: ${built.length} built · ${skipped.length} skipped\n`);
    const truncated = built.filter((r) => r.description_truncated);
    if (truncated.length > 0) {
        process.stdout.write(`⚠️   ${truncated.length} description(s) truncated to 200 chars:\n`);
        for (const r of truncated.slice(0, 10)) {
            process.stdout.write(`   - ${r.skill}\n`);
        }
        if (truncated.length > 10) {
            process.stdout.write(`   …and ${truncated.length - 10} more\n`);
        }
    }
    const t3h = skipped.filter((r) => r.tier === 'T3-H');
    if (t3h.length > 0) {
        process.stdout.write(`🚧  ${t3h.length} T3-H skill(s) skipped (Phase 2 pending):\n`);
        for (const r of t3h.slice(0, 5)) {
            process.stdout.write(`   - ${r.skill}\n`);
        }
        if (t3h.length > 5) {
            process.stdout.write(`   …and ${t3h.length - 5} more\n`);
        }
    }
    const errors = skipped.filter((r) => r.status === 'error');
    if (errors.length > 0) {
        process.stdout.write(`❌  ${errors.length} error(s):\n`);
        for (const r of errors) {
            process.stdout.write(`   - ${r.skill}: ${r.reason}\n`);
        }
        return 1;
    }
    return 0;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** CLI entry: run main, mapping a string SystemExit to stderr + exit 1. */
function _cliMain(): number {
    try {
        return main();
    } catch (e) {
        if (e instanceof StringSystemExit) {
            process.stderr.write(e.message + '\n');
            return 1;
        }
        throw e;
    }
}

const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(_cliMain());
}
