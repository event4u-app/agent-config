/**
 * Retro composition — facts → triage → at most one durable learning per unit
 * (`docs/contracts/retro-v1.md`).
 *
 * The synthesis itself is the agent's; this module is the part that must not
 * depend on it. It triages from facts with the pre-registered start values,
 * applies the durability test to whatever candidate the synthesis produced,
 * routes the survivor to exactly one target from the closed vocabulary, and
 * turns it into intake signals whose origin is the unit key — so two PRs with
 * one learning corroborate each other and two hosts examining one PR do not.
 *
 * Triage start values are a pre-registered hypothesis. They change only by a
 * documented contract revision, never by editing a constant here.
 */

import { createHash } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
    LESSONS_NAME,
    SIDECAR_NAME,
    buildSidecar,
    renderLessonsMd,
    type Sidecar,
    type Signal,
} from './learning_sidecar.js';
import { _scan } from './injection_scan_hook.js';
import { _assert_project_writable } from './memory_signal.js';
import { derive_session_tag } from './_lib/session_tag.js';
import { liveGit, readPrFacts, readSessionFacts, type PrFacts, type SessionFacts } from './retro_facts.js';
import { liveForgeApi, originUrl, resolveForgeRepo, type ForgeApi } from './_lib/forge_reader.js';
import {
    enqueueMerged,
    listSessionPointers,
    localDay,
    markRetroSession,
    pendingUnits,
    recordDisposition,
} from './retro_queue.js';
import { discoverSessions, forgePrState, renderStatus, retroStatus, runDailySweep } from './retro_sweep.js';
import {
    MAX_INTAKE_SIGNALS_PER_UNIT,
    TARGETS,
    triagePr,
    triageSession,
    unitKey,
    unitOrigin,
    type Target,
    type Triage,
} from './retro_triage.js';

export * from './retro_triage.js';
export * from './retro_sweep.js';
import {
    ACTIVE_STATUSES,
    PRINCIPLE_RE,
    sanitizeEvidence,
    type DefectFinding,
    type DefectRecord,
} from './_lib/self_repair.js';
import { listRecords, setStatus, targetCounts, upsertFinding } from './_lib/self_repair_store.js';

/** What the synthesis step proposes for one unit. */
export interface Candidate {
    learning: string;
    target: Target;
    /** Where the learning can already be read; non-null fails the durability test. */
    derivable_from: 'diff' | 'code' | 'tests' | 'docs' | null;
    /** Would the mistake recur without a note? `false` fails the durability test. */
    would_recur: boolean;
    counter_hypothesis: string;
    falsifier: string;
    /**
     * The canonical claim, short and stable (`drain/baseline-drift`). Two
     * syntheses that agree on the claim must produce the same string; it is
     * what corroborates, the wording of `learning` is not.
     */
    subject: string;
    /** A self-repair target (`rule:<id>` …) whose earlier record count this reports. */
    asset_target?: string;
}

export interface RetroOutput {
    unit_key: string;
    facts: PrFacts | SessionFacts;
    triage: Triage;
    learning: string | null;
    target: Target;
    reason: string;
    subject: string | null;
    counter_hypothesis: string | null;
    falsifier: string | null;
    /** Earlier records naming the same asset target — the held/recurred reading. */
    recurrence: Recurrence | null;
}

/**
 * Whether an earlier learning on this target HELD.
 *
 * `first` — nothing earlier named it, so there is nothing to have held.
 * `held` — every record naming it reached a terminal status and none is back
 *   in the queue. The fix landed and the defect has not returned.
 * `recurred` — at least one record naming it is active again. Either it was
 *   never closed, or something reopened it ({@link reopenOnRevert} can, when
 *   called — see its note on what does not call it yet).
 *
 * The verdict is read from record STATUS, never from the occurrence count:
 * occurrences accumulate across a record's whole life, so a high count on a
 * closed record says the defect was frequent before the fix, not that the fix
 * failed. Reading volume as recurrence is the mistake Phase 5 exists to avoid.
 */
export type RecurrenceVerdict = 'first' | 'held' | 'recurred';

