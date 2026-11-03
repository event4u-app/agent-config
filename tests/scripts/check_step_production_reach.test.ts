// road-to-a-tick-the-shipped-path-earns 3.1–3.2.
import { describe, expect, it } from 'vitest';

import { checkStep, exemptionCitesItsCall, namedPaths, newTicks, stepBlock } from '../../src/scripts/check_step_production_reach.js';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    hasMainGuard,
    importedNames,
    productionEntries,
    productionReach,
    usedExports,
    type ReachTree,
} from '../../src/scripts/_lib/production_reach.js';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function treeOf(files: Record<string, string>): ReachTree {
    return { list: () => Object.keys(files), read: (rel) => files[rel] ?? null };
}

const BASE = {
    'src/config/production-entries.json': JSON.stringify({ entries: ['src/main.ts'], entry_sources: ['docs/*.md'] }),
    'src/main.ts': "import { run } from './lib.js';\nrun();\n",
    'src/lib.ts': 'export function helper() {}\nexport function run() { helper(); }\nexport function orphan() {}\n',
    'src/scripts/tool.ts': "import { orphan } from '../lib.js';\norphan();\n",
    'tests/lib.test.ts': "import { helper, orphan, _seam } from '../src/lib.js';\n",
    'tests/run.test.ts': "import { run } from '../src/lib.js';\n",
};

