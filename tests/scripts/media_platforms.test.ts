import { describe, expect, it } from 'vitest';

import { classifyMediaUrl } from '../../src/scripts/_lib/media_platforms.js';

describe('classifyMediaUrl — the platform table', () => {
    const accepted: [string, string, string][] = [
        ['https://www.tiktok.com/@someone/video/7312345678901234567', 'tiktok', '7312345678901234567'],
        ['https://vm.tiktok.com/ZMabc123/', 'tiktok', 'ZMabc123'],
        ['https://www.tiktok.com/t/ZTxyz789/', 'tiktok', 'ZTxyz789'],
        ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
        ['https://m.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123', 'youtube', 'dQw4w9WgXcQ'],
        ['https://youtu.be/dQw4w9WgXcQ', 'youtube', 'dQw4w9WgXcQ'],
        ['https://www.youtube.com/shorts/abcdefghijk', 'youtube', 'abcdefghijk'],
        ['https://www.instagram.com/reel/Cabc_12-x/', 'instagram', 'Cabc_12-x'],
        ['https://www.instagram.com/p/Cxyz987/', 'instagram', 'Cxyz987'],
        ['https://x.com/someone/status/1790000000000000000', 'x', '1790000000000000000'],
        ['https://twitter.com/someone/status/1790000000000000000/video/1', 'x', '1790000000000000000'],
        ['https://vimeo.com/123456789', 'vimeo', '123456789'],
        ['https://player.vimeo.com/video/123456789', 'vimeo', '123456789'],
        ['https://www.loom.com/share/0123456789abcdef0123456789abcdef', 'loom', '0123456789abcdef0123456789abcdef'],
        ['https://www.linkedin.com/posts/someone_topic-activity-7100000000000000000-abcd', 'linkedin', 'someone_topic-activity-7100000000000000000-abcd'],
        ['https://www.linkedin.com/feed/update/urn:li:activity:7100000000000000000/', 'linkedin', '7100000000000000000'],
        ['https://www.reddit.com/r/programming/comments/1abcde/some_title/', 'reddit', '1abcde'],
        ['https://v.redd.it/abc123xyz', 'reddit', 'abc123xyz'],
    ];

    it.each(accepted)('accepts %s as %s %s', (url, platform, id) => {
        const verdict = classifyMediaUrl(url);
        expect(verdict).toMatchObject({ ok: true, platform, id });
        if (verdict.ok) expect(verdict.canonical.startsWith('https://')).toBe(true);
    });

    it('canonicalises the short and mobile YouTube forms to one watch URL', () => {
        const forms = ['https://youtu.be/dQw4w9WgXcQ', 'https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/shorts/dQw4w9WgXcQ'];
        const canon = forms.map((u) => classifyMediaUrl(u)).map((v) => (v.ok ? v.canonical : v.reason));
        expect(new Set(canon)).toEqual(new Set(['https://www.youtube.com/watch?v=dQw4w9WgXcQ']));
    });

    it('refuses lookalike hosts instead of matching them by resemblance', () => {
        for (const url of [
            'https://tiktok.com.evil.io/@someone/video/7312345678901234567',
            'https://youtube.co/watch?v=dQw4w9WgXcQ',
            'https://eviltiktok.com/@someone/video/7312345678901234567',
            'https://youtu.be.attacker.net/dQw4w9WgXcQ',
        ]) {
            const verdict = classifyMediaUrl(url);
            expect(verdict.ok, url).toBe(false);
            if (!verdict.ok) expect(verdict.reason).toMatch(/not a supported media platform/);
        }
    });

    it('refuses non-https, credentials and an explicit port', () => {
        expect(classifyMediaUrl('http://www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ ok: false, reason: expect.stringMatching(/only https/) });
        expect(classifyMediaUrl('https://user:pw@www.youtube.com/watch?v=dQw4w9WgXcQ')).toMatchObject({ ok: false, reason: expect.stringMatching(/credentials/) });
        expect(classifyMediaUrl('https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ')).toMatchObject({ ok: false, reason: expect.stringMatching(/port/) });
    });

    it('refuses a playlist, a profile page and something that is not a URL', () => {
        expect(classifyMediaUrl('https://www.youtube.com/playlist?list=PL123')).toMatchObject({ ok: false, reason: expect.stringMatching(/playlist/) });
        expect(classifyMediaUrl('https://www.tiktok.com/@someone')).toMatchObject({ ok: false, reason: expect.stringMatching(/single post or video/) });
        expect(classifyMediaUrl('not a url')).toMatchObject({ ok: false, reason: 'not a URL' });
    });
});
