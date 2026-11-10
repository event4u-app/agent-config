/**
 * The version of the call surface between the `switch_link` chunk and the two
 * bundles that load it (`quota_notice` and the dispatch bundle's Stop path).
 * Each side compiles its own copy; the chunk answers only a caller whose copy
 * matches, so a chunk from another build is not called even when its digest
 * sidecar matches it. Raise it whenever the signature or meaning of
 * `switchTurn` or `checkpointBeforeMove` changes.
 */
export const SWITCH_LINK_API = 1;
