#!/usr/bin/env tsx
/**
 * check_permission_deny_syntax — the provenance gate over the host permission
 * deny-rule pins in `src/install/hostPermissionsAdapter.ts`.
 *
 * `road-to-a-project-contract-written-down` step 2.1. The step named
 * `src/scripts/hooks/host_lowering.yaml` as the home for this pin, which would
 * have put it behind the plumbing ratification record. The AI council of
 * 2026-10-13 (anthropic + openai, 2/2, both converging on the same path)
 * refused that home — a permission rule has no hook slot and no dispatcher
 * verdict — and required a provenance gate in its place. This is that gate.
 *
 * ```
 * A PIN WITH NO URL, NO READ DATE, OR A PASSED REVIEW DATE IS NOT A PIN.
 * EVERY RULE THE RENDERER PRODUCES MATCHES THE GRAMMAR THE QUOTED EXAMPLES SHOW.
 * ```
 *
 * WHAT THIS DOES NOT CLAIM, stated rather than implied. The examples are
 * verbatim quotes recorded with their URL and read date; the renderer is
 * checked against the grammar they exhibit. That is CONFORMANCE TO A RECORDED
 * READING, not conformance to the live host — the same honesty limit the
 * council named when it observed that a test reading the renderer's own
 * constant proves internal consistency and nothing more. Only a probe against
 * an installed host would close it, and this gate does not pretend to.
 *
 * It also deliberately does NOT fetch `docs_url`. A build that depends on a
 * mutable vendor page is nondeterministic and fails on an unrelated edit to
 * that page; the review date is the drift signal instead.
 *
 * Usage: ./scripts-run src/scripts/check_permission_deny_syntax [--today YYYY-MM-DD]
 * Exit codes: 0 — every pin is current and every rule conforms · 1 — a finding.
 */

import process from 'node:process';

import { asOf } from './_lib/as_of.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    HOST_PERMISSION_SYNTAX,
    denyRulesFor,
    type HostPermissionSyntax,
} from '../install/hostPermissionsAdapter.js';
import { classifyNoGo } from '../install/noGoRules.js';

/**
 * Bullets this gate renders, one per rule shape the adapter can produce.
 *
 * Committed here rather than generated, so a renderer change that silently
 * stops producing one of the shapes is a finding instead of a smaller fixture.
 */
const FIXTURES: readonly string[] = [
    'Never edit `migrations/` by hand',
    'Never overwrite `.env`',
    'Never read `secrets/`',
    'Never run `php artisan migrate:fresh` outside a throwaway database',
];

