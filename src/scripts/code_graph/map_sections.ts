/**
 * Detail by command, not by file. `code-graph map --section <name>` prints one
 * MAP.md section, including those the budget cut, read from the drawn map's
 * own model, so the agent never opens the multi-megabyte `code/map.json`.
 *
 * `mapReadGuardLine` is the line a pre-read guard prints when a large generated
 * map file is opened; it names the command that answers instead.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { type MapMeta, mapMdParts } from './map.js';
import type { MapAreas } from './map_areas.js';
import type { MapModel } from './map_model.js';

export type SectionAnswer = { ok: true; name: string; body: string } | { ok: false; names: string[]; reason: string };

export function mapSection(mapDir: string, name: string): SectionAnswer {
    let doc: { meta: MapMeta; model: MapModel; areas: MapAreas };
    try {
        doc = JSON.parse(fs.readFileSync(path.join(mapDir, 'code', 'map.json'), 'utf-8')) as typeof doc;
    } catch {
        return { ok: false, names: [], reason: 'no drawn map — run `agent-config code-graph map`' };
    }
    const { sections } = mapMdParts(doc.model, doc.meta, doc.areas ?? {});
    const want = name.trim().toLowerCase();
    const hit = sections.find(([n, body]) => n.toLowerCase() === want || (/^## (.*)$/m.exec(body)?.[1] ?? '').toLowerCase().startsWith(want));
    if (!hit) return { ok: false, names: sections.map(([n]) => n), reason: `no section named ${JSON.stringify(name)}` };
    return { ok: true, name: hit[0], body: hit[1] };
}

/** Generated map files above this size are answered by command, not read. */
export const LARGE_MAP_FILE_BYTES = 64 * 1024;

/** The guard line for a read of `rel`, or null when the read is fine. */
export function mapReadGuardLine(rel: string, bytes: number): string | null {
    const p = rel.split(path.sep).join('/');
    if (!/(^|\/)agents\/map\//.test(p) || p.includes('/.build/') || bytes < LARGE_MAP_FILE_BYTES) return null;
    if (/\/code\/map\.json$/.test(p)) return `${p} is ${Math.round(bytes / 1024)} KB of generated model — ask instead: \`agent-config code-graph map --section <name>\`, or \`code-graph ask "<question>"\``;
    if (/\.(json|html)$/.test(p)) return `${p} is ${Math.round(bytes / 1024)} KB generated — ask instead: \`agent-config code-graph ask "<question>"\``;
    return null;
}
