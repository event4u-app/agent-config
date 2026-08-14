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
    /**
     * UTF-8 byte length of the declared description; 0 when absent.
     *
     * Separate from `descriptionLength` because a context budget is spent in
     * bytes while the selector candidates above are stated in characters, and
     * the two diverge on every non-ASCII description in the tree. Reporting one
     * under the other's name is how a limit claim ends up off by the size of
     * its own em-dashes.
     */
    descriptionBytes: number;
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
            descriptionBytes: Buffer.byteLength(description, 'utf-8'),
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
 * HOW a host truncated — the field that keeps one corpus from averaging two
 * unlike mechanisms into a verdict describing neither.
 *
 *   `per-entry`         — some entries arrive described and others bare, with
 *                         no host-stated rule. The claude shape. A selector, if
 *                         one exists, has to be INFERRED by joining projection
 *                         against observation, which is what `analyzeSelector`
 *                         does and why its `no-selector` verdict is meaningful.
 *   `budget-strip-all`  — the host states a budget, strips EVERY description,
 *                         then drops entries wholesale and reports how many.
 *                         The codex shape. Nothing needs inferring: the host
 *                         published its own selector, so running the inference
 *                         over it would produce `insufficient-observation`
 *                         (zero described entries) and read as a failed
 *                         measurement rather than a decisive one.
 *
 * Absent on a record written before 2026-08-15. That is left as `undefined`
 * rather than back-filled with a guess: the one pre-existing record was taken
 * before the distinction existed, and stamping a mode onto it would be a claim
 * about a mechanism nobody classified at the time.
 */
export type TruncationMode = 'per-entry' | 'budget-strip-all';

/**
 * Whether the numbers came from the agent reading its own context, or from the
 * host publishing them.
 *
 * This is the whole reason a second host was worth having, so it is a recorded
 * field rather than something a reader infers from `host`.
 */
export type ObservationKind = 'self-reported' | 'host-reported';

/** One append-only observation record. No field can hold free-form content. */
export interface ObservationRecord {
    schema: 1;
    observed_at: string;
    host: string;
    entries_total: number;
    bare_count: number;
    described_count: number;
    bare_names: string[];
    verdict: SelectorReport['verdict'] | 'host-declared-budget';
    separating_candidates: string[];
    /** Absent on records written before the mechanisms were distinguished. */
    truncation_mode?: TruncationMode;
    /** Entries the host reported dropping. Only ever host-reported. */
    dropped_count?: number;
    observation_kind?: ObservationKind;
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
        truncation_mode: 'per-entry',
        observation_kind: 'self-reported',
    };
}

// ── codex: the host publishes its own truncation ────────────────────────────

/**
 * The budget event codex emits on its structured channel.
 *
 * Matched against the STRUCTURED event's message, never the human-readable
 * stderr line — a reworded banner should make this parser fail loudly, and it
 * would silently match a looser regex over free text. The count is the only
 * number extracted; nothing else in the message is load-bearing.
 */
const _CODEX_BUDGET_RE =
    /Exceeded skills context budget\.\s*All skill descriptions were removed and (\d+) additional skills were not included/i;

export interface CodexTruncation {
    /** Entries the host said it dropped entirely. */
    readonly dropped: number;
}

/**
 * True when the host reported dropping more entries than the projection root
 * offers — i.e. the root does not cover the catalogue the host was counting.
 *
 * Worth its own predicate because the naive reading of that arithmetic is
 * "something is broken", and it is not: a host's catalogue is skills PLUS
 * commands plus whatever the working directory contributes, while a projection
 * root names one tree. A survivor count derived across that gap is not a
 * measurement, so the caller must say so rather than print the subtraction.
 */
export function codexProjectionUndercovers(
    truncation: CodexTruncation,
    entriesTotal: number,
): boolean {
    return truncation.dropped > entriesTotal;
}

/**
 * Parse a `codex exec --json` event stream for the budget event.
 *
 * Returns `null` when the stream carries no such event — which the caller MUST
 * treat as "not measured", never as zero. Risk 3 of the plan names this
 * exactly: a reworded or removed host message would otherwise report a clean
 * `dropped: 0`, and a fixed defect and a broken parser would look identical.
 *
 * Non-JSON lines are skipped rather than fatal: the stream is newline-delimited
 * JSON by contract, but a CLI is free to interleave a plain-text warning and
 * that is not this parser's business.
 */
