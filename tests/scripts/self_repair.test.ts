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

import { parse as parseYaml } from 'yaml';

import {
    chooseEgress,
    CREATION_WINDOW_MS,
    DEFECT_CLASSES,
    type DefectFinding,
    type DefectRecord,
    type DefectSource,
    detectCouncilClaim,
    detectLanguageMirror,
    detectUserReport,
    egressBlockedReason,
    fingerprint,
    mergeRecord,
    NEW_RECORDS_PER_SOURCE_PER_WINDOW,
    parseReport,
    renderReport,
    runDetectors,
    sanitizeEvidence,
    type TurnSnapshot,
} from '../../src/scripts/_lib/self_repair.js';
import {
    attachReleaseErrors,
    listRecords,
    markReleased,
    openRecords,
    OVERFLOW_FILE,
    readOverflow,
    STORE_REL,
    upsertFinding,
} from '../../src/scripts/_lib/self_repair_store.js';
import { buildQueueLine, readTurn } from '../../src/scripts/self_repair_hook.js';
import {
    capabilityOf,
    executeRelease,
    planRelease,
    type Probe,
    probeMachine,
    type ReleaseDeps,
    type ReleasePlan,
    type Runner,
    type RunResult,
    titleFor,
} from '../../src/scripts/self_repair_cli.js';

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

    // Recurrence phrasings carry no fault word at all, so before these patterns
    // the SECOND and THIRD report of a defect were silently not records —
    // precisely when the occurrences counter carries the most signal.
    it.each([
        'das habe ich dir jetzt schon dreimal gesagt',
        'ich sage dir das zum dritten mal',
        'wie oft soll ich das noch sagen',
        "I've already told you this",
        'told you this three times',
        'how many times do i have to repeat it',
    ])('fires on a recurrence phrasing: %s', (prompt) => {
        expect(detectUserReport(prompt)?.defect_class).toBe('user-reported');
    });

    // The near-miss half: a bare repetition word must NOT fire, or the detector
    // becomes noise on ordinary prompts and every spurious record is a spurious PR.
    it.each([
        'mach das nochmal',
        'lauf den test wieder',
        'run it again please',
        'schon wieder ein neuer Task',
        'say that again for the docs',
    ])('stays silent on a bare repetition word: %s', (prompt) => {
        expect(detectUserReport(prompt)).toBeNull();
    });

    it('marks the record as user-reported, not self-detected', () => {
        const f = detectUserReport('du hast die Sprache ignoriert')!;
        expect(f.source).toBe('user-reported');
    });

    it('a pleasantry far from the complaint span does not mute it (R2 #2)', () => {
        const f = detectUserReport(
            'Alles gut mit dem Deploy, aber du hast schon wieder die Hälfte der Dateien übersehen!',
        );
        expect(f?.defect_class).toBe('user-reported');
    });

    it('an exoneration overlapping the matched span still silences the intake', () => {
        expect(detectUserReport('du hast nicht zufällig die alte Config noch offen?')).toBeNull();
        expect(detectUserReport("you didn't need to run that, it's fine")).toBeNull();
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

describe('self-repair — egress routing (route matrix)', () => {
    it('upstream-write: direct PR when the probe shows real push rights', () => {
        expect(
            chooseEgress({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                canPushUpstream: true,
                canFork: true,
            }),
        ).toEqual({ route: 'pull-request', pushVia: 'upstream' });
    });

    it('fork-only: PR via fork when authenticated without upstream push', () => {
        expect(
            chooseEgress({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                canPushUpstream: false,
                canFork: true,
            }),
        ).toEqual({ route: 'pull-request', pushVia: 'fork' });
    });

    it('auth-no-push: issue when neither upstream push nor fork is possible', () => {
        expect(
            chooseEgress({
                hasAgentConfigCheckout: true,
                ghAuthenticated: true,
                canPushUpstream: false,
                canFork: false,
            }),
        ).toEqual({ route: 'issue', pushVia: null });
    });

    it('falls back to an issue when no checkout exists — the consumer case', () => {
        expect(
            chooseEgress({
                hasAgentConfigCheckout: false,
                ghAuthenticated: true,
                canPushUpstream: false,
                canFork: true,
            }),
        ).toEqual({ route: 'issue', pushVia: null });
    });

    it('no-auth: stays local when nothing can reach GitHub', () => {
        expect(
            chooseEgress({
                hasAgentConfigCheckout: true,
                ghAuthenticated: false,
                canPushUpstream: true,
                canFork: true,
            }),
        ).toEqual({ route: 'local-only', pushVia: null });
    });

    it('renders a deterministic report that names route and occurrences', () => {
        const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        const a = renderReport(rec, 'issue');
        expect(a).toBe(renderReport(rec, 'issue'));
        expect(a).toContain('user-reported');
        expect(a).toContain(rec.fingerprint);
    });

    it('privacy-refusal: downgrades the plan to local-only even with full capability', () => {
        const rec: DefectRecord = {
            ...mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW),
            evidence: 'reach me at real.person@example-corp.de',
        };
        const plan = planRelease(rec, fullProbe(), '/tmp');
        expect(plan.route).toBe('local-only');
        expect(plan.pushVia).toBeNull();
        expect(plan.blocked).not.toBeNull();
    });

    it('maps a probe onto the capability shape', () => {
        expect(
            capabilityOf({
                agentConfigCheckout: '/x',
                ghAuthenticated: false,
                canPushUpstream: true,
                canFork: false,
            }),
        ).toEqual({
            hasAgentConfigCheckout: true,
            ghAuthenticated: false,
            canPushUpstream: true,
            canFork: false,
        });
    });

    it('titles the report by class and occurrence count', () => {
        const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        expect(titleFor(rec)).toContain('user-reported');
    });
});

// ── egress ladder execution ────────────────────────────────────────

function fullProbe(overrides: Partial<Probe> = {}): Probe {
    return {
        agentConfigCheckout: '/tmp/checkout',
        ghAuthenticated: true,
        canPushUpstream: true,
        canFork: true,
        ...overrides,
    };
}

/** Scripted runner: matches each call against a step table, records the log. */
function scriptedRunner(
    script: (cmd: string, args: string[]) => Partial<RunResult> | undefined,
    log: string[],
): Runner {
    return (cmd, args) => {
        log.push(`${cmd} ${args.join(' ')}`);
        const hit = script(cmd, args) ?? {};
        return { ok: true, out: '', timedOut: false, ...hit };
    };
}

function recAndPlan(probe: Probe): { rec: DefectRecord; plan: ReleasePlan } {
    const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
    return { rec, plan: planRelease(rec, probe, '/tmp') };
}

const okBranch = (cmd: string, args: string[]): Partial<RunResult> | undefined =>
    cmd === 'git' && args[0] === 'branch' ? { out: 'fix/some-defect\n' } : undefined;

describe('self-repair — probe of actual push rights', () => {
    it('reads permissions.push and allow_forking from the repo API, not `git remote`', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            if (cmd === 'gh' && args[0] === 'api') {
                return { out: '{"permissions":{"push":false},"allow_forking":true}' };
            }
            return undefined;
        }, log);
        const probe = probeMachine({}, '/nowhere', runner, 'event4u-app/agent-config');
        expect(probe.canPushUpstream).toBe(false);
        expect(probe.canFork).toBe(true);
        expect(log.some((l) => l.startsWith('gh api repos/event4u-app/agent-config'))).toBe(true);
        expect(log.some((l) => l.startsWith('git remote'))).toBe(false);
    });

    it('answers false for both when the API call fails — degrade, never guess', () => {
        const runner = scriptedRunner((cmd, args) => {
            if (cmd === 'gh' && args[0] === 'api') {
                return { ok: false, out: 'HTTP 404' };
            }
            return undefined;
        }, []);
        const probe = probeMachine({}, '/nowhere', runner, 'x/y');
        expect(probe.canPushUpstream).toBe(false);
        expect(probe.canFork).toBe(false);
    });

    it('skips the rights probe entirely when gh is unauthenticated', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            if (cmd === 'gh' && args[0] === 'auth') {
                return { ok: false, out: 'not logged in' };
            }
            return undefined;
        }, log);
        const probe = probeMachine({}, '/nowhere', runner, 'x/y');
        expect(probe.ghAuthenticated).toBe(false);
        expect(probe.canFork).toBe(false);
        expect(log.some((l) => l.startsWith('gh api'))).toBe(false);
    });
});

