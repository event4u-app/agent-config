/**
 * check_host_loadability.ts — U4 real-host loadability smoke
 * (road-to-ecosystem-harvest-reliability-measurement).
 *
 * The condensation-hash + linter gates prove the SOURCE tree's shape; this
 * check proves the GENERATED host trees are actually loadable by their hosts:
 *   - .claude/skills/<dir>/SKILL.md — frontmatter parses, has name +
 *     description, and name matches the directory (Claude Code's load rule).
 *   - .cursor/rules/*.mdc — frontmatter parses (Cursor rejects the file
 *     silently otherwise).
 * Run AFTER the projection is generated (CI: the sync-consistency job).
 * Exit 1 on the first malformed artefact, naming it.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

import { parse as parseYaml } from 'yaml';

import { GateLedger } from './_lib/gate_ledger.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { HOST_SURFACES, measureReach } from './_lib/host_projection_reach.js';
import { assertScanned, DeadScopeError } from './_lib/scan_scope.js';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', '..');

/** @returns how many skill directories were examined. */
export function check_claude_skills(root: string, errors: string[]): number {
    const dir = path.join(root, '.claude', 'skills');
    if (!fs.existsSync(dir)) return 0;
    const names = fs.readdirSync(dir);
    for (const name of names) {
        const skillMd = path.join(dir, name, 'SKILL.md');
        if (!fs.existsSync(skillMd)) {
            errors.push(`${skillMd}: missing SKILL.md`);
            continue;
        }
        const src = fs.readFileSync(skillMd, 'utf-8');
        const m = src.match(/^---\n([\s\S]*?)\n---/);
        if (!m) { errors.push(`${skillMd}: no frontmatter`); continue; }
        let meta: Record<string, unknown>;
        try { meta = parseYaml(m[1] ?? '') as Record<string, unknown>; }
        catch (e) { errors.push(`${skillMd}: frontmatter YAML invalid (${(e as Error).message})`); continue; }
        if (typeof meta['name'] !== 'string' || !meta['name']) errors.push(`${skillMd}: missing name`);
        else if (meta['name'] !== name) errors.push(`${skillMd}: name '${meta['name']}' != dir '${name}'`);
        if (typeof meta['description'] !== 'string' || !meta['description']) errors.push(`${skillMd}: missing description`);
    }
    return names.length;
}

