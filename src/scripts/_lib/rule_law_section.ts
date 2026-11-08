/**
 * One spelling of "a rule's law section" — the unit three gates and one
 * projector all price.
 *
 * A **law section** is a heading whose title matches `\biron\s+laws?\b` plus
 * everything under it up to the next heading of the same or a shallower depth.
 * A rule may carry several (`direct-answers` has three, `no-cheap-questions`
 * six); the rule's law is all of them, joined by a blank line, because each one
 * states an obligation and a stub carrying only the first would ship a rule
 * whose other laws silently vanished.
 *
 * WHY A SHARED MODULE RATHER THAN A REGEX PER CALLER. The projector
 * (`project_thin_rules.ts`) byte-copies this text into a stub and digests it;
 * the lint (`lint_rule_law_section.ts`) holds it under a ceiling. If those two
 * disagreed about where a section ends, the lint would certify a length the
 * projection does not carry — the exact drift `THIN_ENTRY_MARKER`'s own comment
 * argues against one file over.
 *
 * The heading regex is deliberately the SAME one `check_iron_law_prominence.ts`
 * uses, so "has a law section" here and "is an Iron Law heading" there cannot
 * diverge. That gate owns prominence (H2, near the top); this module owns
 * extent and size.
 *
 * WHAT THIS DOES NOT CLAIM. Not that the extracted text IS the rule's obligation. A rule can state its
 * law in bold prose or a bare fence under no heading at all — several of the 35
 * routed rules without a heading match do exactly that. A heading match is a
 * STRUCTURAL property, checkable; "this sentence is the obligation" is not, and
 * `report_obligation_carriers` plus the ids in `src/config/rule-obligations.json` is where
 * that question already lives.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

/** Same literal as `check_iron_law_prominence.ts` — one definition, two readers. */
export const IRON_LAW_RE = /\biron\s+laws?\b/i;

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*$/;
const FENCE_RE = /^\s*```/;

export interface LawSection {
    /** Heading title, verbatim. */
    title: string;
    /** Heading depth (1–6). */
    depth: number;
    /** 1-based line of the heading within the body. */
    line: number;
    /** Heading line plus its section, trimmed. */
    text: string;
}

/** Return `[frontmatter_including_fences, body]`. Empty frontmatter if none. */
export function splitFrontmatter(text: string): [string, string] {
    if (text.startsWith('---\n')) {
        const end = text.indexOf('\n---\n', 4);
        if (end !== -1) {
            return [text.slice(0, end + 5), text.slice(end + 5)];
        }
    }
    return ['', text];
}

/**
 * The body a runtime delivery carries: frontmatter removed, HTML comments
 * removed, trimmed.
 *
 * Comments are stripped because they are authoring scaffolding
 * (`<!-- risk-review: … -->`, `<!-- harvest:… -->`, `ref-ignore` markers) that
 * no host renders to a model, so charging a rule for them would price the wrong
 * thing. Frontmatter is excluded for the reason `check_rule_stub_ceiling` gives
 * for the same exclusion: it is the routing surface, and a rule that gains a
 * trigger must not trip a ceiling whose message tells the author to move prose.
 */
export function ruleBody(text: string): string {
    const [, body] = splitFrontmatter(text);
    return body.replace(/<!--[\s\S]*?-->/g, '').trim();
}

/** Every law section in a rule body, in document order. */
export function lawSections(body: string): LawSection[] {
    const lines = body.split('\n');
    let inFence = false;
    const headings: Array<{ i: number; depth: number; title: string }> = [];
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] as string;
        if (FENCE_RE.test(raw)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        const m = HEADING_RE.exec(raw);
        if (m) headings.push({ i, depth: (m[1] as string).length, title: (m[2] as string).trim() });
    }
    const out: LawSection[] = [];
    for (let k = 0; k < headings.length; k += 1) {
        const h = headings[k] as { i: number; depth: number; title: string };
        if (!IRON_LAW_RE.test(h.title)) continue;
        let end = lines.length;
        for (let j = k + 1; j < headings.length; j += 1) {
            const n = headings[j] as { i: number; depth: number; title: string };
            if (n.depth <= h.depth) {
                end = n.i;
                break;
            }
        }
        out.push({
            title: h.title,
            depth: h.depth,
            line: h.i + 1,
            text: lines.slice(h.i, end).join('\n').trim(),
        });
    }
    return out;
}

/**
 * The rule's law, as one byte string — all sections joined by a blank line.
 * `null` when the rule has none, which is a different answer from `''`.
 */
export function lawText(body: string): string | null {
    const sections = lawSections(body);
    if (sections.length === 0) return null;
    return sections.map((s) => s.text).join('\n\n');
}

/** Heading title of a rule's session-start contract (`road-to-a-session-start-under-the-host-limit` 1.2). */
export const STARTUP_CONTRACT_RE = /^startup contract$/i;

/**
 * The rule's startup contract — the `## Startup contract` section, heading
 * included, up to the next heading of the same or a shallower depth. `null`
 * when the rule carries none. Fences are skipped when looking for headings, the
 * same way {@link lawSections} skips them.
 */
