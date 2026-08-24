/**
 * skill_catalogue — the pure measurement library behind `capture_skill_catalogue`.
 *
 * Split out of the CLI for one concrete reason: `install.ts` needs the
 * deploy-time truncation warning, `install.ts` is an esbuild bundle entry, and
 * a bundled module carrying a top-level `process.exit()` runs that exit when a
 * CONSUMER loads the installer — the entry guard cannot tell it apart, because
 * inside a bundle the bundle IS `process.argv[1]`. So everything importable
 * lives here, with no CLI entry and no top-level exit, and the CLI re-exports
 * it.
 *
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
 *   OBSERVATION — which entries actually arrived, and how many did not. This
 *   side has TWO sources and every record says which one it came from:
 *
 *     `self-report` — an agent reading its own context lists the bare names.
 *     Only the agent can see this. It is not enforcement and nothing here
 *     pretends otherwise. This is the claude-shaped path.
 *
 *     `host-event` — the host publishes its own truncation on a machine
 *     channel. `codex exec --json` emits an `item.completed` error event whose
 *     message states how many entries it dropped, so the count is READ, never
 *     transcribed. This is the codex-shaped path and it is deterministic.
 *
 *   Hosts do not truncate the same way, so a record also carries a
 *   `truncation_mode`: `per-entry` (some entries arrive bare, others full —
 *   claude) versus `budget-strip-and-drop` (every description stripped, then N
 *   entries dropped wholesale — codex). Pooling the two into one verdict would
 *   average two different mechanisms into a number describing neither, so the
 *   report is always per host.
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
 * counts, a host label and two closed enums. The record type has no field able
 * to hold prompt text, file bodies, paths outside the catalogue, or user
 * content — the same shape `domain-safety-pii` § Surface 2 requires of a log
 * event. The codex path reads a host message and keeps only the integer in it;
 * the message text itself never reaches a record. Do not widen it with a
 * free-form field.
 *
 * A ZERO IS NEVER INFERRED FROM SILENCE. If the host's budget event is absent
 * or unparseable — reworded upstream, or removed — the capture fails loudly
 * rather than recording `dropped: 0`, because a broken parser and a fixed
 * defect would otherwise look identical. Recording a genuine no-truncation run
 * takes an explicit `--assert-no-truncation`.
 *
 * Exit codes: 0 report produced · 1 usage/IO error, an empty catalogue root
 * (a catalogue scan that found nothing must never read as a clean result), or
 * an unreadable host observation.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

/** Catalogue roots tried in order; the first that exists wins. */
export const DEFAULT_CATALOGUE_ROOTS = ['.claude/skills', 'src/skills'] as const;

/**
 * First existing catalogue root under `workspaceRoot`, or `null`.
 *
 * `.claude/skills` before `src/skills` because a CONSUMER install carries the
 * former and only a maintainer checkout carries the latter. Shared by the
 * `skill-route` concern and the `suggest_skill_for_task` MCP handler on
 * purpose: two resolvers over one catalogue is how a ranker and the tool that
 * exposes it start ranking different trees.
 */
export function resolveSkillsRoot(workspaceRoot: string): string | null {
    for (const candidate of DEFAULT_CATALOGUE_ROOTS) {
        const abs = path.join(workspaceRoot, candidate);
        try {
            if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) return abs;
        } catch {
            // Unreadable candidate is not a match; try the next.
        }
    }
    return null;
}

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
    /**
     * The declared description itself, folded. In-memory only — this is the
     * projection half, which is file content the host is handed, and it is
     * what makes a byte-accurate volume measurement possible. It is NEVER
     * copied into an `ObservationRecord`; see the privacy paragraph.
     */
    description: string;
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
            description,
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

