#!/usr/bin/env tsx
/**
 * The per-host standing-cost table, generated into the contract the README
 * points at — `road-to-delivery-for-every-host` step 7.2.
 *
 * WHY THIS STEP WAS BLOCKED, AND WHAT UNBLOCKED IT
 * -----------------------------------------------
 * 7.2 asked for a table "generated FROM THE CENSUS", and was recorded blocked on
 * 2026-09-07 because the census it meant — `check_preamble_payload_budget` —
 * read the projection SOURCE, where every host carries the same number and a
 * per-host projection mode moves none of them. A per-host table generated from
 * that reading would print one figure three times and call it per-host.
 *
 * The AI council of 2026-09-09 (2/2 present, converged on option 1A) settled the
 * measurement-surface question the step could not: the budget gate gains an
 * ADDITIVE `--host` reading and its gated surface stays the source. That gives
 * this generator a real per-host census to read, which is
 * `report_standing_payload_by_host` — the artefact that already splits the
 * headline figure by host, deterministically and against a pin.
 *
 * WHICH CENSUS, AND WHY NOT THE LOCAL TREES
 * -----------------------------------------
 * The census unit is the projection SOURCE minus the ADR-004 `type: manual`
 * rules no per-tool tree receives: the UPPER BOUND a host loads, an unscoped and
 * un-deduplicated consumer install. Reading the host trees off this disk instead
 * would measure this machine — user-scope dedup and workspace/pack scope both
 * shrink a maintainer checkout below what a consumer receives, and both differ
 * per install. A published contract table has to be reproducible by a reader, so
 * it is generated from the reproducible reading. `check_preamble_payload_budget
 * --host <id>` is the tool for the OTHER question (what does THIS install load),
 * and it prints a PARTIAL TREE warning precisely so the two are not confused.
 *
 * TWO READINGS, CROSS-CHECKED
 * ---------------------------
 * The step's `verify:` is "table numbers equal the census". Parsing the census
 * artefact alone would satisfy that trivially — the table would equal whatever
 * the artefact says, including a stale artefact. So this ALSO re-derives every
 * number live from the tree and refuses when the two disagree, naming both. A
 * published cost table that contradicts the tree is worse than no table.
 *
 * FAILS WHEN THE CENSUS IS MISSING — the step asks for this explicitly. An
 * absent artefact is exit 2, never an empty table: a contract section rendered
 * with no rows reads as "this package has no standing cost", which is the most
 * misleading thing this file could produce.
 *
 * Exit codes: 0 written / in sync · 1 drift under `--check`, or census
 * disagrees with the tree · 2 census missing, unparseable, or empty.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    ARTIFACT_REL,
    HOST_SURFACES,
    readRuleCorpus,
    singleFileChars,
    tokensChars4,
} from './report_standing_payload_by_host.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The contract the README points at for projection modes (README.md:288). */
export const CONTRACT_REL = path.join('docs', 'contracts', 'rule-router.md');

export const BEGIN = '<!-- BEGIN generated: host-standing-cost -->';
export const END = '<!-- END generated: host-standing-cost -->';

export interface HostRow {
    host: string;
    surface: string;
    shape: string;
    bytes: string;
    tokens: string;
}

/**
 * Parse the `## Per host` table out of the census artefact.
 *
 * Deliberately strict. A row shape this does not recognise is a census whose
 * format moved, and silently dropping it would shrink the published table
 * without anything saying so.
 */
export function parseCensus(text: string): HostRow[] {
    const start = text.indexOf('## Per host');
    if (start === -1) return [];
    const lines = text.slice(start).split('\n');
    const rows: HostRow[] = [];
    for (const line of lines) {
        if (!line.startsWith('|')) {
            if (rows.length > 0) break;
            continue;
        }
        const cells = line.split('|').map((c) => c.trim());
        // ['', host, surface, shape, bytes, tok, writer, '']
        if (cells.length < 7) continue;
        const host = (cells[1] ?? '').replace(/`/g, '');
        if (host === '' || host === 'Host' || /^-+$/.test(host)) continue;
        rows.push({
            host,
            surface: (cells[2] ?? '').replace(/`/g, ''),
            shape: cells[3] ?? '',
            bytes: cells[4] ?? '',
            tokens: cells[5] ?? '',
        });
    }
    return rows;
}

/** Re-derive the same numbers from the tree, so the census can be contradicted. */
export function deriveLive(root: string): Map<string, { bytes: string; tokens: string }> {
    const corpus = readRuleCorpus(root);
    const out = new Map<string, { bytes: string; tokens: string }>();
    for (const h of HOST_SURFACES) {
        if (h.surface === null) {
            out.set(h.host, { bytes: '—', tokens: '—' });
            continue;
        }
        if (h.perRuleTree) {
            out.set(h.host, {
                bytes: String(corpus.projectedChars),
                tokens: String(tokensChars4(corpus.projectedChars)),
            });
            continue;
        }
        const chars = singleFileChars(root, h.surface);
        out.set(
            h.host,
            chars === null
                ? { bytes: 'absent', tokens: 'absent' }
                : { bytes: String(chars), tokens: String(tokensChars4(chars)) },
        );
    }
    return out;
}

/** Every host whose census row disagrees with the live tree, rendered. */
export function disagreements(rows: readonly HostRow[], live: ReadonlyMap<string, { bytes: string; tokens: string }>): string[] {
    const out: string[] = [];
    for (const r of rows) {
        const l = live.get(r.host);
        if (l === undefined) {
            out.push(`${r.host}: in the census, absent from HOST_SURFACES in the tree`);
            continue;
        }
        if (l.bytes !== r.bytes || l.tokens !== r.tokens) {
            out.push(
                `${r.host}: census says ${r.bytes} B / ${r.tokens} tok, the tree says ` +
                    `${l.bytes} B / ${l.tokens} tok`,
            );
        }
    }
    return out;
}

