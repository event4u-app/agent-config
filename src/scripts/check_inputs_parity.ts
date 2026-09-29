#!/usr/bin/env tsx
/**
 * What the MCP server reads from an `inputs:` block equals what a real YAML
 * parser reads from it.
 *
 * road-to-an-invocation-contract-that-reaches-the-wire — added after review.
 *
 * WHY THIS GATE EXISTS
 *
 * The server's `_parse_inputs` is a hand-rolled reader of a YAML subset,
 * because the MCP server is stdlib-only and bundled and must not grow a YAML
 * dependency to read one optional block. A hand-rolled reader of a format it
 * does not fully implement has exactly one dangerous failure mode: reading
 * something DIFFERENT from what the author wrote, silently. A host is then told
 * about an argument that does not exist, or not told about one that does — and
 * the schema validates either way, because the schema checks the YAML, not the
 * reader.
 *
 * An independent review found that failure live: the reader's key scan ran at
 * any depth, so a `default:` mapping whose first child was `name:` overwrote
 * the parameter's own name. It also silently misread `required: True`, the
 * flow form, a comment at column zero, and a block scalar. Every one of those
 * is schema-valid.
 *
 * So the reader now DECLINES what it cannot model, and this gate makes every
 * decline and every divergence a build failure with a named remedy. The
 * contract is: write the block form, or the build tells you. That is strictly
 * better than a reader that is clever and occasionally wrong, and it is why the
 * reader is allowed to stay stdlib-only.
 *
 * Exit codes: 0 parity holds · 1 a divergence · 2 the corpus could not be read.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { assertScanned, reportScanned } from './_lib/scan_scope.js';
import { _frontmatter_text, _parse_inputs, type PromptInput } from './mcp_server/prompts.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_inputs_parity';

/** The same reduction `_parse_inputs` produces, taken from a real YAML parse. */
export function yamlInputs(fmText: string): PromptInput[] | null {
    let doc: unknown;
    try {
        doc = yaml.load(fmText);
    } catch {
        return null;
    }
    if (doc === null || typeof doc !== 'object') return null;
    const raw = (doc as Record<string, unknown>)['inputs'];
    if (raw === undefined) return null;
    if (!Array.isArray(raw)) return [];
    const out: PromptInput[] = [];
    for (const item of raw) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r['name'] !== 'string') continue;
        out.push({
            name: r['name'],
            description: typeof r['description'] === 'string' ? r['description'] : '',
            required: r['required'] === true,
        });
    }
    return out;
}

export interface Divergence {
    readonly file: string;
    readonly server: PromptInput[];
    readonly yaml: PromptInput[];
}

const same = (a: readonly PromptInput[], b: readonly PromptInput[]): boolean =>
    a.length === b.length &&
    a.every(
        (x, i) =>
            x.name === b[i]!.name &&
            x.required === b[i]!.required &&
            x.description === b[i]!.description,
    );

/** Compare both readers over one document. `null` when it declares no block. */
export function compare(text: string, file: string): Divergence | null {
    const fm = _frontmatter_text(text);
    if (fm === '') return null;
    const expected = yamlInputs(fm);
    if (expected === null) return null;
    const actual = _parse_inputs(fm);
    return same(actual, expected) ? null : { file, server: actual, yaml: expected };
}

function walk(dir: string, match: (n: string) => boolean, out: string[] = []): string[] {
    if (!fs.existsSync(dir)) return out;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) walk(p, match, out);
        else if (match(e.name)) out.push(p);
    }
    return out;
}

