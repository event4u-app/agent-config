#!/usr/bin/env tsx
/**
 * Cluster-pattern compliance check.
 *
 * TypeScript twin of `src/scripts/check_cluster_patterns.py` (ADR-200,
 * Phase 4 / Wave 4c). The CLI contract is mirrored EXACTLY — no flags,
 * exit codes (0 clean, 1 pattern violations, 3 internal error),
 * stdout/stderr split, byte-identical finding messages, the same
 * locked-clusters table parse, the same domains slug map (via the
 * `_lib/agent_src` twin), and the same dispatcher-structure checks. No
 * behaviour changes — latent bugs replicated.
 *
 * Compares each cluster dispatcher against the Phase 1 reference patterns
 * (`fix`, `optimize`, `feature`).
 *
 * Phase 4 additions (ADR-114): every `routes_to:` entry on a dispatcher must
 * resolve to a real src/domains command slug, and the `## Dispatch` section
 * must document the bare-invocation behaviour (menu / default route /
 * detection fallback) per command-clusters.md § Bare invocation.
 *
 * Exit codes: 0 = clean, 1 = pattern violations, 3 = internal error.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { SRC_DOMAINS, command_slug, resolve_logical } from './_lib/agent_src.js';

const _HERE = fileURLToPath(import.meta.url);
// src/scripts/check_cluster_patterns.ts → two dirs up is the repo root.
// Mirrors the Python `Path(__file__).resolve().parent.parent.parent`.
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const CONTRACT = path.join(ROOT, 'docs/contracts/command-clusters.md');

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _isFile(p: string): boolean {
    try {
        return fs.statSync(p).isFile();
    } catch {
        return false;
    }
}

/** Sorted recursive `command.md` glob (mirrors `SRC_DOMAINS.rglob("command.md")` sorted). */
function _rglobCommandMd(root: string): string[] {
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
            if (ent.name === 'command.md') {
                out.push(full);
            }
            if (ent.isDirectory()) {
                walk(full);
            }
        }
    };
    walk(root);
    out.sort();
    return out;
}

/** Map canonical command slug → physical dispatcher path (domains tree). */
export function build_slug_map(): Map<string, string> {
    const out = new Map<string, string>();
    const dom = SRC_DOMAINS();
    if (!_isDir(dom)) {
        return out;
    }
    for (const p of _rglobCommandMd(dom)) {
        if (!_isFile(p)) {
            continue;
        }
        const slug = command_slug(p);
        if (slug !== null) {
            out.set(slug, p);
        }
    }
    return out;
}

/** Return the physical path for the dispatcher with canonical slug `cluster`. */
function _resolve_command(cluster: string, slug_map: Map<string, string>): string | null {
    const hit = slug_map.get(cluster);
    if (hit !== undefined) {
        return hit;
    }
    return resolve_logical(`commands/${cluster}.md`);
}

const REQUIRED_SECTIONS = ['## Sub-commands', '## Dispatch', '## Rules'];
const TABLE_HEADER_RE = /\|\s*Sub-command\s*\|\s*Routes to\s*\|\s*Purpose\s*\|/i;

interface FileReport {
    path: string;
    cluster: string;
    errors: string[];
}

const ROW_RE = /\|\s*`([a-z][a-z0-9-]*)`\s*\|\s*\d+\s*\|\s*([^|]+)\|/;

/** Return [(cluster_slug, kind)] where kind ∈ {"dispatch", "flag"}. */
export function load_cluster_table(): Array<[string, string]> {
    const text = fs.readFileSync(CONTRACT, 'utf-8');
    let in_table = false;
    const rows: Array<[string, string]> = [];
    for (const line of text.split('\n')) {
        if (line.startsWith('## Locked clusters')) {
            in_table = true;
            continue;
        }
        if (in_table && line.startsWith('## ')) {
            break;
        }
        if (in_table) {
            const m = ROW_RE.exec(line);
            // Python uses `.match` (anchored at start); JS `.exec` is unanchored.
            // Anchor by checking the match starts at index 0.
            if (m && m.index === 0) {
                const name = m[1] as string;
                const sub_col = (m[2] as string).trim().toLowerCase();
                const kind = sub_col.startsWith('flag:') ? 'flag' : 'dispatch';
                rows.push([name, kind]);
            }
        }
    }
    return rows;
}

export function parse_frontmatter(text: string): [Record<string, string>, string] {
    if (!text.startsWith('---\n')) {
        return [{}, text];
    }
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) {
        return [{}, text];
    }
    const fm: Record<string, string> = {};
    for (const line of text.slice(4, end).split('\n')) {
        if (line && !line.startsWith(' ') && line.includes(':')) {
            const idx = line.indexOf(':');
            const k = line.slice(0, idx).trim();
            const v = line.slice(idx + 1).trim();
            fm[k] = v;
        }
    }
    const body = text.slice(end + '\n---\n'.length);
    return [fm, body];
}

