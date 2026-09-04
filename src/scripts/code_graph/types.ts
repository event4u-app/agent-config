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
export type Lang = 'php' | 'typescript' | 'javascript';

/** Same scale as `discovery_graph.ts::EdgeConfidence` (reused, not forked). */
export type EdgeConfidence = 'EXTRACTED' | 'INFERRED' | 'AMBIGUOUS';

/** Relations the extractor emits. */
export type Relation = 'calls' | 'imports' | 'uses' | 'inherits' | 'member';

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
    kind: 'file' | 'class' | 'interface' | 'trait' | 'function' | 'method' | 'constant' | 'type' | 'enum' | 'skipped';
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
    suppressed_edge_counts: { dynamic_no_candidate: number };
    nodes: CodeNode[];
    edges: CodeEdge[];
}

/**
 * Bumped 1 → 2 by `road-to-the-graph-that-lies-confidently`: `CodeNode.kind`
 * gained three members, `CodeGraph` gained `suppressed_edge_counts`, and the
 * per-file extract sidecar gained the import specifier. A cached sidecar
 * written at v1 carries raw edges with no `moduleSpecifier`, which would make
 * `--update` resolve imports the old (name-lookup) way for every unchanged
 * file — a silently mixed graph. `readSidecar` refuses a version mismatch, so
 * the bump is what makes that impossible rather than merely unlikely.
 */
export const SCHEMA_VERSION = 2;

/** Deterministic per-file byte cap — files above this become a SKIPPED node. */
export const MAX_FILE_BYTES = 1_000_000;

/** file-extension → language, launch set only. */
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
};

/** Grammar wasm filename per language (in `tree-sitter-wasms/out/`). */
export const GRAMMAR_WASM: Readonly<Record<Lang, string>> = {
    php: 'tree-sitter-php.wasm',
    typescript: 'tree-sitter-typescript.wasm',
    javascript: 'tree-sitter-javascript.wasm',
};

/** The single ABI version the pinned grammar set is built against. */
export const EXPECTED_GRAMMAR_ABI = 14;