describe('self-repair — egress ladder', () => {
    const deps = (runner: Runner): ReleaseDeps => ({ runner, now: () => LATER });

    it('a failed upstream push degrades to an issue attempt in the same invocation', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            const b = okBranch(cmd, args);
            if (b) {
                return b;
            }
            if (cmd === 'git' && args[0] === 'push') {
                return { ok: false, out: 'remote: permission denied' };
            }
            if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'fork') {
                return { ok: false, out: 'forking disabled' };
            }
            return undefined;
        }, log);
        const probe = fullProbe({ canFork: true });
        const { rec, plan } = recAndPlan(probe);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBe('issue');
        expect(log.some((l) => l.startsWith('gh issue create'))).toBe(true);
        expect(outcome.attempts.map((a) => a.step)).toEqual(['push-upstream', 'fork-ensure']);
    });

    it('a timed-out push degrades exactly like a failed one', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            const b = okBranch(cmd, args);
            if (b) {
                return b;
            }
            if (cmd === 'git' && args[0] === 'push') {
                return { ok: false, out: '', timedOut: true };
            }
            if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'fork') {
                return { ok: false, out: 'nope' };
            }
            return undefined;
        }, log);
        const probe = fullProbe();
        const { rec, plan } = recAndPlan(probe);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBe('issue');
        expect(outcome.attempts[0]?.detail).toContain('timed out after 30s');
    });

    it('fork-only capability pushes to the fork and opens a cross-repo PR', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            const b = okBranch(cmd, args);
            if (b) {
                return b;
            }
            if (cmd === 'gh' && args[0] === 'api' && args[1] === 'user') {
                return { out: 'consumer-login\n' };
            }
            if (cmd === 'git' && args[0] === 'remote' && args[1] === 'get-url') {
                return { ok: false, out: 'no such remote' };
            }
            return undefined;
        }, log);
        const probe = fullProbe({ canPushUpstream: false });
        const { rec, plan } = recAndPlan(probe);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBe('pull-request');
        expect(log.some((l) => l.startsWith('gh repo fork up/stream'))).toBe(true);
        expect(log.some((l) => l.includes('remote add self-repair-fork'))).toBe(true);
        expect(log.some((l) => l.startsWith('git push -u self-repair-fork'))).toBe(true);
        expect(log.some((l) => l.includes('--head consumer-login:fix/some-defect'))).toBe(true);
    });

    it('a triple failure (push → fork → issue) leaves all three errors recorded', () => {
        const tmp = mkTmp();
        const rec = upsertFinding(tmp, detectUserReport('du hast das falsch gemacht')!, NOW)!;
        const runner = scriptedRunner((cmd, args) => {
            const b = okBranch(cmd, args);
            if (b) {
                return b;
            }
            if (cmd === 'git' && args[0] === 'push') {
                return { ok: false, out: 'permission denied' };
            }
            if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'fork') {
                return { ok: false, out: 'forking disabled' };
            }
            if (cmd === 'gh' && args[0] === 'issue') {
                return { ok: false, out: 'API rate limit' };
            }
            return undefined;
        }, []);
        const probe = fullProbe();
        const plan = planRelease(rec, probe, tmp);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBeNull();
        expect(outcome.attempts).toHaveLength(3);
        expect(outcome.attempts.map((a) => a.step)).toEqual([
            'push-upstream',
            'fork-ensure',
            'issue-create',
        ]);

        const stored = attachReleaseErrors(
            tmp,
            rec.fingerprint,
            outcome.attempts.map((a) => sanitizeEvidence(a.detail)),
            LATER,
        );
        expect(stored?.status).toBe('open');
        expect(stored?.release_errors).toHaveLength(3);
        fs.rmSync(tmp, { recursive: true, force: true });
    });

    it('a degraded issue carries a body rendered for the issue route, not the planned one (R2 #4)', () => {
        const log: string[] = [];
        const runner = scriptedRunner((cmd, args) => {
            const b = okBranch(cmd, args);
            if (b) {
                return b;
            }
            if (cmd === 'git' && args[0] === 'push') {
                return { ok: false, out: 'permission denied' };
            }
            if (cmd === 'gh' && args[0] === 'repo' && args[1] === 'fork') {
                return { ok: false, out: 'forking disabled' };
            }
            return undefined;
        }, log);
        const probe = fullProbe();
        const { rec, plan } = recAndPlan(probe);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBe('issue');
        const issueCall = log.find((l) => l.startsWith('gh issue create'))!;
        expect(issueCall).toContain('**Route:** issue');
        expect(issueCall).not.toContain('**Route:** pull-request');
    });

    it('a branch-check failure is a precondition stop, not a silent issue downgrade', () => {
        const runner = scriptedRunner((cmd, args) => {
            if (cmd === 'git' && args[0] === 'branch') {
                return { out: 'main\n' };
            }
            return undefined;
        }, []);
        const probe = fullProbe();
        const { rec, plan } = recAndPlan(probe);
        const outcome = executeRelease(rec, plan, probe, 'up/stream', deps(runner));
        expect(outcome.published).toBeNull();
        expect(outcome.attempts.map((a) => a.step)).toEqual(['branch-check']);
    });

    it('a successful release clears earlier attached errors', () => {
        const tmp = mkTmp();
        const rec = upsertFinding(tmp, detectUserReport('du hast das falsch gemacht')!, NOW)!;
        attachReleaseErrors(tmp, rec.fingerprint, ['push-upstream: permission denied'], NOW);
        const released = markReleased(tmp, rec.fingerprint, LATER);
        expect(released?.status).toBe('released');
        expect(released?.release_errors).toBeUndefined();
        fs.rmSync(tmp, { recursive: true, force: true });
    });
});

