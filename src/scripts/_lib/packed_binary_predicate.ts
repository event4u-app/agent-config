/**
 * Binary-payload eligibility — the mechanically verified predicate that
 * reopened the `binary` class.
 *
 * ## What this is, said plainly
 *
 * `f573d628c` closed `binary` as a hard zero on 2026-09-07. This REOPENS it,
 * 24 hours later, and that IS A WEAKENING OF A CONTROL. An AI council
 * (2026-09-08, 2 seats, unanimous, deep tier) authorised it, and one seat
 * explicitly refused the framing that this is merely "correcting an
 * over-generalisation" — that distinction is cosmetic. The control was closed
 * for the wrong reason, so reopening it is a weakening: justified, and still a
 * weakening. It is written down here rather than softened because a control
 * that gets quietly relaxed is worse than one that never existed.
 *
 * ## Why the closure was wrong
 *
 * Decision A over-generalised. Its reasoning was "the three observed binaries
 * are unused, therefore no binary can ever be required" — an invalid
 * generalisation from an observed sample to a universal rule. The vendored
 * tree-sitter grammars are the direct counterexample: bytes the production path
 * loads and the engine requires. A textual placeholder was lossless for three
 * PNGs nothing decoded; for a grammar it does not degrade a fixture, it breaks
 * the engine.
 *
 * ## What replaces the hard zero — and what does NOT
 *
 * Not a prose exception. A binary is admitted only when EVERY condition below
 * is verified mechanically, on the bytes that are actually in the tarball:
 *
 *   1. exactly one manifest entry for the path
 *   2. no wildcard or directory grant anywhere in the manifest
 *   3. the packed tarball really contains the path
 *   4. sha256(bytes) equals the manifest hash
 *   5. size equals the manifest size
 *   6. kind is `tree-sitter-wasm-grammar`
 *   7. WASM magic and version are valid
 *   8. the PRODUCTION loader reports the manifest's grammar_id
 *   9. the PRODUCTION loader reports the manifest's ABI
 *  10. a defined invalid-header mutation of the bytes is REJECTED
 *  11. a defined unsupported-ABI expectation is REJECTED
 *
 * 8 and 9 go through `probeGrammarFile`, the engine's own loader, deliberately:
 * a second implementation inside the gate could accept bytes the engine
 * rejects, which is exactly the gap that would let a broken grammar ship while
 * the gate called it valid.
 *
 * 10 and 11 run on every invocation, not in a separate test, because a
 * predicate whose refusals nobody exercises is a predicate nobody has checked.
 *
 * ## `archive` is NOT reopened
 *
 * This collision produced evidence about grammars and none whatsoever about
 * archives. `archive` stays a hard zero with no manifest path, and this module
 * offers none.
 *
 * ## Eligibility never touches the measurement
 *
 * The gate reports `observed` as the true count and byte total on every run.
 * Compliance is `observed <= allowed`, where `allowed` is the number of entries
 * that passed every condition above — never `observed` minus something excused.
 * A file that fails one condition lowers `allowed`; it never disappears from
 * `observed`.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** One manifest row. Path-exact; `why` is documentation, never a condition. */
export interface PackedBinaryEntry {
    readonly path: string;
    readonly sha256: string;
    readonly size: number;
    readonly kind: string;
    readonly grammar_id: string;
    readonly abi: number;
    readonly why?: string;
}

export interface PackedBinaryManifest {
    readonly schema_version: number;
    readonly entries: readonly PackedBinaryEntry[];
}

/** The one kind this predicate knows how to verify. */
export const VERIFIABLE_KIND = 'tree-sitter-wasm-grammar';

/** What the production loader reported for a file. */
export interface GrammarProbe {
    readonly abi: number;
    readonly grammar_id: string;
}

/** A per-file verdict, with the failing condition named. */
export interface EligibilityVerdict {
    readonly path: string;
    readonly eligible: boolean;
    /** Every condition that failed, in predicate order. Empty iff eligible. */
    readonly failures: readonly string[];
}

/** WASM preamble: `\0asm` followed by little-endian version 1. */
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d] as const;
const WASM_VERSION = [0x01, 0x00, 0x00, 0x00] as const;

/**
 * Condition 7, on its own so the header mutation in condition 10 has something
 * specific to defeat.
 */
export function wasmMagicAndVersionValid(bytes: Uint8Array): boolean {
    if (bytes.length < 8) return false;
    for (let i = 0; i < 4; i += 1) if (bytes[i] !== WASM_MAGIC[i]) return false;
    for (let i = 0; i < 4; i += 1) if (bytes[4 + i] !== WASM_VERSION[i]) return false;
    return true;
}

/**
 * The DEFINED invalid-header mutation for condition 10.
 *
 * One byte of the magic, flipped. Deliberately NOT `corrupt(bytes)`: arbitrary
 * corruption can land in a custom section and leave a still-valid module, or
 * hit padding and change nothing, so a test built on it can pass while proving
 * nothing. This targets a property the predicate actually validates.
 */
