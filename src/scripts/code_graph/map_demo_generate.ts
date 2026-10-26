/**
 * The load half of the demo: a seeded, deterministic expansion of the demo
 * fixture into a repository big enough to show every view of the map under
 * load — a few thousand source files in PHP (Laravel modules), TypeScript,
 * Python and Go, dozens of tables over three connections, a few dozen
 * external services with contracts, Compose, Kubernetes and Terraform over
 * three environments, a hundred CI jobs, a few dozen decision records and a
 * history of a few hundred commits by ten authors.
 *
 * Nothing here is committed to this repository: it is written into the
 * temporary demo repository and read there by the normal build. The same seed
 * produces the same files, the same commits and the same working change.
 */

/** A seeded generator (mulberry32): the same seed gives the same sequence. */
export function rng(seed: number): () => number {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

export interface DemoAuthor {
    name: string;
    email: string;
}

const NAMES = ['Ada', 'Ben', 'Cleo', 'Dev', 'Eli', 'Fay', 'Gus', 'Hana', 'Ivo', 'Jun'];
export const LOAD_AUTHORS: readonly DemoAuthor[] = NAMES.map((n) => ({ name: `${n} Demo`, email: `${n.toLowerCase()}@example.com` }));

/** One commit of the generated history: whole files to write, and edits to files already there. */
export interface LoadCommit {
    author: DemoAuthor;
    message: string;
    files: Record<string, string>;
    edits: Array<{ file: string; edit: (text: string) => string }>;
}

export interface DemoLoad {
    commits: LoadCommit[];
    /** The uncommitted change on top of the history, across code, data, interfaces, runtime and delivery. */
    working: Array<{ file: string; edit: (text: string) => string }>;
}

export interface HubLoadProject {
    name: string;
    files: Record<string, string>;
}

const DOMAINS = [
    'Billing', 'Catalog', 'Checkout', 'Shipping', 'Returns', 'Loyalty', 'Pricing', 'Search', 'Reviews', 'Wishlist',
    'Accounts', 'Auth', 'Tenants', 'Payments', 'Refunds', 'Taxes', 'Invoicing', 'Ledger', 'Payouts', 'Disputes',
    'Inventory', 'Warehouses', 'Suppliers', 'Purchasing', 'Forecasts', 'Promotions', 'Coupons', 'Gifts', 'Bundles', 'Subscriptions',
    'Notifications', 'Mailing', 'Sms', 'Push', 'Support', 'Tickets', 'Chat', 'Knowledge', 'Feedback', 'Surveys',
    'Reports', 'Analytics', 'Exports', 'Imports', 'Audit', 'Compliance', 'Privacy', 'Consents', 'Media', 'Assets',
    'Content', 'Pages', 'Blog', 'Seo', 'Sitemaps', 'Partners', 'Affiliates', 'Marketplace', 'Vendors', 'Contracts',
];
const ENTITIES = ['Record', 'Entry', 'Batch', 'Rule', 'Item', 'Plan', 'Event', 'Line', 'Slot', 'Note', 'Grant', 'Limit'];
const TS_FEATURES = [
    'cart', 'checkout', 'catalog', 'search', 'account', 'orders', 'returns', 'wishlist', 'reviews', 'loyalty',
    'admin-users', 'admin-orders', 'admin-catalog', 'admin-reports', 'admin-settings', 'support', 'chat', 'inbox', 'billing', 'invoices',
    'shipping', 'tracking', 'stores', 'pickup', 'gift-cards', 'promotions', 'banners', 'cms', 'blog', 'help',
    'onboarding', 'profile', 'security', 'consents', 'notifications', 'exports', 'imports', 'dashboards', 'partners', 'vendors',
];
const PY_PACKAGES = [
    'quotes', 'discounts', 'margins', 'currency', 'rounding', 'taxes', 'bundles', 'tiers', 'elasticity', 'competitors',
    'forecast', 'seasonality', 'anomalies', 'features', 'training', 'serving', 'experiments', 'segments', 'cohorts', 'reports',
    'ingest', 'cleaning', 'storage', 'scheduler', 'api',
];
const GO_PACKAGES = ['stock', 'reserve', 'release', 'transfer', 'count', 'locations', 'bins', 'picking', 'packing', 'labels', 'carriers', 'events', 'store', 'httpapi', 'grpcapi'];
const ENVS = ['dev', 'staging', 'prod'] as const;

const snake = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replace(/-/g, '_').toLowerCase();
const plural = (s: string): string => (s.endsWith('y') ? `${s.slice(0, -1)}ies` : s.endsWith('s') ? `${s}es` : `${s}s`);
const pascal = (s: string): string => s.split(/[-_]/).map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');
const camel = (s: string): string => { const p = pascal(s); return p.charAt(0).toLowerCase() + p.slice(1); };

/** Before the class's (or file's) last closing brace. */
export function beforeLastBrace(text: string, add: string): string {
    const at = text.lastIndexOf('}');
    return at < 0 ? text + add : `${text.slice(0, at)}${add}${text.slice(at)}`;
}

interface PhpEntity {
    module: string;
    name: string;
    cls: string;
    table: string;
    connection: string | null;
}

interface Owner {
    primary: DemoAuthor;
    second: DemoAuthor;
}

class Gen {
    readonly r: () => number;
    readonly commits: LoadCommit[] = [];
    constructor(seed: number) {
        this.r = rng(seed);
    }
    int(n: number): number {
        return Math.floor(this.r() * n);
    }
    pick<T>(xs: readonly T[]): T {
        return xs[this.int(xs.length)] as T;
    }
    chance(p: number): boolean {
        return this.r() < p;
    }
    author(): DemoAuthor {
        return this.pick(LOAD_AUTHORS);
    }
    owner(i: number): Owner {
        return { primary: LOAD_AUTHORS[i % LOAD_AUTHORS.length] as DemoAuthor, second: LOAD_AUTHORS[(i * 3 + 1) % LOAD_AUTHORS.length] as DemoAuthor };
    }
    commit(author: DemoAuthor, message: string, files: Record<string, string> = {}, edits: LoadCommit['edits'] = []): void {
        this.commits.push({ author, message, files, edits });
    }
}

// ---------------------------------------------------------------- PHP modules

function phpModules(g: Gen): { entities: PhpEntity[]; routes: string[]; services: string[] } {
    const entities: PhpEntity[] = [];
    const routes: string[] = [];
    const services: string[] = [];
    DOMAINS.forEach((mod, mi) => {
        const own = g.owner(mi);
        const connection = mi < 10 ? null : mi < 18 ? 'tenant' : mi < 24 ? 'analytics' : null;
        const names = [0, 1, 2].map((k) => ENTITIES[(mi + k * 5) % ENTITIES.length] as string);
        const ents = names.map((n) => {
            const cls = `${mod.replace(/s$/, '')}${n}`;
            return { module: mod, name: n, cls, table: plural(snake(cls)), connection: mi < 24 ? connection : null } as PhpEntity;
        });
        const files: Record<string, string> = {};
        const ns = `App\\Modules\\${mod}`;
        const other = DOMAINS[(mi + 7) % DOMAINS.length] as string;
        const otherSvc = `${other.replace(/s$/, '')}${ENTITIES[((mi + 7) % DOMAINS.length) % ENTITIES.length]}Service`;
        ents.forEach((e, k) => {
            const parent = k > 0 ? (ents[0] as PhpEntity) : null;
            const sibling = ents[(k + 1) % ents.length] as PhpEntity;
            files[`app/Modules/${mod}/Models/${e.cls}.php`] =
                `<?php\n\nnamespace ${ns}\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\n\nclass ${e.cls} extends Model\n{\n` +
                (e.connection ? `    protected $connection = '${e.connection}';\n\n` : '') +
                `    protected $table = '${e.table}';\n\n    protected $fillable = ['name', 'status', 'amount'];\n` +
                (parent ? `\n    public function ${camel(parent.cls)}()\n    {\n        return $this->belongsTo(${parent.cls}::class);\n    }\n` : '') +
                (k === 0 ? `\n    public function ${camel(plural(sibling.cls))}()\n    {\n        return $this->hasMany(${sibling.cls}::class);\n    }\n` : '') +
                (k === 2 ? `\n    public function ${camel(plural(ents[1]!.cls))}()\n    {\n        return $this->belongsToMany(${ents[1]!.cls}::class, '${snake(ents[1]!.cls)}_${snake(e.cls)}');\n    }\n` : '') +
                (k === 1 ? `\n    public function notes()\n    {\n        return $this->morphMany(\\App\\Models\\Note::class, 'notable');\n    }\n` : '') +
                `}\n`;
            const svc = `${e.cls}Service`;
            services.push(`${ns}\\Services\\${svc}`);
            const nextSvc = `${sibling.cls}Service`;
            files[`app/Modules/${mod}/Services/${svc}.php`] =
                `<?php\n\nnamespace ${ns}\\Services;\n\nuse ${ns}\\Models\\${e.cls};\n` +
                (k === 0 && mi > 0 && mi % 6 === 0 ? `use App\\Modules\\${other}\\Services\\${otherSvc};\n` : '') +
                `\nclass ${svc}\n{\n    public static function handle(int $id): array\n    {\n        $row = ${e.cls}::query()->findOrFail($id);\n` +
                `        ${nextSvc}::validate($row->toArray());\n` +
                (k === 0 && mi > 0 && mi % 6 === 0 ? `        ${otherSvc}::validate(['ref' => $id]);\n` : '') +
                `        return $row->toArray();\n    }\n\n    public static function validate(array $data): bool\n    {\n        return isset($data['name']) || isset($data['ref']);\n    }\n\n` +
                `    public static function export(iterable $rows, object $writer): int\n    {\n        $n = 0;\n        foreach ($rows as $row) {\n            $writer->process($row);\n            $n++;\n        }\n\n        return $n;\n    }\n\n` +
                (k === 1 && parent && mi % 2 === 0
                    ? `    public static function report(): array\n    {\n        return \\Illuminate\\Support\\Facades\\DB::select('select p.name, c.status from ${parent.table} p join ${e.table} c on c.${snake(parent.cls)}_id = p.id');\n    }\n\n`
                    : '') +
                `    public function process(array $row): void\n    {\n        self::validate($row);\n    }\n}\n`;
            files[`app/Modules/${mod}/Http/Controllers/${e.cls}Controller.php`] =
                `<?php\n\nnamespace ${ns}\\Http\\Controllers;\n\nuse ${ns}\\Jobs\\Sync${e.cls};\nuse ${ns}\\Services\\${svc};\n\nclass ${e.cls}Controller\n{\n` +
                `    public function show(int $id): array\n    {\n        return ${svc}::handle($id);\n    }\n\n    public function sync(int $id): void\n    {\n        Sync${e.cls}::dispatch($id);\n    }\n\n` +
                // Calls on a receiver whose type nothing states: the graph can only guess where they land.
                `    public function audit(object $sink): void\n    {\n        $sink->export([], $sink);\n        $sink->validate([]);\n        $sink->rev${k * 7 + (mi % 5)}();\n    }\n}\n`;
            const slug = snake(mod).replace(/_/g, '-');
            routes.push(
                `Route::get('/api/${slug}/${snake(e.name)}s/{id}', [\\${ns}\\Http\\Controllers\\${e.cls}Controller::class, 'show']);`,
                `Route::post('/api/${slug}/${snake(e.name)}s/{id}/sync', [\\${ns}\\Http\\Controllers\\${e.cls}Controller::class, 'sync']);`,
            );
            files[`app/Modules/${mod}/Jobs/Sync${e.cls}.php`] =
                `<?php\n\nnamespace ${ns}\\Jobs;\n\nuse ${ns}\\Services\\${svc};\nuse Illuminate\\Contracts\\Queue\\ShouldQueue;\n\nclass Sync${e.cls} implements ShouldQueue\n{\n` +
                `    public function __construct(private int $id)\n    {\n    }\n\n    public function handle(): void\n    {\n        ${svc}::handle($this->id);\n    }\n}\n`;
            files[`app/Modules/${mod}/Events/${e.cls}Changed.php`] =
                `<?php\n\nnamespace ${ns}\\Events;\n\nclass ${e.cls}Changed\n{\n    public function __construct(public int $id)\n    {\n    }\n}\n`;
            files[`app/Modules/${mod}/Listeners/On${e.cls}Changed.php`] =
                `<?php\n\nnamespace ${ns}\\Listeners;\n\nuse ${ns}\\Events\\${e.cls}Changed;\nuse ${ns}\\Services\\${svc};\n\nclass On${e.cls}Changed\n{\n` +
                `    public function handle(${e.cls}Changed $event): void\n    {\n        ${svc}::handle($event->id);\n    }\n}\n`;
            files[`tests/Unit/${mod}/${svc}Test.php`] =
                `<?php\n\nnamespace Tests\\Unit\\${mod};\n\nuse ${ns}\\Services\\${svc};\nuse PHPUnit\\Framework\\TestCase;\n\nclass ${svc}Test extends TestCase\n{\n` +
                `    public function test_validate_accepts_a_name(): void\n    {\n        $this->assertTrue(${svc}::validate(['name' => 'x']));\n    }\n}\n`;
        });
        if (mi % 4 === 0) {
            files[`app/Modules/${mod}/Support/Legacy${mod}Helper.php`] =
                `<?php\n\nnamespace ${ns}\\Support;\n\nclass Legacy${mod}Helper\n{\n    public static function format(string $v): string\n    {\n        return trim($v);\n    }\n}\n`;
        }
        entities.push(...ents);
        g.commit(own.primary, `feat(${snake(mod)}): the ${mod} module`, files);
    });
    return { entities, routes, services };
}

/** One large, much-changed file: the hotspot the health score and the treemap should show. */
function monolith(): string {
    const methods: string[] = [];
    for (let i = 0; i < 70; i++) {
        methods.push(`    public static function step${i}(array $ctx): array\n    {\n        $ctx['step'] = ${i};\n        $ctx['total'] = ($ctx['total'] ?? 0) + ${i};\n\n        return $ctx;\n    }\n`);
    }
    return `<?php\n\nnamespace App\\Modules\\Billing\\Services;\n\nclass LegacyBillingRun\n{\n${methods.join('\n')}}\n`;
}

// ------------------------------------------------------------------ database

function migrations(g: Gen, entities: PhpEntity[]): { files: Record<string, string>; byTable: Map<string, string> } {
    const files: Record<string, string> = {};
    const byTable = new Map<string, string>();
    const withTables = entities.filter((_, i) => i < 75);
    withTables.forEach((e, i) => {
        const idx = entities.indexOf(e) % 3;
        const parent = idx > 0 ? entities[entities.indexOf(e) - idx] : undefined;
        const cols = [`            $table->id();`];
        if (parent) {
            cols.push(
                i % 5 === 0
                    ? `            $table->unsignedBigInteger('${snake(parent.cls)}_id');`
                    : `            $table->foreignId('${snake(parent.cls)}_id')->constrained('${parent.table}')${i % 3 === 0 ? '->cascadeOnDelete()' : i % 3 === 1 ? '->nullOnDelete()' : ''};`,
            );
        }
        cols.push(`            $table->string('name');`, `            $table->string('status')->default('new');`);
        if (i % 2 === 0) cols.push(`            $table->decimal('amount', 12, 2)->nullable();`);
        if (i % 4 === 1) cols.push(`            $table->unsignedBigInteger('external_ref');`);
        // A key named like another table's id, with no constraint and no relation: an implied key.
        if (i % 7 === 0) cols.push(`            $table->unsignedBigInteger('customer_id')->nullable();`);
        if (i % 6 === 2) cols.push(`            $table->index('status');`);
        cols.push(`            $table->timestamps();`);
        const stamp = `2025_${String(1 + Math.floor(i / 28)).padStart(2, '0')}_${String(1 + (i % 28)).padStart(2, '0')}_${String(100000 + i).slice(1)}`;
        byTable.set(e.table, `database/migrations/${stamp}_create_${e.table}_table.php`);
        files[`database/migrations/${stamp}_create_${e.table}_table.php`] =
            `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n` +
            (e.connection ? `    protected $connection = '${e.connection}';\n\n` : '') +
            `    public function up(): void\n    {\n        Schema::create('${e.table}', function (Blueprint $table) {\n${cols.join('\n')}\n        });\n    }\n\n    public function down(): void\n    {\n        Schema::dropIfExists('${e.table}');\n    }\n};\n`;
        if (idx === 2) {
            const a = entities[entities.indexOf(e) - 1] as PhpEntity;
            const pivot = `${snake(a.cls)}_${snake(e.cls)}`;
            files[`database/migrations/${stamp}_900_create_${pivot}_table.php`] =
                `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n` +
                (e.connection ? `    protected $connection = '${e.connection}';\n\n` : '') +
                `    public function up(): void\n    {\n        Schema::create('${pivot}', function (Blueprint $table) {\n` +
                `            $table->foreignId('${snake(a.cls)}_id')->constrained('${a.table}')->cascadeOnDelete();\n` +
                `            $table->foreignId('${snake(e.cls)}_id')->constrained('${e.table}')->cascadeOnDelete();\n` +
                `            $table->primary(['${snake(a.cls)}_id', '${snake(e.cls)}_id']);\n        });\n    }\n};\n`;
        }
    });
    files['database/migrations/2025_12_01_000001_create_notes_table.php'] =
        `<?php\n\nuse Illuminate\\Database\\Migrations\\Migration;\nuse Illuminate\\Database\\Schema\\Blueprint;\nuse Illuminate\\Support\\Facades\\Schema;\n\nreturn new class extends Migration\n{\n` +
        `    public function up(): void\n    {\n        Schema::create('notes', function (Blueprint $table) {\n            $table->id();\n            $table->morphs('notable');\n            $table->text('body');\n            $table->timestamps();\n        });\n    }\n};\n`;
    files['app/Models/Note.php'] =
        `<?php\n\nnamespace App\\Models;\n\nuse Illuminate\\Database\\Eloquent\\Model;\n\nclass Note extends Model\n{\n    public function notable()\n    {\n        return $this->morphTo();\n    }\n}\n`;
    // The tenant connection's schema as saved from the live database: one column short, one column extra, one table nobody migrates.
    const tenant = withTables.filter((e) => e.connection === 'tenant');
    files['agents/map/data/snapshot/tenant.sql'] =
        `--\n-- PostgreSQL database dump\n--\n\n` +
        tenant
            .map((e, i) =>
                `CREATE TABLE public.${e.table} (\n    id bigint NOT NULL,\n` +
                (i % 3 === 0 ? '' : `    name character varying(255) NOT NULL,\n`) +
                `    status character varying(255) NOT NULL,\n` +
                (i % 4 === 0 ? `    legacy_code character varying(32),\n` : '') +
                `    created_at timestamp(0) without time zone,\n    updated_at timestamp(0) without time zone\n);\n`,
            )
            .join('\n') +
        `\nCREATE TABLE public.tenant_settings (\n    id bigint NOT NULL,\n    key character varying(255) NOT NULL,\n    value text\n);\n`;
    void g;
    return { files, byTable };
}

// --------------------------------------------------------------- interfaces

const REST_SERVICES = [
    'erp', 'crm', 'tax-engine', 'fraud', 'address', 'shipping-rates', 'carrier', 'pim', 'dam', 'search-index',
    'recommendations', 'translation', 'currency-rates', 'kyc', 'loyalty-hub', 'reviews-hub', 'ads', 'marketplace-feed',
];
const RESOURCES = ['accounts', 'orders', 'items', 'quotes', 'events', 'reports', 'jobs', 'files', 'rules', 'limits'];

function interfaces(g: Gen): { files: Record<string, string>; config: string[]; envNames: string[] } {
    const files: Record<string, string> = {};
    const config: string[] = [];
    const envNames: string[] = [];
    REST_SERVICES.forEach((svc, si) => {
        const key = snake(svc);
        const cls = `${pascal(svc)}Client`;
        const env = key.toUpperCase();
        config.push(`    '${key}' => [\n        'url' => env('${env}_URL'),\n        'key' => env('${env}_KEY'),\n    ],`);
        envNames.push(`${env}_URL`, `${env}_KEY`);
        const ops: Array<{ verb: string; path: string; fn: string }> = [];
        for (let k = 0; k < 8; k++) {
            const res = RESOURCES[(si + k) % RESOURCES.length] as string;
            const verb = ['get', 'post', 'put', 'delete'][k % 4] as string;
            ops.push({ verb, path: k % 2 ? `/${res}/{id}` : `/${res}`, fn: `${verb}${pascal(res)}${k}` });
        }
        const timeout = si % 3 === 0 ? '' : '->timeout(5)';
        files[`app/Integrations/${cls}.php`] =
            `<?php\n\nnamespace App\\Integrations;\n\nuse Illuminate\\Support\\Facades\\Http;\n\nclass ${cls}\n{\n` +
            ops
                .map((o) => {
                    const p = o.path.includes('{id}') ? `'${o.path.replace('/{id}', '/')}' . $id` : `'${o.path}'`;
                    const body = o.verb === 'post' || o.verb === 'put' ? `, ['name' => $name, 'status' => 'new']` : '';
                    return `    public function ${o.fn}(string $id = '', string $name = ''): array\n    {\n        return Http::withToken(config('services.${key}.key'))${timeout}\n            ->${o.verb}(config('services.${key}.url') . ${p}${body})\n            ->json();\n    }\n`;
                })
                .join('\n') +
            `}\n`;
        if (si < 12) {
            // The contract lists all but the last call, and two operations nobody calls.
            const listed = ops.slice(0, 7);
            const paths = new Map<string, string[]>();
            for (const o of listed) paths.set(o.path, [...(paths.get(o.path) ?? []), o.verb]);
            paths.set(`/health`, ['get']);
            paths.set(`/batch`, ['post']);
            files[`contracts/${svc}.openapi.yaml`] =
                `openapi: 3.0.3\ninfo:\n  title: ${pascal(svc)} API\n  version: ${1 + (si % 3)}.0.0\npaths:\n` +
                [...paths.entries()]
                    .map(([p, verbs]) =>
                        `  ${p}:\n` +
                        verbs
                            .map((v) => `    ${v}:\n      operationId: ${v}${pascal(p.replace(/[{}/]/g, '-'))}\n` + (p.includes('{id}') ? `      parameters:\n        - name: id\n          in: path\n          required: true\n          schema:\n            type: string\n` : '') + `      responses:\n        '200':\n          description: ok\n`)
                            .join(''),
                    )
                    .join('');
        }
    });
    for (const [i, svc] of ['warehouse', 'customs', 'bank'].entries()) {
        const ops = ['GetStatus', 'Submit', 'Cancel', 'ListOpen', 'Confirm'].map((o) => `${o}${pascal(svc)}`);
        files[`resources/wsdl/${svc}.wsdl`] =
            `<?xml version="1.0" encoding="UTF-8"?>\n<definitions name="${pascal(svc)}Service" targetNamespace="urn:${svc}" xmlns="http://schemas.xmlsoap.org/wsdl/" xmlns:tns="urn:${svc}" xmlns:soap="http://schemas.xmlsoap.org/wsdl/soap/" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n` +
            ops.map((o) => `  <message name="${o}Request"><part name="Id" type="xsd:string"/></message>\n  <message name="${o}Response"><part name="Result" type="xsd:string"/></message>\n`).join('') +
            `  <portType name="${pascal(svc)}Port">\n` +
            ops.map((o) => `    <operation name="${o}"><input message="tns:${o}Request"/><output message="tns:${o}Response"/></operation>\n`).join('') +
            `  </portType>\n  <binding name="${pascal(svc)}Binding" type="tns:${pascal(svc)}Port"><soap:binding style="rpc" transport="http://schemas.xmlsoap.org/soap/http"/></binding>\n` +
            `  <service name="${pascal(svc)}Service"><port name="${pascal(svc)}Port" binding="tns:${pascal(svc)}Binding"><soap:address location="https://${svc}.example.com/soap"/></port></service>\n</definitions>\n`;
        files[`app/Integrations/${pascal(svc)}Soap.php`] =
            `<?php\n\nnamespace App\\Integrations;\n\nclass ${pascal(svc)}Soap\n{\n    private \\SoapClient $soap;\n\n    public function __construct()\n    {\n        $this->soap = new \\SoapClient(resource_path('wsdl/${svc}.wsdl'));\n    }\n\n` +
            ops.slice(0, 4 - (i % 2)).map((o) => `    public function ${camel(o)}(string $id): object\n    {\n        return $this->soap->${o}(['Id' => $id]);\n    }\n`).join('\n') +
            `}\n`;
    }
    for (const [i, svc] of ['inventory-graph', 'content-graph', 'pricing-graph'].entries()) {
        const env = `${snake(svc).toUpperCase()}_URL`;
        envNames.push(env);
        const fields = ['stock', 'products', 'prices', 'variants', 'locations'].map((f) => `${f}${i}`);
        files[`contracts/${svc}.graphql`] =
            `type Query {\n${fields.map((f) => `  ${f}(id: String!): String`).join('\n')}\n}\n\ntype Mutation {\n  update${i}(id: String!, value: String): String\n  remove${i}(id: String!): String\n}\n`;
        files[`resources/js/graphql/${camel(svc)}.ts`] =
            `import { gql, GraphQLClient } from 'graphql-request';\n\nconst client = new GraphQLClient(process.env.${env} as string);\n\n` +
            fields.slice(0, 4).map((f) => `export const Q_${f.toUpperCase()} = gql\`\n  query ${pascal(f)}($id: String!) {\n    ${f}(id: $id)\n  }\n\`;\n`).join('\n') +
            `\nexport const M_UPDATE = gql\`\n  mutation Update($id: String!) {\n    update${i}(id: $id, value: "x")\n  }\n\`;\n\nexport async function first(id: string): Promise<unknown> {\n    return client.request(Q_${(fields[0] as string).toUpperCase()}, { id });\n}\n`;
    }
    for (const [i, svc] of ['Locator', 'Scheduler', 'Ledger'].entries()) {
        const rpcs = ['Get', 'List', 'Create', 'Update', 'Delete'].map((v) => `${v}${svc}`);
        files[`contracts/proto/${snake(svc)}.proto`] =
            `syntax = "proto3";\n\npackage ${snake(svc)};\n\nservice ${svc}Service {\n${rpcs.map((r) => `  rpc ${r} (${r}Request) returns (${r}Reply);`).join('\n')}\n}\n\n` +
            rpcs.map((r) => `message ${r}Request {\n  string id = 1;\n}\n\nmessage ${r}Reply {\n  string result = 1;\n}\n`).join('\n');
        files[`services/inventory/internal/grpcapi/${snake(svc)}_client.go`] =
            `package grpcapi\n\nimport (\n\t"context"\n\n\tpb "demo/services/inventory/gen/${snake(svc)}"\n\t"google.golang.org/grpc"\n)\n\n` +
            rpcs.slice(0, 3 + (i % 2)).map((r) => `func ${r}(ctx context.Context, conn *grpc.ClientConn, id string) (string, error) {\n\tclient := pb.New${svc}ServiceClient(conn)\n\treply, err := client.${r}(ctx, &pb.${r}Request{Id: id})\n\tif err != nil {\n\t\treturn "", err\n\t}\n\treturn reply.Result, nil\n}\n`).join('\n');
    }
    files['app/Integrations/Vendors.php'] =
        `<?php\n\nnamespace App\\Integrations;\n\nclass Vendors\n{\n    public static function stripe(): object\n    {\n        return new \\Stripe\\StripeClient(config('services.stripe.secret'));\n    }\n\n` +
        `    public static function storage(): object\n    {\n        return new \\Aws\\S3\\S3Client(['region' => 'eu-central-1', 'version' => 'latest']);\n    }\n\n` +
        `    public static function queue(): object\n    {\n        return new \\Aws\\Sqs\\SqsClient(['region' => 'eu-central-1', 'version' => 'latest']);\n    }\n\n` +
        `    public static function sms(): object\n    {\n        return new \\Twilio\\Rest\\Client(config('services.twilio.sid'), config('services.twilio.token'));\n    }\n\n` +
        `    public static function mail(): object\n    {\n        return new \\SendGrid(config('services.sendgrid.key'));\n    }\n\n` +
        `    public static function ai(): object\n    {\n        return \\OpenAI::client(config('services.openai.key'));\n    }\n}\n`;
    files['resources/js/vendors/slack.ts'] = `import { WebClient } from '@slack/web-api';\n\nexport const slack = new WebClient(process.env.SLACK_TOKEN);\n`;
    files['resources/js/vendors/ai.ts'] = `import Anthropic from '@anthropic-ai/sdk';\n\nexport const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_KEY });\n`;
    for (const s of ['stripe', 'twilio', 'sendgrid', 'openai']) config.push(`    '${s}' => [\n        'key' => env('${s.toUpperCase()}_KEY'),\n        'secret' => env('${s.toUpperCase()}_SECRET'),\n    ],`);
    envNames.push('SLACK_TOKEN', 'ANTHROPIC_KEY');
    void g;
    return { files, config, envNames };
}

// ----------------------------------------------------------------- frontend

function frontend(g: Gen): void {
    TS_FEATURES.forEach((f, fi) => {
        const own = g.owner(fi + 3);
        const dir = `resources/js/features/${f}`;
        const files: Record<string, string> = {};
        const modSlug = snake(DOMAINS[fi % DOMAINS.length] as string).replace(/_/g, '-');
        const ent = snake(ENTITIES[fi % ENTITIES.length] as string);
        files[`${dir}/api.ts`] =
            `export interface Row {\n    id: number;\n    name: string;\n}\n\nexport async function load(id: number): Promise<Row> {\n    const res = await fetch(\`/api/${modSlug}/${ent}s/\${id}\`);\n    return (await res.json()) as Row;\n}\n\n` +
            `export async function sync(id: number): Promise<void> {\n    await fetch(\`/api/${modSlug}/${ent}s/\${id}/sync\`, { method: 'POST' });\n}\n`;
        files[`${dir}/store.ts`] =
            `import { load, type Row } from './api';\n\nconst cache = new Map<number, Row>();\n\nexport async function get(id: number): Promise<Row> {\n    const hit = cache.get(id);\n    if (hit) return hit;\n    const row = await load(id);\n    cache.set(id, row);\n    return row;\n}\n\nexport function clear(): void {\n    cache.clear();\n}\n`;
        files[`${dir}/format.ts`] = `import type { Row } from './api';\n\nexport function title(r: Row): string {\n    return \`#\${r.id} \${r.name}\`;\n}\n\nexport function short(r: Row): string {\n    return r.name.slice(0, 12);\n}\n`;
        for (let v = 0; v < 8; v++) {
            const peer = v === 0 ? './store' : `./view${v - 1}`;
            files[`${dir}/view${v}.ts`] =
                `import { get } from './store';\nimport { title } from './format';\n` +
                (v > 0 ? `import { render${v - 1} } from '${peer}';\n` : '') +
                `\nexport async function render${v}(id: number): Promise<string> {\n    const row = await get(id);\n    return ${v > 0 ? `render${v - 1}(id).then((s) => s + title(row))` : 'title(row)'};\n}\n`;
        }
        files[`${dir}/index.ts`] = `export { render7 as render } from './view7';\nexport { clear } from './store';\n`;
        files[`${dir}/view7.test.ts`] = `import { render7 } from './view7';\n\nexport async function smoke(): Promise<boolean> {\n    return (await render7(1)).length > 0;\n}\n`;
        files[`${dir}/store.test.ts`] = `import { clear, get } from './store';\n\nexport async function cached(): Promise<boolean> {\n    clear();\n    return (await get(1)).id === 1;\n}\n`;
        if (fi % 5 === 0) files[`${dir}/legacy-widget.ts`] = `export function legacyWidget(): string {\n    return 'unused';\n}\n`;
        if (fi > 0 && fi % 3 === 0) {
            const prev = TS_FEATURES[fi - 1] as string;
            files[`${dir}/shared.ts`] = `import { render } from '../${prev}';\n\nexport async function also(id: number): Promise<string> {\n    return render(id);\n}\n`;
        }
        g.commit(own.primary, `feat(frontend): ${f}`, files);
    });
    const app = TS_FEATURES.map((f, i) => `import { render as r${i} } from './features/${f}';`).join('\n');
    g.commit(LOAD_AUTHORS[2] as DemoAuthor, 'feat(frontend): the application shell', {
        'resources/js/app.ts': `${app}\n\nexport const routes = [${TS_FEATURES.map((_, i) => `r${i}`).join(', ')}];\n`,
    });
}

// ------------------------------------------------------------ python & go

function pricingService(g: Gen): void {
    PY_PACKAGES.forEach((p, pi) => {
        const files: Record<string, string> = {};
        const dir = `services/pricing/pricing/${p}`;
        files[`${dir}/__init__.py`] = `from .core import run\n`;
        files[`${dir}/model.py`] = `class ${pascal(p)}Model:\n    def __init__(self, value: float) -> None:\n        self.value = value\n\n    def scaled(self, k: float) -> float:\n        return self.value * k\n`;
        files[`${dir}/rules.py`] = `from .model import ${pascal(p)}Model\n\n\ndef apply(m: ${pascal(p)}Model) -> float:\n    return m.scaled(1.1)\n`;
        files[`${dir}/core.py`] =
            `from .model import ${pascal(p)}Model\nfrom .rules import apply\n` +
            (pi > 0 && pi % 5 === 0 ? `from pricing.${PY_PACKAGES[pi - 1]}.rules import apply as previous\n` : '') +
            `\n\ndef run(value: float) -> float:\n    m = ${pascal(p)}Model(value)\n    return ${pi > 0 && pi % 5 === 0 ? 'previous(m) + ' : ''}apply(m)\n`;
        for (let k = 0; k < 6; k++) files[`${dir}/step_${k}.py`] = `from .core import run\nfrom .rules import apply\n\n\ndef step_${k}(v: float) -> float:\n    return run(v) + ${k}\n`;
        files[`services/pricing/tests/test_${p}.py`] = `from pricing.${p}.core import run\n\n\ndef test_run_is_positive():\n    assert run(1.0) > 0\n`;
        g.commit(g.owner(pi + 5).primary, `feat(pricing): ${p}`, files);
    });
    g.commit(LOAD_AUTHORS[5] as DemoAuthor, 'chore(pricing): project file', {
        'services/pricing/pyproject.toml': `[project]\nname = "pricing"\nversion = "0.4.0"\ndependencies = ["fastapi>=0.110", "boto3>=1.34", "stripe>=8"]\n`,
        'services/pricing/pricing/__init__.py': '',
        'services/pricing/pricing/aws.py': `import boto3\n\nqueue = boto3.client("sqs")\n`,
    });
}

function inventoryService(g: Gen): void {
    GO_PACKAGES.forEach((p, pi) => {
        if (p === 'grpcapi') return;
        const files: Record<string, string> = {};
        const dir = `services/inventory/internal/${p}`;
        const dep = GO_PACKAGES[(pi + 1) % GO_PACKAGES.length] as string;
        const useDep = dep !== 'grpcapi' && pi % 4 !== 3;
        for (let k = 0; k < 5; k++) {
            files[`${dir}/${p}_${k}.go`] =
                `package ${p}\n\n` +
                (useDep && k === 0 ? `import "demo/services/inventory/internal/${dep}"\n\n` : '') +
                `// ${pascal(p)}${k} is step ${k} of ${p}.\nfunc ${pascal(p)}${k}(n int) int {\n` +
                (useDep && k === 0 ? `\treturn ${dep}.${pascal(dep)}1(n) + 1\n` : k > 0 ? `\treturn ${pascal(p)}${k - 1}(n) * 2\n` : `\treturn n\n`) +
                `}\n`;
        }
        files[`${dir}/${p}_test.go`] = `package ${p}\n\nimport "testing"\n\nfunc Test${pascal(p)}(t *testing.T) {\n\tif ${pascal(p)}4(1) < 0 {\n\t\tt.Fatal("negative")\n\t}\n}\n`;
        g.commit(g.owner(pi + 2).primary, `feat(inventory): ${p}`, files);
    });
    g.commit(LOAD_AUTHORS[2] as DemoAuthor, 'chore(inventory): module file', {
        'services/inventory/go.mod': `module demo/services/inventory\n\ngo 1.22\n\nrequire google.golang.org/grpc v1.64.0\n`,
    });
}

// ------------------------------------------------------------------ runtime

const STACKS = ['shop', 'ops', 'data', 'edge'];
const IMAGES = ['nginx:1.27', 'postgres:16.4', 'redis:7.2', 'rabbitmq:3.13', 'node:22', 'php:8.3-fpm', 'python:3.12', 'golang:1.22', 'minio/minio', 'mailhog/mailhog'];

function runtime(g: Gen, envNames: string[]): void {
    const files: Record<string, string> = {};
    STACKS.forEach((stack, si) => {
        const svcs: string[] = [];
        for (let k = 0; k < 8; k++) {
            const name = `${stack}-${['api', 'worker', 'db', 'cache', 'queue', 'proxy', 'search', 'cron'][k]}`;
            const image = IMAGES[(si * 3 + k) % IMAGES.length] as string;
            // Every stack publishes 8080 and 5432 on the host: the collisions the Delivery page's local environment shows.
            const port = k === 0 ? 8080 : k === 2 ? 5432 : 9000 + si * 10 + k;
            const env = envNames.slice((si * 8 + k) % envNames.length, ((si * 8 + k) % envNames.length) + 2);
            svcs.push(
                `  ${name}:\n    image: ${image}\n    ports:\n      - "${port}:${k === 2 ? 5432 : 80}"\n` +
                    (env.length ? `    environment:\n${env.map((e) => `      - ${e}`).join('\n')}\n` : '') +
                    `    networks: [${stack}]\n` +
                    (k > 0 ? `    depends_on:\n      - ${stack}-api\n` : ''),
            );
        }
        files[`deploy/${stack}/compose.yaml`] = `services:\n${svcs.join('')}networks:\n  ${stack}: {}\n`;
    });
    const k8sApps = ['api', 'worker', 'pricing', 'inventory', 'search', 'gateway', 'scheduler', 'mailer', 'reports', 'webhooks'];
    for (const env of ENVS) {
        for (const app of k8sApps) {
            files[`k8s/${env}/${app}.yaml`] =
                `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${app}\n  namespace: ${env}\nspec:\n  replicas: ${env === 'prod' ? 3 : 1}\n  selector:\n    matchLabels:\n      app: ${app}\n  template:\n    metadata:\n      labels:\n        app: ${app}\n    spec:\n      containers:\n        - name: ${app}\n          image: ghcr.io/acme/${app}:1.${k8sApps.indexOf(app)}.0\n          envFrom:\n            - configMapRef:\n                name: ${app}-config\n` +
                `---\napiVersion: v1\nkind: Service\nmetadata:\n  name: ${app}\n  namespace: ${env}\nspec:\n  selector:\n    app: ${app}\n  ports:\n    - port: 80\n      targetPort: 8080\n` +
                (app === 'api' || app === 'gateway' ? `---\napiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: ${app}\n  namespace: ${env}\nspec:\n  rules:\n    - http:\n        paths:\n          - path: /\n            pathType: Prefix\n            backend:\n              service:\n                name: ${app}\n                port:\n                  number: 80\n` : '');
        }
        const res: string[] = [`provider "aws" {\n  region = "eu-central-1"\n}\n`, `module "vpc" {\n  source = "../../modules/vpc"\n  name   = "${env}"\n}\n`];
        for (const app of k8sApps) {
            res.push(
                `resource "aws_ecr_repository" "${app}" {\n  name = "${env}-${app}"\n}\n`,
                `resource "aws_cloudwatch_log_group" "${app}" {\n  name              = "/${env}/${app}"\n  retention_in_days = ${env === 'prod' ? 90 : 14}\n}\n`,
                `resource "aws_iam_role" "${app}" {\n  name = "${env}-${app}"\n  assume_role_policy = "{}"\n}\n`,
            );
        }
        res.push(`resource "aws_db_instance" "main" {\n  identifier = "${env}-main"\n  engine     = "postgres"\n  vpc_security_group_ids = [aws_security_group.db.id]\n}\n`, `resource "aws_security_group" "db" {\n  name   = "${env}-db"\n  vpc_id = module.vpc.id\n}\n`, `resource "aws_s3_bucket" "media" {\n  bucket = "acme-${env}-media"\n}\n`);
        files[`infra/envs/${env}/main.tf`] = res.join('\n');
    }
    files['infra/modules/vpc/main.tf'] = `variable "name" {\n  type = string\n}\n\nresource "aws_vpc" "this" {\n  cidr_block = "10.0.0.0/16"\n  tags = { Name = var.name }\n}\n\noutput "id" {\n  value = aws_vpc.this.id\n}\n`;
    g.commit(LOAD_AUTHORS[2] as DemoAuthor, 'chore(runtime): stacks, Kubernetes and Terraform per environment', files);
}

// ----------------------------------------------------------------- delivery

function delivery(g: Gen): void {
    const files: Record<string, string> = {};
    const apps = ['api', 'worker', 'pricing', 'inventory', 'search', 'gateway', 'scheduler', 'mailer', 'reports', 'webhooks', 'frontend', 'admin', 'docs', 'mobile-api', 'billing', 'ledger', 'exports', 'imports', 'notifications', 'partners'];
    apps.forEach((app, i) => {
        const gated = i % 3 !== 0;
        files[`.github/workflows/${app}.yml`] =
            `name: ${app}\non:\n  push:\n    branches: [main]\n    paths:\n      - '${app === 'pricing' ? 'services/pricing/**' : app === 'inventory' ? 'services/inventory/**' : 'app/**'}'\n  pull_request:\n${i % 4 === 0 ? `  workflow_dispatch:\n` : ''}` +
            `permissions:\n  contents: read\njobs:\n` +
            `  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run lint\n` +
            `  test:\n    needs: lint\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n` +
            `  build:\n    needs: test\n    runs-on: ubuntu-latest\n    steps:\n      - uses: docker/build-push-action@v6\n        with:\n          push: true\n          tags: ghcr.io/acme/${app}:\${{ github.sha }}\n` +
            `  deploy-staging:\n    needs: build\n    runs-on: ubuntu-latest\n    environment: staging\n    steps:\n      - run: kubectl -n staging set image deployment/${app} ${app}=ghcr.io/acme/${app}:\${{ github.sha }}\n` +
            `  deploy-production:\n    needs: ${gated ? 'deploy-staging' : 'build'}\n    runs-on: ubuntu-latest\n${i % 5 === 0 ? `    if: github.ref == 'refs/heads/main'\n` : ''}    environment:\n      name: production\n      url: https://${app}.acme.example\n    steps:\n      - run: kubectl -n prod set image deployment/${app} ${app}=ghcr.io/acme/${app}:\${{ github.sha }}\n`;
    });
    g.commit(LOAD_AUTHORS[2] as DemoAuthor, 'ci: one pipeline per deployable', files);
    const gitlab: string[] = [];
    for (const app of apps.slice(0, 10)) {
        gitlab.push(
            `\n${app}-test:\n  stage: test\n  script:\n    - npm test -- ${app}\n`,
            `\n${app}-image:\n  stage: build\n  needs: [${app}-test]\n  script:\n    - docker build -t $CI_REGISTRY_IMAGE/${app}:$CI_COMMIT_SHA .\n`,
            `\n${app}-deploy:\n  stage: deploy\n  needs: [${app}-image]\n  environment:\n    name: staging\n  script:\n    - kubectl -n staging rollout restart deployment/${app}\n`,
        );
    }
    g.commit(LOAD_AUTHORS[6] as DemoAuthor, 'ci: GitLab jobs per deployable', {}, [{ file: '.gitlab-ci.yml', edit: (t) => t + gitlab.join('') }]);
}

// ---------------------------------------------------------------- decisions

function decisions(g: Gen): void {
    const files: Record<string, string> = {};
    for (let n = 4; n <= 32; n++) {
        const mod = DOMAINS[(n * 7) % DOMAINS.length] as string;
        // Every third record is replaced by the next one: chains of supersession.
        const superseded = n % 3 === 1 && n < 32;
        const supersedes = n % 3 === 2 ? `ADR-${String(n - 1).padStart(3, '0')}` : '—';
        files[`docs/decisions/ADR-${String(n).padStart(3, '0')}-${snake(mod).replace(/_/g, '-')}-boundary.md`] =
            `---\nadr: ${n}\nstatus: ${superseded ? 'superseded' : 'accepted'}\ndate: 2025-${String(1 + (n % 12)).padStart(2, '0')}-${String(1 + (n % 27)).padStart(2, '0')}\nsupersedes: ${supersedes}\nsuperseded_by: ${superseded ? `ADR-${String(n + 1).padStart(3, '0')}` : '—'}\n---\n\n` +
            `# ADR-${String(n).padStart(3, '0')} — The ${mod} module owns its data\n\n` +
            `\`app/Modules/${mod}/Services/${mod.replace(/s$/, '')}${ENTITIES[(DOMAINS.indexOf(mod) * 1) % ENTITIES.length]}Service.php\` is the only writer of the module's tables;\n` +
            `other modules call it, never the models directly.\n`;
    }
    g.commit(LOAD_AUTHORS[0] as DemoAuthor, 'docs(decisions): module boundaries', files);
}

// ------------------------------------------------------------------- churn

function churn(g: Gen, services: string[]): void {
    const monolithFile = 'app/Modules/Billing/Services/LegacyBillingRun.php';
    g.commit(LOAD_AUTHORS[1] as DemoAuthor, 'feat(billing): the nightly billing run', { [monolithFile]: monolith() });
    for (let c = 0; c < 90; c++) {
        const author = g.author();
        const edits: LoadCommit['edits'] = [];
        if (c % 3 === 0) edits.push({ file: monolithFile, edit: (t) => beforeLastBrace(t, `\n    public static function patch${c}(array $ctx): array\n    {\n        return $ctx + ['patch' => ${c}];\n    }\n`) });
        const svc = services[(c * 7) % services.length] as string;
        const mod = svc.split('\\')[2] as string;
        const cls = svc.split('\\').pop() as string;
        const file = `app/Modules/${mod}/Services/${cls}.php`;
        edits.push({ file, edit: (t) => beforeLastBrace(t, `\n    public static function rev${c}(): int\n    {\n        return ${c};\n    }\n`) });
        // A service and its test change together: the co-change pairs History reads.
        edits.push({ file: `tests/Unit/${mod}/${cls}Test.php`, edit: (t) => beforeLastBrace(t, `\n    public function test_rev_${c}(): void\n    {\n        $this->assertSame(${c}, ${cls}::rev${c}());\n    }\n`) });
        if (c % 4 === 1) {
            const f = TS_FEATURES[c % TS_FEATURES.length] as string;
            edits.push({ file: `resources/js/features/${f}/store.ts`, edit: (t) => `${t}\nexport const rev${c} = ${c};\n` }, { file: `resources/js/features/${f}/api.ts`, edit: (t) => `${t}\nexport const apiRev${c} = ${c};\n` });
        }
        g.commit(author, c % 3 === 0 ? `fix(billing): run step ${c}` : `refactor(${snake(mod)}): ${cls} revision ${c}`, {}, edits);
    }
}

// -------------------------------------------------------------- the whole

export function generateDemoLoad(seed = 20261026): DemoLoad {
    const g = new Gen(seed);
    const php = phpModules(g);
    const data = migrations(g, php.entities);
    g.commit(LOAD_AUTHORS[3] as DemoAuthor, 'feat(data): migrations for the module tables', data.files);
    const ifs = interfaces(g);
    g.commit(LOAD_AUTHORS[4] as DemoAuthor, 'feat(integrations): partner clients and their contracts', ifs.files, [
        { file: 'config/services.php', edit: (t) => t.replace(/\n\];\s*$/, `\n${ifs.config.join('\n\n')}\n\n];\n`) },
        { file: '.env.example', edit: (t) => `${t}${ifs.envNames.map((e) => `${e}=`).join('\n')}\n` },
        { file: 'routes/api.php', edit: (t) => `${t}\n${php.routes.join('\n')}\n` },
        {
            file: 'composer.json',
            edit: (t) => t.replace('"guzzlehttp/guzzle": "^7.8"', '"guzzlehttp/guzzle": "^7.8",\n        "stripe/stripe-php": "^15.0",\n        "aws/aws-sdk-php": "^3.300",\n        "twilio/sdk": "^8.0",\n        "sendgrid/sendgrid": "^8.1",\n        "openai-php/client": "^0.10"'),
        },
        {
            file: 'package.json',
            edit: (t) => t.replace('"devDependencies"', '"dependencies": { "graphql-request": "^7.0.0", "@slack/web-api": "^7.0.0", "@anthropic-ai/sdk": "^0.30.0" },\n    "devDependencies"'),
        },
    ]);
    frontend(g);
    pricingService(g);
    inventoryService(g);
    runtime(g, ifs.envNames);
    delivery(g);
    decisions(g);
    churn(g, php.services);
    const working: DemoLoad['working'] = [];
    for (let i = 0; i < 6; i++) {
        const svc = php.services[i * 9] as string;
        const file = `app/Modules/${svc.split('\\')[2]}/Services/${svc.split('\\').pop()}.php`;
        working.push({ file, edit: (t) => beforeLastBrace(t, `\n    public static function preview(int $id): array\n    {\n        return self::handle($id);\n    }\n`) });
    }
    for (const e of php.entities.slice(0, 75).filter((_, i) => i % 25 === 3)) {
        const file = data.byTable.get(e.table);
        if (file) working.push({ file, edit: (t) => t.replace(`            $table->timestamps();`, `            $table->string('channel')->nullable();\n            $table->timestamps();`) });
    }
    working.push(
        { file: 'app/Integrations/ErpClient.php', edit: (t) => beforeLastBrace(t, `\n    public function getLedger(string $id = ''): array\n    {\n        return Http::withToken(config('services.erp.key'))\n            ->get(config('services.erp.url') . '/ledger/' . $id)\n            ->json();\n    }\n`) },
        { file: 'app/Integrations/CrmClient.php', edit: (t) => beforeLastBrace(t, `\n    public function getSegments(): array\n    {\n        return Http::get(config('services.crm.url') . '/segments')->json();\n    }\n`) },
        { file: '.github/workflows/api.yml', edit: (t) => t.replace('      - run: npm test\n', '      - run: npm test\n      - run: npm run test:contract\n') },
        { file: '.github/workflows/pricing.yml', edit: (t) => t.replace('environment: staging', 'environment: staging-eu') },
        { file: 'deploy/shop/compose.yaml', edit: (t) => t.replace('"9003:80"', '"9004:80"') },
        { file: 'infra/envs/prod/main.tf', edit: (t) => `${t}\nresource "aws_sqs_queue" "billing" {\n  name = "prod-billing"\n}\n` },
        { file: 'resources/js/features/cart/store.ts', edit: (t) => `${t}\nexport const pending = true;\n` },
        { file: 'resources/js/features/checkout/api.ts', edit: (t) => `${t}\nexport const version = 2;\n` },
        { file: 'services/pricing/pricing/quotes/core.py', edit: (t) => `${t}\n\ndef preview(value: float) -> float:\n    return run(value)\n` },
    );
    return { commits: g.commits, working };
}