/** @returns how many `.mdc` rule files were examined. */
export function check_cursor_rules(root: string, errors: string[]): number {
    const dir = path.join(root, '.cursor', 'rules');
    if (!fs.existsSync(dir)) return 0;
    let scanned = 0;
    for (const name of fs.readdirSync(dir)) {
        if (!name.endsWith('.mdc')) continue;
        scanned += 1;
        const p = path.join(dir, name);
        const src = fs.readFileSync(p, 'utf-8');
        const m = src.match(/^---\n([\s\S]*?)\n---/);
        if (!m) { errors.push(`${p}: no frontmatter`); continue; }
        // Cursor's documented .mdc format writes `globs: *.php` UNQUOTED —
        // valid for Cursor's parser, invalid strict YAML (`*` starts an
        // alias). Quote the globs value before the strict parse so the check
        // mirrors the host's acceptance, not the YAML spec's.
        const lenient = (m[1] ?? '').replace(
            /^(globs:[ \t]*)([^"'\s[][^\n]*)$/m,
            (_all, key: string, val: string) => `${key}"${val.trim()}"`,
        );
        try { parseYaml(lenient); }
        catch (e) { errors.push(`${p}: frontmatter YAML invalid (${(e as Error).message})`); }
    }
    return scanned;
}

export function run(root: string): string[] {
    const errors: string[] = [];
    // Both host trees are generated and gitignored, and each checker returns
    // early when its tree is absent — so "no malformed artefacts" and "no
    // artefacts" are the same green. Thrown, not returned: `errors` names
    // malformed files, and an unprojected tree is not one.
    const scanned = check_claude_skills(root, errors) + check_cursor_rules(root, errors);
    assertScanned({
        gate: 'check_host_loadability',
        scanned,
        units: 'host artefact(s)',
        roots: ['.claude/skills', '.cursor/rules'],
    });
    return errors;
}

/**
 * `--reach`: per-host projection reach, with a NAMED reason for every host that
 * carries nothing (road-to-skill-ecosystem-runtime-enforcement Phase 3 Step 1).
 *
 * The shape checks above answer "is what exists well-formed". This answers "does
 * anything exist, and if not, is the tool absent or the projection dead" — two
 * findings the shape checks report as the same green, because a checker that
 * returns early on a missing tree cannot distinguish them.
 *
 * A dead projection for a PRESENT tool fails. An absent tool is a ledger SKIP
 * with its detection signals named, never a silent zero.
 */
export function runReach(root: string): { failures: string[]; scanned: number } {
    const ledger = new GateLedger('check_host_loadability:reach');
    ledger.plan(HOST_SURFACES.map((s) => s.id));
    const failures: string[] = [];
    for (const r of measureReach(root)) {
        if (r.status === 'ok') {
            ledger.complete(r.id);
            continue;
        }
        if (r.status === 'skipped-tool-absent') {
            // `precondition_unmet` rather than a new code: the closed union in
            // `_lib/gate_ledger.ts` is the audit surface, and an absent host
            // tool IS a precondition that settled the verdict before the
            // projection could be inspected. Widening the union for one caller
            // would make the ledger's vocabulary grow per gate, which is the
            // property that keeps `SKIP_REASON_MESSAGE` readable.
            ledger.skip(r.id, 'precondition_unmet');
            continue;
        }
        ledger.fail(r.id, r.reason);
        failures.push(`${r.id}: ${r.reason}`);
    }
    ledger.report();
    return { failures, scanned: HOST_SURFACES.length };
}


/**
 * Self-test — proof that the reach mode's REJECTIONS still fire.
 *
 * Required by the `gate-self-test:registered-non-adopters` ratchet, and worth
 * having independently: an enforced `scanned:` floor proves the gate READ
 * something, and only a self-test proves the reading changes the verdict.
 *
 * **One case is deliberately absent and the reason is a real limit.** The
 * verdict this mode exists for — an INSTALLED tool whose projection directory
 * is empty — cannot be built from a fixture root, because presence is read from
 * the machine (`PATH` and `$HOME`), not from the tree under test. A fixture can
 * make a projection empty; it cannot make a tool installed. The rejecting case
 * below is therefore the dead-scope one, and the discriminating half rests on
 * the live measurement, which reports every surface with its own verdict.
 */
function reachSelfTest(): number {
    const tmp = fs.mkdtempSync(path.join(REPO_ROOT, '.host-reach-selftest-'));
    const invoke = (dir: string): number =>
        runGateCli(
            REPO_ROOT,
            'src/scripts/check_host_loadability.ts',
            ['--reach', '--root', dir],
            REPO_ROOT,
        );
    try {
        return runSelfTest({
            gate: 'check_host_loadability',
            minCases: 2,
            minRejectCases: 1,
            cases: [
                {
                    name: 'a root carrying no host projection at all is REFUSED, never passed',
                    expect: 'reject',
                    run: () => invoke(tmp),
                },
                {
                    name: 'this repository accounts for every host surface',
                    expect: 'accept',
                    run: () => invoke(REPO_ROOT),
                },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

const isMain = process.argv[1] !== undefined
    && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
    const rootIdx = process.argv.indexOf('--root');
    const root = rootIdx !== -1 ? process.argv[rootIdx + 1] ?? '.' : '.';
    if (process.argv.includes('--self-test')) {
        process.exit(reachSelfTest());
    }
    if (process.argv.includes('--reach')) {
        const { failures, scanned } = runReach(root);
        process.stdout.write(`scanned: ${String(scanned)}\n`);
        if (failures.length > 0) {
            for (const f of failures) process.stderr.write(`❌  ${f}\n`);
            process.exit(1);
        }
        process.stdout.write(`✅  host projection reach: ${String(scanned)} host surface(s) accounted for\n`);
        process.exit(0);
    }
    let errors: string[];
    try {
        errors = run(root);
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        // Exit 1 is this gate's only failure code.
        process.stderr.write(`❌  ${exc.message}\n`);
        process.exit(1);
    }
    if (errors.length > 0) {
        for (const e of errors) process.stderr.write(`❌  ${e}\n`);
        process.exit(1);
    }
    process.stdout.write('✅  host trees loadable (.claude skills + .cursor mdc)\n');
    process.exit(0);
}
