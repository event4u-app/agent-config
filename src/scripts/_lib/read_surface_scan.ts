/**
 * Read-surface scanner — derive the sanitize floor's coverage list from the
 * imports, not from intent
 * (road-to-a-sanitize-list-that-is-generated, Phase 1).
 *
 * WHY A SCANNER AND NOT A LIST
 * ----------------------------
 * `retrieval_sanitize.ts` used to carry a hand-maintained prose list of the
 * read surfaces it covers, with its own header stating the rule for anything
 * not on it: uncovered. That list went wrong in both directions — a path that
 * reaches the outside world and IS sanitized was absent from it, and two paths
 * carrying fetched bytes toward a model-facing surface were neither listed nor
 * covered. The header already recorded the same failure happening once before,
 * for the same reason: a list maintained by hand records what its author meant,
 * and the tree records what the code does.
 *
 * This module derives the list. A row cannot disagree with the tree, because
 * the tree is the only thing it reads.
 *
 * WHAT A ROW MEANS, AND WHAT IT DOES NOT
 * --------------------------------------
 * A row says a module matched an INBOUND shape — a recognised way outside bytes
 * enter this process — and whether that module imports the sanitize floor. It
 * does not say the floor is applied to the right string, at the right point, or
 * at all: an import is evidence of intent, and only a read of the module
 * establishes the rest. `covered` here means "the floor is in scope in this
 * module", never "this module is safe".
 *
 * THE MISSING-ROW FAILURE, AND WHY `unclassified` EXISTS
 * -----------------------------------------------------
 * A generated table carries an authority a hand-written one never claimed, so
 * its worst failure is not a wrong row — it is an ABSENT one. A fetch shape the
 * scanner does not recognise produces no row, and a missing row reads as "no
 * surface here".
 *
 * Two things push back. Inbound shapes are plural and named (a `fetch`, a
 * `node:http(s)` request, a subprocess of a remote-fetching tool, a parse of
 * markup arriving on stdin) rather than a single pattern. And a WEAK shape —
 * a network call reached through an injected or computed callee, which the
 * strong detectors cannot see — still emits a row, marked `unclassified`, so an
 * unrecognised shape appears in the table as a visible gap instead of as
 * silence. The residual is stated in the table's own header rather than left
 * for a reader to discover: a module whose network access is reached through a
 * shape matching neither set is still absent.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Coverage verdict for one read surface. */
export type SurfaceCoverage = 'covered' | 'uncovered' | 'unclassified';

/** One module that brings outside bytes in and hands a string onward. */
export interface ReadSurfaceRow {
    /** Path relative to `src/scripts/`, POSIX separators. */
    readonly module: string;
    /** Inbound shape id that matched. */
    readonly inbound: string;
    /** Emit shape id that matched, or `undecided`. */
    readonly emit: string;
    readonly coverage: SurfaceCoverage;
    /** Why the row reads the way it does — one clause, no paraphrase. */
    readonly evidence: string;
}

interface ShapeDetector {
    readonly id: string;
    /** True when this module's source carries the shape. */
    readonly match: (src: string) => boolean;
}

