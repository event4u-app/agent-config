#!/usr/bin/env tsx
/**
 * check_voice_lexicon — "never say X" and "this claim needs a proof", checked
 * deterministically on a FINISHED draft (brand-checkability roadmap 5.1-5.3).
 *
 * Three sources of terms, one escaped-literal matcher (word or substring,
 * case-insensitive, never a regex — NG-6):
 *   - the brand-voice slot's `avoid`        → `warning` (flags, never blocks)
 *   - a ghostwriter profile's `taboos`      → `error`   (the draft aborts, as documented)
 *   - the user file's `style.avoid`         → `warning` (5.5; absent means none)
 *
 * Plus the static claim-phrase registry (`_lib/claim_phrases.ts`): a phrase hit
 * whose sentence carries no live slot `claims[]` text is an `unbacked-claim`
 * finding — "needs proof", never "unlawful" (NG-10). German phrases are hints.
 *
 * Plus the AI-tell detector with the slot's `tell_exemptions` passed as its
 * `exclude` set; tells are reported beside the findings and never change the
 * exit code.
 *
 * Exemptions follow the detector's own (`stripExempt` in detect_ai_tells):
 * frontmatter, fenced and inline code, blockquote (cited) lines, URLs and quoted
 * spans are never scanned. They are blanked IN PLACE rather than removed, so a
 * finding's line and column point at the draft the reader has open.
 *
 * Exit: 0 no error-severity finding · 1 an error-severity finding (a ghostwriter
 * taboo) · 2 unusable invocation or an invalid slot. An empty lexicon is reported
 * as SKIPPED with its reason, never as a clean pass.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_voice_lexicon --draft <file | ->
 *     [--slot agents/context-spine/brand-voice.md] [--ghostwriter <profile.md>]
 *     [--user .agent-user.md]
 *     [--json] [--now YYYY-MM-DD]
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { userStyleAvoidSchema } from '../shared/userMd/schema.js';
import { parseLegacyUserMd, parseUserIdentity } from '../shared/userMd/utils.js';

import { ALL_TELL_RULES } from './ai_tells_rules.js';
import { analyzeText, MAX_SCAN_CHARS, type RuleHit } from './detect_ai_tells.js';
import { _classify } from './lint_hidden_unicode.js';
import { parseBrandVoiceSlot, slotDay, validateBrandVoiceSlotText, type ClaimEntry } from './_lib/brand_voice_slot.js';
import { CLAIM_PHRASES, type ClaimClass } from './_lib/claim_phrases.js';
import { DeadScopeError, assertScanned } from './_lib/scan_scope.js';

export type TermSource = 'brand' | 'ghostwriter' | 'user';
export type Severity = 'error' | 'warning' | 'hint';

export interface LexiconTerm {
    term: string;
    match: 'word' | 'substring';
    source: TermSource;
    note?: string;
}

export interface Finding {
    kind: 'avoid' | 'unbacked-claim' | 'hidden-unicode';
    severity: Severity;
    line: number;
    column: number;
    text: string;
    source?: TermSource;
    note?: string;
    claim_class?: ClaimClass;
}

const SEVERITY_BY_SOURCE: Record<TermSource, Severity> = { brand: 'warning', ghostwriter: 'error', user: 'warning' };

function blank(s: string): string {
    return s.replace(/[^\n]/g, ' ');
}

/**
 * The detector's exemption set, blanked in place: same length, same line breaks,
 * so offsets into the result are offsets into the draft.
 */
