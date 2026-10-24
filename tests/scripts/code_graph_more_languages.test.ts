import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { buildFromRepo, resolveLangModule } from '../../src/scripts/code_graph/build.js';
import { extractFile, vueScript } from '../../src/scripts/code_graph/extract.js';
import type { CodeGraph } from '../../src/scripts/code_graph/types.js';
import { validateGraph } from '../../src/scripts/code_graph/validate.js';

let root: string;
let graph: CodeGraph;

function write(rel: string, body: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body);
}
const edge = (source: string, relation: string, target: string) =>
    graph.edges.find((e) => e.source === source && e.relation === relation && e.target === target);

beforeAll(async () => {
    root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'cg-langs-')));
    // Python
    write('pkg/__init__.py', '');
    write('pkg/mod.py', 'def helper(x):\n    return x\n\nclass Base:\n    def go(self):\n        return 1\n');
    write(
        'app/main.py',
        'from pkg.mod import helper as h, Base\nimport os\n\nclass A(Base):\n    def run(self):\n        self.go()\n        return h(1)\n',
    );
    // Java
    write('src/main/java/a/c/Helper.java', 'package a.c;\npublic class Helper {\n  public static void go() {}\n}\n');
    write(
        'src/main/java/a/b/A.java',
        'package a.b;\nimport a.c.Helper;\npublic class A {\n  public void run() { Helper.go(); this.other(); }\n  void other() {}\n}\n',
    );
    // Go
    write('go.mod', 'module example.com/x\n');
    write('mod/do.go', 'package mod\nfunc Do() {}\n');
    write('mod/more.go', 'package mod\ntype S struct{}\nfunc (s *S) Run() { Do() }\n');
    write('mod/do_test.go', 'package mod\nfunc TestDo() {}\n');
    write('main.go', 'package main\nimport (\n  "fmt"\n  "example.com/x/mod"\n)\nfunc main() { fmt.Println(); mod.Do() }\n');
    // Vue
    write('lib/helper.ts', 'export function helper(): number { return 1; }\n');
    write(
        'components/Card.vue',
        '<template>\n  <div>{{ x }}</div>\n</template>\n<script setup lang="ts">\nimport { helper } from \'../lib/helper\';\nconst x = helper();\n</script>\n<style>\n.card { color: red; }\n</style>\n',
    );
    // C#
    write('cs/Models/User.cs', 'namespace App.Models;\n\npublic class User\n{\n    public void Touch() { }\n}\n');
    write(
        'cs/Services/UserService.cs',
        'using System;\nusing App.Models;\n\nnamespace App.Services\n{\n    public interface IUserService { User Find(int id); }\n    public class BaseService { protected void Log() { } }\n    public class UserService : BaseService, IUserService\n    {\n        public UserService() { }\n        public User Find(int id) { base.Log(); Audit(); var u = new User(); u.Touch(); return u; }\n        private void Audit() { }\n    }\n    public record Point(int X);\n    public struct Pair { }\n    public enum Kind { A }\n}\n',
    );
    write('cs/Shared/A.cs', 'namespace App.Shared { public class Clock { } }\n');
    write('cs/Shared/B.cs', 'namespace App.Shared { public class Timer { } }\n');
    write('cs/Use.cs', 'using App.Shared;\nnamespace App { public class Use { public void Run() { var c = new Clock(); } } }\n');
    ({ graph } = await buildFromRepo(root, null));
});

afterAll(() => {
    fs.rmSync(root, { recursive: true, force: true });
});

describe('python (6.1)', () => {
    it('resolves `from pkg.mod import helper as h` to the declaring file, by module path', () => {
        expect(edge('app/main.py', 'imports', 'pkg/mod.py#helper')?.resolved_via).toBe('import-specifier');
    });
    it('declares classes and methods and links a subclass to its base', () => {
        expect(graph.nodes.find((n) => n.id === 'app/main.py#A::run')?.kind).toBe('method');
        expect(edge('app/main.py#A', 'inherits', 'pkg/mod.py#Base')).toBeDefined();
    });
    it('resolves `self.go()` through the hierarchy and the aliased call to the import', () => {
        expect(edge('app/main.py#A::run', 'calls', 'pkg/mod.py#Base::go')).toBeDefined();
        expect(edge('app/main.py#A::run', 'calls', 'pkg/mod.py#helper')).toBeDefined();
    });
    it('names a standard-library import as external, never as an in-repo file', () => {
        expect(graph.edges.some((e) => e.source === 'app/main.py' && e.target === 'external:os')).toBe(true);
    });
});

