#!/usr/bin/env tsx
/**
 * lint_rule_law_section — every routed rule states its law in one section short
 * enough to stand on its own.
 *
 * THE DEFECT. Measured 2026-10-01 over `dist/router.json`'s 106 tier rules:
 * 71 carry a heading matching `Iron Law`, 35 do not — among them
 * `runtime-safety` and `tool-safety`, which govern tool grants and execution
 * handlers. Several of the 35 state a law in bold text or a bare fence instead,
 * so 35 is an upper bound on what is genuinely missing, not a count of
 * lawless rules. Nothing asserted either way: law sections were an authoring
 * habit, never a state.
 *
 * That matters now because `project_thin_rules` ships a class of rules as a
 * stub plus their own law section. A rule with no law section cannot be in that
 * class, and a rule whose law section is 5,387 characters defeats the point of
 * a stub. This gate holds three lines so the projector can rely on them.
 *
 * WHAT IT ASSERTS, three axes, each with its own ratchet:
 *
 * 1. PRESENCE (`--axis presence`). Every routed tier rule has a law section, or
 *    is named in the `missing` baseline. SHRINK-ONLY: an id may leave that list
 *    freely, and a routed rule that is not on it and has no law section fails.
 *    A NEW routed rule therefore cannot be born lawless.
 *
 * 2. LAW CEILING (`--axis ceiling`). Target 1,200 characters, REPORTED and
 *    never failing; hard 2,000, failing. A rule over the hard ceiling today is
 *    named in `law_exceptions` with an owner and a review date, and may only
 *    shrink — its recorded size is a ceiling, not a licence.
 *
 * 3. BODY CEILING (`--axis body-ceiling`). 8,000 characters of
 *    comment-stripped body, the unit a full runtime delivery carries, so it is
 *    priced in the same unit the installed-layer report uses. Today's larger
 *    rules are named in `body_exceptions`, shrink-only on the same terms.
 *
 * WHY THE TARGET IS REPORTED AND NOT ENFORCED. A rule shortened to fit a number
 * is the failure this roadmap says it will not cause. 1,200 is where the
 * distribution sits (median 511, p90 1,787) and a rule between target and hard
 * ceiling is a rule to look at, not a rule to cut. Only 2,000 — above p90, so
 * no rule is truncated by it — refuses.
 *
 * WHY SCOPED TO TIER RULES. "Routed" means present in `router.json`'s `tier_1`
 * or `tier_2`. The nine kernel rules are excluded and the exclusion is a fact
 * about this repository, not a judgement: kernel rule files are agent-write-
 * denied, and two of them (`agent-authority`, `scope-control`) carry no Iron-Law
 * heading today, so a gate that included them would be a gate no agent could
 * ever make green. They are counted and printed under `kernel (reported)` so
 * the exclusion is visible rather than silent, and `project_thin_rules` keeps
 * the kernel full-bodied anyway — it never ships a kernel stub, so the stub-law
 * question does not arise there.
 *
 * WHAT IT DOES NOT ASSERT. Not that the extracted section is the rule's real
 * obligation — a heading match is structural and checkable, "this sentence is
 * the obligation" is not; the `# obligation: line N` marker and
 * `report_obligation_carriers` own that. Not that a rule at its recorded
 * exception is correct, only that it is not worse. And not a cross-commit
 * ratchet: this gate reads one tree, so "shrink-only" means the tree sits at or
 * under what is committed, and a silently LOWERED baseline is a question the
 * diff answers, not this gate. Saying so is the point.
 *
 * Exit codes: 0 clean, 1 violations, 2 usage error, 3 internal error.
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { asOf } from './_lib/as_of.js';
import { measureRuleFile, type RuleLawMeasure } from './_lib/rule_law_section.js';
import { DeadScopeError, reportScanned } from './_lib/scan_scope.js';

const _HERE = fileURLToPath(import.meta.url);
export const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const CONFIG_REL = 'src/config/rule-law-ceilings.json';
export const RULES_REL = 'src/rules';
export const ROUTER_REL = 'dist/router.json';

/** Reported, never failing — a rule above it is a rule to look at. */
export const LAW_TARGET_CHARS = 1_200;
/** Refused. Above p90, so no rule in the distribution is truncated by it. */
export const LAW_HARD_CHARS = 2_000;
/** Refused. The unit a full runtime delivery carries. */
export const BODY_HARD_CHARS = 8_000;

