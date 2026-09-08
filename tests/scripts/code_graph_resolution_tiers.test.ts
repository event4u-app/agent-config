/**
 * Resolution tiers before the name lookup (road-to-a-graph-that-is-shipped 2.3).
 *
 * The extractor's ladder ended in a repo-wide same-name table — a guess,
 * labelled `INFERRED` / `name-lookup`. Two config files state the answer
 * outright. These fixtures build real graphs over real trees carrying a real
 * `tsconfig.json` and a real `composer.json`, because the whole claim is that
 * the tier reads the project's own declaration.
 *
 * Each tier has a SENSITIVITY twin: the same source with the config removed
 * must resolve differently. Without that, a passing test cannot distinguish
 * "the tier worked" from "the name lookup happened to find the same thing".
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { buildFromRepo } from '../../src/scripts/code_graph/build.js';
import {
    aliasRulesFrom,
    parseJsonc,
    psr4RulesFrom,
    resolveAlias,
    resolvePsr4,
} from '../../src/scripts/code_graph/resolution_tiers.js';
import type { CodeEdge } from '../../src/scripts/code_graph/types.js';

const dirs: string[] = [];
afterEach(() => {
    for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function rig(files: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cg-tiers-'));
    dirs.push(dir);
    for (const [rel, body] of Object.entries(files)) {
        const full = path.join(dir, rel);
        fs.mkdirSync(path.dirname(full), { recursive: true });
        fs.writeFileSync(full, body);
    }
    return dir;
}

async function edgesOf(dir: string): Promise<CodeEdge[]> {
    const { graph } = await buildFromRepo(dir, path.join(dir, 'g.json'));
    return graph.edges;
}

const TS_ALIAS_SOURCE = {
    'src/shared/mailer.ts': 'export function send(to: string): string { return to; }\n',
    'src/app/main.ts': "import { send } from '@shared/mailer.js';\nexport function go(): string { return send('a'); }\n",
};
const TSCONFIG = JSON.stringify({
    compilerOptions: { baseUrl: './src', paths: { '@shared/*': ['shared/*'] } },
});

describe('tsconfig paths tier', () => {
    it('binds an aliased specifier to the real file and marks it path-alias', async () => {
        const dir = rig({ ...TS_ALIAS_SOURCE, 'tsconfig.json': TSCONFIG });
        const edges = await edgesOf(dir);

        const imported = edges.find((e) => e.relation === 'imports' && e.source === 'src/app/main.ts');
        expect(imported, 'the import edge is missing entirely').toBeDefined();
        expect(imported?.target).toBe('src/shared/mailer.ts#send');
        expect(imported?.resolved_via).toBe('path-alias');
        // A DECLARED mapping is as much a syntactic fact as a relative
        // specifier, so it is EXTRACTED rather than INFERRED.
        expect(imported?.confidence).toBe('EXTRACTED');

        // The call through the binding inherits the mechanism.
        const call = edges.find((e) => e.relation === 'calls' && e.source === 'src/app/main.ts#go');
        expect(call?.target).toBe('src/shared/mailer.ts#send');
        expect(call?.resolved_via).toBe('path-alias');
    }, 60_000);

    it('is SENSITIVE — without the tsconfig the same import goes external', async () => {
        const dir = rig(TS_ALIAS_SOURCE); // no tsconfig.json
        const edges = await edgesOf(dir);

        const imported = edges.find((e) => e.relation === 'imports' && e.source === 'src/app/main.ts');
        // Non-relative and unaliased: a real module, correctly named, and the
        // wrong one. This is exactly what the tier removes.
        expect(imported?.target).toContain('external:@shared/mailer.js');
        expect(imported?.resolved_via).toBe('import-specifier');
    }, 60_000);

    it('tolerates a tsconfig with comments and trailing commas', async () => {
        const dir = rig({
            ...TS_ALIAS_SOURCE,
            'tsconfig.json':
                '{\n  // the project speaks JSONC\n  "compilerOptions": {\n' +
                '    "baseUrl": "./src", /* inline */\n    "paths": { "@shared/*": ["shared/*"], },\n  },\n}\n',
        });
        const edges = await edgesOf(dir);
        const imported = edges.find((e) => e.relation === 'imports' && e.source === 'src/app/main.ts');
        expect(imported?.resolved_via).toBe('path-alias');
    }, 60_000);
});

