/**
 * `probe_inputs` — what the UI-conformance probe read, in a form its reader can
 * re-check without starting a browser.
 *
 * `ui-conformance.json` recorded `generated_at` and nothing about its inputs, so
 * a probe run before the last UI edit was indistinguishable from one run after
 * it. This module is the shared vocabulary that closes that: the probe writes an
 * `inputs` block with a content digest per input, and the design-pass reader
 * recomputes those digests and compares. ONE definition, imported by both sides,
 * because a producer and a consumer with separate copies of a hash rule agree
 * only until one of them is edited.
 *
 * DIGESTS, NOT MTIMES, AND THAT IS THE WHOLE DECISION (D1). The reader already
 * applies an mtime rule to the ui-audit artefact, and reusing it here was the
 * obvious move. It answers the wrong question: an mtime moves on a checkout, a
 * `cp -p`-less copy, or a bare `touch`, so it would report movement on turns
 * where no byte changed — and a reader who learns to ignore a false stale has
 * learned to ignore a real one. A content digest reports exactly what is being
 * asked: are the bytes the probe saw still the bytes on disk?
 *
 * THE TARGET DIGEST IS A TREE DIGEST, and this is the one place the roadmap's
 * own text needed correcting. A UI surface is an entry document plus the styles
 * and scripts beside it; a digest of `index.html` alone would be blind to a CSS
 * edit, which is the single most common UI change there is — and the roadmap's
 * own verify line for step 1.1 names exactly that case. So the record covers the
 * directory the entry document sits in. It costs a small recursive read the
 * probe does not otherwise perform (the browser, not Node, opens `styles.css`),
 * which is a real cost the roadmap's Risk 3 mitigation did not anticipate. It is
 * bounded: a few small text files against a run that launches Chromium and
 * reloads the page dozens of times per node.
 *
 * NO BROWSER IS REACHABLE FROM HERE. This module imports `node:crypto`,
 * `node:fs` and `node:path` and nothing else, which is what lets the hook decide
 * staleness on a host with no browser binaries installed.
 */
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

/** Schema of the `inputs` block. A reader that does not know it says unknown. */
export const INPUTS_SCHEMA = 'ui-conformance-inputs/v1';

/**
 * The probe build that wrote the block. Bumped when a change to the probe makes
 * an older artefact's findings incomparable with a newer run's; a reader seeing
 * a value it does not know reports unknown rather than guessing.
 */
export const PROBE_VERSION = 'ui-conformance-probe/v1';

/** The sibling file the probe reads for declared, approved deviations. */
export const DECLARATIONS_BASENAME = 'conformance.declared.json';

/**
 * Bound on a tree digest. A surface directory is a handful of files; anything
 * past this is a checkout root someone pointed the probe at by mistake, and
 * hashing it would cost more than the probe run. Exceeding it is recorded as
 * absent with a reason — never silently truncated, which would produce a digest
 * that looks authoritative and covers an arbitrary subset.
 */
export const MAX_TREE_FILES = 2000;

/** Directories never worth digesting, and ruinous to walk. */
const SKIP_DIRS = new Set(['node_modules', '.git']);

export const INPUT_KEYS = ['target', 'reference', 'declarations'] as const;
export type InputKey = (typeof INPUT_KEYS)[number];

export interface InputRecord {
    /**
     * What was digested — a directory for `tree`, a file for `file`. `null` only
     * when no path was supplied at all, which is itself recorded rather than
     * omitted.
     */
    path: string | null;
    kind: 'tree' | 'file';
    /** `absent` carries a reason and a null digest. Never an omitted key. */
    state: 'read' | 'absent';
    /** `sha256:<hex>` when read, `null` when absent. */
    digest: string | null;
    /** Files folded into a tree digest. Absent on a `file` record. */
    files?: number;
    reason?: string;
}

export interface ProbeInputs {
    schema: string;
    probe: string;
    target: InputRecord;
    reference: InputRecord;
    declarations: InputRecord;
}

const sha256 = (data: Buffer | string): string => `sha256:${createHash('sha256').update(data).digest('hex')}`;

const why = (err: unknown): string => {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    return code ? String(code) : String(err);
};

/**
 * The ONE definition of where a target's declarations file lives. The probe's
 * CLI computed this inline; a second copy here would be a rule that agrees with
 * the probe only until one of the two is edited.
 */
export function declarationsPathFor(targetEntryFile: string): string {
    return path.join(path.dirname(targetEntryFile), DECLARATIONS_BASENAME);
}

/** Digest one file. Never throws — an unreadable input is a recorded fact. */
export function digestFile(file: string | null, whenNull = 'no path was supplied'): InputRecord {
    if (!file) return { path: null, kind: 'file', state: 'absent', digest: null, reason: whenNull };
    try {
        return { path: file, kind: 'file', state: 'read', digest: sha256(fs.readFileSync(file)) };
    } catch (err) {
        return { path: file, kind: 'file', state: 'absent', digest: null, reason: `unreadable: ${why(err)}` };
    }
}

/**
 * Digest a directory as one value: every file under it, sorted by relative path,
 * folded path-and-content into a single hash. Sorted because a directory listing
 * order is a filesystem detail, and a digest that moved with it would report
 * movement nobody made.
 *
 * `exclude` drops names recorded as inputs in their own right — the declarations
 * file — so an edit to it moves exactly one digest rather than two.
 */
