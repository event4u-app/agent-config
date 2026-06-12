#!/usr/bin/env node
/**
 * Move a single artefact between packs via `git mv` (history-preserving).
 *
 * TypeScript twin of `src/scripts/move_artefact.py` (ADR-089, Phase 8 /
 * Wave 8b). The public surface, CLI contract, exit codes, stdout/stderr
 * split, byte-for-byte messages, and the `git mv` semantics mirror the
 * Python original EXACTLY. The frontmatter rewrite reproduces PyYAML's
 * `safe_dump(..., sort_keys=False, allow_unicode=True)` output through a
 * faithful port of the PyYAML emitter (scalar-style resolution, plain /
 * single-quoted / double-quoted writers with the same best-width=80
 * line-folding and 2-space continuation indent). No behaviour changes.
 *
 * Flagged divergence candidates (not fixed): `~user` expansion is not
 * needed here; PyYAML's float repr for non-string float VALUES is not
 * exercised by artefact frontmatter (values come from yaml.safe_load of
 * strings/ints/bools/lists) — the emitter covers those shapes.
 *
 * CLI:
 *   --id ID            artefact slug (skill/command name or rule stem)
 *   --type TYPE        skill | rule | command (required when --id ambiguous)
 *   --to PACK          target pack id (e.g. `laravel`, `core`)
 *   --dry-run          print the planned move and frontmatter edit, no FS changes
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { parse as parseYaml } from 'yaml';

const _HERE = path.dirname(fileURLToPath(import.meta.url));
// parents[2] of the .py file (src/scripts/move_artefact.py) is the repo root.
const ROOT = path.resolve(_HERE, '..', '..');
const PACKAGES = path.join(ROOT, 'packages');
const PACKS_VOCAB = path.join(ROOT, 'src', 'config', 'discovery', 'packs.yml');

/** SystemExit equivalent — Python `raise SystemExit(msg)` prints msg + exit 1. */
export class SystemExit extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'SystemExit';
    }
}

function _isDir(p: string): boolean {
    try {
        return fs.statSync(p).isDirectory();
    } catch {
        return false;
    }
}

function _exists(p: string): boolean {
    try {
        fs.statSync(p);
        return true;
    } catch {
        return false;
    }
}

/** Python-string ordering (codepoint). */
function pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

export function _list_pack_ids(): Set<string> {
    const raw = fs.readFileSync(PACKS_VOCAB, 'utf-8');
    const data = (parseYaml(raw, { version: '1.1' }) as Array<Record<string, unknown>> | null) ?? [];
    const out = new Set<string>();
    for (const p of data) {
        out.add(p['id'] as string);
    }
    out.add('core');
    return out;
}

export function _pack_dir(pack_id: string): string {
    return path.join(PACKAGES, pack_id === 'core' ? 'core' : `pack-${pack_id}`);
}

/** Return [physical_path, detected_kind, current_pack_id]. */
export function _find_artefact(slug: string, kind: string | null): [string, string, string] {
    const hits: Array<[string, string, string]> = [];
    // sorted(PACKAGES.iterdir())
    let pkgs: string[];
    try {
        pkgs = fs.readdirSync(PACKAGES).map((n) => path.join(PACKAGES, n));
    } catch {
        pkgs = [];
    }
    pkgs.sort(pyStrCmp);
    for (const pkg of pkgs) {
        const src = path.join(pkg, '.agent-src.uncondensed');
        if (!_isDir(src)) {
            continue;
        }
        const base = path.basename(pkg);
        const pid = base === 'core' ? 'core' : base.replace(/^pack-/, '');
        const candidates: Array<[string, string]> = [
            ['skill', `skills/${slug}/SKILL.md`],
            ['rule', `rules/${slug}.md`],
            ['command', `commands/${slug}.md`],
        ];
        for (const [k, rel] of candidates) {
            const p = path.join(src, rel);
            if (_exists(p) && (kind === null || kind === k)) {
                hits.push([p, k, pid]);
            }
        }
    }
    if (!hits.length) {
        throw new SystemExit(`error: artefact '${slug}' not found under any pack`);
    }
    if (hits.length > 1 && kind === null) {
        const kinds = [...new Set(hits.map((h) => h[1]))].sort(pyStrCmp).join(', ');
        throw new SystemExit(`error: '${slug}' ambiguous (found as: ${kinds}); pass --type`);
    }
    return hits[0] as [string, string, string];
}