/**
 * Small projects beside the shop for the hub: npm packages that depend on one
 * another, Express services whose routes the others call, and Compose files
 * that publish the same host ports.
 */
export function generateHubProjects(seed = 20261026): HubLoadProject[] {
    const r = rng(seed + 1);
    const names = ['core-lib', 'auth-service', 'orders-service', 'catalog-service', 'notify-service', 'admin-ui', 'gateway', 'reports-service'];
    return names.map((name, i) => {
        const deps: Record<string, string> = {};
        if (name !== 'core-lib') deps['@demo/core-lib'] = '^1.0.0';
        if (i > 2) deps[`@demo/${names[i - 1]}`] = '^1.0.0';
        const target = names[(i + 1) % names.length] as string;
        const files: Record<string, string> = {
            'package.json': `${JSON.stringify({ name: `@demo/${name}`, version: '1.0.0', dependencies: { express: '^4.19.0', ...deps } }, null, 4)}\n`,
            'src/app.ts':
                `import express from 'express';\nimport { list, show } from './handlers';\n\nconst app = express();\n\napp.get('/${name}/items', list);\napp.get('/${name}/items/:id', show);\n\nexport default app;\n`,
            'src/handlers.ts': `export function list(): string[] {\n    return [];\n}\n\nexport function show(): string {\n    return '${name}';\n}\n`,
            'src/client.ts':
                `export async function fromNext(id: string): Promise<unknown> {\n    const res = await fetch(\`\${process.env.${snake(target).toUpperCase()}_URL}/${target}/items/\${id}\`, { signal: AbortSignal.timeout(3000) });\n    return res.json();\n}\n`,
            // A few collisions, not a clique: some projects share an app port, every third runs its own Postgres on 5432.
            'docker-compose.yml':
                `services:\n  ${name}:\n    image: ${['node:22', 'node:20', 'oven/bun:1'][i % 3]}\n    ports:\n      - "${8080 + i + (r() < 0.3 ? -1 : 0)}:3000"\n` +
                (i % 3 === 0 ? `  db:\n    image: postgres:16\n    ports:\n      - "5432:5432"\n` : ''),
        };
        return { name, files };
    });
}
