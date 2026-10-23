import { describe, expect, it } from 'vitest';

import {
    annotationRoutes,
    callRoutes,
    fsRoutes,
    joinRoute,
    lastArgName,
    snakePlural,
    tableMapping,
    templateRoots,
} from '../../src/scripts/code_graph/providers/shared/extractors.js';
import { makeKit } from '../../src/scripts/code_graph/providers/shared/kit.js';
import { EMPTY_RESOLUTION_CONFIG } from '../../src/scripts/code_graph/resolution_tiers.js';
import type { CodeEdge, CodeNode } from '../../src/scripts/code_graph/types.js';

const sym = (file: string, name: string, kind: CodeNode['kind'], from: number, to: number): CodeNode => ({
    id: kind === 'method' ? `${file}#${name}` : `${file}#${name}`,
    label: name.split('::').pop() as string,
    kind,
    source_file: file,
    source_location: [from, 1, to, 1],
});

function kitFor(files: Record<string, string>, nodes: CodeNode[], paths: string[] = Object.keys(files), edges: CodeEdge[] = []) {
    return makeKit({
        files: Object.entries(files).map(([p, source]) => ({ path: p, source })),
        baseNodes: nodes,
        baseEdges: edges,
        paths,
        resolution: EMPTY_RESOLUTION_CONFIG,
        roots: [''],
    });
}

const routes = (k: ReturnType<typeof makeKit>) => {
    const r = k.result();
    return r.nodes
        .filter((n) => n.kind === 'route')
        .map((n) => [n.label, r.edges.filter((e) => e.source === n.id && e.relation === 'routes-to').map((e) => e.target)]);
};

describe('helpers', () => {
    it('joins route parts without doubled slashes', () => {
        expect(joinRoute('/api/', '/users/')).toBe('/api/users');
        expect(joinRoute(undefined, '')).toBe('/');
    });

    it('reads the last argument only when it is a name', () => {
        expect(lastArgName(' auth, users.create);')).toBe('users.create');
        expect(lastArgName(' (req, res) => res.send(1));')).toBeNull();
    });

    it('pluralises a class name into a table name', () => {
        expect(snakePlural('BookChapter')).toBe('book_chapters');
        expect(snakePlural('Category')).toBe('categories');
    });
});

describe('annotationRoutes', () => {
    const src = 'from x import app\n\n@app.get("/items")\ndef items():\n    return []\n\nx = cache.get("/items")\n';
    const nodes = [sym('main.py', 'items', 'function', 4, 5)];

    it('routes a decorator to the function below it', () => {
        const k = kitFor({ 'main.py': src }, nodes);
        annotationRoutes(k, { exts: ['.py'], route: /@\w+\.(?<verb>get|post)\(\s*["'](?<path>[^"']*)["']/g });
        expect(routes(k)).toEqual([['GET /items', ['main.py#items']]]);
    });

    it('applies a class prefix and ignores calls that are no decorators', () => {
        const java = '@RequestMapping("/api")\nclass Users {\n  @GetMapping("/users")\n  List<User> list() { return null; }\n}\n';
        const k = kitFor({ 'Users.java': java }, [sym('Users.java', 'Users', 'class', 2, 5), sym('Users.java', 'Users::list', 'method', 4, 4)]);
        annotationRoutes(k, {
            exts: ['.java'],
            route: /@(?<verb>Get|Post)Mapping\(\s*"(?<path>[^"]*)"/g,
            prefix: /@RequestMapping\(\s*"(?<path>[^"]*)"/g,
        });
        expect(routes(k)).toEqual([['GET /api/users', ['Users.java#Users::list']]]);
    });
});

