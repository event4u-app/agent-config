#!/usr/bin/env tsx
/**
 * inbox_source_census — the denominator an inbox run cannot shrink by reading badly.
 *
 * THE GAP THIS CLOSES.
 *
 * `/analyze:inbox` already ends with a **point ledger**: points extracted in its
 * Phase 3 against points dispositioned in Phases 4–5b, per bucket, as counts
 * that must balance. That ledger proves the run answered what it read. It
 * cannot prove the run read what arrived — a point nobody extracted appears in
 * neither column, and the ledger balances perfectly without it. Under-extraction
 * is invisible to the only completeness check the command has.
 *
 * Measured shape of the input that exposed it: round `inbox-2026-09-r` arrived
 * as 12 topic folders, 67 files and ~55,800 lines, where one folder alone held
 * six revisions of a plan beside a 58 KB transcript. Read per file, the
 * revisions look like six sources; read as a set, they are one argument whose
 * later revisions silently drop items the earlier ones carried.
 *
 * WHAT THIS COUNTS — AND WHAT IT DELIBERATELY DOES NOT.
 *
 * Only what is **mechanical and genre-independent**:
 *
 *   1. **Source sets** — files grouped by stem, so a revision family
 *      (`x.v1/x.v2`, `x.consolidated.v1`, `x-loop-1`, `x-2026-09-06`) reports as
 *      ONE set with its members ordered, instead of as N unrelated files.
 *   2. **Anchors** — the four countable structures a source can carry: turn
 *      separators, headings, checkbox steps, and numbered items. Every class is
 *      counted on every file; the run picks the ones its genre uses.
 *   3. **Decision ids** — the `D2` / `E1` / `K7` tokens a source argues in. If
 *      those do not appear in what the run emits, the emitted plan is
 *      undecidable by construction and no reader can tell, because the ids left
 *      with the source.
 *
 * It does NOT guess genre, judge relevance, or extract demands. Those are the
 * reading, and the whole point of a denominator is that it is produced without
 * one — a census that needed judgement would be as shrinkable as the reading it
 * is supposed to bound.
 *
 * HONEST LIMIT.
 *
 * An anchor count is a floor on what must be accounted for, never a target and
 * never a quality measure. A 400-anchor source can carry three demands and a
 * 12-anchor transcript can carry twelve. What the number buys is that a run
 * reporting "41 anchors → 41 accounted" can be challenged by anyone holding the
 * folder, where a prose summary cannot.
 *
 * USAGE.
 *
 *   ./scripts-run src/scripts/inbox_source_census --root agents/tmp/<round-id>
 *   ./scripts-run src/scripts/inbox_source_census --root <dir> --json
 *
 * Exit 2 when the root is missing, unreadable, or enumerates zero files — a
 * census over an empty set is vacuous and must not read as coverage.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** Extensions worth counting. Binaries and archives carry no anchors. */
const TEXT_EXT = new Set(['.md', '.txt', '.markdown', '.mdx']);

/**
 * Version markers that make two files revisions of one source rather than two
 * sources. Ordered most-specific first: `consolidated.v2` must not be stripped
 * to `consolidated` by the bare `.vN` rule.
 */
const VERSION_MARKERS: readonly RegExp[] = [
    /[.-]consolidated[.-]v\d+$/i,
    /[.-]consolidated$/i,
    /[.-]loop[.-]?\d+.*$/i,
    /[.-]v\d+$/i,
    /[.-]\d{4}-\d{2}-\d{2}$/,
    /[.-](final|draft|deep|master)$/i,
];

export interface AnchorCounts {
    /** `----`-style turn separators — the transcript spine. */
    separators: number;
    /** ATX headings, h1 through h4. */
    headings: number;
    /** `- [ ]` / `- [x]` / `- [~]` / `- [-]` roadmap steps. */
    steps: number;
    /** `1.`-style numbered items and `**bold lead-in**` paragraph openers. */
    enumerated: number;
}

export interface FileCensus {
    file: string;
    bytes: number;
    lines: number;
    anchors: AnchorCounts;
    /** Sum of the four anchor classes — the file's floor. */
    total: number;
}

export interface SourceSet {
    /** The shared stem the members were grouped under. */
    stem: string;
    /** Members, oldest-looking first (lexical on the version marker). */
    members: FileCensus[];
    /** True when more than one member shares the stem. */
    isRevisionSet: boolean;
}

export interface TopicCensus {
    topic: string;
    sets: SourceSet[];
    decisionIds: string[];
    fileCount: number;
    anchorTotal: number;
    /**
     * Paths under this topic the census did NOT read, relative to the topic
     * directory. A file the walk skipped is not a file that is not there, and
     * the closing coverage line cannot be read as complete while this is
     * non-empty.
     */
    uncounted: string[];
}