/** Return the path to git-mv (directory for skills, file for rule/command). */
export function _move_root(p: string, kind: string): string {
    return kind === 'skill' ? path.dirname(p) : p;
}

/**
 * Rewrite the `packs:` frontmatter to match the target pack.
 *
 * Returns `true` when a write (or, in dry-run, a planned write) happened.
 * Reproduces the Python logic: split on the first `---`, parse the head
 * with `yaml.safe_load`, mutate `packs`, re-emit with PyYAML safe_dump
 * semantics, and splice `body[1:]` back on (the Python drops the leading
 * newline of `body`, which starts at the `\n---`).
 */
export function _rewrite_packs(md_path: string, new_pack: string, dry_run: boolean): boolean {
    const text = fs.readFileSync(md_path, 'utf-8');
    if (!text.startsWith('---')) {
        return false;
    }
    const end = text.indexOf('\n---', 4);
    if (end === -1) {
        return false;
    }
    const head = text.slice(4, end);
    const body = text.slice(end);
    const fmRaw = parseYaml(head, { version: '1.1' });
    const fm: Record<string, unknown> = (fmRaw ?? {}) as Record<string, unknown>;
    if (typeof fmRaw !== 'object' || fmRaw === null || Array.isArray(fmRaw)) {
        return false;
    }
    const current = (fm['packs'] as unknown[] | null | undefined) ?? [];
    const desired: string[] = new_pack === 'core' ? [] : [new_pack];
    if (_listEqual(current as unknown[], desired)) {
        return false;
    }
    if (desired.length) {
        fm['packs'] = desired;
    } else {
        delete fm['packs'];
    }
    const newText = '---\n' + pyyamlSafeDump(fm) + body.slice(1);
    if (dry_run) {
        process.stdout.write(
            `  would rewrite frontmatter packs: ${pyListRepr(current as unknown[])} -> ${pyListRepr(desired)}\n`,
        );
    } else {
        fs.writeFileSync(md_path, newText, 'utf-8');
        process.stdout.write(
            `  rewrote frontmatter packs: ${pyListRepr(current as unknown[])} -> ${pyListRepr(desired)}\n`,
        );
    }
    return true;
}

function _listEqual(a: unknown[], b: unknown[]): boolean {
    if (a.length !== b.length) {
        return false;
    }
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) {
            return false;
        }
    }
    return true;
}

/** Python `str(list)` repr for the diagnostic line (e.g. `['laravel']`, `[]`). */
function pyListRepr(items: unknown[]): string {
    const inner = items.map((it) => pyScalarRepr(it)).join(', ');
    return `[${inner}]`;
}

