/**
 * Corpus assembler for the provider-recognition leakage bench.
 *
 * `road-to-inbox-harvest-2026-08-e-council-topology-evidence`,
 * `blocker: leakage-bench-needs-assembler-and-design-forks`, todo item 1:
 * `collectGuesses` and `scoreRecognition` in `provider_leakage_bench.ts` both
 * take `items: readonly LeakageItem[]` as an INJECTED parameter, and nothing in
 * this tree ever produced those items from real council output. That gap — not
 * quota, and not the un-committability of the corpus — is what kept the bench
 * at NOT RUN. This module closes it and nothing else.
 *
 * It reads a directory of council response records — the JSON shape
 * `{ responses: [{ provider, model, text, error, ... }] }` written per council
 * run — and emits one `LeakageItem` per usable response body, with the response
 * author as ground truth.
 *
 * ── Why the directory is a parameter, not an import ─────────────────────────
 * `session.ts` binds `RESPONSES_DIR` at module load against the running
 * checkout's root (`session.ts:70-73`). Importing it would couple this loader
 * to one root and make it untestable over a fixture tree — and the same
 * root-binding is part of the retention defect this corpus is the subject of.
 * So the directory arrives as `opts.responsesDir` and this module imports
 * nothing from `session.ts`.
 *
 * ── What this module does NOT do ────────────────────────────────────────────
 * It does NOT anonymise. The bodies in `LeakageCorpus.items` are RAW: whatever
 * the provider wrote, including any self-identification in the prose. An
 * anonymisation pass is a DECLARED OPEN DESIGN FORK in the blocker above and is
 * not settled here, so `assembleLeakageCorpus` MUST NOT be fed to a live rater
 * until that fork is settled — a rater shown a raw body may be reading a
 * signature rather than a style, and the recognition rate would then measure
 * the absence of anonymisation rather than its failure.
 *
 * The `anonymise` seam below exists so the settled fork has somewhere to land
 * without changing this module's shape. Its default is `IDENTITY_ANONYMISE`,
 * which returns its input unchanged — deliberately, and tested for it, so that
 * "the default anonymiser" can never be mistaken for anonymisation having
 * happened.
 *
 * It also does NOT decide, score, prompt, or dispatch. No CLI, no `main()`, no
 * transport, no provider calls.
 *
 * ── Why nothing here deletes ────────────────────────────────────────────────
 * This module contains no write, no `unlink` and no `rm`, and must never gain
 * one. The corpus IS the measurement subject: pruning it destroys the
 * instrument, and the over-retention of these bodies is itself a recorded
 * finding rather than a mess to tidy. Retention is therefore REPORTED — both
 * partitions, counted per family in the census — and enforced by nobody here.
 * The caller chooses which partition it is willing to measure over.
 */
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { LeakageItem } from './provider_leakage_bench.js';

/**
 * The synthetic fixture's basename. Its own body states that "a live runner
 * must refuse this file"; that refusal is implemented here rather than
 * documented, because a recognition rate over hand-written fixture prose
 * describes the fixture author and not a model.
 */
export const SYNTHETIC_FIXTURE_BASENAME = 'smoke-items.json';

/** Any path segment containing this marker is the synthetic bench fixture dir. */
export const SYNTHETIC_PATH_MARKER = 'council-provider-leakage';

/** Mirrors the declared council retention window. Reported, never applied. */
export const DEFAULT_RETENTION_DAYS = 7;

const MS_PER_DAY = 86_400_000;

/** Thrown when the assembler is pointed at data that cannot measure leakage. */
export class SyntheticCorpusRefusal extends Error {
    readonly source: string;
    constructor(source: string, why: string) {
        super(`refusing synthetic corpus data: ${source} — ${why}`);
        this.name = 'SyntheticCorpusRefusal';
        this.source = source;
    }
}

/** Machine-readable exclusion buckets. A dropped body always names one. */
export type ExclusionReason =
    /** Not a `.json` file (the tree also holds `.md` notes and stray dirs). */
    | 'not-json-file'
    /** File exists but is not parseable JSON. */
    | 'unparseable-json'
    /** Parsed, but carries no top-level `responses` array. */
    | 'no-responses-array'
    /** A `responses` entry that is not an object. */
    | 'not-an-object'
    /** Entry has a non-falsy `error` — a failed call has no body to rate. */
    | 'response-carried-error'
    /** Entry has no non-empty `provider`, so there is no ground truth. */
    | 'missing-provider'
    /** Entry has no non-empty `text`, so there is nothing to show a rater. */
    | 'empty-text';

/** One thing that did not become an item, and why. Never a silent drop. */
export interface ExcludedRecord {
    /** Source path relative to `responsesDir`, POSIX-separated. */
    readonly source: string;
    /** Index within `responses`, or `null` for a whole-file exclusion. */
    readonly index: number | null;
    readonly reason: ExclusionReason;
    /** One clause of detail, safe to print beside the reason. */
    readonly detail: string;
}