export interface Recurrence {
    target: string;
    occurrences: number;
    records: number;
    verdict: RecurrenceVerdict;
    /** Fingerprints that are active again — empty unless the verdict is `recurred`. */
    active: string[];
}

export interface ComposeInput {
    key: string;
    facts: PrFacts | SessionFacts;
    candidate: Candidate | null;
    /** Workspace whose self-repair store holds the recurrence counts. */
    root: string;
}

function none(base: Omit<RetroOutput, 'learning' | 'target' | 'reason' | 'subject' | 'counter_hypothesis' | 'falsifier' | 'recurrence'>, reason: string): RetroOutput {
    return {
        ...base,
        learning: null,
        target: 'none',
        reason,
        subject: null,
        counter_hypothesis: null,
        falsifier: null,
        recurrence: null,
    };
}

export function composeRetro(input: ComposeInput): RetroOutput {
    const { key, facts, candidate, root } = input;
    const triage = facts.unit === 'pr' ? triagePr(facts) : triageSession(facts);
    const base = { unit_key: key, facts, triage };
    if (triage.class !== 'analyse') return none(base, `triage ${triage.class} (score ${triage.score})`);
    if (candidate === null) return none(base, 'the synthesis found no learning');
    if (!(TARGETS as readonly string[]).includes(candidate.target)) {
        throw new Error(`composeRetro: target "${candidate.target}" is outside the closed vocabulary`);
    }
    if (candidate.target === 'none') return none(base, 'the synthesis routed the learning to none');
    if (candidate.derivable_from !== null) {
        return none(base, `durability: derivable from the ${candidate.derivable_from}`);
    }
    if (!candidate.would_recur) return none(base, 'durability: would not recur without a note');

    let recurrence: RetroOutput['recurrence'] = null;
    if (candidate.asset_target !== undefined) {
        recurrence = readRecurrence(root, candidate.asset_target);
    }
    return {
        ...base,
        learning: candidate.learning,
        target: candidate.target,
        reason: 'durable: not derivable from code, tests or docs, and would recur',
        subject: candidate.subject,
        counter_hypothesis: candidate.counter_hypothesis,
        falsifier: candidate.falsifier,
        recurrence,
    };
}

/**
 * The held/recurred reading for one asset target.
 *
 * Exported because `/retro status` and the per-unit output both need it and
 * neither should re-derive the rule — two readings of "did it hold" is the
 * same defect class as two readings of "what is the brand".
 */
export function readRecurrence(root: string, target: string): Recurrence {
    const hit = targetCounts(root).find((t) => t.target === target);
    const active = listRecords(root)
        .filter((r) => (r.target ?? []).includes(target) && ACTIVE_STATUSES.includes(r.status))
        .map((r) => r.fingerprint)
        .sort();
    const records = hit?.records.length ?? 0;
    const verdict: RecurrenceVerdict =
        records === 0 ? 'first' : active.length > 0 ? 'recurred' : 'held';
    return { target, occurrences: hit?.occurrences ?? 0, records, verdict, active };
}

/**
 * A revert of a landed fix reopens its record.
 *
 * A fix that was reverted is not a fix, and leaving its record `actioned`
 * would let the next retro report `held` about a defect that is live again.
 * This is the one place a retro writes a STATUS rather than a proposal: it
 * restores a record the tree's own history contradicts, and it never closes,
 * declines or supersedes one.
 *
 * Returns the fingerprints it reopened, sorted. A no-op when the facts carry no
 * measured revert — `missing` is not `false`, so an unread revert fact reopens
 * nothing rather than guessing in either direction.
 *
 * Not yet wired: neither `composeRetro`, `recordRetro` nor `main` calls it, so
 * today a reverted fix stays `actioned` and `readRecurrence` can still say
 * `held`. Wiring needs the reverted fix's own target, which the PR facts do not
 * carry; the candidate's `asset_target` names the new learning's target.
 */