/** Python `repr()` of a possibly-undefined string value. */
function _repr(v: string | undefined): string {
    if (v === undefined) {
        return 'None';
    }
    return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

export function check_dispatcher(cluster: string, slug_map: Map<string, string>): FileReport {
    const p = _resolve_command(cluster, slug_map);
    if (p === null) {
        const rep: FileReport = {
            path: path.join(SRC_DOMAINS(), '<unresolved>', cluster),
            cluster,
            errors: [],
        };
        rep.errors.push(
            `dispatcher file missing: no domains command with slug \`${cluster}\` ` +
                `and no legacy commands/${cluster}.md`,
        );
        return rep;
    }
    const rep: FileReport = { path: p, cluster, errors: [] };
    const text = fs.readFileSync(p, 'utf-8');
    const [fm, body] = parse_frontmatter(text);

    // Frontmatter checks — name/cluster carry the canonical slug.
    if (fm['name'] !== cluster) {
        rep.errors.push(`frontmatter \`name:\` is ${_repr(fm['name'])}, expected ${_repr(cluster)}`);
    }
    if (fm['cluster'] !== cluster) {
        rep.errors.push(`frontmatter \`cluster:\` is ${_repr(fm['cluster'])}, expected ${_repr(cluster)}`);
    }
    if (fm['disable-model-invocation'] !== 'true') {
        rep.errors.push('frontmatter `disable-model-invocation: true` missing');
    }

    // H1 check — the canonical invocation name.
    const h1 = `# /${cluster}`;
    const bodyLines = body.split('\n');
    if (!bodyLines.slice(0, 5).includes(h1)) {
        rep.errors.push(`missing top-level heading ${_repr(h1)} in first 5 body lines`);
    }

    // Section presence.
    for (const section of REQUIRED_SECTIONS) {
        if (!body.includes(section)) {
            rep.errors.push(`missing section header ${_repr(section)}`);
        }
    }

    // Sub-commands table header (only meaningful if Sub-commands section exists).
    if (body.includes('## Sub-commands') && !TABLE_HEADER_RE.test(body)) {
        rep.errors.push('Sub-commands table header must be `| Sub-command | Routes to | Purpose |`');
    }

    // routes_to entries must resolve to real commands (Phase 4 / ADR-114).
    const routesRaw = fm['routes_to'];
    if (routesRaw !== undefined) {
        const m = /^\[(.*)\]$/.exec(routesRaw.trim());
        const entries = m
            ? (m[1] as string)
                  .split(',')
                  .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
                  .filter((s) => s.length > 0)
            : [];
        for (const entry of entries) {
            // routes_to entries name either a command slug or a skill
            // (e.g. `git-commit` routes to the `git-workflow` skill).
            const skillPath = path.join(ROOT, 'src', 'skills', entry, 'SKILL.md');
            if (!slug_map.has(entry) && !_isFile(skillPath)) {
                rep.errors.push(
                    `routes_to entry \`${entry}\` resolves to no src/domains command slug ` +
                        'and no src/skills skill',
                );
            }
        }
    }

    // Bare-invocation story (Phase 4 / ADR-114): the Dispatch section must say
    // what a bare `/<cluster>` does — a menu, a default route, or detection.
    const dispatchIdx = body.indexOf('## Dispatch');
    if (dispatchIdx !== -1) {
        const rest = body.slice(dispatchIdx + '## Dispatch'.length);
        const nextSection = rest.search(/\n## /);
        const section = nextSection === -1 ? rest : rest.slice(0, nextSection);
        if (!/menu|bare|no argument|unknown or missing|detection|default/i.test(section)) {
            rep.errors.push(
                '`## Dispatch` must document the bare-invocation behaviour ' +
                    '(menu, default route, or detection fallback) per ' +
                    'command-clusters.md § Bare invocation',
            );
        }
    }
    return rep;
}

/** Python `Path.relative_to(ROOT)` with as_posix; falls back to abs on ValueError. */
function _relativeToRootOrAbs(p: string): string {
    const rel = path.relative(ROOT, p);
    if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
        return p;
    }
    return rel.split(path.sep).join('/');
}

export function main(): number {
    const rows = load_cluster_table();
    if (rows.length === 0) {
        process.stderr.write(`❌  No clusters parsed from ${_relativeToRootOrAbs(CONTRACT)}\n`);
        return 3;
    }

    const slug_map = build_slug_map();
    const dispatch_clusters = rows.filter(([, k]) => k === 'dispatch').map(([n]) => n);
    const flag_clusters = rows.filter(([, k]) => k === 'flag').map(([n]) => n);

    const reports = dispatch_clusters.map((n) => check_dispatcher(n, slug_map));
    const bad = reports.filter((r) => r.errors.length);

    // Flag clusters: only assert the file exists; legacy shape is preserved.
    const flag_missing = flag_clusters.filter((n) => _resolve_command(n, slug_map) === null);
    if (flag_missing.length) {
        process.stdout.write(`❌  Flag-cluster file(s) missing: ${_pyList(flag_missing)}\n`);
        return 1;
    }

    if (bad.length) {
        process.stdout.write(
            `❌  ${bad.length}/${reports.length} cluster dispatcher(s) deviate ` +
                'from the Phase-1 reference pattern:\n',
        );
        for (const r of bad) {
            const shown = _relativeToRootOrAbs(r.path);
            process.stdout.write(`  • ${shown} (cluster \`${r.cluster}\`)\n`);
            for (const err of r.errors) {
                process.stdout.write(`      - ${err}\n`);
            }
        }
        process.stdout.write(
            `\nReference: the \`fix\`, \`optimize\`, \`feature\` dispatchers ` +
                'under src/domains/\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  ${reports.length} cluster dispatcher(s) match the Phase-1 reference ` +
            `pattern; ${flag_clusters.length} flag-cluster(s) verified present.\n`,
    );
    return 0;
}

/** Python repr of a str list: ['a', 'b']. */
function _pyList(items: readonly string[]): string {
    return '[' + items.map((s) => `'${s}'`).join(', ') + ']';
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
    process.exit(main());
}

export { ROOT, CONTRACT, REQUIRED_SECTIONS, TABLE_HEADER_RE };