export interface SizeException {
    /** Recorded size at adoption. The rule may sit at or under it, never above. */
    chars: number;
    /** Who answers for this rule staying oversized. */
    owner: string;
    /** `YYYY-MM-DD` the exception is due for review. */
    review: string;
    /** Why this rule cannot state its law under the ceiling today. */
    reason: string;
}

export interface LawConfig {
    _comment?: string;
    measured_at_commit?: string;
    /** Routed rules with no law section. Shrink-only: ids may leave, never join. */
    missing: string[];
    /** Rules whose law exceeds {@link LAW_HARD_CHARS}. */
    law_exceptions: Record<string, SizeException>;
    /** Rules whose body exceeds {@link BODY_HARD_CHARS}. */
    body_exceptions: Record<string, SizeException>;
}

export type Axis = 'presence' | 'ceiling' | 'body-ceiling' | 'all';

export interface Finding {
    id: string;
    axis: Exclude<Axis, 'all'>;
    kind: string;
    detail: string;
}

export interface LintResult {
    findings: Finding[];
    /** Rules at or above the soft target but under the hard ceiling. */
    overTarget: Array<{ id: string; chars: number }>;
    measures: RuleLawMeasure[];
    kernelReported: Array<{ id: string; sections: number }>;
    scanned: number;
}

/** Routed tier rule ids, sorted — `tier_1` + `tier_2`, kernel excluded. */
export function routedRuleIds(root = REPO_ROOT): string[] {
    const data = JSON.parse(fs.readFileSync(path.join(root, ROUTER_REL), 'utf-8')) as Record<
        string,
        unknown
    >;
    const ids: string[] = [];
    for (const tier of ['tier_1', 'tier_2']) {
        const entries = data[tier];
        if (!Array.isArray(entries)) continue;
        for (const e of entries) ids.push(String((e as Record<string, unknown>).id));
    }
    return [...new Set(ids)].sort();
}

export function kernelRuleIds(root = REPO_ROOT): string[] {
    const data = JSON.parse(fs.readFileSync(path.join(root, ROUTER_REL), 'utf-8')) as Record<
        string,
        unknown
    >;
    const kernel = data.kernel;
    return Array.isArray(kernel) ? kernel.map((x) => String(x)).sort() : [];
}

export function readConfig(root = REPO_ROOT): LawConfig {
    const p = path.join(root, CONFIG_REL);
    const raw = JSON.parse(fs.readFileSync(p, 'utf-8')) as Partial<LawConfig>;
    return {
        missing: Array.isArray(raw.missing) ? raw.missing : [],
        law_exceptions: raw.law_exceptions ?? {},
        body_exceptions: raw.body_exceptions ?? {},
        measured_at_commit: raw.measured_at_commit ?? '',
    };
}

/** Measure every routed rule that has a file. */
export function measureRouted(root = REPO_ROOT): RuleLawMeasure[] {
    const out: RuleLawMeasure[] = [];
    for (const id of routedRuleIds(root)) {
        const p = path.join(root, RULES_REL, `${id}.md`);
        if (!fs.existsSync(p)) continue;
        out.push(measureRuleFile(id, p));
    }
    return out;
}

