import { createHash } from 'node:crypto';

/**
 * table_fingerprint — the content fingerprint a compiled plumbing table is
 * validated against.
 *
 * Extracted from `dispatch_hook._manifest_fingerprint` so a SECOND table
 * (`host_lowering.yaml`) can use the same helper without importing the
 * dispatcher: `dispatch_hook` → `host_semantics` → `host_lowering` is a live
 * import chain, so the reverse edge would be a cycle.
 *
 * DELIBERATELY CONTENT-DERIVED, NOT MTIME. The first version of the manifest
 * fast path compared mtimes and that was a measured defect, not a theoretical
 * one: on a fresh `actions/checkout` both files carry the checkout timestamp in
 * whatever order git wrote them, so whether the optimisation applied at all was
 * a coin flip — it won on a PR run (p95 129 ms) and lost on the trunk
 * (p95 186 ms) for the same commit. A fingerprint is deterministic wherever the
 * tree came from.
 *
 * SHA-256 over the UTF-8 bytes, plus the length. This replaced an FNV-1a loop
 * in step 3.1 of `road-to-a-kernel-that-guards-its-plumbing`, and the reason
 * the old one existed no longer holds. Its header said a cryptographic hash was
 * refused because `require('node:crypto')` costs 8 ms of process start, which
 * is most of what the precompiled table saves. Both halves were re-measured
 * against the tree as it now stands, and both had gone stale:
 *
 * - The module is ALREADY LOADED. `dist/hooks/dispatch.js` carries 23
 *   top-level `import … from "node:crypto"` statements from other parts of the
 *   graph, so the 8 ms is paid on every dispatch whether this function uses it
 *   or not. There is no startup cost left to avoid.
 * - SHA-256 is FASTER here, not slower: 0.106 ms against 0.113 ms over the
 *   99,792-byte manifest, because Node's digest is native and the FNV-1a loop
 *   was 99,792 interpreted `charCodeAt` calls.
 *
 * The change is therefore free, and it buys the property the old comment had to
 * disclaim: this now guards against a CRAFTED sibling as well as a stale one,
 * which is what a file called a fingerprint should mean when the roadmap around
 * it is about integrity.
 *
 * Producer and both consumers import THIS function — `compile_hook_manifest`
 * writes the value, `dispatch_hook` and `host_lowering` check it — so the
 * algorithm can never drift between the two sides. A mismatch is not a failure
 * either way: the reader falls through to parsing the YAML source, which is
 * correct and merely slower.
 */
export function tableFingerprint(text: string): string {
    const digest = createHash('sha256').update(text, 'utf-8').digest('hex');
    return `${digest}:${String(text.length)}`;
}