function pyScalarRepr(v: unknown): string {
    if (typeof v === 'string') {
        // Python repr prefers single quotes.
        return `'${v.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    }
    if (v === null) {
        return 'None';
    }
    if (v === true) {
        return 'True';
    }
    if (v === false) {
        return 'False';
    }
    return String(v);
}

function _relativeToRoot(p: string): string {
    const rel = path.relative(ROOT, p);
    return rel.split(path.sep).join('/');
}

export function main(argv?: string[]): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const vocab = _list_pack_ids();
    if (!vocab.has(args.to)) {
        const sorted = [...vocab].sort(pyStrCmp);
        process.stderr.write(`error: target pack '${args.to}' not in ${pyListRepr(sorted)}\n`);
        return 2;
    }

    const [srcMd, kind, currentPack] = _find_artefact(args.id, args.type);
    if (currentPack === args.to) {
        process.stdout.write(`no-op: '${args.id}' already lives in pack '${args.to}'\n`);
        return 0;
    }

    const srcRoot = _move_root(srcMd, kind);
    const destPkgSrc = path.join(_pack_dir(args.to), '.agent-src.uncondensed');
    const relUnderPack = path.relative(
        path.join(_pack_dir(currentPack), '.agent-src.uncondensed'),
        srcRoot,
    );
    const destRoot = path.join(destPkgSrc, relUnderPack);

    process.stdout.write(`plan: ${kind} '${args.id}' : ${currentPack} -> ${args.to}\n`);
    process.stdout.write(`  git mv ${_relativeToRoot(srcRoot)} ${_relativeToRoot(destRoot)}\n`);

    // Frontmatter must be rewritten BEFORE the move so the new physical
    // location matches the declared pack. Discovery scanner cross-checks.
    _rewrite_packs(srcMd, args.to, args.dry_run);

    if (args.dry_run) {
        process.stdout.write('dry-run: no FS changes\n');
        return 0;
    }

    fs.mkdirSync(path.dirname(destRoot), { recursive: true });
    const result = spawnSync(
        'git',
        ['mv', _relativeToRoot(srcRoot), _relativeToRoot(destRoot)],
        { cwd: ROOT, encoding: 'utf-8' },
    );
    if (result.status !== 0) {
        process.stderr.write(`git mv failed: ${result.stderr ?? ''}\n`);
        return result.status ?? 1;
    }
    process.stdout.write(`moved: ${_relativeToRoot(srcRoot)} -> ${_relativeToRoot(destRoot)}\n`);
    process.stdout.write('next: run `task sync` and `task lint-pack-boundaries`\n');
    return 0;
}

interface ParsedArgs {
    id: string;
    to: string;
    type: string | null;
    dry_run: boolean;
}

export function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { id: '', to: '', type: null, dry_run: false };
    let haveId = false;
    let haveTo = false;
    const fail = (msg: string): never => {
        process.stderr.write(`move_artefact: error: ${msg}\n`);
        process.exit(2);
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i] as string;
        if (a === '--id') {
            const v = argv[++i];
            if (v === undefined) fail('argument --id: expected one argument');
            out.id = v as string;
            haveId = true;
        } else if (a.startsWith('--id=')) {
            out.id = a.slice('--id='.length);
            haveId = true;
        } else if (a === '--to') {
            const v = argv[++i];
            if (v === undefined) fail('argument --to: expected one argument');
            out.to = v as string;
            haveTo = true;
        } else if (a.startsWith('--to=')) {
            out.to = a.slice('--to='.length);
            haveTo = true;
        } else if (a === '--type') {
            const v = argv[++i];
            if (v === undefined) fail('argument --type: expected one argument');
            if (!['skill', 'rule', 'command'].includes(v as string)) {
                fail(`argument --type: invalid choice: '${v}' (choose from 'skill', 'rule', 'command')`);
            }
            out.type = v as string;
        } else if (a.startsWith('--type=')) {
            const v = a.slice('--type='.length);
            if (!['skill', 'rule', 'command'].includes(v)) {
                fail(`argument --type: invalid choice: '${v}' (choose from 'skill', 'rule', 'command')`);
            }
            out.type = v;
        } else if (a === '--dry-run') {
            out.dry_run = true;
        } else if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: move_artefact [-h] --id ID --to TO [--type {skill,rule,command}] [--dry-run]\n',
            );
            process.exit(0);
        } else {
            fail(`unrecognized arguments: ${a}`);
        }
    }
    if (!haveId) {
        fail('the following arguments are required: --id');
    }
    if (!haveTo) {
        fail('the following arguments are required: --to');
    }
    return out;
}

// ─────────────────────────────────────────────────────────────────────────────
// PyYAML safe_dump emitter (faithful port of the subset used here)
//
// Reproduces `yaml.safe_dump(fm, sort_keys=False, allow_unicode=True)` for a
// top-level mapping whose values are str / int / float / bool / null / list.
// Ports the PyYAML Emitter scalar-style choice, the implicit-tag resolver
// (so plain scalars that would re-read as bool/int/float/null/timestamp get
// quoted), and the plain / single-quoted / double-quoted writers with the
// same best_width=80 folding and 2-space continuation indent.
// ─────────────────────────────────────────────────────────────────────────────

const BEST_WIDTH = 80;
const BEST_INDENT = 2;

// Implicit-resolver patterns (from yaml.resolver.Resolver), anchored.
const _BOOL_RE = /^(?:yes|Yes|YES|no|No|NO|true|True|TRUE|false|False|FALSE|on|On|ON|off|Off|OFF)$/;
const _NULL_RE = /^(?:~|null|Null|NULL|)$/;
const _FLOAT_RE =
    /^(?:[-+]?(?:[0-9][0-9_]*)\.[0-9_]*(?:[eE][-+][0-9]+)?|\.[0-9][0-9_]*(?:[eE][-+][0-9]+)?|[-+]?[0-9][0-9_]*(?::[0-5]?[0-9])+\.[0-9_]*|[-+]?\.(?:inf|Inf|INF)|\.(?:nan|NaN|NAN))$/;
const _INT_RE =
    /^(?:[-+]?0b[0-1_]+|[-+]?0[0-7_]+|[-+]?(?:0|[1-9][0-9_]*)|[-+]?0x[0-9a-fA-F_]+|[-+]?[1-9][0-9_]*(?::[0-5]?[0-9])+)$/;
const _TIMESTAMP_RE =
    /^(?:[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]|[0-9][0-9][0-9][0-9]-[0-9][0-9]?-[0-9][0-9]?(?:[Tt]|[ \t]+)[0-9][0-9]?:[0-9][0-9]:[0-9][0-9](?:\.[0-9]*)?(?:[ \t]*(?:Z|[-+][0-9][0-9]?(?::[0-9][0-9])?))?)$/;
const _MERGE_RE = /^(?:<<)$/;
const _VALUE_RE = /^(?:=)$/;
const _YAMLTAG_RE = /^(?:!|&|\*)$/;

/** True when the plain string would resolve back to `str` (so plain is OK). */
function _resolvesToStr(value: string): boolean {
    if (_BOOL_RE.test(value)) return false;
    if (_NULL_RE.test(value)) return false;
    if (_FLOAT_RE.test(value)) return false;
    if (_INT_RE.test(value)) return false;
    if (_TIMESTAMP_RE.test(value)) return false;
    if (_MERGE_RE.test(value)) return false;
    if (_VALUE_RE.test(value)) return false;
    if (_YAMLTAG_RE.test(value)) return false;
    return true;
}

interface ScalarAnalysis {
    empty: boolean;
    multiline: boolean;
    allow_block_plain: boolean;
    allow_single_quoted: boolean;
    allow_double_quoted: boolean;
}

const _LINEBREAKS = '\n\x85  ';

function _analyzeScalar(scalar: string): ScalarAnalysis {
    if (!scalar) {
        return {
            empty: true,
            multiline: false,
            allow_block_plain: true,
            allow_single_quoted: true,
            allow_double_quoted: true,
        };
    }
    let blockIndicators = false;
    let lineBreaks = false;
    let specialCharacters = false;
    let leadingSpace = false;
    let leadingBreak = false;
    let trailingSpace = false;
    let trailingBreak = false;
    let breakSpace = false;
    let spaceBreak = false;

    if (scalar.startsWith('---') || scalar.startsWith('...')) {
        blockIndicators = true;
    }
    let precededByWhitespace = true;
    let followedByWhitespace =
        scalar.length === 1 || '\0 \t\r\n\x85  '.includes(scalar[1] as string);
    let previousSpace = false;
    let previousBreak = false;

    let index = 0;
    while (index < scalar.length) {
        const ch = scalar[index] as string;
        if (index === 0) {
            if ('#,[]{}&*!|>\'"%@`'.includes(ch)) {
                blockIndicators = true;
            }
            if ('?:'.includes(ch)) {
                if (followedByWhitespace) {
                    blockIndicators = true;
                }
            }
            if (ch === '-' && followedByWhitespace) {
                blockIndicators = true;
            }
        } else {
            if (ch === ':') {
                if (followedByWhitespace) {
                    blockIndicators = true;
                }
            }
            if (ch === '#' && precededByWhitespace) {
                blockIndicators = true;
            }
        }
        if (_LINEBREAKS.includes(ch)) {
            lineBreaks = true;
        }
        if (!(ch === '\n' || ('\x20' <= ch && ch <= '\x7E'))) {
            const isPrintableUnicode =
                ch === '\x85' ||
                ('\xA0' <= ch && ch <= '퟿') ||
                ('' <= ch && ch <= '�');
            if ((isPrintableUnicode || ch > '￿') && ch !== '﻿') {
                // allow_unicode = true → not special
            } else {
                specialCharacters = true;
            }
        }
        if (ch === ' ') {
            if (index === 0) leadingSpace = true;
            if (index === scalar.length - 1) trailingSpace = true;
            if (previousBreak) breakSpace = true;
            previousSpace = true;
            previousBreak = false;
        } else if (_LINEBREAKS.includes(ch)) {
            if (index === 0) leadingBreak = true;
            if (index === scalar.length - 1) trailingBreak = true;
            if (previousSpace) spaceBreak = true;
            previousSpace = false;
            previousBreak = true;
        } else {
            previousSpace = false;
            previousBreak = false;
        }
        index += 1;
        precededByWhitespace = '\0 \t\r\n\x85  '.includes(ch);
        followedByWhitespace =
            index + 1 >= scalar.length ||
            '\0 \t\r\n\x85  '.includes(scalar[index + 1] as string);
    }

    let allowBlockPlain = true;
    let allowSingleQuoted = true;
    const allowDoubleQuoted = true;

    if (leadingSpace || leadingBreak || trailingSpace || trailingBreak) {
        allowBlockPlain = false;
    }
    if (breakSpace) {
        allowBlockPlain = false;
        allowSingleQuoted = false;
    }
    if (spaceBreak || specialCharacters) {
        allowBlockPlain = false;
        allowSingleQuoted = false;
    }
    if (lineBreaks) {
        allowBlockPlain = false;
    }
    if (blockIndicators) {
        allowBlockPlain = false;
    }

    return {
        empty: false,
        multiline: lineBreaks,
        allow_block_plain: allowBlockPlain,
        allow_single_quoted: allowSingleQuoted,
        allow_double_quoted: allowDoubleQuoted,
    };
}

