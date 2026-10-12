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
 *   (iii) A manifest counts only where THIS turn ran a render NAMING THAT
 *         FILE after the edit. Otherwise an agent could write a manifest by
 *         hand, digest included, and discharge its own obligation.
 *
 *         A turn that writes into the render directory by any other route —
 *         an edit tool, or a shell command naming the directory — voids every
 *         manifest for that turn, so a hand-written manifest plus a render that
 *         names the file (and failed) no longer discharges (16.5.0 release
 *         review).
 *
 *         THE RESIDUAL, stated rather than implied. This is a check against an
 *         omission, not a tamper-proof attestation: a process that can run a
 *         shell can write a file by a route no transcript reading recognises.
 *         What is enforced is that a render naming the file ran and that the
 *         turn did not visibly write the render directory; what is not
 *         enforced is that the manifest on disk is the one that render produced. A manifest left by an
 *         EARLIER turn whose digest still matches therefore discharges — and
 *         that is defensible, because a matching digest means the bytes have
 *         not moved since it was taken, which is the whole claim a digest
 *         makes. It is recorded here because the first version of this
 *         paragraph promised more than the code did (finding 2 of this
 *         change's own completion review), and a gate whose documented
 *         assurance outruns its implementation is quoted as written.
 *   (iv)  A deleted `.svg` opens no obligation — it has no current digest, so
 *         there is nothing a render could be bound to.
 *
 * Its own module rather than another 200 lines inside the gate: the gate ships
 * in a byte-capped bundle AND sits two lines under the source-size ratchet, so
 * a separate module is both the unit whose cost can be measured and the only
 * place this could have gone.
 *
 * It is also why `openSvgObligation` returns a finding-shaped object rather
 * than a reason the gate wraps: the gate's entry for it is ONE line, and the
 * reasoning that would have been a comment there is the paragraph above.
 *
 * THE DETECTOR RUNS UNCONDITIONALLY, including while a subagent dispatch is
 * open — nothing about a dispatch makes an unrendered graphic rendered.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { isAssetRenderCommand } from '../_lib/verification_command.js';
import type { ToolCall } from '../_lib/turn_end_transcript.js';

/**
 * Re-exported, not re-derived. Finding 3 of this change's SECOND completion
 * review moved the predicate into `_lib/verification_command.ts`, because
 * detector C needs it too and a `_lib` module may not import from `hooks/`.
 * Two copies of a command-shape regex is how the two detectors come to
 * disagree about what a render is.
 */
export { isAssetRenderCommand };

/**
 * Tools that WRITE. One copy, here rather than imported from the gate: the
 * gate imports this module, so the dependency runs one way.
 */
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit']);

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
    asset?: { digest?: unknown; findings?: unknown } | undefined;
    static?: { errors?: unknown; digest?: unknown } | undefined;
}

/** Does a manifest's asset reading carry an error-severity finding? */
function hasErrorFinding(m: AssetManifestish): boolean {
    const f = m.asset?.findings;
    return Array.isArray(f) && f.some((x) => (x as { severity?: unknown })?.severity === 'error');
}

/**
 * Repo-relative, forward slashes — whatever the host handed us.
 *
 * Finding 1 of this change's completion review, and it was a live gate risk
 * rather than a tidiness point: this used to normalise separators only, so an
 * ABSOLUTE tool-call path never started with `tests/design-artifacts/…` and the
 * planted-fixture exemption silently missed. A blocking gate would then have
 * refused every turn that edits one of the ~25 deliberately-broken fixtures
 * this very change adds — and no test caught it, because every case passed a
 * relative path. The function four lines down already treated an absolute path
 * as expected input, which is the contradiction inside one file that made the
 * finding decidable.
 */
const rel = (root: string, p: string): string => {
    const slashed = p.split(path.sep).join('/');
    if (!path.isAbsolute(p)) return slashed.replace(/^\.\//, '');
    const inside = path.relative(root, p).split(path.sep).join('/');
    // `path.relative` escaping the root with `..` means the path is NOT in this
    // workspace; keep it as given rather than inventing a relation to it.
    return inside === '' || inside.startsWith('../') ? slashed : inside;
};

export function isPlantedFixture(relPath: string, root = ''): boolean {
    const norm = rel(root, relPath);
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
        // AN ERROR FLOOR ON BOTH PATHS. Finding 2 of the fifth completion
        // review: `verification: 'verified'` is written unconditionally by the
        // render — it means a digest-bound render HAPPENED, which is what the
        // skill's status table says and what it should keep meaning — and this
        // branch discharged on it with no look at what the render FOUND. So a
        // file whose own reading carries an error findings discharged a
        // blocking gate through the strong path, while the weaker
        // `renderer-absent` path below refused at a single error. The rigour
        // was inverted: the path that saw more of the file demanded less of it.
        if (m.verification === 'verified' && m.asset?.digest === digest && !hasErrorFinding(m)) {
            return 'verified';
        }
        if (m.reason === 'renderer-absent' && m.static?.digest === digest && m.static.errors === 0) {
            staticOnly = true;
        }
    }
    return staticOnly ? 'static-only' : null;
}