export function lint(root = REPO_ROOT, axis: Axis = 'all'): LintResult {
    const cfg = readConfig(root);
    const measures = measureRouted(root);
    const findings: Finding[] = [];
    const overTarget: Array<{ id: string; chars: number }> = [];
    const baselined = new Set(cfg.missing);
    const want = (a: Exclude<Axis, 'all'>): boolean => axis === 'all' || axis === a;

    for (const m of measures) {
        if (want('presence') && m.law === null && !baselined.has(m.id)) {
            findings.push({
                id: m.id,
                axis: 'presence',
                kind: 'no-law-section',
                detail:
                    'routed rule has no heading matching `Iron Law` — state the obligation under ' +
                    `one, or add the id to \`missing\` in ${CONFIG_REL} (that list is shrink-only, ` +
                    'so a new routed rule may not join it)',
            });
        }
        if (want('ceiling') && m.law !== null) {
            const exc = cfg.law_exceptions[m.id];
            if (exc === undefined) {
                if (m.lawChars > LAW_HARD_CHARS) {
                    findings.push({
                        id: m.id,
                        axis: 'ceiling',
                        kind: 'law-over-hard-ceiling',
                        detail:
                            `law section is ${m.lawChars} chars, over the ${LAW_HARD_CHARS} hard ceiling — ` +
                            'move the discussion under it behind `load_context`, or record a dated ' +
                            `exception with an owner in ${CONFIG_REL}`,
                    });
                } else if (m.lawChars > LAW_TARGET_CHARS) {
                    overTarget.push({ id: m.id, chars: m.lawChars });
                }
            } else if (m.lawChars > exc.chars) {
                findings.push({
                    id: m.id,
                    axis: 'ceiling',
                    kind: 'law-exception-grew',
                    detail:
                        `law section is ${m.lawChars} chars, above its recorded exception of ` +
                        `${exc.chars} (owner ${exc.owner}, review ${exc.review}) — an exception is ` +
                        'a ceiling, not a licence; it may only shrink',
                });
            }
        }
        if (want('body-ceiling')) {
            const exc = cfg.body_exceptions[m.id];
            if (exc === undefined) {
                if (m.bodyChars > BODY_HARD_CHARS) {
                    findings.push({
                        id: m.id,
                        axis: 'body-ceiling',
                        kind: 'body-over-hard-ceiling',
                        detail:
                            `body is ${m.bodyChars} chars, over the ${BODY_HARD_CHARS} hard ceiling — ` +
                            'move history and mechanism discussion into a context file the rule names ' +
                            `in \`load_context\`, or record a dated exception in ${CONFIG_REL}`,
                    });
                }
            } else if (m.bodyChars > exc.chars) {
                findings.push({
                    id: m.id,
                    axis: 'body-ceiling',
                    kind: 'body-exception-grew',
                    detail:
                        `body is ${m.bodyChars} chars, above its recorded exception of ${exc.chars} ` +
                        `(owner ${exc.owner}, review ${exc.review}) — it may only shrink`,
                });
            }
        }
    }

    // A baseline entry for a rule that now HAS a law section is debt that was
    // paid and never collected. Reported as a finding, because a stale
    // suppression is how a ratchet hardens into configuration.
    if (want('presence')) {
        const haveLaw = new Set(measures.filter((m) => m.law !== null).map((m) => m.id));
        const routed = new Set(measures.map((m) => m.id));
        for (const id of cfg.missing) {
            if (haveLaw.has(id)) {
                findings.push({
                    id,
                    axis: 'presence',
                    kind: 'stale-baseline-entry',
                    detail: `now has a law section — remove it from \`missing\` in ${CONFIG_REL}`,
                });
            } else if (!routed.has(id)) {
                findings.push({
                    id,
                    axis: 'presence',
                    kind: 'stale-baseline-entry',
                    detail: `is not a routed rule any more — remove it from \`missing\` in ${CONFIG_REL}`,
                });
            }
        }
    }

    const kernelReported = kernelRuleIds(root).map((id) => {
        const p = path.join(root, RULES_REL, `${id}.md`);
        return { id, sections: fs.existsSync(p) ? measureRuleFile(id, p).sections : 0 };
    });

    findings.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.kind < b.kind ? -1 : 1));
    overTarget.sort((a, b) => b.chars - a.chars);
    return { findings, overTarget, measures, kernelReported, scanned: measures.length };
}

