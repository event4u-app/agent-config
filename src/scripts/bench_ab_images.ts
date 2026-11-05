#!/usr/bin/env node
/**
 * Build the two benchmark images and record exactly what was built.
 *
 * `bench-base` carries the agent CLI and the fixture toolchain; `bench-ac` is
 * that image plus this tree, packed and installed by the public installer. The
 * runner never builds: it reads `images.json` and runs the recorded image ids,
 * so a report names the image a trial ran in rather than a mutable tag.
 *
 * Usage: bench_ab_images [--out <images.json>] [--cli-version <x.y.z>]
 */
import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { read_token_pool, TokenPool, type ContainerCtx } from './_lib/bench_ab_container.js';
import { package_skill_names } from './_lib/bench_ab_delivery_probe.js';

const _HERE = fileURLToPath(import.meta.url);
const REPO_ROOT = path.resolve(path.dirname(_HERE), '..', '..');
export const CONTAINERS_DIR = path.join(REPO_ROOT, 'internal', 'bench', 'containers');
export const DEFAULT_IMAGES_FILE = path.join(CONTAINERS_DIR, 'images.json');
export const DEFAULT_CLI_VERSION = '2.1.316';

export interface ImageRecord {
    tag: string;
    id: string;
}

export interface ImagesFile {
    schema: 1;
    built_at: string;
    tree_sha: string;
    /** True when the packed tree carried uncommitted changes — the tarball is then not `tree_sha`. */
    tree_dirty: boolean;
    package_version: string;
    cli_version: string;
    base: ImageRecord;
    ac: ImageRecord;
}

export interface Exec {
    (cmd: string, args: readonly string[], opts?: { cwd?: string }): { status: number | null; stdout: string; stderr: string };
}

const realExec: Exec = (cmd, args, opts) => {
    const r = spawnSync(cmd, args, { cwd: opts?.cwd, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024 });
    return { status: r.status, stdout: r.stdout ?? '', stderr: r.stderr ?? '' };
};

function must(exec: Exec, cmd: string, args: readonly string[], opts?: { cwd?: string }): string {
    const r = exec(cmd, args, opts);
    if (r.status !== 0) {
        throw new Error(`${cmd} ${args.join(' ')} failed (exit ${String(r.status)}): ${r.stderr.trim().slice(-400)}`);
    }
    return r.stdout.trim();
}

/** `2.1.316 (Claude Code)` → `2.1.316`; null when the output carries no version. */
export function parse_cli_version(out: string): string | null {
    const m = /\b(\d+\.\d+\.\d+)\b/.exec(out);
    return m ? m[1] : null;
}

/**
 * Build both images and return the record. Every external call goes through
 * `exec`, so the sequence is testable without Docker.
 */
