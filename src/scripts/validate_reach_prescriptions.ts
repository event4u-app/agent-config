#!/usr/bin/env tsx
/**
 * validate_reach_prescriptions.ts — mechanized supply-chain gate for the reach
 * install prescriptions (road-to-internet-reach Phase 3, Steps 1 + 5).
 *
 * WHY THIS EXISTS. The roadmap's first draft asserted "every prescription
 * passes the supply-chain-intake gate inline" with no mechanism. An honour
 * system is not a differentiator, so the claim is machine-checked here: a
 * prescription that is unpinned, points at a moving target, or names a tool
 * nobody recorded an intake check for makes CI red.
 *
 * OFFLINE AND DETERMINISTIC BY CONSTRUCTION — a hard architectural constraint,
 * not a preference. The Class A boundary (docs/contracts/no-runtime-boundary.md,
 * ADR-124) forbids network access in the build path, and a lint that phones
 * PyPI is a flaky lint. Registry existence and CVE state therefore come from
 * the COMMITTED intake record (src/config/reach-prescriptions-intake.yml),
 * never from a live fetch. This script spawns nothing and opens no socket.
 *
 * WHAT IT CHECKS
 *   (a) unpinned-install     — an install string with no version specifier and
 *                              no explicit `os-baseline:` sentinel.
 *   (b) moving-target-source — `latest` / `main` / `master` / `HEAD`, an
 *                              `archive/` path, or a `.zip` / `.tgz` /
 *                              `.tar.gz` / `.tar.xz` source.
 *   (c) unrecorded-package   — a backend that prescribes an external install
 *                              but has no entry in the intake record.
 *   plus pin-drift and package-name-mismatch (the registry pin and the package
 *   identifier must be the ones the intake record actually verified — this is
 *   the traceability half, which no schema can express), intake-record
 *   integrity (checklist fields, ISO dates, at least one recorded verification
 *   command), and the repo-wide grep gate below.
 *
 * GREP GATE SCOPE — deliberately narrow, and stated here because an unbounded
 * "no unpinned install anywhere" sweep becomes a false-positive machine that
 * gets suppressed and then means nothing:
 *   1. `src/config/reach-*.yml`  — every reach config file, in full.
 *   2. `docs/**\/*.md`           — reach material ONLY: the whole file when its
 *      name contains `reach`, otherwise just the heading sections whose heading
 *      text mentions reach (through to the next heading at the same or higher
 *      level). Non-reach documentation is out of scope on purpose.
 * Two classes are rejected inside that scope: an unpinned install command, and
 * a pipe-remote-to-shell instruction (`curl … | sh`, `wget … | bash`,
 * `iwr … | iex`). The shipped-skill leg of the roadmap's scope list is absent
 * because the Phase 0 verdict (`band: stop`) cancelled the skill — there is no
 * `src/skills/internet-reach/` to scan.
 *
 * REUSE, NOT DUPLICATION. Schema validation belongs to
 * check_reach_channels.ts; this script imports its loader and its validator
 * for a pre-flight instead of re-implementing either. What it adds is the
 * cross-file reasoning (registry ↔ intake record) and the surface sweep.
 *
 * Exit codes:
 *   0 — clean.
 *   1 — at least one violation.
 *   3 — internal error: a target file is missing, unreadable, or unparseable.
 *
 * Invocation (from project root):
 *   tsx src/scripts/validate_reach_prescriptions.ts [<path-to-registry-yml>]
 *       [--intake <path>] [--quiet] [--help]
 *
 * The optional path argument is what lets the negative fixtures under
 * `tests/fixtures/reach-prescriptions/` run through the same code path as the
 * real registry. When it is given, the grep gate narrows to that one file (the
 * fixture IS the surface under test); the full scope above is swept only for
 * the real registry.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

import {
    RegistryLoadError,
    load_registry,
    sanitizeParseError,
    validate_file,
} from './check_reach_channels.js';

const _HERE = fileURLToPath(import.meta.url);
/** Repo root — two dirs up from src/scripts. */
const ROOT = path.resolve(path.dirname(_HERE), '..', '..');

export const REGISTRY_PATH = path.join(ROOT, 'src', 'config', 'reach-channels.yml');
export const INTAKE_PATH = path.join(ROOT, 'src', 'config', 'reach-prescriptions-intake.yml');