/** Streaming emitter state mirroring PyYAML's column / whitespace tracking. */
class Emitter {
    out = '';
    column = 0;
    whitespace = true;
    indention = true;
    indent = 0;

    private writeRaw(data: string): void {
        this.out += data;
    }

    writeIndicator(indicator: string, needWhitespace: boolean, whitespace = false, indention = false): void {
        const data = this.whitespace || !needWhitespace ? indicator : ' ' + indicator;
        this.whitespace = whitespace;
        this.indention = this.indention && indention;
        this.column += data.length;
        this.writeRaw(data);
    }

    writeLineBreak(): void {
        this.whitespace = true;
        this.indention = true;
        this.column = 0;
        this.writeRaw('\n');
    }

    writeIndent(): void {
        const indent = this.indent || 0;
        if (!this.indention || this.column > indent || (this.column === indent && !this.whitespace)) {
            this.writeLineBreak();
        }
        if (this.column < indent) {
            this.whitespace = true;
            this.writeRaw(' '.repeat(indent - this.column));
            this.column = indent;
        }
    }

    writePlain(text: string, split = true): void {
        if (!text) {
            return;
        }
        if (!this.whitespace) {
            this.writeRaw(' ');
            this.column += 1;
        }
        this.whitespace = false;
        this.indention = false;
        let spaces = false;
        let breaks = false;
        let start = 0;
        let end = 0;
        while (end <= text.length) {
            const ch: string | null = end < text.length ? (text[end] as string) : null;
            if (spaces) {
                if (ch !== ' ') {
                    if (start + 1 === end && this.column > BEST_WIDTH && split) {
                        this.writeIndent();
                        this.whitespace = false;
                        this.indention = false;
                    } else {
                        const data = text.slice(start, end);
                        this.column += data.length;
                        this.writeRaw(data);
                    }
                    start = end;
                }
            } else if (breaks) {
                if (ch === null || !_LINEBREAKS.includes(ch)) {
                    // (multiline plain is never emitted in this subset)
                    const data = text.slice(start, end);
                    this.column += data.length;
                    this.writeRaw(data);
                    start = end;
                }
            } else {
                if (ch === null || ch === ' ' || _LINEBREAKS.includes(ch)) {
                    const data = text.slice(start, end);
                    this.column += data.length;
                    this.writeRaw(data);
                    start = end;
                }
            }
            if (ch !== null) {
                spaces = ch === ' ';
                breaks = _LINEBREAKS.includes(ch);
            }
            end += 1;
        }
    }

