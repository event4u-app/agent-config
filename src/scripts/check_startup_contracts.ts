#!/usr/bin/env tsx
/**
 * Every high-consequence and safety-floor rule carries a startup contract that
 * holds every operative clause of the rule
 * (`road-to-a-session-start-under-the-host-limit` 1.1–1.3).
 *
 * At session start such a rule is delivered as its contract, not its body, so a
 * clause missing from the contract is a clause the agent never sees until a
 * trigger loads the body. `src/config/startup-contract-clauses.json` is the
 * clause audit: per rule, every operative clause with a `source` (a byte-exact
 * span of the rule file, so the audit is anchored to the text it claims to
 * read) and a `witness` (a byte-exact span of the contract that carries it).
 *
 * WHAT THIS PROVES AND WHAT IT DOES NOT. It is deterministic and structural:
 * each audited clause has a carrier in the contract, the contract stands alone
 * (no "below" / "the table"), and the sizes hold. It does not prove a model
 * reading only the contract behaves as it would with the body — that is the
 * release-time non-inferiority check of step 3.3, not a CI gate.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { pathToFileURL } from 'node:url';

import { parseGateArgs, USAGE_EXIT } from './_lib/gate_args.js';
import { runGateCli, runSelfTest } from './_lib/gate_self_test.js';
import { KERNEL_RULE_ID_SET } from './_lib/kernel_rules.js';
import { readConsequenceClass } from './_lib/rule_consequence_class.js';
import { readStartupContract } from './_lib/rule_law_section.js';
import { reportScanned } from './_lib/scan_scope.js';

const SELF_ROOT = path.resolve(import.meta.dirname, '..', '..');
/** `CHECK_STARTUP_CONTRACTS_ROOT` points the gate at a fixture tree (its `--self-test`). */
const REPO_ROOT = process.env['CHECK_STARTUP_CONTRACTS_ROOT'] ?? SELF_ROOT;
const CONFIG_REL = path.join('src', 'config', 'startup-contract-clauses.json');
const RULES_REL = path.join('src', 'rules');

export const CLAUSE_KINDS = [
    'trigger', 'obligation', 'prohibition', 'exception', 'ordering', 'stop', 'escalation', 'precedence', 'bound',
] as const;
export const RESPONSES = ['act', 'stop', 'ask', 'refuse', 'surface', 'none'] as const;

/** A contract must stand alone: a phrase pointing at text it does not carry is a dangling clause. */
export const DANGLING_REF_RE = /\b(below|above|the table|the steps|this list|see section)\b/i;

export interface Clause {
    readonly id: string;
    readonly kind: string;
    readonly source: string;
    readonly in_law: boolean;
    readonly response: string;
    readonly witness: string;
    readonly unresolved_ref: string | null;
}

export interface ContractConfig {
    readonly per_rule_max_chars: number;
    readonly total_max_chars: number;
    readonly rules: Readonly<Record<string, { readonly clauses: readonly Clause[] }>>;
}

export interface RuleText {
    /** The full source file. */
    readonly file: string;
    /** The contract section, `null` when absent. */
    readonly contract: string | null;
}

/** The rules that must carry a contract: consequence class plus `tier: safety-floor`, kernel excluded. */
export function requiredRules(repoRoot: string): string[] {
    const ids = new Set(Object.keys(readConsequenceClass(repoRoot).members));
    const dir = path.join(repoRoot, RULES_REL);
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
        const text = fs.readFileSync(path.join(dir, name), 'utf8');
        const end = text.indexOf('\n---', 3);
        if (text.startsWith('---') && end > 0 && /^tier:\s*["']?safety-floor["']?\s*$/m.test(text.slice(0, end))) {
            ids.add(name.slice(0, -3));
        }
    }
    return [...ids].filter((id) => !KERNEL_RULE_ID_SET.has(id)).sort();
}

/** Every problem with the contracts, as one message each. Empty means green. */
export function contractProblems(
    required: readonly string[],
    texts: ReadonlyMap<string, RuleText>,
    config: ContractConfig,
): string[] {
    const problems: string[] = [];
    let total = 0;
    const carrying = [...texts].filter(([, t]) => t.contract !== null).map(([id]) => id);
    for (const id of new Set([...required, ...carrying, ...Object.keys(config.rules)])) {
        const t = texts.get(id);
        const entry = config.rules[id];
        if (!required.includes(id)) {
            problems.push(`${id}: carries a startup contract or an audit entry but is not a consequence-class or safety-floor rule`);
            continue;
        }
        if (t === undefined || t.contract === null) {
            problems.push(`${id}: no \`## Startup contract\` section`);
            continue;
        }
        if (entry === undefined || entry.clauses.length === 0) {
            problems.push(`${id}: no clause audit in ${CONFIG_REL}`);
            continue;
        }
        total += t.contract.length;
        if (t.contract.length > config.per_rule_max_chars) {
            problems.push(`${id}: contract is ${t.contract.length} chars, over ${config.per_rule_max_chars}`);
        }
        const dangling = DANGLING_REF_RE.exec(t.contract);
        if (dangling !== null) problems.push(`${id}: contract refers to "${dangling[0]}" without carrying its referent`);
        const seen = new Set<string>();
        for (const c of entry.clauses) {
            const at = `${id}#${c.id}`;
            if (!(CLAUSE_KINDS as readonly string[]).includes(c.kind)) problems.push(`${at}: unknown kind "${c.kind}"`);
            if (!(RESPONSES as readonly string[]).includes(c.response)) problems.push(`${at}: unknown response "${c.response}"`);
            if (c.source.trim() === '' || !t.file.includes(c.source)) problems.push(`${at}: source is not a span of the rule file`);
            if (c.witness.trim() === '' || !t.contract.includes(c.witness)) {
                problems.push(`${at}: witness "${c.witness}" is not in the contract — the clause has no carrier`);
            }
            if (seen.has(c.witness)) problems.push(`${at}: witness shared with another clause`);
            seen.add(c.witness);
        }
    }
    if (total > config.total_max_chars) {
        problems.push(`contracts total ${total} chars, over ${config.total_max_chars}`);
    }
    return problems;
}