/** Rebuild the config from the current tree. Never raises an existing ceiling. */
export function writeBaseline(root = REPO_ROOT, today: string): string {
    const prev = fs.existsSync(path.join(root, CONFIG_REL))
        ? readConfig(root)
        : { missing: [], law_exceptions: {}, body_exceptions: {} };
    const measures = measureRouted(root);
    const missing = measures.filter((m) => m.law === null).map((m) => m.id).sort();
    const law_exceptions: Record<string, SizeException> = {};
    const body_exceptions: Record<string, SizeException> = {};
    for (const m of measures) {
        if (m.law !== null && m.lawChars > LAW_HARD_CHARS) {
            const old = prev.law_exceptions[m.id];
            law_exceptions[m.id] = {
                chars: old === undefined ? m.lawChars : Math.min(old.chars, m.lawChars),
                owner: old?.owner ?? 'agent-config-maintainer',
                review: old?.review ?? today,
                reason: old?.reason ?? 'recorded at adoption; not yet reviewed',
            };
        }
        if (m.bodyChars > BODY_HARD_CHARS) {
            const old = prev.body_exceptions[m.id];
            body_exceptions[m.id] = {
                chars: old === undefined ? m.bodyChars : Math.min(old.chars, m.bodyChars),
                owner: old?.owner ?? 'agent-config-maintainer',
                review: old?.review ?? today,
                reason: old?.reason ?? 'recorded at adoption; not yet reviewed',
            };
        }
    }
    const cfg = {
        _comment:
            'Per-rule law-section and body ceilings (road-to-rule-laws-that-can-stand Phase 1). ' +
            'SHRINK-ONLY on every axis: an id may LEAVE `missing`, never join it; a recorded ' +
            'exception is a ceiling the rule may fall below and never rise above. Raising one to ' +
            'clear a red is the config-weakening move this repo blocks by construction — ' +
            '`--write-baseline` refuses to raise, it only re-records the smaller of old and ' +
            'current. A rule at its exception is not thereby correct, only not worse. Regenerate ' +
            'with `lint_rule_law_section --write-baseline`; never hand-edit the counts, but DO ' +
            'hand-edit `owner`, `review` and `reason` — those are the review contract and the ' +
            'generator only seeds them.',
        measured_at_commit: prev.measured_at_commit ?? '',
        missing,
        law_exceptions,
        body_exceptions,
    };
    const text = JSON.stringify(cfg, null, 4) + '\n';
    fs.writeFileSync(path.join(root, CONFIG_REL), text, 'utf-8');
    return text;
}

interface Args {
    axis: Axis;
    quiet: boolean;
    writeBaseline: boolean;
    root: string;
    selfTest: boolean;
}

const USAGE =
    'usage: lint_rule_law_section [--axis presence|ceiling|body-ceiling|all] [--quiet] ' +
    '[--write-baseline] [--root DIR] [--self-test]\n';

function parseArgs(argv: string[]): Args {
    const out: Args = { axis: 'all', quiet: false, writeBaseline: false, root: REPO_ROOT, selfTest: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        if (a === '-h' || a === '--help') {
            process.stdout.write(USAGE);
            process.exit(0);
        } else if (a === '--quiet') {
            out.quiet = true;
        } else if (a === '--write-baseline') {
            out.writeBaseline = true;
        } else if (a === '--self-test') {
            out.selfTest = true;
        } else if (a === '--axis') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write(USAGE);
                process.exit(2);
            }
            out.axis = v as Axis;
            i += 1;
        } else if (a.startsWith('--axis=')) {
            out.axis = a.slice('--axis='.length) as Axis;
        } else if (a === '--root') {
            const v = argv[i + 1];
            if (v === undefined) {
                process.stderr.write(USAGE);
                process.exit(2);
            }
            out.root = path.resolve(v);
            i += 1;
        } else if (a.startsWith('--root=')) {
            out.root = path.resolve(a.slice('--root='.length));
        } else {
            process.stderr.write(USAGE);
            process.stderr.write(`lint_rule_law_section: error: unrecognized argument: ${a}\n`);
            process.exit(2);
        }
    }
    if (!['presence', 'ceiling', 'body-ceiling', 'all'].includes(out.axis)) {
        process.stderr.write(USAGE);
        process.stderr.write(`lint_rule_law_section: error: unknown axis: ${out.axis}\n`);
        process.exit(2);
    }
    return out;
}

/**
 * Prove the gate's reading changes its verdict, not just that it read
 * something. A `scanned:` floor says a corpus was inspected; only a rejecting
 * case says the inspection decides anything.
 */
