#!/usr/bin/env tsx
/**
 * Positioning consistency lint for event4u/agent-config.
 *
 * TypeScript twin of `src/scripts/lint_positioning.py` (ADR-089, Phase 4 /
 * Wave 4b). Mirrors the CLI contract EXACTLY — the `--quiet` argparse flag,
 * exit codes (0 clean, 1 drift, 2 missing PyYAML — inert here since `yaml`
 * is always present), byte-identical stdout (success line) and stderr
 * (drift report), and the same source files. No behaviour changes.
 *
 * Asserts three public-positioning surfaces agree on the canonical phrasing
 * and that every advertised GitHub topic is discoverable in the README body
 * (literally or through `equivalents:` paraphrases).
 *
 * Sources: README.md (H1 + first blockquote), package.json (`description`),
 * .github/about.yml (`description`), .github/topics.yml (`topics:` +
 * optional `equivalents:` map).
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
const README = path.join(REPO_ROOT, 'README.md');
const PACKAGE_JSON = path.join(REPO_ROOT, 'package.json');
const ABOUT_YML = path.join(REPO_ROOT, '.github', 'about.yml');
const TOPICS_YML = path.join(REPO_ROOT, '.github', 'topics.yml');

// re.compile(r"^#\s+(.+?)\s*$", re.MULTILINE)
const H1_RE = /^#\s+(.+?)\s*$/m;
// re.compile(r"^>\s+(.+?)\s*$", re.MULTILINE)
const BLOCKQUOTE_RE = /^>\s+(.+?)\s*$/m;
const DESCRIPTION_MAX = 200;

/** Thrown for the SystemExit("…") raises that print and exit 1. */
class SystemExitError extends Error {
    constructor(public readonly text: string) {
        super(text);
        this.name = 'SystemExitError';
    }
}

function _parseYamlSafe(text: string): unknown {
    // version '1.1' matches PyYAML safe_load.
    return parseYaml(text, { version: '1.1' });
}

function _read_readme_anchors(): [string, string, string] {
    const text = fs.readFileSync(README, 'utf-8');
    const h1_match = H1_RE.exec(text);
    if (!h1_match) {
        throw new SystemExitError('❌  README.md has no H1 heading');
    }
    const h1 = h1_match[1] as string;
    // re.split(r"\s+[—–-]\s+", h1, maxsplit=1)
    const parts = _splitMax(h1, /\s+[—–-]\s+/, 1);
    const anchor = parts.length === 2 ? (parts[1] as string).trim() : h1.trim();

    const bq_match = BLOCKQUOTE_RE.exec(text);
    const blockquote = bq_match ? (bq_match[1] as string).trim() : '';
    return [h1, anchor, blockquote];
}

