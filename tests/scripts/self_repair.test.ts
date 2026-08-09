// Tests for the self-repair loop (src/scripts/_lib/self_repair.ts,
// _lib/self_repair_store.ts, self_repair_hook.ts, self_repair_cli.ts).
//
// The detectors, the fingerprint, the egress routing and the release plan are
// pure, so they are driven directly. The hook is driven through its stdin
// envelope against a tmp workspace — no host, no transcript, no network.
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeEach, afterEach, describe, expect, it } from 'vitest';

import {
    chooseEgressRoute,
    type DefectRecord,
    detectCouncilClaim,
    detectLanguageMirror,
    detectUserReport,
    egressBlockedReason,
    fingerprint,
    mergeRecord,
    renderReport,
    runDetectors,
    sanitizeEvidence,
    type TurnSnapshot,
} from '../../src/scripts/_lib/self_repair.js';
import {
    listRecords,
    markReleased,
    openRecords,
    readRecord,
    recordEgressAttempts,
    upsertFinding,
} from '../../src/scripts/_lib/self_repair_store.js';
import { buildQueueLine, readTurn } from '../../src/scripts/self_repair_hook.js';
import {
    type Exec,
    type Probe,
    type RunResult,
    SELF_REPAIR_FORM_REL,
    SELF_REPAIR_LABEL,
    capabilityOf,
    performEgress,
    planRelease,
    probePushRights,
    titleFor,
} from '../../src/scripts/self_repair_cli.js';
import * as YAML from 'yaml';

const NOW = '2026-08-08T10:00:00.000Z';
const LATER = '2026-08-08T11:00:00.000Z';

function turn(partial: Partial<TurnSnapshot>): TurnSnapshot {
    return { prompt: '', reply: '', toolCommands: [], pinnedLanguage: null, ...partial };
}

function mkTmp(): string {
    return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'selfrepair-')));
}

describe('self-repair — user-report intake', () => {
    it.each([
        'du hast die Regel komplett ignoriert',
        'Du hast das falsch gemacht',
        'der agent hat nicht richtig gearbeitet',
        'you ignored the rule again',
        "that's wrong",
    ])('fires on a complaint: %s', (prompt) => {
        expect(detectUserReport(prompt)?.defect_class).toBe('user-reported');
    });

    it.each([
        'du hast recht, das passt',
        'the test is wrong because the fixture is stale',
        'fix the failing lint rule',
        'kannst du das nochmal prüfen?',
    ])('stays silent on non-complaints: %s', (prompt) => {
        expect(detectUserReport(prompt)).toBeNull();
    });

    it('marks the record as user-reported, not self-detected', () => {
        const f = detectUserReport('du hast die Sprache ignoriert')!;
        expect(f.source).toBe('user-reported');
    });
});

describe('self-repair — council-availability detector', () => {
    it('fires when the claim is made without consulting the resolver', () => {
        const f = detectCouncilClaim(
            turn({ reply: 'Kein Council konfiguriert — ich nutze Subagenten.' }),
        );
        expect(f?.defect_class).toBe('council-availability-claim');
        expect(f?.source).toBe('self-detected');
    });

    it('stays silent when the resolver WAS consulted — reporting its answer is correct', () => {
        const f = detectCouncilClaim(
            turn({
                reply: 'Kein Council konfiguriert — der Resolver meldet keine Member.',
                toolCommands: ['Bash agent-config council:estimate probe.md --input-mode prompt'],
            }),
        );
        expect(f).toBeNull();
    });

    it('accepts the purpose-built council:status verb as the probe', () => {
        expect(
            detectCouncilClaim(
                turn({
                    reply: 'Kein Council konfiguriert — der Resolver meldet NOT CONFIGURED.',
                    toolCommands: ['Bash agent-config council:status'],
                }),
            ),
        ).toBeNull();
    });

    it('stays silent on a reply that merely discusses the council', () => {
        expect(
            detectCouncilClaim(turn({ reply: 'Der Council hat zwei Member und lief sauber durch.' })),
        ).toBeNull();
    });
});