export function reopenOnRevert(
    root: string,
    facts: PrFacts | SessionFacts,
    target: string,
    now: string,
): string[] {
    if (facts.unit !== 'pr') return [];
    const revert = facts.later_revert;
    if (revert.status !== 'measured' || revert.value !== true) return [];
    const reopened: string[] = [];
    for (const rec of listRecords(root)) {
        if (!(rec.target ?? []).includes(target)) continue;
        if (rec.status !== 'actioned') continue;
        setStatus(root, rec.fingerprint, 'open', now, {
            resolution: `reopened: the landed fix was reverted (${facts.unit} ${facts.pr})`,
        });
        reopened.push(rec.fingerprint);
    }
    return reopened.sort();
}

/**
 * Entry type the retro writes into the intake stream — one of the types the
 * memory reader accepts, so a retro signal is read like any other.
 */
export const RETRO_ENTRY_TYPE = 'historical-patterns';

/**
 * The intake signal for one output: exactly the learning that passed the
 * durability test, origin = {@link unitOrigin}. Only an `intake-signal`
 * learning yields one; every other target is a proposal or a record.
 *
 * The sidecar corroborates claims by body, so the body is the canonical claim
 * (the subject), not the synthesis's wording: two independent retros that
 * agree on the claim must corroborate even when they phrase it differently.
 */
export function intakeSignals(out: RetroOutput, nowIso: string): Signal[] {
    if (out.target !== 'intake-signal' || out.learning === null || out.subject === null) return [];
    const origin = unitOrigin(out.unit_key);
    const body = `retro claim: ${out.subject}`;
    return [
        {
            id: createHash('sha256').update(`${origin}\0${body}`).digest('hex').slice(0, 16),
            ts: nowIso,
            tsMs: Date.parse(nowIso),
            origin,
            entryType: RETRO_ENTRY_TYPE,
            path: out.subject,
            body,
            polarity: 'preferred' as const,
        },
    ].slice(0, MAX_INTAKE_SIGNALS_PER_UNIT);
}

export const INTAKE_REL = path.join('agents', 'memory', 'intake');
export const SIDECAR_OUT_REL = path.join('agents', 'memory');

/**
 * Append the signals to this month's intake file. Gitignored and decaying, so
 * it is written without a question; the project-provenance gate still applies.
 * Returns how many were written.
 */
export function writeIntakeSignals(root: string, signals: readonly Signal[]): number {
    if (signals.length === 0) return 0;
    const dir = path.join(root, INTAKE_REL);
    fs.mkdirSync(dir, { recursive: true });
    const lines: string[] = [];
    for (const s of signals) {
        const record = {
            id: s.id,
            ts: s.ts,
            origin: s.origin,
            entry_type: s.entryType,
            path: s.path,
            body: s.body,
            subject: 'project',
            source: 'retro',
        };
        _assert_project_writable(record);
        lines.push(JSON.stringify(record));
    }
    const month = signals[0]!.ts.slice(0, 7);
    fs.appendFileSync(path.join(dir, `signals-${month}.jsonl`), `${lines.join('\n')}\n`, 'utf-8');
    return lines.length;
}

/**
 * Rebuild the learning sidecar at the end of a retro run. Called by the retro
 * itself, so it does not depend on `memory.learn_on_session_end` — that key
 * stays class B with a conservative default and this never reads it.
 */
export function aggregateSidecar(root: string, nowIso: string): Sidecar {
    const sidecar = buildSidecar(path.join(root, INTAKE_REL), nowIso);
    const out = path.join(root, SIDECAR_OUT_REL);
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, SIDECAR_NAME), `${JSON.stringify(sidecar, null, 2)}\n`);
    fs.writeFileSync(path.join(out, LESSONS_NAME), renderLessonsMd(sidecar));
    return sidecar;
}

// ---------------------------------------------------------------------------
// Proposals and package records — the two targets that are not intake signals
// ---------------------------------------------------------------------------

export const PROPOSALS_REL = path.join('agents', 'proposals');

/** File-name prefix of every retro proposal, so `/memory:propose` can list them. */
export const RETRO_PROPOSAL_PREFIX = 'retro-';

function proposalType(assetTarget: string | undefined): string {
    const kind = assetTarget?.split(':')[0];
    return kind === 'rule' || kind === 'skill' || kind === 'command' ? kind : 'guideline';
}

const slug = (s: string): string =>
    s
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 48) || 'learning';

