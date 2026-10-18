/**
 * What lies between a project's `agent_config_version` pin and the latest
 * release, read from the latest release's impact map. It proposes; moving the
 * pin stays a team decision taken with `agent-config update`.
 *
 * Pure: the caller reads the pin and fetches the map. The map is registry input
 * and untrusted, so an entry that does not parse is reported, never trusted.
 */
import { CONSUMER_IMPACT_VALUES } from './consumer_impact';
import { compare_versions, parse_version } from './version_order';

/** `impactMap` is `undefined` when it could not be fetched and `null` when the release carries none. */
export function pin_advice_lines(pin: string, latest: string, impactMap: unknown, label: 'latest' | 'target' = 'latest'): string[] {
    if (compare_versions(latest, pin) !== 1) return [];
    const head = `Pinned at ${pin}; ${label} is ${latest}.`;
    const tail = 'Moving the pin is a team decision: `agent-config update` rewrites it, this check never does.';
    if (impactMap === undefined) {
        return [head, `  The releases in between cannot be read: the impact map of ${latest} could not be fetched.`, tail];
    }
    if (impactMap === null || typeof impactMap !== 'object' || Array.isArray(impactMap)) {
        return [head, `  The releases in between cannot be read: ${latest} carries no impact map.`, tail];
    }
    const rows: Array<[string, string]> = [];
    for (const [version, entry] of Object.entries(impactMap as Record<string, unknown>)) {
        if (parse_version(version) === null) return [head, `  The impact map is not trustworthy: key '${version}' is not a version.`, tail];
        if (compare_versions(version, pin) !== 1 || compare_versions(version, latest) === 1) continue;
        const impact = (entry as Record<string, unknown> | null)?.['impact'];
        if (!(CONSUMER_IMPACT_VALUES as readonly unknown[]).includes(impact)) {
            return [head, `  The impact map is not trustworthy: ${version} has impact '${String(impact)}'.`, tail];
        }
        const security = (entry as Record<string, unknown>)['security'] === true ? ', security fix' : '';
        rows.push([version, `${String(impact)}${security}`]);
    }
    rows.sort((a, b) => compare_versions(a[0], b[0]) ?? 0);
    const body = rows.length === 0
        ? ['  No release in between records a consumer impact.']
        : rows.map(([v, what]) => `  ${v}  ${what}`);
    const keys = Object.keys(impactMap as Record<string, unknown>).sort((a, b) => compare_versions(a, b) ?? 0);
    const first = keys[0];
    const uncovered = first === undefined
        ? ['  The impact map is empty; the releases in between are not described.']
        : compare_versions(pin, first) === -1
            ? [`  The impact map's first entry is ${first}; releases between ${pin} and it may predate the map.`]
            : [];
    return [head, ...body, ...uncovered, tail];
}
