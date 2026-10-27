/**
 * Decisions lane: architecture decision records become `decision` facts, with
 * `supersedes` between them and `governs` from a record to a file it names.
 *
 * Two layouts are read: front-matter records (`docs/decisions/ADR-NNN-*.md`,
 * keys `adr`, `status`, `date`, `supersedes`, `superseded_by`, `amends`,
 * `amended_by`) and MADR-style records under `docs/adr/` (number from the file
 * name, title from the first heading, status and links from a `Status:` line or
 * a `## Status` section). A `governs` link is drawn only for a path-qualified
 * mention that resolves to exactly one file in the repository; anything looser
 * is a name match, and a name match is not a decision about that file.
 */
import { WALK_SKIP_DIRS } from '../../scope.js';
import fs from 'node:fs';
import path from 'node:path';
import { gitProbe } from '../../../_lib/spawn_env.js';
import { spanHash, type LaneFact, type LaneOutput, type LaneRelation, type Witness } from '../lane_fact.js';

export interface ReadDecisionsOptions {
    /** Repository-relative files to resolve mentions against; defaults to `git ls-files`, then a bounded walk. */
    files?: readonly string[];
}

export interface DecisionsOutput extends LaneOutput {
    /** path mentions that named no single file, by reason */
    dropped: { ambiguous: number; unresolved: number };
}

interface AdrRecord {
    file: string;
    number: number;
    title: string;
    status: string;
    date: string;
    titleLine: number;
    titleText: string;
    supersedes: Link[];
    superseded_by: Link[];
    amends: number[];
    amended_by: number[];
    body: Array<{ line: number; text: string }>;
}

interface Link {
    number: number;
    line: number;
    text: string;
    partial: boolean;
}

const NONE = /^(?:—|-|–|none|n\/a|null|~)?$/i;
const WALK_SKIP = new Set(WALK_SKIP_DIRS);
const WALK_CAP = 50_000;

export function decisionId(n: number): string {
    return `decision:ADR-${n}`;
}