/** Every finding carries the locator that makes it actionable without a grep. */
export interface Finding {
    /** `channels[github].backends[gh].install.darwin` or `docs/x.md:42`. */
    readonly locator: string;
    /** Machine-stable violation class — tests assert on this, not on prose. */
    readonly kind:
        | 'schema'
        | 'unpinned-install'
        | 'moving-target-source'
        | 'unrecorded-package'
        | 'pin-drift'
        | 'package-name-mismatch'
        | 'intake-record'
        | 'pipe-to-shell';
    readonly message: string;
}

// --- pinning grammar -------------------------------------------------------
// Mirrors the install pattern in src/scripts/schemas/reach-channels.schema.json
// (that pattern is the pass/fail gate; these named checks say WHICH token made
// a string unacceptable, which a JSON-Schema `pattern` cannot report).

/** `name==1.2.3`, `node@22`, `--version 2.96.0`, or a bare `1.2.3` triple. */
const VERSION_PIN_RE =
    /(?:==|@|=)v?\d+(?:\.\d+)*|--version[ =]v?\d+(?:\.\d+)*|\sv?\d+\.\d+\.\d+/;

/** Declared non-install: a tool the platform ships, with the reason inline. */
const OS_BASELINE_RE = /^os-baseline:\s*\S/;

