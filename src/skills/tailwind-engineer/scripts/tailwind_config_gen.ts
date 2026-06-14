#!/usr/bin/env tsx
// Modified from upstream (Apache-2.0, "claudekit" via
// an external reference ui-styling sub-skill
// @ b7e3af80f6e331f6fb456667b82b12cade7c9d35, last checked 2026-06-07).
// License copy: src/skills/design-intelligence/LICENSE.apache-2.0.txt
// (deployed: <skills-root>/design-intelligence/LICENSE.apache-2.0.txt).
// Modifications: adopted into the agent-config skill tree; header added
// per Apache-2.0 §4b; see design-intelligence/ATTRIBUTION.md.
/**
 * Tailwind CSS Configuration Generator
 *
 * Generate tailwind.config.js/ts with custom theme configuration.
 * Supports colors, fonts, spacing, breakpoints, and plugin recommendations.
 *
 * TypeScript twin of `src/skills/tailwind-engineer/scripts/tailwind_config_gen.py`
 * (ADR-094). The CLI contract is mirrored EXACTLY — snake_case-free flags
 * (`--framework`, `--js`, `--output`, `--colors`, `--fonts`, `--spacing`,
 * `--breakpoints`, `--plugins`, `--validate-only`), exit codes (0 / 1 / 2),
 * the stdout/stderr split, byte-identical messages, AND byte-identical
 * generated config text (whitespace, quoting, key order, trailing newlines).
 * No behaviour changes — latent Python quirks replicated.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

const PROG = 'tailwind_config_gen.py';

// Mirror argparse's wrapped usage block (80-col default; non-tty). Used for
// the invalid-choice / unrecognized-argument error paths.
const USAGE =
    `usage: ${PROG} [-h] [--framework {react,vue,svelte,nextjs}]\n` +
    '                              [--js] [--output OUTPUT]\n' +
    '                              [--colors [NAME:VALUE ...]]\n' +
    '                              [--fonts [TYPE:FAMILY ...]]\n' +
    '                              [--spacing [NAME:VALUE ...]]\n' +
    '                              [--breakpoints [NAME:WIDTH ...]] [--plugins]\n' +
    '                              [--validate-only]\n';

type JsonVal = null | boolean | number | string | JsonVal[] | { [k: string]: JsonVal };
type Dict = { [k: string]: JsonVal };

/**
 * json.dumps(obj, indent=2) — sort_keys False, ensure_ascii True. Mirrors the
 * CPython encoder byte-for-byte: insertion-order keys (Map / object key
 * order), the `: ` / `,` separators implied by `indent`, and `\uXXXX` escapes
 * for non-ASCII. Integer floats are not produced by this generator (all values
 * are strings / arrays / dicts), so no PyFloat branch is needed here.
 */
function jsonDumpsIndent2(obj: JsonVal): string {
    const pad = '  ';

    function enc(value: JsonVal, depth: number): string {
        if (value === null) return 'null';
        if (typeof value === 'boolean') return value ? 'true' : 'false';
        if (typeof value === 'number') return String(value);
        if (typeof value === 'string') return encStr(value);
        if (Array.isArray(value)) {
            if (value.length === 0) return '[]';
            const inner = value.map((v) => pad.repeat(depth + 1) + enc(v, depth + 1));
            return '[\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + ']';
        }
        const o = value as Dict;
        const keys = Object.keys(o);
        if (keys.length === 0) return '{}';
        const inner = keys.map(
            (k) => pad.repeat(depth + 1) + encStr(k) + ': ' + enc(o[k] as JsonVal, depth + 1),
        );
        return '{\n' + inner.join(',\n') + '\n' + pad.repeat(depth) + '}';
    }

    function encStr(s: string): string {
        let out = '"';
        for (const ch of s) {
            const cp = ch.codePointAt(0) as number;
            if (ch === '"') out += '\\"';
            else if (ch === '\\') out += '\\\\';
            else if (ch === '\n') out += '\\n';
            else if (ch === '\r') out += '\\r';
            else if (ch === '\t') out += '\\t';
            else if (ch === '\b') out += '\\b';
            else if (ch === '\f') out += '\\f';
            else if (cp < 0x20) out += '\\u' + cp.toString(16).padStart(4, '0');
            else if (cp < 0x7f) out += ch;
            else if (cp > 0xffff) {
                const v = cp - 0x10000;
                const hi = 0xd800 + (v >> 10);
                const lo = 0xdc00 + (v & 0x3ff);
                out += '\\u' + hi.toString(16).padStart(4, '0');
                out += '\\u' + lo.toString(16).padStart(4, '0');
            } else {
                out += '\\u' + cp.toString(16).padStart(4, '0');
            }
        }
        return out + '"';
    }

    return enc(obj, 0);
}

