/**
 * The open-SVG-obligation reading — step 2.1(b) of `road-to-svg-review-followups`.
 *
 * THE HOLE THIS CLOSES, which a review found and a reading confirmed. A turn
 * that edits an `.svg` and then runs `ui:render --profile asset` looks, to the
 * turn-end gate, like a turn that verified its work. It is not: on a machine
 * with no Playwright that command rendered nothing, and until 2026-10-11 it
 * also exited 0. Teaching `isVerificationCommand` the command would have made
 * the hole worse rather than better — the transcript path never sees an exit
 * code (`turn_end_gate_hook.ts:764` matches a command and stops), so a bare
 * call would have discharged the obligation on both paths.
 *
 * So the detector reads the RENDER, never the call. An `.svg` the turn edited
 * is discharged by exactly one of two records:
 *
 *   1. an asset manifest with `verification: "verified"` whose `asset.digest`
 *      equals the file's CURRENT digest; or
 *   2. an asset manifest with `reason: "renderer-absent"` whose `static` block
 *      carries `errors: 0` on that same digest — reported as `static-only`.
 *
 * Path 2 is why a consumer without Playwright is not refused forever on a gate
 * declared `blocking`. A `render-failed` manifest discharges NOTHING: a
 * renderer that ran and failed is a real failure, not a capability fact.
 *
 * FOUR PRECISIONS, each from a third review and each closing a way the gate
 * would otherwise refuse honest work or accept dishonest work:
 *
 *   (ii)  A planted fixture opens no obligation. `tests/design-artifacts/
 *         fixtures/**` and `tests/design-artifacts/scenarios/**` carry errors
 *         ON PURPOSE and can never reach `verified`, so without this every turn
 *         that touches one would be refused on a blocking gate. By PATH, not by
 *         an inline ignore marker — a marker would hide the planted error from
 *         the very test that has to find it.
 *   (iii) A manifest counts only if THIS turn's render wrote it. Otherwise an
 *         agent could write a manifest by hand, digest included, and discharge
 *         its own obligation. The caller supplies `renderObserved`, which the
 *         record path proves from an invocation and the transcript path from a
 *         matching `ui:render --profile asset` Bash call after the edit.
 *   (iv)  A deleted `.svg` opens no obligation — it has no current digest, so
 *         there is nothing a render could be bound to.
 *
 * Its own module rather than another 200 lines inside the gate: the gate ships
 * in a byte-capped bundle, and a separate module is the unit whose cost can be
 * measured and, if it ever has to be, removed.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Where `ui:render` writes. One copy of the path, shared with the CLI by value. */
export const RENDER_REL = path.join('agents', 'runtime', 'state', 'render');

/**
 * Paths whose `.svg` files are planted on purpose. Precision (ii).
 *
 * Compared against a forward-slash form of the path so the list reads the same
 * on every platform and a Windows-shaped tool call is not silently exempt.
 */
export const PLANTED_PREFIXES: readonly string[] = [
    'tests/design-artifacts/fixtures/',
    'tests/design-artifacts/scenarios/',
];

export type DischargeKind = 'verified' | 'static-only';

export interface SvgObligation {
    /** Repo-relative, forward slashes — the evidence span a refusal quotes. */
    file: string;
    /** Why it is still open, in the words the refusal uses. */
    reason: string;
}

export interface SvgDischarge {
    file: string;
    kind: DischargeKind;
}

export interface SvgObligationReading {
    open: SvgObligation[];
    discharged: SvgDischarge[];
}

/** The shape this reads out of a manifest. Deliberately partial. */
interface AssetManifestish {
    profile?: unknown;
    verification?: unknown;
    reason?: unknown;
    asset?: { digest?: unknown } | undefined;
    static?: { errors?: unknown; digest?: unknown } | undefined;
}

const rel = (p: string): string => p.split(path.sep).join('/');