describe('callRoutes', () => {
    it('resolves a same-file handler and leaves an inline one without a target', () => {
        const src = "function list() {}\nrouter.get('/a', list);\nrouter.get('/b', () => 1);\n";
        const k = kitFor({ 'r.js': src }, [sym('r.js', 'list', 'function', 1, 1)]);
        callRoutes(k, { exts: ['.js'], call: /router\.(?<verb>get)\(\s*'(?<path>[^']*)'\s*,(?=(?<rest>[\s\S]{0,100}))/g });
        expect(routes(k)).toEqual([
            ['GET /a', ['r.js#list']],
            ['GET /b', []],
        ]);
    });
});

describe('fsRoutes', () => {
    it('declares a route per page module and skips the rest', () => {
        const k = kitFor({}, [], ['site/pages/about.vue', 'site/components/x.vue']);
        fsRoutes(k, { route: (p) => (p.startsWith('site/pages/') ? { verb: 'PAGE', path: '/about' } : null) });
        expect(routes(k)).toEqual([['PAGE /about', ['site/pages/about.vue']]]);
    });
});

describe('tableMapping', () => {
    it('maps an entity to its named table and a migration to the table it creates', () => {
        const entity = '@Entity\n@Table(name = "app_users")\nclass User {\n}\n';
        const plain = 'class Note {\n}\n';
        const k = kitFor(
            { 'User.java': entity, 'Note.java': plain, 'db/V1.sql.java': 'create("app_users")' },
            [sym('User.java', 'User', 'class', 3, 4), sym('Note.java', 'Note', 'class', 1, 2)],
        );
        tableMapping(k, {
            exts: ['.java'],
            entity: /@Entity\b/g,
            tableName: /@Table\(\s*name\s*=\s*"(?<name>[^"]+)"/,
            convention: snakePlural,
            migration: { files: (p) => p.startsWith('db/'), create: /create\("(?<name>\w+)"\)/g },
        });
        const r = k.result();
        expect(r.edges.map((e) => `${e.source} ${e.relation} ${e.target}`).sort()).toEqual([
            'User.java#User persists table:app_users',
            'db/V1.sql.java migrates table:app_users',
        ]);
        expect(r.nodes.filter((n) => n.kind === 'table').map((n) => n.id)).toEqual(['table:app_users']);
    });
});

describe('tableMapping on adjacent entities', () => {
    it('never reads the table name of the class above', () => {
        const src = '@Entity\n@Table(name = "first_t")\nclass First {\n}\n@Entity\nclass Second {\n}\n';
        const k = kitFor({ 'E.java': src }, [sym('E.java', 'First', 'class', 3, 4), sym('E.java', 'Second', 'class', 6, 7)]);
        tableMapping(k, {
            exts: ['.java'],
            entity: /@Entity\b/g,
            tableName: /@Table\(\s*name\s*=\s*"(?<name>[^"]+)"/,
            convention: snakePlural,
        });
        expect(k.result().edges.map((e) => `${e.source} ${e.target}`).sort()).toEqual([
            'E.java#First table:first_t',
            'E.java#Second table:seconds',
        ]);
    });
});

describe('templateRoots', () => {
    it('resolves a rendered name to the one template under a root, and refuses two', () => {
        const src = 'def a():\n    return render_template("home.html")\n\ndef b():\n    return render_template("dup.html")\n';
        const k = kitFor({ 'app.py': src }, [sym('app.py', 'a', 'function', 1, 2), sym('app.py', 'b', 'function', 4, 5)], [
            'app.py',
            'templates/home.html',
            'templates/dup.html',
            'app/templates/dup.html',
        ]);
        templateRoots(k, {
            exts: ['.py'],
            call: /render_template\(\s*["'](?<name>[^"']+)["']/g,
            roots: ['templates', 'app/templates'],
            extensions: ['.html'],
        });
        const r = k.result();
        expect(r.edges.map((e) => `${e.source} ${e.relation} ${e.target}`)).toEqual(['app.py#a renders templates/home.html']);
        expect(r.nodes.map((n) => n.id)).toEqual(['templates/home.html']);
    });
});