/**
 * How a host truncates. The two known mechanisms are not variants of one
 * number, so a record that does not say which one it measured cannot be
 * compared against one that measured the other.
 *
 * `per-entry` — some entries arrive with their description, others arrive as
 * bare names. Which is which is the selector question `analyzeSelector` asks.
 *
 * `budget-strip-and-drop` — the host strips EVERY description, then drops N
 * entries from the list entirely. There is no per-entry selector to find; the
 * quantity that matters is N.
 *
 * `none` — the host truncated in NO way on this run: every entry arrived and
 * every description survived. It is a mode a record must be able to state
 * explicitly, because the alternative is leaving the field absent, and absent
 * reads as `per-entry` — a mode this run did not exercise. A `none` record is
 * the only shape that can say "the same host that strips today did not strip
 * here" without inventing a mechanism.
 */
export type TruncationMode = 'per-entry' | 'budget-strip-and-drop' | 'none';

/** Where the observation half came from. See the header. */
export type ObservationSource = 'self-report' | 'host-event';

/**
 * The projection mode the observed install was deployed under.
 *
 * A closed enum, never a free-form label: the record type's privacy contract
 * is that no field can hold arbitrary text, and this one is no exception.
 */
export type ProjectionMode = 'scoped' | 'legacy-all';

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
    /**
     * Absent on a schema-1 record written before hosts were distinguished.
     * Absent reads as `per-entry`, which is what those records measured — see
     * `truncationModeOf`. Never default it to the codex mode: that would
     * retroactively relabel an observation nobody took.
     */
    truncation_mode?: TruncationMode;
    /** Absent on records written before the two sources were distinguished. */
    observation_source?: ObservationSource;
    /**
     * Skills projected at this observation — the ONLY population the drop
     * tracks. `entries_total` counts every artefact, and a controlled probe
     * (2026-08-15) moved the host's dropped count by 0 when 60 commands were
     * added and by +53 when 60 skills were. Comparing artefact totals would
     * fire on command growth that causes no truncation at all.
     */
    projected_skill_count?: number;
    /**
     * Projection mode the observed install was deployed under.
     *
     * Absent on every record written before the mode was captured, and absence
     * is NOT `legacy-all`: those observations were taken without asking, so
     * defaulting them either way would relabel a reading nobody took. A
     * consumer comparing modes must skip a record that carries none.
     */
    projection_mode?: ProjectionMode;
    /**
     * Entries the host dropped wholesale, read from the host's own event.
     * Only ever present on a `budget-strip-and-drop` record — a `per-entry`
     * host publishes no such count, and inventing one is the failure the
     * header's zero-is-never-inferred paragraph forbids.
     */
    dropped_count?: number;
}

/** The mode a record measured; absent reads as the pre-codex `per-entry`. */
export function truncationModeOf(record: ObservationRecord): TruncationMode {
    return record.truncation_mode ?? 'per-entry';
}

/** The source a record came from; absent reads as the pre-codex self-report. */
export function observationSourceOf(record: ObservationRecord): ObservationSource {
    return record.observation_source ?? 'self-report';
}

/**
 * The self-report path's record.
 *
 * `projectedSkillCount` and `projectionMode` are optional in the SAME shape the
 * two host-event builders use — omitted rather than defaulted, because absence
 * is not `legacy-all` and never was (see `ObservationRecord.projection_mode`).
 *
 * They were missing here until 2026-08-18, and the omission was load-bearing in
 * one direction: the self-report path is the ONLY one that fills `bare_names`,
 * so it is the only source the pointable-but-bare join below can read — and
 * every claude observation in the corpus therefore carried no scope at all,
 * while the codex records beside them did. A series that changes scope
 * mid-flight without recording it is not comparable, which is exactly what
 * claim 7 of the roadmap that asked for the field says.
 */
export function buildObservationRecord(
    report: SelectorReport,
    host: string,
    observedAt: string,
    projectedSkillCount?: number,
    projectionMode?: ProjectionMode,
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
        truncation_mode: 'per-entry',
        observation_source: 'self-report',
        ...(projectedSkillCount === undefined ? {} : { projected_skill_count: projectedSkillCount }),
        ...(projectionMode === undefined ? {} : { projection_mode: projectionMode }),
    };
}

/* ------------------------------------------------------------------ *
 * The host-event path — codex publishes its own truncation.
 * ------------------------------------------------------------------ */

/** What a host's own budget event states. Integers only, by construction. */
export interface HostBudgetEvent {
    /** Entries the host dropped from the model-visible list. */
    droppedCount: number;
    /** Whether the host also stripped descriptions from what survived. */
    descriptionsStripped: boolean;
}

