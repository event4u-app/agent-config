/**
 * Surface-tier (core vs lab) resolution for the install split.
 *
 * TypeScript twin of `src/scripts/_lib/surface_tiers.py` (ADR-200 — Python→TS
 * migration). Public API mirrors the Python module exactly (snake_case kept
 * deliberately — fidelity over TS idiom).
 *
 * road-to-install-contract-stability Phase 2. `core` = the lean stable engine
 * users install; `lab` = experimental / pilot tooling. A core-only install
 * excludes `lab`-tier artefacts so lab churn cannot destabilise the adoptable
 * surface.
 *
 * Pack tier lives in `src/config/discovery/packs.yml` (`surface_tier: lab`);
 * the deployed artefacts carry it in frontmatter — commands as `pack:` (scalar),
 * skills as `packs:` (list). The script-cluster tier registry is
 * `src/scripts/surface-tiers.yml` (consumed by the boundary guard, not here).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import type * as YamlModule from 'yaml';

// Conservative fallback if packs.yml is unreadable: the day-one lab packs.
const _LAB_FALLBACK: ReadonlySet<string> = new Set(['ai-video', 'ai-image', 'fun']);

/** Pack ids tagged `surface_tier: lab` in packs.yml (+ safe fallback). */
export function load_lab_pack_ids(repo_root: string): Set<string> {
    const vocab = path.join(repo_root, 'src', 'config', 'discovery', 'packs.yml');
    const ids = new Set<string>();
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const YAML = require('yaml') as typeof YamlModule;
        // version '1.1' matches PyYAML's safe_load.
        const data = YAML.parse(fs.readFileSync(vocab, 'utf-8'), { version: '1.1' });
        for (const entry of (data as unknown[]) ?? []) {
            if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
                const rec = entry as Record<string, unknown>;
                if (rec['surface_tier'] === 'lab') {
                    const pid = rec['id'];
                    if (typeof pid === 'string') {
                        ids.add(pid);
                    }
                }
            }
        }
    } catch {
        // packs.yml missing / unparseable / no yaml → conservative fallback.
        return new Set(_LAB_FALLBACK);
    }
    return ids.size > 0 ? ids : new Set(_LAB_FALLBACK);
}

/**
 * Parse a markdown file's leading frontmatter into its pack set.
 *
 * Handles both shapes: `pack: <id>` (commands) and `packs:` followed by
 * `- <id>` list items (skills). Returns an empty set on any parse failure
 * or when the file carries no pack tag.
 */
export function frontmatter_packs(md_path: string): Set<string> {
    let text: string;
    try {
        text = fs.readFileSync(md_path, 'utf-8');
    } catch {
        // OSError / decode error → empty.
        return new Set();
    }
    if (!text.startsWith('---')) {
        return new Set();
    }
    const end = text.indexOf('\n---', 3);
    const block = end !== -1 ? text.slice(3, end) : text.slice(3);

    const packs = new Set<string>();
    let in_packs_list = false;
    for (const raw of block.split('\n')) {
        const line = raw.replace(/\s+$/, '');
        const stripped = line.trim();
        if (in_packs_list) {
            if (stripped.startsWith('- ')) {
                packs.add(_strip_quotes(stripped.slice(2).trim()));
                continue;
            }
            in_packs_list = false;
        }
        if (stripped.startsWith('pack:')) {
            const val = _strip_quotes(stripped.split(':').slice(1).join(':').trim());
            if (val) {
                packs.add(val);
            }
        } else if (stripped.startsWith('packs:')) {
            const inline = stripped.split(':').slice(1).join(':').trim();
            if (inline.startsWith('[') && inline.endsWith(']')) {
                for (const raw_item of inline.slice(1, -1).split(',')) {
                    const item = _strip_quotes(raw_item.trim());
                    if (item) {
                        packs.add(item);
                    }
                }
            } else {
                in_packs_list = true;
            }
        }
    }
    return packs;
}

/** True when a deployed markdown artefact belongs to a lab-tier pack. */
export function is_lab_artefact(md_path: string, lab_ids: Set<string>): boolean {
    for (const p of frontmatter_packs(md_path)) {
        if (lab_ids.has(p)) {
            return true;
        }
    }
    return false;
}

/** Mirror of Python `str.strip("'\"")` — strips matching outer quote chars. */
function _strip_quotes(s: string): string {
    let out = s;
    while (out.length > 0 && (out[0] === "'" || out[0] === '"')) {
        out = out.slice(1);
    }
    while (out.length > 0 && (out[out.length - 1] === "'" || out[out.length - 1] === '"')) {
        out = out.slice(0, -1);
    }
    return out;
}
