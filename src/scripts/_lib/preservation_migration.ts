/**
 * Preservation-conformance verifier for safety-floor rule edits.
 *
 * `check_safety_floor_untouched` blocks every edit to the four safety-floor
 * rules. That is right for substantive edits and wrong for a P4 migration, which
 * moves lookup material into a `load_context:` target without losing anything.
 * This module decides which one a diff is — by CHECKING, never by trusting a
 * label, a commit message, or a contributor's word. A migration that cannot be
 * proven conformant is treated as substantive and blocked (fail-closed).
 *
 * The contract it enforces is `preservation-guard`'s: every paragraph, list
 * item, and fenced block from the source survives — either still in the rule
 * (telegraph condensation is allowed, so matching is fuzzy) or verbatim in one
 * of the rule's declared `load_context:` targets (a migration is a move, so
 * matching there is near-exact). Iron Law sections are stricter still: their
 * headings must survive at the same level and their fenced blocks byte-for-byte.
 *
 * Pure functions over strings — no git, no fs — so the whole decision is unit
 * testable without manufacturing commits. That absence is why the guard it
 * serves shipped inert for months.
 */

/** A structural unit of a markdown body: heading, paragraph, list item, or fence. */
export interface Unit {
    kind: 'heading' | 'paragraph' | 'list-item' | 'fence';
    /** Heading depth (1-6) for `heading`, else 0. */
    level: number;
    /** Raw text as it appeared, minus the trailing newline. */
    raw: string;
    /** Normalised form used for comparison. */
    norm: string;
}

/** Strip frontmatter; return the body. */
export function strip_frontmatter(text: string): string {
    const m = /^---\n[\s\S]*?\n---\n/.exec(text);
    return m === null ? text : text.slice(m[0].length);
}