/**
 * Read a host budget event out of a `codex exec --json` stream.
 *
 * Parses the STRUCTURED event, never the human-readable warning line: the
 * pretty line is presentation and may be reworded or dropped without notice,
 * while the JSON channel is the host's machine contract. Observed shape
 * (2026-08-15, codex CLI):
 *
 *   {"type":"item.completed","item":{"id":"item_0","type":"error",
 *    "message":"Exceeded skills context budget. All skill descriptions were
 *    removed and 393 additional skills were not included in the
 *    model-visible skills list."}}
 *
 * Returns `null` when no such event is present. `null` means UNKNOWN, never
 * zero — the caller decides whether the run genuinely did not truncate, and
 * says so explicitly. A line that is not JSON is skipped rather than fatal:
 * the stream is interleaved with the CLI's own plain-text chatter.
 */
export function parseHostBudgetEvent(stream: string): HostBudgetEvent | null {
    for (const line of stream.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) continue;

        let parsed: unknown;
        try {
            parsed = JSON.parse(trimmed);
        } catch {
            continue;
        }

        const item = (parsed as { item?: { type?: unknown; message?: unknown } }).item;
        if (item === undefined || item === null || item.type !== 'error') continue;
        const message = typeof item.message === 'string' ? item.message : '';
        if (!/skills context budget/i.test(message)) continue;

        const dropped = /(\d+)\s+additional skills were not included/i.exec(message);
        if (!dropped) {
            // The event fired and its shape changed. Reporting this as "no
            // truncation" would turn an upstream rewording into a clean bill
            // of health, so it is an unknown like any other.
            return null;
        }

        return {
            droppedCount: Number.parseInt(dropped[1]!, 10),
            descriptionsStripped: /descriptions were removed/i.test(message),
        };
    }
    return null;
}

/**
 * An observation built from the host's own event rather than from a self-report.
 *
 * `entriesOffered` is the deterministic projection half — how many artefacts
 * the host was given. `bare_count` is the whole surviving set when the host
 * stripped every description, which is exactly what the codex message states;
 * there is no per-entry list to record, so `bare_names` stays empty rather
 * than being filled with a guess.
 */
export function buildHostEventRecord(
    host: string,
    observedAt: string,
    entriesOffered: number,
    event: HostBudgetEvent,
    projectedSkillCount?: number,
    projectionMode?: ProjectionMode,
): ObservationRecord {
    return {
        schema: 1,
        observed_at: observedAt,
        host,
        // OUR projection, not the host's denominator. Measured 2026-08-15 they
        // are not the same number and there is no way to read the host's:
        // `~/.codex` projects 297 skills + 200 commands = 497 by this tool's
        // count, while the host reported dropping 393 — and a controlled +60
        // commands moved that by ZERO. Whatever codex counts, it is not this.
        // So `entries_total - dropped_count` is NOT a delivered count, and
        // nothing here computes one: a subtraction across two different
        // denominators produces a confident number describing neither.
        entries_total: entriesOffered,
        bare_count: 0,
        described_count: 0,
        bare_names: [],
        // There is nothing to separate: the host did not choose per entry, it
        // stripped all of them. `no-selector` would read as "we looked and
        // found none", which is not what happened.
        verdict: 'insufficient-observation',
        separating_candidates: [],
        truncation_mode: 'budget-strip-and-drop',
        observation_source: 'host-event',
        dropped_count: event.droppedCount,
        ...(projectedSkillCount === undefined ? {} : { projected_skill_count: projectedSkillCount }),
        ...(projectionMode === undefined ? {} : { projection_mode: projectionMode }),
    };
}

/**
 * A run on which the host published NO budget event and the caller asserted
 * that this is a genuine no-truncation observation.
 *
 * The assertion is the caller's and the record says so by carrying
 * `observation_source: 'host-event'` together with `truncation_mode: 'none'`:
 * the host's channel was read, and what it contained was nothing. That pairing
 * is what distinguishes this from a broken parser, which the CLI refuses to
 * record at all without the explicit flag.
 *
 * `dropped_count: 0` is written rather than omitted, and it is safe: every
 * consumer of a dropped count filters on `budget-strip-and-drop`, so a `none`
 * record can never become a measured limit or a deploy-time warning.
 */