describe('java (6.1)', () => {
    it('resolves an import to the class file by package path', () => {
        expect(edge('src/main/java/a/b/A.java', 'imports', 'src/main/java/a/c/Helper.java#Helper')).toBeDefined();
    });
    it('resolves an unqualified call to the enclosing class', () => {
        expect(edge('src/main/java/a/b/A.java#A::run', 'calls', 'src/main/java/a/b/A.java#A::other')).toBeDefined();
    });
});

describe('go (6.1)', () => {
    it('links an import to every non-test file of the package it names', () => {
        expect(edge('main.go', 'imports', 'mod/do.go')).toBeDefined();
        expect(edge('main.go', 'imports', 'mod/more.go')).toBeDefined();
        expect(graph.edges.some((e) => e.source === 'main.go' && e.target === 'mod/do_test.go')).toBe(false);
    });
    it('declares a method on its receiver type', () => {
        expect(graph.nodes.find((n) => n.id === 'mod/more.go#S::Run')?.kind).toBe('method');
        expect(edge('mod/more.go', 'member', 'mod/more.go#S::Run')?.resolved_via).toBe('same-file');
    });
});

describe('csharp (5.2)', () => {
    it('declares classes, interfaces, records, structs, enums and methods incl. constructors', () => {
        const kind = (id: string) => graph.nodes.find((n) => n.id === id)?.kind;
        expect(kind('cs/Services/UserService.cs#UserService')).toBe('class');
        expect(kind('cs/Services/UserService.cs#IUserService')).toBe('interface');
        expect(kind('cs/Services/UserService.cs#Point')).toBe('class');
        expect(kind('cs/Services/UserService.cs#Pair')).toBe('class');
        expect(kind('cs/Services/UserService.cs#Kind')).toBe('enum');
        expect(kind('cs/Services/UserService.cs#UserService::UserService')).toBe('method');
        expect(kind('cs/Services/UserService.cs#UserService::Find')).toBe('method');
    });
    it('reads a file-scoped namespace without a parse error', async () => {
        expect(graph.nodes.find((n) => n.id === 'cs/Models/User.cs#User::Touch')?.kind).toBe('method');
        expect((await extractFile('a.cs', 'namespace A.B;\n\nclass C { }\n', 'csharp')).parseError).toBe(false);
    });
    it('binds `using` to the one file declaring the namespace, and a framework namespace as external', () => {
        expect(edge('cs/Services/UserService.cs', 'imports', 'cs/Models/User.cs')?.resolved_via).toBe('import-specifier');
        expect(graph.edges.some((e) => e.source === 'cs/Services/UserService.cs' && e.target === 'external:System')).toBe(true);
    });
    it('binds no file for a namespace two files declare', () => {
        expect(graph.edges.some((e) => e.source === 'cs/Use.cs' && e.relation === 'imports' && e.target.startsWith('cs/Shared/'))).toBe(false);
        expect(resolveLangModule('csharp', 'x.cs', 'N', [], new Map([['N', ['a.cs']]]))).toEqual(['a.cs']);
    });
    it('links the base list as inherits', () => {
        expect(edge('cs/Services/UserService.cs#UserService', 'inherits', 'cs/Services/UserService.cs#BaseService')).toBeDefined();
        expect(edge('cs/Services/UserService.cs#UserService', 'inherits', 'cs/Services/UserService.cs#IUserService')).toBeDefined();
    });
    it('resolves unqualified, base. and new X() calls', () => {
        expect(edge('cs/Services/UserService.cs#UserService::Find', 'calls', 'cs/Services/UserService.cs#UserService::Audit')).toBeDefined();
        expect(edge('cs/Services/UserService.cs#UserService::Find', 'calls', 'cs/Services/UserService.cs#BaseService::Log')).toBeDefined();
        expect(edge('cs/Services/UserService.cs#UserService::Find', 'calls', 'cs/Models/User.cs#User')).toBeDefined();
    });
});

describe('vue (6.1)', () => {
    it('parses the script block and resolves its imports', () => {
        expect(edge('components/Card.vue', 'imports', 'lib/helper.ts#helper')).toBeDefined();
    });
    it('keeps every location on its line in the .vue file', () => {
        const blanked = vueScript('<template>\n<a/>\n</template>\n<script>\nlet a = 1;\n</script>\n');
        expect(blanked.split('\n')).toHaveLength(7);
        expect(blanked.split('\n')[4]).toBe('let a = 1;');
        expect(blanked).not.toContain('<a/>');
    });
});

describe('module lookup refuses rather than guesses', () => {
    it('returns nothing for a Java suffix that two files match', () => {
        const files = ['x/a/b/C.java', 'y/a/b/C.java'];
        expect(resolveLangModule('java', 'z.java', 'a.b.C', files)).toEqual([]);
    });
    it('keeps the whole graph schema-valid', () => {
        expect(validateGraph(JSON.parse(JSON.stringify(graph))).ok).toBe(true);
    });
});
