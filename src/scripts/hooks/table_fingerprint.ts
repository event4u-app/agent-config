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
 * FNV-1a over UTF-16 code units, plus the length. Not a cryptographic hash and
 * not trying to be: it guards against a STALE sibling, never against a crafted
 * one. A plumbing source an attacker can write is already a plumbing-write
 * violation, which `block_plumbing_writes` is the control for.
 */
export function tableFingerprint(text: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i += 1) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return `${h.toString(16)}:${String(text.length)}`;
}
