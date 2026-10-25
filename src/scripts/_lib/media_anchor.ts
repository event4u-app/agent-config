/**
 * media_anchor.ts — the anchor grammar for a statement taken from a video:
 * `S1@01:05` (source, timestamp) or `S1@01:05 #3` (plus the contact-sheet tile
 * that shows it). Past an hour the form is `S1@1:02:03`; a minute or second
 * field past 59 is not a timestamp and is refused.
 */

export interface MediaAnchor {
    source: number;
    seconds: number;
    tile: number | null;
}

const ANCHOR = /^S([1-9]\d*)@(?:(\d+):)?([0-5]\d):([0-5]\d)(?: #([1-9]\d*))?$/;

export function parseMediaAnchor(text: string): MediaAnchor | null {
    const m = ANCHOR.exec(text);
    if (m === null) return null;
    const hours = m[2] === undefined ? 0 : Number(m[2]);
    return {
        source: Number(m[1]),
        seconds: hours * 3600 + Number(m[3]) * 60 + Number(m[4]),
        tile: m[5] === undefined ? null : Number(m[5]),
    };
}

export function isMediaAnchor(text: string): boolean {
    return parseMediaAnchor(text) !== null;
}

export function formatTimestamp(seconds: number): string {
    const whole = Math.max(0, Math.floor(seconds));
    const h = Math.floor(whole / 3600);
    const mm = String(Math.floor((whole % 3600) / 60)).padStart(2, '0');
    const ss = String(whole % 60).padStart(2, '0');
    return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}