    writeSingleQuoted(text: string, split = true): void {
        this.writeIndicator("'", true);
        let spaces = false;
        let breaks = false;
        let start = 0;
        let end = 0;
        while (end <= text.length) {
            const ch: string | null = end < text.length ? (text[end] as string) : null;
            if (spaces) {
                if (ch === null || ch !== ' ') {
                    if (
                        start + 1 === end &&
                        this.column > BEST_WIDTH &&
                        split &&
                        start !== 0 &&
                        end !== text.length
                    ) {
                        this.writeIndent();
                    } else {
                        const data = text.slice(start, end);
                        this.column += data.length;
                        this.writeRaw(data);
                    }
                    start = end;
                }
            } else if (breaks) {
                if (ch === null || !_LINEBREAKS.includes(ch)) {
                    const data = text.slice(start, end);
                    this.column += data.length;
                    this.writeRaw(data);
                    start = end;
                }
            } else {
                if (ch === null || ch === ' ' || _LINEBREAKS.includes(ch) || ch === "'") {
                    if (start < end) {
                        const data = text.slice(start, end);
                        this.column += data.length;
                        this.writeRaw(data);
                        start = end;
                    }
                }
            }
            if (ch === "'") {
                this.writeRaw("''");
                this.column += 2;
                start = end + 1;
            }
            if (ch !== null) {
                spaces = ch === ' ';
                breaks = _LINEBREAKS.includes(ch);
            }
            end += 1;
        }
        this.writeIndicator("'", false);
    }

