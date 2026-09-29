#!/usr/bin/env tsx
/**
 * Where an artifact declares `inputs:`, its `argument-hint` is DERIVED from
 * that declaration — and a hand-written hint on the same artifact is a
 * conflict, not a merge.
 *
 * road-to-an-invocation-contract-that-reaches-the-wire 3.1.
 *
 * WHY A CONFLICT RATHER THAN A MERGE
 *
 * The tree already answers "what does this take?" in prose, through
 * `argument-hint`, which nothing validates. Adding a structured declaration
 * beside it creates a SECOND authority for the same question, and two surfaces
 * that can answer one question drift — which is the failure this whole roadmap
 * exists to make unrepresentable (Risk 1). Making the derived direction
 * one-way, and a disagreement a build failure, is what keeps the second
 * authority from forming. Merging the two would BE the second authority.
 *
 * An artifact with no declaration is untouched: its hand-written hint stays
 * exactly as it is, because there is nothing to derive from and no conflict to
 * have. That is why the 43 hintless commands are a generation gap that closes
 * as declarations land, rather than 43 prose edits nobody reviewed.
 *
 * THE FORM, AND WHY IT ROUND-TRIPS
 *
 * `<name>` required · `[name]` optional · `:a|b` appended for an enum. The
 * corpus already writes `[path]` and `[--force]` in exactly this shape, so the
 * generated hint is not a new dialect. {@link parseHint} recovers the name,
 * requiredness and enum from the rendered string, and the round-trip is
 * asserted rather than assumed — a generator whose output its own parser cannot
 * read would make the conflict check unfalsifiable.
 *
 * Exit codes: 0 in sync · 1 a conflict or a missing derived hint · 2 unreadable.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_argument_hint';

export interface InputDecl {
    readonly name: string;
    readonly type: string;
    readonly required?: boolean;
    readonly enum?: readonly string[];
}

/** Render the canonical hint for a declaration. */
export function hintFor(inputs: readonly InputDecl[]): string {
    return inputs
        .map((i) => {
            const body = i.enum && i.enum.length > 0 ? `${i.name}:${i.enum.join('|')}` : i.name;
            return i.required === true ? `<${body}>` : `[${body}]`;
        })
        .join(' ');
}

export interface ParsedHint {
    readonly name: string;
    readonly required: boolean;
    readonly enum?: readonly string[];
}

/** Recover declarations from a rendered hint. The inverse of {@link hintFor}. */
export function parseHint(hint: string): ParsedHint[] {
    const out: ParsedHint[] = [];
    for (const m of hint.matchAll(/([<[])([a-z][a-z0-9_]*)(?::([^\]>]+))?([\]>])/g)) {
        const open = m[1]!;
        const close = m[4]!;
        if ((open === '<') !== (close === '>')) continue;
        const parsed: ParsedHint = {
            name: m[2]!,
            required: open === '<',
            ...(m[3] === undefined ? {} : { enum: m[3].split('|') }),
        };
        out.push(parsed);
    }
    return out;
}

/** Frontmatter of one artifact, or `null` when it has none or it is malformed. */
function frontmatter(text: string): Record<string, unknown> | null {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) return null;
    try {
        const fm = yaml.load(m[1]!);
        return fm !== null && typeof fm === 'object' ? (fm as Record<string, unknown>) : null;
    } catch {
        return null;
    }
}

export function declaredInputs(fm: Record<string, unknown> | null): InputDecl[] | null {
    if (fm === null) return null;
    const raw = fm['inputs'];
    if (!Array.isArray(raw)) return null;
    const out: InputDecl[] = [];
    for (const item of raw) {
        if (item === null || typeof item !== 'object') continue;
        const r = item as Record<string, unknown>;
        if (typeof r['name'] !== 'string' || typeof r['type'] !== 'string') continue;
        out.push({
            name: r['name'],
            type: r['type'],
            ...(typeof r['required'] === 'boolean' ? { required: r['required'] } : {}),
            ...(Array.isArray(r['enum'])
                ? { enum: r['enum'].filter((x): x is string => typeof x === 'string') }
                : {}),
        });
    }
    return out;
}

export type FindingKind = 'conflict' | 'missing';

export interface Finding {
    readonly file: string;
    readonly kind: FindingKind;
    readonly derived: string;
    /** The hand-written hint, for a conflict. */
    readonly written?: string;
}

