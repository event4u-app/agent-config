/**
 * Carrier-rung classifier — road-to-a-noted-that-is-a-write 2.3.
 *
 * A convention the user states can be carried three ways, strongest first:
 *
 *   - `config` — a formatter or editor setting enforces it without anyone
 *                reading it (indentation, quotes, line length, line endings);
 *   - `check`  — a linter, test or hook can fail on it (no `console.log`, no
 *                default exports, a numeric size limit, a commit-message shape);
 *   - `prose`  — only an instruction file can carry it.
 *
 * The classifier only classifies; it writes nothing. Its error budget is
 * one-sided: a convention put on too STRONG a rung becomes a config change or a
 * check nobody asked for, while one put too low merely stays prose. So every
 * rule demands a concrete marker, a hedge ("prefer", "möglichst") drops the
 * sentence to prose, and anything unclassifiable is prose.
 */
export type ConventionRung = 'config' | 'check' | 'prose';

// Softened conventions are judgement calls, not settings.
const HEDGE_RE =
    /\b(prefer|preferably|try to|ideally|usually|generally|where possible|if possible|when possible|möglichst|bevorzugt|wenn möglich|nach möglichkeit|eher|meistens|in der regel|sollte(n)? man)\b/i;

// Settings a formatter or `.editorconfig` expresses directly.
const CONFIG_RES: readonly RegExp[] = [
    /\b(tabs?|spaces|leerzeichen)\b[^.!?]{0,40}\b(statt|instead of|not|nicht|for|für|zum)\b[^.!?]{0,20}\b(tabs?|spaces|leerzeichen|indent\w*|einrück\w*)\b/i,
    /\b(indent\w*|einrück\w*)\b[^.!?]{0,30}\b(\d+|two|four|zwei|vier)\b[^.!?]{0,10}\b(spaces|leerzeichen)\b/i,
    /\b(indent\w*|einrück\w*)\b[^.!?]{0,20}\b(with|mit)\b[^.!?]{0,10}\btabs?\b/i,
    /\b(use|nutze|verwende|benutze|always|immer)\b[^.!?]{0,15}\btabs\b/i,
    /\b(single|double|einfache|doppelte)\s+(quotes|anführungszeichen)\b/i,
    /\b(line length|zeilenlänge|max(imum)? line|lines? (longer|shorter) than|zeilen (länger|kürzer) als)\b[^.!?]{0,30}\b\d+\b/i,
    /\b\d+\s*(characters|chars|zeichen)\b[^.!?]{0,20}\b(per line|pro zeile|line length|zeilenlänge)\b/i,
    /\b(trailing commas?|nachgestellte kommas?)\b/i,
    /\b(semicolons?|semikolons?)\b/i,
    /\b(final newline|newline at (the )?end of (the )?file|leerzeile am dateiende|zeilenumbruch am dateiende)\b/i,
    /\b(lf|crlf|line endings|zeilenenden)\b/i,
    /\b(trailing whitespace|leerzeichen am zeilenende)\b/i,
    /\b(utf-?8)\b[^.!?]{0,20}\b(encoding|charset|kodierung)\b|\b(encoding|charset|kodierung)\b[^.!?]{0,20}\butf-?8\b/i,
];

// Rules a linter, a test or a hook can fail on — each names a concrete thing.
const CHECK_RES: readonly RegExp[] = [
    /\b(no|never|kein\w*|nie|niemals|verbiete\w*|forbid\w*|ban)\b[^.!?]{0,30}\b(console\.log|var_dump|dd\(|print\(|debugger|any\b|default exports?|eval|emojis?|todo|fixme|wildcard imports?|relative imports?|magic numbers?)/i,
    /\b(console\.log|var_dump|debugger|default exports?|emojis?)\b[^.!?]{0,30}\b(verboten|not allowed|forbidden|banned|raus|entfernen)\b/i,
    /\b(functions?|methods?|files?|funktionen|methoden|dateien|classes|klassen)\b[^.!?]{0,40}\b(at most|max(imum)?|höchstens|nicht (länger|mehr) als|no (longer|more) than|under|unter)\b[^.!?]{0,10}\b\d+\b[^.!?]{0,10}\b(lines|zeilen|parameters|parameter|arguments?|argumente)\b/i,
    /\b(conventional commits?|commit messages?|commit-messages?|commitnachrichten)\b[^.!?]{0,40}\b(format|prefix|präfix|feat|fix|chore|conventional|scope|imperative?|imperativ)\b/i,
    /\b(imports?)\b[^.!?]{0,20}\b(sorted|alphabetical|sortiert|alphabetisch|ordered|geordnet)\b/i,
    /\b(camelcase|snake_case|pascalcase|kebab-case)\b/i,
    /\bdeclare\s*\(\s*strict_types\s*=\s*1\s*\)|\bstrict(e)? typ(es|en|isierung)\b/i,
    /\b(every|each|jede[rs]?)\b[^.!?]{0,30}\b(test|tests)\b[^.!?]{0,20}\b(must|muss|needs?|braucht)\b/i,
];

/** Classify one convention sentence. Unclassifiable is prose. */
export function conventionRung(sentence: string): ConventionRung {
    const s = sentence.trim();
    if (s === '' || HEDGE_RE.test(s)) return 'prose';
    if (CONFIG_RES.some((re) => re.test(s))) return 'config';
    if (CHECK_RES.some((re) => re.test(s))) return 'check';
    return 'prose';
}