/** `load_context:` targets declared in a rule's frontmatter, in order. */
export function load_context_targets(text: string): string[] {
    const fm = /^---\n([\s\S]*?)\n---\n/.exec(text);
    if (fm === null) return [];
    const out: string[] = [];
    let inBlock = false;
    for (const line of fm[1]!.split('\n')) {
        if (/^load_context:\s*$/.test(line)) {
            inBlock = true;
            continue;
        }
        if (inBlock) {
            const item = /^\s*-\s+(.+?)\s*$/.exec(line);
            if (item !== null) {
                out.push(item[1]!.replace(/^["']|["']$/g, ''));
                continue;
            }
            if (/^\S/.test(line)) inBlock = false;
        }
    }
    return out;
}

/**
 * Normalise a unit for comparison.
 *
 * Deliberately blind to the three things a legitimate migration changes and
 * nothing else: heading depth (an H2 becomes an H3 under a host section), link
 * targets (relative paths are rewritten for the new location), and whitespace.
 * Everything that carries obligation — words, emphasis, negations — is compared
 * as written.
 */
export function normalise(raw: string): string {
    return raw
        .replace(/^#{1,6}\s+/gm, '') // heading depth
        .replace(/\]\([^)]*\)/g, ']()') // link targets
        .replace(/^\s*[-*+]\s+/gm, '') // list markers
        .replace(/\s+/g, ' ')
        .trim();
}

/** Split a markdown body into structural units. Fenced blocks stay intact. */
export function parse_units(body: string): Unit[] {
    const lines = body.split('\n');
    const units: Unit[] = [];
    let para: string[] = [];

    const flush = (): void => {
        if (para.length === 0) return;
        const raw = para.join('\n');
        if (raw.trim() !== '') units.push({ kind: 'paragraph', level: 0, raw, norm: normalise(raw) });
        para = [];
    };

    for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i]!;
        const fence = /^(\s*)(`{3,}|~{3,})/.exec(line);
        if (fence !== null) {
            flush();
            const marker = fence[2]!;
            const block = [line];
            i += 1;
            while (i < lines.length) {
                block.push(lines[i]!);
                if (lines[i]!.trimStart().startsWith(marker)) break;
                i += 1;
            }
            const raw = block.join('\n');
            units.push({ kind: 'fence', level: 0, raw, norm: raw.replace(/\s+$/gm, '') });
            continue;
        }
        const heading = /^(#{1,6})\s+(.*)$/.exec(line);
        if (heading !== null) {
            flush();
            units.push({
                kind: 'heading',
                level: heading[1]!.length,
                raw: line,
                norm: normalise(line),
            });
            continue;
        }
        const item = /^\s*[-*+]\s+/.test(line) || /^\s*\d+\.\s+/.test(line);
        if (item) {
            flush();
            units.push({ kind: 'list-item', level: 0, raw: line, norm: normalise(line) });
            continue;
        }
        if (line.trim() === '') {
            flush();
            continue;
        }
        para.push(line);
    }
    flush();
    return units;
}

/** Dice coefficient over character bigrams — cheap, order-sensitive enough. */
export function similarity(a: string, b: string): number {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
    const grams = (s: string): Map<string, number> => {
        const m = new Map<string, number>();
        for (let i = 0; i < s.length - 1; i += 1) {
            const g = s.slice(i, i + 2);
            m.set(g, (m.get(g) ?? 0) + 1);
        }
        return m;
    };
    const ga = grams(a);
    const gb = grams(b);
    let overlap = 0;
    for (const [g, n] of ga) overlap += Math.min(n, gb.get(g) ?? 0);
    return (2 * overlap) / (a.length - 1 + b.length - 1);
}

/** A unit still present in the rule after telegraph condensation. */
const KEPT_IN_RULE = 0.6;
/** A unit moved into a context file — a move, so near-verbatim. */
const MOVED_TO_CONTEXT = 0.9;

export interface Finding {
    code:
        | 'iron-law-heading-lost'
        | 'iron-law-fence-changed'
        | 'passage-lost'
        | 'unexplained-addition';
    detail: string;
}

/** Units belonging to an Iron Law section (heading matches, until the next same-or-shallower heading). */
export function iron_law_units(units: readonly Unit[]): Unit[] {
    const out: Unit[] = [];
    let depth: number | null = null;
    for (const u of units) {
        if (u.kind === 'heading') {
            if (/^(the\s+)?iron\s+law/i.test(u.norm)) {
                depth = u.level;
                out.push(u);
                continue;
            }
            if (depth !== null && u.level <= depth) depth = null;
        }
        if (depth !== null) out.push(u);
    }
    return out;
}

export interface VerifyInput {
    /** Rule file content before the change. */
    base_rule: string;
    /** Rule file content after the change. */
    head_rule: string;
    /** Declared `load_context` target path → content AFTER the change. */
    head_contexts: ReadonlyMap<string, string>;
    /** Same targets, content BEFORE — so only ADDED context text counts as a landing site. */
    base_contexts: ReadonlyMap<string, string>;
}

/**
 * Decide whether a safety-floor rule edit is a preservation-conforming
 * migration. Returns [] when it is; otherwise every reason it is not.
 */
export function verify_migration(input: VerifyInput): Finding[] {
    const findings: Finding[] = [];
    const baseUnits = parse_units(strip_frontmatter(input.base_rule));
    const headUnits = parse_units(strip_frontmatter(input.head_rule));

    // ── Iron Law: headings survive at depth, fences survive byte-for-byte ──
    const baseIron = iron_law_units(baseUnits);
    const headIron = iron_law_units(headUnits);
    for (const u of baseIron) {
        if (u.kind === 'heading') {
            const hit = headIron.some((h) => h.kind === 'heading' && h.norm === u.norm && h.level === u.level);
            if (!hit) {
                findings.push({
                    code: 'iron-law-heading-lost',
                    detail: `${u.raw.trim()} — must survive verbatim at the same level`,
                });
            }
        } else if (u.kind === 'fence') {
            const hit = headIron.some((h) => h.kind === 'fence' && h.raw === u.raw);
            if (!hit) {
                findings.push({
                    code: 'iron-law-fence-changed',
                    detail: `fenced block under ${u.raw.split('\n')[0] ?? ''} changed — Iron Law fences are byte-exact`,
                });
            }
        }
    }

    // ── Landing sites: only text ADDED to a DECLARED context counts ──
    //
    // The declared set is re-derived here from the rule's own frontmatter rather
    // than trusted from the caller. A migration is only legitimate into a file
    // the rule actually points readers at; dropping a passage into some other
    // file leaves it unreachable from the rule and is a loss, not a move.
    const declared = load_context_targets(input.head_rule);
    const isDeclared = (p: string): boolean =>
        declared.some((rel) => p === rel || p.endsWith(`/${rel}`));
    const landing: string[] = [];
    for (const [path, head] of input.head_contexts) {
        if (!isDeclared(path)) continue;
        const before = new Set(parse_units(strip_frontmatter(input.base_contexts.get(path) ?? '')).map((u) => u.norm));
        for (const u of parse_units(strip_frontmatter(head))) {
            if (!before.has(u.norm)) landing.push(u.norm);
        }
    }

    // ── Every base unit survives: in the rule (fuzzy) or in a context (near-exact) ──
    const headNorms = headUnits.map((u) => u.norm);
    const usedHead = new Set<number>();
    for (const u of baseUnits) {
        let bestIdx = -1;
        let best = 0;
        for (let i = 0; i < headNorms.length; i += 1) {
            if (usedHead.has(i)) continue;
            const s = similarity(u.norm, headNorms[i]!);
            if (s > best) {
                best = s;
                bestIdx = i;
            }
        }
        if (best >= KEPT_IN_RULE) {
            usedHead.add(bestIdx);
            continue;
        }
        const moved = landing.some((l) => similarity(u.norm, l) >= MOVED_TO_CONTEXT);
        if (!moved) {
            findings.push({
                code: 'passage-lost',
                detail: `${u.kind}: ${u.raw.trim().slice(0, 90)}… — not kept in the rule and not found in any declared load_context target`,
            });
        }
    }

    // ── Nothing genuinely new in the rule: a migration only removes ──
    for (let i = 0; i < headUnits.length; i += 1) {
        if (usedHead.has(i)) continue;
        const u = headUnits[i]!;
        const back = baseUnits.some((b) => similarity(b.norm, u.norm) >= KEPT_IN_RULE);
        if (!back) {
            findings.push({
                code: 'unexplained-addition',
                detail: `${u.kind}: ${u.raw.trim().slice(0, 90)}… — new content in a safety-floor rule is a substantive edit, not a migration`,
            });
        }
    }

    return findings;
}
