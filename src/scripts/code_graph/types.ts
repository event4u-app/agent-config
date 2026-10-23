/**
 * Shared types for the native code-graph engine (Class-A, ADR-124).
 *
 * The graph shape is deliberately identical to what the interop tier consumes
 * and to `discovery_graph.ts`'s edge-confidence scale — one code path serves
 * the native cache, a consumer-shipped `graph.json`, and any future consumer
 * of the shape. Deterministic + LLM-free + no network: identical source →
 * identical graph bytes (enforced by the golden-checksum test).
 */

/** Launch set — the stacks this suite's consumers actually run. */
export type Lang = 'php' | 'typescript' | 'javascript' | 'python' | 'go' | 'java';

/** Same scale as `discovery_graph.ts::EdgeConfidence` (reused, not forked). */
export type EdgeConfidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';

/**
 * Relations the graph carries.
 *
 * `calls` / `imports` / `uses` / `inherits` / `member` come from the extractor.
 * `tests` is DERIVED in the build pass (`road-to-a-graph-that-is-shipped` 3.2):
 * a test file that imports an in-repo symbol from a non-test file is asserted
 * to test it, `resolved_via: 'test-import'`, `confidence: 'INFERRED'`. The two
 * halves of that are deliberately split across the two axes — the import is a
 * syntactic fact, so it is EXTRACTED evidence, while "this test tests that
 * subject" is an inference from a naming convention, which is what INFERRED
 * says. Deriving it in `buildGraph` rather than in the extractor keeps the
 * extractor per-file and pure: the predicate needs only the two paths, and no
 * grammar can see whether a file is a test.
 */
/**
 * `routes-to` … `injects` are the convention links a registered provider reads
 * by rule (`providers/`, ADR-298): a route to its handler, code to the template
 * it renders, a template to the template it includes, code to the translation
 * or config file it reads, a migration to its table, a model to its table, a
 * model to the model a relation names, a class to the service a container
 * injects into it. The vocabulary is fixed and names no framework.
 */
export type Relation =
    | 'calls'
    | 'imports'
    | 'uses'
    | 'inherits'
    | 'member'
    | 'tests'
    | 'routes-to'
    | 'renders'
    | 'includes'
    | 'reads'
    | 'migrates'
    | 'persists'
    | 'relates'
    | 'injects'
    /** A Markdown document links to, or names, the file (`docs_layer.ts`). */
    | 'documents';

/**
 * HOW an edge's target was arrived at — the mechanism, not the confidence.
 *
 * The two axes are independent and conflating them is what this field fixes.
 * `confidence` says how much to trust the target; `resolved_via` says what
 * produced it, which is the axis a consumer filters on. Phase 3's verbs accept
 * an edge when `resolved_via` is not in `{name-lookup, dynamic}` — a rule that
 * cannot be expressed in the confidence scale at all, because a `name-lookup`
 * hit and a same-file hit can both be INFERRED.
 *
 * Four of the eight occur today, and saying which is the point of an enum that
 * is wider than its current population:
 *
 * · `same-file` — a local declaration in the using file. The language's own
 *   shadowing rule makes this the strongest binding there is.
 * · `import-specifier` — an import/`use` binding: the file states where the
 *   name comes from.
 * · `name-lookup` — the repo-wide same-name table, or an attempted lookup that
 *   found nothing and left a `symbol:` pseudo-target. A guess either way, and
 *   the value that says so.
 * · `dynamic` — a receiver the extractor cannot type (`$obj->m()`, an
 *   unresolved `C::m()`), or a hierarchy rooted outside the repository.
 *
 * The remaining four are declared and currently unemitted: `path-alias` and
 * `psr4` arrive with the resolution tiers in step 2.3, and `route-table` /
 * `test-import` with the relations Phase 3 adds. They are in the union now so
 * that adding them later is a build change rather than a schema change.
 */
