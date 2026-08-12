#!/usr/bin/env tsx
/**
 * capture_skill_catalogue — make the skill-catalogue delivery defect countable.
 *
 * THE HOST BOUNDARY, STATED FIRST BECAUSE IT DECIDES THE SHAPE OF THIS TOOL.
 * The round-6 census asked for a `session_start` concern that logs the injected
 * catalogue block. A concern cannot do that. The dispatcher envelope carries
 * `session_id`, `source`, `cwd`, `transcript_path` — the injected catalogue is
 * part of the request's system payload, and `preamble_byte_census.ts` already
 * verified independently that no local transcript or file carries it. A hook
 * that "captures the catalogue" would therefore be capturing something else and
 * reporting it under that name, which is worse than not measuring.
 *
 * So the capture is deliberately two-sided, and each side is labelled with what
 * it actually is:
 *
 *   PROJECTION (deterministic) — what the projected skill tree offers the host:
 *   per entry, whether a `description:` exists, how long it is, which
 *   frontmatter keys it carries, and its position in the sorted catalogue. This
 *   is the host's INPUT and it is fully file-measurable.
 *
 *   OBSERVATION (self-reported) — which entries actually arrived as bare names
 *   in a live session. Only the agent reading its own context can see this, so
 *   it is supplied as a file and recorded AS a self-report. It is not
 *   enforcement and nothing here pretends otherwise.
 *
 * The join of the two answers the question the census could not: not "how many
 * are bare" but WHICH PROPERTY separates bare from described. That is the
 * selector, and it is what a delivery fix has to act on. A positional
 * head-N hypothesis is one candidate among several and this tool is built to
 * falsify it rather than assume it — the first observation recorded against
 * this repo showed entries far past position 40 carrying full descriptions
 * while an earlier one was bare, which no head-N budget explains.
 *
 * PRIVACY BY CONSTRUCTION. An observation record carries skill names, integer
 * counts and a host label. The record type has no field able to hold prompt
 * text, file bodies, paths outside the catalogue, or user content — the same
 * shape `domain-safety-pii` § Surface 2 requires of a log event. Do not widen
 * it with a free-form field.
 *
 * Exit codes: 0 report produced · 1 usage/IO error or an empty catalogue root
 * (a catalogue scan that found nothing must never read as a clean result).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

/** Catalogue roots tried in order; the first that exists wins. */
export const DEFAULT_CATALOGUE_ROOTS = ['.claude/skills', 'src/skills'] as const;

/** Where observations accumulate. Append-only, one JSON object per line. */
export const OBSERVATION_LOG = path.join(
    'agents',
    'evidence',
    'metrics',
    'skill-catalogue.jsonl',
);

export interface CatalogueEntry {
    /** Skill directory name — the identifier the host lists. */
    name: string;
    /** 1-based position in the alphabetically sorted catalogue. */
    position: number;
    /** Whether the projected SKILL.md declares a `description:`. */
    hasDescription: boolean;
    /** Character length of the declared description; 0 when absent. */
    descriptionLength: number;
    /** Top-level frontmatter keys the entry declares. */
    frontmatterKeys: string[];
}

export interface SelectorCandidate {
    /** Stable identifier for the property under test. */
    id: string;
    /** Human-readable statement of what the property is. */
    describes: string;
    /** True when the property's values are disjoint across the two groups. */
    separates: boolean;
    /** Why it does or does not separate, in one line. */
    detail: string;
}

export interface SelectorReport {
    catalogueRoot: string;
    entriesTotal: number;
    observedBare: string[];
    observedDescribed: string[];
    /** Observed names that the projection does not know. */
    unknownObserved: string[];
    candidates: SelectorCandidate[];
    verdict: 'selector-found' | 'no-selector' | 'insufficient-observation';
}

/** Frontmatter block between the leading `---` fences, or "" when absent. */
function frontmatterOf(content: string): string {
    if (!content.startsWith('---')) return '';
    const end = content.indexOf('\n---', 3);
    if (end === -1) return '';
    return content.slice(3, end);
}

/**
 * Top-level keys of a frontmatter block. Deliberately shallow: a nested key is
 * not a property the host's catalogue selector could plausibly read, and a full
 * YAML parse would drag a dependency into a measurement tool.
 */
function topLevelKeys(frontmatter: string): string[] {
    const keys: string[] = [];
    for (const line of frontmatter.split('\n')) {
        const match = /^([A-Za-z_][A-Za-z0-9_-]*):/.exec(line);
        if (match) keys.push(match[1]!);
    }
    return keys;
}