    writeDoubleQuoted(text: string, split = true): void {
        this.writeIndicator('"', true);
        let start = 0;
        let end = 0;
        const ESCAPE: Record<string, string> = {
            '\0': '0', '\x07': 'a', '\x08': 'b', '\x09': 't', '\x0A': 'n',
            '\x0B': 'v', '\x0C': 'f', '\x0D': 'r', '\x1B': 'e', '"': '"',
            '\\': '\\', '\x85': 'N', '\xA0': '_', ' ': 'L', ' ': 'P',
        };
        while (end <= text.length) {
            const ch: string | null = end < text.length ? (text[end] as string) : null;
            const needsEscape =
                ch === null ||
                '"\\\x85  ﻿'.includes(ch) ||
                !(
                    ('\x20' <= ch && ch <= '\x7E') ||
                    ('\xA0' <= ch && ch <= '퟿') ||
                    ('' <= ch && ch <= '�')
                );
            if (needsEscape) {
                if (start < end) {
                    const data = text.slice(start, end);
                    this.column += data.length;
                    this.writeRaw(data);
                    start = end;
                }
                if (ch !== null) {
                    let data: string;
                    if (ch in ESCAPE) {
                        data = '\\' + ESCAPE[ch];
                    } else {
                        const code = ch.codePointAt(0) as number;
                        if (code <= 0xff) {
                            data = '\\x' + code.toString(16).toUpperCase().padStart(2, '0');
                        } else if (code <= 0xffff) {
                            data = '\\u' + code.toString(16).toUpperCase().padStart(4, '0');
                        } else {
                            data = '\\U' + code.toString(16).toUpperCase().padStart(8, '0');
                        }
                        this.column += data.length;
                        this.writeRaw(data);
                        start = end + 1;
                        end += 1;
                        continue;
                    }
                    this.column += data.length;
                    this.writeRaw(data);
                    start = end + 1;
                }
            }
            if (
                0 < end &&
                end < text.length - 1 &&
                (ch === ' ' || start >= end) &&
                this.column + (end - start) > BEST_WIDTH &&
                split
            ) {
                let data = text.slice(start, end) + '\\';
                if (start < end) {
                    start = end;
                }
                this.column += data.length;
                this.writeRaw(data);
                this.writeIndent();
                this.whitespace = false;
                this.indention = false;
                if (text[start] === ' ') {
                    this.writeRaw('\\');
                    this.column += 1;
                }
            }
            end += 1;
        }
        this.writeIndicator('"', false);
    }

