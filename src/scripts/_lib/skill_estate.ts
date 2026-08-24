/**
 * The skill corpus, measured — the two dimensions `check_estate_count` ratchets.
 *
 * WHY TWO. A file count is what a `one_in_one_out` lint can express; it is not
 * what a skill COSTS. Merging four large skills into one file satisfies a count
 * ratchet while the description payload a host must carry stays put or grows.
 * AI council 2/2 (2026-08-24) asked for both dimensions in one gate for exactly
 * that reason, over the roadmap's own recommendation of a count plus an
 * informational companion figure: "that supports treating tokens as a coarse
 * secondary budget — not leaving the only cost-sensitive metric informational
 * forever."
 *
 * WHY NOT THE OTHER TWO CANDIDATES, measured before asking rather than argued:
 *
 * - **Catalogue bytes** via `_lib/skill_catalogue.ts` read **0** on this
 *   checkout. `readProjectedCatalogue` walks `.claude/skills`, which is empty in
 *   any tree where `task generate-tools` cannot complete — it fails under
 *   `projection.mode=scoped` without the config package. A ratchet whose reading
 *   depends on whether a generator ran is a ratchet that reds for the
 *   environment.
 * - **Host-listing slots** are the host's decision, not the repository's. A
 *   measured install published its own budget event stating it had stripped
 *   every description and dropped 402 entries.
 *
 * DEPRECATED SKILLS ARE EXCLUDED, and that is load-bearing rather than tidy:
 * with them counted, deprecating a skill would create no headroom and the
 * retirement mechanism would be unusable against its own gate. (Currently 0
 * skills carry it, so the exclusion is a no-op today and a correctness property
 * tomorrow.)
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { gpt_tokens } from './token_count.js';

/** Where the corpus lives, POSIX — the same string a base-tree subtree takes. */
export const SKILLS_POSIX = 'src/skills';

export interface SkillEstate {
    /** Maintained `SKILL.md` files — `lifecycle: deprecated` excluded. */
    skill_count: number;
    /**
     * Exact-BPE tokens across the maintained skills' `description:` fields.
     *
     * `null` when the tokeniser could not resolve. A ratchet must never compare
     * an exact reading against a proxy one — the numbers differ by more than the
     * growth a gate is trying to catch, so the metric is reported UNRESOLVED
     * rather than measured with whatever was available.
     */
    skill_description_tokens: number | null;
    /** Excluded from both figures, reported so the exclusion is visible. */
    deprecated_count: number;
}

/** `description:` from a `SKILL.md` frontmatter block, unquoted. */
export function descriptionOf(text: string): string {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) return '';
    const m = /^description:\s*(.+)$/m.exec(fm[1]!);
    if (m === null) return '';
    return m[1]!.trim().replace(/^["']|["']$/g, '');
}

/** `lifecycle: deprecated` in the frontmatter — the retirement transition state. */
export function isDeprecated(text: string): boolean {
    const fm = /^---\n([\s\S]*?)\n---/.exec(text);
    if (fm === null) return false;
    return /^lifecycle:\s*["']?deprecated["']?\s*$/m.test(fm[1]!);
}

/**
 * Measure the corpus under `root`.
 *
 * `root` is a repository root OR a materialised base-ref tree holding
 * `src/skills/...`, so the floor side runs this exact function over the base
 * ref's own tree — the property `check_estate_count` already has for the roadmap
 * estate, and the reason the "before" side cannot be rewritten by the change
 * under review.
 */
export function measureSkillEstate(root: string): SkillEstate {
    const base = path.join(root, ...SKILLS_POSIX.split('/'));
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(base, { withFileTypes: true });
    } catch {
        return { skill_count: 0, skill_description_tokens: null, deprecated_count: 0 };
    }
    let count = 0;
    let deprecated = 0;
    let tokens = 0;
    let exact = true;
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
        if (!e.isDirectory()) continue;
        const p = path.join(base, e.name, 'SKILL.md');
        let text: string;
        try {
            text = fs.readFileSync(p, 'utf-8');
        } catch {
            continue;
        }
        if (isDeprecated(text)) {
            deprecated += 1;
            continue;
        }
        count += 1;
        const r = gpt_tokens(descriptionOf(text));
        if (!r.exact) exact = false;
        tokens += r.tokens;
    }
    return {
        skill_count: count,
        skill_description_tokens: exact ? tokens : null,
        deprecated_count: deprecated,
    };
}
