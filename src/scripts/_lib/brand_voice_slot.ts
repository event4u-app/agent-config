/**
 * The `brand-voice` context-spine slot — the first slot whose frontmatter is
 * machine-read (docs/contracts/adr-gtm-context-spine-brand-voice.md).
 *
 * Parses `agents/context-spine/brand-voice.md` and validates its frontmatter as
 * DATA: a closed field set (no visual fields, so the slot cannot become a second
 * token store), bounded lists, hidden-Unicode refusal anywhere in the file, and
 * references restricted to repo-relative paths or URLs. Nothing here follows a
 * sample or a reference; readers never execute slot content.
 */
import * as fs from 'node:fs';

import { parse as parseYaml } from 'yaml';

import { ALL_TELL_RULES } from '../ai_tells_rules.js';
import { scanHiddenUnicode } from '../detect_ai_tells.js';

export interface SlotIssue {
    field: string;
    message: string;
}

export interface AvoidEntry {
    term: string;
    match: 'word' | 'substring';
    note?: string;
}

export interface ClaimEntry {
    text: string;
    evidence_ref: string;
    expires?: string;
}

export interface BrandVoiceSlot {
    version: number;
    attributes: Array<{ is: string; is_not: string; proof: string }>;
    tone_by_context?: Array<Record<string, unknown>>;
    avoid?: AvoidEntry[];
    claims?: ClaimEntry[];
    tell_exemptions?: string[];
    samples?: string[];
    customer_language?: string[];
    provenance: {
        sources: Array<{ ref: string; tier: string }>;
        confidence: 'low' | 'med' | 'high';
        last_reviewed_at: string;
    };
    changelog?: string[];
    open_questions?: Array<{ question: string; recommendation: string }>;
}

export const SLOT_FIELDS = [
    'version',
    'attributes',
    'tone_by_context',
    'avoid',
    'claims',
    'tell_exemptions',
    'samples',
    'customer_language',
    'provenance',
    'changelog',
    'open_questions',
] as const;
export const SOURCE_TIERS = ['authoritative', 'operational', 'conversational', 'external-untrusted'] as const;
export const MAX_AVOID = 32;
export const MAX_TERM_CHARS = 64;
export const MAX_SAMPLES = 3;
export const MAX_SAMPLE_WORDS = 200;

type Obj = Record<string, unknown>;

const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isText = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** YAML turns an unquoted 2026-10-01 into a Date; the slot stores the day. */
function asDay(v: unknown): string | null {
    if (v instanceof Date && !Number.isNaN(v.getTime())) return v.toISOString().slice(0, 10);
    return typeof v === 'string' && DATE.test(v) ? v : null;
}

/** A repo-relative path or an http(s) URL — never absolute, never escaping the repository. */
export function isSafeRef(ref: unknown): boolean {
    if (!isText(ref)) return false;
    if (/^https?:\/\/\S+$/.test(ref)) return true;
    if (/^(?:[/\\~]|[A-Za-z]:)/.test(ref) || /^[a-z][a-z0-9+.-]*:/i.test(ref)) return false;
    return !ref.split(/[/\\]/).includes('..');
}

function frontmatterOf(text: string): string | null {
    const m = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    return m === null ? null : (m[1] as string);
}

/** Parse the slot's frontmatter. `data` is null when there is none or it is not a mapping. */
export function parseBrandVoiceSlot(text: string): { data: Obj | null; issues: SlotIssue[] } {
    const fm = frontmatterOf(text);
    if (fm === null) return { data: null, issues: [{ field: 'frontmatter', message: 'no --- frontmatter block' }] };
    let data: unknown;
    try {
        data = parseYaml(fm, { maxAliasCount: 0 });
    } catch (exc) {
        return { data: null, issues: [{ field: 'frontmatter', message: `not YAML: ${(exc as Error).message.split('\n')[0]}` }] };
    }
    if (!isObj(data)) return { data: null, issues: [{ field: 'frontmatter', message: 'not a mapping' }] };
    return { data, issues: [] };
}

