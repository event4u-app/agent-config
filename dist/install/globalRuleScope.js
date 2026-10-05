/**
 * The rule scope governing a GLOBAL deploy.
 *
 * Moved out of `src/scripts/install.ts` by
 * `road-to-an-installed-layer-that-is-thinned` step 1.1, which adds the thinning
 * call to the same deploy loop. `check_source_size_budget` is a one-way ratchet
 * with no per-change headroom, and this repository's stated convention is that
 * the total falls through EXTRACTION and never rises through a baseline edit —
 * the same reason `claudeRuleRewrite` holds the claude-code post-copy reporting
 * rather than the installer. This function is the nearest self-contained block
 * to the change: it is the predicate the deploy loop resolves once per run, it
 * reaches nothing else in the installer, and its four environment touches are
 * already parameters in all but name.
 *
 * BEHAVIOUR IS UNCHANGED, DELIBERATELY. The body is the installer's, verbatim
 * apart from the four injected seams below; `install.ts` keeps a wrapper of the
 * same name and signature, so its re-export and every caller and test see what
 * they saw before. A behaviour change smuggled into an extraction is the one
 * thing that would make the line saving not worth having.
 *
 * The seams are injected rather than imported because each one is an
 * install-time decision the installer owns: where the global settings doc lives,
 * how this build reads and parses YAML, what the packaged template says, and
 * where a warning goes.
 */
import { LEGACY_ALL, ruleScopeFromSettings } from './rule_scope.js';
function isPlainObject(v) {
    return typeof v === 'object' && v !== null && !Array.isArray(v);
}
/**
 * Resolve the rule scope governing THIS global deploy — the same way the wizard
 * does (`src/server/routes/install.ts::_resolveRuleScope`), so the two global
 * paths cannot ship different rule sets for the same settings.
 *
 * Settings resolution mirrors `_resolve_scoped_projection` above: an existing
 * global settings doc is authoritative, and only a genuinely fresh machine falls
 * through to the packaged template. Any read or parse failure resolves to
 * `LEGACY_ALL` — over-shipping is the safe direction, and the compat exclusion
 * (`source-of-truth.md`) still applies even then.
 */
export function resolveGlobalRuleScope(inputs) {
    const { packageRoot, warn } = inputs;
    const settings_path = inputs.settingsPath;
    // No global settings artefact at all — a genuinely fresh machine. Fall
    // through to the packaged template silently: there is no user decision to
    // contradict, and this is the documented upgrade-compat path.
    if (settings_path === null) {
        try {
            return ruleScopeFromSettings(inputs.loadDefaults(), packageRoot);
        }
        catch {
            return LEGACY_ALL;
        }
    }
    // A doc EXISTS, so the user has expressed a configuration. Failing to read
    // it is not the same as not having one: falling back to legacy-all here
    // ships the maintainer-only rules the user may have deliberately scoped out,
    // and `_load_yaml_doc` would report that as an indistinguishable `{}`. So
    // parse it explicitly and be LOUD when it does not parse — over-shipping
    // stays the safe direction, but it must not be a silent one.
    let text;
    try {
        text = inputs.readText(settings_path);
    }
    catch (e) {
        warn(`could not read ${settings_path} (${String(e)}) — rule scoping falls back ` +
            'to legacy-all, so ALL rules including maintainer-only ones will be ' +
            'installed. Fix the file to restore scoping.');
        return LEGACY_ALL;
    }
    const parsed = inputs.parseYaml(text);
    if (!isPlainObject(parsed)) {
        warn(`${settings_path} is not a YAML mapping — rule scoping falls back to ` +
            'legacy-all, so ALL rules including maintainer-only ones will be ' +
            'installed. Fix the file to restore scoping.');
        return LEGACY_ALL;
    }
    try {
        return ruleScopeFromSettings(parsed, packageRoot);
    }
    catch (e) {
        warn(`could not derive rule scope from ${settings_path} (${String(e)}) — ` +
            'falling back to legacy-all; ALL rules will be installed.');
        return LEGACY_ALL;
    }
}
//# sourceMappingURL=globalRuleScope.js.map