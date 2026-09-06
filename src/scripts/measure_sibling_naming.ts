/**
 * measure_sibling_naming — how many skill descriptions name another skill.
 *
 * `road-to-one-motion-authority` step 5.2. An inbox census claimed "44/299
 * descriptions name a sibling" and shipped no definition of *naming* and no
 * script, so the figure could be neither reproduced nor refuted. A companion
 * claim of "218/299 bodies" reproduced under no reading of the tree at all.
 * This script exists so the next such number is falsifiable.
 *
 * WHAT "NAMES A SIBLING" MEANS HERE, stated because the census did not.
 *
 * A description names a sibling when it contains the exact `name:` value of a
 * DIFFERENT shipped skill, delimited so it is not a fragment of a longer
 * identifier. `\b` is not enough: it puts a boundary between `brand` and the
 * hyphen in `brand-identity`, so a bare `\b`-matched `brand` would score every
 * mention of `brand-identity` as naming `brand` too. The delimiter here is
 * "not `[A-Za-z0-9-]`" on both sides, which is the smallest rule that keeps
 * `mcp` out of `mcp-builder` and `laravel` out of `laravel-dto`.
 *
 * A skill naming ITSELF does not count — that is a description, not a pointer.
 *
 * WHAT THE NUMBER IS AND IS NOT.
 *
 * A KNOWN AND UNFIXABLE FALSE POSITIVE, named rather than left for a reader to
 * find: some skill names are ordinary English words, so a description can score
 * a match by accident. `canvas-design` scores `brand` on the phrase "brand
 * assets", which is not a pointer to the `brand` skill. Excluding short or
 * common names would trade this for a false negative on the skills whose names
 * really are those words, and there is no rule that gets both. The count is
 * therefore an upper bound; the per-skill list is printed so a reader can see
 * which matches are real.
 *
 * It is a count of descriptions that mention a sibling by name. It is NOT a
 * measure of routing quality: a description can name a sibling uselessly, and a
 * description that names none can be perfectly routable on its own keywords.
 * The reason the count is worth having is narrower — the router reads
 * descriptions and nothing else, so a family whose members never point at each
 * other is a family the router cannot traverse.
 *
 * Exit code is 0 unless `--min <n>` is given and the count falls below it.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const SKILLS_REL = path.join('src', 'skills');

export interface SkillRecord { name: string; description: string }

/** Read `name:` and `description:` out of a SKILL.md frontmatter block. */
export function parseSkill(text: string): SkillRecord | null {
    if (!text.startsWith('---')) return null;
    const end = text.indexOf('\n---', 3);
    if (end < 0) return null;
    const fm = text.slice(3, end);
    const name = /^name:\s*(.+)$/m.exec(fm)?.[1]?.trim() ?? '';
    let description = /^description:\s*(.+)$/m.exec(fm)?.[1]?.trim() ?? '';
    if ((description.startsWith('"') && description.endsWith('"'))
        || (description.startsWith("'") && description.endsWith("'"))) {
        description = description.slice(1, -1);
    }
    description = description.replace(/\\"/g, '"');
    if (name === '') return null;
    return { name, description };
}

export function loadSkills(root: string): SkillRecord[] {
    const dir = path.join(root, SKILLS_REL);
    if (!fs.existsSync(dir)) return [];
    const out: SkillRecord[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const file = path.join(dir, entry.name, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const rec = parseSkill(fs.readFileSync(file, 'utf-8'));
        if (rec !== null) out.push(rec);
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Identifier-boundary containment: `mcp` is not found inside `mcp-builder`. */
export function namesIdentifier(haystack: string, id: string): boolean {
    let from = 0;
    for (;;) {
        const i = haystack.indexOf(id, from);
        if (i < 0) return false;
        const before = i === 0 ? '' : haystack[i - 1] ?? '';
        const after = haystack[i + id.length] ?? '';
        const isPart = (c: string): boolean => c !== '' && /[A-Za-z0-9-]/.test(c);
        if (!isPart(before) && !isPart(after)) return true;
        from = i + 1;
    }
}

/** For each skill, the OTHER skills its description names. Sorted, deterministic. */
export function siblingsNamed(skills: readonly SkillRecord[]): Map<string, string[]> {
    const names = skills.map((s) => s.name);
    const out = new Map<string, string[]>();
    for (const s of skills) {
        const hits = names
            .filter((n) => n !== s.name && namesIdentifier(s.description, n))
            .sort();
        out.set(s.name, hits);
    }
    return out;
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const rootFlag = argv.indexOf('--root');
    const root = rootFlag >= 0 ? (argv[rootFlag + 1] ?? REPO_ROOT) : REPO_ROOT;
    const minFlag = argv.indexOf('--min');
    const min = minFlag >= 0 ? Number(argv[minFlag + 1]) : null;
    const json = argv.includes('--json');

    const skills = loadSkills(root);
    const map = siblingsNamed(skills);
    const naming = [...map].filter(([, v]) => v.length > 0);

    if (json) {
        process.stdout.write(`${JSON.stringify({
            total: skills.length,
            naming: naming.length,
            entries: Object.fromEntries(naming),
        }, null, 1)}\n`);
    } else {
        process.stdout.write(`scanned: ${String(skills.length)}\n`);
        process.stdout.write(
            `sibling-naming: ${String(naming.length)}/${String(skills.length)} description(s) name at least one other shipped skill\n\n`,
        );
        for (const [name, hits] of naming) {
            process.stdout.write(`  ${name} → ${hits.join(', ')}\n`);
        }
    }

    if (min !== null && Number.isFinite(min) && naming.length < min) {
        process.stderr.write(
            `\n❌  measure_sibling_naming: ${String(naming.length)} below the declared floor of ${String(min)}\n`,
        );
        return 1;
    }
    return 0;
}

if (process.argv[1] !== undefined) {
    const invoked = pathToFileURL(path.resolve(process.argv[1])).href;
    if (invoked === import.meta.url) process.exitCode = main();
}
