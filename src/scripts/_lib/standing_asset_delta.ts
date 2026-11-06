/**
 * Per-asset delta of the always-loaded payload between two checkouts.
 *
 * The bucket table of `check_standing_payload_delta` says how much a bucket
 * moved; it cannot say which file moved it. This lists every always-loaded asset
 * whose loaded size changed, measured the way the ratchet measures it: a
 * projected rule by its file size, a skill by its catalog entry (name and
 * description — the body is not loaded until the skill is used), and the
 * project CLAUDE.md files by their size.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { PREFIX_STABLE_SURFACES } from './prefix_stable_surfaces.js';
import { parseFrontmatter } from '../preamble_byte_census.js';

export interface AssetDelta {
    asset: string;
    base: number | null;
    head: number | null;
    delta_chars: number;
    delta_tokens: number;
}

function root(id: string): string {
    const s = PREFIX_STABLE_SURFACES.find((x) => x.id === id);
    if (s === undefined) throw new Error(`prefix-stable surface '${id}' is not declared`);
    return s.root;
}

/** Loaded size of every always-loaded asset under `repoRoot`, keyed by repo-relative path. */
export function assetSizes(repoRoot: string): Map<string, number> {
    const out = new Map<string, number>();
    const rules = root('project-scope-rules');
    const rulesDir = path.join(repoRoot, rules);
    if (fs.existsSync(rulesDir)) {
        for (const name of fs.readdirSync(rulesDir).filter((n) => n.endsWith('.md')).sort()) {
            out.set(`${rules}/${name}`, fs.statSync(path.join(rulesDir, name)).size);
        }
    }
    const skills = root('preloaded-skills-catalog');
    const skillsDir = path.join(repoRoot, skills);
    if (fs.existsSync(skillsDir)) {
        for (const entry of fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory())) {
            const file = path.join(skillsDir, entry.name, 'SKILL.md');
            if (!fs.existsSync(file)) continue;
            const fm = parseFrontmatter(fs.readFileSync(file, 'utf-8'));
            const name = typeof fm.name === 'string' && fm.name.length > 0 ? fm.name : entry.name;
            const description = typeof fm.description === 'string' ? fm.description : '';
            out.set(`${skills}/${entry.name}/SKILL.md`, `- ${name}: ${description}\n`.length);
        }
    }
    for (const name of ['CLAUDE.md', 'CLAUDE.local.md']) {
        const file = path.join(repoRoot, name);
        if (fs.existsSync(file)) out.set(name, fs.statSync(file).size);
    }
    return out;
}

/** Assets whose loaded size differs between the two trees, largest change first, ties by path. */
export function assetDeltas(baseRoot: string, headRoot: string): AssetDelta[] {
    const base = assetSizes(baseRoot);
    const head = assetSizes(headRoot);
    const out: AssetDelta[] = [];
    for (const asset of new Set([...base.keys(), ...head.keys()])) {
        const b = base.get(asset) ?? null;
        const h = head.get(asset) ?? null;
        const delta = (h ?? 0) - (b ?? 0);
        if (b !== null && h !== null && delta === 0) continue;
        out.push({ asset, base: b, head: h, delta_chars: delta, delta_tokens: Math.round(delta / 4) });
    }
    return out.sort((x, y) => Math.abs(y.delta_chars) - Math.abs(x.delta_chars) || x.asset.localeCompare(y.asset));
}

export function renderAssetDeltas(rows: readonly AssetDelta[]): string {
    const sign = (n: number): string => (n > 0 ? `+${String(n)}` : String(n));
    const out = ['### Changed always-loaded assets', ''];
    if (rows.length === 0) return [...out, '_No always-loaded asset changed in this diff._', ''].join('\n');
    out.push('| asset | base chars | head chars | Δ chars | Δ tok (chars/4) |', '|---|---:|---:|---:|---:|');
    for (const r of rows) {
        out.push(`| \`${r.asset}\` | ${r.base ?? '—'} | ${r.head ?? '—'} | ${sign(r.delta_chars)} | ${sign(r.delta_tokens)} |`);
    }
    out.push('', '_A behaviour claim for a change listed here names its evidence tier in the PR body (`docs/contracts/evidence-basis.md`)._', '');
    return out.join('\n');
}
