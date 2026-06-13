#!/usr/bin/env tsx
/**
 * Interactive scaffolder for new skills under the packages/ layout.
 *
 * TypeScript twin of `src/scripts/new_skill.py` (ADR-092 — Python→TS
 * migration, Phase 8 / Wave 8b). The CLI contract is mirrored EXACTLY —
 * the `--pack` / `--type` / `--name` / `--description` / `--workspace`
 * (repeatable) / `--force` flags, exit codes (0 ok · 1 file exists · 2
 * usage / validation), the stdout/stderr split, byte-identical messages,
 * AND byte-identical scaffolded SKILL.md/rule/command output (including the
 * `yaml.safe_dump(sort_keys=False, allow_unicode=True)` frontmatter block).
 *
 * Type → directory mapping:
 *   - skill    → skills/<name>/SKILL.md
 *   - rule     → rules/<name>.md
 *   - command  → commands/<name>.md
 *
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parse as parseYaml } from 'yaml';

const _HERE = fileURLToPath(import.meta.url);

// Mutable config to mirror the Python module-level constants (tests reassign
// `ROOT` / `PACKAGES` / `PACKS_VOCAB` via monkeypatch). A TS-only test seam.
interface ModuleConfig {
    ROOT: string;
    PACKAGES: string;
    PACKS_VOCAB: string;
}

const _cfg: ModuleConfig = (() => {
    // new_skill.ts → parents[2] of the .py file = repo root.
    const root = path.resolve(path.dirname(_HERE), '..', '..');
    return {
        ROOT: root,
        PACKAGES: path.join(root, 'packages'),
        PACKS_VOCAB: path.join(root, 'src', 'config', 'discovery', 'packs.yml'),
    };
})();

export function _setConfigForTest(overrides: Partial<ModuleConfig>): void {
    Object.assign(_cfg, overrides);
}

export const TEMPLATES: Record<string, string> = {
    skill: 'skills/{name}/SKILL.md',
    rule: 'rules/{name}.md',
    command: 'commands/{name}.md',
};

type VocabEntry = { id: string; workspaces?: string[]; [k: string]: unknown };

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

function _load_vocab(): Record<string, VocabEntry> {
    if (!_exists(_cfg.PACKS_VOCAB)) {
        return {};
    }
    const parsed = parseYaml(fs.readFileSync(_cfg.PACKS_VOCAB, 'utf-8'), { version: '1.1' });
    const data = (parsed ?? []) as VocabEntry[];
    const out: Record<string, VocabEntry> = {};
    for (const p of data) {
        out[p.id] = p;
    }
    return out;
}

function _list_packs(): string[] {
    if (!_isDir(_cfg.PACKAGES)) {
        return [];
    }
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(_cfg.PACKAGES, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const ent of entries) {
        if (ent.isDirectory() || (ent.isSymbolicLink() && _isDir(path.join(_cfg.PACKAGES, ent.name)))) {
            out.push(ent.name === 'core' ? 'core' : _removePrefix(ent.name, 'pack-'));
        }
    }
    out.sort();
    return out;
}

/** Python `str.removeprefix`. */
function _removePrefix(s: string, prefix: string): string {
    return s.startsWith(prefix) ? s.slice(prefix.length) : s;
}

function _pack_dir(pack_id: string): string {
    return path.join(_cfg.PACKAGES, pack_id === 'core' ? 'core' : `pack-${pack_id}`);
}

/**
 * Read a single line from stdin synchronously (mirrors Python `input()`).
 * Only reached on a TTY (the interactive path); never exercised in CI/tests
 * where stdin is not a TTY.
 */
function _readLineSync(): string {
    const buf = Buffer.alloc(1);
    const chars: number[] = [];
    for (;;) {
        let bytes: number;
        try {
            bytes = fs.readSync(0, buf, 0, 1, null);
        } catch {
            break; // EOF / EAGAIN
        }
        if (bytes === 0) {
            break; // EOF
        }
        const c = buf[0] as number;
        if (c === 0x0a) {
            break; // newline
        }
        chars.push(c);
    }
    return Buffer.from(chars).toString('utf-8');
}

function _prompt(label: string, def: string | null = null, choices: string[] | null = null): string {
    let suffix = def ? ` [${def}]` : '';
    if (choices) {
        suffix = ` (${choices.join('/')})` + suffix;
    }
    for (;;) {
        process.stdout.write(`${label}${suffix}: `);
        const raw = _readLineSync().trim();
        if (!raw && def !== null) {
            return def;
        }
        if (choices && !choices.includes(raw)) {
            process.stdout.write(`  must be one of: ${choices.join(', ')}\n`);
            continue;
        }
        if (raw) {
            return raw;
        }
    }
}

