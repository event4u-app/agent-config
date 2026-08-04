#!/usr/bin/env tsx
/**
 * CI guard for docs/featured-skills.md entry validity.
 *
 * Ported from the retired Python `src/scripts/lint_featured_skills.py` (ADR-088,
 * Phase 4 / Wave 4b). The CLI contract is pinned — `--quiet`
 * detected by argv membership, exit codes (0 / 1), stdout/stderr split,
 * byte-identical messages, same regex scan + ordering. No behaviour
 * changes — historical quirks preserved (consumers pin the exact behaviour).
 *
 * NOTE: like the retired Python implementation, the doc/manifest paths are CWD-relative
 * (`Path("docs/featured-skills.md")`), not `__file__`-anchored. The
 * dispatcher invokes from the repo root, so this matches.
 *
 * Exit codes:
 *   0 — every entry resolves; install-pack hints are valid.
 *   1 — at least one stale entry or unknown pack.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);

// CWD-relative, exactly as the Python module's Path(...) literals.
const DOC = 'docs/featured-skills.md';
const MANIFEST = 'dist/discovery/discovery-manifest.json';

// Matches `[`token`](../dist/agent-src/skills/<slug>/SKILL.md)` or
// `[`/token`](../dist/agent-src/commands/<path>.md)`. Captures (category, slug-path).
const LINK_RE = /\[`\/?[^`]+`\]\(\.\.\/dist\/agent-src\/(skills|commands)\/([^)]+?)\.md\)/g;
const PACK_HINT_RE = /--pack\s+([a-z][a-z0-9-]*)/g;

interface Manifest {
    artefacts?: Array<Record<string, unknown>>;
    packs?: Array<Record<string, unknown>>;
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

function load_manifest(): Manifest {
    if (!_exists(MANIFEST)) {
        process.stderr.write(`error: manifest not found at ${MANIFEST}\n`);
        process.exit(1);
    }
    return JSON.parse(fs.readFileSync(MANIFEST, 'utf-8')) as Manifest;
}

/** Return [skill-names, command-names, pack-ids]. */
function manifest_names(manifest: Manifest): [Set<string>, Set<string>, Set<string>] {
    const skills = new Set<string>();
    const commands = new Set<string>();
    for (const art of manifest.artefacts ?? []) {
        const cat = art['category'];
        const name = art['name'];
        if (!name || typeof name !== 'string') {
            continue;
        }
        if (cat === 'skill') {
            skills.add(name);
        } else if (cat === 'command') {
            commands.add(name);
            // Deprecation aliases are permanent stubs (ADR-057 § 8a).
            const replaces = art['replaces'];
            if (Array.isArray(replaces)) {
                for (const alias of replaces) {
                    if (typeof alias === 'string' && alias) {
                        commands.add(alias);
                    }
                }
            }
        }
    }
    const packs = new Set<string>();
    for (const p of manifest.packs ?? []) {
        const id = p['id'];
        if (id && typeof id === 'string') {
            packs.add(id);
        }
    }
    return [skills, commands, packs];
}

function slug_from_path(category: string, raw: string): string {
    if (category === 'skills') {
        return raw.split('/', 1)[0]!;
    }
    // Nested command files (commands/video/scene.md) carry dash-joined
    // frontmatter names (video-scene) — the form the discovery manifest
    // indexes. The colon form only exists as the user-facing slash label.
    const parts = raw.split('/');
    return parts.length > 1 ? parts.join('-') : parts[0]!;
}

/** All [category, slug-path] matches in document order (mirrors re.findall). */
function _findLinks(body: string): Array<[string, string]> {
    const out: Array<[string, string]> = [];
    LINK_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = LINK_RE.exec(body)) !== null) {
        out.push([m[1]!, m[2]!]);
    }
    return out;
}

function _findPackHints(body: string): string[] {
    const out: string[] = [];
    PACK_HINT_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = PACK_HINT_RE.exec(body)) !== null) {
        out.push(m[1]!);
    }
    return out;
}

function main(argv: readonly string[]): number {
    const quiet = argv.includes('--quiet');
    if (!_exists(DOC)) {
        process.stderr.write(`error: ${DOC} not found\n`);
        return 1;
    }

    const manifest = load_manifest();
    const [skills, commands, packs] = manifest_names(manifest);
    const body = fs.readFileSync(DOC, 'utf-8');

    // The doc existing is not the doc being readable by this gate: LINK_RE is
    // pinned to the `../dist/agent-src/{skills,commands}/…` link shape, so a
    // restructured or emptied Featured Skills page yields zero entries and the
    // OK line reports "0 artefact entries validated". Assert the raw match list,
    // before the dedupe the checks below run on.
    const links = _findLinks(body);
    try {
        assertScanned({
            gate: 'lint_featured_skills',
            scanned: links.length,
            units: 'featured artefact link(s)',
            roots: [DOC],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            // 1 is the gate's only failure code — the same one a missing DOC or
            // manifest already returns.
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    const missing: string[] = [];
    const seen = new Set<string>();
    for (const [cat, raw] of links) {
        const slug = slug_from_path(cat, raw);
        const key = `${cat}\0${slug}`;
        if (seen.has(key)) {
            continue;
        }
        seen.add(key);
        const pool = cat === 'skills' ? skills : commands;
        if (!pool.has(slug)) {
            missing.push(`  - ${cat}/${slug} (linked path: ../dist/agent-src/${cat}/${raw}.md)`);
        }
    }

    const unknown_packs: string[] = [];
    for (const pack of _findPackHints(body)) {
        if (!packs.has(pack)) {
            unknown_packs.push(`  - --pack ${pack}`);
        }
    }

    if (missing.length || unknown_packs.length) {
        process.stdout.write(`FAIL  ${DOC}: stale Featured Skills entries detected.\n`);
        if (missing.length) {
            process.stdout.write('\nMissing artefacts (not in discovery-manifest.json):\n');
            for (const line of missing) {
                process.stdout.write(line + '\n');
            }
        }
        if (unknown_packs.length) {
            process.stdout.write('\nUnknown pack ids referenced in install hints:\n');
            for (const line of unknown_packs) {
                process.stdout.write(line + '\n');
            }
        }
        process.stdout.write(
            '\nFix: either restore the artefact, update the doc entry to a ' +
                'current name, or substitute with the nearest existing artefact.\n',
        );
        return 1;
    }

    if (!quiet) {
        const packHintSet = new Set(_findPackHints(body));
        process.stdout.write(
            `OK    ${DOC}: ${seen.size} artefact entries + ` +
                `${packHintSet.size} pack hints validated.\n`,
        );
    }
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
    process.exit(main(process.argv.slice(2)));
}

export {
    type Manifest,
    DOC,
    MANIFEST,
    LINK_RE,
    PACK_HINT_RE,
    manifest_names,
    slug_from_path,
    main,
};
