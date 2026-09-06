/**
 * One ADR frontmatter reader, for the three call sites that each had their own.
 *
 * Before this file the tree carried three independent parsers:
 * `check_adr_frontmatter.parse_frontmatter` (folded indented continuations into
 * the parent scalar), `adr_cite_check.parse_frontmatter` (the same, plus
 * stripping a bare `>-` fold marker), and `adr/regenerate_index.fm` (a
 * `^([a-z_]+):[ \t]*(.+?)[ \t]*$` regex, so a key with an empty value matched
 * nothing and an indented line matched nothing either).
 *
 * Three readers were survivable while every field was a scalar. `provenance`
 * and `evidence` are nested and carry lists, so the divergence stops being
 * cosmetic: the regex reader would have read both as absent — silently, on the
 * surface that renders the public index — while the other two would have folded
 * them into one unusable string. Adding an axis to three parsers also pays for
 * it three times, which is the reason this extraction lands BEFORE the axes
 * rather than after.
 *
 * ## Scalar compatibility is the contract
 *
 * `scalars` reproduces the previous behaviour key-for-key, including the fold
 * of an indented continuation into its parent and the `>-` strip. That is
 * deliberate: the three call sites read `fm.status`, `fm.review_trigger`,
 * `fm.superseded_by` and friends, and a reader that changed any of those
 * values would be a behaviour change wearing a refactor's clothes.
 *
 * The one intentional difference: a key whose own value is empty and whose
 * indented children look like `key: value` (or `- item`) becomes a **nested**
 * entry and is kept out of `scalars` entirely, rather than folded into the
 * garbage string the old readers produced. Nothing read those strings.
 */

/** A frontmatter value that is not a scalar. */
export type AdrFrontmatterNode = string | string[] | { [key: string]: AdrFrontmatterNode };

export interface AdrFrontmatter {
    /**
     * Scalar keys, byte-identical to what the three previous parsers produced
     * for every shape that existed before the nested axes.
     */
    scalars: Record<string, string>;
    /** Keys whose value is a nested map or a list. */
    nested: Record<string, AdrFrontmatterNode>;
    /** Source order of every top-level key, for diagnostics. */
    keyOrder: string[];
}

/** Fold indicators: the value is a multi-line scalar, never a nested map. */
const FOLD_MARKERS = new Set(['>', '>-', '>+', '|', '|-', '|+']);

/**
 * Consume an indented block as prose, with no map/list discrimination.
 *
 * Used whenever the parent carried a fold marker. Routing a folded block
 * through `parseBlock` looked equivalent and was not: real `review_trigger`
 * prose contains colons ("Reopen when an `exec:` claim is found green"), so the
 * map branch claimed the first line and then stopped at the first line without
 * one — truncating four ADRs' triggers to their opening clause. The corpus
 * equivalence test is what caught it; a single-line fixture round-tripped
 * correctly and hid the bug.
 */
function consumeFolded(lines: Line[], start: number, parentIndent: number): [string, number] {
    const parts: string[] = [];
    let i = start;
    while (i < lines.length) {
        const line = lines[i] as Line;
        if (line.indent <= parentIndent) break;
        parts.push(line.text);
        i += 1;
    }
    return [parts.join(' ').trim(), i];
}