export interface SvgObligationInputs {
    /**
     * One entry per file the turn EDITED, in order, `.svg` and otherwise, each
     * carrying the `ui:render --profile asset` command lines that ran after
     * THAT file's last edit, verbatim.
     *
     * Precision (iii), and both halves of it were wrong once.
     *
     * The first round made it per file by NAME: a single boolean used to mean
     * that any asset render anywhere unlocked every manifest on disk, so a
     * hand-written manifest plus a decoy render on an unrelated file
     * discharged the obligation. A command must NAME the file it discharges.
     *
     * The second round made it per file by TIME, which is finding 2 of that
     * round. The render window was taken from the turn's LAST `.svg` edit
     * globally while the obligation is per file, so the ordinary interleaved
     * turn — edit a, render a, edit b, render b — hid render-a behind edit-b
     * and refused a turn in which both files were rendered correctly after
     * their own edits. Confirmed by running it before it was changed.
     *
     * Both windows are the same shape: a render counts for a file only if it
     * names that file AND follows that file's own last edit.
     */
    edits: ReadonlyArray<{ path: string; rendered: readonly string[] }>;
    /**
     * True when this turn wrote into the render directory by some route other
     * than an asset render — an edit tool, or a shell command naming the
     * directory. The manifests on disk are then not evidence of a render, so
     * none of them discharges anything (16.5.0 release review).
     */
    renderDirTampered?: boolean;
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