/** True when the module imports node's HTTP client at all. */
function _importsNodeHttp(src: string): boolean {
    return /from\s+['"]node:https?['"]/.test(src);
}

/**
 * Strong inbound shapes — a recognised way outside bytes enter this process.
 *
 * Each is deliberately narrow. `await fetch(` rather than `fetch(` keeps a
 * fetch call named inside a string literal (a spawned one-liner, a doc example)
 * out of the table; the node-HTTP shape requires the import as well as the call
 * so a `.get(` on an unrelated object cannot produce a row.
 */
export const STRONG_INBOUND: readonly ShapeDetector[] = [
    {
        id: 'network-fetch',
        match: (s) => /\bawait\s+fetch\s*\(/.test(s),
    },
    {
        id: 'node-http-request',
        match: (s) => _importsNodeHttp(s) && /\bhttps?\s*\.\s*(?:get|request)\s*\(/.test(s),
    },
    {
        id: 'remote-subprocess',
        match: (s) =>
            /\b(?:spawnSync|spawn|execSync|execFileSync|execFile)\s*\(\s*\[?\s*['"`](?:curl|wget|gh)['"`]/.test(s),
    },
    {
        id: 'stdin-markup-parse',
        match: (s) =>
            /\bprocess\s*\.\s*stdin\b/.test(s) && /&(?:amp|lt|gt|quot|nbsp|#x?[0-9a-f]+);/i.test(s),
    },
    {
        id: 'declared',
        match: (s) => _DECLARATION_RE.test(s),
    },
];

/**
 * A module may declare its own inbound shape when no syntactic one captures it.
 *
 * The shapes above are all things the scanner can SEE. A host primitive cannot
 * be seen: a subagent reply, an MCP tool result and a host file-read arrive
 * through a channel this package does not own, so no call site in this tree
 * spells them. Risk 1 of the roadmap that produced this scanner names exactly
 * that class, and the answer it demands is a visible row rather than silence.
 *
 * The marker is a comment at the site — `// read-surface: <shape-id>` — not a
 * line in a central list, which is the arrangement this whole module exists to
 * retire. A declaration says only "outside bytes arrive here"; the coverage
 * verdict is still read from the imports, so declaring a surface cannot make it
 * read `covered`.
 */
const _DECLARATION_RE = /\/\/\s*read-surface:\s*([a-z0-9-]+)/;

/** `git` is deliberately NOT a remote command above. */
export const LOCAL_VCS_EXCLUSION =
    'a `git` subprocess reads local repository state, not outside bytes, so it is not an ' +
    'inbound shape. `git fetch` and `git ls-remote` move refs rather than content and are ' +
    'excluded with the rest — a branch name is attacker-influenceable in principle, and if ' +
    'that ever reaches a model-facing surface it needs its own row, not a widened matcher ' +
    'that would re-add every local `git status` wrapper in the tree.';

/**
 * Weak inbound shapes — a network call the strong detectors cannot resolve.
 *
 * `await this._fetch(url, …)` is a real HTTP request behind an injected
 * dependency, which is exactly the shape a strong matcher on `await fetch(`
 * misses. It produces a row rather than silence; the verdict is
 * `unclassified`, because the scanner cannot tell an injected fetch from an
 * injected stub without executing it.
 */
export const WEAK_INBOUND: readonly ShapeDetector[] = [
    {
        id: 'indirect-fetch',
        match: (s) => /\bawait\s+(?:this|self|[a-z_$][\w$]*)\s*\.\s*_?fetch\s*\(/i.test(s),
    },
];

/** Recognised ways a module hands a string onward. */
export const EMIT_SHAPES: readonly ShapeDetector[] = [
    { id: 'file-write', match: (s) => /\b(?:writeFileSync|appendFileSync|writeFile)\s*\(/.test(s) },
    { id: 'stdout-write', match: (s) => /\bprocess\s*\.\s*stdout\s*\.\s*write\s*\(/.test(s) },
    { id: 'exported-api', match: (s) => /^export\s+(?:async\s+)?function\s/m.test(s) },
];

/** The sanitize floor, as an import. One hop; a transitive import is not counted. */
const _SANITIZE_IMPORT_RE =
    /import\s*\{[^}]*\b(?:sanitize_text|sanitize_entry|sanitize_markup)\b[^}]*\}\s*from\s*['"][^'"]*retrieval_sanitize(?:\.js)?['"]/;

/** Test files under `src/scripts/` — fixtures, not surfaces that ship bytes. */
const _EXCLUDE_RE = /(?:^|\/)(?:__tests__|node_modules)\/|\.test\.ts$/;

/**
 * Modules that define or read the coverage rather than being a surface.
 *
 * The scanner and its gate quote every detector pattern above as a literal, so
 * they match their own matchers. Excluding them by name is the honest fix: a
 * row for the scanner would be an artefact of the scanner reading itself, and
 * carrying it would train a reader to skip rows.
 */
const _SELF_MODULES: ReadonlySet<string> = new Set([
    '_lib/retrieval_sanitize.ts',
    '_lib/read_surface_scan.ts',
    'check_read_surface_coverage.ts',
]);

/**
 * Raised when a directory under the scan root cannot be read.
 *
 * The walk used to swallow the error and return, which made an INCOMPLETE scan
 * indistinguishable from a complete one: a permission error on one subtree
 * silently removed every module under it from the table, and the gate then
 * reported the shortened list as matching the tree. An independent review named
 * it; the direction is the same one `assertScanned` enforces at the corpus
 * level, applied to the traversal that builds the corpus.
 */
export class ScanTraversalError extends Error {
    constructor(readonly dir: string, cause: unknown) {
        super(`read_surface_scan: cannot read ${dir} — the scan is incomplete, not clean (${String(cause)})`);
        this.name = 'ScanTraversalError';
    }
}

/**
 * Directory reader, injectable for one reason: to test the failure.
 *
 * The fail-closed branch below can only be exercised by a `readdirSync` that
 * throws, and on ESM `vi.spyOn(fs, 'readdirSync')` cannot redefine the
 * namespace property. The alternative — chmod-000 on a real directory — is not
 * portable, because under root the mode is no barrier and the test then fails
 * in exactly the environment it was written to survive. A narrow seam is the
 * honest shape: production passes nothing and gets `fs.readdirSync`.
 */
export type ReadDir = (dir: string) => fs.Dirent[];

const _defaultReadDir: ReadDir = (dir) => fs.readdirSync(dir, { withFileTypes: true });

function _walk(dir: string, base: string, out: string[], readDir: ReadDir): void {
    let entries: fs.Dirent[];
    try {
        entries = readDir(dir);
    } catch (exc) {
        throw new ScanTraversalError(dir, exc);
    }
    for (const e of entries) {
        const abs = path.join(dir, e.name);
        const rel = path.relative(base, abs).split(path.sep).join('/');
        if (e.isDirectory()) {
            _walk(abs, base, out, readDir);
        } else if (e.isFile() && rel.endsWith('.ts') && !rel.endsWith('.d.ts') && !_EXCLUDE_RE.test(rel)) {
            out.push(rel);
        }
    }
}

/** The scan root, repo-relative. Published so the gate can name it in an error. */
export const SCAN_ROOT = 'src/scripts';

/**
 * Scan every TypeScript module under `src/scripts/` and return one row per
 * module that both brings outside bytes in and hands a string onward.
 *
 * Rows are sorted by module path so the rendered table is stable across
 * filesystems.
 */
export function scanReadSurfaces(repoRoot: string, readDir: ReadDir = _defaultReadDir): ReadSurfaceRow[] {
    const base = path.join(repoRoot, SCAN_ROOT);
    const files: string[] = [];
    _walk(base, base, files, readDir);
    files.sort();

    const rows: ReadSurfaceRow[] = [];
    for (const rel of files) {
        if (_SELF_MODULES.has(rel)) continue;
        let src: string;
        try {
            src = fs.readFileSync(path.join(base, rel), 'utf-8');
        } catch {
            continue;
        }
        const strong = STRONG_INBOUND.find((d) => d.match(src));
        const weak = strong === undefined ? WEAK_INBOUND.find((d) => d.match(src)) : undefined;
        if (strong === undefined && weak === undefined) continue;
        // A declared surface reports the shape its own marker names, so the
        // table says `ingested-corpus` rather than the detector's own id.
        const strongId =
            strong?.id === 'declared' ? (_DECLARATION_RE.exec(src)?.[1] ?? 'declared') : strong?.id;

        const emit = EMIT_SHAPES.find((d) => d.match(src));
        const sanitized = _SANITIZE_IMPORT_RE.test(src);

        if (weak !== undefined) {
            rows.push({
                module: rel,
                inbound: weak.id,
                emit: emit?.id ?? 'undecided',
                coverage: 'unclassified',
                evidence: 'network access through a callee the scanner cannot resolve — read the module',
            });
            continue;
        }
        if (emit === undefined) {
            rows.push({
                module: rel,
                inbound: strongId ?? 'unknown',
                emit: 'undecided',
                coverage: 'unclassified',
                evidence: 'inbound bytes with no recognised emit — the onward path is undecided',
            });
            continue;
        }
        rows.push({
            module: rel,
            inbound: strongId ?? 'unknown',
            emit: emit.id,
            coverage: sanitized ? 'covered' : 'uncovered',
            evidence: sanitized
                ? 'imports the sanitize floor'
                : 'no sanitize import — fetched bytes reach the emit unfiltered',
        });
    }
    return rows;
}

/** Counts by verdict, for the gate's scanned line and for the table header. */
export function tally(rows: readonly ReadSurfaceRow[]): Record<SurfaceCoverage, number> {
    const out: Record<SurfaceCoverage, number> = { covered: 0, uncovered: 0, unclassified: 0 };
    for (const r of rows) out[r.coverage] += 1;
    return out;
}

/** Render the rows as the markdown table body committed to the contract doc. */
export function renderTable(rows: readonly ReadSurfaceRow[]): string {
    const lines = [
        '| module (under `src/scripts/`) | inbound shape | emit shape | coverage | evidence |',
        '|---|---|---|---|---|',
    ];
    for (const r of rows) {
        lines.push(
            `| \`${r.module}\` | \`${r.inbound}\` | \`${r.emit}\` | **${r.coverage}** | ${r.evidence} |`,
        );
    }
    const t = tally(rows);
    lines.push('');
    lines.push(
        `${String(rows.length)} read surface(s): ` +
            `${String(t.covered)} covered, ${String(t.uncovered)} uncovered, ` +
            `${String(t.unclassified)} unclassified.`,
    );
    return lines.join('\n');
}