/** Sources whose contents can change under a fixed reference. */
const MOVING_TARGET_PATTERNS: readonly (readonly [string, RegExp])[] = [
    ['latest', /\blatest\b/],
    ['main', /\bmain\b/],
    ['master', /\bmaster\b/],
    ['HEAD', /\bHEAD\b/],
    ['archive/ path', /archive\//],
    ['.zip archive', /\.zip\b/],
    ['.tgz archive', /\.tgz\b/],
    ['.tar.gz archive', /\.tar\.gz\b/],
    ['.tar.xz archive', /\.tar\.xz\b/],
];

/** A package-manager install invocation, in a command or a doc code span. */
const INSTALL_VERB_RE =
    /\b(?:brew|pipx|pip3?|npm|pnpm|yarn|apt-get|apt|dnf|yum|apk|zypper|pacman|winget|choco|scoop|asdf|cargo|go|gem|uv|uvx)\s+(?:-{1,2}\S+\s+)*(?:install|add|get|i)\b/i;

/** `curl … | sh` and relatives — fetch straight into an interpreter. */
const PIPE_TO_SHELL_RE =
    /\b(?:curl|wget|iwr|invoke-webrequest|fetch)\b[^|\n]*\|\s*(?:sudo\s+)?(?:\S*\/)?(?:sh|bash|zsh|dash|ksh|fish|pwsh|powershell|iex|invoke-expression|python3?|perl|ruby|node)\b/i;

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Checklist fields every `tools:` entry must carry, per supply-chain-intake. */
const INTAKE_CHECKLIST_FIELDS = [
    'existence_verified',
    'pinned',
    'lockfile_note',
    'cve_note',
] as const;

export function has_version_pin(command: string): boolean {
    return VERSION_PIN_RE.test(command);
}

export function is_os_baseline(command: string): boolean {
    return OS_BASELINE_RE.test(command.trim());
}

/** Every moving-target token present in the string, in declaration order. */
export function moving_targets(command: string): string[] {
    return MOVING_TARGET_PATTERNS.filter(([, re]) => re.test(command)).map(([label]) => label);
}

// --- intake record ---------------------------------------------------------

export interface IntakeVerification {
    readonly command: string;
    readonly source?: string;
    readonly observed?: string;
}

export interface IntakeTool {
    readonly backend: string;
    readonly pinned_version: string;
    readonly packages: readonly { registry: string; package: string }[];
    readonly intake: Record<string, string>;
    readonly verified_on: string;
    readonly verification: readonly IntakeVerification[];
}

export interface IntakeRecord {
    readonly tools: readonly IntakeTool[];
    /** Declared non-installs: tool name → true. */
    readonly os_baseline: readonly { tool: string }[];
}

function as_object(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
}

/** Parse the intake record. Throws RegistryLoadError when it is unusable. */
export function load_intake(intakePath: string = INTAKE_PATH): IntakeRecord {
    if (!fs.existsSync(intakePath)) {
        throw new RegistryLoadError(`intake record not found: ${intakePath}`);
    }
    let parsed: unknown;
    try {
        parsed = parseYaml(fs.readFileSync(intakePath, 'utf-8'));
    } catch (err) {
        // `sanitizeParseError`, not `String(err)`: a YAMLParseError stringifies
        // with the offending source line and a caret, which would make
        // `--intake <any-file>` an arbitrary-file-read oracle.
        throw new RegistryLoadError(
            `intake record is not parseable YAML: ${intakePath}: ${sanitizeParseError(err)}`,
        );
    }
    const root = as_object(parsed);
    if (!root) {
        throw new RegistryLoadError(`intake record is not a YAML mapping: ${intakePath}`);
    }
    const tools = Array.isArray(root.tools) ? (root.tools as IntakeTool[]) : [];
    const baseline = Array.isArray(root.os_baseline)
        ? (root.os_baseline as { tool: string }[])
        : [];
    return { tools, os_baseline: baseline };
}

/**
 * Integrity of the record itself. A record whose entries are half-filled would
 * silently satisfy the cross-checks below, so it is validated first.
 */
export function check_intake_record(intake: IntakeRecord): Finding[] {
    const findings: Finding[] = [];
    if (intake.tools.length === 0 && intake.os_baseline.length === 0) {
        findings.push({
            locator: 'reach-prescriptions-intake.yml',
            kind: 'intake-record',
            message: 'record declares neither `tools:` nor `os_baseline:` — nothing is recorded',
        });
    }

    intake.tools.forEach((tool, index) => {
        const at = `tools[${tool?.backend ?? index}]`;
        if (!tool?.backend) {
            findings.push({
                locator: at,
                kind: 'intake-record',
                message: 'entry has no `backend:` — it cannot be matched to a registry backend',
            });
            return;
        }
        if (!tool.pinned_version) {
            findings.push({
                locator: at,
                kind: 'intake-record',
                message: 'entry has no `pinned_version:` — the pin it verified is unknown',
            });
        }
        if (!Array.isArray(tool.packages) || tool.packages.length === 0) {
            findings.push({
                locator: at,
                kind: 'intake-record',
                message: 'entry declares no `packages:` — the verified package identity is unknown',
            });
        }
        const checklist = as_object(tool.intake) ?? {};
        for (const field of INTAKE_CHECKLIST_FIELDS) {
            const value = checklist[field];
            if (typeof value !== 'string' || value.trim() === '') {
                findings.push({
                    locator: `${at}.intake.${field}`,
                    kind: 'intake-record',
                    message: `supply-chain-intake checklist outcome \`${field}\` is missing or empty`,
                });
            }
        }
        if (!ISO_DATE_RE.test(String(tool.verified_on ?? ''))) {
            findings.push({
                locator: `${at}.verified_on`,
                kind: 'intake-record',
                message: `\`verified_on\` must be a quoted ISO date (YYYY-MM-DD), got ${JSON.stringify(tool.verified_on ?? null)}`,
            });
        }
        const verifications = Array.isArray(tool.verification) ? tool.verification : [];
        if (verifications.filter((entry) => Boolean(entry?.command)).length === 0) {
            findings.push({
                locator: `${at}.verification`,
                kind: 'intake-record',
                message:
                    'no `verification:` entry with a `command:` — the check is an assertion, not evidence',
            });
        }
    });

    return findings;
}

// --- registry prescriptions ------------------------------------------------

export interface Prescription {
    readonly channel: string;
    readonly backend: string;
    readonly platform: string;
    readonly command: string;
    readonly locator: string;
}

/**
 * Flatten every install string in the registry. Defensive by design: a
 * malformed registry is reported by the schema pre-flight, so anything
 * unexpected here is skipped rather than thrown.
 */
export function extract_prescriptions(registry: unknown): Prescription[] {
    const out: Prescription[] = [];
    const root = as_object(registry);
    const channels = Array.isArray(root?.channels) ? root.channels : [];
    channels.forEach((rawChannel, channelIndex) => {
        const channel = as_object(rawChannel);
        if (!channel) {
            return;
        }
        const channelId = typeof channel.id === 'string' ? channel.id : `#${channelIndex}`;
        const backends = Array.isArray(channel.backends) ? channel.backends : [];
        backends.forEach((rawBackend, backendIndex) => {
            const backend = as_object(rawBackend);
            if (!backend) {
                return;
            }
            const backendId = typeof backend.id === 'string' ? backend.id : `#${backendIndex}`;
            const install = as_object(backend.install) ?? {};
            for (const [platform, command] of Object.entries(install)) {
                if (typeof command !== 'string') {
                    continue;
                }
                out.push({
                    channel: channelId,
                    backend: backendId,
                    platform,
                    command,
                    locator: `channels[${channelId}].backends[${backendId}].install.${platform}`,
                });
            }
        });
    });
    return out;
}

/**
 * The three roadmap rules plus the two traceability cross-checks.
 *
 * Checks are ordered so each string yields ONE primary finding: a moving-target
 * source short-circuits the pin check (a pinned tarball URL is still a moving
 * target), and an unpinned string short-circuits the pin-drift comparison
 * (there is no pin to compare).
 */
export function check_prescriptions(registry: unknown, intake: IntakeRecord): Finding[] {
    const findings: Finding[] = [];
    const byBackend = new Map(intake.tools.map((tool) => [tool.backend, tool]));
    const baseline = new Set(intake.os_baseline.map((entry) => entry?.tool).filter(Boolean));

    for (const prescription of extract_prescriptions(registry)) {
        const { command, locator, backend, channel } = prescription;
        const recorded = byBackend.get(backend);
        const declaredBaseline = baseline.has(backend);

        const moving = moving_targets(command);
        if (moving.length > 0) {
            findings.push({
                locator,
                kind: 'moving-target-source',
                message: `install source is a moving target (${moving.join(', ')}): ${JSON.stringify(command)} — pin an immutable release instead`,
            });
            continue;
        }

        if (is_os_baseline(command)) {
            // A declared non-install. It still may not name a moving target
            // (checked above) and still needs its tool declared as a baseline.
            if (!declaredBaseline && !recorded) {
                findings.push({
                    locator,
                    kind: 'unrecorded-package',
                    message: `backend \`${backend}\` (channel \`${channel}\`) claims an \`os-baseline:\` exemption but is not declared under \`os_baseline:\` in the intake record`,
                });
            }
            continue;
        }

        if (!has_version_pin(command)) {
            findings.push({
                locator,
                kind: 'unpinned-install',
                message: `install command carries no version specifier: ${JSON.stringify(command)} — pin it exactly, or declare an \`os-baseline:\` exemption with the reason`,
            });
            continue;
        }

        // A real, pinned package install: it needs a recorded intake check.
        if (!recorded) {
            if (declaredBaseline) {
                // Baseline tools may carry one pinned convenience prescription
                // (e.g. a versioned Homebrew formula); the baseline declaration
                // covers it.
                continue;
            }
            findings.push({
                locator,
                kind: 'unrecorded-package',
                message: `backend \`${backend}\` (channel \`${channel}\`) prescribes an external install but has no entry in the intake record — add one to src/config/reach-prescriptions-intake.yml (supply-chain-intake checklist) or the prescription cannot ship`,
            });
            continue;
        }

        if (!command.includes(recorded.pinned_version)) {
            findings.push({
                locator,
                kind: 'pin-drift',
                message: `install pins a version the intake record did not verify (record: ${recorded.pinned_version}): ${JSON.stringify(command)}`,
            });
            continue;
        }

        const names = (recorded.packages ?? []).map((entry) => entry?.package).filter(Boolean);
        if (names.length > 0 && !names.some((name) => command.includes(name))) {
            findings.push({
                locator,
                kind: 'package-name-mismatch',
                message: `install names no package the intake record verified (recorded: ${names.join(', ')}): ${JSON.stringify(command)}`,
            });
        }
    }

    return findings;
}

// --- grep gate over shipped reach surfaces ---------------------------------

/** A heading whose text mentions reach opens an in-scope docs section. */
const REACH_HEADING_RE = /^(#{1,6})\s+.*\breach\b/i;
const ANY_HEADING_RE = /^(#{1,6})\s+/;

/**
 * Line numbers (1-based) of a markdown file that count as reach material.
 * Whole file when its name mentions reach; otherwise the reach heading
 * sections only, each running to the next heading at the same or higher level.
 */
export function reach_scope_lines(relPath: string, text: string): Set<number> {
    const lines = text.split('\n');
    const inScope = new Set<number>();
    if (/reach/i.test(path.basename(relPath))) {
        lines.forEach((_line, index) => inScope.add(index + 1));
        return inScope;
    }
    let openLevel: number | null = null;
    lines.forEach((line, index) => {
        const heading = ANY_HEADING_RE.exec(line);
        if (heading) {
            const level = (heading[1] ?? '#').length;
            if (REACH_HEADING_RE.test(line)) {
                openLevel = level;
            } else if (openLevel !== null && level <= openLevel) {
                openLevel = null;
            }
        }
        if (openLevel !== null) {
            inScope.add(index + 1);
        }
    });
    return inScope;
}

/**
 * Scan one surface's text. `scopeLines` restricts the sweep (docs sections);
 * omit it to scan every line (config files, fixtures).
 *
 * Comments are scanned on purpose: a YAML comment or a doc paragraph telling a
 * human to run `brew install <tool>` hands over the same unpinned artefact the
 * command would, so exempting prose would leave the hazard reachable through
 * the one channel this package actually ships — text a person reads.
 */
export function scan_surface_text(
    relPath: string,
    text: string,
    scopeLines?: Set<number>,
): Finding[] {
    const findings: Finding[] = [];
    text.split('\n').forEach((line, index) => {
        const lineNo = index + 1;
        if (scopeLines && !scopeLines.has(lineNo)) {
            return;
        }
        if (PIPE_TO_SHELL_RE.test(line)) {
            findings.push({
                locator: `${relPath}:${lineNo}`,
                kind: 'pipe-to-shell',
                message: `pipes a remote fetch straight into an interpreter: ${line.trim()} — download, inspect, then run a pinned artefact (supply-chain-intake § no pipe-to-shell)`,
            });
            return;
        }
        if (INSTALL_VERB_RE.test(line) && !has_version_pin(line) && !/os-baseline:/.test(line)) {
            findings.push({
                locator: `${relPath}:${lineNo}`,
                kind: 'unpinned-install',
                message: `unpinned install command in a shipped reach surface: ${line.trim()} — pin the version`,
            });
        }
    });
    return findings;
}

/** The explicit surface list. Kept in one function so the scope is auditable. */
export function collect_surfaces(root: string = ROOT): { abs: string; rel: string }[] {
    const surfaces: { abs: string; rel: string }[] = [];

    const configDir = path.join(root, 'src', 'config');
    if (fs.existsSync(configDir)) {
        for (const name of fs.readdirSync(configDir).sort()) {
            if (/^reach-.*\.ya?ml$/.test(name)) {
                surfaces.push({
                    abs: path.join(configDir, name),
                    rel: path.join('src', 'config', name),
                });
            }
        }
    }

    const docsDir = path.join(root, 'docs');
    const walk = (dir: string): void => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
            a.name.localeCompare(b.name),
        )) {
            const abs = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                walk(abs);
            } else if (entry.isFile() && entry.name.endsWith('.md')) {
                surfaces.push({ abs, rel: path.relative(root, abs) });
            }
        }
    };
    if (fs.existsSync(docsDir)) {
        walk(docsDir);
    }

    return surfaces;
}