export function buildNoTruncationRecord(
    host: string,
    observedAt: string,
    entriesOffered: number,
    projectedSkillCount?: number,
    projectionMode?: ProjectionMode,
): ObservationRecord {
    return {
        schema: 1,
        observed_at: observedAt,
        host,
        entries_total: entriesOffered,
        // BOTH counts stay 0, and neither is a claim that nothing arrived
        // described. The host published no per-entry breakdown at all — it
        // published nothing, which is what `truncation_mode: 'none'` records.
        // Writing `described_count: entriesOffered` would look like a
        // measurement and be an inference; 0 here means "not counted", exactly
        // as it does on the strip-and-drop record beside it.
        bare_count: 0,
        described_count: 0,
        bare_names: [],
        // Nothing arrived bare, so no property separated bare from described —
        // which is what `no-selector` states. Unlike the strip-and-drop case,
        // here the label is literally true rather than merely available.
        verdict: 'no-selector',
        separating_candidates: [],
        truncation_mode: 'none',
        observation_source: 'host-event',
        dropped_count: 0,
        ...(projectedSkillCount === undefined ? {} : { projected_skill_count: projectedSkillCount }),
        ...(projectionMode === undefined ? {} : { projection_mode: projectionMode }),
    };
}

/* ------------------------------------------------------------------ *
 * The projection half, per host — volume, not just entry count.
 * ------------------------------------------------------------------ */

/** What one host root is offered. Every number is file-measured. */
export interface CatalogueVolume {
    host: string;
    root: string;
    skillEntries: number;
    commandEntries: number;
    /** Everything the host lists — the number its budget is spent on. */
    artefacts: number;
    /** Bytes of declared `description:` text across the skill entries. */
    descriptionBytes: number;
}

/** Every `*.md` under a root, at any depth. */
function markdownFilesUnder(root: string): string[] {
    if (!fs.existsSync(root)) return [];
    const out: string[] = [];
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (fs.statSync(full).isDirectory()) walk(full);
            else if (entry.name.endsWith('.md')) out.push(full);
        }
    };
    walk(root);
    return out;
}

/**
 * Measure what a host root actually offers.
 *
 * `root` is the host's own config directory (`~/.codex`, `~/.claude`), not a
 * skills directory — the budget is spent on the whole catalogue, and counting
 * skills alone would understate it by the command set.
 */
export function measureCatalogueVolume(host: string, root: string): CatalogueVolume {
    const skillsRoot = path.join(root, 'skills');
    const skills = fs.existsSync(skillsRoot) ? readProjectedCatalogue(skillsRoot) : [];
    const commandEntries = markdownFilesUnder(path.join(root, 'commands')).length;
    return {
        host,
        root,
        skillEntries: skills.length,
        commandEntries,
        artefacts: skills.length + commandEntries,
        descriptionBytes: skills.reduce((sum, e) => sum + Buffer.byteLength(e.description), 0),
    };
}

/* ------------------------------------------------------------------ *
 * Projection modes — what a host would be offered under `scoped`
 * versus under `legacy-all`, side by side.
 * ------------------------------------------------------------------ */

/**
 * The two SKILL counts a package projects, plus the pack closure behind the
 * smaller one.
 *
 * SKILLS, not artefacts, and the distinction is load-bearing rather than
 * pedantic: a controlled probe on 2026-08-15 moved the measured host's dropped
 * count by 0 when 60 commands were added and by +53 when 60 skills were, so a
 * threshold read off artefact totals would fire on growth that causes no
 * truncation at all.
 *
 * Both numbers come from ONE walk in the caller, partitioned by the
 * installer's own prune predicate, so `scoped + prunedUnderScoped ===
 * legacyAll` holds by construction rather than by two counters agreeing.
 */
