/**
 * GENERATED projection of `CREDENTIAL_PREFIXES` from the rule table
 * (`egress_rules.ts`) — never edit by hand.
 *
 * It exists so a module the dispatch bundle carries can read the raw-key prefix
 * list without pulling the whole engine into that bundle (the engine is a
 * conditional chunk, `hooks/egress_engine_loader.ts`). `egress_prefixes.test.ts`
 * fails when this list and the table's differ and prints the body to paste, so
 * the table stays the one place a prefix is decided.
 */
export const CREDENTIAL_PREFIXES: readonly string[] = [
    'github_pat_',
    'sk-proj-',
    'sk_live_',
    'sk_test_',
    'sk-ant-',
    'ya29.',
    'pplx-',
    'xoxb-',
    'xoxp-',
    'xoxa-',
    'xoxr-',
    'xoxs-',
    'AKIA',
    'AIza',
    'ghp_',
    'gho_',
    'ghu_',
    'ghs_',
    'ghr_',
    'xai-',
    'gsk_',
    'sk-',
];