export function readRuleTexts(repoRoot: string): Map<string, RuleText> {
    const dir = path.join(repoRoot, RULES_REL);
    const out = new Map<string, RuleText>();
    for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.md'))) {
        const file = fs.readFileSync(path.join(dir, name), 'utf8');
        out.set(name.slice(0, -3), { file, contract: readStartupContract(dir, name.slice(0, -3)) });
    }
    return out;
}

/** Source directory of the contracts, one file per rule (`startupContractPath`). */
export const CONTRACTS_REL = path.join('src', 'agent-src', 'startup-contracts', 'rules');

/** Contract files that name no rule — an orphan is never read by a stub builder, so its edits go unchecked. */
export function orphanContracts(repoRoot: string): string[] {
    const dir = path.join(repoRoot, CONTRACTS_REL);
    if (!fs.existsSync(dir)) return [];
    return fs
        .readdirSync(dir)
        .filter((n) => n.endsWith('.md') && !fs.existsSync(path.join(repoRoot, RULES_REL, n)))
        .map((n) => `${path.join(CONTRACTS_REL, n)}: a startup contract for a rule that does not exist`);
}

/**
 * `--self-test` — drives the real binary over a one-rule fixture tree: an
 * audited contract passes; a contract missing a clause's witness, and a
 * required rule with no contract file, are refused.
 */
export function selfTest(): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'csc-self-'));
    const contract = '## Startup contract\n\n- **When:** a secret is about to be staged.\n- **Never:** commit it; stop and ask.\n';
    const tree = (contractText: string | null): string => {
        const root = fs.mkdtempSync(path.join(tmp, 'repo-'));
        fs.mkdirSync(path.join(root, 'src', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(root, 'src', 'config'), { recursive: true });
        fs.writeFileSync(path.join(root, 'src', 'rules', 'r.md'), '---\ntype: "auto"\n---\n# R\n\nNEVER commit a secret.\n', 'utf-8');
        fs.writeFileSync(
            path.join(root, 'src', 'config', 'rule-consequence-class.json'),
            JSON.stringify({ criterion_ref: 'fixture', members: { r: { reason: 'fixture' } }, no_stub: {}, excluded: {} }),
            'utf-8',
        );
        fs.writeFileSync(
            path.join(root, CONFIG_REL),
            JSON.stringify({
                per_rule_max_chars: 2000,
                total_max_chars: 34000,
                rules: { r: { clauses: [{ id: 'c1', kind: 'prohibition', source: 'NEVER commit a secret.', in_law: true, response: 'stop', witness: 'commit it; stop and ask', unresolved_ref: null }] } },
            }),
            'utf-8',
        );
        if (contractText !== null) {
            fs.mkdirSync(path.join(root, CONTRACTS_REL), { recursive: true });
            fs.writeFileSync(path.join(root, CONTRACTS_REL, 'r.md'), contractText, 'utf-8');
        }
        return root;
    };
    const run = (root: string): number => {
        process.env['CHECK_STARTUP_CONTRACTS_ROOT'] = root;
        try {
            return runGateCli(SELF_ROOT, 'src/scripts/check_startup_contracts.ts', ['--quiet'], root);
        } finally {
            delete process.env['CHECK_STARTUP_CONTRACTS_ROOT'];
        }
    };
    try {
        return runSelfTest({
            gate: 'check_startup_contracts',
            minCases: 3,
            minRejectCases: 2,
            cases: [
                { name: 'an audited contract carrying every witness passes', expect: 'accept', run: () => run(tree(contract)) },
                { name: 'a contract missing a clause witness is refused', expect: 'reject', run: () => run(tree(contract.replace('commit it; stop and ask', 'commit it'))) },
                { name: 'a required rule with no contract file is refused', expect: 'reject', run: () => run(tree(null)) },
            ],
        });
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: readonly string[] = process.argv.slice(2)): number {
    if (argv.includes('--self-test')) return selfTest();
    const parsed = parseGateArgs('check_startup_contracts', argv, { quiet: { type: 'boolean' } });
    if (!parsed.ok) {
        process.stderr.write(`${parsed.message}\n`);
        return USAGE_EXIT;
    }
    const config = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, CONFIG_REL), 'utf8')) as ContractConfig;
    const required = requiredRules(REPO_ROOT);
    reportScanned({
        gate: 'check_startup_contracts',
        scanned: required.length,
        units: 'contract-bearing rule(s)',
        roots: [RULES_REL],
    });
    const problems = [...contractProblems(required, readRuleTexts(REPO_ROOT), config), ...orphanContracts(REPO_ROOT)];
    for (const p of problems) process.stderr.write(`❌  ${p}\n`);
    if (problems.length === 0 && parsed.values.quiet !== true) {
        const clauses = Object.values(config.rules).reduce((n, r) => n + r.clauses.length, 0);
        process.stdout.write(`✅  check_startup_contracts: ${required.length} rule(s), ${clauses} clause(s), each with a carrier.\n`);
    }
    return problems.length === 0 ? 0 : 1;
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    process.exitCode = main();
}