export interface ProjectionModeCounts {
    /** Skills a default `projection.mode: scoped` install deploys. */
    scoped: number;
    /** Every skill in the catalogue — what `legacy-all` deploys. */
    legacyAll: number;
    /** `legacyAll - scoped`; the reduction `scoped` buys. */
    prunedUnderScoped: number;
    /** Pack ids active by default under `scoped`, sorted. */
    activePacks: string[];
    /**
     * Skills a `projection.mode: tiered` install deploys natively — those
     * predicted to reach the model WITH their description. `null` when no tier
     * split exists on this machine, which is the common case and is NOT zero.
     */
    tierACount: number | null;
    /**
     * Skills `tiered` withholds from the native catalogue; still served by the
     * MCP recovery tools. `null` under the same condition as `tierACount`.
     */
    tierBCount: number | null;
}

/**
 * Which mode an installed host root is consistent with.
 *
 * `indeterminate` is a real answer and the common one. A host root is not
 * required to hold exactly what this package projects — another suite, a
 * plugin, or a stale install all put skills there — so a count matching
 * neither number says the root was not installed from this tree at this
 * revision, never that the install is broken. And when the two modes yield the
 * same number (no pack-tagged skills), NO root can discriminate them, so every
 * row is `indeterminate` by construction rather than by measurement.
 */
export type ProjectionModeMatch = 'scoped' | 'legacy-all' | 'indeterminate';

/** One host's installed skill count, read against the two mode counts. */
export interface HostProjectionRow {
    host: string;
    root: string;
    /** Skills present in the host root right now — file-measured. */
    installedSkills: number;
    matches: ProjectionModeMatch;
}

/**
 * Classify one measured host root against the package's two mode counts.
 *
 * Deliberately an equality test and nothing cleverer. A nearest-neighbour rule
 * would label every root with whichever number happens to be closer, which
 * reports a mode for a root that carries neither — the confident-number
 * failure this module's header forbids twice over.
 */
export function classifyHostProjection(
    volume: CatalogueVolume,
    counts: ProjectionModeCounts,
): HostProjectionRow {
    const ambiguous = counts.scoped === counts.legacyAll;
    let matches: ProjectionModeMatch = 'indeterminate';
    if (!ambiguous) {
        if (volume.skillEntries === counts.scoped) matches = 'scoped';
        else if (volume.skillEntries === counts.legacyAll) matches = 'legacy-all';
    }
    return {
        host: volume.host,
        root: volume.root,
        installedSkills: volume.skillEntries,
        matches,
    };
}

/** The side-by-side report. Measurement only — it flips no default. */
export function formatProjectionModes(
    counts: ProjectionModeCounts,
    rows: readonly HostProjectionRow[],
): string {
    const lines = [
        'projected SKILL counts by projection mode (package side, one walk):',
        `  scoped:      ${counts.scoped}`,
        `  legacy-all:  ${counts.legacyAll}`,
        `  pruned under scoped: ${counts.prunedUnderScoped}`,
        `  active packs under scoped: ${counts.activePacks.length}`,
    ];
    if (counts.tierACount === null || counts.tierBCount === null) {
        lines.push(
            '  tiered:      no split on this machine (agents/runtime/state/skill-tiers.json',
            '               absent) — not zero, unmeasured. `tiered` ships the full surface',
            '               until a split exists.',
        );
    } else {
        lines.push(
            `  tiered:      tier A ${counts.tierACount} native + tier B ${counts.tierBCount} ` +
                `MCP-only = ${counts.tierACount + counts.tierBCount}`,
        );
        if (counts.tierACount + counts.tierBCount !== counts.legacyAll) {
            lines.push(
                `               ⚠️  tier A + tier B (${counts.tierACount + counts.tierBCount}) != ` +
                    `legacy-all (${counts.legacyAll}) — the split is STALE, recompute it.`,
            );
        }
    }
    lines.push('');
    if (rows.length === 0) {
        lines.push(
            'No host root measured. Pass --host-root <dir> (repeatable) to read what',
            'each host currently holds against the two numbers above.',
        );
        return lines.join('\n');
    }
    lines.push('installed host roots:');
    for (const row of [...rows].sort((a, b) => a.host.localeCompare(b.host))) {
        lines.push(`  ${row.host}: ${row.installedSkills} skills — consistent with ${row.matches}`);
    }
    lines.push(
        '',
        'This is the PROJECTION half only, and it is a measurement: no default was',
        'read, changed, or recommended here. `indeterminate` means the root carries',
        'neither count — another suite, a plugin, or a stale install all produce it.',
        'No host limit is extrapolated from another host, and no delivered or',
        'survivor count is computed anywhere.',
    );
    return lines.join('\n');
}

