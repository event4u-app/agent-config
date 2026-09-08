/**
 * Build pass — resolve raw edges against the whole-repo symbol table, finalise
 * the confidence taxonomy, and emit a deterministic `graph.json`.
 *
 * Determinism contract: identical *source* → identical graph bytes. Canonical
 * sort on nodes (by id) and edges (by source, relation, target, confidence),
 * stable key order, POSIX-relative paths, content-addressed checksum, no
 * timestamps. The golden-checksum test enforces byte-equality across runs.
 *
 * Path confinement: every candidate file is resolved and asserted under the
 * repo root; symlinks are skipped; ids are POSIX-relative. No network, no LLM.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../_lib/fs_atomic.js';
import { extractFile, type FileExtract, type RawEdge } from './extract.js';
import {
    ALIAS_VIA,
    aliasRulesFrom,
    EMPTY_RESOLUTION_CONFIG,
    parseJsonc,
    PSR4_VIA,
    psr4RulesFrom,
    type ResolutionConfig,
    resolveAlias,
    resolvePsr4,
} from './resolution_tiers.js';
import { emitSqliteTwin } from './sqlite_store.js';
import {
    type CodeEdge,
    type CodeGraph,
    type EdgeConfidence,
    EXPECTED_GRAMMAR_ABI,
    EXT_LANG,
    type Lang,
    type ResolvedVia,
    SCHEMA_VERSION,
} from './types.js';

const CANDIDATE_CAP = 12;
const IGNORE_DIRS = new Set([
    'node_modules',
    '.git',
    'vendor',
    'dist',
    'build',
    '.next',
    'coverage',
    '.cache',
    'storage',
]);

export interface SourceFile {
    /** repo-relative POSIX path */
    path: string;
    source: string;
}

// ── deterministic file discovery (path-confined) ─────────────────────────────

/** Recursively list launch-set source files under `root`, path-confined. */
export function discoverFiles(root: string): string[] {
    const abs = path.resolve(root);
    // Resolve the root itself first: a repo checked out under a symlinked
    // path (e.g. macOS /tmp → /private/tmp) must still confine correctly —
    // compare each file's realpath against the RESOLVED root, not `abs`.
    let realRoot: string;
    try {
        realRoot = fs.realpathSync(abs);
    } catch {
        return [];
    }
    const out: string[] = [];
    const walk = (dir: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(dir, { withFileTypes: true });
        } catch {
            return;
        }
        for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
            const full = path.join(dir, e.name);
            if (e.isSymbolicLink()) continue; // never follow symlinks
            if (e.isDirectory()) {
                if (!IGNORE_DIRS.has(e.name) && !e.name.startsWith('.')) walk(full);
                continue;
            }
            if (!e.isFile()) continue;
            const ext = path.extname(e.name).toLowerCase();
            if (!(ext in EXT_LANG)) continue;
            let real: string;
            try {
                real = fs.realpathSync(full);
            } catch {
                continue;
            }
            if (!real.startsWith(realRoot + path.sep)) continue; // symlink-escape confinement
            out.push(full);
        }
    };
    walk(abs);
    return out.sort();
}

function toPosixRel(root: string, full: string): string {
    return path.relative(root, full).split(path.sep).join('/');
}

// ── symbol table + resolution ────────────────────────────────────────────────

interface SymbolTable {
    /** bare name → def node ids (classes/interfaces/traits/functions). */
    byName: Map<string, string[]>;
    /** method name → method node ids (`...::name`). */
    methodsByName: Map<string, string[]>;
    /** class node id → its own method names. */
    ownMethods: Map<string, Set<string>>;
    /** class node id → parent class node ids (in-repo, resolved). */
    parents: Map<string, string[]>;
    /** class base name → class node id (first wins, deterministic by sort). */
    classByName: Map<string, string>;
}

/**
 * What a resolved name is allowed to BE at a given use site.
 *
 * The council that reviewed this repair made the same point from both seats: a
 * confidence label cannot contain a false edge, only describe one, so the
 * candidate set has to be filtered by capability BEFORE a confidence is
 * assigned. A `const` cannot satisfy `foo()`; a `type` alias cannot satisfy
 * `new T()`. Without this, adding constant/type/enum nodes in 2.1 would feed
 * the very same-name table that produced the false `path` edge in the first
 * place.
 */
type Capability = 'callable' | 'constructible' | 'any';
const CALLABLE_KINDS: ReadonlySet<string> = new Set(['function', 'method']);
const CONSTRUCTIBLE_KINDS: ReadonlySet<string> = new Set(['class']);