const QUOTED = /^["'](.*)["']$/;

function stripQuotes(value: string): string {
    return value.replace(QUOTED, '$1');
}

/** `[a, b, c]` → `['a','b','c']`; a bare `[]` → `[]`. */
function parseInlineList(raw: string): string[] | null {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return null;
    const inner = trimmed.slice(1, -1).trim();
    if (inner === '') return [];
    return inner
        .split(',')
        .map((part) => stripQuotes(part.trim()))
        .filter((part) => part !== '');
}

interface Line {
    indent: number;
    text: string;
}

/** Split the `---` block into significant lines, dropping blanks and comments. */
function significantLines(block: string): Line[] {
    const out: Line[] = [];
    for (const raw of block.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        if (line === '') continue;
        const trimmed = line.trimStart();
        if (trimmed.startsWith('#')) continue;
        out.push({ indent: line.length - trimmed.length, text: trimmed });
    }
    return out;
}

/**
 * Parse one indented block into a map, a list, or a folded scalar.
 *
 * The discriminator is the block's own first line, not the parent key: `- x`
 * opens a list, `k: v` opens a map, anything else is prose to fold. Keying on
 * the parent name would have meant a hard-coded field list, which is the thing
 * three divergent parsers already demonstrated does not survive a new axis.
 */
function parseBlock(lines: Line[], start: number, parentIndent: number): [AdrFrontmatterNode, number] {
    const first = lines[start];
    if (first === undefined) return ['', start];

    // A list.
    if (first.text.startsWith('- ') || first.text === '-') {
        const items: string[] = [];
        let i = start;
        while (i < lines.length) {
            const line = lines[i] as Line;
            if (line.indent <= parentIndent || !line.text.startsWith('-')) break;
            items.push(stripQuotes(line.text.replace(/^-\s*/, '').trim()));
            i += 1;
        }
        return [items, i];
    }

    // A map — every child line at this indent carries a `key:`.
    const colon = first.text.indexOf(':');
    if (colon > 0) {
        const map: Record<string, AdrFrontmatterNode> = {};
        let i = start;
        while (i < lines.length) {
            const line = lines[i] as Line;
            if (line.indent <= parentIndent) break;
            const idx = line.text.indexOf(':');
            if (idx <= 0) break;
            const key = line.text.slice(0, idx).trim();
            const rest = line.text.slice(idx + 1).trim();
            i += 1;
            if (rest === '' || FOLD_MARKERS.has(rest)) {
                const next = lines[i];
                if (next !== undefined && next.indent > line.indent) {
                    if (FOLD_MARKERS.has(rest)) {
                        const [folded, consumed] = consumeFolded(lines, i, line.indent);
                        map[key] = folded;
                        i = consumed;
                        continue;
                    }
                    const [child, consumed] = parseBlock(lines, i, line.indent);
                    map[key] = child;
                    i = consumed;
                    continue;
                }
                map[key] = '';
                continue;
            }
            const inline = parseInlineList(rest);
            map[key] = inline ?? stripQuotes(rest);
        }
        return [map, i];
    }

    // Prose — fold it.
    const parts: string[] = [];
    let i = start;
    while (i < lines.length) {
        const line = lines[i] as Line;
        if (line.indent <= parentIndent) break;
        parts.push(line.text);
        i += 1;
    }
    return [parts.join(' ').trim(), i];
}

/**
 * Flatten a node back to the single string the old fold produced.
 *
 * A list renders as its inline literal (`[a, b]`) rather than as joined items,
 * because that is what the previous parsers put in the scalar map for
 * `protected_dimensions: [purpose]` and the corpus-equivalence test holds this
 * reader to that byte-for-byte.
 */
function foldToString(node: AdrFrontmatterNode): string {
    if (typeof node === 'string') return node;
    if (Array.isArray(node)) return `[${node.join(', ')}]`;
    return Object.entries(node)
        .map(([k, v]) => `${k}: ${foldToString(v)}`)
        .join(' ')
        .trim();
}

/**
 * Read the leading `---` block of an ADR.
 *
 * Returns `null` when there is no frontmatter at all — which is the honest
 * answer for the seven per-area records, whose metadata lives in a blockquote
 * line instead. `adr_cite_check` already declares them partial coverage for
 * exactly this reason; this reader does not paper over it.
 */
export function readAdrFrontmatter(text: string): AdrFrontmatter | null {
    if (!text.startsWith('---\n')) return null;
    const end = text.indexOf('\n---\n', 4);
    if (end === -1) return null;

    const lines = significantLines(text.slice(4, end));
    const scalars: Record<string, string> = {};
    const nested: Record<string, AdrFrontmatterNode> = {};
    const keyOrder: string[] = [];

    let i = 0;
    while (i < lines.length) {
        const line = lines[i] as Line;
        if (line.indent > 0) {
            // Orphan indented line with no parent — the old readers dropped
            // these too (no key to fold into). Skip rather than invent one.
            i += 1;
            continue;
        }
        const idx = line.text.indexOf(':');
        if (idx <= 0) {
            i += 1;
            continue;
        }
        const key = line.text.slice(0, idx).trim();
        const rest = line.text.slice(idx + 1).trim();
        keyOrder.push(key);
        i += 1;

        const next = lines[i];
        const hasBlock = next !== undefined && next.indent > 0;

        if (FOLD_MARKERS.has(rest) && hasBlock) {
            const [folded, consumed] = consumeFolded(lines, i, 0);
            scalars[key] = folded;
            i = consumed;
            continue;
        }

        if (rest === '' && hasBlock) {
            const [child, consumed] = parseBlock(lines, i, 0);
            i = consumed;
            if (typeof child === 'string') {
                scalars[key] = child;
            } else {
                nested[key] = child;
            }
            continue;
        }

        const inline = parseInlineList(rest);
        if (inline !== null) {
            nested[key] = inline;
            continue;
        }

        // A plain scalar with continuation lines — prose, as the old readers
        // treated it. The same colon hazard applies here.
        if (hasBlock) {
            const [folded, consumed] = consumeFolded(lines, i, 0);
            scalars[key] = `${stripQuotes(rest)} ${folded}`.trim();
            i = consumed;
            continue;
        }
        scalars[key] = stripQuotes(rest).replace(/^>-?$/, '');
    }

    return { scalars, nested, keyOrder };
}

/**
 * The scalar-only view, for the call sites that want exactly what they had.
 *
 * A nested key is rendered back into its folded string here so a caller that
 * only knows about scalars still sees *something* for `provenance` rather than
 * `undefined` — which matters for the index reader, where an absent key and an
 * empty key print differently.
 */
export function readAdrFrontmatterScalars(text: string): Record<string, string> | null {
    const parsed = readAdrFrontmatter(text);
    if (parsed === null) return null;
    const out: Record<string, string> = { ...parsed.scalars };
    for (const [key, node] of Object.entries(parsed.nested)) {
        out[key] = foldToString(node);
    }
    return out;
}

// ---------------------------------------------------------------------------
// Typed accessors for the two axes. Deliberately tolerant: a census proposal
// and a hand-authored record both flow through here, and a malformed value has
// to be reportable rather than fatal.
// ---------------------------------------------------------------------------

export const PROVENANCE_KINDS = ['human', 'agentic', 'mixed', 'unknown'] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export const AGENTIC_MODES = ['single', 'council', 'delegated'] as const;
export const EVIDENCE_STRENGTHS = ['E0', 'E1', 'E2', 'E3', 'E4'] as const;
export type EvidenceStrength = (typeof EVIDENCE_STRENGTHS)[number];

export const DISCOVERY_STATES = ['complete', 'incomplete'] as const;
export const AUTHORITY_BASES = ['evidence', 'owner_intent'] as const;
export type AuthorityBasis = (typeof AUTHORITY_BASES)[number];

/**
 * Reopen-authority vocabulary (`adr-layout.md` § Reopen authority).
 *
 * Moved here from `check_adr_frontmatter.ts` on 2026-08-31 so the ADR gate and
 * `road-to-harness-promotion-bridge` step 7.2 read ONE list. 7.2's whole
 * requirement is "route through the existing gate, not a second governance
 * system"; importing the validator's private constant was not available, and
 * copying it would have created the second system the step forbids.
 *
 * Both fields stay OPTIONAL at the ADR reader — an absent `reopen_policy`
 * resolves to `unclassified`, never to `owner`.
 */
export const REOPEN_POLICIES = ['directional', 'owner', 'unclassified'] as const;
export type ReopenPolicy = (typeof REOPEN_POLICIES)[number];

export const PROTECTED_DIMENSIONS = [
    'purpose',
    'security_floor',
    'privacy_floor',
    'external_commitment',
    'governance',
    'none',
] as const;
export type ProtectedDimension = (typeof PROTECTED_DIMENSIONS)[number];

export interface AdrProvenance {
    kind: string | null;
    decisionMakers: string[];
    humanDirected: string | null;
    agenticMode: string | null;
}

export interface AdrEvidence {
    strength: string | null;
    discovery: string | null;
    basis: string[];
}

function asString(node: AdrFrontmatterNode | undefined): string | null {
    if (typeof node === 'string') return node === '' ? null : node;
    return null;
}

function asList(node: AdrFrontmatterNode | undefined): string[] {
    if (Array.isArray(node)) return node;
    if (typeof node === 'string' && node !== '') return [node];
    return [];
}

export function provenanceOf(fm: AdrFrontmatter): AdrProvenance | null {
    const node = fm.nested.provenance;
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return null;
    return {
        kind: asString(node.kind),
        decisionMakers: asList(node.decision_makers),
        humanDirected: asString(node.human_directed),
        agenticMode: asString(node.agentic_mode),
    };
}

export function evidenceOf(fm: AdrFrontmatter): AdrEvidence | null {
    const node = fm.nested.evidence;
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return null;
    return {
        strength: asString(node.strength),
        discovery: asString(node.discovery),
        basis: asList(node.basis),
    };
}

export function authorityBasisOf(fm: AdrFrontmatter): string | null {
    return fm.scalars.authority_basis ?? null;
}

/**
 * Does this record's own metadata say a cite-time reader must NOT treat it as
 * establishing that the alternatives remain invalid?
 *
 * True for an accepted record graded E0 or E1, whatever its provenance.
 *
 * **Provenance was in this predicate and has been removed** (neutral review,
 * 2026-08-21). It required `kind === 'agentic'`, so an identical E0 record made
 * by a human printed no notice at all. That was wrong on the claim's own terms:
 * "this record does not by itself establish that alternatives remain invalid"
 * is a statement about the strength of the EVIDENCE, and a human snapshot is
 * exactly as thin as an agent snapshot. Gating it on who decided also sat one
 * step sideways from `adr-layout`'s own line that a record's historical
 * decision-maker does not determine how it is treated on citation.
 *
 * `authority_basis: owner_intent` is the one exemption, and it is the RIGHT
 * discriminator where provenance was the wrong one. An owner purpose statement
 * is legitimately E0 — that is the honest form — and its alternatives ARE
 * foreclosed, by ownership rather than by evidence. Printing "this does not
 * establish that alternatives remain invalid" over it would be false. The
 * declared field says which kind of authority a record rests on, so it is the
 * field that decides, and the burden table already reads `owner_intent` as
 * binding until the owner changes it.
 *
 * That is also why the earlier provenance gate was subtly wrong rather than
 * simply wrong: it was reaching for this exemption and grabbing a correlate.
 * Most owner-intent records are human-made, so `kind === 'agentic'` approximated
 * it — and silently withheld the notice from every thin HUMAN record that
 * carried no owner claim at all.
 *
 * The name says `lowEvidence` rather than `provisionalAuthority` for a second
 * reason from the same review: ADR-239 and the roadmap both explicitly REJECT
 * the word "provisional" for this output, because it asserts a permission that
 * does not exist. Identifiers carrying the rejected vocabulary would have been
 * the doctrine contradicted in its own implementation.
 *
 * What the caller prints is `authority_effect: disabled-shadow-mode` — a
 * DISABLED effect, not a provisional permission. No grade authorizes anything.
 */
export function isLowEvidenceAccepted(fm: AdrFrontmatter): boolean {
    if ((fm.scalars.status ?? '') !== 'accepted') return false;
    if (authorityBasisOf(fm) === 'owner_intent') return false;
    const evidence = evidenceOf(fm);
    return evidence?.strength === 'E0' || evidence?.strength === 'E1';
}

// ---------------------------------------------------------------------------
// Index cells. The two nested axes rendered as two flat table cells, in ONE
// place, because two generated tables print them (`adr/regenerate_index.ts`
// and `audit_adr_coverage.render_area_readme`) and both are byte-compared by a
// `--check` gate — a second copy of the em-dash-on-absent convention would be
// two gates disagreeing about one record.
// ---------------------------------------------------------------------------

/** The placeholder both generated tables already use for an absent scalar. */
const CELL_ABSENT = '—';

/**
 * Reserved row keys the index generators spread over their frontmatter scalars.
 *
 * Named apart from the frontmatter keys they derive from (`provenance`,
 * `evidence`), which `readAdrFrontmatterScalars` also emits as folded strings —
 * a folded `kind: agentic decision_makers: [...]` is not a table cell, and
 * colliding with those keys would put it in one.
 */
export interface AdrAxisCells {
    provenance_kind: string;
    evidence_grade: string;
}

/**
 * `provenance.kind` and `evidence.strength` as table cells.
 *
 * `discovery` rides in the evidence cell rather than in a third column: a bare
 * `E0` collapses the five states `adr-layout § evidence.discovery` separates,
 * so an index that printed the grade alone would re-create exactly the
 * conflation the axis exists to undo.
 *
 * Most of the corpus carries neither axis and is not expected to — the backfill
 * is deliberately out of this roadmap — so `—` is the common answer and means
 * "not assessed", never "assessed as weak".
 */
export function readAdrAxisCells(text: string): AdrAxisCells {
    const fm = readAdrFrontmatter(text);
    if (fm === null) return { provenance_kind: CELL_ABSENT, evidence_grade: CELL_ABSENT };
    const provenance = provenanceOf(fm);
    const evidence = evidenceOf(fm);
    const strength = evidence?.strength ?? null;
    const discovery = evidence?.discovery ?? null;
    return {
        provenance_kind: provenance?.kind ?? CELL_ABSENT,
        evidence_grade:
            strength === null
                ? CELL_ABSENT
                : discovery === null
                  ? strength
                  : `${strength} (${discovery})`,
    };
}

/**
 * The one shape this tool decides: a trigger whose condition IS a leading date.
 *
 * Deliberately anchored at the start of the string and deliberately narrow. The
 * boundary is the whole safety property — the moment a trigger is matched on a
 * date found anywhere in its prose, "reopens when N exceeds M" is one edit away
 * and the machine-readable grammar two council seats rejected on 2026-08-19 has
 * been built by increments.
 */
export const DATED_TRIGGER_RE = /^\s*(?:expir(?:y|es)\b\s*[:—-]?\s*)?(\d{4})-(\d{2})-(\d{2})(?!\d)/iu;

/**
 * A trigger that ANNOUNCES itself as dated, whether or not the date parses.
 *
 * The gap between this and `DATED_TRIGGER_RE` is the `dated-unparsed` state.
 * Exactly one ADR in the corpus carries a dated expiry, so a parse tuned to its
 * phrasing can fail on the second one — and the failure mode is silence,
 * because the old answer for every trigger was `indeterminate`. This probe is
 * what turns that silence into a reported defect.
 */
export const DATED_TRIGGER_PROBE = /^\s*(?:expir(?:y|es)\b|\d{4}-\d{1,2}-\d{1,2}\b)/iu;

/** The UTC calendar day of an instant, as `YYYY-MM-DD`. */
export function iso_day(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/**
 * The calendar day a dated trigger names, or null when there is none to read.
 *
 * Round-tripping through `Date.UTC` rejects `2026-13-45`, which matches the
 * shape and is not a date.
 */
export function dated_trigger_day(trigger: string): string | null {
    const m = DATED_TRIGGER_RE.exec(trigger);
    if (m === null) return null;
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const at = new Date(Date.UTC(y, mo - 1, d));
    if (at.getUTCFullYear() !== y || at.getUTCMonth() !== mo - 1 || at.getUTCDate() !== d) {
        return null;
    }
    return iso_day(at);
}
