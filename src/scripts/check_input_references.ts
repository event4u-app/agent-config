#!/usr/bin/env tsx
/**
 * Every in-body `${x}` on an artifact that declares `inputs:` is backed by a
 * declaration.
 *
 * road-to-an-invocation-contract-that-reaches-the-wire 2.2.
 *
 * SCOPED TO DECLARING ARTIFACTS, ON PURPOSE
 *
 * An artifact with no `inputs:` block is not checked at all. That is what lets
 * this arrive with zero findings over a corpus where nothing declares anything
 * yet, and grow only with adoption — a check that fired on every artifact would
 * have to be introduced together with a migration nobody asked for, which is
 * exactly what the optional block was designed to avoid.
 *
 * THE COUNTING UNIT IS THE CENSUS'S, IMPORTED
 *
 * A reference counts when it appears in PROSE — outside fenced code blocks,
 * indented blocks and inline code spans. `proseOnly` is imported from
 * `report_invocation_surface.ts` rather than restated, because two copies of
 * that definition would drift and the whole point of this phase is that the
 * declaration and what depends on it cannot disagree.
 *
 * The consequence is stated rather than hidden: a `${target}` inside a fenced
 * usage example is NOT checked. That is the conservative direction. A skill
 * teaching Terraform has `${local.x}` in a fence and would otherwise be
 * reported against a declaration it never claimed to satisfy — a false positive
 * on working content, which is the failure that makes a young gate get
 * disabled. When adoption makes in-fence usage examples common, widening the
 * unit is a deliberate change with its own diff.
 *
 * Exit codes: 0 every reference backed · 1 an unbacked reference · 2 the corpus
 * could not be read.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import * as yaml from 'js-yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { reportScanned } from './_lib/scan_scope.js';
import { proseOnly } from './report_invocation_surface.js';

const _HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const GATE = 'check_input_references';

/** The reference form this checks. Only the plurality syntax is a reference. */
const REFERENCE_RE = /\$\{([a-z][a-z0-9_]*)\}/g;

export interface Unbacked {
    readonly file: string;
    readonly name: string;
    readonly declared: readonly string[];
}

/** Declared input names, or `null` when the artifact declares no block at all. */
export function declaredInputs(text: string): string[] | null {
    const m = /^---\n([\s\S]*?)\n---/.exec(text);
    if (m === null) return null;
    let fm: unknown;
    try {
        fm = yaml.load(m[1]!);
    } catch {
        return null;
    }
    if (fm === null || typeof fm !== 'object') return null;
    const inputs = (fm as Record<string, unknown>)['inputs'];
    if (!Array.isArray(inputs)) return null;
    const names: string[] = [];
    for (const item of inputs) {
        if (item === null || typeof item !== 'object') continue;
        const name = (item as Record<string, unknown>)['name'];
        if (typeof name === 'string') names.push(name);
    }
    return names;
}

/**
 * Prose `${x}` references with no matching declaration.
 *
 * Returns `[]` for an artifact that declares no block — not because it has no
 * references, but because it is out of scope.
 */
export function unbackedReferences(text: string, file = '<data>'): Unbacked[] {
    const declared = declaredInputs(text);
    if (declared === null) return [];
    const seen = new Set<string>();
    const out: Unbacked[] = [];
    for (const m of proseOnly(text).matchAll(REFERENCE_RE)) {
        const name = m[1]!;
        if (declared.includes(name) || seen.has(name)) continue;
        seen.add(name);
        out.push({ file, name, declared });
    }
    return out;
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

export function scan(root: string): { findings: Unbacked[]; scanned: number; declaring: number } {
    const files = [
        ...walk(path.join(root, 'dist', 'agent-src', 'commands'), (n) => n.endsWith('.md')),
        ...walk(path.join(root, 'src', 'skills'), (n) => n === 'SKILL.md'),
    ].sort();

    const findings: Unbacked[] = [];
    let declaring = 0;
    for (const f of files) {
        const text = fs.readFileSync(f, 'utf8');
        if (declaredInputs(text) !== null) declaring += 1;
        findings.push(...unbackedReferences(text, path.relative(root, f)));
    }
    return { findings, scanned: files.length, declaring };
}

export function main(argv: readonly string[]): number {
    const rootIdx = argv.indexOf('--root');
    const root = rootIdx === -1 ? ROOT : (argv[rootIdx + 1] ?? ROOT);

    const { findings, scanned, declaring } = scan(root);
    const ledger = new GateLedger(GATE);
    ledger.plan(findings.map((f) => `${f.file}:${f.name}`));
    for (const f of findings) {
        ledger.fail(`${f.file}:${f.name}`, `\`\${${f.name}}\` is not declared`);
    }

    reportScanned({
        gate: GATE,
        scanned,
        units: 'artifact(s)',
        roots: ['dist/agent-src/commands', 'src/skills'],
    });
    ledger.report();

    if (findings.length > 0) {
        for (const f of findings) {
            process.stdout.write(
                `❌  ${GATE}: ${f.file} references \`\${${f.name}}\` with no \`inputs.${f.name}\` ` +
                    `(declared: ${f.declared.length > 0 ? f.declared.join(', ') : 'none'}).\n`,
            );
        }
        process.stdout.write(
            '\nAdd the declaration, or drop the reference. Only artifacts that declare ' +
                '`inputs:` at all are checked, so this never asks an artifact to start ' +
                'declaring — it asks a declaration to be complete.\n',
        );
        return 1;
    }

    process.stdout.write(
        `✅  ${GATE}: every in-body reference is backed ` +
            `(${String(declaring)} of ${String(scanned)} artifact(s) declare \`inputs:\`).\n`,
    );
    return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