export function parseCodexTruncation(stream: string): CodexTruncation | null {
    for (const line of stream.split('\n')) {
        const trimmed = line.trim();
        if (trimmed === '' || !trimmed.startsWith('{')) continue;
        let event: unknown;
        try {
            event = JSON.parse(trimmed);
        } catch {
            continue;
        }
        const item = (event as { item?: { type?: unknown; message?: unknown } }).item;
        if (item === undefined || item.type !== 'error' || typeof item.message !== 'string') {
            continue;
        }
        const m = _CODEX_BUDGET_RE.exec(item.message);
        if (m) {
            return { dropped: Number(m[1]) };
        }
    }
    return null;
}

/**
 * Build the codex-shaped observation.
 *
 * Deliberately does NOT run `analyzeSelector`. On this host the selector is not
 * something to infer — it is stated by the host, and every surviving entry is
 * bare by construction because the budget strips all descriptions first. Piping
 * it through the inference would report `insufficient-observation` (no described
 * entries to separate against), which is the pooled-verdict failure this
 * roadmap's Risk 1 exists to prevent.
 *
 * `entries_total` is the PROJECTED count — what the host was offered. `dropped`
 * is what it said it discarded. The survivors are the difference, and they are
 * all bare, so `bare_count` is a derived integer rather than a name list: the
 * host publishes a count, not an identity, and inventing names for it would be
 * a fabrication.
 */
export function buildCodexObservationRecord(
    truncation: CodexTruncation,
    entriesTotal: number,
    observedAt: string,
): ObservationRecord {
    // `dropped > entriesTotal` is NOT a rounding case to clamp away — it is the
    // measurement telling you the projection root under-covers what the host
    // counted, and it fired the first time this ran for real (297 skills
    // offered, 393 reported dropped, 2026-08-15). Clamping alone would have
    // published a confident `bare_count: 0`. `codexProjectionUndercovers`
    // below is what the caller reports instead; the clamp stays so the record
    // never carries a negative count, but it is the floor, not the finding.
    const survivors = Math.max(entriesTotal - truncation.dropped, 0);
    return {
        schema: 1,
        observed_at: observedAt,
        host: 'codex',
        entries_total: entriesTotal,
        bare_count: survivors,
        described_count: 0,
        bare_names: [],
        verdict: 'host-declared-budget',
        separating_candidates: ['host-declared-budget'],
        truncation_mode: 'budget-strip-all',
        dropped_count: truncation.dropped,
        observation_kind: 'host-reported',
    };
}

// ── projected volume — the input side, stated next to the observation ───────

/**
 * What a host is actually offered, in the units a budget is spent in.
 *
 * `description_bytes` is the payload a description-stripping host discards
 * first, so it is the number that predicts whether a budget-shaped truncation
 * fires at all — and it was being recomputed by hand in prose. Reporting it
 * beside the observation is what lets a later reader check a limit claim
 * against the measurement it came from rather than against a remembered figure.
 */
export interface ProjectedVolume {
    readonly root: string;
    readonly entries: number;
    readonly declares_description: number;
    readonly description_bytes: number;
}

/**
 * Command bodies under a tree — the OTHER half of a host catalogue.
 *
 * Split from the skill scan because the two have different membership rules (a
 * skill is a directory holding `SKILL.md`; a command is a markdown file, often
 * nested a group deep) and because leaving commands out is what produced the
 * first real run's contradiction: 297 skills offered against 393 reported
 * dropped. The host was never counting only skills.
 */
export function countCommandBodies(root: string): number {
    if (!fs.existsSync(root)) return 0;
    let total = 0;
    const walk = (dir: string): void => {
        for (const dirent of fs.readdirSync(dir, { withFileTypes: true })) {
            const abs = path.join(dir, dirent.name);
            // `existsSync`-style resolution rather than `isDirectory()`, for the
            // same symlink reason `readProjectedCatalogue` documents: these
            // trees are projections and a Dirent reports a symlinked directory
            // as not-a-directory.
            if (dirent.name.endsWith('.md')) {
                total += 1;
            } else if (fs.existsSync(path.join(abs, '.')) && fs.statSync(abs).isDirectory()) {
                walk(abs);
            }
        }
    };
    walk(root);
    return total;
}