export function blankExempt(text: string): string {
    let t = text.replace(/^---\n[\s\S]*?\n---\n/, blank);
    t = t.replace(/```[\s\S]*?```/g, blank).replace(/~~~[\s\S]*?~~~/g, blank);
    t = t.replace(/`[^`\n]*`/g, blank);
    t = t.replace(/^\s*>.*$/gm, blank);
    t = t.replace(/https?:\/\/\S+/g, blank);
    t = t
        .replace(/"[^"\n]{1,300}"/g, blank)
        // German low-high quotes close on “, the English opener, so they run first.
        .replace(/„[^“\n]{1,300}“/g, blank)
        .replace(/“[^”\n]{1,300}”/g, blank)
        .replace(/(^|[\s([{"“])'([^'\n]{1,120})'(?=[\s)\]},.!?;:"”]|$)/g, (m, lead: string, inner: string) =>
            inner.includes(' ') ? lead + blank(m.slice(lead.length)) : m,
        );
    return t;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function literalRegex(term: string, match: 'word' | 'substring'): RegExp {
    const body = escapeRegex(term);
    return match === 'word'
        ? new RegExp(`(?<![\\p{L}\\p{N}_])${body}(?![\\p{L}\\p{N}_])`, 'giu')
        : new RegExp(body, 'giu');
}

function locator(text: string): (index: number) => { line: number; column: number } {
    const starts = [0];
    for (let i = 0; i < text.length; i += 1) if (text[i] === '\n') starts.push(i + 1);
    return (index) => {
        let lo = 0;
        let hi = starts.length - 1;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if ((starts[mid] as number) <= index) lo = mid;
            else hi = mid - 1;
        }
        return { line: lo + 1, column: index - (starts[lo] as number) + 1 };
    };
}

/** Every avoid/taboo hit outside the exempt regions, located in the original draft. */
export function scanLexicon(text: string, terms: readonly LexiconTerm[]): Finding[] {
    const scanned = blankExempt(text);
    const locate = locator(text);
    const found: Array<Finding & { index: number }> = [];
    for (const t of terms) {
        for (const m of scanned.matchAll(literalRegex(t.term, t.match))) {
            const index = m.index ?? 0;
            found.push({
                kind: 'avoid',
                severity: SEVERITY_BY_SOURCE[t.source],
                ...locate(index),
                text: text.slice(index, index + m[0].length),
                source: t.source,
                ...(t.note !== undefined ? { note: t.note } : {}),
                index,
            });
        }
    }
    return found.sort((a, b) => a.index - b.index).map(({ index: _i, ...f }) => f);
}

/** The sentence around `index`: bounded by `.`/`!`/`?` + whitespace, or a blank line. */
function sentenceAt(text: string, index: number): string {
    const before = text.slice(0, index);
    const startMatch = [...before.matchAll(/[.!?](?=\s)|\n\s*\n/g)].pop();
    const start = startMatch === undefined ? 0 : (startMatch.index ?? 0) + startMatch[0].length;
    const rest = text.slice(index);
    const end = rest.search(/[.!?](?=\s|$)|\n\s*\n/);
    return text.slice(start, end === -1 ? text.length : index + end + 1);
}

/**
 * Claim-phrase hits. A hit is backed when its sentence contains the `text` of a
 * live `claims[]` entry (case-insensitive); an entry past its `expires` day backs
 * nothing and the finding names the expiry.
 */
export function scanClaims(text: string, claims: readonly ClaimEntry[], now: Date): Finding[] {
    const scanned = blankExempt(text);
    const locate = locator(text);
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const hits: Array<{ index: number; length: number; cls: ClaimClass; severity: Severity }> = [];
    for (const p of CLAIM_PHRASES) {
        for (const m of scanned.matchAll(literalRegex(p.phrase, 'word'))) {
            hits.push({ index: m.index ?? 0, length: m[0].length, cls: p.cls, severity: p.language === 'en' ? 'warning' : 'hint' });
        }
    }
    // Overlapping phrases ("industry-leading" inside a longer hit) report once, the longest.
    hits.sort((a, b) => a.index - b.index || b.length - a.length);
    const kept: typeof hits = [];
    for (const h of hits) {
        const last = kept[kept.length - 1];
        if (last !== undefined && h.index < last.index + last.length) continue;
        kept.push(h);
    }
    const findings: Finding[] = [];
    for (const h of kept) {
        const sentence = sentenceAt(scanned, h.index).toLowerCase();
        const covering = claims.filter((c) => c.text.trim() !== '' && sentence.includes(c.text.toLowerCase()));
        const live = covering.filter((c) => {
            const day = slotDay(c.expires);
            return day === null || Date.parse(`${day}T00:00:00Z`) >= today;
        });
        if (live.length > 0) continue;
        const expired = covering.map((c) => slotDay(c.expires)).filter((d): d is string => d !== null);
        findings.push({
            kind: 'unbacked-claim',
            severity: h.severity,
            ...locate(h.index),
            text: text.slice(h.index, h.index + h.length),
            claim_class: h.cls,
            note:
                expired.length > 0
                    ? `needs proof: the claim entry covering it expired ${expired.sort().pop() as string}`
                    : 'needs proof: no claims[] entry in the brand-voice slot backs this sentence',
        });
    }
    return findings;
}

function hiddenUnicodeFindings(text: string): Finding[] {
    const locate = locator(text);
    const first = new Map<string, { index: number; count: number }>();
    let i = 0;
    for (const ch of text) {
        const cls = _classify(ch.codePointAt(0) as number);
        if (cls !== null) {
            const e = first.get(cls) ?? { index: i, count: 0 };
            e.count += 1;
            first.set(cls, e);
        }
        i += ch.length;
    }
    return [...first.entries()].map(([cls, e]) => ({
        kind: 'hidden-unicode' as const,
        severity: 'warning' as const,
        ...locate(e.index),
        text: cls,
        note: `${e.count} hidden character(s) of class ${cls}; never strip silently — inspect the source`,
    }));
}

export interface CheckOptions {
    terms: readonly LexiconTerm[];
    claims: readonly ClaimEntry[];
    tellExemptions: readonly string[];
    now: Date;
}

export interface CheckReport {
    findings: Finding[];
    tells: Array<Pick<RuleHit, 'id' | 'severity' | 'count'>>;
    truncated: boolean;
}

export function checkDraft(text: string, opts: CheckOptions): CheckReport {
    const truncated = text.length > MAX_SCAN_CHARS;
    const scanned = truncated ? text.slice(0, MAX_SCAN_CHARS) : text;
    const tellReport = analyzeText(scanned, 'auto', { exclude: new Set(opts.tellExemptions) });
    const findings = [
        ...hiddenUnicodeFindings(scanned),
        ...scanLexicon(scanned, opts.terms),
        ...scanClaims(scanned, opts.claims, opts.now),
    ].sort((a, b) => a.line - b.line || a.column - b.column);
    const tells = [...tellReport.hard_hits, ...tellReport.cluster_hits].map((h) => ({
        id: h.id,
        severity: h.severity,
        count: h.count,
    }));
    return { findings, tells, truncated };
}

/** Tell ids the detector registry does not know. */
export function unknownTellIds(ids: readonly string[]): string[] {
    const known = new Set(ALL_TELL_RULES.map((r) => r.id));
    return ids.filter((id) => !known.has(id));
}

/** The slot's `avoid` list as brand terms. Assumes a slot that validated. */
export function lexiconFromSlot(slotText: string): LexiconTerm[] {
    const data = parseBrandVoiceSlot(slotText).data ?? {};
    const avoid = Array.isArray(data['avoid']) ? (data['avoid'] as Array<Record<string, unknown>>) : [];
    return avoid.map((a) => ({
        term: String(a['term']),
        match: a['match'] === 'substring' ? ('substring' as const) : ('word' as const),
        source: 'brand' as const,
        ...(typeof a['note'] === 'string' ? { note: a['note'] } : {}),
    }));
}

export function claimsFromSlot(slotText: string): ClaimEntry[] {
    const data = parseBrandVoiceSlot(slotText).data ?? {};
    const claims = Array.isArray(data['claims']) ? (data['claims'] as Array<Record<string, unknown>>) : [];
    return claims.map((c) => {
        const day = slotDay(c['expires']);
        return { text: String(c['text'] ?? ''), evidence_ref: String(c['evidence_ref'] ?? ''), ...(day !== null ? { expires: day } : {}) };
    });
}

export function tellExemptionsFromSlot(slotText: string): string[] {
    const data = parseBrandVoiceSlot(slotText).data ?? {};
    return Array.isArray(data['tell_exemptions']) ? data['tell_exemptions'].map(String) : [];
}

/** A ghostwriter profile's `taboos`, each a literal phrase matched as words. */
export function lexiconFromGhostwriter(profileText: string): LexiconTerm[] {
    const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(profileText);
    if (m === null) return [];
    let data: unknown;
    try {
        data = parseYaml(m[1] as string, { maxAliasCount: 0 });
    } catch {
        return [];
    }
    const taboos = typeof data === 'object' && data !== null ? (data as Record<string, unknown>)['taboos'] : undefined;
    return (Array.isArray(taboos) ? taboos : [])
        .filter((t): t is string => typeof t === 'string' && t.trim() !== '')
        .map((t) => ({ term: t.trim(), match: 'word' as const, source: 'ghostwriter' as const }));
}

/** The raw `style.avoid` of a user file — fenced `.agent-user.md` or bare `.agent-user.yml`. */
function rawUserAvoid(profileText: string): unknown {
    let data: Record<string, unknown>;
    try {
        data = /^---\r?\n/.test(profileText) ? parseLegacyUserMd(profileText) : parseUserIdentity(profileText);
    } catch {
        return undefined;
    }
    const style = data['style'];
    return typeof style === 'object' && style !== null ? (style as Record<string, unknown>)['avoid'] : undefined;
}

/** Schema issues in the user file's `style.avoid`; empty when it is valid or absent. */
export function validateUserAvoid(profileText: string): string[] {
    const raw = rawUserAvoid(profileText);
    if (raw === undefined) return [];
    const parsed = userStyleAvoidSchema.safeParse(raw);
    return parsed.success ? [] : parsed.error.issues.map((i) => `style.avoid${i.path.map((p) => `[${String(p)}]`).join('')}: ${i.message}`);
}

/** The user file's `style.avoid` as user terms. An absent or invalid list loads none. */
export function lexiconFromUserProfile(profileText: string): LexiconTerm[] {
    const parsed = userStyleAvoidSchema.safeParse(rawUserAvoid(profileText) ?? []);
    if (!parsed.success) return [];
    return parsed.data.map((a) => ({
        term: a.pattern,
        match: a.match,
        source: 'user' as const,
        ...(a.note !== undefined ? { note: a.note } : {}),
    }));
}

interface Args {
    draft: string;
    slot: string | null;
    ghostwriter: string | null;
    user: string | null;
    json: boolean;
    now: Date;
}

function parseArgs(argv: readonly string[]): Args | string {
    let draft: string | null = null;
    let slot: string | null = null;
    let ghostwriter: string | null = null;
    let user: string | null = null;
    let json = false;
    let now = new Date();
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (): string | null => (i + 1 < argv.length ? (argv[++i] as string) : null);
        if (a === '--json') json = true;
        else if (a === '--draft') draft = value();
        else if (a === '--slot') slot = value();
        else if (a === '--ghostwriter') ghostwriter = value();
        else if (a === '--user') user = value();
        else if (a === '--now') {
            const v = value();
            if (v === null || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return '--now takes a YYYY-MM-DD day';
            now = new Date(`${v}T12:00:00Z`);
        } else return `unknown argument: ${a}`;
    }
    if (draft === null) return 'usage: check_voice_lexicon --draft <file> [--slot <file>] [--ghostwriter <file>] [--user <file>] [--json] [--now YYYY-MM-DD]';
    return { draft, slot, ghostwriter, user, json, now };
}

/**
 * Read stdin to EOF. fd 0 may arrive non-blocking (a host pipe, or any earlier
 * `process.stdin` access), where `readFileSync(0)` throws EAGAIN mid-payload;
 * so read in chunks and wait out EAGAIN. Like `cat`, an unpiped TTY waits for
 * input — the drafting surfaces always pipe.
 */
function readStdin(): string | null {
    const chunks: Buffer[] = [];
    const buf = Buffer.alloc(65536);
    const pause = new Int32Array(new SharedArrayBuffer(4));
    for (;;) {
        let n: number;
        try {
            n = fs.readSync(0, buf, 0, buf.length, null);
        } catch (exc) {
            if ((exc as NodeJS.ErrnoException).code === 'EAGAIN') {
                Atomics.wait(pause, 0, 0, 10);
                continue;
            }
            return null;
        }
        if (n === 0) return Buffer.concat(chunks).toString('utf-8');
        chunks.push(Buffer.from(buf.subarray(0, n)));
    }
}

/**
 * A drafting command prints its draft as ONE fenced block, and fenced text is
 * exempt — so a draft piped as printed would scan as empty. When the whole input
 * is a single fence, blank the two fence lines and scan the body; offsets hold.
 */
export function unwrapSingleFence(text: string): string {
    const lines = text.split('\n');
    const first = lines.findIndex((l) => l.trim() !== '');
    let last = lines.length - 1;
    while (last > first && (lines[last] ?? '').trim() === '') last -= 1;
    const open = /^\s*(`{3,}|~{3,})/.exec(lines[first] ?? '');
    if (first < 0 || last <= first || open === null) return text;
    const fence = open[1] as string;
    const closeRe = new RegExp(`^\\s*${fence[0] === '`' ? '`' : '~'}{${fence.length},}\\s*$`);
    if (!closeRe.test(lines[last] ?? '')) return text;
    const blank = (l: string): string => l.replace(/[^\n]/g, ' ');
    lines[first] = blank(lines[first] as string);
    lines[last] = blank(lines[last] as string);
    return lines.join('\n');
}