export function renderTable(rows: readonly HostRow[], pin: string): string {
    const L: string[] = [BEGIN];
    L.push('');
    L.push('### Standing rule cost, per host');
    L.push('');
    L.push(
        'Generated by `./scripts-run src/scripts/generate_host_cost_table` from ' +
            `\`${ARTIFACT_REL}\`, pinned to \`${pin}\`. Do not hand-edit between the markers.`,
    );
    L.push('');
    L.push(
        'The unit is the projection **source** minus the ADR-004 `type: manual` rules no ' +
            'per-tool tree receives — the upper bound a host loads on an unscoped, ' +
            'un-deduplicated install. Every scope narrowing (user-scope dedup, workspace and ' +
            'pack scope) moves a host DOWN from these figures, never up. **This measures ' +
            'delivery, not consumption:** whether a host reads what it is handed is the axis ' +
            '`docs/enforcement-by-host.md` owns.',
    );
    L.push('');
    L.push('| Host | Surface | Shape | Bytes | chars/4 tok |');
    L.push('|---|---|---|---:|---:|');
    for (const r of rows) {
        const surface = r.surface === '—' ? '—' : `\`${r.surface}\``;
        L.push(`| \`${r.host}\` | ${surface} | ${r.shape} | ${r.bytes} | ${r.tokens} |`);
    }
    L.push('');
    L.push(
        'To measure what **one concrete install** loads rather than the upper bound, run ' +
            '`./scripts-run src/scripts/check_preamble_payload_budget --host <id>`. That ' +
            'reading is informational and never gated, and it prints a `PARTIAL TREE` warning ' +
            'when the host tree holds fewer rule files than the source — which a maintainer ' +
            'checkout always does.',
    );
    L.push('');
    L.push(END);
    return L.join('\n');
}

/** The pin the census artefact declares, or `null` when it declares none. */
export function censusPin(text: string): string | null {
    const m = /Pinned to commit `([0-9a-f]{7,40})`/.exec(text);
    return m === null ? null : (m[1] as string);
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    const root = REPO_ROOT;
    const check = argv.includes('--check');
    const censusAbs = path.join(root, ARTIFACT_REL);

    if (!fs.existsSync(censusAbs)) {
        process.stderr.write(
            `❌  host cost table: the census is missing at ${ARTIFACT_REL}.\n` +
                '    Regenerate it first:\n' +
                '      ./scripts-run src/scripts/report_standing_payload_by_host --emit --pin <sha>\n' +
                '    This generator refuses rather than rendering an empty table: a contract\n' +
                '    section with no rows reads as "this package has no standing cost".\n',
        );
        return 2;
    }
    const censusText = fs.readFileSync(censusAbs, 'utf-8');
    const rows = parseCensus(censusText);
    if (rows.length === 0) {
        process.stderr.write(
            `❌  host cost table: found no parseable rows under "## Per host" in ${ARTIFACT_REL}.\n` +
                '    The census format moved, or the section is empty. Either way this refuses:\n' +
                '    a silently shorter table is a cost claim nobody wrote.\n',
        );
        return 2;
    }
    const pin = censusPin(censusText);
    if (pin === null) {
        process.stderr.write(
            `❌  host cost table: ${ARTIFACT_REL} declares no pin. An unpinned census cannot be\n` +
                '    reproduced by a reader, so a table generated from it is not evidence.\n',
        );
        return 2;
    }

    const bad = disagreements(rows, deriveLive(root));
    if (bad.length > 0) {
        process.stderr.write(
            '❌  host cost table: the census disagrees with the tree — refusing to publish either.\n' +
                bad.map((b) => `      · ${b}\n`).join('') +
                '    A stale census is the one failure a "table equals the census" check cannot\n' +
                '    catch on its own, which is why both readings are taken. Re-emit the census\n' +
                '    at the current pin, then re-run this.\n',
        );
        return 1;
    }

    const contractAbs = path.join(root, CONTRACT_REL);
    if (!fs.existsSync(contractAbs)) {
        process.stderr.write(`❌  host cost table: ${CONTRACT_REL} does not exist.\n`);
        return 2;
    }
    const contract = fs.readFileSync(contractAbs, 'utf-8');
    const table = renderTable(rows, pin);

    const b = contract.indexOf(BEGIN);
    const e = contract.indexOf(END);
    let next: string;
    if (b === -1 || e === -1) {
        next = contract.replace(/\n*$/, '\n') + '\n' + table + '\n';
    } else {
        next = contract.slice(0, b) + table + contract.slice(e + END.length);
    }

    if (next === contract) {
        process.stdout.write(`✅  host cost table: ${CONTRACT_REL} in sync (${rows.length} hosts, pin ${pin}).\n`);
        return 0;
    }
    if (check) {
        process.stderr.write(
            `❌  host cost table: ${CONTRACT_REL} is out of date against ${ARTIFACT_REL}.\n` +
                '    Run ./scripts-run src/scripts/generate_host_cost_table\n',
        );
        return 1;
    }
    fs.writeFileSync(contractAbs, next, 'utf-8');
    process.stdout.write(
        `✅  host cost table: wrote ${rows.length} host row(s) into ${CONTRACT_REL} (pin ${pin}).\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url.endsWith(path.basename(process.argv[1]))) {
    process.exit(main());
}