describe('self-repair — language-mirror detector', () => {
    it('fires when a de-pinned turn opens in English', () => {
        const f = detectLanguageMirror(
            turn({
                pinnedLanguage: 'de',
                reply: 'I have looked at the failing test and there are two things that you can do here.',
            }),
        );
        expect(f?.defect_class).toBe('language-mirror');
    });

    it('stays silent when the opening is in the pinned language', () => {
        expect(
            detectLanguageMirror(
                turn({
                    pinnedLanguage: 'de',
                    reply: 'Ich habe den fehlschlagenden Test geprüft und es sind zwei Dinge, die Du tun kannst.',
                }),
            ),
        ).toBeNull();
    });

    it('stays silent without a pin — nothing to compare against', () => {
        expect(
            detectLanguageMirror(turn({ reply: 'I have looked at the failing test and the config.' })),
        ).toBeNull();
    });

    it('ignores code fences, so an English identifier block is not a violation', () => {
        expect(
            detectLanguageMirror(
                turn({
                    pinnedLanguage: 'de',
                    reply: 'Ich habe das geprüft:\n```\nthe quick brown fox is not there and you have that\n```\n',
                }),
            ),
        ).toBeNull();
    });

    it('stays silent on a short opening — too little signal to judge', () => {
        expect(detectLanguageMirror(turn({ pinnedLanguage: 'de', reply: 'Done.' }))).toBeNull();
    });
});

describe('self-repair — evidence hygiene and the privacy gate', () => {
    it('strips home paths and emails at capture', () => {
        const s = sanitizeEvidence('failed at /Users/someone/projects/x for a@b.de');
        expect(s).not.toContain('someone');
        expect(s).not.toContain('a@b.de');
        expect(s).toContain('<home>');
    });

    it('caps the evidence length', () => {
        expect(sanitizeEvidence('x'.repeat(500)).length).toBeLessThanOrEqual(160);
    });

    it('refuses egress when the privacy floor rejects the record', () => {
        const rec: DefectRecord = {
            defect_class: 'user-reported',
            source: 'user-reported',
            evidence: 'contact me at real.person@example-corp.de',
            suggested_surface: 'x',
            fingerprint: 'abc',
            first_seen: NOW,
            last_seen: NOW,
            occurrences: 1,
            status: 'open',
        };
        expect(egressBlockedReason(rec, null)).not.toBeNull();
    });

    it('clears a record whose evidence carries nothing sensitive', () => {
        const rec: DefectRecord = {
            defect_class: 'council-availability-claim',
            source: 'self-detected',
            evidence: 'Kein Council konfiguriert',
            suggested_surface: 'see the council-availability rule',
            fingerprint: 'abc',
            first_seen: NOW,
            last_seen: NOW,
            occurrences: 1,
            status: 'open',
        };
        expect(egressBlockedReason(rec, null)).toBeNull();
    });
});

describe('self-repair — record identity', () => {
    it('folds two spellings of the same defect into one fingerprint', () => {
        const a = fingerprint('council-availability-claim', 'Kein Council konfiguriert (3 Member)');
        const b = fingerprint('council-availability-claim', 'Kein Council konfiguriert (7 Member)');
        expect(a).toBe(b);
    });

    it('separates different classes carrying the same words', () => {
        expect(fingerprint('user-reported', 'same text')).not.toBe(
            fingerprint('language-mirror', 'same text'),
        );
    });

    it('increments instead of duplicating on a repeat', () => {
        const f = detectUserReport('du hast das falsch gemacht')!;
        const first = mergeRecord(null, f, NOW);
        const second = mergeRecord(first, f, LATER);
        expect(second.occurrences).toBe(2);
        expect(second.first_seen).toBe(NOW);
        expect(second.last_seen).toBe(LATER);
    });

    it('reopens a released record when the defect recurs', () => {
        const f = detectUserReport('du hast das falsch gemacht')!;
        const released: DefectRecord = { ...mergeRecord(null, f, NOW), status: 'released' };
        expect(mergeRecord(released, f, LATER).status).toBe('open');
    });
});

