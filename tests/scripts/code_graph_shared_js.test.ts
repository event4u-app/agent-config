import { describe, expect, it } from 'vitest';

import { cleanRoute, objectAt, valueOf } from '../../src/scripts/code_graph/providers/shared/js.js';

describe('shared JS provider helpers', () => {
    it('reads an object literal around an index, blanking nested objects and arrays', () => {
        const src = "x([{ path: 'a', children: [{ path: 'b', component: B }], lazy: () => import('./a') }])";
        const obj = objectAt(src, src.indexOf("path: 'a'"));
        expect(obj).not.toBeNull();
        expect(obj?.flat).not.toContain("'b'");
        expect(valueOf(obj?.flat ?? '', 'lazy')).toBe("() => import('./a')");
        expect(valueOf(obj?.flat ?? '', 'component')).toBeNull();
    });

    it('declines an index inside a call rather than an object', () => {
        const src = "route('a', handler)";
        expect(objectAt(src, src.indexOf("'a'"))).toBeNull();
    });

    it('cleans route segments the way the default pass does', () => {
        expect(cleanRoute(['(shop)', 'items', '[id]', 'index'])).toBe('/items/[id]');
        expect(cleanRoute([])).toBe('/');
    });
});
