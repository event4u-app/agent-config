/**
 * Re-read measurement over Claude Code transcript legs.
 *
 * `road-to-role-scoped-spawn-profiles` Phase 3 Step 3 requires a re-read
 * measurement BEFORE any suppression: *"A suppression built without this
 * measurement is suppressing whatever the author happened to notice."* This
 * module is that measurement, and it is deliberately a sibling of
 * `cc_transcript.ts` rather than a widening of it — `scanTranscripts` keeps
 * only `type: "assistant"` records carrying a `usage` block, which is exactly
 * the population a `tool_result` is NOT in.
 *
 * **What a "leg" is, stated because every count below depends on it.** One
 * `.jsonl` file is one leg. Claude Code writes the main session to
 * `<project>/<sessionId>.jsonl` and each subagent to
 * `<project>/<sessionId>/subagents/agent-*.jsonl`, so a leg is a single
 * conversation whose context window is its own. A file read once in the main
 * leg and once inside a subagent is NOT a re-read — the second leg never had
 * the first one's context — and {@link computeRereads} counts per leg for that
 * reason.
 *
 * **The wasted-token figure is a `chars / 4` PROXY, not a measurement.** The
 * transcript records no per-tool-result token count, so the size of a
 * duplicate read is estimated from the JSON-encoded length of its
 * `tool_result` body. Every caller must label it as a proxy; this module names
 * the field `wasted_tokens_proxy` so the label cannot be dropped by accident.
 *
 * Read-only: no writes, no network, no spawn.
 */

import * as fs from 'node:fs';

/**
 * Tools whose result is a file body the model already holds after the first
 * call. Deliberately narrow: `Edit` and `Write` also carry a `file_path`, but
 * re-reading after a mutation is correct behaviour, not waste, so counting
 * them would manufacture "re-reads" out of the loop this measurement exists to
 * distinguish from.
 */
export const READ_SHAPED_TOOLS: ReadonlySet<string> = new Set(['Read', 'NotebookRead']);

/** One observed read-shaped tool call inside one leg. */
export interface ReadEvent {
    filePath: string;
    /** JSON-encoded length of the matching `tool_result` body; 0 when no result was recorded. */
    resultChars: number;
}

/** Per-path rollup across every leg that read it more than once. */
export interface RereadFile {
    file_path: string;
    /** Total read-shaped calls on this path, across all legs. */
    total_reads: number;
    /** Reads beyond the first WITHIN a leg, summed over legs. */
    duplicate_reads: number;
    /** Number of legs in which this path was read at least twice. */
    legs_with_reread: number;
    /** `chars / 4` proxy over the duplicate reads only — never a measurement. */
    wasted_tokens_proxy: number;
}

export interface RereadResult {
    legs_scanned: number;
    total_reads: number;
    duplicate_reads: number;
    wasted_tokens_proxy: number;
    /** Only paths with at least one duplicate, ranked by `wasted_tokens_proxy` desc. */
    files: RereadFile[];
}

function parseLine(line: string): Record<string, unknown> | null {
    const t = line.trim();
    if (t.length === 0) return null;
    try {
        const v = JSON.parse(t) as unknown;
        return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

function contentBlocks(rec: Record<string, unknown>): Array<Record<string, unknown>> {
    const msg = rec.message;
    if (!msg || typeof msg !== 'object' || Array.isArray(msg)) return [];
    const content = (msg as Record<string, unknown>).content;
    if (!Array.isArray(content)) return [];
    return content.filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && !Array.isArray(c));
}

function readPathOf(input: unknown): string | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
    const o = input as Record<string, unknown>;
    for (const key of ['file_path', 'filePath', 'notebook_path', 'notebookPath']) {
        const v = o[key];
        if (typeof v === 'string' && v.length > 0) return v;
    }
    return null;
}

/**
 * Every read-shaped call in one leg, in call order, each paired with the size
 * of its result.
 *
 * Two passes on purpose: a `tool_result` can only be matched by
 * `tool_use_id`, and nothing guarantees it appears after its `tool_use` in
 * file order once a transcript has been resumed or replayed. An unreadable or
 * malformed file yields `[]` — this is instrumentation, and a measurement that
 * throws on one bad leg reports nothing about the other two thousand.
 */
export function collectReadEvents(file: string): ReadEvent[] {
    let text: string;
    try {
        text = fs.readFileSync(file, 'utf-8');
    } catch {
        return [];
    }

    const order: Array<{ id: string | null; filePath: string }> = [];
    const sizes = new Map<string, number>();

    for (const line of text.split('\n')) {
        const rec = parseLine(line);
        if (!rec) continue;
        for (const block of contentBlocks(rec)) {
            if (block.type === 'tool_use') {
                if (typeof block.name !== 'string' || !READ_SHAPED_TOOLS.has(block.name)) continue;
                const filePath = readPathOf(block.input);
                if (filePath === null) continue;
                order.push({ id: typeof block.id === 'string' ? block.id : null, filePath });
            } else if (block.type === 'tool_result') {
                const id = block.tool_use_id ?? block.toolUseId;
                if (typeof id !== 'string') continue;
                let chars = 0;
                try {
                    chars = JSON.stringify(block.content ?? '').length;
                } catch {
                    chars = 0;
                }
                sizes.set(id, chars);
            }
        }
    }

    return order.map((o) => ({
        filePath: o.filePath,
        resultChars: o.id === null ? 0 : (sizes.get(o.id) ?? 0),
    }));
}

const CHARS_PER_TOKEN_PROXY = 4;

/**
 * Roll every leg up into a per-path re-read ranking.
 *
 * The duplicate count is per leg: the first read of a path in a leg is the
 * cost of knowing it, every later read in the SAME leg is the waste. Legs are
 * never joined, so a path read once in each of two legs contributes zero
 * duplicates — see the module doc.
 */
export function computeRereads(files: readonly string[]): RereadResult {
    const acc = new Map<string, RereadFile>();
    let legsScanned = 0;
    let totalReads = 0;

    for (const file of files) {
        const events = collectReadEvents(file);
        legsScanned += 1;
        if (events.length === 0) continue;

        const seenInLeg = new Map<string, number>();
        for (const ev of events) {
            totalReads += 1;
            const priorInLeg = seenInLeg.get(ev.filePath) ?? 0;
            seenInLeg.set(ev.filePath, priorInLeg + 1);

            const row = acc.get(ev.filePath) ?? {
                file_path: ev.filePath,
                total_reads: 0,
                duplicate_reads: 0,
                legs_with_reread: 0,
                wasted_tokens_proxy: 0,
            };
            row.total_reads += 1;
            if (priorInLeg >= 1) {
                row.duplicate_reads += 1;
                row.wasted_tokens_proxy += Math.round(ev.resultChars / CHARS_PER_TOKEN_PROXY);
                if (priorInLeg === 1) row.legs_with_reread += 1;
            }
            acc.set(ev.filePath, row);
        }
    }

    const withDuplicates = [...acc.values()].filter((r) => r.duplicate_reads > 0);
    withDuplicates.sort(
        (a, b) =>
            b.wasted_tokens_proxy - a.wasted_tokens_proxy ||
            b.duplicate_reads - a.duplicate_reads ||
            a.file_path.localeCompare(b.file_path),
    );

    return {
        legs_scanned: legsScanned,
        total_reads: totalReads,
        duplicate_reads: withDuplicates.reduce((s, r) => s + r.duplicate_reads, 0),
        wasted_tokens_proxy: withDuplicates.reduce((s, r) => s + r.wasted_tokens_proxy, 0),
        files: withDuplicates,
    };
}
