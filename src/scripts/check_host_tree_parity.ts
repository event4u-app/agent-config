#!/usr/bin/env tsx
/**
 * A host outside the form record's delivery set receives EXACTLY what `eager-all` writes.
 *
 * `road-to-delivery-for-every-host` step 1.4, and the gate behind its AC-2.
 *
 * WHY A SEPARATE GATE FROM `check_rule_projection_integrity`
 * ---------------------------------------------------------
 * That gate reads the trees AS THEY STAND — no regeneration, by design, because
 * its job is to catch a STALE tree and regenerating erases the evidence. Its 1.3
 * host axis therefore asks a content question about the entries that exist:
 * "is any of these a stub in a tree that should hold bodies?"
 *
 * That is necessary and it is not sufficient. It cannot see a projector change
 * that alters a non-delivery host's output in some way OTHER than stubbing it —
 * a different frontmatter rewrite, a dropped rule, an added byte. The AC is
 * byte-identity, and byte-identity can only be established by producing both
 * trees and comparing them.
 *
 * So this gate GENERATES, twice, into a temporary root it owns:
 *
 *   1. no form record                       → the reference (eager-all) trees
 *   2. a copy of `src/config/project-tree-form.json` → the trees under test
 *
 * and requires every tree whose host is NOT a delivery host to be byte-identical
 * across the two runs. It never writes into the repository: the fixture root is
 * a `mkdtemp` directory, seeded from `dist/agent-src/rules`, and removed on exit.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It does not assert that the DELIVERY host's tree changed. A flip that thins
 * nothing is a different defect and `check_rule_projection_integrity` plus the
 * unit corpus already cover it; asserting it here would make this gate fail on a
 * legitimate `hosts: []`, which is the safe configuration.
 *
 * AND IT ASSERTS NOTHING WHEN EVERY THINNABLE HOST IS ENROLLED. With
 * `hosts: [claude-code, cursor, cline]` there is no non-delivery tree, so the
 * comparison has no subject. That case now prints a `⚠️  NOTHING COMPARED` line
 * naming the gate that does carry the question, instead of the `✅ … 0 …
 * byte-identical` line it printed until 2026-09-08 (R2 finding 12) — a green
 * sentence for an assertion that was never made.
 *
 * NO SETTINGS KEY DRIVES EITHER FIXTURE (ADR-293). Until 2026-10-22 the two
 * fixtures were seeded with `lean_projection.*` settings and the delivery set
 * was read from the same key — after `condense` had stopped reading it, so both
 * fixtures projected eager-all and the gate compared two identical trees. The
 * delivery set now comes from `shippedProjection`, the reader the projector
 * uses, and the thinning fixture carries the record itself.
 *
 * It also does not read the repository's own `.claude/rules` etc. Those are
 * gitignored and absent on a fresh CI checkout, and a gate that silently passes
 * when its subject is missing is the shape this repository's scan-scope
 * discipline exists to reject — hence the fixture root, which always exists.
 *
 * Exit: 0 parity holds · 1 a non-delivery host's tree differs · 2 the gate could
 * not run (no rule corpus to seed from).
 */

import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { GateLedger, UnaccountedTargetsError } from './_lib/gate_ledger.js';
import { PROJECT_TREE_FORM_REL, shippedProjection } from './_lib/project_tree_form.js';
import { reportScanned } from './_lib/scan_scope.js';
import {
    _getStateForTest,
    _resetStateForTest as _pointCondenseAt,
    generate_rule_symlinks,
} from './condense.js';

