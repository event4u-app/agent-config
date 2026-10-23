/**
 * The provider seam (ADR-298): everything a framework links by convention
 * reaches the graph through a registered provider, never through a call the
 * build hard-wires. The core imports providers only through `./index.ts`.
 */
import type { SourceFile } from '../build.js';
import type { FileRole } from '../map_model.js';
import type { ResolutionConfig } from '../resolution_tiers.js';
import type { CodeEdge, CodeNode } from '../types.js';

/**
 * What a provider may read to decide whether it applies: manifests and marker
 * files, never file suffixes — `.php` does not mean any one framework.
 */
export interface ProjectProbe {
    /** Manifest files by repo-relative POSIX path → text. */
    manifests: ReadonlyMap<string, string>;
    /** Repo-relative paths of marker files that carry no text worth reading (an entry script). */
    markers: ReadonlySet<string>;
    /** Every project path, sorted, code or not (templates, assets); empty when unknown. */
    paths: readonly string[];
}

export const EMPTY_PROBE: ProjectProbe = { manifests: new Map(), markers: new Set(), paths: [] };

export interface ProviderInput {
    files: readonly SourceFile[];
    baseNodes: readonly CodeNode[];
    /** The graph's edges so far, read-only (import bindings, for resolving a handler name). */
    baseEdges: readonly CodeEdge[];
    /** Every project path under the provider's roots, code or not (templates). */
    paths: readonly string[];
    resolution: ResolutionConfig;
    /** Package roots the provider was detected in; `''` is the repository root. */
    roots: readonly string[];
}

export interface ProviderResult {
    nodes: CodeNode[];
    edges: CodeEdge[];
    /** Base edges the provider proves false; applied only when it drew something. */
    contest?: (e: CodeEdge) => boolean;
}

export interface ConventionProvider {
    id: string;
    /** Basenames of marker files whose presence the probe should record (an entry script). */
    markers?: readonly string[];
    /** Package roots this provider applies to; empty when it does not. */
    detect(probe: ProjectProbe): string[];
    build(input: ProviderInput): ProviderResult;
    /** A role the map gives a file by this provider's conventions. */
    roleOf?(path: string): FileRole | undefined;
}