export function startupContract(body: string): string | null {
    const lines = body.split('\n');
    let inFence = false;
    let start = -1;
    let depth = 0;
    for (let i = 0; i < lines.length; i += 1) {
        const raw = lines[i] as string;
        if (FENCE_RE.test(raw)) {
            inFence = !inFence;
            continue;
        }
        if (inFence) continue;
        const m = HEADING_RE.exec(raw);
        if (m === null) continue;
        const d = (m[1] as string).length;
        if (start === -1) {
            if (STARTUP_CONTRACT_RE.test((m[2] as string).trim())) {
                start = i;
                depth = d;
            }
        } else if (d <= depth) {
            return lines.slice(start, i).join('\n').trim();
        }
    }
    return start === -1 ? null : lines.slice(start).join('\n').trim();
}

/**
 * Where a rule's startup contract lives: its own file, `startup-contracts/rules/<id>.md`,
 * beside the rules directory (`dist/agent-src/rules` ↔ `dist/agent-src/startup-contracts/rules`;
 * in source, `src/rules` ↔ `src/agent-src/startup-contracts/rules`). Not inside the rule:
 * every host that delivers the full rule would otherwise carry the contract twice, once as
 * the body it restates (road-to-a-session-start-under-the-host-limit; the per-spawn
 * payload ratchet). `null` when the rule has none.
 */
export function startupContractPath(rulesDir: string, id: string): string | null {
    for (const base of [path.join(rulesDir, '..', 'startup-contracts', 'rules'), path.join(rulesDir, '..', 'agent-src', 'startup-contracts', 'rules')]) {
        const file = path.join(base, `${id}.md`);
        if (fs.existsSync(file)) return file;
    }
    return null;
}

/** The startup contract of rule `id` under `rulesDir`, heading included; `null` when it has none. */
export function readStartupContract(rulesDir: string, id: string): string | null {
    const file = startupContractPath(rulesDir, id);
    return file === null ? null : startupContract(ruleBody(fs.readFileSync(file, 'utf8')));
}

export interface RuleLawMeasure {
    id: string;
    /** Characters of the law text, 0 when there is none. */
    lawChars: number;
    /** Number of law sections found. */
    sections: number;
    /** Characters of the comment-stripped body. */
    bodyChars: number;
    /** The law text itself, `null` when absent. */
    law: string | null;
}

/** Measure one rule file. */
export function measureRuleFile(id: string, filePath: string): RuleLawMeasure {
    const body = ruleBody(fs.readFileSync(filePath, 'utf-8'));
    const law = lawText(body);
    // The startup contract restates the body for session start and is priced by
    // `check_startup_contracts`; counting it here would charge the rule twice.
    const contract = startupContract(body);
    return {
        id,
        lawChars: law === null ? 0 : law.length,
        sections: lawSections(body).length,
        bodyChars: contract === null ? body.length : body.replace(contract, '').trim().length,
        law,
    };
}