// --- yaml.safe_dump replica for the fixed frontmatter shape ------------------
//
// PyYAML `safe_dump(sort_keys=False, allow_unicode=True)` block style:
//   - 2-space indent for nested mappings
//   - list items flush at the parent key's indent (`workspaces:\n- a`)
//   - booleans lowercase (`false`); plain scalars unquoted when safe
//   - unicode passed through verbatim (allow_unicode=True)
// The frontmatter is a known, simple structure (strings, bool, string-lists,
// flat nested dicts), so this targeted dumper reproduces the bytes exactly.

type YamlVal = string | boolean | number | YamlVal[] | { [k: string]: YamlVal };

function _dumpScalar(v: string | boolean | number): string {
    if (typeof v === 'boolean') {
        return v ? 'true' : 'false';
    }
    if (typeof v === 'number') {
        return String(v);
    }
    return _emitPlainOrQuoted(v);
}

/**
 * Emit a string the way PyYAML's default (safe) emitter would: plain when it
 * is representable as a plain scalar, otherwise single-quoted. The frontmatter
 * values here are descriptions and slugs; cover the common cases faithfully.
 */
function _emitPlainOrQuoted(s: string): string {
    if (s === '') {
        return "''";
    }
    if (_needsQuoting(s)) {
        return "'" + s.replace(/'/g, "''") + "'";
    }
    return s;
}

function _needsQuoting(s: string): boolean {
    // Reserved indicators at start, or values PyYAML would resolve to a
    // non-string type, or leading/trailing whitespace, force quoting.
    if (s !== s.trim()) {
        return true;
    }
    if (/^[?:,\[\]{}#&*!|>'"%@`-]/.test(s) || s.startsWith('- ')) {
        return true;
    }
    if (/[:#]\s/.test(s) || s.endsWith(':') || / #/.test(s)) {
        return true;
    }
    // Type-resolving plain scalars (bool / null / int / float) → quote.
    const lower = s.toLowerCase();
    const RESOLVABLE = new Set([
        'true', 'false', 'yes', 'no', 'on', 'off', 'null', 'none', '~',
        'y', 'n',
    ]);
    if (RESOLVABLE.has(lower)) {
        return true;
    }
    if (/^[-+]?\d+$/.test(s) || /^[-+]?(\d+\.\d*|\.\d+|\d+)([eE][-+]?\d+)?$/.test(s)) {
        return true;
    }
    return false;
}

function _dumpFrontmatter(fm: Record<string, YamlVal>): string {
    const lines: string[] = [];
    for (const [key, val] of Object.entries(fm)) {
        if (Array.isArray(val)) {
            lines.push(`${key}:`);
            for (const item of val) {
                lines.push(`- ${_dumpScalar(item as string | boolean | number)}`);
            }
        } else if (val !== null && typeof val === 'object') {
            lines.push(`${key}:`);
            for (const [k2, v2] of Object.entries(val as Record<string, YamlVal>)) {
                lines.push(`  ${k2}: ${_dumpScalar(v2 as string | boolean | number)}`);
            }
        } else {
            lines.push(`${key}: ${_dumpScalar(val as string | boolean | number)}`);
        }
    }
    return lines.join('\n') + '\n';
}

export function _frontmatter(name: string, description: string, workspaces: string[], pack: string): string {
    const fm: Record<string, YamlVal> = {
        name,
        description,
        source: 'package',
        workspaces,
        packs: pack !== 'core' ? [pack] : [],
        lifecycle: 'active',
        trust: { level: 'professional', confidence: 'medium', human_review_required: false },
        install: { default: false, removable: true },
    };
    if (Array.isArray(fm.packs) && fm.packs.length === 0) {
        delete fm.packs;
    }
    // Rebuild preserving insertion order with `packs` dropped in place.
    return '---\n' + _dumpFrontmatter(fm) + '---\n';
}

export function _body(kind: string, name: string, description: string): string {
    if (kind === 'skill') {
        return (
            `\n# ${name}\n\n## When to use\n\n${description}\n\n## Procedure\n\n` +
            '1. _TODO: replace with the real step-by-step._\n\n' +
            '## Examples\n\n_TODO: copy-pasteable example._\n'
        );
    }
    if (kind === 'rule') {
        return `\n# ${name}\n\n${description}\n\n## Iron Law\n\n\`\`\`\nTODO\n\`\`\`\n`;
    }
    return `\n# ${name}\n\n${description}\n\n## Steps\n\n1. _TODO_\n`;
}

interface ParsedArgs {
    pack: string | null;
    kind: string | null;
    name: string | null;
    description: string | null;
    workspace: string[];
    force: boolean;
}

function _argError(msg: string): never {
    process.stderr.write(
        'usage: new_skill [-h] [--pack PACK] [--type {skill,rule,command}] [--name NAME]\n' +
            '                 [--description DESCRIPTION] [--workspace WORKSPACE] [--force]\n',
    );
    process.stderr.write(`new_skill: error: ${msg}\n`);
    process.exit(2);
}

function parse_args(argv: string[]): ParsedArgs {
    const out: ParsedArgs = { pack: null, kind: null, name: null, description: null, workspace: [], force: false };
    for (let i = 0; i < argv.length; i += 1) {
        const a = argv[i] as string;
        const value = (flag: string): string => {
            const eq = a.indexOf('=');
            if (eq !== -1 && a.startsWith('--')) {
                return a.slice(eq + 1);
            }
            const next = argv[i + 1];
            if (next === undefined) {
                _argError(`argument ${flag}: expected one argument`);
            }
            i += 1;
            return next;
        };
        if (a === '-h' || a === '--help') {
            process.stdout.write(
                'usage: new_skill [-h] [--pack PACK] [--type {skill,rule,command}] [--name NAME]\n' +
                    '                 [--description DESCRIPTION] [--workspace WORKSPACE] [--force]\n',
            );
            process.exit(0);
        } else if (a === '--force') {
            out.force = true;
        } else if (a === '--pack' || a.startsWith('--pack=')) {
            out.pack = value('--pack');
        } else if (a === '--type' || a.startsWith('--type=')) {
            const v = value('--type');
            if (!Object.keys(TEMPLATES).includes(v)) {
                _argError(`argument --type: invalid choice: '${v}' (choose from 'skill', 'rule', 'command')`);
            }
            out.kind = v;
        } else if (a === '--name' || a.startsWith('--name=')) {
            out.name = value('--name');
        } else if (a === '--description' || a.startsWith('--description=')) {
            out.description = value('--description');
        } else if (a === '--workspace' || a.startsWith('--workspace=')) {
            out.workspace.push(value('--workspace'));
        } else {
            _argError(`unrecognized arguments: ${a}`);
        }
    }
    return out;
}

function _relativeToRoot(p: string): string {
    return path.relative(_cfg.ROOT, p).split(path.sep).join('/');
}

export function main(argv: string[] | null = null): number {
    const args = parse_args(argv ?? process.argv.slice(2));

    const packs = _list_packs();
    if (packs.length === 0) {
        process.stderr.write('error: no packages/ tree found\n');
        return 2;
    }
    const vocab = _load_vocab();
    const interactive = Boolean(process.stdin.isTTY);
    const pack = args.pack ?? (interactive ? _prompt('pack', 'core', packs) : 'core');
    if (!packs.includes(pack)) {
        process.stderr.write(`error: pack '${pack}' not in ${_pyListRepr(packs)}\n`);
        return 2;
    }
    const kind = args.kind ?? (interactive ? _prompt('type', 'skill', Object.keys(TEMPLATES)) : 'skill');
    const name = args.name ?? (interactive ? _prompt('name (kebab-case)') : '');
    if (!name || name.includes(' ') || name !== name.toLowerCase()) {
        process.stderr.write(`error: name '${name}' must be lowercase kebab-case\n`);
        return 2;
    }
    const description =
        args.description ?? (interactive ? _prompt('description (one line)') : 'TODO: describe trigger');
    let workspaces: string[];
    if (args.workspace.length > 0) {
        workspaces = args.workspace;
    } else {
        const vw = vocab[pack]?.workspaces;
        workspaces = vw && vw.length > 0 ? vw : ['engineering'];
    }

    const rel = TEMPLATES[kind]!.replace('{name}', name);
    const out = path.join(_pack_dir(pack), '.agent-src.uncondensed', rel);
    if (_exists(out) && !args.force) {
        process.stderr.write(`error: ${_relativeToRoot(out)} exists (use --force)\n`);
        return 1;
    }
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, _frontmatter(name, description, workspaces, pack) + _body(kind, name, description), 'utf-8');
    process.stdout.write(`created: ${_relativeToRoot(out)}\n`);
    process.stdout.write('next steps:\n');
    process.stdout.write('  1. flesh out the body\n');
    process.stdout.write('  2. run `task sync` to project into dist/agent-src/ and .augment/\n');
    process.stdout.write('  3. run `task lint-skills` for validation\n');
    return 0;
}

/** Python `repr(list[str])`. */
function _pyListRepr(items: string[]): string {
    return '[' + items.map((s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'").join(', ') + ']';
}

const _isCliEntry =
    process.argv[1] !== undefined && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_isCliEntry || process.argv[1] === _HERE) {
    process.exit(main());
}
