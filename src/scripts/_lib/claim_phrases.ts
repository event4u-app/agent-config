/**
 * Claim-phrase registry for `check_voice_lexicon` (brand-checkability roadmap 5.3).
 *
 * Static, literal, multi-word PHRASES — never bare words. A single word such as
 * "only" or "best" is ordinary prose far too often to mean a claim (NG-10); a
 * phrase like "industry-leading" or "the number one platform" is a claim that
 * needs a proof. A hit is advisory: the finding says "needs proof", never
 * "unlawful".
 *
 * PRE-REGISTERED: this list was frozen before each measurement. v1 missed the
 * bar on `tests/fixtures/voice-lexicon/negative-corpus.txt`; v2 drops the four
 * English single-word entries NG-10 already excludes and is measured on
 * `negative-corpus-v2.txt`, a corpus it was not revised against (bar ≤ 0.1 hits
 * per 10k words). Changing it re-opens the measurement.
 *
 * German phrases run at `hint` severity until a German negative corpus is
 * registered (E5, 5.3).
 */

export type ClaimClass = 'superlative' | 'comparative' | 'absolute' | 'certification' | 'guarantee';

export interface ClaimPhrase {
    phrase: string;
    cls: ClaimClass;
    language: 'en' | 'de';
}

const en = (cls: ClaimClass, ...phrases: string[]): ClaimPhrase[] =>
    phrases.map((phrase) => ({ phrase, cls, language: 'en' as const }));
const de = (cls: ClaimClass, ...phrases: string[]): ClaimPhrase[] =>
    phrases.map((phrase) => ({ phrase, cls, language: 'de' as const }));

export const CLAIM_PHRASES: readonly ClaimPhrase[] = [
    ...en(
        'superlative',
        'number one',
        'no. 1',
        "world's best",
        "world's leading",
        'world-leading',
        'world-class',
        'industry-leading',
        'industry leading',
        'market-leading',
        'market leader',
        'best-in-class',
        'best in class',
        'best-of-breed',
        'the leading provider',
        'the leading platform',
        'second to none',
    ),
    ...en(
        'comparative',
        'faster than any',
        'better than any',
        'cheaper than any',
        'more secure than any',
        'outperforms all',
        'outperforms every',
        'beats every',
    ),
    ...en('absolute', 'never fails', 'zero downtime', '100% secure', '100% uptime', '100% accurate', 'completely secure'),
    ...en('certification', 'officially certified', 'award-winning', 'award winning', 'clinically proven', 'scientifically proven'),
    ...en('guarantee', 'guaranteed results', 'guaranteed to work', 'we guarantee', 'money-back guarantee', 'risk-free'),
    ...de('superlative', 'nummer eins', 'marktführer', 'weltweit führend', 'branchenführend', 'unschlagbar', 'unübertroffen'),
    ...de('comparative', 'schneller als jede', 'besser als jede', 'günstiger als jede'),
    ...de('absolute', '100 % sicher', '100% sicher', 'absolut sicher', 'null ausfallzeit'),
    ...de('certification', 'preisgekrönt', 'klinisch bewiesen', 'wissenschaftlich bewiesen'),
    ...de('guarantee', 'garantiert', 'geld-zurück-garantie', 'risikofrei'),
];
