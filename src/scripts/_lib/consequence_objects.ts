/**
 * consequence_objects — the consequence vocabulary's prose half.
 *
 * Two things live here: the phrase rows that recognise a consequence
 * authorization, and the extraction of the OBJECT such an authorization names.
 * An authorization for one table, one environment or one recipient class is not
 * an authorization for another, and until this existed the ledger could express
 * the difference for nothing but pull-request numbers.
 *
 * IT IS RECOGNITION AND EXTRACTION, NOT MATCHING. Nothing here decides
 * anything; the one consumer that acts on the vocabulary is `conformance_scan`,
 * which counts after the fact. Making the object a matching condition is the
 * ledger item ADR-254 left to the owner.
 *
 * It sits beside `git_authorization_hook` rather than inside it because that
 * file is against the per-file source-size budget, which charges every line
 * above 1500. The split is along a real seam: the hook owns the machinery —
 * sentence bounds, negation, fenced-paste handling — and this module owns the
 * consequence vocabulary that machinery is applied to.
 */
import type { GitOp } from "../git_authorization_hook.js";

/**
 * Prose phrases, German and English, that authorize a consequence operation.
 *
 * Spliced into `PHRASES` at its definition, so every row inherits the
 * interrogative filter, the clause-scoped negation check and the fenced-paste
 * split rather than reimplementing them.
 *
 * Every row REQUIRES ITS OBJECT NOUN, and that is why the patterns are long. A
 * bare verb cannot tell an authorization from a mention, and for this class the
 * mention is the common case: "deploy" appears in a hundred sentences that
 * authorize nothing, while "deploy nach production" appears only when someone
 * means it.
 *
 * German verb endings are `(e|en)?` because the imperative drops its `-e`, and
 * both word orders are covered — the house style stated above `PHRASES`. The
 * leading boundary is an explicit character class rather than `\b`: JavaScript's
 * `\b` is ASCII-only, so a word STARTING with an umlaut ("Ändere") has no
 * boundary before it and the row silently never fires.
 */
export const CONSEQUENCE_PHRASES: ReadonlyArray<{ op: GitOp; re: RegExp }> = [
  {
    op: "prod-deploy",
    re: /(?<![A-Za-z0-9_À-ɏ])(deploy(e|en|t|st)?|ausroll(e|en)?|ship(pe|pen)?|live\s*schalt(e|en)?|rollout)\b[^.\n]{0,30}\b(produktion|production|prod|live|prod-umgebung)\b|\b(produktion|production|prod|live)\b[^.\n]{0,30}\b(deploy(e|en)?|ausrollen|ausroll(e|en)?|live\s*schalten|rollout)\b/i,
  },
  {
    op: "prod-data-destroy",
    re: /(?<![A-Za-z0-9_À-ɏ])(l(ö|oe)sch(e|en)?|entfern(e|en)?|leer(e|en)?|verwerf(e|en)?|drop|truncate|delete|wipe|purge|zerst(ö|oe)r(e|en)?)\b[^.\n]{0,40}\b(tabelle|tabellen|datenbank|daten|bucket|collection|zeilen|rows|table|database|dataset)\b|\b(tabelle|tabellen|datenbank|daten|bucket|collection|table|database)\b[^.\n]{0,40}\b(l(ö|oe)schen|leeren|verwerfen|droppen|truncaten|entfernen|drop|truncate|delete|wipe|purge)\b/i,
  },
  {
    op: "prod-infra-change",
    re: /(?<![A-Za-z0-9_À-ɏ])((ver)?(ä|ae)nder(e|n)?|anpass(e|en)?|umbau(e|en)?|apply|destroy|(neu\s*)?provisionier(e|en)?)\b[^.\n]{0,40}\b(infrastruktur|infrastructure|cluster|terraform|iam|dns|netzwerk|network|firewall|policy|policies|security[-\s]group)\b|\b(infrastruktur|infrastructure|cluster|terraform|iam|dns|netzwerk|firewall)\b[^.\n]{0,40}\b((ver)?(ä|ae)ndern|anpassen|umbauen|zerst(ö|oe)ren|apply|destroy)\b/i,
  },
  {
    op: "external-send",
    re: /(?<![A-Za-z0-9_À-ɏ])(schick(e|en)?|verschick(e|en)?|send(e|en|et)?|mail(e|en)?|raussend(e|en)?|versend(e|en)?|post|publish)\b[^.\n]{0,40}\b(mail|mails|email|e-mail|nachricht|nachrichten|newsletter|webhook|kunden|kundin|kunde|empf(ä|ae)nger|customers?|recipients?|message)\b|\b(mail|email|e-mail|nachricht|newsletter|kunden|customers?)\b[^.\n]{0,40}\b(schicken|verschicken|senden|versenden|rausschicken|send|deliver)\b/i,
  },
  {
    op: "money-movement",
    re: /(?<![A-Za-z0-9_À-ɏ])(erstatt(e|en)?|r(ü|ue)ckerstatt(e|en)?|zahl(e|en)?|(ü|ue)berweis(e|en)?|abbuch(e|en)?|belast(e|en)?|refund|charge|payout|transfer|bill)\b[^.\n]{0,40}\b(betrag|geld|rechnung|zahlung|euro|dollar|kunde|kunden|karte|konto|invoice|payment|customer|card|account)\b|\b(betrag|geld|rechnung|zahlung|invoice|payment)\b[^.\n]{0,40}\b(erstatten|zur(ü|ue)ckzahlen|(ü|ue)berweisen|abbuchen|belasten|refund|charge|transfer)\b/i,
  },
  {
    op: "trunk-force-push",
    re: /(?<![A-Za-z0-9_À-ɏ])(force[-\s]?push(e|en|t)?|force[-\s]?pushen|(ü|ue)berschreib(e|en)?)\b[^.\n]{0,40}\b(main|master|trunk|produktions?[-\s]?branch|production|release[-\s]?branch)\b|\b(main|master|trunk|production)\b[^.\n]{0,40}\b(force[-\s]?pushen|force[-\s]?push|(ü|ue)berschreiben)\b/i,
  },
  {
    op: "out-of-scope-destruction",
    re: /(?<![A-Za-z0-9_À-ɏ])(l(ö|oe)sch(e|en)?|entfern(e|en)?|r(ä|ae)um(e|en)?\s*auf|aufr(ä|ae)um(e|en)?|delete|remove|wipe)\b[^.\n]{0,40}\b(au(ß|ss)erhalb|ausserhalb|unabh(ä|ae)ngig|nicht\s+zur\s+aufgabe|outside\s+(the\s+)?(task|scope)|unrelated|everything\s+else|alles\s+andere)\b|\b(au(ß|ss)erhalb|outside\s+(the\s+)?(task|scope)|unrelated)\b[^.\n]{0,40}\b(l(ö|oe)schen|entfernen|aufr(ä|ae)umen|delete|remove|wipe)\b/i,
  },
];

