#!/usr/bin/env tsx
/**
 * Provenance-declaration gate for the security and safety floors.
 *
 * WHY THIS SCOPE AND NOT ALL 120 RULES. `src/rules/code-provenance.md`
 * § The knowledge layer states the obligation for prose: an artefact asserting
 * an externally-sourced claim either cites it or labels the statement as own
 * analysis, and "silence is neither". That rule also says plainly that nothing
 * enforces it — `lint_harvest_provenance` validates the harvest ledger's own
 * rows and "cannot see a claim nobody recorded". This gate is the structural
 * half for the surface where an unsourced normative claim costs the most.
 *
 * road-to-retired-claims-stay-retired Phase 3.2. The roadmap picked the ten
 * deliberately: holding all 120 at once is the strict-gate-fires-on-everything
 * failure this repository has recorded before, and the ten are the rules whose
 * normative content most plausibly came from outside.
 *
 * WHAT IT CHECKS. Each in-scope rule carries an `evidence:` block with
 * `source_type`, `verified_on` and `normative_level`. The block's SHAPE —
 * enums, the date pattern, unknown keys — is `rule.schema.json`'s job via
 * `validate_frontmatter`, and is deliberately not duplicated here: two
 * validators for one shape drift, and the schema is the one a rule author
 * already runs. This gate owns PRESENCE within a declared scope, which the
 * schema cannot express because the block is optional everywhere else.
 *
 * THE SCOPE IS A LIST, AND THAT IS THE POINT. There is no frontmatter marker
 * that delimits "security and safety floor" — measured 2026-08-30, the ten
 * span three tiers (`2a`, `2b`, `safety-floor`), two `type` values and three
 * pack sets, and `packs: [engineering-base]` also holds rules that are not
 * safety floors. Deriving the scope from a proxy would silently admit and drop
 * rules as unrelated frontmatter moved. An explicit list is reviewable, and a
 * rule joining it is a decision somebody makes rather than a side effect.
 *
 * Exit codes: 0 = every in-scope rule declares · 1 = a declaration is missing
 * or the scope is dead · 2 = usage error.
 *
 * Usage:
 *     ./scripts-run src/scripts/check_rule_evidence_declaration
 *     ./scripts-run src/scripts/check_rule_evidence_declaration --root <dir>
 *     ./scripts-run src/scripts/check_rule_evidence_declaration --self-test
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { runSelfTest, type SelfTestCase } from './_lib/gate_self_test.js';
import { assertWatchlistResolves, DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _FILE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_FILE), '..', '..');

/**
 * The declared scope, with the reason each row is in it.
 *
 * Growing this list is the intended way to widen the obligation: adding a row
 * makes the gate fail until that rule declares, which is exactly the
 * "an eleventh rule added without one fails" behaviour the roadmap asked for.
 */
export const SCOPE: ReadonlyArray<{ rule: string; why: string }> = [
    { rule: 'security-sensitive-stop', why: 'gates every edit to an auth / tenancy / billing / secrets surface' },
    { rule: 'untrusted-input-defense', why: 'the data-not-instructions boundary; cites OWASP LLM01' },
    { rule: 'lethal-trifecta-guard', why: 'the three-leg exfiltration shape; cites the OWASP ASI list' },
    { rule: 'secret-vcs-guard', why: 'the last gate before a credential reaches history' },
    { rule: 'broken-access-control', why: 'cites OWASP A01:2021 and BOLA/IDOR, and GDPR exposure' },
    { rule: 'tool-safety', why: 'Least Agency; cites OWASP ASI excessive-agency and LLM06' },
    { rule: 'domain-safety-pii', why: 'cites GDPR, CCPA, HIPAA, EEO and a k-anonymity figure' },
    { rule: 'non-destructive-by-default', why: 'the Hard Floor no other rule may lift' },
    { rule: 'engineering-safety-floor', why: 'the production / infra / bulk-destructive floor' },
    { rule: 'code-provenance', why: 'states the knowledge-layer obligation this gate enforces' },
];

/** The three keys a declaration must carry, per rule.schema.json. */
const REQUIRED_KEYS = ['source_type', 'verified_on', 'normative_level'] as const;

export interface Finding {
    rule: string;
    reason: string;
}

/** Extract the frontmatter block of a markdown file, or `null`. */
function frontmatter(body: string): string | null {
    if (!body.startsWith('---\n')) return null;
    const end = body.indexOf('\n---', 3);
    if (end === -1) return null;
    return body.slice(4, end + 1);
}

/**
 * The `evidence:` mapping's own lines, or `null` when the key is absent.
 *
 * Deliberately a line scan rather than a YAML parse: this gate runs on every
 * `task ci`, the schema validator already parses the same file properly, and a
 * second parser is a second thing that can disagree about the first.
 */
export function evidenceLines(fm: string): string[] | null {
    const lines = fm.split('\n');
    const start = lines.findIndex((l) => /^evidence:\s*$/.test(l));
    if (start === -1) return null;
    const out: string[] = [];
    for (const line of lines.slice(start + 1)) {
        if (line.trim() === '') continue;
        if (!/^\s+\S/.test(line)) break; // dedented — the block ended
        out.push(line);
    }
    return out;
}