/**
 * A corpus item: a `LeakageItem` plus the provenance the SCORER may see and the
 * rater may not.
 */
export interface CorpusItem extends LeakageItem {
    /** Source path relative to `responsesDir`, POSIX-separated. */
    readonly source_file: string;
    readonly response_index: number;
    /** Source file mtime in epoch ms — the only retention input. */
    readonly mtime_ms: number;
    /** Whether `mtime_ms` falls inside `retention_days` of `now`. Reported only. */
    readonly within_retention: boolean;
}

/** Per-family counts. Keys are whatever providers were actually present. */
export type FamilyCounts = Readonly<Record<string, number>>;

export interface CorpusCensus {
    readonly files_scanned: number;
    readonly files_excluded: number;
    readonly responses_seen: number;
    readonly items_kept: number;
    readonly items_excluded: number;
    /** Echoed so a published census is self-describing. */
    readonly retention_days: number;
    readonly now_ms: number;
    /** Kept items whose source mtime is inside the TTL, counted per family. */
    readonly within_retention: FamilyCounts;
    /** Kept items whose source mtime is older than the TTL, per family. */
    readonly over_retention: FamilyCounts;
    readonly within_retention_total: number;
    readonly over_retention_total: number;
}

export interface LeakageCorpus {
    readonly items: readonly CorpusItem[];
    /** Sorted distinct families actually present. Never a hardcoded list. */
    readonly families: readonly string[];
    readonly excluded: readonly ExcludedRecord[];
    readonly census: CorpusCensus;
}

export interface AssembleOptions {
    /** Directory of council response records. Walked recursively. */
    readonly responsesDir: string;
    /** Epoch ms treated as "now" for the retention partition. */
    readonly now?: number;
    readonly retentionDays?: number;
    /**
     * The anonymisation seam. Defaults to `IDENTITY_ANONYMISE`, i.e. NO
     * anonymisation — see the header. Supplying one does not make this module
     * an anonymiser; it makes the fork's decision injectable.
     */
    readonly anonymise?: (text: string) => string;
}

/** The default `anonymise`: returns its argument unchanged. Not anonymisation. */
export const IDENTITY_ANONYMISE = (text: string): string => text;

/**
 * Assemble a leakage corpus from a directory of council response records.
 *
 * Throws `SyntheticCorpusRefusal` — never excludes-and-continues — when the
 * directory or any file in it is synthetic bench data. The blocker's wording is
 * that a live runner must REFUSE it, and an exclusion is not a refusal: it
 * would let a run proceed over a silently smaller corpus.
 */