/**
 * Write an `override-proposal` or `contract-no-go-proposal` as a proposal file
 * at stage `captured`. Nothing is applied: promotion through the proposal gate
 * stays a person's act. Returns the repository-relative path, or `null` when
 * the output is not one of the two proposal targets.
 */
/**
 * True when a synthesised field carries an injection or encoding signal. The
 * synthesis read review comments, so its output is scanned before it is
 * persisted into a file a later session loads as context; a hit writes nothing.
 */
export function carriesInjectionSignal(out: RetroOutput): boolean {
    return [out.subject, out.learning, out.counter_hypothesis, out.falsifier].some((t) => typeof t === 'string' && _scan(t).risk_level !== 'low');
}

export function writeProposal(root: string, out: RetroOutput, candidate: Candidate, nowIso: string): string | null {
    if (out.target !== 'override-proposal' && out.target !== 'contract-no-go-proposal') return null;
    if (out.learning === null || out.subject === null) return null;
    if (carriesInjectionSignal(out)) return null;
    const hash = createHash('sha256').update(`${out.unit_key}\0${out.subject}`).digest('hex').slice(0, 8);
    const id = `${RETRO_PROPOSAL_PREFIX}${slug(out.subject)}-${hash}`;
    const rel = path.join(PROPOSALS_REL, `${id}.md`);
    const day = nowIso.slice(0, 10);
    const body = [
        '---',
        `proposal_id: ${id}`,
        `type: ${proposalType(candidate.asset_target)}`,
        'scope: project',
        'stage: captured',
        `source_learning: ${JSON.stringify(out.unit_key)}`,
        `target_artifact: ${JSON.stringify(candidate.asset_target ?? '')}`,
        'author: retro',
        `created: ${day}`,
        `last_updated: ${day}`,
        `retro_target: ${out.target}`,
        `retro_unit_key: ${JSON.stringify(out.unit_key)}`,
        '---',
        '',
        `# Proposal: ${out.subject}`,
        '',
        '## 1. Learning',
        '',
        out.learning,
        '',
        '## Counter-hypothesis',
        '',
        out.counter_hypothesis ?? '—',
        '',
        '## Falsifier',
        '',
        out.falsifier ?? '—',
        '',
        '## Status',
        '',
        `Captured by a retro on \`${out.unit_key}\`. A single retro is evidence #1, never a mandate:`,
        'nothing here is applied until a person promotes it through the proposal gate.',
        '',
    ].join('\n');
    const file = path.join(root, rel);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (!fs.existsSync(file)) fs.writeFileSync(file, body);
    return rel;
}

/** At most one package record per run (contract § Caps). */
export const MAX_PACKAGE_RECORDS_PER_RUN = 1;

const oneLine = (s: string, max: number): string => {
    const flat = s.replace(/\s+/g, ' ').trim();
    return flat.length <= max ? flat : `${flat.slice(0, max - 1)}…`;
};

/**
 * Write a `package-record` as a self-repair record carrying the claim and the
 * unit key. Whether it ever leaves the machine is not decided here: the record
 * passes the same privacy floor and release path as every other one.
 */
export function writePackageRecord(
    root: string,
    out: RetroOutput,
    candidate: Candidate,
    nowIso: string,
    opts: { treeRoot?: string } = {},
): DefectRecord | null {
    if (out.target !== 'package-record' || out.learning === null || out.subject === null) return null;
    if (carriesInjectionSignal(out)) return null;
    const finding: DefectFinding = {
        defect_class: 'model-noticed',
        source: 'model-noticed',
        evidence: sanitizeEvidence(`retro claim: ${out.subject}`),
        suggested_surface: sanitizeEvidence(out.learning),
        ...(candidate.asset_target !== undefined ? { target: [candidate.asset_target] } : {}),
        ...(PRINCIPLE_RE.test(out.subject) ? { principle: out.subject } : {}),
        ...(out.falsifier !== null && out.falsifier.trim() !== '' ? { falsifier: oneLine(out.falsifier, 160) } : {}),
        unit_keys: [out.unit_key],
    };
    return upsertFinding(root, finding, nowIso, opts);
}