function readOrNull(p: string): string | null {
    try {
        return fs.readFileSync(p, 'utf-8');
    } catch {
        return null;
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const args = parseArgs(argv);
    if (typeof args === 'string') {
        process.stderr.write(`${args}\n`);
        return 2;
    }
    // `-` reads stdin: a drafting command that prints only must not write its draft to disk.
    const raw = args.draft === '-' ? readStdin() : readOrNull(args.draft);
    if (raw === null) {
        process.stderr.write(`draft not readable: ${args.draft === '-' ? 'stdin (pipe the draft)' : args.draft}\n`);
        return 2;
    }
    if (raw.trim() === '') {
        process.stderr.write(`draft is empty: ${args.draft === '-' ? 'stdin (pipe the draft)' : args.draft}\n`);
        return 2;
    }
    const draft = unwrapSingleFence(raw);
    const terms: LexiconTerm[] = [];
    let claims: ClaimEntry[] = [];
    let tellExemptions: string[] = [];
    const sources: string[] = [];
    if (args.slot !== null) {
        const slotText = readOrNull(args.slot);
        if (slotText === null) {
            process.stderr.write(`slot not readable: ${args.slot}\n`);
            return 2;
        }
        const issues = validateBrandVoiceSlotText(slotText);
        if (issues.length > 0) {
            process.stderr.write(`invalid brand-voice slot ${args.slot}:\n`);
            for (const i of issues) process.stderr.write(`  - ${i.field}: ${i.message}\n`);
            return 2;
        }
        terms.push(...lexiconFromSlot(slotText));
        claims = claimsFromSlot(slotText);
        tellExemptions = tellExemptionsFromSlot(slotText);
        sources.push(args.slot);
    }
    if (args.ghostwriter !== null) {
        const profile = readOrNull(args.ghostwriter);
        if (profile === null) {
            process.stderr.write(`ghostwriter profile not readable: ${args.ghostwriter}\n`);
            return 2;
        }
        terms.push(...lexiconFromGhostwriter(profile));
        sources.push(args.ghostwriter);
    }
    if (args.user !== null) {
        const userText = readOrNull(args.user);
        if (userText === null) {
            process.stderr.write(`user file not readable: ${args.user}\n`);
            return 2;
        }
        const issues = validateUserAvoid(userText);
        if (issues.length > 0) {
            process.stderr.write(`invalid user file ${args.user}:\n`);
            for (const i of issues) process.stderr.write(`  - ${i}\n`);
            return 2;
        }
        terms.push(...lexiconFromUserProfile(userText));
        sources.push(args.user);
    }
    let lexicon: { status: 'scanned'; terms: number } | { status: 'skipped'; reason: string };
    try {
        assertScanned({ gate: 'check_voice_lexicon', scanned: terms.length, units: 'lexicon term(s)', roots: sources });
        lexicon = { status: 'scanned', terms: terms.length };
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        lexicon = { status: 'skipped', reason: exc.message };
    }
    const report = checkDraft(draft, { terms, claims, tellExemptions, now: args.now });
    const failed = report.findings.some((f) => f.severity === 'error');
    if (args.json) {
        process.stdout.write(`${JSON.stringify({ draft: args.draft, lexicon, ...report }, null, 2)}\n`);
    } else {
        if (lexicon.status === 'skipped') process.stdout.write(`lexicon: SKIPPED — ${lexicon.reason}\n`);
        for (const f of report.findings) {
            const note = f.note !== undefined ? ` — ${f.note}` : '';
            process.stdout.write(`${args.draft}:${f.line}:${f.column} ${f.severity} ${f.kind} "${f.text}"${note}\n`);
        }
        for (const t of report.tells) process.stdout.write(`tell ${t.id} ×${t.count} (${t.severity})\n`);
        if (report.truncated) process.stdout.write(`⚠️  draft truncated to ${MAX_SCAN_CHARS} chars for scanning\n`);
        if (report.findings.length === 0) process.stdout.write('no lexicon or claim findings\n');
    }
    return failed ? 1 : 0;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