function satisfies(kind: string | undefined, want: Capability): boolean {
    if (kind === undefined) return true; // a file id / external ref — unknown, not disqualified
    if (want === 'callable') return CALLABLE_KINDS.has(kind);
    if (want === 'constructible') return CONSTRUCTIBLE_KINDS.has(kind);
    return true;
}

/**
 * One file's name bindings — the thing this engine did not have, and whose
 * absence is the whole of defect 1.1.
 *
 * `locals` is every symbol DECLARED in the file. `imports` is every name the
 * file BINDS from elsewhere, keyed on the local binding name, carrying whether
 * the binding was resolved from a module specifier (`exact`) or merely matched
 * by name (PHP `use`, which names a fully-qualified symbol and is matched on
 * its base name without checking the namespace).
 */
interface FileScope {
    locals: Map<string, string[]>;
    /** `via` records WHICH tier produced the binding, so an edge built from it
     * reports the mechanism instead of assuming `import-specifier`. */
    imports: Map<string, { target: string; exact: boolean; via: ResolvedVia }>;
}

const REL_EXTS = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs'];

/** POSIX-only join/dirname over graph ids, which are always POSIX-relative. */
function idDirname(id: string): string {
    const i = id.lastIndexOf('/');
    return i === -1 ? '' : id.slice(0, i);
}
function idJoin(dir: string, rel: string): string {
    const parts = (dir === '' ? [] : dir.split('/')).concat(rel.split('/'));
    const out: string[] = [];
    for (const p of parts) {
        if (p === '' || p === '.') continue;
        if (p === '..') {
            // A `..` that would escape the root is KEPT, so the caller can see
            // the specifier points outside the indexed tree rather than
            // silently resolving to something inside it.
            if (out.length && out[out.length - 1] !== '..') out.pop();
            else out.push('..');
            continue;
        }
        out.push(p);
    }
    return out.join('/');
}

/**
 * A relative module specifier → the id of the file node it names, or `null`
 * when that file is not in this graph (out of root, or an unsupported
 * extension). A bare specifier (`node:path`, `js-yaml`) is external by
 * definition and returns `null` too — the caller distinguishes the two by
 * looking at the specifier itself.
 *
 * TS source imports `./types.js` and the file on disk is `types.ts`, so the
 * runtime extension is stripped before the candidate list is tried.
 */
function resolveSpecifier(fromFile: string, spec: string, fileIds: ReadonlySet<string>): string | null {
    if (!spec.startsWith('.')) return null;
    const base = idJoin(idDirname(fromFile), spec);
    const stem = base.replace(/\.(js|jsx|mjs|cjs)$/, '');
    const candidates = [base, ...REL_EXTS.map((e) => stem + e), ...REL_EXTS.map((e) => base + '/index' + e)];
    for (const c of candidates) if (fileIds.has(c)) return c;
    return null;
}

function push(map: Map<string, string[]>, k: string, v: string): void {
    const arr = map.get(k);
    if (arr) {
        if (!arr.includes(v)) arr.push(v);
    } else map.set(k, [v]);
}

/**
 * Read the project's declared resolution tiers from `root` (2.3).
 *
 * IO lives here rather than in `buildGraph`, which stays pure so identical
 * source plus identical config yields identical bytes. A missing or
 * unparseable config is not an error — it degrades to no tiers, which is the
 * behaviour every build had before this existed.
 *
 * `tsconfig.json` is read as JSONC: it is JSONC by convention and this
 * repository's own carries `//` comments, so `JSON.parse` on it throws.
 */
export function readResolutionConfig(root: string): ResolutionConfig {
    const read = (name: string): unknown | null => {
        try {
            return parseJsonc(fs.readFileSync(path.join(root, name), 'utf-8'));
        } catch {
            return null;
        }
    };
    return {
        aliases: aliasRulesFrom(read('tsconfig.json')),
        psr4: psr4RulesFrom(read('composer.json')),
    };
}

/**
 * Pure, deterministic graph build over an in-memory file set. Exposed for
 * tests (no IO). `buildFromRepo` is the IO wrapper.
 */