describe('self-repair — egress routing', () => {
    // The five-state route matrix P4.1 requires. The row that did not exist
    // before is `fork-only`: the old capability carried `canPush: boolean`
    // computed from remote EXISTENCE, so every consumer who cloned the public
    // repo scored `true`, routed to `pull-request`, and died at `git push`.
    it('opens a PR when the fix can be authored and pushed upstream', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                pushRights: 'upstream',
            }),
        ).toBe('pull-request');
    });

    it('opens a fork PR when the repo is forkable but not writable — the consumer path', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                pushRights: 'fork-only',
            }),
        ).toBe('fork-pull-request');
    });

    it('falls back to an issue when no checkout exists', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: false,
                ghAuthenticated: true,
                pushRights: 'fork-only',
            }),
        ).toBe('issue');
    });

    it('falls back to an issue when authenticated but nothing can be pushed', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                pushRights: 'none',
            }),
        ).toBe('issue');
    });

    it('stays local when nothing can reach GitHub', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: false,
                pushRights: 'upstream',
            }),
        ).toBe('local-only');
    });

    it('renders a deterministic report that names route and occurrences', () => {
        const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        const a = renderReport(rec, 'issue');
        expect(a).toBe(renderReport(rec, 'issue'));
        expect(a).toContain('user-reported');
        expect(a).toContain(rec.fingerprint);
    });

    it('a privacy refusal downgrades the plan to local-only even with full capability', () => {
        const rec: DefectRecord = {
            ...mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW),
            evidence: 'reach me at real.person@example-corp.de',
        };
        const plan = planRelease(
            rec,
            { agentConfigCheckout: '/tmp/x', ghAuthenticated: true, pushRights: 'upstream' },
            '/tmp',
        );
        expect(plan.route).toBe('local-only');
        expect(plan.blocked).not.toBeNull();
    });

    it('maps a probe onto the capability shape', () => {
        expect(
            capabilityOf({
                agentConfigCheckout: '/x',
                ghAuthenticated: false,
                pushRights: 'upstream',
            }),
        ).toEqual({
            hasAgentConfigCheckout: true,
            ghAuthenticated: false,
            pushRights: 'upstream',
        });
    });

    it('titles the report by class and occurrence count', () => {
        const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        expect(titleFor(rec)).toContain('user-reported');
    });
});

describe('self-repair — store', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('persists a finding and reads it back as open', () => {
        const f = detectUserReport('du hast das falsch gemacht')!;
        const rec = upsertFinding(tmp, f, NOW);
        expect(openRecords(tmp).map((r) => r.fingerprint)).toEqual([rec.fingerprint]);
    });

    it('keeps one file per fingerprint across repeats', () => {
        const f = detectUserReport('du hast das falsch gemacht')!;
        upsertFinding(tmp, f, NOW);
        const second = upsertFinding(tmp, f, LATER);
        expect(listRecords(tmp)).toHaveLength(1);
        expect(second.occurrences).toBe(2);
    });

    it('drops a released record out of the open set', () => {
        const rec = upsertFinding(tmp, detectUserReport('du hast das falsch gemacht')!, NOW);
        markReleased(tmp, rec.fingerprint, LATER);
        expect(openRecords(tmp)).toHaveLength(0);
        expect(listRecords(tmp)).toHaveLength(1);
    });

    it('returns an empty list for a workspace with no store', () => {
        expect(listRecords(path.join(tmp, 'nope'))).toEqual([]);
    });
});