/** re.split(pattern, s, maxsplit=n) — split at most `maxsplit` times. */
function _splitMax(s: string, pattern: RegExp, maxsplit: number): string[] {
    const re = new RegExp(pattern.source, pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g');
    const out: string[] = [];
    let last = 0;
    let count = 0;
    let m: RegExpExecArray | null;
    while (count < maxsplit && (m = re.exec(s)) !== null) {
        out.push(s.slice(last, m.index));
        last = m.index + m[0].length;
        count += 1;
        if (m.index === re.lastIndex) {
            re.lastIndex++;
        }
    }
    out.push(s.slice(last));
    return out;
}

function _read_package_description(): string {
    const data = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
    return String(data?.description ?? '').trim();
}

function _read_about_description(): string {
    const data = (_parseYamlSafe(fs.readFileSync(ABOUT_YML, 'utf-8')) ?? {}) as Record<string, unknown>;
    return String(data?.description ?? '').trim();
}

function _read_topics(): [string[], Record<string, string[]>] {
    const data = (_parseYamlSafe(fs.readFileSync(TOPICS_YML, 'utf-8')) ?? {}) as Record<string, unknown>;
    const topicsRaw = Array.isArray(data['topics']) ? (data['topics'] as unknown[]) : [];
    const topics = topicsRaw.map((t) => String(t));
    const equivalentsRaw =
        data['equivalents'] && typeof data['equivalents'] === 'object'
            ? (data['equivalents'] as Record<string, unknown>)
            : {};
    const equivalents: Record<string, string[]> = {};
    for (const [k, vs] of Object.entries(equivalentsRaw)) {
        equivalents[String(k)] = (Array.isArray(vs) ? vs : []).map((v) => String(v));
    }
    return [topics, equivalents];
}

function _topic_present(
    readme_lc: string,
    topic: string,
    equivalents: Record<string, string[]>,
): [boolean, string | null] {
    const needles = [
        topic,
        topic.replace(/-/g, ' '),
        topic.replace(/-/g, ''),
        ...(equivalents[topic] ?? []),
    ];
    for (const n of needles) {
        if (n && readme_lc.includes(n.toLowerCase())) {
            return [true, n];
        }
    }
    return [false, null];
}

interface ParsedArgs {
    quiet: boolean;
}

function _argparse_error(message: string): never {
    process.stderr.write('usage: lint_positioning.py [-h] [--quiet]\n');
    process.stderr.write(`lint_positioning.py: error: ${message}\n`);
    process.exit(2);
}

function parse_args(argv: readonly string[]): ParsedArgs {
    let quiet = false;
    for (const arg of argv) {
        if (arg === '--quiet') {
            quiet = true;
        } else if (arg === '-h' || arg === '--help') {
            process.stdout.write('usage: lint_positioning.py [-h] [--quiet]\n');
            process.exit(0);
        } else {
            _argparse_error(`unrecognized arguments: ${arg}`);
        }
    }
    return { quiet };
}

export function main(): number {
    const args = parse_args(process.argv.slice(2));

    let anchor: string;
    let pkg_desc: string;
    let about_desc: string;
    let topics: string[];
    let equivalents: Record<string, string[]>;
    try {
        [, anchor] = _read_readme_anchors();
        pkg_desc = _read_package_description();
        about_desc = _read_about_description();
        [topics, equivalents] = _read_topics();
    } catch (e) {
        if (e instanceof SystemExitError) {
            process.stdout.write(e.text + '\n');
            return 1;
        }
        throw e;
    }

    const errors: string[] = [];
    const anchor_lc = anchor.toLowerCase();
    if (!pkg_desc.toLowerCase().includes(anchor_lc)) {
        errors.push('package.json.description missing canonical anchor');
    }
    if (!about_desc.toLowerCase().includes(anchor_lc)) {
        errors.push('.github/about.yml description missing canonical anchor');
    }
    if (pkg_desc.length > DESCRIPTION_MAX) {
        errors.push(`package.json.description is ${pkg_desc.length} chars (max ${DESCRIPTION_MAX})`);
    }
    if (about_desc.length > DESCRIPTION_MAX) {
        errors.push(`.github/about.yml description is ${about_desc.length} chars (max ${DESCRIPTION_MAX})`);
    }

    const readme_lc = fs.readFileSync(README, 'utf-8').toLowerCase();
    const missing_topics: string[] = [];
    for (const topic of topics) {
        const [present] = _topic_present(readme_lc, topic, equivalents);
        if (!present) {
            missing_topics.push(topic);
        }
    }

    if (errors.length > 0 || missing_topics.length > 0) {
        process.stderr.write('❌  positioning drift detected:\n');
        process.stderr.write(`        README anchor:         ${anchor}\n`);
        process.stderr.write(`        package.json.desc:     ${pkg_desc}\n`);
        process.stderr.write(`        .github/about.yml:     ${about_desc}\n\n`);
        for (const err of errors) {
            process.stderr.write(`        - ${err}\n`);
        }
        if (missing_topics.length > 0) {
            process.stderr.write('\n        topics absent from README (literal + equivalents):\n');
            for (const t of missing_topics) {
                process.stderr.write(`          - ${t}\n`);
            }
            process.stderr.write(
                '\n        Resolve by editing all three to share the canonical anchor,\n' +
                    "        or extending .github/topics.yml's `equivalents:` map\n" +
                    '        (or by removing the topic). The README is the canonical phrasing.\n',
            );
        } else {
            process.stderr.write(
                '\n        Resolve by editing all three to share the canonical anchor.\n' +
                    '        The README is the canonical phrasing; the other two follow it.\n',
            );
        }
        return 1;
    }

    if (!args.quiet) {
        process.stdout.write(`✅  positioning consistent (anchor: ${_pyRepr(anchor)}, topics: ${topics.length})\n`);
    }
    return 0;
}

/** Python `repr()` of a string literal (single-quote preference). */
function _pyRepr(s: string): string {
    if (s.includes("'") && !s.includes('"')) {
        return `"${s.replace(/\\/g, '\\\\')}"`;
    }
    return `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

const _isCliEntry =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}

export {
    REPO_ROOT,
    README,
    PACKAGE_JSON,
    ABOUT_YML,
    TOPICS_YML,
    DESCRIPTION_MAX,
    _read_readme_anchors,
    _topic_present,
};