    for (const { path: raw, rendered } of inputs.edits) {
        if (!/\.svg$/i.test(raw)) continue;
        // Repo-relative FIRST, so `seen`, the planted exemption and the
        // reported `file` all speak the same dialect — the doc on
        // `SvgObligation.file` promises repo-relative and used to be false for
        // an absolute tool call.
        const relPath = rel(root, raw);
        if (seen.has(relPath)) continue;
        seen.add(relPath);
        // (ii) planted fixtures carry errors on purpose.
        if (isPlantedFixture(relPath, root)) continue;

        // (iv) a deleted file has no current digest, so nothing could be bound
        // to it and no render could ever discharge it.
        const abs = path.isAbsolute(raw) ? raw : path.join(root, relPath);
        // The BYTES, matching the render and the static witness. Finding 2 of
        // the sixth completion review: this hashed the UTF-8 decoded string
        // while the render hashed the raw buffer, so a file the decode is not
        // byte-exact over could never have its obligation discharged.
        let bytes: Buffer;
        try {
            bytes = fs.readFileSync(abs);
        } catch {
            continue;
        }
        const digest = crypto.createHash('sha256').update(bytes).digest('hex');

        // (iii) The manifests are only consulted once a render was observed.
        // Reading them first and then discarding the verdict would make the
        // ordering look like a performance detail rather than the rule.
        if (!renderNames(rendered, relPath)) {
            open.push({
                file: relPath,
                reason:
                    'no `ui:render --profile asset` naming this file ran after THIS file\'s last edit, so no ' +
                    'manifest on ' +
                    'disk can be attributed to it — a manifest written by any other route, and a render of ' +
                    'some other file, both discharge nothing',
            });
            continue;
        }
        if (inputs.renderDirTampered) {
            open.push({
                file: relPath,
                reason:
                    'this turn wrote into the render directory by a route other than `ui:render`, so no manifest ' +
                    'there is evidence of a render — re-run the render in a turn that does not touch it',
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
 * Does one of the observed renders NAME this file?
 *
 * The render is a precondition for reading a manifest, never a discharge on
 * its own — `isVerificationCommand` still does not match it, so the command's
 * text cannot satisfy the obligation on the transcript path. Detector C reads
 * `isVerificationAttempt` instead, which is a different question with a
 * different right answer; both live in `_lib/verification_command.ts`, where
 * the split is argued.
 */
export function renderNames(commands: readonly string[], relPath: string): boolean {
    const base = relPath.split('/').pop() ?? relPath;
    return commands.some((c) => {
        const slashed = c.split(path.sep).join('/');
        // The path as written, or its basename — a caller may `cd` first, and a
        // basename collision inside one turn is a narrower hole than the
        // any-render-unlocks-everything it replaces.
        //
        // BOTH tests are anchored. Finding 3 of the fourth completion review:
        // the path branch was a bare `includes`, so a render of
        // `public/icon.svg` counted as naming `n.svg` and `on.svg` — any file
        // whose path is a substring of another file's path was discharged by a
        // render it had nothing to do with, which is the
        // any-render-unlocks-everything hole this function replaced, reopened
        // one character at a time. The boundary admits `/` before, so a path
        // written `./public/icon.svg` still names `public/icon.svg`.
        const bounded = (needle: string): boolean =>
            new RegExp(`(^|[\\s/'"])${escapeRe(needle)}(\\s|$|['"])`).test(slashed);
        return bounded(relPath) || bounded(base);
    });
}

/** Escape a path component for use inside a RegExp. */
function escapeRe(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}



/**
 * An `.svg` this turn edited that no render describes — step 2.1(b) of
 * `road-to-svg-review-followups`.
 *
 * REPORTED UNDER `verification`, not under a new detector id, and that is a
 * choice rather than a shortcut: this IS a verification finding — a file
 * changed and nothing that can fail was run over it — and a seventh id would
 * ripple through `DETECTOR_IDS`, the per-detector counters and the demotion
 * contract for a distinction the operator never makes.
 *
 * IT RUNS EVEN WHEN `detectUnverifiedEdit` IS SATISFIED. That is the point:
 * review claim C2 is about a turn that edits an `.svg` and then runs something
 * — a test suite, a linter, a bare `ui:render` — which looks like verification
 * and did not look at the graphic. An unrelated check discharges nothing here.
 *
 * The companion half is that `isVerificationCommand` learns NEITHER `ui:render`
 * NOR `xmllint`. Teaching it either would discharge the obligation on the
 * transcript path from the command text alone, which is the hole rather than
 * the fix. `svg_obligation.ts` carries the two records that do discharge it.
 */
export function openSvgObligation(
    workspaceRoot: string,
    toolCalls: readonly ToolCall[],
): { detector: 'verification'; evidence: string; reason: string; mode: 'transcript' } | null {
    // Precision (iii). The render has to come AFTER the edit it describes, on
    // both evidence paths — `toolCalls` is assembled for both, so one rule
    // covers them rather than two that can disagree.
    //
    // The window is per FILE, which finding 2 of the second review round is
    // about: taking it from the turn's last `.svg` edit globally hid an
    // earlier file's render behind a later file's edit, so the ordinary
    // interleaved turn was refused although every file had been rendered after
    // its own edit. The last edit of each path is the one that counts, because
    // an earlier render describes bytes a later edit replaced.
    const lastEditOf = new Map<string, number>();
    for (let i = 0; i < toolCalls.length; i += 1) {
        const c = toolCalls[i]!;
        if (!EDIT_TOOLS.has(c.name) || c.path === undefined) continue;
        lastEditOf.set(c.path, i);
    }
    if (lastEditOf.size === 0) return null;

    const edits = [...lastEditOf].map(([p, at]) => {
        const rendered: string[] = [];
        for (let i = at + 1; i < toolCalls.length; i += 1) {
            const c = toolCalls[i]!;
            if (c.name === 'Bash' && c.command !== undefined && isAssetRenderCommand(c.command)) {
                rendered.push(c.command);
            }
        }
        return { path: p, rendered };
    });

    const renderDir = RENDER_REL.split(path.sep).join('/');
    const renderDirTampered = toolCalls.some((c) => {
        if (EDIT_TOOLS.has(c.name) && c.path !== undefined) {
            return rel(workspaceRoot, c.path).startsWith(`${renderDir}/`);
        }
        return (
            c.name === 'Bash' &&
            c.command !== undefined &&
            !isAssetRenderCommand(c.command) &&
            c.command.split(path.sep).join('/').includes(renderDir)
        );
    });

    let reading: SvgObligationReading;
    try {
        reading = readSvgObligations(workspaceRoot, { edits, renderDirTampered });
    } catch {
        // A gate that crashed on its own instrument is a new failure mode on a
        // path meant to be inert. An unreadable render directory is no finding.
        return null;
    }
    const first = reading.open[0];
    if (first === undefined) return null;

    const more = reading.open.length > 1 ? ` (and ${String(reading.open.length - 1)} more)` : '';
    return {
        // Reported under `verification` rather than a seventh detector id: it
        // IS a verification finding — a file changed and nothing that can fail
        // ran over it — and a new id would ripple through DETECTOR_IDS, the
        // per-detector counters and the demotion contract for a distinction the
        // operator never makes.
        detector: 'verification',
        mode: 'transcript',
        evidence: first.file,
        reason:
            `this turn edited an .svg and no render describes it${more} — ${first.reason}. ` +
            'A bare `ui:render --profile asset` that rendered nothing, and a test or lint run over other ' +
            'files, both discharge nothing: the gate reads the render, never the call.',
    };
}