/** Mirror Python `str.strip("'\"")` — strip listed chars from both ends. */
function _stripChars(s: string, chars: string): string {
    let start = 0;
    let end = s.length;
    while (start < end && chars.includes(s[start] as string)) {
        start += 1;
    }
    while (end > start && chars.includes(s[end - 1] as string)) {
        end -= 1;
    }
    return s.slice(start, end);
}

export class TailwindConfigGenerator {
    typescript: boolean;
    framework: string;
    outputPath: string;
    config: Dict;

    constructor(typescript = true, framework = 'react', outputPath: string | null = null) {
        this.typescript = typescript;
        this.framework = framework;
        this.outputPath = outputPath ?? this._defaultOutputPath();
        this.config = this._baseConfig();
    }

    /** Determine default output path — Path.cwd() / `tailwind.config.{ext}`. */
    _defaultOutputPath(): string {
        const ext = this.typescript ? 'ts' : 'js';
        return path.join(process.cwd(), `tailwind.config.${ext}`);
    }

    /** Create base configuration structure. */
    _baseConfig(): Dict {
        return {
            darkMode: ['class'],
            content: this._defaultContentPaths(),
            theme: {
                extend: {},
            },
            plugins: [],
        };
    }

    /** Get default content paths for framework. */
    _defaultContentPaths(): string[] {
        const paths: { [k: string]: string[] } = {
            react: ['./src/**/*.{js,jsx,ts,tsx}', './index.html'],
            vue: ['./src/**/*.{vue,js,ts,jsx,tsx}', './index.html'],
            svelte: ['./src/**/*.{svelte,js,ts}', './src/app.html'],
            nextjs: [
                './app/**/*.{js,ts,jsx,tsx}',
                './pages/**/*.{js,ts,jsx,tsx}',
                './components/**/*.{js,ts,jsx,tsx}',
            ],
        };
        return paths[this.framework] ?? (paths['react'] as string[]);
    }

    private _extend(): Dict {
        return (this.config['theme'] as Dict)['extend'] as Dict;
    }

    /** Add custom colors to theme (dict.update — insertion order preserved). */
    addColors(colors: { [k: string]: string }): void {
        const extend = this._extend();
        if (!('colors' in extend)) {
            extend['colors'] = {};
        }
        const target = extend['colors'] as Dict;
        for (const [k, v] of Object.entries(colors)) {
            target[k] = v;
        }
    }

    /** Add full color palette (50-950 shades) for a base color. */
    addColorPalette(name: string, _baseColor: string): void {
        const extend = this._extend();
        if (!('colors' in extend)) {
            extend['colors'] = {};
        }
        (extend['colors'] as Dict)[name] = {
            '50': `var(--color-${name}-50)`,
            '100': `var(--color-${name}-100)`,
            '200': `var(--color-${name}-200)`,
            '300': `var(--color-${name}-300)`,
            '400': `var(--color-${name}-400)`,
            '500': `var(--color-${name}-500)`,
            '600': `var(--color-${name}-600)`,
            '700': `var(--color-${name}-700)`,
            '800': `var(--color-${name}-800)`,
            '900': `var(--color-${name}-900)`,
            '950': `var(--color-${name}-950)`,
        };
    }

    /** Add custom font families. */
    addFonts(fonts: { [k: string]: string[] }): void {
        const extend = this._extend();
        if (!('fontFamily' in extend)) {
            extend['fontFamily'] = {};
        }
        const target = extend['fontFamily'] as Dict;
        for (const [k, v] of Object.entries(fonts)) {
            target[k] = v;
        }
    }

    /** Add custom spacing values. */
    addSpacing(spacing: { [k: string]: string }): void {
        const extend = this._extend();
        if (!('spacing' in extend)) {
            extend['spacing'] = {};
        }
        const target = extend['spacing'] as Dict;
        for (const [k, v] of Object.entries(spacing)) {
            target[k] = v;
        }
    }

    /** Add custom breakpoints. */
    addBreakpoints(breakpoints: { [k: string]: string }): void {
        const extend = this._extend();
        if (!('screens' in extend)) {
            extend['screens'] = {};
        }
        const target = extend['screens'] as Dict;
        for (const [k, v] of Object.entries(breakpoints)) {
            target[k] = v;
        }
    }

    /** Add plugin requirements (skip duplicates, preserve order). */
    addPlugins(plugins: string[]): void {
        const arr = this.config['plugins'] as string[];
        for (const plugin of plugins) {
            if (!arr.includes(plugin)) {
                arr.push(plugin);
            }
        }
    }

