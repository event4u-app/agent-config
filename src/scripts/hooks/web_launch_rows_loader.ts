/**
 * Loads `scanWebLaunch` from its conditional chunk beside the dispatch bundle,
 * through the shared `loadChunkExport`. Unbundled (source) runs return null:
 * the rows are tested through `scanWebLaunch` directly. A failed load loses
 * only these rows, never the pass.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { WriteTimeHit } from '../web_launch_third_party.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export type WebLaunchScan = (rel: string, content: string) => WriteTimeHit[];

export const WEB_LAUNCH_CHUNK = 'web_launch_rows.chunk.cjs';

export function loadWebLaunchScan(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): WebLaunchScan | null {
    if (!bundled) return null;
    return loadChunkExport<WebLaunchScan>(selfUrl, path.join(path.dirname(fileURLToPath(selfUrl)), WEB_LAUNCH_CHUNK), 'scanWebLaunch', true);
}