export function assembleLeakageCorpus(opts: AssembleOptions): LeakageCorpus {
    const now = opts.now ?? Date.now();
    const retentionDays = opts.retentionDays ?? DEFAULT_RETENTION_DAYS;
    const anonymise = opts.anonymise ?? IDENTITY_ANONYMISE;
    const root = opts.responsesDir;

    if (_posix(path.resolve(root)).includes(SYNTHETIC_PATH_MARKER)) {
        throw new SyntheticCorpusRefusal(
            root,
            `the directory path contains "${SYNTHETIC_PATH_MARKER}", the synthetic bench fixture location`,
        );
    }

    const excluded: ExcludedRecord[] = [];
    const items: CorpusItem[] = [];
    let filesScanned = 0;
    let filesExcluded = 0;
    let responsesSeen = 0;

    // Sorted relative paths: two runs over the same tree emit byte-identical
    // output, which a bench whose result gets published has to be able to claim.
    for (const rel of _walkSorted(root)) {
        const abs = path.join(root, rel);
        const base = path.basename(rel);

        if (base === SYNTHETIC_FIXTURE_BASENAME) {
            throw new SyntheticCorpusRefusal(
                rel,
                `basename is the synthetic fixture "${SYNTHETIC_FIXTURE_BASENAME}", whose own body states a live runner must refuse it`,
            );
        }
        if (!base.endsWith('.json')) {
            excluded.push({ source: rel, index: null, reason: 'not-json-file', detail: 'no .json extension' });
            filesExcluded += 1;
            continue;
        }

        filesScanned += 1;
        let parsed: unknown;
        try {
            parsed = JSON.parse(fs.readFileSync(abs, 'utf8'));
        } catch (err) {
            excluded.push({
                source: rel,
                index: null,
                reason: 'unparseable-json',
                detail: err instanceof Error ? err.message : String(err),
            });
            filesExcluded += 1;
            continue;
        }

        // A truthy top-level `synthetic` key is the fixture's self-declaration.
        // Checked after the basename guard so a renamed fixture is still caught.
        if (_isRecord(parsed) && Boolean(parsed['synthetic'])) {
            throw new SyntheticCorpusRefusal(rel, 'the record carries a truthy top-level "synthetic" key');
        }

        const responses = _isRecord(parsed) ? parsed['responses'] : undefined;
        if (!Array.isArray(responses)) {
            excluded.push({
                source: rel,
                index: null,
                reason: 'no-responses-array',
                detail: 'no top-level `responses` array',
            });
            filesExcluded += 1;
            continue;
        }

        const mtimeMs = fs.statSync(abs).mtimeMs;
        const withinRetention = now - mtimeMs <= retentionDays * MS_PER_DAY;

        for (let i = 0; i < responses.length; i += 1) {
            responsesSeen += 1;
            const entry: unknown = responses[i];
            if (!_isRecord(entry)) {
                excluded.push({ source: rel, index: i, reason: 'not-an-object', detail: `entry is ${typeof entry}` });
                continue;
            }
            const error = entry['error'];
            if (Boolean(error)) {
                excluded.push({
                    source: rel,
                    index: i,
                    reason: 'response-carried-error',
                    detail: typeof error === 'string' ? error.slice(0, 120) : 'non-falsy error field',
                });
                continue;
            }
            const provider = _nonEmptyString(entry['provider']);
            if (provider === null) {
                excluded.push({ source: rel, index: i, reason: 'missing-provider', detail: 'no non-empty provider' });
                continue;
            }
            const text = _nonEmptyString(entry['text']);
            if (text === null) {
                excluded.push({ source: rel, index: i, reason: 'empty-text', detail: 'no non-empty text' });
                continue;
            }
            items.push({
                id: leakageItemId(rel, i),
                text: anonymise(text),
                true_family: provider,
                source_file: rel,
                response_index: i,
                mtime_ms: mtimeMs,
                within_retention: withinRetention,
            });
        }
    }

    const within: Record<string, number> = {};
    const over: Record<string, number> = {};
    for (const item of items) {
        const bucket = item.within_retention ? within : over;
        bucket[item.true_family] = (bucket[item.true_family] ?? 0) + 1;
    }

    return {
        items,
        families: [...new Set(items.map((i) => i.true_family))].sort(),
        excluded,
        census: {
            files_scanned: filesScanned,
            files_excluded: filesExcluded,
            responses_seen: responsesSeen,
            items_kept: items.length,
            items_excluded: excluded.filter((e) => e.index !== null).length,
            retention_days: retentionDays,
            now_ms: now,
            within_retention: within,
            over_retention: over,
            within_retention_total: _sum(within),
            over_retention_total: _sum(over),
        },
    };
}

/**
 * Stable, collision-free, OPAQUE item id.
 *
 * The id is a digest of the source path plus the response index — NOT the
 * basename — and that is load-bearing rather than stylistic: real filenames
 * under `agents/runtime/council/responses/` include
 * `anthropic-design-skills-integration.json` and several `claude-*.json`, so a
 * basename-derived id would hand the rater the ground truth in the item's own
 * identifier and the bench would measure reading, not recognition. The id must
 * never embed the provider name, or any part of a path that might.
 *
 * Deterministic (a digest, not a counter) so two runs over the same tree
 * produce the same ids, and index-suffixed so two bodies in one file cannot
 * collide.
 */
export function leakageItemId(relPath: string, index: number): string {
    const digest = crypto.createHash('sha1').update(_posix(relPath)).digest('hex').slice(0, 12);
    return `item-${digest}-${String(index)}`;
}

/** Recursive file walk, returning `root`-relative POSIX paths in sorted order. */
function _walkSorted(root: string): string[] {
    const out: string[] = [];
    const visit = (dirRel: string): void => {
        let entries: fs.Dirent[];
        try {
            entries = fs.readdirSync(path.join(root, dirRel), { withFileTypes: true });
        } catch {
            return;
        }
        const names = entries.map((e) => e.name).sort();
        for (const name of names) {
            const rel = dirRel === '' ? name : `${dirRel}/${name}`;
            const abs = path.join(root, rel);
            let stat: fs.Stats;
            try {
                stat = fs.statSync(abs);
            } catch {
                continue;
            }
            if (stat.isDirectory()) {
                // Real records nest: `<slug>.json/` directories hold per-round
                // files. Recursing keeps those bodies eligible; the relative
                // path keeps their ids distinct.
                visit(rel);
            } else if (stat.isFile()) {
                out.push(rel);
            }
        }
    };
    visit('');
    return out.sort();
}

function _posix(p: string): string {
    return p.split(path.sep).join('/');
}

function _isRecord(v: unknown): v is Record<string, unknown> {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function _nonEmptyString(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v : null;
}

function _sum(counts: Readonly<Record<string, number>>): number {
    return Object.values(counts).reduce((a, b) => a + b, 0);
}