export function buildGraph(
    files: readonly SourceFile[],
    extracts: readonly FileExtract[],
    resolution: ResolutionConfig = EMPTY_RESOLUTION_CONFIG,
): CodeGraph {
    const nodes = extracts.flatMap((e) => e.nodes);
    const nodeIds = new Set(nodes.map((n) => n.id));

    // Symbol resolution is language-scoped: a TS `this.foo()` must never
    // resolve to a PHP method of the same name (and vice-versa). Keys are
    // `${lang}:${name}`; candidate lists are filtered to the caller's language.
    const langOf = (sourceFile: string): Lang | null =>
        (EXT_LANG[path.extname(sourceFile).toLowerCase()] as Lang | undefined) ?? null;
    const nodeLang = new Map<string, Lang>();
    for (const n of nodes) {
        const l = langOf(n.source_file);
        if (l) nodeLang.set(n.id, l);
    }
    const k = (lang: Lang | null, name: string): string => `${lang ?? '?'}:${name}`;

    const sym: SymbolTable = {
        byName: new Map(),
        methodsByName: new Map(),
        ownMethods: new Map(),
        parents: new Map(),
        classByName: new Map(),
    };
    for (const n of nodes) {
        const lang = nodeLang.get(n.id) ?? null;
        // `byName` stays the CALLABLE/CONSTRUCTIBLE table it always was. The
        // kinds 2.1 added (constant / type / enum) are deliberately NOT put in
        // it: they are reachable through a file's own scope and through
        // `imports`, and letting them satisfy a bare `foo()` by name is the
        // defect this roadmap removes, not a feature it adds.
        if (n.kind === 'class' || n.kind === 'interface' || n.kind === 'trait' || n.kind === 'function') {
            push(sym.byName, k(lang, n.label), n.id);
            if (n.kind !== 'function' && !sym.classByName.has(k(lang, n.label)))
                sym.classByName.set(k(lang, n.label), n.id);
        }
        if (n.kind === 'method') {
            push(sym.methodsByName, k(lang, n.label), n.id);
            const classId = n.id.slice(0, n.id.lastIndexOf('::'));
            const set = sym.ownMethods.get(classId) ?? new Set<string>();
            set.add(n.label);
            sym.ownMethods.set(classId, set);
        }
    }
    // resolve inheritance to in-repo class ids (same language)
    for (const e of extracts)
        for (const inh of e.inherits) {
            const parentId = sym.classByName.get(k(e.lang, inh.parentName));
            if (parentId) push(sym.parents, inh.classId, parentId);
        }

    const ancestorsOf = (classId: string): string[] => {
        const seen = new Set<string>();
        const stack = [...(sym.parents.get(classId) ?? [])];
        while (stack.length) {
            const p = stack.pop() as string;
            if (seen.has(p)) continue;
            seen.add(p);
            for (const gp of sym.parents.get(p) ?? []) stack.push(gp);
        }
        return [...seen];
    };
    /** find a method `name` on `classId` or its in-repo ancestors. */
    const resolveHierMethod = (classId: string, name: string): string | null => {
        if (sym.ownMethods.get(classId)?.has(name)) return `${classId}::${name}`;
        for (const anc of ancestorsOf(classId)) if (sym.ownMethods.get(anc)?.has(name)) return `${anc}::${name}`;
        return null;
    };

    const nodeKind = new Map(nodes.map((n) => [n.id, n.kind as string]));
    const fileIds = new Set(nodes.filter((n) => n.kind === 'file').map((n) => n.id));
    const scopes = new Map<string, FileScope>();
    for (const ex of extracts) {
        const locals = new Map<string, string[]>();
        for (const n of ex.nodes) if (n.kind !== 'file') push(locals, n.label, n.id);
        const imports = new Map<string, { target: string; exact: boolean; via: ResolvedVia }>();
        for (const r of ex.rawEdges) {
            if (r.relation !== 'imports') continue;
            const local = r.localName ?? r.targetName;
            if (imports.has(local)) continue; // first binding wins, deterministically
            const spec = r.moduleSpecifier;
            if (spec === undefined) {
                // PHP `use A\B\C` — a fully-qualified NAME, not a module path.
                //
                // TIER 1 (2.3): composer PSR-4 maps the NAMESPACE to a
                // directory, so the class file is named outright. That is a
                // declared mapping, hence `exact: true` — and it is the only
                // rung that can tell two same-named classes in different
                // namespaces apart.
                const fq = r.fqName ?? r.targetName;
                const psr4File = resolvePsr4(fq, resolution, fileIds);
                if (psr4File !== null) {
                    const member = `${psr4File}#${r.targetName}`;
                    imports.set(local, {
                        target: nodeKind.has(member) ? member : psr4File,
                        exact: true,
                        via: PSR4_VIA,
                    });
                    continue;
                }
                // TIER 2: base name, namespace discarded. A lookup, not a
                // syntactic fact: `exact: false`.
                const hit =
                    sym.classByName.get(k(ex.lang, r.targetName)) ??
                    (sym.byName.get(k(ex.lang, r.targetName)) ?? []).find((id) => id.includes('#') && !id.includes('::'));
                if (hit) imports.set(local, { target: hit, exact: false, via: 'name-lookup' });
                continue;
            }
            // TIER 0: a relative specifier — the file says where it points.
            // TIER 1 (2.3): tsconfig `paths`. `@shared/x` IS `src/shared/x`
            // because the project declares it, so this is a fact and not a
            // guess. Without it the specifier is non-relative, `resolveSpecifier`
            // returns null, and the import binds to `external:@shared/x` — a
            // real module, correctly named, and the wrong one.
            const relFile = resolveSpecifier(ex.file, spec, fileIds);
            const aliasFile = relFile === null ? resolveAlias(spec, resolution, fileIds) : null;
            const file = relFile ?? aliasFile;
            if (file === null) {
                // Bare (`node:path`, `zod`) or relative-but-out-of-root. Either
                // way the module is real and NAMED, and it is not this
                // repository's same-named symbol. `import * as path from
                // 'node:path'` ends here, which is the whole of 1.1.
                const named = r.importKind === 'named';
                imports.set(local, {
                    target: named ? `external:${spec}#${r.targetName}` : `external:${spec}`,
                    exact: true,
                    via: 'import-specifier',
                });
                continue;
            }
            // A namespace or default import binds the MODULE, never a
            // same-named export inside it.
            const member = `${file}#${r.targetName}`;
            const target = r.importKind === 'named' && nodeKind.has(member) ? member : file;
            imports.set(local, { target, exact: true, via: aliasFile === null ? 'import-specifier' : ALIAS_VIA });
        }
        scopes.set(ex.file, { locals, imports });
    }
    const emptyScope: FileScope = { locals: new Map(), imports: new Map() };

    /**
     * Resolve a bare name at a use site inside `file`, capability-filtered.
     *
     * The ladder is the language's own: a LOCAL declaration shadows an import
     * (both council seats named this, and JS/TS/PHP all agree), an import
     * resolved from a specifier is next, and only then the repo-wide same-name
     * table — which is a guess and is labelled as one.
     */
    const resolveInScope = (
        file: string,
        name: string,
        want: Capability,
        lang: Lang,
        scopeOnly = false,
    ): { target: string; confidence: EdgeConfidence; via: ResolvedVia } | null => {
        const scope = scopes.get(file) ?? emptyScope;
        // The ladder's rungs ARE the mechanism taxonomy, so `via` is read off
        // the branch that succeeded rather than inferred afterwards.
        for (const id of scope.locals.get(name) ?? [])
            if (satisfies(nodeKind.get(id), want))
                return { target: id, confidence: 'EXTRACTED', via: 'same-file' };
        const bound = scope.imports.get(name);
        if (bound && satisfies(nodeKind.get(bound.target), want))
            return {
                target: bound.target,
                confidence: bound.exact ? 'EXTRACTED' : 'INFERRED',
                // The binding knows how it was made — a tsconfig alias and a
                // PSR-4 namespace are not import specifiers and must not be
                // reported as ones.
                via: bound.via,
            };
        if (scopeOnly) return null;
        const wide =
            want === 'constructible'
                ? sym.classByName.get(k(lang, name))
                : (sym.byName.get(k(lang, name)) ?? []).find(
                      (id) => id.includes('#') && !id.includes('::') && satisfies(nodeKind.get(id), want),
                  );
        // Reached only by matching a name across the whole repository, with no
        // binding in this file to justify it. That is not a syntactic fact and
        // no longer claims to be one.
        if (wide) return { target: wide, confidence: 'INFERRED', via: 'name-lookup' };
        return null;
    };

/**
 * The mechanism for an edge whose target did not resolve.
 *
 * A `symbol:` pseudo-target is the residue of a name lookup that found
 * nothing, so `name-lookup` is what actually happened. `confidence` already
 * carries whether it resolved; this field carries what was tried.
 */
    const UNRESOLVED_VIA: ResolvedVia = 'name-lookup';

    // Deduped the same way emitted edges are, so the count is comparable to
    // `edges.length` rather than being a raw call-site tally that reads as a
    // larger loss than the graph actually took.
    const suppressedKeys = new Set<string>();
    const edges: CodeEdge[] = [];
    const seen = new Set<string>();
    const emit = (e: CodeEdge): void => {
        const key = `${e.source}\0${e.relation}\0${e.target}\0${e.confidence}`;
        if (seen.has(key)) return;
        seen.add(key);
        edges.push(e);
    };
    const methodCandidates = (name: string, lang: Lang): string[] =>
        (sym.methodsByName.get(k(lang, name)) ?? []).slice().sort().slice(0, CANDIDATE_CAP);

    for (const ex of extracts) {
        // structural inherits edges (same-language resolution)
        for (const inh of ex.inherits) {
            const hit = resolveInScope(ex.file, inh.parentName, 'constructible', ex.lang);
            emit({
                source: inh.classId,
                target: hit?.target ?? `symbol:${inh.parentName}`,
                relation: 'inherits',
                confidence: hit?.confidence ?? 'EXTRACTED',
                resolved_via: hit?.via ?? UNRESOLVED_VIA,
                provider: 'native',
            });
        }
        for (const r of ex.rawEdges) resolveRawEdge(r, ex);
    }

    function resolveRawEdge(r: RawEdge, ex: FileExtract): void {
        if (r.relation === 'member') {
            const sep = r.sourceId.includes('#') ? '::' : '#';
            const target = `${r.sourceId}${sep}${r.targetName}`;
            emit({
                source: r.sourceId,
                target: nodeIds.has(target) ? target : `symbol:${r.targetName}`,
                relation: 'member',
                confidence: 'EXTRACTED',
                // A member id is DERIVED from its own source node's id, so the
                // declaration is in the same file by construction — no lookup
                // of any kind happens here.
                resolved_via: nodeIds.has(target) ? 'same-file' : UNRESOLVED_VIA,
                provider: 'native',
            });
            return;
        }
        if (r.relation === 'imports') {
            // The import's own binding, computed once per file above. A
            // specifier-resolved binding is a syntactic fact — the file says
            // where the name comes from — and a PHP `use` matched by base name
            // is not, and says so.
            const bound = (scopes.get(ex.file) ?? emptyScope).imports.get(r.localName ?? r.targetName);
            emit({
                source: r.sourceId,
                target: bound?.target ?? `symbol:${r.targetName}`,
                relation: 'imports',
                confidence: bound ? (bound.exact ? 'EXTRACTED' : 'INFERRED') : 'EXTRACTED',
                resolved_via: bound ? bound.via : UNRESOLVED_VIA,
                provider: 'native',
            });
            return;
        }
        if (r.relation === 'uses') {
            // A registry literal (`{ foo: handleFoo }`) or an object shorthand
            // (`{ id, label }`) names something bound IN THIS FILE. It is
            // resolved through the file's scope and NOWHERE else: a shorthand
            // property almost always names a local variable, and matching it
            // against a same-named declaration elsewhere in the repository is
            // the defect this roadmap removes, applied to a second relation.
            const hit = resolveInScope(ex.file, r.targetName, 'any', ex.lang, true);
            emit({
                source: r.sourceId,
                target: hit?.target ?? `symbol:${r.targetName}`,
                relation: 'uses',
                confidence: hit?.confidence ?? 'EXTRACTED',
                resolved_via: hit?.via ?? UNRESOLVED_VIA,
                provider: 'native',
            });
            return;
        }
        // relation === 'calls'
        if (r.callStyle === 'new' || r.callStyle === 'free') {
            const want: Capability = r.callStyle === 'new' ? 'constructible' : 'callable';
            const hit = resolveInScope(ex.file, r.targetName, want, ex.lang);
            emit({
                source: r.sourceId,
                target: hit?.target ?? `symbol:${r.targetName}`,
                relation: 'calls',
                // An UNRESOLVED name stays EXTRACTED: `symbol:strlen` claims
                // nothing about a node, it records that a call to a name this
                // repository does not declare happened here. What is no longer
                // EXTRACTED is a claim about a SPECIFIC in-repo node reached by
                // name alone.
                confidence: hit?.confidence ?? 'EXTRACTED',
                resolved_via: hit?.via ?? UNRESOLVED_VIA,
                provider: 'native',
            });
            return;
        }
        if (r.callStyle === 'this' || r.callStyle === 'self' || r.callStyle === 'static' || r.callStyle === 'parent') {
            const hit = r.enclosingClassId ? resolveHierMethod(r.enclosingClassId, r.targetName) : null;
            if (hit) {
                emit({
                    source: r.sourceId,
                    target: hit,
                    relation: 'calls',
                    confidence: 'INFERRED',
                    // Walked the class hierarchy, which is same-file only when
                    // the declaring class is; the honest mechanism for a
                    // hierarchy walk is the repo-wide method table.
                    resolved_via: 'name-lookup',
                    provider: 'native',
                });
            } else {
                // enclosing class extends an out-of-repo base → honest AMBIGUOUS
                const cands = methodCandidates(r.targetName, ex.lang);
                emit({
                    source: r.sourceId,
                    target: ambiguousTarget(cands, r.targetName),
                    relation: 'calls',
                    confidence: 'AMBIGUOUS',
                    resolved_via: 'dynamic',
                    provider: 'native',
                    // The enclosing class extends a base outside this
                    // repository, so the method is not findable HERE — a
                    // different cause from a call whose receiver is unknown,
                    // and the two need different fixes.
                    ambiguity_reason: 'hierarchy-unresolved',
                    ...(cands.length ? { candidates: cands } : {}),
                });
            }
            return;
        }
        // scoped (Class::m unresolved / facade) or dynamic ($obj->m) → AMBIGUOUS
        const cands = methodCandidates(r.targetName, ex.lang);
        if (r.callStyle === 'dynamic' && cands.length === 0) {
            // `x.push()`, `m.get()`, `s.join()` — a dynamic member call whose
            // method name matches NO method declared in this repository. The
            // only target available is `symbol:push`, which is not a node, so
            // no query verb can reach it: `affected` and `path` resolve seeds
            // against real nodes and a pseudo-node is never one. It was 257 of
            // 660 edges on this engine's own source — 39 % of the graph
            // asserting "a method named push was called somewhere".
            //
            // NOT suppressed: a `scoped` call (`Cache::get()`) and a
            // `hierarchy-unresolved` `$this->missing()` both name a real
            // unresolved intent inside a known receiver, which a later
            // resolution pass could settle. This drops only the class where
            // there is nothing to settle.
            //
            // The count is published in `suppressed_edge_counts` — an engine
            // that silently deletes its worst edges reports a flattering
            // confidence ratio and no evidence.
            suppressedKeys.add(`${r.sourceId}\0calls\0symbol:${r.targetName}`);
            return;
        }
        emit({
            source: r.sourceId,
            target: ambiguousTarget(cands, r.targetName),
            relation: 'calls',
            confidence: 'AMBIGUOUS',
            resolved_via: 'dynamic',
            provider: 'native',
            // Receiver type unknown: `$obj->m()` or an unresolved `C::m()`.
            // Resolving this needs type inference the extractor does not do,
            // which is exactly what 1.2 has to decide about rather than assume.
            ambiguity_reason: 'receiver-unknown',
            ...(cands.length ? { candidates: cands } : {}),
        });
    }

    // ── DERIVED `tests` edges (3.2) ────────────────────────────────────────
    //
    // A test file that imports an in-repo symbol from a NON-test file is
    // asserted to test it. Derived here rather than extracted because the
    // predicate is a property of the two PATHS, which no grammar can see, and
    // because `buildGraph` already holds every `imports` edge plus the node
    // table needed to reject cross-test and out-of-repo targets.
    //
    // Three exclusions, each of which would otherwise manufacture a false
    // `tests` edge:
    //   · target outside the repository (`external:*` / `symbol:*`) — there is
    //     no subject to test;
    //   · target in another TEST file — a shared test helper is not a subject;
    //   · target is the subject FILE node rather than a symbol in it, which is
    //     kept: a test that imports a module tests that module, and the file
    //     node is the only handle a caller has for a module with no exported
    //     symbol the extractor named.
    const nodeSourceFile = new Map(nodes.map((n) => [n.id, n.source_file]));
    for (const e of [...edges]) {
        if (e.relation !== 'imports') continue;
        const from = nodeSourceFile.get(e.source);
        if (from === undefined || !isTestFile(from)) continue;
        const to = nodeSourceFile.get(e.target);
        if (to === undefined || isTestFile(to)) continue;
        emit({
            source: e.source,
            target: e.target,
            relation: 'tests',
            confidence: 'INFERRED',
            resolved_via: 'test-import',
            provider: 'native',
        });
    }

    // deterministic ordering
    nodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    edges.sort((a, b) => {
        const ka = `${a.source}\0${a.relation}\0${a.target}\0${a.confidence}`;
        const kb = `${b.source}\0${b.relation}\0${b.target}\0${b.confidence}`;
        return ka < kb ? -1 : ka > kb ? 1 : 0;
    });

    const counts = { EXTRACTED: 0, INFERRED: 0, AMBIGUOUS: 0 };
    for (const e of edges) counts[e.confidence] += 1;
    const suppressed = { dynamic_no_candidate: suppressedKeys.size };

    const languages = [...new Set(extracts.map((e) => e.lang))].sort() as Lang[];

    // content-addressed checksum (deterministic across machines)
    const h = createHash('sha256');
    for (const f of [...files].sort((a, b) => (a.path < b.path ? -1 : 1))) {
        h.update(f.path);
        h.update('\0');
        h.update(createHash('sha256').update(f.source, 'utf-8').digest('hex'));
        h.update('\n');
    }

    return {
        schema_version: SCHEMA_VERSION,
        source_checksum: h.digest('hex'),
        languages,
        grammar_abi: EXPECTED_GRAMMAR_ABI,
        edge_confidence_counts: counts,
        suppressed_edge_counts: suppressed,
        nodes,
        edges,
    };
}

