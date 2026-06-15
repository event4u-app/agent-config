#!/usr/bin/env tsx
// Modified from upstream (Apache-2.0, "claudekit" via
// an external reference ui-styling sub-skill
// @ b7e3af80f6e331f6fb456667b82b12cade7c9d35, last checked 2026-06-07).
// License copy: src/skills/design-intelligence/LICENSE.apache-2.0.txt
// (deployed: <skills-root>/design-intelligence/LICENSE.apache-2.0.txt).
// Modifications: adopted into the agent-config skill tree; header added
// per Apache-2.0 §4b; see design-intelligence/ATTRIBUTION.md.
/**
 * shadcn/ui Component Installer
 *
 * Add shadcn/ui components to project with automatic dependency handling.
 * Wraps shadcn CLI for programmatic component installation.
 *
 * TypeScript twin of `src/skills/react-shadcn-ui/scripts/shadcn_add.py`
 * (ADR-096). The CLI contract is mirrored EXACTLY — positional components,
 * `--all`, `--overwrite`, `--dry-run`, `--list`, `--project-root`, exit codes
 * (0 / 1), the stdout/stderr split, byte-identical messages, AND the exact
 * `npx shadcn@latest …` command shape. No behaviour changes — latent Python
 * quirks replicated.
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';

export class ShadcnInstaller {
    projectRoot: string;
    dryRun: boolean;
    componentsJson: string;

    constructor(projectRoot: string | null = null, dryRun = false) {
        this.projectRoot = projectRoot ?? process.cwd();
        this.dryRun = dryRun;
        this.componentsJson = path.join(this.projectRoot, 'components.json');
    }

    /** Check if shadcn is initialized — components.json exists. */
    checkShadcnConfig(): boolean {
        return fs.existsSync(this.componentsJson);
    }

    /** Get list of already installed components (unsorted, mirrors .py). */
    getInstalledComponents(): string[] {
        if (!this.checkShadcnConfig()) {
            return [];
        }
        try {
            const config = JSON.parse(fs.readFileSync(this.componentsJson, 'utf-8')) as unknown;
            const aliasesRaw =
                config && typeof config === 'object' && 'aliases' in config
                    ? (config as { aliases?: unknown }).aliases
                    : undefined;
            const aliases =
                aliasesRaw && typeof aliasesRaw === 'object'
                    ? (aliasesRaw as { components?: unknown })
                    : {};
            const componentsAlias =
                typeof aliases.components === 'string' ? aliases.components : 'components';
            const componentsDir = path.join(this.projectRoot, componentsAlias.replace('@/', ''));
            const uiDir = path.join(componentsDir, 'ui');

            if (!fs.existsSync(uiDir)) {
                return [];
            }

            return _globTsxStems(uiDir);
        } catch {
            // json.JSONDecodeError | KeyError | OSError → []
            return [];
        }
    }

    /** Add shadcn/ui components → [success, message]. */
    addComponents(components: string[], overwrite = false): [boolean, string] {
        if (components.length === 0) {
            return [false, 'No components specified'];
        }

        if (!this.checkShadcnConfig()) {
            return [false, "shadcn not initialized. Run 'npx shadcn@latest init' first"];
        }

        // Check which components already exist
        const installed = this.getInstalledComponents();
        const alreadyInstalled = components.filter((c) => installed.includes(c));

        if (alreadyInstalled.length > 0 && !overwrite) {
            return [
                false,
                `Components already installed: ${alreadyInstalled.join(', ')}. ` +
                    'Use --overwrite to reinstall',
            ];
        }

        // Build command
        const cmd = ['npx', 'shadcn@latest', 'add', ...components];

        if (overwrite) {
            cmd.push('--overwrite');
        }

        if (this.dryRun) {
            return [true, `Would run: ${cmd.join(' ')}`];
        }

        // Execute command
        return this._runAdd(cmd, `Successfully added components: ${components.join(', ')}`);
    }

    /** Add all available shadcn/ui components → [success, message]. */
    addAllComponents(overwrite = false): [boolean, string] {
        if (!this.checkShadcnConfig()) {
            return [false, "shadcn not initialized. Run 'npx shadcn@latest init' first"];
        }

        const cmd = ['npx', 'shadcn@latest', 'add', '--all'];

        if (overwrite) {
            cmd.push('--overwrite');
        }

        if (this.dryRun) {
            return [true, `Would run: ${cmd.join(' ')}`];
        }

        return this._runAdd(cmd, 'Successfully added all components', true);
    }

    /**
     * Mirror the subprocess.run(..., check=True) try/except for both add paths.
     * `failAll` toggles the "Failed to add all components" vs "Failed to add
     * components" prefix.
     */
    private _runAdd(cmd: string[], successBase: string, failAll = false): [boolean, string] {
        const result = spawnSync(cmd[0] as string, cmd.slice(1), {
            cwd: this.projectRoot,
            encoding: 'utf-8',
        });

        // FileNotFoundError — the executable itself is missing.
        if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') {
            return [false, 'npx not found. Ensure Node.js is installed'];
        }

        const stdout = result.stdout ?? '';
        const stderr = result.stderr ?? '';
        const status = result.status;

        if (status === 0) {
            let successMsg = successBase;
            if (stdout) {
                successMsg += `\n\nOutput:\n${stdout}`;
            }
            return [true, successMsg];
        }

        // subprocess.CalledProcessError — e.stderr or e.stdout or str(e).
        const detail = stderr || stdout || _calledProcessError(cmd, status, result.signal);
        const prefix = failAll ? 'Failed to add all components' : 'Failed to add components';
        return [false, `${prefix}: ${detail}`];
    }

    /** List installed components → [success, message]. */
    listInstalled(): [boolean, string] {
        if (!this.checkShadcnConfig()) {
            return [false, 'shadcn not initialized'];
        }

        const installed = this.getInstalledComponents();

        if (installed.length === 0) {
            return [true, 'No components installed'];
        }

        const sorted = [...installed].sort(_pyStrCmp);
        return [true, 'Installed components:\n' + sorted.map((c) => `  - ${c}`).join('\n')];
    }
}

