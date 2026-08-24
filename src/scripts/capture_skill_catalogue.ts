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
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    DEFAULT_CATALOGUE_ROOTS,
    OBSERVATION_LOG,
    analyzeSelector,
    buildHostEventRecord,
    buildNoTruncationRecord,
    buildObservationRecord,
    classifyHostProjection,
    formatPerHostVerdicts,
    formatProjectionModes,
    formatReport,
    knownHostLimits,
    measureCatalogueVolume,
    parseHostBudgetEvent,
    readObservationLog,
    readProjectedCatalogue,
    resolveSkillsRoot,
    type HostProjectionRow,
    type ProjectionMode,
    type ProjectionModeCounts,
    type SelectorReport,
} from './_lib/skill_catalogue.js';
import {
    cadenceStatus,
    formatCadenceStatus,
    formatPointableBare,
    joinPointableBare,
    scopeFlagDecision,
} from './_lib/skill_catalogue_series.js';
import { scoped_projection_stats } from './_lib/scoped_projection.js';
import { iter_skills } from './update_counts.js';

// Re-exported so the CLI module stays the one public name for this tool —
// both halves, so the split into a series layer is an internal seam and not a
// second import path every consumer has to learn.
export * from './_lib/skill_catalogue.js';
export * from './_lib/skill_catalogue_series.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO = path.resolve(path.dirname(_HERE), '..', '..');

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

/** Every occurrence of a repeatable flag, in argv order. */
function argValues(flag: string): string[] {
    const out: string[] = [];
    for (let i = 0; i < process.argv.length - 1; i += 1) {
        if (process.argv[i] === flag) out.push(process.argv[i + 1]!);
    }
    return out;
}

/**
 * `--projection-mode <scoped|legacy-all>`, validated against the closed enum.
 *
 * Returns `undefined` when the flag is absent — which the record schema reads
 * as "not captured", never as `legacy-all`. An unrecognised value throws
 * rather than falling back: a typo silently recorded as the wrong mode is the
 * failure this whole module refuses elsewhere.
 */
function argProjectionMode(): ProjectionMode | undefined {
    const raw = argValue('--projection-mode');
    if (raw === null) return undefined;
    if (raw === 'scoped' || raw === 'legacy-all') return raw;
    throw new Error(`--projection-mode must be scoped or legacy-all, got: ${raw}`);
}

/** `~` expanded against the current user's home. */
function expandHome(p: string): string {
    return p.startsWith('~/') ? path.join(os.homedir(), p.slice(2)) : p;
}

/**
 * `--today <ISO>` for a deterministic run, else the machine's own date.
 *
 * Range-checked by round-trip, not by shape alone. `2026-13-45` matches the
 * pattern and then parses to `NaN`, which reaches `cadenceStatus` and makes
 * every host report `stamp unparseable (<the record's date>)` — a diagnostic
 * blaming the corpus for an operator typo.
 */
function argToday(): string {
    const explicit = argValue('--today');
    if (explicit) {
        const parsed = new Date(`${explicit}T00:00:00Z`);
        if (
            !/^\d{4}-\d{2}-\d{2}$/.test(explicit) ||
            Number.isNaN(parsed.getTime()) ||
            parsed.toISOString().slice(0, 10) !== explicit
        ) {
            throw new Error(`--today must be a real ISO date (YYYY-MM-DD), got: ${explicit}`);
        }
        return explicit;
    }
    return new Date().toISOString().slice(0, 10);
}

/**
 * `--cadence` — is an observation due on any host, and how far is the corpus?
 *
 * The recurring half of the capture. It reports and prints the next command; it
 * never records anything itself. Two reasons, both deliberate: recording is what
 * `--host-event --record` and `--observed --record` already do, and a mode that
 * both decides freshness AND writes a record could refresh a series with a
 * reading nobody took.
 *
 * The asymmetry between the hosts is printed rather than smoothed over. The
 * codex round is one shell pipeline and can be scheduled; the claude round needs
 * an agent to read its own delivered context, which no scheduler can do.
 */