/**
 * Everything one composed retro writes, routed by its single target, then the
 * unit's disposition and the sidecar. `dryRun` writes nothing.
 */
export interface RecordResult {
    target: Target;
    written: string | null;
}

export function recordRetro(
    root: string,
    out: RetroOutput,
    candidate: Candidate | null,
    nowIso: string,
    opts: { dryRun?: boolean; packageRecordsThisRun?: number; sessionTag?: string; treeRoot?: string } = {},
): RecordResult {
    if (opts.dryRun === true) return { target: out.target, written: null };
    let written: string | null = null;
    if (candidate !== null) {
        if (out.target === 'intake-signal') {
            written = `${writeIntakeSignals(root, intakeSignals(out, nowIso))} intake signal(s)`;
        } else if (out.target === 'override-proposal' || out.target === 'contract-no-go-proposal') {
            written = writeProposal(root, out, candidate, nowIso);
        } else if (out.target === 'package-record') {
            if ((opts.packageRecordsThisRun ?? 0) >= MAX_PACKAGE_RECORDS_PER_RUN) {
                throw new Error('recordRetro: at most one package record per run');
            }
            written = writePackageRecord(root, out, candidate, nowIso, opts.treeRoot !== undefined ? { treeRoot: opts.treeRoot } : {})
                ?.fingerprint ?? null;
        }
    }
    recordDisposition(root, out.unit_key, 'analysed', nowIso);
    if (opts.sessionTag !== undefined) markRetroSession(root, opts.sessionTag, nowIso);
    aggregateSidecar(root, nowIso);
    return { target: out.target, written };
}

/** Retro learnings for `/memory:propose`: proposal files and retro intake signals, with their unit keys. */
export interface RetroLearning {
    kind: 'proposal' | 'intake-signal';
    unit: string;
    subject: string;
    where: string;
}

export function listRetroLearnings(root: string): RetroLearning[] {
    const out: RetroLearning[] = [];
    const dir = path.join(root, PROPOSALS_REL);
    let names: string[] = [];
    try {
        names = fs.readdirSync(dir).sort();
    } catch {
        names = [];
    }
    for (const n of names) {
        if (!n.startsWith(RETRO_PROPOSAL_PREFIX) || !n.endsWith('.md')) continue;
        const text = fs.readFileSync(path.join(dir, n), 'utf-8');
        const unit = /^retro_unit_key:\s*"?([^"\n]+)"?$/m.exec(text)?.[1] ?? '';
        const subject = /^# Proposal:\s*(.+)$/m.exec(text)?.[1] ?? n;
        out.push({ kind: 'proposal', unit, subject, where: path.join(PROPOSALS_REL, n) });
    }
    const intake = path.join(root, INTAKE_REL);
    let files: string[] = [];
    try {
        files = fs.readdirSync(intake).filter((f) => f.endsWith('.jsonl')).sort();
    } catch {
        files = [];
    }
    for (const f of files) {
        for (const line of fs.readFileSync(path.join(intake, f), 'utf-8').split('\n')) {
            let r: Record<string, unknown>;
            try {
                r = JSON.parse(line) as Record<string, unknown>;
            } catch {
                continue;
            }
            if (r['source'] !== 'retro') continue;
            out.push({
                kind: 'intake-signal',
                unit: String(r['origin'] ?? ''),
                subject: String(r['path'] ?? ''),
                where: path.join(INTAKE_REL, f),
            });
        }
    }
    return out;
}

// ---------------------------------------------------------------------------
// Manual retro — `/retro` by hand never reads or writes the switch
// ---------------------------------------------------------------------------

export interface PlannedUnit {
    unit_key: string;
    facts: PrFacts | SessionFacts;
    triage: Triage;
}

/**
 * Triage the units a person asked for. Reads no setting and writes nothing, so
 * a manual run neither depends on `retro.enabled` nor re-enables an automatic
 * path; a paused sweep does not pause it.
 */