/**
 * Operations whose authorization is meaningless without its object.
 *
 * "Delete the table" is not an authorization to delete a table; it is an
 * authorization to delete THAT table. The same holds for a recipient class and
 * for a payment. The other four consequence operations are environment-scoped
 * rather than object-scoped, so an object is recorded for them when the prose
 * names one and never required.
 */
export const OBJECT_REQUIRED_OPS: ReadonlySet<GitOp> = new Set<GitOp>([
  "prod-data-destroy",
  "external-send",
  "money-movement",
]);

/**
 * Words that can follow an object noun and are never the object's NAME.
 *
 * "Lösch die Tabelle bitte" names no table; the extractor's next-token rule
 * captures `bitte` unless something says otherwise. A stop list is the honest
 * shape for that — the same reviewable-keyword-list discipline the negation and
 * pasted-output vocabularies above use, and for the same reason: a parser that
 * guessed here would record a fabricated object, and a fabricated object is
 * worse than a missing one because the conformance count treats a recorded
 * object as an authorization the turn actually gave.
 */
const OBJECT_STOP_WORDS: ReadonlySet<string> = new Set([
  "bitte", "doch", "mal", "nicht", "jetzt", "gleich", "auch", "noch", "wieder",
  "in", "im", "aus", "von", "vom", ": ", "der", "die", "das", "den", "dem",
  "und", "oder", "mit", "auf", "zu", "komplett", "ganz", "alle", "allen",
  "please", "now", "again", "too", "also", "from", "and", "or", "the", "a",
  "an", "there", "here", "completely", "all", "with", "on", "to", "in",
]);

/** Lower-case, strip surrounding quotes and trailing punctuation. */
function _normalizeObject(raw: string): string {
  return raw.trim().replace(/^["'`]+|["'`]+$/g, "").replace(/[.,;:]+$/, "").toLowerCase();
}

/** Per-operation object patterns, each with the capture group that holds it. */
const OBJECT_PATTERNS: Readonly<Record<string, readonly RegExp[]>> = {
  "prod-data-destroy": [
    /\b(?:tabelle|table|datenbank|database|schema|collection|index)\s+["'`]?([A-Za-z_][\w.$-]*)/gi,
    /\bs3:\/\/([\w.-]+)/gi,
    /\b(?:bucket)\s+["'`]?([A-Za-z_][\w.-]*)/gi,
  ],
  "external-send": [
    /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    /\bhttps?:\/\/([^\s/"'`]+)/gi,
    /\b(?:an\s+(?:die|den|alle)|to\s+(?:the|all))\s+([A-Za-z][\w-]*)/gi,
  ],
  "money-movement": [
    /(\d[\d.,]*)\s*(?:€|eur\b|euro\b|\$|usd\b)/gi,
    /(?:€|\$)\s*(\d[\d.,]*)/g,
    /\b(?:kunde|kunden|customer|account|konto)\s+["'`]?([A-Za-z0-9][\w.-]*)/gi,
  ],
};

/**
 * The objects a sentence names for one operation.
 *
 * Returns `[]` when the prose names none — which is a real answer and the one
 * `conformance_scan` reads as "the record does not name this object". An empty
 * list is never widened into a wildcard.
 */
export function extractObjects(op: GitOp, text: string): string[] {
  const patterns = OBJECT_PATTERNS[op];
  if (!patterns) return [];
  const out: string[] = [];
  for (const re of patterns) {
    const local = new RegExp(re.source, re.flags.includes("g") ? re.flags : `${re.flags}g`);
    let m: RegExpExecArray | null;
    while ((m = local.exec(text)) !== null) {
      const value = _normalizeObject(m[1] ?? "");
      if (value && !OBJECT_STOP_WORDS.has(value) && !out.includes(value)) out.push(value);
      if (m.index === local.lastIndex) local.lastIndex++;
    }
  }
  return out;
}