/** Compare one artifact's declaration against its hint. */
export function checkArtifact(text: string, file: string): Finding | null {
    const fm = frontmatter(text);
    const inputs = declaredInputs(fm);
    if (inputs === null || inputs.length === 0) return null;
    const derived = hintFor(inputs);
    const written = fm?.['argument-hint'];
    if (typeof written !== 'string') return { file, kind: 'missing', derived };
    if (written.trim() !== derived) return { file, kind: 'conflict', derived, written };
    return null;
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

/**
 * COMMANDS ONLY, and the reason is structural rather than a scoping preference:
 * `argument-hint` is a key of `command.schema.json` and of no other schema. A
 * skill cannot carry one, so reporting a skill that declares `inputs:` as
 * "missing its hint" would demand a field the schema forbids. Skills still get
 * their declaration onto the wire — that is `to_mcp_prompt_meta`'s job (3.2),
 * which reads the declaration directly and needs no hint at all.
 */
export function scan(root: string): { findings: Finding[]; scanned: number; declaring: number } {
    const files = walk(path.join(root, 'src', 'domains'), (n) => n === 'command.md').sort();

    const findings: Finding[] = [];
    let declaring = 0;
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        const inputs = declaredInputs(frontmatter(text));
        if (inputs !== null && inputs.length > 0) declaring += 1;
        const finding = checkArtifact(text, path.relative(root, f));
        if (finding !== null) findings.push(finding);
    }
    return { findings, scanned: files.length, declaring };
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--self-test')) return selfTest();
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (argv[rootIdx + 1] ?? ROOT);

    const { findings, scanned, declaring } = scan(root);
    const ledger = new GateLedger(GATE);
    ledger.plan(findings.map((f) => f.file));
    for (const f of findings) ledger.fail(f.file, f.kind);

    reportScanned({
        gate: GATE,
        scanned,
        units: 'artifact(s)',
        roots: ['src/domains'],
    });
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            if (f.kind === 'conflict') {
                process.stdout.write(
                    `❌  ${GATE}: ${f.file} has a hand-written \`argument-hint\` that contradicts ` +
                        `its declaration.\n      written: ${f.written ?? ''}\n      derived: ${f.derived}\n`,
                );
            } else {
                process.stdout.write(
                    `❌  ${GATE}: ${f.file} declares \`inputs:\` but carries no \`argument-hint\`.\n` +
                        `      derived: ${f.derived}\n`,
                );
            }
        }
        process.stdout.write(
            '\nWhere a declaration exists the hint is derived from it, one way. Fix the ' +
                'declaration, or delete the hand-written hint — never reconcile the two by ' +
                'hand, which is the second authority this check exists to prevent.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: every derived \`argument-hint\` matches its declaration ` +
            `(${String(declaring)} of ${String(scanned)} artifact(s) declare \`inputs:\`).\n`,
    );
    return 0;
}

/**
 * A self-test is what proves a gate DISCRIMINATES. An enforced scan floor only
 * proves it read something; the verdict has to move.
 */
function selfTest(): number {
    const plant = (name: string, fm: string): string => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), `arg-hint-${name}-`));
        const cmd = path.join(dir, 'src', 'domains', 'probe-pack', 'probe');
        fs.mkdirSync(cmd, { recursive: true });
        fs.writeFileSync(path.join(cmd, 'command.md'), `---\nname: probe\n${fm}---\n\nbody\n`, 'utf-8');
        return dir;
    };

    const run = (root: string): number =>
        runGateCli(ROOT, path.join('src', 'scripts', 'check_argument_hint.ts'), ['--root', root], ROOT);

    return runSelfTest({
        gate: GATE,
        minCases: 4,
        minRejectCases: 2,
        cases: [
            {
                name: 'a hint matching its declaration passes',
                expect: 'accept',
                run: () =>
                    run(plant('match', 'argument-hint: "<a>"\ninputs:\n  - name: a\n    type: string\n    required: true\n')),
            },
            {
                name: 'a hand-written hint contradicting the declaration fails',
                expect: 'reject',
                run: () =>
                    run(plant('conflict', 'argument-hint: "[other]"\ninputs:\n  - name: a\n    type: string\n    required: true\n')),
            },
            {
                name: 'a declaration with no hint at all fails',
                expect: 'reject',
                run: () => run(plant('missing', 'inputs:\n  - name: a\n    type: string\n')),
            },
            {
                name: 'an artifact with no declaration keeps its free-text hint',
                expect: 'accept',
                run: () => run(plant('nodecl', 'argument-hint: "[free text]"\n')),
            },
        ],
    });
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