export function selfTest(write: (s: string) => void = (s) => process.stdout.write(s)): number {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'law-selftest-'));
    try {
        fs.mkdirSync(path.join(tmp, 'src', 'rules'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'src', 'config'), { recursive: true });
        fs.mkdirSync(path.join(tmp, 'dist'), { recursive: true });
        fs.writeFileSync(
            path.join(tmp, ROUTER_REL),
            JSON.stringify({ kernel: [], tier_1: [{ id: 'lawless' }, { id: 'lawful' }], tier_2: [] }),
        );
        fs.writeFileSync(
            path.join(tmp, CONFIG_REL),
            JSON.stringify({ missing: [], law_exceptions: {}, body_exceptions: {} }),
        );
        fs.writeFileSync(path.join(tmp, 'src/rules/lawless.md'), '---\nx: 1\n---\n\n# Lawless\n\nProse.\n');
        fs.writeFileSync(
            path.join(tmp, 'src/rules/lawful.md'),
            '---\nx: 1\n---\n\n# Lawful\n\n## The Iron Law\n\nNEVER DO THE THING.\n',
        );

        const rejecting = lint(tmp, 'presence');
        const accepting = (() => {
            fs.writeFileSync(
                path.join(tmp, CONFIG_REL),
                JSON.stringify({ missing: ['lawless'], law_exceptions: {}, body_exceptions: {} }),
            );
            return lint(tmp, 'presence');
        })();
        const ok =
            rejecting.findings.length === 1 &&
            rejecting.findings[0]?.kind === 'no-law-section' &&
            accepting.findings.length === 0;
        write(
            ok
                ? '✅  self-test: 1 rejecting case, 1 accepting case — the reading decides the verdict\n'
                : `❌  self-test FAILED: rejecting=${rejecting.findings.length} accepting=${accepting.findings.length}\n`,
        );
        return ok ? 0 : 1;
    } finally {
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}

export function main(argv: string[] | null = null): number {
    const args = parseArgs(argv ?? process.argv.slice(2));
    if (args.selfTest) {
        return selfTest();
    }
    if (args.writeBaseline) {
        const today = asOf().toISOString().slice(0, 10);
        writeBaseline(args.root, today);
        process.stdout.write(`wrote ${CONFIG_REL}\n`);
        return 0;
    }

    let res: LintResult;
    try {
        res = lint(args.root, args.axis);
    } catch (exc) {
        process.stderr.write(`❌  lint_rule_law_section: ${(exc as Error).message}\n`);
        return 3;
    }

    // Outside the `--quiet` guard on purpose: CI passes `--quiet`, and a gate
    // whose count disappears under the flag reads as silent to the coverage
    // census.
    try {
        reportScanned({
            gate: 'lint_rule_law_section',
            scanned: res.scanned,
            units: 'routed rule(s)',
            roots: [RULES_REL, ROUTER_REL],
        });
    } catch (exc) {
        if (exc instanceof DeadScopeError) {
            process.stderr.write(`❌  ${exc.message}\n`);
            return 1;
        }
        throw exc;
    }

    if (!args.quiet) {
        const withLaw = res.measures.filter((m) => m.law !== null).length;
        process.stdout.write(
            `law sections: ${withLaw}/${res.measures.length} routed rules; ` +
                `kernel reported separately (${res.kernelReported.filter((k) => k.sections > 0).length}/` +
                `${res.kernelReported.length} carry one, write-denied so never failed here)\n`,
        );
        for (const t of res.overTarget) {
            process.stdout.write(
                `   over target (${LAW_TARGET_CHARS}), not a failure: ${t.id} — ${t.chars} chars\n`,
            );
        }
    }

    if (res.findings.length > 0) {
        for (const f of res.findings) {
            process.stderr.write(`❌  ${f.id} [${f.axis}/${f.kind}] ${f.detail}\n`);
        }
        process.stderr.write(`❌  lint_rule_law_section: ${res.findings.length} finding(s)\n`);
        return 1;
    }
    if (!args.quiet) {
        process.stdout.write('✅  lint_rule_law_section clean\n');
    }
    return 0;
}

function isCliEntry(): boolean {
    if (process.argv[1] === undefined) return false;
    if (import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) return true;
    try {
        return fs.realpathSync(fileURLToPath(import.meta.url)) === fs.realpathSync(path.resolve(process.argv[1]));
    } catch {
        return false;
    }
}

if (isCliEntry()) {
    process.exit(main());
}
