#!/usr/bin/env node
/**
 * B6 — the falsifiability lock for per-skill honest-null `gaps:`.
 *
 * Every `gaps[].witness` in a skill's frontmatter must point at a test file that
 * EXISTS (pointer integrity). The witness *passing* — and going red when the gap
 * is fixed (the stale-gap audit) — is enforced by the ordinary test suite; this
 * script guarantees the pointer never rots and the shape is well-formed, so the
 * proof page's "Known Limits" can never cite a phantom witness.
 *
 * Read-only over `src/skills/*\/SKILL.md`. Exit 0 clean / 1 on any broken pointer
 * or malformed entry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
export const ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const SKILLS_DIR = path.join(ROOT, 'src', 'skills');
const FRONTMATTER_RE = /^---\n([\s\S]*?)\n---\n/;

export interface Gap {
    description: string;
    witness: string;
}
export interface SkillGaps {
    skill: string;
    file: string;
    gaps: Gap[];
}

/** Parse `gaps:` from every SKILL.md that declares them. */
export function collectSkillGaps(skillsDir: string = SKILLS_DIR): SkillGaps[] {
    const out: SkillGaps[] = [];
    let names: string[];
    try {
        names = fs.readdirSync(skillsDir).sort();
    } catch {
        return out;
    }
    for (const name of names) {
        const file = path.join(skillsDir, name, 'SKILL.md');
        if (!fs.existsSync(file)) continue;
        const m = FRONTMATTER_RE.exec(fs.readFileSync(file, 'utf-8'));
        if (!m) continue;
        let fm: Record<string, unknown> | null;
        try {
            fm = parseYaml(m[1] as string) as Record<string, unknown> | null;
        } catch {
            continue;
        }
        if (!fm || !Array.isArray(fm.gaps) || fm.gaps.length === 0) continue;
        out.push({ skill: name, file, gaps: fm.gaps as Gap[] });
    }
    return out;
}

export function findBrokenPointers(entries: SkillGaps[], root: string = ROOT): string[] {
    const errs: string[] = [];
    for (const e of entries) {
        e.gaps.forEach((g, i) => {
            if (typeof g?.description !== 'string' || !g.description.trim()) {
                errs.push(`${e.skill}: gaps[${i}] missing/empty description`);
            }
            if (typeof g?.witness !== 'string' || !g.witness.trim()) {
                errs.push(`${e.skill}: gaps[${i}] missing/empty witness`);
                return;
            }
            if (!fs.existsSync(path.join(root, g.witness))) {
                errs.push(`${e.skill}: gaps[${i}] witness not found: ${g.witness}`);
            }
        });
    }
    return errs;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    const quiet = argv.includes('--quiet');
    const entries = collectSkillGaps();
    const errs = findBrokenPointers(entries);
    if (errs.length > 0) {
        process.stdout.write('❌ skill gaps:\n');
        for (const e of errs.sort()) process.stdout.write(`  - ${e}\n`);
        return 1;
    }
    const gapCount = entries.reduce((n, e) => n + e.gaps.length, 0);
    if (!quiet) {
        process.stdout.write(
            `✅  skill gaps: ${gapCount} gap(s) across ${entries.length} skill(s), all witness pointers resolve.\n`,
        );
    }
    return 0;
}

const _isCli =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCli) process.exit(main());
