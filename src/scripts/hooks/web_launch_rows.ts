/**
 * The chunk entry for `design_pass_hook`'s web-launch rows: a third-party load
 * on first paint and a superseded statute on a legal page, over one written
 * file. Built as `web_launch_rows.chunk.cjs` by `hook_chunks.mjs` and loaded only
 * for an `.html`/`.css` write, so the register, the supersession table and the
 * row code cost the shared dispatch bundle nothing.
 */
import { origins } from '../../config/third-party-origins.json';
import { supersessions } from '../../config/web-launch-readiness.json';
import { type OriginRow, type Supersession, type WriteTimeHit, writeTimeFindings } from '../web_launch_third_party.js';

export function scanWebLaunch(rel: string, content: string): WriteTimeHit[] {
    return writeTimeFindings(rel, content, origins as OriginRow[], supersessions as Supersession[]);
}
