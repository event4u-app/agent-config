#!/usr/bin/env tsx
/**
 * Resolve the typed exhibits on review findings against the commit each names.
 *
 * A finding can point at text — a quote at a line, a pattern that must be
 * absent, two quotes that must hold together, or a recorded command result.
 * This reader checks the first three at their `commit` with plain git and
 * returns one verdict per exhibit:
 *
 *   - `admissible`   — the exhibit holds at its commit;
 *   - `inadmissible` — the commit is reachable and the exhibit does not hold;
 *   - `unverifiable` — the commit or the blob cannot be read here.
 *
 * An `executed` exhibit is reported `unverifiable` and never re-run: the
 * command came out of a model reply, and running text from a reply is the
 * injection path `untrusted-input-defense` exists to close.
 *
 * It INFORMS, it never filters. Nothing here writes a disposition or drops a
 * finding: a zero-spend pilot found that a naive presence check holds for more
 * false positives than real defects (real defects often name a missing thing),
 * so filtering on it would discard real defects first. Admissibility may filter
 * only once a measured precision lift says it should.
 *
 * Usage:
 *   ./scripts-run src/scripts/check_finding_exhibits --findings <file.json> [--cwd <repo>] [--json]
 *
 * Exit codes: 0 report printed · 2 usage or unreadable input.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { type Exhibit, type PresenceExhibit, wellFormedExhibit } from './_lib/finding_exhibits.js';
import { reportScanned } from './_lib/scan_scope.js';

export type ExhibitVerdict = 'admissible' | 'inadmissible' | 'unverifiable';

export interface ExhibitResult {
    readonly finding: number;
    readonly exhibit: number;
    readonly type: Exhibit['type'] | 'malformed';
    readonly verdict: ExhibitVerdict;
    readonly reason: string;
}

/** Lines either side of the claimed line within which a presence quote may sit. */
export const PRESENCE_WINDOW = 3;

function git(cwd: string, args: readonly string[]): { ok: boolean; out: string; code: number | null } {
    const r = spawnSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    return { ok: r.status === 0, out: r.stdout ?? '', code: r.status };
}

function commitReachable(cwd: string, commit: string): boolean {
    return git(cwd, ['cat-file', '-e', `${commit}^{commit}`]).ok;
}

function resolvePresence(cwd: string, e: PresenceExhibit): { verdict: ExhibitVerdict; reason: string } {
    if (!commitReachable(cwd, e.commit)) return { verdict: 'unverifiable', reason: `commit ${e.commit} unreachable` };
    const blob = git(cwd, ['show', `${e.commit}:${e.path}`]);
    if (!blob.ok) return { verdict: 'inadmissible', reason: `${e.path} absent at ${e.commit}` };
    const lines = blob.out.split('\n');
    const from = Math.max(0, e.line - 1 - PRESENCE_WINDOW);
    const to = Math.min(lines.length, e.line + PRESENCE_WINDOW);
    const window = lines.slice(from, to).join('\n');
    return window.includes(e.quote)
        ? { verdict: 'admissible', reason: `quote found within ±${PRESENCE_WINDOW} of line ${e.line}` }
        : { verdict: 'inadmissible', reason: `quote not within ±${PRESENCE_WINDOW} of ${e.path}:${e.line}` };
}