/**
 * Strip a trailing version marker to the stem two revisions share.
 *
 * Applied repeatedly, most-specific first, so `road-to-x.consolidated.v3`
 * reduces through `road-to-x.consolidated` to `road-to-x` — otherwise a
 * `.consolidated` family and a plain `.vN` family of the same plan report as
 * two sets and the diff obligation never fires on the pair.
 */
export function stemOf(filename: string): string {
    let s = filename.replace(/\.(md|markdown|mdx|txt)$/i, '');
    let changed = true;
    while (changed) {
        changed = false;
        for (const re of VERSION_MARKERS) {
            const next = s.replace(re, '');
            if (next !== s && next.length > 0) {
                s = next;
                changed = true;
                break;
            }
        }
    }
    return s;
}

/** Count the four anchor classes. Fenced code is skipped — a fence is content. */
export function countAnchors(text: string): AnchorCounts {
    const out: AnchorCounts = { separators: 0, headings: 0, steps: 0, enumerated: 0 };
    let inFence = false;
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trimEnd();
        if (/^\s*(```|~~~)/.test(line)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        if (/^-{4,}$|^={4,}$|^\*{4,}$/.test(line.trim())) {
            out.separators += 1;
            continue;
        }
        if (/^#{1,4} \S/.test(line)) {
            out.headings += 1;
            continue;
        }
        if (/^\s*[-*] \[[ xX~-]\]/.test(line)) {
            out.steps += 1;
            continue;
        }
        if (/^\s*\d+[.)] \S/.test(line) || /^\*\*[^*]+\*\*/.test(line)) {
            out.enumerated += 1;
        }
    }
    return out;
}

/**
 * Decision / open-question ids the source argues in — `D2`, `E1`, `K7`, `AC3`.
 *
 * Deliberately narrow: one to three capitals followed by one or two digits, as
 * a whole token. A wider pattern matches version strings, HTTP codes and every
 * `P0` in ordinary prose, and a noisy id set is worse than none — the run would
 * stop reading the row.
 */
export function decisionIds(text: string): string[] {
    const hits = text.match(/\b[A-Z]{1,3}\d{1,2}\b/g) ?? [];
    return [...new Set(hits)].sort();
}

function censusFile(abs: string, rel: string): FileCensus {
    const text = fs.readFileSync(abs, 'utf-8');
    const anchors = countAnchors(text);
    return {
        file: rel,
        bytes: Buffer.byteLength(text),
        lines: text.split(/\r?\n/).length,
        anchors,
        total: anchors.separators + anchors.headings + anchors.steps + anchors.enumerated,
    };
}

/**
 * Every path under `dir`, recursively, split into the text files the census
 * reads and everything else. Both are relative to `dir` and sorted.
 *
 * The recursion is the repair. The previous reader took only the files
 * DIRECTLY in a topic directory, so a nested folder of later-loop plans was
 * invisible while the closing line still claimed every anchor left with a
 * ledger row. Measured on the round that found it: twelve files reported
 * against fourteen present, and zero revision sets against three.
 */
function collect(dir: string, recursive: boolean): { text: string[]; other: string[] } {
    const text: string[] = [];
    const other: string[] = [];
    const walk = (abs: string, rel: string): void => {
        for (const d of fs.readdirSync(abs, { withFileTypes: true })) {
            const childRel = rel === '' ? d.name : `${rel}/${d.name}`;
            if (d.isDirectory()) {
                if (recursive) walk(path.join(abs, d.name), childRel);
                continue;
            }
            if (!d.isFile()) continue;
            if (TEXT_EXT.has(path.extname(d.name).toLowerCase())) text.push(childRel);
            else other.push(childRel);
        }
    };
    walk(dir, '');
    text.sort();
    other.sort();
    return { text, other };
}

/**
 * Group one topic folder's files into source sets and count its anchors.
 *
 * `recursive` is true for a topic, false for the round root — `censusRoot`
 * treats each immediate subdirectory as its own topic, so a recursive root
 * pass would count those files twice.
 */
export function censusTopic(dir: string, topic: string, recursive = true): TopicCensus {
    const { text: names, other: uncounted } = collect(dir, recursive);

    const byStem = new Map<string, FileCensus[]>();
    const ids = new Set<string>();
    for (const name of names) {
        const abs = path.join(dir, name);
        const fc = censusFile(abs, name);
        for (const id of decisionIds(fs.readFileSync(abs, 'utf-8'))) ids.add(id);
        // The stem comes from the BASENAME, so `plan.md` and `v2/plan.md` are
        // one revision set across directory levels. That is the grouping this
        // repair is for; it also means two unrelated files that happen to
        // share a stem at different depths read as one set, which is why each
        // member is printed with its path relative to the topic.
        const stem = stemOf(path.basename(name));
        const bucket = byStem.get(stem);
        if (bucket) bucket.push(fc);
        else byStem.set(stem, [fc]);
    }

    const sets: SourceSet[] = [...byStem.entries()]
        .map(([stem, members]) => ({
            stem,
            members: members.sort((a, b) => a.file.localeCompare(b.file)),
            isRevisionSet: members.length > 1,
        }))
        .sort((a, b) => a.stem.localeCompare(b.stem));

    return {
        topic,
        sets,
        decisionIds: [...ids].sort(),
        fileCount: names.length,
        uncounted,
        anchorTotal: sets.reduce(
            (n, s) => n + s.members.reduce((m, f) => m + f.total, 0),
            0,
        ),
    };
}

/** Walk a round root: each immediate subdirectory is a topic, plus the root itself. */
export function censusRoot(root: string): TopicCensus[] {
    const out: TopicCensus[] = [];
    const rootLevel = censusTopic(root, '.', false);
    if (rootLevel.fileCount > 0 || rootLevel.uncounted.length > 0) out.push(rootLevel);
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const t = censusTopic(path.join(root, d.name), d.name);
        if (t.fileCount > 0 || t.uncounted.length > 0) out.push(t);
    }
    return out;
}

function render(topics: TopicCensus[], write: (s: string) => unknown): void {
    let files = 0;
    let anchors = 0;
    let revisionSets = 0;
    let uncounted = 0;
    for (const t of topics) {
        write(`\n## ${t.topic}\n`);
        for (const s of t.sets) {
            const tag = s.isRevisionSet ? ` — REVISION SET (${String(s.members.length)}), diff consecutive members` : '';
            write(`  ${s.stem}${tag}\n`);
            for (const f of s.members) {
                const a = f.anchors;
                write(
                    `    ${f.file}  ${String(f.bytes)}B/${String(f.lines)}L  ` +
                        `sep ${String(a.separators)} · head ${String(a.headings)} · ` +
                        `step ${String(a.steps)} · enum ${String(a.enumerated)}  = ${String(f.total)}\n`,
                );
            }
            if (s.isRevisionSet) revisionSets += 1;
        }
        if (t.decisionIds.length > 0) write(`  decision ids: ${t.decisionIds.join(' ')}\n`);
        if (t.uncounted.length > 0) {
            write(`  not counted (${String(t.uncounted.length)}): ${t.uncounted.join(', ')}\n`);
        }
        files += t.fileCount;
        anchors += t.anchorTotal;
        uncounted += t.uncounted.length;
    }
    write(
        `\ntopics ${String(topics.length)} · files ${String(files)} · ` +
            `revision sets ${String(revisionSets)} · anchors ${String(anchors)} · ` +
            `not counted ${String(uncounted)}\n`,
    );
    if (uncounted > 0) {
        write(
            `${String(uncounted)} file(s) are named above and were NOT read — the census reads ` +
                `${[...TEXT_EXT].sort().join(' ')} only. The anchor total below is over what was ` +
                'read, so it is a floor and not a measure of the folder.\n',
        );
    }
    write(
        'Every anchor leaves the run carrying a ledger row or named in one `no-demand` line.\n' +
            'Every revision set owes a consecutive-member diff (/analyze:inbox Phase 2b).\n',
    );
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const rootIdx = argv.indexOf('--root');
    const rootArg = rootIdx === -1 ? undefined : argv[rootIdx + 1];
    if (rootArg === undefined) {
        process.stderr.write('usage: inbox_source_census --root <dir> [--json]\n');
        return 2;
    }
    const root = path.resolve(REPO_ROOT, rootArg);
    let stat: fs.Stats;
    try {
        stat = fs.statSync(root);
    } catch {
        process.stderr.write(`❌  inbox_source_census: root not readable: ${root}\n`);
        return 2;
    }
    if (!stat.isDirectory()) {
        process.stderr.write(`❌  inbox_source_census: root is not a directory: ${root}\n`);
        return 2;
    }

    const topics = censusRoot(root);
    const files = topics.reduce((n, t) => n + t.fileCount, 0);
    if (files === 0) {
        process.stderr.write(
            `❌  inbox_source_census: 0 text file(s) under ${root} — a census over an ` +
                'empty set is vacuous and must not read as coverage.\n',
        );
        return 2;
    }

    if (argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ root, topics }, null, 2)}\n`);
        return 0;
    }
    render(topics, (s) => process.stdout.write(s));
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    process.exit(main());
}
