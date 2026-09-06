/**
 * The consequence vocabulary — recorded, counted, and refusing nothing.
 *
 * The boundaries the owner named had no vocabulary at all, so an authorization
 * given in plain words was invisible to the advisory ledger and the matching
 * operation was invisible to the conformance count.
 *
 * WHAT THIS IS NOT. ADR-254 deleted the enforcing reader; the ledger concern
 * that survived is advisory by manifest, and the only consumer that acts on
 * this vocabulary is the after-the-fact tally in `conformance_scan`. Nothing
 * here refuses, and the test names say so deliberately — the Risk Register's
 * rank-3 item is that a later reader mistakes a wider record for a wider gate.
 */
import { describe, expect, it } from 'vitest';

import {
    ALL_OPS,
    classifyAuthorization,
    extractObjects,
    OBJECT_REQUIRED_OPS,
    type GitOp,
} from '../../src/scripts/git_authorization_hook.js';
import {
    BLOCK_OPS,
    commandObject,
    commandOp,
} from '../../src/scripts/hooks/git_command_classifier.js';

const CONSEQUENCE_OPS: GitOp[] = [
    'prod-deploy',
    'prod-data-destroy',
    'prod-infra-change',
    'external-send',
    'money-movement',
    'trunk-force-push',
    'out-of-scope-destruction',
];

describe('all seven boundaries the owner named exist in the vocabulary', () => {
    it.each(CONSEQUENCE_OPS)('%s is in ALL_OPS', (op) => {
        expect(ALL_OPS).toContain(op);
    });

    it('there are exactly seven of them', () => {
        expect(CONSEQUENCE_OPS).toHaveLength(7);
    });
});

describe('a prompt naming a consequence operation records it — German and English', () => {
    const CASES: Array<[GitOp, string, string]> = [
        ['prod-deploy', 'de', 'Deploy das nach production.'],
        ['prod-deploy', 'en', 'Ship this to production now.'],
        ['prod-data-destroy', 'de', 'Bitte lösche die Tabelle orders in der Produktionsdatenbank.'],
        ['prod-data-destroy', 'en', 'Please drop the orders table in production.'],
        ['prod-infra-change', 'de', 'Ändere die Infrastruktur im Cluster.'],
        ['prod-infra-change', 'en', 'Apply the terraform infrastructure change.'],
        ['external-send', 'de', 'Schick die Mail an die Kunden raus.'],
        ['external-send', 'en', 'Send the newsletter email to the customers.'],
        ['money-movement', 'de', 'Erstatte dem Kunden den Betrag.'],
        ['money-movement', 'en', 'Refund the customer payment.'],
        ['trunk-force-push', 'de', 'Force-push main bitte.'],
        ['trunk-force-push', 'en', 'Force-push main.'],
        ['out-of-scope-destruction', 'de', 'Lösch auch alles andere außerhalb der Aufgabe.'],
        ['out-of-scope-destruction', 'en', 'Delete everything else outside the task.'],
    ];

    it.each(CASES)('%s (%s)', (op, _lang, prompt) => {
        expect(classifyAuthorization(prompt).authorized).toContain(op);
    });
});

describe('a prompt that does NOT authorize records nothing', () => {
    // Three exclusions the extended vocabulary inherits from the existing
    // machinery rather than reimplementing: the interrogative filter, the
    // clause-scoped negation check, and the fenced-paste split.
    const SILENT: Array<[string, string]> = [
        ['a question about the operation', 'Was macht ein drop der orders Tabelle in production eigentlich?'],
        ['an English question', 'What would dropping the orders table in production do?'],
        ['a German negation', 'Lösche auf keinen Fall die Tabelle orders in production.'],
        ['an English negation', 'Do not drop the orders table in production.'],
        ['a negated deploy', 'Deploy das nicht nach production.'],
        ['a fenced paste of the command', 'Here is what I ran:\n```\npsql -c "DROP TABLE orders"\n```\nWhy did it fail?'],
        ['a fenced deploy transcript', '```\nterraform apply\n```\nthis errored, why?'],
        ['a bare verb with no object noun', 'Can you deploy this branch?'],
        ['a bare send with no object noun', 'Send it over when you are done.'],
    ];

    it.each(SILENT)('%s', (_name, prompt) => {
        const authorized = classifyAuthorization(prompt).authorized;
        for (const op of CONSEQUENCE_OPS) {
            expect(authorized, `${op} leaked from: ${prompt}`).not.toContain(op);
        }
    });
});