/** Stable JSON with sorted keys — the byte-equality anchor. */
/**
 * The `target` of an AMBIGUOUS edge.
 *
 * `road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh` 1.2. The rule
 * that was here — `candidates[0] ?? symbol:<name>` — is the false positive the
 * roadmap names verbatim: `discoverTurboGenerators --calls--> LruCache::set`,
 * measured across three files, produced by a generic `.set(...)` call whose
 * first alphabetical candidate happened to be a cache class in a bench fixture.
 *
 * **The defect is not the ambiguity, it is the ARBITRARY WINNER.** Every
 * consumer that reads `target` and ignores `confidence` sees a specific method
 * on a specific class — and the taxonomy's own acceptance rule is that an
 * AMBIGUOUS edge is correct when the true target is *among the candidates*,
 * which says plainly that no single one of them is the answer.
 *
 * So: ONE candidate is a real resolution and is kept as the target; MORE than
 * one is a choice the extractor cannot make, and the target becomes the
 * unresolved symbol while `candidates` carries every option. Nothing is lost —
 * the list was already emitted — and the graph stops asserting a method call
 * that does not happen.
 *
 * Measured effect on this repository: 8,960 AMBIGUOUS edges carried candidates,
 * of which 8,939 had more than one and therefore an arbitrary target.
 */