export function analyse(root = REPO_ROOT): Finding[] {
    const findings: Finding[] = [];
    for (const { rule } of SCOPE) {
        const abs = path.join(root, 'src', 'rules', `${rule}.md`);
        let body: string;
        try {
            body = fs.readFileSync(abs, 'utf8');
        } catch {
            findings.push({ rule, reason: 'in scope but the rule file does not exist — remove the row or restore the rule' });
            continue;
        }
        const fm = frontmatter(body);
        if (fm === null) {
            findings.push({ rule, reason: 'no frontmatter block' });
            continue;
        }
        const block = evidenceLines(fm);
        if (block === null) {
            findings.push({
                rule,
                reason:
                    'carries no `evidence:` block — state where its normative content came from, ' +
                    'or record `source_type: own-analysis`, which is a complete discharge',
            });
            continue;
        }
        for (const key of REQUIRED_KEYS) {
            if (!block.some((l) => new RegExp(`^\\s+${key}:\\s*\\S`).test(l))) {
                findings.push({ rule, reason: `evidence block is missing \`${key}\`` });
            }
        }
    }
    return findings;
}

function runGate(root: string): number {
    try {
        assertWatchlistResolves({
            gate: 'check_rule_evidence_declaration',
            candidates: SCOPE.map((s) => `src/rules/${s.rule}.md`),
            repoRoot: root,
        });
    } catch (exc) {
        if (!(exc instanceof DeadScopeError)) throw exc;
        process.stderr.write(`❌  ${exc.message}\n`);
        return 1;
    }
    reportScanned({
        gate: 'check_rule_evidence_declaration',
        scanned: SCOPE.length,
        units: 'in-scope rule(s)',
        roots: ['src/rules/'],
    });
    const findings = analyse(root);
    if (findings.length > 0) {
        process.stderr.write(
            `❌  check_rule_evidence_declaration: ${String(findings.length)} finding(s):\n`,
        );
        for (const f of findings) process.stderr.write(`    src/rules/${f.rule}.md — ${f.reason}\n`);
        process.stderr.write(
            '    → the block is documented at `evidence` in src/scripts/schemas/rule.schema.json.\n',
        );
        return 1;
    }
    process.stdout.write(
        `✅  check_rule_evidence_declaration: ${String(SCOPE.length)} security/safety rule(s) declare their provenance.\n`,
    );
    return 0;
}

function selfTest(): number {
    const roots: string[] = [];
    const fixture = (frontmatterBody: string, rules = [SCOPE[0]!.rule]): number => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rule-evidence-'));
        roots.push(dir);
        fs.mkdirSync(path.join(dir, 'src', 'rules'), { recursive: true });
        // Every in-scope rule must exist or the run fails for the wrong reason;
        // the ones not under test get a well-formed block.
        const good = [
            'evidence:',
            '  source_type: own-analysis',
            '  verified_on: 2026-08-30',
            '  normative_level: informative',
        ].join('\n');
        for (const { rule } of SCOPE) {
            const fm = rules.includes(rule) ? frontmatterBody : good;
            fs.writeFileSync(
                path.join(dir, 'src', 'rules', `${rule}.md`),
                `---\ntype: "auto"\n${fm}\n---\n\n# ${rule}\n`,
            );
        }
        return runGate(dir);
    };

    const cases: SelfTestCase[] = [
        {
            name: 'every in-scope rule declares → accept',
            expect: 'accept',
            run: () =>
                fixture(
                    ['evidence:', '  source_type: own-analysis', '  verified_on: 2026-08-30', '  normative_level: informative'].join('\n'),
                ),
        },
        {
            name: 'an in-scope rule with NO evidence block → reject',
            expect: 'reject',
            run: () => fixture('description: "a rule with no provenance"'),
        },
        {
            name: 'an evidence block missing normative_level → reject',
            expect: 'reject',
            run: () =>
                fixture(['evidence:', '  source_type: own-analysis', '  verified_on: 2026-08-30'].join('\n')),
        },
        {
            name: 'an evidence key present but valueless → reject',
            expect: 'reject',
            run: () =>
                fixture(
                    ['evidence:', '  source_type: own-analysis', '  verified_on:', '  normative_level: informative'].join('\n'),
                ),
        },
        {
            name: 'a populated external-standard block → accept',
            expect: 'accept',
            run: () =>
                fixture(
                    [
                        'evidence:',
                        '  source_type: external-standard',
                        '  source_urls: ["https://example.invalid/standard"]',
                        '  verified_on: 2026-08-30',
                        '  normative_level: recommended',
                    ].join('\n'),
                ),
        },
    ];

    try {
        return runSelfTest({
            gate: 'check_rule_evidence_declaration',
            cases,
            minCases: 5,
            minRejectCases: 3,
        });
    } finally {
        for (const d of roots) fs.rmSync(d, { recursive: true, force: true });
    }
}

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    let root = REPO_ROOT;
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i]!;
        if (a === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write('check_rule_evidence_declaration: --root needs a directory\n');
                return 2;
            }
            root = path.resolve(v);
            i += 1;
        } else if (a === '--quiet') {
            continue;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: check_rule_evidence_declaration [--root DIR] [--quiet] [--self-test]\n',
            );
            return 0;
        } else {
            process.stderr.write(`check_rule_evidence_declaration: unrecognized argument: ${a}\n`);
            return 2;
        }
    }
    return runGate(root);
}

if (process.argv[1] !== undefined && process.argv[1].includes('check_rule_evidence_declaration')) {
    process.exit(main());
}
