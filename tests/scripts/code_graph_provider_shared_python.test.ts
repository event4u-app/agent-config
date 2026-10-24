import { describe, expect, it } from 'vitest';

import { assignedCalls, balanced, importedModules, kwargString, splitArgs, stringLiteral } from '../../src/scripts/code_graph/providers/shared/python.js';

describe('python provider helpers', () => {
    it('balances a call across nested brackets and strings holding brackets', () => {
        const src = 'f(a, g("(x"), [1, 2]) + 1';
        expect(balanced(src, 1)).toBe('a, g("(x"), [1, 2]');
    });

    it('splits arguments at top-level commas only', () => {
        expect(splitArgs('"x/", views.fn, name="a,b", kw=dict(a=1, b=2)')).toEqual(['"x/"', 'views.fn', 'name="a,b"', 'kw=dict(a=1, b=2)']);
        expect(splitArgs('')).toEqual([]);
    });

    it('reads plain and raw string literals, and nothing else', () => {
        expect(stringLiteral('r"^a/$"')).toBe('^a/$');
        expect(stringLiteral("'x'")).toBe('x');
        expect(stringLiteral('name')).toBeNull();
        expect(stringLiteral('"a" + b')).toBeNull();
    });

    it('reads a keyword literal without matching a longer key', () => {
        expect(kwargString('"n", url_prefix="/api"', 'url_prefix')).toBe('/api');
        expect(kwargString('"n", my_prefix="/no"', 'prefix')).toBeUndefined();
    });

    it('finds module-level constructor assignments by variable', () => {
        const calls = assignedCalls('app = FastAPI()\nrouter: APIRouter = fastapi.APIRouter(prefix="/v")\n    inner = FastAPI()\n', ['FastAPI', 'APIRouter']);
        expect([...calls.keys()]).toEqual(['app', 'router']);
        expect(calls.get('router')?.args).toBe('prefix="/v"');
    });

    it('maps imported modules, absolute and relative, only when the file exists', () => {
        const inventory = new Set(['blog/views.py', 'blog/api/__init__.py', 'blog/urls.py']);
        const src = 'from blog import views, missing\nfrom . import api as rest\nfrom .views import index\n';
        const mods = importedModules('blog/urls.py', src, [''], inventory);
        expect([...mods]).toEqual([
            ['views', 'blog/views.py'],
            ['rest', 'blog/api/__init__.py'],
        ]);
    });
});