export function scan(root: string): { findings: Divergence[]; scanned: number } {
    const files = [
        ...walk(path.join(root, 'src', 'domains'), (n) => n === 'command.md'),
        ...walk(path.join(root, 'src', 'skills'), (n) => n === 'SKILL.md'),
        ...walk(path.join(root, 'dist', 'agent-src', 'commands'), (n) => n.endsWith('.md')),
    ].sort();

    const findings: Divergence[] = [];
    for (const f of files) {
        const d = compare(fs.readFileSync(f, 'utf8'), path.relative(root, f));
        if (d !== null) findings.push(d);
    }
    return { findings, scanned: files.length };
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (argv[rootIdx + 1] ?? ROOT);

    const { findings, scanned } = scan(root);
    const ledger = new GateLedger(GATE);
    ledger.plan(findings.map((f) => f.file));
    for (const f of findings) {
        ledger.fail(f.file, `server read ${String(f.server.length)}, YAML read ${String(f.yaml.length)}`);
    }

    // A gate that read nothing has not passed. This fires BEFORE the verdict,
    // because certifying against an empty corpus is the false green the coverage
    // manifest exists to refuse — named by the provider-diverse ratification
    // review as one condition that would have flipped its verdict.
    assertScanned({ gate: GATE, scanned: scanned, units: 'artifact(s)', roots: ['src/domains', 'src/skills', 'dist/agent-src/commands'] });

    reportScanned({
        gate: GATE,
        scanned,
        units: 'artifact(s)',
        roots: ['src/domains', 'src/skills', 'dist/agent-src/commands'],
    });
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(
                `❌  ${GATE}: ${f.file} — the MCP reader and YAML disagree about \`inputs:\`.\n` +
                    `      server: ${JSON.stringify(f.server)}\n` +
                    `      yaml:   ${JSON.stringify(f.yaml)}\n`,
            );
        }
        process.stdout.write(
            '\nThe server reads one shape, deliberately — a block sequence of `- name:` items ' +
                'with scalar values on their own lines. Rewrite the declaration in that shape. ' +
                'The flow form, a block scalar and a nested mapping under an item key are ' +
                'refused rather than guessed at, and this gate is how the refusal is visible ' +
                'instead of becoming a wrong argument on the wire.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: the MCP reader and YAML agree on every declared \`inputs:\` block.\n`,
    );
    return 0;
}

/**
 * One rejecting case per way the reader and YAML can part company, plus the
 * agreeing case — because a suite that only proves passes proves nothing.
 */
function selfTest(): number {
    const plant = (name: string, fm: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `inputs-parity-${name}-`));
        const skills = path.join(dir, 'src', 'skills', 'probe');
        fs.mkdirSync(skills, { recursive: true });
        fs.writeFileSync(path.join(skills, 'SKILL.md'), `---\nname: probe\n${fm}---\n\nbody\n`, 'utf-8');
        return dir;
    };
    const run = (root: string): number =>
        runGateCli(ROOT, path.join('src', 'scripts', 'check_inputs_parity.ts'), ['--root', root], ROOT);

    return runSelfTest({
        gate: GATE,
        minCases: 6,
        minRejectCases: 5,
        cases: [
            {
                name: 'an empty corpus is refused, not certified green',
                expect: 'reject',
                run: () => run(fs.mkdtempSync(path.join(os.tmpdir(), 'inputs-parity-empty-'))),
            },
            {
                name: 'the supported block form agrees',
                expect: 'accept',
                run: () => run(plant('ok', 'inputs:\n  - name: a\n    type: string\n    required: true\n')),
            },
            {
                name: 'the flow form is a divergence',
                expect: 'reject',
                run: () => run(plant('flow', 'inputs: [{name: a, type: string}]\n')),
            },
            {
                name: 'a nested mapping under an item key is a divergence',
                expect: 'reject',
                run: () =>
                    run(plant('nested', 'inputs:\n  - name: opts\n    type: string\n    default:\n      name: fallback\n')),
            },
            {
                name: 'a block scalar is a divergence',
                expect: 'reject',
                run: () =>
                    run(plant('scalar', 'inputs:\n  - name: a\n    type: string\n    description: >\n      long\n')),
            },
            {
                name: 'a dash on its own line is a divergence',
                expect: 'reject',
                run: () => run(plant('bareDash', 'inputs:\n  -\n    name: a\n    type: string\n')),
            },
        ],
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