describe('production reach', () => {
    it('reads named, aliased, namespace and default imports', () => {
        expect(importedNames('{ a, b as c, type D }')).toEqual(['a', 'b', 'D']);
        expect(importedNames('* as ns')).toEqual(['*']);
        expect(importedNames('def, { a }')).toEqual(['a', '*']);
    });

    it('counts an export the module uses itself, not one only declared', () => {
        expect(usedExports(BASE['src/lib.ts'])).toEqual(['helper']);
    });

    it('counts an export the module spreads, but not a same-named member access', () => {
        expect(usedExports('export function list() { return []; }\nconst all = [...list()];\n')).toEqual(['list']);
        expect(usedExports('export function list() { return []; }\nconst all = other.list();\n')).toEqual([]);
    });

    it('reaches a helper through its module, but not an export nobody imports', () => {
        const reach = productionReach(treeOf(BASE));
        expect(reach.symbols.has('src/lib.ts#helper')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#run')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#orphan')).toBe(false);
    });

    it('takes scripts an entry source names as entries', () => {
        const files = { ...BASE, 'docs/use.md': 'Run `./scripts-run src/scripts/tool` to see it.\n' };
        const reach = productionReach(treeOf(files));
        expect(reach.entries.has('src/scripts/tool.ts')).toBe(true);
        expect(reach.symbols.has('src/lib.ts#orphan')).toBe(true);
    });
});

describe('an entry is something that is invoked (ledger-that-can-say-no 2.1)', () => {
    const guarded = "export function main() { return 0; }\nif (process.argv[1] !== undefined) process.exit(main());\n";
    const lib = 'export function helper() { return 1; }\n';

    it('does not take a prose mention of a library module as an entry', () => {
        const files = { ...BASE, 'src/scripts/_lib/x.ts': lib, 'docs/use.md': '`helper` (`src/scripts/_lib/x.ts`) does it.\n' };
        expect(productionEntries(treeOf(files))).not.toContain('src/scripts/_lib/x.ts');
    });

    it('takes a prose mention of a module with a main guard as an entry', () => {
        const files = { ...BASE, 'src/scripts/cli.ts': guarded, 'docs/use.md': 'The CLI (`src/scripts/cli.ts`) checks it.\n' };
        expect(productionEntries(treeOf(files))).toContain('src/scripts/cli.ts');
    });

    it('takes a command-line mention as an entry even without a main guard', () => {
        for (const line of ['./scripts-run src/scripts/_lib/x', 'node src/scripts/_lib/x.ts', 'npx tsx src/scripts/_lib/x.ts']) {
            const files = { ...BASE, 'src/scripts/_lib/x.ts': lib, 'docs/use.md': `\`\`\`bash\n${line} --flag\n\`\`\`\n` };
            expect(productionEntries(treeOf(files)), line).toContain('src/scripts/_lib/x.ts');
        }
    });

    it('keeps reading a non-markdown source by mention', () => {
        const files = {
            ...BASE,
            'src/config/production-entries.json': JSON.stringify({ entries: [], entry_sources: ['Taskfile.yml'] }),
            'src/scripts/_lib/x.ts': lib,
            'Taskfile.yml': 'cmds:\n  - src/scripts/_lib/x\n',
        };
        expect(productionEntries(treeOf(files))).toContain('src/scripts/_lib/x.ts');
    });

    it('takes a script a context invokes as an entry', () => {
        const files = {
            ...BASE,
            'src/config/production-entries.json': JSON.stringify({ entries: [], entry_sources: ['src/agent-src/contexts/**/*.md'] }),
            'src/scripts/analysis_validate.ts': lib,
            'src/agent-src/contexts/execution/analysis-loop.md':
                '```bash\n./scripts-run src/scripts/analysis_validate --run <run-dir>\n```\n',
        };
        expect(productionEntries(treeOf(files))).toContain('src/scripts/analysis_validate.ts');
    });

    it('lists contexts as an entry source in the committed config', () => {
        const cfg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'src/config/production-entries.json'), 'utf-8')) as {
            entry_sources: string[];
        };
        expect(cfg.entry_sources).toContain('src/agent-src/contexts/**/*.md');
    });

    it('recognises the main-guard shapes the tree uses, and not a library', () => {
        expect(hasMainGuard(guarded)).toBe(true);
        expect(hasMainGuard('function main() {}\nif (isCliEntry()) process.exit(main());\n')).toBe(true);
        expect(hasMainGuard('function main() {}\nprocess.exit(main());\n')).toBe(true);
        expect(hasMainGuard('function main() {}\nmain();\n')).toBe(true);
        expect(hasMainGuard(lib)).toBe(false);
        expect(hasMainGuard('// process.argv[1] in a comment only\nexport const a = 1;\n')).toBe(false);
    });

    it('reads comments string-aware, so a glob literal does not hide a real guard', () => {
        const src =
            "const GLOB = 'docs/*.md';\nexport function main() { return 0; }\n" +
            'if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(main());\n';
        expect(hasMainGuard(src)).toBe(true);
        expect(hasMainGuard("const s = 'process.argv[1] === x';\nexport const a = 1;\n")).toBe(false);
        expect(hasMainGuard('const re = /a\\/*b/;\nexport function main() { return 0; }\nif (isCliEntry(import.meta.url, "x")) main();\n')).toBe(true);
    });

    it('counts only call sites of the known guard helpers, not a look-alike or a definition', () => {
        expect(hasMainGuard('export function check(t: string) { return isDirective(t); }\n')).toBe(false);
        expect(hasMainGuard('export function walk(p: string) { return fs.statSync(p).isDirectory(); }\n')).toBe(false);
        expect(hasMainGuard('export function isCliEntry(url: string, name: string): boolean { return false; }\n')).toBe(false);
        expect(hasMainGuard("export function usage() { return `usage: ${path.basename(process.argv[1] ?? '')}`; }\n")).toBe(false);
        expect(hasMainGuard("if (isCliEntry(import.meta.url, 'x')) process.exit(main(process.argv.slice(2)));\n")).toBe(true);
        expect(hasMainGuard('runGateCli(import.meta.url, check);\n')).toBe(true);
        expect(hasMainGuard('if (import.meta.url === pathToFileURL(path.resolve(process.argv[1] ?? "")).href) run();\n')).toBe(true);
    });
});

