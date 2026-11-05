/**
 * Class 3 (model → table) derived from the code, per registration § Check v2 item 4:
 * the model's `$table`, else Laravel's convention, and every migration that creates,
 * alters, renames or drops that table. A migration that only writes rows is not one.
 */

const escape = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Laravel's plural of the last word, for the regular and the -is/-y/-sibilant shapes. */
function plural(word: string): string {
    if (/is$/.test(word)) return word.replace(/is$/, 'es');
    if (/[^aeiou]y$/.test(word)) return word.replace(/y$/, 'ies');
    if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
    return `${word}s`;
}

export function tableOfModel(source: string, className: string): string {
    const explicit = source.match(/protected\s+\$table\s*=\s*['"]([^'"]+)['"]/);
    if (explicit?.[1]) return explicit[1];
    const words = className.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().split('_');
    words.push(plural(words.pop() as string));
    return words.join('_');
}

export function migrationTouchesTable(source: string, table: string): boolean {
    const t = escape(table);
    const q = `['"]${t}['"]`;
    const schema = new RegExp(`Schema::(?:create|table|drop|dropIfExists)\\(\\s*${q}|Schema::rename\\(\\s*['"][^'"]+['"]\\s*,\\s*${q}|Schema::rename\\(\\s*${q}`);
    const raw = new RegExp(`\\b(?:ALTER|CREATE|DROP)\\s+TABLE\\s+(?:IF\\s+(?:NOT\\s+)?EXISTS\\s+)?[\`"]?${t}[\`"]?(?![\\w])`, 'i');
    return schema.test(source) || raw.test(source);
}

const isVendor = (p: string): boolean => /(^|\/)(vendor|node_modules)\//.test(p);

/**
 * The derived answer, or null when the model class has no unique declaration — the
 * item then stays with the 2-of-3 check.
 */
export function deriveModelTable(className: string, tracked: string[], read: (path: string) => string): { table: string; files: string[] } | null {
    const decl = new RegExp(`\\bclass\\s+${escape(className)}\\b`);
    const models = tracked.filter((p) => p.endsWith('.php') && !isVendor(p) && !/\/migrations\//i.test(p) && decl.test(read(p)));
    if (models.length !== 1) return null;
    const model = models[0] as string;
    const table = tableOfModel(read(model), className);
    const migrations = tracked.filter((p) => p.endsWith('.php') && !isVendor(p) && /\/migrations\//i.test(p) && migrationTouchesTable(read(p), table));
    return { table, files: [model, ...migrations.sort()] };
}