/* ------------------------------------------------------------------ *
 * Known limits — read off recorded observations, never invented.
 * ------------------------------------------------------------------ */

/**
 * A truncation this estate has actually OBSERVED for one host.
 *
 * Deliberately not "the host's limit". Two of its three numbers would have to
 * come from the host to call it that, and only one does. What is recorded is
 * the honest pair: at a projection of `projectedVolume`, the host said it
 * dropped `droppedEntries`. No delivered count is derived — see
 * `buildHostEventRecord` for why the subtraction is invalid.
 *
 * Built only from a `budget-strip-and-drop` observation, because only that
 * mode publishes a count. A `per-entry` host reports which entries arrived
 * bare, which is a selector fact and not a truncation quantity, so such a host
 * yields nothing here and produces no warning. That asymmetry is the point:
 * an unmeasured host gets no invented number.
 */
export interface KnownHostLimit {
    host: string;
    /** Entries the host itself said it dropped. */
    droppedEntries: number;
    /** What THIS tool projected for that host at that observation. */
    projectedVolume: number;
    /**
     * SKILLS projected at that observation — the comparable quantity.
     * Absent on a record written before the skill-only count existed, and
     * absence is load-bearing: without it the observation is not comparable
     * and yields no eligibility (see `migrationEligibility`).
     */
    projectedSkills: number | null;
    observedAt: string;
}

/**
 * Is `candidate` the record a host's headline should quote, given `incumbent`?
 *
 * Shared by `knownHostLimits` and `formatPerHostVerdicts` because they used to
 * disagree, and the disagreement was visible in one run: two arms of the same
 * experiment recorded on the same date made `--limits` print `dropped 402` in
 * the verdict block and `dropped 330` in the measured-truncations block, for
 * one host on one day. Two reducers over one log must not break a tie in
 * opposite directions.
 *
 * Later date always wins. On an EQUAL date the larger drop wins, which is also
 * the conservative direction this module already takes elsewhere: over-warning
 * about truncation is safe, under-warning is the failure. It is also what keeps
 * a `scoped` arm from being quoted at a `legacy-all` install — the scoped arm
 * is by construction the smaller number.
 */
function _supersedes(candidate: ObservationRecord, incumbent: ObservationRecord): boolean {
    if (candidate.observed_at !== incumbent.observed_at) {
        return candidate.observed_at > incumbent.observed_at;
    }
    return (candidate.dropped_count ?? 0) > (incumbent.dropped_count ?? 0);
}

/** The record whose truncation a host's headline quotes, per `_supersedes`. */
export function headlineRecordPerHost(
    records: readonly ObservationRecord[],
): Map<string, ObservationRecord> {
    const out = new Map<string, ObservationRecord>();
    for (const record of records) {
        const previous = out.get(record.host);
        if (previous === undefined || _supersedes(record, previous)) {
            out.set(record.host, record);
        }
    }
    return out;
}

/** The most recent observed truncation per host. */
export function knownHostLimits(records: readonly ObservationRecord[]): Map<string, KnownHostLimit> {
    const out = new Map<string, KnownHostLimit>();
    const chosen = new Map<string, ObservationRecord>();
    for (const record of records) {
        if (truncationModeOf(record) !== 'budget-strip-and-drop') continue;
        if (typeof record.dropped_count !== 'number') continue;
        if (record.dropped_count <= 0) continue;
        const previous = chosen.get(record.host);
        if (previous !== undefined && !_supersedes(record, previous)) continue;
        chosen.set(record.host, record);
        out.set(record.host, {
            host: record.host,
            droppedEntries: record.dropped_count,
            projectedVolume: record.entries_total,
            projectedSkills: record.projected_skill_count ?? null,
            observedAt: record.observed_at,
        });
    }
    return out;
}