describe('check_step_production_reach', () => {
    const tree = treeOf({
        ...BASE,
        'src/domains/a/command.md': '# a\n',
        'src/scripts/analysis_validate.ts': 'export const v = 1;\n',
    });
    const reach = productionReach(tree);

    it('reds a tick whose test takes an unreached symbol from its subject', () => {
        const f = checkStep(tree, reach, 'r.md', '1.1', '- [x] **1.1 x** `src/lib.ts`\n  verify: `tests/lib.test.ts`');
        expect(f?.reason).toContain('src/lib.ts#orphan');
        expect(f?.reason).not.toContain('_seam');
    });

    it('passes a tick whose tested symbols are reached', () => {
        expect(checkStep(tree, reach, 'r.md', '1.2', '- [x] **1.2 x** `src/lib.ts`\n  verify: `tests/run.test.ts`')).toBeNull();
    });

    it('honours a declared production entry', () => {
        const block = '- [x] **1.3 x** `src/lib.ts`, production entry: `src/scripts/tool.ts`\n  verify: `tests/lib.test.ts`';
        expect(checkStep(tree, reach, 'r.md', '1.3', block)).toBeNull();
    });

    it('refuses a ticked step that says built, not wired', () => {
        expect(checkStep(tree, reach, 'r.md', '1.4', '- [x] **1.4 x** built, not wired')).not.toBeNull();
    });

    it('reds a prose-citing exemption that names no invoking file:line (2.2)', () => {
        const block =
            '- [x] **1.5 x** `src/lib.ts`\n  reach exempt: driven by the analysis doors through command prose, no TypeScript caller\n  verify: `tests/lib.test.ts`';
        expect(checkStep(tree, reach, 'r.md', '1.5', block)?.reason).toContain('file:line');
    });

    it('passes a prose-citing exemption that names the invoking file:line (2.2)', () => {
        const block =
            '- [x] **1.5 x** `src/lib.ts`\n  reach exempt: driven by the door, invoked at `src/domains/a/command.md:90`\n  verify: `tests/lib.test.ts`';
        expect(checkStep(tree, reach, 'r.md', '1.5', block)).toBeNull();
    });

    it('reads the corpus as the roadmap expects, without making it an oracle (2.2)', () => {
        const adr288 =
            'the analysis ledger is driven by the analysis doors through command prose (ADR-288), with no TypeScript caller — appendLoop, nextLoop and ledgerSummary were already unreached before this step.';
        const verdict =
            'isMediaAnchor is consumed by src/scripts/analysis_validate.ts, which the analysis commands run by path from markdown; the production-entry config does not read command bodies, so that edge is invisible here.';
        expect(exemptionCitesItsCall(adr288, tree)).toBe(false);
        expect(exemptionCitesItsCall(verdict, tree)).toBe(true);
        expect(exemptionCitesItsCall('a maintainer bench, never shipped', tree)).toBe(true);
    });

    it('takes only a citation of a real command, door or script file other than the step\'s own subject (2.2)', () => {
        const door = 'driven by the analysis doors through command prose';
        // Any `x.y:N` token used to pass: a version, a JSON line, a file the tree does not have.
        expect(exemptionCitesItsCall(`${door}, see v1.2:3`, tree)).toBe(false);
        expect(exemptionCitesItsCall(`${door}, see package.json:4`, tree)).toBe(false);
        expect(exemptionCitesItsCall(`${door}, invoked at src/domains/nope/command.md:9`, tree)).toBe(false);
        // Any `src/**.ts` path used to pass, the step's own subject included.
        expect(exemptionCitesItsCall(`${door}, as src/lib.ts says`, tree, ['src/lib.ts'])).toBe(false);
        expect(exemptionCitesItsCall(`${door}, as src/lib.ts:3 says`, tree, ['src/lib.ts'])).toBe(false);
        // A real door line, or a real TypeScript caller that is not the subject, still passes.
        expect(exemptionCitesItsCall(`${door}, invoked at src/domains/a/command.md:90`, tree)).toBe(true);
        expect(exemptionCitesItsCall(`${door}, called by src/scripts/tool.ts`, tree, ['src/lib.ts'])).toBe(true);
    });

    it('reds an exemption whose only citation is the step\'s own subject', () => {
        const block =
            '- [x] **1.5 x** `src/lib.ts`\n  reach exempt: driven by the door; see src/lib.ts:1 for the code\n  verify: `tests/lib.test.ts`';
        expect(checkStep(tree, reach, 'r.md', '1.5', block)?.reason).toContain('file:line');
    });

    it('maps a named test to its own subject module', () => {
        const files = { ...BASE, 'src/scripts/_lib/x.ts': 'export const a = 1;\n', 'tests/scripts/_lib_x.test.ts': '' };
        expect(namedPaths(treeOf(files), 'verify: `tests/scripts/_lib_x.test.ts`').subjects).toEqual(['src/scripts/_lib/x.ts']);
    });

    it('reads only new ticks and the step block', () => {
        expect(newTicks('+++ b/r.md\n-- [ ] **2.1 a**\n+- [x] **2.1 a**\n+- [x] **2.2 b**\n-- [x] **2.2 b**\n')).toEqual([
            { file: 'r.md', step: '2.1' },
        ]);
        expect(stepBlock('- [x] **2.1 a**\n  more\n- [ ] **2.2 b**\n', '2.1')).toBe('- [x] **2.1 a**\n  more');
    });
});