export function planManualRetro(
    _root: string,
    input: { repo: string; facts: ReadonlyArray<PrFacts | SessionFacts> },
): PlannedUnit[] {
    return input.facts.map((f) => ({
        unit_key:
            f.unit === 'pr'
                ? unitKey({
                      repo: input.repo,
                      pr: f.pr,
                      ...(f.merge_sha.status === 'measured' ? { merge_sha: f.merge_sha.value } : {}),
                  })
                : unitKey({ repo: input.repo, session: f.tag }),
        facts: f,
        triage: f.unit === 'pr' ? triagePr(f) : triageSession(f),
    }));
}

// ---------------------------------------------------------------------------
// CLI — the `/retro` forms (`docs/contracts/retro-v1.md`)
// ---------------------------------------------------------------------------

function argValue(argv: readonly string[], flag: string): string | null {
    const i = argv.indexOf(flag);
    return i === -1 ? null : (argv[i + 1] ?? null);
}

function argValues(argv: readonly string[], flag: string): string[] {
    const out: string[] = [];
    argv.forEach((a, i) => {
        if (a === flag && argv[i + 1] !== undefined) out.push(argv[i + 1]!);
    });
    return out;
}

interface Forge {
    slug: string;
    api: ForgeApi;
}

function liveForge(root: string): Forge | null {
    const target = resolveForgeRepo(originUrl(root));
    if (target === null) return null;
    return { slug: target.slug, api: liveForgeApi(undefined, undefined, { host: target.host, cwd: root }) };
}