/** `ADR-268, ADR-118` · `206` · `ADR-255 (§ 4 only)` → numbers, qualifiers kept as `partial`. */
export function parseAdrRefs(value: string): Array<{ number: number; partial: boolean }> {
    // A Markdown link's target is a file name, not a qualifier.
    const v = value.replace(/\]\([^)]*\)/g, ']').trim();
    if (NONE.test(v)) return [];
    const out: Array<{ number: number; partial: boolean }> = [];
    // Split on commas outside parentheses: a qualifier may itself hold a comma.
    let depth = 0;
    let cur = '';
    const parts: string[] = [];
    for (const ch of v) {
        if (ch === '(') depth++;
        if (ch === ')') depth = Math.max(0, depth - 1);
        if (ch === ',' && depth === 0) {
            parts.push(cur);
            cur = '';
        } else cur += ch;
    }
    parts.push(cur);
    for (const part of parts) {
        const head = part.replace(/\(.*$/s, '');
        const m = /(?:ADR[-\s]?)?0*(\d+)/i.exec(head);
        if (!m) continue;
        out.push({ number: Number(m[1]), partial: /\(/.test(part) });
    }
    return out;
}

function numberFromFile(file: string): number | null {
    const base = path.posix.basename(file);
    const m = /^ADR[-_]?0*(\d+)/i.exec(base) ?? /^0*(\d+)[-_]/.exec(base);
    return m ? Number(m[1]) : null;
}

function parseRecord(file: string, text: string): AdrRecord | null {
    const lines = text.split(/\r?\n/);
    const rec: AdrRecord = {
        file,
        number: numberFromFile(file) ?? NaN,
        title: '',
        status: '',
        date: '',
        titleLine: 1,
        titleText: lines[0] ?? '',
        supersedes: [],
        superseded_by: [],
        amends: [],
        amended_by: [],
        body: [],
    };
    let i = 0;
    if (lines[0]?.trim() === '---') {
        for (i = 1; i < lines.length; i++) {
            const line = lines[i] ?? '';
            if (line.trim() === '---') {
                i++;
                break;
            }
            const m = /^([a-z_]+):\s*(.*)$/.exec(line);
            if (!m) continue;
            const [, key = '', value = ''] = m;
            const at = i + 1;
            const links = (): Link[] => parseAdrRefs(value).map((r) => ({ ...r, line: at, text: line }));
            if (key === 'adr' && /^\d+$/.test(value.trim())) rec.number = Number(value.trim());
            else if (key === 'status') rec.status = value.trim();
            else if (key === 'date') rec.date = value.trim();
            else if (key === 'title') rec.title = value.trim().replace(/^["']|["']$/g, '');
            else if (key === 'supersedes') rec.supersedes.push(...links());
            else if (key === 'superseded_by') rec.superseded_by.push(...links());
            else if (key === 'amends') rec.amends.push(...parseAdrRefs(value).map((r) => r.number));
            else if (key === 'amended_by') rec.amended_by.push(...parseAdrRefs(value).map((r) => r.number));
        }
    }
    const bodyStart = i;
    let inStatusSection = false;
    let inFence = false;
    for (let j = bodyStart; j < lines.length; j++) {
        const line = lines[j] ?? '';
        const at = j + 1;
        if (/^\s*(```|~~~)/.test(line)) inFence = !inFence;
        rec.body.push({ line: at, text: line });
        if (inFence) continue;
        const h1 = /^#\s+(.+?)\s*$/.exec(line);
        if (h1 && !rec.title) {
            rec.title = (h1[1] as string).replace(/^ADR[-\s]?\d+\s*[—:-]\s*/i, '').replace(/^\d+\.\s*/, '');
            rec.titleLine = at;
            rec.titleText = line;
            continue;
        }
        if (/^##\s+status\s*$/i.test(line)) {
            inStatusSection = true;
            continue;
        }
        if (/^#{1,6}\s/.test(line)) inStatusSection = false;
        const statusLine = /^\s*[-*]?\s*status:\s*(.+)$/i.exec(line);
        const statusText = statusLine ? (statusLine[1] as string) : inStatusSection && line.trim() ? line.trim() : null;
        if (statusText !== null) {
            if (!rec.status) rec.status = statusText.replace(/\s+(?:by|to)\b.*$/i, '').replace(/[[\]*_]/g, '').trim().toLowerCase();
            const by = /superseded\s+by\s+(.+)$/i.exec(statusText);
            if (by) rec.superseded_by.push(...parseAdrRefs(by[1] as string).map((r) => ({ ...r, line: at, text: line })));
            if (inStatusSection) inStatusSection = false;
        }
        if (!rec.date) {
            const d = /^\s*[-*]?\s*date:\s*(\S+)/i.exec(line);
            if (d) rec.date = d[1] as string;
        }
        const sup = /^\s*[-*]?\s*supersedes:?\s+(.+)$/i.exec(line);
        if (sup) rec.supersedes.push(...parseAdrRefs(sup[1] as string).map((r) => ({ ...r, line: at, text: line })));
    }
    if (!Number.isFinite(rec.number)) return null;
    if (!rec.title) rec.title = path.posix.basename(file, '.md');
    return rec;
}

function listFiles(root: string): string[] {
    try {
        return gitProbe(root, ['-c', 'core.quotePath=false', 'ls-files', '-z'], { maxBuffer: 256 * 1024 * 1024 })
            .split('\0')
            .filter(Boolean);
    } catch {
        const out: string[] = [];
        const walk = (rel: string): void => {
            if (out.length >= WALK_CAP) return;
            let entries: fs.Dirent[];
            try {
                entries = fs.readdirSync(path.join(root, rel), { withFileTypes: true });
            } catch {
                return;
            }
            for (const e of entries.sort((a, b) => (a.name < b.name ? -1 : 1))) {
                if (WALK_SKIP.has(e.name)) continue;
                const p = rel ? `${rel}/${e.name}` : e.name;
                if (e.isDirectory()) walk(p);
                else if (e.isFile()) out.push(p);
            }
        };
        walk('');
        return out;
    }
}

export function isDecisionFile(p: string): boolean {
    if (!p.endsWith('.md')) return false;
    const base = path.posix.basename(p);
    if (/^(README|index|template)/i.test(base)) return false;
    if (/(^|\/)docs\/decisions\/ADR-\d+[^/]*\.md$/i.test(p)) return true;
    return /(^|\/)docs\/adr\//.test(p) && /^(?:ADR[-_]?)?\d+[-_]/i.test(base);
}

const PATH_TOKEN = /(?:\.{0,2}\/)?[A-Za-z0-9_@.-]+(?:\/[A-Za-z0-9_@.-]+)+/g;

/** Path-qualified mentions on one line, URLs removed, `:line` suffixes cut. */
export function pathMentions(text: string): string[] {
    const clean = text.replace(/[a-z][a-z0-9+.-]*:\/\/\S+/gi, ' ');
    const out = new Set<string>();
    for (const m of clean.matchAll(PATH_TOKEN)) {
        const tok = m[0].replace(/^\.?\//, '').replace(/[.,;:]+$/, '');
        // A path names a file only if its last segment has an extension.
        if (!/\.[A-Za-z0-9]+$/.test(tok.split('/').pop() ?? '')) continue;
        out.add(tok);
    }
    return [...out];
}

function refs(ns: readonly number[]): string[] {
    return [...new Set(ns)].sort((a, b) => a - b).map((n) => `ADR-${n}`);
}

export function readDecisions(root: string, opts: ReadDecisionsOptions = {}): DecisionsOutput {
    const files = opts.files ? [...opts.files] : listFiles(root);
    const output: DecisionsOutput = { lane: 'decisions', facts: [], relations: [], skipped: [], dropped: { ambiguous: 0, unresolved: 0 } };
    const records: AdrRecord[] = [];
    for (const f of files.filter(isDecisionFile).sort()) {
        let text: string;
        try {
            text = fs.readFileSync(path.join(root, f), 'utf-8');
        } catch {
            output.skipped.push({ file: f, reason: 'unreadable' });
            continue;
        }
        const rec = parseRecord(f, text);
        if (!rec) {
            output.skipped.push({ file: f, reason: 'no ADR number in file name or front matter' });
            continue;
        }
        records.push(rec);
    }
    const byNumber = new Map<number, AdrRecord>();
    for (const r of records) {
        if (byNumber.has(r.number)) {
            output.skipped.push({ file: r.file, reason: `duplicate ADR number ${r.number}` });
            continue;
        }
        byNumber.set(r.number, r);
    }

    const w = (file: string, line: number, text: string): Witness => ({ file, line, hash: spanHash(text) });
    const facts: LaneFact[] = [];
    const relations = new Map<string, LaneRelation>();
    const addSupersedes = (newer: number, older: number, src: AdrRecord, link: Link): void => {
        if (newer === older) return;
        if (!byNumber.has(newer) || !byNumber.has(older)) {
            output.skipped.push({ file: src.file, reason: `supersedes link to missing ADR-${byNumber.has(newer) ? older : newer}` });
            return;
        }
        const key = `${newer}>${older}`;
        const prev = relations.get(key);
        if (prev) {
            // Both records state it: keep the newer record's own line as the witness.
            if (src.number === newer) prev.witness = w(src.file, link.line, link.text);
            return;
        }
        relations.set(key, {
            relation: 'supersedes',
            from: decisionId(newer),
            to: decisionId(older),
            attrs: { partial: link.partial },
            witness: w(src.file, link.line, link.text),
            rung: 'T1',
            owner: src.file,
            guess: false,
        });
    };

    // Every trailing run of path segments → the files ending in it, so a
    // mention resolves in one lookup however large the repository is.
    const bySuffix = new Map<string, string[]>();
    for (const f of files) {
        const segs = f.split('/');
        for (let k = 0; k < segs.length; k++) {
            const suffix = segs.slice(k).join('/');
            const list = bySuffix.get(suffix);
            if (list) list.push(f);
            else bySuffix.set(suffix, [f]);
        }
    }
    const governs: LaneRelation[] = [];
    for (const r of byNumber.values()) {
        facts.push({
            kind: 'decision',
            id: decisionId(r.number),
            name: `ADR-${r.number} — ${r.title}`,
            attrs: {
                number: r.number,
                title: r.title,
                status: r.status || null,
                date: r.date || null,
                supersedes: refs(r.supersedes.map((l) => l.number)),
                superseded_by: refs(r.superseded_by.map((l) => l.number)),
                amends: refs(r.amends),
                amended_by: refs(r.amended_by),
            },
            witness: w(r.file, r.titleLine, r.titleText),
            rung: 'T1',
            owner: r.file,
        });
        for (const l of r.supersedes) addSupersedes(r.number, l.number, r, l);
        for (const l of r.superseded_by) addSupersedes(l.number, r.number, r, l);

        const seen = new Set<string>();
        for (const { line, text } of r.body) {
            for (const mention of pathMentions(text)) {
                const hits = bySuffix.get(mention) ?? [];
                if (hits.length === 0) {
                    output.dropped.unresolved++;
                    continue;
                }
                if (hits.length > 1) {
                    output.dropped.ambiguous++;
                    continue;
                }
                const target = hits[0] as string;
                // A record naming itself or another record is a citation, not governance.
                if (target === r.file || isDecisionFile(target) || seen.has(target)) continue;
                seen.add(target);
                governs.push({
                    relation: 'governs',
                    from: decisionId(r.number),
                    to: target,
                    attrs: { mention },
                    witness: w(r.file, line, text),
                    rung: 'T1',
                    owner: r.file,
                    guess: false,
                });
            }
        }
    }
    output.facts = facts.sort((a, b) => Number(a.attrs.number) - Number(b.attrs.number));
    output.relations = [...relations.values(), ...governs];
    return output;
}