function runCadenceMode(): number {
    const today = argToday();
    const records = readObservationLog(path.join(REPO, OBSERVATION_LOG));
    const rows = cadenceStatus(records, today);

    if (process.argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    today,
                    // `daysSince` is NaN when a record's stamp is unparseable, and
                    // `JSON.stringify(NaN)` emits `null` — indistinguishable from an
                    // absent field to a machine consumer. This module states every
                    // other absence explicitly, so this one is stated too.
                    hosts: rows.map((row) => ({
                        ...row,
                        daysSince: Number.isNaN(row.daysSince) ? null : row.daysSince,
                        daysSinceKnown: !Number.isNaN(row.daysSince),
                    })),
                },
                null,
                2,
            )}\n`,
        );
        return 0;
    }

    process.stdout.write(`${formatCadenceStatus(rows, today)}\n`);

    if (rows.length === 0) {
        // The one state in which every host is maximally overdue is the state
        // with no host to name: `cadenceStatus` only knows hosts it has already
        // seen. Saying so beats printing a "next round" header over nothing.
        process.stdout.write(
            '\nno host is known yet, so no next command can be named — the corpus has never been\n' +
                'written to. Take a first observation on any host, then this mode has a series to keep current.\n',
        );
        return 0;
    }

    const due = rows.filter((row) => row.due);
    if (due.length === 0) return 0;

    // ONE walk, hoisted: `projectionModeCounts` parses the frontmatter of every
    // skill in the tree, and the counts are a property of the package, not of
    // the host being reported — calling it per due host walked the tree twice
    // for a value that cannot differ, against its own docstring.
    const counts = projectionModeCounts();

    process.stdout.write('\nnext round — run what is due:\n\n');
    for (const row of due) {
        const scopeFlag = projectionModeFlagFor(row.host, counts);
        // Keyed on the HOST, never on the latest record's source. Only codex is
        // known to publish a parseable budget event, and `row.source` comes from
        // a single headline record whose same-date tie `_supersedes` breaks on
        // `dropped_count` — a self-report record has none, so one same-date
        // host-event row could flip a self-report host onto the codex pipeline
        // and record codex's truncation under another host's name.
        if (row.host === 'codex') {
            process.stdout.write(
                `  # ${row.host} — deterministic, read off the host's own JSON channel\n` +
                    `  codex exec --json --skip-git-repo-check "reply with exactly: OK" \\\n` +
                    `    | agent-config exec capture_skill_catalogue \\\n` +
                    `        --host-event - --host ${row.host} --host-root ~/.${row.host} \\\n` +
                    `        ${scopeFlag.flag}--record --observed-at ${today}\n` +
                    `${scopeFlag.note}\n`,
            );
            continue;
        }
        process.stdout.write(
            `  # ${row.host} — self-report; only an agent reading its own context can produce it.\n` +
                `  # Write the entries seen bare and the ones seen described, one name per line, to\n` +
                `  #   agents/evidence/metrics/skill-catalogue/${today}-${row.host}-{bare,described}.txt\n` +
                `  agent-config exec capture_skill_catalogue \\\n` +
                `      --observed agents/evidence/metrics/skill-catalogue/${today}-${row.host}-bare.txt \\\n` +
                `      --described agents/evidence/metrics/skill-catalogue/${today}-${row.host}-described.txt \\\n` +
                `      --host ${row.host} ${scopeFlag.flag}--record --observed-at ${today}\n` +
                `${scopeFlag.note}\n`,
        );
    }
    return 0;
}

/**
 * The `--projection-mode` flag for one host's round, MEASURED off its installed
 * root — or omitted, with the reason, when the root carries neither mode count.
 *
 * Printing `--projection-mode <scoped|legacy-all>` as a placeholder invites the
 * operator to pick one, and on an `indeterminate` root either pick is a label
 * nobody measured. Measured 2026-08-18 on this machine: `~/.codex` holds 297
 * skills against a scoped projection of 219 and a legacy-all of 290 — it matches
 * neither, because it is a stale install rather than a broken one. So the honest
 * output for that root is no flag and a stated reason, which keeps the record's
 * absent-scope field meaning "not determinable" instead of "not asked".
 */
function projectionModeFlagFor(host: string, counts: ProjectionModeCounts): { flag: string; note: string } {
    const root = expandHome(`~/.${host}`);
    const exists = fs.existsSync(root);
    const decision = scopeFlagDecision(
        root,
        exists,
        exists ? classifyHostProjection(measureCatalogueVolume(host, root), counts) : null,
    );
    const wrapped = decision.reason
        .split(/(?<=\.) (?=[A-Z])/)
        .map((part) => `  #   ${part}`)
        .join('\n');
    return decision.mode === null
        ? { flag: '', note: `  #   no --projection-mode:\n${wrapped}\n` }
        : { flag: `--projection-mode ${decision.mode} `, note: `${wrapped}\n` };
}