export function projectedVolume(root: string): ProjectedVolume {
    const entries = readProjectedCatalogue(root);
    let bytes = 0;
    let described = 0;
    for (const entry of entries) {
        if (entry.hasDescription) {
            described += 1;
            bytes += entry.descriptionBytes;
        }
    }
    return { root, entries: entries.length, declares_description: described, description_bytes: bytes };
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

    // ── codex mode: the host reported its own truncation ────────────────────
    //
    // Deliberately consumes a CAPTURED stream rather than invoking `codex exec`
    // itself. Spending a model call from inside a measurement tool would make
    // the instrument itself billable and non-reproducible, and the operator
    // already has the stream from any ordinary run:
    //   codex exec --json --skip-git-repo-check - <<< 'reply OK' > events.jsonl
    const codexEventsPath = argValue('--codex-events');
    if (codexEventsPath) {
        const stream =
            codexEventsPath === '-'
                ? fs.readFileSync(0, 'utf-8')
                : fs.readFileSync(codexEventsPath, 'utf-8');
        const truncation = parseCodexTruncation(stream);
        if (truncation === null) {
            // NEVER a zero observation. An absent event means the parser did
            // not measure anything — a reworded host banner and a genuinely
            // untruncated catalogue must not produce the same record.
            process.stderr.write(
                '❌  no skills-context-budget event found in the codex stream.\n' +
                    '    This is "not measured", never "dropped 0" — a reworded or removed\n' +
                    '    host message looks exactly like a fixed defect from here, so the\n' +
                    '    honest outcome is a loud failure. Re-capture with:\n' +
                    "      codex exec --json --skip-git-repo-check - <<< 'reply OK' > events.jsonl\n",
            );
            return 1;
        }

        // The projection this host was offered. `--projection-root` because a
        // host's own estate (`~/.codex/skills`) is what IT was handed, which is
        // not this repo's `src/skills` — measuring the wrong tree would put a
        // confident, wrong denominator under the host's own dropped count.
        const projectionRoot = argValue('--projection-root');
        const volume = projectedVolume(projectionRoot ? resolveCatalogueRoot(projectionRoot) : root);
        // `--command-root` is optional but almost always required for a HONEST
        // denominator: a host budget spans skills and commands together, and a
        // skills-only count under-reports the estate by whatever the command
        // tree holds (200 of 497 on the machine this was first run on).
        const commandRoot = argValue('--command-root');
        const commandEntries = commandRoot ? countCommandBodies(commandRoot) : 0;
        const catalogueEntries = volume.entries + commandEntries;
        const stampedAt = argValue('--observed-at');
        const record = buildCodexObservationRecord(truncation, catalogueEntries, stampedAt ?? '');

        if (process.argv.includes('--json')) {
            process.stdout.write(`${JSON.stringify({ volume, record }, null, 2)}\n`);
        } else {
            const undercovers = codexProjectionUndercovers(truncation, catalogueEntries);
            const survivorLine = undercovers
                ? `  survived: NOT DERIVABLE — the host counted more than this root offers (see below)\n`
                : `  survived (all bare — the budget strips every description first): ${record.bare_count}\n`;
            process.stdout.write(
                `projection root: ${volume.root}\n` +
                    `skills offered: ${volume.entries}\n` +
                    (commandRoot ? `commands offered: ${commandEntries} (${commandRoot})\n` : '') +
                    `catalogue entries offered: ${catalogueEntries}` +
                    (commandRoot ? '\n' : '  ⚠️  skills only — pass --command-root for the full estate\n') +
                    `declares a description: ${volume.declares_description}\n` +
                    `description payload: ${volume.description_bytes} bytes\n\n` +
                    `host-reported truncation (codex):\n` +
                    `  dropped entirely: ${record.dropped_count}\n` +
                    survivorLine +
                    `  truncation_mode: ${record.truncation_mode}\n\n` +
                    (undercovers
                        ? `⚠️  projection under-coverage: the host reported dropping ${record.dropped_count} entries\n` +
                          `    while this root offers only ${volume.entries}. That is a fact about the ROOT,\n` +
                          `    not a broken measurement: a host catalogue spans skills AND commands and\n` +
                          `    also picks up whatever the working directory contributes. The dropped\n` +
                          `    count stands; the survivor count does not, and is recorded as the clamped\n` +
                          `    floor rather than published as a measurement.\n\n`
                        : '') +
                    `verdict: host-declared-budget — the selector is published by the host, not inferred.\n` +
                    `This is NOT poolable with a per-entry observation; read the two per host.\n`,
            );
        }

        if (process.argv.includes('--record')) {
            if (!stampedAt) {
                process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
                return 1;
            }
            const logPath = path.join(REPO, OBSERVATION_LOG);
            fs.mkdirSync(path.dirname(logPath), { recursive: true });
            fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);
            process.stdout.write(`\nrecorded → ${OBSERVATION_LOG}\n`);
        }
        return 0;
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