const _HERE = path.resolve(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

/** The tool dirs this gate compares, and the host each belongs to. */
export const TREES: Readonly<Record<string, string>> = {
    '.claude/rules': 'claude-code',
    '.cursor/rules': 'cursor',
    '.clinerules': 'cline',
};

/** Every entry in `dir` as `name -> content`, reading through symlinks. */
export function treeContents(root: string, rel: string): Record<string, string> {
    const dir = path.join(root, rel);
    const out: Record<string, string> = {};
    if (!fs.existsSync(dir)) return out;
    for (const name of fs.readdirSync(dir).sort()) {
        if (name === 'README.md') continue;
        try {
            out[name] = fs.readFileSync(path.join(dir, name), 'utf-8');
        } catch {
            out[name] = '<unreadable>';
        }
    }
    return out;
}

/**
 * Copy the rule corpus into a fresh fixture root. `withRecord` also copies the
 * package-owned form record, which is the only input `condense` reads for the
 * project-tree form since ADR-293 — without it the fixture projects eager-all.
 */
function seedFixture(repoRoot: string, tmp: string, label: string, withRecord: boolean): string {
    const root = path.join(tmp, label);
    const dist = path.join(root, 'dist', 'agent-src', 'rules');
    fs.mkdirSync(dist, { recursive: true });
    const src = path.join(repoRoot, 'dist', 'agent-src', 'rules');
    for (const name of fs.readdirSync(src).filter((f) => f.endsWith('.md'))) {
        fs.copyFileSync(path.join(src, name), path.join(dist, name));
    }
    const record = path.join(repoRoot, PROJECT_TREE_FORM_REL);
    if (withRecord && fs.existsSync(record)) {
        fs.mkdirSync(path.dirname(path.join(root, PROJECT_TREE_FORM_REL)), { recursive: true });
        fs.copyFileSync(record, path.join(root, PROJECT_TREE_FORM_REL));
    }
    return root;
}

export interface ParityFinding {
    readonly tree: string;
    readonly host: string;
    readonly rule: string;
    readonly reason: string;
}

/** Compare two generated trees, reporting every difference in a non-delivery host's tree. */
export function compareTrees(
    eagerRoot: string,
    testRoot: string,
    deliveryHosts: readonly string[],
): ParityFinding[] {
    const out: ParityFinding[] = [];
    for (const [tree, host] of Object.entries(TREES)) {
        if (deliveryHosts.includes(host)) continue;
        const a = treeContents(eagerRoot, tree);
        const b = treeContents(testRoot, tree);
        for (const name of new Set([...Object.keys(a), ...Object.keys(b)])) {
            const left = a[name];
            const right = b[name];
            if (left === right) continue;
            const reason =
                left === undefined
                    ? 'present under the thinning mode and absent under eager-all'
                    : right === undefined
                      ? 'written by eager-all and MISSING under the thinning mode'
                      : `content differs (${String(left.length)} vs ${String(right.length)} bytes)`;
            out.push({ tree, host, rule: name, reason });
        }
    }
    return out;
}

/**
 * The notice for a comparison with NO SUBJECT, or `null` when there is one.
 *
 * R2 finding 12: with every thinnable host in the delivery set there is
 * no non-delivery tree left, so this gate's assertion is VACUOUS — and it used
 * to say so inside the same `✅ … byte-identical` sentence it prints when the
 * assertion actually held. Zero compared is not a pass; it is an absence of
 * subject, and the reader has to be told which gate carries the question
 * instead.
 *
 * Deliberately NOT an exit-1: enrolling all three hosts is a legal
 * configuration, and reddening a legal configuration is how a gate gets
 * switched off. Pure and exported so the wording is under test without running
 * the two-fixture generation.
 */
export function parityScopeNotice(configured: readonly string[]): string | null {
    const comparable = Object.entries(TREES).filter(([, h]) => !configured.includes(h));
    if (comparable.length > 0) return null;
    return (
        `⚠️  check_host_tree_parity: NOTHING COMPARED — every thinnable host is in ` +
        `the form record's delivery set [${configured.join(', ') || '(none)'}], so no non-delivery tree ` +
        `exists and this gate asserts nothing about this configuration. A stub in a tree with ` +
        `no bound delivery slot is reported by check_rule_projection_integrity's host axis ` +
        `(thinnedTreeFindings); the byte-identity question here has no subject.\n`
    );
}

/** The two generated fixture roots and the delivery hosts the test run was built for. */
export interface ParityFixtures {
    readonly eagerRoot: string;
    readonly testRoot: string;
    readonly configured: readonly string[];
}

/**
 * Generate the eager-all and the thinning projection of `root`'s rule corpus
 * under `tmp`, restoring `condense`'s root and `HOME` afterwards.
 */
export function generateParityFixtures(root: string, tmp: string): ParityFixtures {
    // The delivery set is the one the projector itself derives from the record —
    // never a `lean_projection` settings value, which ADR-293 removed.
    const configured = shippedProjection(root).hosts;
    const saved = _getStateForTest();
    const savedHome = process.env['HOME'];
    try {
        // An empty HOME: user-scope dedup must find no twin, or the two runs
        // would differ for a reason that has nothing to do with the host axis.
        const home = path.join(tmp, 'home');
        fs.mkdirSync(home, { recursive: true });
        process.env['HOME'] = home;

        const eagerRoot = seedFixture(root, tmp, 'eager', false);
        _pointCondenseAt(eagerRoot);
        generate_rule_symlinks();

        const testRoot = seedFixture(root, tmp, 'test', true);
        _pointCondenseAt(testRoot);
        generate_rule_symlinks();
        return { eagerRoot, testRoot, configured };
    } finally {
        _pointCondenseAt(saved.PROJECT_ROOT);
        if (savedHome === undefined) delete process.env['HOME'];
        else process.env['HOME'] = savedHome;
    }
}

export function main(argv: readonly string[] = []): number {
    const root = REPO_ROOT;
    const dist = path.join(root, 'dist', 'agent-src', 'rules');
    if (!fs.existsSync(dist) || fs.readdirSync(dist).filter((f) => f.endsWith('.md')).length === 0) {
        process.stderr.write(
            `❌  check_host_tree_parity: no rule corpus at dist/agent-src/rules — run \`task sync\` first.\n`,
        );
        return 2;
    }

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-parity-'));
    let findings: ParityFinding[];
    let configured: readonly string[];
    try {
        const fx = generateParityFixtures(root, tmp);
        configured = fx.configured;
        findings = compareTrees(fx.eagerRoot, fx.testRoot, configured);
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
    const hostList = configured.join(', ') || '(none)';

    const compared = Object.entries(TREES).filter(([, h]) => !configured.includes(h)).length;
    reportScanned({
        gate: 'check_host_tree_parity',
        scanned: compared,
        units: 'non-delivery host rule tree(s)',
        roots: Object.keys(TREES),
    });

    // One ledger target per non-delivery tree, not per entry: the assertion is
    // about a TREE being byte-identical, and a per-entry ledger would report
    // 200-odd completed targets for what is three yes/no questions.
    const ledger = new GateLedger('check_host_tree_parity');
    const compareable = Object.entries(TREES).filter(([, h]) => !configured.includes(h)).map(([t]) => t);
    ledger.plan(compareable);
    const broken = new Set(findings.map((f) => f.tree));
    for (const tree of compareable) {
        if (broken.has(tree)) ledger.fail(tree, 'differs from the eager-all projection');
        else ledger.complete(tree);
    }
    try {
        if (argv.includes('--quiet')) ledger.finalize();
        else ledger.report();
    } catch (exc) {
        if (exc instanceof UnaccountedTargetsError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (findings.length > 0) {
        process.stderr.write(
            `❌  check_host_tree_parity: ${String(findings.length)} entry(ies) differ between ` +
                `eager-all and delivery on a host that is NOT in the delivery set [${hostList}]:\n`,
        );
        for (const f of findings) {
            process.stderr.write(`  · ${f.tree}/${f.rule} (${f.host}) — ${f.reason}\n`);
        }
        process.stderr.write(
            '\nA host outside the delivery set must receive exactly what `eager-all` writes ' +
                '(K3, and the completeness invariant). Fix the projector, never the expectation.\n',
        );
        return 1;
    }
    const notice = parityScopeNotice(configured);
    if (notice !== null) {
        process.stderr.write(notice);
        return 0;
    }
    if (!argv.includes('--quiet')) {
        process.stdout.write(
            `✅  check_host_tree_parity: ${String(compared)} non-delivery host tree(s) byte-identical to ` +
                `eager-all · delivery hosts [${hostList}]\n`,
        );
    }
    return 0;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exit(main(process.argv.slice(2)));
}
