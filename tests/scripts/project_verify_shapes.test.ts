import { describe, expect, it } from 'vitest';

import { containerExecCommand, isVerificationCommandInContainer } from '../../src/scripts/_lib/project_verify_shapes.js';
import { isVerificationCommand } from '../../src/scripts/_lib/verification_command.js';

/** A verifier run inside a container (retro F2). */
const CONTAINER_POSITIVES: readonly string[] = [
    'docker exec -w /app api vendor/bin/pest --filter UserTest',
    'docker compose exec app php artisan test',
    'docker-compose exec -T app composer test',
    'docker exec -it --user www app ./vendor/bin/phpunit',
    'docker exec --workdir=/app api pytest -q',
    'sudo docker exec api vendor/bin/pest',
];

/** Container shapes that run no verifier, or whose words cannot all be read. */
const CONTAINER_NEGATIVES: readonly string[] = [
    'docker exec app ls tests',
    'docker exec app cat test.log',
    "docker exec app sh -c 'vendor/bin/pest'",
    'docker run --rm app vendor/bin/pest',
    'docker exec --unknown-flag app vendor/bin/pest',
    'docker exec -w',
    'docker exec api',
    'docker exec api vendor/bin/pest || true',
];

/**
 * F2 shapes council D5 left unrecognised: a repository-named script says
 * nothing about what it runs, and `sail` / `container exec` / `podman exec`
 * forward with grammars not pinned here.
 */
const UNRESOLVED_BY_D5: readonly string[] = [
    'tools/test',
    './tools/test',
    'python3 scripts/check_links.py',
    './agent-config roadmap:progress-check',
    'vendor/bin/sail test',
    'podman exec api pytest -q',
];

describe('verifier inside a container', () => {
    it.each(CONTAINER_POSITIVES)('accepts %s', (cmd) => {
        expect(isVerificationCommandInContainer(cmd)).toBe(true);
    });

    it.each(CONTAINER_POSITIVES.slice(0, 2))('the live predicate does not see %s (unwired gap)', (cmd) => {
        expect(isVerificationCommand(cmd)).toBe(false);
    });

    it.each(CONTAINER_NEGATIVES)('refuses %s', (cmd) => {
        expect(isVerificationCommandInContainer(cmd)).toBe(false);
    });

    it.each(UNRESOLVED_BY_D5)('leaves %s unrecognised', (cmd) => {
        expect(isVerificationCommandInContainer(cmd)).toBe(false);
    });

    it('keeps everything the live predicate already accepts', () => {
        for (const cmd of ['vendor/bin/pest', 'npx vitest run x', 'task ci', 'php artisan test']) {
            expect(isVerificationCommandInContainer(cmd)).toBe(true);
        }
    });

    it('reads exec options by arity before the container name', () => {
        expect(containerExecCommand(['docker', 'exec', '-w', '/app', '-e', 'A=1', 'api', 'pest'])).toEqual(['pest']);
        expect(containerExecCommand(['docker', 'compose', 'exec', '--index', '2', 'app', 'ls'])).toEqual(['ls']);
        expect(containerExecCommand(['docker', 'exec', '-it', 'api', 'pest'])).toEqual(['pest']);
        expect(containerExecCommand(['docker', 'exec', '-x', 'api', 'pest'])).toBeNull();
        expect(containerExecCommand(['docker', 'run', 'api', 'pest'])).toBeNull();
    });
});