/**
 * The declared description with surrounding quotes stripped, or "".
 *
 * A block scalar (`description: >-` / `|`) puts the text on the FOLLOWING
 * lines, so taking the remainder of the header line would yield the
 * two-character indicator and report `descriptionLength: 2`. That would feed
 * the length-based selector candidate noise, and a length threshold could be
 * reported or refuted on it. Block scalars are therefore folded properly.
 */
function descriptionOf(frontmatter: string): string {
    const lines = frontmatter.split('\n');
    for (let i = 0; i < lines.length; i += 1) {
        const match = /^description:\s*(.*)$/.exec(lines[i]!);
        if (!match) continue;
        const rest = match[1]!.trim();

        if (/^[|>][-+]?\d*$/.test(rest)) {
            const body: string[] = [];
            for (let j = i + 1; j < lines.length; j += 1) {
                const line = lines[j]!;
                if (line.trim() === '') {
                    body.push('');
                    continue;
                }
                if (!/^\s/.test(line)) break; // dedented, so the block ended
                body.push(line.trim());
            }
            return body.join(' ').trim();
        }

        return rest.replace(/^["']|["']$/g, '');
    }
    return '';
}

/**
 * Read every `<root>/<name>/SKILL.md` into a catalogue entry, sorted by name —
 * the order a host listing follows and therefore the order a positional
 * hypothesis is measured against.
 */
export function readProjectedCatalogue(root: string): CatalogueEntry[] {
    // Membership is decided by "does <name>/SKILL.md resolve", never by
    // `Dirent.isDirectory()`. The host-facing projection is a tree of SYMLINKS
    // into `dist/agent-src/skills/`, and a Dirent for a symlink reports
    // `isDirectory() === false` — that filter silently read 47 of 289 entries
    // and reported the result as a complete catalogue. `existsSync` follows
    // the link, so the scan sees what the host sees.
    const names = fs
        .readdirSync(root)
        .filter((n) => fs.existsSync(path.join(root, n, 'SKILL.md')))
        .sort();

    return names.map((name, index) => {
        const content = fs.readFileSync(path.join(root, name, 'SKILL.md'), 'utf-8');
        const frontmatter = frontmatterOf(content);
        const description = descriptionOf(frontmatter);
        return {
            name,
            position: index + 1,
            hasDescription: description.length > 0,
            descriptionLength: description.length,
            frontmatterKeys: topLevelKeys(frontmatter),
        };
    });
}

/** True when two number sets occupy disjoint ranges in either direction. */
function rangesAreDisjoint(a: number[], b: number[]): boolean {
    if (a.length === 0 || b.length === 0) return false;
    const maxA = Math.max(...a);
    const minA = Math.min(...a);
    const maxB = Math.max(...b);
    const minB = Math.min(...b);
    return maxA < minB || maxB < minA;
}

/**
 * Join the projection against an observation and report which property, if
 * any, separates the bare entries from the described ones.
 *
 * `observedBare` is the list of entries a live session saw without a
 * description. Everything else in the projection is treated as observed
 * described, which is the honest reading of a whole-catalogue observation —
 * a partial observation would need its own described list, so the caller
 * passes one when it has it.
 */
export function analyzeSelector(
    projected: CatalogueEntry[],
    observedBare: readonly string[],
    observedDescribed?: readonly string[],
): Omit<SelectorReport, 'catalogueRoot'> {
    const known = new Map(projected.map((e) => [e.name, e]));
    const bare = observedBare.filter((n) => known.has(n));
    const describedInput =
        observedDescribed ?? projected.map((e) => e.name).filter((n) => !bare.includes(n));
    const described = describedInput.filter((n) => known.has(n));

    // Both self-reported lists are validated, not only the bare one: a typo in
    // --described silently shrank the described set and weakened the analysis,
    // while the same typo in --observed was surfaced.
    const unknownObserved = [
        ...new Set([
            ...observedBare.filter((n) => !known.has(n)),
            ...(observedDescribed ?? []).filter((n) => !known.has(n)),
        ]),
    ].sort();

    const base = {
        entriesTotal: projected.length,
        observedBare: [...bare].sort(),
        observedDescribed: [...described].sort(),
        unknownObserved,
    };

    if (bare.length === 0 || described.length === 0) {
        return {
            ...base,
            candidates: [],
            verdict: 'insufficient-observation' as const,
        };
    }

    const bareEntries = bare.map((n) => known.get(n)!);
    const describedEntries = described.map((n) => known.get(n)!);
    const candidates: SelectorCandidate[] = [];

    // 1. The projection itself — does the entry even declare a description?
    const bareWithDesc = bareEntries.filter((e) => e.hasDescription).length;
    const describedWithoutDesc = describedEntries.filter((e) => !e.hasDescription).length;
    candidates.push({
        id: 'declares-description',
        describes: 'the projected SKILL.md declares a `description:`',
        separates: bareWithDesc === 0 && describedWithoutDesc === 0,
        detail: `${bareWithDesc}/${bareEntries.length} bare entries declare one; ${describedWithoutDesc}/${describedEntries.length} described entries do not`,
    });

    // 2. The head-N hypothesis the census proposed — falsifiable here.
    const barePositions = bareEntries.map((e) => e.position);
    const describedPositions = describedEntries.map((e) => e.position);
    const positional = Math.max(...describedPositions) < Math.min(...barePositions);
    candidates.push({
        id: 'positional-head',
        describes: 'every described entry sorts before every bare entry (a head-N budget)',
        separates: positional,
        detail: positional
            ? `described top out at #${Math.max(...describedPositions)}, bare start at #${Math.min(...barePositions)}`
            : `described reach #${Math.max(...describedPositions)} while bare start at #${Math.min(...barePositions)} — the ranges overlap, so no head-N cut explains this`,
    });

    // 3. Description length as a budget proxy.
    const lengthSeparates = rangesAreDisjoint(
        bareEntries.map((e) => e.descriptionLength),
        describedEntries.map((e) => e.descriptionLength),
    );
    candidates.push({
        id: 'description-length',
        describes: 'description length ranges do not overlap between the groups',
        separates: lengthSeparates,
        detail: lengthSeparates
            ? 'a length threshold separates the two groups'
            : 'length ranges overlap',
    });

    // 4. Any frontmatter key whose presence tracks the split exactly.
    const allKeys = new Set<string>();
    for (const entry of projected) for (const key of entry.frontmatterKeys) allKeys.add(key);
    for (const key of [...allKeys].sort()) {
        const bareHas = bareEntries.filter((e) => e.frontmatterKeys.includes(key)).length;
        const describedHas = describedEntries.filter((e) =>
            e.frontmatterKeys.includes(key),
        ).length;
        const separates =
            (bareHas === 0 && describedHas === describedEntries.length) ||
            (describedHas === 0 && bareHas === bareEntries.length);
        if (!separates) continue;
        candidates.push({
            id: `frontmatter:${key}`,
            describes: `presence of the \`${key}:\` frontmatter key`,
            separates: true,
            detail: `bare ${bareHas}/${bareEntries.length}, described ${describedHas}/${describedEntries.length}`,
        });
    }

    return {
        ...base,
        candidates,
        verdict: candidates.some((c) => c.separates)
            ? ('selector-found' as const)
            : ('no-selector' as const),
    };
}

/** One append-only observation record. No field can hold free-form content. */
export interface ObservationRecord {
    schema: 1;
    observed_at: string;
    host: string;
    entries_total: number;
    bare_count: number;
    described_count: number;
    bare_names: string[];
    verdict: SelectorReport['verdict'];
    separating_candidates: string[];
}

export function buildObservationRecord(
    report: SelectorReport,
    host: string,
    observedAt: string,
): ObservationRecord {
    return {
        schema: 1,
        observed_at: observedAt,
        host,
        entries_total: report.entriesTotal,
        bare_count: report.observedBare.length,
        described_count: report.observedDescribed.length,
        bare_names: report.observedBare,
        verdict: report.verdict,
        separating_candidates: report.candidates.filter((c) => c.separates).map((c) => c.id),
    };
}

export function formatReport(report: SelectorReport): string {
    const lines: string[] = [];
    lines.push(`catalogue root: ${report.catalogueRoot}`);
    lines.push(`entries: ${report.entriesTotal}`);
    lines.push(
        `observed: ${report.observedBare.length} bare · ${report.observedDescribed.length} described (self-reported)`,
    );
    if (report.unknownObserved.length > 0) {
        lines.push(
            `⚠️  ${report.unknownObserved.length} observed name(s) absent from the projection: ${report.unknownObserved.join(', ')}`,
        );
    }
    if (report.verdict === 'insufficient-observation') {
        lines.push('');
        lines.push(
            'verdict: insufficient-observation — an observation needs at least one bare AND one described entry to separate anything.',
        );
        return lines.join('\n');
    }
    lines.push('');
    lines.push('selector candidates:');
    for (const candidate of report.candidates) {
        lines.push(`  ${candidate.separates ? '✅' : '❌'} ${candidate.id} — ${candidate.describes}`);
        lines.push(`     ${candidate.detail}`);
    }
    lines.push('');
    lines.push(
        report.verdict === 'selector-found'
            ? 'verdict: selector-found — a delivery fix can act on the separating property above.'
            : 'verdict: no-selector — no measured property separates the groups; the selector is host-internal on this evidence. Publish the null rather than guessing a fix.',
    );
    return lines.join('\n');
}

function resolveCatalogueRoot(explicit: string | null): string {
    if (explicit) {
        if (!fs.existsSync(explicit)) {
            throw new Error(`catalogue root does not exist: ${explicit}`);
        }
        return explicit;
    }
    for (const candidate of DEFAULT_CATALOGUE_ROOTS) {
        const abs = path.join(REPO, candidate);
        if (fs.existsSync(abs)) return abs;
    }
    throw new Error(
        `no catalogue root found — tried ${DEFAULT_CATALOGUE_ROOTS.join(', ')} under ${REPO}`,
    );
}

function argValue(flag: string): string | null {
    const index = process.argv.indexOf(flag);
    if (index === -1 || index + 1 >= process.argv.length) return null;
    return process.argv[index + 1]!;
}

function main(): number {
    const root = resolveCatalogueRoot(argValue('--catalogue-root'));
    const projected = readProjectedCatalogue(root);

    if (projected.length === 0) {
        process.stderr.write(
            `❌  catalogue root ${root} holds no SKILL.md entries — a scan that found nothing is not a clean result\n`,
        );
        return 1;
    }

    const observedPath = argValue('--observed');
    if (!observedPath) {
        // Projection-only mode: the deterministic half, for a baseline snapshot.
        const withDescription = projected.filter((e) => e.hasDescription).length;
        const payload = {
            catalogue_root: path.relative(REPO, root) || root,
            entries_total: projected.length,
            declares_description: withDescription,
            declares_none: projected.length - withDescription,
        };
        if (process.argv.includes('--json')) {
            process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
        } else {
            process.stdout.write(
                `catalogue root: ${payload.catalogue_root}\nentries: ${payload.entries_total}\ndeclares a description: ${payload.declares_description}\ndeclares none: ${payload.declares_none}\n\nThis is the PROJECTION half only — what the host is offered. Which entries actually\narrived bare is a live-session observation; pass it with --observed <file>.\n`,
            );
        }
        return 0;
    }

    const readNames = (p: string): string[] =>
        fs
            .readFileSync(p, 'utf-8')
            .split('\n')
            .map((l) => l.trim())
            .filter((l) => l.length > 0 && !l.startsWith('#'));

    const observedBare = readNames(observedPath);

    // A PARTIAL observation must supply both lists. Without `--described` the
    // analyzer treats every non-bare entry as observed-described, which is only
    // true of a whole-catalogue read; on a partial one it would silently invent
    // hundreds of observations nobody made.
    const describedPath = argValue('--described');
    const observedDescribed = describedPath ? readNames(describedPath) : undefined;

    const report: SelectorReport = {
        catalogueRoot: path.relative(REPO, root) || root,
        ...analyzeSelector(projected, observedBare, observedDescribed),
    };

    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    } else {
        process.stdout.write(`${formatReport(report)}\n`);
    }

    const host = argValue('--host') ?? 'unknown';
    const stampedAt = argValue('--observed-at');
    if (process.argv.includes('--record')) {
        if (!stampedAt) {
            process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
            return 1;
        }
        const logPath = path.join(REPO, OBSERVATION_LOG);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        fs.appendFileSync(
            logPath,
            `${JSON.stringify(buildObservationRecord(report, host, stampedAt))}\n`,
        );
        process.stdout.write(`\nrecorded → ${OBSERVATION_LOG}\n`);
    }

    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(_HERE)) {
    try {
        process.exit(main());
    } catch (error) {
        process.stderr.write(`❌  ${(error as Error).message}\n`);
        process.exit(1);
    }
}
