#!/usr/bin/env tsx
/**
 * inbox_source_census — the denominator an inbox run cannot shrink by reading badly.
 *
 * ## The gap this closes
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
 * ## What this counts — and what it deliberately does not
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
 * ## Honest limit
 *
 * An anchor count is a floor on what must be accounted for, never a target and
 * never a quality measure. A 400-anchor source can carry three demands and a
 * 12-anchor transcript can carry twelve. What the number buys is that a run
 * reporting "41 anchors → 41 accounted" can be challenged by anyone holding the
 * folder, where a prose summary cannot.
 *
 * ## Usage
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

/** Group one topic folder's files into source sets and count its anchors. */
export function censusTopic(dir: string, topic: string): TopicCensus {
    const names = fs
        .readdirSync(dir, { withFileTypes: true })
        .filter((d) => d.isFile() && TEXT_EXT.has(path.extname(d.name).toLowerCase()))
        .map((d) => d.name)
        .sort();

    const byStem = new Map<string, FileCensus[]>();
    const ids = new Set<string>();
    for (const name of names) {
        const abs = path.join(dir, name);
        const fc = censusFile(abs, name);
        for (const id of decisionIds(fs.readFileSync(abs, 'utf-8'))) ids.add(id);
        const stem = stemOf(name);
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
        anchorTotal: sets.reduce(
            (n, s) => n + s.members.reduce((m, f) => m + f.total, 0),
            0,
        ),
    };
}

/** Walk a round root: each immediate subdirectory is a topic, plus the root itself. */
export function censusRoot(root: string): TopicCensus[] {
    const out: TopicCensus[] = [];
    const rootLevel = censusTopic(root, '.');
    if (rootLevel.fileCount > 0) out.push(rootLevel);
    for (const d of fs.readdirSync(root, { withFileTypes: true })) {
        if (!d.isDirectory()) continue;
        const t = censusTopic(path.join(root, d.name), d.name);
        if (t.fileCount > 0) out.push(t);
    }
    return out;
}

function render(topics: TopicCensus[], write: (s: string) => unknown): void {
    let files = 0;
    let anchors = 0;
    let revisionSets = 0;
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
        files += t.fileCount;
        anchors += t.anchorTotal;
    }
    write(
        `\ntopics ${String(topics.length)} · files ${String(files)} · ` +
            `revision sets ${String(revisionSets)} · anchors ${String(anchors)}\n` +
            'Every anchor leaves the run carrying a ledger row or named in one `no-demand` line.\n' +
            'Every revision set owes a consecutive-member diff (/analyze:inbox Phase 2b).\n',
    );
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const rootIdx = argv.indexOf('--root');
    if (rootIdx === -1 || argv[rootIdx + 1] === undefined) {
        process.stderr.write('usage: inbox_source_census --root <dir> [--json]\n');
        return 2;
    }
    const root = path.resolve(REPO_ROOT, argv[rootIdx + 1]);
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