/** `Tool(specifier)` — the shape every example on the page exhibits. */
const RULE_RE = /^(Edit|Read|Bash)\(.+\)$/;

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** The ISO day after `iso`. */
function dayAfter(iso: string): string {
    const d = new Date(`${iso}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Every finding against one row. Exported so the rejecting cases can be driven
 * over crafted rows: this gate's corpus is a typed constant, not a file tree,
 * so there is no `--root` fixture seam for a `_lib/gate_self_test.ts`
 * `--self-test` to point at. `tests/scripts/permission_deny_syntax.test.ts`
 * carries the discrimination proof instead, and runs on every commit.
 */
export function checkRow(row: HostPermissionSyntax, today: string): string[] {
    const bad: string[] = [];
    const where = `host \`${row.host}\``;
    if (!row.docs_url.startsWith('https://')) {
        bad.push(`${where}: docs_url is not an https URL`);
    }
    if (!ISO_RE.test(row.docs_at)) bad.push(`${where}: docs_at is not an ISO date`);
    if (!ISO_RE.test(row.expires)) bad.push(`${where}: expires is not an ISO date`);
    // One day of slack, because `docs_at` is written by a human in their own
    // zone while `today` below is UTC. Without it a page read at 01:00 CEST
    // reds the gate on the day it was read, which would teach the next author
    // to back-date the field rather than to record when they read it.
    if (ISO_RE.test(row.docs_at) && row.docs_at > dayAfter(today)) {
        bad.push(`${where}: docs_at ${row.docs_at} is more than a day in the future`);
    }
    if (ISO_RE.test(row.expires) && row.expires < today) {
        bad.push(
            `${where}: the pin's review date ${row.expires} has passed — re-read ` +
                `${row.docs_url}, update docs_at/expires, and re-check the examples`,
        );
    }
    if (ISO_RE.test(row.docs_at) && ISO_RE.test(row.expires) && row.expires <= row.docs_at) {
        bad.push(`${where}: expires ${row.expires} is not after docs_at ${row.docs_at}`);
    }
    if (row.deny_key.length === 0) bad.push(`${where}: deny_key is empty`);
    if (row.examples.length === 0) bad.push(`${where}: no example is recorded`);
    for (const ex of row.examples) {
        if (!RULE_RE.test(ex)) bad.push(`${where}: example \`${ex}\` is not Tool(specifier)`);
    }

    // Every rule the renderer produces must use a tool the examples show, in
    // the shape they show. A renderer that started emitting `Write(...)` — a
    // rule the host accepts and never consults — is caught here.
    const tools = new Set(row.examples.map((e) => e.slice(0, e.indexOf('('))));
    const rendered: string[] = [];
    for (const bullet of FIXTURES) {
        for (const rule of denyRulesFor(row.host, classifyNoGo(bullet))) {
            rendered.push(rule);
            if (!RULE_RE.test(rule)) {
                bad.push(`${where}: rendered \`${rule}\` is not Tool(specifier)`);
                continue;
            }
            const tool = rule.slice(0, rule.indexOf('('));
            if (!tools.has(tool)) {
                bad.push(
                    `${where}: rendered \`${rule}\` uses tool \`${tool}\`, which no recorded ` +
                        'example shows',
                );
            }
        }
    }
    if (rendered.length === 0) {
        bad.push(`${where}: the fixtures rendered no rule at all`);
        return bad;
    }

    // Each shape, asserted on its own. The earlier version checked only that
    // SOME rule was produced and that each produced rule's tool was recorded,
    // which a renderer that silently stopped emitting `Read(...)` passes — the
    // comment above FIXTURES claimed this was covered and it was not.
    for (const [label, matches] of SHAPES) {
        if (!rendered.some(matches)) {
            bad.push(
                `${where}: the fixtures rendered no ${label} rule — a renderer that stops ` +
                    'producing a shape must be a finding, not a smaller result',
            );
        }
    }
    return bad;
}

/** One entry per rule shape the adapter is expected to be able to render. */
const SHAPES: readonly (readonly [string, (r: string) => boolean])[] = [
    ['Edit(path)', (r) => r.startsWith('Edit(')],
    ['Read(path)', (r) => r.startsWith('Read(')],
    ['Bash(exact command)', (r) => r.startsWith('Bash(') && !r.endsWith(' *)')],
    ['Bash(command with arguments)', (r) => r.startsWith('Bash(') && r.endsWith(' *)')],
];

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    // `asOf()`, not the wall clock: this gate's only time-dependent verdict is
    // whether a pin's review date has passed, and a staleness verdict that
    // differs between Monday and Friday over an unchanged tree is not
    // reproducible from the commit. `--today` stays as this gate's own pin,
    // which is what the rejecting cases in its test drive.
    let today = asOf().toISOString().slice(0, 10);
    for (let i = 0; i < argv.length; i += 1) {
        if (argv[i] === '--today') {
            const next = argv[i + 1];
            if (next === undefined || !ISO_RE.test(next)) {
                process.stderr.write('check_permission_deny_syntax: --today needs YYYY-MM-DD\n');
                return 1;
            }
            today = next;
            i += 1;
        }
    }

    const rows = Object.values(HOST_PERMISSION_SYNTAX);
    // Through the shared resolver, not a hand-written line: a gate that reports
    // a count it never asserted can print `scanned: 0` and exit green, which is
    // exactly the certify-an-empty-corpus failure this seam exists to stop.
    // No `allowEmpty` — a pin table with no rows is a dead scope here, never an
    // expected state, and the gate should say so rather than pass.
    try {
        reportScanned({
            gate: 'check_permission_deny_syntax',
            scanned: rows.length,
            units: 'host permission pin(s)',
            roots: ['src/install/hostPermissionsAdapter.ts'],
        });
    } catch (err) {
        process.stderr.write(`❌  ${err instanceof Error ? err.message : String(err)}\n`);
        return 1;
    }
    const bad = rows.flatMap((row) => checkRow(row, today));
    process.stdout.write(
        `check_permission_deny_syntax ledger: scanned=${String(rows.length)} ` +
            `planned=${String(rows.length)} skipped=0\n`,
    );
    if (bad.length > 0) {
        for (const b of bad) process.stderr.write(`❌  ${b}\n`);
        return 1;
    }
    process.stdout.write(
        `✅  check_permission_deny_syntax: ${String(rows.length)} host pin(s) current, ` +
            `every rendered rule in the recorded grammar.\n`,
    );
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === `file://${process.argv[1]}`) {
    process.exit(main());
}