describe('self-repair — hook', () => {
    let tmp: string;
    beforeEach(() => {
        tmp = mkTmp();
    });
    afterEach(() => {
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('reads the last reply and the tool commands out of a JSONL transcript', () => {
        const tp = path.join(tmp, 't.jsonl');
        fs.writeFileSync(
            tp,
            [
                JSON.stringify({ type: 'user', message: { content: 'los' } }),
                JSON.stringify({
                    type: 'assistant',
                    message: {
                        content: [
                            { type: 'text', text: 'Kein Council konfiguriert.' },
                            { type: 'tool_use', name: 'Bash', input: { command: 'ls -la' } },
                        ],
                    },
                }),
                '',
            ].join('\n'),
            'utf-8',
        );
        const t = readTurn(tp, 'de');
        expect(t.reply).toContain('Kein Council');
        expect(t.toolCommands.some((c) => c.includes('ls -la'))).toBe(true);
        expect(runDetectors(t).map((f) => f.defect_class)).toContain('council-availability-claim');
    });

    it('returns an empty snapshot for a missing transcript instead of throwing', () => {
        expect(readTurn(path.join(tmp, 'absent.jsonl'), 'de').reply).toBe('');
    });

    it('builds a queue line that names the count and points at the store', () => {
        const line = buildQueueLine(3, 'user-reported');
        expect(line).toContain('3 open');
        expect(line).toContain('agents/runtime/self-repair/');
    });
});

// ── P4.1: push-rights probe + the egress ladder ──────────────────────
//
// The ladder is driven through an injected Exec, so no test touches a network,
// a git remote, or the `gh` binary. What is asserted is the property the step
// names: a failure or a timeout on any leg produces an issue attempt WITHIN the
// same invocation, and an exhausted ladder leaves the record open with its
// failed legs attached.

const OK: RunResult = { ok: true, out: 'done', timedOut: false };
const BAD: RunResult = { ok: false, out: 'permission denied', timedOut: false };
const SLOW: RunResult = { ok: false, out: '', timedOut: true };

/** An Exec that answers per matched argv substring, defaulting to OK. */
function execFor(routes: { match: string; result: RunResult }[]): { exec: Exec; calls: string[] } {
    const calls: string[] = [];
    const exec: Exec = (cmd, args) => {
        const line = `${cmd} ${args.join(' ')}`;
        calls.push(line);
        for (const r of routes) {
            if (line.includes(r.match)) return r.result;
        }
        return OK;
    };
    return { exec, calls };
}

const PROBE_UPSTREAM: Probe = {
    agentConfigCheckout: '/tmp/checkout',
    ghAuthenticated: true,
    pushRights: 'upstream',
};

function planFor(route: DefectRecord extends never ? never : Parameters<typeof performEgress>[1]['route']) {
    return { route, blocked: null, title: 'fix(self-repair): x', body: 'BODY' };
}

function aRecord(): DefectRecord {
    return mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
}

describe('probePushRights — rights, not remote existence', () => {
    it('reads upstream write access from the repo permissions', () => {
        const { exec } = execFor([{ match: '.permissions.push', result: { ...OK, out: 'true\n' } }]);
        expect(probePushRights('/tmp/c', 'o/r', exec)).toBe('upstream');
    });

    it('falls to fork-only when push is denied but the repo allows forks', () => {
        const { exec } = execFor([
            { match: '.permissions.push', result: { ...OK, out: 'false\n' } },
            { match: '.allow_forking', result: { ...OK, out: 'true\n' } },
        ]);
        expect(probePushRights('/tmp/c', 'o/r', exec)).toBe('fork-only');
    });

    it('is none when neither push nor forking is available', () => {
        const { exec } = execFor([
            { match: '.permissions.push', result: { ...OK, out: 'false\n' } },
            { match: '.allow_forking', result: { ...OK, out: 'false\n' } },
        ]);
        expect(probePushRights('/tmp/c', 'o/r', exec)).toBe('none');
    });

    it('is none without a checkout, and never calls out', () => {
        const { exec, calls } = execFor([]);
        expect(probePushRights(null, 'o/r', exec)).toBe('none');
        expect(calls).toEqual([]);
    });

    it('is none — not upstream — when the API call itself fails', () => {
        const { exec } = execFor([{ match: 'gh api', result: BAD }]);
        expect(probePushRights('/tmp/c', 'o/r', exec)).toBe('none');
    });
});

describe('performEgress — the ladder degrades inside one invocation', () => {
    it('publishes a PR on the happy path', () => {
        const { exec, calls } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
        ]);
        const out = performEgress(aRecord(), planFor('pull-request'), PROBE_UPSTREAM, 'o/r', exec);
        expect(out.published).toBe(true);
        expect(out.attempts).toEqual([]);
        expect(calls.some((c) => c.startsWith('git push'))).toBe(true);
        expect(calls.some((c) => c.includes('pr create'))).toBe(true);
    });

    it('a failed push attempts an issue in the SAME invocation', () => {
        const { exec, calls } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
            { match: 'git push', result: BAD },
        ]);
        const out = performEgress(aRecord(), planFor('pull-request'), PROBE_UPSTREAM, 'o/r', exec);
        expect(out.published).toBe(true);
        expect(out.attempts).toEqual([{ route: 'pull-request', step: 'push', outcome: 'failed' }]);
        expect(calls.some((c) => c.includes('issue create'))).toBe(true);
    });

    it('a timed-out push is recorded as a timeout, not a plain failure', () => {
        const { exec } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
            { match: 'git push', result: SLOW },
        ]);
        const out = performEgress(aRecord(), planFor('pull-request'), PROBE_UPSTREAM, 'o/r', exec);
        expect(out.attempts[0]).toEqual({
            route: 'pull-request',
            step: 'push',
            outcome: 'timeout',
        });
        expect(out.published).toBe(true);
    });

    it('the fork route forks first and pushes to the fork remote', () => {
        const { exec, calls } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
        ]);
        const out = performEgress(
            aRecord(),
            planFor('fork-pull-request'),
            { ...PROBE_UPSTREAM, pushRights: 'fork-only' },
            'o/r',
            exec,
        );
        expect(out.published).toBe(true);
        expect(calls.some((c) => c.includes('repo fork'))).toBe(true);
        expect(calls.some((c) => c === 'git push -u fork fix/x')).toBe(true);
    });

    it('a failed fork degrades to an issue without attempting a push', () => {
        const { exec, calls } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
            { match: 'repo fork', result: BAD },
        ]);
        const out = performEgress(
            aRecord(),
            planFor('fork-pull-request'),
            { ...PROBE_UPSTREAM, pushRights: 'fork-only' },
            'o/r',
            exec,
        );
        expect(out.attempts[0]?.step).toBe('fork');
        expect(calls.some((c) => c.startsWith('git push'))).toBe(false);
        expect(out.published).toBe(true);
    });

    it('a triple failure publishes nothing and returns every failed leg', () => {
        const { exec } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'fix/x\n' } },
            { match: 'repo fork', result: BAD },
            { match: 'issue create', result: SLOW },
        ]);
        const out = performEgress(
            aRecord(),
            planFor('fork-pull-request'),
            { ...PROBE_UPSTREAM, pushRights: 'fork-only' },
            'o/r',
            exec,
        );
        expect(out.published).toBe(false);
        expect(out.attempts).toEqual([
            { route: 'fork-pull-request', step: 'fork', outcome: 'failed' },
            { route: 'fork-pull-request', step: 'issue', outcome: 'timeout' },
        ]);
    });

    it('local-only publishes nothing and attempts nothing', () => {
        const { exec, calls } = execFor([]);
        const out = performEgress(aRecord(), planFor('local-only'), PROBE_UPSTREAM, 'o/r', exec);
        expect(out.published).toBe(false);
        expect(out.attempts).toEqual([]);
        expect(calls).toEqual([]);
    });

    it('a trunk branch degrades to an issue instead of pushing to main', () => {
        const { exec, calls } = execFor([
            { match: 'branch --show-current', result: { ...OK, out: 'main\n' } },
        ]);
        const out = performEgress(aRecord(), planFor('pull-request'), PROBE_UPSTREAM, 'o/r', exec);
        expect(calls.some((c) => c.startsWith('git push'))).toBe(false);
        expect(out.published).toBe(true);
    });
});