describe('the command side classifies what the count could not see before', () => {
    const CASES: Array<[string, GitOp]> = [
        ['terraform apply', 'prod-infra-change'],
        ['terraform destroy', 'prod-infra-change'],
        ['kubectl delete pod api-7', 'prod-infra-change'],
        ['helm upgrade api ./chart', 'prod-infra-change'],
        ['psql -c "DROP TABLE orders"', 'prod-data-destroy'],
        ['aws s3 rm s3://prod-assets --recursive', 'prod-data-destroy'],
        ['redis-cli flushall', 'prod-data-destroy'],
        ['vercel deploy --prod', 'prod-deploy'],
        ['flyctl deploy', 'prod-deploy'],
        ['curl -X POST https://api.example.com/send', 'external-send'],
        ['sendmail -t', 'external-send'],
        ['stripe refunds create', 'money-movement'],
        ['rm -rf /var/data', 'out-of-scope-destruction'],
        ['git push --force origin main', 'trunk-force-push'],
    ];

    it.each(CASES)('%s → %s', (cmd, op) => {
        expect(commandOp(cmd)).toBe(op);
    });

    it('a force-push on a FEATURE branch is still plain force-push', () => {
        // The other half of the trunk refinement. Without this row a classifier
        // that answered `trunk-force-push` for every force-push would pass.
        expect(commandOp('git push --force-with-lease origin feature/x')).toBe('force-push');
    });

    it('an ordinary read classifies as nothing', () => {
        expect(commandOp('ls -la')).toBeNull();
        expect(commandOp('git status')).toBeNull();
        expect(commandOp('terraform plan')).toBeNull();
    });
});

describe('the object an authorization names', () => {
    it('is required for exactly the three operations whose object IS the authorization', () => {
        expect([...OBJECT_REQUIRED_OPS].sort()).toEqual([
            'external-send',
            'money-movement',
            'prod-data-destroy',
        ]);
    });

    it('reads a table name out of the prose', () => {
        expect(extractObjects('prod-data-destroy', 'lösch die Tabelle orders in production')).toContain('orders');
    });

    it('reads a bucket out of the prose', () => {
        expect(extractObjects('prod-data-destroy', 'delete s3://prod-assets')).toContain('prod-assets');
    });

    it('reads a recipient out of the prose', () => {
        expect(extractObjects('external-send', 'send the mail to ops@example.com')).toContain('ops@example.com');
    });

    it('reads an amount out of the prose', () => {
        expect(extractObjects('money-movement', 'erstatte 250 EUR')).toContain('250');
    });

    it('names nothing when the prose names nothing — never a wildcard', () => {
        expect(extractObjects('prod-data-destroy', 'lösch das bitte')).toEqual([]);
    });

    it('reads the object off the command too, normalised the same way', () => {
        expect(commandObject('prod-data-destroy', 'psql -c "DROP TABLE Orders"')).toBe('orders');
        expect(commandObject('prod-data-destroy', 'psql -c "TRUNCATE sessions"')).toBe('sessions');
        expect(commandObject('prod-data-destroy', 'aws s3 rm s3://prod-assets')).toBe('prod-assets');
        expect(commandObject('external-send', 'curl -X POST https://api.example.com/x')).toBe('api.example.com');
    });

    it('a command naming no object reports null rather than a guess', () => {
        // Fail-closed for a measurement: a guessed object would manufacture a
        // violation out of a parse failure.
        expect(commandObject('prod-data-destroy', 'psql -f cleanup.sql')).toBeNull();
    });

    it('an operation outside the object vocabulary has no objects to read', () => {
        expect(extractObjects('commit', 'commit the orders table changes')).toEqual([]);
        expect(commandObject('commit', 'git commit -m x')).toBeNull();
    });
});

describe('the record is a record — nothing here refuses', () => {
    it('the consequence ops sit in BLOCK_OPS, which after ADR-254 only counts', () => {
        // BLOCK_OPS has exactly one consumer that acts on it: the after-the-fact
        // tally in `conformance_scan`. Membership is a counting decision.
        for (const op of CONSEQUENCE_OPS) {
            expect(BLOCK_OPS.has(op)).toBe(true);
        }
    });

    it('classifyAuthorization returns a record and no verdict', () => {
        const r = classifyAuthorization('deploy das nach production');
        expect(Object.keys(r).sort()).toEqual(['authorized', 'evidence']);
        expect(r.evidence['prod-deploy']).toContain('prose:');
    });
});