/** Run the grep gate over the declared scope. */
export function scan_shipped_surfaces(root: string = ROOT): Finding[] {
    const findings: Finding[] = [];
    for (const surface of collect_surfaces(root)) {
        let text: string;
        try {
            text = fs.readFileSync(surface.abs, 'utf-8');
        } catch (err) {
            throw new RegistryLoadError(
                `surface unreadable: ${surface.rel}: ${sanitizeParseError(err)}`,
            );
        }
        const isDoc = surface.rel.split(path.sep)[0] === 'docs';
        findings.push(
            ...scan_surface_text(
                surface.rel,
                text,
                isDoc ? reach_scope_lines(surface.rel, text) : undefined,
            ),
        );
    }
    return findings;
}

// --- orchestration ---------------------------------------------------------

export interface RunOptions {
    readonly registryPath?: string | undefined;
    readonly intakePath?: string | undefined;
    /** Grep-gate scope: the full surface list, or just the target registry. */
    readonly surfaceRoot?: string | null | undefined;
}

/**
 * Everything the CLI reports, as data. Throws RegistryLoadError for the exit-3
 * class so an unusable file is never reported as "0 violations".
 */
export function run_checks(options: RunOptions = {}): Finding[] {
    const registryPath = options.registryPath ?? REGISTRY_PATH;
    const intakePath = options.intakePath ?? INTAKE_PATH;
    const findings: Finding[] = [];

    // Pre-flight: the schema gate owns shape validation (reuse, not a second
    // implementation). Shape errors are surfaced, then the prescription checks
    // run anyway on whatever is well-formed enough to read.
    for (const error of validate_file(registryPath).filter(
        (finding) => finding.severity === 'error',
    )) {
        findings.push({
            locator: error.path,
            kind: 'schema',
            message: `${error.rule}: ${error.message} (fix via \`task check-reach-channels\`)`,
        });
    }

    const registry = load_registry(registryPath);
    const intake = load_intake(intakePath);
    findings.push(...check_intake_record(intake));
    findings.push(...check_prescriptions(registry, intake));

    if (options.surfaceRoot === null) {
        // Fixture run: the target file is the only surface under test.
        const rel = path.relative(ROOT, registryPath) || registryPath;
        findings.push(...scan_surface_text(rel, fs.readFileSync(registryPath, 'utf-8')));
    } else {
        findings.push(...scan_shipped_surfaces(options.surfaceRoot ?? ROOT));
    }

    return findings;
}