function ambiguousTarget(candidates: readonly string[], targetName: string): string {
    if (candidates.length === 1) return candidates[0] as string;
    return `symbol:${targetName}`;
}

/**
 * Is `relPath` a test file?
 *
 * A deterministic PATH predicate — no content read, no heuristic on the file's
 * body. It is the input to the derived `tests` relation (3.2), so it has to be
 * conservative in one direction only: a subject wrongly classified as a test
 * silently loses its `tests` edges, while a test wrongly classified as a
 * subject would make a test file look like a tested surface. Both are wrong;
 * the second is worse, because `untested` would then report a real subject as
 * covered.
 *
 * The four conventions are the ones this launch set actually uses, and each is
 * anchored rather than substring-matched so a directory called
 * `src/latest/thing.ts` is not a test:
 *
 *   · a `tests/` or `test/` path segment (this repository's own layout);
 *   · a `__tests__/` segment (the JS convention);
 *   · a `.test.` / `.spec.` filename infix (Vitest / Jest / Pest-JS);
 *   · a `Test.php` / `test.php` filename suffix, or a `_test.php` infix
 *     (PHPUnit's `*Test.php` and Go-style `_test` both appear in PHP trees).
 */
export function isTestFile(relPath: string): boolean {
    const p = relPath.split(path.sep).join('/');
    const segments = p.split('/');
    if (segments.some((seg) => seg === 'tests' || seg === 'test' || seg === '__tests__')) return true;
    const base = segments[segments.length - 1] ?? '';
    if (/\.(test|spec)\./i.test(base)) return true;
    if (/(^|[._-])test\.php$/i.test(base)) return true;
    if (/Test\.php$/.test(base)) return true;
    return false;
}

