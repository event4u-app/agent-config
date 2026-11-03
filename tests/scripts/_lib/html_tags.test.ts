// Tests for src/scripts/_lib/html_tags.ts — the one attribute reader the web-launch
// gate and the third-party classifier share. Every case is a FORM change that
// must not change what is read.
import { describe, expect, it } from 'vitest';

import { HEAD_TAGS, LOADABLE_TAGS, attr, tagsOf, titleOf } from '../../../src/scripts/_lib/html_tags';

const meta = (html: string) => tagsOf(html, HEAD_TAGS).filter((t) => t.name === 'meta')[0]?.tag ?? '';

describe('attr reads an attribute whatever the order, quoting, case or spacing', () => {
    it('attribute order does not matter', () => {
        expect(attr(meta('<meta name="robots" content="noindex">'), 'content')).toBe('noindex');
        expect(attr(meta('<meta content="noindex" name="robots">'), 'name')).toBe('robots');
    });

    it('double, single and unquoted values read the same', () => {
        for (const html of ['<meta name="robots">', "<meta name='robots'>", '<meta name=robots>']) {
            expect([html, attr(meta(html), 'name')]).toEqual([html, 'robots']);
        }
    });

    it('attribute names are case-insensitive', () => {
        expect(attr(meta('<META NAME="robots" CONTENT="noindex">'), 'content')).toBe('noindex');
    });

    it('whitespace around = and between attributes, including newlines, is tolerated', () => {
        expect(attr(meta('<meta\n  name = "robots"\n\tcontent =\n"none">'), 'content')).toBe('none');
    });

    it('self-closing tags read the value without the slash', () => {
        expect(attr(meta('<meta name=robots content=noindex/>'), 'content')).toBe('noindex');
        expect(attr(meta('<meta name="robots" content="noindex" />'), 'content')).toBe('noindex');
    });

    it('data-src is never read as src', () => {
        const [img] = tagsOf('<img data-src="https://a.example/x.png">');
        expect(attr(img?.tag ?? '', 'src')).toBeUndefined();
        expect(attr(img?.tag ?? '', 'data-src')).toBe('https://a.example/x.png');
    });

    it('a value containing the other quote is kept whole', () => {
        expect(attr(meta(`<meta name="description" content="Bob's garden">`), 'content')).toBe("Bob's garden");
    });

    it('an absent attribute is undefined, an empty one is the empty string', () => {
        expect(attr(meta('<meta name="robots">'), 'content')).toBeUndefined();
        expect(attr(meta('<meta name="robots" content="">'), 'content')).toBe('');
    });
});

describe('tagsOf takes the tag set it reads', () => {
    it('defaults to the loadable set, so meta and title are not read by the third-party pass', () => {
        expect(LOADABLE_TAGS).not.toContain('meta');
        expect(tagsOf('<meta name=a><link href=b>').map((t) => t.name)).toEqual(['link']);
    });

    it('the head set reads meta, link and title, and nothing that merely starts with those letters', () => {
        expect(tagsOf('<meta a><link b><title>x</title><metadata><linkx>', HEAD_TAGS).map((t) => t.name)).toEqual([
            'meta',
            'link',
            'title',
        ]);
    });

    it('a tag name is matched case-insensitively and reported lowercase', () => {
        expect(tagsOf('<META name=a>', HEAD_TAGS).map((t) => t.name)).toEqual(['meta']);
    });
});

describe('titleOf reads the title text', () => {
    it('trims, reads attributes on the tag, and is undefined when absent', () => {
        expect(titleOf('<title lang="en">\n  Acme — Gardens  </title>')).toBe('Acme — Gardens');
        expect(titleOf('<p>no title</p>')).toBeUndefined();
        expect(titleOf('<title></title>')).toBeUndefined();
    });
});