describe('recordEgressAttempts — structured, and never a raw error string', () => {
    let root: string;
    beforeEach(() => {
        root = mkTmp();
    });
    afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

    it('attaches failed legs and leaves the record open', () => {
        const rec = upsertFinding(root, detectUserReport('du hast das falsch gemacht')!, NOW);
        recordEgressAttempts(root, rec.fingerprint, [
            { route: 'pull-request', step: 'push', outcome: 'failed' },
            { route: 'pull-request', step: 'issue', outcome: 'timeout' },
        ]);
        const back = readRecord(root, rec.fingerprint)!;
        expect(back.status).toBe('open');
        expect(back.egress_attempts).toHaveLength(2);
        // The whole point of the shape: no field can carry a path, a URL or a
        // username, so the privacy floor holds by construction.
        const serialised = JSON.stringify(back.egress_attempts);
        expect(serialised).not.toContain('/');
        expect(serialised).not.toContain('permission denied');
    });

    it('a successful release clears earlier failed legs', () => {
        const rec = upsertFinding(root, detectUserReport('du hast das falsch gemacht')!, NOW);
        recordEgressAttempts(root, rec.fingerprint, [
            { route: 'issue', step: 'issue', outcome: 'failed' },
        ]);
        markReleased(root, rec.fingerprint, LATER);
        const back = readRecord(root, rec.fingerprint)!;
        expect(back.status).toBe('released');
        expect(back.egress_attempts).toBeUndefined();
    });
});