/** `retro:<repo>#pr<N>@…` or `retro:<repo>#session@<tag>/p…` back into what reads its facts. */
export function parseUnitKey(key: string): { repo: string; pr?: number; session?: string } | null {
    const m = /^retro:([^#]+)#(?:pr(\d+)@[^/]+|session@([^/]+))\/p\d+$/.exec(key);
    if (m === null) return null;
    return m[2] !== undefined ? { repo: m[1]!, pr: Number(m[2]) } : { repo: m[1]!, session: m[3]! };
}

const USAGE = [
    'usage: retro                         examine the queued units (facts + triage)',
    '       retro <N>                     one merged PR',
    '       retro --session [<tag>]       this session, or the session with that tag',
    '       retro --since <YYYY-MM-DD>    every session that ended on or after the day',
    '       retro status                  queue, last sweep, skip reasons, backlog, triage p50',
    '       retro learnings               retro proposals and intake signals, with their unit keys',
    '       retro record --unit <key> --candidate <file.json>',
    '       retro enqueue-merged --pr <N> [--pr <M> …]   path A, once after /pr:merge',
    '       retro sweep                   path C by hand (respects retro.enabled)',
    '       --dry-run on any form writes nothing',
].join('\n');

export function main(
    argv: readonly string[] = process.argv.slice(2),
    out = (s: string): void => {
        process.stdout.write(`${s}\n`);
    },
    root: string = process.cwd(),
): number {
    const dryRun = argv.includes('--dry-run');
    const args = argv.filter((a) => a !== '--dry-run');
    const now = new Date().toISOString();
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const verb = args[0];

    if (verb === 'status') {
        out(renderStatus(retroStatus(root)));
        return 0;
    }
    if (verb === 'learnings') {
        const rows = listRetroLearnings(root);
        out(rows.length === 0 ? 'no retro learnings' : rows.map((r) => `${r.kind}\t${r.unit}\t${r.subject}\t${r.where}`).join('\n'));
        return 0;
    }
    if (verb === '--help' || verb === '-h') {
        out(USAGE);
        return 0;
    }

    const forge = liveForge(root);
    const repo = forge?.slug ?? path.basename(root);
    const prFacts = (pr: number): PrFacts | null =>
        forge === null ? null : readPrFacts({ pr, slug: forge.slug, api: forge.api, git: liveGit(root), root });

    if (verb === 'enqueue-merged') {
        const prs = argValues(args, '--pr').map(Number).filter((n) => Number.isInteger(n) && n > 0);
        if (prs.length === 0) {
            out('retro enqueue-merged: --pr <N> at least once');
            return 2;
        }
        if (dryRun) {
            out(`would enqueue ${prs.length} PR(s) when retro.enabled is on`);
            return 0;
        }
        const read = forge === null ? null : forgePrState(forge.api, forge.slug);
        const r = enqueueMerged(
            root,
            {
                repo,
                prs: prs.map((pr) => {
                    const s = read?.(pr);
                    return { pr, merge_sha: s?.state === 'MERGED' ? s.merge_sha : null };
                }),
            },
            now,
        );
        out(r.status === 'enqueued' ? `retro: ${r.units.length} unit(s) enqueued` : `retro: ${r.status} — nothing enqueued`);
        return 0;
    }

    if (verb === 'sweep') {
        const r = runDailySweep(root, {
            now,
            timeZone: tz,
            repo,
            sessions: discoverSessions(root, tz),
            ...(forge !== null ? { readPr: forgePrState(forge.api, forge.slug) } : {}),
            ...(dryRun ? { enabled: false } : {}),
        });
        out(r.line ?? `retro sweep: ${dryRun ? 'dry run — nothing written' : r.status}`);
        return 0;
    }

    if (verb === 'record') {
        const key = argValue(args, '--unit');
        const candFile = argValue(args, '--candidate');
        const unit = key === null ? null : parseUnitKey(key);
        if (key === null || unit === null || candFile === null) {
            out('retro record: --unit <unit key> and --candidate <file.json> are required');
            return 2;
        }
        const candidate = JSON.parse(fs.readFileSync(candFile, 'utf-8')) as Candidate | null;
        const facts = unit.pr !== undefined ? prFacts(unit.pr) : readSessionFacts({ tag: unit.session!, root });
        if (facts === null) {
            out('retro record: origin is not a GitHub repository; PR facts cannot be read');
            return 2;
        }
        const composed = composeRetro({ key, facts, candidate, root });
        const sessionId = process.env['CLAUDE_CODE_SESSION_ID'];
        const res = recordRetro(root, composed, candidate, now, {
            dryRun,
            ...(sessionId !== undefined && sessionId !== '' ? { sessionTag: derive_session_tag(sessionId) } : {}),
        });
        out(JSON.stringify({ ...res, reason: composed.reason, recurrence: composed.recurrence }, null, 2));
        return 0;
    }

    // Examination forms: facts + triage, written nowhere.
    const facts: Array<PrFacts | SessionFacts> = [];
    if (verb !== undefined && /^\d+$/.test(verb)) {
        const f = prFacts(Number(verb));
        if (f === null) {
            out('retro: origin is not a GitHub repository; PR facts cannot be read');
            return 2;
        }
        facts.push(f);
    } else if (verb === '--session') {
        const tag = args[1] ?? '';
        const id = process.env['CLAUDE_CODE_SESSION_ID'] ?? '';
        if (tag !== '') facts.push(readSessionFacts({ tag, root }));
        else if (id !== '') facts.push(readSessionFacts({ sessionId: id, root }));
        else {
            out('retro --session: no tag given and no session id in the environment');
            return 2;
        }
    } else if (verb === '--since') {
        const since = args[1] ?? '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(since)) {
            out('retro --since: a day as YYYY-MM-DD');
            return 2;
        }
        for (const p of listSessionPointers(root)) {
            if (localDay(p.ended_at, tz) >= since) facts.push(readSessionFacts({ tag: p.tag, root }));
        }
    } else if (verb === undefined) {
        for (const e of pendingUnits(root)) {
            if (e.kind === 'pr' && e.pr !== undefined) {
                const f = prFacts(e.pr);
                if (f !== null) facts.push(f);
            } else if (e.session !== undefined) {
                facts.push(readSessionFacts({ tag: e.session, root }));
            }
        }
    } else {
        out(USAGE);
        return 2;
    }
    out(JSON.stringify(planManualRetro(root, { repo, facts }), null, 2));
    return 0;
}

// Bundle-safety: never auto-run when inlined into an esbuild bundle, where every
// module shares the bundle's `import.meta.url` (see cmd_migrate.ts).
declare const __AGENT_CONFIG_BUNDLE__: boolean | undefined;
function isCliEntry(): boolean {
    if (typeof __AGENT_CONFIG_BUNDLE__ !== 'undefined' && __AGENT_CONFIG_BUNDLE__) return false;
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