/** Resolve one well-formed exhibit. */
export function resolveExhibit(cwd: string, e: Exhibit): { verdict: ExhibitVerdict; reason: string } {
    switch (e.type) {
        case 'presence':
            return resolvePresence(cwd, e);
        case 'pair': {
            const [a, b] = e.legs.map((leg) => resolvePresence(cwd, leg));
            if (a!.verdict === 'unverifiable' || b!.verdict === 'unverifiable')
                return { verdict: 'unverifiable', reason: 'a leg is unverifiable' };
            return a!.verdict === 'admissible' && b!.verdict === 'admissible'
                ? { verdict: 'admissible', reason: 'both legs hold' }
                : { verdict: 'inadmissible', reason: `legs: ${a!.verdict} / ${b!.verdict}` };
        }
        case 'absence': {
            if (!commitReachable(cwd, e.commit)) return { verdict: 'unverifiable', reason: `commit ${e.commit} unreachable` };
            // `git grep` exits 1 on zero matches, which is the expected case here.
            const r = git(cwd, ['grep', '-c', '-E', '-e', e.pattern, e.commit, '--', e.path_glob]);
            if (!r.ok && r.code !== 1) return { verdict: 'unverifiable', reason: 'git grep failed' };
            const count = r.out
                .split('\n')
                .filter(Boolean)
                .reduce((sum, l) => sum + Number(l.slice(l.lastIndexOf(':') + 1) || 0), 0);
            return count === e.expected
                ? { verdict: 'admissible', reason: `${count} match(es), expected ${e.expected}` }
                : { verdict: 'inadmissible', reason: `${count} match(es), expected ${e.expected}` };
        }
        case 'executed':
            return { verdict: 'unverifiable', reason: 'recorded command result; never re-run' };
    }
}

/** Resolve every exhibit on every finding. Findings without exhibits yield no rows. */
export function checkFindingExhibits(cwd: string, findings: readonly unknown[]): ExhibitResult[] {
    const out: ExhibitResult[] = [];
    findings.forEach((f, fi) => {
        const raw = (f as { exhibits?: unknown })?.exhibits;
        if (!Array.isArray(raw)) return;
        raw.forEach((x, xi) => {
            const e = wellFormedExhibit(x);
            if (!e) {
                out.push({ finding: fi, exhibit: xi, type: 'malformed', verdict: 'inadmissible', reason: 'malformed exhibit' });
                return;
            }
            out.push({ finding: fi, exhibit: xi, type: e.type, ...resolveExhibit(cwd, e) });
        });
    });
    return out;
}

function main(argv: readonly string[]): number {
    const at = (flag: string): string | undefined => {
        const i = argv.indexOf(flag);
        return i >= 0 ? argv[i + 1] : undefined;
    };
    const file = at('--findings');
    if (!file) {
        process.stderr.write('usage: check_finding_exhibits --findings <file.json> [--cwd <repo>] [--json]\n');
        return 2;
    }
    let doc: unknown;
    try {
        doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        process.stderr.write(`check_finding_exhibits: cannot read ${file}: ${(err as Error).message}\n`);
        return 2;
    }
    const findings = Array.isArray(doc) ? doc : ((doc as { findings?: unknown[] })?.findings ?? []);
    const results = checkFindingExhibits(at('--cwd') ?? process.cwd(), findings);
    const json = argv.includes('--json');
    // In --json mode the count goes to stderr so stdout stays one parseable document.
    reportScanned(
        {
            gate: 'check_finding_exhibits',
            scanned: findings.length,
            units: 'finding(s)',
            roots: [file],
            allowEmpty:
                'EMPTY_VALID: a review that found nothing writes an empty findings array, which is an honest null, not a moved root.',
        },
        json ? process.stderr.write.bind(process.stderr) : undefined,
    );
    if (json) {
        process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
        return 0;
    }
    for (const r of results) process.stdout.write(`finding ${r.finding} exhibit ${r.exhibit} ${r.type}: ${r.verdict} — ${r.reason}\n`);
    const count = (v: ExhibitVerdict) => results.filter((r) => r.verdict === v).length;
    process.stdout.write(
        `${results.length} exhibit(s): ${count('admissible')} admissible · ${count('inadmissible')} inadmissible · ${count('unverifiable')} unverifiable\n`,
    );
    return 0;
}

const _isMain = (() => {
    const entry = process.argv[1];
    if (!entry) return false;
    try {
        return fs.realpathSync(entry) === fs.realpathSync(fileURLToPath(import.meta.url));
    } catch {
        return false;
    }
})();

if (_isMain) process.exit(main(process.argv.slice(2)));
