/**
 * A three-project estate for the estate-index and estate-query tests: two npm
 * projects that use vitest (`core` publishes `@estate/core`, `app` depends on
 * it by path) and a composer project (`billing`) that uses neither, but calls
 * a name only `core` declares and a name `core` and `app` both declare.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export interface Estate {
    core: string;
    app: string;
    billing: string;
}

function write(root: string, rel: string, text: string): void {
    const p = path.join(root, rel);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text);
}

function commit(root: string): void {
    execFileSync('git', ['-C', root, 'init', '-q']);
    execFileSync('git', ['-C', root, 'add', '-A']);
    execFileSync('git', ['-C', root, '-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-q', '-m', 'fixture']);
}

/**
 * `modules` source files of chained functions and a class with several
 * methods. The per-module weight is set so a top-level symbol carries about
 * as much graph as in this repository — 85.5 MB of JSON for 38,838 top-level
 * symbols, ≈ 2.2 KB each (measured 2026-10-24 on its own graph) — so the 4.4
 * size ratio is read against a realistic graph, not a skeleton.
 */
function bulk(root: string, prefix: string, modules: number): void {
    for (let i = 0; i < modules; i++) {
        const prev = i === 0 ? '' : `import { ${prefix}Step${i - 1}c } from './m${i - 1}.js';\n`;
        const call = i === 0 ? 'x' : `${prefix}Step${i - 1}c(x)`;
        const methods = ['open', 'close', 'read', 'write', 'reset', 'check']
            .map((m, j) => `    ${m}(): number {\n        return ${prefix}Step${i}${'abc'[j % 3]}(this.size) + this.${j === 0 ? 'close' : 'open'}();\n    }\n`)
            .join('');
        write(
            root,
            `src/gen/m${i}.ts`,
            `${prev}export function ${prefix}Step${i}a(x: number): number {\n    return ${call} + 1;\n}\n` +
                `export function ${prefix}Step${i}b(x: number): number {\n    return ${prefix}Step${i}a(x) * 2;\n}\n` +
                `export function ${prefix}Step${i}c(x: number): number {\n    return ${prefix}Step${i}b(x) - 3;\n}\n` +
                `export class ${prefix}Box${i} {\n    size = ${i};\n${methods}}\n`,
        );
    }
}

export function makeEstate(base: string, modules = 40): Estate {
    const core = path.join(base, 'core');
    write(core, 'package.json', JSON.stringify({ name: '@estate/core', devDependencies: { vitest: '^3.0.0' } }, null, 2));
    write(core, 'src/index.ts', 'export function uniqueThing(): number {\n    return 1;\n}\nexport function sharedName(): number {\n    return 2;\n}\n');
    write(core, 'tests/index.test.ts', "import { describe } from 'vitest';\nimport { uniqueThing } from '../src/index.js';\ndescribe('x', () => uniqueThing());\n");
    bulk(core, 'core', modules);
    commit(core);

    const app = path.join(base, 'app');
    write(
        app,
        'package.json',
        JSON.stringify({ name: 'estate-app', dependencies: { '@estate/core': 'file:../core' }, devDependencies: { vitest: '^3.0.0' } }, null, 2),
    );
    write(app, 'src/main.ts', "import { uniqueThing } from '@estate/core';\nexport function sharedName(): number {\n    return uniqueThing();\n}\n");
    bulk(app, 'app', modules);
    commit(app);

    const billing = path.join(base, 'billing');
    write(billing, 'composer.json', JSON.stringify({ name: 'Estate/Billing', require: { php: '^8.2', 'ext-json': '*', 'monolog/monolog': '^3.0' } }, null, 2));
    write(billing, 'src/run.ts', 'export function bill(): number {\n    return uniqueThing() + sharedName();\n}\n');
    write(billing, 'src/Invoice.php', '<?php\nnamespace Billing;\nclass Invoice {\n    public function total(): int { return 1; }\n}\n');
    bulk(billing, 'bill', modules);
    commit(billing);
    return { core, app, billing };
}