export function isPlantedFixture(relPath: string): boolean {
    const norm = rel(relPath).replace(/^\.\//, '');
    return PLANTED_PREFIXES.some((prefix) => norm.startsWith(prefix));
}

/** Every asset manifest currently under the render directory. */
export function readAssetManifests(root: string): AssetManifestish[] {
    const dir = path.join(root, RENDER_REL);
    let entries: string[];
    try {
        entries = fs.readdirSync(dir);
    } catch {
        return [];
    }
    const out: AssetManifestish[] = [];
    for (const name of entries) {
        let raw: string;
        try {
            raw = fs.readFileSync(path.join(dir, name, 'manifest.json'), 'utf8');
        } catch {
            continue;
        }
        try {
            const parsed = JSON.parse(raw) as AssetManifestish;
            if (parsed.profile === 'asset') out.push(parsed);
        } catch {
            // An unreadable manifest discharges nothing, which is the same
            // verdict as an absent one and the safe direction for a gate.
        }
    }
    return out;
}

/**
 * How a digest is discharged by the manifests on disk, or `null`.
 *
 * `verified` wins over `static-only` when both exist: the stronger record is
 * the one the report should name.
 */
export function dischargeFor(manifests: readonly AssetManifestish[], digest: string): DischargeKind | null {
    let staticOnly = false;
    for (const m of manifests) {
        if (m.verification === 'verified' && m.asset?.digest === digest) return 'verified';
        if (m.reason === 'renderer-absent' && m.static?.digest === digest && m.static.errors === 0) {
            staticOnly = true;
        }
    }
    return staticOnly ? 'static-only' : null;
}

export interface SvgObligationInputs {
    /** Repo-relative paths the turn EDITED, in order, `.svg` and otherwise. */
    editedPaths: readonly string[];
    /**
     * Whether this turn is known to have run an asset render AFTER its last
     * edit. Precision (iii): a manifest written by hand discharges nothing, and
     * this detector cannot tell one from a rendered one by reading it.
     */
    renderObserved: boolean;
}

/**
 * The reading. Pure apart from reading the files it is asked about, so the
 * eight cases the roadmap names can be exercised without a hook run.
 */
export function readSvgObligations(root: string, inputs: SvgObligationInputs): SvgObligationReading {
    const open: SvgObligation[] = [];
    const discharged: SvgDischarge[] = [];
    const seen = new Set<string>();
    let manifests: AssetManifestish[] | null = null;

    for (const raw of inputs.editedPaths) {
        if (!/\.svg$/i.test(raw)) continue;
        const relPath = rel(raw);
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        // (ii) planted fixtures carry errors on purpose.
        if (isPlantedFixture(relPath)) continue;

        // (iv) a deleted file has no current digest, so nothing could be bound
        // to it and no render could ever discharge it.
        const abs = path.isAbsolute(raw) ? raw : path.join(root, relPath);
        let content: string;
        try {
            content = fs.readFileSync(abs, 'utf8');
        } catch {
            continue;
        }
        const digest = crypto.createHash('sha256').update(content).digest('hex');

        // (iii) The manifests are only consulted once a render was observed.
        // Reading them first and then discarding the verdict would make the
        // ordering look like a performance detail rather than the rule.
        if (!inputs.renderObserved) {
            open.push({
                file: relPath,
                reason:
                    'no `ui:render --profile asset` ran after the edit, so no manifest on disk can describe ' +
                    'these bytes — a manifest written by any other route discharges nothing',
            });
            continue;
        }
        manifests ??= readAssetManifests(root);
        const kind = dischargeFor(manifests, digest);
        if (kind === null) {
            open.push({
                file: relPath,
                reason:
                    'no asset manifest matches this file\'s current digest — a render that is `verified`, or a ' +
                    '`renderer-absent` one whose static witness reports 0 errors on the same digest, discharges it',
            });
            continue;
        }
        discharged.push({ file: relPath, kind });
    }
    return { open, discharged };
}

/**
 * Does this Bash command invoke the asset render?
 *
 * Narrow on purpose, and NOT added to `isVerificationCommand`: matching here
 * makes the command a precondition for reading a manifest, while matching
 * there would make it a discharge on its own — which is the hole.
 */
export function isAssetRenderCommand(command: string): boolean {
    return /\bui:render\b/.test(command) && /--profile[= ]\s*asset\b/.test(command);
}