    /** Get plugin recommendations based on configuration. */
    recommendPlugins(): string[] {
        const recommendations: string[] = [];
        recommendations.push('tailwindcss-animate');
        if (this.framework === 'nextjs') {
            recommendations.push('@tailwindcss/typography');
        }
        return recommendations;
    }

    /** Generate configuration file content. */
    generateConfigString(): string {
        if (this.typescript) {
            return this._generateTypescript();
        }
        return this._generateJavascript();
    }

    /** Generate TypeScript configuration. */
    _generateTypescript(): string {
        const pluginsStr = this._formatPlugins();

        // Match the .py: it builds config_json twice (the first is dead);
        // the live one drops the plugins array, then dumps indent=2.
        const configObj: Dict = { ...this.config };
        delete configObj['plugins'];
        const configJson = jsonDumpsIndent2(configObj);

        return (
            `import type { Config } from 'tailwindcss'\n` +
            `\n` +
            `const config: Config = {\n` +
            `${this._indentJson(configJson, 1)}\n` +
            `  plugins: [${pluginsStr}],\n` +
            `}\n` +
            `\n` +
            `export default config\n`
        );
    }

    /** Generate JavaScript configuration. */
    _generateJavascript(): string {
        const pluginsStr = this._formatPlugins();

        const configObj: Dict = { ...this.config };
        delete configObj['plugins'];
        const configJson = jsonDumpsIndent2(configObj);

        return (
            `/** @type {import('tailwindcss').Config} */\n` +
            `module.exports = {\n` +
            `${this._indentJson(configJson, 1)}\n` +
            `  plugins: [${pluginsStr}],\n` +
            `}\n`
        );
    }

    /** Format plugins array for config. */
    _formatPlugins(): string {
        const arr = this.config['plugins'] as string[];
        if (arr.length === 0) {
            return '';
        }
        const pluginRequires = arr.map((plugin) => `require('${plugin}')`);
        return pluginRequires.join(', ');
    }

    /** Add indentation to JSON string (skip first and last brace lines). */
    _indentJson(jsonStr: string, level: number): string {
        const indent = '  '.repeat(level);
        const lines = jsonStr.split('\n');
        const indented = lines.slice(1, lines.length - 1).map((line) => indent + line);
        return indented.join('\n');
    }

    /** Write configuration to file → [success, message]. */
    writeConfig(): [boolean, string] {
        try {
            const configContent = this.generateConfigString();
            fs.writeFileSync(this.outputPath, configContent);
            return [true, `Configuration written to ${this.outputPath}`];
        } catch (e) {
            return [false, `Failed to write config: ${osErrorMessage(e)}`];
        }
    }

    /** Validate configuration → [valid, message]. */
    validateConfig(): [boolean, string] {
        if ((this.config['content'] as JsonVal[]).length === 0) {
            return [false, 'No content paths specified'];
        }
        if (Object.keys(this._extend()).length === 0) {
            return [true, 'Warning: No theme extensions defined'];
        }
        return [true, 'Configuration valid'];
    }
}

/** Render an OSError the way Python's `str(e)` does for write failures. */
function osErrorMessage(e: unknown): string {
    if (e && typeof e === 'object' && 'message' in e) {
        return String((e as { message: unknown }).message);
    }
    return String(e);
}

class ArgExit extends Error {
    constructor(public code: number) {
        super('argexit');
    }
}

interface Args {
    framework: string;
    js: boolean;
    output: string | null;
    colors: string[] | null;
    fonts: string[] | null;
    spacing: string[] | null;
    breakpoints: string[] | null;
    plugins: boolean;
    validate_only: boolean;
}

/** Emit the argparse-style error (usage to stderr + error line) and exit 2. */
function argError(message: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    throw new ArgExit(2);
}

const FRAMEWORK_CHOICES = ['react', 'vue', 'svelte', 'nextjs'];