export type ResolvedVia =
    | 'same-file'
    | 'import-specifier'
    | 'path-alias'
    | 'psr4'
    | 'route-table'
    /** A template directive, a render / translation / config call naming a file, or a Markdown link. */
    | 'directive-scan'
    /** A schema or migration call creating a table, or a model mapped to such a table. */
    | 'schema-call'
    /** An ORM relation declared inside a model, naming the related model. */
    | 'orm-relation'
    /** A dependency-injection declaration naming the injected class. */
    | 'di-binding'
    /** A string literal equal to exactly one file's path (the default pass). */
    | 'literal-path'
    /** A dotted name equal to exactly one template's path (the default pass). */
    | 'literal-dotted'
    /** A page module whose path is its route (the default pass). */
    | 'fs-route'
    /** Stated by a compiler-grade SCIP index the project ships (`scip_reader.ts`). */
    | 'compiler-index'
    | 'test-import'
    | 'name-lookup'
    | 'dynamic'
    /**
     * Read from a consumer's own graph file, written by another tool.
     *
     * Not a mechanism THIS package used — a statement that it used none. The
     * relation came from someone else's vocabulary and was mapped, which is
     * an interpretation, so the value belongs in the guess set below and the
     * gate verbs refuse a graph made only of these.
     */
    | 'foreign';

/**
 * WHICH engine produced the edge.
 *
 * One value, and the field exists anyway: an edge with no provider is
 * indistinguishable from an edge whose provider nobody recorded, and the whole
 * point of a mixed graph — should one ever exist — is being able to tell them
 * apart. Kill register K2 forbids an external provider entering `src/`, so this
 * stays a single-member union until a decision changes that.
 */
export type EdgeProvider =
    | 'native'
    /**
     * The edge was read from a graph file this package did not build.
     *
     * This is a DATA tag on an edge, not an engine in `src/`: no foreign
     * extractor is vendored, imported or executed anywhere, and K2 is about
     * the latter. The field exists precisely so a mixed graph can be told
     * apart, and a consumer-shipped graph is the first case where it is.
     */
    | 'foreign'
    /** Read from the project's own SCIP index, merged into the native build. */
    | 'scip';

/**
 * Every mechanism, classified as a statement (the source names the target) or
 * a guess. Trust is this ALLOWLIST (ADR-298): it replaced a denylist of guesses,
 * under which a new mechanism was trusted merely because nobody had listed it —
 * wrong once several providers emit edges. A string that is no member at all
 * (an older or foreign graph) is a guess. The type below fails to compile when a
 * `ResolvedVia` member is in neither list.
 *
 * The guesses: `name-lookup` is the repo-wide same-name table (or a lookup that
 * found nothing); `dynamic` is a receiver the extractor cannot type; `foreign`
 * was read from another tool's graph and only mapped. The BUILD pass needs the
 * split as much as the query tier: a derived edge stamped with a trustworthy
 * mechanism while its own evidence was a guess LAUNDERS the guess — a PHP
 * `use Two\Mailer` with no `composer.json` binds by base name, and a `tests`
 * edge derived from it made a wrong target trustworthy to every consumer.
 */
// One space-separated string per list: this module ships in the hook bundle,
// where an array literal costs a line per entry. `Words` splits it in the type.
const STATED_WORDS =
    'same-file import-specifier path-alias psr4 route-table directive-scan schema-call orm-relation di-binding compiler-index test-import literal-path literal-dotted fs-route' as const;
const GUESS_WORDS = 'name-lookup dynamic foreign' as const;
type Words<S extends string> = S extends `${infer H} ${infer T}` ? H | Words<T> : S;
/** Mechanisms in neither list; must be `never` (a test asserts it). */
export type UnclassifiedResolvedVia = Exclude<ResolvedVia, Words<typeof STATED_WORDS> | Words<typeof GUESS_WORDS>>;
/** Words that are no mechanism at all; must be `never` too. */
export type UnknownTrustWord = Exclude<Words<typeof STATED_WORDS> | Words<typeof GUESS_WORDS>, ResolvedVia>;
/** Fails to compile while either list is incomplete or carries a stray word. */
export type TrustListsComplete = [UnclassifiedResolvedVia | UnknownTrustWord] extends [never] ? true : never;
export const TRUST_LISTS_COMPLETE: TrustListsComplete = true;
export const STATED_RESOLVED_VIA: ReadonlySet<string> = new Set(STATED_WORDS.split(' '));
export const GUESS_RESOLVED_VIA: ReadonlySet<ResolvedVia> = new Set(GUESS_WORDS.split(' ') as ResolvedVia[]);

/** Does this edge's target rest on a stated fact? Anything not listed as stated is a guess. */
export function isStatedResolution(resolved_via: ResolvedVia): boolean {
    return STATED_RESOLVED_VIA.has(resolved_via);
}

