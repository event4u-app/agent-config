/**
 * Executable probe for the provider-qualification exit criterion
 * (road-to-release-review-p0 Phase 3).
 *
 * The roadmap states the criterion as behaviour, not as coverage: *"a
 * deliberately broken seat yields unavailable rather than configured, and a
 * council run against it reports short instead of printing a quorum."* This
 * script asserts exactly that, against the real `build_members` path, with a
 * synthetic roster and an injected environment report — no config file, no
 * network, no provider call, no spend.
 *
 * It exists in addition to the vitest suites rather than instead of them. The
 * unit tests can be green while the wiring is gone: `build_members` evaluates
 * qualification only when a `probe_store` is supplied, so a future refactor
 * that drops the argument at the three production call sites would leave every
 * test passing and the repair silently inert. This probe re-asserts the
 * end-to-end shape the roadmap names, and is the `verify:` annotation its
 * Phase 3 steps point at.
 *
 * Exit 0 = the criterion holds. Exit 1 = it does not, with the failing
 * assertion named. `--quiet` suppresses the per-assertion lines and keeps the
 * verdict, matching the house convention for a script CI may call.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import type { EnvironmentReport } from './_lib/environment_detector.js';
import type { ProbeStore } from './ai_council/probe_store.js';
import type { QuorumResult } from './ai_council/quorum.js';
import { isCountableForQuorum, qualifyMember, type MemberQualification } from './ai_council/qualification.js';
import { build_members } from './council_cli.js';

const QUIET = process.argv.includes('--quiet');

const KEY_VAR = 'COUNCIL_QUALIFICATION_PROBE_KEY';
const TODAY = new Date().toISOString().slice(0, 10);

function _out(line: string): void {
    if (!QUIET) {
        process.stdout.write(`${line}\n`);
    }
}

const failures: string[] = [];

function check(name: string, condition: boolean, detail: string): void {
    if (condition) {
        _out(`  ok    ${name}`);
        return;
    }
    failures.push(`${name} — ${detail}`);
    _out(`  FAIL  ${name} — ${detail}`);
}

/** No hosts, no auth records, no keys — every rung is decided by the roster. */
function emptyReport(): EnvironmentReport {
    return { hosts: [], auth: [], keys: [] };
}

function rosterSettings(): Record<string, unknown> {
    return {
        ai_council: {
            enabled: true,
            mode: 'auto',
            members: {
                // Healthy: resolves through the key rung and has been observed.
                anthropic: { enabled: true, model: 'model-a', api_key_ref: `env:${KEY_VAR}` },
                // Broken: constructs identically, and its last exchange was
                // rejected by the transport. This is the recorded codex shape —
                // a seat that looks configured from every angle a config read
                // can see.
                openai: { enabled: true, model: 'model-b', api_key_ref: `env:${KEY_VAR}` },
            },
        },
    };
}

function storeWith(members: ProbeStore['members']): ProbeStore {
    return { schema: 1, members };
}

export function main(): number {
    _out('council qualification — exit-criterion probe');

    // The roster is only constructible while the key var is set; restore
    // whatever was there so the probe leaves no environment residue.
    const prior = process.env[KEY_VAR];
    process.env[KEY_VAR] = 'sk-probe-key';
    try {
        // ── Criterion 1: a deliberately broken seat yields `unavailable`. ──
        const broken = qualifyMember({
            name: 'broken',
            transport: { available: true, transport: 'api', reason: null, absentReason: null },
            modelId: 'model-b',
            lastProbe: { at: TODAY, outcome: 'model_unservable' },
        });
        check(
            'a seat whose model the transport rejected reports unavailable',
            broken.verdict === 'unavailable',
            `got ${broken.verdict}`,
        );
        check(
            'and it is not countable toward a quorum',
            !isCountableForQuorum(broken.verdict),
            'a seat nothing will answer from was counted present',
        );

        // ── Criterion 1b: "configured" alone never reads as available. ──
        const neverObserved = qualifyMember({
            name: 'never-observed',
            transport: { available: true, transport: 'api', reason: null, absentReason: null },
            modelId: 'model-a',
            lastProbe: null,
        });
        check(
            'a configured, plausible, never-observed seat reports unknown',
            neverObserved.verdict === 'unknown',
            `got ${neverObserved.verdict} — configuration must never read as demonstrated`,
        );

        // ── Criterion 2: the run reports SHORT rather than printing a quorum. ──
        const quorum_out: { result: QuorumResult | null } = { result: null };
        const qualification_out: MemberQualification[] = [];
        build_members(rosterSettings(), {
            environment_report: emptyReport(),
            quorum_out,
            qualification_out,
            probe_store: storeWith({
                anthropic: { at: TODAY, outcome: 'ok' },
                openai: { at: TODAY, outcome: 'model_unservable' },
            }),
        });
        const q = quorum_out.result;
        check('the pre-run quorum was evaluated', q !== null, 'quorum_out.result stayed null');
        if (q !== null) {
            check(
                'the broken seat is withheld from present',
                q.present === 1,
                `present=${String(q.present)}, expected 1 of a 2-seat roster`,
            );
            // The direction check. Shrinking `n` would lower ceil(n/2) and make
            // a short pass EASIER to conclude — the same over-claim in the
            // opposite arithmetic.
            check(
                'the roster is NOT shrunk — total stays 2',
                q.total === 2,
                `total=${String(q.total)}; dropping the seat from n would lower the threshold`,
            );
        }
        check(
            'qualification reached the caller',
            qualification_out.length === 2,
            `qualification_out has ${String(qualification_out.length)} entries — the wiring is inert`,
        );
        const wiredBroken = qualification_out.find((x) => x.name === 'openai');
        check(
            'the broken seat is reported unavailable end-to-end',
            wiredBroken?.verdict === 'unavailable',
            `got ${String(wiredBroken?.verdict)}`,
        );

        // ── Criterion 3: the store is consulted, not assumed. ──
        const ungated: { result: QuorumResult | null } = { result: null };
        build_members(rosterSettings(), { environment_report: emptyReport(), quorum_out: ungated });
        check(
            'omitting the store leaves presence at constructibility only',
            ungated.result?.present === 2,
            `present=${String(ungated.result?.present)} — the default must stay deterministic`,
        );
    } finally {
        if (prior === undefined) {
            delete process.env[KEY_VAR];
        } else {
            process.env[KEY_VAR] = prior;
        }
    }

    if (failures.length > 0) {
        process.stdout.write(
            `council qualification: ❌ ${String(failures.length)} assertion(s) failed\n`,
        );
        for (const f of failures) {
            process.stdout.write(`  - ${f}\n`);
        }
        return 1;
    }
    process.stdout.write('council qualification: ✅ exit criterion holds\n');
    return 0;
}

const _HERE = fileURLToPath(import.meta.url);
function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry() || process.argv[1] === _HERE) {
    process.exit(main());
}