/**
 * `--pointable-bare` — the D-4 join: host truth against disk truth.
 *
 * Intersects the bare names of every per-entry observation with the catalogue
 * the runtime ranker reads, and publishes how many skills the ranker can name
 * while the model never received their description.
 *
 * `--catalogue-root` is honoured here, through the SAME resolver the main path
 * uses. Two resolvers over one catalogue is how the ranker and the tool that
 * reports on it start reading different trees — `resolveSkillsRoot`'s own
 * docstring names that hazard — and silently ignoring the flag in one mode is
 * exactly that split inside a single invocation.
 */
function runPointableBareMode(): number {
    const explicitRoot = argValue('--catalogue-root');
    const rankerRoot = explicitRoot ? resolveCatalogueRoot(explicitRoot) : resolveSkillsRoot(REPO);
    if (rankerRoot === null) {
        process.stderr.write(
            '❌  no catalogue root resolved for the ranker — tried ' +
                `${DEFAULT_CATALOGUE_ROOTS.join(', ')} under ${REPO}.\n` +
                '    An empty catalogue is never a clean join: it would report 0 pointable\n' +
                '    entries because nothing was read, not because nothing diverged.\n',
        );
        return 1;
    }
    const catalogueNames = readProjectedCatalogue(rankerRoot).map((entry) => entry.name);
    // The guard the error text above already promised, and did not have. A
    // present-but-empty or half-generated projection resolves fine — the
    // resolver returns the first EXISTING directory, not the first non-empty
    // one — and then every row scores 0 pointable off a catalogue nobody read,
    // printing a clean D-4 verdict. That is the zero-inferred-from-silence this
    // module's header forbids outright, and the sibling path guards it the same
    // way.
    if (catalogueNames.length === 0) {
        process.stderr.write(
            `❌  the ranker catalogue at ${rankerRoot} holds no entries.\n` +
                '    An empty catalogue is never a clean join: every observation would score 0\n' +
                '    pointable because nothing was read, not because nothing diverged.\n',
        );
        return 1;
    }
    const records = readObservationLog(path.join(REPO, OBSERVATION_LOG));
    const join = joinPointableBare(records, catalogueNames);

    if (process.argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify(
                {
                    ranker_catalogue_root: path.relative(REPO, rankerRoot) || rankerRoot,
                    ranker_catalogue_entries: catalogueNames.length,
                    // The disk side carries the same scope discipline the host
                    // side does: `pointableBare` grows with a stale-large root,
                    // so which projection the join ran against is recorded
                    // rather than left to the entry count to imply.
                    ranker_catalogue_projection: classifyHostProjection(
                        measureCatalogueVolume('ranker', rankerRoot),
                        projectionModeCounts(),
                    ).matches,
                    skipped_non_per_entry: join.skippedNonPerEntry,
                    skipped_malformed: join.skippedMalformed,
                    observations: join.rows,
                },
                null,
                2,
            )}\n`,
        );
        return 0;
    }

    process.stdout.write(
        `${formatPointableBare(join, path.relative(REPO, rankerRoot) || rankerRoot, catalogueNames.length)}\n`,
    );
    return 0;
}

/**
 * `--limits` — publish the per-host picture: what each host was measured to
 * deliver, and whether the observed hosts truncate the same way.
 */
function runLimitsMode(): number {
    const records = readObservationLog(path.join(REPO, OBSERVATION_LOG));
    const limits = knownHostLimits(records);

    if (process.argv.includes('--json')) {
        process.stdout.write(
            `${JSON.stringify({ hosts: [...limits.values()], observations: records.length }, null, 2)}\n`,
        );
        return 0;
    }

    process.stdout.write(`${formatPerHostVerdicts(records)}\n\n`);
    if (limits.size === 0) {
        process.stdout.write(
            'measured truncations: none.\nOnly a host that publishes its own dropped count yields one; a\nself-reported observation states which entries arrived bare, which is a\nselector question, not a ceiling.\n',
        );
        return 0;
    }
    process.stdout.write('measured truncations:\n');
    for (const limit of [...limits.values()].sort((a, b) => a.host.localeCompare(b.host))) {
        process.stdout.write(
            `  ${limit.host}: dropped ${limit.droppedEntries} entries on ${limit.observedAt}, ` +
                `at a projection of ${limit.projectedVolume}\n`,
        );
    }
    return 0;
}

/**
 * `--projection-modes` — the two modes side by side, as a MEASUREMENT.
 *
 * It reads no setting, writes no setting, and recommends no default. The
 * scoped-projection default and its migration notice are owned by a different
 * roadmap and were decided on 2026-08-15; this mode exists so the size of the
 * difference is a published number instead of an intuition, and it deliberately
 * offers no flag that would change anything.
 *
 * `--host-root` is repeatable, so several installed hosts are read against the
 * same pair of numbers in one run. Each host is reported on its own row: no
 * host's count is ever used to say anything about another's.
 */
/** The package's two projection-mode counts, one walk. Shared by both modes. */
function projectionModeCounts(): ProjectionModeCounts {
    const stats = scoped_projection_stats(REPO, iter_skills());
    // The tier split is a per-machine runtime artefact (gitignored), so absent is
    // the normal state and must read as "unmeasured", never as zero.
    let tierACount: number | null = null;
    let tierBCount: number | null = null;
    const tiersFile = path.join(REPO, 'agents', 'runtime', 'state', 'skill-tiers.json');
    if (fs.existsSync(tiersFile)) {
        try {
            const parsed = JSON.parse(fs.readFileSync(tiersFile, 'utf-8')) as {
                tier_a?: unknown;
                tier_b?: unknown;
            };
            if (Array.isArray(parsed.tier_a) && Array.isArray(parsed.tier_b)) {
                tierACount = parsed.tier_a.length;
                tierBCount = parsed.tier_b.length;
            }
        } catch {
            /* a malformed split is an absent split — never a partial count */
        }
    }
    return {
        scoped: stats.projected,
        legacyAll: stats.total,
        prunedUnderScoped: stats.pruned,
        activePacks: stats.active_packs,
        tierACount,
        tierBCount,
    };
}

function runProjectionModesMode(): number {
    const counts = projectionModeCounts();

    const rows: HostProjectionRow[] = [];
    for (const rootArg of argValues('--host-root')) {
        const root = expandHome(rootArg);
        if (!fs.existsSync(root)) {
            process.stderr.write(`❌  host root does not exist: ${root}\n`);
            return 1;
        }
        const host = path.basename(root).replace(/^\./, '');
        rows.push(classifyHostProjection(measureCatalogueVolume(host, root), counts));
    }

    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify({ counts, hosts: rows }, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(`${formatProjectionModes(counts, rows)}\n`);
    return 0;
}

/** `--volume <host-root>` — the projection half for one host, byte-accurate. */
function runVolumeMode(rootArg: string): number {
    const root = expandHome(rootArg);
    if (!fs.existsSync(root)) {
        process.stderr.write(`❌  host root does not exist: ${root}\n`);
        return 1;
    }
    const volume = measureCatalogueVolume(argValue('--host') ?? path.basename(root).replace(/^\./, ''), root);
    if (process.argv.includes('--json')) {
        process.stdout.write(`${JSON.stringify(volume, null, 2)}\n`);
        return 0;
    }
    process.stdout.write(
        `host: ${volume.host}\nroot: ${volume.root}\n` +
            `skill entries: ${volume.skillEntries}\ncommand entries: ${volume.commandEntries}\n` +
            `artefacts offered: ${volume.artefacts}\n` +
            `description payload: ${volume.descriptionBytes} bytes\n\n` +
            'This is the PROJECTION half — what the host is offered, not what it delivered.\n',
    );
    return 0;
}

/**
 * `--host-event <file|->` — record what the host itself published.
 *
 * The deterministic path. `-` reads stdin, so the capture composes directly:
 *   codex exec --json --skip-git-repo-check "reply with exactly: OK" \
 *     | capture_skill_catalogue --host-event - --host codex --host-root ~/.codex
 */
function runHostEventMode(source: string): number {
    const stream =
        source === '-'
            ? fs.readFileSync(0, 'utf-8')
            : fs.readFileSync(expandHome(source), 'utf-8');

    const hostRootArg = argValue('--host-root');
    if (!hostRootArg) {
        process.stderr.write(
            '❌  --host-event requires --host-root <dir> — the dropped count is only\n' +
                '    meaningful against the number of artefacts the host was offered.\n',
        );
        return 1;
    }
    const host = argValue('--host') ?? 'unknown';
    const volume = measureCatalogueVolume(host, expandHome(hostRootArg));
    if (volume.artefacts === 0) {
        process.stderr.write(`❌  host root ${volume.root} offers no catalogue artefacts\n`);
        return 1;
    }

    const event = parseHostBudgetEvent(stream);
    if (event === null) {
        if (!process.argv.includes('--assert-no-truncation')) {
            process.stderr.write(
                '❌  no parseable skills-budget event in this stream.\n' +
                    '    That is UNKNOWN, not zero: a reworded or removed host message looks\n' +
                    '    exactly like a fixed defect. If this run genuinely did not truncate,\n' +
                    '    say so with --assert-no-truncation.\n',
            );
            return 1;
        }
        process.stdout.write(
            `host: ${host}\noffered: ${volume.artefacts} (${volume.skillEntries} skills + ${volume.commandEntries} commands)\n` +
                `dropped: 0 (asserted — no budget event in the stream)\n` +
                'descriptions stripped: no — the host published nothing to strip.\n',
        );
        if (process.argv.includes('--record')) {
            const stampedAt = argValue('--observed-at');
            if (!stampedAt) {
                process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
                return 1;
            }
            const logPath = path.join(REPO, OBSERVATION_LOG);
            fs.mkdirSync(path.dirname(logPath), { recursive: true });
            fs.appendFileSync(
                logPath,
                `${JSON.stringify(
                    buildNoTruncationRecord(
                        host,
                        stampedAt,
                        volume.artefacts,
                        volume.skillEntries,
                        argProjectionMode(),
                    ),
                )}\n`,
            );
            process.stdout.write(`recorded → ${OBSERVATION_LOG}\n`);
        }
        return 0;
    }

    process.stdout.write(
        `host: ${host}\nroot: ${volume.root}\n` +
            `artefacts offered: ${volume.artefacts} (${volume.skillEntries} skills + ${volume.commandEntries} commands)\n` +
            `description payload: ${volume.descriptionBytes} bytes\n` +
            `dropped by the host: ${event.droppedCount}\n` +
            `descriptions stripped: ${event.descriptionsStripped ? 'yes — all of them' : 'no'}\n\n` +
            'Source: host-event (read from the host\'s own JSON channel, not self-reported).\n' +
            'No delivered count is printed: the offered figure above is THIS tool\'s\n' +
            'projection and the dropped figure is the host\'s, and a controlled probe\n' +
            'showed they do not share a denominator. Subtracting them would invent a number.\n',
    );

    if (process.argv.includes('--record')) {
        const stampedAt = argValue('--observed-at');
        if (!stampedAt) {
            process.stderr.write('❌  --record requires --observed-at <ISO date>\n');
            return 1;
        }
        const logPath = path.join(REPO, OBSERVATION_LOG);
        fs.mkdirSync(path.dirname(logPath), { recursive: true });
        const record = buildHostEventRecord(
            host,
            stampedAt,
            volume.artefacts,
            event,
            volume.skillEntries,
            argProjectionMode(),
        );
        fs.appendFileSync(logPath, `${JSON.stringify(record)}\n`);
        process.stdout.write(`recorded → ${OBSERVATION_LOG}\n`);
    }
    return 0;
}

function main(): number {
    if (process.argv.includes('--cadence')) return runCadenceMode();
    if (process.argv.includes('--pointable-bare')) return runPointableBareMode();
    if (process.argv.includes('--limits')) return runLimitsMode();
    if (process.argv.includes('--projection-modes')) return runProjectionModesMode();

    const volumeRoot = argValue('--volume');
    if (volumeRoot) return runVolumeMode(volumeRoot);

    const hostEvent = argValue('--host-event');
    if (hostEvent) return runHostEventMode(hostEvent);

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
        const projectionMode = argProjectionMode();
        if (projectionMode === undefined) {
            // A WARNING, not a refusal. Recording without the scope is a
            // legitimate reading — the record type says absence is not
            // `legacy-all` and a consumer comparing modes skips it — so
            // rejecting it would refuse an observation to protect a
            // comparison. But an unscoped record is silently incomparable,
            // which is the failure this line exists to make loud.
            process.stdout.write(
                '\n⚠️  no --projection-mode given: this record will carry no projection scope.\n' +
                    '    Absence is NOT `legacy-all` — a mode comparison skips a record that\n' +
                    '    carries none, so the observation stays outside that series. Pass\n' +
                    '    --projection-mode <scoped|legacy-all> to keep it comparable.\n',
            );
        }
        fs.appendFileSync(
            logPath,
            // The catalogue root IS the skill tree, so every projected entry is
            // a skill: the count is file-measured, not derived from the
            // artefact total the way a host root's would be.
            `${JSON.stringify(buildObservationRecord(report, host, stampedAt, projected.length, projectionMode))}\n`,
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