export interface CodeNode {
    /** Path-qualified from day one: `<relpath>#<symbol>` (collision-free). */
    id: string;
    label: string;
    /**
     * `constant` / `type` / `enum` were added by
     * `road-to-the-graph-that-lies-confidently` 2.1: the v2 benchmark's
     * `references` class probes a const (`EXT_LANG`) and a type alias
     * (`SettingsClass`), and neither had a node to resolve to. `interface` is
     * reused rather than forked — a TS interface and a PHP interface are the
     * same thing to a caller.
     *
     * The kind is also a CAPABILITY claim the build pass reads: a `constant` is
     * never callable and never constructible, so a bare `foo()` may not resolve
     * to one by name. `const Widget = class {}` is emitted as `class` for
     * exactly that reason.
     */
    kind:
        | 'file'
        | 'class'
        | 'interface'
        | 'trait'
        | 'function'
        | 'method'
        | 'constant'
        | 'type'
        | 'enum'
        | 'skipped'
        /** A declared route or dispatched entry, `<VERB> <path>` (a convention provider). */
        | 'route'
        /** A database table a migration or schema creates (a convention provider). */
        | 'table';
    source_file: string;
    /** 1-based [startLine, startCol, endLine, endCol]; [] for synthetic nodes. */
    source_location: readonly number[];
}

export interface CodeEdge {
    source: string;
    target: string;
    relation: Relation;
    confidence: EdgeConfidence;
    /**
     * REQUIRED. Not optional, so "no edge lacks either field" is a property the
     * type system enforces at every construction site rather than a rule a
     * linter has to re-check afterwards.
     */
    resolved_via: ResolvedVia;
    /** REQUIRED, for the same reason. */
    provider: EdgeProvider;
    /**
     * Present only on AMBIGUOUS / multi-candidate edges: the resolved-target
     * candidates by id. An AMBIGUOUS edge is "correct" when the true target is
     * among these (the honest-taxonomy acceptance rule).
     */
    candidates?: string[];
    /**
     * Present only on AMBIGUOUS edges: WHY the target did not resolve.
     *
     * Added by `road-to-inbox-harvest-2026-08-f-code-graph-evidence-refresh`
     * 1.1. Before it, 43 % of this graph's edges carried AMBIGUOUS with no
     * recorded cause, so "resolve the largest class" was not a question the
     * artifact could answer — you had to re-run the extractor with a bespoke
     * script to find out what the classes even were.
     *
     * The taxonomy is the extractor's own branch structure, not a guess:
     *
     * · `receiver-unknown` — a dynamic (`$obj->m()`) or scoped (`C::m()`) call
     *   whose receiver type is not known. Resolving this needs type inference
     *   the extractor does not do.
     * · `hierarchy-unresolved` — a `this`/`self`/`static`/`parent` call inside a
     *   class whose hierarchy does not contain the method, i.e. the base class
     *   is outside the repository. Not resolvable from this tree at all.
     *
     * And the second axis, which decides whether resolution is even possible:
     * an edge with `candidates` has same-named methods to choose between; one
     * without has NO in-repo candidate, so no amount of inference would find a
     * target.
     */
    ambiguity_reason?: 'receiver-unknown' | 'hierarchy-unresolved';
    /** The convention provider that drew this edge (ADR-298); absent on every other edge. */
    provider_id?: string;
}

/** A convention provider active in this build, with the package roots it applied to. */
export interface ActiveProviderRecord {
    id: string;
    roots: string[];
}

export interface CodeGraph {
    schema_version: number;
    /** content-addressed to the file-manifest checksum (cache key). */
    source_checksum: string;
    /** launch-set languages actually seen in this build. */
    languages: Lang[];
    /** ABI version of the grammars used (pinned; asserted by the smoke test). */
    grammar_abi: number;
    /** per-confidence-class edge counts, so the honesty split is visible. */
    edge_confidence_counts: Record<EdgeConfidence, number>;
    /**
     * Edges the build pass REFUSED to emit, by reason. Present so a smaller
     * edge total cannot be read as a better graph without saying what was
     * dropped: an engine that quietly deletes its worst edges publishes a
     * flattering confidence ratio and no evidence.
     *
     * `dynamic_no_candidate` — a dynamic member call (`x.push()`) whose method
     * name matches NO method declared in this repository. The edge could only
     * ever have pointed at a `symbol:` pseudo-node, which is not a node, so no
     * query verb could reach it: `affected` and `path` resolve their seeds
     * against real nodes. It was 257 of 660 edges on this engine's own source.
     */
    suppressed_edge_counts: {
        dynamic_no_candidate: number;
        /**
         * Base edges a convention provider proved false and removed, per
         * provider id — e.g. a fluent route-builder call that name lookup had
         * bound to an unrelated in-repo method of the same name. Present only
         * when some count is non-zero.
         */
        contested_by_provider?: Record<string, number>;
    };
    /** Convention providers active in this build; present only when one was. */
    providers?: ActiveProviderRecord[];
    nodes: CodeNode[];
    edges: CodeEdge[];
}

