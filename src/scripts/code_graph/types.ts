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
    kind: 'file' | 'class' | 'interface' | 'trait' | 'function' | 'method' | 'skipped';
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
    nodes: CodeNode[];
    edges: CodeEdge[];
}

export const SCHEMA_VERSION = 1;

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