export function serializeGraph(g: CodeGraph): string {
    const key_order: (keyof CodeGraph)[] = [
        'schema_version',
        'source_checksum',
        'languages',
        'grammar_abi',
        'edge_confidence_counts',
        'suppressed_edge_counts',
        'nodes',
        'edges',
    ];
    const node = (n: CodeGraph['nodes'][number]) => ({
        id: n.id,
        label: n.label,
        kind: n.kind,
        source_file: n.source_file,
        source_location: n.source_location,
    });
    const edge = (e: CodeEdge) => {
        const base: Record<string, unknown> = {
            source: e.source,
            target: e.target,
            relation: e.relation,
            confidence: e.confidence,
            // Unconditional, unlike the two optional fields below: these are
            // required on every edge, so emitting them conditionally would make
            // an absent field mean "not set" instead of being impossible.
            resolved_via: e.resolved_via,
            provider: e.provider,
        };
        // Ordered before `candidates` deliberately: the reason is the coarser
        // axis and a reader scanning the serialized graph sees WHY before HOW
        // MANY. Both are omitted when absent, so an EXTRACTED edge is byte-for-
        // byte what it was before this field existed.
        if (e.ambiguity_reason) base['ambiguity_reason'] = e.ambiguity_reason;
        if (e.candidates) base['candidates'] = e.candidates;
        return base;
    };
    const ordered: Record<string, unknown> = {};
    for (const k of key_order) {
        if (k === 'nodes') ordered[k] = g.nodes.map(node);
        else if (k === 'edges') ordered[k] = g.edges.map(edge);
        else ordered[k] = g[k];
    }
    return JSON.stringify(ordered, null, 2) + '\n';
}