/**
 * Bumped 3 → 4 by `road-to-a-graph-that-is-shipped` 3.2: the `Relation` union
 * gained `tests`, and the build pass now derives those edges. A cached sidecar
 * written at v3 carries per-file extracts that are still correct — `tests` is
 * derived from `imports`, not extracted — but `readSidecar` refuses a version
 * mismatch anyway, and that refusal is the right conservative default: the
 * alternative is a version check that has to reason about WHICH schema changes
 * a sidecar survives, which is a rule that rots silently the first time someone
 * adds an extractor field. A full re-extraction is the cost of being sure.
 *
 * Bumped 2 → 3 by `road-to-a-graph-that-is-shipped` 2.2: every `CodeEdge` now
 * carries `resolved_via` and `provider`. A cached sidecar written at v2 has
 * neither, so `--update` would reuse untagged edges beside tagged ones and
 * produce a graph whose `resolved_via` histogram silently under-counts —
 * exactly the mixed-graph failure the previous bump describes. `readSidecar`
 * refuses a version mismatch, which is what makes that impossible rather than
 * merely unlikely.
 *
 * Bumped 1 → 2 by `road-to-the-graph-that-lies-confidently`: `CodeNode.kind`
 * gained three members, `CodeGraph` gained `suppressed_edge_counts`, and the
 * per-file extract sidecar gained the import specifier. A cached sidecar
 * written at v1 carries raw edges with no `moduleSpecifier`, which would make
 * `--update` resolve imports the old (name-lookup) way for every unchanged
 * file — a silently mixed graph. `readSidecar` refuses a version mismatch, so
 * the bump is what makes that impossible rather than merely unlikely.
 *
 * Bumped 4 → 5 by `road-to-a-map-that-draws-itself` 1.3: same-file
 * same-name declarations now carry `@2`, `@3` suffixes, so a cache written
 * at v4 holds ids a v5 build would not produce.
 *
 * Bumped 5 → 6 by `road-to-graph-providers-for-every-stack` 2.1: framework
 * names left the schema (`orm-relation`, `contested_by_provider`), provider
 * edges carry `provider_id`, the graph records its active providers, and the
 * vocabulary gained `injects` / `di-binding`.
 */
export const SCHEMA_VERSION = 6;

/** Deterministic per-file byte cap — files above this become a SKIPPED node. */
export const MAX_FILE_BYTES = 1_000_000;

/** file-extension → language, launch set only. */
// `.vue`: a component's `<script>` is TypeScript or JavaScript; extract.ts blanks the
// template and style around it. (Outside the literal: esbuild keeps comments inside one.)
export const EXT_LANG: Readonly<Record<string, Lang>> = {
    '.php': 'php',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.mts': 'typescript',
    '.cts': 'typescript',
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.mjs': 'javascript',
    '.cjs': 'javascript',
    '.py': 'python',
    '.go': 'go',
    '.java': 'java',
    '.vue': 'typescript',
};

/** Grammar wasm filename per language (in `tree-sitter-wasms/out/`). */
export const GRAMMAR_WASM: Readonly<Record<Lang, string>> = {
    php: 'tree-sitter-php.wasm',
    typescript: 'tree-sitter-typescript.wasm',
    javascript: 'tree-sitter-javascript.wasm',
    python: 'tree-sitter-python.wasm',
    go: 'tree-sitter-go.wasm',
    java: 'tree-sitter-java.wasm',
};

/** The single ABI version the pinned grammar set is built against. */
export const EXPECTED_GRAMMAR_ABI = 14;
