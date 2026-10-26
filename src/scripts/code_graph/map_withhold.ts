/**
 * Withholds from the map what the repository's own source-confidentiality gate
 * would block in a tracked file. The map is written into the tracked tree, so a
 * commit subject or an import specifier it copies is republished there: a name
 * the gate denies, or a `github.com/<owner>/<repo>` slug, which the gate blocks
 * under `agents/**` where the map lives.
 *
 * Active only where the gate's config exists. A repository without it runs no
 * such gate, and its import specifiers are ordinary data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { repoSlugHits } from '../_lib/source_shape.js';
import type { MapModel } from './map_model.js';

export const GATE_CONFIG = 'src/scripts/external_sources_denylist.json';
export const WITHHELD_SUBJECT = '[subject withheld]';

export type Withheld = (text: string) => boolean;

export function sourceWithholding(root: string): Withheld | null {
    let cfg: { deny?: string[]; deny_digests?: string[] };
    try {
        cfg = JSON.parse(fs.readFileSync(path.join(root, GATE_CONFIG), 'utf-8'));
    } catch {
        return null;
    }
    const deny = (cfg.deny ?? []).map((p) => new RegExp(p, 'i'));
    // Digests without a plaintext list cannot be checked here: withhold every text rather than guess.
    if (deny.length === 0 && (cfg.deny_digests ?? []).length > 0) return () => true;
    return (text) => deny.some((re) => re.test(text)) || repoSlugHits(text).length > 0;
}

/** Applies `withheld` to the copied strings in place; returns how many it withheld. */
export function withholdSources(model: MapModel, withheld: Withheld): number {
    let n = 0;
    for (const f of model.files) {
        const kept = f.externals.filter((e) => !withheld(e));
        n += f.externals.length - kept.length;
        f.externals = kept;
    }
    const top = model.analyses.externals.filter(([spec]) => !withheld(spec));
    n += model.analyses.externals.length - top.length;
    model.analyses.externals = top;
    for (const c of model.provenance?.commits ?? []) {
        if (withheld(c[5])) {
            c[5] = WITHHELD_SUBJECT;
            n++;
        }
    }
    return n;
}
