import { describe, expect, it } from 'vitest';

import { areaTitles } from '../../src/scripts/code_graph/map_model.js';

const area = (name: string, kind: 'area' | 'small-parts' = 'area') => ({ name, kind });

describe('area working titles', () => {
    it('names an area after its hub file, words split and capitalised', () => {
        expect(areaTitles([area('src/order_service.ts'), area('app/Http/UserController.php')])).toEqual(['Order Service', 'User Controller']);
    });

    it('a unique title stays unchanged while colliding ones get the shortest distinguishing parent folder', () => {
        const titles = areaTitles([area('pkg/billing/core.py'), area('pkg/auth/core.py'), area('pkg/billing/ledger.py')]);
        expect(titles).toEqual(['billing · Core', 'auth · Core', 'Ledger']);
    });

    it('reaches further up only as far as the paths need', () => {
        const titles = areaTitles([area('a/billing/core.py'), area('b/billing/core.py'), area('c/auth/core.py')]);
        expect(new Set(titles).size).toBe(3);
        expect(titles).toEqual(['a/billing · Core', 'b/billing · Core', 'auth · Core']);
    });

    it('a hub at the root keeps the bare title beside a prefixed one', () => {
        expect(areaTitles([area('core.py'), area('svc/core.py')])).toEqual(['Core', 'svc · Core']);
    });

    it('same folder, same stem, different extension: the file name decides', () => {
        const titles = areaTitles([area('lib/core.ts'), area('lib/core.py')]);
        expect(new Set(titles).size).toBe(2);
        expect(titles).toEqual(['lib · core.ts', 'lib · core.py']);
    });

    it('small parts are named after their folder and disambiguated the same way', () => {
        const titles = areaTitles([area('small parts · a/utils', 'small-parts'), area('small parts · b/utils', 'small-parts'), area('small parts · docs', 'small-parts')]);
        expect(titles).toEqual(['a · utils', 'b · utils', 'docs']);
    });

    it('an area and a small-parts bucket with the same word never collide, they are labelled apart in the viewer', () => {
        expect(areaTitles([area('x/utils.ts'), area('small parts · utils', 'small-parts')])).toEqual(['Utils', 'utils']);
    });

    it('is deterministic for any input order', () => {
        const input = [area('p/q/core.py'), area('r/q/core.py'), area('s/core.py')];
        const forward = areaTitles(input);
        const backward = areaTitles([...input].reverse()).reverse();
        expect(backward).toEqual(forward);
        expect(new Set(forward).size).toBe(3);
    });
});
