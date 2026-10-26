/**
 * `code-graph map --demo` — a map drawn from sample data, for working on the
 * map's pages when the repository at hand has no database, no contracts or no
 * pipeline to show.
 *
 * The demo fixture (`tests/fixtures/code-graph/demo/`) is a plain directory.
 * It is copied into a temporary git repository with a scripted history — several
 * authors, files changed together, a working change on top — and then goes
 * through the same build, lane readers and map writer as any repository. Nothing
 * in the payloads is special-cased: the only difference is `meta.demo`, which
 * puts the "sample data" chip in the header.
 *
 * The hub demo registers the fixture projects in a temporary user-global home,
 * so the user's own registry, estate index and hub are never read or written.
 * Both pages land in `<map dir>/.build/demo/` (gitignored) or `--out`.
 */
import { execFileSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { updateRegistry } from '../_lib/project_registry.js';
import { hardenedSpawnEnv } from '../_lib/spawn_env.js';
import { planHub, writeHub } from './estate_map.js';
import { graphHome } from './graph_home.js';
import { buildMap, hasMap, type MapBuildResult } from './map.js';
import { registerUse } from './projects_cli.js';
import type { CodeGraph } from './types.js';

const PKG_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
export const DEMO_FIXTURE = path.join(PKG_ROOT, 'tests', 'fixtures', 'code-graph', 'demo');
export const HUB_FIXTURE = path.join(PKG_ROOT, 'tests', 'fixtures', 'code-graph', 'hub');

/** Where `map --demo` writes when no `--out` is given: inside the root's gitignored `.build/`. */
export function demoOutDir(root: string): string {
    return path.join(graphHome(root).buildDir, 'demo');
}

interface Author {
    name: string;
    email: string;
}

const ADA: Author = { name: 'Ada Demo', email: 'ada@example.com' };
const BEN: Author = { name: 'Ben Demo', email: 'ben@example.com' };
const CLEO: Author = { name: 'Cleo Demo', email: 'cleo@example.com' };

/**
 * One commit of the scripted history: the fixture files it adds or changes, by
 * prefix. `draft` files are committed with a revision line appended, so a later
 * step that lists them again (and the final content) counts as a change — this is
 * what gives the history area churn, owners and pairs of files changed together.
 */
interface Step {
    author: Author;
    message: string;
    paths: string[];
    draft?: string[];
}

const HISTORY: Step[] = [
    {
        author: ADA,
        message: 'feat: orders and users',
        paths: [
            'composer.json', 'README.md', '.gitignore', '.env.example', 'config/database.php', 'routes/web.php',
            'app/Http/Controllers/OrderController.php', 'app/Models/User.php', 'app/Models/Order.php', 'app/Models/Coupon.php',
            'database/migrations/2024_01_01_000001', 'database/migrations/2024_01_01_000002', 'database/migrations/2024_01_01_000003',
        ],
    },
    {
        author: BEN,
        message: 'feat: shops, order items and invoices',
        paths: [
            'database/migrations/2024_01_01_000004', 'database/migrations/2024_01_01_000005', 'database/migrations/2024_01_01_000006',
            'app/Models/Shop.php', 'app/Models/OrderItem.php', 'app/Models/Invoice.php', 'app/Http/Controllers/InvoiceController.php',
            'tests/Feature/',
        ],
    },
    {
        author: ADA,
        message: 'feat: partner integration over REST and SOAP',
        paths: [
            'app/Services/PartnerClient.php', 'contracts/', 'resources/wsdl/', 'config/services.php', 'routes/api.php',
            'app/Http/Controllers/StockController.php', 'docs/decisions/ADR-001',
        ],
    },
    {
        author: CLEO,
        message: 'chore: containers, infrastructure and the frontend',
        paths: ['compose.yaml', 'compose.resolved.yaml', 'Dockerfile', 'Makefile', 'Taskfile.yml', 'infra/', 'k8s/', '.devcontainer/', 'resources/js/', 'package.json'],
    },
    { author: CLEO, message: 'ci: GitHub Actions and GitLab pipelines', paths: ['.github/', '.gitlab-ci.yml'] },
    {
        author: BEN,
        message: 'feat: queued stock sync, coupon pruning, tenant customers',
        paths: [
            'app/Jobs/', 'app/Console/', 'docs/decisions/ADR-002', 'docs/decisions/ADR-003', 'app/Models/Customer.php',
            'database/migrations/2024_03_',
        ],
    },
    { author: ADA, message: 'chore: commit the schema dump and the snapshot', paths: ['database/schema/', 'agents/'] },
    { author: ADA, message: 'refactor: order listing', paths: [], draft: ['app/Http/Controllers/OrderController.php', 'app/Models/Order.php'] },
    { author: BEN, message: 'fix: partner stock path', paths: [], draft: ['app/Services/PartnerClient.php', 'contracts/partner.openapi.yaml'] },
    { author: ADA, message: 'feat: order detail', paths: [], draft: ['app/Http/Controllers/OrderController.php', 'app/Models/Order.php', 'tests/Feature/OrderControllerTest.php'] },
    { author: BEN, message: 'feat: cancel a partner order', paths: [], draft: ['app/Services/PartnerClient.php', 'contracts/partner.openapi.yaml'] },
    { author: ADA, message: 'feat: place an order', paths: ['app/Http/Controllers/OrderController.php', 'app/Models/Order.php', 'tests/Feature/OrderControllerTest.php'] },
    { author: BEN, message: 'feat: partner prices', paths: ['app/Services/PartnerClient.php', 'contracts/partner.openapi.yaml'] },
];

/** First commit of the scripted history; each later one is ten days on. */
const HISTORY_START = Date.parse('2026-05-04T09:00:00Z');
const STEP_MS = 10 * 86_400_000;

/**
 * The uncommitted change on top of the history, so Impact and the agent's
 * context pack have a diff: a new column, a new partner operation, one more CI
 * step and a new controller. Each edit is inserted before its anchor; a fixture that no
 * longer has it fails here rather than drawing a demo without a diff.
 */
const WORKING_CHANGE: Array<{ file: string; anchor: string; insert: string } | { file: string; create: string }> = [
    { file: 'database/migrations/2024_01_01_000005_create_order_items_table.php', anchor: "            $table->integer('quantity');", insert: "            $table->string('sku')->index();\n" },
    {
        file: 'app/Services/PartnerClient.php',
        anchor: '    public function prices(',
        insert:
            "    public function returns(string $orderId): array\n    {\n        return Http::withToken(config('services.partner.key'))\n" +
            "            ->get(config('services.partner.url') . \"/orders/{$orderId}/returns\")\n            ->json();\n    }\n\n",
    },
    { file: '.github/workflows/ci.yml', anchor: '  build:\n', insert: '      - run: npm run lint\n' },
    {
        file: 'app/Http/Controllers/CouponController.php',
        create:
            '<?php\n\nnamespace App\\Http\\Controllers;\n\nuse App\\Models\\Coupon;\n\nclass CouponController\n{\n    public function index()\n    {\n        return Coupon::whereNull(\'expires_at\')->paginate(25);\n    }\n}\n',
    },
];

function listFiles(dir: string, base = dir): string[] {
    const out: string[] = [];
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...listFiles(p, base));
        else if (e.isFile()) out.push(path.relative(base, p).split(path.sep).join('/'));
    }
    return out.sort();
}

