// The two checks `check_no_external_sources` runs on one tracked file — the
// plaintext deny list and the attribution-shape heuristic at its tier — applied
// to content that has not been committed yet, so a generated artefact can be
// tested before it ever reaches the tree.
import { _load_config } from '../../src/scripts/check_no_external_sources.js';
import { shapeHits, shapePathHits, tierFor } from '../../src/scripts/_lib/source_shape.js';

export function sourceGateFindings(rel: string, text: string): string[] {
    const deny = _load_config().deny.map((p) => [p, new RegExp(p, 'i')] as const);
    const out: string[] = [];
    const block = tierFor(rel) === 'block';
    if (block) for (const h of shapePathHits(rel)) out.push(`path ${h.cls}`);
    text.split('\n').forEach((line, i) => {
        for (const [p, re] of deny) if (re.test(line)) out.push(`${String(i + 1)}: deny ${p}`);
        if (block) for (const h of shapeHits(line)) out.push(`${String(i + 1)}: ${h.cls}`);
    });
    return out;
}
