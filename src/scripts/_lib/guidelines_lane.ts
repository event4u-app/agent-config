/**
 * The `docs/guidelines/` → `dist/agent-src/guidelines/` projection lane.
 *
 * Why this exists at all: the projected rules declare `routes_to:
 * guideline:<slug>` against **22 distinct targets** and link
 * `../../docs/guidelines/<slug>.md`, and until this lane shipped
 * `dist/agent-src/` carried no `guidelines/` directory — so every one of those
 * routes was declared and dead in a consumer install. (The figure is the gate's own reading. An
 * earlier draft here said "31 rules", which reproduced on nothing: `grep -l`
 * returns 22 in both trees. A blind review checked it; the number is now the
 * one `check_projected_rule_routes` prints.) `AUGMENT_SYMLINK_DIRS`
 * in `condense.ts` has listed `guidelines` since before the lane existed; the
 * symlink simply had nothing to point at.
 *
 * Shape, and why it is a lane rather than a source root: the multi-root
 * resolver in `agent_src.ts` derives an artefact's *identity* from
 * `_root_specs()`, and everything that scans the artefact estate — the
 * discovery manifest, the skill linter, the size and count ratchets — walks
 * that same list. Adding `docs/guidelines` there would reclassify 119
 * guidelines as estate artefacts and move every one of those numbers. So the
 * lane is appended only where the *projection* reads (`iter_all_sources` and
 * `resolve_logical`), exactly as `_iter_domains_commands` already is, and the
 * estate view is left alone.
 *
 * Identity: `docs/guidelines/<subpath>.md` is logical `guidelines/<subpath>.md`
 * — one directory deep in the projection, the same depth as `rules/` and
 * `skills/`, which is what makes the existing `../guidelines/…` rewrite in
 * `condense.ts::_rewrite_body_links` resolve from a projected rule.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Logical-path prefix every guideline is projected under. */
export const GUIDELINES_LOGICAL_PREFIX = 'guidelines/';

/** Physical source directory, relative to the repo root. */
export const GUIDELINES_SOURCE_REL = path.join('docs', 'guidelines');

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

/** Recursive, name-sorted at every level so the walk order is deterministic. */
function* _walkSorted(dir: string): Generator<string> {
    let entries: string[];
    try {
        entries = fs.readdirSync(dir).sort();
    } catch {
        return;
    }
    for (const name of entries) {
        const full = path.join(dir, name);
        if (_isDir(full)) {
            yield* _walkSorted(full);
        } else if (_isFile(full)) {
            yield full;
        }
    }
}

/**
 * Yield `[physical_path, logical_relpath]` for every file under
 * `<root>/docs/guidelines/`. Deterministic order; yields nothing when the
 * directory is absent, which is the normal state of a consumer checkout.
 */
export function* iter_guidelines(root: string): Generator<[string, string]> {
    const base = path.join(root, GUIDELINES_SOURCE_REL);
    if (!_isDir(base)) {
        return;
    }
    for (const p of _walkSorted(base)) {
        const rel = path.relative(base, p).split(path.sep).join('/');
        yield [p, GUIDELINES_LOGICAL_PREFIX + rel];
    }
}

/**
 * Physical path backing a logical `guidelines/<subpath>`, or `null` when the
 * logical path is not a guideline or the file does not exist.
 */
export function resolve_guideline(root: string, logical_rel: string): string | null {
    const rel = logical_rel.replaceAll('\\', '/').replace(/^\/+/, '');
    if (!rel.startsWith(GUIDELINES_LOGICAL_PREFIX)) {
        return null;
    }
    const suffix = rel.slice(GUIDELINES_LOGICAL_PREFIX.length);
    if (suffix.length === 0 || suffix.split('/').includes('..')) {
        return null;
    }
    const candidate = path.join(root, GUIDELINES_SOURCE_REL, suffix);
    return _isFile(candidate) ? candidate : null;
}

/**
 * Rewrite a projected body's relative `.md` links onto the projection.
 *
 * Lives here rather than in `condense.ts` for two reasons, and the second is
 * the load-bearing one. It is this lane's own subject: every rule it applies is
 * a statement about which source trees project where, which is what this module
 * exists to know. And `condense.ts` sits ~1,200 lines past the 1,500-line
 * ceiling `check_source_size_budget` ratchets, so every line there costs one
 * unit of excess while every line here costs zero — the doctrine that file's
 * own baseline note prescribes for exactly this case.
 *
 * `prefix` is the caller's depth prefix (`../` per level below
 * `dist/agent-src/`), so a rule at depth 1 and a guideline at depth 2 both
 * resolve.
 */
export function rewriteProjectedBodyLinks(body: string, prefix: string): string {
    return body
        .replace(BODY_DOCS_RE, (_m, t: string) => prefix + t.replace(/^docs\/guidelines\//, 'guidelines/'))
        .replace(BODY_SRC_RE, (_m, t: string) => prefix + t);
}

/**
 * `docs/guidelines/` is projected and loses its `docs/` segment;
 * `docs/contracts/` is NOT projected and keeps its path unchanged.
 *
 * One-or-more `../` rather than a literal `../../`: the dominant convention in
 * `src/rules/` is a single `../` — 26 sites across 18 rules — so a literal
 * two-level pattern matched only the minority spelling.
 */
const BODY_DOCS_RE = /(?:\.\.\/)+(docs\/(?:guidelines|contracts)\/[^)\s]+\.md)/g;

/**
 * `src/rules`, `src/skills` and `src/agent-src/<x>` all project into
 * `dist/agent-src/`, losing the `src/` (and `agent-src/`) segment.
 *
 * Until the guidelines lane shipped, no PROJECTED file linked into `src/`, so
 * this rewrite had nothing to do and did not exist. A guideline does it 209
 * times — a blind review measured 253 of 268 links under
 * `dist/agent-src/guidelines/` resolving to nothing before this was added.
 *
 * `src/domains` is deliberately absent: a domains command projects to
 * `commands/<subpath>.md`, which is a re-shaping rather than a prefix strip,
 * and guessing it would produce a link that looks right and is wrong.
 */
const BODY_SRC_RE =
    /(?:\.\.\/)+src\/(?:agent-src\/)?((?:rules|skills|commands|contexts|personas|user-types|templates|scripts)\/[^)\s]+\.md)/g;
