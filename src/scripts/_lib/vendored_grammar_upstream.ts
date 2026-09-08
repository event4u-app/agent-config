/**
 * The vendored grammars' one anchor outside the manifest.
 *
 * WHAT THIS ANSWERS.
 *
 * `packed_binary_predicate.ts` verifies eleven conditions over
 * `src/config/packed-binary-manifest.json`, and every one of them is
 * manifest-internal: the manifest states a sha256 and the bytes are hashed
 * against it, so a single commit that edits both passes all eleven. The
 * `release/14.22.0` self-review finding `d1696732ac28` names exactly that gap.
 * This module closes it by comparing the vendored bytes against a source the
 * repository does not author: the `tree-sitter-wasms` release pinned in
 * `package-lock.json` and installed by `npm ci`.
 *
 * WHAT IT MAY CLAIM, AND WHAT IT MAY NOT.
 *
 * It MAY claim: the vendored bytes equal the bytes of the locked upstream
 * package, independent of the binary manifest's own self-description.
 *
 * It MUST NOT claim to be independent of all repository state, and it MUST NOT
 * claim to verify the grammars cryptographically against the registry
 * independent of local build state. It does neither. The chain is
 * registry tarball -> `npm ci` checks its sha512 against the lock's
 * `integrity` -> extracted bytes -> vendored bytes, and only the last link is
 * checked here. An attacker who edits `node_modules` after install defeats
 * this, and a lock entry that points at a hostile package defeats it earlier
 * still — that link is review's job, not a check's, because the lock is
 * human-readable text and the manifest is machine-only JSON.
 *
 * Both scoping sentences are the AI council's wording (2026-09-09, 2 seats,
 * unanimous on this question), kept verbatim so a later reader can tell the
 * boundary from an oversight.
 *
 * WHY IT REFUSES RATHER THAN SKIPS.
 *
 * An upstream comparison is trivially written so that it passes when the
 * upstream is absent, which is a green that verifies nothing — the exact shape
 * of the eleven conditions it is here to supplement. So an absent package, a
 * version that is not the locked one, an absent counterpart file, and an empty
 * claim set are all refusals, never passes.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { VERIFIABLE_KIND, type PackedBinaryManifest } from './packed_binary_predicate.js';

/**
 * The upstream this repository copies from. Hardcoded rather than derived: the
 * vendored set exists precisely because the package is NOT a runtime
 * dependency, so there is no dependency edge to read it off, and
 * `src/vendor/grammars/README.md` names the same string as the refresh source.
 */
export const UPSTREAM_PACKAGE = 'tree-sitter-wasms';

/** Where the upstream keeps its compiled grammars inside its own package. */
const UPSTREAM_GRAMMAR_SUBDIR = 'out';

/** A refusal — the anchor could not be established, so no verdict is honest. */
export class UpstreamAnchorRefusal extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'UpstreamAnchorRefusal';
    }
}

/** One vendored file compared against its upstream counterpart. */
export interface GrammarComparison {
    readonly vendoredPath: string;
    readonly upstreamPath: string;
    readonly vendoredSha256: string;
    readonly upstreamSha256: string;
    readonly equal: boolean;
}

export interface UpstreamAnchorVerdict {
    readonly lockedVersion: string;
    readonly lockedIntegrity: string;
    readonly installedVersion: string;
    readonly comparisons: readonly GrammarComparison[];
    /** Human-readable divergence lines. Empty iff every comparison is equal. */
    readonly divergences: readonly string[];
}

export interface UpstreamAnchorOptions {
    readonly repoRoot: string;
    /** Defaults to `<repoRoot>/node_modules/<UPSTREAM_PACKAGE>`. Fixture seam. */
    readonly upstreamPackageDir?: string;
    /** Defaults to `<repoRoot>/src/vendor/grammars`. Fixture seam. */
    readonly vendoredDir?: string;
    /** Defaults to the manifest at `<repoRoot>/src/config/…`. Fixture seam. */
    readonly manifest?: PackedBinaryManifest;
}

interface LockPin {
    readonly version: string;
    readonly integrity: string;
}

/**
 * The locked pin for the upstream, read from `package-lock.json`.
 *
 * `integrity` is not used to verify anything here — it is carried into the
 * verdict so the caller can print the anchor it is trusting, and its absence
 * is a refusal because a lock row without one pins a version and not bytes.
 */