describe('self-repair — structured upstream intake (issue form)', () => {
    const FORM_PATH = path.resolve(process.cwd(), '.github/ISSUE_TEMPLATE/self_repair_report.yml');

    interface FormElement {
        type: string;
        id?: string;
        attributes?: { options?: string[] };
    }

    function loadForm(): { labels: string[]; body: FormElement[] } {
        return parseYaml(fs.readFileSync(FORM_PATH, 'utf-8')) as {
            labels: string[];
            body: FormElement[];
        };
    }

    it('renderReport round-trips through the form fields — single occurrence', () => {
        const rec = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        const parsed = parseReport(renderReport(rec, 'issue'));
        expect(parsed).toEqual({
            defect_class: rec.defect_class,
            fingerprint: rec.fingerprint,
            occurrences: 1,
            evidence: rec.evidence,
            suggested_surface: rec.suggested_surface,
        });
    });

    it('renderReport round-trips through the form fields — repeated occurrences', () => {
        const first = mergeRecord(null, detectUserReport('du hast das falsch gemacht')!, NOW);
        const rec = mergeRecord(first, detectUserReport('du hast das falsch gemacht')!, LATER);
        const parsed = parseReport(renderReport(rec, 'pull-request'));
        expect(parsed?.occurrences).toBe(2);
        expect(parsed?.fingerprint).toBe(rec.fingerprint);
    });

    it('the form collects exactly the parsed-report fields', () => {
        const ids = loadForm()
            .body.filter((e) => e.type !== 'markdown')
            .map((e) => e.id);
        const rec = mergeRecord(null, detectUserReport('x you ignored the rule')!, NOW);
        const parsed = parseReport(renderReport(rec, 'issue'))!;
        expect(ids.sort()).toEqual(Object.keys(parsed).sort());
    });

    it('the dropdown options mirror the DefectClass union', () => {
        const dropdown = loadForm().body.find((e) => e.id === 'defect_class');
        expect(dropdown?.attributes?.options).toEqual([...DEFECT_CLASSES]);
    });

    it('the form applies the clustering label', () => {
        expect(loadForm().labels).toContain('self-repair');
    });

    it('parseReport refuses a body that is not a self-repair report', () => {
        expect(parseReport('## Some other issue\n\nfree text')).toBeNull();
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
        const rec = upsertFinding(tmp, f, NOW)!;
        expect(openRecords(tmp).map((r) => r.fingerprint)).toEqual([rec.fingerprint]);
    });

    it('keeps one file per fingerprint across repeats', () => {
        const f = detectUserReport('du hast das falsch gemacht')!;
        upsertFinding(tmp, f, NOW);
        const second = upsertFinding(tmp, f, LATER)!;
        expect(listRecords(tmp)).toHaveLength(1);
        expect(second.occurrences).toBe(2);
    });

    it('drops a released record out of the open set', () => {
        const rec = upsertFinding(tmp, detectUserReport('du hast das falsch gemacht')!, NOW)!;
        markReleased(tmp, rec.fingerprint, LATER);
        expect(openRecords(tmp)).toHaveLength(0);
        expect(listRecords(tmp)).toHaveLength(1);
    });

    it('returns an empty list for a workspace with no store', () => {
        expect(listRecords(path.join(tmp, 'nope'))).toEqual([]);
    });

    // The cap bounds CREATION. Note what `fingerprint` already folds: it hashes
    // a SHAPE (digits → `#`, quotes and punctuation stripped, case-folded), so
    // spans differing only in numbers or punctuation are one record and never
    // reach the cap at all. Distinct records need distinct WORDS, which is what
    // this generator varies — a version keyed on a counter produced exactly one
    // record for twenty findings, and the cap it was written to exercise never
    // fired. Letters only, since the shape pass drops everything else.
    function distinctFinding(n: number, source: DefectSource = 'user-reported'): DefectFinding {
        const word =
            String.fromCharCode(97 + Math.floor(n / 26)) + String.fromCharCode(97 + (n % 26));
        return {
            defect_class: source === 'user-reported' ? 'user-reported' : 'language-mirror',
            source,
            evidence: `distinct evidence span ${word}`,
            suggested_surface: 'some-rule.md',
        };
    }

    it('folds digit-only variation into one record, so the cap never sees it', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW + 5; i += 1) {
            upsertFinding(
                tmp,
                {
                    defect_class: 'user-reported',
                    source: 'user-reported',
                    evidence: `the same complaint, attempt ${i}`,
                    suggested_surface: 'some-rule.md',
                },
                NOW,
            );
        }
        expect(listRecords(tmp)).toHaveLength(1);
        expect(listRecords(tmp)[0]!.occurrences).toBe(NEW_RECORDS_PER_SOURCE_PER_WINDOW + 5);
        expect(readOverflow(tmp)['user-reported']).toBeUndefined();
    });

    it('opens records up to the cap and refuses the one past it', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW; i += 1) {
            expect(upsertFinding(tmp, distinctFinding(i), NOW)).not.toBeNull();
        }
        expect(listRecords(tmp)).toHaveLength(NEW_RECORDS_PER_SOURCE_PER_WINDOW);
        expect(upsertFinding(tmp, distinctFinding(600), NOW)).toBeNull();
        expect(listRecords(tmp)).toHaveLength(NEW_RECORDS_PER_SOURCE_PER_WINDOW);
    });

    it('counts every refusal per source instead of dropping it silently', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW + 3; i += 1) {
            upsertFinding(tmp, distinctFinding(i), NOW);
        }
        expect(readOverflow(tmp)['user-reported']?.dropped).toBe(3);
        expect(readOverflow(tmp)['user-reported']?.last_seen).toBe(NOW);
        expect(readOverflow(tmp)['self-detected']).toBeUndefined();
    });

    it('never caps a fold — an existing fingerprint still increments past the cap', () => {
        const first = upsertFinding(tmp, distinctFinding(0), NOW)!;
        for (let i = 1; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW + 5; i += 1) {
            upsertFinding(tmp, distinctFinding(i), NOW);
        }
        const folded = upsertFinding(tmp, distinctFinding(0), LATER);
        expect(folded).not.toBeNull();
        expect(folded!.fingerprint).toBe(first.fingerprint);
        expect(folded!.occurrences).toBe(2);
    });

    it('budgets each source separately, so one runaway cannot starve the other', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW + 2; i += 1) {
            upsertFinding(tmp, distinctFinding(i), NOW);
        }
        expect(upsertFinding(tmp, distinctFinding(0, 'self-detected'), NOW)).not.toBeNull();
    });

    it('lets the budget recover once the window has passed', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW; i += 1) {
            upsertFinding(tmp, distinctFinding(i), NOW);
        }
        expect(upsertFinding(tmp, distinctFinding(600), NOW)).toBeNull();
        const afterWindow = new Date(Date.parse(NOW) + CREATION_WINDOW_MS + 1000).toISOString();
        expect(upsertFinding(tmp, distinctFinding(600), afterWindow)).not.toBeNull();
    });

    it('keeps the overflow counter out of the record list', () => {
        for (let i = 0; i < NEW_RECORDS_PER_SOURCE_PER_WINDOW + 1; i += 1) {
            upsertFinding(tmp, distinctFinding(i), NOW);
        }
        expect(fs.existsSync(path.join(tmp, STORE_REL, OVERFLOW_FILE))).toBe(true);
        expect(listRecords(tmp).every((r) => typeof r.fingerprint === 'string')).toBe(true);
        expect(listRecords(tmp)).toHaveLength(NEW_RECORDS_PER_SOURCE_PER_WINDOW);
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

    // The store has always counted repeats; the line never carried the number,
    // so a recurring defect was indistinguishable from a first sighting.
    it('surfaces the recurrence count and routes it once the record repeats', () => {
        const line = buildQueueLine(1, 'user-reported', 3);
        expect(line).toContain('recurred 3 time(s)');
        expect(line).toContain('decision-revisit-gate');
        expect(line).toContain('never on the repetition count');
    });

    it('says nothing about recurrence on a first sighting', () => {
        for (const line of [buildQueueLine(2, 'user-reported'), buildQueueLine(2, 'user-reported', 1)]) {
            expect(line).not.toContain('recurred');
            expect(line).toContain('2 open');
        }
    });
});
