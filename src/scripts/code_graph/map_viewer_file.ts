/**
 * `agents/map/index.html` is local: gitignored and rendered from the committed
 * data (`code/map.json` and `manifest.json`), so it never conflicts and the data
 * is not stored twice. A redraw writes it with everything the drawing knew; when
 * the data changes without a redraw — a pull, a checkout, a fresh clone — it is
 * rendered from the stored data alone, without a graph. What only a drawing
 * knows (drift since the previous one, the working diff's impact and the agent's
 * diff pack) is absent from such a render until the next redraw.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { write_atomic } from '../_lib/fs_atomic.js';
import type { MapAreas } from './map_areas.js';
import { hasMap, mapJsonPath, readMapAt, renderHtml } from './map.js';
import { readManifestAt, stampViewer, viewerIsCurrent } from './map_stored.js';

/** The viewer page for the map in `dir`, from its stored data alone, or null when there is no readable map. */
export function viewerFromStored(dir: string): string | null {
    const read = readMapAt(dir);
    if (!read) return null;
    let areas: MapAreas = {};
    try {
        const parsed = JSON.parse(fs.readFileSync(mapJsonPath(dir), 'utf-8')) as { areas?: unknown };
        if (parsed.areas && typeof parsed.areas === 'object') areas = parsed.areas as MapAreas;
    } catch {
        /* readMapAt just parsed it; an unreadable areas block renders as none */
    }
    const man = readManifestAt(dir);
    const { meta, model } = read;
    model.pin = { commit: meta.commit, date: man?.built ?? '', freshness: meta.state, generation: meta.graph_generation ?? '' };
    return renderHtml(model, meta, areas);
}

export type ViewerOutcome = 'current' | 'rendered' | 'no-map' | 'failed';

/** Render `index.html` in `dir` from the committed data unless the copy on disk already matches it; never throws. */
export function ensureViewer(dir: string): ViewerOutcome {
    if (!hasMap(dir)) return 'no-map';
    if (viewerIsCurrent(dir)) return 'current';
    const html = viewerFromStored(dir);
    if (html === null) return 'no-map';
    try {
        write_atomic(path.join(dir, 'index.html'), html);
        stampViewer(dir);
    } catch {
        return 'failed';
    }
    return 'rendered';
}
