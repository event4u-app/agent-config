/**
 * The shipped set of the npm package, modelled from package.json `files`.
 *
 * npm honours `!`-negated entries, so this does too: an excluded path is not
 * shipped even when an included directory contains it. A pattern supports `*`
 * (within one path segment) and `**` (across segments); an entry ending in `/`
 * is a directory prefix.
 */

/** @param {string} pattern */
function toRegExp(pattern) {
    const body = pattern
        .replace(/[.+^${}()|[\]\\]/g, '\\$&')
        .replace(/\*\*/g, '\u0000')
        .replace(/\*/g, '[^/]*')
        .replace(/\u0000/g, '.*');
    return new RegExp(`^${body}${pattern.endsWith('/') ? '' : '$'}`);
}

/**
 * @param {readonly string[]} files the package.json `files` array
 * @returns {{ isShipped: (posixPath: string) => boolean, prefixes: string[] }}
 */
export function shippedSet(files) {
    const included = files.filter((f) => !f.startsWith('!'));
    const excluded = files.filter((f) => f.startsWith('!')).map((f) => toRegExp(f.slice(1)));
    const prefixes = included.filter((f) => f.endsWith('/')).map((f) => f.replace(/\/+$/, '') + '/');
    const exact = included.filter((f) => !f.endsWith('/') && !f.includes('*'));
    const globs = included.filter((f) => !f.endsWith('/') && f.includes('*')).map(toRegExp);
    return {
        prefixes,
        isShipped(posixPath) {
            if (excluded.some((re) => re.test(posixPath))) return false;
            return exact.includes(posixPath) || globs.some((re) => re.test(posixPath)) || prefixes.some((p) => posixPath.startsWith(p));
        },
    };
}