export function build_images(opts: { exec?: Exec; cli_version?: string; now?: () => Date } = {}): ImagesFile {
    const exec = opts.exec ?? realExec;
    const cliVersion = opts.cli_version ?? DEFAULT_CLI_VERSION;
    const tree_sha = must(exec, 'git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT });
    const tree_dirty = must(exec, 'git', ['status', '--porcelain', '--untracked-files=no'], { cwd: REPO_ROOT }) !== '';
    const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf-8')) as { version: string };

    const ctx = fs.mkdtempSync(path.join(os.tmpdir(), 'bench-ac-ctx-'));
    try {
        const packed = must(exec, 'npm', ['pack', '--silent', '--pack-destination', ctx], { cwd: REPO_ROOT })
            .split('\n')
            .pop() as string;
        fs.renameSync(path.join(ctx, packed), path.join(ctx, 'agent-config.tgz'));
        fs.copyFileSync(path.join(CONTAINERS_DIR, 'Dockerfile.ac'), path.join(ctx, 'Dockerfile.ac'));

        must(exec, 'docker', [
            'build', '-q', '-t', 'bench-base',
            '--build-arg', `CLAUDE_CLI_VERSION=${cliVersion}`,
            '-f', path.join(CONTAINERS_DIR, 'Dockerfile.base'), CONTAINERS_DIR,
        ]);
        const baseId = must(exec, 'docker', ['image', 'inspect', '--format', '{{.Id}}', 'bench-base']);
        must(exec, 'docker', [
            'build', '-q', '-t', 'bench-ac',
            '--build-arg', 'BASE_IMAGE=bench-base',
            '-f', path.join(ctx, 'Dockerfile.ac'), ctx,
        ]);
        const acId = must(exec, 'docker', ['image', 'inspect', '--format', '{{.Id}}', 'bench-ac']);

        const seen = parse_cli_version(must(exec, 'docker', ['run', '--rm', baseId, 'claude', '--version']));
        if (seen !== cliVersion) {
            throw new Error(`bench-base runs CLI ${String(seen)}, expected ${cliVersion}`);
        }
        return {
            schema: 1,
            built_at: (opts.now ?? (() => new Date()))().toISOString(),
            tree_sha,
            tree_dirty,
            package_version: pkg.version,
            cli_version: cliVersion,
            base: { tag: 'bench-base', id: baseId },
            ac: { tag: 'bench-ac', id: acId },
        };
    } finally {
        fs.rmSync(ctx, { recursive: true, force: true });
    }
}

/** Read and validate `images.json`; throws with the reason when it cannot be used. */
export function read_images(file: string = DEFAULT_IMAGES_FILE): ImagesFile {
    if (!fs.existsSync(file)) {
        throw new Error(`${file} not found — build the images first: ./scripts-run src/scripts/bench_ab_images`);
    }
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<ImagesFile>;
    for (const k of ['tree_sha', 'cli_version', 'package_version'] as const) {
        if (typeof raw[k] !== 'string' || !raw[k]) throw new Error(`${file}: missing ${k}`);
    }
    for (const k of ['base', 'ac'] as const) {
        const rec = raw[k];
        if (!rec || typeof rec.id !== 'string' || !rec.id.startsWith('sha256:')) {
            throw new Error(`${file}: ${k}.id is not an image id`);
        }
    }
    return raw as ImagesFile;
}

/**
 * The container context a sweep runs with: the recorded images, the token and
 * the package's skill names for the load check. A selftest makes no model call,
 * so it needs neither images nor a token and gets placeholders it never uses.
 */
export function container_context(opts: { selftest: boolean; images_file?: string }): { ctx: ContainerCtx; images: ImagesFile | null } {
    if (opts.selftest) {
        return { ctx: { base_image: 'selftest', ac_image: 'selftest', token: '', package_skills: new Set() }, images: null };
    }
    const images = read_images(opts.images_file);
    const ctx: ContainerCtx = {
        base_image: images.base.id,
        ac_image: images.ac.id,
        token: '',
        package_skills: package_skill_names(path.join(REPO_ROOT, 'src', 'skills')),
        pool: new TokenPool(read_token_pool()),
    };
    ctx.token = (ctx.pool as TokenPool).current.token;
    return { ctx, images };
}

export function main(argv: readonly string[] = process.argv.slice(2), exec?: Exec): number {
    let out = DEFAULT_IMAGES_FILE;
    let cli: string | undefined;
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--out') out = argv[++i] ?? out;
        else if (a === '--cli-version') cli = argv[++i];
        else {
            process.stderr.write(`bench_ab_images: unknown argument ${a}\n`);
            return 2;
        }
    }
    const rec = build_images({ ...(exec ? { exec } : {}), ...(cli ? { cli_version: cli } : {}) });
    fs.writeFileSync(out, `${JSON.stringify(rec, null, 2)}\n`, 'utf-8');
    process.stdout.write(`bench_ab_images: base ${rec.base.id.slice(0, 19)} · ac ${rec.ac.id.slice(0, 19)} · CLI ${rec.cli_version} · package ${rec.package_version} @ ${rec.tree_sha.slice(0, 10)}${rec.tree_dirty ? '+dirty' : ''} → ${out}\n`);
    return 0;
}

function _isCliEntry(): boolean {
    try {
        return fs.realpathSync(_HERE) === fs.realpathSync(path.resolve(process.argv[1] ?? ''));
    } catch {
        return false;
    }
}

if (_isCliEntry()) {
    process.exitCode = main();
}