export interface BuildResult {
    graph: CodeGraph;
    json: string;
    fileCount: number;
    reExtracted: number;
    reused: number;
}

function contentHash(s: string): string {
    return createHash('sha256').update(s, 'utf-8').digest('hex');
}

/** Sidecar of per-file extracts keyed by content hash — enables `--update`
 * without re-parsing unchanged files. Gitignored build artifact, never a
 * source of truth: a full build reproduces the identical graph. */
interface ExtractSidecar {
    version: number;
    files: Record<string, { hash: string; extract: FileExtract }>;
}

/** Exported so `refresh` (cli.ts) can locate/seed/promote the sidecar next to
 * a temp `--out` path without duplicating the naming convention. */
export function sidecarPath(cachePath: string): string {
    return cachePath.replace(/\.json$/, '.extracts.json');
}

function readSidecar(p: string): ExtractSidecar | null {
    try {
        const s = JSON.parse(fs.readFileSync(p, 'utf-8')) as ExtractSidecar;
        return s.version === SCHEMA_VERSION ? s : null;
    } catch {
        return null;
    }
}

/**
 * IO wrapper: discover → read → extract → build → (optionally) write cache.
 * With `update`, reuses cached per-file extracts for files whose content hash
 * is unchanged and re-extracts only changed/new files. The resulting graph is
 * byte-identical to a cold build (buildGraph is pure over the extract set) —
 * `--update` is a speed optimization, never a semantic one.
 */