export function definedInvalidHeaderMutation(bytes: Uint8Array): Uint8Array {
    const out = Uint8Array.from(bytes);
    if (out.length > 1) out[1] = (out[1] as number) ^ 0xff;
    return out;
}

/**
 * The DEFINED unsupported-ABI expectation for condition 11.
 *
 * The ABI is not a byte at a known offset — it is what the loader reports after
 * parsing the module — so this mutates the EXPECTATION rather than the bytes:
 * an entry claiming an ABI the grammar does not have must be refused. Same
 * validated property, targeted from the side where it can be stated exactly.
 */
export function definedUnsupportedAbiEntry(entry: PackedBinaryEntry): PackedBinaryEntry {
    return { ...entry, abi: entry.abi + 1 };
}

/** Condition 2, evaluated over the whole manifest rather than per file. */
export function wildcardGrants(manifest: PackedBinaryManifest): string[] {
    return manifest.entries
        .filter((e) => e.path.includes('*') || e.path.includes('?') || e.path.endsWith('/'))
        .map((e) => e.path);
}

/** Paths carrying more than one row — condition 1's uniqueness half. */
export function duplicatePaths(manifest: PackedBinaryManifest): string[] {
    const seen = new Map<string, number>();
    for (const e of manifest.entries) seen.set(e.path, (seen.get(e.path) ?? 0) + 1);
    return [...seen.entries()].filter(([, n]) => n > 1).map(([p]) => p);
}

/**
 * Evaluate every condition for one packed file.
 *
 * `probe` is injected so the caller decides how the production loader is
 * reached — in the gate it is a child process, in a test it can be a stub that
 * returns a wrong ABI. `null` means the loader could not answer, which fails
 * conditions 8 and 9 rather than passing them by default.
 */
export function evaluateEntry(options: {
    readonly filePath: string;
    readonly packedPaths: ReadonlySet<string>;
    readonly manifest: PackedBinaryManifest;
    readonly bytes: Uint8Array | null;
    readonly probe: GrammarProbe | null;
}): EligibilityVerdict {
    const { filePath, packedPaths, manifest, bytes, probe } = options;
    const failures: string[] = [];

    const rows = manifest.entries.filter((e) => e.path === filePath);
    if (rows.length === 0) failures.push('no manifest entry for this path');
    if (rows.length > 1) failures.push('more than one manifest entry for this path');
    const wild = wildcardGrants(manifest);
    if (wild.length > 0) failures.push(`manifest carries wildcard or directory grants: ${wild.join(', ')}`);
    if (!packedPaths.has(filePath)) failures.push('path is not in the packed tarball');

    const entry = rows[0];
    if (entry === undefined) return { path: filePath, eligible: false, failures };

    if (bytes === null) {
        failures.push('bytes could not be read');
        return { path: filePath, eligible: false, failures };
    }
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (digest !== entry.sha256) failures.push(`sha256 mismatch: ${digest} != ${entry.sha256}`);
    if (bytes.length !== entry.size) failures.push(`size mismatch: ${String(bytes.length)} != ${String(entry.size)}`);
    if (entry.kind !== VERIFIABLE_KIND) failures.push(`kind is not ${VERIFIABLE_KIND}: ${entry.kind}`);
    if (!wasmMagicAndVersionValid(bytes)) failures.push('WASM magic or version invalid');

    if (probe === null) {
        failures.push('the production loader could not read this file');
    } else {
        if (probe.grammar_id !== entry.grammar_id) {
            failures.push(`grammar_id mismatch: loader says ${probe.grammar_id}, manifest says ${entry.grammar_id}`);
        }
        if (probe.abi !== entry.abi) {
            failures.push(`ABI mismatch: loader says ${String(probe.abi)}, manifest says ${String(entry.abi)}`);
        }
    }

    // Conditions 10 and 11 — the predicate refusing what it must refuse. Run
    // here, on every invocation, so a refusal path is never merely asserted in
    // a test somebody can skip.
    if (wasmMagicAndVersionValid(definedInvalidHeaderMutation(bytes))) {
        failures.push('self-check failed: a defined invalid-header mutation was NOT rejected');
    }
    if (probe !== null && probe.abi === definedUnsupportedAbiEntry(entry).abi) {
        failures.push('self-check failed: a defined unsupported-ABI expectation was NOT rejected');
    }

    return { path: filePath, eligible: failures.length === 0, failures };
}

/** Read and shape-check the manifest. Throws rather than degrading to empty. */
export function loadManifest(repoRoot: string): PackedBinaryManifest {
    const p = path.join(repoRoot, 'src', 'config', 'packed-binary-manifest.json');
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as PackedBinaryManifest;
    if (!Array.isArray(raw.entries)) throw new Error(`packed-binary-manifest: entries must be an array (${p})`);
    return raw;
}