const HELP = `validate_reach_prescriptions — offline supply-chain gate for reach install prescriptions

Usage:
  tsx src/scripts/validate_reach_prescriptions.ts [<registry.yml>] [options]

Options:
  --intake <path>   Intake record to read (default: src/config/reach-prescriptions-intake.yml)
  --quiet           Suppress the success line
  --help            This text

Checks (all offline — no network, no subprocess):
  unpinned-install       install string with no version specifier and no os-baseline: sentinel
  moving-target-source   latest / main / master / HEAD / archive path / .zip / .tgz / .tar.gz / .tar.xz
  unrecorded-package     backend prescribes an external install with no intake-record entry
  pin-drift              registry pin differs from the version the intake record verified
  package-name-mismatch  install names no package identifier the intake record verified
  intake-record          record entry missing a checklist outcome, an ISO date, or a verification command
  pipe-to-shell          a remote fetch piped into an interpreter (curl … | sh)

Grep-gate scope (narrow on purpose — an unbounded sweep becomes a false-positive machine):
  1. src/config/reach-*.yml  — in full.
  2. docs/**/*.md            — reach material only: the whole file when its name
     contains "reach", otherwise only the heading sections whose heading text
     mentions reach, each through to the next heading at the same or higher level.
  Nothing else in the repo is scanned. There is no src/skills/internet-reach/ to
  scan: the Phase 0 benchmark returned band: stop and the router skill was cancelled.
  Comments and prose inside that scope count — text telling a human to run an
  unpinned install hands over the same artefact the command would.
  Passing a registry path narrows the gate to that one file (the fixture under test).

Exit codes: 0 clean · 1 violations · 3 unusable input (missing / unparseable file).
`;

