// Phase-6 F1 — server identity metadata.
//
// Three values surfaced at boot via stderr (`run_stdio` boot log):
//
// - **server version** — wire-surface SemVer in `__init__.py::__version__`.
//   Hand-bumped when the MCP-side surface (prompts/resources/tools shape,
//   protocol semantics) changes.
// - **package version** — read from `package.json::version` at boot.
//   Build-ID semantics; bumps with every release of the agent-config bundle.
// - **skill-set signature** — SHA-256 hex (first 12 chars) over the joined
//   `PromptCache._signature` + `ResourceCache._signature` tuples
//   (`(uri, mtime)` pairs, already sorted). Content fingerprint, not a
//   version — auto-derived, never hand-edited.
//
// Wire-surface caveat: the MCP SDK constructs `serverInfo.Implementation`
// internally with a fixed field set (`name`, `version`, `websiteUrl`,
// `icons`), so the package version and skill-set signature cannot be
// attached to `serverInfo._meta` without subclassing the session.
// Stderr is the canonical surface in Phase 6; a wire-surface lift can
// follow once the SDK supports it.
//
// TS twin of metadata.py (py2ts Phase 8). Mirrors the full public surface:
//   - Signature type, read_package_version, compute_skill_set_signature,
//     boot_log_line.
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// `(uri, mtime)` pairs. Mirrors Python `Sequence[tuple[str, float]]`.
export type Signature = ReadonlyArray<readonly [string, number]>;

/** Return `package.json::version`, or `"unknown"` if unreadable. */
export function read_package_version(root: string): string {
    const p = path.join(root, 'package.json');
    let data: Record<string, unknown>;
    try {
        data = JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, unknown>;
    } catch {
        return 'unknown';
    }
    const version = data.version;
    if (typeof version !== 'string' || !version) {
        return 'unknown';
    }
    return version;
}

/**
 * SHA-256 hex (12 chars) over the concatenated `(uri, mtime)` tuples.
 *
 * Deterministic across processes for identical inputs. Changes when
 * any tracked file's path-set or mtime changes. Inputs are taken as-is
 * (callers pass already-sorted cache signatures); the hash is taken
 * over the joined repr to keep the framing unambiguous.
 */
export function compute_skill_set_signature(...signatures: Signature[]): string {
    const hasher = crypto.createHash('sha256');
    for (const sig of signatures) {
        for (const [uri, mtime] of sig) {
            hasher.update(Buffer.from(uri, 'utf-8'));
            hasher.update(Buffer.from([0x00]));
            // Python: f"{mtime:.6f}".encode("ascii") — fixed 6 decimals.
            hasher.update(Buffer.from(mtime.toFixed(6), 'ascii'));
            hasher.update(Buffer.from([0x1e])); // record separator
        }
        hasher.update(Buffer.from([0x1d])); // group separator between caches
    }
    return hasher.digest('hex').slice(0, 12);
}

/** Single stderr line surfacing all three identity values at boot. */
export function boot_log_line(options: {
    server_version: string;
    package_version: string;
    skill_set_signature: string;
}): string {
    const { server_version, package_version, skill_set_signature } = options;
    return (
        `mcp-server: identity serverVersion=${server_version} ` +
        `packageVersion=${package_version} ` +
        `skillSetSignature=${skill_set_signature}`
    );
}