export function readLockPin(repoRoot: string): LockPin {
    const lockPath = path.join(repoRoot, 'package-lock.json');
    if (!fs.existsSync(lockPath)) {
        throw new UpstreamAnchorRefusal(`no package-lock.json at ${lockPath} — there is no locked upstream to anchor to`);
    }
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8')) as {
        packages?: Record<string, { version?: string; integrity?: string }>;
    };
    const key = `node_modules/${UPSTREAM_PACKAGE}`;
    const row = lock.packages?.[key];
    if (row === undefined) {
        throw new UpstreamAnchorRefusal(`package-lock.json carries no \`${key}\` row — the vendored grammars have no locked source`);
    }
    if (typeof row.version !== 'string' || row.version.length === 0) {
        throw new UpstreamAnchorRefusal(`\`${key}\` in package-lock.json carries no version`);
    }
    if (typeof row.integrity !== 'string' || row.integrity.length === 0) {
        throw new UpstreamAnchorRefusal(
            `\`${key}\` in package-lock.json carries no \`integrity\` — the row pins a version but not bytes, so \`npm ci\` verifies nothing for it`,
        );
    }
    return { version: row.version, integrity: row.integrity };
}

function readManifest(repoRoot: string): PackedBinaryManifest {
    const p = path.join(repoRoot, 'src', 'config', 'packed-binary-manifest.json');
    if (!fs.existsSync(p)) throw new UpstreamAnchorRefusal(`no packed-binary manifest at ${p}`);
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as PackedBinaryManifest;
    if (!Array.isArray(raw.entries)) throw new UpstreamAnchorRefusal(`packed-binary-manifest: entries must be an array (${p})`);
    return raw;
}

function sha256(file: string): string {
    return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

/**
 * Compare every vendored grammar the manifest admits against the locked
 * upstream's copy of the same filename.
 *
 * Throws `UpstreamAnchorRefusal` when the anchor cannot be established at all;
 * returns a verdict whose `divergences` is non-empty when it can be established
 * and the bytes differ. The two are deliberately different outcomes: a refusal
 * says "this was not checked", a divergence says "this was checked and is
 * wrong", and collapsing them is how a check becomes a permanent green.
 */
export function verifyVendoredGrammarsAgainstUpstream(options: UpstreamAnchorOptions): UpstreamAnchorVerdict {
    const { repoRoot } = options;
    const upstreamDir = options.upstreamPackageDir ?? path.join(repoRoot, 'node_modules', UPSTREAM_PACKAGE);
    const vendoredDir = options.vendoredDir ?? path.join(repoRoot, 'src', 'vendor', 'grammars');
    const manifest = options.manifest ?? readManifest(repoRoot);

    const pin = readLockPin(repoRoot);

    const claims = manifest.entries.filter((e) => e.kind === VERIFIABLE_KIND);
    if (claims.length === 0) {
        throw new UpstreamAnchorRefusal(
            `the manifest admits no \`${VERIFIABLE_KIND}\` entry — nothing was compared, and reporting that as a pass would be a green over an empty corpus`,
        );
    }

    const upstreamPkgJson = path.join(upstreamDir, 'package.json');
    if (!fs.existsSync(upstreamPkgJson)) {
        throw new UpstreamAnchorRefusal(
            `${UPSTREAM_PACKAGE} is not installed at ${upstreamDir} — run \`npm ci\`. The vendored bytes were NOT verified; an absent upstream is a refusal, never a pass`,
        );
    }
    const installed = JSON.parse(fs.readFileSync(upstreamPkgJson, 'utf-8')) as { version?: string };
    if (installed.version !== pin.version) {
        throw new UpstreamAnchorRefusal(
            `installed ${UPSTREAM_PACKAGE} is ${String(installed.version)} but package-lock.json pins ${pin.version} — comparing against an unlocked tree would anchor to nothing`,
        );
    }

    const comparisons: GrammarComparison[] = [];
    const divergences: string[] = [];

    for (const entry of claims) {
        const vendoredPath = path.join(vendoredDir, path.basename(entry.path));
        const upstreamPath = path.join(upstreamDir, UPSTREAM_GRAMMAR_SUBDIR, path.basename(entry.path));
        if (!fs.existsSync(vendoredPath)) {
            throw new UpstreamAnchorRefusal(`the manifest admits ${entry.path} but ${vendoredPath} does not exist`);
        }
        if (!fs.existsSync(upstreamPath)) {
            throw new UpstreamAnchorRefusal(
                `${entry.path} has no counterpart at ${upstreamPath} — the locked upstream does not carry this grammar, so this file has no anchor`,
            );
        }
        const vendoredSha256 = sha256(vendoredPath);
        const upstreamSha256 = sha256(upstreamPath);
        const equal = vendoredSha256 === upstreamSha256;
        comparisons.push({ vendoredPath, upstreamPath, vendoredSha256, upstreamSha256, equal });
        if (!equal) {
            divergences.push(
                `${entry.path}: vendored sha256 ${vendoredSha256} != upstream ${upstreamSha256} (${UPSTREAM_PACKAGE}@${pin.version})`,
            );
        }
    }

    return {
        lockedVersion: pin.version,
        lockedIntegrity: pin.integrity,
        installedVersion: pin.version,
        comparisons,
        divergences,
    };
}
