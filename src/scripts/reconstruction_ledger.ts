#!/usr/bin/env tsx
/**
 * Check an obligation ledger file (docs/contracts/reconstruction-obligations.md).
 *
 * The reference door runs this before it reports an `adapt` or `rebuild`
 * transfer as done. The file is JSON: `{ "evidence_ids": [...], "obligations": [...] }`
 * — the evidence ids the run recorded, and one row per behavior. A file that
 * records no evidence ids fails closed: no row's evidence can resolve.
 * The check catches an evidence id the run's recorded list does not contain;
 * since that list lives in the same file, it does not prove the evidence exists
 * outside it.
 *
 * Usage: ./scripts-run src/scripts/reconstruction_ledger --check <file>
 *        ./scripts-run src/scripts/reconstruction_ledger --providers
 *
 * --check: exit 0 closed · 1 open or unknown · 2 invalid, or a usage / read error.
 * --providers: exit 0 configured or not (none is `coverage: unknown`) · 2 malformed slot.
 * The slot is read from the user-global settings only (`readProviderSlot`).
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parse as parseYaml } from 'yaml';

import { user_global_settings_paths } from './_lib/agent_settings.js';
import {
    evaluateLedger,
    parseObservationProviders,
    shapeErrors,
    type Obligation,
    type ObservationProvider,
} from './_lib/reconstruction_ledger.js';

function fail(message: string): number {
    process.stderr.write(`reconstruction_ledger: ${message}\n`);
    return 2;
}

/**
 * The slot, read from the USER-GLOBAL settings files only. A repository's own
 * `.agent-settings.yml` is never consulted: which MCP server gets called is the
 * user's decision, and a cloned repository must not be able to make it.
 */
export function readProviderSlot(paths: readonly string[] = user_global_settings_paths()): { providers: ObservationProvider[]; errors: string[] } {
    let raw: unknown;
    for (const p of paths) {
        if (!fs.existsSync(p)) continue;
        let doc: unknown;
        try {
            doc = parseYaml(fs.readFileSync(p, 'utf-8'));
        } catch (err) {
            return { providers: [], errors: [`${p}: not YAML (${err instanceof Error ? err.message : String(err)})`] };
        }
        const section = doc !== null && typeof doc === 'object' ? (doc as Record<string, unknown>)['reconstruction'] : undefined;
        if (section !== null && typeof section === 'object' && 'observation_providers' in section) {
            raw = (section as Record<string, unknown>)['observation_providers'];
        }
    }
    return parseObservationProviders(raw);
}

/**
 * `--providers`: which observation providers the run may call. Exit 0 whether
 * or not one is configured — absence is a result, stated as `coverage: unknown`
 * — and 2 only when the slot itself is malformed.
 */
function providers(): number {
    const { providers: list, errors } = readProviderSlot();
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`reconstruction_ledger: ${e}\n`);
        return 2;
    }
    if (list.length === 0) {
        process.stdout.write('runtime evidence unavailable · no observation provider configured · coverage: unknown\n');
        return 0;
    }
    for (const p of list) process.stdout.write(`provider ${p.server} · ${p.kinds.join(', ')}\n`);
    return 0;
}

export function main(argv: readonly string[]): number {
    if (argv.includes('--providers') && argv.includes('--check')) return fail('--providers and --check are separate modes');
    if (argv.includes('--providers')) return argv.length === 1 ? providers() : fail('usage: reconstruction_ledger --providers');
    const i = argv.indexOf('--check');
    const file = i >= 0 ? argv[i + 1] : undefined;
    if (file === undefined) return fail('usage: reconstruction_ledger --check <file>');
    if (!fs.existsSync(file)) return fail(`no such file: ${file}`);
    let data: unknown;
    try {
        data = JSON.parse(fs.readFileSync(file, 'utf-8'));
    } catch (err) {
        return fail(`${file}: not JSON (${err instanceof Error ? err.message : String(err)})`);
    }
    const doc = data as { evidence_ids?: unknown; obligations?: unknown } | null;
    if (doc === null || typeof doc !== 'object' || !Array.isArray(doc.obligations)) {
        return fail(`${file}: expected an object with an \`obligations\` array`);
    }
    if (!Array.isArray(doc.evidence_ids) || !doc.evidence_ids.every((e) => typeof e === 'string')) {
        return fail(`${file}: no \`evidence_ids\` list — without the run's records no evidence id can resolve`);
    }
    const malformed = doc.obligations.flatMap((r, i) => shapeErrors(r, i));
    if (malformed.length > 0) {
        process.stdout.write('ledger invalid · malformed rows\n');
        for (const e of malformed) process.stdout.write(`  - ${e}\n`);
        return 2;
    }
    const slot = readProviderSlot();
    if (slot.errors.length > 0) return fail(slot.errors.join('; '));
    const verdict = evaluateLedger(doc.obligations as Obligation[], {
        evidenceIds: new Set(doc.evidence_ids as string[]),
        providers: new Set(slot.providers.map((p) => p.server)),
    });
    const parity = verdict.parity === null ? 'n/a' : `${verdict.verified}/${verdict.counted}`;
    process.stdout.write(`ledger ${verdict.state} · parity ${parity}\n`);
    for (const e of verdict.errors) process.stdout.write(`  - ${e}\n`);
    if (verdict.state === 'closed') return 0;
    if (verdict.state === 'invalid') return 2;
    return 1;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exit(main(process.argv.slice(2)));
}
