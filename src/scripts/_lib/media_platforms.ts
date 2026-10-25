/**
 * media_platforms.ts — which public post or video a URL names, decided by a
 * table and nothing else. The router never fetches: it answers "platform +
 * canonical id" or names the reason it refuses, so the caller can print one
 * line instead of handing a doubtful URL to a downloader.
 *
 * A host matches only by exact name or as a subdomain of a listed domain, so a
 * lookalike (`tiktok.com.evil.io`, `youtube.co`) is refused as an unknown host
 * rather than resembling a known one.
 */

export type MediaPlatform = 'tiktok' | 'youtube' | 'instagram' | 'x' | 'vimeo' | 'loom' | 'linkedin' | 'reddit';

export interface MediaUrlMatch {
    ok: true;
    platform: MediaPlatform;
    id: string;
    canonical: string;
}

export interface MediaUrlRefusal {
    ok: false;
    reason: string;
}

export type MediaUrlVerdict = MediaUrlMatch | MediaUrlRefusal;

interface PlatformRow {
    platform: MediaPlatform;
    domains: readonly string[];
    match: (url: URL, host: string) => { id: string; canonical: string } | null;
}

const YT_ID = /^[A-Za-z0-9_-]{11}$/;

function segments(url: URL): string[] {
    return url.pathname.split('/').filter((s) => s !== '');
}

const PLATFORMS: readonly PlatformRow[] = [
    {
        platform: 'tiktok',
        domains: ['tiktok.com'],
        match: (url, host) => {
            const s = segments(url);
            if (host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
                return s.length === 1 && /^[A-Za-z0-9]+$/.test(s[0] as string)
                    ? { id: s[0] as string, canonical: `https://${host}/${s[0] as string}/` }
                    : null;
            }
            if (s[0] === 't' && s.length === 2 && /^[A-Za-z0-9]+$/.test(s[1] as string)) {
                return { id: s[1] as string, canonical: `https://www.tiktok.com/t/${s[1] as string}/` };
            }
            if (s.length === 3 && (s[0] as string).startsWith('@') && s[1] === 'video' && /^\d+$/.test(s[2] as string)) {
                return { id: s[2] as string, canonical: `https://www.tiktok.com/${s[0] as string}/video/${s[2] as string}` };
            }
            return null;
        },
    },
    {
        platform: 'youtube',
        domains: ['youtube.com', 'youtu.be'],
        match: (url, host) => {
            const s = segments(url);
            let id: string | null = null;
            if (host === 'youtu.be') id = s.length === 1 ? (s[0] as string) : null;
            else if (s[0] === 'watch' && s.length === 1) id = url.searchParams.get('v');
            else if (s.length === 2 && ['shorts', 'embed', 'live'].includes(s[0] as string)) id = s[1] as string;
            if (id === null || !YT_ID.test(id)) return null;
            return { id, canonical: `https://www.youtube.com/watch?v=${id}` };
        },
    },
    {
        platform: 'instagram',
        domains: ['instagram.com'],
        match: (url) => {
            const s = segments(url);
            if (s.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(s[1] as string)) return null;
            const kind = s[0] === 'reels' ? 'reel' : (s[0] as string);
            if (!['reel', 'p', 'tv'].includes(kind)) return null;
            return { id: s[1] as string, canonical: `https://www.instagram.com/${kind}/${s[1] as string}/` };
        },
    },
    {
        platform: 'x',
        domains: ['x.com', 'twitter.com'],
        match: (url) => {
            const s = segments(url);
            if (s.length < 3 || s[1] !== 'status' || !/^\d+$/.test(s[2] as string)) return null;
            if (!/^\w{1,15}$/.test(s[0] as string)) return null;
            return { id: s[2] as string, canonical: `https://x.com/${s[0] as string}/status/${s[2] as string}` };
        },
    },
    {
        platform: 'vimeo',
        domains: ['vimeo.com'],
        match: (url, host) => {
            const s = segments(url);
            const id = host === 'player.vimeo.com' ? (s[0] === 'video' && s.length === 2 ? s[1] : undefined) : s.length === 1 ? s[0] : undefined;
            return id !== undefined && /^\d+$/.test(id) ? { id, canonical: `https://vimeo.com/${id}` } : null;
        },
    },
    {
        platform: 'loom',
        domains: ['loom.com'],
        match: (url) => {
            const s = segments(url);
            if (s.length !== 2 || !['share', 'embed'].includes(s[0] as string) || !/^[0-9a-f]{32}$/.test(s[1] as string)) return null;
            return { id: s[1] as string, canonical: `https://www.loom.com/share/${s[1] as string}` };
        },
    },
    {
        platform: 'linkedin',
        domains: ['linkedin.com'],
        match: (url) => {
            const s = segments(url);
            if (s.length === 2 && s[0] === 'posts' && /^[\w%-]+$/.test(s[1] as string)) {
                return { id: s[1] as string, canonical: `https://www.linkedin.com/posts/${s[1] as string}` };
            }
            const activity = s[0] === 'feed' && s[1] === 'update' ? /^urn:li:activity:(\d+)$/.exec(decodeURIComponent(s[2] ?? '')) : null;
            if (activity !== null && s.length === 3) {
                return { id: activity[1] as string, canonical: `https://www.linkedin.com/feed/update/urn:li:activity:${activity[1] as string}/` };
            }
            return null;
        },
    },
    {
        platform: 'reddit',
        domains: ['reddit.com', 'redd.it'],
        match: (url, host) => {
            const s = segments(url);
            if (host === 'v.redd.it' || host === 'redd.it') {
                return s.length === 1 && /^[a-z0-9]+$/i.test(s[0] as string)
                    ? { id: s[0] as string, canonical: `https://${host}/${s[0] as string}` }
                    : null;
            }
            if (s.length >= 4 && s[0] === 'r' && s[2] === 'comments' && /^[a-z0-9]+$/i.test(s[3] as string)) {
                return { id: s[3] as string, canonical: `https://www.reddit.com/r/${s[1] as string}/comments/${s[3] as string}/` };
            }
            return null;
        },
    },
];

function onDomain(host: string, domain: string): boolean {
    return host === domain || host.endsWith(`.${domain}`);
}

export function classifyMediaUrl(raw: string): MediaUrlVerdict {
    let url: URL;
    try {
        url = new URL(raw.trim());
    } catch {
        return { ok: false, reason: 'not a URL' };
    }
    if (url.protocol !== 'https:') return { ok: false, reason: `scheme ${url.protocol} refused — only https is read` };
    if (url.username !== '' || url.password !== '') return { ok: false, reason: 'a URL carrying credentials is refused' };
    if (url.port !== '') return { ok: false, reason: `an explicit port (${url.port}) is refused` };
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    const row = PLATFORMS.find((p) => p.domains.some((d) => onDomain(host, d)));
    if (row === undefined) return { ok: false, reason: `host ${host} is not a supported media platform` };
    if (row.platform === 'youtube' && segments(url)[0] === 'playlist') {
        return { ok: false, reason: 'a playlist is refused — pass one video' };
    }
    const hit = row.match(url, host);
    if (hit === null) return { ok: false, reason: `${row.platform}: the path does not name a single post or video` };
    return { ok: true, platform: row.platform, ...hit };
}
