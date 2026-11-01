/**
 * What a tracked map file may carry: a function of the tree alone. The drawn-at
 * commit, its date, the graph generation, the freshness, the drift since the
 * previous drawing and everything read from the working diff stay in
 * `manifest.json` and the viewer, so a redraw of an unchanged area writes the
 * same bytes and two branches touching different areas do not collide.
 */
import type { MapAreas } from './map_areas.js';
import * as fs from 'node:fs';
import * as path from 'node:path';

import type { MapManifest, MapMeta } from './map.js';
import type { MapModel } from './map_model.js';

/** The meta fields a tracked map file keeps: none that change when only the commit does. */
export function storedMeta(meta: MapMeta): MapMeta {
    return { title: meta.title, commit: '', state: '', summary: meta.summary, ...(meta.demo ? { demo: true } : {}) };
}

/**
 * The model without what names the commit (`pin`, `provenance.head`) or depends
 * on the previous drawing (`drift`): the manifest and the viewer carry those.
 */
export function storedModel(model: MapModel): MapModel {
    const { drift: _drift, pin: _pin, ...rest } = model as MapModel & { pin?: unknown };
    const prov = (rest as unknown as { provenance?: Record<string, unknown> }).provenance;
    if (prov && typeof prov === 'object') {
        const { head: _head, ...p } = prov;
        (rest as unknown as { provenance?: unknown }).provenance = p;
    }
    return rest as MapModel;
}

/** The knowledge areas without what reads the working diff (`impact`, the agent's diff pack), not the tree. */
export function storedAreas(areas: MapAreas): MapAreas {
    const { impact: _impact, ...rest } = areas as MapAreas & { impact?: unknown };
    const agent = (rest as unknown as { agent?: Record<string, unknown> }).agent;
    if (agent && typeof agent === 'object' && 'contextPack' in agent) {
        const { contextPack: _pack, ...a } = agent;
        (rest as unknown as { agent?: unknown }).agent = a;
    }
    return rest as MapAreas;
}

/**
 * JSON with one array element per line and one key per line in the outer two
 * object levels, so git merges edits to different records instead of
 * conflicting on a single line. Deterministic for a deterministic input.
 */
export function lineJson(v: unknown, depth = 0): string {
    const pad = ' '.repeat(depth);
    if (Array.isArray(v)) return v.length === 0 ? '[]' : `[\n${v.map((x) => `${pad} ${JSON.stringify(x ?? null)}`).join(',\n')}\n${pad}]`;
    if (v !== null && typeof v === 'object' && depth < 2) {
        const entries = Object.entries(v).filter(([, x]) => x !== undefined);
        return entries.length === 0 ? '{}' : `{\n${entries.map(([k, x]) => `${pad} ${JSON.stringify(k)}: ${lineJson(x, depth + 1)}`).join(',\n')}\n${pad}}`;
    }
    return JSON.stringify(v);
}

/** The manifest of the map in `dir`, or null. */
export function readManifestAt(dir: string): Partial<MapManifest> | null {
    try {
        return JSON.parse(fs.readFileSync(path.join(dir, 'manifest.json'), 'utf-8')) as Partial<MapManifest>;
    } catch {
        return null;
    }
}

/** A stored meta with commit, date, generation and freshness filled back in from the manifest. */
export function withManifest(meta: MapMeta, man: Partial<MapManifest> | null): MapMeta {
    const built = meta.built || man?.built;
    const generation = meta.graph_generation || man?.generation;
    return {
        ...meta,
        commit: meta.commit || man?.commit || '',
        state: meta.state || man?.state || '',
        ...(built ? { built } : {}),
        ...(generation ? { graph_generation: generation } : {}),
    };
}
