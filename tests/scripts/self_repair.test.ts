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
    upsertFinding,
} from '../../src/scripts/_lib/self_repair_store.js';
import { buildQueueLine, readTurn } from '../../src/scripts/self_repair_hook.js';
import { capabilityOf, planRelease, titleFor } from '../../src/scripts/self_repair_cli.js';

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
    it('opens a PR when the fix can be authored and pushed', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                canPush: true,
            }),
        ).toBe('pull-request');
    });

    it('falls back to an issue when no checkout exists — the consumer case', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: false,
                ghAuthenticated: true,
                canPush: false,
            }),
        ).toBe('issue');
    });

    it('falls back to an issue when the checkout cannot push', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                canPush: false,
            }),
        ).toBe('issue');
    });

    it('stays local when nothing can reach GitHub', () => {
        expect(
            chooseEgressRoute({
                hasAgentConfigCheckout: true,
                ghAuthenticated: false,
                canPush: true,
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
            { agentConfigCheckout: '/tmp/x', ghAuthenticated: true, canPush: true },
            '/tmp',
        );
        expect(plan.route).toBe('local-only');
        expect(plan.blocked).not.toBeNull();
    });

    it('maps a probe onto the capability shape', () => {
        expect(
            capabilityOf({ agentConfigCheckout: '/x', ghAuthenticated: false, canPush: true }),
        ).toEqual({ hasAgentConfigCheckout: true, ghAuthenticated: false, canPush: true });
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
