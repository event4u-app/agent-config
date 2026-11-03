/**
 * Loads `scanWebLaunch` from its conditional chunk beside the dispatch bundle,
 * through the shared `loadChunkExport`. Unbundled (source) runs return null:
 * the rows are tested through `scanWebLaunch` directly. A failed bundled load is
 * reported by the hook as a degraded pass, never as a clean one.
 */
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { Finding } from './design_pass_hook.js';
import { isBundled, loadChunkExport } from './svg_rules_loader.js';

export type WebLaunchScan = (rel: string, content: string) => Finding[];

export const WEB_LAUNCH_CHUNK = 'web_launch_rows.chunk.cjs';

export function loadWebLaunchScan(selfUrl: string = import.meta.url, bundled: boolean = isBundled()): WebLaunchScan | null {
    if (!bundled) return null;
    const specifier = path.join(path.dirname(fileURLToPath(selfUrl)), WEB_LAUNCH_CHUNK);
    return loadChunkExport<WebLaunchScan>(selfUrl, specifier, 'scanWebLaunch', true);
}