/**
 * The deploy-time warning, or `null` when this deploy is smaller than the one
 * that was measured truncating — or when nothing has been measured at all.
 *
 * Warns, never blocks: over-shipping is the safe direction and a consumer who
 * accepts truncation is making a legitimate choice. Naming the command is the
 * point — a number with no way to reproduce it is noise.
 */
export function catalogueLimitWarning(
    volume: CatalogueVolume,
    limit: KnownHostLimit | undefined,
): string | null {
    if (limit === undefined) return null;
    // SKILLS, not artefacts. The council's correction, and it rests on this
    // estate's own probe: +60 commands moved the host's dropped count by 0.
    // An artefact-total comparison would warn on command growth that truncates
    // nothing. An observation with no skill count is not comparable, so it
    // yields no warning rather than a guess.
    if (limit.projectedSkills === null) return null;
    if (volume.skillEntries < limit.projectedSkills) return null;
    return (
        `${volume.host}: deploying ${volume.skillEntries} skills. ` +
        `This host reported dropping ${limit.droppedEntries} entries from the ` +
        `model-visible list when last measured (${limit.observedAt}, at ` +
        `${limit.projectedSkills} skills) — that much never reaches the model. ` +
        'Explain: `agent-config exec capture_skill_catalogue --limits`'
    );
}

/* ------------------------------------------------------------------ *
 * Migration eligibility — AI council, 2026-08-15, 2/2 converged.
 * ------------------------------------------------------------------ */

/**
 * Why an install is (not) eligible to be ASKED about scoped projection.
 *
 * Eligibility is deliberately separate from whether a prompt can be shown.
 * The council's refinement: an install can qualify while the session is
 * non-interactive, and collapsing the two would make "not asked because CI"
 * indistinguishable from "not asked because it does not qualify".
 */
export interface MigrationEligibility {
    eligible: boolean;
    /** Machine-readable reason, always set — including on the eligible path. */
    reason:
        | 'eligible'
        | 'no-observation-for-host'
        | 'observation-not-comparable'
        | 'no-truncation-observed'
        | 'already-scoped'
        | 'already-tiered'
        | 'below-observed-skill-volume';
    /** Populated only when eligible, for the message. */
    droppedEntries?: number;
    observedAt?: string;
}

/**
 * Is this install worth asking about?
 *
 * `currentSkillCount` is the SKILL population only, and that is the whole
 * correction the council made to the original predicate. A controlled probe
 * (2026-08-15) moved the host's dropped count by 0 when 60 command files were
 * added and by +53 when 60 skills were, so a comparison over total artefacts
 * would fire on command growth that truncates nothing.
 *
 * An observation with no recorded skill count is NOT comparable — the two
 * numbers would be counted by different rules — and returns
 * `observation-not-comparable` rather than being coerced into a verdict.
 * Never extrapolate from another host.
 */
export function migrationEligibility(
    host: string,
    resolvedMode: 'scoped' | 'legacy-all' | 'tiered',
    currentSkillCount: number,
    limits: ReadonlyMap<string, KnownHostLimit>,
): MigrationEligibility {
    if (resolvedMode === 'scoped') return { eligible: false, reason: 'already-scoped' };
    // `tiered` already withholds skills from the native catalogue, so an offer to
    // migrate to `scoped` has nothing to buy. It gets its OWN reason rather than
    // reusing `already-scoped`: the two narrow on different axes (packs vs the
    // host's listing budget), and a caller reading the reason should be able to
    // tell which one the install is actually on.
    if (resolvedMode === 'tiered') return { eligible: false, reason: 'already-tiered' };
    const limit = limits.get(host);
    if (limit === undefined) return { eligible: false, reason: 'no-observation-for-host' };
    if (limit.projectedSkills === null) return { eligible: false, reason: 'observation-not-comparable' };
    if (limit.droppedEntries <= 0) return { eligible: false, reason: 'no-truncation-observed' };
    if (currentSkillCount < limit.projectedSkills) {
        return { eligible: false, reason: 'below-observed-skill-volume' };
    }
    return {
        eligible: true,
        reason: 'eligible',
        droppedEntries: limit.droppedEntries,
        observedAt: limit.observedAt,
    };
}