export function digestTree(
    dir: string | null,
    exclude: readonly string[] = [],
    whenNull = 'no path was supplied',
): InputRecord {
    if (!dir) return { path: null, kind: 'tree', state: 'absent', digest: null, reason: whenNull };
    const skip = new Set(exclude);
    const found: string[] = [];

    const walk = (rel: string): string | null => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(path.join(dir, rel), { withFileTypes: true });
        } catch (err) {
            return `unreadable: ${why(err)}`;
        }
        for (const e of [...entries].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))) {
            const child = rel ? `${rel}/${e.name}` : e.name;
            if (rel === '' && skip.has(e.name)) continue;
            if (e.isDirectory()) {
                if (SKIP_DIRS.has(e.name)) continue;
                const failed = walk(child);
                if (failed) return failed;
                continue;
            }
            if (!e.isFile()) continue;
            found.push(child);
            if (found.length > MAX_TREE_FILES) {
                return `directory holds more than ${MAX_TREE_FILES} files — too large to digest`;
            }
        }
        return null;
    };

    const failure = walk('');
    if (failure) return { path: dir, kind: 'tree', state: 'absent', digest: null, reason: failure };

    const h = createHash('sha256');
    for (const rel of found.sort()) {
        let body: Buffer;
        try {
            body = fs.readFileSync(path.join(dir, rel));
        } catch (err) {
            return { path: dir, kind: 'tree', state: 'absent', digest: null, reason: `unreadable: ${why(err)}` };
        }
        // The path is folded in alongside the bytes, so a rename moves the digest
        // even when the content is byte-identical.
        h.update(rel).update('\0').update(body).update('\0');
    }
    return {
        path: dir,
        kind: 'tree',
        state: 'read',
        digest: `sha256:${h.digest('hex')}`,
        files: found.length,
    };
}

/**
 * The block the probe writes beside `generated_at`. A target or reference is
 * digested as the surface directory it belongs to; the declarations file is
 * digested on its own.
 */
export function collectInputs(targetEntryFile: string | null, referenceEntryFile: string | null): ProbeInputs {
    const dirOf = (f: string | null): string | null => (f ? path.dirname(f) : null);
    return {
        schema: INPUTS_SCHEMA,
        probe: PROBE_VERSION,
        target: digestTree(dirOf(targetEntryFile), [DECLARATIONS_BASENAME], 'no --target was supplied'),
        reference: digestTree(
            dirOf(referenceEntryFile),
            [DECLARATIONS_BASENAME],
            'no --reference was given; nothing was compared against',
        ),
        declarations: targetEntryFile
            ? digestFile(declarationsPathFor(targetEntryFile))
            : digestFile(null, 'no --target was supplied, so no declarations file was looked for'),
    };
}

export type InputComparison =
    | { verdict: 'unknown'; reason: string; moved: readonly InputKey[] }
    | { verdict: 'unchanged'; moved: readonly InputKey[] }
    | { verdict: 'moved'; moved: readonly InputKey[] };

const isRecord = (v: unknown): v is InputRecord =>
    typeof v === 'object' && v !== null && 'state' in (v as object) && 'kind' in (v as object);

/**
 * Re-read each recorded input and say whether it moved.
 *
 * THREE verdicts, and `unknown` is not a hedge. An artefact written before the
 * `inputs` block existed has nothing to compare, and calling that `moved` would
 * report stale for every pre-existing run on the first turn after this change —
 * Risk 1 of the roadmap. It is a version skew, not evidence of movement, and it
 * is equally not evidence of freshness.
 *
 * `resolve` maps a recorded path to this host's filesystem; the caller owns that
 * because the probe records the path it was given and only the reader knows the
 * root it is reading from.
 */
export function compareInputs(recorded: unknown, resolve: (p: string) => string): InputComparison {
    if (typeof recorded !== 'object' || recorded === null) {
        return {
            verdict: 'unknown',
            moved: [],
            reason: 'the artefact carries no inputs block — it predates the input digests',
        };
    }
    const r = recorded as Partial<ProbeInputs>;
    if (r.schema !== INPUTS_SCHEMA) {
        return {
            verdict: 'unknown',
            moved: [],
            reason: `inputs schema ${String(r.schema)} is not ${INPUTS_SCHEMA} — this reader cannot compare it`,
        };
    }
    if (r.probe !== PROBE_VERSION) {
        return {
            verdict: 'unknown',
            moved: [],
            reason: `written by ${String(r.probe)}, read by ${PROBE_VERSION} — findings across builds are not comparable`,
        };
    }

    const moved: InputKey[] = [];
    for (const key of INPUT_KEYS) {
        const rec = r[key];
        if (!isRecord(rec)) {
            return {
                verdict: 'unknown',
                moved: [],
                reason: `the inputs block carries no usable record for ${key}`,
            };
        }
        // An input that was never supplied has nothing to move to or from.
        if (rec.path === null) continue;
        const here = rec.kind === 'tree'
            ? digestTree(resolve(rec.path), [DECLARATIONS_BASENAME])
            : digestFile(resolve(rec.path));
        if (here.state !== rec.state || here.digest !== rec.digest) moved.push(key);
    }
    return moved.length ? { verdict: 'moved', moved } : { verdict: 'unchanged', moved: [] };
}