export function main(argv: string[] = process.argv.slice(2)): number {
    if (argv.includes('--help') || argv.includes('-h')) {
        process.stdout.write(HELP);
        return 0;
    }
    const quiet = argv.includes('--quiet');

    let intakePath: string | undefined;
    const positional: string[] = [];
    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];
        if (arg === undefined) {
            continue;
        }
        if (arg === '--intake') {
            const value = argv[index + 1];
            if (!value) {
                process.stderr.write('validate_reach_prescriptions: --intake needs a path\n');
                return 3;
            }
            intakePath = path.resolve(value);
            index += 1;
        } else if (arg.startsWith('--intake=')) {
            intakePath = path.resolve(arg.slice('--intake='.length));
        } else if (!arg.startsWith('-')) {
            positional.push(arg);
        }
    }
    if (positional.length > 1) {
        process.stderr.write(
            'validate_reach_prescriptions: at most one registry path argument is accepted\n',
        );
        return 3;
    }

    const registryPath = positional[0] ? path.resolve(positional[0]) : REGISTRY_PATH;
    const relTarget = path.relative(ROOT, registryPath) || registryPath;

    let findings: Finding[];
    try {
        findings = run_checks({
            registryPath,
            intakePath,
            surfaceRoot: positional[0] ? null : ROOT,
        });
    } catch (err) {
        if (err instanceof RegistryLoadError) {
            process.stderr.write(`❌  validate_reach_prescriptions: ${err.message}\n`);
            return 3;
        }
        throw err;
    }

    if (findings.length > 0) {
        process.stdout.write(
            `❌  ${relTarget}: ${findings.length} prescription violation(s):\n`,
        );
        for (const finding of findings) {
            process.stdout.write(`  - [${finding.kind}] ${finding.locator}: ${finding.message}\n`);
        }
        return 1;
    }

    if (!quiet) {
        process.stdout.write(
            `✅  ${relTarget}: every install prescription is pinned, intake-recorded, and free of pipe-to-shell (offline check).\n`,
        );
    }
    return 0;
}

function _isCliEntry(): boolean {
    if (!process.argv[1]) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // A symlinked invocation makes the raw URLs differ (import.meta.url is the
    // resolved real path while argv[1] keeps the symlink path) — compare
    // realpaths so the CLI still fires when run through a projection symlink.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1]));
        return here === argv;
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exit(main());
}