function draftLine(rel: string, n: number): string {
    if (/\.(ya?ml)$/.test(rel)) return `# revision ${n}\n`;
    return `// revision ${n}\n`;
}

function git(root: string, args: string[], who?: Author, at?: number): void {
    const stamp = at === undefined ? {} : { GIT_AUTHOR_DATE: new Date(at).toISOString(), GIT_COMMITTER_DATE: new Date(at).toISOString() };
    const ident = who ? { GIT_AUTHOR_NAME: who.name, GIT_AUTHOR_EMAIL: who.email, GIT_COMMITTER_NAME: who.name, GIT_COMMITTER_EMAIL: who.email } : {};
    execFileSync('git', ['-c', 'core.hooksPath=/dev/null', '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'init.defaultBranch=main', '-C', root, ...args], {
        // The user's own git configuration (hooks, signing, templates) has no say over a throwaway fixture repository.
        env: hardenedSpawnEnv({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1', ...ident, ...stamp }),
        stdio: ['ignore', 'ignore', 'pipe'],
    });
}

/** The demo repository at `root`: the fixture, committed step by step, with the working change on top. */
export function materialiseDemoRepo(fixture: string, root: string, steps: readonly Step[] = HISTORY): void {
    const files = listFiles(fixture);
    const placed = new Set<string>();
    fs.mkdirSync(root, { recursive: true });
    git(root, ['init', '-q']);
    const put = (rel: string, suffix = ''): void => {
        const p = path.join(root, rel);
        fs.mkdirSync(path.dirname(p), { recursive: true });
        fs.writeFileSync(p, fs.readFileSync(path.join(fixture, rel), 'utf-8') + suffix);
        placed.add(rel);
    };
    steps.forEach((s, i) => {
        const owned = files.filter((f) => s.paths.some((p) => f === p || f.startsWith(p)));
        if (s.paths.length && !owned.length) throw new Error(`demo history step '${s.message}' matches no fixture file`);
        for (const f of owned) put(f);
        for (const f of s.draft ?? []) {
            if (!files.includes(f)) throw new Error(`demo history step '${s.message}' drafts a file the fixture lacks: ${f}`);
            put(f, draftLine(f, i));
        }
        git(root, ['add', '-A']);
        git(root, ['commit', '-q', '-m', s.message], s.author, HISTORY_START + i * STEP_MS);
    });
    const left = files.filter((f) => !placed.has(f));
    if (left.length) {
        for (const f of left) put(f);
        git(root, ['add', '-A']);
        git(root, ['commit', '-q', '-m', 'chore: remaining fixture files'], ADA, HISTORY_START + steps.length * STEP_MS);
    }
    for (const w of WORKING_CHANGE) {
        const p = path.join(root, w.file);
        if ('create' in w) {
            fs.mkdirSync(path.dirname(p), { recursive: true });
            fs.writeFileSync(p, w.create);
            continue;
        }
        const text = fs.readFileSync(p, 'utf-8');
        const at = text.indexOf(w.anchor);
        if (at < 0) throw new Error(`demo working change: ${w.file} no longer contains its anchor`);
        fs.writeFileSync(p, text.slice(0, at) + w.insert + text.slice(at));
    }
}

/** A fixture project of the hub demo as a committed repository with a project home. */
function hubProject(fixture: string, root: string): void {
    fs.cpSync(fixture, root, { recursive: true });
    fs.mkdirSync(path.join(root, 'agents'), { recursive: true });
    git(root, ['init', '-q']);
    git(root, ['add', '-A']);
    git(root, ['commit', '-q', '-m', 'fixture'], CLEO, HISTORY_START);
}

function readGraph(root: string): CodeGraph | null {
    try {
        return JSON.parse(fs.readFileSync(graphHome(root).cachePath, 'utf-8')) as CodeGraph;
    } catch {
        return null;
    }
}

function head(root: string): string | null {
    try {
        return execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], { env: hardenedSpawnEnv({ GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1' }), encoding: 'utf-8' }).trim();
    } catch {
        return null;
    }
}

/** Copy a drawn map folder, without its `.build/`, into `to`. */
function copyMap(from: string, to: string): void {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from)) {
        if (e === '.build') continue;
        fs.cpSync(path.join(from, e), path.join(to, e), { recursive: true });
    }
}

export interface DemoResult {
    outDir: string;
    page: string;
    hubPage: string;
    map: MapBuildResult;
    hubProjects: number;
}

/**
 * Draw the demo map and the hub demo into `outDir` (default {@link demoOutDir}).
 * A chosen directory is written only when it is empty or already holds a map.
 */
export async function buildDemoMap(root: string, opts: { outDir?: string } = {}): Promise<DemoResult> {
    if (!fs.existsSync(DEMO_FIXTURE)) throw new Error(`the demo fixture ships only with a source checkout of agent-config; not found: ${DEMO_FIXTURE}`);
    const outDir = opts.outDir ?? demoOutDir(root);
    if (opts.outDir !== undefined && fs.existsSync(outDir) && fs.readdirSync(outDir).length && !hasMap(outDir)) {
        throw new Error(`refusing to write the demo map into ${outDir}: it is not empty and holds no map.json`);
    }
    const tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'agent-config-map-demo-')));
    const saved = process.env['EVENT4U_CONFIG_HOME'];
    // Every user-global write of this run — repository identity key, registry,
    // estate index — lands in the temporary home and goes with it.
    process.env['EVENT4U_CONFIG_HOME'] = path.join(tmp, 'home');
    try {
        const shop = path.join(tmp, 'demo-shop');
        materialiseDemoRepo(DEMO_FIXTURE, shop);
        const map = await buildMap(shop, { demo: true });

        updateRegistry((reg) => {
            reg.index = true;
        });
        const projects = [shop];
        for (const name of ['alpha', 'beta']) {
            const from = path.join(HUB_FIXTURE, name);
            if (!fs.existsSync(from)) continue;
            const r = path.join(tmp, name);
            hubProject(from, r);
            await buildMap(r, { demo: true });
            projects.push(r);
        }
        for (const r of projects) registerUse(r, readGraph(r), head(r));
        fs.rmSync(outDir, { recursive: true, force: true });
        copyMap(map.outDir, outDir);
        // Written in place, not copied: the hub's banner names the folder it was written to.
        const hubOut = path.join(outDir, 'hub');
        const plan = planHub(hubOut);
        writeHub(hubOut, plan, true);
        fs.rmSync(path.join(hubOut, '.build'), { recursive: true, force: true });
        return { outDir, page: path.join(outDir, 'index.html'), hubPage: path.join(outDir, 'hub', 'index.html'), map, hubProjects: plan.payload.projects.length };
    } finally {
        if (saved === undefined) delete process.env['EVENT4U_CONFIG_HOME'];
        else process.env['EVENT4U_CONFIG_HOME'] = saved;
        fs.rmSync(tmp, { recursive: true, force: true });
    }
}
