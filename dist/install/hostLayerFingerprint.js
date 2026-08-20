/**
 * Deterministic content fingerprint of a host artefact layer.
 *
 * ## Why a fingerprint and not a version number
 *
 * The single-delivery partition is a *removal*: after it, `task generate-tools`
 * writes 16 rules and zero skills into `<repo>/.claude/` and every other
 * artefact is delivered ONLY by the host-global layer. That removes the build's
 * own repair path — regeneration can no longer heal a stale global layer,
 * because it stops writing the affected files at all.
 *
 * A package version proves *which installer claims to have written* the host
 * directory. It does not prove that the directory holds the artefacts this
 * checkout is about to omit. Measured on the maintainer machine 2026-08-20:
 * `package.json` and the published release both read `14.6.0`, while **153
 * skills existed only in the project layer** and 37 only in the global one. A
 * version-equality predicate would have authorised the partition there and
 * silently dropped 153 skills. So the predicate compares content.
 *
 * ## Cost — measured, and the earlier figure was wrong
 *
 * A prior revision of the blocker recorded 5.85 s per generation for a
 * content comparison and used that number to argue the approach was too
 * expensive. That figure was a **shell artefact**: it spawned one `cat` per
 * file. Re-measured in Node on the same tree: **61 ms** over 664 source files,
 * **103 ms** over 1019 host files. The comparison is cheap; the 5.85 s never
 * described this mechanism.
 *
 * ## Contract
 *
 * Side-effect-free, no CLI entry, no `process.exit` — this module ships inside
 * the consumer installer bundle, same constraint as `ruleInScope.ts`. Keep it
 * that way.
 */
import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
/**
 * Fingerprint wire version. Bump when the digest input changes shape, so an
 * old lockfile compares unequal instead of comparing wrong.
 */
export const FINGERPRINT_SCHEMA = 1;
/** Files under `dir`, recursively, sorted by path — deterministic order. */
function collectFiles(dir) {
    const out = [];
    const walk = (d) => {
        let entries;
        try {
            entries = fs.readdirSync(d, { withFileTypes: true });
        }
        catch {
            return; // absent or unreadable → contributes nothing
        }
        const sorted = [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
        for (const e of sorted) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                walk(p);
            }
            else if (e.isFile()) {
                out.push(p);
            }
            // Symlinks are deliberately skipped: the project layer symlinks into
            // `dist/`, the global layer holds real files, and following links
            // would make two layers of identical CONTENT fingerprint differently
            // depending on which side was read.
        }
    };
    walk(dir);
    return out.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
/**
 * Content fingerprint over the given layers.
 *
 * The digest covers, per file, its **layer-relative** path and its bytes — so a
 * rename, a deletion, an addition, and an edit each change it, while the
 * absolute location of the layer does not. Layers are folded in the order
 * given; pass them in a stable order.
 *
 * An absent layer root is not an error: it contributes zero files. That makes
 * the fingerprint of "nothing installed" well-defined and unequal to any real
 * layer, which is what the fail-safe branch of the partition predicate wants.
 */
export function fingerprintLayers(layers) {
    const h = createHash('sha256');
    h.update(`v${FINGERPRINT_SCHEMA}\0`);
    for (const layer of layers) {
        h.update(`layer:${layer.label}\0`);
        for (const file of collectFiles(layer.root)) {
            h.update(path.relative(layer.root, file));
            h.update('\0');
            try {
                h.update(fs.readFileSync(file));
            }
            catch {
                // A file that vanished between listing and reading is a partial
                // install by definition. Fold a marker rather than throwing, so
                // the digest differs from a complete layer instead of aborting
                // the caller.
                h.update('\0unreadable\0');
            }
            h.update('\0');
        }
    }
    return h.digest('hex');
}
/**
 * The host-global artefact layers the partition depends on, in a FIXED order.
 *
 * **This is the one definition, and it has to be.** The installer fingerprints
 * what it wrote; the build fingerprints what it finds and compares. Two inline
 * lists would drift — and a drift here does not fail loudly, it makes the
 * partition permanently unreachable while every fail-safe branch reports a
 * plausible reason. Import this; never re-list the layers.
 *
 * Only `claude-code` is covered, and the narrowness is the measurement rather
 * than an omission: the 110-rule / 203,873-token duplication ADR-236 partitions
 * was measured on `~/.claude/`. Widening this list widens what must be verified
 * before a single artefact is withheld, so it is a deliberate addition.
 *
 * `commands` is in the list because the project layer writes skills AND commands
 * into ONE directory (`generate_claude_commands` targets `CLAUDE_SKILLS_DIR`)
 * while the host layer keeps them apart in `~/.claude/skills` and
 * `~/.claude/commands`. Emptying the project directory withholds commands too,
 * so commands must be part of what gets verified first. Measured 2026-08-20:
 * 414 project entries against 298 host skills plus 93 host commands.
 */
export function hostLayerInputs(userHome) {
    const claude = path.join(userHome, '.claude');
    return [
        { label: 'rules', root: path.join(claude, 'rules') },
        { label: 'skills', root: path.join(claude, 'skills') },
        { label: 'commands', root: path.join(claude, 'commands') },
    ];
}
//# sourceMappingURL=hostLayerFingerprint.js.map