const PHP_PSR4_SOURCE = {
    'app/Services/Mailer.php': "<?php\nnamespace App\\Services;\nclass Mailer { public function send(): void {} }\n",
    // A SECOND class with the same base name in a different namespace. This is
    // the case the base-name lookup cannot tell apart and PSR-4 can.
    'lib/Legacy/Mailer.php': "<?php\nnamespace Legacy;\nclass Mailer { public function send(): void {} }\n",
    'app/Http/Controller.php':
        "<?php\nnamespace App\\Http;\nuse App\\Services\\Mailer;\nclass Controller { public function run(): void { $m = new Mailer(); $m->send(); } }\n",
};
const COMPOSER = JSON.stringify({ autoload: { 'psr-4': { 'App\\': 'app/', 'Legacy\\': 'lib/Legacy/' } } });

describe('composer PSR-4 tier', () => {
    it('binds a namespaced use to the right file when two share a base name', async () => {
        const dir = rig({ ...PHP_PSR4_SOURCE, 'composer.json': COMPOSER });
        const edges = await edgesOf(dir);

        const imported = edges.find((e) => e.relation === 'imports' && e.source === 'app/Http/Controller.php');
        expect(imported, 'the use edge is missing entirely').toBeDefined();
        expect(imported?.resolved_via).toBe('psr4');
        expect(imported?.confidence).toBe('EXTRACTED');
        // The namespace decides, so it must be the App one and never Legacy.
        expect(imported?.target).toContain('app/Services/Mailer.php');
        expect(imported?.target).not.toContain('lib/Legacy');
    }, 60_000);

    it('is SENSITIVE — without composer.json the binding falls back to a name lookup', async () => {
        const dir = rig(PHP_PSR4_SOURCE); // no composer.json
        const edges = await edgesOf(dir);
        const imported = edges.find((e) => e.relation === 'imports' && e.source === 'app/Http/Controller.php');
        expect(imported?.resolved_via).toBe('name-lookup');
    }, 60_000);
});

describe('the tier primitives', () => {
    it('parses JSONC without eating a // inside a string', () => {
        const parsed = parseJsonc('{ "a": "http://x/y", // trailing\n "b": 1, }') as Record<string, unknown>;
        expect(parsed['a']).toBe('http://x/y');
        expect(parsed['b']).toBe(1);
    });

    it('returns null on genuinely broken JSON rather than throwing', () => {
        expect(parseJsonc('{ "a": ')).toBeNull();
    });

    it('orders alias rules longest-prefix-first, which is TypeScript’s own rule', () => {
        const rules = aliasRulesFrom({
            compilerOptions: { baseUrl: './src', paths: { '@a/*': ['a/*'], '@a/deep/*': ['deep/*'] } },
        });
        expect(rules[0]?.prefix).toBe('@a/deep/');
        expect(rules[0]?.targets).toEqual(['src/deep']);
    });

    it('orders psr-4 rules longest-namespace-first and reads autoload-dev too', () => {
        const rules = psr4RulesFrom({
            autoload: { 'psr-4': { 'App\\': 'app/' } },
            'autoload-dev': { 'psr-4': { 'App\\Tests\\': 'tests/' } },
        });
        expect(rules[0]?.prefix).toBe('App\\Tests\\');
    });

    it('declines an alias whose target is not in the graph', () => {
        const rules = aliasRulesFrom({ compilerOptions: { baseUrl: './src', paths: { '@x/*': ['x/*'] } } });
        // Nothing under src/x exists in this file set, so claiming a hit would
        // be worse than the `external:` binding it would replace.
        expect(resolveAlias('@x/gone.js', { aliases: rules, psr4: [] }, new Set(['src/other.ts']))).toBeNull();
    });

    it('declines a psr-4 name whose file is not in the graph', () => {
        const rules = psr4RulesFrom({ autoload: { 'psr-4': { 'App\\': 'app/' } } });
        expect(resolvePsr4('App\\Gone', { aliases: [], psr4: rules }, new Set(['app/Here.php']))).toBeNull();
        expect(resolvePsr4('App\\Here', { aliases: [], psr4: rules }, new Set(['app/Here.php']))).toBe('app/Here.php');
        // A leading backslash is legal PHP and means the same thing.
        expect(resolvePsr4('\\App\\Here', { aliases: [], psr4: rules }, new Set(['app/Here.php']))).toBe('app/Here.php');
    });
});