function stringList(v: unknown, field: string, issues: SlotIssue[]): void {
    if (v === undefined) return;
    if (!Array.isArray(v) || !v.every(isText)) issues.push({ field, message: 'must be a list of non-empty strings' });
}

/** Every schema and data-safety issue in a slot file's text. Empty means valid. */
export function validateBrandVoiceSlotText(text: string): SlotIssue[] {
    const issues: SlotIssue[] = [];
    const hidden = scanHiddenUnicode(text);
    if (hidden.length > 0) {
        issues.push({
            field: 'hidden-unicode',
            message: hidden.map((h) => `${h.cls} ×${h.count} (${h.sample_codepoints.join(', ')})`).join('; '),
        });
    }
    const { data, issues: parseIssues } = parseBrandVoiceSlot(text);
    if (data === null) return [...parseIssues, ...issues];

    for (const key of Object.keys(data)) {
        if (!(SLOT_FIELDS as readonly string[]).includes(key)) {
            issues.push({ field: key, message: `unknown field (allowed: ${SLOT_FIELDS.join(', ')})` });
        }
    }

    if (!Number.isInteger(data['version']) || (data['version'] as number) < 1) {
        issues.push({ field: 'version', message: 'must be a positive integer' });
    }

    const attrs = data['attributes'];
    if (!Array.isArray(attrs) || attrs.length !== 3) {
        issues.push({ field: 'attributes', message: 'must list exactly three {is, is_not, proof} attributes' });
    }
    const attrNames = new Set<string>();
    (Array.isArray(attrs) ? attrs : []).forEach((a, i) => {
        for (const k of ['is', 'is_not', 'proof']) {
            if (!isObj(a) || !isText(a[k])) issues.push({ field: `attributes[${i}].${k}`, message: 'must be non-empty text' });
        }
        if (isObj(a) && isText(a['is'])) attrNames.add(a['is']);
    });

    const tone = data['tone_by_context'];
    if (tone !== undefined && !Array.isArray(tone)) issues.push({ field: 'tone_by_context', message: 'must be a list' });
    (Array.isArray(tone) ? tone : []).forEach((t, i) => {
        for (const k of ['context', 'audience_state', 'lead_attribute']) {
            if (!isObj(t) || !isText(t[k])) issues.push({ field: `tone_by_context[${i}].${k}`, message: 'must be non-empty text' });
        }
        if (isObj(t) && isText(t['lead_attribute']) && attrNames.size > 0 && !attrNames.has(t['lead_attribute'])) {
            issues.push({ field: `tone_by_context[${i}].lead_attribute`, message: 'must name one of the attributes' });
        }
        if (isObj(t)) {
            stringList(t['amplify'], `tone_by_context[${i}].amplify`, issues);
            stringList(t['mute'], `tone_by_context[${i}].mute`, issues);
        }
    });

    const avoid = data['avoid'];
    if (avoid !== undefined && (!Array.isArray(avoid) || avoid.length > MAX_AVOID)) {
        issues.push({ field: 'avoid', message: `must be a list of at most ${MAX_AVOID} entries` });
    }
    (Array.isArray(avoid) ? avoid : []).forEach((a, i) => {
        const term = isObj(a) ? a['term'] : undefined;
        if (typeof term !== 'string' || term.trim().length === 0 || [...term].length > MAX_TERM_CHARS) {
            issues.push({ field: `avoid[${i}].term`, message: `must be 1-${MAX_TERM_CHARS} characters of literal text` });
        }
        if (!isObj(a) || (a['match'] !== 'word' && a['match'] !== 'substring')) {
            issues.push({ field: `avoid[${i}].match`, message: 'must be word or substring (no regex)' });
        }
        if (isObj(a) && a['note'] !== undefined && typeof a['note'] !== 'string') {
            issues.push({ field: `avoid[${i}].note`, message: 'must be text' });
        }
    });

    const claims = data['claims'];
    if (claims !== undefined && !Array.isArray(claims)) issues.push({ field: 'claims', message: 'must be a list' });
    (Array.isArray(claims) ? claims : []).forEach((c, i) => {
        if (!isObj(c) || !isText(c['text'])) issues.push({ field: `claims[${i}].text`, message: 'must be non-empty text' });
        if (!isObj(c) || !isSafeRef(c['evidence_ref'])) {
            issues.push({ field: `claims[${i}].evidence_ref`, message: 'must be a repo-relative path or an http(s) URL' });
        }
        if (isObj(c) && c['expires'] !== undefined && asDay(c['expires']) === null) {
            issues.push({ field: `claims[${i}].expires`, message: 'must be a YYYY-MM-DD date' });
        }
    });

    stringList(data['tell_exemptions'], 'tell_exemptions', issues);
    const knownTells = new Set(ALL_TELL_RULES.map((r) => r.id));
    (Array.isArray(data['tell_exemptions']) ? data['tell_exemptions'] : []).forEach((id, i) => {
        if (typeof id === 'string' && !knownTells.has(id)) {
            issues.push({ field: `tell_exemptions[${i}]`, message: 'not a tell id in the detector registry' });
        }
    });

    const samples = data['samples'];
    if (samples !== undefined && (!Array.isArray(samples) || samples.length > MAX_SAMPLES)) {
        issues.push({ field: 'samples', message: `must be a list of at most ${MAX_SAMPLES} samples` });
    }
    (Array.isArray(samples) ? samples : []).forEach((s, i) => {
        if (!isText(s)) issues.push({ field: `samples[${i}]`, message: 'must be non-empty text' });
        else if (s.split(/\s+/).filter(Boolean).length > MAX_SAMPLE_WORDS) {
            issues.push({ field: `samples[${i}]`, message: `must be at most ${MAX_SAMPLE_WORDS} words` });
        }
    });

    stringList(data['customer_language'], 'customer_language', issues);
    stringList(data['changelog'], 'changelog', issues);

    const prov = data['provenance'];
    if (!isObj(prov)) {
        issues.push({ field: 'provenance', message: 'must be a mapping with sources, confidence, last_reviewed_at' });
    } else {
        const sources = prov['sources'];
        if (!Array.isArray(sources)) issues.push({ field: 'provenance.sources', message: 'must be a list' });
        (Array.isArray(sources) ? sources : []).forEach((s, i) => {
            if (!isObj(s) || !isSafeRef(s['ref'])) {
                issues.push({ field: `provenance.sources[${i}].ref`, message: 'must be a repo-relative path or an http(s) URL' });
            }
            if (!isObj(s) || !(SOURCE_TIERS as readonly unknown[]).includes(s['tier'])) {
                issues.push({ field: `provenance.sources[${i}].tier`, message: `must be one of ${SOURCE_TIERS.join(', ')}` });
            }
        });
        if (!['low', 'med', 'high'].includes(prov['confidence'] as string)) {
            issues.push({ field: 'provenance.confidence', message: 'must be low, med or high' });
        }
        if (asDay(prov['last_reviewed_at']) === null) {
            issues.push({ field: 'provenance.last_reviewed_at', message: 'must be a YYYY-MM-DD date' });
        }
    }

    const questions = data['open_questions'];
    if (questions !== undefined && !Array.isArray(questions)) issues.push({ field: 'open_questions', message: 'must be a list' });
    (Array.isArray(questions) ? questions : []).forEach((q, i) => {
        for (const k of ['question', 'recommendation']) {
            if (!isObj(q) || !isText(q[k])) issues.push({ field: `open_questions[${i}].${k}`, message: 'must be non-empty text' });
        }
    });

    return issues;
}

/** Read and validate a slot file; a missing file is the caller's question, not an issue. */
export function validateBrandVoiceSlotFile(p: string): SlotIssue[] {
    return validateBrandVoiceSlotText(fs.readFileSync(p, 'utf-8'));
}

/** The slot's day field, normalised (YAML may hand back a Date). */
export function slotDay(v: unknown): string | null {
    return asDay(v);
}