/** Parse argv mirroring the argparse spec (nargs="*" flags collect tokens). */
function parseArgs(argv: string[]): Args {
    const args: Args = {
        framework: 'react',
        js: false,
        output: null,
        colors: null,
        fonts: null,
        spacing: null,
        breakpoints: null,
        plugins: false,
        validate_only: false,
    };
    const starFlags = new Set(['--colors', '--fonts', '--spacing', '--breakpoints']);

    let i = 0;
    while (i < argv.length) {
        let a = argv[i] as string;
        let inlineValue: string | null = null;
        const eq = a.indexOf('=');
        if (a.startsWith('--') && eq !== -1) {
            inlineValue = a.slice(eq + 1);
            a = a.slice(0, eq);
        }

        if (a === '--js') {
            args.js = true;
        } else if (a === '--plugins') {
            args.plugins = true;
        } else if (a === '--validate-only') {
            args.validate_only = true;
        } else if (a === '--framework') {
            const v = inlineValue ?? (argv[++i] as string | undefined);
            if (v === undefined) {
                argError('argument --framework: expected one argument');
            }
            if (!FRAMEWORK_CHOICES.includes(v)) {
                argError(
                    `argument --framework: invalid choice: '${v}' ` +
                        `(choose from 'react', 'vue', 'svelte', 'nextjs')`,
                );
            }
            args.framework = v;
        } else if (a === '--output') {
            const v = inlineValue ?? (argv[++i] as string | undefined);
            if (v === undefined) {
                argError('argument --output: expected one argument');
            }
            args.output = v;
        } else if (starFlags.has(a)) {
            const collected: string[] = [];
            if (inlineValue !== null) {
                collected.push(inlineValue);
            } else {
                while (i + 1 < argv.length && !(argv[i + 1] as string).startsWith('-')) {
                    collected.push(argv[++i] as string);
                }
            }
            const key = a.slice(2) as 'colors' | 'fonts' | 'spacing' | 'breakpoints';
            args[key] = collected;
        } else {
            argError(`unrecognized arguments: ${a}`);
        }
        i += 1;
    }
    return args;
}

export function main(argv: string[] = process.argv.slice(2)): number {
    let args: Args;
    try {
        args = parseArgs(argv);
    } catch (e) {
        if (e instanceof ArgExit) {
            return e.code;
        }
        throw e;
    }

    const generator = new TailwindConfigGenerator(!args.js, args.framework, args.output);

    // Add custom colors
    if (args.colors) {
        const colors: { [k: string]: string } = {};
        for (const colorSpec of args.colors) {
            const idx = colorSpec.indexOf(':');
            if (idx === -1) {
                process.stderr.write(`Invalid color spec: ${colorSpec}\n`);
                return 1;
            }
            const name = colorSpec.slice(0, idx);
            const value = colorSpec.slice(idx + 1);
            colors[name] = value;
        }
        generator.addColors(colors);
    }

    // Add custom fonts
    if (args.fonts) {
        const fonts: { [k: string]: string[] } = {};
        for (const fontSpec of args.fonts) {
            const idx = fontSpec.indexOf(':');
            if (idx === -1) {
                process.stderr.write(`Invalid font spec: ${fontSpec}\n`);
                return 1;
            }
            const fontType = fontSpec.slice(0, idx);
            const family = fontSpec.slice(idx + 1);
            fonts[fontType] = family.split(',').map((f) => _stripChars(f.trim(), "'\""));
        }
        generator.addFonts(fonts);
    }

    // Add custom spacing
    if (args.spacing) {
        const spacing: { [k: string]: string } = {};
        for (const spacingSpec of args.spacing) {
            const idx = spacingSpec.indexOf(':');
            if (idx === -1) {
                process.stderr.write(`Invalid spacing spec: ${spacingSpec}\n`);
                return 1;
            }
            const name = spacingSpec.slice(0, idx);
            const value = spacingSpec.slice(idx + 1);
            spacing[name] = value;
        }
        generator.addSpacing(spacing);
    }

    // Add custom breakpoints
    if (args.breakpoints) {
        const breakpoints: { [k: string]: string } = {};
        for (const bpSpec of args.breakpoints) {
            const idx = bpSpec.indexOf(':');
            if (idx === -1) {
                process.stderr.write(`Invalid breakpoint spec: ${bpSpec}\n`);
                return 1;
            }
            const name = bpSpec.slice(0, idx);
            const width = bpSpec.slice(idx + 1);
            breakpoints[name] = width;
        }
        generator.addBreakpoints(breakpoints);
    }

    // Add recommended plugins
    if (args.plugins) {
        const recommended = generator.recommendPlugins();
        generator.addPlugins(recommended);
        process.stdout.write(`Added recommended plugins: ${recommended.join(', ')}\n`);
        process.stdout.write('\nInstall with:\n');
        process.stdout.write(`  npm install -D ${recommended.join(' ')}\n`);
    }

    // Validate
    const [valid, message] = generator.validateConfig();
    if (!valid) {
        process.stderr.write(`Validation failed: ${message}\n`);
        return 1;
    }

    if (message.startsWith('Warning')) {
        process.stdout.write(`${message}\n`);
    }

    // Validate only mode
    if (args.validate_only) {
        process.stdout.write('Configuration valid\n');
        process.stdout.write('\nGenerated config:\n');
        process.stdout.write(`${generator.generateConfigString()}\n`);
        return 0;
    }

    // Write config
    const [success, writeMsg] = generator.writeConfig();
    process.stdout.write(`${writeMsg}\n`);
    return success ? 0 : 1;
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