/**
 * The prompt body. Returns lines; WRITES NOTHING, by contract.
 *
 * `projection.mode` is settings class C, so `settings:set` refuses it by
 * construction and only a human edit or the GUI write route may set it. The
 * message therefore never offers a CLI write — suggesting one would send the
 * reader to a command guaranteed to reject them, which the council caught in
 * the first draft of this text.
 */
export function migrationPromptLines(
    host: string,
    eligibility: MigrationEligibility,
    settingsPath: string,
): string[] {
    return [
        `${host}: ${eligibility.droppedEntries} catalogue entries never reach the model.`,
        `Measured on this machine (${eligibility.observedAt}). This install is on \`legacy-all\`,`,
        'which ships everything and lets the host drop what does not fit — silently.',
        '',
        'Scoping the projection to your active packs is the alternative. Nothing here',
        'changes it for you: `projection.mode` is yours to set, by hand or in the GUI.',
        '',
        `  edit  ${settingsPath}`,
        '        projection:',
        '          mode: scoped',
        '',
        '  or    agent-config config      (Settings → projection)',
        '',
        'Keeping `legacy-all` is a legitimate choice — this is a notification, not a gate.',
    ];
}

/** Read the append-only observation log; a missing or broken line is skipped. */
export function readObservationLog(logPath: string): ObservationRecord[] {
    if (!fs.existsSync(logPath)) return [];
    const out: ObservationRecord[] = [];
    for (const line of fs.readFileSync(logPath, 'utf-8').split('\n')) {
        const trimmed = line.trim();
        if (trimmed.length === 0) continue;
        try {
            out.push(JSON.parse(trimmed) as ObservationRecord);
        } catch {
            continue;
        }
    }
    return out;
}

/**
 * Per-host verdicts — never one pooled verdict.
 *
 * Pooling a `per-entry` observation with a `budget-strip-and-drop` one would
 * report a selector verdict over a host that has no per-entry selector, which
 * is Risk 1 of the roadmap that asked for this field.
 */
export function formatPerHostVerdicts(records: readonly ObservationRecord[]): string {
    if (records.length === 0) return 'no observations recorded yet.';
    const byHost = new Map<string, ObservationRecord[]>();
    for (const record of records) {
        const bucket = byHost.get(record.host) ?? [];
        bucket.push(record);
        byHost.set(record.host, bucket);
    }

    const headline = headlineRecordPerHost(records);

    const lines: string[] = [];
    for (const host of [...byHost.keys()].sort()) {
        const bucket = byHost.get(host)!;
        // One selector for both reducers — see `_supersedes`. The previous
        // `>=` reduce here kept the FIRST of two same-date rows while
        // `knownHostLimits` kept the LAST, so one run printed two different
        // drop counts for one host on one day.
        const latest = headline.get(host)!;
        const mode = truncationModeOf(latest);
        lines.push(
            `${host}: ${bucket.length} observation(s) · mode ${mode} · ` +
                `source ${observationSourceOf(latest)} · latest ${latest.observed_at}`,
        );
        lines.push(
            mode === 'budget-strip-and-drop'
                ? `   offered ${latest.entries_total}, dropped ${latest.dropped_count ?? 'unknown'} — ` +
                      'no per-entry selector exists on this host; the quantity is the budget.'
                : `   verdict ${latest.verdict} · ${latest.bare_count} bare of ${latest.entries_total}`,
        );
    }

    const modes = new Set([...headline.values()].map((r) => truncationModeOf(r)));
    lines.push('');
    lines.push(
        modes.size > 1
            ? `hosts: ${byHost.size} · truncation modes DIFFER (${[...modes].sort().join(', ')}) — ` +
                  'a pooled verdict across them would describe neither host.'
            : `hosts: ${byHost.size} · all observed hosts truncate the same way (${[...modes][0] ?? 'none'}).`,
    );
    return lines.join('\n');
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