    /** Choose style + write a string scalar at the current position. */
    writeStringScalar(value: string): void {
        const analysis = _analyzeScalar(value);
        const implicitPlain = _resolvesToStr(value);
        // choose_scalar_style: prefer plain when implicit & allowed.
        if (implicitPlain && !analysis.empty && !analysis.multiline && analysis.allow_block_plain) {
            this.writePlain(value);
            return;
        }
        if (analysis.allow_single_quoted && !analysis.multiline) {
            this.writeSingleQuoted(value);
            return;
        }
        if (analysis.allow_single_quoted) {
            this.writeSingleQuoted(value);
            return;
        }
        this.writeDoubleQuoted(value);
    }

    /** Write a non-string scalar (bool/int/float/null) — always plain. */
    writeBareScalar(text: string): void {
        this.writePlain(text);
    }
}

/** Python `str()` of a YAML scalar value as PyYAML's representer would emit it. */
function _scalarText(value: unknown): { text: string; isString: boolean } {
    if (value === null || value === undefined) {
        return { text: 'null', isString: false };
    }
    if (typeof value === 'boolean') {
        return { text: value ? 'true' : 'false', isString: false };
    }
    if (typeof value === 'number') {
        if (Number.isInteger(value)) {
            return { text: String(value), isString: false };
        }
        return { text: _pyFloatRepr(value), isString: false };
    }
    return { text: String(value), isString: true };
}

/** Python `repr(float)` for non-integral floats (shortest round-trip). */
function _pyFloatRepr(value: number): string {
    if (Number.isInteger(value)) {
        return `${value}.0`;
    }
    return String(value);
}

/**
 * Emit a top-level mapping the way `yaml.safe_dump(d, sort_keys=False,
 * allow_unicode=True)` does: keys in insertion order, block sequences for
 * list values, `[]` for empty lists.
 */
export function pyyamlSafeDump(mapping: Record<string, unknown>): string {
    const em = new Emitter();
    em.indent = 0;
    let first = true;
    for (const [key, value] of Object.entries(mapping)) {
        if (!first) {
            em.writeIndent();
        }
        first = false;
        // Mapping key (plain scalar) then ':' indicator.
        em.writeStringScalar(key);
        em.writeIndicator(':', false);
        if (Array.isArray(value)) {
            if (value.length === 0) {
                // Flow empty sequence `[]`.
                em.writeIndicator('[', true, true);
                em.writeIndicator(']', false);
            } else {
                // Block sequence under a block mapping is "indentless" in
                // PyYAML — the item indent stays at the mapping indent (0),
                // each item prefixed `- ` (the `-` indicator leaves
                // whitespace=false, so the scalar writer prepends the space).
                for (const item of value) {
                    em.writeIndent();
                    em.writeIndicator('-', true);
                    const sv = _scalarText(item);
                    if (sv.isString) {
                        em.writeStringScalar(sv.text);
                    } else {
                        em.writeBareScalar(sv.text);
                    }
                }
            }
        } else {
            // A block-mapping value scalar is written at the increased indent
            // (best_indent=2) so any folded continuation line indents to
            // column 2 — PyYAML's `increase_indent` before the value node.
            const savedIndent = em.indent;
            em.indent = BEST_INDENT;
            const sv = _scalarText(value);
            // value indicator already left whitespace=false after ':'.
            if (sv.isString) {
                em.writeStringScalar(sv.text);
            } else {
                em.writeBareScalar(sv.text);
            }
            em.indent = savedIndent;
        }
    }
    // PyYAML terminates the document with a single trailing newline.
    em.out += '\n';
    return em.out;
}

function _isCliEntry(): boolean {
    if (process.argv[1] === undefined) {
        return false;
    }
    const argvUrl = pathToFileURL(path.resolve(process.argv[1])).href;
    if (import.meta.url === argvUrl) {
        return true;
    }
    // Symlinked temp dirs (e.g. macOS /var → /private/var) make the raw URLs
    // differ; compare realpaths so the entry guard still fires.
    try {
        const here = fs.realpathSync(fileURLToPath(import.meta.url));
        const argv = fs.realpathSync(path.resolve(process.argv[1] as string));
        return here === argv;
    } catch {
        return false;
    }
}
if (_isCliEntry()) {
    try {
        process.exitCode = main();
    } catch (err) {
        if (err instanceof SystemExit) {
            process.stderr.write(`${err.message}\n`);
            process.exitCode = 1;
        } else {
            throw err;
        }
    }
}