/** Mirror Python default str comparison (UTF-16 code-unit ordering matches for BMP). */
function _pyStrCmp(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Mirror `[f.stem for f in ui_dir.glob("*.tsx") if f.is_file()]`. Path.glob
 * returns only direct children whose name ends in `.tsx`; `f.stem` drops the
 * final `.tsx` suffix; order is the directory listing (later `sorted()` in
 * list_installed handles display order). Symlinks to files count as files.
 */
function _globTsxStems(uiDir: string): string[] {
    let entries: fs.Dirent[];
    try {
        entries = fs.readdirSync(uiDir, { withFileTypes: true });
    } catch {
        return [];
    }
    const out: string[] = [];
    for (const e of entries) {
        if (!e.name.endsWith('.tsx')) {
            continue;
        }
        let isFile = e.isFile();
        if (e.isSymbolicLink()) {
            try {
                isFile = fs.statSync(path.join(uiDir, e.name)).isFile();
            } catch {
                isFile = false;
            }
        }
        if (isFile) {
            out.push(e.name.slice(0, -'.tsx'.length));
        }
    }
    return out;
}

/** Mirror `str(subprocess.CalledProcessError)` for the rare empty-output case. */
function _calledProcessError(cmd: string[], status: number | null, signal: string | null): string {
    const cmdRepr = '[' + cmd.map((c) => `'${c}'`).join(', ') + ']';
    if (signal) {
        return `Command ${cmdRepr} died with ${signal}.`;
    }
    return `Command ${cmdRepr} returned non-zero exit status ${status}.`;
}

const PROG = 'shadcn_add.py';

const HELP =
    `usage: ${PROG} [-h] [--all] [--overwrite] [--dry-run] [--list]\n` +
    '                     [--project-root PROJECT_ROOT]\n' +
    '                     [components ...]\n' +
    '\n' +
    'Add shadcn/ui components to your project\n' +
    '\n' +
    'positional arguments:\n' +
    '  components            Component names to add (e.g., button, card, dialog)\n' +
    '\n' +
    'optional arguments:\n' +
    '  -h, --help            show this help message and exit\n' +
    '  --all                 Add all available components\n' +
    '  --overwrite           Overwrite existing components\n' +
    '  --dry-run             Show what would be done without executing\n' +
    '  --list                List installed components\n' +
    '  --project-root PROJECT_ROOT\n' +
    '                        Project root directory (default: current directory)\n' +
    '\n' +
    'Examples:\n' +
    '  # Add single component\n' +
    '  python shadcn_add.py button\n' +
    '\n' +
    '  # Add multiple components\n' +
    '  python shadcn_add.py button card dialog\n' +
    '\n' +
    '  # Add all components\n' +
    '  python shadcn_add.py --all\n' +
    '\n' +
    '  # Overwrite existing components\n' +
    '  python shadcn_add.py button --overwrite\n' +
    '\n' +
    '  # Dry run (show what would be done)\n' +
    '  python shadcn_add.py button card --dry-run\n' +
    '\n' +
    '  # List installed components\n' +
    '  python shadcn_add.py --list\n' +
    '        \n';

const USAGE =
    `usage: ${PROG} [-h] [--all] [--overwrite] [--dry-run] [--list]\n` +
    '                     [--project-root PROJECT_ROOT]\n' +
    '                     [components ...]\n';

class ArgExit extends Error {
    constructor(public code: number) {
        super('argexit');
    }
}

interface Args {
    components: string[];
    all: boolean;
    overwrite: boolean;
    dry_run: boolean;
    list: boolean;
    project_root: string | null;
}

function argError(message: string): never {
    process.stderr.write(USAGE);
    process.stderr.write(`${PROG}: error: ${message}\n`);
    throw new ArgExit(2);
}

/** Parse argv mirroring the argparse spec (positional `components` nargs="*"). */
function parseArgs(argv: string[]): Args {
    const args: Args = {
        components: [],
        all: false,
        overwrite: false,
        dry_run: false,
        list: false,
        project_root: null,
    };

    let i = 0;
    while (i < argv.length) {
        let a = argv[i] as string;
        let inlineValue: string | null = null;
        const eq = a.indexOf('=');
        if (a.startsWith('--') && eq !== -1) {
            inlineValue = a.slice(eq + 1);
            a = a.slice(0, eq);
        }

        if (a === '-h' || a === '--help') {
            process.stdout.write(HELP);
            throw new ArgExit(0);
        } else if (a === '--all') {
            args.all = true;
        } else if (a === '--overwrite') {
            args.overwrite = true;
        } else if (a === '--dry-run') {
            args.dry_run = true;
        } else if (a === '--list') {
            args.list = true;
        } else if (a === '--project-root') {
            const v = inlineValue ?? (argv[++i] as string | undefined);
            if (v === undefined) {
                argError('argument --project-root: expected one argument');
            }
            args.project_root = v;
        } else if (a.startsWith('-') && a !== '-') {
            argError(`unrecognized arguments: ${argv[i]}`);
        } else {
            args.components.push(argv[i] as string);
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

    const installer = new ShadcnInstaller(args.project_root, args.dry_run);

    // Handle list command
    if (args.list) {
        const [success, message] = installer.listInstalled();
        process.stdout.write(`${message}\n`);
        return success ? 0 : 1;
    }

    // Handle add all command
    if (args.all) {
        const [success, message] = installer.addAllComponents(args.overwrite);
        process.stdout.write(`${message}\n`);
        return success ? 0 : 1;
    }

    // Handle add specific components
    if (args.components.length === 0) {
        process.stdout.write(HELP);
        return 1;
    }

    const [success, message] = installer.addComponents(args.components, args.overwrite);

    process.stdout.write(`${message}\n`);
    return success ? 0 : 1;
}

const _invokedDirectly =
    process.argv[1] !== undefined &&
    import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (_invokedDirectly) {
    process.exitCode = main();
}