export async function buildFromRepo(
    root: string,
    cachePath: string | null,
    opts: { update?: boolean } = {},
): Promise<BuildResult> {
    const abs = path.resolve(root);
    const fullPaths = discoverFiles(abs);
    const files: SourceFile[] = [];
    for (const full of fullPaths) {
        const rel = toPosixRel(abs, full);
        let source: string;
        try {
            source = fs.readFileSync(full, 'utf-8');
        } catch {
            continue;
        }
        files.push({ path: rel, source });
    }

    const prior = opts.update && cachePath ? readSidecar(sidecarPath(cachePath)) : null;
    const priorFiles = prior?.files ?? {};
    const nextSidecar: ExtractSidecar = { version: SCHEMA_VERSION, files: {} };
    const extracts: FileExtract[] = [];
    let reExtracted = 0;
    let reused = 0;
    for (const f of files) {
        const hash = contentHash(f.source);
        const cached = priorFiles[f.path];
        let extract: FileExtract;
        if (cached && cached.hash === hash) {
            extract = cached.extract;
            reused += 1;
        } else {
            const lang = EXT_LANG[path.extname(f.path).toLowerCase()] as Lang;
            extract = await extractFile(f.path, f.source, lang);
            reExtracted += 1;
        }
        extracts.push(extract);
        nextSidecar.files[f.path] = { hash, extract };
    }

    const graph = buildGraph(files, extracts, readResolutionConfig(root));
    const json = serializeGraph(graph);
    if (cachePath) {
        write_atomic(cachePath, json);
        write_atomic(sidecarPath(cachePath), JSON.stringify(nextSidecar));
        // Derived SQLite twin (ADR-129): best-effort accelerator beside the
        // canonical JSON — never fails the build, no-op on old Node.
        emitSqliteTwin(graph, json, cachePath);
    }
    return { graph, json, fileCount: files.length, reExtracted, reused };
}