// ── P4.2: the structured intake form round-trips the report ──────────

describe('self-repair intake form', () => {
    const formPath = path.join(process.cwd(), SELF_REPAIR_FORM_REL);
    const form = YAML.parse(fs.readFileSync(formPath, 'utf-8')) as {
        labels: string[];
        body: { type: string; id?: string; attributes: Record<string, unknown> }[];
    };
    const fieldIds = form.body.filter((b) => b.id !== undefined).map((b) => b.id as string);

    it('carries the label the CLI sets, so hand-filed and CLI-filed reports cluster', () => {
        expect(form.labels).toContain(SELF_REPAIR_LABEL);
    });

    it('has exactly one field per piece of information the report renders', () => {
        // The round-trip contract: no form field asks for something the record
        // cannot supply, and no rendered fact lacks a field to land in.
        expect(new Set(fieldIds)).toEqual(
            new Set([
                'defect_class',
                'fingerprint',
                'source',
                'occurrences',
                'seen',
                'evidence',
                'suggested_surface',
                'route',
            ]),
        );
    });

    it('every required field has a value in a rendered report', () => {
        const rec: DefectRecord = {
            ...mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW),
            suggested_surface: 'src/rules/council-availability.md — probe never run',
        };
        const report = renderReport(rec, 'issue');
        // Each field maps to a fact that must be recoverable from the report.
        expect(report).toContain(rec.defect_class);
        expect(report).toContain(rec.fingerprint);
        expect(report).toContain('user-reported');
        expect(report).toContain(rec.evidence);
        expect(report).toContain(rec.suggested_surface);
        expect(report).toContain('issue');
        expect(report).toContain(rec.first_seen);
    });

    it('the fingerprint field is required — it is the clustering key', () => {
        const fp = form.body.find((b) => b.id === 'fingerprint');
        expect((fp?.attributes['label'] as string).toLowerCase()).toContain('fingerprint');
        expect((fp as unknown as { validations: { required: boolean } }).validations.required).toBe(
            true,
        );
    });

    it('the route dropdown offers every EgressRoute that can file an issue', () => {
        const route = form.body.find((b) => b.id === 'route');
        const options = route?.attributes['options'] as string[];
        expect(options).toEqual(
            expect.arrayContaining(['issue', 'pull-request', 'fork-pull-request']),
        );
        // `local-only` must NOT be offered: by definition nothing left the machine,
        // so a local-only report cannot exist as an issue.
        expect(options).not.toContain('local-only');
    });
});
